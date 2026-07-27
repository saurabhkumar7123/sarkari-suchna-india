"use strict";

/**
 * Phase AI-5 — Aggregate operational / validation / performance reports.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const {
  FORMAT_ID,
  ENGINE_VERSION,
  PHASE,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGE_LABELS
} = require("./types");
const { buildPipelineHealth, evaluateOperationalReadiness } = require("./readiness");
const { aggregatePerformance } = require("./performance");
const { renderPipelineDiagrams } = require("./diagrams");

const KNOWN_LIMITATIONS = Object.freeze([
  "Validation uses text/HTML fixtures only — no live government website fetches.",
  "Binary PDF bytes are not stored; broken/missing PDF cases use synthetic pdfText.",
  "Telegram stage formats payloads only; delivery transports are never invoked.",
  "Editorial Queue builds packages for inspection; reviewAction transitions are not applied.",
  "Manual Publish Gate is evaluated with confirm=false; publishing engine is never called.",
  "Memory measurements reflect Node heap deltas and are approximate.",
  "Scholarship / Admission scenarios may classify with lower confidence than core recruitment types.",
  "AI-5 does not modify Production Workflow orchestration order or stage runners."
]);

const FUTURE_IMPROVEMENTS = Object.freeze([
  "Add golden-file regression snapshots per scenario for confidence drift detection.",
  "Wire optional dry-run hooks into Monitoring Bot without enabling LIVE_CRAWLER.",
  "Extend OCR-heavy fixtures with real scanned-PDF text samples under license.",
  "Surface AI-5 diagnostics in an operator dashboard (read-only).",
  "Tune ambiguous-match separation thresholds after a larger recruitment corpus.",
  "Add per-board precision/recall reports once a labeled evaluation set exists.",
  "Optional parallel stage timing for extraction vs classification when inputs allow."
]);

/**
 * Build the full Phase AI-5 operational report.
 * @param {{
 *   scenarioSuite: object,
 *   failureSuite: object,
 *   compatibility: object,
 *   now?: Date
 * }} input
 * @returns {object}
 */
function buildOperationalReport(input = {}) {
  const scenarioSuite = input.scenarioSuite || { runs: [], summary: null };
  const failureSuite = input.failureSuite || { runs: [], failureSignals: [] };
  const compatibility = input.compatibility || null;
  const allRuns = [...(scenarioSuite.runs || []), ...(failureSuite.runs || [])];

  const pipelineHealth = buildPipelineHealth(allRuns);
  const performance = aggregatePerformance(allRuns.map((r) => r.performance));
  const readiness = evaluateOperationalReadiness({
    scenarioSuite,
    failureSuite,
    compatibility,
    performance
  });

  const failureCategories = categorizeFailures(failureSuite.failureSignals || []);
  const recommendationQuality = buildRecommendationQuality(scenarioSuite.runs || []);
  const diagrams = renderPipelineDiagrams();

  return deepFreeze({
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    advisoryOnly: true,
    appliesChanges: false,
    generatedAt: (input.now instanceof Date
      ? input.now
      : new Date()
    ).toISOString(),

    pipelineHealth,
    successRate: (scenarioSuite.summary && scenarioSuite.summary.successRate) || 0,
    scenarioSummary: scenarioSuite.summary || null,
    failureSummary: failureSuite.summary || null,
    failureCategories,
    confidenceDistribution:
      (scenarioSuite.summary && scenarioSuite.summary.confidenceDistribution) ||
      null,
    recommendationQuality,
    editorialQualityDistribution:
      (scenarioSuite.summary &&
        scenarioSuite.summary.editorialQualityDistribution) ||
      null,
    performanceSummary: performance,
    operationalReadiness: readiness,
    backwardCompatibility: compatibility,
    knownLimitations: KNOWN_LIMITATIONS.slice(),
    recommendedFutureImprovements: FUTURE_IMPROVEMENTS.slice(),
    diagrams,
    productionReadinessAssessment: {
      verdict: readiness.verdict,
      health: readiness.health,
      overallScore: readiness.overallScore,
      caveats: readiness.caveats,
      autoPublishEnabled: false,
      schedulerActivated: false,
      pagesPublished: 0,
      databaseSchemaChanged: false,
      generatorUiChanged: false,
      productionWorkflowChanged: false
    },
    stageCatalog: PIPELINE_STAGE_ORDER.map((id) => ({
      stageId: id,
      label: PIPELINE_STAGE_LABELS[id]
    }))
  });
}

/**
 * Compact representative scenario outputs for deliverables.
 * @param {object[]} runs
 * @returns {object[]}
 */
function buildScenarioOutputDigest(runs = []) {
  return runs.map((run) =>
    deepFreeze({
      id: run.scenario && run.scenario.id,
      kind: run.scenario && run.scenario.kind,
      label: run.scenario && run.scenario.label,
      pipelineOk: run.pipelineOk,
      stageCounts: run.stageCounts,
      observed: run.observed,
      performance: {
        totalPipelineLatencyMs:
          run.performance && run.performance.totalPipelineLatencyMs,
        extractionTimeMs: run.performance && run.performance.extractionTimeMs,
        classificationTimeMs:
          run.performance && run.performance.classificationTimeMs,
        matchingTimeMs: run.performance && run.performance.matchingTimeMs,
        editorialAnalysisTimeMs:
          run.performance && run.performance.editorialAnalysisTimeMs
      },
      stageResults: (run.stages || []).map((s) => ({
        stageId: s.stageId,
        result: s.executionResult,
        durationMs: s.durationMs,
        warningCodes: (s.warnings || []).map((w) => w.code),
        confidence: s.confidence
      })),
      telegramPreview: run.artifacts && run.artifacts.telegramText,
      publishGate: run.artifacts && run.artifacts.manualPublishGate
    })
  );
}

function categorizeFailures(signals = []) {
  const categories = Object.create(null);
  for (const signal of signals) {
    const kind = signal.kind || "unknown";
    if (!categories[kind]) {
      categories[kind] = {
        kind,
        count: 0,
        typicalWarningCodes: [],
        localizedStages: []
      };
    }
    categories[kind].count += 1;
    for (const code of signal.warningCodes || []) {
      if (!categories[kind].typicalWarningCodes.includes(code)) {
        categories[kind].typicalWarningCodes.push(code);
      }
    }
    for (const stageId of signal.warnStages || []) {
      if (!categories[kind].localizedStages.includes(stageId)) {
        categories[kind].localizedStages.push(stageId);
      }
    }
  }
  return Object.values(categories);
}

function buildRecommendationQuality(runs = []) {
  const dist = Object.create(null);
  let withMatch = 0;
  let humanReview = 0;
  for (const run of runs) {
    const action =
      (run.observed && run.observed.recommendationAction) || "none";
    dist[action] = (dist[action] || 0) + 1;
    if (action && action !== "none" && action !== "ignore") withMatch += 1;
    if (/human_review|possible_duplicate/i.test(String(action))) humanReview += 1;
  }
  return deepFreeze({
    distribution: dist,
    actionableRate: runs.length ? Number((withMatch / runs.length).toFixed(4)) : 0,
    humanReviewRate: runs.length
      ? Number((humanReview / runs.length).toFixed(4))
      : 0
  });
}

module.exports = {
  KNOWN_LIMITATIONS,
  FUTURE_IMPROVEMENTS,
  buildOperationalReport,
  buildScenarioOutputDigest,
  categorizeFailures,
  buildRecommendationQuality
};
