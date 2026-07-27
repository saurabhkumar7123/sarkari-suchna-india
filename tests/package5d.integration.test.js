'use strict';

/**
 * Package 5D — Integration regression: Programs 4–5C surfaces unchanged.
 *
 * Confirms Package 5D did not wire runtime routes or alter Program 4/5A/5B/5C
 * admin pages / APIs. Draft preparation remains advisory-only.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 5D does not change Program 4–5C production surfaces", () => {
  test("draft-preparation route is not activated", async () => {
    const response = await request(app).get("/admin/draft-preparation");
    expect([404, 302, 401]).toContain(response.status);
    expect(
      fs.existsSync(path.join(root, "private/admin-draft-preparation.html"))
    ).toBe(false);
  });

  test("prior Program 5 advisory routes remain unwired", async () => {
    const pipeline = await request(app).get("/admin/pipeline-health");
    expect([404, 302, 401]).toContain(pipeline.status);

    const monitoring = await request(app).get("/admin/monitoring-review-integration");
    expect([404, 302, 401]).toContain(monitoring.status);

    const lifecycle = await request(app).get("/admin/controlled-lifecycle");
    expect([404, 302, 401]).toContain(lifecycle.status);
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
    expect(nav).not.toContain("/admin/draft-preparation");
  });

  test("advisory draft preparation module exists without express wiring", () => {
    const indexSrc = read("server/lib/recruitment/draftPreparation/index.js");
    expect(indexSrc).toMatch(/Package 5D/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getDraftPreparationFramework,
    } = require("../server/lib/recruitment/draftPreparation");
    const framework = getDraftPreparationFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.draftPersistenceDenied).toBe(true);
    expect(framework.safetyBoundaries.automaticDraftCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.productionDraftInsertionDenied).toBe(true);
    expect(framework.runtimeEffects.productionBehaviorChanged).toBe(false);
  });

  test("Package 5A–5C product facades still load", () => {
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

    const {
      getControlledLifecycleEngineFramework,
    } = require("../server/lib/recruitment/controlledLifecycleEngine");
    const p5c = getControlledLifecycleEngineFramework();
    expect(p5c.packageCode).toBe("5C");
    expect(p5c.advisoryOnly).toBe(true);
  });
});
