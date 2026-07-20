"use strict";

/**
 * Phase 86 — Recruitment Mapping Candidate Analyzer (Read-only).
 *
 * Pure library that analyzes page-like recruitment entities and determines
 * mapping candidates for future recruitment grouping. Descriptive only —
 * does not perform mapping, database access, or page updates.
 *
 * Accepts plain JavaScript objects and returns a deeply frozen analysis object.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE = 86;

const RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY =
  "recruitment_mapping_candidate_analysis";

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

const PRIMARY_SELECTION_REASONS = Object.freeze({
  EXPLICIT_PRIMARY_METADATA: "explicit_primary_metadata",
  ANCHOR_METADATA: "anchor_metadata",
  NOTIFICATION_EVENT_TYPE: "notification_event_type",
  DETERMINISTIC_FIRST: "deterministic_first"
});

const RELATED_HINT_TYPES = Object.freeze({
  MATCHING_RECRUITMENT_ID: "matching_recruitment_id",
  MATCHING_PARENT_RECRUITMENT_ID: "matching_parent_recruitment_id",
  MATCHING_NORMALIZED_TITLE: "matching_normalized_title",
  EVENT_RELATIONSHIP_METADATA: "event_relationship_metadata"
});

const IGNORE_REASONS = Object.freeze({
  MISSING_ID: "missing_id",
  MISSING_TITLE: "missing_title",
  INSUFFICIENT_IDENTIFYING_INFORMATION: "insufficient_identifying_information"
});

const IGNORE_REASON_LIST = Object.freeze(Object.values(IGNORE_REASONS));

const NOTIFICATION_EVENT_TYPES = Object.freeze(
  new Set(["notification", "short_notification"])
);

const RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA = Object.freeze({
  phase: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsMapping: false,
  mutatesInput: false,
  mutatesOutput: false,
  fetchesEntities: false
});

const RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
  description:
    "Immutable descriptive analysis of recruitment mapping candidates from page-like entities.",
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  ignoreReasons: IGNORE_REASON_LIST,
  primarySelectionReasons: Object.freeze(Object.values(PRIMARY_SELECTION_REASONS)),
  relatedHintTypes: Object.freeze(Object.values(RELATED_HINT_TYPES)),
  metadata: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_ANALYSIS_SUMMARY = Object.freeze({
  totalEntities: 0,
  analyzedEntities: 0,
  primaryCount: 0,
  relatedCount: 0,
  ignoredCount: 0,
  reasons: Object.freeze([])
});

const EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS = deepFreeze({
  phase: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
  entity: RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
  primaryCandidate: null,
  relatedCandidates: Object.freeze([]),
  ignoredCandidates: Object.freeze([]),
  analysisSummary: EMPTY_ANALYSIS_SUMMARY,
  confidence: CONFIDENCE_LEVELS.UNKNOWN,
  metadata: deepFreeze({
    ...RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA,
    createReason: "invalid_input",
    primarySelectionReason: null,
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

function hasIdentifyingInformation(fields) {
  return (
    fields.recruitmentId != null ||
    fields.parentRecruitmentId != null ||
    fields.eventType != null ||
    fields.metadataPrimary === true ||
    fields.metadataAnchor === true ||
    fields.metadataRole != null
  );
}

function classifyEntity(entity) {
  if (!isPlainObject(entity)) {
    return {
      analyzable: false,
      ignoreReasons: [IGNORE_REASONS.INSUFFICIENT_IDENTIFYING_INFORMATION]
    };
  }

  const metadata = isPlainObject(entity.metadata) ? entity.metadata : {};
  const id = normalizeEntityId(entity.id ?? entity.entityId ?? entity.entity_id);
  const title = extractTitle(entity, metadata);
  const eventType = extractEventType(entity, metadata);
  const recruitmentId = extractRecruitmentId(entity, metadata);
  const parentRecruitmentId = extractParentRecruitmentId(entity, metadata);
  const metadataPrimary = isTruthyFlag(metadata.primary);
  const metadataAnchor = isTruthyFlag(metadata.anchor);
  const metadataRole = normalizeString(metadata.role);

  const ignoreReasons = [];

  if (id == null) {
    ignoreReasons.push(IGNORE_REASONS.MISSING_ID);
  }

  if (title == null) {
    ignoreReasons.push(IGNORE_REASONS.MISSING_TITLE);
  }

  if (
    id == null &&
    title == null &&
    !hasIdentifyingInformation({
      recruitmentId,
      parentRecruitmentId,
      eventType,
      metadataPrimary,
      metadataAnchor,
      metadataRole
    })
  ) {
    if (!ignoreReasons.includes(IGNORE_REASONS.INSUFFICIENT_IDENTIFYING_INFORMATION)) {
      ignoreReasons.push(IGNORE_REASONS.INSUFFICIENT_IDENTIFYING_INFORMATION);
    }
  } else if (
    id != null &&
    title != null &&
    !hasIdentifyingInformation({
      recruitmentId,
      parentRecruitmentId,
      eventType,
      metadataPrimary,
      metadataAnchor,
      metadataRole
    }) &&
    !normalizeComparableTitle(title)
  ) {
    ignoreReasons.push(IGNORE_REASONS.INSUFFICIENT_IDENTIFYING_INFORMATION);
  }

  if (ignoreReasons.length > 0) {
    return {
      analyzable: false,
      ignoreReasons: ignoreReasons.sort()
    };
  }

  return {
    analyzable: true,
    normalized: deepFreeze({
      id,
      title,
      normalizedTitle: normalizeComparableTitle(title),
      eventType,
      recruitmentId,
      parentRecruitmentId,
      metadata: normalizeMetadata(metadata),
      metadataPrimary,
      metadataAnchor,
      metadataRole
    })
  };
}

function compareCandidates(left, right) {
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

function dedupeCandidates(candidates) {
  const seen = new Set();
  const deduped = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const key = candidateKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  deduped.sort(compareCandidates);
  return deduped;
}

function buildIgnoredCandidate(entity, ignoreReasons) {
  const metadata = isPlainObject(entity?.metadata) ? normalizeMetadata(entity.metadata) : Object.freeze({});

  return deepFreeze({
    id: normalizeEntityId(entity?.id ?? entity?.entityId ?? entity?.entity_id),
    title: extractTitle(entity ?? {}, metadata),
    eventType: extractEventType(entity ?? {}, metadata),
    recruitmentId: extractRecruitmentId(entity ?? {}, metadata),
    parentRecruitmentId: extractParentRecruitmentId(entity ?? {}, metadata),
    metadata,
    ignoreReasons: Object.freeze(ignoreReasons.slice().sort())
  });
}

function primaryPriority(candidate) {
  if (candidate.metadataPrimary === true) {
    return 4;
  }
  if (candidate.metadataAnchor === true) {
    return 3;
  }
  if (candidate.eventType != null && NOTIFICATION_EVENT_TYPES.has(candidate.eventType)) {
    return 2;
  }
  return 1;
}

function selectPrimaryCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { primaryCandidate: null, selectionReason: null };
  }

  const ranked = candidates.slice().sort((left, right) => {
    const priorityCompare = primaryPriority(right) - primaryPriority(left);
    if (priorityCompare !== 0) {
      return priorityCompare;
    }
    return compareCandidates(left, right);
  });

  const selected = ranked[0];
  let selectionReason = PRIMARY_SELECTION_REASONS.DETERMINISTIC_FIRST;

  if (selected.metadataPrimary === true) {
    selectionReason = PRIMARY_SELECTION_REASONS.EXPLICIT_PRIMARY_METADATA;
  } else if (selected.metadataAnchor === true) {
    selectionReason = PRIMARY_SELECTION_REASONS.ANCHOR_METADATA;
  } else if (
    selected.eventType != null &&
    NOTIFICATION_EVENT_TYPES.has(selected.eventType)
  ) {
    selectionReason = PRIMARY_SELECTION_REASONS.NOTIFICATION_EVENT_TYPE;
  }

  return {
    primaryCandidate: deepFreeze({
      id: selected.id,
      title: selected.title,
      normalizedTitle: selected.normalizedTitle,
      eventType: selected.eventType,
      recruitmentId: selected.recruitmentId,
      parentRecruitmentId: selected.parentRecruitmentId,
      metadata: selected.metadata,
      selectionReason
    }),
    selectionReason
  };
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

function collectRelatedHints(candidate, primary) {
  const hints = [];

  const primaryIds = new Set(
    [primary.id, primary.recruitmentId, primary.parentRecruitmentId]
      .filter((value) => value != null)
      .map((value) => String(value))
  );

  if (candidate.recruitmentId != null) {
    for (const primaryId of primaryIds) {
      if (idsEqual(candidate.recruitmentId, primaryId)) {
        hints.push(RELATED_HINT_TYPES.MATCHING_RECRUITMENT_ID);
        break;
      }
    }
  }

  if (candidate.parentRecruitmentId != null) {
    for (const primaryId of primaryIds) {
      if (idsEqual(candidate.parentRecruitmentId, primaryId)) {
        hints.push(RELATED_HINT_TYPES.MATCHING_PARENT_RECRUITMENT_ID);
        break;
      }
    }
  }

  if (
    candidate.normalizedTitle != null &&
    primary.normalizedTitle != null &&
    candidate.normalizedTitle === primary.normalizedTitle
  ) {
    hints.push(RELATED_HINT_TYPES.MATCHING_NORMALIZED_TITLE);
  }

  const relationshipTarget = extractEventRelationshipTarget(candidate.metadata);
  if (relationshipTarget != null && idsEqual(relationshipTarget, primary.id)) {
    hints.push(RELATED_HINT_TYPES.EVENT_RELATIONSHIP_METADATA);
  }

  return hints.sort();
}

function buildRelatedCandidate(candidate, hints) {
  return deepFreeze({
    id: candidate.id,
    title: candidate.title,
    normalizedTitle: candidate.normalizedTitle,
    eventType: candidate.eventType,
    recruitmentId: candidate.recruitmentId,
    parentRecruitmentId: candidate.parentRecruitmentId,
    metadata: candidate.metadata,
    relationshipHints: Object.freeze(hints.slice())
  });
}

function findRelatedCandidates(candidates, primary) {
  if (primary == null) {
    return [];
  }

  const related = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (idsEqual(candidate.id, primary.id)) {
      continue;
    }

    const hints = collectRelatedHints(candidate, primary);
    if (hints.length === 0) {
      continue;
    }

    related.push(buildRelatedCandidate(candidate, hints));
  }

  return dedupeCandidates(related);
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

function calculateConfidence(primary, relatedCandidates, selectionReason) {
  if (primary == null) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  const signals = [];

  if (selectionReason === PRIMARY_SELECTION_REASONS.EXPLICIT_PRIMARY_METADATA) {
    signals.push(CONFIDENCE_LEVELS.HIGH);
  } else if (selectionReason === PRIMARY_SELECTION_REASONS.ANCHOR_METADATA) {
    signals.push(CONFIDENCE_LEVELS.HIGH);
  } else if (selectionReason === PRIMARY_SELECTION_REASONS.NOTIFICATION_EVENT_TYPE) {
    signals.push(CONFIDENCE_LEVELS.MEDIUM);
  } else {
    signals.push(CONFIDENCE_LEVELS.LOW);
  }

  for (let i = 0; i < relatedCandidates.length; i += 1) {
    const hints = relatedCandidates[i].relationshipHints ?? [];
    if (
      hints.includes(RELATED_HINT_TYPES.MATCHING_RECRUITMENT_ID) ||
      hints.includes(RELATED_HINT_TYPES.MATCHING_PARENT_RECRUITMENT_ID)
    ) {
      signals.push(CONFIDENCE_LEVELS.HIGH);
    } else if (hints.includes(RELATED_HINT_TYPES.EVENT_RELATIONSHIP_METADATA)) {
      signals.push(CONFIDENCE_LEVELS.MEDIUM);
    } else if (hints.includes(RELATED_HINT_TYPES.MATCHING_NORMALIZED_TITLE)) {
      signals.push(CONFIDENCE_LEVELS.MEDIUM);
    } else {
      signals.push(CONFIDENCE_LEVELS.LOW);
    }
  }

  return minConfidence(signals);
}

function buildAnalysisSummary({
  totalEntities,
  analyzedEntities,
  primaryCandidate,
  relatedCandidates,
  ignoredCandidates,
  selectionReason
}) {
  const reasons = [];

  if (primaryCandidate == null && analyzedEntities > 0) {
    reasons.push("NO_PRIMARY_SELECTED");
  }

  if (selectionReason != null) {
    reasons.push(`PRIMARY_${selectionReason.toUpperCase()}`);
  }

  if (ignoredCandidates.length > 0) {
    reasons.push("IGNORED_ENTITIES_PRESENT");
  }

  if (relatedCandidates.length === 0 && primaryCandidate != null && analyzedEntities > 1) {
    reasons.push("NO_RELATED_CANDIDATES");
  }

  return deepFreeze({
    totalEntities,
    analyzedEntities,
    primaryCount: primaryCandidate == null ? 0 : 1,
    relatedCount: relatedCandidates.length,
    ignoredCount: ignoredCandidates.length,
    reasons: Object.freeze(reasons.sort())
  });
}

function normalizeEntitiesInput(entitiesInput) {
  if (!Array.isArray(entitiesInput)) {
    return {
      analyzableCandidates: [],
      ignoredCandidates: [],
      totalEntities: 0,
      duplicateEntitiesSkipped: 0
    };
  }

  const analyzableCandidates = [];
  const ignoredCandidates = [];
  const seenAnalyzableIds = new Set();
  let duplicateEntitiesSkipped = 0;

  for (let i = 0; i < entitiesInput.length; i += 1) {
    const entity = entitiesInput[i];
    const classification = classifyEntity(entity);

    if (!classification.analyzable) {
      ignoredCandidates.push(
        buildIgnoredCandidate(entity, classification.ignoreReasons)
      );
      continue;
    }

    const key = String(classification.normalized.id);
    if (seenAnalyzableIds.has(key)) {
      duplicateEntitiesSkipped += 1;
      continue;
    }

    seenAnalyzableIds.add(key);
    analyzableCandidates.push(classification.normalized);
  }

  analyzableCandidates.sort(compareCandidates);
  ignoredCandidates.sort((left, right) => compareCandidates(left, right));

  return {
    analyzableCandidates,
    ignoredCandidates: dedupeCandidates(ignoredCandidates),
    totalEntities: entitiesInput.length,
    duplicateEntitiesSkipped
  };
}

/**
 * Create an immutable recruitment mapping candidate analysis from plain input.
 * Pure: no I/O, no mutation of input, no mapping execution.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentMappingCandidateAnalysis(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS;
  }

  if (!isPlainObject(input)) {
    return EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS;
  }

  const {
    analyzableCandidates,
    ignoredCandidates,
    totalEntities,
    duplicateEntitiesSkipped
  } = normalizeEntitiesInput(input.entities);

  const { primaryCandidate, selectionReason } = selectPrimaryCandidate(analyzableCandidates);
  const relatedCandidates = findRelatedCandidates(analyzableCandidates, primaryCandidate);
  const confidence = calculateConfidence(primaryCandidate, relatedCandidates, selectionReason);

  const analysisSummary = buildAnalysisSummary({
    totalEntities,
    analyzedEntities: analyzableCandidates.length,
    primaryCandidate,
    relatedCandidates,
    ignoredCandidates,
    selectionReason
  });

  return deepFreeze({
    phase: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
    entity: RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
    primaryCandidate,
    relatedCandidates: Object.freeze(relatedCandidates.slice()),
    ignoredCandidates: Object.freeze(ignoredCandidates.slice()),
    analysisSummary,
    confidence,
    metadata: deepFreeze({
      ...RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA,
      createReason: "analysis_input",
      primarySelectionReason: selectionReason,
      duplicateEntitiesSkipped
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentMappingCandidateAnalysis(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.phase !== RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE ||
    value.entity !== RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY ||
    !("primaryCandidate" in value) ||
    !Array.isArray(value.relatedCandidates) ||
    !Array.isArray(value.ignoredCandidates) ||
    !isPlainObject(value.analysisSummary) ||
    typeof value.confidence !== "string" ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  if (!SUPPORTED_CONFIDENCE_LEVELS.has(value.confidence)) {
    return false;
  }

  const summary = value.analysisSummary;
  if (
    typeof summary.totalEntities !== "number" ||
    typeof summary.analyzedEntities !== "number" ||
    typeof summary.primaryCount !== "number" ||
    typeof summary.relatedCount !== "number" ||
    typeof summary.ignoredCount !== "number" ||
    !Array.isArray(summary.reasons)
  ) {
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

  for (let i = 0; i < value.ignoredCandidates.length; i += 1) {
    if (!isPlainObject(value.ignoredCandidates[i])) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} analysis
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentMappingCandidateAnalysis(analysis) {
  const reasons = [];

  if (!isRecruitmentMappingCandidateAnalysis(analysis)) {
    return buildValidationResult(["INVALID_ANALYSIS_SHAPE"]);
  }

  if (analysis.metadata.performsMapping !== false) {
    reasons.push("PERFORMS_MAPPING_MUST_BE_FALSE");
  }

  if (analysis.metadata.runtimeIntegration !== false) {
    reasons.push("RUNTIME_INTEGRATION_MUST_BE_FALSE");
  }

  if (analysis.metadata.mutatesInput !== false) {
    reasons.push("MUTATES_INPUT_MUST_BE_FALSE");
  }

  if (
    analysis.analysisSummary.primaryCount === 1 &&
    analysis.primaryCandidate == null
  ) {
    reasons.push("PRIMARY_COUNT_REQUIRES_PRIMARY_CANDIDATE");
  }

  if (
    analysis.analysisSummary.primaryCount === 0 &&
    analysis.primaryCandidate != null
  ) {
    reasons.push("MISSING_PRIMARY_COUNT_FOR_PRIMARY_CANDIDATE");
  }

  if (analysis.analysisSummary.relatedCount !== analysis.relatedCandidates.length) {
    reasons.push("RELATED_COUNT_MISMATCH");
  }

  if (analysis.analysisSummary.ignoredCount !== analysis.ignoredCandidates.length) {
    reasons.push("IGNORED_COUNT_MISMATCH");
  }

  const expectedAnalyzed =
    analysis.analysisSummary.primaryCount + analysis.analysisSummary.relatedCount;
  const uniqueRelatedIds = new Set(
    analysis.relatedCandidates.map((candidate) => String(candidate.id))
  );
  const primaryId =
    analysis.primaryCandidate == null ? null : String(analysis.primaryCandidate.id);

  if (primaryId != null && uniqueRelatedIds.has(primaryId)) {
    reasons.push("PRIMARY_CANNOT_APPEAR_IN_RELATED");
  }

  if (
    analysis.analysisSummary.analyzedEntities <
    analysis.analysisSummary.primaryCount + uniqueRelatedIds.size
  ) {
    reasons.push("ANALYZED_ENTITIES_UNDERCOUNT");
  }

  if (expectedAnalyzed > analysis.analysisSummary.analyzedEntities) {
    reasons.push("ANALYZED_ENTITIES_INCONSISTENT");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} analysis
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentMappingCandidateAnalysis(analysis) {
  const validation = validateRecruitmentMappingCandidateAnalysis(analysis);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
      entity: RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
      valid: false,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      primaryCount: 0,
      relatedCount: 0,
      ignoredCount: 0,
      totalEntities: 0,
      readOnly: true,
      performsMapping: false
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
    entity: RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
    valid: true,
    confidence: analysis.confidence,
    primaryCount: analysis.analysisSummary.primaryCount,
    relatedCount: analysis.analysisSummary.relatedCount,
    ignoredCount: analysis.analysisSummary.ignoredCount,
    totalEntities: analysis.analysisSummary.totalEntities,
    analyzedEntities: analysis.analysisSummary.analyzedEntities,
    primarySelectionReason: analysis.metadata.primarySelectionReason ?? null,
    duplicateEntitiesSkipped: analysis.metadata.duplicateEntitiesSkipped ?? 0,
    hasPrimaryCandidate: analysis.primaryCandidate != null,
    readOnly: true,
    performsMapping: false
  });
}

module.exports = {
  RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_PHASE,
  RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS_ENTITY,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  PRIMARY_SELECTION_REASONS,
  RELATED_HINT_TYPES,
  IGNORE_REASONS,
  IGNORE_REASON_LIST,
  RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_DESCRIPTOR,
  RECRUITMENT_MAPPING_CANDIDATE_ANALYZER_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_MAPPING_CANDIDATE_ANALYSIS,
  createRecruitmentMappingCandidateAnalysis,
  isRecruitmentMappingCandidateAnalysis,
  validateRecruitmentMappingCandidateAnalysis,
  summarizeRecruitmentMappingCandidateAnalysis
};
