"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dry-run-suite-"));
process.env.AUTOMATION_MASTER_CONTROL_PATH = path.join(tmpDir, "master.json");
process.env.AUTOMATION_CONTROL_PLANE_PATH = path.join(tmpDir, "plane.json");
delete process.env.AUTOMATION_MASTER_ENABLED;
delete process.env.AUTOMATION_EMERGENCY_STOP;
delete process.env.AUTOMATION_MODE;

jest.mock("../server/repositories/enterprise/auditEnterprise.repository", () => ({
  recordEvent: jest.fn().mockResolvedValue({ id: 1 }),
  isReady: jest.fn().mockResolvedValue(false),
  listEvents: jest.fn()
}));

jest.mock("../server/services/updates/siteChecker", () => ({
  checkSite: jest.fn()
}));

jest.mock("../server/services/updates/updates.repository", () => ({
  fetchSites: jest.fn(),
  getSiteById: jest.fn()
}));

const { checkSite } = require("../server/services/updates/siteChecker");
const { fetchSites, getSiteById } = require("../server/services/updates/updates.repository");
const controlPlane = require("../server/config/automationControlPlane");
const dryRun = require("../server/services/updates/monitoringDryRun");

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("monitoring dry-run framework", () => {
  beforeEach(() => {
    controlPlane.writeControlPlane({ mode: "DORMANT", updatedBy: "test-reset" });
    controlPlane.invalidateCache();
    checkSite.mockReset();
    fetchSites.mockReset();
    getSiteById.mockReset();
  });

  test("refuses dry-run when mode inactive", async () => {
    await expect(
      dryRun.runSourceDryRun({
        id: 1,
        name: "X",
        url: "https://ssc.gov.in/",
        selector: "a",
        active: 1
      })
    ).rejects.toMatchObject({
      code: "DRY_RUN_INACTIVE"
    });
  });

  test("dry-run detects change without publish/telegram/draft", async () => {
    controlPlane.setDryRunMode(true);
    const site = {
      id: 7,
      name: "SSC",
      url: "https://ssc.gov.in/portal",
      selector: "a",
      active: 1,
      broken: 0,
      failCount: 0,
      lastCheckedAt: "2026-09-01T00:00:00.000Z"
    };
    getSiteById.mockResolvedValue(site);
    checkSite.mockResolvedValue({ changed: true, invalid: false });

    const result = await dryRun.runSourceDryRun(7);
    expect(result.dryRun).toBe(true);
    expect(result.check.changed).toBe(true);
    expect(result.published).toBe(false);
    expect(result.telegramSent).toBe(false);
    expect(result.draftCreated).toBe(false);
    expect(result.externalNotificationSent).toBe(false);
    expect(checkSite).toHaveBeenCalled();
  });

  test("batch dry-run isolates sources and keeps guarantees", async () => {
    controlPlane.setDryRunMode(true);
    fetchSites.mockResolvedValue([
      {
        id: 1,
        name: "A",
        url: "https://ssc.gov.in/a",
        selector: "a",
        active: 1,
        broken: 0,
        failCount: 0,
        lastCheckedAt: "2026-09-01T00:00:00.000Z"
      },
      {
        id: 2,
        name: "B",
        url: "https://upsc.gov.in/b",
        selector: "a",
        active: 1,
        broken: 0,
        failCount: 0,
        lastCheckedAt: "2026-09-01T00:00:00.000Z"
      }
    ]);
    checkSite
      .mockResolvedValueOnce({ changed: false, invalid: false })
      .mockResolvedValueOnce({ changed: true, invalid: false });

    const batch = await dryRun.runDryRunBatch({ limit: 5 });
    expect(batch.count).toBe(2);
    expect(batch.guarantees.published).toBe(false);
    expect(batch.guarantees.telegramSent).toBe(false);
    expect(batch.guarantees.autoPublishBlocked).toBe(true);
    expect(batch.guarantees.externalWebsiteModified).toBe(false);
  });
});
