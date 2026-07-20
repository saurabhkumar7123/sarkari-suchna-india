"use strict";

/**
 * Phase 82 — Recruitment Relationship Mapping Foundation (Read-only).
 *
 * Pure library that represents descriptive relationships between recruitment
 * lifecycle entities without performing actual linking. Accepts plain JavaScript
 * objects and returns an immutable relationship map.
 *
 * Does not resolve pages, fetch URLs, access a database, or mutate input.
 * Designed as a foundation for a future relationship engine expansion.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_RELATIONSHIP_MAP_PHASE = 82;

const RECRUITMENT_RELATIONSHIP_MAP_ENTITY = "recruitment_relationship_map";

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
 * Descriptive confidence levels for relationship entries.
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

const RECRUITMENT_RELATIONSHIP_MAP_METADATA = Object.freeze({
  phase: RECRUITMENT_RELATIONSHIP_MAP_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  resolvesPages: false,
  fetchesUrls: false,
  performsLinking: false,
  mutatesInput: false,
  supportsFutureRelationshipEngine: true
});

const RECRUITMENT_RELATIONSHIP_MAP_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_RELATIONSHIP_MAP_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_RELATIONSHIP_MAP_PHASE,
  description:
    "Immutable descriptive map of relationships between recruitment lifecycle entities.",
  relationshipTypes: RELATIONSHIP_TYPE_LIST,
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  metadata: RECRUITMENT_RELATIONSHIP_MAP_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
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
 * @returns {boolean}
 */
function isSupportedRelationshipType(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_RELATIONSHIP_TYPES.has(normalized);
}

/**
 * Normalize a relationship type; unknown or missing values become UNKNOWN.
 *
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
    if (entry == null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      copy[key] = entry;
    } else {
      copy[key] = String(entry);
    }
  }
  return Object.freeze(copy);
}

/**
 * @param {*} entity
 * @returns {Readonly<Object>|null}
 */
function normalizeEntity(entity) {
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

function compareRelationships(left, right) {
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

/**
 * @param {*} relationship
 * @returns {Readonly<Object>|null}
 */
function normalizeRelationship(relationship) {
  if (!isPlainObject(relationship)) {
    return null;
  }

  const source = normalizeEntityId(
    relationship.source ?? relationship.sourceId ?? relationship.source_id
  );
  const target = normalizeEntityId(
    relationship.target ?? relationship.targetId ?? relationship.target_id
  );

  if (source == null && target == null) {
    return null;
  }

  return deepFreeze({
    source,
    target,
    relationshipType: normalizeRelationshipType(
      relationship.relationshipType ?? relationship.relationship_type ?? relationship.type
    ),
    confidence: normalizeConfidence(relationship.confidence),
    metadata: normalizeMetadata(relationship.metadata)
  });
}

function normalizeRelatedEntities(relatedEntities) {
  if (!Array.isArray(relatedEntities)) {
    return [];
  }

  const normalized = [];
  for (let i = 0; i < relatedEntities.length; i += 1) {
    const entity = normalizeEntity(relatedEntities[i]);
    if (entity != null) {
      normalized.push(entity);
    }
  }

  normalized.sort(compareEntityIds);
  return normalized;
}

function normalizeRelationships(relationships) {
  if (!Array.isArray(relationships)) {
    return [];
  }

  const normalized = [];
  for (let i = 0; i < relationships.length; i += 1) {
    const relationship = normalizeRelationship(relationships[i]);
    if (relationship != null) {
      normalized.push(relationship);
    }
  }

  normalized.sort(compareRelationships);
  return normalized;
}

const EMPTY_RECRUITMENT_RELATIONSHIP_MAP = deepFreeze({
  recruitmentId: null,
  primaryEntity: null,
  relatedEntities: Object.freeze([]),
  relationships: Object.freeze([]),
  relationshipCount: 0
});

/**
 * Create an immutable recruitment relationship map from plain input objects.
 * Pure: no I/O, no mutation of input, no linking resolution.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentRelationshipMap(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_RECRUITMENT_RELATIONSHIP_MAP;
  }

  if (!isPlainObject(input)) {
    return EMPTY_RECRUITMENT_RELATIONSHIP_MAP;
  }

  const recruitmentId = normalizeEntityId(
    input.recruitmentId ?? input.recruitment_id
  );
  const primaryEntity = normalizeEntity(
    input.primaryEntity ?? input.primary_entity ?? null
  );
  const relatedEntities = normalizeRelatedEntities(
    input.relatedEntities ?? input.related_entities
  );
  const relationships = normalizeRelationships(
    input.relationships
  );

  return deepFreeze({
    recruitmentId,
    primaryEntity,
    relatedEntities: Object.freeze(relatedEntities.slice()),
    relationships: Object.freeze(relationships.slice()),
    relationshipCount: relationships.length
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentRelationshipMap(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !("recruitmentId" in value) ||
    !("primaryEntity" in value) ||
    !Array.isArray(value.relatedEntities) ||
    !Array.isArray(value.relationships) ||
    typeof value.relationshipCount !== "number"
  ) {
    return false;
  }

  if (value.relationshipCount !== value.relationships.length) {
    return false;
  }

  if (value.primaryEntity != null && !isPlainObject(value.primaryEntity)) {
    return false;
  }

  for (let i = 0; i < value.relatedEntities.length; i += 1) {
    if (!isPlainObject(value.relatedEntities[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.relationships.length; i += 1) {
    const relationship = value.relationships[i];
    if (!isPlainObject(relationship)) {
      return false;
    }
    if (
      !("source" in relationship) ||
      !("target" in relationship) ||
      typeof relationship.relationshipType !== "string" ||
      typeof relationship.confidence !== "string" ||
      !isPlainObject(relationship.metadata)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Object|null|undefined} relationshipMap
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentRelationshipMap(relationshipMap) {
  const reasons = [];

  if (!isRecruitmentRelationshipMap(relationshipMap)) {
    return buildValidationResult(["INVALID_RELATIONSHIP_MAP_SHAPE"]);
  }

  if (relationshipMap.relationshipCount !== relationshipMap.relationships.length) {
    reasons.push("INVALID_RELATIONSHIP_COUNT");
  }

  for (let i = 0; i < relationshipMap.relationships.length; i += 1) {
    const relationship = relationshipMap.relationships[i];
    if (!SUPPORTED_RELATIONSHIP_TYPES.has(relationship.relationshipType)) {
      reasons.push("INVALID_RELATIONSHIP_TYPE");
      break;
    }
  }

  for (let i = 0; i < relationshipMap.relationships.length; i += 1) {
    const relationship = relationshipMap.relationships[i];
    if (!SUPPORTED_CONFIDENCE_LEVELS.has(relationship.confidence)) {
      reasons.push("INVALID_CONFIDENCE");
      break;
    }
  }

  if (
    relationshipMap.primaryEntity != null &&
    relationshipMap.primaryEntity.id == null &&
    relationshipMap.primaryEntity.entityType == null
  ) {
    reasons.push("INVALID_PRIMARY_ENTITY");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} relationshipMap
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentRelationshipMap(relationshipMap) {
  const validation = validateRecruitmentRelationshipMap(relationshipMap);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_RELATIONSHIP_MAP_PHASE,
      entity: RECRUITMENT_RELATIONSHIP_MAP_ENTITY,
      valid: false,
      recruitmentId: null,
      hasPrimaryEntity: false,
      relatedEntityCount: 0,
      relationshipCount: 0,
      relationshipTypes: Object.freeze([]),
      readOnly: true,
      performsLinking: false
    });
  }

  const relationshipTypes = [];
  const seenTypes = new Set();
  for (let i = 0; i < relationshipMap.relationships.length; i += 1) {
    const type = relationshipMap.relationships[i].relationshipType;
    if (!seenTypes.has(type)) {
      seenTypes.add(type);
      relationshipTypes.push(type);
    }
  }

  return Object.freeze({
    phase: RECRUITMENT_RELATIONSHIP_MAP_PHASE,
    entity: RECRUITMENT_RELATIONSHIP_MAP_ENTITY,
    valid: true,
    recruitmentId: relationshipMap.recruitmentId,
    hasPrimaryEntity: relationshipMap.primaryEntity != null,
    primaryEntityType:
      relationshipMap.primaryEntity != null
        ? relationshipMap.primaryEntity.entityType
        : null,
    relatedEntityCount: relationshipMap.relatedEntities.length,
    relationshipCount: relationshipMap.relationshipCount,
    relationshipTypes: Object.freeze(relationshipTypes.slice()),
    readOnly: true,
    performsLinking: false
  });
}

module.exports = {
  RECRUITMENT_RELATIONSHIP_MAP_PHASE,
  RECRUITMENT_RELATIONSHIP_MAP_ENTITY,
  RELATIONSHIP_TYPES,
  SUPPORTED_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LIST,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RECRUITMENT_RELATIONSHIP_MAP_DESCRIPTOR,
  RECRUITMENT_RELATIONSHIP_MAP_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_RELATIONSHIP_MAP,
  isSupportedRelationshipType,
  normalizeRelationshipType,
  normalizeConfidence,
  createRecruitmentRelationshipMap,
  isRecruitmentRelationshipMap,
  validateRecruitmentRelationshipMap,
  summarizeRecruitmentRelationshipMap
};
