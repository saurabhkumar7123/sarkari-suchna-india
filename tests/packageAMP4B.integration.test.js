"use strict";

const request = require("supertest");
const app = require("../server/app");

describe("Package AMP-4B Production Runtime Integration", () => {
  test("automation flags remain fail-safe off by default", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
  });

  test("enterprise persistence and ACC endpoints require authentication", async () => {
    const endpoints = [
      "/api/admin/enterprise-persistence/snapshot",
      "/api/admin/automation-control-center",
      "/api/admin/automation-control-center/dashboard"
    ];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
    }
  });

  test("ACC page exposes live runtime modules", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(
      path.join(__dirname, "../private/admin-automation-control-center.html"),
      "utf8"
    );
    expect(html).toContain("Control overview");
    expect(html).toContain("accWorkerStatusPill");
    expect(html).toContain("accTelegramStatusPill");
    expect(html).not.toContain("Advisory only");
  });
});
