"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Monitoring Official Sources consolidation", () => {
  test("/admin/monitoring is the canonical Official Sources UI", () => {
    const monitoring = read("private/admin-monitoring.html");
    expect(monitoring).toContain('id="acc-sources-title">Official Source Manager');
    expect(monitoring).toContain('id="accSourceRows"');
    expect(monitoring).toContain('id="accAddSourceBtn"');
    expect(monitoring).toContain('id="accSourceDialog"');
    expect(monitoring).toContain("admin-automation-control-center.js");
    expect(monitoring).toContain('data-acc-page="sources"');
    expect(monitoring).toContain('data-mon-page="sources"');
    expect(monitoring).toContain("Monitoring status");
    expect(monitoring).toContain('href="/admin/monitoring/activity"');
    expect(monitoring).not.toContain("Runtime: Dormant");
    expect(monitoring).not.toContain("Activation: NO-GO");
  });

  test("ACC /sources is redirected, not a second functional UI", () => {
    const appSource = read("server/app.js");
    expect(appSource).toContain('"/admin/automation-control-center/sources"');
    expect(appSource).toContain('res.redirect(302, "/admin/monitoring")');
    expect(appSource).not.toMatch(/sources:\s*"admin-automation-sources\.html"/);

    const stub = read("private/admin-automation-sources.html");
    expect(stub).toContain("/admin/monitoring");
    expect(stub).not.toContain('id="accSourceRows"');
    expect(stub).not.toContain('id="accAddSourceBtn"');
  });

  test("ACC navigation no longer lists Sources", () => {
    const pages = [
      "private/admin-automation-control-center.html",
      "private/admin-automation-controls.html",
      "private/admin-automation-drafts.html",
      "private/admin-automation-recruitments.html",
      "private/admin-automation-reviews.html",
      "private/admin-automation-queue.html",
      "private/admin-automation-insights.html",
      "private/admin-automation-health.html",
      "private/admin-automation-logs.html"
    ];
    for (const page of pages) {
      const html = read(page);
      expect(html).not.toContain('href="/admin/automation-control-center/sources"');
      expect(html).not.toMatch(/>Sources</);
      expect(html).not.toMatch(/>Official sources</);
    }
  });

  test("ACC overview keeps Monitoring summary + Open Monitoring only", () => {
    const overview = read("private/admin-automation-control-center.html");
    expect(overview).toContain('id="accMonitoringSection"');
    expect(overview).toContain("Open Monitoring");
    expect(overview).toContain('href="/admin/monitoring"');
    expect(overview).not.toContain("Open Sources");
    expect(overview).not.toContain('id="accSourceRows"');
    expect(overview).not.toContain('id="accAddSourceBtn"');
    expect(overview).toContain("Official Sources");
    expect(overview).toContain("Needs attention");
  });

  test("dashboard has monitoring summary link, not source-management UI", () => {
    const dashboard = read("private/admin-dashboard.html");
    expect(dashboard).toContain('href="/admin/monitoring"');
    expect(dashboard).toContain("Open Monitoring");
    expect(dashboard).not.toContain('id="accSourceRows"');
    expect(dashboard).not.toContain('id="accAddSourceBtn"');
    expect(dashboard).not.toContain("Official Source Manager");
    expect(dashboard).not.toContain('href="/admin/automation-control-center/sources"');
  });

  test("source registry APIs remain under ACC API paths", () => {
    const routes = read("server/api/admin/automationControlCenter.routes.js");
    expect(routes).toContain("/automation-control-center/sources");
    expect(routes).toContain("/automation-control-center/sources/verify");
    const client = read("public/assets/js/admin-automation-control-center.js");
    expect(client).toContain("/api/admin/automation-control-center/sources");
    expect(client).toContain('accSources: "/admin/monitoring"');
  });

  test("automation flags and auto-publish lock remain unchanged", () => {
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.PRODUCTION_MONITORING_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(current.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
    expect(current.AUTO_DRAFT_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.isAutomationDormant()).toBe(true);
  });

  test("ACC sources route requires auth then redirects when authenticated path is configured", async () => {
    const unauth = await request(app).get("/admin/automation-control-center/sources");
    expect(unauth.status).toBe(302);
    expect(unauth.headers.location).toMatch(/^\/login/);
  });

  test("command palette points Official Sources at /admin/monitoring", () => {
    const palette = read("public/assets/js/admin-command-palette.js");
    expect(palette).toContain('href: "/admin/monitoring"');
    expect(palette).toContain("Open Source Manager");
    expect(palette).not.toContain("/admin/automation-control-center/sources");
  });
});
