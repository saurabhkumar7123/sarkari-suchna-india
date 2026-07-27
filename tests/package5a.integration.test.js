'use strict';

/**
 * Package 5A — Integration regression: Programs 4 surfaces unchanged.
 *
 * Confirms Package 5A did not wire runtime routes or alter Program 4
 * admin pages / APIs. Observability framework remains advisory-only.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 5A does not change Program 4 production surfaces", () => {
  test("pipeline health route is not activated", async () => {
    const response = await request(app).get("/admin/pipeline-health");
    // Unwired path should not serve a dedicated pipeline health page.
    expect([404, 302, 401]).toContain(response.status);
    expect(fs.existsSync(path.join(root, "private/admin-pipeline-health.html"))).toBe(
      false
    );
  });

  test("Program 4 SEO diagnostics surface still present", async () => {
    const diagnostics = await request(app).get("/api/admin/seo-diagnostics");
    expect(diagnostics.status).toBe(401);

    const html = read("private/admin-seo-diagnostics.html");
    expect(html).toContain("SEO Diagnostics");
  });

  test("Program 4 editorial and shared preview surfaces still present", () => {
    expect(read("private/admin-editorial-review.html")).toContain("Editorial");
    expect(read("private/admin-recruitment-runtime-preview.html").length).toBeGreaterThan(
      0
    );
    expect(read("public/assets/js/admin-nav.js")).toContain(
      'data-nav-path="/admin/editorial-review"'
    );
    expect(read("public/assets/js/admin-nav.js")).toContain(
      'data-nav-path="/admin/seo-diagnostics"'
    );
    expect(read("public/assets/js/admin-nav.js")).not.toContain(
      "/admin/pipeline-health"
    );
  });

  test("advisory pipeline health module exists without express wiring", () => {
    const indexSrc = read("server/lib/recruitment/pipelineHealth/index.js");
    expect(indexSrc).toMatch(/Package 5A/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getPipelineHealthAndDiagnosticsFramework,
    } = require("../server/lib/recruitment/pipelineHealth");
    const framework = getPipelineHealthAndDiagnosticsFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.runtimeEffects.productionBehaviorChanged).toBe(false);
  });
});
