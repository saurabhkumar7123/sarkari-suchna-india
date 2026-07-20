"use strict";

/**
 * Phase 115 — Recruitment Draft Persistence Boundary.
 *
 * Pure read-only boundary that converts Phase 114 draft proposals into safe
 * persistence request objects without database access, draft creation, coordinator
 * invocation, pipeline mutations, or any side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  RECRUITMENT_DRAFT_PROPOSAL_ACTIONS,
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE,
  RECRUITMENT_DRAFT_PROPOSAL_REASONS,
  isRecruitmentDraftProposal
} = require("./recruitmentDraftProposalEngine");

const RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_PHASE = 115;

const RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_ENTITY = "recruitment_draft_persistence_boundary";

const RECRUITMENT_DRAFT_PERSISTENCE_ENTITY = "recruitment_draft";

const RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS = Object.freeze({
  CREATE_DRAFT_REQUEST: "CREATE_DRAFT_REQUEST",
  UPDATE_DRAFT_REQUEST: "UPDATE_DRAFT_REQUEST",
  NO_PERSISTENCE_REQUEST: "NO_PERSISTENCE_REQUEST",
  MANUAL_REVIEW_REQUEST: "MANUAL_REVIEW_REQUEST"
});

const PROPOSAL_ACTION_TO_OPERATION = Object.freeze({
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT]:
    RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT]:
    RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION]:
    RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED]:
    RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
});

const RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA = Object.freeze({
  phase: RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  persistenceRequestOnly: true,
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
  sourcePhases: Object.freeze([114])
});

const RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_PHASE,
  description:
    "Read-only persistence boundary projecting Phase 114 draft proposals into safe persistence request objects.",
  metadata: RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA
});

const EMPTY_PERSISTENCE_REQUEST_SUMMARY = Object.freeze({
  operation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST,
  proposalAction: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
  lifecycleEvent: "UNKNOWN",
  requiresApproval: true,
  confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
  reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT
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
 * @param {Readonly<Object>|null|undefined} sourceContext
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @returns {string|null}
 */
function resolveSourceIdentifier(sourceContext, detectedUpdateContext) {
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
    if (typeof detectedUpdateContext.sourceIdentifier === "string") {
      if (detectedUpdateContext.sourceIdentifier.length > 0) {
        return detectedUpdateContext.sourceIdentifier;
      }
    }
  }

  return null;
}

/**
 * @param {Readonly<Object>|null|undefined} sourceContext
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {Readonly<Object>|null|undefined} workflowContext
 * @returns {string|null}
 */
function resolveTitleHint(sourceContext, detectedUpdateContext, workflowContext) {
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

  if (isPlainObject(workflowContext)) {
    if (typeof workflowContext.titleHint === "string" && workflowContext.titleHint.length > 0) {
      return workflowContext.titleHint;
    }
    if (typeof workflowContext.title === "string" && workflowContext.title.length > 0) {
      return workflowContext.title;
    }
  }

  return null;
}

/**
 * @param {Readonly<Object>} proposal
 * @param {Readonly<Object>|null|undefined} sourceContext
 * @param {Readonly<Object>|null|undefined} detectedUpdateContext
 * @param {Readonly<Object>|null|undefined} workflowContext
 * @returns {Readonly<Object>}
 */
function buildSafePayload(proposal, sourceContext, detectedUpdateContext, workflowContext) {
  return deepFreeze({
    lifecycleEvent: proposal.lifecycleEvent,
    proposalType: proposal.proposalType,
    sourceIdentifier: resolveSourceIdentifier(sourceContext, detectedUpdateContext),
    titleHint: resolveTitleHint(sourceContext, detectedUpdateContext, workflowContext),
    actionReason: proposal.reason
  });
}

/**
 * @param {string} operation
 * @returns {string|null}
 */
function resolveEntityForOperation(operation) {
  if (
    operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST ||
    operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST
  ) {
    return RECRUITMENT_DRAFT_PERSISTENCE_ENTITY;
  }

  return null;
}

/**
 * @param {string} operation
 * @param {Readonly<Object>} proposal
 * @returns {boolean}
 */
function resolveRequiresApproval(operation, proposal) {
  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST) {
    return false;
  }

  if (operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST) {
    return true;
  }

  if (proposal.requiresHumanReview === true) {
    return true;
  }

  return (
    operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST ||
    operation === RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST
  );
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildPersistenceRequestResult(params) {
  return deepFreeze({
    operation: params.operation,
    entity: params.entity,
    proposalAction: params.proposalAction,
    lifecycleEvent: params.lifecycleEvent,
    targetMode: params.targetMode,
    payload: params.payload,
    requiresApproval: params.requiresApproval === true,
    confidence: params.confidence,
    reason: params.reason,
    persistenceEnabled: false,
    executed: false,
    advisory: true,
    architectureOnly: true
  });
}

/**
 * @returns {Readonly<Object>}
 */
function buildManualReviewPersistenceRequest() {
  const proposalAction = RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED;
  const operation = RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST;

  return buildPersistenceRequestResult({
    operation,
    entity: resolveEntityForOperation(operation),
    proposalAction,
    lifecycleEvent: "UNKNOWN",
    targetMode: RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.MANUAL,
    payload: deepFreeze({
      lifecycleEvent: "UNKNOWN",
      proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
      sourceIdentifier: null,
      titleHint: null,
      actionReason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT
    }),
    requiresApproval: true,
    confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
    reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT
  });
}

/**
 * Convert a Phase 114 draft proposal into a safe persistence request object.
 * Never throws. Never mutates input. Never writes drafts or queries databases.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function createRecruitmentDraftPersistenceRequest(context) {
  try {
    const proposal = resolveDraftProposal(context);
    if (!proposal) {
      return buildManualReviewPersistenceRequest();
    }

    const operation = PROPOSAL_ACTION_TO_OPERATION[proposal.action];
    if (!operation) {
      return buildManualReviewPersistenceRequest();
    }

    const sourceContext = isPlainObject(context) ? context.sourceContext : null;
    const detectedUpdateContext = isPlainObject(context) ? context.detectedUpdateContext : null;
    const workflowContext = isPlainObject(context) ? context.workflowContext : null;

    return buildPersistenceRequestResult({
      operation,
      entity: resolveEntityForOperation(operation),
      proposalAction: proposal.action,
      lifecycleEvent: proposal.lifecycleEvent,
      targetMode: proposal.targetMode,
      payload: buildSafePayload(proposal, sourceContext, detectedUpdateContext, workflowContext),
      requiresApproval: resolveRequiresApproval(operation, proposal),
      confidence: proposal.confidence,
      reason: proposal.reason
    });
  } catch {
    return buildManualReviewPersistenceRequest();
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDraftPersistenceRequest(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validOperations = Object.values(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS);
  const validActions = Object.values(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS);

  if (
    !validOperations.includes(value.operation) ||
    !validActions.includes(value.proposalAction) ||
    typeof value.lifecycleEvent !== "string" ||
    typeof value.targetMode !== "string" ||
    typeof value.confidence !== "string" ||
    typeof value.reason !== "string" ||
    typeof value.requiresApproval !== "boolean"
  ) {
    return false;
  }

  if (value.operation !== PROPOSAL_ACTION_TO_OPERATION[value.proposalAction]) {
    return false;
  }

  if (!isPlainObject(value.payload)) {
    return false;
  }

  const payload = value.payload;
  if (
    typeof payload.lifecycleEvent !== "string" ||
    typeof payload.proposalType !== "string" ||
    (payload.sourceIdentifier != null && typeof payload.sourceIdentifier !== "string") ||
    (payload.titleHint != null && typeof payload.titleHint !== "string") ||
    typeof payload.actionReason !== "string"
  ) {
    return false;
  }

  const expectedEntity = resolveEntityForOperation(value.operation);
  if (value.entity !== expectedEntity) {
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
 * Summarize a recruitment draft persistence request result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDraftPersistenceRequest(value) {
  if (!isRecruitmentDraftPersistenceRequest(value)) {
    return EMPTY_PERSISTENCE_REQUEST_SUMMARY;
  }

  return Object.freeze({
    operation: value.operation,
    proposalAction: value.proposalAction,
    lifecycleEvent: value.lifecycleEvent,
    requiresApproval: value.requiresApproval === true,
    confidence: value.confidence,
    reason: value.reason
  });
}

module.exports = {
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_PHASE,
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_ENTITY,
  RECRUITMENT_DRAFT_PERSISTENCE_ENTITY,
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS,
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_DESCRIPTOR,
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA,
  EMPTY_PERSISTENCE_REQUEST_SUMMARY,
  createRecruitmentDraftPersistenceRequest,
  isRecruitmentDraftPersistenceRequest,
  summarizeRecruitmentDraftPersistenceRequest
};
