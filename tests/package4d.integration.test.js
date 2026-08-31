"use strict";

/**
 * Package 4D — Shared Runtime Preview & Cross-Process Consistency.
 *
 * Integration checks: auth gating for the shared preview API, a single
 * reusable preview panel consumed by both Recruitment Operations and
 * Editorial Review, and regression against Packages 4B and 4C.
 */

const request = require("supertest");
const fs = require("fs");
const path = require("path");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 4D Shared Runtime Preview integration", () => {
  test("shared preview APIs require existing admin authentication", async () => {
    const preview = await request(app).get("/api/admin/shared-preview/1");
    expect(preview.status).toBe(401);

    const diagnostics = await request(app).get("/api/admin/shared-preview/1/diagnostics");
    expect(diagnostics.status).toBe(401);

    const refresh = await request(app)
      .post("/api/admin/shared-preview/1/refresh")
      .send({ reason: "manual" });
    expect(refresh.status).toBe(401);
  });

  test("both operator surfaces embed the same shared preview panel", () => {
    const recruitments = read("private/admin-recruitments.html");
    const editorialReview = read("private/admin-editorial-review.html");

    for (const html of [recruitments, editorialReview]) {
      expect(html).toContain("Shared Runtime Preview");
      expect(html).toContain('id="sharedPreviewPanel"');
      expect(html).toContain("/js/admin-shared-preview.js");
      expect(html).toContain("/css/admin/shared-preview.css");
    }
  });

  test("shared preview client is a single reusable representation consumed by both modules", () => {
    const shared = read("public/assets/js/admin-shared-preview.js");
    expect(shared).toContain("window.AdminSharedPreview");
    expect(shared).toContain("/api/admin/shared-preview/");

    const ops = read("public/assets/js/admin-recruitment-operations.js");
    const review = read("public/assets/js/admin-editorial-review.js");
    expect(ops).toContain("window.AdminSharedPreview");
    expect(review).toContain("window.AdminSharedPreview");
    // Neither module builds its own preview — both defer to the shared panel.
    expect(ops).not.toContain("/api/admin/shared-preview/");
    expect(review).not.toContain("/api/admin/shared-preview/");
  });

  test("shared preview stays manual: no polling, timers, or background sync", () => {
    const shared = read("public/assets/js/admin-shared-preview.js");
    expect(shared).not.toMatch(/setInterval|setTimeout/);
    expect(shared).not.toMatch(/websocket|eventsource/i);
    expect(shared).toContain("Refresh preview");

    const service = read("server/services/sharedPreview.service.js");
    expect(service).not.toMatch(/setInterval|setTimeout|cron\(/i);
    expect(service).not.toMatch(/require\(.*(redis|node-cache|worker)/i);
  });

  test("shared preview API surface is read-oriented plus manual refresh only", () => {
    const routes = read("server/api/admin/sharedPreview.routes.js");
    expect(routes).toContain('"/shared-preview/:recruitmentId"');
    expect(routes).toContain('"/shared-preview/:recruitmentId/diagnostics"');
    expect(routes).toContain('"/shared-preview/:recruitmentId/refresh"');
    expect(routes).not.toMatch(/router\.(put|delete|patch)/);
    expect(routes).not.toMatch(/publish/i);
  });

  test("refresh hooks cover recruitment update, draft change, review decision and page link change", () => {
    expect(read("server/controllers/admin/recruitment.controller.js")).toContain(
      '"recruitment_update"'
    );
    expect(read("server/controllers/admin/recruitmentDraftBinding.controller.js")).toContain(
      '"draft_change"'
    );
    expect(read("server/controllers/admin/editorialReview.controller.js")).toContain(
      '"review_decision"'
    );
    expect(read("server/controllers/admin/recruitmentPageLink.controller.js")).toContain(
      '"page_link_change"'
    );
  });

  test("Package 4C Editorial Review regression still holds", async () => {
    const response = await request(app).get("/admin/editorial-review");
    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/login/);

    const html = read("private/admin-editorial-review.html");
    expect(html).toContain("Editorial Review Workspace");
    expect(html).toContain("Decision controls");
    expect(html).toContain("Validation summary");
    expect(html).toContain("Internal notes");

    const binding = await request(app).get("/api/admin/recruitments/1/draft-binding");
    expect(binding.status).toBe(401);
    const reviews = await request(app).get("/api/admin/editorial-reviews");
    expect(reviews.status).toBe(401);
  });

  test("Package 4B Recruitment Operations regression still holds", async () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain("Recruitment Manager");
    expect(html).toContain("Event Timeline");
    expect(html).toContain("Recruitment Page");
    expect(html).toContain("Generator Draft Binding");

    const list = await request(app).get("/api/admin/recruitments");
    expect(list.status).toBe(401);
    const update = await request(app).put("/api/admin/recruitments/1").send({ title: "x" });
    expect(update.status).toBe(401);
  });
});
