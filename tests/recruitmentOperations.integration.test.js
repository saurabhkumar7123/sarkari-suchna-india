"use strict";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 4B Recruitment Operations integration", () => {
  test("Recruitment Operations page requires existing admin authentication", async () => {
    const response = await request(app).get("/admin/recruitments");
    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/login/);
  });

  test("admin dashboard and shared navigation expose Recruitment Operations", () => {
    expect(read("private/admin-dashboard.html")).toContain('href="/admin/recruitments"');
    expect(read("public/assets/js/admin-nav.js")).toContain('data-nav-path="/admin/recruitments"');
  });

  test("manager provides recruitment, event, page-link, and readiness controls", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain("Recruitment Manager");
    expect(html).toContain("Recruitment Events");
    expect(html).toContain("Recruitment Page Links");
    expect(html).toContain("Ready for Review");
    expect(html).toContain('id="archiveRecruitmentBtn"');
    expect(html).toContain('id="validatePageBtn"');
  });

  test("operator UI uses only authenticated manual CRUD endpoints", () => {
    const js = read("public/assets/js/admin-recruitment-operations.js");
    expect(js).toContain("/api/admin/recruitments");
    expect(js).toContain("/api/admin/recruitment-events/");
    expect(js).toContain("/api/admin/page-linkages");
    expect(js).not.toContain("/publish");
    expect(js).not.toMatch(/worker|scheduler|monitoring pipeline/i);
  });
});
