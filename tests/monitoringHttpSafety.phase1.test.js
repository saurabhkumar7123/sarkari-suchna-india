"use strict";

/**
 * Phase-1 monitoring HTTP safety foundation unit tests.
 * Does not require BullMQ / Redis 5+.
 */

jest.mock("../server/repositories/enterprise/auditEnterprise.repository", () => ({
  recordEvent: jest.fn().mockResolvedValue({ id: 1 }),
  isReady: jest.fn().mockResolvedValue(false),
  listEvents: jest.fn()
}));

const axios = require("axios");
const {
  monitoringSafeGet,
  monitoringSafeRequest,
  assertMonitoringHttpMethodAllowed,
  assertUrlPolicy,
  fetchWithSafeRedirects,
  MonitoringHttpSafetyError,
  DEFAULT_MAX_HTML_BYTES,
  getMaxHtmlBytes
} = require("../server/services/updates/monitoringHttpSafety");
const {
  isAutomationExecutionPermitted,
  getMasterControlState
} = require("../server/config/automationKillSwitch");
const {
  canEnqueueLiveCrawlerJobs,
  canRunAutomationWorkers,
  canDeliverTelegram,
  isAutomationDormant,
  getAutomationFlags
} = require("../server/config/automationFlags");
const { recordEvent } = require("../server/repositories/enterprise/auditEnterprise.repository");
const { extractLatestItems } = require("../server/services/updates/siteChecker");

describe("monitoring HTTP safety — methods", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    recordEvent.mockClear();
  });

  test("GET is allowed by method firewall", async () => {
    await expect(assertMonitoringHttpMethodAllowed("GET")).resolves.toBe("GET");
    await expect(assertMonitoringHttpMethodAllowed("get")).resolves.toBe("GET");
  });

  test.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s is blocked before any network call",
    async (method) => {
      const spy = jest.spyOn(axios, "get").mockResolvedValue({ status: 200, data: "nope", headers: {} });
      await expect(
        monitoringSafeRequest("https://ssc.gov.in/notices", { method, allowWhenAutomationDormant: true })
      ).rejects.toMatchObject({
        name: "MonitoringHttpSafetyError",
        code: "BLOCKED_HTTP_METHOD",
        blocked: true
      });
      expect(spy).not.toHaveBeenCalled();
      expect(recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "BLOCKED_HTTP_METHOD",
          status: "blocked",
          detail: expect.objectContaining({
            result: "BLOCKED",
            requestedMethod: method
          })
        })
      );
    }
  );
});

describe("monitoring HTTP safety — URL policy", () => {
  test("malformed URL fails closed", () => {
    expect(() => assertUrlPolicy("not a url")).toThrow(MonitoringHttpSafetyError);
  });

  test("unsupported protocol fails closed", () => {
    expect(() => assertUrlPolicy("ftp://ssc.gov.in/x")).toThrow(/http or https/i);
  });

  test("unapproved host fails closed", () => {
    expect(() => assertUrlPolicy("https://example.com/jobs")).toThrow(/approved official/i);
  });

  test("approved official host passes", () => {
    expect(assertUrlPolicy("https://ssc.gov.in/notices").hostname).toMatch(/ssc\.gov\.in/);
  });

  test("private host fails closed", () => {
    expect(() => assertUrlPolicy("http://127.0.0.1/")).toThrow(/private/i);
  });
});

describe("monitoring HTTP safety — redirects", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    recordEvent.mockClear();
  });

  test("same approved host redirect is allowed", async () => {
    jest.spyOn(axios, "get").mockImplementation(async (url) => {
      if (url === "https://ssc.gov.in/old") {
        return {
          status: 302,
          headers: { location: "https://ssc.gov.in/notices" },
          data: ""
        };
      }
      return { status: 200, headers: {}, data: "<html>ok</html>" };
    });

    const result = await fetchWithSafeRedirects("https://ssc.gov.in/old", {
      allowWhenAutomationDormant: true
    });
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe("https://ssc.gov.in/notices");
    expect(result.redirectChain.length).toBeGreaterThanOrEqual(2);
  });

  test("www to apex same host is allowed", async () => {
    jest.spyOn(axios, "get").mockImplementation(async (url) => {
      if (String(url).includes("www.upsc.gov.in")) {
        return {
          status: 301,
          headers: { location: "https://upsc.gov.in/whats-new" },
          data: ""
        };
      }
      return { status: 200, headers: {}, data: "<html>upsc</html>" };
    });

    const result = await fetchWithSafeRedirects("https://www.upsc.gov.in/", {
      allowWhenAutomationDormant: true
    });
    expect(result.finalUrl).toBe("https://upsc.gov.in/whats-new");
  });

  test("approved → unapproved host redirect is blocked without fetching destination", async () => {
    const spy = jest.spyOn(axios, "get").mockImplementation(async (url) => {
      if (String(url).includes("ssc.gov.in")) {
        return {
          status: 302,
          headers: { location: "https://evil.example/phish" },
          data: ""
        };
      }
      throw new Error("should not fetch unapproved host");
    });

    await expect(
      fetchWithSafeRedirects("https://ssc.gov.in/notices", { allowWhenAutomationDormant: true })
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });

    const fetchedHosts = spy.mock.calls.map((c) => String(c[0]));
    expect(fetchedHosts.some((u) => u.includes("evil.example"))).toBe(false);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "UNSAFE_REDIRECT",
        status: "blocked"
      })
    );
  });

  test("cross-org official redirect is blocked (ssc → upsc)", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 302,
      headers: { location: "https://upsc.gov.in/" },
      data: ""
    });

    await expect(
      fetchWithSafeRedirects("https://ssc.gov.in/notices", { allowWhenAutomationDormant: true })
    ).rejects.toMatchObject({ code: "UNSAFE_REDIRECT" });
  });
});

describe("monitoring HTTP safety — response size", () => {
  const original = process.env.UPDATE_MAX_HTML_BYTES;

  afterEach(() => {
    if (original === undefined) delete process.env.UPDATE_MAX_HTML_BYTES;
    else process.env.UPDATE_MAX_HTML_BYTES = original;
    jest.restoreAllMocks();
  });

  test("default max is 2 MiB", () => {
    delete process.env.UPDATE_MAX_HTML_BYTES;
    expect(getMaxHtmlBytes()).toBe(DEFAULT_MAX_HTML_BYTES);
    expect(DEFAULT_MAX_HTML_BYTES).toBe(2 * 1024 * 1024);
  });

  test("within limit is allowed", async () => {
    process.env.UPDATE_MAX_HTML_BYTES = "1024";
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      headers: {},
      data: "x".repeat(100)
    });
    const result = await fetchWithSafeRedirects("https://ssc.gov.in/n", {
      maxBytes: 1024,
      allowWhenAutomationDormant: true
    });
    expect(result.status).toBe(200);
  });

  test("over limit is blocked", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      headers: {},
      data: "x".repeat(5000)
    });
    await expect(
      fetchWithSafeRedirects("https://ssc.gov.in/n", {
        maxBytes: 100,
        allowWhenAutomationDormant: true
      })
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "RESPONSE_TOO_LARGE", status: "blocked" })
    );
  });
});

describe("automation kill switch foundation", () => {
  const prevMaster = process.env.AUTOMATION_MASTER_ENABLED;
  const prevStop = process.env.AUTOMATION_EMERGENCY_STOP;
  const prevMon = process.env.PRODUCTION_MONITORING_ENABLED;
  const prevSched = process.env.SCHEDULER_ACTIVATION_ENABLED;
  const prevCrawl = process.env.LIVE_CRAWLER_ENABLED;
  const prevWorker = process.env.WORKER_ACTIVATION_ENABLED;
  const prevGw = process.env.NOTIFICATION_GATEWAY_ENABLED;
  const prevTg = process.env.TELEGRAM_DELIVERY_ENABLED;

  afterEach(() => {
    const restore = (key, val) => {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    };
    restore("AUTOMATION_MASTER_ENABLED", prevMaster);
    restore("AUTOMATION_EMERGENCY_STOP", prevStop);
    restore("PRODUCTION_MONITORING_ENABLED", prevMon);
    restore("SCHEDULER_ACTIVATION_ENABLED", prevSched);
    restore("LIVE_CRAWLER_ENABLED", prevCrawl);
    restore("WORKER_ACTIVATION_ENABLED", prevWorker);
    restore("NOTIFICATION_GATEWAY_ENABLED", prevGw);
    restore("TELEGRAM_DELIVERY_ENABLED", prevTg);
    jest.restoreAllMocks();
  });

  test("default master control is dormant / not permitted", () => {
    delete process.env.AUTOMATION_MASTER_ENABLED;
    delete process.env.AUTOMATION_EMERGENCY_STOP;
    expect(isAutomationExecutionPermitted()).toBe(false);
    expect(getMasterControlState().masterEnabled).toBe(false);
    expect(isAutomationDormant()).toBe(true);
  });

  test("kill switch OFF blocks enqueue / worker / telegram even if capability flags ON", () => {
    process.env.AUTOMATION_MASTER_ENABLED = "0";
    process.env.PRODUCTION_MONITORING_ENABLED = "1";
    process.env.SCHEDULER_ACTIVATION_ENABLED = "1";
    process.env.LIVE_CRAWLER_ENABLED = "1";
    process.env.WORKER_ACTIVATION_ENABLED = "1";
    process.env.NOTIFICATION_GATEWAY_ENABLED = "1";
    process.env.TELEGRAM_DELIVERY_ENABLED = "1";

    expect(isAutomationExecutionPermitted()).toBe(false);
    expect(canEnqueueLiveCrawlerJobs()).toBe(false);
    expect(canRunAutomationWorkers()).toBe(false);
    expect(canDeliverTelegram()).toBe(false);
    expect(getAutomationFlags().AUTOMATION_MASTER_ENABLED).toBe(false);
  });

  test("live HTTP fetch blocked when master off (no network)", async () => {
    process.env.AUTOMATION_MASTER_ENABLED = "0";
    const spy = jest.spyOn(axios, "get").mockResolvedValue({ status: 200, data: "x", headers: {} });
    await expect(monitoringSafeGet("https://ssc.gov.in/")).rejects.toMatchObject({
      code: "AUTOMATION_KILL_SWITCH"
    });
    expect(spy).not.toHaveBeenCalled();
  });

  test("admin verify path can fetch while dormant via allowWhenAutomationDormant", async () => {
    process.env.AUTOMATION_MASTER_ENABLED = "0";
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      headers: {},
      data: "<html>ok</html>"
    });
    const result = await monitoringSafeGet("https://ssc.gov.in/", {
      allowWhenAutomationDormant: true
    });
    expect(result.status).toBe(200);
  });

  test("emergency stop blocks even if master env is 1", () => {
    process.env.AUTOMATION_MASTER_ENABLED = "1";
    process.env.AUTOMATION_EMERGENCY_STOP = "1";
    expect(isAutomationExecutionPermitted()).toBe(false);
  });
});

describe("selector no-guessing policy", () => {
  test("exact selector miss returns selector_miss without guessing", () => {
    const html = `<html><body>
      <a href="/whats-new/Exam/Notice">Notice: Engineering Services</a>
    </body></html>`;
    const extracted = extractLatestItems(html, {
      id: 2,
      name: "UPSC",
      url: "https://www.upsc.gov.in/",
      selector: 'a[href*="notice"]'
    });
    expect(extracted).toEqual({ invalid: true, reason: "selector_miss" });
  });

  test("exact matching selector still works", () => {
    const html = `<html><body>
      <a href="/notice/example.pdf">UPSC Latest Notice Title Here</a>
    </body></html>`;
    const extracted = extractLatestItems(html, {
      id: 2,
      name: "UPSC",
      url: "https://upsc.gov.in/",
      selector: 'a[href*="notice"]'
    });
    expect(extracted.invalid).toBeUndefined();
    expect(extracted.items[0].title).toMatch(/UPSC Latest Notice/i);
  });
});
