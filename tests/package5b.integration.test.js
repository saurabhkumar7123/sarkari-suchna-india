'use strict';

/**
 * Package 5B — Integration regression: Programs 4–5A surfaces unchanged.
 *
 * Confirms Package 5B did not wire runtime routes or alter Program 4/5A
 * admin pages / APIs. Integration framework remains advisory-only.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 5B does not change Program 4–5A production surfaces", () => {
  test("monitoring-review-integration route is not activated", async () => {
    const response = await request(app).get("/admin/monitoring-review-integration");
    expect([404, 302, 401]).toContain(response.status);
    expect(
      fs.existsSync(path.join(root, "private/admin-monitoring-review-integration.html"))
    ).toBe(false);
  });

  test("pipeline health route remains unwired (5A regression)", async () => {
    const response = await request(app).get("/admin/pipeline-health");
    expect([404, 302, 401]).toContain(response.status);
  });

  test("Program 4 editorial and shared preview surfaces still present", () => {
    expect(read("private/admin-editorial-review.html")).toContain("Editorial");
    expect(read("private/admin-recruitment-runtime-preview.html").length).toBeGreaterThan(
      0
    );
    const nav = read("public/assets/js/admin-nav.js");
    expect(nav).toContain('data-nav-path="/admin/editorial-review"');
    expect(nav).toContain('data-nav-path="/admin/seo-diagnostics"');
    expect(nav).not.toContain("/admin/pipeline-health");
    expect(nav).not.toContain("/admin/monitoring-review-integration");
  });

  test("advisory monitoring review module exists without express wiring", () => {
    const indexSrc = read(
      "server/lib/recruitment/monitoringReviewIntegration/index.js"
    );
    expect(indexSrc).toMatch(/Package 5B/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getMonitoringReviewIntegrationFramework,
    } = require("../server/lib/recruitment/monitoringReviewIntegration");
    const framework = getMonitoringReviewIntegrationFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.productionQueueInsertionDenied).toBe(true);
    expect(framework.runtimeEffects.productionBehaviorChanged).toBe(false);
  });

  test("Package 5A product facade still loads", () => {
    const {
      getPipelineHealthAndDiagnosticsFramework,
    } = require("../server/lib/recruitment/pipelineHealth");
    const framework = getPipelineHealthAndDiagnosticsFramework();
    expect(framework.packageCode).toBe("5A");
    expect(framework.advisoryOnly).toBe(true);
  });
});
