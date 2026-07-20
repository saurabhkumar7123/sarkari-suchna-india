"use strict";

/**
 * Phase 83 — Recruitment Relationship Resolver (Read-only).
 *
 * Pure library that analyzes recruitment entity candidates and produces
 * possible relationship suggestions. Descriptive only — does not create
 * real links, fetch data, or mutate input entities.
 *
 * Accepts plain JavaScript objects and returns an immutable resolution result.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE = 83;

const RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY = "recruitment_relationship_resolution";

/**
 * Supported relationship types between recruitment lifecycle entities.
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
 * Descriptive confidence levels for suggested relationships.
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

const RECRUITMENT_ENTITY_TYPE = "recruitment";
const RECRUITMENT_EVENT_ENTITY_TYPE = "recruitment_event";

const RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA = Object.freeze({
  phase: RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsLinking: false,
  mutatesInput: false,
  infersHiddenInformation: false,
  supportsFutureRelationshipEngine: true
});

const RECRUITMENT_RELATIONSHIP_RESOLVER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE,
  description:
    "Immutable descriptive relationship suggestions derived from recruitment entity candidates.",
  relationshipTypes: RELATIONSHIP_TYPE_LIST,
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  metadata: RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_CONFIDENCE_SUMMARY = Object.freeze({
  high: 0,
  medium: 0,
  low: 0,
  unknown: 0,
  total: 0
});

const EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION = deepFreeze({
  candidates: Object.freeze([]),
  suggestedRelationships: Object.freeze([]),
  relationshipCount: 0,
  confidenceSummary: EMPTY_CONFIDENCE_SUMMARY
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

function normalizeEntityId(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return normalizeString(value);
}

function normalizeComparableTitle(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  return normalized
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function buildValidationResult(reasons) {
  const normalizedReasons = Array.isArray(reasons)
    ? reasons.filter((reason) => typeof reason === "string" && reason.trim() !== "")
    : [];

  let status = VALIDATION_STATUS.VALID;
  if (normalizedReasons.length > 0) {
    status =
      normalizedReasons.some((reason) => reason.startsWith("MISSING_")) ||
      normalizedReasons.some((reason) => reason.startsWith("INVALID_"))
        ? VALIDATION_STATUS.INCOMPLETE
        : VALIDATION_STATUS.INVALID;
  }

  return deepFreeze({
    valid: normalizedReasons.length === 0,
    status,
    reasons: Object.freeze(normalizedReasons.slice())
  });
}

/**
 * @param {*} value
 * @returns {string}
 */
function normalizeRelationshipType(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return RELATIONSHIP_TYPES.UNKNOWN;
  }
  if (SUPPORTED_RELATIONSHIP_TYPES.has(normalized)) {
    return normalized;
  }
  const upper = normalized.toUpperCase();
  if (SUPPORTED_RELATIONSHIP_TYPES.has(upper)) {
    return upper;
  }
  return RELATIONSHIP_TYPES.UNKNOWN;
}

/**
 * @param {*} value
 * @returns {string}
 */
function normalizeConfidence(value) {
  if (value == null || value === "") {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0.8) {
      return CONFIDENCE_LEVELS.HIGH;
    }
    if (value >= 0.5) {
      return CONFIDENCE_LEVELS.MEDIUM;
    }
    if (value > 0) {
      return CONFIDENCE_LEVELS.LOW;
    }
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  const normalized = normalizeString(value);
  if (normalized == null) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  const lower = normalized.toLowerCase();
  if (SUPPORTED_CONFIDENCE_LEVELS.has(lower)) {
    return lower;
  }

  return CONFIDENCE_LEVELS.UNKNOWN;
}

/**
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function normalizeMetadata(value) {
  if (!isPlainObject(value)) {
    return Object.freeze({});
  }

  const copy = {};
  const keys = Object.keys(value).sort();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const entry = value[key];
    if (
      entry == null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      copy[key] = entry;
    } else {
      copy[key] = String(entry);
    }
  }
  return Object.freeze(copy);
}

function compareEntityIds(left, right) {
  const leftId = left == null ? null : left.id;
  const rightId = right == null ? null : right.id;

  if (leftId == null && rightId == null) {
    return 0;
  }
  if (leftId == null) {
    return 1;
  }
  if (rightId == null) {
    return -1;
  }

  const leftKey = String(leftId);
  const rightKey = String(rightId);
  if (leftKey < rightKey) {
    return -1;
  }
  if (leftKey > rightKey) {
    return 1;
  }
  return 0;
}

function compareSuggestedRelationships(left, right) {
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

function extractEntityTitle(entity) {
  if (!isPlainObject(entity) || !isPlainObject(entity.metadata)) {
    return null;
  }
  const metadata = entity.metadata;
  return (
    normalizeComparableTitle(
      metadata.title ??
        metadata.name ??
        metadata.recruitment_title ??
        metadata.recruitmentTitle ??
        metadata.label
    ) ?? null
  );
}

function extractRecruitmentIdentifier(entity) {
  if (!isPlainObject(entity)) {
    return null;
  }

  const metadata = isPlainObject(entity.metadata) ? entity.metadata : {};
  const fromMetadata = normalizeEntityId(
    metadata.recruitmentId ??
      metadata.recruitment_id ??
      metadata.parentRecruitmentId ??
      metadata.parent_recruitment_id ??
      metadata.parentId ??
      metadata.parent_id
  );

  if (fromMetadata != null) {
    return fromMetadata;
  }

  if (normalizeString(entity.entityType) === RECRUITMENT_ENTITY_TYPE && entity.id != null) {
    return normalizeEntityId(entity.id);
  }

  return null;
}

function extractYearOrVersion(entity) {
  if (!isPlainObject(entity) || !isPlainObject(entity.metadata)) {
    return null;
  }
  const metadata = entity.metadata;
  const candidate =
    metadata.year ??
    metadata.recruitment_year ??
    metadata.recruitmentYear ??
    metadata.version ??
    metadata.edition;
  if (candidate == null || candidate === "") {
    return null;
  }
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractRelatedEntityId(entity) {
  if (!isPlainObject(entity) || !isPlainObject(entity.metadata)) {
    return null;
  }
  const metadata = entity.metadata;
  return normalizeEntityId(
    metadata.relatedEntityId ??
      metadata.related_entity_id ??
      metadata.relatedTo ??
      metadata.related_to ??
      metadata.targetEntityId ??
      metadata.target_entity_id
  );
}

function extractExplicitRelationshipType(entity) {
  if (!isPlainObject(entity) || !isPlainObject(entity.metadata)) {
    return null;
  }
  const metadata = entity.metadata;
  const candidate =
    metadata.relationshipType ??
    metadata.relationship_type ??
    metadata.relationshipHint ??
    metadata.relationship_hint ??
    metadata.suggestedRelationshipType ??
    metadata.suggested_relationship_type;
  const normalized = normalizeRelationshipType(candidate);
  return normalized === RELATIONSHIP_TYPES.UNKNOWN && candidate == null ? null : normalized;
}

function isRecruitmentEntity(entity) {
  return normalizeString(entity?.entityType) === RECRUITMENT_ENTITY_TYPE;
}

function isRecruitmentEventEntity(entity) {
  return normalizeString(entity?.entityType) === RECRUITMENT_EVENT_ENTITY_TYPE;
}

function idsEqual(left, right) {
  if (left == null || right == null) {
    return false;
  }
  return String(left) === String(right);
}

function buildSuggestion({
  source,
  target,
  relationshipType,
  confidence,
  reason,
  metadata = {}
}) {
  return deepFreeze({
    source,
    target,
    relationshipType: normalizeRelationshipType(relationshipType),
    confidence: normalizeConfidence(confidence),
    reason: normalizeString(reason) ?? "unspecified",
    metadata: normalizeMetadata(metadata)
  });
}

/**
 * Normalize a recruitment entity candidate for relationship analysis.
 *
 * @param {*} entity
 * @returns {Readonly<Object>|null}
 */
function normalizeEntityForRelationship(entity) {
  if (!isPlainObject(entity)) {
    return null;
  }

  const id = normalizeEntityId(entity.id ?? entity.entityId ?? entity.entity_id);
  const entityType = normalizeString(
    entity.entityType ?? entity.entity_type ?? entity.type
  );

  if (id == null && entityType == null) {
    return null;
  }

  return deepFreeze({
    id,
    entityType,
    metadata: normalizeMetadata(entity.metadata)
  });
}

function normalizeCandidates(entities) {
  if (!Array.isArray(entities)) {
    return [];
  }

  const normalized = [];
  const seenIds = new Set();

  for (let i = 0; i < entities.length; i += 1) {
    const entity = normalizeEntityForRelationship(entities[i]);
    if (entity == null) {
      continue;
    }
    const key = entity.id == null ? `__missing_id_${i}` : String(entity.id);
    if (seenIds.has(key)) {
      continue;
    }
    seenIds.add(key);
    normalized.push(entity);
  }

  normalized.sort(compareEntityIds);
  return normalized;
}

function findEntityById(candidates, entityId) {
  if (entityId == null) {
    return null;
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (idsEqual(candidates[i].id, entityId)) {
      return candidates[i];
    }
  }
  return null;
}

function evaluateExplicitMetadataHints(candidates) {
  const suggestions = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const entity = candidates[i];
    const relatedId = extractRelatedEntityId(entity);
    if (relatedId == null || entity.id == null) {
      continue;
    }

    const relatedEntity = findEntityById(candidates, relatedId);
    if (relatedEntity == null) {
      continue;
    }

    const explicitType = extractExplicitRelationshipType(entity);
    const relationshipType = explicitType ?? RELATIONSHIP_TYPES.UNKNOWN;
    const confidence =
      explicitType != null && explicitType !== RELATIONSHIP_TYPES.UNKNOWN
        ? CONFIDENCE_LEVELS.HIGH
        : CONFIDENCE_LEVELS.MEDIUM;

    suggestions.push(
      buildSuggestion({
        source: entity.id,
        target: relatedId,
        relationshipType,
        confidence,
        reason: "explicit_metadata_related_entity",
        metadata: {
          hintSource: "relatedEntityId",
          originatingEntityId: entity.id
        }
      })
    );
  }

  return suggestions;
}

function evaluateRecruitmentEventRelationship(left, right) {
  const recruitment = isRecruitmentEntity(left) ? left : isRecruitmentEntity(right) ? right : null;
  const event = isRecruitmentEventEntity(left)
    ? left
    : isRecruitmentEventEntity(right)
      ? right
      : null;

  if (recruitment == null || event == null) {
    return null;
  }

  const recruitmentId = recruitment.id;
  const eventRecruitmentId = extractRecruitmentIdentifier(event);
  const sharedRecruitmentId =
    recruitmentId != null &&
    eventRecruitmentId != null &&
    idsEqual(recruitmentId, eventRecruitmentId);

  const recruitmentTitle = extractEntityTitle(recruitment);
  const eventTitle = extractEntityTitle(event);
  const sharedTitle =
    recruitmentTitle != null && eventTitle != null && recruitmentTitle === eventTitle;

  const eventType = normalizeString(event.metadata?.eventType ?? event.metadata?.event_type);

  if (sharedRecruitmentId) {
    return buildSuggestion({
      source: recruitment.id,
      target: event.id,
      relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
      confidence: CONFIDENCE_LEVELS.HIGH,
      reason: "matching_recruitment_identifier",
      metadata: {
        recruitmentId: recruitmentId,
        ...(eventType != null ? { eventType } : {})
      }
    });
  }

  if (sharedTitle) {
    return buildSuggestion({
      source: recruitment.id,
      target: event.id,
      relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      reason: "matching_normalized_title",
      metadata: {
        normalizedTitle: recruitmentTitle,
        ...(eventType != null ? { eventType } : {})
      }
    });
  }

  if (eventType != null) {
    return buildSuggestion({
      source: recruitment.id,
      target: event.id,
      relationshipType: RELATIONSHIP_TYPES.RELATED_EVENT,
      confidence: CONFIDENCE_LEVELS.LOW,
      reason: "event_type_relationship_hint",
      metadata: { eventType }
    });
  }

  return null;
}

function evaluateVersionRelationship(left, right) {
  if (!isRecruitmentEntity(left) || !isRecruitmentEntity(right)) {
    return null;
  }

  const leftTitle = extractEntityTitle(left);
  const rightTitle = extractEntityTitle(right);
  if (leftTitle == null || rightTitle == null || leftTitle !== rightTitle) {
    return null;
  }

  const leftYear = extractYearOrVersion(left);
  const rightYear = extractYearOrVersion(right);

  const leftNextTarget = normalizeEntityId(
    left.metadata?.nextVersionId ??
      left.metadata?.next_version_id ??
      left.metadata?.nextVersionTarget
  );
  const rightNextTarget = normalizeEntityId(
    right.metadata?.nextVersionId ??
      right.metadata?.next_version_id ??
      right.metadata?.nextVersionTarget
  );
  const leftPreviousSource = normalizeEntityId(
    left.metadata?.previousVersionId ??
      left.metadata?.previous_version_id ??
      left.metadata?.previousVersionTarget
  );
  const rightPreviousSource = normalizeEntityId(
    right.metadata?.previousVersionId ??
      right.metadata?.previous_version_id ??
      right.metadata?.previousVersionTarget
  );

  if (leftNextTarget != null && idsEqual(leftNextTarget, right.id)) {
    return buildSuggestion({
      source: left.id,
      target: right.id,
      relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      reason: "explicit_previous_version_metadata",
      metadata: { normalizedTitle: leftTitle }
    });
  }

  if (rightNextTarget != null && idsEqual(rightNextTarget, left.id)) {
    return buildSuggestion({
      source: right.id,
      target: left.id,
      relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      reason: "explicit_previous_version_metadata",
      metadata: { normalizedTitle: leftTitle }
    });
  }

  if (leftPreviousSource != null && idsEqual(leftPreviousSource, right.id)) {
    return buildSuggestion({
      source: right.id,
      target: left.id,
      relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      reason: "explicit_previous_version_metadata",
      metadata: { normalizedTitle: leftTitle }
    });
  }

  if (rightPreviousSource != null && idsEqual(rightPreviousSource, left.id)) {
    return buildSuggestion({
      source: left.id,
      target: right.id,
      relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      reason: "explicit_previous_version_metadata",
      metadata: { normalizedTitle: leftTitle }
    });
  }

  if (leftYear != null && rightYear != null && leftYear !== rightYear) {
    const older = leftYear < rightYear ? left : right;
    const newer = leftYear < rightYear ? right : left;
    return buildSuggestion({
      source: older.id,
      target: newer.id,
      relationshipType: RELATIONSHIP_TYPES.PREVIOUS_VERSION,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      reason: "version_year_indicator",
      metadata: {
        normalizedTitle: leftTitle,
        olderYear: extractYearOrVersion(older),
        newerYear: extractYearOrVersion(newer)
      }
    });
  }

  return null;
}

function evaluatePrimaryRelationship(left, right) {
  const leftIsRecruitment = isRecruitmentEntity(left);
  const rightIsRecruitment = isRecruitmentEntity(right);

  if (leftIsRecruitment && !rightIsRecruitment && isRecruitmentEventEntity(right)) {
    const suggestion = evaluateRecruitmentEventRelationship(left, right);
    if (
      suggestion != null &&
      suggestion.confidence === CONFIDENCE_LEVELS.HIGH &&
      suggestion.relationshipType === RELATIONSHIP_TYPES.RELATED_EVENT
    ) {
      return buildSuggestion({
        source: left.id,
        target: right.id,
        relationshipType: RELATIONSHIP_TYPES.PRIMARY,
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "primary_recruitment_for_event",
        metadata: suggestion.metadata
      });
    }
  }

  if (rightIsRecruitment && !leftIsRecruitment && isRecruitmentEventEntity(left)) {
    const suggestion = evaluateRecruitmentEventRelationship(right, left);
    if (
      suggestion != null &&
      suggestion.confidence === CONFIDENCE_LEVELS.HIGH &&
      suggestion.relationshipType === RELATIONSHIP_TYPES.RELATED_EVENT
    ) {
      return buildSuggestion({
        source: right.id,
        target: left.id,
        relationshipType: RELATIONSHIP_TYPES.PRIMARY,
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "primary_recruitment_for_event",
        metadata: suggestion.metadata
      });
    }
  }

  if (leftIsRecruitment && rightIsRecruitment) {
    const leftPrimary = left.metadata?.isPrimary === true || left.metadata?.primary === true;
    const rightPrimary = right.metadata?.isPrimary === true || right.metadata?.primary === true;

    if (leftPrimary && !rightPrimary) {
      return buildSuggestion({
        source: left.id,
        target: right.id,
        relationshipType: RELATIONSHIP_TYPES.PRIMARY,
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "explicit_primary_metadata",
        metadata: { normalizedTitle: extractEntityTitle(left) }
      });
    }

    if (rightPrimary && !leftPrimary) {
      return buildSuggestion({
        source: right.id,
        target: left.id,
        relationshipType: RELATIONSHIP_TYPES.PRIMARY,
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "explicit_primary_metadata",
        metadata: { normalizedTitle: extractEntityTitle(right) }
      });
    }
  }

  return null;
}

function evaluateUnknownRelationship(left, right) {
  if (
    (isRecruitmentEntity(left) && isRecruitmentEventEntity(right)) ||
    (isRecruitmentEntity(right) && isRecruitmentEventEntity(left))
  ) {
    return null;
  }

  if (isRecruitmentEntity(left) && isRecruitmentEntity(right)) {
    const leftTitle = extractEntityTitle(left);
    const rightTitle = extractEntityTitle(right);
    const leftYear = extractYearOrVersion(left);
    const rightYear = extractYearOrVersion(right);
    if (
      leftTitle != null &&
      rightTitle != null &&
      leftTitle === rightTitle &&
      leftYear != null &&
      rightYear != null
    ) {
      return null;
    }
  }

  const leftTitle = extractEntityTitle(left);
  const rightTitle = extractEntityTitle(right);
  const sharedTitle =
    leftTitle != null && rightTitle != null && leftTitle === rightTitle;

  const leftRecruitmentId = extractRecruitmentIdentifier(left);
  const rightRecruitmentId = extractRecruitmentIdentifier(right);
  const sharedRecruitmentId =
    leftRecruitmentId != null &&
    rightRecruitmentId != null &&
    idsEqual(leftRecruitmentId, rightRecruitmentId);

  if (!sharedTitle && !sharedRecruitmentId) {
    return null;
  }

  if (left.id == null || right.id == null) {
    return null;
  }

  const source = compareEntityIds(left, right) <= 0 ? left.id : right.id;
  const target = compareEntityIds(left, right) <= 0 ? right.id : left.id;

  return buildSuggestion({
    source,
    target,
    relationshipType: RELATIONSHIP_TYPES.UNKNOWN,
    confidence: CONFIDENCE_LEVELS.LOW,
    reason: sharedRecruitmentId
      ? "weak_recruitment_identifier_overlap"
      : "weak_title_overlap",
    metadata: {
      ...(sharedTitle ? { normalizedTitle: leftTitle } : {}),
      ...(sharedRecruitmentId ? { recruitmentId: leftRecruitmentId } : {})
    }
  });
}

function dedupeSuggestions(suggestions) {
  const seen = new Set();
  const deduped = [];

  for (let i = 0; i < suggestions.length; i += 1) {
    const suggestion = suggestions[i];
    const key = [
      String(suggestion.source ?? ""),
      String(suggestion.target ?? ""),
      suggestion.relationshipType
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(suggestion);
  }

  deduped.sort(compareSuggestedRelationships);
  return deduped;
}

function buildConfidenceSummary(suggestions) {
  const summary = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
    total: suggestions.length
  };

  for (let i = 0; i < suggestions.length; i += 1) {
    const confidence = suggestions[i].confidence;
    if (confidence === CONFIDENCE_LEVELS.HIGH) {
      summary.high += 1;
    } else if (confidence === CONFIDENCE_LEVELS.MEDIUM) {
      summary.medium += 1;
    } else if (confidence === CONFIDENCE_LEVELS.LOW) {
      summary.low += 1;
    } else {
      summary.unknown += 1;
    }
  }

  return Object.freeze(summary);
}

function suggestRelationshipsForCandidates(candidates) {
  if (candidates.length < 2) {
    return [];
  }

  const suggestions = [];

  suggestions.push(...evaluateExplicitMetadataHints(candidates));

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const left = candidates[i];
      const right = candidates[j];

      if (left.id != null && right.id != null && idsEqual(left.id, right.id)) {
        continue;
      }

      const primarySuggestion = evaluatePrimaryRelationship(left, right);
      if (primarySuggestion != null) {
        suggestions.push(primarySuggestion);
      }

      const eventSuggestion = evaluateRecruitmentEventRelationship(left, right);
      if (eventSuggestion != null) {
        suggestions.push(eventSuggestion);
      }

      const versionSuggestion = evaluateVersionRelationship(left, right);
      if (versionSuggestion != null) {
        suggestions.push(versionSuggestion);

        if (versionSuggestion.relationshipType === RELATIONSHIP_TYPES.PREVIOUS_VERSION) {
          suggestions.push(
            buildSuggestion({
              source: versionSuggestion.target,
              target: versionSuggestion.source,
              relationshipType: RELATIONSHIP_TYPES.NEXT_VERSION,
              confidence: versionSuggestion.confidence,
              reason: "version_year_indicator_inverse",
              metadata: versionSuggestion.metadata
            })
          );
        }
      }

      const unknownSuggestion = evaluateUnknownRelationship(left, right);
      if (unknownSuggestion != null) {
        suggestions.push(unknownSuggestion);
      }
    }
  }

  return dedupeSuggestions(suggestions);
}

/**
 * Analyze recruitment entity candidates and produce relationship suggestions.
 * Pure: no I/O, no mutation of input, no actual linking.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function resolveRecruitmentRelationships(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION;
  }

  if (!isPlainObject(input)) {
    return EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION;
  }

  const candidates = normalizeCandidates(input.entities);
  const suggestedRelationships = suggestRelationshipsForCandidates(candidates);

  return deepFreeze({
    candidates: Object.freeze(candidates.slice()),
    suggestedRelationships: Object.freeze(suggestedRelationships.slice()),
    relationshipCount: suggestedRelationships.length,
    confidenceSummary: buildConfidenceSummary(suggestedRelationships)
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRelationshipResolutionResult(value) {
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

  for (let i = 0; i < value.candidates.length; i += 1) {
    const candidate = value.candidates[i];
    if (!isPlainObject(candidate)) {
      return false;
    }
    if (!("id" in candidate) || !("entityType" in candidate) || !isPlainObject(candidate.metadata)) {
      return false;
    }
  }

  for (let i = 0; i < value.suggestedRelationships.length; i += 1) {
    const relationship = value.suggestedRelationships[i];
    if (!isPlainObject(relationship)) {
      return false;
    }
    if (
      !("source" in relationship) ||
      !("target" in relationship) ||
      typeof relationship.relationshipType !== "string" ||
      typeof relationship.confidence !== "string" ||
      typeof relationship.reason !== "string" ||
      !isPlainObject(relationship.metadata)
    ) {
      return false;
    }
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

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRelationshipResolutionResult(result) {
  const reasons = [];

  if (!isRelationshipResolutionResult(result)) {
    return buildValidationResult(["INVALID_RELATIONSHIP_RESOLUTION_SHAPE"]);
  }

  if (result.relationshipCount !== result.suggestedRelationships.length) {
    reasons.push("INVALID_RELATIONSHIP_COUNT");
  }

  const summary = result.confidenceSummary;
  const counted =
    summary.high + summary.medium + summary.low + summary.unknown;
  if (counted !== summary.total || summary.total !== result.relationshipCount) {
    reasons.push("INVALID_CONFIDENCE_SUMMARY");
  }

  for (let i = 0; i < result.suggestedRelationships.length; i += 1) {
    const relationship = result.suggestedRelationships[i];
    if (!SUPPORTED_RELATIONSHIP_TYPES.has(relationship.relationshipType)) {
      reasons.push("INVALID_RELATIONSHIP_TYPE");
      break;
    }
  }

  for (let i = 0; i < result.suggestedRelationships.length; i += 1) {
    const relationship = result.suggestedRelationships[i];
    if (!SUPPORTED_CONFIDENCE_LEVELS.has(relationship.confidence)) {
      reasons.push("INVALID_CONFIDENCE");
      break;
    }
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeRelationshipResolutionResult(result) {
  const validation = validateRelationshipResolutionResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE,
      entity: RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY,
      valid: false,
      candidateCount: 0,
      relationshipCount: 0,
      confidenceSummary: EMPTY_CONFIDENCE_SUMMARY,
      relationshipTypes: Object.freeze([]),
      readOnly: true,
      performsLinking: false
    });
  }

  const relationshipTypes = [];
  const seenTypes = new Set();
  for (let i = 0; i < result.suggestedRelationships.length; i += 1) {
    const type = result.suggestedRelationships[i].relationshipType;
    if (!seenTypes.has(type)) {
      seenTypes.add(type);
      relationshipTypes.push(type);
    }
  }

  return Object.freeze({
    phase: RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE,
    entity: RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY,
    valid: true,
    candidateCount: result.candidates.length,
    relationshipCount: result.relationshipCount,
    confidenceSummary: result.confidenceSummary,
    relationshipTypes: Object.freeze(relationshipTypes.slice()),
    readOnly: true,
    performsLinking: false
  });
}

module.exports = {
  RECRUITMENT_RELATIONSHIP_RESOLVER_PHASE,
  RECRUITMENT_RELATIONSHIP_RESOLUTION_ENTITY,
  RELATIONSHIP_TYPES,
  SUPPORTED_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LIST,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RECRUITMENT_RELATIONSHIP_RESOLVER_DESCRIPTOR,
  RECRUITMENT_RELATIONSHIP_RESOLVER_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_RELATIONSHIP_RESOLUTION,
  normalizeEntityForRelationship,
  resolveRecruitmentRelationships,
  isRelationshipResolutionResult,
  validateRelationshipResolutionResult,
  summarizeRelationshipResolutionResult
};
