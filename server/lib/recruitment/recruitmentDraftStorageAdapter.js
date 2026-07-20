"use strict";

/**
 * Phase 118 — Recruitment Draft Storage Adapter Boundary.
 *
 * Pure advisory storage adapter that converts an approved Phase 117 review
 * package into a future draft storage payload without database access, draft
 * creation, coordinator invocation, pipeline mutations, or any side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE
} = require("./recruitmentDraftProposalEngine");

const {
  RECRUITMENT_DRAFT_PERSISTENCE_ENTITY,
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS
} = require("./recruitmentDraftPersistenceBoundary");

const {
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  RECRUITMENT_DRAFT_APPROVED_OPERATIONS,
  isRecruitmentDraftApproval
} = require("./recruitmentDraftApprovalGate");

const {
  RECRUITMENT_DRAFT_REVIEW_STATUSES,
  isRecruitmentDraftReviewPackage
} = require("./recruitmentDraftReviewPackageBuilder");

const RECRUITMENT_DRAFT_STORAGE_ADAPTER_PHASE = 118;

const RECRUITMENT_DRAFT_STORAGE_ADAPTER_ENTITY = "recruitment_draft_storage_adapter";

const RECRUITMENT_DRAFT_STORAGE_PAYLOAD_VERSION = "1.0.0";

const RECRUITMENT_DRAFT_STORAGE_ACTIONS = Object.freeze({
  CREATE_DRAFT_RECORD: "CREATE_DRAFT_RECORD",
  UPDATE_DRAFT_RECORD: "UPDATE_DRAFT_RECORD",
  HOLD_FOR_REVIEW: "HOLD_FOR_REVIEW",
  NO_STORAGE_ACTION: "NO_STORAGE_ACTION"
});

const RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA = Object.freeze({
  phase: RECRUITMENT_DRAFT_STORAGE_ADAPTER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  storageAdapterOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  createsDrafts: false,
  publishesPages: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  sourcePhases: Object.freeze([116, 117])
});

const RECRUITMENT_DRAFT_STORAGE_ADAPTER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DRAFT_STORAGE_ADAPTER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DRAFT_STORAGE_ADAPTER_PHASE,
  description:
    "Pure advisory storage adapter projecting Phase 117 review packages into future draft storage payloads.",
  metadata: RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA
});

const EMPTY_STORAGE_PAYLOAD_SUMMARY = Object.freeze({
  storageAction: RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW,
  entity: null,
  lifecycleEvent: "UNKNOWN",
  proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
  reviewStatus: RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED,
  approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
  confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
  requiresHumanReview: true
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
function resolveReviewPackage(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isRecruitmentDraftReviewPackage(context.reviewPackage)) {
    return context.reviewPackage;
  }

  return null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isMinimalValidApprovalDecision(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validStatuses = Object.values(RECRUITMENT_DRAFT_APPROVAL_STATUSES);
  const validOperations = Object.values(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS);

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
    value.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED &&
    (value.requiresHumanAction === true || value.reviewerRequired === true)
  ) {
    return false;
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
 * @param {Readonly<Object>|null|undefined} context
 * @returns {Readonly<Object>|null}
 */
function resolveApprovalDecision(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isRecruitmentDraftApproval(context.approvalDecision)) {
    return context.approvalDecision;
  }

  if (isMinimalValidApprovalDecision(context.approvalDecision)) {
    return context.approvalDecision;
  }

  return null;
}

/**
 * @param {Readonly<Object>} approvalDecision
 * @returns {boolean}
 */
function isApprovedCreateDraftRequest(approvalDecision) {
  return (
    approvalDecision.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED &&
    approvalDecision.persistenceOperation ===
      RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST &&
    approvalDecision.approvedOperation ===
      RECRUITMENT_DRAFT_APPROVED_OPERATIONS.CREATE_DRAFT_REQUEST
  );
}

/**
 * @param {Readonly<Object>} approvalDecision
 * @returns {boolean}
 */
function isApprovedUpdateDraftRequest(approvalDecision) {
  return (
    approvalDecision.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED &&
    approvalDecision.persistenceOperation ===
      RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST
  );
}

/**
 * @param {Readonly<Object>} reviewPackage
 * @param {Readonly<Object>} approvalDecision
 * @returns {string}
 */
function resolveStorageAction(reviewPackage, approvalDecision) {
  const reviewStatus = reviewPackage.reviewStatus;

  if (reviewStatus === RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION) {
    return RECRUITMENT_DRAFT_STORAGE_ACTIONS.NO_STORAGE_ACTION;
  }

  if (reviewStatus === RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED) {
    return RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW;
  }

  if (
    reviewStatus === RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW &&
    isApprovedCreateDraftRequest(approvalDecision)
  ) {
    return RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD;
  }

  if (
    reviewStatus === RECRUITMENT_DRAFT_REVIEW_STATUSES.CHANGE_REVIEW_REQUIRED &&
    isApprovedUpdateDraftRequest(approvalDecision)
  ) {
    return RECRUITMENT_DRAFT_STORAGE_ACTIONS.UPDATE_DRAFT_RECORD;
  }

  return RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW;
}

/**
 * @param {string} storageAction
 * @returns {string|null}
 */
function resolveEntityForStorageAction(storageAction) {
  if (
    storageAction === RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD ||
    storageAction === RECRUITMENT_DRAFT_STORAGE_ACTIONS.UPDATE_DRAFT_RECORD
  ) {
    return RECRUITMENT_DRAFT_PERSISTENCE_ENTITY;
  }

  return null;
}

/**
 * @param {Readonly<Object>|null|undefined} sourceContext
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {Readonly<Object>} reviewPackage
 * @returns {string|null}
 */
function resolveSourceIdentifier(sourceContext, detectedUpdateContext, reviewPackage) {
  if (typeof reviewPackage.sourceIdentifier === "string" && reviewPackage.sourceIdentifier.length > 0) {
    return reviewPackage.sourceIdentifier;
  }

  if (isPlainObject(sourceContext)) {
    if (typeof sourceContext.sourceIdentifier === "string" && sourceContext.sourceIdentifier.length > 0) {
      return sourceContext.sourceIdentifier;
    }
    if (typeof sourceContext.url === "string" && sourceContext.url.length > 0) {
      return sourceContext.url;
    }
    if (isPlainObject(sourceContext.notice) && typeof sourceContext.notice.url === "string") {
      if (sourceContext.notice.url.length > 0) {
        return sourceContext.notice.url;
      }
    }
  }

  if (isPlainObject(detectedUpdateContext)) {
    if (typeof detectedUpdateContext.sourceUrl === "string" && detectedUpdateContext.sourceUrl.length > 0) {
      return detectedUpdateContext.sourceUrl;
    }
    if (
      typeof detectedUpdateContext.sourceIdentifier === "string" &&
      detectedUpdateContext.sourceIdentifier.length > 0
    ) {
      return detectedUpdateContext.sourceIdentifier;
    }
  }

  return null;
}

/**
 * @param {Readonly<Object>|null|undefined} sourceContext
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {Readonly<Object>} reviewPackage
 * @returns {string|null}
 */
function resolveTitleHint(sourceContext, detectedUpdateContext, reviewPackage) {
  if (typeof reviewPackage.titleHint === "string" && reviewPackage.titleHint.length > 0) {
    return reviewPackage.titleHint;
  }

  if (isPlainObject(sourceContext)) {
    if (typeof sourceContext.titleHint === "string" && sourceContext.titleHint.length > 0) {
      return sourceContext.titleHint;
    }
    if (typeof sourceContext.title === "string" && sourceContext.title.length > 0) {
      return sourceContext.title;
    }
    if (isPlainObject(sourceContext.notice) && typeof sourceContext.notice.title === "string") {
      if (sourceContext.notice.title.length > 0) {
        return sourceContext.notice.title;
      }
    }
  }

  if (isPlainObject(detectedUpdateContext)) {
    if (typeof detectedUpdateContext.title === "string" && detectedUpdateContext.title.length > 0) {
      return detectedUpdateContext.title;
    }
    if (typeof detectedUpdateContext.titleHint === "string" && detectedUpdateContext.titleHint.length > 0) {
      return detectedUpdateContext.titleHint;
    }
  }

  return null;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildStoragePayloadResult(params) {
  return deepFreeze({
    storageAction: params.storageAction,
    entity: params.entity,
    lifecycleEvent: params.lifecycleEvent,
    proposalType: params.proposalType,
    titleHint: params.titleHint ?? null,
    sourceIdentifier: params.sourceIdentifier ?? null,
    draftMetadata: deepFreeze({
      reviewStatus: params.reviewStatus,
      approvalStatus: params.approvalStatus,
      confidence: params.confidence,
      requiresHumanReview: params.requiresHumanReview === true
    }),
    payloadVersion: RECRUITMENT_DRAFT_STORAGE_PAYLOAD_VERSION,
    persistenceEnabled: false,
    executed: false,
    advisory: true,
    architectureOnly: true
  });
}

/**
 * @returns {Readonly<Object>}
 */
function buildEmptyStoragePayload() {
  return buildStoragePayloadResult({
    storageAction: RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW,
    entity: null,
    lifecycleEvent: "UNKNOWN",
    proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
    titleHint: null,
    sourceIdentifier: null,
    reviewStatus: RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED,
    approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
    confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
    requiresHumanReview: true
  });
}

/**
 * Convert a Phase 117 review package into a future draft storage payload.
 * Never throws. Never mutates input. Never writes drafts or queries databases.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function createRecruitmentDraftStoragePayload(context) {
  try {
    const reviewPackage = resolveReviewPackage(context);
    const approvalDecision = resolveApprovalDecision(context);

    if (!reviewPackage || !approvalDecision) {
      return buildEmptyStoragePayload();
    }

    const sourceContext = isPlainObject(context) ? context.sourceContext : null;
    const detectedUpdateContext = isPlainObject(context) ? context.detectedUpdateContext : null;

    const storageAction = resolveStorageAction(reviewPackage, approvalDecision);
    const titleHint = resolveTitleHint(sourceContext, detectedUpdateContext, reviewPackage);
    const sourceIdentifier = resolveSourceIdentifier(
      sourceContext,
      detectedUpdateContext,
      reviewPackage
    );

    return buildStoragePayloadResult({
      storageAction,
      entity: resolveEntityForStorageAction(storageAction),
      lifecycleEvent: reviewPackage.lifecycleEvent,
      proposalType: reviewPackage.proposalType,
      titleHint,
      sourceIdentifier,
      reviewStatus: reviewPackage.reviewStatus,
      approvalStatus: approvalDecision.approvalStatus,
      confidence: reviewPackage.confidence,
      requiresHumanReview: reviewPackage.requiresHumanReview
    });
  } catch {
    return buildEmptyStoragePayload();
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDraftStoragePayload(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validStorageActions = Object.values(RECRUITMENT_DRAFT_STORAGE_ACTIONS);
  const validReviewStatuses = Object.values(RECRUITMENT_DRAFT_REVIEW_STATUSES);
  const validApprovalStatuses = Object.values(RECRUITMENT_DRAFT_APPROVAL_STATUSES);
  const validProposalTypes = Object.values(RECRUITMENT_DRAFT_PROPOSAL_TYPES);

  if (
    !validStorageActions.includes(value.storageAction) ||
    typeof value.lifecycleEvent !== "string" ||
    !validProposalTypes.includes(value.proposalType) ||
    value.payloadVersion !== RECRUITMENT_DRAFT_STORAGE_PAYLOAD_VERSION ||
    (value.titleHint != null && typeof value.titleHint !== "string") ||
    (value.sourceIdentifier != null && typeof value.sourceIdentifier !== "string")
  ) {
    return false;
  }

  const expectedEntity = resolveEntityForStorageAction(value.storageAction);
  if (value.entity !== expectedEntity) {
    return false;
  }

  if (!isPlainObject(value.draftMetadata)) {
    return false;
  }

  const metadata = value.draftMetadata;
  if (
    !validReviewStatuses.includes(metadata.reviewStatus) ||
    !validApprovalStatuses.includes(metadata.approvalStatus) ||
    typeof metadata.confidence !== "string" ||
    typeof metadata.requiresHumanReview !== "boolean"
  ) {
    return false;
  }

  return (
    value.persistenceEnabled === false &&
    value.executed === false &&
    value.advisory === true &&
    value.architectureOnly === true
  );
}

/**
 * Summarize a recruitment draft storage payload result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDraftStoragePayload(value) {
  if (!isRecruitmentDraftStoragePayload(value)) {
    return EMPTY_STORAGE_PAYLOAD_SUMMARY;
  }

  return Object.freeze({
    storageAction: value.storageAction,
    entity: value.entity,
    lifecycleEvent: value.lifecycleEvent,
    proposalType: value.proposalType,
    reviewStatus: value.draftMetadata.reviewStatus,
    approvalStatus: value.draftMetadata.approvalStatus,
    confidence: value.draftMetadata.confidence,
    requiresHumanReview: value.draftMetadata.requiresHumanReview === true
  });
}

module.exports = {
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_PHASE,
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_ENTITY,
  RECRUITMENT_DRAFT_STORAGE_PAYLOAD_VERSION,
  RECRUITMENT_DRAFT_STORAGE_ACTIONS,
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_DESCRIPTOR,
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA,
  EMPTY_STORAGE_PAYLOAD_SUMMARY,
  createRecruitmentDraftStoragePayload,
  isRecruitmentDraftStoragePayload,
  summarizeRecruitmentDraftStoragePayload
};
