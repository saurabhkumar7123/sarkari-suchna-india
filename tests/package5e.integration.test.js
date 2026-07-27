'use strict';

/**
 * Package 5E — Integration regression: Programs 4–5D surfaces unchanged.
 *
 * Confirms Package 5E did not wire runtime routes or alter Program 4/5A–5D
 * admin pages / APIs. Candidate resolution remains advisory-only.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../server/app");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Package 5E does not change Program 4–5D production surfaces", () => {
  test("candidate-resolution route is not activated", async () => {
    const response = await request(app).get("/admin/candidate-resolution");
    expect([404, 302, 401]).toContain(response.status);
    expect(
      fs.existsSync(path.join(root, "private/admin-candidate-resolution.html"))
    ).toBe(false);

    const alt = await request(app).get("/admin/controlled-candidate-resolution");
    expect([404, 302, 401]).toContain(alt.status);
  });

  test("prior Program 5 advisory routes remain unwired", async () => {
    const pipeline = await request(app).get("/admin/pipeline-health");
    expect([404, 302, 401]).toContain(pipeline.status);

    const monitoring = await request(app).get("/admin/monitoring-review-integration");
    expect([404, 302, 401]).toContain(monitoring.status);

    const lifecycle = await request(app).get("/admin/controlled-lifecycle");
    expect([404, 302, 401]).toContain(lifecycle.status);

    const draft = await request(app).get("/admin/draft-preparation");
    expect([404, 302, 401]).toContain(draft.status);
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
    expect(nav).not.toContain("/admin/candidate-resolution");
    expect(nav).not.toContain("/admin/controlled-candidate-resolution");
  });

  test("advisory candidate resolution module exists without express wiring", () => {
    const indexSrc = read(
      "server/lib/recruitment/controlledCandidateResolution/index.js"
    );
    expect(indexSrc).toMatch(/Package 5E/);
    expect(indexSrc).not.toMatch(/\bexpress\b/);
    expect(indexSrc).not.toMatch(/router\./);

    const {
      getControlledCandidateResolutionFramework,
    } = require("../server/lib/recruitment/controlledCandidateResolution");
    const framework = getControlledCandidateResolutionFramework();
    expect(framework.safetyBoundaries.routeCreationDenied).toBe(true);
    expect(framework.safetyBoundaries.automaticMergeDenied).toBe(true);
    expect(framework.safetyBoundaries.automaticCandidateResolutionDenied).toBe(
      true
    );
    expect(framework.safetyBoundaries.databaseChangesDenied).toBe(true);
    expect(framework.runtimeEffects.productionBehaviorChanged).toBe(false);
  });

  test("Package 5A–5D product facades still load", () => {
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

    const {
      getDraftPreparationFramework,
    } = require("../server/lib/recruitment/draftPreparation");
    const p5d = getDraftPreparationFramework();
    expect(p5d.packageCode).toBe("5D");
    expect(p5d.advisoryOnly).toBe(true);
  });
});
