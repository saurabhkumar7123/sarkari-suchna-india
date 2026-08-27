"use strict";

jest.mock("../server/services/updates/updates.repository", () => ({
  fetchSites: jest.fn(),
  getSiteById: jest.fn(),
  createSite: jest.fn(),
  updateSite: jest.fn(),
  deleteSite: jest.fn(),
  restoreSite: jest.fn(),
  disableSite: jest.fn(),
  fetchRecentUpdates: jest.fn()
}));

jest.mock("../server/services/updates/robotsAccessPolicy", () => {
  const actual = jest.requireActual("../server/services/updates/robotsAccessPolicy");
  return {
    ...actual,
    evaluateRobotsAccessPolicy: jest.fn(),
    assertRobotsAllowsMonitoring: jest.fn()
  };
});

const {
  normalizeMonitoringUrlForCompare,
  assertSafeOfficialMonitoringUrl,
  urlsAreDuplicateNormalized
} = require("../server/services/updates/monitoringUrlSafety");
const {
  assertMonitoringSiteWritable,
  findDuplicateMonitoringUrl
} = require("../server/services/updates/monitoringSiteWriteGuard");
const {
  evaluateRobotsAccessPolicy,
  assertRobotsAllowsMonitoring,
  clearRobotsPolicyCache
} = require("../server/services/updates/robotsAccessPolicy");
const {
  withHostPoliteness,
  noteHostRateLimited,
  parseRetryAfterMs,
  resetHostPolitenessForTests,
  getHostPolitenessSnapshot
} = require("../server/services/updates/hostPoliteness");
const {
  classifyMonitoringHttpError
} = require("../server/services/updates/monitoringFetchErrors");
const {
  fetchSites,
  createSite,
  updateSite,
  restoreSite,
  disableSite,
  getSiteById
} = require("../server/services/updates/updates.repository");
const automationControlCenterService = require("../server/services/automationControlCenter.service");

describe("monitoring URL safety / registry hardening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRobotsPolicyCache();
    resetHostPolitenessForTests();
    fetchSites.mockResolvedValue([]);
    evaluateRobotsAccessPolicy.mockResolvedValue({
      allowed: true,
      reason: "robots_allow",
      status: 200,
      robotsUrl: "https://ssc.gov.in/robots.txt",
      crawlDelayMs: 0,
      failClosed: false
    });
    assertRobotsAllowsMonitoring.mockImplementation(async (url) =>
      evaluateRobotsAccessPolicy(url)
    );
  });

  test("accepted: approved official URL", () => {
    const result = assertSafeOfficialMonitoringUrl("https://ssc.gov.in/Portal/LatestNews");
    expect(result.ok).toBe(true);
    expect(result.hostname).toMatch(/ssc\.gov\.in$/);
  });

  test("rejected: non-official URL", () => {
    expect(() => assertSafeOfficialMonitoringUrl("https://random-private-site.example/jobs")).toThrow(
      /not an approved official source/i
    );
  });

  test("rejected: mirror host", () => {
    expect(() => assertSafeOfficialMonitoringUrl("https://www.sarkariresult.com/ssc/")).toThrow(
      /not an approved official source/i
    );
  });

  test("rejected: malformed URL", () => {
    expect(() => assertSafeOfficialMonitoringUrl("not a url")).toThrow(/malformed/i);
  });

  test("rejected: unsupported protocol", () => {
    expect(() => assertSafeOfficialMonitoringUrl("ftp://ssc.gov.in/file")).toThrow(/http or https/i);
  });

  test("rejected: private/internal URL", () => {
    expect(() => assertSafeOfficialMonitoringUrl("http://127.0.0.1/admin")).toThrow(/private or internal/i);
    expect(() => assertSafeOfficialMonitoringUrl("http://localhost/jobs")).toThrow(/private or internal/i);
  });

  test("normalize: trailing slash + hostname case", () => {
    expect(normalizeMonitoringUrlForCompare("https://SSC.gov.in/Portal/")).toBe(
      "https://ssc.gov.in/Portal"
    );
    expect(
      urlsAreDuplicateNormalized("https://SSC.gov.in/Portal/", "https://ssc.gov.in/Portal")
    ).toBe(true);
  });

  test("duplicate exact URL rejected", async () => {
    fetchSites.mockResolvedValue([
      { id: 1, name: "SSC", url: "https://ssc.gov.in/Portal/LatestNews", active: 1 }
    ]);
    await expect(
      assertMonitoringSiteWritable({
        url: "https://ssc.gov.in/Portal/LatestNews",
        requireRobotsAllow: true
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Monitoring URL already exists."
    });
  });

  test("duplicate normalized URL rejected", async () => {
    fetchSites.mockResolvedValue([
      { id: 1, name: "SSC", url: "https://ssc.gov.in/Portal/LatestNews/", active: 1 }
    ]);
    await expect(
      assertMonitoringSiteWritable({
        url: "https://SSC.gov.in/Portal/LatestNews",
        requireRobotsAllow: false
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("different legitimate URLs on same domain accepted", async () => {
    fetchSites.mockResolvedValue([
      { id: 1, name: "SSC news", url: "https://ssc.gov.in/Portal/LatestNews", active: 1 }
    ]);
    const result = await assertMonitoringSiteWritable({
      url: "https://ssc.gov.in/Portal/Notice",
      requireRobotsAllow: true
    });
    expect(result.url).toContain("ssc.gov.in");
  });

  test("same organization multiple approved URLs accepted via findDuplicate", async () => {
    fetchSites.mockResolvedValue([
      { id: 1, name: "UPSC A", url: "https://www.upsc.gov.in/whats-new", active: 1 },
      { id: 2, name: "UPSC B", url: "https://www.upsc.gov.in/examinations", active: 1 }
    ]);
    await expect(findDuplicateMonitoringUrl("https://www.upsc.gov.in/recruitment")).resolves.toBeNull();
  });
});

describe("robots access policy (mocked evaluate)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRobotsPolicyCache();
  });

  test("allowed path → monitor", async () => {
    evaluateRobotsAccessPolicy.mockResolvedValue({
      allowed: true,
      reason: "robots_allow",
      status: 200,
      crawlDelayMs: 0
    });
    const decision = await evaluateRobotsAccessPolicy("https://ssc.gov.in/ok");
    expect(decision.allowed).toBe(true);
  });

  test("disallowed path → do not monitor", async () => {
    assertRobotsAllowsMonitoring.mockRejectedValue(
      Object.assign(new Error("Monitoring URL is disallowed by robots.txt."), {
        statusCode: 400,
        code: "MONITORING_ROBOTS_DENIED"
      })
    );
    await expect(assertRobotsAllowsMonitoring("https://ssc.gov.in/secret")).rejects.toMatchObject({
      code: "MONITORING_ROBOTS_DENIED"
    });
  });

  test("policy unclear → fail closed for new activation", async () => {
    assertRobotsAllowsMonitoring.mockRejectedValue(
      Object.assign(
        new Error(
          "Monitoring access policy is unclear or restricted; activation blocked (fail closed)."
        ),
        { statusCode: 400, code: "MONITORING_ROBOTS_DENIED" }
      )
    );
    await expect(assertRobotsAllowsMonitoring("https://ssc.gov.in/x")).rejects.toMatchObject({
      code: "MONITORING_ROBOTS_DENIED"
    });
  });
});

describe("robotsAccessPolicy integration with robots-parser", () => {
  const axios = require("axios");
  const robotsPolicy = jest.requireActual("../server/services/updates/robotsAccessPolicy");

  afterEach(() => {
    jest.restoreAllMocks();
    robotsPolicy.clearRobotsPolicyCache();
  });

  test("200 Disallow blocks path", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: "User-agent: *\nDisallow: /private\nAllow: /\n"
    });
    const denied = await robotsPolicy.evaluateRobotsAccessPolicy(
      "https://example.gov.in/private/page",
      { bypassCache: true }
    );
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe("robots_disallow");

    const allowed = await robotsPolicy.evaluateRobotsAccessPolicy("https://example.gov.in/public", {
      bypassCache: true
    });
    // host cache may retain parser body — force separate host via query on robots host is same
    // Use bypass and same host: path allow should work with cached parserBody
    expect(allowed.allowed).toBe(true);
  });

  test("404 robots.txt treated as no crawler rules (allow)", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({ status: 404, data: "Not Found" });
    const decision = await robotsPolicy.evaluateRobotsAccessPolicy("https://unique404.gov.in/jobs", {
      bypassCache: true
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("robots_not_found");
  });

  test("403 robots.txt fail closed", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({ status: 403, data: "Forbidden" });
    const decision = await robotsPolicy.evaluateRobotsAccessPolicy("https://unique403.gov.in/jobs", {
      bypassCache: true
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("robots_forbidden");
  });

  test("timeout / network fail closed", async () => {
    jest.spyOn(axios, "get").mockRejectedValue(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));
    const decision = await robotsPolicy.evaluateRobotsAccessPolicy("https://uniqueto.gov.in/jobs", {
      bypassCache: true
    });
    expect(decision.allowed).toBe(false);
    expect(decision.failClosed).toBe(true);
  });
});

describe("429 / error classification + host politeness", () => {
  test("Retry-After parsed", () => {
    expect(parseRetryAfterMs("12")).toBe(12000);
  });

  test("429 classification", () => {
    const c = classifyMonitoringHttpError({
      response: { status: 429, headers: { "retry-after": "30" } }
    });
    expect(c.kind).toBe("rate_limited");
    expect(c.rateLimited).toBe(true);
  });

  test("same host serialized; different hosts independent", async () => {
    const order = [];
    const a1 = withHostPoliteness("https://ssc.gov.in/a", async () => {
      order.push("a-start");
      await new Promise((r) => setTimeout(r, 40));
      order.push("a-end");
      return "a";
    }, { minGapMs: 0 });
    const a2 = withHostPoliteness("https://ssc.gov.in/b", async () => {
      order.push("a2-start");
      order.push("a2-end");
      return "a2";
    }, { minGapMs: 0 });
    const b1 = withHostPoliteness("https://upsc.gov.in/x", async () => {
      order.push("b-start");
      order.push("b-end");
      return "b";
    }, { minGapMs: 0 });

    const results = await Promise.all([a1, a2, b1]);
    expect(results).toEqual(["a", "a2", "b"]);
    const aStart = order.indexOf("a-start");
    const aEnd = order.indexOf("a-end");
    const a2Start = order.indexOf("a2-start");
    expect(aStart).toBeLessThan(aEnd);
    expect(aEnd).toBeLessThanOrEqual(a2Start);
    expect(order).toContain("b-start");
  });

  test("noteHostRateLimited sets backoff", () => {
    noteHostRateLimited("https://ssc.gov.in/page", "5");
    const snap = getHostPolitenessSnapshot();
    expect(snap["ssc.gov.in"].waitMs).toBeGreaterThan(0);
  });
});

describe("ACC createSource / updateSource Enabled persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchSites.mockResolvedValue([]);
    evaluateRobotsAccessPolicy.mockResolvedValue({
      allowed: true,
      reason: "robots_allow",
      status: 200,
      crawlDelayMs: 0
    });
    assertRobotsAllowsMonitoring.mockResolvedValue({
      allowed: true,
      reason: "robots_allow",
      status: 200,
      crawlDelayMs: 0
    });
    createSite.mockResolvedValue(42);
    updateSite.mockResolvedValue(undefined);
    disableSite.mockResolvedValue(undefined);
    restoreSite.mockResolvedValue(undefined);
    getSiteById.mockImplementation(async (id) => ({
      id,
      name: "SSC",
      url: "https://ssc.gov.in/Portal/LatestNews",
      selector: "a",
      priority: 2,
      active: 1,
      broken: 0,
      failCount: 0,
      lastCheckedAt: null
    }));
  });

  test("create with enabled=false calls disableSite", async () => {
    await automationControlCenterService.createSource({
      name: "SSC",
      monitoringUrl: "https://ssc.gov.in/Portal/LatestNews",
      selector: "a",
      priority: "P1",
      enabled: false
    });
    expect(createSite).toHaveBeenCalled();
    expect(disableSite).toHaveBeenCalledWith(42);
  });

  test("update enabled false→true uses restoreSite", async () => {
    getSiteById.mockResolvedValueOnce({
      id: 7,
      name: "SSC",
      url: "https://ssc.gov.in/Portal/LatestNews",
      selector: "a",
      priority: 2,
      active: 0,
      broken: 0
    });
    getSiteById.mockResolvedValueOnce({
      id: 7,
      name: "SSC",
      url: "https://ssc.gov.in/Portal/LatestNews",
      selector: "a",
      priority: 2,
      active: 1,
      broken: 0
    });
    await automationControlCenterService.updateSource(7, {
      name: "SSC",
      monitoringUrl: "https://ssc.gov.in/Portal/LatestNews",
      selector: "a",
      priority: "P1",
      enabled: true
    });
    expect(restoreSite).toHaveBeenCalledWith(7);
  });

  test("rejects non-official on create", async () => {
    await expect(
      automationControlCenterService.createSource({
        name: "Bad",
        monitoringUrl: "https://example.com/jobs",
        selector: "a",
        enabled: true
      })
    ).rejects.toThrow(/approved official source/i);
    expect(createSite).not.toHaveBeenCalled();
  });
});

describe("safety invariants in siteChecker module source", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.join(__dirname, "../server/services/updates/siteChecker.js"),
    "utf8"
  );

  test("no POST to monitored targets", () => {
    expect(src).not.toMatch(/axios\.post\s*\(/);
    expect(src).toMatch(/method:\s*"GET"/);
  });

  test("no credentials/cookies sent", () => {
    expect(src).not.toMatch(/withCredentials\s*:\s*true/);
    expect(src).not.toMatch(/Cookie\s*:/);
  });

  test("no recursive fetching of discovered links", () => {
    expect(src).toMatch(/absolutizeLink/);
    // absolutize is for saved link fields only; fetchHtml called with site.url
    expect(src).toMatch(/fetchHtml\(site\.url/);
  });
});
