"use strict";

/**
 * Phase 89 — Backward Compatibility Integration Contract (Read-only).
 *
 * Pure library that describes compatibility guarantees future recruitment
 * implementation must preserve. Evaluates only supplied plain JavaScript
 * objects (migration blueprint, architecture analysis, mapping plan) and
 * returns a deeply frozen integration contract. Descriptive only — does not perform
 * runtime integration, migration, database access, or persistence.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const BACKWARD_COMPATIBILITY_CONTRACT_PHASE = 89;

const BACKWARD_COMPATIBILITY_CONTRACT_ENTITY = "backward_compatibility_contract";

const COMPATIBILITY_STATUS = Object.freeze({
  COMPATIBLE: "COMPATIBLE",
  PARTIALLY_COMPATIBLE: "PARTIALLY_COMPATIBLE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED"
});

const SUPPORTED_COMPATIBILITY_STATUSES = Object.freeze(
  new Set(Object.values(COMPATIBILITY_STATUS))
);

const MIGRATION_STAGES = Object.freeze({
  PREPARATION: "PREPARATION",
  READY_FOR_MIGRATION: "READY_FOR_MIGRATION",
  REQUIRES_REVIEW: "REQUIRES_REVIEW"
});

const SUPPORTED_MIGRATION_STAGES = Object.freeze(new Set(Object.values(MIGRATION_STAGES)));

const READINESS_STATUS = Object.freeze({
  READY: "READY",
  PARTIAL: "PARTIAL",
  NOT_READY: "NOT_READY"
});

const SUPPORTED_READINESS_STATUSES = Object.freeze(new Set(Object.values(READINESS_STATUS)));

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

const PRESERVED_BEHAVIOR_IDS = Object.freeze({
  PAGE_URL_RESOLUTION: "PAGE_URL_RESOLUTION",
  UPDATE_DETECTION_PIPELINE: "UPDATE_DETECTION_PIPELINE",
  WORKER_PIPELINE_DECISIONS: "WORKER_PIPELINE_DECISIONS",
  GENERATOR_AND_PAGE_RENDERING: "GENERATOR_AND_PAGE_RENDERING",
  REVIEW_QUEUE_ADVISORY: "REVIEW_QUEUE_ADVISORY",
  COMPATIBILITY_LAYER_ADDITIVE: "COMPATIBILITY_LAYER_ADDITIVE",
  EXISTING_RECRUITMENT_IDENTIFIERS: "EXISTING_RECRUITMENT_IDENTIFIERS",
  LIFECYCLE_EVENT_VOCABULARY: "LIFECYCLE_EVENT_VOCABULARY",
  MONITORING_AND_DIAGNOSTICS: "MONITORING_AND_DIAGNOSTICS",
  PUBLIC_API_RESPONSE_SHAPES: "PUBLIC_API_RESPONSE_SHAPES"
});

const MIGRATION_CONSTRAINT_IDS = Object.freeze({
  NO_SCHEMA_MIGRATION_WITHOUT_BLUEPRINT: "NO_SCHEMA_MIGRATION_WITHOUT_BLUEPRINT",
  NO_RUNTIME_PERSISTENCE_WITHOUT_CHECKLIST: "NO_RUNTIME_PERSISTENCE_WITHOUT_CHECKLIST",
  FEATURE_FLAG_REQUIRED: "FEATURE_FLAG_REQUIRED",
  NO_ROUTE_CHANGES_WITHOUT_REDIRECT_PLAN: "NO_ROUTE_CHANGES_WITHOUT_REDIRECT_PLAN",
  NO_PIPELINE_BEHAVIOR_CHANGE: "NO_PIPELINE_BEHAVIOR_CHANGE",
  NO_MONITORING_REGRESSION: "NO_MONITORING_REGRESSION",
  PHASED_ROLLOUT_ONLY: "PHASED_ROLLOUT_ONLY",
  PRESERVE_EXISTING_ENTITY_RESOLUTION: "PRESERVE_EXISTING_ENTITY_RESOLUTION"
});

const IMPLEMENTATION_REQUIREMENT_IDS = Object.freeze({
  BLUEPRINT_READY_FOR_MIGRATION: "BLUEPRINT_READY_FOR_MIGRATION",
  ARCHITECTURE_ANALYSIS_READY: "ARCHITECTURE_ANALYSIS_READY",
  MAPPING_PLAN_READY: "MAPPING_PLAN_READY",
  ALL_PREREQUISITES_RESOLVED: "ALL_PREREQUISITES_RESOLVED",
  RELATIONSHIP_VALIDATION_PASSED: "RELATIONSHIP_VALIDATION_PASSED",
  TIMELINE_PROJECTION_AVAILABLE: "TIMELINE_PROJECTION_AVAILABLE",
  LIFECYCLE_EVALUATION_AVAILABLE: "LIFECYCLE_EVALUATION_AVAILABLE",
  IGNORED_CANDIDATES_REVIEWED: "IGNORED_CANDIDATES_REVIEWED",
  UNSUPPORTED_ENTITIES_RESOLVED: "UNSUPPORTED_ENTITIES_RESOLVED",
  DEFERRED_ROLLOUT_ITEMS_PLANNED: "DEFERRED_ROLLOUT_ITEMS_PLANNED",
  MANUAL_REVIEW_COMPLETED: "MANUAL_REVIEW_COMPLETED"
});

const VALIDATION_CHECKLIST_IDS = Object.freeze({
  VERIFY_PAGE_URLS_UNCHANGED: "VERIFY_PAGE_URLS_UNCHANGED",
  VERIFY_UPDATE_DETECTION_UNCHANGED: "VERIFY_UPDATE_DETECTION_UNCHANGED",
  VERIFY_WORKER_PIPELINE_UNCHANGED: "VERIFY_WORKER_PIPELINE_UNCHANGED",
  VERIFY_COMPATIBILITY_LAYER_ADDITIVE: "VERIFY_COMPATIBILITY_LAYER_ADDITIVE",
  VERIFY_NO_UNAPPROVED_PERSISTENCE: "VERIFY_NO_UNAPPROVED_PERSISTENCE",
  VERIFY_FEATURE_FLAGS_DEFAULT_OFF: "VERIFY_FEATURE_FLAGS_DEFAULT_OFF",
  VERIFY_BLUEPRINT_PREREQUISITES_MET: "VERIFY_BLUEPRINT_PREREQUISITES_MET",
  VERIFY_MAPPING_PLAN_VALIDATION: "VERIFY_MAPPING_PLAN_VALIDATION",
  VERIFY_ROLLOUT_DEFERRED_ITEMS: "VERIFY_ROLLOUT_DEFERRED_ITEMS",
  VERIFY_MONITORING_BASELINE: "VERIFY_MONITORING_BASELINE"
});

const PRESERVED_BEHAVIOR_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    id: PRESERVED_BEHAVIOR_IDS.PAGE_URL_RESOLUTION,
    description:
      "Existing page-based recruitment URLs and slugs must remain resolvable throughout phased rollout."
  }),
  Object.freeze({
    order: 2,
    id: PRESERVED_BEHAVIOR_IDS.UPDATE_DETECTION_PIPELINE,
    description:
      "Site update detection, notice ingestion, and telegram notification behavior must remain unchanged."
  }),
  Object.freeze({
    order: 3,
    id: PRESERVED_BEHAVIOR_IDS.WORKER_PIPELINE_DECISIONS,
    description:
      "Worker recruitment pipeline eligibility and detection decisions must not change without explicit feature enablement."
  }),
  Object.freeze({
    order: 4,
    id: PRESERVED_BEHAVIOR_IDS.GENERATOR_AND_PAGE_RENDERING,
    description:
      "Generator output and public page rendering must preserve current recruitment content presentation."
  }),
  Object.freeze({
    order: 5,
    id: PRESERVED_BEHAVIOR_IDS.REVIEW_QUEUE_ADVISORY,
    description:
      "Review queue and eligibility evaluation must remain advisory-only until persistence is explicitly approved."
  }),
  Object.freeze({
    order: 6,
    id: PRESERVED_BEHAVIOR_IDS.COMPATIBILITY_LAYER_ADDITIVE,
    description:
      "Recruitment compatibility context attachment must remain additive-only and must not alter pipeline outcomes."
  }),
  Object.freeze({
    order: 7,
    id: PRESERVED_BEHAVIOR_IDS.EXISTING_RECRUITMENT_IDENTIFIERS,
    description:
      "Existing recruitmentId and parentRecruitmentId fields on page entities must continue to resolve identically."
  }),
  Object.freeze({
    order: 8,
    id: PRESERVED_BEHAVIOR_IDS.LIFECYCLE_EVENT_VOCABULARY,
    description:
      "Current eventType vocabulary on page entities must map to lifecycle events without breaking existing consumers."
  }),
  Object.freeze({
    order: 9,
    id: PRESERVED_BEHAVIOR_IDS.MONITORING_AND_DIAGNOSTICS,
    description:
      "Existing monitoring, logging, and diagnostics signals must not regress during integration rollout."
  }),
  Object.freeze({
    order: 10,
    id: PRESERVED_BEHAVIOR_IDS.PUBLIC_API_RESPONSE_SHAPES,
    description:
      "Public API response shapes for recruitment-related endpoints must remain backward compatible."
  })
]);

const MIGRATION_CONSTRAINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    id: MIGRATION_CONSTRAINT_IDS.NO_SCHEMA_MIGRATION_WITHOUT_BLUEPRINT,
    description:
      "Database schema changes must not occur until the migration blueprint reaches READY_FOR_MIGRATION."
  }),
  Object.freeze({
    order: 2,
    id: MIGRATION_CONSTRAINT_IDS.NO_RUNTIME_PERSISTENCE_WITHOUT_CHECKLIST,
    description:
      "Runtime persistence for recruitment lifecycle data must not be enabled until the validation checklist passes."
  }),
  Object.freeze({
    order: 3,
    id: MIGRATION_CONSTRAINT_IDS.FEATURE_FLAG_REQUIRED,
    description:
      "All new recruitment integration paths must be guarded by feature flags defaulting to disabled."
  }),
  Object.freeze({
    order: 4,
    id: MIGRATION_CONSTRAINT_IDS.NO_ROUTE_CHANGES_WITHOUT_REDIRECT_PLAN,
    description:
      "Page route and URL changes must not ship without an approved redirect and backfill plan."
  }),
  Object.freeze({
    order: 5,
    id: MIGRATION_CONSTRAINT_IDS.NO_PIPELINE_BEHAVIOR_CHANGE,
    description:
      "runRecruitmentPipeline and siteWorker orchestration must not alter existing decision outcomes."
  }),
  Object.freeze({
    order: 6,
    id: MIGRATION_CONSTRAINT_IDS.NO_MONITORING_REGRESSION,
    description:
      "Monitoring and alerting baselines must be established before enabling lifecycle integration."
  }),
  Object.freeze({
    order: 7,
    id: MIGRATION_CONSTRAINT_IDS.PHASED_ROLLOUT_ONLY,
    description:
      "Rollout must proceed in phases — no big-bang migration of page entities to lifecycle aggregates."
  }),
  Object.freeze({
    order: 8,
    id: MIGRATION_CONSTRAINT_IDS.PRESERVE_EXISTING_ENTITY_RESOLUTION,
    description:
      "Page entity to recruitment resolution must preserve current anchor and related-entity grouping semantics."
  })
]);

const IMPLEMENTATION_REQUIREMENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    id: IMPLEMENTATION_REQUIREMENT_IDS.BLUEPRINT_READY_FOR_MIGRATION,
    description:
      "Migration blueprint must report READY_FOR_MIGRATION stage with READY readiness status."
  }),
  Object.freeze({
    order: 2,
    id: IMPLEMENTATION_REQUIREMENT_IDS.ARCHITECTURE_ANALYSIS_READY,
    description:
      "Architecture analysis must report READY migration readiness with no unsupported entity blockers."
  }),
  Object.freeze({
    order: 3,
    id: IMPLEMENTATION_REQUIREMENT_IDS.MAPPING_PLAN_READY,
    description:
      "Mapping plan must report READY status with primary anchor and related entities identified."
  }),
  Object.freeze({
    order: 4,
    id: IMPLEMENTATION_REQUIREMENT_IDS.ALL_PREREQUISITES_RESOLVED,
    description:
      "All blueprint prerequisites must be resolved before production integration is enabled."
  }),
  Object.freeze({
    order: 5,
    id: IMPLEMENTATION_REQUIREMENT_IDS.RELATIONSHIP_VALIDATION_PASSED,
    description:
      "Relationship validation must pass when validation results are available in the mapping plan."
  }),
  Object.freeze({
    order: 6,
    id: IMPLEMENTATION_REQUIREMENT_IDS.TIMELINE_PROJECTION_AVAILABLE,
    description:
      "Timeline projection must be available and aligned with the planned recruitment mapping."
  }),
  Object.freeze({
    order: 7,
    id: IMPLEMENTATION_REQUIREMENT_IDS.LIFECYCLE_EVALUATION_AVAILABLE,
    description:
      "Lifecycle state evaluation must be available and consistent with timeline projection."
  }),
  Object.freeze({
    order: 8,
    id: IMPLEMENTATION_REQUIREMENT_IDS.IGNORED_CANDIDATES_REVIEWED,
    description:
      "All ignored mapping candidates must be manually reviewed and dispositioned before rollout."
  }),
  Object.freeze({
    order: 9,
    id: IMPLEMENTATION_REQUIREMENT_IDS.UNSUPPORTED_ENTITIES_RESOLVED,
    description:
      "Unsupported page entities identified in architecture analysis must be resolved or explicitly deferred."
  }),
  Object.freeze({
    order: 10,
    id: IMPLEMENTATION_REQUIREMENT_IDS.DEFERRED_ROLLOUT_ITEMS_PLANNED,
    description:
      "All deferred production rollout items from the migration blueprint must have an approved plan."
  }),
  Object.freeze({
    order: 11,
    id: IMPLEMENTATION_REQUIREMENT_IDS.MANUAL_REVIEW_COMPLETED,
    description:
      "Manual review must be completed when the migration blueprint requires review."
  })
]);

const VALIDATION_CHECKLIST_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_PAGE_URLS_UNCHANGED,
    description:
      "Confirm existing recruitment page URLs resolve and return equivalent content after integration changes."
  }),
  Object.freeze({
    order: 2,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_UPDATE_DETECTION_UNCHANGED,
    description:
      "Confirm site update detection produces identical notice payloads for known recruitment fixtures."
  }),
  Object.freeze({
    order: 3,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_WORKER_PIPELINE_UNCHANGED,
    description:
      "Confirm worker recruitment pipeline decisions match baseline for representative update samples."
  }),
  Object.freeze({
    order: 4,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_COMPATIBILITY_LAYER_ADDITIVE,
    description:
      "Confirm compatibility layer attachment does not alter pipeline eligibility or matching outcomes."
  }),
  Object.freeze({
    order: 5,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_NO_UNAPPROVED_PERSISTENCE,
    description:
      "Confirm no unapproved recruitment persistence writes occur during observation or dry-run phases."
  }),
  Object.freeze({
    order: 6,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_FEATURE_FLAGS_DEFAULT_OFF,
    description:
      "Confirm all recruitment integration feature flags default to disabled in production configuration."
  }),
  Object.freeze({
    order: 7,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_BLUEPRINT_PREREQUISITES_MET,
    description:
      "Confirm all migration blueprint prerequisites are resolved per the approved blueprint."
  }),
  Object.freeze({
    order: 8,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_MAPPING_PLAN_VALIDATION,
    description:
      "Confirm mapping plan relationship validation passes for all planned lifecycle groupings."
  }),
  Object.freeze({
    order: 9,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_ROLLOUT_DEFERRED_ITEMS,
    description:
      "Confirm each deferred rollout item from the blueprint has a documented completion or deferral decision."
  }),
  Object.freeze({
    order: 10,
    id: VALIDATION_CHECKLIST_IDS.VERIFY_MONITORING_BASELINE,
    description:
      "Confirm monitoring and alerting baselines are captured before enabling lifecycle integration."
  })
]);

const BACKWARD_COMPATIBILITY_CONTRACT_METADATA = Object.freeze({
  phase: BACKWARD_COMPATIBILITY_CONTRACT_PHASE,
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
  generatesSql: false,
  fetchesEntities: false
});

const BACKWARD_COMPATIBILITY_CONTRACT_DESCRIPTOR = Object.freeze({
  entity: BACKWARD_COMPATIBILITY_CONTRACT_ENTITY,
  domain: "recruitment",
  phase: BACKWARD_COMPATIBILITY_CONTRACT_PHASE,
  description:
    "Immutable backward compatibility integration contract describing guarantees for future recruitment implementation.",
  compatibilityStatuses: Object.freeze(Object.values(COMPATIBILITY_STATUS)),
  preservedBehaviorCount: PRESERVED_BEHAVIOR_DEFINITIONS.length,
  migrationConstraintCount: MIGRATION_CONSTRAINT_DEFINITIONS.length,
  implementationRequirementCount: IMPLEMENTATION_REQUIREMENT_DEFINITIONS.length,
  validationChecklistCount: VALIDATION_CHECKLIST_DEFINITIONS.length,
  metadata: BACKWARD_COMPATIBILITY_CONTRACT_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_BACKWARD_COMPATIBILITY_CONTRACT = deepFreeze({
  compatibilityStatus: COMPATIBILITY_STATUS.REVIEW_REQUIRED,
  preservedBehaviors: Object.freeze(buildContractItems(PRESERVED_BEHAVIOR_DEFINITIONS)),
  migrationConstraints: Object.freeze(buildContractItems(MIGRATION_CONSTRAINT_DEFINITIONS)),
  implementationRequirements: Object.freeze(
    IMPLEMENTATION_REQUIREMENT_DEFINITIONS.map((item) =>
      deepFreeze({
        order: item.order,
        id: item.id,
        description: item.description,
        satisfied: false
      })
    )
  ),
  validationChecklist: Object.freeze(
    VALIDATION_CHECKLIST_DEFINITIONS.map((item) =>
      deepFreeze({
        order: item.order,
        id: item.id,
        description: item.description,
        required: true
      })
    )
  ),
  metadata: deepFreeze({
    ...BACKWARD_COMPATIBILITY_CONTRACT_METADATA,
    createReason: "invalid_input",
    migrationBlueprintAvailable: false,
    architectureAnalysisAvailable: false,
    mappingPlanAvailable: false,
    blueprintStage: MIGRATION_STAGES.REQUIRES_REVIEW,
    blueprintReadinessStatus: READINESS_STATUS.NOT_READY,
    prerequisiteCount: 0,
    riskCount: 0,
    deferredItemCount: 0,
    unsatisfiedRequirementCount: IMPLEMENTATION_REQUIREMENT_DEFINITIONS.length,
    confidence: CONFIDENCE_LEVELS.UNKNOWN
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

function normalizeConfidence(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }
  const lower = normalized.toLowerCase();
  return SUPPORTED_CONFIDENCE_LEVELS.has(lower) ? lower : CONFIDENCE_LEVELS.UNKNOWN;
}

function normalizeReadinessStatus(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const upper = normalized.toUpperCase();
  return SUPPORTED_READINESS_STATUSES.has(upper) ? upper : null;
}

function normalizeMigrationStage(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const upper = normalized.toUpperCase();
  return SUPPORTED_MIGRATION_STAGES.has(upper) ? upper : null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const result = [];
  for (let i = 0; i < value.length; i += 1) {
    const entry = normalizeString(value[i]);
    if (entry != null) {
      result.push(entry);
    }
  }
  return result;
}

function sortUniqueStrings(values) {
  const seen = new Set();
  const sorted = values.slice().sort();
  const result = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i];
    if (!seen.has(entry)) {
      seen.add(entry);
      result.push(entry);
    }
  }
  return result;
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
  const normalizedReasons = sortUniqueStrings(reasons);
  if (normalizedReasons.length === 0) {
    return deepFreeze({
      valid: true,
      status: VALIDATION_STATUS.VALID,
      reasons: Object.freeze([])
    });
  }
  return deepFreeze({
    valid: false,
    status: VALIDATION_STATUS.INVALID,
    reasons: Object.freeze(normalizedReasons)
  });
}

function buildContractItems(definitions) {
  return definitions.map((item) =>
    deepFreeze({
      order: item.order,
      id: item.id,
      description: item.description
    })
  );
}

function countFromSummaryOrArray(summaryValue, arrayValue) {
  if (typeof summaryValue === "number" && Number.isFinite(summaryValue) && summaryValue >= 0) {
    return summaryValue;
  }
  if (Array.isArray(arrayValue)) {
    return arrayValue.length;
  }
  return 0;
}

function resolveAggregateConfidence(confidences) {
  if (confidences.length === 0) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }
  let lowest = CONFIDENCE_ORDER[CONFIDENCE_LEVELS.HIGH];
  let result = CONFIDENCE_LEVELS.HIGH;
  for (let i = 0; i < confidences.length; i += 1) {
    const order = CONFIDENCE_ORDER[confidences[i]] ?? 0;
    if (order < lowest) {
      lowest = order;
      result = confidences[i];
    }
  }
  return result;
}

function normalizeMigrationBlueprint(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const migrationReadiness = isPlainObject(value.migrationReadiness) ? value.migrationReadiness : {};
  const risks = Array.isArray(value.risks) ? value.risks : [];
  const deferredItems = Array.isArray(value.deferredItems) ? value.deferredItems : [];

  return {
    migrationStage: normalizeMigrationStage(value.migrationStage),
    readinessStatus: normalizeReadinessStatus(migrationReadiness.status),
    confidence: normalizeConfidence(migrationReadiness.confidence),
    reasons: normalizeStringArray(migrationReadiness.reasons),
    prerequisites: sortUniqueStrings(normalizeStringArray(value.prerequisites)),
    riskCount: risks.length,
    deferredItemCount: deferredItems.length,
    hasIgnoredCandidatePrerequisite: normalizeStringArray(value.prerequisites).includes(
      "IGNORED_CANDIDATES_REQUIRE_REVIEW"
    ),
    hasUnsupportedEntitiesPrerequisite: normalizeStringArray(value.prerequisites).includes(
      "UNSUPPORTED_ENTITIES_IN_ARCHITECTURE"
    ),
    hasStandaloneEntitiesPrerequisite: normalizeStringArray(value.prerequisites).includes(
      "STANDALONE_ENTITIES_IN_ARCHITECTURE"
    )
  };
}

function normalizeArchitectureAnalysis(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const migrationReadiness = isPlainObject(value.migrationReadiness) ? value.migrationReadiness : {};
  const analysisSummary = isPlainObject(value.analysisSummary) ? value.analysisSummary : {};

  return {
    status: normalizeReadinessStatus(migrationReadiness.status),
    confidence: normalizeConfidence(migrationReadiness.confidence),
    reasons: normalizeStringArray(migrationReadiness.reasons),
    anchorCount: countFromSummaryOrArray(analysisSummary.anchorCount, value.anchorCandidates),
    lifecycleCount: countFromSummaryOrArray(analysisSummary.lifecycleCount, value.lifecycleCandidates),
    standaloneCount: countFromSummaryOrArray(
      analysisSummary.standaloneCount,
      value.standaloneCandidates
    ),
    unsupportedCount: countFromSummaryOrArray(
      analysisSummary.unsupportedCount,
      value.unsupportedCandidates
    )
  };
}

function normalizeMappingPlan(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    status: normalizeReadinessStatus(value.mappingStatus),
    confidence: normalizeConfidence(value.confidence),
    missingInformation: sortUniqueStrings(normalizeStringArray(value.missingInformation)),
    hasPrimary: isPlainObject(value.primaryCandidate),
    relatedCount: Array.isArray(value.relatedCandidates) ? value.relatedCandidates.length : 0,
    validationAvailable: value.metadata?.validationAvailable === true,
    validationValid: value.metadata?.validationValid === true,
    timelineAvailable: value.metadata?.timelineAvailable === true,
    lifecycleAvailable: value.metadata?.lifecycleAvailable === true
  };
}

function blueprintExplicitlyRequiresReview(blueprint) {
  if (blueprint == null) {
    return false;
  }
  if (blueprint.migrationStage === MIGRATION_STAGES.REQUIRES_REVIEW) {
    return true;
  }
  if (blueprint.hasIgnoredCandidatePrerequisite) {
    return true;
  }
  if (
    blueprint.reasons.includes("MANUAL_REVIEW_REQUIRED") ||
    blueprint.prerequisites.includes("IGNORED_CANDIDATES_REQUIRE_REVIEW")
  ) {
    return true;
  }
  return false;
}

function resolveCompatibilityStatus(blueprint, architecture, mappingPlan) {
  if (blueprintExplicitlyRequiresReview(blueprint)) {
    return COMPATIBILITY_STATUS.REVIEW_REQUIRED;
  }

  const blueprintReady =
    blueprint != null &&
    blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
    blueprint.readinessStatus === READINESS_STATUS.READY &&
    blueprint.prerequisites.length === 0;

  const architectureReady =
    architecture != null && architecture.status === READINESS_STATUS.READY;

  const mappingReady = mappingPlan != null && mappingPlan.status === READINESS_STATUS.READY;

  if (blueprintReady && architectureReady && mappingReady) {
    return COMPATIBILITY_STATUS.COMPATIBLE;
  }

  if (blueprint == null && architecture == null && mappingPlan == null) {
    return COMPATIBILITY_STATUS.REVIEW_REQUIRED;
  }

  if (
    blueprint != null &&
    blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
    blueprint.prerequisites.length > 0
  ) {
    return COMPATIBILITY_STATUS.REVIEW_REQUIRED;
  }

  return COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE;
}

function evaluateRequirementSatisfaction(requirementId, blueprint, architecture, mappingPlan) {
  switch (requirementId) {
    case IMPLEMENTATION_REQUIREMENT_IDS.BLUEPRINT_READY_FOR_MIGRATION:
      return (
        blueprint != null &&
        blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
        blueprint.readinessStatus === READINESS_STATUS.READY
      );
    case IMPLEMENTATION_REQUIREMENT_IDS.ARCHITECTURE_ANALYSIS_READY:
      return (
        architecture != null &&
        architecture.status === READINESS_STATUS.READY &&
        architecture.unsupportedCount === 0
      );
    case IMPLEMENTATION_REQUIREMENT_IDS.MAPPING_PLAN_READY:
      return mappingPlan != null && mappingPlan.status === READINESS_STATUS.READY;
    case IMPLEMENTATION_REQUIREMENT_IDS.ALL_PREREQUISITES_RESOLVED:
      return blueprint != null && blueprint.prerequisites.length === 0;
    case IMPLEMENTATION_REQUIREMENT_IDS.RELATIONSHIP_VALIDATION_PASSED:
      if (mappingPlan == null) {
        return false;
      }
      if (!mappingPlan.validationAvailable) {
        return mappingPlan.status === READINESS_STATUS.READY;
      }
      return mappingPlan.validationValid;
    case IMPLEMENTATION_REQUIREMENT_IDS.TIMELINE_PROJECTION_AVAILABLE:
      return mappingPlan != null && mappingPlan.timelineAvailable;
    case IMPLEMENTATION_REQUIREMENT_IDS.LIFECYCLE_EVALUATION_AVAILABLE:
      return mappingPlan != null && mappingPlan.lifecycleAvailable;
    case IMPLEMENTATION_REQUIREMENT_IDS.IGNORED_CANDIDATES_REVIEWED:
      return blueprint == null || !blueprint.hasIgnoredCandidatePrerequisite;
    case IMPLEMENTATION_REQUIREMENT_IDS.UNSUPPORTED_ENTITIES_RESOLVED:
      return (
        architecture == null ||
        (architecture.unsupportedCount === 0 && !blueprint?.hasUnsupportedEntitiesPrerequisite)
      );
    case IMPLEMENTATION_REQUIREMENT_IDS.DEFERRED_ROLLOUT_ITEMS_PLANNED:
      return (
        blueprint != null &&
        blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
        blueprint.deferredItemCount > 0
      );
    case IMPLEMENTATION_REQUIREMENT_IDS.MANUAL_REVIEW_COMPLETED:
      return blueprint != null && !blueprintExplicitlyRequiresReview(blueprint);
    default:
      return false;
  }
}

function buildImplementationRequirements(blueprint, architecture, mappingPlan) {
  return IMPLEMENTATION_REQUIREMENT_DEFINITIONS.map((item) =>
    deepFreeze({
      order: item.order,
      id: item.id,
      description: item.description,
      satisfied: evaluateRequirementSatisfaction(item.id, blueprint, architecture, mappingPlan)
    })
  );
}

function resolveChecklistItemRequired(checklistId, blueprint, compatibilityStatus) {
  if (compatibilityStatus === COMPATIBILITY_STATUS.COMPATIBLE) {
    return true;
  }

  switch (checklistId) {
    case VALIDATION_CHECKLIST_IDS.VERIFY_BLUEPRINT_PREREQUISITES_MET:
    case VALIDATION_CHECKLIST_IDS.VERIFY_MAPPING_PLAN_VALIDATION:
    case VALIDATION_CHECKLIST_IDS.VERIFY_ROLLOUT_DEFERRED_ITEMS:
      return blueprint != null;
    default:
      return true;
  }
}

function buildValidationChecklist(blueprint, compatibilityStatus) {
  return VALIDATION_CHECKLIST_DEFINITIONS.map((item) =>
    deepFreeze({
      order: item.order,
      id: item.id,
      description: item.description,
      required: resolveChecklistItemRequired(item.id, blueprint, compatibilityStatus)
    })
  );
}

function resolveContractConfidence(blueprint, architecture, mappingPlan) {
  const confidences = [];
  if (blueprint != null) {
    confidences.push(blueprint.confidence);
  }
  if (architecture != null) {
    confidences.push(architecture.confidence);
  }
  if (mappingPlan != null) {
    confidences.push(mappingPlan.confidence);
  }
  return resolveAggregateConfidence(confidences);
}

/**
 * Create an immutable backward compatibility integration contract from plain input.
 * Pure: no I/O, no mutation of input, no runtime integration.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createBackwardCompatibilityContract(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_BACKWARD_COMPATIBILITY_CONTRACT;
  }

  if (!isPlainObject(input)) {
    return EMPTY_BACKWARD_COMPATIBILITY_CONTRACT;
  }

  const blueprint = normalizeMigrationBlueprint(input.migrationBlueprint);
  const architecture = normalizeArchitectureAnalysis(input.architectureAnalysis);
  const mappingPlan = normalizeMappingPlan(input.mappingPlan);

  const compatibilityStatus = resolveCompatibilityStatus(blueprint, architecture, mappingPlan);
  const implementationRequirements = buildImplementationRequirements(
    blueprint,
    architecture,
    mappingPlan
  );
  const unsatisfiedRequirementCount = implementationRequirements.filter(
    (item) => item.satisfied !== true
  ).length;

  return deepFreeze({
    compatibilityStatus,
    preservedBehaviors: Object.freeze(buildContractItems(PRESERVED_BEHAVIOR_DEFINITIONS)),
    migrationConstraints: Object.freeze(buildContractItems(MIGRATION_CONSTRAINT_DEFINITIONS)),
    implementationRequirements: Object.freeze(implementationRequirements),
    validationChecklist: Object.freeze(
      buildValidationChecklist(blueprint, compatibilityStatus)
    ),
    metadata: deepFreeze({
      ...BACKWARD_COMPATIBILITY_CONTRACT_METADATA,
      createReason: "contract_input",
      migrationBlueprintAvailable: blueprint != null,
      architectureAnalysisAvailable: architecture != null,
      mappingPlanAvailable: mappingPlan != null,
      blueprintStage: blueprint?.migrationStage ?? MIGRATION_STAGES.REQUIRES_REVIEW,
      blueprintReadinessStatus: blueprint?.readinessStatus ?? READINESS_STATUS.NOT_READY,
      prerequisiteCount: blueprint?.prerequisites.length ?? 0,
      riskCount: blueprint?.riskCount ?? 0,
      deferredItemCount: blueprint?.deferredItemCount ?? 0,
      unsatisfiedRequirementCount,
      confidence: resolveContractConfidence(blueprint, architecture, mappingPlan)
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isBackwardCompatibilityContract(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !SUPPORTED_COMPATIBILITY_STATUSES.has(value.compatibilityStatus) ||
    !Array.isArray(value.preservedBehaviors) ||
    !Array.isArray(value.migrationConstraints) ||
    !Array.isArray(value.implementationRequirements) ||
    !Array.isArray(value.validationChecklist) ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  const contractItemArrays = [
    value.preservedBehaviors,
    value.migrationConstraints
  ];

  for (let arrayIndex = 0; arrayIndex < contractItemArrays.length; arrayIndex += 1) {
    const items = contractItemArrays[arrayIndex];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (
        !isPlainObject(item) ||
        typeof item.order !== "number" ||
        typeof item.id !== "string" ||
        typeof item.description !== "string"
      ) {
        return false;
      }
    }
  }

  for (let i = 0; i < value.implementationRequirements.length; i += 1) {
    const item = value.implementationRequirements[i];
    if (
      !isPlainObject(item) ||
      typeof item.order !== "number" ||
      typeof item.id !== "string" ||
      typeof item.description !== "string" ||
      typeof item.satisfied !== "boolean"
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.validationChecklist.length; i += 1) {
    const item = value.validationChecklist[i];
    if (
      !isPlainObject(item) ||
      typeof item.order !== "number" ||
      typeof item.id !== "string" ||
      typeof item.description !== "string" ||
      typeof item.required !== "boolean"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} contract
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateBackwardCompatibilityContract(contract) {
  const reasons = [];

  if (!isBackwardCompatibilityContract(contract)) {
    return buildValidationResult(["INVALID_CONTRACT_SHAPE"]);
  }

  if (contract.metadata.runtimeIntegration !== false) {
    reasons.push("RUNTIME_INTEGRATION_MUST_BE_FALSE");
  }

  if (contract.metadata.performsMigration !== false) {
    reasons.push("PERFORMS_MIGRATION_MUST_BE_FALSE");
  }

  if (contract.metadata.generatesSql !== false) {
    reasons.push("GENERATES_SQL_MUST_BE_FALSE");
  }

  if (
    contract.compatibilityStatus === COMPATIBILITY_STATUS.COMPATIBLE &&
    contract.metadata.unsatisfiedRequirementCount > 0
  ) {
    reasons.push("COMPATIBLE_REQUIRES_ALL_REQUIREMENTS_SATISFIED");
  }

  if (
    contract.compatibilityStatus === COMPATIBILITY_STATUS.COMPATIBLE &&
    contract.metadata.blueprintStage !== MIGRATION_STAGES.READY_FOR_MIGRATION
  ) {
    reasons.push("COMPATIBLE_REQUIRES_READY_FOR_MIGRATION_BLUEPRINT");
  }

  const behaviorOrders = contract.preservedBehaviors.map((item) => item.order);
  for (let i = 0; i < behaviorOrders.length; i += 1) {
    if (behaviorOrders[i] !== i + 1) {
      reasons.push("PRESERVED_BEHAVIORS_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  const constraintOrders = contract.migrationConstraints.map((item) => item.order);
  for (let i = 0; i < constraintOrders.length; i += 1) {
    if (constraintOrders[i] !== i + 1) {
      reasons.push("MIGRATION_CONSTRAINTS_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  const requirementOrders = contract.implementationRequirements.map((item) => item.order);
  for (let i = 0; i < requirementOrders.length; i += 1) {
    if (requirementOrders[i] !== i + 1) {
      reasons.push("IMPLEMENTATION_REQUIREMENTS_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  const checklistOrders = contract.validationChecklist.map((item) => item.order);
  for (let i = 0; i < checklistOrders.length; i += 1) {
    if (checklistOrders[i] !== i + 1) {
      reasons.push("VALIDATION_CHECKLIST_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} contract
 * @returns {Readonly<Object>}
 */
function summarizeBackwardCompatibilityContract(contract) {
  const validation = validateBackwardCompatibilityContract(contract);
  if (!validation.valid) {
    return Object.freeze({
      phase: BACKWARD_COMPATIBILITY_CONTRACT_PHASE,
      entity: BACKWARD_COMPATIBILITY_CONTRACT_ENTITY,
      valid: false,
      compatibilityStatus: COMPATIBILITY_STATUS.REVIEW_REQUIRED,
      preservedBehaviorCount: 0,
      migrationConstraintCount: 0,
      implementationRequirementCount: 0,
      validationChecklistCount: 0,
      unsatisfiedRequirementCount: 0,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      readOnly: true,
      performsMigration: false
    });
  }

  const satisfiedCount = contract.implementationRequirements.filter(
    (item) => item.satisfied === true
  ).length;

  return Object.freeze({
    phase: BACKWARD_COMPATIBILITY_CONTRACT_PHASE,
    entity: BACKWARD_COMPATIBILITY_CONTRACT_ENTITY,
    valid: true,
    compatibilityStatus: contract.compatibilityStatus,
    preservedBehaviorCount: contract.preservedBehaviors.length,
    migrationConstraintCount: contract.migrationConstraints.length,
    implementationRequirementCount: contract.implementationRequirements.length,
    validationChecklistCount: contract.validationChecklist.length,
    satisfiedRequirementCount: satisfiedCount,
    unsatisfiedRequirementCount: contract.metadata.unsatisfiedRequirementCount,
    migrationBlueprintAvailable: contract.metadata.migrationBlueprintAvailable === true,
    architectureAnalysisAvailable: contract.metadata.architectureAnalysisAvailable === true,
    mappingPlanAvailable: contract.metadata.mappingPlanAvailable === true,
    blueprintStage: contract.metadata.blueprintStage,
    confidence: contract.metadata.confidence,
    readOnly: true,
    performsMigration: false
  });
}

module.exports = {
  BACKWARD_COMPATIBILITY_CONTRACT_PHASE,
  BACKWARD_COMPATIBILITY_CONTRACT_ENTITY,
  COMPATIBILITY_STATUS,
  SUPPORTED_COMPATIBILITY_STATUSES,
  MIGRATION_STAGES,
  SUPPORTED_MIGRATION_STAGES,
  READINESS_STATUS,
  SUPPORTED_READINESS_STATUSES,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  PRESERVED_BEHAVIOR_IDS,
  MIGRATION_CONSTRAINT_IDS,
  IMPLEMENTATION_REQUIREMENT_IDS,
  VALIDATION_CHECKLIST_IDS,
  PRESERVED_BEHAVIOR_DEFINITIONS,
  MIGRATION_CONSTRAINT_DEFINITIONS,
  IMPLEMENTATION_REQUIREMENT_DEFINITIONS,
  VALIDATION_CHECKLIST_DEFINITIONS,
  BACKWARD_COMPATIBILITY_CONTRACT_DESCRIPTOR,
  BACKWARD_COMPATIBILITY_CONTRACT_METADATA,
  VALIDATION_STATUS,
  EMPTY_BACKWARD_COMPATIBILITY_CONTRACT,
  createBackwardCompatibilityContract,
  isBackwardCompatibilityContract,
  validateBackwardCompatibilityContract,
  summarizeBackwardCompatibilityContract
};
