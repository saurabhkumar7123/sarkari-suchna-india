"use strict";

/**
 * Phase 85 — Recruitment Mapping Planning Layer (Read-only).
 *
 * Pure library that prepares a descriptive plan for future mapping of existing
 * entities into the recruitment lifecycle structure. Evaluates mapping readiness
 * only — does not perform mapping, create relationships, or access a database.
 *
 * Accepts plain JavaScript objects and returns an immutable planning object.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_MAPPING_PLANNER_PHASE = 85;

const RECRUITMENT_MAPPING_PLAN_ENTITY = "recruitment_mapping_plan";

/**
 * Mapping readiness status for future lifecycle mapping.
 */
const MAPPING_STATUS = Object.freeze({
  READY: "READY",
  PARTIAL: "PARTIAL",
  NOT_READY: "NOT_READY"
});

const SUPPORTED_MAPPING_STATUSES = Object.freeze(new Set(Object.values(MAPPING_STATUS)));

/**
 * Planning readiness levels describing confidence in future mapping execution.
 */
const READINESS_LEVELS = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  UNKNOWN: "UNKNOWN"
});

const SUPPORTED_READINESS_LEVELS = Object.freeze(new Set(Object.values(READINESS_LEVELS)));

/**
 * Descriptive confidence levels (Phase 82–84 vocabulary, inline).
 */
const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const SUPPORTED_CONFIDENCE_LEVELS = Object.freeze(new Set(Object.values(CONFIDENCE_LEVELS)));

const CONFIDENCE_ORDER = Object.freeze({
  [CONFIDENCE_LEVELS.HIGH]: 3,
  [CONFIDENCE_LEVELS.MEDIUM]: 2,
  [CONFIDENCE_LEVELS.LOW]: 1,
  [CONFIDENCE_LEVELS.UNKNOWN]: 0
});

/**
 * Relationship types (Phase 82 vocabulary, inline).
 */
const RELATIONSHIP_TYPES = Object.freeze({
  PRIMARY: "PRIMARY",
  RELATED_EVENT: "RELATED_EVENT",
  PREVIOUS_VERSION: "PREVIOUS_VERSION",
  NEXT_VERSION: "NEXT_VERSION",
  UNKNOWN: "UNKNOWN"
});

const ENTITY_ROLES = Object.freeze({
  PRIMARY: "PRIMARY",
  RELATED: "RELATED"
});

const PLANNING_MISSING_INFORMATION = Object.freeze({
  MISSING_PRIMARY_ENTITY: "MISSING_PRIMARY_ENTITY",
  MISSING_PRIMARY_ENTITY_ID: "MISSING_PRIMARY_ENTITY_ID",
  MISSING_RELATIONSHIPS: "MISSING_RELATIONSHIPS",
  MISSING_VALIDATION_RESULT: "MISSING_VALIDATION_RESULT",
  RELATIONSHIPS_NOT_VALIDATED: "RELATIONSHIPS_NOT_VALIDATED",
  MISSING_TIMELINE_PROJECTION: "MISSING_TIMELINE_PROJECTION",
  MISSING_LIFECYCLE_EVALUATION: "MISSING_LIFECYCLE_EVALUATION",
  MISSING_LIFECYCLE_STATE: "MISSING_LIFECYCLE_STATE",
  INVALID_INPUT_SHAPE: "INVALID_INPUT_SHAPE"
});

const PLANNING_MISSING_INFORMATION_LIST = Object.freeze(
  Object.values(PLANNING_MISSING_INFORMATION)
);

const RECRUITMENT_MAPPING_PLANNER_METADATA = Object.freeze({
  phase: RECRUITMENT_MAPPING_PLANNER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsMapping: false,
  createsRelationships: false,
  mutatesInput: false,
  fetchesEntities: false
});

const RECRUITMENT_MAPPING_PLANNER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_MAPPING_PLAN_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_MAPPING_PLANNER_PHASE,
  description:
    "Immutable descriptive plan evaluating readiness for future recruitment lifecycle mapping.",
  mappingStatuses: Object.freeze(Object.values(MAPPING_STATUS)),
  readinessLevels: Object.freeze(Object.values(READINESS_LEVELS)),
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  missingInformationCodes: PLANNING_MISSING_INFORMATION_LIST,
  metadata: RECRUITMENT_MAPPING_PLANNER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_RECRUITMENT_MAPPING_PLAN = deepFreeze({
  phase: RECRUITMENT_MAPPING_PLANNER_PHASE,
  entity: RECRUITMENT_MAPPING_PLAN_ENTITY,
  recruitmentId: null,
  primaryCandidate: null,
  relatedCandidates: Object.freeze([]),
  mappingStatus: MAPPING_STATUS.NOT_READY,
  readiness: READINESS_LEVELS.UNKNOWN,
  missingInformation: Object.freeze([
    PLANNING_MISSING_INFORMATION.INVALID_INPUT_SHAPE,
    PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY
  ]),
  confidence: CONFIDENCE_LEVELS.UNKNOWN,
  metadata: deepFreeze({
    ...RECRUITMENT_MAPPING_PLANNER_METADATA,
    createReason: "invalid_input",
    relationshipCount: 0,
    relatedCandidateCount: 0,
    validationAvailable: false,
    validationValid: false,
    timelineAvailable: false,
    lifecycleAvailable: false
  })
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

function normalizeEntity(entity) {
  if (!isPlainObject(entity)) {
    return null;
  }

  const id = normalizeEntityId(entity.id ?? entity.entityId ?? entity.entity_id);
  const entityType = normalizeString(
    entity.entityType ?? entity.entity_type ?? entity.type
  );
  const role = normalizeString(entity.role ?? entity.entityRole ?? entity.entity_role);
  const normalizedRole =
    role != null && role.toUpperCase() === ENTITY_ROLES.PRIMARY
      ? ENTITY_ROLES.PRIMARY
      : role != null && role.toUpperCase() === ENTITY_ROLES.RELATED
        ? ENTITY_ROLES.RELATED
        : entity.isPrimary === true
          ? ENTITY_ROLES.PRIMARY
          : null;

  if (id == null && entityType == null) {
    return null;
  }

  return deepFreeze({
    id,
    entityType,
    role: normalizedRole,
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

  const leftString = String(leftId);
  const rightString = String(rightId);
  if (leftString < rightString) {
    return -1;
  }
  if (leftString > rightString) {
    return 1;
  }
  return 0;
}

function entityKey(entity) {
  if (entity == null) {
    return "";
  }
  return `${entity.id ?? ""}:${entity.entityType ?? ""}`;
}

function dedupeEntities(entities) {
  const seen = new Set();
  const deduped = [];

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    const key = entityKey(entity);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entity);
  }

  deduped.sort(compareEntityIds);
  return deduped;
}

function normalizeEntityCollection(entitiesInput) {
  if (entitiesInput == null) {
    return { primaryCandidate: null, relatedCandidates: [] };
  }

  if (Array.isArray(entitiesInput)) {
    const normalized = [];
    for (let i = 0; i < entitiesInput.length; i += 1) {
      const entity = normalizeEntity(entitiesInput[i]);
      if (entity != null) {
        normalized.push(entity);
      }
    }

    const primaryCandidates = normalized.filter(
      (entity) => entity.role === ENTITY_ROLES.PRIMARY
    );
    const primaryCandidate =
      primaryCandidates.length > 0
        ? primaryCandidates[0]
        : normalized.length > 0
          ? normalized[0]
          : null;

    const relatedCandidates = dedupeEntities(
      normalized.filter((entity) => entityKey(entity) !== entityKey(primaryCandidate))
    );

    return { primaryCandidate, relatedCandidates };
  }

  if (!isPlainObject(entitiesInput)) {
    return { primaryCandidate: null, relatedCandidates: [] };
  }

  const primaryCandidate = normalizeEntity(
    entitiesInput.primaryEntity ??
      entitiesInput.primary_entity ??
      entitiesInput.primary ??
      null
  );

  const relatedSource =
    entitiesInput.relatedEntities ??
    entitiesInput.related_entities ??
    entitiesInput.related ??
    [];

  const relatedCandidates = [];
  if (Array.isArray(relatedSource)) {
    for (let i = 0; i < relatedSource.length; i += 1) {
      const entity = normalizeEntity(relatedSource[i]);
      if (entity != null && entityKey(entity) !== entityKey(primaryCandidate)) {
        relatedCandidates.push(entity);
      }
    }
  }

  return {
    primaryCandidate,
    relatedCandidates: dedupeEntities(relatedCandidates)
  };
}

function normalizeRelationships(relationships) {
  if (!Array.isArray(relationships)) {
    return [];
  }

  const normalized = [];
  for (let i = 0; i < relationships.length; i += 1) {
    const relationship = relationships[i];
    if (!isPlainObject(relationship)) {
      continue;
    }

    const source = normalizeEntityId(relationship.source);
    const target = normalizeEntityId(relationship.target);
    const relationshipType = normalizeString(relationship.relationshipType);
    const confidence = normalizeConfidence(relationship.confidence);

    if (source == null && target == null) {
      continue;
    }

    normalized.push(
      deepFreeze({
        source,
        target,
        relationshipType: relationshipType ?? RELATIONSHIP_TYPES.UNKNOWN,
        confidence,
        metadata: normalizeMetadata(relationship.metadata)
      })
    );
  }

  normalized.sort((left, right) => {
    const sourceCompare = String(left.source ?? "").localeCompare(String(right.source ?? ""));
    if (sourceCompare !== 0) {
      return sourceCompare;
    }
    const targetCompare = String(left.target ?? "").localeCompare(String(right.target ?? ""));
    if (targetCompare !== 0) {
      return targetCompare;
    }
    return String(left.relationshipType ?? "").localeCompare(String(right.relationshipType ?? ""));
  });

  return normalized;
}

function isValidationResultAvailable(validationResult) {
  return (
    isPlainObject(validationResult) &&
    typeof validationResult.valid === "boolean" &&
    typeof validationResult.status === "string"
  );
}

function isValidationSuccessful(validationResult) {
  if (!isValidationResultAvailable(validationResult)) {
    return false;
  }

  const status = normalizeString(validationResult.status);
  if (validationResult.valid === true) {
    return true;
  }

  return status != null && status.toUpperCase() === "VALID";
}

function isTimelineProjectionAvailable(timelineProjection) {
  if (!isPlainObject(timelineProjection)) {
    return false;
  }

  const recruitmentId = normalizeEntityId(timelineProjection.recruitmentId);
  const eventCount = timelineProjection.eventCount;
  const events = timelineProjection.events;

  return (
    recruitmentId != null ||
    (typeof eventCount === "number" && eventCount > 0) ||
    (Array.isArray(events) && events.length > 0)
  );
}

function isLifecycleEvaluationAvailable(lifecycleEvaluation) {
  if (!isPlainObject(lifecycleEvaluation)) {
    return false;
  }

  const recruitmentId = normalizeEntityId(lifecycleEvaluation.recruitmentId);
  const suggestedState = normalizeString(
    lifecycleEvaluation.suggestedState ?? lifecycleEvaluation.suggested_state
  );
  const confidence = lifecycleEvaluation.confidence;

  return (
    recruitmentId != null ||
    suggestedState != null ||
    confidence != null
  );
}

function hasLifecycleState(lifecycleEvaluation) {
  if (!isPlainObject(lifecycleEvaluation)) {
    return false;
  }

  return (
    normalizeString(
      lifecycleEvaluation.suggestedState ?? lifecycleEvaluation.suggested_state
    ) != null
  );
}

function resolveRecruitmentId(primaryCandidate, timelineProjection, lifecycleEvaluation) {
  const timelineId = isPlainObject(timelineProjection)
    ? normalizeEntityId(timelineProjection.recruitmentId)
    : null;
  const lifecycleId = isPlainObject(lifecycleEvaluation)
    ? normalizeEntityId(lifecycleEvaluation.recruitmentId)
    : null;
  const primaryId = primaryCandidate != null ? primaryCandidate.id : null;

  return timelineId ?? lifecycleId ?? primaryId ?? null;
}

function collectRelationshipConfidences(relationships, validationResult) {
  const confidences = [];

  for (let i = 0; i < relationships.length; i += 1) {
    confidences.push(relationships[i].confidence);
  }

  if (isPlainObject(validationResult) && Array.isArray(validationResult.relationshipResults)) {
    for (let i = 0; i < validationResult.relationshipResults.length; i += 1) {
      const entry = validationResult.relationshipResults[i];
      if (isPlainObject(entry) && entry.confidence != null) {
        confidences.push(normalizeConfidence(entry.confidence));
      }
    }
  }

  return confidences;
}

function minConfidence(confidences) {
  if (!Array.isArray(confidences) || confidences.length === 0) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  let lowest = CONFIDENCE_LEVELS.HIGH;
  for (let i = 0; i < confidences.length; i += 1) {
    const confidence = normalizeConfidence(confidences[i]);
    if (CONFIDENCE_ORDER[confidence] < CONFIDENCE_ORDER[lowest]) {
      lowest = confidence;
    }
  }
  return lowest;
}

function collectConfidenceSignals(context) {
  const signals = [];

  if (context.validationValid) {
    signals.push(CONFIDENCE_LEVELS.HIGH);
  } else if (context.validationAvailable) {
    const status = normalizeString(context.validationStatus);
    if (status != null && status.toUpperCase() === "REVIEW_REQUIRED") {
      signals.push(CONFIDENCE_LEVELS.MEDIUM);
    } else {
      signals.push(CONFIDENCE_LEVELS.LOW);
    }
  }

  const relationshipConfidence = minConfidence(context.relationshipConfidences);
  if (context.hasRelationships) {
    signals.push(relationshipConfidence);
  }

  if (context.lifecycleConfidence != null) {
    signals.push(normalizeConfidence(context.lifecycleConfidence));
  }

  return signals;
}

function calculateConfidence(context) {
  const signals = collectConfidenceSignals(context);

  if (context.primaryCandidate == null) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  if (signals.length === 0) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  return minConfidence(signals);
}

function collectMissingInformation(context) {
  const missing = [];

  if (context.primaryCandidate == null) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY);
  } else if (context.primaryCandidate.id == null) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY_ID);
  }

  if (!context.hasRelationships) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_RELATIONSHIPS);
  }

  if (!context.validationAvailable) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_VALIDATION_RESULT);
  } else if (!context.validationValid) {
    missing.push(PLANNING_MISSING_INFORMATION.RELATIONSHIPS_NOT_VALIDATED);
  }

  if (!context.timelineAvailable) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_TIMELINE_PROJECTION);
  }

  if (!context.lifecycleAvailable) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_LIFECYCLE_EVALUATION);
  } else if (!context.hasLifecycleState) {
    missing.push(PLANNING_MISSING_INFORMATION.MISSING_LIFECYCLE_STATE);
  }

  return missing.sort();
}

function resolveMappingStatus(missingInformation, primaryCandidate) {
  if (
    primaryCandidate == null ||
    missingInformation.includes(PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY)
  ) {
    return MAPPING_STATUS.NOT_READY;
  }

  const requiredForReady = [
    PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY_ID,
    PLANNING_MISSING_INFORMATION.MISSING_RELATIONSHIPS,
    PLANNING_MISSING_INFORMATION.MISSING_VALIDATION_RESULT,
    PLANNING_MISSING_INFORMATION.RELATIONSHIPS_NOT_VALIDATED,
    PLANNING_MISSING_INFORMATION.MISSING_TIMELINE_PROJECTION,
    PLANNING_MISSING_INFORMATION.MISSING_LIFECYCLE_EVALUATION,
    PLANNING_MISSING_INFORMATION.MISSING_LIFECYCLE_STATE
  ];

  const hasRequiredGap = requiredForReady.some((code) =>
    missingInformation.includes(code)
  );

  if (!hasRequiredGap) {
    return MAPPING_STATUS.READY;
  }

  return MAPPING_STATUS.PARTIAL;
}

function resolveReadiness(mappingStatus, confidence, missingCount) {
  if (mappingStatus === MAPPING_STATUS.NOT_READY) {
    return READINESS_LEVELS.UNKNOWN;
  }

  if (mappingStatus === MAPPING_STATUS.READY) {
    if (confidence === CONFIDENCE_LEVELS.HIGH) {
      return READINESS_LEVELS.HIGH;
    }
    if (confidence === CONFIDENCE_LEVELS.MEDIUM) {
      return READINESS_LEVELS.MEDIUM;
    }
    return READINESS_LEVELS.LOW;
  }

  if (confidence === CONFIDENCE_LEVELS.HIGH && missingCount <= 1) {
    return READINESS_LEVELS.MEDIUM;
  }
  if (confidence === CONFIDENCE_LEVELS.MEDIUM && missingCount <= 2) {
    return READINESS_LEVELS.MEDIUM;
  }
  if (missingCount <= 1) {
    return READINESS_LEVELS.MEDIUM;
  }

  return READINESS_LEVELS.LOW;
}

function buildPlanningContext(input) {
  const { primaryCandidate, relatedCandidates } = normalizeEntityCollection(input.entities);
  const relationships = normalizeRelationships(input.relationships);
  const validationResult = isPlainObject(input.validationResult) ? input.validationResult : null;
  const timelineProjection = isPlainObject(input.timelineProjection)
    ? input.timelineProjection
    : null;
  const lifecycleEvaluation = isPlainObject(input.lifecycleEvaluation)
    ? input.lifecycleEvaluation
    : null;

  const validationAvailable = isValidationResultAvailable(validationResult);
  const validationValid = isValidationSuccessful(validationResult);
  const timelineAvailable = isTimelineProjectionAvailable(timelineProjection);
  const lifecycleAvailable = isLifecycleEvaluationAvailable(lifecycleEvaluation);
  const lifecycleStatePresent =
    lifecycleAvailable && hasLifecycleState(lifecycleEvaluation);

  return {
    primaryCandidate,
    relatedCandidates,
    relationships,
    validationResult,
    timelineProjection,
    lifecycleEvaluation,
    hasRelationships: relationships.length > 0,
    validationAvailable,
    validationValid,
    validationStatus: validationAvailable ? validationResult.status : null,
    timelineAvailable,
    lifecycleAvailable,
    hasLifecycleState: lifecycleStatePresent,
    lifecycleConfidence: lifecycleAvailable ? lifecycleEvaluation.confidence : null,
    relationshipConfidences: collectRelationshipConfidences(relationships, validationResult)
  };
}

/**
 * Create an immutable recruitment mapping plan from plain input objects.
 * Pure: no I/O, no mutation of input, no mapping execution.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentMappingPlan(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_RECRUITMENT_MAPPING_PLAN;
  }

  if (!isPlainObject(input)) {
    return EMPTY_RECRUITMENT_MAPPING_PLAN;
  }

  const context = buildPlanningContext(input);
  const missingInformation = collectMissingInformation(context);
  const mappingStatus = resolveMappingStatus(missingInformation, context.primaryCandidate);
  const confidence = calculateConfidence(context);
  const readiness = resolveReadiness(
    mappingStatus,
    confidence,
    missingInformation.length
  );
  const recruitmentId = resolveRecruitmentId(
    context.primaryCandidate,
    context.timelineProjection,
    context.lifecycleEvaluation
  );

  return deepFreeze({
    phase: RECRUITMENT_MAPPING_PLANNER_PHASE,
    entity: RECRUITMENT_MAPPING_PLAN_ENTITY,
    recruitmentId,
    primaryCandidate: context.primaryCandidate,
    relatedCandidates: Object.freeze(context.relatedCandidates.slice()),
    mappingStatus,
    readiness,
    missingInformation: Object.freeze(missingInformation.slice()),
    confidence,
    metadata: deepFreeze({
      ...RECRUITMENT_MAPPING_PLANNER_METADATA,
      createReason: "planning_input",
      relationshipCount: context.relationships.length,
      relatedCandidateCount: context.relatedCandidates.length,
      validationAvailable: context.validationAvailable,
      validationValid: context.validationValid,
      timelineAvailable: context.timelineAvailable,
      lifecycleAvailable: context.lifecycleAvailable,
      lifecycleStatePresent: context.hasLifecycleState
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentMappingPlan(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.phase !== RECRUITMENT_MAPPING_PLANNER_PHASE ||
    value.entity !== RECRUITMENT_MAPPING_PLAN_ENTITY ||
    !("recruitmentId" in value) ||
    !("primaryCandidate" in value) ||
    !Array.isArray(value.relatedCandidates) ||
    typeof value.mappingStatus !== "string" ||
    typeof value.readiness !== "string" ||
    !Array.isArray(value.missingInformation) ||
    typeof value.confidence !== "string" ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  if (!SUPPORTED_MAPPING_STATUSES.has(value.mappingStatus)) {
    return false;
  }

  if (!SUPPORTED_READINESS_LEVELS.has(value.readiness)) {
    return false;
  }

  if (!SUPPORTED_CONFIDENCE_LEVELS.has(value.confidence)) {
    return false;
  }

  if (value.primaryCandidate != null && !isPlainObject(value.primaryCandidate)) {
    return false;
  }

  for (let i = 0; i < value.relatedCandidates.length; i += 1) {
    if (!isPlainObject(value.relatedCandidates[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.missingInformation.length; i += 1) {
    if (typeof value.missingInformation[i] !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} plan
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentMappingPlan(plan) {
  const reasons = [];

  if (!isRecruitmentMappingPlan(plan)) {
    return buildValidationResult(["INVALID_MAPPING_PLAN_SHAPE"]);
  }

  if (plan.metadata.performsMapping !== false || plan.metadata.createsRelationships !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (plan.metadata.runtimeIntegration !== false) {
    reasons.push("RUNTIME_INTEGRATION_MUST_BE_FALSE");
  }

  if (
    plan.mappingStatus === MAPPING_STATUS.READY &&
    plan.missingInformation.length > 0
  ) {
    reasons.push("READY_STATUS_REQUIRES_NO_MISSING_INFORMATION");
  }

  if (
    plan.mappingStatus === MAPPING_STATUS.NOT_READY &&
    plan.primaryCandidate != null &&
    !plan.missingInformation.includes(PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY)
  ) {
    reasons.push("NOT_READY_STATUS_INCONSISTENT_WITH_PRIMARY");
  }

  if (
    plan.mappingStatus === MAPPING_STATUS.READY &&
    plan.readiness === READINESS_LEVELS.UNKNOWN
  ) {
    reasons.push("READY_STATUS_REQUIRES_KNOWN_READINESS");
  }

  if (
    plan.mappingStatus === MAPPING_STATUS.NOT_READY &&
    plan.readiness !== READINESS_LEVELS.UNKNOWN
  ) {
    reasons.push("NOT_READY_STATUS_REQUIRES_UNKNOWN_READINESS");
  }

  if (
    plan.primaryCandidate == null &&
    plan.recruitmentId != null &&
    !plan.missingInformation.includes(PLANNING_MISSING_INFORMATION.MISSING_PRIMARY_ENTITY)
  ) {
    reasons.push("RECRUITMENT_ID_WITHOUT_PRIMARY_REQUIRES_MISSING_FLAG");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} plan
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentMappingPlan(plan) {
  const validation = validateRecruitmentMappingPlan(plan);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_MAPPING_PLANNER_PHASE,
      entity: RECRUITMENT_MAPPING_PLAN_ENTITY,
      valid: false,
      recruitmentId: null,
      mappingStatus: MAPPING_STATUS.NOT_READY,
      readiness: READINESS_LEVELS.UNKNOWN,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      missingInformationCount: 0,
      relatedCandidateCount: 0,
      relationshipCount: 0,
      readOnly: true,
      performsMapping: false
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_MAPPING_PLANNER_PHASE,
    entity: RECRUITMENT_MAPPING_PLAN_ENTITY,
    valid: true,
    recruitmentId: plan.recruitmentId,
    mappingStatus: plan.mappingStatus,
    readiness: plan.readiness,
    confidence: plan.confidence,
    missingInformationCount: plan.missingInformation.length,
    relatedCandidateCount: plan.relatedCandidates.length,
    relationshipCount: plan.metadata.relationshipCount ?? 0,
    hasPrimaryCandidate: plan.primaryCandidate != null,
    validationAvailable: plan.metadata.validationAvailable === true,
    validationValid: plan.metadata.validationValid === true,
    timelineAvailable: plan.metadata.timelineAvailable === true,
    lifecycleAvailable: plan.metadata.lifecycleAvailable === true,
    readOnly: true,
    performsMapping: false
  });
}

module.exports = {
  RECRUITMENT_MAPPING_PLANNER_PHASE,
  RECRUITMENT_MAPPING_PLAN_ENTITY,
  MAPPING_STATUS,
  SUPPORTED_MAPPING_STATUSES,
  READINESS_LEVELS,
  SUPPORTED_READINESS_LEVELS,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RELATIONSHIP_TYPES,
  ENTITY_ROLES,
  PLANNING_MISSING_INFORMATION,
  PLANNING_MISSING_INFORMATION_LIST,
  RECRUITMENT_MAPPING_PLANNER_DESCRIPTOR,
  RECRUITMENT_MAPPING_PLANNER_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_MAPPING_PLAN,
  createRecruitmentMappingPlan,
  isRecruitmentMappingPlan,
  validateRecruitmentMappingPlan,
  summarizeRecruitmentMappingPlan
};
