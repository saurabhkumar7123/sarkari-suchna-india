"use strict";

/**
 * PWP Phase 1 — Pipeline stage contracts.
 * Every stage receives the same input envelope and returns the same result shape.
 */

const STAGE_STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED"
});

function createStageInput({
  workflowId,
  recruitmentId = null,
  sourceProfile = null,
  currentPayload = null,
  previousStage = null,
  workflowContext = {}
} = {}) {
  return {
    workflowId: workflowId || null,
    recruitmentId: recruitmentId || null,
    sourceProfile: sourceProfile || null,
    currentPayload: currentPayload || null,
    previousStage: previousStage || null,
    workflowContext: workflowContext && typeof workflowContext === "object" ? workflowContext : {}
  };
}

function createStageResult({
  status = STAGE_STATUS.SUCCESS,
  payload = null,
  warnings = [],
  errors = [],
  executionSummary = {}
} = {}) {
  return {
    status,
    payload,
    warnings: Array.isArray(warnings) ? warnings.slice() : [],
    errors: Array.isArray(errors) ? errors.slice() : [],
    executionSummary:
      executionSummary && typeof executionSummary === "object" ? { ...executionSummary } : {}
  };
}

function isStageSuccess(result) {
  return result && result.status === STAGE_STATUS.SUCCESS;
}

module.exports = {
  STAGE_STATUS,
  createStageInput,
  createStageResult,
  isStageSuccess
};
