"use strict";

/**
 * Package 4F — SEO & Content Pipeline Completion integration.
 *
 * Covers sitemap/API/UI wiring and regression against Packages 4B–4E.
 */

const request = require("supertest");
const fs = require("fs");
const path = require("path");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 4F SEO & Content Pipeline integration", () => {
  test("SEO diagnostics and pipeline APIs require authentication", async () => {
    const diagnostics = await request(app).get("/api/admin/seo-diagnostics");
    expect(diagnostics.status).toBe(401);

    const sitemap = await request(app).get("/api/admin/seo-diagnostics/sitemap");
    expect(sitemap.status).toBe(401);

    const report = await request(app).get(
      "/api/admin/seo-diagnostics/feature-completion-report"
    );
    expect(report.status).toBe(401);

    const checklist = await request(app).get(
      "/api/admin/seo-pipeline/pages/demo/editorial-checklist"
    );
    expect(checklist.status).toBe(401);
  });

  test("SEO Diagnostics admin page exposes operator panels", async () => {
    const response = await request(app).get("/admin/seo-diagnostics");
    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/login/);

    const html = read("private/admin-seo-diagnostics.html");
    expect(html).toContain("SEO Diagnostics");
    expect(html).toContain('id="seoMissingMetadata"');
    expect(html).toContain('id="seoMissingSchema"');
    expect(html).toContain('id="seoBrokenLinks"');
    expect(html).toContain('id="seoDuplicateTitles"');
    expect(html).toContain('id="featureCompletionReport"');
    expect(html).toContain("admin-seo-diagnostics.js");
    expect(html).toMatch(/no automatic corrections/i);
    expect(html).toMatch(/no external SEO services/i);
    expect(html).not.toMatch(/auto-publish/i);

    const js = read("public/assets/js/admin-seo-diagnostics.js");
    expect(js).toContain("/api/admin/seo-diagnostics");
    expect(js).toContain("feature-completion-report");
    expect(js).toContain("editorial-checklist");
    expect(js).toContain("link-suggestions");
    expect(js).toContain("freshness");
    expect(js).not.toMatch(/setInterval\s*\(/);
  });

  test("navigation and command palette include SEO Diagnostics", () => {
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('data-nav-path="/admin/seo-diagnostics"');
    expect(nav).toContain("SEO Diagnostics");

    const palette = read("public/assets/js/admin-command-palette.js");
    expect(palette).toContain("SEO Diagnostics");
    expect(palette).toContain("Feature Completion Report");
  });

  test("editorial review exposes Package 4F checklist and freshness surfaces", () => {
    const html = read("private/admin-editorial-review.html");
    expect(html).toContain('id="erEditorialChecklist"');
    expect(html).toContain('id="erFreshnessMeta"');
    expect(html).toContain('id="erLinkSuggestions"');
    expect(html).toContain("/admin/seo-diagnostics");

    const js = read("public/assets/js/admin-editorial-review.js");
    expect(js).toContain("loadContentPipelineGuidance");
    expect(js).toContain("/api/admin/seo-pipeline/pages/");
    expect(js).toContain("editorial-checklist");
    expect(js).toContain("link-suggestions");
  });

  test("sitemap generator source includes hub coverage helpers", () => {
    const source = read("server/lib/sitemapGenerator.js");
    expect(source).toContain("buildStaticSitemapEntries");
    expect(source).toContain("validateSitemapCoverage");
    expect(source).toContain("topicCategories");
  });

  test("Package 4E productivity regression still holds", async () => {
    const productivity = await request(app).get("/api/admin/admin-productivity");
    expect(productivity.status).toBe(401);

    const html = read("private/admin-dashboard.html");
    expect(html).toContain('id="dashboardOpsProductivity"');
    expect(html).not.toMatch(/Live Visitors/i);
  });

  test("Package 4D Shared Preview regression still holds", async () => {
    const preview = await request(app).get("/api/admin/shared-preview/1");
    expect(preview.status).toBe(401);

    const recruitments = read("private/admin-recruitments.html");
    const editorialReview = read("private/admin-editorial-review.html");
    for (const html of [recruitments, editorialReview]) {
      expect(html).toContain("Shared Runtime Preview");
      expect(html).toContain('id="sharedPreviewPanel"');
    }
  });

  test("Package 4C Editorial Review regression still holds", async () => {
    const response = await request(app).get("/admin/editorial-review");
    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/login/);

    const reviews = await request(app).get("/api/admin/editorial-reviews");
    expect(reviews.status).toBe(401);

    const html = read("private/admin-editorial-review.html");
    expect(html).toContain("Editorial Review Workspace");
    expect(html).toContain("Decision controls");
  });

  test("Package 4B Recruitment Operations regression still holds", async () => {
    const html = read("private/admin-recruitments.html");
    expect(html).toContain("Recruitment Manager");
    expect(html).toContain("Event Timeline");
    expect(html).toContain("Generator Draft Binding");

    const list = await request(app).get("/api/admin/recruitments");
    expect(list.status).toBe(401);
  });

  test("automation and Program 5 surfaces remain out of package scope", () => {
    const service = read("server/services/seoPipeline.service.js");
    expect(service).not.toMatch(/require\(["'].*(bullmq|ioredis|node-cron)/i);
    expect(service).not.toMatch(/\.publish\s*\(/);
    expect(service).toMatch(/[Aa]dvisory/);

    const report = read("server/lib/seo/featureCompletionReport.js");
    expect(report).toContain("authorizesDeployment: false");
    expect(report).toContain("authorizesProgram5: false");
  });
});
