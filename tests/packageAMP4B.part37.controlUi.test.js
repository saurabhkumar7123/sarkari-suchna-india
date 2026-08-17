"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

jest.mock("../server/services/updates/updateScheduler", () => ({
  startUpdateScheduler: jest.fn(async () => ({ stop: () => {}, isActive: () => false })),
  triggerManualUpdateCheck: jest.fn(),
  isUpdateSchedulerActive: jest.fn(() => false)
}));

jest.mock("../server/services/updates/telegramNotifier", () => ({
  isTelegramConfigured: jest.fn(() => false),
  canSendTelegram: jest.fn(() => false),
  sendTelegramMessage: jest.fn(async () => ({ sent: false, skipped: true }))
}));

const fs = require("fs");
const path = require("path");
const request = require("supertest");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const FLAG_KEYS = [
  "SCHEDULER_ACTIVATION_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "AUTO_PUBLISH_ENABLED",
  "PRODUCTION_MONITORING_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "WORKER_ACTIVATION_ENABLED",
  "RECRUITMENT_PIPELINE_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "CRON_ACTIVATION_ENABLED"
];

function snapshotFlags() {
  const snap = {};
  for (const key of FLAG_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreFlags(snap) {
  for (const key of FLAG_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

describe("Part 37 Automation + Manual Workflow Control UI", () => {
  const prior = snapshotFlags();

  afterEach(() => {
    restoreFlags(prior);
    jest.clearAllMocks();
  });

  test("1. UI loads with publishing controls on the existing ACC page", () => {
    const html = read("private/admin-automation-control-center.html");
    expect(html).toContain("Automation Control Center");
    expect(html).toContain("Automation &amp; Publishing");
    expect(html).toContain("AUTOMATION STATUS");
    expect(html).toContain("admin-design-system.css");
    expect(html).toContain("admin-sidebar.css");
    expect(html).toContain("automation-control-center.css");
  });

  test("2-4. Scheduler OFF, Telegram OFF, AUTO_PUBLISH LOCKED OFF", () => {
    const html = read("private/admin-automation-control-center.html");
    expect(html).toContain("id=\"accSchedulerStatusBadge\">OFF<");
    expect(html).toContain("id=\"accTelegramStatusBadge\">OFF<");
    expect(html).toContain("LOCKED OFF");
    expect(html).toContain("MANUAL REVIEW ONLY");
    expect(html).not.toMatch(/id=["']accAutoPublishToggle["']/);
    expect(html).not.toMatch(/AUTO_PUBLISH[\s\S]{0,80}role=["']switch["']/);

    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.NOTIFICATION_GATEWAY_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });

  test("5. no request can enable AUTO_PUBLISH", () => {
    const { automationControlsUpdateSchema } = require("../server/validations/admin.validation");
    const { updatePublishingControls, getPublishingControlState } = require("../server/services/automationControlCenter.service");
    const { sendTelegramMessage } = require("../server/services/updates/telegramNotifier");
    const { startUpdateScheduler } = require("../server/services/updates/updateScheduler");

    const rejected = automationControlsUpdateSchema.validate({
      AUTO_PUBLISH_ENABLED: true
    });
    expect(rejected.error).toBeTruthy();

    const alsoRejected = automationControlsUpdateSchema.validate({
      autoPublishEnabled: true,
      schedulerEnabled: true
    });
    expect(alsoRejected.error).toBeTruthy();

    expect(() => updatePublishingControls({ autoPublishEnabled: true })).toThrow(/AUTO_PUBLISH cannot be enabled/);
    expect(() => updatePublishingControls({ AUTO_PUBLISH_ENABLED: true })).toThrow(/AUTO_PUBLISH cannot be enabled/);

    const state = getPublishingControlState();
    expect(state.autoPublish.enabled).toBe(false);
    expect(state.autoPublish.locked).toBe(true);
    expect(state.autoPublish.status).toBe("LOCKED OFF");
    expect(require("../server/config/automationFlags").getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(startUpdateScheduler).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  test("6. active sources show SSC + UPSC from backend data", () => {
    const { buildActiveOfficialSources } = require("../server/services/automationControlCenter.service");
    const sources = buildActiveOfficialSources([
      { id: 1, name: "SSC", enabled: true },
      { id: 2, name: "UPSC", enabled: true },
      { id: 3, name: "NTA", enabled: false },
      { id: 4, name: "IBPS", enabled: false }
    ]);
    expect(sources).toEqual([
      { id: 1, name: "SSC", status: "ACTIVE" },
      { id: 2, name: "UPSC", status: "ACTIVE" }
    ]);
    expect(sources).toHaveLength(2);

    const html = read("private/admin-automation-control-center.html");
    const client = read("public/assets/js/admin-automation-control-center.js");
    expect(html).toContain("Active official sources");
    expect(html).not.toContain("Active official sources: 2");
    expect(client).toContain("activeOfficialSourceCount");
    expect(client).not.toMatch(/Active official sources: 2/);
  });

  test("7. manual workflow is displayed and uses backend counts", () => {
    const html = read("private/admin-automation-control-center.html");
    expect(html).toContain("MANUAL PUBLISH WORKFLOW");
    expect(html).toContain("AUTOMATED PIPELINE");
    expect(html).toContain("MANUAL APPROVAL");
    expect(html).toContain("MANUAL PUBLISH");
    expect(html).toContain("acc-flow__not-path");
    expect(html).toMatch(/AUTO PUBLISH/);

    const { buildManualWorkflow } = require("../server/services/automationControlCenter.service");
    const stages = buildManualWorkflow(
      [{ id: 1 }],
      [{ id: 2 }],
      [{ id: 3, status: "pending" }, { id: 4, status: "approved" }],
      [{ id: 5, status: "published" }]
    );
    expect(stages.map((row) => row.label)).toEqual([
      "Detected Update",
      "Draft",
      "Review Queue",
      "Manual Edit / Review",
      "Manual Approval",
      "Manual Publish"
    ]);
    expect(stages[0].count).toBe(1);
    expect(stages[2].count).toBe(2);
    expect(stages[3].count).toBe(1);
    expect(stages[4].count).toBe(1);

    const client = read("public/assets/js/admin-automation-control-center.js");
    expect(client).toContain("manualWorkflow");
    expect(client).toContain("Enabling Scheduler will allow automatic monitoring of active official sources.");
    expect(client).toContain("Telegram notifications may be sent for detected updates/review events.");
    expect(client).toContain("/api/admin/automation-control-center/controls");
    expect(client).not.toContain("autoPublishEnabled");
  });

  test("8-10. opening controls does not mutate DB, send Telegram, or start scheduler", () => {
    const serviceSource = read("server/services/automationControlCenter.service.js");
    const getStateBlock = serviceSource.slice(
      serviceSource.indexOf("function getPublishingControlState"),
      serviceSource.indexOf("function rejectAutoPublishEnable")
    );
    const updateBlock = serviceSource.slice(
      serviceSource.indexOf("function updatePublishingControls"),
      serviceSource.indexOf("function buildActiveOfficialSources")
    );
    expect(getStateBlock).not.toContain("createSite");
    expect(getStateBlock).not.toContain("updateSite");
    expect(getStateBlock).not.toContain("insertDetectedUpdate");
    expect(getStateBlock).not.toContain("startUpdateScheduler");
    expect(getStateBlock).not.toContain("sendTelegramMessage");
    expect(updateBlock).not.toContain("startUpdateScheduler");
    expect(updateBlock).not.toContain("sendTelegramMessage");
    expect(updateBlock).toContain("AUTO_PUBLISH_ENABLED");
    expect(updateBlock).toContain("\"false\"");

    const {
      getPublishingControlState,
      updatePublishingControls
    } = require("../server/services/automationControlCenter.service");
    const { startUpdateScheduler } = require("../server/services/updates/updateScheduler");
    const { sendTelegramMessage } = require("../server/services/updates/telegramNotifier");
    const flags = require("../server/config/automationFlags");

    const before = getPublishingControlState();
    expect(before.scheduler.status).toBe("OFF");
    expect(before.telegram.status).toBe("OFF");
    expect(before.dormant).toBe(true);
    expect(startUpdateScheduler).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();

    const afterEnableAttempt = updatePublishingControls({ schedulerEnabled: true });
    expect(afterEnableAttempt.scheduler.enabled).toBe(true);
    expect(afterEnableAttempt.scheduler.status).toBe("OFF");
    expect(afterEnableAttempt.autoPublish.status).toBe("LOCKED OFF");
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(startUpdateScheduler).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();

    updatePublishingControls({ schedulerEnabled: false, telegramEnabled: false });
    expect(flags.canStartMonitoringScheduler()).toBe(false);
    expect(flags.canDeliverTelegram()).toBe(false);
    expect(flags.isAutomationDormant()).toBe(true);
  });

  test("11. existing admin navigation remains intact", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain("Dashboard");
    expect(nav).toContain("Page Manager");
    expect(nav).toContain("Recruitments");
    expect(nav).toContain("Review Queue");
    expect(nav).toContain("Monitoring");
    expect(nav).toContain("Automation Control Center");
    expect(nav).toContain("/admin/automation-control-center");
    expect(nav).toContain("/admin/dashboard");
    expect(nav).toContain("/admin/alerts");
  });

  test("control endpoints remain authenticated", async () => {
    const app = require("../server/app");
    const getRes = await request(app).get("/api/admin/automation-control-center/controls");
    expect(getRes.status).toBe(401);
    const patchRes = await request(app)
      .patch("/api/admin/automation-control-center/controls")
      .send({ schedulerEnabled: true });
    expect(patchRes.status).toBe(401);
    const pageRes = await request(app).get("/admin/automation-control-center");
    expect(pageRes.status).toBe(302);
  });
});
