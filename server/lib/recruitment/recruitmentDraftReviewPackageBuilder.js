"use strict";

/**
 * Phase 117 — Recruitment Draft Review Package Builder.
 *
 * Pure advisory read-only library that converts Phase 114 draft proposals,
 * Phase 115 persistence requests, and Phase 116 approval decisions into a
 * structured human review package without database access, draft creation,
 * coordinator invocation, pipeline mutations, or any side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  RECRUITMENT_DRAFT_PROPOSAL_ACTIONS,
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE,
  RECRUITMENT_DRAFT_PROPOSAL_REASONS,
  isRecruitmentDraftProposal
} = require("./recruitmentDraftProposalEngine");

const {
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS,
  isRecruitmentDraftPersistenceRequest
} = require("./recruitmentDraftPersistenceBoundary");

const {
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  isRecruitmentDraftApproval
} = require("./recruitmentDraftApprovalGate");

const RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_PHASE = 117;

const RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_ENTITY = "recruitment_draft_review_package_builder";

const RECRUITMENT_DRAFT_REVIEW_STATUSES = Object.freeze({
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  CHANGE_REVIEW_REQUIRED: "CHANGE_REVIEW_REQUIRED",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  NO_ACTION: "NO_ACTION"
});

const RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS = Object.freeze({
  PROPOSED_CREATE: "PROPOSED_CREATE",
  PROPOSED_UPDATE: "PROPOSED_UPDATE",
  MANUAL_REVIEW: "MANUAL_REVIEW"
});

const OPERATION_TO_REVIEW_STATUS = Object.freeze({
  [RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST]:
    RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW,
  [RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST]:
    RECRUITMENT_DRAFT_REVIEW_STATUSES.CHANGE_REVIEW_REQUIRED,
  [RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST]:
    RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED,
  [RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST]:
    RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION
});

const RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA = Object.freeze({
  phase: RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  reviewPackageOnly: true,
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
  sourcePhases: Object.freeze([114, 115, 116])
});

const RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_PHASE,
  description:
    "Pure advisory review package builder projecting Phase 114-116 outputs into structured human review packages.",
  metadata: RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA
});

const EMPTY_REVIEW_PACKAGE_SUMMARY = Object.freeze({
  reviewStatus: RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED,
  action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
  lifecycleEvent: "UNKNOWN",
  proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
  persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST,
  approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
  confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
  requiresHumanReview: true,
  reviewerDecisionRequired: true
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
function resolveDraftProposal(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isRecruitmentDraftProposal(context.draftProposal)) {
    return context.draftProposal;
  }

  return null;
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

  return null;
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

  return null;
}

/**
 * @param {Readonly<Object>|null|undefined} sourceContext
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {Readonly<Object>|null|undefined} payload
 * @returns {string|null}
 */
function resolveSourceIdentifier(sourceContext, detectedUpdateContext, payload) {
  if (isPlainObject(payload) && typeof payload.sourceIdentifier === "string") {
    if (payload.sourceIdentifier.length > 0) {
      return payload.sourceIdentifier;
    }
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
 * @param {Readonly<Object>|null|undefined} payload
 * @returns {string|null}
 */
function resolveTitleHint(sourceContext, detectedUpdateContext, payload) {
  if (isPlainObject(payload) && typeof payload.titleHint === "string" && payload.titleHint.length > 0) {
    return payload.titleHint;
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
 * @param {Readonly<Object>} proposal
 * @param {Readonly<Object>} persistenceRequest
 * @param {string|null} titleHint
 * @param {string|null} sourceIdentifier
 * @returns {Readonly<Object>}
 */
function buildCreateReviewItem(proposal, persistenceRequest, titleHint, sourceIdentifier) {
  return deepFreeze({
    changeKind: RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS.PROPOSED_CREATE,
    lifecycleEvent: proposal.lifecycleEvent,
    proposalType: proposal.proposalType,
    targetMode: persistenceRequest.targetMode,
    titleHint,
    sourceIdentifier,
    reason: proposal.reason,
    advisoryDescription: "Proposed recruitment draft creation"
  });
}

/**
 * @param {Readonly<Object>} proposal
 * @param {Readonly<Object>} persistenceRequest
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {string|null} titleHint
 * @param {string|null} sourceIdentifier
 * @returns {Readonly<Object>}
 */
function buildUpdateReviewItem(
  proposal,
  persistenceRequest,
  detectedUpdateContext,
  titleHint,
  sourceIdentifier
) {
  const updateType =
    isPlainObject(detectedUpdateContext) && typeof detectedUpdateContext.updateType === "string"
      ? detectedUpdateContext.updateType
      : null;

  return deepFreeze({
    changeKind: RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS.PROPOSED_UPDATE,
    lifecycleEvent: proposal.lifecycleEvent,
    proposalType: proposal.proposalType,
    targetMode: persistenceRequest.targetMode,
    updateType,
    titleHint,
    sourceIdentifier,
    reason: proposal.reason,
    advisoryDescription: "Proposed recruitment draft lifecycle update"
  });
}

/**
 * @param {Readonly<Object>} proposal
 * @param {Readonly<Object>} persistenceRequest
 * @returns {Readonly<Object>}
 */
function buildManualReviewItem(proposal, persistenceRequest) {
  return deepFreeze({
    changeKind: RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS.MANUAL_REVIEW,
    lifecycleEvent: proposal.lifecycleEvent,
    proposalType: proposal.proposalType,
    targetMode: persistenceRequest.targetMode,
    reason: proposal.reason,
    advisoryDescription: "Manual review required before draft action"
  });
}

/**
 * @param {string} operation
 * @param {Readonly<Object>} proposal
 * @param {Readonly<Object>} persistenceRequest
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {string|null} titleHint
 * @param {string|null} sourceIdentifier
 * @returns {Readonly<Array>}
 */
function buildReviewItems(
  operation,
  proposal,
  persistenceRequest,
  detectedUpdateContext,
  titleHint,
  sourceIdentifier
) {
  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST) {
    return deepFreeze([
      buildCreateReviewItem(proposal, persistenceRequest, titleHint, sourceIdentifier)
    ]);
  }

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST) {
    return deepFreeze([
      buildUpdateReviewItem(
        proposal,
        persistenceRequest,
        detectedUpdateContext,
        titleHint,
        sourceIdentifier
      )
    ]);
  }

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST) {
    return deepFreeze([buildManualReviewItem(proposal, persistenceRequest)]);
  }

  return deepFreeze([]);
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildReviewPackageResult(params) {
  return deepFreeze({
    reviewStatus: params.reviewStatus,
    action: params.action,
    lifecycleEvent: params.lifecycleEvent,
    proposalType: params.proposalType,
    persistenceOperation: params.persistenceOperation,
    approvalStatus: params.approvalStatus,
    confidence: params.confidence,
    titleHint: params.titleHint ?? null,
    sourceIdentifier: params.sourceIdentifier ?? null,
    reviewItems: params.reviewItems,
    requiresHumanReview: params.requiresHumanReview === true,
    reviewerDecisionRequired: params.reviewerDecisionRequired === true,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * @returns {Readonly<Object>}
 */
function buildEmptyReviewPackage() {
  return buildReviewPackageResult({
    reviewStatus: RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED,
    action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
    lifecycleEvent: "UNKNOWN",
    proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
    persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST,
    approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
    confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
    titleHint: null,
    sourceIdentifier: null,
    reviewItems: deepFreeze([]),
    requiresHumanReview: true,
    reviewerDecisionRequired: true
  });
}

/**
 * @param {boolean} proposalRequiresReview
 * @param {boolean} persistenceRequiresApproval
 * @param {boolean} approvalRequiresHumanAction
 * @param {string} operation
 * @returns {boolean}
 */
function resolveRequiresHumanReview(
  proposalRequiresReview,
  persistenceRequiresApproval,
  approvalRequiresHumanAction,
  operation
) {
  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST) {
    return false;
  }

  return (
    proposalRequiresReview === true ||
    persistenceRequiresApproval === true ||
    approvalRequiresHumanAction === true
  );
}

/**
 * Convert Phase 114-116 outputs into a structured human review package.
 * Never throws. Never mutates input. Never creates drafts or queries databases.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function createRecruitmentDraftReviewPackage(context) {
  try {
    const draftProposal = resolveDraftProposal(context);
    const persistenceRequest = resolvePersistenceRequest(context);
    const approvalDecision = resolveApprovalDecision(context);

    if (!draftProposal || !persistenceRequest || !approvalDecision) {
      return buildEmptyReviewPackage();
    }

    const operation = persistenceRequest.operation;
    const reviewStatus = OPERATION_TO_REVIEW_STATUS[operation];
    if (!reviewStatus) {
      return buildEmptyReviewPackage();
    }

    const sourceContext = isPlainObject(context) ? context.sourceContext : null;
    const detectedUpdateContext = isPlainObject(context) ? context.detectedUpdateContext : null;
    const payload = persistenceRequest.payload;

    const titleHint = resolveTitleHint(sourceContext, detectedUpdateContext, payload);
    const sourceIdentifier = resolveSourceIdentifier(
      sourceContext,
      detectedUpdateContext,
      payload
    );

    const reviewItems = buildReviewItems(
      operation,
      draftProposal,
      persistenceRequest,
      detectedUpdateContext,
      titleHint,
      sourceIdentifier
    );

    return buildReviewPackageResult({
      reviewStatus,
      action: draftProposal.action,
      lifecycleEvent: draftProposal.lifecycleEvent,
      proposalType: draftProposal.proposalType,
      persistenceOperation: operation,
      approvalStatus: approvalDecision.approvalStatus,
      confidence: draftProposal.confidence,
      titleHint,
      sourceIdentifier,
      reviewItems,
      requiresHumanReview: resolveRequiresHumanReview(
        draftProposal.requiresHumanReview === true,
        persistenceRequest.requiresApproval === true,
        approvalDecision.requiresHumanAction === true,
        operation
      ),
      reviewerDecisionRequired: approvalDecision.reviewerRequired === true
    });
  } catch {
    return buildEmptyReviewPackage();
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDraftReviewPackage(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validReviewStatuses = Object.values(RECRUITMENT_DRAFT_REVIEW_STATUSES);
  const validActions = Object.values(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS);
  const validProposalTypes = Object.values(RECRUITMENT_DRAFT_PROPOSAL_TYPES);
  const validOperations = Object.values(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS);
  const validApprovalStatuses = Object.values(RECRUITMENT_DRAFT_APPROVAL_STATUSES);

  if (
    !validReviewStatuses.includes(value.reviewStatus) ||
    !validActions.includes(value.action) ||
    !validProposalTypes.includes(value.proposalType) ||
    !validOperations.includes(value.persistenceOperation) ||
    !validApprovalStatuses.includes(value.approvalStatus) ||
    typeof value.lifecycleEvent !== "string" ||
    typeof value.confidence !== "string" ||
    typeof value.requiresHumanReview !== "boolean" ||
    typeof value.reviewerDecisionRequired !== "boolean" ||
    !Array.isArray(value.reviewItems)
  ) {
    return false;
  }

  if (value.reviewStatus !== OPERATION_TO_REVIEW_STATUS[value.persistenceOperation]) {
    return false;
  }

  if ((value.titleHint != null && typeof value.titleHint !== "string") ||
    (value.sourceIdentifier != null && typeof value.sourceIdentifier !== "string")) {
    return false;
  }

  for (let i = 0; i < value.reviewItems.length; i += 1) {
    const item = value.reviewItems[i];
    if (!isPlainObject(item) || typeof item.changeKind !== "string") {
      return false;
    }
  }

  if (
    value.persistenceOperation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST &&
    value.reviewItems.length !== 0
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
 * Summarize a recruitment draft review package result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDraftReviewPackage(value) {
  if (!isRecruitmentDraftReviewPackage(value)) {
    return EMPTY_REVIEW_PACKAGE_SUMMARY;
  }

  return Object.freeze({
    reviewStatus: value.reviewStatus,
    action: value.action,
    lifecycleEvent: value.lifecycleEvent,
    proposalType: value.proposalType,
    persistenceOperation: value.persistenceOperation,
    approvalStatus: value.approvalStatus,
    confidence: value.confidence,
    requiresHumanReview: value.requiresHumanReview === true,
    reviewerDecisionRequired: value.reviewerDecisionRequired === true
  });
}

module.exports = {
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_PHASE,
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_ENTITY,
  RECRUITMENT_DRAFT_REVIEW_STATUSES,
  RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS,
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_DESCRIPTOR,
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA,
  EMPTY_REVIEW_PACKAGE_SUMMARY,
  createRecruitmentDraftReviewPackage,
  isRecruitmentDraftReviewPackage,
  summarizeRecruitmentDraftReviewPackage
};
