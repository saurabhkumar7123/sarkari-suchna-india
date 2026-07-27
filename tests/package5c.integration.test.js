'use strict';

/**
 * Package 5C — Integration regression: Programs 4–5B surfaces unchanged.
 *
 * Confirms Package 5C did not wire runtime routes or alter Program 4/5A/5B
 * admin pages / APIs. Lifecycle engine remains advisory-only.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 5C does not change Program 4–5B production surfaces", () => {
  test("controlled-lifecycle route is not activated", async () => {
    const response = await request(app).get("/admin/controlled-lifecycle");
    expect([404, 302, 401]).toContain(response.status);
    expect(
      fs.existsSync(path.join(root, "private/admin-controlled-lifecycle.html"))
    ).toBe(false);
  });

  test("lifecycle-engine route is not activated", async () => {
    const response = await request(app).get("/admin/lifecycle-engine");
    expect([404, 302, 401]).toContain(response.status);
  });

  test("pipeline health and monitoring-review routes remain unwired", async () => {
    const pipeline = await request(app).get("/admin/pipeline-health");
    expect([404, 302, 401]).toContain(pipeline.status);

    const monitoring = await request(app).get("/admin/monitoring-review-integration");
    expect([404, 302, 401]).toContain(monitoring.status);
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
    expect(nav).not.toContain("/admin/controlled-lifecycle");
    expect(nav).not.toContain("/admin/lifecycle-engine");
  });

  test("advisory controlled lifecycle module exists without express wiring", () => {
    const indexSrc = read(
      "server/lib/recruitment/controlledLifecycleEngine/index.js"
    );
    expect(indexSrc).toMatch(/Package 5C/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getControlledLifecycleEngineFramework,
    } = require("../server/lib/recruitment/controlledLifecycleEngine");
    const framework = getControlledLifecycleEngineFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.automaticTransitionDenied).toBe(true);
    expect(framework.safetyBoundaries.runtimeStateMutationDenied).toBe(true);
    expect(framework.runtimeEffects.productionBehaviorChanged).toBe(false);
  });

  test("Package 5A and 5B product facades still load", () => {
    const {
      getPipelineHealthAndDiagnosticsFramework,
    } = require("../server/lib/recruitment/pipelineHealth");
    const p5a = getPipelineHealthAndDiagnosticsFramework();
    expect(p5a.packageCode).toBe("5A");
    expect(p5a.advisoryOnly).toBe(true);

    const {
      getMonitoringReviewIntegrationFramework,
    } = require("../server/lib/recruitment/monitoringReviewIntegration");
    const p5b = getMonitoringReviewIntegrationFramework();
    expect(p5b.packageCode).toBe("5B");
    expect(p5b.advisoryOnly).toBe(true);
  });
});
