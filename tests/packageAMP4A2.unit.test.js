"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const db = require("../server/config/db");
const fs = require("fs");
const path = require("path");

const ENTERPRISE_DATA_DIR = path.join(__dirname, "../server/data/enterprise-test");

beforeAll(() => {
  process.env.ENTERPRISE_DATA_DIR = ENTERPRISE_DATA_DIR;
  if (!fs.existsSync(ENTERPRISE_DATA_DIR)) {
    fs.mkdirSync(ENTERPRISE_DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  try {
    require("../server/lib/enterprise/base/schemaGuard").invalidateSchemaCache();
  } catch {
    // ignore if module not loaded
  }
  if (fs.existsSync(ENTERPRISE_DATA_DIR)) {
    for (const file of fs.readdirSync(ENTERPRISE_DATA_DIR)) {
      fs.unlinkSync(path.join(ENTERPRISE_DATA_DIR, file));
    }
  }
});

describe("Package AMP-4A.2 Enterprise Persistence Layer", () => {
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
  });

  test("RBAC permission matrix grants admin read without execution", () => {
    const { PERMISSIONS } = require("../server/lib/enterprise/rbac/permissions");
    const { hasPermission } = require("../server/lib/enterprise/rbac/RbacService");
    expect(hasPermission("admin", PERMISSIONS.RECRUITMENT_READ)).toBe(true);
    expect(hasPermission("viewer", PERMISSIONS.AUTOMATION_EXECUTE)).toBe(false);
    expect(hasPermission("super_admin", PERMISSIONS.AUTOMATION_EXECUTE)).toBe(true);
  });

  test("notification gateway returns disabled status when flags are off", async () => {
    const gateway = require("../server/lib/enterprise/notificationGateway");
    const status = gateway.getChannelStatus();
    expect(status.every((row) => row.enabled === false)).toBe(true);
    const result = await gateway.sendNotification({
      channel: "telegram",
      payload: { message: "test" }
    });
    expect(result.delivered).toBe(false);
    expect(result.status).toBe("disabled");
  });

  test("version history service stores and compares versions in file mode", async () => {
    db.query.mockResolvedValueOnce([[]]);
    const versionHistory = require("../server/lib/enterprise/versionHistory/VersionHistoryService");
    await versionHistory.createVersion({
      entityType: "recruitment",
      entityId: 1,
      version: 1,
      author: "tester",
      changeSummary: "Initial",
      snapshot: { title: "A" }
    });
    await versionHistory.createVersion({
      entityType: "recruitment",
      entityId: 1,
      version: 2,
      author: "tester",
      changeSummary: "Updated",
      snapshot: { title: "B" }
    });
    const listed = await versionHistory.listVersions({
      entityType: "recruitment",
      entityId: 1
    });
    expect(listed.data.length).toBe(2);
    const comparison = versionHistory.compareVersions(listed.data[1], listed.data[0]);
    expect(comparison.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "title" })])
    );
  });

  test("soft delete service records delete and restore audit trail", async () => {
    db.query.mockResolvedValue([[]]);
    const softDelete = require("../server/lib/enterprise/softDelete/SoftDeleteService");
    await softDelete.recordSoftDelete({
      entityType: "recruitment",
      entityId: 9,
      reason: "test",
      deletedBy: "tester"
    });
    const log = await softDelete.listSoftDeleteLog({ entityType: "recruitment" });
    expect(log.data[0]).toEqual(
      expect.objectContaining({
        entity_type: "recruitment",
        entity_id: 9,
        reason: "test"
      })
    );
    await softDelete.recordRestore({
      entityType: "recruitment",
      entityId: 9,
      restoredBy: "tester"
    });
  });

  test("audit repository records and exports events in file mode", async () => {
    db.query.mockResolvedValue([[]]);
    const auditRepo = require("../server/repositories/enterprise/auditEnterprise.repository");
    await auditRepo.recordEvent({
      category: "workflow",
      eventType: "workflow_update",
      action: "state_change",
      actor: "tester",
      detail: { state: "idle" }
    });
    const listed = await auditRepo.listEvents({ category: "workflow" });
    expect(listed.data.length).toBeGreaterThan(0);
    const exported = await auditRepo.exportEvents({ category: "workflow" });
    expect(exported.count).toBeGreaterThan(0);
  });

  test("metrics repository upserts daily metrics in file mode", async () => {
    db.query.mockResolvedValue([[]]);
    const metricsRepo = require("../server/repositories/enterprise/metricsEnterprise.repository");
    await metricsRepo.upsertMetric({
      metricDate: "2026-07-20",
      metricType: metricsRepo.METRIC_TYPES.DAILY,
      value: { reviews: 3, drafts: 1 }
    });
    const listed = await metricsRepo.listMetrics({
      metricType: metricsRepo.METRIC_TYPES.DAILY,
      metricDate: "2026-07-20"
    });
    expect(listed.data[0].value_json).toEqual({ reviews: 3, drafts: 1 });
  });

  test("workflow repository creates and updates workflow state in file mode", async () => {
    db.query.mockResolvedValue([[]]);
    const workflowRepo = require("../server/repositories/enterprise/workflowEnterprise.repository");
    const created = await workflowRepo.createWorkflow({
      workflow_key: "recruitment-review",
      current_state: "idle"
    });
    expect(created.workflow_key).toBe("recruitment-review");
    const updated = await workflowRepo.updateWorkflow("recruitment-review", {
      current_state: "pending_review",
      lock_version: 0
    });
    expect(updated.current_state).toBe("pending_review");
  });

  test("universal search aggregates entity results", async () => {
    db.query.mockResolvedValue([[]]);
    const search = require("../server/lib/enterprise/search/UniversalSearchService");
    const result = await search.searchAll({ entities: "settings", search: "Automation" });
    expect(result.unified.data.length).toBeGreaterThan(0);
  });

  test("enterprise persistence snapshot reports dormant automation", async () => {
    db.query.mockResolvedValue([[]]);
    const { getPlatformSnapshot } = require("../server/services/enterprise/enterprisePersistence.service");
    const snapshot = await getPlatformSnapshot();
    expect(snapshot.package).toBe("AMP-4B");
    expect(snapshot.automationDormant).toBe(true);
    expect(snapshot.flags.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
  });

  test("migration script is additive and non-destructive", () => {
    const migrationPath = path.join(
      __dirname,
      "../db/migrations/2026-07-20-amp4a2-enterprise-persistence.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    const executableSql = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(executableSql).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(executableSql).not.toMatch(/DROP TABLE/i);
    expect(executableSql).not.toMatch(/ALTER TABLE.*DROP/i);
  });
});
