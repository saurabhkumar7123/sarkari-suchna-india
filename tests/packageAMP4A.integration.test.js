"use strict";

const request = require("supertest");
const app = require("../server/app");

describe("Package AMP-4A Controlled Production Integration", () => {
  test("automation flags remain fail-safe off by default", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
    expect(current.AUTO_DRAFT_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(current.NOTIFICATION_GATEWAY_ENABLED).toBe(false);
    expect(current.PRODUCTION_MONITORING_ENABLED).toBe(false);
    expect(current.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
    expect(current.WORKER_ACTIVATION_ENABLED).toBe(false);
    expect(flags.canStartMonitoringScheduler()).toBe(false);
    expect(flags.canRunAutomationWorkers()).toBe(false);
    expect(flags.canDeliverTelegram()).toBe(false);
  });

  test("automation control center endpoints require authentication", async () => {
    const endpoints = [
      "/api/admin/automation-control-center",
      "/api/admin/automation-control-center/dashboard",
      "/api/admin/automation-control-center/sources",
      "/api/admin/automation-control-center/settings",
      "/api/admin/automation-control-center/workflow",
      "/api/admin/automation-control-center/audit",
      "/api/admin/automation-control-center/controls"
    ];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
    }
  });
});
