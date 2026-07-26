"use strict";

/**
 * PWP Phase 4 — Editorial Workflow Layer.
 *
 * Manages deterministic editorial review before manual publishing.
 * Review operations only. No AI. No publishing. No Generator rendering.
 *
 * Shared API:
 *   prepareEditorialReview()
 *   reviewAction()
 *
 * Returns: Editorial Package + Review State + Validation Report + Review History
 */

const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");
const {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  EDITORIAL_PACKAGE_FORMAT_ID,
  EDITORIAL_CONTRACT_FORMAT_ID,
  REVIEW_STATES,
  REVIEW_ACTIONS,
  REVIEW_TRANSITIONS,
  TERMINAL_REVIEW_STATES
} = require("./editorialTypes");
const { validateEditorialReviewInput } = require("./validation");
const {
  buildEditorialPackage,
  buildEditorialContract,
  createReviewId
} = require("./editorialPackage");
const { buildDiffModel } = require("./diffModel");
const { applyReviewAction, resolveNextState, isAllowedTransition } = require("./reviewStateMachine");
const {
  getReviewHistory,
  storeEditorialPackage,
  getStoredEditorialPackage,
  clearReviewMemory,
  seedReviewHistory
} = require("./reviewHistory");

function normalizeInput(input = {}) {
  const workflowContext =
    input.workflowContext && typeof input.workflowContext === "object"
      ? input.workflowContext
      : {};

  const draftPackage = input.draftPackage || null;
  const generatorContract = input.generatorContract || null;

  const validationSummary =
    input.validationSummary ||
    (draftPackage && draftPackage.validationSummary) ||
    (input.validationReport && input.validationReport.summary) ||
    null;

  const editorialNotes =
    input.editorialNotes != null
      ? input.editorialNotes
      : draftPackage && draftPackage.editorialNotes
        ? draftPackage.editorialNotes
        : null;

  const existingPageMetadata =
    input.existingPageMetadata ||
    input.existingPage ||
    workflowContext.existingPageMetadata ||
    workflowContext.existingPage ||
    null;

  const workflowId =
    input.workflowId ||
    workflowContext.workflowId ||
    (workflowContext.monitoringEvent && workflowContext.monitoringEvent.workflowId) ||
    (draftPackage && draftPackage.workflowId) ||
    null;

  return {
    workflowContext,
    draftPackage,
    generatorContract,
    validationSummary,
    editorialNotes,
    existingPageMetadata,
    workflowId
  };
}

/**
 * Prepare editorial review from Phase 3 outputs.
 *
 * Accepts only:
 * - Workflow Context
 * - Draft Package
 * - Generator Contract
 * - Validation Summary
 * - Editorial Notes
 * - Existing Page Metadata (optional)
 *
 * @param {object} input
 * @returns {object}
 */
function prepareEditorialReview(input = {}) {
  const normalized = normalizeInput(input);

  const validationReport = validateEditorialReviewInput({
    workflowContext: normalized.workflowContext,
    draftPackage: normalized.draftPackage,
    generatorContract: normalized.generatorContract,
    validationSummary: normalized.validationSummary,
    editorialNotes: normalized.editorialNotes,
    existingPageMetadata: normalized.existingPageMetadata,
    workflowId: normalized.workflowId
  });

  // Validation failure → do not enter review queue.
  if (!validationReport.valid) {
    const editorialContract = buildEditorialContract({
      editorialPackage: null,
      validationReport
    });

    return deepFreeze({
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      phase: PHASE,
      editorialPackage: null,
      editorialContract,
      reviewState: null,
      validationReport,
      reviewHistory: Object.freeze([]),
      skipped: true,
      skipReason: "VALIDATION_FAILED",
      queued: false,
      effects: Object.freeze({
        preparesEditorialPackage: false,
        entersReviewQueue: false,
        rendersHtml: false,
        publishes: false,
        usesAi: false,
        automaticApproval: false
      })
    });
  }

  const editorialPackage = buildEditorialPackage({
    workflowContext: normalized.workflowContext,
    draftPackage: normalized.draftPackage,
    generatorContract: normalized.generatorContract,
    validationSummary: validationReport.validationSummary || normalized.validationSummary,
    editorialNotes: normalized.editorialNotes,
    existingPageMetadata: normalized.existingPageMetadata,
    workflowId: normalized.workflowId,
    reviewState: REVIEW_STATES.QUEUED,
    warnings: validationReport.warnings.slice()
  });

  seedReviewHistory(editorialPackage.reviewId, editorialPackage.reviewHistory);
  storeEditorialPackage(editorialPackage);

  const editorialContract = buildEditorialContract({
    editorialPackage,
    validationReport
  });

  return deepFreeze({
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    editorialPackage,
    editorialContract,
    reviewState: editorialPackage.reviewState,
    validationReport,
    reviewHistory: editorialPackage.reviewHistory,
    skipped: false,
    skipReason: null,
    queued: true,
    effects: Object.freeze({
      preparesEditorialPackage: true,
      entersReviewQueue: true,
      rendersHtml: false,
      publishes: false,
      usesAi: false,
      automaticApproval: false
    })
  });
}

/**
 * Apply an explicit reviewer decision.
 *
 * @param {object} input
 * @returns {object}
 */
function reviewAction(input = {}) {
  const result = applyReviewAction(input);

  if (!result.ok) {
    return deepFreeze({
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      phase: PHASE,
      editorialPackage: result.editorialPackage,
      reviewState: result.reviewState,
      validationReport: Object.freeze({
        valid: false,
        errors: Object.freeze([result.error]),
        warnings: Object.freeze([]),
        summary: Object.freeze({
          valid: false,
          errorCount: 1,
          warningCount: 0,
          action: result.action,
          previousState: result.previousState
        })
      }),
      reviewHistory: result.reviewHistory,
      skipped: false,
      ok: false,
      error: result.error,
      effects: Object.freeze({
        preparesEditorialPackage: false,
        entersReviewQueue: false,
        rendersHtml: false,
        publishes: false,
        usesAi: false,
        automaticApproval: false,
        stateChanged: false
      })
    });
  }

  return deepFreeze({
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    editorialPackage: result.editorialPackage,
    reviewState: result.reviewState,
    validationReport: Object.freeze({
      valid: true,
      errors: Object.freeze([]),
      warnings: Object.freeze([]),
      summary: Object.freeze({
        valid: true,
        errorCount: 0,
        warningCount: 0,
        action: result.action,
        previousState: result.previousState,
        newState: result.reviewState
      })
    }),
    reviewHistory: result.reviewHistory,
    skipped: false,
    ok: true,
    error: null,
    effects: Object.freeze({
      preparesEditorialPackage: false,
      entersReviewQueue: false,
      rendersHtml: false,
      publishes: false,
      usesAi: false,
      automaticApproval: false,
      stateChanged: true,
      readyForManualPublish:
        result.reviewState === REVIEW_STATES.READY_FOR_MANUAL_PUBLISH
    })
  });
}

module.exports = {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  EDITORIAL_PACKAGE_FORMAT_ID,
  EDITORIAL_CONTRACT_FORMAT_ID,
  REVIEW_STATES,
  REVIEW_ACTIONS,
  REVIEW_TRANSITIONS,
  TERMINAL_REVIEW_STATES,
  prepareEditorialReview,
  reviewAction,
  validateEditorialReviewInput,
  buildEditorialPackage,
  buildEditorialContract,
  buildDiffModel,
  createReviewId,
  resolveNextState,
  isAllowedTransition,
  getReviewHistory,
  getStoredEditorialPackage,
  clearReviewMemory,
  normalizeInput
};
