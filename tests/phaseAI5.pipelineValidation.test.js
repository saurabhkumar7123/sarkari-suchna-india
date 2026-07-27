"use strict";

/**
 * Phase AI-5 — End-to-End Production Validation & Operational Readiness tests.
 *
 * Validates the full automation pipeline across representative scenarios and
 * failure simulations, generates diagnostics / performance / readiness reports,
 * and proves Production Workflow / Generator / AUTO_PUBLISH remain unchanged.
 */

const {
  SCENARIOS,
  FAILURES,
  listScenarios,
  listFailures,
  SCENARIO_KINDS,
  FAILURE_KINDS
} = require("./fixtures/ai5/scenarios");

const {
  PHASE,
  FORMAT_ID,
  ENGINE_VERSION,
  PIPELINE_STAGES,
  PIPELINE_STAGE_ORDER,
  STAGE_RESULT,
  validatePipeline,
  validateStage,
  runScenarioSuite,
  runFailureSuite,
  runFullValidation,
  checkBackwardCompatibility,
  evaluateOperationalReadiness,
  buildOperationalReport,
  buildScenarioOutputDigest,
  buildPipelineHealth,
  renderPipelineDiagrams,
  KNOWN_LIMITATIONS,
  FUTURE_IMPROVEMENTS
} = require("../server/lib/pipelineValidation");

const { runGeneratorIntelligencePipeline } = require("../server/lib/generatorIntelligence");
const {
  runProductionWorkflow,
  WORKFLOW_STATES,
  STAGE_STATUS,
  PUBLISHING_POLICY
} = require("../server/lib/productionWorkflow");
const telegramNotification = require("../server/lib/monitoringBot/telegramNotification");
const { getAutomationFlags } = require("../server/config/automationFlags");
const { NOTICES: AI2_NOTICES } = require("./fixtures/ai2/governmentNotices");
const { SAMPLES: AI1_SAMPLES } = require("./fixtures/ai1/notificationSamples");
const { enrichWithEditorialIntelligence } = require("../server/lib/editorialIntelligence");

const NOW = new Date("2026-07-26T00:00:00Z");

describe("Phase AI-5 taxonomy", () => {
  test("exposes nine ordered pipeline stages", () => {
    expect(PIPELINE_STAGE_ORDER).toHaveLength(9);
    expect(PIPELINE_STAGE_ORDER[0]).toBe(PIPELINE_STAGES.MONITORING_INPUT);
    expect(PIPELINE_STAGE_ORDER[PIPELINE_STAGE_ORDER.length - 1]).toBe(
      PIPELINE_STAGES.MANUAL_PUBLISH_GATE
    );
    expect(PHASE).toBe("AI-5");
    expect(FORMAT_ID).toBe("pipeline_validation_report_v1");
    expect(ENGINE_VERSION).toMatch(/^ai5\./);
  });

  test("covers all required scenario and failure kinds", () => {
    expect(Object.keys(SCENARIO_KINDS)).toHaveLength(15);
    expect(listScenarios()).toHaveLength(15);
    expect(Object.keys(FAILURE_KINDS)).toHaveLength(11);
    expect(listFailures()).toHaveLength(11);
  });
});

describe("Phase AI-5 single pipeline run", () => {
  test("runs all stages for new recruitment without publishing", () => {
    const result = validatePipeline(SCENARIOS[SCENARIO_KINDS.NEW_RECRUITMENT], {
      now: NOW
    });
    expect(result.advisoryOnly).toBe(true);
    expect(result.appliesChanges).toBe(false);
    expect(result.published).toBe(false);
    expect(result.autoPublishEnabled).toBe(false);
    expect(result.schedulerActivated).toBe(false);
    expect(result.stages).toHaveLength(9);
    expect(result.pipelineOk).toBe(true);
    expect(result.observed.eventType).toBe("new_recruitment");
    expect(result.artifacts.manualPublishGate.published).toBe(false);
    expect(result.performance.totalPipelineLatencyMs).toBeGreaterThanOrEqual(0);
  });

  test("stage diagnostics include required fields", () => {
    const result = validatePipeline(SCENARIOS[SCENARIO_KINDS.ADMIT_CARD], {
      now: NOW
    });
    for (const stage of result.stages) {
      expect(stage).toEqual(
        expect.objectContaining({
          stageId: expect.any(String),
          stageLabel: expect.any(String),
          executionResult: expect.any(String),
          warnings: expect.any(Array),
          validationIssues: expect.any(Array),
          confidence: expect.any(Object),
          durationMs: expect.any(Number)
        })
      );
      expect([
        STAGE_RESULT.PASS,
        STAGE_RESULT.WARN,
        STAGE_RESULT.FAIL,
        STAGE_RESULT.ERROR,
        STAGE_RESULT.SKIP
      ]).toContain(stage.executionResult);
    }
  });

  test("validateStage returns a single-stage diagnostic", () => {
    const stage = validateStage(
      PIPELINE_STAGES.NOTICE_INTELLIGENCE,
      SCENARIOS[SCENARIO_KINDS.RESULT],
      { now: NOW }
    );
    expect(stage.stageId).toBe(PIPELINE_STAGES.NOTICE_INTELLIGENCE);
    expect(stage.diagnostic.stageId).toBe(PIPELINE_STAGES.NOTICE_INTELLIGENCE);
  });
});

describe("Phase AI-5 representative scenario suite", () => {
  let suite;

  beforeAll(() => {
    suite = runScenarioSuite(listScenarios(), { now: NOW });
  });

  test("executes all 15 scenarios", () => {
    expect(suite.count).toBe(15);
    expect(suite.summary.total).toBe(15);
    expect(suite.summary.successRate).toBeGreaterThan(0.7);
  });

  test.each(Object.values(SCENARIO_KINDS))(
    "scenario kind %s completes without stage errors",
    (kind) => {
      const run = suite.runs.find((r) => r.scenario.kind === kind);
      expect(run).toBeTruthy();
      expect(run.stageCounts.error).toBe(0);
      expect(run.artifacts.manualPublishGate.published).toBe(false);
    }
  );

  test("records performance measurements", () => {
    expect(suite.performance.sampleCount).toBe(15);
    expect(suite.performance.averages.totalPipelineLatencyMs).toBeGreaterThanOrEqual(0);
    expect(suite.performance.averages.classificationTimeMs).toBeGreaterThanOrEqual(0);
    expect(suite.performance.averages.matchingTimeMs).toBeGreaterThanOrEqual(0);
    expect(suite.performance.averages.editorialAnalysisTimeMs).toBeGreaterThanOrEqual(0);
    expect(suite.performance.averages.extractionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe("Phase AI-5 failure simulations", () => {
  let failureSuite;

  beforeAll(() => {
    failureSuite = runFailureSuite(listFailures(), { now: NOW });
  });

  test("exercises all 11 failure categories", () => {
    expect(failureSuite.count).toBe(11);
    expect(failureSuite.failureSignals).toHaveLength(11);
  });

  test("missing / broken / OCR PDF cases surface extraction warnings", () => {
    for (const kind of [
      FAILURE_KINDS.MISSING_PDF,
      FAILURE_KINDS.BROKEN_PDF,
      FAILURE_KINDS.OCR_HEAVY_PDF
    ]) {
      const signal = failureSuite.failureSignals.find((f) => f.kind === kind);
      expect(signal).toBeTruthy();
      expect(signal.warningCodes.length + signal.warnStages.length).toBeGreaterThan(0);
    }
  });

  test("duplicate notice surfaces fingerprint warning", () => {
    const signal = failureSuite.failureSignals.find(
      (f) => f.kind === FAILURE_KINDS.DUPLICATE_NOTICE
    );
    expect(signal.warningCodes).toContain("DUPLICATE_FINGERPRINT");
  });

  test("ambiguous match surfaces match ambiguity or review signal", () => {
    const signal = failureSuite.failureSignals.find(
      (f) => f.kind === FAILURE_KINDS.AMBIGUOUS_RECRUITMENT_MATCH
    );
    expect(
      signal.warningCodes.some((c) =>
        /AMBIGUOUS|MANUAL_REVIEW|LOW_|UNKNOWN_/i.test(c)
      ) || signal.warnStages.includes(PIPELINE_STAGES.RECRUITMENT_MATCHING)
    ).toBe(true);
  });

  test("failure isolation keeps issues localized", () => {
    for (const signal of failureSuite.failureSignals) {
      expect(signal.warnStages.length).toBeLessThan(9);
    }
  });
});

describe("Phase AI-5 operational readiness & reports", () => {
  let full;

  beforeAll(() => {
    full = runFullValidation({
      scenarios: listScenarios(),
      failures: listFailures(),
      now: NOW
    });
  });

  test("backward compatibility checks all pass", () => {
    expect(full.compatibility.allPassed).toBe(true);
    expect(full.compatibility.flags.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(full.compatibility.flags.SCHEDULER_ACTIVATION_ENABLED).toBe(false);
  });

  test("operational report includes required sections", () => {
    const report = full.operationalReport;
    expect(report.phase).toBe("AI-5");
    expect(report.pipelineHealth.stages.length).toBeGreaterThanOrEqual(9);
    expect(report.successRate).toBeGreaterThan(0);
    expect(report.failureCategories.length).toBeGreaterThanOrEqual(11);
    expect(report.confidenceDistribution).toBeTruthy();
    expect(report.recommendationQuality).toBeTruthy();
    expect(report.editorialQualityDistribution).toBeTruthy();
    expect(report.performanceSummary.sampleCount).toBeGreaterThan(0);
    expect(report.operationalReadiness.verdict).toBeTruthy();
    expect(report.knownLimitations.length).toBe(KNOWN_LIMITATIONS.length);
    expect(report.recommendedFutureImprovements.length).toBe(
      FUTURE_IMPROVEMENTS.length
    );
    expect(report.productionReadinessAssessment.pagesPublished).toBe(0);
    expect(report.productionReadinessAssessment.autoPublishEnabled).toBe(false);
    expect(report.productionReadinessAssessment.productionWorkflowChanged).toBe(
      false
    );
  });

  test("scenario output digest is produced", () => {
    expect(full.scenarioOutputs).toHaveLength(15);
    expect(full.scenarioOutputs[0].stageResults).toHaveLength(9);
  });

  test("pipeline diagrams are available", () => {
    const diagrams = renderPipelineDiagrams();
    expect(diagrams.ascii).toContain("Monitoring Input");
    expect(diagrams.ascii).toContain("Manual Publish Gate");
    expect(diagrams.mermaidFlow).toContain("flowchart TD");
    expect(diagrams.stageTable).toHaveLength(9);
  });

  test("readiness evaluation is advisory and non-publishing", () => {
    const readiness = evaluateOperationalReadiness({
      scenarioSuite: full.scenarioSuite,
      failureSuite: full.failureSuite,
      compatibility: full.compatibility
    });
    expect(readiness.advisoryOnly).toBe(true);
    expect(readiness.publishingDenied).toBe(true);
    expect(readiness.productionBehaviorUnchanged).toBe(true);
  });
});

describe("Phase AI-5 Production Workflow compatibility", () => {
  test("Production Workflow behaves identically with and without AI-5 validation artifacts", async () => {
    const buildEvent = (extra) => ({
      sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx",
      title: "UPPSC Combined State Upper Subordinate Services Examination 2026",
      contentType: "text/html",
      html: AI2_NOTICES.UPPSC_NEW_RECRUITMENT.html,
      forceChangeDetected: true,
      allowTelegramDelivery: true,
      telegramTransport: telegramNotification.createMemoryTransport(),
      ...extra
    });

    const baseline = await runProductionWorkflow({
      monitoringEvent: buildEvent(),
      workflowId: "ai5_compat_baseline"
    });

    // Attach additive editorial intelligence the same way prior phases do —
    // AI-5 itself never mutates the workflow path.
    const enrichedEvent = enrichWithEditorialIntelligence(buildEvent(), {
      now: NOW,
      profile: "new_recruitment",
      title: "UPPSC Combined State Upper Subordinate Services Examination 2026"
    });
    // Run AI-5 validation separately (advisory) — must not affect workflow.
    const validation = validatePipeline(SCENARIOS[SCENARIO_KINDS.NEW_RECRUITMENT], {
      now: NOW
    });
    expect(validation.published).toBe(false);

    const enriched = await runProductionWorkflow({
      monitoringEvent: enrichedEvent,
      workflowId: "ai5_compat_enriched"
    });

    expect(enriched.status).toBe(baseline.status);
    expect(enriched.finalState).toBe(baseline.finalState);
    expect(enriched.published).toBe(baseline.published);
    expect(enriched.autoPublishBlocked).toBe(baseline.autoPublishBlocked);
    const stageStatuses = (result) =>
      Object.entries(result.stageResults).map(([stageId, stage]) => [
        stageId,
        stage.status
      ]);
    expect(stageStatuses(enriched)).toEqual(stageStatuses(baseline));
    expect(baseline.status).toBe(STAGE_STATUS.SUCCESS);
    expect(baseline.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
    expect(baseline.published).toBe(false);
  });

  test("AUTO_PUBLISH remains disabled", () => {
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(checkBackwardCompatibility().allPassed).toBe(true);
  });

  test("Generator pipeline output shape is unchanged by AI-5 require", () => {
    const before = runGeneratorIntelligencePipeline(AI1_SAMPLES.SSC);
    validatePipeline(SCENARIOS[SCENARIO_KINDS.NEW_RECRUITMENT], { now: NOW });
    const after = runGeneratorIntelligencePipeline(AI1_SAMPLES.SSC);
    expect(after.result).toBe(before.result);
    expect(after.meta.formatId).toBe(before.meta.formatId);
  });

  test("buildOperationalReport and health helpers are pure", () => {
    const suite = runScenarioSuite(
      [SCENARIOS[SCENARIO_KINDS.EXTENSION], SCENARIOS[SCENARIO_KINDS.CORRIGENDUM]],
      { now: NOW }
    );
    const health = buildPipelineHealth(suite.runs);
    expect(health.stages.length).toBeGreaterThanOrEqual(9);
    const digest = buildScenarioOutputDigest(suite.runs);
    expect(digest).toHaveLength(2);
    const report = buildOperationalReport({
      scenarioSuite: suite,
      failureSuite: { runs: [], failureSignals: [], summary: null },
      compatibility: checkBackwardCompatibility(),
      now: NOW
    });
    expect(report.advisoryOnly).toBe(true);
  });
});
