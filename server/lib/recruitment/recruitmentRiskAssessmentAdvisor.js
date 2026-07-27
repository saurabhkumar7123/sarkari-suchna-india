"use strict";

/**
 * Phase 142 — Recruitment Risk Assessment Advisor (Advisory Only).
 *
 * Pure advisory risk assessment producing technical, operational, rollout, and
 * monitoring risk summaries with mitigation recommendations. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE = 142;

const RECRUITMENT_RISK_ASSESSMENT_ADVISOR_ENTITY = "recruitment_risk_assessment_advisor";

const RISK_ASSESSMENT_SCHEMA_VERSION = "1.0.0";

const RISK_SEVERITY = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const RISK_CATEGORY = Object.freeze({
  TECHNICAL: "technical",
  OPERATIONAL: "operational",
  ROLLOUT: "rollout",
  MONITORING: "monitoring"
});

const OVERALL_RISK_POSTURE = Object.freeze({
  ACCEPTABLE: "ACCEPTABLE",
  ELEVATED: "ELEVATED",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const SEVERITY_WEIGHT = Object.freeze({
  [RISK_SEVERITY.LOW]: 1,
  [RISK_SEVERITY.MEDIUM]: 2,
  [RISK_SEVERITY.HIGH]: 3,
  [RISK_SEVERITY.CRITICAL]: 4,
  [RISK_SEVERITY.UNKNOWN]: 0
});

const RECRUITMENT_RISK_ASSESSMENT_ADVISOR_METADATA = Object.freeze({
  phase: RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  riskAssessmentAdvisorOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141
  ])
});

const RECRUITMENT_RISK_ASSESSMENT_ADVISOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_RISK_ASSESSMENT_ADVISOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE,
  description:
    "Pure advisory risk assessment covering technical, operational, rollout, and monitoring risks with mitigation recommendations.",
  schemaVersion: RISK_ASSESSMENT_SCHEMA_VERSION,
  metadata: RECRUITMENT_RISK_ASSESSMENT_ADVISOR_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "overallRiskPosture",
  "overallRiskLevel",
  "riskScore",
  "technicalRisks",
  "operationalRisks",
  "rolloutRisks",
  "monitoringRisks",
  "mitigationRecommendations",
  "riskSummary",
  "confidence",
  "advisoryMetadata"
]);

const RISK_CATEGORY_ORDER = Object.freeze([
  RISK_CATEGORY.TECHNICAL,
  RISK_CATEGORY.OPERATIONAL,
  RISK_CATEGORY.ROLLOUT,
  RISK_CATEGORY.MONITORING
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
function isRecognizedRiskInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const objectFields = [
    "architectureSummary",
    "compositionValidation",
    "integrationContractSummary",
    "integrationContract",
    "adoptionBlueprintSummary",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
    "operationalReadinessAssessment",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "featureFlagStrategy",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment"
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
function hasMeaningfulRiskSignals(input) {
  const signalFields = [
    "architectureSummary",
    "compositionValidation",
    "integrationContractSummary",
    "integrationContract",
    "adoptionBlueprintSummary",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
    "operationalReadinessAssessment",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "featureFlagStrategy",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment",
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
 * @param {string} riskId
 * @param {string} category
 * @param {string} severity
 * @param {string} description
 * @param {string} source
 * @returns {Readonly<Object>}
 */
function buildRiskItem(riskId, category, severity, description, source) {
  return deepFreeze({
    riskId,
    category,
    severity,
    description,
    source
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function assessTechnicalRisks(input) {
  const risks = [];
  const architecture = isPlainObject(input.architectureSummary) ? input.architectureSummary : null;
  const validation = isPlainObject(input.compositionValidation) ? input.compositionValidation : null;
  const contractSummary = isPlainObject(input.integrationContractSummary)
    ? input.integrationContractSummary
    : null;
  const contract = isPlainObject(input.integrationContract) ? input.integrationContract : null;

  if (architecture == null && validation == null && contractSummary == null && contract == null) {
    return Object.freeze([
      buildRiskItem(
        "technical_metadata_missing",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.UNKNOWN,
        "Technical risk assessment unavailable due to missing architecture advisory metadata",
        "architecture"
      )
    ]);
  }

  const summaryPosture =
    typeof architecture?.summaryPosture === "string" ? architecture.summaryPosture : null;
  const validationStatus =
    typeof validation?.validationStatus === "string" ? validation.validationStatus : null;
  const contractPosture =
    typeof contractSummary?.summaryPosture === "string"
      ? contractSummary.summaryPosture
      : typeof contract?.contractStatus === "string"
        ? contract.contractStatus
        : null;

  if (summaryPosture === "ARCHITECTURE_BLOCKED") {
    risks.push(
      buildRiskItem(
        "architecture_blueprint_blocked",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.CRITICAL,
        "Architecture blueprint blocked by advisory signals",
        "architectureSummary"
      )
    );
  } else if (summaryPosture === "ARCHITECTURE_REVIEW_REQUIRED") {
    risks.push(
      buildRiskItem(
        "architecture_blueprint_review_required",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.MEDIUM,
        "Architecture blueprint requires advisory review",
        "architectureSummary"
      )
    );
  }

  if (validationStatus === "INVALID") {
    risks.push(
      buildRiskItem(
        "composition_validation_invalid",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.HIGH,
        "Composition validation failed advisory checks",
        "compositionValidation"
      )
    );
  } else if (validationStatus === "PARTIALLY_VALID") {
    risks.push(
      buildRiskItem(
        "composition_validation_partial",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.MEDIUM,
        "Composition validation partially satisfied",
        "compositionValidation"
      )
    );
  }

  if (
    contractPosture === "INTEGRATION_BLOCKED" ||
    contractPosture === "BLOCKED_INTEGRATION"
  ) {
    risks.push(
      buildRiskItem(
        "integration_contract_blocked",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.HIGH,
        "Integration contract blocked by advisory signals",
        "integrationContract"
      )
    );
  }

  if (risks.length === 0) {
    risks.push(
      buildRiskItem(
        "technical_risk_acceptable",
        RISK_CATEGORY.TECHNICAL,
        RISK_SEVERITY.LOW,
        "Technical advisory signals within acceptable risk thresholds",
        "architecture"
      )
    );
  }

  return Object.freeze(risks);
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function assessOperationalRisks(input) {
  const risks = [];
  const adoption = isPlainObject(input.adoptionBlueprintSummary) ? input.adoptionBlueprintSummary : null;
  const gate = isPlainObject(input.runtimeReadinessGate) ? input.runtimeReadinessGate : null;
  const playbook = isPlainObject(input.productionAdoptionPlaybook)
    ? input.productionAdoptionPlaybook
    : null;
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;

  if (adoption == null && gate == null && playbook == null && operational == null) {
    return Object.freeze([
      buildRiskItem(
        "operational_metadata_missing",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.UNKNOWN,
        "Operational risk assessment unavailable due to missing deployment advisory metadata",
        "operational"
      )
    ]);
  }

  const summaryPosture = typeof adoption?.summaryPosture === "string" ? adoption.summaryPosture : null;
  const gateStatus = typeof gate?.gateStatus === "string" ? gate.gateStatus : null;
  const playbookPosture =
    typeof playbook?.playbookPosture === "string" ? playbook.playbookPosture : null;
  const operationalStatus = typeof operational?.status === "string" ? operational.status : null;

  if (summaryPosture === "ADOPTION_BLOCKED") {
    risks.push(
      buildRiskItem(
        "adoption_blueprint_blocked",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.CRITICAL,
        "Runtime adoption blueprint blocked by advisory signals",
        "adoptionBlueprintSummary"
      )
    );
  }

  if (gateStatus === "GATE_CLOSED") {
    risks.push(
      buildRiskItem(
        "runtime_gate_closed",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.HIGH,
        "Runtime readiness gate closed by advisory checkpoints",
        "runtimeReadinessGate"
      )
    );
  } else if (gateStatus === "GATE_CONDITIONAL") {
    risks.push(
      buildRiskItem(
        "runtime_gate_conditional",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.MEDIUM,
        "Runtime readiness gate conditionally open with advisory caveats",
        "runtimeReadinessGate"
      )
    );
  }

  if (playbookPosture === "PLAYBOOK_BLOCKED") {
    risks.push(
      buildRiskItem(
        "production_playbook_blocked",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.HIGH,
        "Production adoption playbook blocked by advisory signals",
        "productionAdoptionPlaybook"
      )
    );
  } else if (playbookPosture === "PLAYBOOK_PARTIAL") {
    risks.push(
      buildRiskItem(
        "production_playbook_partial",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.MEDIUM,
        "Production adoption playbook partially complete",
        "productionAdoptionPlaybook"
      )
    );
  }

  if (operationalStatus === "OPERATIONAL_BLOCKED") {
    risks.push(
      buildRiskItem(
        "operational_readiness_blocked",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.CRITICAL,
        "Operational readiness assessment blocked by advisory signals",
        "operationalReadinessAssessment"
      )
    );
  }

  if (risks.length === 0) {
    risks.push(
      buildRiskItem(
        "operational_risk_acceptable",
        RISK_CATEGORY.OPERATIONAL,
        RISK_SEVERITY.LOW,
        "Operational advisory signals within acceptable risk thresholds",
        "operational"
      )
    );
  }

  return Object.freeze(risks);
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function assessRolloutRisks(input) {
  const risks = [];
  const rolloutPlan = resolveRolloutPlannerInput(input);
  const strategy = isPlainObject(input.featureFlagStrategy) ? input.featureFlagStrategy : null;

  if (rolloutPlan == null && strategy == null) {
    return Object.freeze([
      buildRiskItem(
        "rollout_metadata_missing",
        RISK_CATEGORY.ROLLOUT,
        RISK_SEVERITY.UNKNOWN,
        "Rollout risk assessment unavailable due to missing rollout advisory metadata",
        "rollout"
      )
    ]);
  }

  if (rolloutPlan != null) {
    const stages = Array.isArray(rolloutPlan.rolloutStages) ? rolloutPlan.rolloutStages : [];
    const blockedCount = stages.filter((stage) => stage?.status === "BLOCKED").length;
    const inProgressCount = stages.filter((stage) => stage?.status === "IN_PROGRESS").length;

    if (blockedCount > 0) {
      risks.push(
        buildRiskItem(
          "rollout_stage_blocked",
          RISK_CATEGORY.ROLLOUT,
          RISK_SEVERITY.HIGH,
          "One or more rollout stages blocked by advisory signals",
          "integrationRolloutPlan"
        )
      );
    } else if (inProgressCount > 0) {
      risks.push(
        buildRiskItem(
          "rollout_stage_in_progress",
          RISK_CATEGORY.ROLLOUT,
          RISK_SEVERITY.MEDIUM,
          "Rollout stages in progress with incomplete advisory coverage",
          "integrationRolloutPlan"
        )
      );
    }
  }

  if (strategy != null) {
    const flagPosture =
      typeof strategy.flagStrategyPosture === "string" ? strategy.flagStrategyPosture : null;

    if (flagPosture === "STRATEGY_BLOCKED") {
      risks.push(
        buildRiskItem(
          "feature_flag_strategy_blocked",
          RISK_CATEGORY.ROLLOUT,
          RISK_SEVERITY.HIGH,
          "Feature flag strategy blocked by advisory signals",
          "featureFlagStrategy"
        )
      );
    } else if (flagPosture === "STRATEGY_PARTIAL") {
      risks.push(
        buildRiskItem(
          "feature_flag_strategy_partial",
          RISK_CATEGORY.ROLLOUT,
          RISK_SEVERITY.MEDIUM,
          "Feature flag strategy partially defined",
          "featureFlagStrategy"
        )
      );
    }
  }

  if (risks.length === 0) {
    risks.push(
      buildRiskItem(
        "rollout_risk_acceptable",
        RISK_CATEGORY.ROLLOUT,
        RISK_SEVERITY.LOW,
        "Rollout advisory signals within acceptable risk thresholds",
        "rollout"
      )
    );
  }

  return Object.freeze(risks);
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function assessMonitoringRisks(input) {
  const risks = [];
  const planning = isPlainObject(input.observabilityPlanning) ? input.observabilityPlanning : null;
  const rolloutReadiness = isPlainObject(input.observationRolloutReadiness)
    ? input.observationRolloutReadiness
    : null;
  const health = isPlainObject(input.observationHealth) ? input.observationHealth : null;
  const diagnosticsPlanning = isPlainObject(input.diagnosticsPlanning)
    ? input.diagnosticsPlanning
    : null;
  const diagnosticsAttachment = isPlainObject(input.diagnosticsAttachment)
    ? input.diagnosticsAttachment
    : null;

  if (
    planning == null &&
    rolloutReadiness == null &&
    health == null &&
    diagnosticsPlanning == null &&
    diagnosticsAttachment == null
  ) {
    return Object.freeze([
      buildRiskItem(
        "monitoring_metadata_missing",
        RISK_CATEGORY.MONITORING,
        RISK_SEVERITY.UNKNOWN,
        "Monitoring risk assessment unavailable due to missing observability and diagnostics metadata",
        "monitoring"
      )
    ]);
  }

  if (planning != null) {
    const observabilityPosture =
      typeof planning.observabilityPosture === "string" ? planning.observabilityPosture : null;
    const contractStatus =
      typeof planning.contractStatus === "string" ? planning.contractStatus : null;

    if (observabilityPosture === "OBSERVABILITY_BLOCKED") {
      risks.push(
        buildRiskItem(
          "observability_planning_blocked",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.HIGH,
          "Observability planning blocked by advisory signals",
          "observabilityPlanning"
        )
      );
    } else if (observabilityPosture === "OBSERVABILITY_PARTIAL") {
      risks.push(
        buildRiskItem(
          "observability_planning_partial",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.MEDIUM,
          "Observability planning partially defined",
          "observabilityPlanning"
        )
      );
    }

    if (contractStatus === "CONTRACT_BLOCKED") {
      risks.push(
        buildRiskItem(
          "observation_contract_blocked",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.HIGH,
          "Observation contract blocked by advisory signals",
          "observabilityPlanning"
        )
      );
    }
  }

  if (health != null || rolloutReadiness != null) {
    const healthStatus =
      typeof health?.status === "string"
        ? health.status
        : typeof rolloutReadiness?.healthStatus === "string"
          ? rolloutReadiness.healthStatus
          : null;

    if (healthStatus === "BLOCKED") {
      risks.push(
        buildRiskItem(
          "observation_health_blocked",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.HIGH,
          "Observation health blocked by advisory signals",
          "observationHealth"
        )
      );
    } else if (healthStatus === "INCOMPLETE" || healthStatus === "AT_RISK") {
      risks.push(
        buildRiskItem(
          "observation_health_incomplete",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.MEDIUM,
          "Observation health signals incomplete or at risk",
          "observationHealth"
        )
      );
    }
  }

  if (diagnosticsPlanning != null || diagnosticsAttachment != null) {
    const diagnosticsPosture =
      typeof diagnosticsPlanning?.diagnosticsPosture === "string"
        ? diagnosticsPlanning.diagnosticsPosture
        : null;
    const attachmentReady =
      diagnosticsAttachment?.attachmentReady === true ||
      diagnosticsPlanning?.attachmentReady === true;

    if (diagnosticsPosture === "DIAGNOSTICS_BLOCKED") {
      risks.push(
        buildRiskItem(
          "diagnostics_planning_blocked",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.HIGH,
          "Diagnostics planning blocked by advisory signals",
          "diagnosticsPlanning"
        )
      );
    }

    if (!attachmentReady && diagnosticsPlanning != null) {
      risks.push(
        buildRiskItem(
          "diagnostics_attachment_not_ready",
          RISK_CATEGORY.MONITORING,
          RISK_SEVERITY.MEDIUM,
          "Diagnostics attachment not ready for advisory monitoring",
          "diagnosticsAttachment"
        )
      );
    }
  }

  if (risks.length === 0) {
    risks.push(
      buildRiskItem(
        "monitoring_risk_acceptable",
        RISK_CATEGORY.MONITORING,
        RISK_SEVERITY.LOW,
        "Monitoring advisory signals within acceptable risk thresholds",
        "monitoring"
      )
    );
  }

  return Object.freeze(risks);
}

/**
 * @param {Readonly<Array>} allRisks
 * @returns {Readonly<Array>}
 */
function buildMitigationRecommendations(allRisks) {
  const recommendations = [];
  const riskIds = allRisks.map((risk) => risk.riskId);

  if (riskIds.includes("architecture_blueprint_blocked")) {
    recommendations.push("Resolve blocked architecture blueprint advisory signals before proceeding");
  }
  if (riskIds.includes("composition_validation_invalid")) {
    recommendations.push("Complete composition validation advisory remediation");
  }
  if (riskIds.includes("integration_contract_blocked")) {
    recommendations.push("Review and resolve integration contract advisory blockers");
  }
  if (riskIds.includes("runtime_gate_closed")) {
    recommendations.push("Address runtime readiness gate advisory checkpoints");
  }
  if (riskIds.includes("adoption_blueprint_blocked")) {
    recommendations.push("Resolve runtime adoption blueprint advisory blockers");
  }
  if (riskIds.includes("production_playbook_blocked")) {
    recommendations.push("Complete production adoption playbook advisory sections");
  }
  if (riskIds.includes("rollout_stage_blocked")) {
    recommendations.push("Resolve blocked rollout stage advisory signals");
  }
  if (riskIds.includes("feature_flag_strategy_blocked")) {
    recommendations.push("Complete feature flag strategy advisory definitions");
  }
  if (riskIds.includes("observability_planning_blocked")) {
    recommendations.push("Define observability planning advisory coverage");
  }
  if (riskIds.includes("observation_contract_blocked")) {
    recommendations.push("Resolve observation contract advisory blockers");
  }
  if (riskIds.includes("diagnostics_planning_blocked")) {
    recommendations.push("Complete diagnostics planning advisory coverage");
  }
  if (riskIds.includes("technical_metadata_missing")) {
    recommendations.push("Supply architecture advisory metadata for technical risk assessment");
  }
  if (riskIds.includes("operational_metadata_missing")) {
    recommendations.push("Supply deployment advisory metadata for operational risk assessment");
  }
  if (riskIds.includes("rollout_metadata_missing")) {
    recommendations.push("Supply rollout advisory metadata for rollout risk assessment");
  }
  if (riskIds.includes("monitoring_metadata_missing")) {
    recommendations.push("Supply observability and diagnostics metadata for monitoring risk assessment");
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue advisory governance review with current risk posture");
  }

  return Object.freeze(recommendations);
}

/**
 * @param {Readonly<Array>} allRisks
 * @returns {string}
 */
function resolveOverallRiskLevel(allRisks) {
  const severities = allRisks.map((risk) => risk.severity);

  if (severities.includes(RISK_SEVERITY.CRITICAL)) {
    return RISK_SEVERITY.CRITICAL;
  }
  if (severities.includes(RISK_SEVERITY.HIGH)) {
    return RISK_SEVERITY.HIGH;
  }
  if (severities.includes(RISK_SEVERITY.MEDIUM)) {
    return RISK_SEVERITY.MEDIUM;
  }
  if (severities.every((s) => s === RISK_SEVERITY.UNKNOWN)) {
    return RISK_SEVERITY.UNKNOWN;
  }
  return RISK_SEVERITY.LOW;
}

/**
 * @param {string} overallRiskLevel
 * @returns {string}
 */
function resolveOverallRiskPosture(overallRiskLevel) {
  if (overallRiskLevel === RISK_SEVERITY.CRITICAL) {
    return OVERALL_RISK_POSTURE.CRITICAL;
  }
  if (overallRiskLevel === RISK_SEVERITY.HIGH) {
    return OVERALL_RISK_POSTURE.HIGH;
  }
  if (overallRiskLevel === RISK_SEVERITY.MEDIUM) {
    return OVERALL_RISK_POSTURE.ELEVATED;
  }
  if (overallRiskLevel === RISK_SEVERITY.UNKNOWN) {
    return OVERALL_RISK_POSTURE.UNKNOWN;
  }
  return OVERALL_RISK_POSTURE.ACCEPTABLE;
}

/**
 * @param {Readonly<Array>} allRisks
 * @returns {number}
 */
function calculateRiskScore(allRisks) {
  if (allRisks.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let count = 0;

  for (let i = 0; i < allRisks.length; i += 1) {
    const weight = SEVERITY_WEIGHT[allRisks[i].severity] ?? 0;
    if (weight > 0) {
      totalWeight += weight;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  return Math.round((totalWeight / (count * SEVERITY_WEIGHT[RISK_SEVERITY.CRITICAL])) * 100);
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Array>} categoryRisks
 * @returns {number}
 */
function calculateConfidence(input, categoryRisks) {
  const populatedCategories = categoryRisks.filter(
    (risks) => !risks.some((risk) => risk.riskId.endsWith("_metadata_missing"))
  ).length;

  if (populatedCategories === 0) {
    return 0;
  }

  const coverageRatio = populatedCategories / RISK_CATEGORY_ORDER.length;
  const riskScore = calculateRiskScore(categoryRisks.flat());
  const inverseRisk = 100 - riskScore;

  return Math.round(inverseRisk * coverageRatio);
}

/**
 * @param {string} posture
 * @param {string} level
 * @param {number} riskCount
 * @returns {string}
 */
function buildRiskSummaryText(posture, level, riskCount) {
  if (posture === OVERALL_RISK_POSTURE.UNKNOWN) {
    return "Risk assessment could not be determined from supplied advisory metadata";
  }

  if (posture === OVERALL_RISK_POSTURE.ACCEPTABLE) {
    return `Advisory risk posture acceptable with ${riskCount} identified risk signals at ${level} severity`;
  }

  if (posture === OVERALL_RISK_POSTURE.CRITICAL) {
    return `Advisory risk posture critical with ${riskCount} identified risk signals requiring immediate review`;
  }

  return `Advisory risk posture ${posture.toLowerCase()} with ${riskCount} identified risk signals at ${level} severity`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildRiskAssessmentResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    overallRiskPosture: params.overallRiskPosture,
    overallRiskLevel: params.overallRiskLevel,
    riskScore: params.riskScore,
    technicalRisks: params.technicalRisks,
    operationalRisks: params.operationalRisks,
    rolloutRisks: params.rolloutRisks,
    monitoringRisks: params.monitoringRisks,
    mitigationRecommendations: params.mitigationRecommendations,
    riskSummary: params.riskSummary,
    confidence: params.confidence,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_142",
      phase: RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE,
      riskAssessmentAdvisorOnly: true,
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
 * Assess recruitment advisory risk profile from supplied metadata.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function assessRecruitmentRiskProfile(input) {
  try {
    if (!isRecognizedRiskInput(input) || !hasMeaningfulRiskSignals(input)) {
      const technicalRisks = assessTechnicalRisks({});
      const operationalRisks = assessOperationalRisks({});
      const rolloutRisks = assessRolloutRisks({});
      const monitoringRisks = assessMonitoringRisks({});
      const allRisks = [...technicalRisks, ...operationalRisks, ...rolloutRisks, ...monitoringRisks];
      const overallRiskLevel = resolveOverallRiskLevel(allRisks);
      const overallRiskPosture = resolveOverallRiskPosture(overallRiskLevel);
      const categoryRisks = [technicalRisks, operationalRisks, rolloutRisks, monitoringRisks];

      return buildRiskAssessmentResult({
        recruitmentId: null,
        overallRiskPosture,
        overallRiskLevel,
        riskScore: calculateRiskScore(allRisks),
        technicalRisks,
        operationalRisks,
        rolloutRisks,
        monitoringRisks,
        mitigationRecommendations: buildMitigationRecommendations(allRisks),
        riskSummary: buildRiskSummaryText(overallRiskPosture, overallRiskLevel, allRisks.length),
        confidence: calculateConfidence({}, categoryRisks)
      });
    }

    const recruitmentId = resolveRecruitmentId(input.recruitmentId);
    const technicalRisks = assessTechnicalRisks(input);
    const operationalRisks = assessOperationalRisks(input);
    const rolloutRisks = assessRolloutRisks(input);
    const monitoringRisks = assessMonitoringRisks(input);
    const allRisks = [...technicalRisks, ...operationalRisks, ...rolloutRisks, ...monitoringRisks];
    const overallRiskLevel = resolveOverallRiskLevel(allRisks);
    const overallRiskPosture = resolveOverallRiskPosture(overallRiskLevel);
    const categoryRisks = [technicalRisks, operationalRisks, rolloutRisks, monitoringRisks];

    return buildRiskAssessmentResult({
      recruitmentId,
      overallRiskPosture,
      overallRiskLevel,
      riskScore: calculateRiskScore(allRisks),
      technicalRisks,
      operationalRisks,
      rolloutRisks,
      monitoringRisks,
      mitigationRecommendations: buildMitigationRecommendations(allRisks),
      riskSummary: buildRiskSummaryText(overallRiskPosture, overallRiskLevel, allRisks.length),
      confidence: calculateConfidence(input, categoryRisks)
    });
  } catch {
    const technicalRisks = assessTechnicalRisks({});
    const operationalRisks = assessOperationalRisks({});
    const rolloutRisks = assessRolloutRisks({});
    const monitoringRisks = assessMonitoringRisks({});
    const allRisks = [...technicalRisks, ...operationalRisks, ...rolloutRisks, ...monitoringRisks];

    return buildRiskAssessmentResult({
      recruitmentId: null,
      overallRiskPosture: OVERALL_RISK_POSTURE.UNKNOWN,
      overallRiskLevel: RISK_SEVERITY.UNKNOWN,
      riskScore: 0,
      technicalRisks,
      operationalRisks,
      rolloutRisks,
      monitoringRisks,
      mitigationRecommendations: buildMitigationRecommendations(allRisks),
      riskSummary: buildRiskSummaryText(OVERALL_RISK_POSTURE.UNKNOWN, RISK_SEVERITY.UNKNOWN, allRisks.length),
      confidence: 0
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentRiskAssessment(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!(EXPECTED_RESULT_KEYS[i] in value)) {
      return false;
    }
  }

  if (!Object.values(OVERALL_RISK_POSTURE).includes(value.overallRiskPosture)) {
    return false;
  }

  if (
    typeof value.riskScore !== "number" ||
    typeof value.confidence !== "number" ||
    !Array.isArray(value.technicalRisks)
  ) {
    return false;
  }

  if (!isPlainObject(value.advisoryMetadata)) {
    return false;
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.riskAssessmentAdvisorOnly === true &&
    value.advisoryMetadata.executed === false
  );
}

module.exports = {
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE,
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_ENTITY,
  RISK_ASSESSMENT_SCHEMA_VERSION,
  RISK_SEVERITY,
  RISK_CATEGORY,
  OVERALL_RISK_POSTURE,
  RISK_CATEGORY_ORDER,
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_DESCRIPTOR,
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_METADATA,
  EXPECTED_RESULT_KEYS,
  assessRecruitmentRiskProfile,
  isRecruitmentRiskAssessment
};
