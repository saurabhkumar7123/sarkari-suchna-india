"use strict";

/**
 * Phase 84 — Recruitment Relationship Validation Layer (Read-only).
 *
 * Pure library that validates relationship suggestions produced by Phase 83.
 * Evaluates relationship structure only — does not create, store, or apply
 * relationships, resolve missing data, or access a database.
 *
 * Accepts a Phase 83 relationship resolution result and returns an immutable
 * validation result with per-relationship statuses.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE = 84;

const RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY = "recruitment_relationship_validation";

/**
 * Supported relationship types (Phase 83 vocabulary, inline).
 */
const RELATIONSHIP_TYPES = Object.freeze({
  PRIMARY: "PRIMARY",
  RELATED_EVENT: "RELATED_EVENT",
  PREVIOUS_VERSION: "PREVIOUS_VERSION",
  NEXT_VERSION: "NEXT_VERSION",
  UNKNOWN: "UNKNOWN"
});

const SUPPORTED_RELATIONSHIP_TYPES = Object.freeze(
  new Set(Object.values(RELATIONSHIP_TYPES))
);

const RELATIONSHIP_TYPE_LIST = Object.freeze(Object.values(RELATIONSHIP_TYPES));

/**
 * Descriptive confidence levels (Phase 83 vocabulary, inline).
 */
const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const SUPPORTED_CONFIDENCE_LEVELS = Object.freeze(
  new Set(Object.values(CONFIDENCE_LEVELS))
);

const LOW_CONFIDENCE_LEVELS = Object.freeze(
  new Set([CONFIDENCE_LEVELS.LOW, CONFIDENCE_LEVELS.UNKNOWN])
);

const RELATIONSHIP_VALIDATION_REASONS = Object.freeze({
  MISSING_SOURCE: "MISSING_SOURCE",
  MISSING_TARGET: "MISSING_TARGET",
  INVALID_RELATIONSHIP_TYPE: "INVALID_RELATIONSHIP_TYPE",
  INVALID_CONFIDENCE: "INVALID_CONFIDENCE",
  SELF_RELATIONSHIP: "SELF_RELATIONSHIP",
  DUPLICATE_RELATIONSHIP: "DUPLICATE_RELATIONSHIP",
  CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE",
  LOW_CONFIDENCE_REVIEW: "LOW_CONFIDENCE_REVIEW",
  INVALID_RESOLUTION_INPUT: "INVALID_RESOLUTION_INPUT"
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "VALID",
  INVALID: "INVALID",
  REVIEW_REQUIRED: "REVIEW_REQUIRED"
});

const SUPPORTED_VALIDATION_STATUSES = Object.freeze(
  new Set(Object.values(VALIDATION_STATUS))
);

const RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsLinking: false,
  mutatesInput: false,
  resolvesMissingData: false,
  fetchesEntities: false,
  appliesRelationships: false,
  validatesStructureOnly: true
});

const RECRUITMENT_RELATIONSHIP_VALIDATOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE,
  description:
    "Immutable structural validation of recruitment relationship suggestions from Phase 83.",
  relationshipTypes: RELATIONSHIP_TYPE_LIST,
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  validationStatuses: Object.freeze(Object.values(VALIDATION_STATUS)),
  metadata: RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA
});

const EMPTY_VALIDATION_SUMMARY = Object.freeze({
  relationshipCount: 0,
  validCount: 0,
  invalidCount: 0,
  reviewRequiredCount: 0
});

const EMPTY_RECRUITMENT_RELATIONSHIP_VALIDATION = deepFreeze({
  valid: false,
  status: VALIDATION_STATUS.INVALID,
  relationshipResults: Object.freeze([]),
  summary: EMPTY_VALIDATION_SUMMARY
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
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

function idsEqual(left, right) {
  if (left == null || right == null) {
    return false;
  }
  return String(left) === String(right);
}

function relationshipKey(source, target, relationshipType) {
  return [String(source ?? ""), String(target ?? ""), String(relationshipType ?? "")].join("|");
}

function compareRelationshipEntries(left, right) {
  const sourceCompare = String(left.source ?? "").localeCompare(String(right.source ?? ""));
  if (sourceCompare !== 0) {
    return sourceCompare;
  }
  const targetCompare = String(left.target ?? "").localeCompare(String(right.target ?? ""));
  if (targetCompare !== 0) {
    return targetCompare;
  }
  return String(left.relationshipType ?? "").localeCompare(String(right.relationshipType ?? ""));
}

function compareSuggestedRelationships(left, right) {
  return compareRelationshipEntries(left, right);
}

/**
 * Inline Phase 83 relationship resolution result shape check.
 * @param {*} value
 * @returns {boolean}
 */
function isRelationshipResolutionInput(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !Array.isArray(value.candidates) ||
    !Array.isArray(value.suggestedRelationships) ||
    typeof value.relationshipCount !== "number" ||
    !isPlainObject(value.confidenceSummary)
  ) {
    return false;
  }

  if (value.relationshipCount !== value.suggestedRelationships.length) {
    return false;
  }

  const summary = value.confidenceSummary;
  if (
    typeof summary.high !== "number" ||
    typeof summary.medium !== "number" ||
    typeof summary.low !== "number" ||
    typeof summary.unknown !== "number" ||
    typeof summary.total !== "number"
  ) {
    return false;
  }

  return true;
}

function hasPresentEndpoint(value) {
  if (value == null) {
    return false;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return true;
  }
  return normalizeString(value) != null;
}

function collectStructuralReasons(relationship) {
  const reasons = [];

  if (!hasPresentEndpoint(relationship.source)) {
    reasons.push(RELATIONSHIP_VALIDATION_REASONS.MISSING_SOURCE);
  }

  if (!hasPresentEndpoint(relationship.target)) {
    reasons.push(RELATIONSHIP_VALIDATION_REASONS.MISSING_TARGET);
  }

  if (
    typeof relationship.relationshipType !== "string" ||
    !SUPPORTED_RELATIONSHIP_TYPES.has(relationship.relationshipType)
  ) {
    reasons.push(RELATIONSHIP_VALIDATION_REASONS.INVALID_RELATIONSHIP_TYPE);
  }

  if (
    typeof relationship.confidence !== "string" ||
    !SUPPORTED_CONFIDENCE_LEVELS.has(relationship.confidence)
  ) {
    reasons.push(RELATIONSHIP_VALIDATION_REASONS.INVALID_CONFIDENCE);
  }

  if (
    hasPresentEndpoint(relationship.source) &&
    hasPresentEndpoint(relationship.target) &&
    idsEqual(relationship.source, relationship.target)
  ) {
    reasons.push(RELATIONSHIP_VALIDATION_REASONS.SELF_RELATIONSHIP);
  }

  return reasons;
}

function buildRelationshipValidationResult(relationship, reasons, status) {
  return deepFreeze({
    source: relationship.source ?? null,
    target: relationship.target ?? null,
    relationshipType:
      typeof relationship.relationshipType === "string" ? relationship.relationshipType : null,
    confidence: typeof relationship.confidence === "string" ? relationship.confidence : null,
    status,
    reasons: Object.freeze(reasons.slice())
  });
}

function resolveRelationshipStatus(reasons) {
  if (reasons.length === 0) {
    return VALIDATION_STATUS.VALID;
  }

  if (
    reasons.some((reason) => reason === RELATIONSHIP_VALIDATION_REASONS.LOW_CONFIDENCE_REVIEW)
  ) {
    return VALIDATION_STATUS.REVIEW_REQUIRED;
  }

  return VALIDATION_STATUS.INVALID;
}

function detectCircularReferenceKeys(relationships) {
  const circularKeys = new Set();

  const previousEdges = new Set();
  const nextEdges = new Set();

  for (let i = 0; i < relationships.length; i += 1) {
    const relationship = relationships[i];
    if (!hasPresentEndpoint(relationship.source) || !hasPresentEndpoint(relationship.target)) {
      continue;
    }

    const key = relationshipKey(
      relationship.source,
      relationship.target,
      relationship.relationshipType
    );
    const reverseKey = relationshipKey(
      relationship.target,
      relationship.source,
      relationship.relationshipType
    );

    if (relationship.relationshipType === RELATIONSHIP_TYPES.PREVIOUS_VERSION) {
      if (previousEdges.has(reverseKey)) {
        circularKeys.add(key);
        circularKeys.add(reverseKey);
      }
      previousEdges.add(key);
    }

    if (relationship.relationshipType === RELATIONSHIP_TYPES.NEXT_VERSION) {
      if (nextEdges.has(reverseKey)) {
        circularKeys.add(key);
        circularKeys.add(reverseKey);
      }
      nextEdges.add(key);
    }
  }

  return circularKeys;
}

function buildValidationSummary(relationshipResults) {
  const summary = {
    relationshipCount: relationshipResults.length,
    validCount: 0,
    invalidCount: 0,
    reviewRequiredCount: 0
  };

  for (let i = 0; i < relationshipResults.length; i += 1) {
    const status = relationshipResults[i].status;
    if (status === VALIDATION_STATUS.VALID) {
      summary.validCount += 1;
    } else if (status === VALIDATION_STATUS.REVIEW_REQUIRED) {
      summary.reviewRequiredCount += 1;
    } else {
      summary.invalidCount += 1;
    }
  }

  return Object.freeze(summary);
}

function resolveOverallStatus(summary) {
  if (summary.invalidCount > 0) {
    return VALIDATION_STATUS.INVALID;
  }
  if (summary.reviewRequiredCount > 0) {
    return VALIDATION_STATUS.REVIEW_REQUIRED;
  }
  return VALIDATION_STATUS.VALID;
}

function validateSuggestedRelationships(suggestedRelationships) {
  const sorted = suggestedRelationships.slice().sort(compareSuggestedRelationships);
  const circularKeys = detectCircularReferenceKeys(sorted);
  const seenKeys = new Set();
  const relationshipResults = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const relationship = sorted[i];
    const reasons = collectStructuralReasons(relationship);

    const key = relationshipKey(
      relationship.source,
      relationship.target,
      relationship.relationshipType
    );

    if (seenKeys.has(key)) {
      reasons.push(RELATIONSHIP_VALIDATION_REASONS.DUPLICATE_RELATIONSHIP);
    } else {
      seenKeys.add(key);
    }

    if (circularKeys.has(key)) {
      reasons.push(RELATIONSHIP_VALIDATION_REASONS.CIRCULAR_REFERENCE);
    }

    const invalidStructuralReasons = reasons.filter(
      (reason) => reason !== RELATIONSHIP_VALIDATION_REASONS.LOW_CONFIDENCE_REVIEW
    );

    if (
      invalidStructuralReasons.length === 0 &&
      LOW_CONFIDENCE_LEVELS.has(relationship.confidence)
    ) {
      reasons.push(RELATIONSHIP_VALIDATION_REASONS.LOW_CONFIDENCE_REVIEW);
    }

    const status = resolveRelationshipStatus(reasons);
    relationshipResults.push(buildRelationshipValidationResult(relationship, reasons, status));
  }

  relationshipResults.sort(compareRelationshipEntries);
  return relationshipResults;
}

/**
 * Validate relationship suggestions from a Phase 83 resolution result.
 * Pure: no I/O, no mutation of input, no linking or persistence.
 *
 * @param {Object|null|undefined} input Phase 83 relationship resolution result
 * @returns {Readonly<Object>}
 */
function validateRecruitmentRelationships(input) {
  if (!isRelationshipResolutionInput(input)) {
    return EMPTY_RECRUITMENT_RELATIONSHIP_VALIDATION;
  }

  const relationshipResults = validateSuggestedRelationships(input.suggestedRelationships);
  const summary = buildValidationSummary(relationshipResults);
  const status = resolveOverallStatus(summary);

  return deepFreeze({
    valid: status === VALIDATION_STATUS.VALID,
    status,
    relationshipResults: Object.freeze(relationshipResults.slice()),
    summary
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRelationshipValidationResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.valid !== "boolean" ||
    typeof value.status !== "string" ||
    !Array.isArray(value.relationshipResults) ||
    !isPlainObject(value.summary)
  ) {
    return false;
  }

  if (!SUPPORTED_VALIDATION_STATUSES.has(value.status)) {
    return false;
  }

  const summary = value.summary;
  if (
    typeof summary.relationshipCount !== "number" ||
    typeof summary.validCount !== "number" ||
    typeof summary.invalidCount !== "number" ||
    typeof summary.reviewRequiredCount !== "number"
  ) {
    return false;
  }

  if (
    summary.relationshipCount !== value.relationshipResults.length ||
    summary.validCount + summary.invalidCount + summary.reviewRequiredCount !==
      summary.relationshipCount
  ) {
    return false;
  }

  for (let i = 0; i < value.relationshipResults.length; i += 1) {
    const entry = value.relationshipResults[i];
    if (!isPlainObject(entry)) {
      return false;
    }
    if (
      !("source" in entry) ||
      !("target" in entry) ||
      !("relationshipType" in entry) ||
      !("confidence" in entry) ||
      typeof entry.status !== "string" ||
      !Array.isArray(entry.reasons)
    ) {
      return false;
    }
    if (!SUPPORTED_VALIDATION_STATUSES.has(entry.status)) {
      return false;
    }
    for (let j = 0; j < entry.reasons.length; j += 1) {
      if (typeof entry.reasons[j] !== "string") {
        return false;
      }
    }
  }

  return true;
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRelationshipValidationResult(result) {
  const reasons = [];

  if (!isRelationshipValidationResult(result)) {
    return deepFreeze({
      valid: false,
      status: VALIDATION_STATUS.INVALID,
      reasons: Object.freeze(["INVALID_RELATIONSHIP_VALIDATION_SHAPE"])
    });
  }

  if (result.valid !== (result.status === VALIDATION_STATUS.VALID)) {
    reasons.push("INVALID_VALID_FLAG");
  }

  const expectedStatus = resolveOverallStatus(result.summary);
  if (result.status !== expectedStatus) {
    reasons.push("INVALID_AGGREGATE_STATUS");
  }

  for (let i = 0; i < result.relationshipResults.length; i += 1) {
    const entry = result.relationshipResults[i];
    const expectedEntryStatus = resolveRelationshipStatus(entry.reasons);
    if (entry.status !== expectedEntryStatus) {
      reasons.push("INVALID_RELATIONSHIP_STATUS");
      break;
    }
  }

  return deepFreeze({
    valid: reasons.length === 0,
    status: reasons.length === 0 ? VALIDATION_STATUS.VALID : VALIDATION_STATUS.INVALID,
    reasons: Object.freeze(reasons.slice())
  });
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeRelationshipValidationResult(result) {
  const validation = validateRelationshipValidationResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE,
      entity: RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY,
      valid: false,
      status: VALIDATION_STATUS.INVALID,
      relationshipCount: 0,
      validCount: 0,
      invalidCount: 0,
      reviewRequiredCount: 0,
      readOnly: true,
      performsLinking: false
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE,
    entity: RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY,
    valid: result.valid,
    status: result.status,
    relationshipCount: result.summary.relationshipCount,
    validCount: result.summary.validCount,
    invalidCount: result.summary.invalidCount,
    reviewRequiredCount: result.summary.reviewRequiredCount,
    readOnly: true,
    performsLinking: false
  });
}

module.exports = {
  RECRUITMENT_RELATIONSHIP_VALIDATOR_PHASE,
  RECRUITMENT_RELATIONSHIP_VALIDATION_ENTITY,
  RELATIONSHIP_TYPES,
  SUPPORTED_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LIST,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  LOW_CONFIDENCE_LEVELS,
  RELATIONSHIP_VALIDATION_REASONS,
  VALIDATION_STATUS,
  SUPPORTED_VALIDATION_STATUSES,
  RECRUITMENT_RELATIONSHIP_VALIDATOR_DESCRIPTOR,
  RECRUITMENT_RELATIONSHIP_VALIDATOR_METADATA,
  EMPTY_RECRUITMENT_RELATIONSHIP_VALIDATION,
  validateRecruitmentRelationships,
  isRelationshipValidationResult,
  validateRelationshipValidationResult,
  summarizeRelationshipValidationResult
};
