'use strict';

/**
 * Package 5A — Product-side unit tests (advisory pipeline health).
 */

const {
  HEALTH_STATUS,
  buildPipelineHealthObservationsFromProgram4,
  evaluateProductPipelineHealth,
  generateProductPipelineHealthReport,
  generateProductPipelineHealthDashboard,
  createPipelineHealthRegistry,
  buildPipelineDependencyGraph,
  validatePipelineDependencyGraph,
  transitionHealthStatus,
  getPipelineHealthAndDiagnosticsFramework,
} = require("../server/lib/recruitment/pipelineHealth");

describe("Package 5A pipeline health (product advisory)", () => {
  test("framework identity is Package 5A advisory-only", () => {
    const framework = getPipelineHealthAndDiagnosticsFramework();
    expect(framework.packageCode).toBe("5A");
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.program5AutomationAuthorized).toBe(false);
  });

  test("observations reuse shared preview integrity without duplicating logic", () => {
    const observations = buildPipelineHealthObservationsFromProgram4({
      lastEvaluatedAt: "2026-07-19T00:00:00.000Z",
      recruitmentOperations: { healthy: true },
      draftPreparation: { ready: true },
      sharedPreview: {
        recruitment: {
          id: 1,
          title: "SSC CGL",
          slug: "ssc-cgl",
          lifecycle_state: "notification",
        },
        drafts: [],
        review: null,
        pages: [],
        events: [],
      },
      editorialReview: { reviewComplete: true },
      seoValidation: { healthy: true, evaluated: true },
      publishReadiness: { ready: true, evaluated: true },
    });

    const preview = observations.find((o) => o.stageId === "SHARED_PREVIEW");
    expect(preview.evaluated).toBe(true);
    expect(preview.healthy).toBe(true);
    expect(preview.warnings).toEqual(expect.arrayContaining(["missing_draft"]));

    const evaluation = evaluateProductPipelineHealth({
      observations,
      lastEvaluatedAt: "2026-07-19T00:00:00.000Z",
    });
    expect(evaluation.advisoryOnly).toBe(true);
    expect(evaluation.report.stages.length).toBe(11);
  });

  test("SEO diagnostics input maps into SEO_VALIDATION observations", () => {
    const observations = buildPipelineHealthObservationsFromProgram4({
      seoDiagnosticsInput: {
        pages: [
          {
            title: "Job A",
            slug: "job-a",
            status: "draft",
            content: "<p>Hello</p>",
          },
        ],
        sitemapLocs: [],
        baseUrl: "https://www.example.com",
        now: "2026-07-19T00:00:00.000Z",
      },
    });

    const seo = observations.find((o) => o.stageId === "SEO_VALIDATION");
    expect(seo.evaluated).toBe(true);
    expect(Array.isArray(seo.validationFailures)).toBe(true);
  });

  test("health report and dashboard remain advisory", () => {
    const report = generateProductPipelineHealthReport({
      recruitmentOperations: { healthy: true },
      draftPreparation: { ready: true },
      editorialReview: { ok: true },
      seoValidation: { healthy: true, evaluated: true },
      publishReadiness: { ready: true },
      lastEvaluatedAt: "2026-07-19T00:00:00.000Z",
    });
    expect(report.advisoryOnly).toBe(true);
    expect(report.automation).toBe(false);

    const dashboard = generateProductPipelineHealthDashboard({
      recruitmentOperations: { healthy: true },
      lastEvaluatedAt: "2026-07-19T00:00:00.000Z",
    });
    expect(dashboard.readOnly).toBe(true);
    expect(dashboard.runtimeWired).toBe(false);
    expect(dashboard.featureActivated).toBe(false);
  });

  test("dependency graph and status transitions stay non-executing", () => {
    const registry = createPipelineHealthRegistry();
    const graph = buildPipelineDependencyGraph(registry);
    const validation = validatePipelineDependencyGraph(graph, registry);
    expect(validation.valid).toBe(true);
    expect(graph.executionEngine).toBe(false);

    const transition = transitionHealthStatus(HEALTH_STATUS.BLOCKED, {});
    expect(transition.next).toBe(HEALTH_STATUS.BLOCKED);
    expect(transition.automaticRecovery).toBe(false);
  });
});
