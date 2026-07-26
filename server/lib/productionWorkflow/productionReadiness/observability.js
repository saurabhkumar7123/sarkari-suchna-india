"use strict";

/**
 * PWP Phase 5 — Read-only workflow diagnostics and execution summary.
 */

const { STAGE_HEALTH } = require("./readinessTypes");
const { STAGE_NAMES } = require("./readinessManifest");

const VALIDATION_AREA_STAGE = Object.freeze({
  generator: "GENERATOR_DRAFT",
  editorial: "EDITORIAL_QUEUE",
  telegram: "TELEGRAM_NOTIFICATION",
  publishing: "MANUAL_PUBLISH_GATE"
});

function normalizeEntries(entries) {
  return Array.isArray(entries) ? entries.slice() : [];
}

function isValidObservedResult(result) {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    typeof result.status === "string" &&
    Array.isArray(result.warnings) &&
    Array.isArray(result.errors) &&
    Boolean(result.executionSummary) &&
    typeof result.executionSummary === "object"
  );
}

function buildWorkflowDiagnostics({ manifest, validation, execution = null }) {
  const pipeline = manifest.pipeline || {};
  const order = pipeline.expectedStageOrder || [];
  const report = execution && execution.report ? execution.report : execution || null;
  const observedResults =
    execution && execution.stageResults && typeof execution.stageResults === "object"
      ? execution.stageResults
      : {};
  const executed = new Map(
    normalizeEntries(report && report.executedStages).map((entry) => [entry.stageId, entry])
  );
  const skipped = new Map(
    normalizeEntries(report && report.skippedStages).map((entry) => [entry.stageId, entry])
  );
  const reportWarnings = normalizeEntries(report && report.warnings);
  const reportErrors = normalizeEntries(report && report.errors);

  return order.map((stageId) => {
    const runnerAvailable = Boolean(pipeline.runners && pipeline.runners[stageId]);
    const observed = observedResults[stageId] || null;
    const executionRecord = executed.get(stageId) || null;
    const skippedRecord = skipped.get(stageId) || null;
    const stageValidationErrors = validation.errors.filter(
      (entry) =>
        entry.area === stageId ||
        VALIDATION_AREA_STAGE[entry.area] === stageId
    );
    const stageValidationWarnings = validation.warnings.filter((entry) => entry.area === stageId);
    const warnings = [
      ...stageValidationWarnings,
      ...reportWarnings
        .filter((entry) => entry.stageId === stageId)
        .map((entry) => entry.warning),
      ...normalizeEntries(observed && observed.warnings)
    ];
    const errors = [
      ...stageValidationErrors,
      ...reportErrors
        .filter((entry) => entry.stageId === stageId)
        .map((entry) => entry.error),
      ...normalizeEntries(observed && observed.errors)
    ];

    let status = STAGE_HEALTH.READY;
    if (!runnerAvailable) status = STAGE_HEALTH.MISSING;
    else if (skippedRecord) status = STAGE_HEALTH.SKIPPED;
    else if (stageValidationErrors.some((entry) => entry.severity === "BLOCKING")) {
      status = STAGE_HEALTH.BLOCKED;
    }
    else if (
      (observed && observed.status === "FAILED") ||
      (executionRecord && executionRecord.status === "FAILED")
    ) {
      status = STAGE_HEALTH.FAILED;
    }
    else if (errors.length > 0) status = STAGE_HEALTH.FAILED;
    else if (warnings.length > 0) status = STAGE_HEALTH.WARNING;

    return {
      stageId,
      stageName: STAGE_NAMES[stageId] || stageId,
      status,
      durationMs:
        executionRecord && executionRecord.durationMs != null
          ? executionRecord.durationMs
          : null,
      inputValid: manifest.contracts && manifest.contracts.stageInputValid === true,
      outputValid: observed
        ? isValidObservedResult(observed)
        : runnerAvailable && manifest.contracts && manifest.contracts.stageResultValid === true,
      warnings,
      errors,
      skippedReason: skippedRecord ? skippedRecord.reason || null : null
    };
  });
}

function buildObservabilitySummary({ diagnostics, validation, execution = null }) {
  const report = execution && execution.report ? execution.report : execution || {};
  const timeline = normalizeEntries(report && report.executionTimeline).map((entry) => ({
    at: entry.at || null,
    fromState: entry.fromState || null,
    toState: entry.toState || null,
    stageId: entry.stageId || null,
    status: entry.status || null,
    message: entry.message || null,
    durationMs: entry.durationMs != null ? entry.durationMs : null
  }));
  const skippedStages = diagnostics
    .filter((entry) => entry.status === STAGE_HEALTH.SKIPPED)
    .map((entry) => ({
      stageId: entry.stageId,
      stageName: entry.stageName,
      reason: entry.skippedReason
    }));
  const executionErrors = normalizeEntries(report && report.errors);

  return {
    workflowId:
      (execution && execution.workflowId) ||
      (report && report.workflowId) ||
      null,
    finalState:
      (execution && execution.finalState) ||
      (report && report.finalState) ||
      null,
    durationMs: report && report.durationMs != null ? report.durationMs : null,
    workflowTimeline: timeline,
    stageSummary: diagnostics.map((entry) => ({
      stageId: entry.stageId,
      stageName: entry.stageName,
      status: entry.status,
      durationMs: entry.durationMs
    })),
    failureSummary: [...validation.errors, ...executionErrors],
    skippedStages
  };
}

module.exports = {
  isValidObservedResult,
  buildWorkflowDiagnostics,
  buildObservabilitySummary
};
