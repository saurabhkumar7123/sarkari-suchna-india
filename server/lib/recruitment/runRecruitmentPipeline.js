"use strict";

/**
 * Phase 24 — safe runtime hook for recruitment detection orchestration.
 * Phase 31.B — optional updateId for traceability only (no persistence).
 * Phase 69 — attaches recruitment compatibility context additively (WeakMap only).
 * Phase 92 — advisory workflow integration hook (WeakMap only, feature-flagged).
 * Phase 109 — advisory observation contract integration hook (WeakMap only, feature-flagged).
 * Never throws to caller. Never persists review items.
 */

const { processRecruitmentDetection } = require("./detectionProcessor");
const { attachRecruitmentCompatibility } = require("./recruitmentCompatibilityLayer");
const {
  attachRecruitmentWorkflowIntegration
} = require("./recruitmentPipelineIntegrationHook");
const {
  attachRecruitmentWorkflowObservationContractIntegration
} = require("./recruitmentWorkflowObservationContractIntegrationHook");

/**
 * @param {*} value
 * @returns {number|null}
 */
function normalizeUpdateId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {Object} input
 * @param {Object} input.notice
 * @param {Object[]} [input.candidateRecruitments]
 * @param {boolean} [input.isEnabled]
 * @param {typeof processRecruitmentDetection} [input.processDetection]
 * @param {string} [input.createdAt]
 * @param {number|string|null} [input.updateId] detected updates.id for traceability
 * @param {Object|null} [input.featureFlags] optional workflow integration flags
 * @param {string} [input.executionMode]
 * @param {string|null} [input.correlationId]
 * @param {string|null} [input.traceId]
 * @param {string|null} [input.pipelineRunId]
 * @param {string|null} [input.contextId]
 * @returns {{ skipped: true, reason: string, updateId: number|null } | { skipped: false, result: Object, updateId: number|null } | { skipped: false, failed: true, error: Error, updateId: number|null }}
 */
function finalizePipelineOutcome(outcome, compatibilityInput) {
  try {
    attachRecruitmentCompatibility(outcome, compatibilityInput);
  } catch {
    // Phase 69 — compatibility is additive only; never alter pipeline decisions.
  }
  try {
    attachRecruitmentWorkflowIntegration(outcome, compatibilityInput);
  } catch {
    // Phase 92 — advisory integration only; never alter pipeline decisions.
  }
  try {
    attachRecruitmentWorkflowObservationContractIntegration(
      outcome,
      compatibilityInput
    );
  } catch {
    // Phase 109 advisory integration only
  }
  return outcome;
}

function runRecruitmentPipeline({
  notice,
  candidateRecruitments = [],
  isEnabled = false,
  processDetection = processRecruitmentDetection,
  createdAt,
  updateId = null,
  featureFlags = null,
  executionMode,
  correlationId,
  traceId,
  pipelineRunId,
  contextId
} = {}) {
  const traceUpdateId = normalizeUpdateId(updateId);
  const compatibilityInput = {
    notice,
    updateId: traceUpdateId,
    createdAt,
    featureFlags,
    executionMode,
    correlationId,
    traceId,
    pipelineRunId,
    contextId
  };

  if (!isEnabled) {
    return finalizePipelineOutcome(
      { skipped: true, reason: "flag_off", updateId: traceUpdateId },
      compatibilityInput
    );
  }

  try {
    const result = processDetection({
      notice,
      candidateRecruitments,
      createdAt
    });
    return finalizePipelineOutcome(
      { skipped: false, result, updateId: traceUpdateId },
      compatibilityInput
    );
  } catch (error) {
    return finalizePipelineOutcome(
      {
        skipped: false,
        failed: true,
        error: error instanceof Error ? error : new Error(String(error)),
        updateId: traceUpdateId
      },
      compatibilityInput
    );
  }
}

module.exports = {
  runRecruitmentPipeline,
  normalizeUpdateId
};
