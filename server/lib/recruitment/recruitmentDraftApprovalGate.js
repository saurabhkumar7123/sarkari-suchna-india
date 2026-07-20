"use strict";

/**
 * Phase 116 — Recruitment Draft Approval Gate.
 *
 * Pure advisory approval gate that evaluates Phase 115 persistence requests
 * without database access, reviewer decision storage, coordinator invocation,
 * pipeline mutations, or any side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS,
  isRecruitmentDraftPersistenceRequest
} = require("./recruitmentDraftPersistenceBoundary");

const RECRUITMENT_DRAFT_APPROVAL_GATE_PHASE = 116;

const RECRUITMENT_DRAFT_APPROVAL_GATE_ENTITY = "recruitment_draft_approval_gate";

const RECRUITMENT_DRAFT_APPROVAL_STATUSES = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  NEEDS_REVIEW: "NEEDS_REVIEW"
});

const RECRUITMENT_DRAFT_APPROVED_OPERATIONS = Object.freeze({
  NO_ACTION: "NO_ACTION",
  CREATE_DRAFT_REQUEST: "CREATE_DRAFT_REQUEST"
});

const RECRUITMENT_DRAFT_APPROVAL_REASONS = Object.freeze({
  INVALID_PERSISTENCE_REQUEST: "INVALID_PERSISTENCE_REQUEST",
  EXISTING_RECRUITMENT_UPDATE: "EXISTING_RECRUITMENT_UPDATE",
  HIGH_RISK_PERSISTENCE_REQUEST: "HIGH_RISK_PERSISTENCE_REQUEST",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED"
});

const RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA = Object.freeze({
  phase: RECRUITMENT_DRAFT_APPROVAL_GATE_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  approvalGateOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  storesReviewerDecisions: false,
  createsDrafts: false,
  publishesPages: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  sourcePhases: Object.freeze([115])
});

const RECRUITMENT_DRAFT_APPROVAL_GATE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DRAFT_APPROVAL_GATE_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DRAFT_APPROVAL_GATE_PHASE,
  description:
    "Pure advisory approval gate evaluating Phase 115 persistence requests without execution.",
  metadata: RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA
});

const EMPTY_APPROVAL_SUMMARY = Object.freeze({
  approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
  persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST,
  approvedOperation: null,
  lifecycleEvent: "UNKNOWN",
  requiresHumanAction: true,
  reviewerRequired: true,
  confidence: "NONE",
  reason: RECRUITMENT_DRAFT_APPROVAL_REASONS.INVALID_PERSISTENCE_REQUEST
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {Readonly<Object>|null|undefined} context
 * @returns {Readonly<Object>|null}
 */
function resolvePersistenceRequest(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isRecruitmentDraftPersistenceRequest(context.persistenceRequest)) {
    return context.persistenceRequest;
  }

  if (isRecruitmentDraftPersistenceRequest(context)) {
    return context;
  }

  return null;
}

/**
 * @param {Readonly<Object>|null|undefined} context
 * @returns {boolean}
 */
function isHighRiskContext(context) {
  if (!isPlainObject(context)) {
    return false;
  }

  if (isPlainObject(context.riskContext) && context.riskContext.highRisk === true) {
    return true;
  }

  return isPlainObject(context) && context.highRisk === true;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildApprovalResult(params) {
  return deepFreeze({
    approvalStatus: params.approvalStatus,
    approvedOperation: params.approvedOperation ?? null,
    persistenceOperation: params.persistenceOperation,
    lifecycleEvent: params.lifecycleEvent,
    confidence: params.confidence,
    reason: params.reason,
    requiresHumanAction: params.requiresHumanAction === true,
    reviewerRequired: params.reviewerRequired === true,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * @returns {Readonly<Object>}
 */
function buildInvalidPersistenceApproval() {
  return buildApprovalResult({
    approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
    approvedOperation: null,
    persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST,
    lifecycleEvent: "UNKNOWN",
    confidence: "NONE",
    reason: RECRUITMENT_DRAFT_APPROVAL_REASONS.INVALID_PERSISTENCE_REQUEST,
    requiresHumanAction: true,
    reviewerRequired: true
  });
}

/**
 * @param {Readonly<Object>} persistenceRequest
 * @param {boolean} highRisk
 * @returns {Readonly<Object>}
 */
function evaluatePersistenceRequestApproval(persistenceRequest, highRisk) {
  const operation = persistenceRequest.operation;
  const lifecycleEvent = persistenceRequest.lifecycleEvent;
  const confidence = persistenceRequest.confidence;
  const persistenceReason = persistenceRequest.reason;

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST) {
    return buildApprovalResult({
      approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED,
      approvedOperation: RECRUITMENT_DRAFT_APPROVED_OPERATIONS.NO_ACTION,
      persistenceOperation: operation,
      lifecycleEvent,
      confidence,
      reason: persistenceReason,
      requiresHumanAction: false,
      reviewerRequired: false
    });
  }

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST) {
    return buildApprovalResult({
      approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
      approvedOperation: null,
      persistenceOperation: operation,
      lifecycleEvent,
      confidence,
      reason: persistenceReason,
      requiresHumanAction: true,
      reviewerRequired: true
    });
  }

  if (highRisk) {
    return buildApprovalResult({
      approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
      approvedOperation: null,
      persistenceOperation: operation,
      lifecycleEvent,
      confidence,
      reason: RECRUITMENT_DRAFT_APPROVAL_REASONS.HIGH_RISK_PERSISTENCE_REQUEST,
      requiresHumanAction: true,
      reviewerRequired: true
    });
  }

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST) {
    return buildApprovalResult({
      approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED,
      approvedOperation: RECRUITMENT_DRAFT_APPROVED_OPERATIONS.CREATE_DRAFT_REQUEST,
      persistenceOperation: operation,
      lifecycleEvent,
      confidence,
      reason: persistenceReason,
      requiresHumanAction: false,
      reviewerRequired: false
    });
  }

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST) {
    return buildApprovalResult({
      approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
      approvedOperation: null,
      persistenceOperation: operation,
      lifecycleEvent,
      confidence,
      reason:
        persistenceReason || RECRUITMENT_DRAFT_APPROVAL_REASONS.EXISTING_RECRUITMENT_UPDATE,
      requiresHumanAction: true,
      reviewerRequired: true
    });
  }

  return buildInvalidPersistenceApproval();
}

/**
 * Evaluate advisory approval for a Phase 115 persistence request.
 * Never throws. Never mutates input. Never writes or queries databases.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function evaluateRecruitmentDraftApproval(context) {
  try {
    const persistenceRequest = resolvePersistenceRequest(context);
    if (!persistenceRequest) {
      return buildInvalidPersistenceApproval();
    }

    const highRisk = isHighRiskContext(context);
    return evaluatePersistenceRequestApproval(persistenceRequest, highRisk);
  } catch {
    return buildInvalidPersistenceApproval();
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDraftApproval(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validStatuses = Object.values(RECRUITMENT_DRAFT_APPROVAL_STATUSES);
  const validOperations = Object.values(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS);
  const validApprovedOperations = Object.values(RECRUITMENT_DRAFT_APPROVED_OPERATIONS);

  if (
    !validStatuses.includes(value.approvalStatus) ||
    !validOperations.includes(value.persistenceOperation) ||
    typeof value.lifecycleEvent !== "string" ||
    typeof value.confidence !== "string" ||
    typeof value.reason !== "string" ||
    typeof value.requiresHumanAction !== "boolean" ||
    typeof value.reviewerRequired !== "boolean"
  ) {
    return false;
  }

  if (
    value.approvedOperation != null &&
    !validApprovedOperations.includes(value.approvedOperation)
  ) {
    return false;
  }

  if (value.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED) {
    if (value.approvedOperation == null) {
      return false;
    }
    if (value.requiresHumanAction === true || value.reviewerRequired === true) {
      return false;
    }
  }

  if (
    value.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW &&
    value.reviewerRequired !== true
  ) {
    return false;
  }

  return (
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

/**
 * Summarize a recruitment draft approval result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDraftApproval(value) {
  if (!isRecruitmentDraftApproval(value)) {
    return EMPTY_APPROVAL_SUMMARY;
  }

  return Object.freeze({
    approvalStatus: value.approvalStatus,
    persistenceOperation: value.persistenceOperation,
    approvedOperation: value.approvedOperation ?? null,
    lifecycleEvent: value.lifecycleEvent,
    requiresHumanAction: value.requiresHumanAction === true,
    reviewerRequired: value.reviewerRequired === true,
    confidence: value.confidence,
    reason: value.reason
  });
}

module.exports = {
  RECRUITMENT_DRAFT_APPROVAL_GATE_PHASE,
  RECRUITMENT_DRAFT_APPROVAL_GATE_ENTITY,
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  RECRUITMENT_DRAFT_APPROVED_OPERATIONS,
  RECRUITMENT_DRAFT_APPROVAL_REASONS,
  RECRUITMENT_DRAFT_APPROVAL_GATE_DESCRIPTOR,
  RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA,
  EMPTY_APPROVAL_SUMMARY,
  evaluateRecruitmentDraftApproval,
  isRecruitmentDraftApproval,
  summarizeRecruitmentDraftApproval
};
