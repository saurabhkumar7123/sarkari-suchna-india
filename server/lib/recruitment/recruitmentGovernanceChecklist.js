"use strict";

/**
 * Phase 142 — Recruitment Governance Checklist (Advisory Only).
 *
 * Pure advisory governance checklist consolidating architecture, rollout,
 * observability, diagnostics, operational, and documentation review signals.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE = 142;

const RECRUITMENT_GOVERNANCE_CHECKLIST_ENTITY = "recruitment_governance_checklist";

const CHECKLIST_SCHEMA_VERSION = "1.0.0";

const GOVERNANCE_CHECK_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNSATISFIED: "UNSATISFIED",
  UNKNOWN: "UNKNOWN"
});

const GOVERNANCE_POSTURE = Object.freeze({
  GOVERNANCE_READY: "GOVERNANCE_READY",
  GOVERNANCE_REVIEW_REQUIRED: "GOVERNANCE_REVIEW_REQUIRED",
  GOVERNANCE_BLOCKED: "GOVERNANCE_BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const REVIEW_SECTION_IDS = Object.freeze({
  ARCHITECTURE: "architectureReview",
  ROLLOUT: "rolloutReview",
  OBSERVABILITY: "observabilityReview",
  DIAGNOSTICS: "diagnosticsReview",
  OPERATIONAL: "operationalReview",
  DOCUMENTATION: "documentationReview"
});

const REVIEW_SECTION_ORDER = Object.freeze([
  REVIEW_SECTION_IDS.ARCHITECTURE,
  REVIEW_SECTION_IDS.ROLLOUT,
  REVIEW_SECTION_IDS.OBSERVABILITY,
  REVIEW_SECTION_IDS.DIAGNOSTICS,
  REVIEW_SECTION_IDS.OPERATIONAL,
  REVIEW_SECTION_IDS.DOCUMENTATION
]);

const REVIEW_SECTION_DEFINITIONS = Object.freeze([
  Object.freeze({ id: REVIEW_SECTION_IDS.ARCHITECTURE, label: "Architecture Review", order: 1 }),
  Object.freeze({ id: REVIEW_SECTION_IDS.ROLLOUT, label: "Rollout Review", order: 2 }),
  Object.freeze({ id: REVIEW_SECTION_IDS.OBSERVABILITY, label: "Observability Review", order: 3 }),
  Object.freeze({ id: REVIEW_SECTION_IDS.DIAGNOSTICS, label: "Diagnostics Review", order: 4 }),
  Object.freeze({ id: REVIEW_SECTION_IDS.OPERATIONAL, label: "Operational Review", order: 5 }),
  Object.freeze({ id: REVIEW_SECTION_IDS.DOCUMENTATION, label: "Documentation Review", order: 6 })
]);

const CHECK_STATUS_SCORE = Object.freeze({
  [GOVERNANCE_CHECK_STATUS.SATISFIED]: 100,
  [GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED]: 50,
  [GOVERNANCE_CHECK_STATUS.UNSATISFIED]: 0,
  [GOVERNANCE_CHECK_STATUS.UNKNOWN]: 0
});

const RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA = Object.freeze({
  phase: RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  governanceChecklistOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141
  ])
});

const RECRUITMENT_GOVERNANCE_CHECKLIST_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_GOVERNANCE_CHECKLIST_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE,
  description:
    "Pure advisory governance checklist covering architecture, rollout, observability, diagnostics, operational, and documentation reviews.",
  schemaVersion: CHECKLIST_SCHEMA_VERSION,
  metadata: RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "governancePosture",
  "overallScore",
  "reviewSections",
  "architectureReview",
  "rolloutReview",
  "observabilityReview",
  "diagnosticsReview",
  "operationalReview",
  "documentationReview",
  "knownGaps",
  "confidence",
  "advisoryMetadata"
]);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
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

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedGovernanceInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const objectFields = [
    "architectureSummary",
    "compositionValidation",
    "integrationContractSummary",
    "integrationContract",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "featureFlagStrategy",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment",
    "operationalReadinessAssessment",
    "adoptionBlueprintSummary",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
    "governanceCompliance"
  ];

  for (let i = 0; i < objectFields.length; i += 1) {
    const field = objectFields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  if (input.recruitmentId != null) {
    if (typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulGovernanceSignals(input) {
  const signalFields = [
    "architectureSummary",
    "compositionValidation",
    "integrationContractSummary",
    "integrationContract",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "featureFlagStrategy",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment",
    "operationalReadinessAssessment",
    "adoptionBlueprintSummary",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
    "governanceCompliance",
    "recruitmentId"
  ];

  for (let i = 0; i < signalFields.length; i += 1) {
    if (input[signalFields[i]] != null) {
      return true;
    }
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>|null}
 */
function resolveRolloutPlannerInput(input) {
  if (isPlainObject(input.integrationRolloutPlan)) {
    return input.integrationRolloutPlan;
  }
  if (isPlainObject(input.integrationRolloutPlanner)) {
    return input.integrationRolloutPlanner;
  }
  if (isPlainObject(input.rolloutPlanner)) {
    return input.rolloutPlanner;
  }
  return null;
}

/**
 * @param {string} status
 * @returns {number}
 */
function scoreForStatus(status) {
  return CHECK_STATUS_SCORE[status] ?? 0;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateArchitectureReview(input) {
  const architecture = isPlainObject(input.architectureSummary) ? input.architectureSummary : null;
  const validation = isPlainObject(input.compositionValidation) ? input.compositionValidation : null;
  const contractSummary = isPlainObject(input.integrationContractSummary)
    ? input.integrationContractSummary
    : null;
  const contract = isPlainObject(input.integrationContract) ? input.integrationContract : null;

  const hasSignals = architecture != null || validation != null || contractSummary != null || contract != null;

  if (!hasSignals) {
    return {
      reviewId: REVIEW_SECTION_IDS.ARCHITECTURE,
      status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
      score: 0,
      hasSignals: false,
      items: Object.freeze([
        Object.freeze({
          itemId: "architecture_blueprint_defined",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Architecture blueprint defined"
        }),
        Object.freeze({
          itemId: "composition_validation_passed",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Composition validation passed"
        }),
        Object.freeze({
          itemId: "integration_contract_defined",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Integration contract defined"
        })
      ]),
      gaps: Object.freeze(["architecture_advisory_metadata_missing"]),
      summary: "Architecture review could not be determined from supplied advisory metadata"
    };
  }

  const summaryPosture =
    typeof architecture?.summaryPosture === "string" ? architecture.summaryPosture : "UNKNOWN";
  const validationStatus =
    typeof validation?.validationStatus === "string" ? validation.validationStatus : "UNKNOWN";
  const contractPosture =
    typeof contractSummary?.summaryPosture === "string"
      ? contractSummary.summaryPosture
      : typeof contract?.contractStatus === "string"
        ? contract.contractStatus
        : "UNKNOWN";

  const blueprintStatus =
    summaryPosture === "ARCHITECTURE_READY" || summaryPosture === "ARCHITECTURE_REVIEW_REQUIRED"
      ? summaryPosture === "ARCHITECTURE_READY"
        ? GOVERNANCE_CHECK_STATUS.SATISFIED
        : GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
      : summaryPosture === "ARCHITECTURE_BLOCKED"
        ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
        : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const validationCheckStatus =
    validationStatus === "VALID"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : validationStatus === "PARTIALLY_VALID"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : validationStatus === "INVALID"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const contractCheckStatus =
    contractPosture === "INTEGRATION_CONTRACT_READY" || contractPosture === "CONTRACT_READY"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : contractPosture === "INTEGRATION_BLOCKED" || contractPosture === "BLOCKED_INTEGRATION"
        ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
        : contractPosture.includes("PARTIAL") || contractPosture === "CONTRACT_PARTIAL"
          ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const items = Object.freeze([
    Object.freeze({
      itemId: "architecture_blueprint_defined",
      status: blueprintStatus,
      label: "Architecture blueprint defined"
    }),
    Object.freeze({
      itemId: "composition_validation_passed",
      status: validationCheckStatus,
      label: "Composition validation passed"
    }),
    Object.freeze({
      itemId: "integration_contract_defined",
      status: contractCheckStatus,
      label: "Integration contract defined"
    })
  ]);

  const gaps = [];
  if (blueprintStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED) {
    gaps.push("architecture_blueprint_blocked");
  }
  if (blueprintStatus === GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED) {
    gaps.push("architecture_blueprint_review_required");
  }
  if (validationCheckStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED) {
    gaps.push("composition_validation_failed");
  }
  if (contractCheckStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED) {
    gaps.push("integration_contract_blocked");
  }

  const statuses = items.map((item) => item.status);
  let sectionStatus = GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;
  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNSATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.SATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.SATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.UNKNOWN)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNKNOWN;
  }

  const score = Math.round(
    items.reduce((sum, item) => sum + scoreForStatus(item.status), 0) / items.length
  );

  return {
    reviewId: REVIEW_SECTION_IDS.ARCHITECTURE,
    status: sectionStatus,
    score,
    hasSignals: true,
    items,
    gaps: Object.freeze(gaps),
    summary:
      sectionStatus === GOVERNANCE_CHECK_STATUS.SATISFIED
        ? "Architecture review satisfied for advisory governance"
        : sectionStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED
          ? "Architecture review blocked by advisory signals"
          : "Architecture review requires advisory attention"
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateRolloutReview(input) {
  const rolloutPlan = resolveRolloutPlannerInput(input);
  const strategy = isPlainObject(input.featureFlagStrategy) ? input.featureFlagStrategy : null;
  const hasSignals = rolloutPlan != null || strategy != null;

  if (!hasSignals) {
    return {
      reviewId: REVIEW_SECTION_IDS.ROLLOUT,
      status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
      score: 0,
      hasSignals: false,
      items: Object.freeze([
        Object.freeze({
          itemId: "rollout_plan_defined",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Rollout plan defined"
        }),
        Object.freeze({
          itemId: "rollout_stages_ready",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Rollout stages ready"
        }),
        Object.freeze({
          itemId: "feature_flag_strategy_defined",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Feature flag strategy defined"
        })
      ]),
      gaps: Object.freeze(["rollout_advisory_metadata_missing"]),
      summary: "Rollout review could not be determined from supplied advisory metadata"
    };
  }

  const stages = Array.isArray(rolloutPlan?.rolloutStages) ? rolloutPlan.rolloutStages : [];
  const blockedCount = stages.filter((stage) => stage?.status === "BLOCKED").length;
  const readyCount = stages.filter((stage) => stage?.status === "READY").length;

  const planStatus =
    rolloutPlan == null
      ? GOVERNANCE_CHECK_STATUS.UNKNOWN
      : blockedCount > 0
        ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
        : stages.length > 0 && readyCount === stages.length
          ? GOVERNANCE_CHECK_STATUS.SATISFIED
          : readyCount > 0
            ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
            : GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;

  const stagesStatus =
    rolloutPlan == null
      ? GOVERNANCE_CHECK_STATUS.UNKNOWN
      : blockedCount > 0
        ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
        : stages.length > 0 && readyCount === stages.length
          ? GOVERNANCE_CHECK_STATUS.SATISFIED
          : readyCount > 0
            ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
            : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const flagPosture =
    typeof strategy?.flagStrategyPosture === "string" ? strategy.flagStrategyPosture : "STRATEGY_UNKNOWN";
  const flagStatus =
    flagPosture === "STRATEGY_DEFINED"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : flagPosture === "STRATEGY_PARTIAL"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : flagPosture === "STRATEGY_BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const items = Object.freeze([
    Object.freeze({ itemId: "rollout_plan_defined", status: planStatus, label: "Rollout plan defined" }),
    Object.freeze({ itemId: "rollout_stages_ready", status: stagesStatus, label: "Rollout stages ready" }),
    Object.freeze({
      itemId: "feature_flag_strategy_defined",
      status: flagStatus,
      label: "Feature flag strategy defined"
    })
  ]);

  const gaps = [];
  if (blockedCount > 0) {
    gaps.push("rollout_stage_blocked");
  }
  if (flagPosture === "STRATEGY_BLOCKED") {
    gaps.push("feature_flag_strategy_blocked");
  }
  if (rolloutPlan == null) {
    gaps.push("rollout_plan_missing");
  }

  const statuses = items.map((item) => item.status);
  let sectionStatus = GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;
  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNSATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.SATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.SATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.UNKNOWN)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNKNOWN;
  }

  const score = Math.round(
    items.reduce((sum, item) => sum + scoreForStatus(item.status), 0) / items.length
  );

  return {
    reviewId: REVIEW_SECTION_IDS.ROLLOUT,
    status: sectionStatus,
    score,
    hasSignals: true,
    items,
    gaps: Object.freeze(gaps),
    summary:
      sectionStatus === GOVERNANCE_CHECK_STATUS.SATISFIED
        ? "Rollout review satisfied for advisory governance"
        : sectionStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED
          ? "Rollout review blocked by advisory signals"
          : "Rollout review requires advisory attention"
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateObservabilityReview(input) {
  const planning = isPlainObject(input.observabilityPlanning) ? input.observabilityPlanning : null;
  const rolloutReadiness = isPlainObject(input.observationRolloutReadiness)
    ? input.observationRolloutReadiness
    : null;
  const health = isPlainObject(input.observationHealth) ? input.observationHealth : null;
  const hasSignals = planning != null || rolloutReadiness != null || health != null;

  if (!hasSignals) {
    return {
      reviewId: REVIEW_SECTION_IDS.OBSERVABILITY,
      status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
      score: 0,
      hasSignals: false,
      items: Object.freeze([
        Object.freeze({
          itemId: "observability_planning_defined",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Observability planning defined"
        }),
        Object.freeze({
          itemId: "observation_contract_ready",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Observation contract ready"
        }),
        Object.freeze({
          itemId: "observation_health_acceptable",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Observation health acceptable"
        })
      ]),
      gaps: Object.freeze(["observability_advisory_metadata_missing"]),
      summary: "Observability review could not be determined from supplied advisory metadata"
    };
  }

  const observabilityPosture =
    typeof planning?.observabilityPosture === "string"
      ? planning.observabilityPosture
      : "OBSERVABILITY_UNKNOWN";
  const contractStatus =
    typeof planning?.contractStatus === "string" ? planning.contractStatus : "UNKNOWN";
  const healthStatus =
    typeof health?.status === "string"
      ? health.status
      : typeof rolloutReadiness?.healthStatus === "string"
        ? rolloutReadiness.healthStatus
        : "UNKNOWN";

  const planningStatus =
    observabilityPosture === "OBSERVABILITY_DEFINED"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : observabilityPosture === "OBSERVABILITY_PARTIAL"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : observabilityPosture === "OBSERVABILITY_BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const contractCheckStatus =
    contractStatus === "CONTRACT_READY"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : contractStatus === "CONTRACT_PARTIAL"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : contractStatus === "CONTRACT_BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const healthCheckStatus =
    healthStatus === "READY" || healthStatus === "HEALTHY"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : healthStatus === "INCOMPLETE" || healthStatus === "AT_RISK"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : healthStatus === "BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const items = Object.freeze([
    Object.freeze({
      itemId: "observability_planning_defined",
      status: planningStatus,
      label: "Observability planning defined"
    }),
    Object.freeze({
      itemId: "observation_contract_ready",
      status: contractCheckStatus,
      label: "Observation contract ready"
    }),
    Object.freeze({
      itemId: "observation_health_acceptable",
      status: healthCheckStatus,
      label: "Observation health acceptable"
    })
  ]);

  const gaps = [];
  if (observabilityPosture === "OBSERVABILITY_BLOCKED") {
    gaps.push("observability_planning_blocked");
  }
  if (contractStatus === "CONTRACT_BLOCKED") {
    gaps.push("observation_contract_blocked");
  }
  if (healthStatus === "BLOCKED") {
    gaps.push("observation_health_blocked");
  }

  const statuses = items.map((item) => item.status);
  let sectionStatus = GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;
  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNSATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.SATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.SATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.UNKNOWN)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNKNOWN;
  }

  const score = Math.round(
    items.reduce((sum, item) => sum + scoreForStatus(item.status), 0) / items.length
  );

  return {
    reviewId: REVIEW_SECTION_IDS.OBSERVABILITY,
    status: sectionStatus,
    score,
    hasSignals: true,
    items,
    gaps: Object.freeze(gaps),
    summary:
      sectionStatus === GOVERNANCE_CHECK_STATUS.SATISFIED
        ? "Observability review satisfied for advisory governance"
        : sectionStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED
          ? "Observability review blocked by advisory signals"
          : "Observability review requires advisory attention"
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateDiagnosticsReview(input) {
  const planning = isPlainObject(input.diagnosticsPlanning) ? input.diagnosticsPlanning : null;
  const attachment = isPlainObject(input.diagnosticsAttachment) ? input.diagnosticsAttachment : null;
  const hasSignals = planning != null || attachment != null;

  if (!hasSignals) {
    return {
      reviewId: REVIEW_SECTION_IDS.DIAGNOSTICS,
      status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
      score: 0,
      hasSignals: false,
      items: Object.freeze([
        Object.freeze({
          itemId: "diagnostics_planning_defined",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Diagnostics planning defined"
        }),
        Object.freeze({
          itemId: "diagnostics_attachment_ready",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Diagnostics attachment ready"
        }),
        Object.freeze({
          itemId: "diagnostics_coverage_adequate",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Diagnostics coverage adequate"
        })
      ]),
      gaps: Object.freeze(["diagnostics_advisory_metadata_missing"]),
      summary: "Diagnostics review could not be determined from supplied advisory metadata"
    };
  }

  const diagnosticsPosture =
    typeof planning?.diagnosticsPosture === "string"
      ? planning.diagnosticsPosture
      : "DIAGNOSTICS_UNKNOWN";
  const attachmentReady =
    attachment?.attachmentReady === true || planning?.attachmentReady === true;
  const coverageRatio =
    typeof planning?.coverageRatio === "number"
      ? planning.coverageRatio
      : typeof attachment?.coverageRatio === "number"
        ? attachment.coverageRatio
        : null;

  const planningStatus =
    diagnosticsPosture === "DIAGNOSTICS_DEFINED"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : diagnosticsPosture === "DIAGNOSTICS_PARTIAL"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : diagnosticsPosture === "DIAGNOSTICS_BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const attachmentStatus = attachmentReady
    ? GOVERNANCE_CHECK_STATUS.SATISFIED
    : GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;

  const coverageStatus =
    coverageRatio == null
      ? GOVERNANCE_CHECK_STATUS.UNKNOWN
      : coverageRatio >= 1
        ? GOVERNANCE_CHECK_STATUS.SATISFIED
        : coverageRatio >= 0.5
          ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
          : GOVERNANCE_CHECK_STATUS.UNSATISFIED;

  const items = Object.freeze([
    Object.freeze({
      itemId: "diagnostics_planning_defined",
      status: planningStatus,
      label: "Diagnostics planning defined"
    }),
    Object.freeze({
      itemId: "diagnostics_attachment_ready",
      status: attachmentStatus,
      label: "Diagnostics attachment ready"
    }),
    Object.freeze({
      itemId: "diagnostics_coverage_adequate",
      status: coverageStatus,
      label: "Diagnostics coverage adequate"
    })
  ]);

  const gaps = [];
  if (diagnosticsPosture === "DIAGNOSTICS_BLOCKED") {
    gaps.push("diagnostics_planning_blocked");
  }
  if (!attachmentReady) {
    gaps.push("diagnostics_attachment_not_ready");
  }
  if (coverageRatio != null && coverageRatio < 1) {
    gaps.push("diagnostics_coverage_incomplete");
  }

  const statuses = items.map((item) => item.status);
  let sectionStatus = GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;
  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNSATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.SATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.SATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.UNKNOWN)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNKNOWN;
  }

  const score = Math.round(
    items.reduce((sum, item) => sum + scoreForStatus(item.status), 0) / items.length
  );

  return {
    reviewId: REVIEW_SECTION_IDS.DIAGNOSTICS,
    status: sectionStatus,
    score,
    hasSignals: true,
    items,
    gaps: Object.freeze(gaps),
    summary:
      sectionStatus === GOVERNANCE_CHECK_STATUS.SATISFIED
        ? "Diagnostics review satisfied for advisory governance"
        : sectionStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED
          ? "Diagnostics review blocked by advisory signals"
          : "Diagnostics review requires advisory attention"
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateOperationalReview(input) {
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;
  const adoptionSummary = isPlainObject(input.adoptionBlueprintSummary)
    ? input.adoptionBlueprintSummary
    : null;
  const gate = isPlainObject(input.runtimeReadinessGate) ? input.runtimeReadinessGate : null;
  const hasSignals = operational != null || adoptionSummary != null || gate != null;

  if (!hasSignals) {
    return {
      reviewId: REVIEW_SECTION_IDS.OPERATIONAL,
      status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
      score: 0,
      hasSignals: false,
      items: Object.freeze([
        Object.freeze({
          itemId: "operational_readiness_assessed",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Operational readiness assessed"
        }),
        Object.freeze({
          itemId: "deployment_readiness_satisfied",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Deployment readiness satisfied"
        }),
        Object.freeze({
          itemId: "runtime_gate_acceptable",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Runtime gate acceptable"
        })
      ]),
      gaps: Object.freeze(["operational_advisory_metadata_missing"]),
      summary: "Operational review could not be determined from supplied advisory metadata"
    };
  }

  const operationalStatus =
    typeof operational?.status === "string" ? operational.status : "UNKNOWN";
  const summaryPosture =
    typeof adoptionSummary?.summaryPosture === "string" ? adoptionSummary.summaryPosture : "UNKNOWN";
  const gateStatus = typeof gate?.gateStatus === "string" ? gate.gateStatus : "GATE_UNKNOWN";

  const assessedStatus =
    operationalStatus === "OPERATIONAL_READY"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : operationalStatus === "OPERATIONAL_PARTIALLY_READY"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : operationalStatus === "OPERATIONAL_BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : operationalStatus === "OPERATIONAL_REVIEW_REQUIRED"
            ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
            : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const deploymentStatus =
    summaryPosture === "ADOPTION_READY"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : summaryPosture === "ADOPTION_BLOCKED"
        ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
        : summaryPosture !== "UNKNOWN"
          ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const gateCheckStatus =
    gateStatus === "GATE_OPEN"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : gateStatus === "GATE_CONDITIONAL"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : gateStatus === "GATE_CLOSED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const items = Object.freeze([
    Object.freeze({
      itemId: "operational_readiness_assessed",
      status: assessedStatus,
      label: "Operational readiness assessed"
    }),
    Object.freeze({
      itemId: "deployment_readiness_satisfied",
      status: deploymentStatus,
      label: "Deployment readiness satisfied"
    }),
    Object.freeze({
      itemId: "runtime_gate_acceptable",
      status: gateCheckStatus,
      label: "Runtime gate acceptable"
    })
  ]);

  const gaps = [];
  if (operationalStatus === "OPERATIONAL_BLOCKED") {
    gaps.push("operational_readiness_blocked");
  }
  if (summaryPosture === "ADOPTION_BLOCKED") {
    gaps.push("deployment_adoption_blocked");
  }
  if (gateStatus === "GATE_CLOSED") {
    gaps.push("runtime_readiness_gate_closed");
  }

  const statuses = items.map((item) => item.status);
  let sectionStatus = GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;
  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNSATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.SATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.SATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.UNKNOWN)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNKNOWN;
  }

  const score = Math.round(
    items.reduce((sum, item) => sum + scoreForStatus(item.status), 0) / items.length
  );

  return {
    reviewId: REVIEW_SECTION_IDS.OPERATIONAL,
    status: sectionStatus,
    score,
    hasSignals: true,
    items,
    gaps: Object.freeze(gaps),
    summary:
      sectionStatus === GOVERNANCE_CHECK_STATUS.SATISFIED
        ? "Operational review satisfied for advisory governance"
        : sectionStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED
          ? "Operational review blocked by advisory signals"
          : "Operational review requires advisory attention"
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateDocumentationReview(input) {
  const playbook = isPlainObject(input.productionAdoptionPlaybook)
    ? input.productionAdoptionPlaybook
    : null;
  const governance = isPlainObject(input.governanceCompliance) ? input.governanceCompliance : null;
  const hasSignals = playbook != null || governance != null;

  if (!hasSignals) {
    return {
      reviewId: REVIEW_SECTION_IDS.DOCUMENTATION,
      status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
      score: 0,
      hasSignals: false,
      items: Object.freeze([
        Object.freeze({
          itemId: "production_playbook_complete",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Production playbook complete"
        }),
        Object.freeze({
          itemId: "advisory_documentation_present",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Advisory documentation present"
        }),
        Object.freeze({
          itemId: "governance_compliance_documented",
          status: GOVERNANCE_CHECK_STATUS.UNKNOWN,
          label: "Governance compliance documented"
        })
      ]),
      gaps: Object.freeze(["documentation_advisory_metadata_missing"]),
      summary: "Documentation review could not be determined from supplied advisory metadata"
    };
  }

  const playbookPosture =
    typeof playbook?.playbookPosture === "string" ? playbook.playbookPosture : "PLAYBOOK_UNKNOWN";
  const governancePosture =
    typeof governance?.governancePosture === "string" ? governance.governancePosture : "UNKNOWN";
  const sectionCount =
    typeof playbook?.sectionCount === "number" ? playbook.sectionCount : 0;

  const playbookStatus =
    playbookPosture === "PLAYBOOK_COMPLETE"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : playbookPosture === "PLAYBOOK_PARTIAL"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : playbookPosture === "PLAYBOOK_BLOCKED"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const advisoryDocStatus =
    sectionCount > 0 || playbookPosture !== "PLAYBOOK_UNKNOWN"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const complianceStatus =
    governancePosture === "COMPLIANT"
      ? GOVERNANCE_CHECK_STATUS.SATISFIED
      : governancePosture === "PARTIALLY_COMPLIANT"
        ? GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED
        : governancePosture === "NON_COMPLIANT"
          ? GOVERNANCE_CHECK_STATUS.UNSATISFIED
          : GOVERNANCE_CHECK_STATUS.UNKNOWN;

  const items = Object.freeze([
    Object.freeze({
      itemId: "production_playbook_complete",
      status: playbookStatus,
      label: "Production playbook complete"
    }),
    Object.freeze({
      itemId: "advisory_documentation_present",
      status: advisoryDocStatus,
      label: "Advisory documentation present"
    }),
    Object.freeze({
      itemId: "governance_compliance_documented",
      status: complianceStatus,
      label: "Governance compliance documented"
    })
  ]);

  const gaps = [];
  if (playbookPosture === "PLAYBOOK_BLOCKED") {
    gaps.push("production_playbook_blocked");
  }
  if (playbookPosture === "PLAYBOOK_PARTIAL") {
    gaps.push("production_playbook_partial");
  }
  if (governancePosture === "NON_COMPLIANT") {
    gaps.push("governance_compliance_non_compliant");
  }

  const statuses = items.map((item) => item.status);
  let sectionStatus = GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED;
  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNSATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.SATISFIED)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.SATISFIED;
  } else if (statuses.every((s) => s === GOVERNANCE_CHECK_STATUS.UNKNOWN)) {
    sectionStatus = GOVERNANCE_CHECK_STATUS.UNKNOWN;
  }

  const score = Math.round(
    items.reduce((sum, item) => sum + scoreForStatus(item.status), 0) / items.length
  );

  return {
    reviewId: REVIEW_SECTION_IDS.DOCUMENTATION,
    status: sectionStatus,
    score,
    hasSignals: true,
    items,
    gaps: Object.freeze(gaps),
    summary:
      sectionStatus === GOVERNANCE_CHECK_STATUS.SATISFIED
        ? "Documentation review satisfied for advisory governance"
        : sectionStatus === GOVERNANCE_CHECK_STATUS.UNSATISFIED
          ? "Documentation review blocked by advisory signals"
          : "Documentation review requires advisory attention"
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function evaluateAllReviewSections(input) {
  return {
    architectureReview: evaluateArchitectureReview(input),
    rolloutReview: evaluateRolloutReview(input),
    observabilityReview: evaluateObservabilityReview(input),
    diagnosticsReview: evaluateDiagnosticsReview(input),
    operationalReview: evaluateOperationalReview(input),
    documentationReview: evaluateDocumentationReview(input)
  };
}

/**
 * @param {Readonly<Object>} definition
 * @param {Readonly<Object>} review
 * @returns {Readonly<Object>}
 */
function buildReviewSectionSummary(definition, review) {
  const satisfiedCount = review.items.filter(
    (item) => item.status === GOVERNANCE_CHECK_STATUS.SATISFIED
  ).length;

  return deepFreeze({
    reviewId: definition.id,
    reviewLabel: definition.label,
    order: definition.order,
    status: review.status,
    score: review.score,
    hasSignals: review.hasSignals,
    itemCount: review.items.length,
    satisfiedItemCount: satisfiedCount,
    items: Object.freeze(review.items.slice()),
    gaps: Object.freeze(review.gaps.slice()),
    summary: review.summary
  });
}

/**
 * @param {Readonly<Object>} sections
 * @returns {Readonly<Array>}
 */
function buildReviewSectionsArray(sections) {
  const result = [];

  for (let i = 0; i < REVIEW_SECTION_DEFINITIONS.length; i += 1) {
    const definition = REVIEW_SECTION_DEFINITIONS[i];
    const review = sections[definition.id];
    result.push(buildReviewSectionSummary(definition, review));
  }

  return Object.freeze(result);
}

/**
 * @param {Readonly<Object>} sections
 * @returns {Readonly<Array>}
 */
function collectKnownGaps(sections) {
  const gaps = [];

  for (let i = 0; i < REVIEW_SECTION_ORDER.length; i += 1) {
    const sectionId = REVIEW_SECTION_ORDER[i];
    const review = sections[sectionId];
    if (review == null) {
      continue;
    }

    for (let j = 0; j < review.gaps.length; j += 1) {
      const gap = review.gaps[j];
      if (!gaps.includes(gap)) {
        gaps.push(gap);
      }
    }
  }

  return Object.freeze(gaps);
}

/**
 * @param {Readonly<Object>} sections
 * @returns {number}
 */
function calculateOverallScore(sections) {
  const populated = REVIEW_SECTION_ORDER.filter(
    (sectionId) => sections[sectionId]?.hasSignals === true
  );

  if (populated.length === 0) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < populated.length; i += 1) {
    total += sections[populated[i]].score;
  }

  return Math.round(total / populated.length);
}

/**
 * @param {Readonly<Object>} sections
 * @returns {number}
 */
function calculateConfidence(sections) {
  const populated = REVIEW_SECTION_ORDER.filter(
    (sectionId) => sections[sectionId]?.hasSignals === true
  );

  if (populated.length === 0) {
    return 0;
  }

  const overallScore = calculateOverallScore(sections);
  const coverageRatio = populated.length / REVIEW_SECTION_ORDER.length;

  return Math.round(overallScore * coverageRatio);
}

/**
 * @param {Readonly<Object>} sections
 * @returns {string}
 */
function resolveGovernancePosture(sections) {
  const populated = REVIEW_SECTION_ORDER.filter(
    (sectionId) => sections[sectionId]?.hasSignals === true
  );

  if (populated.length === 0) {
    return GOVERNANCE_POSTURE.UNKNOWN;
  }

  const statuses = populated.map((sectionId) => sections[sectionId].status);

  if (statuses.includes(GOVERNANCE_CHECK_STATUS.UNSATISFIED)) {
    return GOVERNANCE_POSTURE.GOVERNANCE_BLOCKED;
  }

  if (
    statuses.every((status) => status === GOVERNANCE_CHECK_STATUS.SATISFIED) &&
    populated.length === REVIEW_SECTION_ORDER.length
  ) {
    return GOVERNANCE_POSTURE.GOVERNANCE_READY;
  }

  return GOVERNANCE_POSTURE.GOVERNANCE_REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildChecklistResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    governancePosture: params.governancePosture,
    overallScore: params.overallScore,
    reviewSections: params.reviewSections,
    architectureReview: deepFreeze(params.sections.architectureReview),
    rolloutReview: deepFreeze(params.sections.rolloutReview),
    observabilityReview: deepFreeze(params.sections.observabilityReview),
    diagnosticsReview: deepFreeze(params.sections.diagnosticsReview),
    operationalReview: deepFreeze(params.sections.operationalReview),
    documentationReview: deepFreeze(params.sections.documentationReview),
    knownGaps: params.knownGaps,
    confidence: params.confidence,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_142",
      phase: RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE,
      governanceChecklistOnly: true,
      executed: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      runtimeWiringEnabled: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false
    })
  });
}

/**
 * Build structured governance checklist from supplied advisory metadata.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentGovernanceChecklist(input) {
  try {
    if (!isRecognizedGovernanceInput(input) || !hasMeaningfulGovernanceSignals(input)) {
      const emptySections = evaluateAllReviewSections({});

      return buildChecklistResult({
        recruitmentId: null,
        governancePosture: GOVERNANCE_POSTURE.UNKNOWN,
        overallScore: 0,
        sections: emptySections,
        reviewSections: buildReviewSectionsArray(emptySections),
        knownGaps: collectKnownGaps(emptySections),
        confidence: 0
      });
    }

    const recruitmentId = resolveRecruitmentId(input.recruitmentId);
    const sections = evaluateAllReviewSections(input);
    const reviewSections = buildReviewSectionsArray(sections);
    const knownGaps = collectKnownGaps(sections);
    const overallScore = calculateOverallScore(sections);
    const confidence = calculateConfidence(sections);
    const governancePosture = resolveGovernancePosture(sections);

    return buildChecklistResult({
      recruitmentId,
      governancePosture,
      overallScore,
      sections,
      reviewSections,
      knownGaps,
      confidence
    });
  } catch {
    const emptySections = evaluateAllReviewSections({});

    return buildChecklistResult({
      recruitmentId: null,
      governancePosture: GOVERNANCE_POSTURE.UNKNOWN,
      overallScore: 0,
      sections: emptySections,
      reviewSections: buildReviewSectionsArray(emptySections),
      knownGaps: collectKnownGaps(emptySections),
      confidence: 0
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentGovernanceChecklist(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!(EXPECTED_RESULT_KEYS[i] in value)) {
      return false;
    }
  }

  if (!Object.values(GOVERNANCE_POSTURE).includes(value.governancePosture)) {
    return false;
  }

  if (typeof value.confidence !== "number" || !Array.isArray(value.reviewSections)) {
    return false;
  }

  if (!isPlainObject(value.advisoryMetadata)) {
    return false;
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.governanceChecklistOnly === true &&
    value.advisoryMetadata.executed === false
  );
}

module.exports = {
  RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE,
  RECRUITMENT_GOVERNANCE_CHECKLIST_ENTITY,
  CHECKLIST_SCHEMA_VERSION,
  GOVERNANCE_CHECK_STATUS,
  GOVERNANCE_POSTURE,
  REVIEW_SECTION_IDS,
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_DEFINITIONS,
  RECRUITMENT_GOVERNANCE_CHECKLIST_DESCRIPTOR,
  RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentGovernanceChecklist,
  isRecruitmentGovernanceChecklist
};
