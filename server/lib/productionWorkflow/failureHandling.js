"use strict";

/**
 * PWP Phase 1 — Failure report + advisory retry metadata.
 * Automatic retries are intentionally NOT performed.
 */

function buildFailureReport({
  workflowId,
  failedStage,
  previousState,
  errors = [],
  warnings = [],
  payload = null,
  blockingReason = null
} = {}) {
  return {
    workflowId: workflowId || null,
    failedStage: failedStage || null,
    previousState: previousState || null,
    blockingReason:
      blockingReason || (errors[0] && (errors[0].message || errors[0])) || "stage_failed",
    errors: Array.isArray(errors) ? errors.slice() : [],
    warnings: Array.isArray(warnings) ? warnings.slice() : [],
    payload,
    published: false,
    autoPublishBlocked: true
  };
}

function buildRetryAdvisory({
  retryPossible = false,
  recommendedStage = null,
  blockingReason = null
} = {}) {
  return {
    retryPossible: Boolean(retryPossible),
    recommendedStage: recommendedStage || null,
    blockingReason: blockingReason || null,
    automaticRetry: false
  };
}

function advisoryFromStageFailure(stageId, errors = []) {
  const blockingReason =
    (errors[0] && (errors[0].message || String(errors[0]))) || `${stageId}_failed`;
  return buildRetryAdvisory({
    retryPossible: true,
    recommendedStage: stageId,
    blockingReason
  });
}

module.exports = {
  buildFailureReport,
  buildRetryAdvisory,
  advisoryFromStageFailure
};
