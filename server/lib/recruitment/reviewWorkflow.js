"use strict";

/**
 * Phase 43 — Review Workflow Architecture (Safe Mode / architecture only).
 *
 * Defines the review item model, status lifecycle, review decisions/actions,
 * validation rules, and pure state transitions for future manual review
 * workflows.
 *
 * Never creates database tables. Never inserts review records. Never uses
 * queues. Never modifies workers. Never modifies runtime persistence.
 * Never enables automation. Never creates admin UI.
 *
 * Transitions are deterministic, side-effect-free descriptions only:
 * executed is always false; architectureOnly is always true;
 * sideEffects is always false. This module supports future manual review
 * workflows but does not execute them.
 */

const REVIEW_WORKFLOW_PHASE = 43;

const REVIEW_WORKFLOW_STATUS = Object.freeze({
  PENDING: "pending",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CANCELLED: "cancelled"
});

const REVIEW_WORKFLOW_ACTIONS = Object.freeze({
  APPROVE: "approve",
  REJECT: "reject",
  REQUEST_CHANGES: "request_changes",
  SKIP: "skip"
});

/**
 * System / lifecycle events that are not reviewer actions.
 * Used by the state machine for future schedulers and operators.
 */
const REVIEW_WORKFLOW_EVENTS = Object.freeze({
  START_REVIEW: "start_review",
  EXPIRE: "expire",
  CANCEL: "cancel"
});

const REVIEW_WORKFLOW_STATUS_VALUES = Object.freeze(
  Object.values(REVIEW_WORKFLOW_STATUS)
);

const REVIEW_WORKFLOW_ACTION_VALUES = Object.freeze(
  Object.values(REVIEW_WORKFLOW_ACTIONS)
);

const REVIEW_WORKFLOW_EVENT_VALUES = Object.freeze(
  Object.values(REVIEW_WORKFLOW_EVENTS)
);

const TERMINAL_STATUSES = Object.freeze([
  REVIEW_WORKFLOW_STATUS.APPROVED,
  REVIEW_WORKFLOW_STATUS.REJECTED,
  REVIEW_WORKFLOW_STATUS.EXPIRED,
  REVIEW_WORKFLOW_STATUS.CANCELLED
]);

const REVIEW_WORKFLOW_VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD: "INVALID_FIELD",
  INVALID_STATUS: "INVALID_STATUS",
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  TERMINAL_STATE: "TERMINAL_STATE"
});

const REQUIRED_REVIEW_ITEM_FIELDS = Object.freeze([
  "reviewId",
  "recruitmentId",
  "eventType",
  "title",
  "status",
  "lastAction",
  "notes",
  "reasons",
  "createdAt",
  "updatedAt",
  "architectureOnly",
  "executed",
  "metadata"
]);

/**
 * Explicit transition table:
 * fromStatus → trigger (action or event) → toStatus
 *
 * trigger keys use action / event string values.
 */
const TRANSITION_TABLE = Object.freeze({
  [REVIEW_WORKFLOW_STATUS.PENDING]: Object.freeze({
    [REVIEW_WORKFLOW_EVENTS.START_REVIEW]: REVIEW_WORKFLOW_STATUS.IN_REVIEW,
    [REVIEW_WORKFLOW_ACTIONS.SKIP]: REVIEW_WORKFLOW_STATUS.IN_REVIEW,
    [REVIEW_WORKFLOW_ACTIONS.APPROVE]: REVIEW_WORKFLOW_STATUS.APPROVED,
    [REVIEW_WORKFLOW_ACTIONS.REJECT]: REVIEW_WORKFLOW_STATUS.REJECTED,
    [REVIEW_WORKFLOW_EVENTS.EXPIRE]: REVIEW_WORKFLOW_STATUS.EXPIRED,
    [REVIEW_WORKFLOW_EVENTS.CANCEL]: REVIEW_WORKFLOW_STATUS.CANCELLED
  }),
  [REVIEW_WORKFLOW_STATUS.IN_REVIEW]: Object.freeze({
    [REVIEW_WORKFLOW_ACTIONS.APPROVE]: REVIEW_WORKFLOW_STATUS.APPROVED,
    [REVIEW_WORKFLOW_ACTIONS.REJECT]: REVIEW_WORKFLOW_STATUS.REJECTED,
    [REVIEW_WORKFLOW_ACTIONS.REQUEST_CHANGES]: REVIEW_WORKFLOW_STATUS.PENDING,
    [REVIEW_WORKFLOW_ACTIONS.SKIP]: REVIEW_WORKFLOW_STATUS.IN_REVIEW,
    [REVIEW_WORKFLOW_EVENTS.EXPIRE]: REVIEW_WORKFLOW_STATUS.EXPIRED,
    [REVIEW_WORKFLOW_EVENTS.CANCEL]: REVIEW_WORKFLOW_STATUS.CANCELLED
  }),
  [REVIEW_WORKFLOW_STATUS.APPROVED]: Object.freeze({}),
  [REVIEW_WORKFLOW_STATUS.REJECTED]: Object.freeze({}),
  [REVIEW_WORKFLOW_STATUS.EXPIRED]: Object.freeze({}),
  [REVIEW_WORKFLOW_STATUS.CANCELLED]: Object.freeze({})
});

/**
 * @typedef {Object} ReviewWorkflowMatchSnapshot
 * @property {boolean|string|null} match
 * @property {string|null} confidence
 * @property {string[]} matchedSignals
 * @property {string[]} conflictingSignals
 */

/**
 * @typedef {Object} ReviewWorkflowItem
 * @property {string|null} reviewId
 * @property {string|null} recruitmentId
 * @property {string|null} eventType
 * @property {string|null} sourceUrl
 * @property {string} title
 * @property {string|null} confidence
 * @property {ReviewWorkflowMatchSnapshot|null} matchResult
 * @property {string} status
 * @property {string|null} lastAction
 * @property {string|null} notes
 * @property {string[]} reasons
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 * @property {Object} metadata
 */

/**
 * @typedef {Object} ReviewWorkflowValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} ReviewWorkflowTransitionPlan
 * @property {boolean} allowed
 * @property {string|null} fromStatus
 * @property {string|null} toStatus
 * @property {string|null} trigger
 * @property {string|null} triggerKind
 * @property {string[]} errors
 * @property {string[]} reasons
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 * @property {boolean} advisory
 * @property {Object} metadata
 */

/**
 * @typedef {Object} ReviewWorkflowDecisionResult
 * @property {boolean} success
 * @property {string[]} errors
 * @property {string[]} reasons
 * @property {ReviewWorkflowItem} item
 * @property {ReviewWorkflowTransitionPlan} transition
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 */

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sortUniqueStrings(values) {
  return [...new Set(values.map((v) => String(v)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function clonePlain(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return { ...value };
}

function cloneStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function cloneMatchResult(value) {
  if (value == null) {
    return null;
  }
  if (!isPlainObject(value)) {
    return null;
  }
  return {
    match: value.match === undefined ? null : value.match,
    confidence:
      value.confidence == null || value.confidence === ""
        ? null
        : String(value.confidence),
    matchedSignals: cloneStringArray(value.matchedSignals),
    conflictingSignals: cloneStringArray(value.conflictingSignals)
  };
}

function cloneReviewWorkflowItem(item) {
  return {
    reviewId: item.reviewId == null ? null : String(item.reviewId),
    recruitmentId:
      item.recruitmentId == null ? null : String(item.recruitmentId),
    eventType: item.eventType == null ? null : String(item.eventType),
    sourceUrl: item.sourceUrl == null ? null : String(item.sourceUrl),
    title: String(item.title ?? ""),
    confidence: item.confidence == null ? null : String(item.confidence),
    matchResult: cloneMatchResult(item.matchResult),
    status: String(item.status),
    lastAction: item.lastAction == null ? null : String(item.lastAction),
    notes: item.notes == null ? null : String(item.notes),
    reasons: cloneStringArray(item.reasons),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    architectureOnly: true,
    executed: false,
    metadata: {
      ...clonePlain(item.metadata),
      sideEffects: false,
      phase: REVIEW_WORKFLOW_PHASE,
      architectureOnly: true,
      executed: false
    }
  };
}

function normalizeOptionalString(value) {
  const text = collapseWhitespace(value);
  return text || null;
}

function normalizeRequiredTitle(value, errors) {
  const text = collapseWhitespace(value);
  if (!text) {
    errors.push("title is required");
    return "";
  }
  return text;
}

function normalizeStatus(value, errors) {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) {
    errors.push("status is required");
    return null;
  }
  if (!REVIEW_WORKFLOW_STATUS_VALUES.includes(text)) {
    errors.push("status is invalid");
    return null;
  }
  return text;
}

function normalizeActionOrNull(value, errors) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const text = collapseWhitespace(value).toLowerCase();
  if (!REVIEW_WORKFLOW_ACTION_VALUES.includes(text)) {
    errors.push("lastAction is invalid");
    return null;
  }
  return text;
}

function normalizeTrigger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const text = collapseWhitespace(value).toLowerCase();
  return text || null;
}

function normalizeTimestamp(value, fieldName, errors, fallback) {
  const text = collapseWhitespace(value);
  if (!text) {
    if (fallback != null) {
      return fallback;
    }
    errors.push(`${fieldName} is required`);
    return null;
  }
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    errors.push(`${fieldName} must be a valid ISO timestamp`);
    return null;
  }
  return new Date(timestamp).toISOString();
}

function normalizeReasons(value) {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return sortUniqueStrings(
    value
      .map((item) => collapseWhitespace(item))
      .filter((item) => item.length > 0)
  );
}

function normalizeMatchResult(value, errors) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isPlainObject(value)) {
    errors.push("matchResult must be an object");
    return null;
  }
  if (!Array.isArray(value.matchedSignals)) {
    errors.push("matchResult.matchedSignals must be an array");
  }
  if (!Array.isArray(value.conflictingSignals)) {
    errors.push("matchResult.conflictingSignals must be an array");
  }
  if (
    errors.some(
      (e) =>
        e === "matchResult.matchedSignals must be an array" ||
        e === "matchResult.conflictingSignals must be an array"
    )
  ) {
    return null;
  }
  return cloneMatchResult(value);
}

function buildMetadata(extras) {
  return {
    sideEffects: false,
    phase: REVIEW_WORKFLOW_PHASE,
    architectureOnly: true,
    executed: false,
    workflowExecutable: false,
    persistenceEnabled: false,
    queueEnqueueEnabled: false,
    automationEnabled: false,
    ...clonePlain(extras)
  };
}

function triggerKindOf(trigger) {
  if (REVIEW_WORKFLOW_ACTION_VALUES.includes(trigger)) {
    return "action";
  }
  if (REVIEW_WORKFLOW_EVENT_VALUES.includes(trigger)) {
    return "event";
  }
  return null;
}

/**
 * @param {string} status
 * @returns {boolean}
 */
function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(String(status ?? "").toLowerCase());
}

/**
 * @param {string} fromStatus
 * @returns {string[]}
 */
function listAllowedTriggers(fromStatus) {
  const status = String(fromStatus ?? "").toLowerCase();
  const row = TRANSITION_TABLE[status];
  if (!row) {
    return [];
  }
  return Object.keys(row).sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} fromStatus
 * @returns {string[]}
 */
function listAllowedActions(fromStatus) {
  return listAllowedTriggers(fromStatus).filter((trigger) =>
    REVIEW_WORKFLOW_ACTION_VALUES.includes(trigger)
  );
}

/**
 * @param {string} fromStatus
 * @param {string} trigger
 * @returns {boolean}
 */
function isTransitionAllowed(fromStatus, trigger) {
  const status = String(fromStatus ?? "").toLowerCase();
  const normalizedTrigger = normalizeTrigger(trigger);
  if (!normalizedTrigger) {
    return false;
  }
  const row = TRANSITION_TABLE[status];
  if (!row) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(row, normalizedTrigger);
}

/**
 * Resolve the target status for a trigger from the current status.
 * Returns null when the transition is not allowed.
 *
 * @param {string} trigger
 * @param {string} [currentStatus]
 * @returns {string|null}
 */
function resolveStatusForTrigger(
  trigger,
  currentStatus = REVIEW_WORKFLOW_STATUS.PENDING
) {
  const status = String(currentStatus ?? "").toLowerCase();
  const normalizedTrigger = normalizeTrigger(trigger);
  if (!normalizedTrigger) {
    return null;
  }
  const row = TRANSITION_TABLE[status];
  if (!row || !Object.prototype.hasOwnProperty.call(row, normalizedTrigger)) {
    return null;
  }
  return row[normalizedTrigger];
}

/**
 * Action-oriented helper (review decisions only).
 *
 * @param {string} action
 * @param {string} [currentStatus]
 * @returns {string|null}
 */
function resolveStatusForAction(
  action,
  currentStatus = REVIEW_WORKFLOW_STATUS.PENDING
) {
  const normalized = normalizeTrigger(action);
  if (!normalized || !REVIEW_WORKFLOW_ACTION_VALUES.includes(normalized)) {
    return null;
  }
  return resolveStatusForTrigger(normalized, currentStatus);
}

function buildValidationResult(errors, reasons) {
  const sortedErrors = sortUniqueStrings(errors);
  const sortedReasons = sortUniqueStrings(reasons);
  return {
    valid: sortedErrors.length === 0,
    errors: sortedErrors,
    reasons:
      sortedErrors.length === 0
        ? [REVIEW_WORKFLOW_VALIDATION_REASONS.VALID]
        : sortedReasons.length > 0
          ? sortedReasons
          : [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_FIELD]
  };
}

/**
 * Create an architecture-only review workflow item.
 * Does not persist, enqueue, or mutate external state.
 *
 * @param {Object} [input]
 * @returns {ReviewWorkflowItem}
 */
function createReviewWorkflowItem(input = {}) {
  const errors = [];
  const source = isPlainObject(input) ? input : {};
  const title = normalizeRequiredTitle(source.title, errors);
  const matchResult = normalizeMatchResult(source.matchResult, errors);
  const createdAt = normalizeTimestamp(
    source.createdAt,
    "createdAt",
    errors,
    new Date(0).toISOString()
  );
  const updatedAt = normalizeTimestamp(
    source.updatedAt,
    "updatedAt",
    errors,
    createdAt
  );

  const statusErrors = [];
  const status =
    source.status === undefined || source.status === null || source.status === ""
      ? REVIEW_WORKFLOW_STATUS.PENDING
      : normalizeStatus(source.status, statusErrors);
  errors.push(...statusErrors);

  const actionErrors = [];
  const lastAction = normalizeActionOrNull(source.lastAction, actionErrors);
  errors.push(...actionErrors);

  const confidence =
    normalizeOptionalString(source.confidence)?.toLowerCase() ??
    (matchResult && matchResult.confidence
      ? String(matchResult.confidence).toLowerCase()
      : null);

  const item = {
    reviewId: normalizeOptionalString(source.reviewId),
    recruitmentId:
      source.recruitmentId == null || source.recruitmentId === ""
        ? null
        : String(source.recruitmentId),
    eventType: normalizeOptionalString(source.eventType)?.toLowerCase() ?? null,
    sourceUrl: normalizeOptionalString(source.sourceUrl),
    title,
    confidence,
    matchResult,
    status: status ?? REVIEW_WORKFLOW_STATUS.PENDING,
    lastAction,
    notes: normalizeOptionalString(source.notes),
    reasons: normalizeReasons(source.reasons),
    createdAt: createdAt ?? new Date(0).toISOString(),
    updatedAt: updatedAt ?? createdAt ?? new Date(0).toISOString(),
    architectureOnly: true,
    executed: false,
    metadata: buildMetadata({
      creationErrors: sortUniqueStrings(errors),
      createdValid: errors.length === 0,
      ...(clonePlain(source.metadata) || {})
    })
  };

  return item;
}

/**
 * @param {ReviewWorkflowItem} item
 * @returns {ReviewWorkflowValidationResult}
 */
function validateReviewWorkflowItem(item) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(item)) {
    return buildValidationResult(
      ["review workflow item must be an object"],
      [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_INPUT]
    );
  }

  for (const field of REQUIRED_REVIEW_ITEM_FIELDS) {
    if (!(field in item)) {
      errors.push(`${field} is required`);
      reasons.push(REVIEW_WORKFLOW_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  normalizeRequiredTitle(item.title, errors);
  normalizeStatus(item.status, errors);
  normalizeActionOrNull(item.lastAction, errors);
  normalizeTimestamp(item.createdAt, "createdAt", errors, null);
  normalizeTimestamp(item.updatedAt, "updatedAt", errors, null);

  if (item.matchResult !== undefined && item.matchResult !== null) {
    normalizeMatchResult(item.matchResult, errors);
  }

  if (!Array.isArray(item.reasons)) {
    errors.push("reasons must be an array");
  }

  if (item.architectureOnly !== true) {
    errors.push("architectureOnly must be true");
  }

  if (item.executed !== false) {
    errors.push("executed must be false");
  }

  if (!isPlainObject(item.metadata)) {
    errors.push("metadata must be an object");
  } else {
    if (item.metadata.sideEffects !== false) {
      errors.push("metadata.sideEffects must be false");
    }
    if (item.metadata.architectureOnly !== true) {
      errors.push("metadata.architectureOnly must be true");
    }
  }

  if (
    item.status &&
    REVIEW_WORKFLOW_STATUS_VALUES.includes(
      String(item.status).toLowerCase()
    ) === false
  ) {
    reasons.push(REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_STATUS);
  }

  if (errors.length > 0 && reasons.length === 0) {
    reasons.push(REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_FIELD);
  }

  return buildValidationResult(errors, reasons);
}

function buildTransitionPlan({
  allowed,
  fromStatus,
  toStatus,
  trigger,
  errors,
  reasons
}) {
  const sortedErrors = sortUniqueStrings(errors);
  const sortedReasons = sortUniqueStrings(reasons);
  const kind = trigger == null ? null : triggerKindOf(trigger);

  return {
    allowed: allowed === true && sortedErrors.length === 0,
    fromStatus: fromStatus == null ? null : String(fromStatus),
    toStatus: toStatus == null ? null : String(toStatus),
    trigger: trigger == null ? null : String(trigger),
    triggerKind: kind,
    errors: sortedErrors,
    reasons: sortedReasons,
    architectureOnly: true,
    executed: false,
    advisory: true,
    metadata: buildMetadata({
      transitionPlanned: true,
      transitionExecuted: false,
      workflowExecutable: false
    })
  };
}

/**
 * Plan a review workflow transition without applying it.
 *
 * @param {ReviewWorkflowItem|Object} item
 * @param {string} trigger - action or system event
 * @returns {ReviewWorkflowTransitionPlan}
 */
function planReviewWorkflowTransition(item, trigger) {
  if (!isPlainObject(item)) {
    return buildTransitionPlan({
      allowed: false,
      fromStatus: null,
      toStatus: null,
      trigger: normalizeTrigger(trigger),
      errors: ["review workflow item must be an object"],
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_INPUT]
    });
  }

  const fromStatus = String(item.status ?? "").toLowerCase();
  const normalizedTrigger = normalizeTrigger(trigger);

  if (!normalizedTrigger) {
    return buildTransitionPlan({
      allowed: false,
      fromStatus: fromStatus || null,
      toStatus: null,
      trigger: null,
      errors: ["trigger is required"],
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_ACTION]
    });
  }

  if (triggerKindOf(normalizedTrigger) == null) {
    return buildTransitionPlan({
      allowed: false,
      fromStatus: fromStatus || null,
      toStatus: null,
      trigger: normalizedTrigger,
      errors: ["trigger is invalid"],
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_ACTION]
    });
  }

  if (!REVIEW_WORKFLOW_STATUS_VALUES.includes(fromStatus)) {
    return buildTransitionPlan({
      allowed: false,
      fromStatus: fromStatus || null,
      toStatus: null,
      trigger: normalizedTrigger,
      errors: ["status is invalid"],
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_STATUS]
    });
  }

  if (isTerminalStatus(fromStatus)) {
    return buildTransitionPlan({
      allowed: false,
      fromStatus,
      toStatus: null,
      trigger: normalizedTrigger,
      errors: ["review item is in a terminal status"],
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.TERMINAL_STATE]
    });
  }

  if (!isTransitionAllowed(fromStatus, normalizedTrigger)) {
    return buildTransitionPlan({
      allowed: false,
      fromStatus,
      toStatus: null,
      trigger: normalizedTrigger,
      errors: [
        `transition not allowed: ${fromStatus} + ${normalizedTrigger}`
      ],
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_TRANSITION]
    });
  }

  const toStatus = resolveStatusForTrigger(normalizedTrigger, fromStatus);
  return buildTransitionPlan({
    allowed: true,
    fromStatus,
    toStatus,
    trigger: normalizedTrigger,
    errors: [],
    reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.VALID]
  });
}

/**
 * Apply a review decision/action or system event to a cloned item model.
 * Pure and architecture-only: never persists, enqueues, or mutates input.
 *
 * @param {ReviewWorkflowItem|Object} item
 * @param {string} trigger
 * @param {Object} [options]
 * @param {string} [options.notes]
 * @param {string} [options.updatedAt]
 * @returns {ReviewWorkflowDecisionResult}
 */
function applyReviewWorkflowDecision(item, trigger, options = {}) {
  const opts = isPlainObject(options) ? options : {};
  const transition = planReviewWorkflowTransition(item, trigger);

  if (!isPlainObject(item)) {
    return {
      success: false,
      errors: transition.errors,
      reasons: transition.reasons,
      item: /** @type {ReviewWorkflowItem} */ ({
        reviewId: null,
        recruitmentId: null,
        eventType: null,
        sourceUrl: null,
        title: "",
        confidence: null,
        matchResult: null,
        status: REVIEW_WORKFLOW_STATUS.PENDING,
        lastAction: null,
        notes: null,
        reasons: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        architectureOnly: true,
        executed: false,
        metadata: buildMetadata()
      }),
      transition,
      architectureOnly: true,
      executed: false
    };
  }

  const validation = validateReviewWorkflowItem(item);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      reasons: validation.reasons,
      item: cloneReviewWorkflowItem(item),
      transition: buildTransitionPlan({
        allowed: false,
        fromStatus: item.status == null ? null : String(item.status),
        toStatus: null,
        trigger: normalizeTrigger(trigger),
        errors: validation.errors,
        reasons: validation.reasons
      }),
      architectureOnly: true,
      executed: false
    };
  }

  if (!transition.allowed) {
    return {
      success: false,
      errors: transition.errors,
      reasons: transition.reasons,
      item: cloneReviewWorkflowItem(item),
      transition,
      architectureOnly: true,
      executed: false
    };
  }

  const updated = cloneReviewWorkflowItem(item);
  updated.status = transition.toStatus;
  updated.lastAction = REVIEW_WORKFLOW_ACTION_VALUES.includes(transition.trigger)
    ? transition.trigger
    : item.lastAction == null
      ? null
      : String(item.lastAction);

  if (opts.notes !== undefined) {
    updated.notes = normalizeOptionalString(opts.notes);
  }

  const updatedAtErrors = [];
  updated.updatedAt = normalizeTimestamp(
    opts.updatedAt,
    "updatedAt",
    updatedAtErrors,
    item.updatedAt
  );
  if (updatedAtErrors.length > 0) {
    return {
      success: false,
      errors: sortUniqueStrings(updatedAtErrors),
      reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_FIELD],
      item: cloneReviewWorkflowItem(item),
      transition: buildTransitionPlan({
        allowed: false,
        fromStatus: transition.fromStatus,
        toStatus: null,
        trigger: transition.trigger,
        errors: updatedAtErrors,
        reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.INVALID_FIELD]
      }),
      architectureOnly: true,
      executed: false
    };
  }

  updated.architectureOnly = true;
  updated.executed = false;
  updated.metadata = buildMetadata({
    ...clonePlain(updated.metadata),
    lastTrigger: transition.trigger,
    lastTriggerKind: transition.triggerKind,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    transitionExecuted: false,
    decisionAppliedInMemoryOnly: true
  });

  return {
    success: true,
    errors: [],
    reasons: [REVIEW_WORKFLOW_VALIDATION_REASONS.VALID],
    item: updated,
    transition,
    architectureOnly: true,
    executed: false
  };
}

/**
 * Guard: confirm a review workflow value never records execution or
 * side effects.
 *
 * @param {Object} value
 * @returns {boolean}
 */
function isReviewWorkflowArchitectureOnly(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (value.architectureOnly !== true || value.executed !== false) {
    return false;
  }

  if (isPlainObject(value.metadata)) {
    if (value.metadata.sideEffects !== false) {
      return false;
    }
    if (value.metadata.architectureOnly !== true) {
      return false;
    }
    if (value.metadata.persistenceEnabled === true) {
      return false;
    }
    if (value.metadata.queueEnqueueEnabled === true) {
      return false;
    }
    if (value.metadata.automationEnabled === true) {
      return false;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "advisory") &&
    value.advisory !== true
  ) {
    return false;
  }

  return true;
}

module.exports = {
  REVIEW_WORKFLOW_PHASE,
  REVIEW_WORKFLOW_STATUS,
  REVIEW_WORKFLOW_ACTIONS,
  REVIEW_WORKFLOW_EVENTS,
  REVIEW_WORKFLOW_STATUS_VALUES,
  REVIEW_WORKFLOW_ACTION_VALUES,
  REVIEW_WORKFLOW_EVENT_VALUES,
  TERMINAL_STATUSES,
  TRANSITION_TABLE,
  REQUIRED_REVIEW_ITEM_FIELDS,
  REVIEW_WORKFLOW_VALIDATION_REASONS,
  createReviewWorkflowItem,
  validateReviewWorkflowItem,
  isTerminalStatus,
  listAllowedTriggers,
  listAllowedActions,
  isTransitionAllowed,
  resolveStatusForTrigger,
  resolveStatusForAction,
  planReviewWorkflowTransition,
  applyReviewWorkflowDecision,
  isReviewWorkflowArchitectureOnly
};
