"use strict";

/**
 * Phase AI-5 — Scenario suite and failure simulation orchestration.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const { FORMAT_ID, ENGINE_VERSION, PHASE, STAGE_RESULT } = require("./types");
const { validatePipeline } = require("./pipelineRunner");
const { aggregatePerformance } = require("./performance");

/**
 * Run every representative scenario.
 * @param {object[]} scenarios
 * @param {{ now?: Date }} [options]
 * @returns {object}
 */
function runScenarioSuite(scenarios = [], options = {}) {
  const startedAt = Date.now();
  const runs = [];

  for (const scenario of scenarios) {
    const result = validatePipeline(scenario, { now: options.now });
    runs.push(result);
  }

  return deepFreeze({
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    suiteType: "representative_scenarios",
    advisoryOnly: true,
    count: runs.length,
    runs,
    summary: summarizeRuns(runs),
    performance: aggregatePerformance(runs.map((r) => r.performance)),
    durationMs: Date.now() - startedAt,
    generatedAt: (options.now instanceof Date
      ? options.now
      : new Date()
    ).toISOString()
  });
}

/**
 * Run failure simulations. Duplicate notice reuses prior fingerprint.
 * @param {object[]} failures
 * @param {{ now?: Date }} [options]
 * @returns {object}
 */
function runFailureSuite(failures = [], options = {}) {
  const startedAt = Date.now();
  const runs = [];

  for (const failure of failures) {
    const opts = { now: options.now };
    if (failure.duplicateOf || failure.kind === "duplicate_notice") {
      // First pass establishes fingerprint; second pass should warn duplicate.
      const first = validatePipeline(
        { ...failure, event: failure.duplicateOf || failure.event },
        { now: options.now }
      );
      opts.priorFingerprint = first.observed && first.observed.fingerprint;
    }
    const result = validatePipeline(failure, opts);
    runs.push(result);
  }

  return deepFreeze({
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    suiteType: "failure_simulations",
    advisoryOnly: true,
    count: runs.length,
    runs,
    summary: summarizeRuns(runs),
    failureSignals: runs.map((r) => ({
      id: r.scenario && r.scenario.id,
      kind: r.scenario && r.scenario.kind,
      pipelineOk: r.pipelineOk,
      warnStages: r.stages
        .filter((s) => s.executionResult === STAGE_RESULT.WARN || s.executionResult === STAGE_RESULT.FAIL)
        .map((s) => s.stageId),
      warningCodes: collectWarningCodes(r)
    })),
    performance: aggregatePerformance(runs.map((r) => r.performance)),
    durationMs: Date.now() - startedAt,
    generatedAt: (options.now instanceof Date
      ? options.now
      : new Date()
    ).toISOString()
  });
}

/**
 * @param {object[]} runs
 * @returns {object}
 */
function summarizeRuns(runs = []) {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let error = 0;
  const confidence = { high: 0, medium: 0, low: 0, unknown: 0 };
  const eventTypes = Object.create(null);
  const recommendationActions = Object.create(null);
  const editorialBands = { high: 0, medium: 0, low: 0, unknown: 0 };

  for (const run of runs) {
    if (!run) continue;
    if (run.pipelineOk && run.stageCounts.warn === 0) pass += 1;
    else if (run.pipelineOk) warn += 1;
    else if (run.stageCounts.error > 0) error += 1;
    else fail += 1;

    const noticeStage = (run.stages || []).find(
      (s) => s.stageId === "notice_intelligence"
    );
    const levelRaw =
      (noticeStage && noticeStage.confidence && noticeStage.confidence.level) ||
      "unknown";
    const level = String(levelRaw).toLowerCase().replace(/^very_/, "") || "unknown";
    if (confidence[level] != null) confidence[level] += 1;
    else confidence.unknown += 1;

    const et = (run.observed && run.observed.eventType) || "unknown";
    eventTypes[et] = (eventTypes[et] || 0) + 1;

    const action = (run.observed && run.observed.recommendationAction) || "none";
    recommendationActions[action] = (recommendationActions[action] || 0) + 1;

    const overall = run.observed && run.observed.editorialOverall;
    if (typeof overall !== "number") editorialBands.unknown += 1;
    else if (overall >= 75) editorialBands.high += 1;
    else if (overall >= 50) editorialBands.medium += 1;
    else editorialBands.low += 1;
  }

  const total = runs.length || 1;
  return deepFreeze({
    total: runs.length,
    pass,
    warn,
    fail,
    error,
    successRate: Number(((pass + warn) / total).toFixed(4)),
    strictPassRate: Number((pass / total).toFixed(4)),
    confidenceDistribution: confidence,
    eventTypeDistribution: eventTypes,
    recommendationDistribution: recommendationActions,
    editorialQualityDistribution: editorialBands
  });
}

/**
 * @param {object} run
 * @returns {string[]}
 */
function collectWarningCodes(run) {
  const codes = [];
  for (const stage of run.stages || []) {
    for (const w of stage.warnings || []) {
      if (w && w.code) codes.push(w.code);
    }
    for (const issue of stage.validationIssues || []) {
      if (issue && issue.code) codes.push(issue.code);
    }
  }
  return [...new Set(codes)];
}

module.exports = {
  runScenarioSuite,
  runFailureSuite,
  summarizeRuns,
  collectWarningCodes
};
