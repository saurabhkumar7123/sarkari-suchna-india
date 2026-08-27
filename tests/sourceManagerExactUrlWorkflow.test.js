"use strict";

jest.mock("../server/services/updates/updates.repository", () => ({
  fetchSites: jest.fn(),
  getSiteById: jest.fn(),
  createSite: jest.fn(),
  updateSite: jest.fn(),
  deleteSite: jest.fn(),
  restoreSite: jest.fn(),
  disableSite: jest.fn(),
  fetchRecentUpdates: jest.fn(),
  markSiteChecked: jest.fn(),
  saveSiteBaseline: jest.fn()
}));

jest.mock("../server/services/updates/robotsAccessPolicy", () => {
  const actual = jest.requireActual("../server/services/updates/robotsAccessPolicy");
  return {
    ...actual,
    evaluateRobotsAccessPolicy: jest.fn(),
    assertRobotsAllowsMonitoring: jest.fn(),
    MONITORING_BOT_UA: actual.MONITORING_BOT_UA
  };
});

jest.mock("../server/services/updates/siteChecker", () => {
  const actual = jest.requireActual("../server/services/updates/siteChecker");
  return {
    ...actual,
    checkSite: jest.fn()
  };
});

const axios = require("axios");
const {
  fetchSites,
  getSiteById,
  createSite,
  disableSite,
  markSiteChecked,
  saveSiteBaseline
} = require("../server/services/updates/updates.repository");
const {
  evaluateRobotsAccessPolicy,
  clearRobotsPolicyCache
} = require("../server/services/updates/robotsAccessPolicy");
const {
  verifyMonitoringSource,
  extractSelectorPreview,
  normalizePurpose
} = require("../server/services/updates/monitoringSourceVerify");
const { checkSite } = require("../server/services/updates/siteChecker");
const automationControlCenterService = require("../server/services/automationControlCenter.service");
const { resetHostPolitenessForTests } = require("../server/services/updates/hostPoliteness");

describe("Official Source Manager verify workflow", () => {
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
  });

  test("exact approved URL accepted with selector preview", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      headers: {},
      data: "<html><body><a class='notice'>Recruitment Notice One</a></body></html>"
    });
    const report = await verifyMonitoringSource({
      url: "https://ssc.gov.in/Portal/LatestNews",
      selector: "a.notice"
    });
    expect(report.safeToActivate).toBe(true);
    expect(report.exactUrl).toBe("https://ssc.gov.in/Portal/LatestNews");
    expect(report.checks.officialHost.status).toBe("PASS");
    expect(report.checks.selector.status).toBe("PASS");
    expect(report.preview).toMatch(/Recruitment Notice One/i);
    expect(axios.get).toHaveBeenCalledWith(
      "https://ssc.gov.in/Portal/LatestNews",
      expect.objectContaining({ method: "GET", maxRedirects: 0 })
    );
  });

  test("non-official URL rejected", async () => {
    const report = await verifyMonitoringSource({
      url: "https://example.com/jobs",
      selector: "body"
    });
    expect(report.safeToActivate).toBe(false);
    expect(report.checks.officialHost.status).toBe("FAIL");
    expect(report.message).toMatch(/not an approved official source/i);
  });

  test("private/internal URL rejected", async () => {
    const report = await verifyMonitoringSource({
      url: "http://127.0.0.1/admin",
      selector: "body"
    });
    expect(report.safeToActivate).toBe(false);
    expect(report.checks.privateHost.status).toBe("FAIL");
  });

  test("duplicate URL rejected", async () => {
    fetchSites.mockResolvedValue([
      { id: 9, name: "Existing", url: "https://ssc.gov.in/Portal/LatestNews" }
    ]);
    const report = await verifyMonitoringSource({
      url: "https://ssc.gov.in/Portal/LatestNews/",
      selector: "body"
    });
    expect(report.safeToActivate).toBe(false);
    expect(report.checks.duplicate.status).toBe("FAIL");
  });

  test("different URLs on same domain are not duplicates", async () => {
    fetchSites.mockResolvedValue([
      { id: 9, name: "Existing", url: "https://ssc.gov.in/Portal/LatestNews" }
    ]);
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      headers: {},
      data: "<html><body>Notice board content here</body></html>"
    });
    const report = await verifyMonitoringSource({
      url: "https://ssc.gov.in/Portal/Notice",
      selector: "body"
    });
    expect(report.checks.duplicate.status).toBe("PASS");
    expect(report.safeToActivate).toBe(true);
  });

  test("blocked robots cannot activate", async () => {
    evaluateRobotsAccessPolicy.mockResolvedValue({
      allowed: false,
      reason: "robots_disallow",
      status: 200,
      robotsUrl: "https://ssc.gov.in/robots.txt",
      crawlDelayMs: 0,
      failClosed: true
    });
    const report = await verifyMonitoringSource({
      url: "https://ssc.gov.in/secret",
      selector: "body"
    });
    expect(report.safeToActivate).toBe(false);
    expect(report.checks.robots.status).toBe("BLOCKED");
    expect(report.message).toMatch(/robots policy blocks/i);
  });

  test("HTTP 403 blocks activation", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 403,
      headers: {},
      data: "Forbidden"
    });
    const report = await verifyMonitoringSource({
      url: "https://ssc.gov.in/Portal/LatestNews",
      selector: "body"
    });
    expect(report.safeToActivate).toBe(false);
    expect(report.message).toMatch(/403/);
  });

  test("redirect to unapproved host blocked", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 302,
      headers: { location: "https://evil.example/phish" },
      data: ""
    });
    const report = await verifyMonitoringSource({
      url: "https://ssc.gov.in/Portal/LatestNews",
      selector: "body"
    });
    expect(report.safeToActivate).toBe(false);
    expect(report.message).toMatch(/unapproved host/i);
  });

  test("selector verification fails on empty match", () => {
    const extracted = extractSelectorPreview("<html><body><p>x</p></body></html>", ".missing");
    expect(extracted.ok).toBe(false);
    expect(extracted.reason).toMatch(/no useful content/i);
  });

  test("purpose normalize maps controlled values", () => {
    expect(normalizePurpose("Admit Card")).toBe("admit_card");
    expect(normalizePurpose("Recruitment / Vacancy")).toBe("recruitment");
    expect(normalizePurpose("bogus")).toBe("");
  });
});

describe("runSourceCheck exact-URL safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    markSiteChecked.mockResolvedValue(undefined);
    saveSiteBaseline.mockResolvedValue(undefined);
  });

  test("disabled source does not get monitored", async () => {
    getSiteById.mockResolvedValue({
      id: 3,
      name: "UPPSC",
      url: "https://uppsc.up.nic.in/notifications",
      selector: "body",
      active: 0,
      broken: 0
    });
    await expect(automationControlCenterService.runSourceCheck(3)).rejects.toMatchObject({
      code: "MONITORING_SOURCE_DISABLED"
    });
    expect(checkSite).not.toHaveBeenCalled();
  });

  test("active source uses exact configured URL", async () => {
    const exact = "https://uppsc.up.nic.in/recruitment/notifications";
    getSiteById.mockResolvedValue({
      id: 4,
      name: "UPPSC",
      url: exact,
      selector: "a",
      active: 1,
      broken: 0,
      lastContent: "sig:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:baseline"
    });
    checkSite.mockResolvedValue({ changed: false, reason: "no_change" });
    const out = await automationControlCenterService.runSourceCheck(4);
    expect(checkSite).toHaveBeenCalledWith(expect.objectContaining({ url: exact }));
    expect(out.exactUrlUsed).toBe(exact);
    expect(out.monitoringUrl).toBe(exact);
    expect(markSiteChecked).toHaveBeenCalledWith(4);
  });

  test("create stores exact URL and purpose without auto-activating", async () => {
    createSite.mockResolvedValue(55);
    disableSite.mockResolvedValue(undefined);
    getSiteById.mockResolvedValue({
      id: 55,
      name: "UPPSC",
      url: "https://uppsc.up.nic.in/recruitment/notifications",
      selector: "body",
      purpose: "recruitment",
      priority: 2,
      active: 0,
      broken: 0
    });
    const created = await automationControlCenterService.createSource({
      name: "UPPSC",
      monitoringUrl: "https://uppsc.up.nic.in/recruitment/notifications",
      selector: "body",
      purpose: "recruitment",
      enabled: false
    });
    expect(createSite).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://uppsc.up.nic.in/recruitment/notifications",
        purpose: "recruitment"
      })
    );
    expect(disableSite).toHaveBeenCalledWith(55);
    expect(created.monitoringUrl).toBe("https://uppsc.up.nic.in/recruitment/notifications");
    expect(created.enabled).toBe(false);
  });
});

describe("verify module source safety invariants", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.join(__dirname, "../server/services/updates/monitoringSourceVerify.js"),
    "utf8"
  );

  test("GET-only verify fetch", () => {
    expect(src).toMatch(/method:\s*"GET"/);
    expect(src).not.toMatch(/axios\.post\s*\(/);
  });

  test("no credentials/cookies and no bypass controls", () => {
    expect(src).not.toMatch(/withCredentials\s*:\s*true/);
    expect(src).not.toMatch(/Cookie\s*:/);
    expect(src).not.toMatch(/force.?activate/i);
    expect(src).not.toMatch(/ignore.?robots/i);
    expect(src).not.toMatch(/bypassRestriction|forceActivate|ignoreRobots/i);
  });
});
