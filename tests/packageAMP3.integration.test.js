"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package AMP-3 Automation Control Center", () => {
  test("automation control center routes remain authenticated", async () => {
    const dashboard = await request(app).get("/admin/dashboard");
    expect(dashboard.status).toBe(302);
    expect(dashboard.headers.location).toMatch(/^\/login/);

    const alias = await request(app).get("/admin/automation-control-center");
    expect(alias.status).toBe(302);
    expect(alias.headers.location).toMatch(/^\/login/);
  });

  test("ACC overview is a control dashboard, not a mega-page of every module", () => {
    const html = read("private/admin-automation-control-center.html");
    expect(html).toContain("Automation Control Center");
    expect(html).toContain("Control overview");
    expect(html).toContain("accPipelineFlagLabel");
    expect(html).toContain("accWorkerStatusPill");
    expect(html).toContain("View details");
    expect(html).not.toMatch(/Advisory only/i);
    expect(html).not.toContain("id=\"accAddSourceBtn\"");
    expect(html).not.toContain("id=\"accSourceRows\"");
    expect(html).not.toContain("id=\"accRecruitmentRows\"");
    expect(html).not.toContain("id=\"accAuditRows\"");
    expect(html).not.toContain("id=\"accSchedulerToggle\"");
    expect(html).not.toContain("id=\"accSettingsForm\"");
  });

  test("dedicated ACC pages expose their modules", () => {
    expect(read("private/admin-automation-sources.html")).toContain("Official Source Manager");
    expect(read("private/admin-automation-recruitments.html")).toContain("Recruitment Explorer");
    expect(read("private/admin-automation-reviews.html")).toContain("Review Center");
    expect(read("private/admin-automation-drafts.html")).toContain("Draft Viewer");
    expect(read("private/admin-automation-queue.html")).toContain("Workflow Queue");
    expect(read("private/admin-automation-insights.html")).toContain("AI Insights");
    expect(read("private/admin-automation-health.html")).toContain("Health cards");
    expect(read("private/admin-automation-health.html")).toContain("Open Monitoring");
    expect(read("private/admin-automation-logs.html")).toContain("Audit Center");
    expect(read("private/admin-automation-controls.html")).toContain("Feature Flags");
    expect(read("private/admin-automation-controls.html")).toContain("accSchedulerToggle");
  });

  test("ACC assets and navigation are wired", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain("Automation Control Center");

    const palette = read("public/assets/js/admin-command-palette.js");
    expect(palette).toContain("Open Source Manager");
    expect(palette).toContain("Open AI Insights");

    const client = read("public/assets/js/admin-automation-control-center.js");
    expect(client).toContain("/api/admin/automation-control-center");
    expect(client).not.toContain("localStorage.getItem");
    expect(client).not.toContain("localStorage.setItem");
    expect(client).not.toMatch(/setInterval\s*\(/);
  });

  test("server wires admin dashboard to ACC page", () => {
    const source = read("server/app.js");
    expect(source).toContain("/admin/automation-control-center");
    expect(source).toContain("admin-automation-control-center.html");
    expect(source).toContain("ACC_SECTION_PAGES");
    expect(source).toContain("admin-automation-drafts.html");
  });

  test("recruitment pipeline config remains fail-safe off", () => {
    const config = require("../server/config/recruitmentPipeline");
    const enabled =
      config.RECRUITMENT_PIPELINE_ENABLED ?? config.isRecruitmentPipelineEnabled?.() ?? false;
    expect(enabled).toBe(false);
  });

  test("ACC integration API remains authenticated", async () => {
    const res = await request(app).get("/api/admin/automation-control-center");
    expect(res.status).toBe(401);
  });
});
