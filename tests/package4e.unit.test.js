"use strict";

/**
 * Package 4E — Unit tests for bulk operations and productivity summary.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

describe("Package 4E recruitment bulk service", () => {
  const originalEnv = process.env.RECRUITMENT_OPS_METADATA_PATH;
  let tmpDir;
  let recruitmentBulkService;
  let opsMeta;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg4e-ops-"));
    process.env.RECRUITMENT_OPS_METADATA_PATH = path.join(tmpDir, "ops.json");
    jest.resetModules();
    opsMeta = require("../server/repositories/recruitmentOpsMetadata.repository");
    recruitmentBulkService = require("../server/services/recruitmentBulk.service");
  });

  afterAll(() => {
    if (originalEnv == null) delete process.env.RECRUITMENT_OPS_METADATA_PATH;
    else process.env.RECRUITMENT_OPS_METADATA_PATH = originalEnv;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("rejects bulk action without explicit confirmation", async () => {
    await expect(
      recruitmentBulkService.executeBulk({ action: "archive", ids: [1], confirm: false })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("rejects unknown bulk action", async () => {
    await expect(
      recruitmentBulkService.executeBulk({ action: "publish", ids: [1], confirm: true })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("ops metadata assignment store works without SQL", () => {
    const row = opsMeta.setAssignment(42, "editor-a", "admin");
    expect(row.assignee).toBe("editor-a");
    expect(opsMeta.getAssignment(42).assignee).toBe("editor-a");
    opsMeta.removeAssignment(42);
    expect(opsMeta.getAssignment(42)).toBeNull();
  });
});

describe("Package 4E admin productivity service", () => {
  test("exports productivity summary builder", () => {
    const service = require("../server/services/adminProductivity.service");
    expect(typeof service.getProductivitySummary).toBe("function");
    expect(service.PENDING_REVIEW_STATES).toContain("review_pending");
    expect(service.VALIDATION_WARNING_STATES).toContain("changes_requested");
  });
});

describe("Package 4E page bulk regenerate service", () => {
  test("requires confirmation and validates slugs", async () => {
    const service = require("../server/services/pageBulkRegenerate.service");
    await expect(service.regeneratePages({ slugs: ["a"], confirm: false })).rejects.toMatchObject({
      statusCode: 400
    });
    await expect(service.regeneratePages({ slugs: [], confirm: true })).rejects.toMatchObject({
      statusCode: 400
    });
  });
});

describe("Package 4E client helper modules", () => {
  test("ops search and notifications scripts are syntactically loadable as source text", () => {
    const root = path.join(__dirname, "..");
    const search = fs.readFileSync(path.join(root, "public/assets/js/admin-ops-search.js"), "utf8");
    const notify = fs.readFileSync(
      path.join(root, "public/assets/js/admin-ops-notifications.js"),
      "utf8"
    );
    expect(search).toContain("window.AdminOpsSearch");
    expect(notify).toContain("window.AdminOpsNotifications");
    expect(() => new Function(search)).not.toThrow();
    expect(() => new Function(notify)).not.toThrow();
  });
});
