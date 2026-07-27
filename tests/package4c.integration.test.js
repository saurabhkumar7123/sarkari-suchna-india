"use strict";

const request = require("supertest");
const fs = require("fs");
const path = require("path");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 4C Human Review Workflow integration", () => {
  test("Editorial Review page requires existing admin authentication", async () => {
    const response = await request(app).get("/admin/editorial-review");
    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/login/);
  });

  test("draft binding and editorial review APIs require authentication", async () => {
    const binding = await request(app).get("/api/admin/recruitments/1/draft-binding");
    expect(binding.status).toBe(401);

    const attach = await request(app)
      .post("/api/admin/recruitments/1/draft-binding/attach")
      .send({ draft_id: 1 });
    expect(attach.status).toBe(401);

    const reviews = await request(app).get("/api/admin/editorial-reviews");
    expect(reviews.status).toBe(401);

    const decision = await request(app)
      .post("/api/admin/editorial-reviews/1/decision")
      .send({ decision: "approve" });
    expect(decision.status).toBe(401);
  });

  test("admin dashboard and navigation expose Editorial Review workspace", () => {
    expect(read("private/admin-dashboard.html")).toContain('href="/admin/editorial-review"');
    expect(read("public/assets/js/admin-nav.js")).toContain('data-nav-path="/admin/editorial-review"');
    expect(read("public/assets/js/admin-nav.js")).toContain('data-nav-path="/admin/recruitments"');
  });

  test("Recruitment Operations exposes draft binding controls", () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain("Generator Draft Binding");
    expect(html).toContain('id="draftBindForm"');
    expect(html).toContain('id="openEditorialReviewBtn"');

    const js = read("public/assets/js/admin-recruitment-operations.js");
    expect(js).toContain("/draft-binding/attach");
    expect(js).toContain("/draft-binding/detach");
    expect(js).toContain("/draft-binding/replace");
    expect(js).not.toContain("/publish");
    expect(js).not.toMatch(/worker|scheduler|monitoring pipeline/i);
  });

  test("Editorial Review workspace exposes manual decision controls only", () => {
    const html = read("private/admin-editorial-review.html");
    expect(html).toContain("Editorial Review Workspace");
    expect(html).toContain("Decision controls");
    expect(html).toContain("Validation summary");
    expect(html).toContain("Internal notes");

    const js = read("public/assets/js/admin-editorial-review.js");
    expect(js).toContain("/api/admin/editorial-reviews");
    expect(js).toContain("approve");
    expect(js).toContain("request_changes");
    expect(js).toContain("return_to_draft");
    expect(js).toContain("reopen_review");
    expect(js).not.toMatch(/auto.?publish|scheduler|worker/i);
  });

  test("Package 4B Recruitment Operations regression still holds", () => {
    expect(read("private/admin-dashboard.html")).toContain('href="/admin/recruitments"');
    expect(read("public/assets/js/admin-nav.js")).toContain('data-nav-path="/admin/recruitments"');
    const html = read("private/admin-recruitments.html");
    expect(html).toContain("Recruitment Manager");
    expect(html).toContain("Recruitment Events");
    expect(html).toContain("Recruitment Page Links");
    expect(html).toContain("Ready for Review");
  });
});
