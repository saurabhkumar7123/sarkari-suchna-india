"use strict";

/**
 * Phase 22 — deterministic recruitment review queue representation.
 * Pure library: no DB, no network, no runtime wiring in this phase.
 */

const REVIEW_STATUS = Object.freeze({
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  FROZEN: "frozen",
  NEEDS_MATCHING: "needs_matching"
});

const REVIEW_DECISIONS = Object.freeze({
  APPROVE: "approve",
  REJECT: "reject",
  SKIP: "skip",
  NONE: "none"
});

const VALID_EVENT_TYPES = Object.freeze([
  "notification",
  "short_notification",
  "correction",
  "exam_date",
  "city_intimation",
  "admit_card",
  "answer_key",
  "objection",
  "result",
  "final_result",
  "dv",
  "medical",
  "joining",
  "unknown"
]);

const VALID_CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

const VALID_MATCH_VALUES = Object.freeze([true, false, "unknown"]);

const REVIEW_STATUS_VALUES = Object.freeze(Object.values(REVIEW_STATUS));
const REVIEW_DECISION_VALUES = Object.freeze(Object.values(REVIEW_DECISIONS));

/**
 * @typedef {Object} ReviewMatchResult
 * @property {boolean|string} match
 * @property {string} confidence
 * @property {string[]} matchedSignals
 * @property {string[]} conflictingSignals
 */

/**
 * @typedef {Object} ReviewItem
 * @property {number|null} recruitmentId
 * @property {string} eventType
 * @property {ReviewMatchResult|null} matchResult
 * @property {string|null} confidence
 * @property {string|null} sourceUrl
 * @property {string} title
 * @property {string} createdAt
 * @property {string} status
 * @property {string} decision
 * @property {string|null} notes
 * @property {boolean} frozen
 */

/**
 * @typedef {Object} ReviewValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 */

/**
 * @typedef {Object} ReviewOperationResult
 * @property {boolean} success
 * @property {string[]} errors
 * @property {ReviewItem} item
 */

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sortErrors(errors) {
  return [...new Set(errors)].sort((a, b) => a.localeCompare(b));
}

function buildValidationResult(errors) {
  const sorted = sortErrors(errors);
  return {
    valid: sorted.length === 0,
    errors: sorted
  };
}

function normalizeOptionalString(value) {
  const text = collapseWhitespace(value);
  return text || null;
}

function normalizeRequiredString(value, fieldName, errors) {
  const text = collapseWhitespace(value);
  if (!text) {
    errors.push(`${fieldName} is required`);
    return null;
  }
  return text;
}

function normalizeRecruitmentId(value, errors) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push("recruitmentId must be a positive integer");
    return null;
  }
  return id;
}

function normalizeEventType(value, errors) {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) {
    errors.push("eventType is required");
    return null;
  }
  if (!VALID_EVENT_TYPES.includes(text)) {
    errors.push("eventType is invalid");
    return null;
  }
  return text;
}

function normalizeConfidence(value, errors) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const text = collapseWhitespace(value).toLowerCase();
  if (!VALID_CONFIDENCE_LEVELS.includes(text)) {
    errors.push("confidence is invalid");
    return null;
  }
  return text;
}

function normalizeMatchResult(value, errors) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push("matchResult must be an object");
    return null;
  }

  const localErrors = [];
  if (!VALID_MATCH_VALUES.includes(value.match)) {
    localErrors.push("matchResult.match is invalid");
  }

  const confidence = normalizeConfidence(value.confidence, localErrors);
  if (value.confidence !== undefined && value.confidence !== null && value.confidence !== "" && !confidence) {
    localErrors.push("matchResult.confidence is invalid");
  }

  if (!Array.isArray(value.matchedSignals)) {
    localErrors.push("matchResult.matchedSignals must be an array");
  }
  if (!Array.isArray(value.conflictingSignals)) {
    localErrors.push("matchResult.conflictingSignals must be an array");
  }

  if (localErrors.length > 0) {
    errors.push(...localErrors);
    return null;
  }

  return {
    match: value.match,
    confidence: confidence ?? null,
    matchedSignals: [...value.matchedSignals],
    conflictingSignals: [...value.conflictingSignals]
  };
}

function normalizeCreatedAt(value, errors) {
  const text = collapseWhitespace(value);
  if (!text) {
    errors.push("createdAt is required");
    return null;
  }
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    errors.push("createdAt must be a valid ISO timestamp");
    return null;
  }
  return new Date(timestamp).toISOString();
}

function normalizeStatus(value, errors) {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) {
    errors.push("status is required");
    return null;
  }
  if (!REVIEW_STATUS_VALUES.includes(text)) {
    errors.push("status is invalid");
    return null;
  }
  return text;
}

function normalizeDecision(value, errors) {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) {
    errors.push("decision is required");
    return null;
  }
  if (!REVIEW_DECISION_VALUES.includes(text)) {
    errors.push("decision is invalid");
    return null;
  }
  return text;
}

function validateFrozenState(item, errors) {
  const isFrozenStatus = item.status === REVIEW_STATUS.FROZEN;
  const isFrozenFlag = item.frozen === true;

  if (isFrozenStatus !== isFrozenFlag) {
    errors.push("frozen state is inconsistent");
  }

  if (isFrozenFlag && !Object.isFrozen(item)) {
    errors.push("frozen review item must be immutable");
  }
}

/**
 * Single source of truth for decision → review status mapping.
 * When currentStatus is omitted, defaults to pending (admin persistence path).
 *
 * @param {string} decision
 * @param {string} [currentStatus]
 * @returns {string}
 */
function resolveStatusForDecision(decision, currentStatus = REVIEW_STATUS.PENDING) {
  switch (decision) {
    case REVIEW_DECISIONS.APPROVE:
      return REVIEW_STATUS.APPROVED;
    case REVIEW_DECISIONS.REJECT:
      return REVIEW_STATUS.REJECTED;
    case REVIEW_DECISIONS.SKIP:
      return REVIEW_STATUS.UNDER_REVIEW;
    case REVIEW_DECISIONS.NONE:
    default:
      return currentStatus === REVIEW_STATUS.APPROVED ||
        currentStatus === REVIEW_STATUS.REJECTED ||
        currentStatus === REVIEW_STATUS.UNDER_REVIEW
        ? REVIEW_STATUS.PENDING
        : currentStatus;
  }
}

function cloneReviewItem(item) {
  return {
    ...item,
    matchResult: item.matchResult
      ? {
          ...item.matchResult,
          matchedSignals: [...item.matchResult.matchedSignals],
          conflictingSignals: [...item.matchResult.conflictingSignals]
        }
      : null
  };
}

function deepFreezeReviewItem(item) {
  const frozenMatchResult = item.matchResult
    ? Object.freeze({
        ...item.matchResult,
        matchedSignals: Object.freeze([...item.matchResult.matchedSignals]),
        conflictingSignals: Object.freeze([...item.matchResult.conflictingSignals])
      })
    : null;

  return Object.freeze({
    ...item,
    status: REVIEW_STATUS.FROZEN,
    frozen: true,
    matchResult: frozenMatchResult
  });
}

/**
 * @param {Object} input
 * @returns {ReviewItem}
 */
function createReviewItem(input = {}) {
  const errors = [];
  const title = normalizeRequiredString(input.title, "title", errors);
  const eventType = normalizeEventType(input.eventType, errors);
  const matchResult = normalizeMatchResult(input.matchResult, errors);
  const confidence =
    normalizeConfidence(input.confidence, errors) ?? matchResult?.confidence ?? null;
  const createdAt = input.createdAt
    ? normalizeCreatedAt(input.createdAt, errors)
    : new Date(0).toISOString();

  const item = {
    recruitmentId: normalizeRecruitmentId(input.recruitmentId, errors),
    eventType: eventType ?? "",
    matchResult,
    confidence,
    sourceUrl: normalizeOptionalString(input.sourceUrl),
    title: title ?? "",
    createdAt: createdAt ?? new Date(0).toISOString(),
    status: REVIEW_STATUS.PENDING,
    decision: REVIEW_DECISIONS.NONE,
    notes: normalizeOptionalString(input.notes),
    frozen: false
  };

  if (errors.length > 0) {
    return item;
  }

  return item;
}

/**
 * @param {ReviewItem} item
 * @returns {ReviewValidationResult}
 */
function validateReviewItem(item) {
  const errors = [];

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return buildValidationResult(["review item must be an object"]);
  }

  normalizeRequiredString(item.title, "title", errors);
  normalizeEventType(item.eventType, errors);
  normalizeRecruitmentId(item.recruitmentId, errors);
  normalizeMatchResult(item.matchResult, errors);
  normalizeConfidence(item.confidence, errors);
  normalizeCreatedAt(item.createdAt, errors);
  normalizeStatus(item.status, errors);
  normalizeDecision(item.decision, errors);
  validateFrozenState(item, errors);

  if (item.sourceUrl !== undefined && item.sourceUrl !== null && item.sourceUrl !== "") {
    const sourceUrl = collapseWhitespace(item.sourceUrl);
    if (!sourceUrl) {
      errors.push("sourceUrl must be a non-empty string when provided");
    }
  }

  if (item.notes !== undefined && item.notes !== null && item.notes !== "") {
    const notes = collapseWhitespace(item.notes);
    if (!notes) {
      errors.push("notes must be a non-empty string when provided");
    }
  }

  if (
    item.matchResult &&
    item.confidence &&
    item.matchResult.confidence &&
    item.confidence !== item.matchResult.confidence
  ) {
    errors.push("confidence must match matchResult.confidence when both are present");
  }

  return buildValidationResult(errors);
}

/**
 * @param {ReviewItem} item
 * @param {string} decision
 * @returns {ReviewOperationResult}
 */
function updateReviewDecision(item, decision) {
  const current = item && typeof item === "object" ? item : null;
  if (!current) {
    return {
      success: false,
      errors: ["review item must be an object"],
      item: /** @type {ReviewItem} */ ({})
    };
  }

  const validation = validateReviewItem(current);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      item: current
    };
  }

  if (current.frozen || current.status === REVIEW_STATUS.FROZEN || Object.isFrozen(current)) {
    return {
      success: false,
      errors: ["review item is frozen"],
      item: current
    };
  }

  const decisionErrors = [];
  const normalizedDecision = normalizeDecision(decision, decisionErrors);
  if (decisionErrors.length > 0) {
    return {
      success: false,
      errors: sortErrors(decisionErrors),
      item: current
    };
  }

  const updated = cloneReviewItem(current);
  updated.decision = normalizedDecision;
  updated.status = resolveStatusForDecision(normalizedDecision, current.status);

  return {
    success: true,
    errors: [],
    item: updated
  };
}

/**
 * @param {ReviewItem} item
 * @returns {ReviewOperationResult}
 */
function freezeReviewItem(item) {
  const current = item && typeof item === "object" ? item : null;
  if (!current) {
    return {
      success: false,
      errors: ["review item must be an object"],
      item: /** @type {ReviewItem} */ ({})
    };
  }

  if (current.frozen || current.status === REVIEW_STATUS.FROZEN || Object.isFrozen(current)) {
    return {
      success: false,
      errors: ["review item is already frozen"],
      item: current
    };
  }

  const validation = validateReviewItem(current);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      item: current
    };
  }

  const frozen = deepFreezeReviewItem(cloneReviewItem(current));
  const frozenValidation = validateReviewItem(frozen);
  if (!frozenValidation.valid) {
    return {
      success: false,
      errors: frozenValidation.errors,
      item: current
    };
  }

  return {
    success: true,
    errors: [],
    item: frozen
  };
}

module.exports = {
  REVIEW_STATUS,
  REVIEW_DECISIONS,
  REVIEW_STATUS_VALUES,
  VALID_EVENT_TYPES,
  resolveStatusForDecision,
  createReviewItem,
  validateReviewItem,
  updateReviewDecision,
  freezeReviewItem
};
