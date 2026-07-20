"use strict";

/**
 * Phase 114 — Recruitment Draft Proposal Engine.
 *
 * Pure read-only draft proposal engine that consumes pre-composed advisory outputs
 * and produces architecture-only draft action recommendations without database access,
 * draft creation, publishing, coordinator invocation, or pipeline mutations.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const RECRUITMENT_DRAFT_PROPOSAL_ENGINE_PHASE = 114;

const RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY = "recruitment_draft_proposal_engine";

const RECRUITMENT_DRAFT_PROPOSAL_ACTIONS = Object.freeze({
  CREATE_DRAFT: "CREATE_DRAFT",
  UPDATE_DRAFT: "UPDATE_DRAFT",
  HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED",
  NO_ACTION: "NO_ACTION"
});

const RECRUITMENT_DRAFT_PROPOSAL_TYPES = Object.freeze({
  NEW_RECRUITMENT_DRAFT: "NEW_RECRUITMENT_DRAFT",
  RECRUITMENT_LIFECYCLE_UPDATE: "RECRUITMENT_LIFECYCLE_UPDATE",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  NONE: "NONE"
});

const RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES = Object.freeze({
  DRAFT_CREATE: "DRAFT_CREATE",
  DRAFT_UPDATE: "DRAFT_UPDATE",
  MANUAL: "MANUAL",
  NONE: "NONE"
});

const RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "none"
});

const RECRUITMENT_DRAFT_PROPOSAL_REASONS = Object.freeze({
  ROLLOUT_NOT_READY: "ROLLOUT_NOT_READY",
  LIFECYCLE_UNKNOWN: "LIFECYCLE_UNKNOWN",
  NOTIFICATION_WITHOUT_PAGE: "NOTIFICATION_WITHOUT_PAGE",
  EXISTING_RECRUITMENT_UPDATE: "EXISTING_RECRUITMENT_UPDATE",
  WORKFLOW_COMPLETED: "WORKFLOW_COMPLETED",
  INSUFFICIENT_CONTEXT: "INSUFFICIENT_CONTEXT",
  INVALID_INPUT: "INVALID_INPUT"
});

/**
 * Advisory lifecycle vocabulary aligned with Phase 95 (no import).
 */
const ADVISORY_LIFECYCLE_EVENTS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  NOTIFICATION: "NOTIFICATION",
  APPLICATION: "APPLICATION",
  APPLICATION_CORRECTION: "APPLICATION_CORRECTION",
  EXAM_CITY: "EXAM_CITY",
  ADMIT_CARD: "ADMIT_CARD",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  FINAL_RESULT: "FINAL_RESULT",
  COUNSELLING: "COUNSELLING",
  DOCUMENT_VERIFICATION: "DOCUMENT_VERIFICATION",
  JOINING: "JOINING",
  COMPLETED: "COMPLETED"
});

const RECRUITMENT_LIFECYCLE_EVENT_SET = Object.freeze(
  new Set(Object.values(ADVISORY_LIFECYCLE_EVENTS))
);

const ROLLOUT_READINESS_READY = "READY";

const RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA = Object.freeze({
  phase: RECRUITMENT_DRAFT_PROPOSAL_ENGINE_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  draftProposalOnly: true,
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
  sourcePhases: Object.freeze([113])
});

const RECRUITMENT_DRAFT_PROPOSAL_ENGINE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DRAFT_PROPOSAL_ENGINE_PHASE,
  description:
    "Read-only draft proposal engine projecting advisory workflow outputs into draft action recommendations.",
  metadata: RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA
});

const ACTION_TO_PROPOSAL_TYPE = Object.freeze({
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT]:
    RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT]:
    RECRUITMENT_DRAFT_PROPOSAL_TYPES.RECRUITMENT_LIFECYCLE_UPDATE,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED]:
    RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION]: RECRUITMENT_DRAFT_PROPOSAL_TYPES.NONE
});

const ACTION_TO_TARGET_MODE = Object.freeze({
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT]:
    RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_CREATE,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT]:
    RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_UPDATE,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED]:
    RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.MANUAL,
  [RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION]: RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.NONE
});

const EMPTY_DRAFT_PROPOSAL_SUMMARY = Object.freeze({
  action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
  proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
  lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
  confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
  reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT,
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
 * @returns {string}
 */
function resolveLifecycleEvent(context) {
  if (!isPlainObject(context)) {
    return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
  }

  if (typeof context.lifecycle === "string" && RECRUITMENT_LIFECYCLE_EVENT_SET.has(context.lifecycle)) {
    return context.lifecycle;
  }

  if (isPlainObject(context.lifecycle) && typeof context.lifecycle.event === "string") {
    const event = context.lifecycle.event;
    if (RECRUITMENT_LIFECYCLE_EVENT_SET.has(event)) {
      return event;
    }
  }

  const health = context.health;
  if (isPlainObject(health) && typeof health.lifecycle === "string") {
    if (RECRUITMENT_LIFECYCLE_EVENT_SET.has(health.lifecycle)) {
      return health.lifecycle;
    }
  }

  const rolloutReadiness = context.rolloutReadiness;
  if (isPlainObject(rolloutReadiness) && typeof rolloutReadiness.lifecycle === "string") {
    if (RECRUITMENT_LIFECYCLE_EVENT_SET.has(rolloutReadiness.lifecycle)) {
      return rolloutReadiness.lifecycle;
    }
  }

  const workflowGateway = context.workflowGateway;
  if (isPlainObject(workflowGateway) && isPlainObject(workflowGateway.recommendation)) {
    const lifecycle = workflowGateway.recommendation.lifecycle;
    if (typeof lifecycle === "string" && RECRUITMENT_LIFECYCLE_EVENT_SET.has(lifecycle)) {
      return lifecycle;
    }
  }

  return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
}

/**
 * @param {Readonly<Object>|null|undefined} context
 * @returns {string|null}
 */
function resolveRolloutStatus(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  const rolloutReadiness = context.rolloutReadiness;
  if (isPlainObject(rolloutReadiness) && typeof rolloutReadiness.status === "string") {
    return rolloutReadiness.status;
  }

  return null;
}

/**
 * @param {Readonly<Object>|null|undefined} context
 * @param {string} lifecycleEvent
 * @returns {boolean}
 */
function resolveWorkflowCompleted(context, lifecycleEvent) {
  if (lifecycleEvent === ADVISORY_LIFECYCLE_EVENTS.COMPLETED) {
    return true;
  }

  if (!isPlainObject(context)) {
    return false;
  }

  const health = context.health;
  if (isPlainObject(health) && health.workflowCompleted === true) {
    return true;
  }

  const workflowGateway = context.workflowGateway;
  if (
    isPlainObject(workflowGateway) &&
    isPlainObject(workflowGateway.recommendation) &&
    workflowGateway.recommendation.workflowCompleted === true
  ) {
    return true;
  }

  if (isPlainObject(context.lifecycle) && context.lifecycle.workflowCompleted === true) {
    return true;
  }

  return false;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function hasExistingPageContext(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (value.exists === true) {
    return true;
  }

  if (typeof value.pageId === "string" && value.pageId.length > 0) {
    return true;
  }

  if (typeof value.slug === "string" && value.slug.length > 0) {
    return true;
  }

  if (value.recruitmentId != null) {
    return true;
  }

  return false;
}

/**
 * @param {string} lifecycleEvent
 * @returns {boolean}
 */
function isRecruitmentLifecycleEvent(lifecycleEvent) {
  return (
    lifecycleEvent !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN &&
    lifecycleEvent !== ADVISORY_LIFECYCLE_EVENTS.COMPLETED &&
    RECRUITMENT_LIFECYCLE_EVENT_SET.has(lifecycleEvent)
  );
}

/**
 * @param {string} action
 * @param {string} reason
 * @param {boolean} hasDetectedUpdate
 * @returns {string}
 */
function resolveConfidence(action, reason, hasDetectedUpdate) {
  if (action === RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION) {
    return RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE;
  }

  if (action === RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED) {
    return RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.LOW;
  }

  if (
    action === RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT &&
    hasDetectedUpdate &&
    reason === RECRUITMENT_DRAFT_PROPOSAL_REASONS.EXISTING_RECRUITMENT_UPDATE
  ) {
    return RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH;
  }

  if (
    action === RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT &&
    reason === RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE
  ) {
    return RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH;
  }

  return RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.MEDIUM;
}

/**
 * @param {Readonly<Object>|null|undefined} context
 * @returns {Readonly<{ action: string, reason: string, requiresHumanReview: boolean }>}
 */
function resolveDraftProposalDecision(context) {
  if (!isPlainObject(context)) {
    return Object.freeze({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT,
      requiresHumanReview: true
    });
  }

  const rolloutStatus = resolveRolloutStatus(context);
  const lifecycleEvent = resolveLifecycleEvent(context);
  const workflowCompleted = resolveWorkflowCompleted(context, lifecycleEvent);
  const pageExists = hasExistingPageContext(context.existingPageContext);
  const hasDetectedUpdate = isPlainObject(context.detectedUpdateContext);

  if (rolloutStatus !== ROLLOUT_READINESS_READY) {
    return Object.freeze({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY,
      requiresHumanReview: true
    });
  }

  if (workflowCompleted) {
    return Object.freeze({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.WORKFLOW_COMPLETED,
      requiresHumanReview: false
    });
  }

  if (lifecycleEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return Object.freeze({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.LIFECYCLE_UNKNOWN,
      requiresHumanReview: true
    });
  }

  if (lifecycleEvent === ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION && !pageExists) {
    return Object.freeze({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE,
      requiresHumanReview: false
    });
  }

  if (isRecruitmentLifecycleEvent(lifecycleEvent) && pageExists) {
    return Object.freeze({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.EXISTING_RECRUITMENT_UPDATE,
      requiresHumanReview: false
    });
  }

  return Object.freeze({
    action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
    reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INSUFFICIENT_CONTEXT,
    requiresHumanReview: true
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildDraftProposalResult(params) {
  return deepFreeze({
    action: params.action,
    proposalType: ACTION_TO_PROPOSAL_TYPE[params.action],
    lifecycleEvent: params.lifecycleEvent,
    confidence: params.confidence,
    reason: params.reason,
    requiresHumanReview: params.requiresHumanReview === true,
    targetMode: ACTION_TO_TARGET_MODE[params.action],
    source: RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Produce a read-only recruitment draft proposal from advisory context.
 * Never throws. Never mutates input. Never writes drafts or queries databases.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function createRecruitmentDraftProposal(context) {
  try {
    const lifecycleEvent = resolveLifecycleEvent(context);
    const decision = resolveDraftProposalDecision(context);
    const hasDetectedUpdate = isPlainObject(context) && isPlainObject(context.detectedUpdateContext);

    return buildDraftProposalResult({
      action: decision.action,
      lifecycleEvent,
      confidence: resolveConfidence(decision.action, decision.reason, hasDetectedUpdate),
      reason: decision.reason,
      requiresHumanReview: decision.requiresHumanReview
    });
  } catch {
    return buildDraftProposalResult({
      action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED,
      lifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
      confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE,
      reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT,
      requiresHumanReview: true
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDraftProposal(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validActions = Object.values(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS);
  const validProposalTypes = Object.values(RECRUITMENT_DRAFT_PROPOSAL_TYPES);

  if (
    !validActions.includes(value.action) ||
    !validProposalTypes.includes(value.proposalType) ||
    typeof value.lifecycleEvent !== "string" ||
    typeof value.confidence !== "string" ||
    typeof value.reason !== "string" ||
    typeof value.requiresHumanReview !== "boolean" ||
    typeof value.targetMode !== "string" ||
    typeof value.source !== "string"
  ) {
    return false;
  }

  if (value.proposalType !== ACTION_TO_PROPOSAL_TYPE[value.action]) {
    return false;
  }

  if (value.targetMode !== ACTION_TO_TARGET_MODE[value.action]) {
    return false;
  }

  return (
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false &&
    value.source === RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY
  );
}

/**
 * Summarize a recruitment draft proposal result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDraftProposal(value) {
  if (!isRecruitmentDraftProposal(value)) {
    return EMPTY_DRAFT_PROPOSAL_SUMMARY;
  }

  return Object.freeze({
    action: value.action,
    proposalType: value.proposalType,
    lifecycleEvent: value.lifecycleEvent,
    confidence: value.confidence,
    reason: value.reason,
    requiresHumanReview: value.requiresHumanReview === true
  });
}

module.exports = {
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_PHASE,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY,
  RECRUITMENT_DRAFT_PROPOSAL_ACTIONS,
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE,
  RECRUITMENT_DRAFT_PROPOSAL_REASONS,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_DESCRIPTOR,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA,
  EMPTY_DRAFT_PROPOSAL_SUMMARY,
  createRecruitmentDraftProposal,
  isRecruitmentDraftProposal,
  summarizeRecruitmentDraftProposal
};
