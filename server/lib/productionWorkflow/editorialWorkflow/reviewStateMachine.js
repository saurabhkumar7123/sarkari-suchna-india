"use strict";

/**
 * PWP Phase 4 — Deterministic review state machine.
 * All transitions are explicit. No automatic approval.
 */

const {
  REVIEW_STATES,
  REVIEW_ACTIONS,
  REVIEW_TRANSITIONS
} = require("./editorialTypes");
const {
  createHistoryEntry,
  appendReviewHistory,
  getReviewHistory,
  storeEditorialPackage,
  getStoredEditorialPackage
} = require("./reviewHistory");
const { withReviewTransition } = require("./editorialPackage");

function resolveNextState(currentState, action) {
  const table = REVIEW_TRANSITIONS[action];
  if (!table) return null;
  return table[currentState] || null;
}

function isAllowedTransition(currentState, action) {
  return resolveNextState(currentState, action) != null;
}

/**
 * Apply an explicit review action to an Editorial Package.
 *
 * @param {{
 *   editorialPackage?: object,
 *   reviewId?: string,
 *   action: string,
 *   reason?: string|null,
 *   reviewerId?: string|null,
 *   timestamp?: string|null
 * }} input
 * @returns {{
 *   ok: boolean,
 *   editorialPackage: object|null,
 *   reviewState: string|null,
 *   reviewHistory: object[],
 *   error: object|null,
 *   previousState: string|null,
 *   action: string|null
 * }}
 */
function applyReviewAction(input = {}) {
  const action = input.action || null;
  const reason = input.reason != null ? input.reason : null;
  const reviewerId = input.reviewerId != null ? input.reviewerId : null;
  const timestamp = input.timestamp || "deterministic";

  let editorialPackage =
    input.editorialPackage ||
    (input.reviewId ? getStoredEditorialPackage(input.reviewId) : null) ||
    null;

  if (!editorialPackage || typeof editorialPackage !== "object") {
    return Object.freeze({
      ok: false,
      editorialPackage: null,
      reviewState: null,
      reviewHistory: Object.freeze([]),
      error: Object.freeze({
        code: "MISSING_EDITORIAL_PACKAGE",
        message: "Editorial Package is required for reviewAction"
      }),
      previousState: null,
      action
    });
  }

  if (!action || !REVIEW_ACTIONS[action]) {
    return Object.freeze({
      ok: false,
      editorialPackage,
      reviewState: editorialPackage.reviewState,
      reviewHistory: getReviewHistory(editorialPackage.reviewId),
      error: Object.freeze({
        code: "UNKNOWN_REVIEW_ACTION",
        message: `Unknown or missing review action: ${action}`
      }),
      previousState: editorialPackage.reviewState,
      action
    });
  }

  const previousState = editorialPackage.reviewState;
  const newState = resolveNextState(previousState, action);

  if (!newState) {
    return Object.freeze({
      ok: false,
      editorialPackage,
      reviewState: previousState,
      reviewHistory: getReviewHistory(editorialPackage.reviewId),
      error: Object.freeze({
        code: "INVALID_TRANSITION",
        message: `Action ${action} is not allowed from state ${previousState}`
      }),
      previousState,
      action
    });
  }

  // No automatic approval — APPROVE must be the explicit action that lands in APPROVED.
  if (
    newState === REVIEW_STATES.APPROVED &&
    action !== REVIEW_ACTIONS.APPROVE
  ) {
    return Object.freeze({
      ok: false,
      editorialPackage,
      reviewState: previousState,
      reviewHistory: getReviewHistory(editorialPackage.reviewId),
      error: Object.freeze({
        code: "AUTOMATIC_APPROVAL_FORBIDDEN",
        message: "Approval requires explicit APPROVE action"
      }),
      previousState,
      action
    });
  }

  const historyEntry = createHistoryEntry({
    timestamp,
    previousState,
    newState,
    action,
    reason,
    reviewerId
  });

  const reviewHistory = appendReviewHistory(editorialPackage.reviewId, historyEntry);
  const nextPackage = withReviewTransition(editorialPackage, {
    newState,
    historyEntry,
    reviewHistory
  });

  storeEditorialPackage(nextPackage);

  return Object.freeze({
    ok: true,
    editorialPackage: nextPackage,
    reviewState: newState,
    reviewHistory,
    error: null,
    previousState,
    action
  });
}

module.exports = {
  resolveNextState,
  isAllowedTransition,
  applyReviewAction
};
