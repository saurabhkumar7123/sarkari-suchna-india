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

  test("ACC page exposes all major runtime modules", () => {
    const html = read("private/admin-automation-control-center.html");
    expect(html).toContain("Automation Control Center");
    expect(html).toContain("Official Source Manager");
    expect(html).toContain("Recruitment Explorer");
    expect(html).toContain("Review Center");
    expect(html).toContain("Workflow Queue");
    expect(html).toContain("AI Insights");
    expect(html).toContain("Audit Center");
    expect(html).toContain("Feature Flags");
    expect(html).toContain("accPipelineFlagLabel");
    expect(html).toContain("accWorkerStatusPill");
    expect(html).not.toMatch(/Advisory only/i);
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
