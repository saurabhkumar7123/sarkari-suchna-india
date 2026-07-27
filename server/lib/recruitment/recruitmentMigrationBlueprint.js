"use strict";

/**
 * Phase 88 — Recruitment Migration Blueprint (Read-only).
 *
 * Pure library that produces a descriptive migration blueprint from supplied
 * architecture analysis, mapping plan, and candidate analysis objects toward
 * the future recruitment lifecycle model. Descriptive only — does not perform
 * migration, database access, page updates, or persistence.
 *
 * Accepts plain JavaScript objects and returns a deeply frozen blueprint object.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_MIGRATION_BLUEPRINT_PHASE = 88;

const RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY = "recruitment_migration_blueprint";

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

const PREREQUISITE_CODES = Object.freeze({
  MISSING_ARCHITECTURE_ANALYSIS: "MISSING_ARCHITECTURE_ANALYSIS",
  MISSING_MAPPING_PLAN: "MISSING_MAPPING_PLAN",
  MISSING_CANDIDATE_ANALYSIS: "MISSING_CANDIDATE_ANALYSIS",
  ARCHITECTURE_NOT_READY: "ARCHITECTURE_NOT_READY",
  ARCHITECTURE_PARTIALLY_READY: "ARCHITECTURE_PARTIALLY_READY",
  MAPPING_PLAN_NOT_READY: "MAPPING_PLAN_NOT_READY",
  MAPPING_PLAN_PARTIALLY_READY: "MAPPING_PLAN_PARTIALLY_READY",
  MISSING_PRIMARY_CANDIDATE: "MISSING_PRIMARY_CANDIDATE",
  NO_RELATED_CANDIDATES: "NO_RELATED_CANDIDATES",
  UNSUPPORTED_ENTITIES_IN_ARCHITECTURE: "UNSUPPORTED_ENTITIES_IN_ARCHITECTURE",
  STANDALONE_ENTITIES_IN_ARCHITECTURE: "STANDALONE_ENTITIES_IN_ARCHITECTURE",
  IGNORED_CANDIDATES_REQUIRE_REVIEW: "IGNORED_CANDIDATES_REQUIRE_REVIEW",
  INVALID_INPUT_SHAPE: "INVALID_INPUT_SHAPE"
});

const PREREQUISITE_CODE_LIST = Object.freeze(Object.values(PREREQUISITE_CODES));

const RISK_IDS = Object.freeze({
  UNSUPPORTED_ENTITIES: "UNSUPPORTED_ENTITIES",
  IGNORED_CANDIDATES: "IGNORED_CANDIDATES",
  LOW_CONFIDENCE_SIGNALS: "LOW_CONFIDENCE_SIGNALS",
  PARTIAL_ARCHITECTURE: "PARTIAL_ARCHITECTURE",
  LIFECYCLE_MAPPING_GAPS: "LIFECYCLE_MAPPING_GAPS",
  VALIDATION_GAPS: "VALIDATION_GAPS",
  STANDALONE_ENTITY_ISOLATION: "STANDALONE_ENTITY_ISOLATION",
  ANALYSIS_INPUT_INCOMPLETE: "ANALYSIS_INPUT_INCOMPLETE",
  MAPPING_PLAN_CONFLICT: "MAPPING_PLAN_CONFLICT"
});

const DEFERRED_ITEM_IDS = Object.freeze({
  RUNTIME_PIPELINE_INTEGRATION: "RUNTIME_PIPELINE_INTEGRATION",
  DATABASE_SCHEMA_MIGRATION: "DATABASE_SCHEMA_MIGRATION",
  PAGE_ROUTE_AND_URL_UPDATES: "PAGE_ROUTE_AND_URL_UPDATES",
  PRODUCTION_DATA_BACKFILL: "PRODUCTION_DATA_BACKFILL",
  MONITORING_AND_ALERTING_ALIGNMENT: "MONITORING_AND_ALERTING_ALIGNMENT",
  LIVE_MIGRATION_EXECUTION: "LIVE_MIGRATION_EXECUTION"
});

const MIGRATION_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    id: "REVIEW_ARCHITECTURE_CLASSIFICATION",
    title: "Review architecture classification",
    description:
      "Confirm anchor, lifecycle, standalone, and unsupported classifications from the existing page-based recruitment model."
  }),
  Object.freeze({
    order: 2,
    id: "CONFIRM_PRIMARY_ANCHOR",
    title: "Confirm primary recruitment anchor",
    description:
      "Validate the selected primary candidate that will anchor the future recruitment lifecycle structure."
  }),
  Object.freeze({
    order: 3,
    id: "MAP_LIFECYCLE_RELATIONSHIPS",
    title: "Map lifecycle relationships",
    description:
      "Describe how related page entities will be grouped under the primary recruitment lifecycle."
  }),
  Object.freeze({
    order: 4,
    id: "VALIDATE_MAPPING_PLAN",
    title: "Validate mapping plan",
    description:
      "Review mapping plan readiness, missing information, and relationship confidence before migration."
  }),
  Object.freeze({
    order: 5,
    id: "PROJECT_LIFECYCLE_TIMELINE",
    title: "Project lifecycle timeline",
    description:
      "Align timeline projection and lifecycle state evaluation with the planned recruitment mapping."
  }),
  Object.freeze({
    order: 6,
    id: "RESOLVE_PREREQUISITES",
    title: "Resolve prerequisites",
    description:
      "Address all unmet prerequisites identified by upstream analysis before migration execution."
  }),
  Object.freeze({
    order: 7,
    id: "MITIGATE_MIGRATION_RISKS",
    title: "Mitigate migration risks",
    description:
      "Review and plan mitigation for identified migration risks including unsupported or ignored entities."
  }),
  Object.freeze({
    order: 8,
    id: "PREPARE_ROLLOUT_CHECKLIST",
    title: "Prepare rollout checklist",
    description:
      "Finalize deferred production rollout items and confirm no runtime integration occurs in this phase."
  })
]);

const RECRUITMENT_MIGRATION_BLUEPRINT_METADATA = Object.freeze({
  phase: RECRUITMENT_MIGRATION_BLUEPRINT_PHASE,
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

const RECRUITMENT_MIGRATION_BLUEPRINT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_MIGRATION_BLUEPRINT_PHASE,
  description:
    "Immutable descriptive migration blueprint from page-based recruitment toward the lifecycle model.",
  migrationStages: Object.freeze(Object.values(MIGRATION_STAGES)),
  readinessStatuses: Object.freeze(Object.values(READINESS_STATUS)),
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  prerequisiteCodes: PREREQUISITE_CODE_LIST,
  metadata: RECRUITMENT_MIGRATION_BLUEPRINT_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_MIGRATION_READINESS = deepFreeze({
  status: READINESS_STATUS.NOT_READY,
  confidence: CONFIDENCE_LEVELS.UNKNOWN,
  reasons: Object.freeze(["NO_ANALYSIS_INPUT_PROVIDED"])
});

const EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT = deepFreeze({
  migrationStage: MIGRATION_STAGES.REQUIRES_REVIEW,
  migrationReadiness: EMPTY_MIGRATION_READINESS,
  migrationSteps: Object.freeze(MIGRATION_STEP_DEFINITIONS.slice()),
  prerequisites: Object.freeze([
    PREREQUISITE_CODES.INVALID_INPUT_SHAPE,
    PREREQUISITE_CODES.MISSING_ARCHITECTURE_ANALYSIS,
    PREREQUISITE_CODES.MISSING_MAPPING_PLAN,
    PREREQUISITE_CODES.MISSING_CANDIDATE_ANALYSIS
  ]),
  risks: Object.freeze([
    deepFreeze({
      id: RISK_IDS.ANALYSIS_INPUT_INCOMPLETE,
      description:
        "No architecture analysis, mapping plan, or candidate analysis was supplied for blueprint generation."
    })
  ]),
  deferredItems: Object.freeze(buildStandardDeferredItems()),
  metadata: deepFreeze({
    ...RECRUITMENT_MIGRATION_BLUEPRINT_METADATA,
    createReason: "invalid_input",
    architectureAnalysisAvailable: false,
    mappingPlanAvailable: false,
    candidateAnalysisAvailable: false,
    prerequisiteCount: 4,
    riskCount: 1,
    deferredItemCount: 6
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

function buildStandardDeferredItems() {
  return [
    deepFreeze({
      id: DEFERRED_ITEM_IDS.RUNTIME_PIPELINE_INTEGRATION,
      description:
        "Integrate recruitment lifecycle mapping into the runtime recruitment pipeline after blueprint approval."
    }),
    deepFreeze({
      id: DEFERRED_ITEM_IDS.DATABASE_SCHEMA_MIGRATION,
      description:
        "Apply database schema changes supporting the recruitment lifecycle model during production rollout."
    }),
    deepFreeze({
      id: DEFERRED_ITEM_IDS.PAGE_ROUTE_AND_URL_UPDATES,
      description:
        "Update page routes, URLs, and redirects to align with lifecycle-based recruitment structure."
    }),
    deepFreeze({
      id: DEFERRED_ITEM_IDS.PRODUCTION_DATA_BACKFILL,
      description:
        "Backfill production recruitment data from page entities into lifecycle aggregates."
    }),
    deepFreeze({
      id: DEFERRED_ITEM_IDS.MONITORING_AND_ALERTING_ALIGNMENT,
      description:
        "Align monitoring and alerting with lifecycle migration metrics and rollout checkpoints."
    }),
    deepFreeze({
      id: DEFERRED_ITEM_IDS.LIVE_MIGRATION_EXECUTION,
      description:
        "Execute live migration of page-based recruitment entities into the lifecycle model."
    })
  ];
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
    ),
    totalEntities:
      typeof value.totalEntities === "number" && Number.isFinite(value.totalEntities)
        ? value.totalEntities
        : 0
  };
}

function normalizeMappingPlan(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    status: normalizeReadinessStatus(value.mappingStatus),
    readiness: normalizeString(value.readiness),
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

function normalizeCandidateAnalysis(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const analysisSummary = isPlainObject(value.analysisSummary) ? value.analysisSummary : {};

  return {
    hasPrimary: isPlainObject(value.primaryCandidate),
    relatedCount: countFromSummaryOrArray(
      analysisSummary.relatedCount,
      value.relatedCandidates
    ),
    ignoredCount: countFromSummaryOrArray(
      analysisSummary.ignoredCount,
      value.ignoredCandidates
    ),
    primaryCount: countFromSummaryOrArray(analysisSummary.primaryCount, null),
    confidence: normalizeConfidence(value.confidence)
  };
}

function collectPrerequisites(architecture, mappingPlan, candidateAnalysis) {
  const prerequisites = [];

  if (architecture == null) {
    prerequisites.push(PREREQUISITE_CODES.MISSING_ARCHITECTURE_ANALYSIS);
  } else {
    if (architecture.status === READINESS_STATUS.NOT_READY) {
      prerequisites.push(PREREQUISITE_CODES.ARCHITECTURE_NOT_READY);
    } else if (architecture.status === READINESS_STATUS.PARTIAL) {
      prerequisites.push(PREREQUISITE_CODES.ARCHITECTURE_PARTIALLY_READY);
    }
    if (architecture.unsupportedCount > 0) {
      prerequisites.push(PREREQUISITE_CODES.UNSUPPORTED_ENTITIES_IN_ARCHITECTURE);
    }
    if (architecture.standaloneCount > 0) {
      prerequisites.push(PREREQUISITE_CODES.STANDALONE_ENTITIES_IN_ARCHITECTURE);
    }
  }

  if (mappingPlan == null) {
    prerequisites.push(PREREQUISITE_CODES.MISSING_MAPPING_PLAN);
  } else {
    if (mappingPlan.status === READINESS_STATUS.NOT_READY) {
      prerequisites.push(PREREQUISITE_CODES.MAPPING_PLAN_NOT_READY);
    } else if (mappingPlan.status === READINESS_STATUS.PARTIAL) {
      prerequisites.push(PREREQUISITE_CODES.MAPPING_PLAN_PARTIALLY_READY);
    }
    for (let i = 0; i < mappingPlan.missingInformation.length; i += 1) {
      prerequisites.push(mappingPlan.missingInformation[i]);
    }
  }

  if (candidateAnalysis == null) {
    prerequisites.push(PREREQUISITE_CODES.MISSING_CANDIDATE_ANALYSIS);
  } else {
    if (!candidateAnalysis.hasPrimary) {
      prerequisites.push(PREREQUISITE_CODES.MISSING_PRIMARY_CANDIDATE);
    }
    if (candidateAnalysis.hasPrimary && candidateAnalysis.relatedCount === 0) {
      prerequisites.push(PREREQUISITE_CODES.NO_RELATED_CANDIDATES);
    }
    if (candidateAnalysis.ignoredCount > 0) {
      prerequisites.push(PREREQUISITE_CODES.IGNORED_CANDIDATES_REQUIRE_REVIEW);
    }
  }

  return sortUniqueStrings(prerequisites);
}

function collectRisks(architecture, mappingPlan, candidateAnalysis, prerequisites) {
  const risks = [];

  if (
    architecture == null &&
    mappingPlan == null &&
    candidateAnalysis == null
  ) {
    risks.push({
      id: RISK_IDS.ANALYSIS_INPUT_INCOMPLETE,
      description:
        "No architecture analysis, mapping plan, or candidate analysis was supplied for blueprint generation."
    });
  } else if (
    architecture == null ||
    mappingPlan == null ||
    candidateAnalysis == null
  ) {
    risks.push({
      id: RISK_IDS.ANALYSIS_INPUT_INCOMPLETE,
      description:
        "One or more upstream analyses are missing, reducing confidence in migration planning."
    });
  }

  if (architecture != null && architecture.unsupportedCount > 0) {
    risks.push({
      id: RISK_IDS.UNSUPPORTED_ENTITIES,
      description:
        "Unsupported page entities may not map cleanly into the recruitment lifecycle model."
    });
  }

  if (candidateAnalysis != null && candidateAnalysis.ignoredCount > 0) {
    risks.push({
      id: RISK_IDS.IGNORED_CANDIDATES,
      description:
        "Ignored candidate entities require manual review before lifecycle migration."
    });
  }

  if (architecture != null && architecture.status === READINESS_STATUS.PARTIAL) {
    risks.push({
      id: RISK_IDS.PARTIAL_ARCHITECTURE,
      description:
        "Architecture analysis reports partial readiness with incomplete anchor or lifecycle grouping."
    });
  }

  if (
    architecture != null &&
    architecture.anchorCount > 0 &&
    architecture.lifecycleCount === 0
  ) {
    risks.push({
      id: RISK_IDS.LIFECYCLE_MAPPING_GAPS,
      description:
        "Anchor candidates exist without corresponding lifecycle event grouping."
    });
  }

  if (mappingPlan != null && mappingPlan.validationAvailable && !mappingPlan.validationValid) {
    risks.push({
      id: RISK_IDS.VALIDATION_GAPS,
      description:
        "Relationship validation is available but did not pass, indicating mapping uncertainty."
    });
  }

  if (architecture != null && architecture.standaloneCount > 0) {
    risks.push({
      id: RISK_IDS.STANDALONE_ENTITY_ISOLATION,
      description:
        "Standalone entities may remain isolated outside lifecycle grouping after migration."
    });
  }

  if (
    architecture != null &&
    mappingPlan != null &&
    architecture.status === READINESS_STATUS.READY &&
    mappingPlan.status === READINESS_STATUS.NOT_READY
  ) {
    risks.push({
      id: RISK_IDS.MAPPING_PLAN_CONFLICT,
      description:
        "Architecture analysis is ready but the mapping plan is not, indicating conflicting readiness signals."
    });
  }

  const confidences = [];
  if (architecture != null) {
    confidences.push(architecture.confidence);
  }
  if (mappingPlan != null) {
    confidences.push(mappingPlan.confidence);
  }
  if (candidateAnalysis != null) {
    confidences.push(candidateAnalysis.confidence);
  }

  const aggregateConfidence = resolveAggregateConfidence(confidences);
  if (
    aggregateConfidence === CONFIDENCE_LEVELS.LOW ||
    aggregateConfidence === CONFIDENCE_LEVELS.UNKNOWN
  ) {
    risks.push({
      id: RISK_IDS.LOW_CONFIDENCE_SIGNALS,
      description:
        "Upstream analyses report low or unknown confidence in migration readiness."
    });
  }

  if (prerequisites.length > 0 && risks.length === 0) {
    risks.push({
      id: RISK_IDS.ANALYSIS_INPUT_INCOMPLETE,
      description: "Unmet prerequisites remain before migration can proceed."
    });
  }

  risks.sort((left, right) => left.id.localeCompare(right.id));
  return risks;
}

function resolveAggregateConfidence(confidences) {
  if (!Array.isArray(confidences) || confidences.length === 0) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  let lowestOrder = CONFIDENCE_ORDER[CONFIDENCE_LEVELS.HIGH];
  let result = CONFIDENCE_LEVELS.HIGH;

  for (let i = 0; i < confidences.length; i += 1) {
    const confidence = normalizeConfidence(confidences[i]);
    const order = CONFIDENCE_ORDER[confidence];
    if (order < lowestOrder) {
      lowestOrder = order;
      result = confidence;
    }
  }

  return result;
}

function collectReadinessReasons(
  architecture,
  mappingPlan,
  candidateAnalysis,
  prerequisites,
  status
) {
  const reasons = [];

  if (architecture == null) {
    reasons.push("ARCHITECTURE_ANALYSIS_UNAVAILABLE");
  } else if (architecture.status === READINESS_STATUS.READY) {
    reasons.push("ARCHITECTURE_ANALYSIS_READY");
  } else if (architecture.status === READINESS_STATUS.PARTIAL) {
    reasons.push("ARCHITECTURE_ANALYSIS_PARTIAL");
  } else {
    reasons.push("ARCHITECTURE_ANALYSIS_NOT_READY");
  }

  if (mappingPlan == null) {
    reasons.push("MAPPING_PLAN_UNAVAILABLE");
  } else if (mappingPlan.status === READINESS_STATUS.READY) {
    reasons.push("MAPPING_PLAN_READY");
  } else if (mappingPlan.status === READINESS_STATUS.PARTIAL) {
    reasons.push("MAPPING_PLAN_PARTIAL");
  } else {
    reasons.push("MAPPING_PLAN_NOT_READY");
  }

  if (candidateAnalysis == null) {
    reasons.push("CANDIDATE_ANALYSIS_UNAVAILABLE");
  } else if (candidateAnalysis.hasPrimary) {
    reasons.push("PRIMARY_CANDIDATE_IDENTIFIED");
  } else {
    reasons.push("PRIMARY_CANDIDATE_MISSING");
  }

  if (prerequisites.length === 0 && status === READINESS_STATUS.READY) {
    reasons.push("ALL_PREREQUISITES_MET");
  } else if (prerequisites.length > 0) {
    reasons.push("PREREQUISITES_REMAINING");
  }

  if (
    architecture != null &&
    mappingPlan != null &&
    candidateAnalysis != null &&
    architecture.status === READINESS_STATUS.READY &&
    mappingPlan.status === READINESS_STATUS.READY &&
    candidateAnalysis.hasPrimary
  ) {
    reasons.push("UPSTREAM_ANALYSES_ALIGNED");
  }

  return sortUniqueStrings(reasons);
}

function resolveMigrationReadiness(architecture, mappingPlan, candidateAnalysis, prerequisites) {
  const confidences = [];
  if (architecture != null) {
    confidences.push(architecture.confidence);
  }
  if (mappingPlan != null) {
    confidences.push(mappingPlan.confidence);
  }
  if (candidateAnalysis != null) {
    confidences.push(candidateAnalysis.confidence);
  }

  const confidence = resolveAggregateConfidence(confidences);

  const allPresent =
    architecture != null && mappingPlan != null && candidateAnalysis != null;
  const architectureReady = architecture != null && architecture.status === READINESS_STATUS.READY;
  const mappingReady = mappingPlan != null && mappingPlan.status === READINESS_STATUS.READY;
  const candidateReady = candidateAnalysis != null && candidateAnalysis.hasPrimary;

  let status = READINESS_STATUS.NOT_READY;

  if (
    allPresent &&
    architectureReady &&
    mappingReady &&
    candidateReady &&
    prerequisites.length === 0
  ) {
    status = READINESS_STATUS.READY;
  } else if (
    allPresent ||
    architecture != null ||
    mappingPlan != null ||
    candidateAnalysis != null
  ) {
    const anyPartial =
      (architecture != null && architecture.status === READINESS_STATUS.PARTIAL) ||
      (mappingPlan != null && mappingPlan.status === READINESS_STATUS.PARTIAL) ||
      (candidateAnalysis != null && candidateAnalysis.hasPrimary);
    const anyReadySignal =
      architectureReady || mappingReady || candidateReady;

    if (anyPartial || anyReadySignal) {
      status = READINESS_STATUS.PARTIAL;
    }
  }

  const reasons = collectReadinessReasons(
    architecture,
    mappingPlan,
    candidateAnalysis,
    prerequisites,
    status
  );

  return {
    status,
    confidence,
    reasons
  };
}

function requiresManualReview(
  architecture,
  mappingPlan,
  candidateAnalysis,
  prerequisites,
  risks
) {
  if (architecture == null && mappingPlan == null && candidateAnalysis == null) {
    return true;
  }

  if (architecture != null && architecture.unsupportedCount > 0) {
    return true;
  }

  if (candidateAnalysis != null && candidateAnalysis.ignoredCount > 0) {
    return true;
  }

  if (
    architecture != null &&
    mappingPlan != null &&
    architecture.status === READINESS_STATUS.READY &&
    mappingPlan.status === READINESS_STATUS.NOT_READY
  ) {
    return true;
  }

  if (
    prerequisites.includes(PREREQUISITE_CODES.MISSING_ARCHITECTURE_ANALYSIS) &&
    prerequisites.includes(PREREQUISITE_CODES.MISSING_MAPPING_PLAN) &&
    prerequisites.includes(PREREQUISITE_CODES.MISSING_CANDIDATE_ANALYSIS)
  ) {
    return true;
  }

  const reviewRiskIds = new Set([
    RISK_IDS.UNSUPPORTED_ENTITIES,
    RISK_IDS.IGNORED_CANDIDATES,
    RISK_IDS.MAPPING_PLAN_CONFLICT
  ]);

  if (
    architecture == null &&
    mappingPlan == null &&
    candidateAnalysis == null
  ) {
    reviewRiskIds.add(RISK_IDS.ANALYSIS_INPUT_INCOMPLETE);
  }

  for (let i = 0; i < risks.length; i += 1) {
    if (reviewRiskIds.has(risks[i].id)) {
      return true;
    }
  }

  return false;
}

function resolveMigrationStage(
  architecture,
  mappingPlan,
  candidateAnalysis,
  prerequisites,
  migrationReadiness,
  risks
) {
  if (
    requiresManualReview(architecture, mappingPlan, candidateAnalysis, prerequisites, risks)
  ) {
    return MIGRATION_STAGES.REQUIRES_REVIEW;
  }

  if (
    migrationReadiness.status === READINESS_STATUS.READY &&
    architecture != null &&
    mappingPlan != null &&
    candidateAnalysis != null &&
    prerequisites.length === 0
  ) {
    return MIGRATION_STAGES.READY_FOR_MIGRATION;
  }

  return MIGRATION_STAGES.PREPARATION;
}

function buildMigrationSteps() {
  return MIGRATION_STEP_DEFINITIONS.map((step) =>
    deepFreeze({
      order: step.order,
      id: step.id,
      title: step.title,
      description: step.description
    })
  );
}

/**
 * Create an immutable recruitment migration blueprint from plain input objects.
 * Pure: no I/O, no mutation of input, no migration execution.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentMigrationBlueprint(input) {
  if (input == null || input === false || typeof input !== "object" || Array.isArray(input)) {
    return EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT;
  }

  if (!isPlainObject(input)) {
    return EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT;
  }

  const architecture = normalizeArchitectureAnalysis(input.architectureAnalysis);
  const mappingPlan = normalizeMappingPlan(input.mappingPlan);
  const candidateAnalysis = normalizeCandidateAnalysis(input.candidateAnalysis);

  const prerequisites = collectPrerequisites(architecture, mappingPlan, candidateAnalysis);
  const risks = collectRisks(architecture, mappingPlan, candidateAnalysis, prerequisites);
  let migrationReadiness = resolveMigrationReadiness(
    architecture,
    mappingPlan,
    candidateAnalysis,
    prerequisites
  );

  if (
    requiresManualReview(architecture, mappingPlan, candidateAnalysis, prerequisites, risks) &&
    migrationReadiness.status === READINESS_STATUS.READY
  ) {
    migrationReadiness = {
      status: READINESS_STATUS.PARTIAL,
      confidence: migrationReadiness.confidence,
      reasons: sortUniqueStrings([
        ...migrationReadiness.reasons,
        "MANUAL_REVIEW_REQUIRED"
      ])
    };
  }

  const migrationStage = resolveMigrationStage(
    architecture,
    mappingPlan,
    candidateAnalysis,
    prerequisites,
    migrationReadiness,
    risks
  );

  const frozenRisks = risks.map((risk) =>
    deepFreeze({
      id: risk.id,
      description: risk.description
    })
  );

  return deepFreeze({
    migrationStage,
    migrationReadiness: deepFreeze({
      status: migrationReadiness.status,
      confidence: migrationReadiness.confidence,
      reasons: Object.freeze(migrationReadiness.reasons.slice())
    }),
    migrationSteps: Object.freeze(buildMigrationSteps()),
    prerequisites: Object.freeze(prerequisites.slice()),
    risks: Object.freeze(frozenRisks),
    deferredItems: Object.freeze(buildStandardDeferredItems()),
    metadata: deepFreeze({
      ...RECRUITMENT_MIGRATION_BLUEPRINT_METADATA,
      createReason: "blueprint_input",
      architectureAnalysisAvailable: architecture != null,
      mappingPlanAvailable: mappingPlan != null,
      candidateAnalysisAvailable: candidateAnalysis != null,
      prerequisiteCount: prerequisites.length,
      riskCount: frozenRisks.length,
      deferredItemCount: buildStandardDeferredItems().length
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentMigrationBlueprint(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !SUPPORTED_MIGRATION_STAGES.has(value.migrationStage) ||
    !isPlainObject(value.migrationReadiness) ||
    !SUPPORTED_READINESS_STATUSES.has(value.migrationReadiness.status) ||
    !SUPPORTED_CONFIDENCE_LEVELS.has(value.migrationReadiness.confidence) ||
    !Array.isArray(value.migrationReadiness.reasons) ||
    !Array.isArray(value.migrationSteps) ||
    !Array.isArray(value.prerequisites) ||
    !Array.isArray(value.risks) ||
    !Array.isArray(value.deferredItems) ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  for (let i = 0; i < value.migrationReadiness.reasons.length; i += 1) {
    if (typeof value.migrationReadiness.reasons[i] !== "string") {
      return false;
    }
  }

  for (let i = 0; i < value.migrationSteps.length; i += 1) {
    const step = value.migrationSteps[i];
    if (
      !isPlainObject(step) ||
      typeof step.order !== "number" ||
      typeof step.id !== "string" ||
      typeof step.title !== "string" ||
      typeof step.description !== "string"
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.prerequisites.length; i += 1) {
    if (typeof value.prerequisites[i] !== "string") {
      return false;
    }
  }

  for (let i = 0; i < value.risks.length; i += 1) {
    const risk = value.risks[i];
    if (
      !isPlainObject(risk) ||
      typeof risk.id !== "string" ||
      typeof risk.description !== "string"
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.deferredItems.length; i += 1) {
    const item = value.deferredItems[i];
    if (
      !isPlainObject(item) ||
      typeof item.id !== "string" ||
      typeof item.description !== "string"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} blueprint
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentMigrationBlueprint(blueprint) {
  const reasons = [];

  if (!isRecruitmentMigrationBlueprint(blueprint)) {
    return buildValidationResult(["INVALID_BLUEPRINT_SHAPE"]);
  }

  if (blueprint.metadata.performsMigration !== false) {
    reasons.push("PERFORMS_MIGRATION_MUST_BE_FALSE");
  }

  if (blueprint.metadata.runtimeIntegration !== false) {
    reasons.push("RUNTIME_INTEGRATION_MUST_BE_FALSE");
  }

  if (blueprint.metadata.generatesSql !== false) {
    reasons.push("GENERATES_SQL_MUST_BE_FALSE");
  }

  if (
    blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
    blueprint.prerequisites.length > 0
  ) {
    reasons.push("READY_FOR_MIGRATION_REQUIRES_NO_PREREQUISITES");
  }

  if (
    blueprint.migrationStage === MIGRATION_STAGES.READY_FOR_MIGRATION &&
    blueprint.migrationReadiness.status !== READINESS_STATUS.READY
  ) {
    reasons.push("READY_FOR_MIGRATION_REQUIRES_READY_STATUS");
  }

  if (
    blueprint.migrationStage === MIGRATION_STAGES.REQUIRES_REVIEW &&
    blueprint.migrationReadiness.status === READINESS_STATUS.READY &&
    blueprint.prerequisites.length === 0
  ) {
    reasons.push("REQUIRES_REVIEW_INCONSISTENT_WITH_READY_STATUS");
  }

  const stepOrders = blueprint.migrationSteps.map((step) => step.order);
  for (let i = 0; i < stepOrders.length; i += 1) {
    if (stepOrders[i] !== i + 1) {
      reasons.push("MIGRATION_STEPS_MUST_BE_SEQUENTIAL");
      break;
    }
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} blueprint
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentMigrationBlueprint(blueprint) {
  const validation = validateRecruitmentMigrationBlueprint(blueprint);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_MIGRATION_BLUEPRINT_PHASE,
      entity: RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY,
      valid: false,
      migrationStage: MIGRATION_STAGES.REQUIRES_REVIEW,
      readinessStatus: READINESS_STATUS.NOT_READY,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      prerequisiteCount: 0,
      riskCount: 0,
      deferredItemCount: 0,
      migrationStepCount: 0,
      readOnly: true,
      performsMigration: false
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_MIGRATION_BLUEPRINT_PHASE,
    entity: RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY,
    valid: true,
    migrationStage: blueprint.migrationStage,
    readinessStatus: blueprint.migrationReadiness.status,
    confidence: blueprint.migrationReadiness.confidence,
    prerequisiteCount: blueprint.prerequisites.length,
    riskCount: blueprint.risks.length,
    deferredItemCount: blueprint.deferredItems.length,
    migrationStepCount: blueprint.migrationSteps.length,
    architectureAnalysisAvailable: blueprint.metadata.architectureAnalysisAvailable === true,
    mappingPlanAvailable: blueprint.metadata.mappingPlanAvailable === true,
    candidateAnalysisAvailable: blueprint.metadata.candidateAnalysisAvailable === true,
    readOnly: true,
    performsMigration: false
  });
}

module.exports = {
  RECRUITMENT_MIGRATION_BLUEPRINT_PHASE,
  RECRUITMENT_MIGRATION_BLUEPRINT_ENTITY,
  MIGRATION_STAGES,
  SUPPORTED_MIGRATION_STAGES,
  READINESS_STATUS,
  SUPPORTED_READINESS_STATUSES,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  PREREQUISITE_CODES,
  PREREQUISITE_CODE_LIST,
  RISK_IDS,
  DEFERRED_ITEM_IDS,
  MIGRATION_STEP_DEFINITIONS,
  RECRUITMENT_MIGRATION_BLUEPRINT_DESCRIPTOR,
  RECRUITMENT_MIGRATION_BLUEPRINT_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_MIGRATION_BLUEPRINT,
  createRecruitmentMigrationBlueprint,
  isRecruitmentMigrationBlueprint,
  validateRecruitmentMigrationBlueprint,
  summarizeRecruitmentMigrationBlueprint
};
