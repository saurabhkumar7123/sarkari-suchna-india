"use strict";

/**
 * Phase 87 — Existing Recruitment Architecture Analyzer (Read-only).
 *
 * Pure library that analyzes plain JavaScript representations of existing
 * page-like recruitment entities and produces a descriptive architecture
 * analysis for future migration planning. Descriptive only — does not
 * perform migration, database access, or page updates.
 *
 * Accepts plain JavaScript objects and returns a deeply frozen analysis object.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE = 87;

const EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY =
  "existing_recruitment_architecture_analysis";

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const SUPPORTED_CONFIDENCE_LEVELS = Object.freeze(
  new Set(Object.values(CONFIDENCE_LEVELS))
);

const CONFIDENCE_ORDER = Object.freeze({
  [CONFIDENCE_LEVELS.HIGH]: 3,
  [CONFIDENCE_LEVELS.MEDIUM]: 2,
  [CONFIDENCE_LEVELS.LOW]: 1,
  [CONFIDENCE_LEVELS.UNKNOWN]: 0
});

const MIGRATION_READINESS_STATUS = Object.freeze({
  READY: "READY",
  PARTIAL: "PARTIAL",
  NOT_READY: "NOT_READY"
});

const SUPPORTED_MIGRATION_READINESS_STATUSES = Object.freeze(
  new Set(Object.values(MIGRATION_READINESS_STATUS))
);

const ANCHOR_HINT_TYPES = Object.freeze({
  EXPLICIT_PRIMARY_METADATA: "explicit_primary_metadata",
  ANCHOR_METADATA: "anchor_metadata",
  NOTIFICATION_EVENT_TYPE: "notification_event_type",
  SHORT_NOTIFICATION_EVENT_TYPE: "short_notification_event_type"
});

const LIFECYCLE_HINT_TYPES = Object.freeze({
  MATCHING_RECRUITMENT_ID: "matching_recruitment_id",
  MATCHING_PARENT_RECRUITMENT_ID: "matching_parent_recruitment_id",
  EVENT_TYPE_PRESENT: "event_type_present",
  EVENT_RELATIONSHIP_METADATA: "event_relationship_metadata",
  MATCHING_NORMALIZED_TITLE: "matching_normalized_title"
});

const UNSUPPORTED_REASONS = Object.freeze({
  MISSING_ID: "missing_id",
  MISSING_TITLE: "missing_title",
  MALFORMED_STRUCTURE: "malformed_structure"
});

const UNSUPPORTED_REASON_LIST = Object.freeze(Object.values(UNSUPPORTED_REASONS));

const NOTIFICATION_EVENT_TYPES = Object.freeze(
  new Set(["notification", "short_notification"])
);

const EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA = Object.freeze({
  phase: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsMigration: false,
  mutatesInput: false,
  mutatesOutput: false,
  fetchesEntities: false
});

const EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_DESCRIPTOR = Object.freeze({
  entity: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY,
  domain: "recruitment",
  phase: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE,
  description:
    "Immutable descriptive architecture analysis of existing page-like recruitment entities for migration planning.",
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  migrationReadinessStatuses: Object.freeze(Object.values(MIGRATION_READINESS_STATUS)),
  anchorHintTypes: Object.freeze(Object.values(ANCHOR_HINT_TYPES)),
  lifecycleHintTypes: Object.freeze(Object.values(LIFECYCLE_HINT_TYPES)),
  unsupportedReasons: UNSUPPORTED_REASON_LIST,
  metadata: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_ANALYSIS_SUMMARY = Object.freeze({
  anchorCount: 0,
  lifecycleCount: 0,
  standaloneCount: 0,
  unsupportedCount: 0,
  reasons: Object.freeze([])
});

const EMPTY_MIGRATION_READINESS = deepFreeze({
  status: MIGRATION_READINESS_STATUS.NOT_READY,
  confidence: CONFIDENCE_LEVELS.UNKNOWN,
  reasons: Object.freeze(["NO_ENTITIES_PROVIDED"])
});

const EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS = deepFreeze({
  totalEntities: 0,
  anchorCandidates: Object.freeze([]),
  lifecycleCandidates: Object.freeze([]),
  standaloneCandidates: Object.freeze([]),
  unsupportedCandidates: Object.freeze([]),
  analysisSummary: EMPTY_ANALYSIS_SUMMARY,
  migrationReadiness: EMPTY_MIGRATION_READINESS,
  metadata: deepFreeze({
    ...EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA,
    createReason: "invalid_input",
    duplicateEntitiesSkipped: 0
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

function isTruthyFlag(value) {
  if (value === true || value === 1) {
    return true;
  }
  const normalized = normalizeString(value);
  if (normalized == null) {
    return false;
  }
  const lower = normalized.toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1" || lower === "primary" || lower === "anchor";
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

function idsEqual(left, right) {
  if (left == null || right == null) {
    return false;
  }
  return String(left) === String(right);
}

function extractTitle(entity, metadata) {
  return normalizeString(
    entity.title ??
      entity.name ??
      metadata.title ??
      metadata.name ??
      metadata.recruitmentTitle ??
      metadata.recruitment_title ??
      metadata.label
  );
}

function extractEventType(entity, metadata) {
  const raw = entity.eventType ?? entity.event_type ?? metadata.eventType ?? metadata.event_type;
  const normalized = normalizeString(raw);
  return normalized == null ? null : normalized.toLowerCase();
}

function extractRecruitmentId(entity, metadata) {
  return normalizeEntityId(
    entity.recruitmentId ??
      entity.recruitment_id ??
      metadata.recruitmentId ??
      metadata.recruitment_id
  );
}

function extractParentRecruitmentId(entity, metadata) {
  return normalizeEntityId(
    entity.parentRecruitmentId ??
      entity.parent_recruitment_id ??
      metadata.parentRecruitmentId ??
      metadata.parent_recruitment_id ??
      metadata.parentId ??
      metadata.parent_id
  );
}

function extractEventRelationshipTarget(metadata) {
  if (!isPlainObject(metadata)) {
    return null;
  }

  return normalizeEntityId(
    metadata.relatedEntityId ??
      metadata.related_entity_id ??
      metadata.relatedTo ??
      metadata.related_to ??
      metadata.targetEntityId ??
      metadata.target_entity_id ??
      metadata.anchorEntityId ??
      metadata.anchor_entity_id
  );
}

function compareById(left, right) {
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

function candidateKey(candidate) {
  if (candidate == null) {
    return "";
  }
  return String(candidate.id ?? "");
}

function dedupeById(candidates) {
  const seen = new Set();
  const deduped = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const key = candidateKey(candidate);
    if (key === "" || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  deduped.sort(compareById);
  return deduped;
}

function dedupeUnsupportedCandidates(candidates) {
  const seen = new Set();
  const deduped = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const idKey = candidateKey(candidate);
    const reasonKey = Array.isArray(candidate.unsupportedReasons)
      ? candidate.unsupportedReasons.join("|")
      : "";
    const titleKey = candidate.title == null ? "" : String(candidate.title);
    const key =
      idKey !== ""
        ? idKey
        : `__unsupported__:${reasonKey}:${titleKey}:${i}`;

    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  deduped.sort(compareById);
  return deduped;
}

function classifyEntitySupport(entity) {
  if (!isPlainObject(entity)) {
    return {
      supported: false,
      unsupportedReasons: [UNSUPPORTED_REASONS.MALFORMED_STRUCTURE]
    };
  }

  const metadata = isPlainObject(entity.metadata) ? entity.metadata : {};
  const id = normalizeEntityId(entity.id ?? entity.entityId ?? entity.entity_id);
  const title = extractTitle(entity, metadata);
  const unsupportedReasons = [];

  if (id == null) {
    unsupportedReasons.push(UNSUPPORTED_REASONS.MISSING_ID);
  }

  if (title == null) {
    unsupportedReasons.push(UNSUPPORTED_REASONS.MISSING_TITLE);
  }

  if (unsupportedReasons.length > 0) {
    return {
      supported: false,
      unsupportedReasons: unsupportedReasons.sort()
    };
  }

  return {
    supported: true,
    normalized: {
      id,
      title,
      normalizedTitle: normalizeComparableTitle(title),
      eventType: extractEventType(entity, metadata),
      recruitmentId: extractRecruitmentId(entity, metadata),
      parentRecruitmentId: extractParentRecruitmentId(entity, metadata),
      metadata: normalizeMetadata(metadata),
      metadataPrimary: isTruthyFlag(metadata.primary),
      metadataAnchor: isTruthyFlag(metadata.anchor),
      relationshipTarget: extractEventRelationshipTarget(metadata)
    }
  };
}

function buildUnsupportedCandidate(entity, unsupportedReasons) {
  const metadata = isPlainObject(entity?.metadata) ? normalizeMetadata(entity.metadata) : Object.freeze({});

  return deepFreeze({
    id: normalizeEntityId(entity?.id ?? entity?.entityId ?? entity?.entity_id),
    title: extractTitle(entity ?? {}, metadata),
    unsupportedReasons: Object.freeze(unsupportedReasons.slice().sort())
  });
}

function collectAnchorHints(entity) {
  const hints = [];

  if (entity.metadataPrimary === true) {
    hints.push(ANCHOR_HINT_TYPES.EXPLICIT_PRIMARY_METADATA);
  }

  if (entity.metadataAnchor === true) {
    hints.push(ANCHOR_HINT_TYPES.ANCHOR_METADATA);
  }

  if (entity.eventType === "notification") {
    hints.push(ANCHOR_HINT_TYPES.NOTIFICATION_EVENT_TYPE);
  } else if (entity.eventType === "short_notification") {
    hints.push(ANCHOR_HINT_TYPES.SHORT_NOTIFICATION_EVENT_TYPE);
  }

  return hints.sort();
}

function hasAnchorHints(entity) {
  return collectAnchorHints(entity).length > 0;
}

function buildAnchorCandidate(entity, anchorHints) {
  return deepFreeze({
    id: entity.id,
    title: entity.title,
    normalizedTitle: entity.normalizedTitle,
    eventType: entity.eventType,
    recruitmentId: entity.recruitmentId,
    parentRecruitmentId: entity.parentRecruitmentId,
    metadata: entity.metadata,
    anchorHints: Object.freeze(anchorHints.slice())
  });
}

function entityReferenceIds(entity) {
  return new Set(
    [entity.id, entity.recruitmentId, entity.parentRecruitmentId]
      .filter((value) => value != null)
      .map((value) => String(value))
  );
}

function collectLifecycleHints(entity, allEntities) {
  const hints = [];
  const linkedEntityIds = new Set();
  const selfRefs = entityReferenceIds(entity);

  for (let i = 0; i < allEntities.length; i += 1) {
    const other = allEntities[i];
    if (idsEqual(other.id, entity.id)) {
      continue;
    }

    const otherRefs = entityReferenceIds(other);

    if (entity.recruitmentId != null) {
      for (const ref of otherRefs) {
        if (idsEqual(entity.recruitmentId, ref)) {
          hints.push(LIFECYCLE_HINT_TYPES.MATCHING_RECRUITMENT_ID);
          linkedEntityIds.add(String(other.id));
          break;
        }
      }
    }

    if (entity.parentRecruitmentId != null) {
      for (const ref of otherRefs) {
        if (idsEqual(entity.parentRecruitmentId, ref)) {
          hints.push(LIFECYCLE_HINT_TYPES.MATCHING_PARENT_RECRUITMENT_ID);
          linkedEntityIds.add(String(other.id));
          break;
        }
      }
    }

    if (
      entity.normalizedTitle != null &&
      other.normalizedTitle != null &&
      entity.normalizedTitle === other.normalizedTitle
    ) {
      hints.push(LIFECYCLE_HINT_TYPES.MATCHING_NORMALIZED_TITLE);
      linkedEntityIds.add(String(other.id));
    }

    if (entity.relationshipTarget != null && idsEqual(entity.relationshipTarget, other.id)) {
      hints.push(LIFECYCLE_HINT_TYPES.EVENT_RELATIONSHIP_METADATA);
      linkedEntityIds.add(String(other.id));
    }

    for (const selfRef of selfRefs) {
      if (other.relationshipTarget != null && idsEqual(other.relationshipTarget, selfRef)) {
        hints.push(LIFECYCLE_HINT_TYPES.EVENT_RELATIONSHIP_METADATA);
        linkedEntityIds.add(String(other.id));
      }
    }
  }

  if (entity.eventType != null) {
    hints.push(LIFECYCLE_HINT_TYPES.EVENT_TYPE_PRESENT);
  }

  const uniqueHints = [...new Set(hints)].sort();
  const hasLinkage =
    uniqueHints.includes(LIFECYCLE_HINT_TYPES.MATCHING_RECRUITMENT_ID) ||
    uniqueHints.includes(LIFECYCLE_HINT_TYPES.MATCHING_PARENT_RECRUITMENT_ID) ||
    uniqueHints.includes(LIFECYCLE_HINT_TYPES.EVENT_RELATIONSHIP_METADATA) ||
    uniqueHints.includes(LIFECYCLE_HINT_TYPES.MATCHING_NORMALIZED_TITLE);

  return {
    hints: uniqueHints,
    linkedEntityIds: [...linkedEntityIds].sort(),
    hasLinkage
  };
}

function hasLifecycleLinkage(entity, allEntities) {
  return collectLifecycleHints(entity, allEntities).hasLinkage;
}

function buildLifecycleCandidate(entity, lifecycleHints, linkedEntityIds) {
  return deepFreeze({
    id: entity.id,
    title: entity.title,
    normalizedTitle: entity.normalizedTitle,
    eventType: entity.eventType,
    recruitmentId: entity.recruitmentId,
    parentRecruitmentId: entity.parentRecruitmentId,
    metadata: entity.metadata,
    lifecycleHints: Object.freeze(lifecycleHints.slice()),
    linkedEntityIds: Object.freeze(linkedEntityIds.slice())
  });
}

function buildStandaloneCandidate(entity) {
  return deepFreeze({
    id: entity.id,
    title: entity.title,
    normalizedTitle: entity.normalizedTitle,
    eventType: entity.eventType,
    recruitmentId: entity.recruitmentId,
    parentRecruitmentId: entity.parentRecruitmentId,
    metadata: entity.metadata
  });
}

function normalizeEntitiesInput(entitiesInput) {
  if (!Array.isArray(entitiesInput)) {
    return {
      supportedEntities: [],
      unsupportedCandidates: [],
      totalEntities: 0,
      duplicateEntitiesSkipped: 0
    };
  }

  const supportedEntities = [];
  const unsupportedCandidates = [];
  const seenSupportedIds = new Set();
  let duplicateEntitiesSkipped = 0;

  for (let i = 0; i < entitiesInput.length; i += 1) {
    const entity = entitiesInput[i];
    const classification = classifyEntitySupport(entity);

    if (!classification.supported) {
      unsupportedCandidates.push(
        buildUnsupportedCandidate(entity, classification.unsupportedReasons)
      );
      continue;
    }

    const key = String(classification.normalized.id);
    if (seenSupportedIds.has(key)) {
      duplicateEntitiesSkipped += 1;
      continue;
    }

    seenSupportedIds.add(key);
    supportedEntities.push(classification.normalized);
  }

  supportedEntities.sort(compareById);
  unsupportedCandidates.sort(compareById);

  return {
    supportedEntities,
    unsupportedCandidates: dedupeUnsupportedCandidates(unsupportedCandidates),
    totalEntities: entitiesInput.length,
    duplicateEntitiesSkipped
  };
}

function classifySupportedEntities(supportedEntities) {
  const anchorCandidates = [];
  const lifecycleCandidates = [];
  const standaloneCandidates = [];

  for (let i = 0; i < supportedEntities.length; i += 1) {
    const entity = supportedEntities[i];

    if (hasAnchorHints(entity)) {
      anchorCandidates.push(buildAnchorCandidate(entity, collectAnchorHints(entity)));
      continue;
    }

    const lifecycle = collectLifecycleHints(entity, supportedEntities);
    if (lifecycle.hasLinkage) {
      lifecycleCandidates.push(
        buildLifecycleCandidate(entity, lifecycle.hints, lifecycle.linkedEntityIds)
      );
      continue;
    }

    standaloneCandidates.push(buildStandaloneCandidate(entity));
  }

  return {
    anchorCandidates: dedupeById(anchorCandidates),
    lifecycleCandidates: dedupeById(lifecycleCandidates),
    standaloneCandidates: dedupeById(standaloneCandidates)
  };
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

function assessMigrationReadiness({
  totalEntities,
  anchorCandidates,
  lifecycleCandidates,
  standaloneCandidates,
  unsupportedCandidates
}) {
  const reasons = [];
  const supportedCount =
    anchorCandidates.length + lifecycleCandidates.length + standaloneCandidates.length;

  if (totalEntities === 0 || supportedCount === 0) {
    return deepFreeze({
      status: MIGRATION_READINESS_STATUS.NOT_READY,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      reasons: Object.freeze(["NO_SUPPORTED_ENTITIES"])
    });
  }

  if (anchorCandidates.length === 0) {
    reasons.push("NO_ANCHOR_CANDIDATES");
  } else {
    reasons.push("ANCHOR_CANDIDATES_PRESENT");
  }

  if (lifecycleCandidates.length > 0) {
    reasons.push("LIFECYCLE_CANDIDATES_PRESENT");
  }

  if (standaloneCandidates.length > 0) {
    reasons.push("STANDALONE_CANDIDATES_PRESENT");
  }

  if (unsupportedCandidates.length > 0) {
    reasons.push("UNSUPPORTED_ENTITIES_PRESENT");
  }

  const unsupportedRatio = unsupportedCandidates.length / totalEntities;
  const standaloneRatio = standaloneCandidates.length / Math.max(supportedCount, 1);

  let status = MIGRATION_READINESS_STATUS.NOT_READY;
  const confidenceSignals = [];

  if (
    anchorCandidates.length > 0 &&
    lifecycleCandidates.length > 0 &&
    unsupportedRatio === 0 &&
    standaloneCandidates.length === 0
  ) {
    status = MIGRATION_READINESS_STATUS.READY;
    confidenceSignals.push(CONFIDENCE_LEVELS.HIGH);
    reasons.push("ANCHOR_AND_LIFECYCLE_GROUPING_COMPLETE");
  } else if (
    anchorCandidates.length > 0 &&
    lifecycleCandidates.length > 0 &&
    unsupportedRatio <= 0.25 &&
    standaloneRatio <= 0.25
  ) {
    status = MIGRATION_READINESS_STATUS.READY;
    confidenceSignals.push(CONFIDENCE_LEVELS.MEDIUM);
    reasons.push("ANCHOR_AND_LIFECYCLE_WITH_MINOR_GAPS");
  } else if (anchorCandidates.length > 0 && lifecycleCandidates.length > 0) {
    status = MIGRATION_READINESS_STATUS.PARTIAL;
    confidenceSignals.push(CONFIDENCE_LEVELS.MEDIUM);
    reasons.push("ANCHOR_AND_LIFECYCLE_WITH_GAPS");
  } else if (anchorCandidates.length > 0) {
    status = MIGRATION_READINESS_STATUS.PARTIAL;
    confidenceSignals.push(CONFIDENCE_LEVELS.LOW);
    reasons.push("ANCHORS_WITHOUT_LIFECYCLE_GROUPING");
  } else if (lifecycleCandidates.length > 0) {
    status = MIGRATION_READINESS_STATUS.PARTIAL;
    confidenceSignals.push(CONFIDENCE_LEVELS.LOW);
    reasons.push("LIFECYCLE_WITHOUT_ANCHOR");
  } else {
    status = MIGRATION_READINESS_STATUS.NOT_READY;
    confidenceSignals.push(CONFIDENCE_LEVELS.UNKNOWN);
    reasons.push("INSUFFICIENT_ARCHITECTURE_SIGNALS");
  }

  if (unsupportedRatio > 0.5) {
    status = MIGRATION_READINESS_STATUS.NOT_READY;
    confidenceSignals.push(CONFIDENCE_LEVELS.LOW);
    if (!reasons.includes("HIGH_UNSUPPORTED_RATIO")) {
      reasons.push("HIGH_UNSUPPORTED_RATIO");
    }
  }

  return deepFreeze({
    status,
    confidence: minConfidence(confidenceSignals),
    reasons: Object.freeze([...new Set(reasons)].sort())
  });
}

function buildAnalysisSummary({
  anchorCandidates,
  lifecycleCandidates,
  standaloneCandidates,
  unsupportedCandidates
}) {
  const reasons = [];

  if (anchorCandidates.length === 0) {
    reasons.push("NO_ANCHOR_CANDIDATES");
  }

  if (lifecycleCandidates.length === 0 && anchorCandidates.length > 0) {
    reasons.push("NO_LIFECYCLE_CANDIDATES");
  }

  if (standaloneCandidates.length > 0) {
    reasons.push("STANDALONE_ENTITIES_PRESENT");
  }

  if (unsupportedCandidates.length > 0) {
    reasons.push("UNSUPPORTED_ENTITIES_PRESENT");
  }

  return deepFreeze({
    anchorCount: anchorCandidates.length,
    lifecycleCount: lifecycleCandidates.length,
    standaloneCount: standaloneCandidates.length,
    unsupportedCount: unsupportedCandidates.length,
    reasons: Object.freeze(reasons.sort())
  });
}

/**
 * Analyze existing recruitment architecture from plain page-like entity input.
 * Pure: no I/O, no mutation of input, no migration execution.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function analyzeExistingRecruitmentArchitecture(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS;
  }

  if (!isPlainObject(input)) {
    return EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS;
  }

  const {
    supportedEntities,
    unsupportedCandidates,
    totalEntities,
    duplicateEntitiesSkipped
  } = normalizeEntitiesInput(input.entities);

  const { anchorCandidates, lifecycleCandidates, standaloneCandidates } =
    classifySupportedEntities(supportedEntities);

  const analysisSummary = buildAnalysisSummary({
    anchorCandidates,
    lifecycleCandidates,
    standaloneCandidates,
    unsupportedCandidates
  });

  const migrationReadiness = assessMigrationReadiness({
    totalEntities,
    anchorCandidates,
    lifecycleCandidates,
    standaloneCandidates,
    unsupportedCandidates
  });

  return deepFreeze({
    totalEntities,
    anchorCandidates: Object.freeze(anchorCandidates.slice()),
    lifecycleCandidates: Object.freeze(lifecycleCandidates.slice()),
    standaloneCandidates: Object.freeze(standaloneCandidates.slice()),
    unsupportedCandidates: Object.freeze(unsupportedCandidates.slice()),
    analysisSummary,
    migrationReadiness,
    metadata: deepFreeze({
      ...EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA,
      createReason: "architecture_input",
      duplicateEntitiesSkipped
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isExistingRecruitmentArchitectureAnalysis(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.totalEntities !== "number" ||
    !Array.isArray(value.anchorCandidates) ||
    !Array.isArray(value.lifecycleCandidates) ||
    !Array.isArray(value.standaloneCandidates) ||
    !Array.isArray(value.unsupportedCandidates) ||
    !isPlainObject(value.analysisSummary) ||
    !isPlainObject(value.migrationReadiness) ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  const summary = value.analysisSummary;
  if (
    typeof summary.anchorCount !== "number" ||
    typeof summary.lifecycleCount !== "number" ||
    typeof summary.standaloneCount !== "number" ||
    typeof summary.unsupportedCount !== "number" ||
    !Array.isArray(summary.reasons)
  ) {
    return false;
  }

  const readiness = value.migrationReadiness;
  if (
    typeof readiness.status !== "string" ||
    typeof readiness.confidence !== "string" ||
    !Array.isArray(readiness.reasons) ||
    !SUPPORTED_MIGRATION_READINESS_STATUSES.has(readiness.status) ||
    !SUPPORTED_CONFIDENCE_LEVELS.has(readiness.confidence)
  ) {
    return false;
  }

  for (let i = 0; i < value.anchorCandidates.length; i += 1) {
    if (!isPlainObject(value.anchorCandidates[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.lifecycleCandidates.length; i += 1) {
    if (!isPlainObject(value.lifecycleCandidates[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.standaloneCandidates.length; i += 1) {
    if (!isPlainObject(value.standaloneCandidates[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.unsupportedCandidates.length; i += 1) {
    if (!isPlainObject(value.unsupportedCandidates[i])) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} analysis
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateExistingRecruitmentArchitectureAnalysis(analysis) {
  const reasons = [];

  if (!isExistingRecruitmentArchitectureAnalysis(analysis)) {
    return buildValidationResult(["INVALID_ANALYSIS_SHAPE"]);
  }

  if (analysis.metadata.performsMigration !== false) {
    reasons.push("PERFORMS_MIGRATION_MUST_BE_FALSE");
  }

  if (analysis.metadata.runtimeIntegration !== false) {
    reasons.push("RUNTIME_INTEGRATION_MUST_BE_FALSE");
  }

  if (analysis.metadata.mutatesInput !== false) {
    reasons.push("MUTATES_INPUT_MUST_BE_FALSE");
  }

  if (analysis.analysisSummary.anchorCount !== analysis.anchorCandidates.length) {
    reasons.push("ANCHOR_COUNT_MISMATCH");
  }

  if (analysis.analysisSummary.lifecycleCount !== analysis.lifecycleCandidates.length) {
    reasons.push("LIFECYCLE_COUNT_MISMATCH");
  }

  if (analysis.analysisSummary.standaloneCount !== analysis.standaloneCandidates.length) {
    reasons.push("STANDALONE_COUNT_MISMATCH");
  }

  if (analysis.analysisSummary.unsupportedCount !== analysis.unsupportedCandidates.length) {
    reasons.push("UNSUPPORTED_COUNT_MISMATCH");
  }

  const classifiedTotal =
    analysis.anchorCandidates.length +
    analysis.lifecycleCandidates.length +
    analysis.standaloneCandidates.length +
    analysis.unsupportedCandidates.length;

  if (classifiedTotal > analysis.totalEntities) {
    reasons.push("CLASSIFIED_TOTAL_EXCEEDS_TOTAL_ENTITIES");
  }

  const anchorIds = new Set(analysis.anchorCandidates.map((entry) => String(entry.id)));
  const lifecycleIds = new Set(analysis.lifecycleCandidates.map((entry) => String(entry.id)));
  const standaloneIds = new Set(analysis.standaloneCandidates.map((entry) => String(entry.id)));

  for (const id of lifecycleIds) {
    if (anchorIds.has(id)) {
      reasons.push("ENTITY_CANNOT_BE_BOTH_ANCHOR_AND_LIFECYCLE");
      break;
    }
  }

  for (const id of standaloneIds) {
    if (anchorIds.has(id) || lifecycleIds.has(id)) {
      reasons.push("ENTITY_CANNOT_APPEAR_IN_MULTIPLE_SUPPORTED_BUCKETS");
      break;
    }
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} analysis
 * @returns {Readonly<Object>}
 */
function summarizeExistingRecruitmentArchitectureAnalysis(analysis) {
  const validation = validateExistingRecruitmentArchitectureAnalysis(analysis);
  if (!validation.valid) {
    return Object.freeze({
      phase: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE,
      entity: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY,
      valid: false,
      migrationStatus: MIGRATION_READINESS_STATUS.NOT_READY,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      totalEntities: 0,
      anchorCount: 0,
      lifecycleCount: 0,
      standaloneCount: 0,
      unsupportedCount: 0,
      readOnly: true,
      performsMigration: false
    });
  }

  return Object.freeze({
    phase: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE,
    entity: EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY,
    valid: true,
    migrationStatus: analysis.migrationReadiness.status,
    confidence: analysis.migrationReadiness.confidence,
    totalEntities: analysis.totalEntities,
    anchorCount: analysis.analysisSummary.anchorCount,
    lifecycleCount: analysis.analysisSummary.lifecycleCount,
    standaloneCount: analysis.analysisSummary.standaloneCount,
    unsupportedCount: analysis.analysisSummary.unsupportedCount,
    duplicateEntitiesSkipped: analysis.metadata.duplicateEntitiesSkipped ?? 0,
    readOnly: true,
    performsMigration: false
  });
}

module.exports = {
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_PHASE,
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS_ENTITY,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  MIGRATION_READINESS_STATUS,
  SUPPORTED_MIGRATION_READINESS_STATUSES,
  ANCHOR_HINT_TYPES,
  LIFECYCLE_HINT_TYPES,
  UNSUPPORTED_REASONS,
  UNSUPPORTED_REASON_LIST,
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_DESCRIPTOR,
  EXISTING_RECRUITMENT_ARCHITECTURE_ANALYZER_METADATA,
  VALIDATION_STATUS,
  EMPTY_EXISTING_RECRUITMENT_ARCHITECTURE_ANALYSIS,
  analyzeExistingRecruitmentArchitecture,
  isExistingRecruitmentArchitectureAnalysis,
  validateExistingRecruitmentArchitectureAnalysis,
  summarizeExistingRecruitmentArchitectureAnalysis
};
