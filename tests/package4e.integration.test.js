"use strict";

/**
 * Package 4E — Admin Productivity & Operational Efficiency.
 *
 * Covers bulk recruitment ops, dashboard productivity widgets, quick actions,
 * operational search helpers, local notifications, stub closure
 * (bulk regenerate + Live Visitors removal), and navigation polish.
 * Regression against Packages 4B–4D.
 */

const request = require("supertest");
const fs = require("fs");
const path = require("path");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 4E Admin Productivity integration", () => {
  test("bulk recruitment and productivity APIs require authentication", async () => {
    const bulk = await request(app)
      .post("/api/admin/recruitments/bulk")
      .send({ action: "archive", ids: [1], confirm: true });
    expect(bulk.status).toBe(401);

    const productivity = await request(app).get("/api/admin/admin-productivity");
    expect(productivity.status).toBe(401);

    const regenerate = await request(app)
      .post("/api/admin/pages/bulk-regenerate")
      .send({ slugs: ["demo"], confirm: true });
    expect(regenerate.status).toBe(401);
  });

  test("bulk recruitment UI exposes confirmed batch actions", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain('id="recruitmentBulkBar"');
    expect(html).toContain('id="bulkActionSelect"');
    expect(html).toContain("Bulk Archive");
    expect(html).toContain("Bulk Restore");
    expect(html).toContain("Bulk Status Update");
    expect(html).toContain("Bulk Category Update");
    expect(html).toContain("Bulk Assignment");
    expect(html).toContain("Bulk Delete");
    expect(html).toContain("admin-ops-search.js");
    expect(html).toContain("admin-ops-notifications.js");

    const js = read("public/assets/js/admin-recruitment-operations.js");
    expect(js).toContain("/api/admin/recruitments/bulk");
    expect(js).toContain("confirm: true");
    expect(js).toContain("AdminOpsSearch");
    expect(js).toContain("saveFilter");
    expect(js).toContain("rememberSearch");
    expect(js).not.toMatch(/setInterval|websocket|worker/i);
  });

  test("dashboard productivity widgets and quick actions are present", () => {
    const html = read("private/admin-dashboard.html");
    expect(html).toContain('id="dashboardOpsProductivity"');
    expect(html).toContain('id="opsPendingReviews"');
    expect(html).toContain('id="opsActiveRecruitments"');
    expect(html).toContain('id="opsDraftsWaiting"');
    expect(html).toContain('id="opsBrokenPageLinks"');
    expect(html).toContain('id="opsValidationWarnings"');
    expect(html).toContain("Create Draft");
    expect(html).toContain("Search Recruitments");
    expect(html).toContain("Open Events");
    expect(html).toContain("Shared Preview");
    expect(html).toContain('href="/admin/editorial-review"');
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("card--coming-soon");
    expect(html).not.toMatch(/Live Visitors/i);

    const js = read("public/assets/js/admin-dashboard.js");
    expect(js).toContain("/api/admin/admin-productivity");
    expect(js).toContain("loadProductivityWidgets");
  });

  test("operational search and local notifications modules exist", () => {
    const search = read("public/assets/js/admin-ops-search.js");
    expect(search).toContain("window.AdminOpsSearch");
    expect(search).toContain("persistFilters");
    expect(search).toContain("recentSearches");
    expect(search).toContain("saveFilter");

    const notify = read("public/assets/js/admin-ops-notifications.js");
    expect(notify).toContain("window.AdminOpsNotifications");
    expect(notify).toContain("REVIEW_COMPLETED");
    expect(notify).toContain("DRAFT_ATTACHED");
    expect(notify).toContain("VALIDATION_WARNING");
    expect(notify).toContain("BROKEN_PAGE_LINK");
    expect(notify).not.toMatch(/setInterval\s*\(/);
    expect(notify).not.toMatch(/mailto:|Notification\.requestPermission|serviceWorker/i);

    const bell = read("public/assets/js/admin-notifications.js");
    expect(bell).toContain("AdminOpsNotifications");
  });

  test("Coming soon stubs are closed: bulk regenerate implemented, Live Visitors removed", () => {
    const pageManager = read("public/assets/js/admin-page-manager.js");
    expect(pageManager).toContain("/api/admin/pages/bulk-regenerate");
    expect(pageManager).toContain("confirm: true");
    expect(pageManager).not.toContain("Coming soon");
    expect(pageManager).not.toContain("Regenerate (soon)");

    const routes = read("server/api/admin/page.routes.js");
    expect(routes).toContain('"/pages/bulk-regenerate"');

    const service = read("server/services/pageBulkRegenerate.service.js");
    expect(service).toContain("regeneratePages");
    expect(service).toContain("confirm !== true");
    expect(service).not.toMatch(/setInterval\s*\(/);
    expect(service).not.toMatch(/require\(["'].*bull/i);
  });

  test("navigation connects Dashboard, Operations, Editorial Review, Events, Shared Preview", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('data-nav-path="/admin/dashboard"');
    expect(nav).toContain('data-nav-path="/admin/recruitments"');
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).toContain('data-nav-path="/admin/recruitment-runtime-preview"');
    expect(nav).toContain("#eventTimeline");
    expect(nav).toContain("Shared Preview");

    const palette = read("public/assets/js/admin-command-palette.js");
    expect(palette).toContain("Create Recruitment");
    expect(palette).toContain("Open Editorial Review");
    expect(palette).toContain("Open Shared Preview");
    expect(palette).toContain("Search Recruitments");
    expect(palette).toContain("/api/admin/recruitments");
    expect(palette).toContain("/admin/recruitments#eventTimeline");
  });

  test("Package 4D Shared Preview regression still holds", async () => {
    const preview = await request(app).get("/api/admin/shared-preview/1");
    expect(preview.status).toBe(401);

    const recruitments = read("private/admin-recruitments.html");
    const editorialReview = read("private/admin-editorial-review.html");
    for (const html of [recruitments, editorialReview]) {
      expect(html).toContain("Shared Runtime Preview");
      expect(html).toContain('id="sharedPreviewPanel"');
      expect(html).toContain("/js/admin-shared-preview.js");
    }
  });

  test("Package 4C Editorial Review regression still holds", async () => {
    const response = await request(app).get("/admin/editorial-review");
    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/login/);

    const html = read("private/admin-editorial-review.html");
    expect(html).toContain("Editorial Review Workspace");
    expect(html).toContain("Decision controls");

    const reviews = await request(app).get("/api/admin/editorial-reviews");
    expect(reviews.status).toBe(401);
  });

  test("Package 4B Recruitment Operations regression still holds", async () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain("Recruitment Manager");
    expect(html).toContain("Event Timeline");
    expect(html).toContain("Recruitment Page Links");
    expect(html).toContain("Generator Draft Binding");
    expect(html).toContain('id="newRecruitmentBtn"');

    const list = await request(app).get("/api/admin/recruitments");
    expect(list.status).toBe(401);
  });

  test("automation and Program 5 surfaces remain out of package scope", () => {
    const bulk = read("server/services/recruitmentBulk.service.js");
    expect(bulk).toContain("confirm");
    expect(bulk).not.toMatch(/require\(["'].*(bullmq|ioredis|node-cron)/i);
    expect(bulk).not.toMatch(/\.publish\s*\(/);

    const productivity = read("server/services/adminProductivity.service.js");
    expect(productivity).not.toMatch(/setInterval\s*\(/);
    expect(productivity).not.toMatch(/require\(["'].*(bullmq|node-cron)/i);
  });
});
