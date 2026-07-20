"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const db = require("../server/config/db");
const fs = require("fs");
const path = require("path");

const ENTERPRISE_DATA_DIR = path.join(__dirname, "../server/data/enterprise-test-amp4b");

beforeAll(() => {
  process.env.ENTERPRISE_DATA_DIR = ENTERPRISE_DATA_DIR;
  if (!fs.existsSync(ENTERPRISE_DATA_DIR)) {
    fs.mkdirSync(ENTERPRISE_DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  delete process.env.RECRUITMENT_PIPELINE_ENABLED;
  delete process.env.NOTIFICATION_GATEWAY_ENABLED;
  delete process.env.TELEGRAM_DELIVERY_ENABLED;
  delete process.env.PRODUCTION_MONITORING_ENABLED;
  try {
    require("../server/lib/enterprise/base/schemaGuard").invalidateSchemaCache();
  } catch {
    // ignore
  }
  if (fs.existsSync(ENTERPRISE_DATA_DIR)) {
    for (const file of fs.readdirSync(ENTERPRISE_DATA_DIR)) {
      fs.unlinkSync(path.join(ENTERPRISE_DATA_DIR, file));
    }
  }
});

describe("Package AMP-4B Production Runtime Conversion", () => {
  test("automation flags remain fail-safe off by default", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
    expect(current.AUTO_DRAFT_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(current.NOTIFICATION_GATEWAY_ENABLED).toBe(false);
    expect(flags.isAutomationDormant()).toBe(true);
    expect(flags.canRunProductionPipeline()).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
  });

  test("activation readiness returns NO-GO while flags remain off", async () => {
    db.query.mockResolvedValue([[]]);
    const { evaluateActivationReadiness } = require("../server/lib/recruitment/productionRuntime/activationReadiness");
    const readiness = await evaluateActivationReadiness();
    expect(readiness.decision).toBe("NO-GO");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });

  test("notification gateway remains disabled when flags are off", async () => {
    const gateway = require("../server/lib/enterprise/notificationGateway");
    const status = gateway.getChannelStatus();
    expect(status.find((row) => row.channel === "telegram").enabled).toBe(false);
    const result = await gateway.sendNotification({
      channel: "telegram",
      payload: { message: "test" }
    });
    expect(result.delivered).toBe(false);
    expect(result.status).toBe("disabled");
  });

  test("inactive future channels return inactive status when gateway enabled", async () => {
    process.env.NOTIFICATION_GATEWAY_ENABLED = "true";
    jest.resetModules();
    const gateway = require("../server/lib/enterprise/notificationGateway");
    const result = await gateway.sendNotification({
      channel: "email",
      payload: { message: "test" }
    });
    expect(result.status).toBe("inactive");
    expect(result.delivered).toBe(false);
  });

  test("production runtime skips when flags are off", async () => {
    db.query.mockResolvedValue([[]]);
    const { runProductionDetectionPipeline } = require("../server/lib/recruitment/productionRuntime");
    const outcome = await runProductionDetectionPipeline({
      notice: { title: "Test notice", content: "Test", url: "https://example.gov.in" },
      updateId: 1,
      candidateRecruitments: []
    });
    expect(outcome.skipped).toBe(true);
    expect(outcome.reason).toBe("production_runtime_disabled");
  });

  test("enterprise persistence controller no longer uses assertDormant", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../server/controllers/admin/enterprisePersistence.controller.js"),
      "utf8"
    );
    expect(source).not.toContain("assertDormant");
    expect(source).toContain("assertPermission");
  });

  test("siteWorker uses production runtime module", () => {
    const source = fs.readFileSync(path.join(__dirname, "../server/services/workers/siteWorker.js"), "utf8");
    expect(source).toContain("runProductionDetectionPipeline");
    expect(source).not.toContain("recordRuntimePreviewFromPipeline");
    expect(source).not.toContain("buildPreviewLifecycleArchitecture");
  });

  test("automation workflow exposes production orchestration", () => {
    const workflow = require("../server/lib/recruitment/automationWorkflow");
    expect(typeof workflow.runProductionAutomationWorkflow).toBe("function");
  });

  test("pipeline integration exposes production integration", () => {
    const integration = require("../server/lib/monitoringBot/pipelineIntegration");
    expect(typeof integration.integrateProductProductionPipeline).toBe("function");
  });
});
