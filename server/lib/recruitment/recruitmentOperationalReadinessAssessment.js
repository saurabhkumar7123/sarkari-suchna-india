"use strict";

/**
 * Phase 141 — Recruitment Operational Readiness Assessment Framework (Advisory Only).
 *
 * Pure advisory framework that evaluates overall operational readiness from supplied
 * advisory metadata across deployment, observability, diagnostics, rollout, feature
 * flags, and workflow coverage. Summarizes readiness only — never enables runtime
 * features, writes database records, modifies workflow execution, publishes content,
 * activates rollout, changes feature flags, or integrates into runtime.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE = 141;

const RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_ENTITY =
  "recruitment_operational_readiness_assessment";

const ASSESSMENT_SCHEMA_VERSION = "1.0.0";

const OPERATIONAL_READINESS_STATUS = Object.freeze({
  OPERATIONAL_READY: "OPERATIONAL_READY",
  OPERATIONAL_PARTIALLY_READY: "OPERATIONAL_PARTIALLY_READY",
  OPERATIONAL_REVIEW_REQUIRED: "OPERATIONAL_REVIEW_REQUIRED",
  OPERATIONAL_BLOCKED: "OPERATIONAL_BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const CATEGORY_READINESS_LEVEL = Object.freeze({
  READY: "READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const READINESS_CATEGORY_IDS = Object.freeze({
  DEPLOYMENT: "deployment",
  OBSERVABILITY: "observability",
  DIAGNOSTICS: "diagnostics",
  ROLLOUT: "rollout",
  FEATURE_FLAGS: "featureFlags",
  WORKFLOW_COVERAGE: "workflowCoverage"
});

const READINESS_CATEGORY_ORDER = Object.freeze([
  READINESS_CATEGORY_IDS.DEPLOYMENT,
  READINESS_CATEGORY_IDS.OBSERVABILITY,
  READINESS_CATEGORY_IDS.DIAGNOSTICS,
  READINESS_CATEGORY_IDS.ROLLOUT,
  READINESS_CATEGORY_IDS.FEATURE_FLAGS,
  READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE
]);

const READINESS_CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: READINESS_CATEGORY_IDS.DEPLOYMENT,
    label: "Deployment Readiness",
    order: 1
  }),
  Object.freeze({
    id: READINESS_CATEGORY_IDS.OBSERVABILITY,
    label: "Observability Readiness",
    order: 2
  }),
  Object.freeze({
    id: READINESS_CATEGORY_IDS.DIAGNOSTICS,
    label: "Diagnostics Readiness",
    order: 3
  }),
  Object.freeze({
    id: READINESS_CATEGORY_IDS.ROLLOUT,
    label: "Rollout Readiness",
    order: 4
  }),
  Object.freeze({
    id: READINESS_CATEGORY_IDS.FEATURE_FLAGS,
    label: "Feature Flag Readiness",
    order: 5
  }),
  Object.freeze({
    id: READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE,
    label: "Workflow Coverage",
    order: 6
  })
]);

const CATEGORY_READINESS_SCORE = Object.freeze({
  [CATEGORY_READINESS_LEVEL.READY]: 100,
  [CATEGORY_READINESS_LEVEL.PARTIALLY_READY]: 60,
  [CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED]: 40,
  [CATEGORY_READINESS_LEVEL.BLOCKED]: 0,
  [CATEGORY_READINESS_LEVEL.UNKNOWN]: 0
});

const RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA = Object.freeze({
  phase: RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  operationalReadinessAssessmentOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  createsDrafts: false,
  publishesPages: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  connectsToStorage: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140
  ])
});

const RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE,
  description:
    "Pure advisory operational readiness assessment summarizing deployment, observability, diagnostics, rollout, feature flag, and workflow coverage signals.",
  schemaVersion: ASSESSMENT_SCHEMA_VERSION,
  metadata: RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "status",
  "overallReadiness",
  "categorySummaries",
  "deploymentReadiness",
  "observabilityReadiness",
  "diagnosticsReadiness",
  "rolloutReadiness",
  "featureFlagReadiness",
  "workflowCoverage",
  "knownGaps",
  "recommendedNextActivities",
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
function isRecognizedAssessmentInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const objectFields = [
    "adoptionBlueprintSummary",
    "runtimeAdoptionBlueprint",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
    "featureFlagStrategy",
    "integrationRolloutPlan",
    "rolloutPlanner",
    "integrationRolloutPlanner",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment",
    "capabilityRegistry",
    "workflowCoverage",
    "integrationContractSummary",
    "integrationContract"
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
function hasMeaningfulAssessmentSignals(input) {
  const signalFields = [
    "adoptionBlueprintSummary",
    "runtimeAdoptionBlueprint",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
    "featureFlagStrategy",
    "integrationRolloutPlan",
    "rolloutPlanner",
    "integrationRolloutPlanner",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment",
    "capabilityRegistry",
    "workflowCoverage",
    "integrationContractSummary",
    "integrationContract",
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
 * @returns {Readonly<Object>}
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
 * @param {string} level
 * @returns {number}
 */
function scoreForLevel(level) {
  return CATEGORY_READINESS_SCORE[level] ?? 0;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessDeploymentReadiness(input) {
  const summary = isPlainObject(input.adoptionBlueprintSummary) ? input.adoptionBlueprintSummary : null;
  const blueprint = isPlainObject(input.runtimeAdoptionBlueprint) ? input.runtimeAdoptionBlueprint : null;
  const gate = isPlainObject(input.runtimeReadinessGate) ? input.runtimeReadinessGate : null;
  const playbook = isPlainObject(input.productionAdoptionPlaybook)
    ? input.productionAdoptionPlaybook
    : null;

  const hasSignals =
    summary != null || blueprint != null || gate != null || playbook != null;

  if (!hasSignals) {
    return {
      categoryId: READINESS_CATEGORY_IDS.DEPLOYMENT,
      readinessLevel: CATEGORY_READINESS_LEVEL.UNKNOWN,
      score: 0,
      hasSignals: false,
      signalCount: 0,
      summary: "Deployment readiness could not be determined from supplied advisory metadata",
      gaps: Object.freeze(["deployment_advisory_metadata_missing"])
    };
  }

  const summaryPosture =
    typeof summary?.summaryPosture === "string" ? summary.summaryPosture : "UNKNOWN";
  const adoptionPosture =
    typeof blueprint?.adoptionPosture === "string"
      ? blueprint.adoptionPosture
      : typeof summary?.adoptionOverview?.adoptionPosture === "string"
        ? summary.adoptionOverview.adoptionPosture
        : "ADOPTION_ROADMAP_UNKNOWN";
  const gateStatus =
    typeof gate?.gateStatus === "string"
      ? gate.gateStatus
      : typeof summary?.adoptionOverview?.gateStatus === "string"
        ? summary.adoptionOverview.gateStatus
        : "GATE_UNKNOWN";
  const playbookPosture =
    typeof playbook?.playbookPosture === "string"
      ? playbook.playbookPosture
      : typeof summary?.adoptionOverview?.playbookPosture === "string"
        ? summary.adoptionOverview.playbookPosture
        : "PLAYBOOK_UNKNOWN";

  const gaps = [];

  if (
    summaryPosture === "ADOPTION_BLOCKED" ||
    adoptionPosture === "ADOPTION_ROADMAP_BLOCKED" ||
    gateStatus === "GATE_CLOSED" ||
    playbookPosture === "PLAYBOOK_BLOCKED"
  ) {
    if (gateStatus === "GATE_CLOSED") {
      gaps.push("runtime_readiness_gate_closed");
    }
    if (playbookPosture === "PLAYBOOK_BLOCKED") {
      gaps.push("production_adoption_playbook_blocked");
    }
    if (
      summaryPosture === "ADOPTION_BLOCKED" ||
      adoptionPosture === "ADOPTION_ROADMAP_BLOCKED"
    ) {
      gaps.push("runtime_adoption_blueprint_blocked");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.DEPLOYMENT,
      readinessLevel: CATEGORY_READINESS_LEVEL.BLOCKED,
      score: 0,
      hasSignals: true,
      signalCount: [summary, blueprint, gate, playbook].filter(Boolean).length,
      summary: "Deployment readiness blocked by advisory adoption signals",
      gaps: Object.freeze(gaps)
    };
  }

  const deploymentReady =
    (summaryPosture === "ADOPTION_READY" ||
      adoptionPosture === "ADOPTION_ROADMAP_DEFINED") &&
    gateStatus === "GATE_OPEN" &&
    playbookPosture === "PLAYBOOK_COMPLETE";

  if (deploymentReady) {
    return {
      categoryId: READINESS_CATEGORY_IDS.DEPLOYMENT,
      readinessLevel: CATEGORY_READINESS_LEVEL.READY,
      score: 100,
      hasSignals: true,
      signalCount: [summary, blueprint, gate, playbook].filter(Boolean).length,
      summary: "Deployment readiness satisfied for advisory operational review",
      gaps: Object.freeze([])
    };
  }

  if (
    gateStatus === "GATE_CONDITIONAL" ||
    summaryPosture === "READINESS_GATE_REVIEW_REQUIRED" ||
    summaryPosture === "SHADOW_MODE_REVIEW_REQUIRED"
  ) {
    if (gateStatus === "GATE_CONDITIONAL") {
      gaps.push("runtime_readiness_gate_conditional");
    }
    if (summaryPosture === "SHADOW_MODE_REVIEW_REQUIRED") {
      gaps.push("shadow_mode_review_required");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.DEPLOYMENT,
      readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
      score: 40,
      hasSignals: true,
      signalCount: [summary, blueprint, gate, playbook].filter(Boolean).length,
      summary: "Deployment readiness requires advisory review before operational sign-off",
      gaps: Object.freeze(gaps)
    };
  }

  if (
    adoptionPosture === "ADOPTION_ROADMAP_PARTIAL" ||
    playbookPosture === "PLAYBOOK_PARTIAL" ||
    summaryPosture === "ADOPTION_REVIEW_REQUIRED"
  ) {
    if (adoptionPosture === "ADOPTION_ROADMAP_PARTIAL") {
      gaps.push("runtime_adoption_roadmap_partial");
    }
    if (playbookPosture === "PLAYBOOK_PARTIAL") {
      gaps.push("production_adoption_playbook_partial");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.DEPLOYMENT,
      readinessLevel: CATEGORY_READINESS_LEVEL.PARTIALLY_READY,
      score: 60,
      hasSignals: true,
      signalCount: [summary, blueprint, gate, playbook].filter(Boolean).length,
      summary: "Deployment readiness partially satisfied with advisory gaps remaining",
      gaps: Object.freeze(gaps)
    };
  }

  gaps.push("deployment_advisory_signals_incomplete");

  return {
    categoryId: READINESS_CATEGORY_IDS.DEPLOYMENT,
    readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
    score: 40,
    hasSignals: true,
    signalCount: [summary, blueprint, gate, playbook].filter(Boolean).length,
    summary: "Deployment readiness requires additional advisory metadata for assessment",
    gaps: Object.freeze(gaps)
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessObservabilityReadiness(input) {
  const planning = isPlainObject(input.observabilityPlanning) ? input.observabilityPlanning : null;
  const rolloutReadiness = isPlainObject(input.observationRolloutReadiness)
    ? input.observationRolloutReadiness
    : null;
  const health = isPlainObject(input.observationHealth) ? input.observationHealth : null;

  const hasSignals = planning != null || rolloutReadiness != null || health != null;

  if (!hasSignals) {
    return {
      categoryId: READINESS_CATEGORY_IDS.OBSERVABILITY,
      readinessLevel: CATEGORY_READINESS_LEVEL.UNKNOWN,
      score: 0,
      hasSignals: false,
      signalCount: 0,
      summary: "Observability readiness could not be determined from supplied advisory metadata",
      gaps: Object.freeze(["observability_advisory_metadata_missing"])
    };
  }

  const observabilityPosture =
    typeof planning?.observabilityPosture === "string"
      ? planning.observabilityPosture
      : "OBSERVABILITY_UNKNOWN";
  const contractStatus =
    typeof planning?.contractStatus === "string" ? planning.contractStatus : null;
  const healthStatus =
    typeof health?.status === "string"
      ? health.status
      : typeof rolloutReadiness?.healthStatus === "string"
        ? rolloutReadiness.healthStatus
        : null;
  const rolloutStatus =
    typeof rolloutReadiness?.status === "string" ? rolloutReadiness.status : null;

  const gaps = [];

  if (
    observabilityPosture === "OBSERVABILITY_BLOCKED" ||
    contractStatus === "CONTRACT_BLOCKED" ||
    rolloutStatus === "NOT_READY"
  ) {
    if (contractStatus === "CONTRACT_BLOCKED") {
      gaps.push("observation_contract_blocked");
    }
    if (rolloutStatus === "NOT_READY") {
      gaps.push("observation_rollout_not_ready");
    }
    if (observabilityPosture === "OBSERVABILITY_BLOCKED") {
      gaps.push("observability_planning_blocked");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.OBSERVABILITY,
      readinessLevel: CATEGORY_READINESS_LEVEL.BLOCKED,
      score: 0,
      hasSignals: true,
      signalCount: [planning, rolloutReadiness, health].filter(Boolean).length,
      summary: "Observability readiness blocked by advisory observation signals",
      gaps: Object.freeze(gaps)
    };
  }

  const observabilityReady =
    observabilityPosture === "OBSERVABILITY_DEFINED" ||
    (contractStatus === "CONTRACT_READY" && healthStatus === "READY") ||
    rolloutStatus === "READY";

  if (observabilityReady) {
    return {
      categoryId: READINESS_CATEGORY_IDS.OBSERVABILITY,
      readinessLevel: CATEGORY_READINESS_LEVEL.READY,
      score: 100,
      hasSignals: true,
      signalCount: [planning, rolloutReadiness, health].filter(Boolean).length,
      summary: "Observability readiness satisfied for advisory operational review",
      gaps: Object.freeze([])
    };
  }

  if (
    observabilityPosture === "OBSERVABILITY_PARTIAL" ||
    healthStatus === "INCOMPLETE" ||
    contractStatus === "CONTRACT_PARTIAL"
  ) {
    if (observabilityPosture === "OBSERVABILITY_PARTIAL") {
      gaps.push("observability_planning_partial");
    }
    if (healthStatus === "INCOMPLETE") {
      gaps.push("observation_health_incomplete");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.OBSERVABILITY,
      readinessLevel: CATEGORY_READINESS_LEVEL.PARTIALLY_READY,
      score: 60,
      hasSignals: true,
      signalCount: [planning, rolloutReadiness, health].filter(Boolean).length,
      summary: "Observability readiness partially satisfied with advisory gaps remaining",
      gaps: Object.freeze(gaps)
    };
  }

  gaps.push("observability_advisory_signals_incomplete");

  return {
    categoryId: READINESS_CATEGORY_IDS.OBSERVABILITY,
    readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
    score: 40,
    hasSignals: true,
    signalCount: [planning, rolloutReadiness, health].filter(Boolean).length,
    summary: "Observability readiness requires advisory review",
    gaps: Object.freeze(gaps)
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessDiagnosticsReadiness(input) {
  const planning = isPlainObject(input.diagnosticsPlanning) ? input.diagnosticsPlanning : null;
  const attachment = isPlainObject(input.diagnosticsAttachment) ? input.diagnosticsAttachment : null;

  const hasSignals = planning != null || attachment != null;

  if (!hasSignals) {
    return {
      categoryId: READINESS_CATEGORY_IDS.DIAGNOSTICS,
      readinessLevel: CATEGORY_READINESS_LEVEL.UNKNOWN,
      score: 0,
      hasSignals: false,
      signalCount: 0,
      summary: "Diagnostics readiness could not be determined from supplied advisory metadata",
      gaps: Object.freeze(["diagnostics_advisory_metadata_missing"])
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

  const gaps = [];

  if (diagnosticsPosture === "DIAGNOSTICS_BLOCKED") {
    gaps.push("diagnostics_planning_blocked");
    return {
      categoryId: READINESS_CATEGORY_IDS.DIAGNOSTICS,
      readinessLevel: CATEGORY_READINESS_LEVEL.BLOCKED,
      score: 0,
      hasSignals: true,
      signalCount: [planning, attachment].filter(Boolean).length,
      summary: "Diagnostics readiness blocked by advisory diagnostics signals",
      gaps: Object.freeze(gaps)
    };
  }

  if (diagnosticsPosture === "DIAGNOSTICS_DEFINED" && attachmentReady) {
    return {
      categoryId: READINESS_CATEGORY_IDS.DIAGNOSTICS,
      readinessLevel: CATEGORY_READINESS_LEVEL.READY,
      score: 100,
      hasSignals: true,
      signalCount: [planning, attachment].filter(Boolean).length,
      summary: "Diagnostics readiness satisfied for advisory operational review",
      gaps: Object.freeze([])
    };
  }

  if (
    diagnosticsPosture === "DIAGNOSTICS_PARTIAL" ||
    (coverageRatio != null && coverageRatio > 0 && coverageRatio < 1)
  ) {
    if (diagnosticsPosture === "DIAGNOSTICS_PARTIAL") {
      gaps.push("diagnostics_planning_partial");
    }
    if (coverageRatio != null && coverageRatio < 1) {
      gaps.push("diagnostics_coverage_incomplete");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.DIAGNOSTICS,
      readinessLevel: CATEGORY_READINESS_LEVEL.PARTIALLY_READY,
      score: 60,
      hasSignals: true,
      signalCount: [planning, attachment].filter(Boolean).length,
      summary: "Diagnostics readiness partially satisfied with advisory gaps remaining",
      gaps: Object.freeze(gaps)
    };
  }

  gaps.push("diagnostics_advisory_signals_incomplete");

  return {
    categoryId: READINESS_CATEGORY_IDS.DIAGNOSTICS,
    readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
    score: 40,
    hasSignals: true,
    signalCount: [planning, attachment].filter(Boolean).length,
    summary: "Diagnostics readiness requires advisory review",
    gaps: Object.freeze(gaps)
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessRolloutReadiness(input) {
  const rolloutPlan = resolveRolloutPlannerInput(input);
  const hasSignals = rolloutPlan != null;

  if (!hasSignals) {
    return {
      categoryId: READINESS_CATEGORY_IDS.ROLLOUT,
      readinessLevel: CATEGORY_READINESS_LEVEL.UNKNOWN,
      score: 0,
      hasSignals: false,
      signalCount: 0,
      summary: "Rollout readiness could not be determined from supplied advisory metadata",
      gaps: Object.freeze(["rollout_advisory_metadata_missing"])
    };
  }

  const stages = Array.isArray(rolloutPlan.rolloutStages) ? rolloutPlan.rolloutStages : [];
  const readyCount = stages.filter((stage) => stage?.status === "READY").length;
  const blockedCount = stages.filter((stage) => stage?.status === "BLOCKED").length;
  const inProgressCount = stages.filter((stage) => stage?.status === "IN_PROGRESS").length;
  const gaps = [];

  if (blockedCount > 0) {
    gaps.push("rollout_stage_blocked");
    return {
      categoryId: READINESS_CATEGORY_IDS.ROLLOUT,
      readinessLevel: CATEGORY_READINESS_LEVEL.BLOCKED,
      score: 0,
      hasSignals: true,
      signalCount: 1,
      readyStageCount: readyCount,
      totalStageCount: stages.length,
      summary: "Rollout readiness blocked by advisory rollout stage signals",
      gaps: Object.freeze(gaps)
    };
  }

  if (stages.length > 0 && readyCount === stages.length) {
    return {
      categoryId: READINESS_CATEGORY_IDS.ROLLOUT,
      readinessLevel: CATEGORY_READINESS_LEVEL.READY,
      score: 100,
      hasSignals: true,
      signalCount: 1,
      readyStageCount: readyCount,
      totalStageCount: stages.length,
      summary: "Rollout readiness satisfied for advisory operational review",
      gaps: Object.freeze([])
    };
  }

  if (inProgressCount > 0 || readyCount > 0) {
    if (inProgressCount > 0) {
      gaps.push("rollout_stage_in_progress");
    }
    if (readyCount > 0 && readyCount < stages.length) {
      gaps.push("rollout_stages_incomplete");
    }

    return {
      categoryId: READINESS_CATEGORY_IDS.ROLLOUT,
      readinessLevel: CATEGORY_READINESS_LEVEL.PARTIALLY_READY,
      score: 60,
      hasSignals: true,
      signalCount: 1,
      readyStageCount: readyCount,
      totalStageCount: stages.length,
      summary: "Rollout readiness partially satisfied with advisory gaps remaining",
      gaps: Object.freeze(gaps)
    };
  }

  gaps.push("rollout_advisory_signals_incomplete");

  return {
    categoryId: READINESS_CATEGORY_IDS.ROLLOUT,
    readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
    score: 40,
    hasSignals: true,
    signalCount: 1,
    readyStageCount: readyCount,
    totalStageCount: stages.length,
    summary: "Rollout readiness requires advisory review",
    gaps: Object.freeze(gaps)
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessFeatureFlagReadiness(input) {
  const strategy = isPlainObject(input.featureFlagStrategy) ? input.featureFlagStrategy : null;
  const hasSignals = strategy != null;

  if (!hasSignals) {
    return {
      categoryId: READINESS_CATEGORY_IDS.FEATURE_FLAGS,
      readinessLevel: CATEGORY_READINESS_LEVEL.UNKNOWN,
      score: 0,
      hasSignals: false,
      signalCount: 0,
      summary: "Feature flag readiness could not be determined from supplied advisory metadata",
      gaps: Object.freeze(["feature_flag_advisory_metadata_missing"])
    };
  }

  const flagStrategyPosture =
    typeof strategy.flagStrategyPosture === "string"
      ? strategy.flagStrategyPosture
      : "STRATEGY_UNKNOWN";
  const flagCount = typeof strategy.flagCount === "number" ? strategy.flagCount : 0;
  const gaps = [];

  if (flagStrategyPosture === "STRATEGY_BLOCKED") {
    gaps.push("feature_flag_strategy_blocked");
    return {
      categoryId: READINESS_CATEGORY_IDS.FEATURE_FLAGS,
      readinessLevel: CATEGORY_READINESS_LEVEL.BLOCKED,
      score: 0,
      hasSignals: true,
      signalCount: 1,
      flagCount,
      summary: "Feature flag readiness blocked by advisory strategy signals",
      gaps: Object.freeze(gaps)
    };
  }

  if (flagStrategyPosture === "STRATEGY_DEFINED" && flagCount > 0) {
    return {
      categoryId: READINESS_CATEGORY_IDS.FEATURE_FLAGS,
      readinessLevel: CATEGORY_READINESS_LEVEL.READY,
      score: 100,
      hasSignals: true,
      signalCount: 1,
      flagCount,
      summary: "Feature flag readiness satisfied for advisory operational review",
      gaps: Object.freeze([])
    };
  }

  if (flagStrategyPosture === "STRATEGY_PARTIAL") {
    gaps.push("feature_flag_strategy_partial");
    return {
      categoryId: READINESS_CATEGORY_IDS.FEATURE_FLAGS,
      readinessLevel: CATEGORY_READINESS_LEVEL.PARTIALLY_READY,
      score: 60,
      hasSignals: true,
      signalCount: 1,
      flagCount,
      summary: "Feature flag readiness partially satisfied with advisory gaps remaining",
      gaps: Object.freeze(gaps)
    };
  }

  gaps.push("feature_flag_advisory_signals_incomplete");

  return {
    categoryId: READINESS_CATEGORY_IDS.FEATURE_FLAGS,
    readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
    score: 40,
    hasSignals: true,
    signalCount: 1,
    flagCount,
    summary: "Feature flag readiness requires advisory review",
    gaps: Object.freeze(gaps)
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessWorkflowCoverage(input) {
  const registry = isPlainObject(input.capabilityRegistry) ? input.capabilityRegistry : null;
  const coverage = isPlainObject(input.workflowCoverage) ? input.workflowCoverage : null;
  const contractSummary = isPlainObject(input.integrationContractSummary)
    ? input.integrationContractSummary
    : null;
  const contract = isPlainObject(input.integrationContract) ? input.integrationContract : null;

  const hasSignals =
    registry != null || coverage != null || contractSummary != null || contract != null;

  if (!hasSignals) {
    return {
      categoryId: READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE,
      readinessLevel: CATEGORY_READINESS_LEVEL.UNKNOWN,
      score: 0,
      hasSignals: false,
      signalCount: 0,
      registeredCapabilityCount: 0,
      coverageRatio: 0,
      summary: "Workflow coverage could not be determined from supplied advisory metadata",
      gaps: Object.freeze(["workflow_coverage_advisory_metadata_missing"])
    };
  }

  const capabilities = Array.isArray(registry?.capabilities) ? registry.capabilities : [];
  const registeredCapabilityCount =
    typeof coverage?.registeredCapabilityCount === "number"
      ? coverage.registeredCapabilityCount
      : capabilities.length;
  const expectedCapabilityCount =
    typeof coverage?.expectedCapabilityCount === "number" ? coverage.expectedCapabilityCount : 8;
  const coverageRatio =
    typeof coverage?.coverageRatio === "number"
      ? coverage.coverageRatio
      : expectedCapabilityCount > 0
        ? registeredCapabilityCount / expectedCapabilityCount
        : 0;

  const contractPosture =
    typeof contractSummary?.summaryPosture === "string"
      ? contractSummary.summaryPosture
      : typeof contract?.contractStatus === "string"
        ? contract.contractStatus
        : null;

  const gaps = [];

  if (
    contractPosture === "INTEGRATION_BLOCKED" ||
    contractPosture === "BLOCKED_INTEGRATION"
  ) {
    gaps.push("integration_contract_blocked");
    return {
      categoryId: READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE,
      readinessLevel: CATEGORY_READINESS_LEVEL.BLOCKED,
      score: 0,
      hasSignals: true,
      signalCount: [registry, coverage, contractSummary, contract].filter(Boolean).length,
      registeredCapabilityCount,
      coverageRatio,
      summary: "Workflow coverage blocked by advisory integration contract signals",
      gaps: Object.freeze(gaps)
    };
  }

  if (coverageRatio >= 1 || registeredCapabilityCount >= expectedCapabilityCount) {
    return {
      categoryId: READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE,
      readinessLevel: CATEGORY_READINESS_LEVEL.READY,
      score: 100,
      hasSignals: true,
      signalCount: [registry, coverage, contractSummary, contract].filter(Boolean).length,
      registeredCapabilityCount,
      coverageRatio,
      summary: "Workflow coverage satisfied for advisory operational review",
      gaps: Object.freeze([])
    };
  }

  if (coverageRatio >= 0.5 || registeredCapabilityCount > 0) {
    gaps.push("workflow_capability_coverage_partial");
    return {
      categoryId: READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE,
      readinessLevel: CATEGORY_READINESS_LEVEL.PARTIALLY_READY,
      score: 60,
      hasSignals: true,
      signalCount: [registry, coverage, contractSummary, contract].filter(Boolean).length,
      registeredCapabilityCount,
      coverageRatio,
      summary: "Workflow coverage partially satisfied with advisory gaps remaining",
      gaps: Object.freeze(gaps)
    };
  }

  gaps.push("workflow_coverage_advisory_signals_incomplete");

  return {
    categoryId: READINESS_CATEGORY_IDS.WORKFLOW_COVERAGE,
    readinessLevel: CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED,
    score: 40,
    hasSignals: true,
    signalCount: [registry, coverage, contractSummary, contract].filter(Boolean).length,
    registeredCapabilityCount,
    coverageRatio,
    summary: "Workflow coverage requires advisory review",
    gaps: Object.freeze(gaps)
  };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function assessAllCategories(input) {
  return {
    deployment: assessDeploymentReadiness(input),
    observability: assessObservabilityReadiness(input),
    diagnostics: assessDiagnosticsReadiness(input),
    rollout: assessRolloutReadiness(input),
    featureFlags: assessFeatureFlagReadiness(input),
    workflowCoverage: assessWorkflowCoverage(input)
  };
}

/**
 * @param {Readonly<Object>} definition
 * @param {Readonly<Object>} assessment
 * @returns {Readonly<Object>}
 */
function buildCategorySummary(definition, assessment) {
  return deepFreeze({
    categoryId: definition.id,
    categoryLabel: definition.label,
    order: definition.order,
    readinessLevel: assessment.readinessLevel,
    score: assessment.score,
    hasSignals: assessment.hasSignals,
    signalCount: assessment.signalCount,
    summary: assessment.summary,
    gaps: Object.freeze(assessment.gaps.slice())
  });
}

/**
 * @param {Readonly<Object>} categories
 * @returns {Readonly<Array>}
 */
function buildCategorySummaries(categories) {
  const summaries = [];

  for (let i = 0; i < READINESS_CATEGORY_DEFINITIONS.length; i += 1) {
    const definition = READINESS_CATEGORY_DEFINITIONS[i];
    const assessment = categories[definition.id];
    summaries.push(buildCategorySummary(definition, assessment));
  }

  return Object.freeze(summaries);
}

/**
 * @param {Readonly<Object>} categories
 * @returns {Readonly<Array>}
 */
function collectKnownGaps(categories) {
  const gaps = [];

  for (let i = 0; i < READINESS_CATEGORY_ORDER.length; i += 1) {
    const categoryId = READINESS_CATEGORY_ORDER[i];
    const assessment = categories[categoryId];
    if (assessment == null) {
      continue;
    }

    for (let j = 0; j < assessment.gaps.length; j += 1) {
      const gap = assessment.gaps[j];
      if (!gaps.includes(gap)) {
        gaps.push(gap);
      }
    }
  }

  return Object.freeze(gaps);
}

/**
 * @param {Readonly<Object>} categories
 * @param {Readonly<Array>} knownGaps
 * @returns {Readonly<Array>}
 */
function buildRecommendedNextActivities(categories, knownGaps) {
  const activities = [];

  if (knownGaps.includes("deployment_advisory_metadata_missing")) {
    activities.push("Supply runtime adoption and deployment advisory metadata");
  }
  if (knownGaps.includes("observability_advisory_metadata_missing")) {
    activities.push("Supply observability planning and observation health advisory metadata");
  }
  if (knownGaps.includes("diagnostics_advisory_metadata_missing")) {
    activities.push("Supply diagnostics planning and attachment advisory metadata");
  }
  if (knownGaps.includes("rollout_advisory_metadata_missing")) {
    activities.push("Supply integration rollout planner advisory metadata");
  }
  if (knownGaps.includes("feature_flag_advisory_metadata_missing")) {
    activities.push("Supply feature flag strategy advisory metadata");
  }
  if (knownGaps.includes("workflow_coverage_advisory_metadata_missing")) {
    activities.push("Supply capability registry and workflow coverage advisory metadata");
  }

  if (knownGaps.includes("runtime_readiness_gate_closed")) {
    activities.push("Review runtime readiness gate advisory checkpoints");
  }
  if (knownGaps.includes("runtime_readiness_gate_conditional")) {
    activities.push("Resolve conditional runtime readiness gate advisory signals");
  }
  if (knownGaps.includes("shadow_mode_review_required")) {
    activities.push("Complete shadow mode advisory blueprint review");
  }
  if (knownGaps.includes("feature_flag_strategy_partial")) {
    activities.push("Complete feature flag strategy advisory definitions");
  }
  if (knownGaps.includes("rollout_stage_blocked")) {
    activities.push("Resolve blocked rollout stage advisory signals");
  }
  if (knownGaps.includes("workflow_capability_coverage_partial")) {
    activities.push("Expand workflow capability registry advisory coverage");
  }

  const populatedCount = READINESS_CATEGORY_ORDER.filter(
    (categoryId) => categories[categoryId]?.hasSignals === true
  ).length;

  if (activities.length === 0 && populatedCount === READINESS_CATEGORY_ORDER.length) {
    const allReady = READINESS_CATEGORY_ORDER.every(
      (categoryId) => categories[categoryId]?.readinessLevel === CATEGORY_READINESS_LEVEL.READY
    );
    if (allReady) {
      activities.push("Proceed with advisory operational readiness review");
    } else {
      activities.push("Review remaining operational readiness advisory gaps");
    }
  }

  if (activities.length === 0) {
    activities.push("Supply additional operational readiness advisory metadata");
  }

  return Object.freeze(activities);
}

/**
 * @param {Readonly<Object>} categories
 * @returns {number}
 */
function calculateConfidence(categories) {
  const populated = READINESS_CATEGORY_ORDER.filter(
    (categoryId) => categories[categoryId]?.hasSignals === true
  );

  if (populated.length === 0) {
    return 0;
  }

  let totalScore = 0;
  for (let i = 0; i < populated.length; i += 1) {
    totalScore += categories[populated[i]].score;
  }

  const averageScore = totalScore / populated.length;
  const coverageRatio = populated.length / READINESS_CATEGORY_ORDER.length;

  return Math.round(averageScore * coverageRatio);
}

/**
 * @param {Readonly<Object>} categories
 * @returns {string}
 */
function resolveOverallStatus(categories) {
  const populated = READINESS_CATEGORY_ORDER.filter(
    (categoryId) => categories[categoryId]?.hasSignals === true
  );

  if (populated.length === 0) {
    return OPERATIONAL_READINESS_STATUS.UNKNOWN;
  }

  const levels = populated.map((categoryId) => categories[categoryId].readinessLevel);
  const allCategoriesPopulated = populated.length === READINESS_CATEGORY_ORDER.length;

  if (levels.includes(CATEGORY_READINESS_LEVEL.BLOCKED)) {
    return OPERATIONAL_READINESS_STATUS.OPERATIONAL_BLOCKED;
  }

  if (levels.every((level) => level === CATEGORY_READINESS_LEVEL.READY)) {
    if (allCategoriesPopulated) {
      return OPERATIONAL_READINESS_STATUS.OPERATIONAL_READY;
    }
    return OPERATIONAL_READINESS_STATUS.OPERATIONAL_PARTIALLY_READY;
  }

  if (
    levels.includes(CATEGORY_READINESS_LEVEL.PARTIALLY_READY) ||
    levels.includes(CATEGORY_READINESS_LEVEL.REVIEW_REQUIRED)
  ) {
    const allReadyOrPartial = levels.every(
      (level) =>
        level === CATEGORY_READINESS_LEVEL.READY ||
        level === CATEGORY_READINESS_LEVEL.PARTIALLY_READY
    );
    if (allReadyOrPartial && levels.includes(CATEGORY_READINESS_LEVEL.PARTIALLY_READY)) {
      return OPERATIONAL_READINESS_STATUS.OPERATIONAL_PARTIALLY_READY;
    }
    return OPERATIONAL_READINESS_STATUS.OPERATIONAL_REVIEW_REQUIRED;
  }

  return OPERATIONAL_READINESS_STATUS.OPERATIONAL_REVIEW_REQUIRED;
}

/**
 * @param {string} status
 * @param {number} confidence
 * @param {number} populatedCategoryCount
 * @returns {string}
 */
function buildOverallReadinessSummary(status, confidence, populatedCategoryCount) {
  if (status === OPERATIONAL_READINESS_STATUS.UNKNOWN) {
    return "Operational readiness could not be determined from supplied advisory metadata";
  }

  if (status === OPERATIONAL_READINESS_STATUS.OPERATIONAL_READY) {
    return `Operational readiness satisfied across ${populatedCategoryCount} advisory categories with ${confidence}% confidence`;
  }

  if (status === OPERATIONAL_READINESS_STATUS.OPERATIONAL_BLOCKED) {
    return "Operational readiness blocked by advisory signals";
  }

  if (status === OPERATIONAL_READINESS_STATUS.OPERATIONAL_PARTIALLY_READY) {
    return `Operational readiness partially satisfied across ${populatedCategoryCount} advisory categories with ${confidence}% confidence`;
  }

  return `Operational readiness requires advisory review across ${populatedCategoryCount} populated categories with ${confidence}% confidence`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildAssessmentResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    status: params.status,
    overallReadiness: deepFreeze({
      status: params.status,
      confidence: params.confidence,
      populatedCategoryCount: params.populatedCategoryCount,
      totalCategoryCount: READINESS_CATEGORY_ORDER.length,
      summary: params.overallSummary
    }),
    categorySummaries: params.categorySummaries,
    deploymentReadiness: deepFreeze(params.categories.deployment),
    observabilityReadiness: deepFreeze(params.categories.observability),
    diagnosticsReadiness: deepFreeze(params.categories.diagnostics),
    rolloutReadiness: deepFreeze(params.categories.rollout),
    featureFlagReadiness: deepFreeze(params.categories.featureFlags),
    workflowCoverage: deepFreeze(params.categories.workflowCoverage),
    knownGaps: params.knownGaps,
    recommendedNextActivities: params.recommendedNextActivities,
    confidence: params.confidence,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_141",
      phase: RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE,
      operationalReadinessAssessmentOnly: true,
      architectureOnly: true,
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
 * Evaluate overall operational readiness from supplied advisory metadata.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function buildOperationalReadinessAssessment(input) {
  try {
    if (!isRecognizedAssessmentInput(input) || !hasMeaningfulAssessmentSignals(input)) {
      const emptyCategories = assessAllCategories({});

      return buildAssessmentResult({
        recruitmentId: null,
        status: OPERATIONAL_READINESS_STATUS.UNKNOWN,
        confidence: 0,
        populatedCategoryCount: 0,
        overallSummary: buildOverallReadinessSummary(
          OPERATIONAL_READINESS_STATUS.UNKNOWN,
          0,
          0
        ),
        categories: emptyCategories,
        categorySummaries: buildCategorySummaries(emptyCategories),
        knownGaps: collectKnownGaps(emptyCategories),
        recommendedNextActivities: buildRecommendedNextActivities(
          emptyCategories,
          collectKnownGaps(emptyCategories)
        )
      });
    }

    const recruitmentId = resolveRecruitmentId(input.recruitmentId);
    const categories = assessAllCategories(input);
    const categorySummaries = buildCategorySummaries(categories);
    const knownGaps = collectKnownGaps(categories);
    const recommendedNextActivities = buildRecommendedNextActivities(categories, knownGaps);
    const confidence = calculateConfidence(categories);
    const status = resolveOverallStatus(categories);
    const populatedCategoryCount = READINESS_CATEGORY_ORDER.filter(
      (categoryId) => categories[categoryId].hasSignals === true
    ).length;
    const overallSummary = buildOverallReadinessSummary(
      status,
      confidence,
      populatedCategoryCount
    );

    return buildAssessmentResult({
      recruitmentId,
      status,
      confidence,
      populatedCategoryCount,
      overallSummary,
      categories,
      categorySummaries,
      knownGaps,
      recommendedNextActivities
    });
  } catch {
    const emptyCategories = assessAllCategories({});

    return buildAssessmentResult({
      recruitmentId: null,
      status: OPERATIONAL_READINESS_STATUS.UNKNOWN,
      confidence: 0,
      populatedCategoryCount: 0,
      overallSummary: buildOverallReadinessSummary(
        OPERATIONAL_READINESS_STATUS.UNKNOWN,
        0,
        0
      ),
      categories: emptyCategories,
      categorySummaries: buildCategorySummaries(emptyCategories),
      knownGaps: collectKnownGaps(emptyCategories),
      recommendedNextActivities: buildRecommendedNextActivities(
        emptyCategories,
        collectKnownGaps(emptyCategories)
      )
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isOperationalReadinessAssessment(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!(EXPECTED_RESULT_KEYS[i] in value)) {
      return false;
    }
  }

  if (!Object.values(OPERATIONAL_READINESS_STATUS).includes(value.status)) {
    return false;
  }

  if (typeof value.confidence !== "number" || !Array.isArray(value.categorySummaries)) {
    return false;
  }

  if (!isPlainObject(value.advisoryMetadata)) {
    return false;
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.operationalReadinessAssessmentOnly === true &&
    value.advisoryMetadata.executed === false
  );
}

module.exports = {
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_PHASE,
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_ENTITY,
  ASSESSMENT_SCHEMA_VERSION,
  OPERATIONAL_READINESS_STATUS,
  CATEGORY_READINESS_LEVEL,
  READINESS_CATEGORY_IDS,
  READINESS_CATEGORY_ORDER,
  READINESS_CATEGORY_DEFINITIONS,
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_DESCRIPTOR,
  RECRUITMENT_OPERATIONAL_READINESS_ASSESSMENT_METADATA,
  EXPECTED_RESULT_KEYS,
  buildOperationalReadinessAssessment,
  isOperationalReadinessAssessment
};
