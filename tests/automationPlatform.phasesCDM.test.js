"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

describe("source governance policy", () => {
  const {
    buildSourcePolicy,
    assertExactUrlBinding,
    deriveSourceHealth,
    HEALTH_STATUS,
    SELECTOR_STATUS,
    normalizeUrlKey
  } = require("../server/services/updates/sourceGovernancePolicy");

  const baseSite = {
    id: 42,
    name: "SSC Notices",
    url: "https://ssc.gov.in/portal",
    selector: "a.notice",
    active: 1,
    broken: 0,
    failCount: 0,
    lastCheckedAt: "2026-09-01T00:00:00.000Z",
    priority: 2
  };

  test("builds policy with exact URL binding fields", () => {
    const policy = buildSourcePolicy(baseSite);
    expect(policy.sourceId).toBe(42);
    expect(policy.sourceName).toBe("SSC Notices");
    expect(policy.officialHost).toBe("ssc.gov.in");
    expect(policy.approvedUrl).toBe("https://ssc.gov.in/portal");
    expect(policy.approvedProtocol).toBe("https");
    expect(policy.enabled).toBe(true);
    expect(policy.selectorPolicy.guessingAllowed).toBe(false);
    expect(policy.selectorPolicy.recursiveCrawlAllowed).toBe(false);
    expect(policy.robotsPolicy.bypassAllowed).toBe(false);
    expect(policy.hostApproved).toBe(true);
    expect(policy.approvedFetchUrls).toContain("https://ssc.gov.in/portal");
  });

  test("exact URL binding allows approved URL only", () => {
    const policy = buildSourcePolicy(baseSite);
    expect(assertExactUrlBinding(policy, "https://ssc.gov.in/portal").allowed).toBe(true);
    expect(assertExactUrlBinding(policy, "https://ssc.gov.in/other").allowed).toBe(false);
    expect(assertExactUrlBinding(policy, "https://upsc.gov.in/").allowed).toBe(false);
  });

  test("disabled source is rejected by binding", () => {
    const policy = buildSourcePolicy({ ...baseSite, active: 0 });
    const result = assertExactUrlBinding(policy, baseSite.url);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SOURCE_DISABLED");
  });

  test("health stays UNKNOWN when never checked", () => {
    const health = deriveSourceHealth({ ...baseSite, lastCheckedAt: null, failCount: 0 });
    expect(health.healthStatus).toBe(HEALTH_STATUS.UNKNOWN);
  });

  test("selector miss yields DEGRADED", () => {
    const health = deriveSourceHealth(baseSite, { selectorStatus: SELECTOR_STATUS.MISS });
    expect(health.healthStatus).toBe(HEALTH_STATUS.DEGRADED);
    expect(health.reason).toBe("selector_miss");
  });

  test("normalizeUrlKey strips trailing slash on paths", () => {
    expect(normalizeUrlKey("https://ssc.gov.in/a/")).toBe(normalizeUrlKey("https://ssc.gov.in/a"));
  });
});

describe("durable automation control plane", () => {
  let tmpDir;
  let masterPath;
  let planePath;
  let killSwitch;
  let controlPlane;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acc-plane-"));
    masterPath = path.join(tmpDir, "master.json");
    planePath = path.join(tmpDir, "plane.json");
    process.env.AUTOMATION_MASTER_CONTROL_PATH = masterPath;
    process.env.AUTOMATION_CONTROL_PLANE_PATH = planePath;
    delete process.env.AUTOMATION_MASTER_ENABLED;
    delete process.env.AUTOMATION_EMERGENCY_STOP;
    delete process.env.AUTOMATION_MODE;
    jest.resetModules();
    killSwitch = require("../server/config/automationKillSwitch");
    controlPlane = require("../server/config/automationControlPlane");
    controlPlane.invalidateCache();
  });

  afterEach(() => {
    delete process.env.AUTOMATION_MASTER_CONTROL_PATH;
    delete process.env.AUTOMATION_CONTROL_PLANE_PATH;
    delete process.env.AUTOMATION_MASTER_ENABLED;
    delete process.env.AUTOMATION_EMERGENCY_STOP;
    delete process.env.AUTOMATION_MODE;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("defaults to dormant with fetch blocked", () => {
    const snap = controlPlane.getControlPlaneSnapshot();
    expect(snap.mode).toBe("DORMANT");
    expect(snap.monitoringFetchPermitted).toBe(false);
    expect(snap.autoPublishBlocked).toBe(true);
  });

  test("dry-run permits monitoring fetch without master LIVE", () => {
    controlPlane.setDryRunMode(true, { updatedBy: "test" });
    expect(controlPlane.isDryRunMode()).toBe(true);
    expect(controlPlane.isMonitoringFetchPermitted()).toBe(true);
    expect(controlPlane.canDeliverExternalNotifications()).toBe(false);
    expect(killSwitch.isAutomationExecutionPermitted()).toBe(false);
  });

  test("emergency stop blocks dry-run and live", () => {
    controlPlane.setDryRunMode(true);
    controlPlane.engageEmergencyStop({ updatedBy: "test" });
    expect(controlPlane.isMonitoringFetchPermitted()).toBe(false);
    expect(controlPlane.getAutomationMode()).toBe("DORMANT");
  });

  test("capability flags persist to shared file", () => {
    controlPlane.writeControlPlane({
      liveCrawlerEnabled: true,
      productionMonitoringEnabled: true,
      updatedBy: "test"
    });
    controlPlane.invalidateCache();
    expect(controlPlane.getDurableCapability("LIVE_CRAWLER_ENABLED")).toBe(true);
    expect(controlPlane.getDurableCapability("PRODUCTION_MONITORING_ENABLED")).toBe(true);
    expect(controlPlane.getDurableCapability("AUTO_PUBLISH_ENABLED")).toBe(false);
  });

  test("master enable requires clearing emergency stop", () => {
    controlPlane.engageEmergencyStop();
    expect(() => controlPlane.setMasterEnabled(true)).toThrow(/emergency stop/i);
  });

  test("ordinary writeControlPlane cannot enter LIVE without allowLivePromotion", () => {
    controlPlane.writeControlPlane({ mode: "LIVE", updatedBy: "test" });
    expect(controlPlane.getAutomationMode()).toBe("DORMANT");
    expect(controlPlane.isLiveMode()).toBe(false);
  });

  test("durable file mode wins over stale AUTOMATION_MODE env", () => {
    controlPlane.writeControlPlane({ mode: "DORMANT", updatedBy: "test" });
    process.env.AUTOMATION_MODE = "LIVE";
    controlPlane.invalidateCache();
    expect(controlPlane.getAutomationMode()).toBe("DORMANT");
  });

  test("promoteToLive with master sets LIVE", () => {
    controlPlane.setMasterEnabled(true, { promoteToLive: true, updatedBy: "test" });
    expect(controlPlane.getAutomationMode()).toBe("LIVE");
    expect(controlPlane.isLiveMode()).toBe(true);
    // Restore safe for subsequent tests in this file's afterEach cleanup paths.
    controlPlane.setMasterEnabled(false, { updatedBy: "test" });
    expect(controlPlane.getAutomationMode()).toBe("DORMANT");
  });
});

describe("monitoring scale simulation", () => {
  const { simulateGovernedScale } = require("../server/services/updates/monitoringScaleSimulator");

  test.each([2, 5, 20, 50, 100])(
    "simulates %i governed sources with isolation",
    (n) => {
      const result = simulateGovernedScale(n, { concurrency: 5, injectFailures: true });
      expect(result.sourceCount).toBe(n);
      expect(result.guarantees.noExternalHttp).toBe(true);
      expect(result.guarantees.singleBadSourceDoesNotStopPlatform).toBe(true);
      expect(result.eligible + result.skippedDisabled + result.skippedPolicy).toBe(n);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.plannedJobs + result.failedIsolated).toBe(result.eligible);
    }
  );
});
