"use strict";

/**
 * PWP Phase 5 — Production Readiness, Operational Verification & Observability.
 */

const {
  evaluateProductionReadiness,
  buildProductionReadinessManifest,
  READINESS_SERVICE_ID,
  READINESS_SERVICE_VERSION,
  READINESS_PHASE,
  READINESS_REPORT_FORMAT_ID,
  READINESS_LEVELS,
  HEALTH_LEVELS,
  READINESS_STAGE_HEALTH,
  EXPECTED_READINESS_STAGE_ORDER,
  PIPELINE_STAGE_ORDER,
  STAGE_IDS,
  STAGE_STATUS,
  ORCHESTRATOR_VERSION,
  RESOLUTION_ENGINE_ID,
  GENERATOR_INTEGRATION_ENGINE_ID,
  EDITORIAL_WORKFLOW_ENGINE_ID,
  runProductionWorkflow,
  prepareGeneratorDraft,
  prepareEditorialReview
} = require("../server/lib/productionWorkflow");

function findError(report, code) {
  return report.health.errors.some((entry) => {
    if (entry && entry.code === code) return true;
    return entry && entry.error && entry.error.code === code;
  });
}

describe("PWP Phase 5 — Production Readiness Service", () => {
  test("healthy pipeline is READY with complete health and diagnostics", () => {
    const report = evaluateProductionReadiness();

    expect(report.serviceId).toBe("PWP_PRODUCTION_READINESS_SERVICE");
    expect(report.serviceId).toBe(READINESS_SERVICE_ID);
    expect(READINESS_SERVICE_VERSION).toBe("1.0.0");
    expect(READINESS_PHASE).toBe("PHASE_5");
    expect(READINESS_REPORT_FORMAT_ID).toBe("pwp_production_readiness_report_v1");
    expect(report.readinessLevel).toBe(READINESS_LEVELS.READY);
    expect(report.overallHealth).toBe(HEALTH_LEVELS.HEALTHY);
    expect(report.ready).toBe(true);
    expect(report.validation.valid).toBe(true);
    expect(report.diagnostics).toHaveLength(EXPECTED_READINESS_STAGE_ORDER.length);
    expect(report.health.readyStages).toHaveLength(EXPECTED_READINESS_STAGE_ORDER.length);
    expect(report.health.blockedStages).toEqual([]);
  });

  test("missing stage produces NOT_READY and stage diagnostics", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        pipeline: {
          runners: { [STAGE_IDS.MULTI_SOURCE_CORRELATION_3D]: false }
        }
      }
    });
    const diagnostic = report.diagnostics.find(
      (entry) => entry.stageId === STAGE_IDS.MULTI_SOURCE_CORRELATION_3D
    );

    expect(report.readinessLevel).toBe(READINESS_LEVELS.NOT_READY);
    expect(report.overallHealth).toBe(HEALTH_LEVELS.UNHEALTHY);
    expect(diagnostic.status).toBe(READINESS_STAGE_HEALTH.MISSING);
    expect(findError(report, "MISSING_STAGE")).toBe(true);
  });

  test("broken stage contract produces NOT_READY", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        contracts: { stageResultValid: false }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.NOT_READY);
    expect(findError(report, "BROKEN_PIPELINE_CONTRACT")).toBe(true);
    expect(report.diagnostics.every((entry) => entry.outputValid === false)).toBe(true);
  });

  test("version mismatch is reported deterministically", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        components: {
          generator: { version: "2.0.0" }
        }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.NOT_READY);
    expect(findError(report, "VERSION_MISMATCH")).toBe(true);
  });

  test("manual publish gate verifies auto-publish disabled and explicit approval", () => {
    const report = evaluateProductionReadiness();

    expect(report.productionGates).toEqual({
      autoPublishEnabled: false,
      autoPublishBlocked: true,
      manualPublishOnly: true,
      manualApprovalRequired: true,
      noBypassPath: true
    });
    expect(
      report.validation.checks.find((entry) => entry.code === "MANUAL_PUBLISH_GATE_INTACT").valid
    ).toBe(true);
  });

  test("unsafe manual publish gate is BLOCKED", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        gates: { noBypassPath: false }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.BLOCKED);
    expect(report.overallHealth).toBe(HEALTH_LEVELS.BLOCKED);
    expect(findError(report, "MANUAL_PUBLISH_GATE_BROKEN")).toBe(true);
    expect(report.health.blockedStages).toContain(STAGE_IDS.MANUAL_PUBLISH_GATE);
  });

  test("generator boundary has no upstream, AI, or publish access", () => {
    const manifest = buildProductionReadinessManifest();
    const boundary = manifest.boundaries.generator;

    expect(boundary.mayAccessMonitoring).toBe(false);
    expect(boundary.mayAccessProgram1).toBe(false);
    expect(boundary.mayAccessProgram2).toBe(false);
    expect(boundary.mayAccessProgram3).toBe(false);
    expect(boundary.mayAccessResolutionEngine).toBe(false);
    expect(boundary.mayRenderFromSuppliedPackageOnly).toBe(true);
    expect(boundary.mayUseAi).toBe(false);
    expect(boundary.mayPublish).toBe(false);
  });

  test("broken generator boundary is BLOCKED", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        boundaries: { generator: { mayAccessProgram1: true } }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.BLOCKED);
    expect(findError(report, "GENERATOR_BOUNDARY_BROKEN")).toBe(true);
    expect(report.health.blockedStages).toContain(STAGE_IDS.GENERATOR_DRAFT);
  });

  test("editorial boundary requires package-only manual review", () => {
    const manifest = buildProductionReadinessManifest();
    const boundary = manifest.boundaries.editorial;

    expect(boundary.mayConsumeEditorialPackageOnly).toBe(true);
    expect(boundary.mayAccessGeneratorInternals).toBe(false);
    expect(boundary.mayAutoApprove).toBe(false);
    expect(boundary.mayUseAi).toBe(false);
    expect(boundary.mayRenderHtml).toBe(false);
    expect(boundary.mayPublish).toBe(false);
  });

  test("broken editorial boundary is BLOCKED", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        boundaries: { editorial: { mayAutoApprove: true } }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.BLOCKED);
    expect(findError(report, "EDITORIAL_BOUNDARY_BROKEN")).toBe(true);
    expect(report.health.blockedStages).toContain(STAGE_IDS.EDITORIAL_QUEUE);
  });

  test("Telegram boundary is available, explicit, and read-only", () => {
    const report = evaluateProductionReadiness();
    const check = report.validation.checks.find(
      (entry) => entry.code === "TELEGRAM_BOUNDARY_INTACT"
    );

    expect(check.valid).toBe(true);
    expect(report.effects.sendsTelegram).toBe(false);
    expect(report.effects.usesNetwork).toBe(false);
  });

  test("broken Telegram boundary is BLOCKED", () => {
    const report = evaluateProductionReadiness({
      manifestOverrides: {
        boundaries: { telegram: { automaticSending: true } }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.BLOCKED);
    expect(findError(report, "TELEGRAM_BOUNDARY_BROKEN")).toBe(true);
    expect(report.health.blockedStages).toContain(STAGE_IDS.TELEGRAM_NOTIFICATION);
  });

  test("READY_WITH_WARNINGS summarizes skipped stages without changing runtime", () => {
    const report = evaluateProductionReadiness({
      execution: {
        workflowId: "observed-workflow",
        finalState: "RECRUITMENT_RESOLVED",
        report: {
          workflowId: "observed-workflow",
          finalState: "RECRUITMENT_RESOLVED",
          durationMs: 12,
          executionTimeline: [],
          executedStages: [],
          skippedStages: [
            {
              stageId: STAGE_IDS.GENERATOR_DRAFT,
              reason: "resolution:IGNORE_DUPLICATE"
            }
          ],
          warnings: [],
          errors: []
        }
      }
    });

    expect(report.readinessLevel).toBe(READINESS_LEVELS.READY_WITH_WARNINGS);
    expect(report.overallHealth).toBe(HEALTH_LEVELS.DEGRADED);
    expect(report.observability.skippedStages).toEqual([
      {
        stageId: STAGE_IDS.GENERATOR_DRAFT,
        stageName: "Workflow Phase 3 — Generator Boundary",
        reason: "resolution:IGNORE_DUPLICATE"
      }
    ]);
  });

  test("execution observability reports timeline, duration, failure, and skips", () => {
    const execution = {
      workflowId: "wf-failed",
      finalState: "FAILED",
      stageResults: {
        [STAGE_IDS.CHANGE_DETECTION]: {
          status: STAGE_STATUS.FAILED,
          payload: null,
          warnings: [],
          errors: [{ code: "CHANGE_FAILED", message: "fixture" }],
          executionSummary: { stage: STAGE_IDS.CHANGE_DETECTION }
        }
      },
      report: {
        workflowId: "wf-failed",
        finalState: "FAILED",
        durationMs: 7,
        executionTimeline: [
          {
            at: "deterministic",
            fromState: "SOURCE_DETECTED",
            toState: "FAILED",
            stageId: STAGE_IDS.CHANGE_DETECTION,
            status: STAGE_STATUS.FAILED,
            message: "fixture",
            durationMs: 3
          }
        ],
        executedStages: [
          {
            stageId: STAGE_IDS.CHANGE_DETECTION,
            status: STAGE_STATUS.FAILED,
            durationMs: 3
          }
        ],
        skippedStages: [
          { stageId: STAGE_IDS.SOURCE_INTELLIGENCE_3A, reason: "upstream_failure" }
        ],
        warnings: [],
        errors: [
          {
            stageId: STAGE_IDS.CHANGE_DETECTION,
            error: { code: "CHANGE_FAILED", message: "fixture" }
          }
        ]
      }
    };
    const report = evaluateProductionReadiness({ execution });
    const failed = report.diagnostics.find(
      (entry) => entry.stageId === STAGE_IDS.CHANGE_DETECTION
    );

    expect(report.readinessLevel).toBe(READINESS_LEVELS.NOT_READY);
    expect(failed.status).toBe(READINESS_STAGE_HEALTH.FAILED);
    expect(failed.durationMs).toBe(3);
    expect(failed.inputValid).toBe(true);
    expect(failed.outputValid).toBe(true);
    expect(report.observability.workflowTimeline).toHaveLength(1);
    expect(report.observability.failureSummary.length).toBeGreaterThan(0);
    expect(report.observability.skippedStages).toHaveLength(1);
  });

  test("report is deeply immutable and deterministic", () => {
    const first = evaluateProductionReadiness();
    const second = evaluateProductionReadiness();

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.health)).toBe(true);
    expect(Object.isFrozen(first.diagnostics)).toBe(true);
    expect(Object.isFrozen(first.diagnostics[0])).toBe(true);
    expect(() => {
      first.readinessLevel = READINESS_LEVELS.BLOCKED;
    }).toThrow();
  });

  test("stage and state ordering remain compatible", () => {
    const report = evaluateProductionReadiness();

    expect(EXPECTED_READINESS_STAGE_ORDER).toEqual(PIPELINE_STAGE_ORDER);
    expect(
      report.validation.checks.find((entry) => entry.code === "STAGE_ORDER_VALID").valid
    ).toBe(true);
    expect(
      report.validation.checks.find((entry) => entry.code === "STATE_ORDER_VALID").valid
    ).toBe(true);
  });

  test("backward compatibility — Phases 1–4 public APIs remain available", () => {
    expect(ORCHESTRATOR_VERSION).toBe("2.0.0");
    expect(RESOLUTION_ENGINE_ID).toBe("PWP_RECRUITMENT_RESOLUTION_ENGINE");
    expect(GENERATOR_INTEGRATION_ENGINE_ID).toBe("PWP_GENERATOR_INTEGRATION_LAYER");
    expect(EDITORIAL_WORKFLOW_ENGINE_ID).toBe("PWP_EDITORIAL_WORKFLOW_LAYER");
    expect(typeof runProductionWorkflow).toBe("function");
    expect(typeof prepareGeneratorDraft).toBe("function");
    expect(typeof prepareEditorialReview).toBe("function");
  });
});
