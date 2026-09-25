"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Automation Control Center operator UI", () => {
  const overview = read("private/admin-automation-control-center.html");
  const controls = read("private/admin-automation-controls.html");
  const dashboard = read("private/admin-dashboard.html");
  const client = read("public/assets/js/admin-automation-control-center.js");
  const css = read("public/assets/css/admin/automation-control-center.css");
  const service = read("server/services/automationControlCenter.service.js");

  test("overview follows the deduplicated operator IA order", () => {
    const order = [
      'id="accSystemStatus"',
      'id="accSafetyGate"',
      'id="accHumanAction"',
      'id="accMonitoringSection"',
      'id="accPipelineSection"',
      'id="accAiSection"',
      'id="accSchedulerSection"',
      'id="accNotifySection"',
      'id="accWorkerSection"',
      'id="accErrorsSection"',
      'id="accHowDetails"',
      'id="accAdvancedDetails"'
    ];
    let cursor = -1;
    for (const marker of order) {
      const index = overview.indexOf(marker);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  test("overview uses short summaries and links instead of full child copies", () => {
    expect(overview).toContain("Open Monitoring");
    expect(overview).not.toContain("Open Queue");
    expect(overview).not.toContain("Open Insights");
    expect(overview).not.toContain("Open Controls");
    expect(overview).not.toContain("Open Health");
    expect(overview).not.toContain("Open Sources");
    expect(overview).not.toContain("Section summaries");
    expect(overview).not.toContain("MANUAL PUBLISH WORKFLOW");
    expect(overview).not.toContain("AUTOMATED PIPELINE");
    expect(overview).not.toContain('id="accStatsGrid"');
    expect(overview).not.toContain('id="accSchedulerToggle"');
    expect((overview.match(/id=\"accMonitoringSection\"/g) || []).length).toBe(1);
    expect((overview.match(/id=\"accPipelineSection\"/g) || []).length).toBe(1);
  });

  test("controls page is the only activation UI; auto publish stays locked", () => {
    expect(controls).toContain('id="accOperatorControls"');
    expect(controls).toContain("Only place for automation ON/OFF actions");
    expect(controls).toContain("LOCKED");
    expect(controls).toContain("MANUAL REVIEW ONLY");
    expect(controls).toContain('id="accSchedulerToggle"');
    expect(controls).toContain('id="accPublicationSafety"');
    expect(controls).not.toMatch(/id=["']accAutoPublishToggle["']/);
    expect(overview).not.toContain('id="accSchedulerToggle"');
    expect(overview).not.toContain('id="accOperatorControls"');
    expect(dashboard).not.toContain('id="accSchedulerToggle"');
    expect(dashboard).not.toContain("Quick access");
    expect(dashboard).not.toContain('id="dashboardAutoStatus"');
    expect(dashboard).not.toContain("No enable controls on this page");
  });

  test("default OFF / LOCKED states remain visible", () => {
    expect(overview).toContain('id="accOverallState">DORMANT / SAFE<');
    expect(overview).toContain('id="accTopMonitoringState">OFF<');
    expect(overview).toContain('id="accSchedulerStatusBadge">OFF<');
    expect(overview).toContain('id="accTelegramStatusBadge">OFF<');
    expect(overview).toContain("LOCKED OFF");
    expect(overview).toContain("Nothing requires your action right now.");
  });

  test("existing workflow links remain wired", () => {
    expect(overview).toContain('href="/admin/recruitment-review-queue"');
    expect(overview).toContain('href="/generator#drafts"');
    expect(overview).toContain('href="/admin/monitoring/updates"');
    expect(overview).toContain('href="/admin/monitoring"');
    expect(overview).not.toContain('href="/admin/automation-control-center/sources"');
    expect(overview).toContain('href="/admin/recruitments"');
    expect(overview).toContain('href="/admin/automation-control-center/controls"');
  });

  test("client supports operator control cards and confirmations", () => {
    expect(client).toContain("renderOperatorControlCards");
    expect(client).toContain("onOperatorControlClick");
    expect(client).toContain("toggleControlPayload");
    expect(client).toContain("Not available");
  });

  test("service exposes component controls and keeps auto publish locked", () => {
    expect(service).toContain("components");
    expect(service).toContain("productionMonitoringEnabled");
    expect(service).toContain("liveCrawlerEnabled");
    expect(service).toContain("autoDraftEnabled");
    expect(service).toContain("workerEnabled");
    expect(service).toContain("Telegram requires Notification Gateway");
    expect(service).toContain('process.env.AUTO_PUBLISH_ENABLED = "false"');
  });

  test("clean responsive styles exist", () => {
    expect(css).toContain(".acc-content--clean");
    expect(css).toContain(".acc-summary-grid");
    expect(css).toContain(".acc-operator-controls");
    expect(css).toContain("@media (max-width: 640px)");
  });

  test("automation flags remain fail-safe off", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.AUTO_DRAFT_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(current.PRODUCTION_MONITORING_ENABLED).toBe(false);
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
    expect(current.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });

  test("control updates flip canonical flags and reject unsafe telegram enable", () => {
    const fsLocal = require("fs");
    const os = require("os");
    const pathLocal = require("path");
    const tmp = fsLocal.mkdtempSync(pathLocal.join(os.tmpdir(), "acc-op-ui-"));
    const prior = { ...process.env };
    process.env.AUTOMATION_MASTER_CONTROL_PATH = pathLocal.join(tmp, "master.json");
    process.env.AUTOMATION_CONTROL_PLANE_PATH = pathLocal.join(tmp, "plane.json");
    delete process.env.AUTOMATION_MASTER_ENABLED;
    delete process.env.AUTOMATION_EMERGENCY_STOP;
    delete process.env.AUTOMATION_MODE;
    jest.resetModules();

    try {
      const {
        updatePublishingControls,
        getPublishingControlState
      } = require("../server/services/automationControlCenter.service");
      const flags = require("../server/config/automationFlags");
      const controlPlane = require("../server/config/automationControlPlane");
      controlPlane.invalidateCache();

      const state = getPublishingControlState();
      expect(state.components.some((c) => c.id === "autoPublish" && c.locked)).toBe(true);
      expect(state.safetyGate && state.safetyGate.liveActivationAvailable).toBe(false);

      expect(() => updatePublishingControls({ telegramEnabled: true })).toThrow(
        /Notification Gateway/
      );

      expect(() => updatePublishingControls({ mode: "LIVE" })).toThrow(/human approval|promoteToLive/i);

      updatePublishingControls({ notificationGatewayEnabled: true, telegramEnabled: true });
      expect(flags.getAutomationFlags().NOTIFICATION_GATEWAY_ENABLED).toBe(true);
      expect(flags.getAutomationFlags().TELEGRAM_DELIVERY_ENABLED).toBe(true);

      updatePublishingControls({
        notificationGatewayEnabled: false,
        telegramEnabled: false,
        productionMonitoringEnabled: false,
        liveCrawlerEnabled: false,
        schedulerEnabled: false,
        autoDraftEnabled: false,
        workerEnabled: false,
        dryRunEnabled: false,
        mode: "DORMANT"
      });
      expect(flags.isAutomationDormant()).toBe(true);
      expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
      expect(getPublishingControlState().controlPlane.mode).toBe("DORMANT");
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in prior)) delete process.env[key];
      }
      Object.assign(process.env, prior);
      try {
        fsLocal.rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      jest.resetModules();
    }
  });
});
