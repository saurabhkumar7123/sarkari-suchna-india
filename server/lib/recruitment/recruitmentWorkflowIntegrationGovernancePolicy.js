"use strict";

/**
 * Phase 136 — Recruitment Workflow Integration Governance Policy (Advisory Only).
 *
 * Pure advisory governance policy that defines controlled integration rules for
 * future recruitment workflow integration. No database access, no persistence,
 * no runtime imports, no side effects. No automation. Never mutates input.
 * Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_PHASE = 136;

const RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_ENTITY =
  "recruitment_workflow_integration_governance_policy";

const GOVERNANCE_POLICY_STATUS = Object.freeze({
  ENFORCED: "ENFORCED",
  WAIVED: "WAIVED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  UNKNOWN: "UNKNOWN"
});

const GOVERNANCE_POSTURE = Object.freeze({
  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const POLICY_CATEGORY = Object.freeze({
  READINESS: "READINESS",
  CONSISTENCY: "CONSISTENCY",
  SAFETY: "SAFETY",
  ROLLBACK: "ROLLBACK",
  INTEGRATION_BOUNDARY: "INTEGRATION_BOUNDARY"
});

const GOVERNANCE_POLICY_IDS = Object.freeze({
  CONTROLLED_INTEGRATION_ONLY: "CONTROLLED_INTEGRATION_ONLY",
  ADVISORY_OUTPUTS_REQUIRED: "ADVISORY_OUTPUTS_REQUIRED",
  CONSISTENCY_BEFORE_GATE: "CONSISTENCY_BEFORE_GATE",
  HEALTH_RISK_THRESHOLDS: "HEALTH_RISK_THRESHOLDS",
  NO_AUTOMATION_WITHOUT_REVIEW: "NO_AUTOMATION_WITHOUT_REVIEW",
  ROLLBACK_PLAN_DOCUMENTED: "ROLLBACK_PLAN_DOCUMENTED",
  PHASE_DEPENDENCY_ORDER: "PHASE_DEPENDENCY_ORDER",
  NO_PRODUCTION_MUTATION: "NO_PRODUCTION_MUTATION",
  READINESS_GATE_SATISFIED: "READINESS_GATE_SATISFIED",
  GOVERNANCE_REVIEW_COMPLETE: "GOVERNANCE_REVIEW_COMPLETE"
});

const INTEGRATION_STATUS = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const CONSISTENCY_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const RECOMMENDATION_STATUS = Object.freeze({
  PROCEED: "PROCEED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_ACTION_REQUIRED: "BLOCKED_ACTION_REQUIRED",
  MONITOR_ADVISORY: "MONITOR_ADVISORY",
  UNKNOWN: "UNKNOWN"
});

const HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  STABLE: "STABLE",
  AT_RISK: "AT_RISK",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const RISK_LEVEL = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const GOVERNANCE_POLICY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.CONTROLLED_INTEGRATION_ONLY,
    label: "Integration must remain controlled and advisory-only",
    category: POLICY_CATEGORY.INTEGRATION_BOUNDARY
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.ADVISORY_OUTPUTS_REQUIRED,
    label: "Advisory outputs must be present before governance review",
    category: POLICY_CATEGORY.READINESS
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.CONSISTENCY_BEFORE_GATE,
    label: "Consistency validation must pass before integration gate",
    category: POLICY_CATEGORY.CONSISTENCY
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.HEALTH_RISK_THRESHOLDS,
    label: "Health and risk signals must remain within acceptable thresholds",
    category: POLICY_CATEGORY.SAFETY
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.NO_AUTOMATION_WITHOUT_REVIEW,
    label: "No automation without explicit governance review",
    category: POLICY_CATEGORY.SAFETY
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.ROLLBACK_PLAN_DOCUMENTED,
    label: "Advisory rollback plan must be documented before integration",
    category: POLICY_CATEGORY.ROLLBACK
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.PHASE_DEPENDENCY_ORDER,
    label: "Phase dependency order must be satisfied",
    category: POLICY_CATEGORY.READINESS
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.NO_PRODUCTION_MUTATION,
    label: "Governance must not mutate production state",
    category: POLICY_CATEGORY.INTEGRATION_BOUNDARY
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.READINESS_GATE_SATISFIED,
    label: "Integration readiness gate must be satisfied",
    category: POLICY_CATEGORY.READINESS
  }),
  Object.freeze({
    id: GOVERNANCE_POLICY_IDS.GOVERNANCE_REVIEW_COMPLETE,
    label: "Governance review must be complete before proceeding",
    category: POLICY_CATEGORY.INTEGRATION_BOUNDARY
  })
]);

const RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_136",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  governancePolicyOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135
  ])
});

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
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedGovernancePolicyInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "integrationReadiness",
    "readinessAssessment",
    "recommendation",
    "consistencyValidation",
    "intelligenceSummary",
    "moduleSignals",
    "governanceReview",
    "rollbackPlanDocumented"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "boolean" || typeof value === "string") {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulGovernancePolicySignals(input) {
  return (
    input.integrationReadiness != null ||
    input.readinessAssessment != null ||
    input.recommendation != null ||
    input.consistencyValidation != null ||
    input.intelligenceSummary != null ||
    input.moduleSignals != null ||
    input.governanceReview != null ||
    input.rollbackPlanDocumented != null
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractGovernancePolicySignals(input) {
  const integrationReadiness = isPlainObject(input.integrationReadiness)
    ? input.integrationReadiness
    : {};
  const readinessAssessment = isPlainObject(input.readinessAssessment)
    ? input.readinessAssessment
    : {};
  const recommendation = isPlainObject(input.recommendation) ? input.recommendation : {};
  const consistencyValidation = isPlainObject(input.consistencyValidation)
    ? input.consistencyValidation
    : {};
  const intelligenceSummary = isPlainObject(input.intelligenceSummary)
    ? input.intelligenceSummary
    : {};
  const governanceReview = isPlainObject(input.governanceReview) ? input.governanceReview : {};

  const integrationStatus =
    typeof integrationReadiness.integrationStatus === "string"
      ? integrationReadiness.integrationStatus
      : typeof integrationReadiness.readinessLevel === "string"
        ? integrationReadiness.readinessLevel
        : null;

  const readinessStatus =
    typeof readinessAssessment.readinessStatus === "string"
      ? readinessAssessment.readinessStatus
      : null;

  const recommendationStatus =
    typeof recommendation.recommendationStatus === "string"
      ? recommendation.recommendationStatus
      : null;

  const consistencyStatus =
    typeof consistencyValidation.consistencyStatus === "string"
      ? consistencyValidation.consistencyStatus
      : null;

  const currentState = isPlainObject(intelligenceSummary.currentState)
    ? intelligenceSummary.currentState
    : {};

  const healthStatus =
    typeof currentState.health === "string"
      ? currentState.health
      : typeof intelligenceSummary.healthStatus === "string"
        ? intelligenceSummary.healthStatus
        : null;

  const riskLevel =
    typeof currentState.risk === "string"
      ? currentState.risk
      : typeof intelligenceSummary.riskLevel === "string"
        ? intelligenceSummary.riskLevel
        : null;

  const satisfiedPhases = new Set();
  if (isPlainObject(input.moduleSignals)) {
    const keys = Object.keys(input.moduleSignals);
    for (let i = 0; i < keys.length; i += 1) {
      const phase = Number(keys[i]);
      const signal = input.moduleSignals[keys[i]];
      if (
        Number.isInteger(phase) &&
        isPlainObject(signal) &&
        (signal.satisfied === true || signal.ready === true)
      ) {
        satisfiedPhases.add(phase);
      }
    }
  }

  const governanceReviewComplete =
    governanceReview.complete === true || governanceReview.reviewComplete === true;

  const rollbackPlanDocumented =
    input.rollbackPlanDocumented === true || governanceReview.rollbackPlanDocumented === true;

  return {
    integrationStatus,
    readinessStatus,
    recommendationStatus,
    consistencyStatus,
    healthStatus,
    riskLevel,
    satisfiedPhases,
    governanceReviewComplete,
    rollbackPlanDocumented
  };
}

/**
 * @param {string} policyId
 * @param {Readonly<Object>} signals
 * @param {boolean} hasSignals
 * @returns {string}
 */
function evaluateGovernancePolicy(policyId, signals, hasSignals) {
  if (!hasSignals) {
    return GOVERNANCE_POLICY_STATUS.UNKNOWN;
  }

  switch (policyId) {
    case GOVERNANCE_POLICY_IDS.CONTROLLED_INTEGRATION_ONLY:
      return GOVERNANCE_POLICY_STATUS.ENFORCED;

    case GOVERNANCE_POLICY_IDS.ADVISORY_OUTPUTS_REQUIRED:
      return signals.integrationStatus != null ||
        signals.recommendationStatus != null ||
        signals.consistencyStatus != null
        ? GOVERNANCE_POLICY_STATUS.ENFORCED
        : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.CONSISTENCY_BEFORE_GATE:
      return signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT
        ? GOVERNANCE_POLICY_STATUS.ENFORCED
        : signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT
          ? GOVERNANCE_POLICY_STATUS.WAIVED
          : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.HEALTH_RISK_THRESHOLDS:
      if (signals.healthStatus === HEALTH_STATUS.BLOCKED) {
        return GOVERNANCE_POLICY_STATUS.WAIVED;
      }
      if (
        signals.riskLevel === RISK_LEVEL.CRITICAL ||
        signals.riskLevel === RISK_LEVEL.HIGH
      ) {
        return GOVERNANCE_POLICY_STATUS.WAIVED;
      }
      if (
        signals.healthStatus === HEALTH_STATUS.HEALTHY ||
        signals.healthStatus === HEALTH_STATUS.STABLE ||
        signals.riskLevel === RISK_LEVEL.LOW ||
        signals.riskLevel === RISK_LEVEL.MEDIUM
      ) {
        return GOVERNANCE_POLICY_STATUS.ENFORCED;
      }
      return GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.NO_AUTOMATION_WITHOUT_REVIEW:
      return signals.governanceReviewComplete
        ? GOVERNANCE_POLICY_STATUS.ENFORCED
        : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.ROLLBACK_PLAN_DOCUMENTED:
      return signals.rollbackPlanDocumented
        ? GOVERNANCE_POLICY_STATUS.ENFORCED
        : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.PHASE_DEPENDENCY_ORDER:
      if ([114, 115, 116, 117].every((phase) => signals.satisfiedPhases.has(phase))) {
        return GOVERNANCE_POLICY_STATUS.ENFORCED;
      }
      return signals.satisfiedPhases.size > 0
        ? GOVERNANCE_POLICY_STATUS.WAIVED
        : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.NO_PRODUCTION_MUTATION:
      return GOVERNANCE_POLICY_STATUS.ENFORCED;

    case GOVERNANCE_POLICY_IDS.READINESS_GATE_SATISFIED:
      return signals.integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
        ? GOVERNANCE_POLICY_STATUS.ENFORCED
        : signals.integrationStatus === INTEGRATION_STATUS.NOT_READY
          ? GOVERNANCE_POLICY_STATUS.WAIVED
          : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    case GOVERNANCE_POLICY_IDS.GOVERNANCE_REVIEW_COMPLETE:
      return signals.governanceReviewComplete
        ? GOVERNANCE_POLICY_STATUS.ENFORCED
        : GOVERNANCE_POLICY_STATUS.UNKNOWN;

    default:
      return GOVERNANCE_POLICY_STATUS.UNKNOWN;
  }
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildPolicyEvaluations(input, signals) {
  const hasSignals = hasMeaningfulGovernancePolicySignals(input);

  return GOVERNANCE_POLICY_DEFINITIONS.map((definition) =>
    deepFreeze({
      id: definition.id,
      label: definition.label,
      category: definition.category,
      status: evaluateGovernancePolicy(definition.id, signals, hasSignals)
    })
  );
}

/**
 * @param {ReadonlyArray<Object>} policyEvaluations
 * @returns {string}
 */
function resolveGovernancePosture(policyEvaluations) {
  const hasWaived = policyEvaluations.some(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.WAIVED
  );
  const hasUnknown = policyEvaluations.some(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.UNKNOWN
  );
  const enforcedCount = policyEvaluations.filter(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.ENFORCED
  ).length;

  if (hasWaived) {
    return GOVERNANCE_POSTURE.NON_COMPLIANT;
  }

  if (hasUnknown) {
    return GOVERNANCE_POSTURE.REVIEW_REQUIRED;
  }

  if (enforcedCount === policyEvaluations.length) {
    return GOVERNANCE_POSTURE.COMPLIANT;
  }

  return GOVERNANCE_POSTURE.UNKNOWN;
}

/**
 * @param {ReadonlyArray<Object>} policyEvaluations
 * @param {string} governancePosture
 * @returns {string}
 */
function buildGovernancePolicySummary(policyEvaluations, governancePosture) {
  const enforcedCount = policyEvaluations.filter(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.ENFORCED
  ).length;
  const waivedCount = policyEvaluations.filter(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.WAIVED
  ).length;

  if (policyEvaluations.every((item) => item.status === GOVERNANCE_POLICY_STATUS.UNKNOWN)) {
    return "Recruitment workflow integration governance policy awaits advisory prerequisite signals";
  }

  if (governancePosture === GOVERNANCE_POSTURE.COMPLIANT) {
    return `Recruitment workflow integration governance policy compliant with all ${policyEvaluations.length} rules enforced`;
  }

  if (governancePosture === GOVERNANCE_POSTURE.NON_COMPLIANT) {
    return `Recruitment workflow integration governance policy non-compliant with ${waivedCount} waived rules`;
  }

  return `Recruitment workflow integration governance policy requires review with ${enforcedCount} of ${policyEvaluations.length} rules enforced`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildGovernancePolicyResult(params) {
  return deepFreeze({
    policyEvaluations: Object.freeze(params.policyEvaluations.slice()),
    enforcedCount: params.enforcedCount,
    waivedCount: params.waivedCount,
    unknownCount: params.unknownCount,
    governancePosture: params.governancePosture,
    governancePolicySummary: params.governancePolicySummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_136",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      governancePolicyOnly: true
    })
  });
}

/**
 * Create recruitment workflow integration governance policy evaluation.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationGovernancePolicy(input) {
  if (!isRecognizedGovernancePolicyInput(input) || !hasMeaningfulGovernancePolicySignals(input)) {
    const staticEvaluations = GOVERNANCE_POLICY_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        label: definition.label,
        category: definition.category,
        status: GOVERNANCE_POLICY_STATUS.UNKNOWN
      })
    );

    return buildGovernancePolicyResult({
      policyEvaluations: staticEvaluations,
      enforcedCount: 0,
      waivedCount: 0,
      unknownCount: staticEvaluations.length,
      governancePosture: GOVERNANCE_POSTURE.UNKNOWN,
      governancePolicySummary: buildGovernancePolicySummary(staticEvaluations, GOVERNANCE_POSTURE.UNKNOWN)
    });
  }

  const signals = extractGovernancePolicySignals(input);
  const policyEvaluations = buildPolicyEvaluations(input, signals);
  const enforcedCount = policyEvaluations.filter(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.ENFORCED
  ).length;
  const waivedCount = policyEvaluations.filter(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.WAIVED
  ).length;
  const unknownCount = policyEvaluations.filter(
    (item) => item.status === GOVERNANCE_POLICY_STATUS.UNKNOWN
  ).length;
  const governancePosture = resolveGovernancePosture(policyEvaluations);

  return buildGovernancePolicyResult({
    policyEvaluations,
    enforcedCount,
    waivedCount,
    unknownCount,
    governancePosture,
    governancePolicySummary: buildGovernancePolicySummary(policyEvaluations, governancePosture)
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_ENTITY,
  GOVERNANCE_POLICY_STATUS,
  GOVERNANCE_POSTURE,
  POLICY_CATEGORY,
  GOVERNANCE_POLICY_IDS,
  GOVERNANCE_POLICY_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA,
  createRecruitmentWorkflowIntegrationGovernancePolicy
};
