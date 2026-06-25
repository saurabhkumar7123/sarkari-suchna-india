"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");

describe("adminActivity.service countActivity", () => {
  let tmpDir;
  let activityPath;
  let service;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "admin-activity-"));
    activityPath = path.join(tmpDir, "admin-activity.json");
    await fs.writeFile(
      activityPath,
      JSON.stringify(
        [
          { action: "page_publish", status: "success", timestamp: "2026-06-25T10:00:00.000Z" },
          { action: "page_publish", status: "success", timestamp: "2026-06-24T10:00:00.000Z" },
          { action: "csv_upload", status: "failed", timestamp: "2026-06-25T11:00:00.000Z" },
          { action: "login", status: "success", timestamp: "2026-06-25T12:00:00.000Z" }
        ],
        null,
        2
      ),
      "utf8"
    );
    jest.resetModules();
    jest.doMock("../server/services/file.service", () => ({
      readFile: (p, enc) => fs.readFile(p, enc),
      writeFile: (p, data, enc) => fs.writeFile(p, data, enc)
    }));
    jest.doMock("path", () => {
      const actual = jest.requireActual("path");
      return {
        ...actual,
        join: (...parts) => {
          const joined = actual.join(...parts);
          if (joined.endsWith("admin-activity.json")) return activityPath;
          if (joined.endsWith("data")) return tmpDir;
          return joined;
        }
      };
    });
    service = require("../server/services/adminActivity.service");
  });

  afterEach(async () => {
    jest.resetModules();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("counts successful publishes", async () => {
    const count = await service.countActivity({ action: "page_publish", status: "success" });
    expect(count).toBe(2);
  });

  test("counts failed actions", async () => {
    const count = await service.countActivity({ status: "failed" });
    expect(count).toBe(1);
  });
});
