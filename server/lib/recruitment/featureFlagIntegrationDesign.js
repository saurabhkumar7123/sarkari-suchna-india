"use strict";

/**
 * Phase 90 — Feature Flag Integration Design (Read-only).
 *
 * Pure library that describes how future recruitment architecture should be
 * introduced behind feature flags. Evaluates only supplied plain JavaScript
 * objects (compatibility contract, migration blueprint, mapping plan) and
 * returns a deeply frozen integration design. Descriptive only — does not
 * create feature flags, read environment variables, or perform runtime
 * integration.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const FEATURE_FLAG_INTEGRATION_DESIGN_PHASE = 90;

const FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY = "feature_flag_integration_design";

const ROLLOUT_STAGES = Object.freeze({
  DESIGN_READY: "DESIGN_READY",
  DESIGN_INCOMPLETE: "DESIGN_INCOMPLETE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED"
});

const SUPPORTED_ROLLOUT_STAGES = Object.freeze(new Set(Object.values(ROLLOUT_STAGES)));

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

const FLAG_DEFAULT_STATES = Object.freeze({
  DISABLED: "disabled",
  ENABLED: "enabled"
});

const SUPPORTED_FLAG_DEFAULT_STATES = Object.freeze(new Set(Object.values(FLAG_DEFAULT_STATES)));

const FEATURE_FLAG_IDS = Object.freeze({
  RECRUITMENT_PIPELINE: "RECRUITMENT_PIPELINE_ENABLED",
  LIFECYCLE_DATA_PRESENCE: "RECRUITMENT_LIFECYCLE_DATA_PRESENCE_ENABLED",
  LIFECYCLE_READ_AWARENESS: "RECRUITMENT_LIFECYCLE_READ_AWARENESS_ENABLED",
  LIFECYCLE_EDITORIAL_ATTACHMENT: "RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED",
  LIFECYCLE_MONITORING_MATCH: "RECRUITMENT_LIFECYCLE_MONITORING_MATCH_ENABLED",
  LIFECYCLE_PUBLIC_LIFECYCLE: "RECRUITMENT_LIFECYCLE_PUBLIC_LIFECYCLE_ENABLED",
  AUTOMATIC_PERSISTENCE: "AUTOMATIC_PERSISTENCE_ENABLED",
  REVIEW_QUEUE_ENQUEUE: "REVIEW_QUEUE_ENQUEUE_ENABLED"
});

const FEATURE_FLAG_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE,
    name: "Recruitment Pipeline",
    description:
      "Gates siteWorker recruitment pipeline invocation; must remain disabled until baseline verification completes.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE,
    name: "Recruitment Data Presence (Group A)",
    description:
      "Enables lifecycle data presence scaffolding without altering existing page entity resolution.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS,
    name: "Recruitment Read Awareness (Group B)",
    description:
      "Enables read-path awareness of lifecycle aggregates while preserving current public API shapes.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.LIFECYCLE_EDITORIAL_ATTACHMENT,
    name: "Editorial Attachment (Group C)",
    description:
      "Enables editorial attachment of lifecycle context to recruitment content without route changes.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.LIFECYCLE_MONITORING_MATCH,
    name: "Monitoring Matching (Group D)",
    description:
      "Enables lifecycle-aware monitoring match signals after monitoring baseline is established.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.LIFECYCLE_PUBLIC_LIFECYCLE,
    name: "Public Lifecycle (Group E)",
    description:
      "Enables public lifecycle presentation only after upstream lifecycle groups are stable.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.AUTOMATIC_PERSISTENCE,
    name: "Automatic Persistence",
    description:
      "Gates automatic recruitment lifecycle persistence; must remain disabled until validation checklist passes.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.REVIEW_QUEUE_ENQUEUE,
    name: "Review Queue Enqueue",
    description:
      "Gates review queue enqueue behavior; must remain disabled until persistence enablement is explicitly approved.",
    defaultState: FLAG_DEFAULT_STATES.DISABLED
  })
]);

const ROLLOUT_SEQUENCE_PHASE_IDS = Object.freeze({
  RESOLVE_MIGRATION_PREREQUISITES: "RESOLVE_MIGRATION_PREREQUISITES",
  COMPLETE_MANUAL_REVIEW_GATE: "COMPLETE_MANUAL_REVIEW_GATE",
  VERIFY_COMPATIBILITY_GUARANTEES: "VERIFY_COMPATIBILITY_GUARANTEES",
  ENABLE_PIPELINE_FLAG: "ENABLE_PIPELINE_FLAG",
  ENABLE_LIFECYCLE_GROUP_A: "ENABLE_LIFECYCLE_GROUP_A",
  ENABLE_LIFECYCLE_GROUP_B: "ENABLE_LIFECYCLE_GROUP_B",
  ENABLE_LIFECYCLE_GROUP_C: "ENABLE_LIFECYCLE_GROUP_C",
  ENABLE_LIFECYCLE_GROUP_D: "ENABLE_LIFECYCLE_GROUP_D",
  ENABLE_LIFECYCLE_GROUP_E: "ENABLE_LIFECYCLE_GROUP_E",
  ENABLE_PERSISTENCE_FLAG: "ENABLE_PERSISTENCE_FLAG",
  ENABLE_REVIEW_QUEUE_FLAG: "ENABLE_REVIEW_QUEUE_FLAG"
});

const BASE_ROLLOUT_SEQUENCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.VERIFY_COMPATIBILITY_GUARANTEES,
    title: "Verify compatibility guarantees",
    description:
      "Confirm backward compatibility contract preserved behaviors and validation checklist before any flag enablement.",
    flagIds: Object.freeze([])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_PIPELINE_FLAG,
    title: "Enable pipeline observation flag",
    description:
      "Enable RECRUITMENT_PIPELINE_ENABLED for controlled observation without altering baseline pipeline decisions.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_A,
    title: "Enable lifecycle data presence",
    description: "Enable RECRUITMENT_LIFECYCLE_DATA_PRESENCE_ENABLED (Group A) after pipeline observation stabilizes.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_B,
    title: "Enable read awareness",
    description:
      "Enable RECRUITMENT_LIFECYCLE_READ_AWARENESS_ENABLED (Group B) after Group A is stable.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_C,
    title: "Enable editorial attachment",
    description:
      "Enable RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED (Group C) after read awareness is verified.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_EDITORIAL_ATTACHMENT])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_D,
    title: "Enable monitoring matching",
    description:
      "Enable RECRUITMENT_LIFECYCLE_MONITORING_MATCH_ENABLED (Group D) after monitoring baseline capture.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_MONITORING_MATCH])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_LIFECYCLE_GROUP_E,
    title: "Enable public lifecycle",
    description:
      "Enable RECRUITMENT_LIFECYCLE_PUBLIC_LIFECYCLE_ENABLED (Group E) after editorial and monitoring groups are stable.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_PUBLIC_LIFECYCLE])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_PERSISTENCE_FLAG,
    title: "Enable controlled persistence",
    description:
      "Enable AUTOMATIC_PERSISTENCE_ENABLED only after validation checklist and deferred rollout items are approved.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.AUTOMATIC_PERSISTENCE])
  }),
  Object.freeze({
    id: ROLLOUT_SEQUENCE_PHASE_IDS.ENABLE_REVIEW_QUEUE_FLAG,
    title: "Enable review queue advisory",
    description:
      "Enable REVIEW_QUEUE_ENQUEUE_ENABLED last, retaining advisory-only behavior until persistence is explicitly approved.",
    flagIds: Object.freeze([FEATURE_FLAG_IDS.REVIEW_QUEUE_ENQUEUE])
  })
]);

const PREREQUISITE_ROLLOUT_PHASE = Object.freeze({
  id: ROLLOUT_SEQUENCE_PHASE_IDS.RESOLVE_MIGRATION_PREREQUISITES,
  title: "Resolve migration prerequisites",
  description:
    "Address migration blueprint prerequisites and mapping plan gaps before feature flag enablement proceeds.",
  flagIds: Object.freeze([])
});

const REVIEW_GATE_ROLLOUT_PHASE = Object.freeze({
  id: ROLLOUT_SEQUENCE_PHASE_IDS.COMPLETE_MANUAL_REVIEW_GATE,
  title: "Complete manual review gate",
  description:
    "Complete manual review for ignored candidates, unsupported entities, or blueprint review requirements before rollout.",
  flagIds: Object.freeze([])
});

const DEPENDENCY_DEFINITIONS = Object.freeze([
  Object.freeze({
    flagId: FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS,
    dependsOn: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE]),
    description: "Read awareness requires lifecycle data presence to be enabled first."
  }),
  Object.freeze({
    flagId: FEATURE_FLAG_IDS.LIFECYCLE_EDITORIAL_ATTACHMENT,
    dependsOn: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS]),
    description: "Editorial attachment requires read awareness to be enabled first."
  }),
  Object.freeze({
    flagId: FEATURE_FLAG_IDS.LIFECYCLE_MONITORING_MATCH,
    dependsOn: Object.freeze([FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE]),
    description: "Monitoring matching requires lifecycle data presence to be enabled first."
  }),
  Object.freeze({
    flagId: FEATURE_FLAG_IDS.LIFECYCLE_PUBLIC_LIFECYCLE,
    dependsOn: Object.freeze([
      FEATURE_FLAG_IDS.LIFECYCLE_EDITORIAL_ATTACHMENT,
      FEATURE_FLAG_IDS.LIFECYCLE_MONITORING_MATCH
    ]),
    description: "Public lifecycle requires editorial attachment and monitoring matching to be enabled first."
  }),
  Object.freeze({
    flagId: FEATURE_FLAG_IDS.AUTOMATIC_PERSISTENCE,
    dependsOn: Object.freeze([
      FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE,
      FEATURE_FLAG_IDS.LIFECYCLE_DATA_PRESENCE,
      FEATURE_FLAG_IDS.LIFECYCLE_READ_AWARENESS,
      FEATURE_FLAG_IDS.LIFECYCLE_EDITORIAL_ATTACHMENT,
      FEATURE_FLAG_IDS.LIFECYCLE_MONITORING_MATCH,
      FEATURE_FLAG_IDS.LIFECYCLE_PUBLIC_LIFECYCLE
    ]),
    description:
      "Automatic persistence requires all lifecycle group flags and pipeline observation to be enabled first."
  }),
  Object.freeze({
    flagId: FEATURE_FLAG_IDS.REVIEW_QUEUE_ENQUEUE,
    dependsOn: Object.freeze([FEATURE_FLAG_IDS.AUTOMATIC_PERSISTENCE]),
    description: "Review queue enqueue requires automatic persistence flag to be enabled first."
  })
]);

const ROLLBACK_PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "DISABLE_REVIEW_QUEUE",
    action:
      "Disable REVIEW_QUEUE_ENQUEUE_ENABLED and confirm no review queue writes occur during rollback."
  }),
  Object.freeze({
    id: "DISABLE_AUTOMATIC_PERSISTENCE",
    action:
      "Disable AUTOMATIC_PERSISTENCE_ENABLED and verify no unapproved recruitment persistence writes occur."
  }),
  Object.freeze({
    id: "DISABLE_PUBLIC_LIFECYCLE",
    action:
      "Disable RECRUITMENT_LIFECYCLE_PUBLIC_LIFECYCLE_ENABLED (Group E) and confirm public pages match baseline."
  }),
  Object.freeze({
    id: "DISABLE_MONITORING_MATCH",
    action:
      "Disable RECRUITMENT_LIFECYCLE_MONITORING_MATCH_ENABLED (Group D) and restore monitoring baseline signals."
  }),
  Object.freeze({
    id: "DISABLE_EDITORIAL_ATTACHMENT",
    action:
      "Disable RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED (Group C) and confirm editorial output unchanged."
  }),
  Object.freeze({
    id: "DISABLE_READ_AWARENESS",
    action:
      "Disable RECRUITMENT_LIFECYCLE_READ_AWARENESS_ENABLED (Group B) and confirm read paths match baseline."
  }),
  Object.freeze({
    id: "DISABLE_DATA_PRESENCE",
    action:
      "Disable RECRUITMENT_LIFECYCLE_DATA_PRESENCE_ENABLED (Group A) and confirm lifecycle scaffolding is inert."
  }),
  Object.freeze({
    id: "DISABLE_PIPELINE_FLAG",
    action:
      "Disable RECRUITMENT_PIPELINE_ENABLED and confirm worker pipeline decisions match pre-rollout baseline."
  }),
  Object.freeze({
    id: "VERIFY_BASELINE_BEHAVIOR",
    action:
      "Re-run compatibility validation checklist and confirm preserved behaviors match the backward compatibility contract."
  }),
  Object.freeze({
    id: "DOCUMENT_ROLLBACK_COMPLETION",
    action:
      "Document rollback completion, deferred item disposition, and readiness to re-attempt phased enablement."
  })
]);

const FEATURE_FLAG_INTEGRATION_DESIGN_METADATA = Object.freeze({
  phase: FEATURE_FLAG_INTEGRATION_DESIGN_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsMigration: false,
  createsFeatureFlags: false,
  readsEnvironmentVariables: false,
  mutatesInput: false,
  mutatesOutput: false,
  generatesSql: false,
  fetchesEntities: false
});

const FEATURE_FLAG_INTEGRATION_DESIGN_DESCRIPTOR = Object.freeze({
  entity: FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY,
  domain: "recruitment",
  phase: FEATURE_FLAG_INTEGRATION_DESIGN_PHASE,
  description:
    "Immutable feature flag integration design describing phased recruitment architecture rollout.",
  rolloutStages: Object.freeze(Object.values(ROLLOUT_STAGES)),
  featureFlagCount: FEATURE_FLAG_DEFINITIONS.length,
  rolloutSequencePhaseCount: BASE_ROLLOUT_SEQUENCE_DEFINITIONS.length,
  dependencyCount: DEPENDENCY_DEFINITIONS.length,
  rollbackActionCount: ROLLBACK_PLAN_DEFINITIONS.length,
  metadata: FEATURE_FLAG_INTEGRATION_DESIGN_METADATA
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

function normalizeCompatibilityStatus(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const upper = normalized.toUpperCase();
  return SUPPORTED_COMPATIBILITY_STATUSES.has(upper) ? upper : null;
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

function buildFeatureFlags() {
  return FEATURE_FLAG_DEFINITIONS.map((item) =>
    deepFreeze({
      id: item.id,
      name: item.name,
      description: item.description,
      defaultState: item.defaultState
    })
  );
}

function buildDependencies() {
  return DEPENDENCY_DEFINITIONS.map((item, index) =>
    deepFreeze({
      order: index + 1,
      flagId: item.flagId,
      dependsOn: Object.freeze(item.dependsOn.slice()),
      description: item.description
    })
  );
}

function buildRollbackPlan() {
  return ROLLBACK_PLAN_DEFINITIONS.map((item, index) =>
    deepFreeze({
      order: index + 1,
      id: item.id,
      action: item.action
    })
  );
}

function normalizeCompatibilityContract(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const metadata = isPlainObject(value.metadata) ? value.metadata : {};

  return {
    compatibilityStatus: normalizeCompatibilityStatus(value.compatibilityStatus),
    unsatisfiedRequirementCount:
      typeof metadata.unsatisfiedRequirementCount === "number" &&
      Number.isFinite(metadata.unsatisfiedRequirementCount) &&
      metadata.unsatisfiedRequirementCount >= 0
        ? metadata.unsatisfiedRequirementCount
        : null,
    blueprintStage: normalizeMigrationStage(metadata.blueprintStage),
    blueprintReadinessStatus: normalizeReadinessStatus(metadata.blueprintReadinessStatus),
    confidence: normalizeConfidence(metadata.confidence),
    migrationBlueprintAvailable: metadata.migrationBlueprintAvailable === true,
    mappingPlanAvailable: metadata.mappingPlanAvailable === true,
    prerequisiteCount:
      typeof metadata.prerequisiteCount === "number" &&
      Number.isFinite(metadata.prerequisiteCount) &&
      metadata.prerequisiteCount >= 0
        ? metadata.prerequisiteCount
        : 0,
    riskCount:
      typeof metadata.riskCount === "number" &&
      Number.isFinite(metadata.riskCount) &&
      metadata.riskCount >= 0
        ? metadata.riskCount
        : 0,
    deferredItemCount:
      typeof metadata.deferredItemCount === "number" &&
      Number.isFinite(metadata.deferredItemCount) &&
      metadata.deferredItemCount >= 0
        ? metadata.deferredItemCount
        : 0
  };
}

function normalizeMigrationBlueprint(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const migrationReadiness = isPlainObject(value.migrationReadiness) ? value.migrationReadiness : {};

  return {
    migrationStage: normalizeMigrationStage(value.migrationStage),
    readinessStatus: normalizeReadinessStatus(migrationReadiness.status),
    confidence: normalizeConfidence(migrationReadiness.confidence),
    reasons: normalizeStringArray(migrationReadiness.reasons),
    prerequisites: sortUniqueStrings(normalizeStringArray(value.prerequisites)),
    riskCount: Array.isArray(value.risks) ? value.risks.length : 0,
    deferredItemCount: Array.isArray(value.deferredItems) ? value.deferredItems.length : 0,
    hasIgnoredCandidatePrerequisite: normalizeStringArray(value.prerequisites).includes(
      "IGNORED_CANDIDATES_REQUIRE_REVIEW"
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

function needsPrerequisiteResolutionPhase(blueprint, mappingPlan, compatibility) {
  if (blueprint != null && blueprint.prerequisites.length > 0) {
    return true;
  }
  if (mappingPlan != null && mappingPlan.status !== READINESS_STATUS.READY) {
    return true;
  }
  if (mappingPlan != null && mappingPlan.missingInformation.length > 0) {
    return true;
  }
  if (compatibility != null && compatibility.compatibilityStatus === COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE) {
    return true;
  }
  if (blueprint != null && blueprint.migrationStage === MIGRATION_STAGES.PREPARATION) {
    return true;
  }
  return false;
}

function needsManualReviewGate(blueprint, compatibility) {
  if (compatibility != null && compatibility.compatibilityStatus === COMPATIBILITY_STATUS.REVIEW_REQUIRED) {
    return true;
  }
  if (blueprintExplicitlyRequiresReview(blueprint)) {
    return true;
  }
  if (compatibility != null && (compatibility.unsatisfiedRequirementCount ?? 0) > 0) {
    return true;
  }
  if (blueprint != null && blueprint.prerequisites.length > 0) {
    return true;
  }
  return false;
}

function resolveRolloutStage(compatibility, blueprint, mappingPlan) {
  if (compatibility == null && blueprint == null && mappingPlan == null) {
    return ROLLOUT_STAGES.REVIEW_REQUIRED;
  }

  if (needsManualReviewGate(blueprint, compatibility)) {
    return ROLLOUT_STAGES.REVIEW_REQUIRED;
  }

  const blueprintReady =
    blueprint != null &&
    blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
    blueprint.readinessStatus === READINESS_STATUS.READY &&
    blueprint.prerequisites.length === 0;

  const mappingReady = mappingPlan != null && mappingPlan.status === READINESS_STATUS.READY;

  const contractReady =
    compatibility != null &&
    compatibility.compatibilityStatus === COMPATIBILITY_STATUS.COMPATIBLE &&
    (compatibility.unsatisfiedRequirementCount ?? 0) === 0;

  if (blueprintReady && mappingReady && contractReady) {
    return ROLLOUT_STAGES.DESIGN_READY;
  }

  if (compatibility == null && blueprint == null && mappingPlan == null) {
    return ROLLOUT_STAGES.REVIEW_REQUIRED;
  }

  return ROLLOUT_STAGES.DESIGN_INCOMPLETE;
}

function buildRolloutSequence(rolloutStage, blueprint, mappingPlan, compatibility) {
  const phases = [];

  if (rolloutStage === ROLLOUT_STAGES.REVIEW_REQUIRED) {
    phases.push(PREREQUISITE_ROLLOUT_PHASE);
    phases.push(REVIEW_GATE_ROLLOUT_PHASE);
  } else if (rolloutStage === ROLLOUT_STAGES.DESIGN_INCOMPLETE) {
    if (needsPrerequisiteResolutionPhase(blueprint, mappingPlan, compatibility)) {
      phases.push(PREREQUISITE_ROLLOUT_PHASE);
    }
  }

  for (let i = 0; i < BASE_ROLLOUT_SEQUENCE_DEFINITIONS.length; i += 1) {
    phases.push(BASE_ROLLOUT_SEQUENCE_DEFINITIONS[i]);
  }

  return phases.map((phase, index) =>
    deepFreeze({
      order: index + 1,
      id: phase.id,
      title: phase.title,
      description: phase.description,
      flagIds: Object.freeze(phase.flagIds.slice())
    })
  );
}

function resolveDesignConfidence(compatibility, blueprint, mappingPlan) {
  const confidences = [];
  if (compatibility != null) {
    confidences.push(compatibility.confidence);
  }
  if (blueprint != null) {
    confidences.push(blueprint.confidence);
  }
  if (mappingPlan != null) {
    confidences.push(mappingPlan.confidence);
  }
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

const EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN = deepFreeze({
  rolloutStage: ROLLOUT_STAGES.REVIEW_REQUIRED,
  featureFlags: Object.freeze(buildFeatureFlags()),
  rolloutSequence: Object.freeze(
    buildRolloutSequence(ROLLOUT_STAGES.REVIEW_REQUIRED, null, null, null)
  ),
  dependencies: Object.freeze(buildDependencies()),
  rollbackPlan: Object.freeze(buildRollbackPlan()),
  metadata: deepFreeze({
    ...FEATURE_FLAG_INTEGRATION_DESIGN_METADATA,
    createReason: "invalid_input",
    compatibilityContractAvailable: false,
    migrationBlueprintAvailable: false,
    mappingPlanAvailable: false,
    compatibilityStatus: COMPATIBILITY_STATUS.REVIEW_REQUIRED,
    blueprintStage: MIGRATION_STAGES.REQUIRES_REVIEW,
    blueprintReadinessStatus: READINESS_STATUS.NOT_READY,
    mappingPlanStatus: READINESS_STATUS.NOT_READY,
    prerequisiteCount: 0,
    riskCount: 0,
    deferredItemCount: 0,
    unsatisfiedRequirementCount: null,
    featureFlagCount: FEATURE_FLAG_DEFINITIONS.length,
    rolloutSequencePhaseCount: buildRolloutSequence(
      ROLLOUT_STAGES.REVIEW_REQUIRED,
      null,
      null,
      null
    ).length,
    dependencyCount: DEPENDENCY_DEFINITIONS.length,
    rollbackActionCount: ROLLBACK_PLAN_DEFINITIONS.length,
    confidence: CONFIDENCE_LEVELS.UNKNOWN
  })
});

/**
 * Create an immutable feature flag integration design from plain input.
 * Pure: no I/O, no mutation of input, no runtime integration.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createFeatureFlagIntegrationDesign(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN;
  }

  if (!isPlainObject(input)) {
    return EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN;
  }

  const compatibility = normalizeCompatibilityContract(input.compatibilityContract);
  const blueprint = normalizeMigrationBlueprint(input.migrationBlueprint);
  const mappingPlan = normalizeMappingPlan(input.mappingPlan);

  const rolloutStage = resolveRolloutStage(compatibility, blueprint, mappingPlan);
  const rolloutSequence = buildRolloutSequence(rolloutStage, blueprint, mappingPlan, compatibility);

  return deepFreeze({
    rolloutStage,
    featureFlags: Object.freeze(buildFeatureFlags()),
    rolloutSequence: Object.freeze(rolloutSequence),
    dependencies: Object.freeze(buildDependencies()),
    rollbackPlan: Object.freeze(buildRollbackPlan()),
    metadata: deepFreeze({
      ...FEATURE_FLAG_INTEGRATION_DESIGN_METADATA,
      createReason: "design_input",
      compatibilityContractAvailable: compatibility != null,
      migrationBlueprintAvailable: blueprint != null,
      mappingPlanAvailable: mappingPlan != null,
      compatibilityStatus:
        compatibility?.compatibilityStatus ?? COMPATIBILITY_STATUS.REVIEW_REQUIRED,
      blueprintStage: blueprint?.migrationStage ?? MIGRATION_STAGES.REQUIRES_REVIEW,
      blueprintReadinessStatus: blueprint?.readinessStatus ?? READINESS_STATUS.NOT_READY,
      mappingPlanStatus: mappingPlan?.status ?? READINESS_STATUS.NOT_READY,
      prerequisiteCount: blueprint?.prerequisites.length ?? compatibility?.prerequisiteCount ?? 0,
      riskCount: blueprint?.riskCount ?? compatibility?.riskCount ?? 0,
      deferredItemCount: blueprint?.deferredItemCount ?? compatibility?.deferredItemCount ?? 0,
      unsatisfiedRequirementCount: compatibility?.unsatisfiedRequirementCount ?? null,
      featureFlagCount: FEATURE_FLAG_DEFINITIONS.length,
      rolloutSequencePhaseCount: rolloutSequence.length,
      dependencyCount: DEPENDENCY_DEFINITIONS.length,
      rollbackActionCount: ROLLBACK_PLAN_DEFINITIONS.length,
      confidence: resolveDesignConfidence(compatibility, blueprint, mappingPlan)
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isFeatureFlagIntegrationDesign(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !SUPPORTED_ROLLOUT_STAGES.has(value.rolloutStage) ||
    !Array.isArray(value.featureFlags) ||
    !Array.isArray(value.rolloutSequence) ||
    !Array.isArray(value.dependencies) ||
    !Array.isArray(value.rollbackPlan) ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  for (let i = 0; i < value.featureFlags.length; i += 1) {
    const flag = value.featureFlags[i];
    if (
      !isPlainObject(flag) ||
      typeof flag.id !== "string" ||
      typeof flag.name !== "string" ||
      typeof flag.description !== "string" ||
      !SUPPORTED_FLAG_DEFAULT_STATES.has(flag.defaultState)
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.rolloutSequence.length; i += 1) {
    const phase = value.rolloutSequence[i];
    if (
      !isPlainObject(phase) ||
      typeof phase.order !== "number" ||
      typeof phase.id !== "string" ||
      typeof phase.title !== "string" ||
      typeof phase.description !== "string" ||
      !Array.isArray(phase.flagIds)
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.dependencies.length; i += 1) {
    const dependency = value.dependencies[i];
    if (
      !isPlainObject(dependency) ||
      typeof dependency.order !== "number" ||
      typeof dependency.flagId !== "string" ||
      !Array.isArray(dependency.dependsOn) ||
      typeof dependency.description !== "string"
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.rollbackPlan.length; i += 1) {
    const action = value.rollbackPlan[i];
    if (
      !isPlainObject(action) ||
      typeof action.order !== "number" ||
      typeof action.id !== "string" ||
      typeof action.action !== "string"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} design
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateFeatureFlagIntegrationDesign(design) {
  const reasons = [];

  if (!isFeatureFlagIntegrationDesign(design)) {
    return buildValidationResult(["INVALID_DESIGN_SHAPE"]);
  }

  if (design.metadata.runtimeIntegration !== false) {
    reasons.push("RUNTIME_INTEGRATION_MUST_BE_FALSE");
  }

  if (design.metadata.createsFeatureFlags !== false) {
    reasons.push("CREATES_FEATURE_FLAGS_MUST_BE_FALSE");
  }

  if (design.metadata.readsEnvironmentVariables !== false) {
    reasons.push("READS_ENVIRONMENT_VARIABLES_MUST_BE_FALSE");
  }

  if (design.metadata.performsMigration !== false) {
    reasons.push("PERFORMS_MIGRATION_MUST_BE_FALSE");
  }

  if (
    design.rolloutStage === ROLLOUT_STAGES.DESIGN_READY &&
    design.metadata.compatibilityStatus !== COMPATIBILITY_STATUS.COMPATIBLE
  ) {
    reasons.push("DESIGN_READY_REQUIRES_COMPATIBLE_CONTRACT");
  }

  if (
    design.rolloutStage === ROLLOUT_STAGES.DESIGN_READY &&
    design.metadata.blueprintStage !== MIGRATION_STAGES.READY_FOR_MIGRATION
  ) {
    reasons.push("DESIGN_READY_REQUIRES_READY_FOR_MIGRATION_BLUEPRINT");
  }

  if (
    design.rolloutStage === ROLLOUT_STAGES.DESIGN_READY &&
    design.metadata.mappingPlanStatus !== READINESS_STATUS.READY
  ) {
    reasons.push("DESIGN_READY_REQUIRES_READY_MAPPING_PLAN");
  }

  if (design.featureFlags.some((flag) => flag.defaultState !== FLAG_DEFAULT_STATES.DISABLED)) {
    reasons.push("ALL_FEATURE_FLAGS_MUST_DEFAULT_DISABLED");
  }

  const sequenceOrders = design.rolloutSequence.map((phase) => phase.order);
  for (let i = 0; i < sequenceOrders.length; i += 1) {
    if (sequenceOrders[i] !== i + 1) {
      reasons.push("ROLLOUT_SEQUENCE_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  const dependencyOrders = design.dependencies.map((item) => item.order);
  for (let i = 0; i < dependencyOrders.length; i += 1) {
    if (dependencyOrders[i] !== i + 1) {
      reasons.push("DEPENDENCIES_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  const rollbackOrders = design.rollbackPlan.map((item) => item.order);
  for (let i = 0; i < rollbackOrders.length; i += 1) {
    if (rollbackOrders[i] !== i + 1) {
      reasons.push("ROLLBACK_PLAN_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} design
 * @returns {Readonly<Object>}
 */
function summarizeFeatureFlagIntegrationDesign(design) {
  const validation = validateFeatureFlagIntegrationDesign(design);
  if (!validation.valid) {
    return Object.freeze({
      phase: FEATURE_FLAG_INTEGRATION_DESIGN_PHASE,
      entity: FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY,
      valid: false,
      rolloutStage: ROLLOUT_STAGES.REVIEW_REQUIRED,
      featureFlagCount: 0,
      rolloutSequencePhaseCount: 0,
      dependencyCount: 0,
      rollbackActionCount: 0,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      readOnly: true,
      createsFeatureFlags: false,
      runtimeIntegration: false
    });
  }

  return Object.freeze({
    phase: FEATURE_FLAG_INTEGRATION_DESIGN_PHASE,
    entity: FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY,
    valid: true,
    rolloutStage: design.rolloutStage,
    featureFlagCount: design.featureFlags.length,
    rolloutSequencePhaseCount: design.rolloutSequence.length,
    dependencyCount: design.dependencies.length,
    rollbackActionCount: design.rollbackPlan.length,
    compatibilityContractAvailable: design.metadata.compatibilityContractAvailable === true,
    migrationBlueprintAvailable: design.metadata.migrationBlueprintAvailable === true,
    mappingPlanAvailable: design.metadata.mappingPlanAvailable === true,
    compatibilityStatus: design.metadata.compatibilityStatus,
    blueprintStage: design.metadata.blueprintStage,
    mappingPlanStatus: design.metadata.mappingPlanStatus,
    prerequisiteCount: design.metadata.prerequisiteCount,
    unsatisfiedRequirementCount: design.metadata.unsatisfiedRequirementCount,
    confidence: design.metadata.confidence,
    readOnly: true,
    createsFeatureFlags: false,
    runtimeIntegration: false
  });
}

module.exports = {
  FEATURE_FLAG_INTEGRATION_DESIGN_PHASE,
  FEATURE_FLAG_INTEGRATION_DESIGN_ENTITY,
  ROLLOUT_STAGES,
  SUPPORTED_ROLLOUT_STAGES,
  COMPATIBILITY_STATUS,
  SUPPORTED_COMPATIBILITY_STATUSES,
  MIGRATION_STAGES,
  SUPPORTED_MIGRATION_STAGES,
  READINESS_STATUS,
  SUPPORTED_READINESS_STATUSES,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  FLAG_DEFAULT_STATES,
  SUPPORTED_FLAG_DEFAULT_STATES,
  FEATURE_FLAG_IDS,
  FEATURE_FLAG_DEFINITIONS,
  ROLLOUT_SEQUENCE_PHASE_IDS,
  BASE_ROLLOUT_SEQUENCE_DEFINITIONS,
  DEPENDENCY_DEFINITIONS,
  ROLLBACK_PLAN_DEFINITIONS,
  FEATURE_FLAG_INTEGRATION_DESIGN_DESCRIPTOR,
  FEATURE_FLAG_INTEGRATION_DESIGN_METADATA,
  VALIDATION_STATUS,
  EMPTY_FEATURE_FLAG_INTEGRATION_DESIGN,
  createFeatureFlagIntegrationDesign,
  isFeatureFlagIntegrationDesign,
  validateFeatureFlagIntegrationDesign,
  summarizeFeatureFlagIntegrationDesign
};
