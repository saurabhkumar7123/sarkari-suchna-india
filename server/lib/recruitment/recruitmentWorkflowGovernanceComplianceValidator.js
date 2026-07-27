"use strict";

/**
 * Phase 136 — Recruitment Workflow Governance Compliance Validator (Advisory Only).
 *
 * Pure advisory validator that verifies recruitment workflow integration
 * governance policy compliance. No database access, no persistence, no runtime
 * imports, no side effects. No auto-correction. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_PHASE = 136;

const RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_ENTITY =
  "recruitment_workflow_governance_compliance_validator";

const COMPLIANCE_STATUS = Object.freeze({
  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const COMPLIANCE_RULE_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  VIOLATED: "VIOLATED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  UNKNOWN: "UNKNOWN"
});

const COMPLIANCE_RULE_IDS = Object.freeze({
  POLICY_POSTURE_COMPLIANT: "POLICY_POSTURE_COMPLIANT",
  DECISION_MATRIX_FAVORABLE: "DECISION_MATRIX_FAVORABLE",
  ROLLBACK_PLAN_AVAILABLE: "ROLLBACK_PLAN_AVAILABLE",
  NO_CRITICAL_RISK: "NO_CRITICAL_RISK",
  CONSISTENCY_ENFORCED: "CONSISTENCY_ENFORCED",
  READINESS_GATE_ENFORCED: "READINESS_GATE_ENFORCED",
  ADVISORY_ONLY_BOUNDARY: "ADVISORY_ONLY_BOUNDARY",
  GOVERNANCE_REVIEW_DOCUMENTED: "GOVERNANCE_REVIEW_DOCUMENTED"
});

const GOVERNANCE_POSTURE = Object.freeze({
  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const MATRIX_POSTURE = Object.freeze({
  PROCEED_ADVISORY: "PROCEED_ADVISORY",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_ADVISORY: "BLOCKED_ADVISORY",
  UNKNOWN: "UNKNOWN"
});

const ROLLBACK_POSTURE = Object.freeze({
  FULL_ROLLBACK_ADVISORY: "FULL_ROLLBACK_ADVISORY",
  PARTIAL_ROLLBACK_ADVISORY: "PARTIAL_ROLLBACK_ADVISORY",
  NO_ROLLBACK_NEEDED: "NO_ROLLBACK_NEEDED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const RISK_LEVEL = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const CONSISTENCY_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const INTEGRATION_STATUS = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const COMPLIANCE_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.POLICY_POSTURE_COMPLIANT,
    label: "Governance policy posture must be compliant"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.DECISION_MATRIX_FAVORABLE,
    label: "Decision matrix must not be blocked"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.ROLLBACK_PLAN_AVAILABLE,
    label: "Advisory rollback plan must be available"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.NO_CRITICAL_RISK,
    label: "Critical risk must not be present"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.CONSISTENCY_ENFORCED,
    label: "Consistency validation must be enforced"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.READINESS_GATE_ENFORCED,
    label: "Integration readiness gate must be enforced"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.ADVISORY_ONLY_BOUNDARY,
    label: "Advisory-only boundary must be maintained"
  }),
  Object.freeze({
    id: COMPLIANCE_RULE_IDS.GOVERNANCE_REVIEW_DOCUMENTED,
    label: "Governance review must be documented"
  })
]);

const RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_136",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  autoCorrectionEnabled: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  governanceComplianceOnly: true,
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
function isRecognizedComplianceInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "governancePolicy",
    "decisionMatrix",
    "rollbackPlan",
    "integrationReadiness",
    "consistencyValidation",
    "intelligenceSummary",
    "governanceReview"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "boolean") {
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
function hasMeaningfulComplianceSignals(input) {
  return (
    input.governancePolicy != null ||
    input.decisionMatrix != null ||
    input.rollbackPlan != null ||
    input.integrationReadiness != null ||
    input.consistencyValidation != null ||
    input.intelligenceSummary != null ||
    input.governanceReview != null
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractComplianceSignals(input) {
  const governancePolicy = isPlainObject(input.governancePolicy) ? input.governancePolicy : {};
  const decisionMatrix = isPlainObject(input.decisionMatrix) ? input.decisionMatrix : {};
  const rollbackPlan = isPlainObject(input.rollbackPlan) ? input.rollbackPlan : {};
  const integrationReadiness = isPlainObject(input.integrationReadiness)
    ? input.integrationReadiness
    : {};
  const consistencyValidation = isPlainObject(input.consistencyValidation)
    ? input.consistencyValidation
    : {};
  const intelligenceSummary = isPlainObject(input.intelligenceSummary)
    ? input.intelligenceSummary
    : {};
  const governanceReview = isPlainObject(input.governanceReview) ? input.governanceReview : {};

  const governancePosture =
    typeof governancePolicy.governancePosture === "string"
      ? governancePolicy.governancePosture
      : null;

  const matrixPosture =
    typeof decisionMatrix.matrixPosture === "string" ? decisionMatrix.matrixPosture : null;

  const rollbackPosture =
    typeof rollbackPlan.rollbackPosture === "string" ? rollbackPlan.rollbackPosture : null;

  const rollbackStageCount =
    typeof rollbackPlan.recommendedCount === "number"
      ? rollbackPlan.recommendedCount
      : Array.isArray(rollbackPlan.recommendedStages)
        ? rollbackPlan.recommendedStages.length
        : 0;

  const integrationStatus =
    typeof integrationReadiness.integrationStatus === "string"
      ? integrationReadiness.integrationStatus
      : typeof integrationReadiness.readinessLevel === "string"
        ? integrationReadiness.readinessLevel
        : null;

  const consistencyStatus =
    typeof consistencyValidation.consistencyStatus === "string"
      ? consistencyValidation.consistencyStatus
      : null;

  const currentState = isPlainObject(intelligenceSummary.currentState)
    ? intelligenceSummary.currentState
    : {};

  const riskLevel =
    typeof currentState.risk === "string"
      ? currentState.risk
      : typeof intelligenceSummary.riskLevel === "string"
        ? intelligenceSummary.riskLevel
        : null;

  const governanceReviewDocumented =
    governanceReview.documented === true ||
    governanceReview.complete === true ||
    governanceReview.reviewComplete === true;

  return {
    governancePosture,
    matrixPosture,
    rollbackPosture,
    rollbackStageCount,
    integrationStatus,
    consistencyStatus,
    riskLevel,
    governanceReviewDocumented
  };
}

/**
 * @param {string} ruleId
 * @param {Readonly<Object>} signals
 * @param {boolean} hasSignals
 * @returns {string}
 */
function evaluateComplianceRule(ruleId, signals, hasSignals) {
  if (!hasSignals) {
    return COMPLIANCE_RULE_STATUS.UNKNOWN;
  }

  switch (ruleId) {
    case COMPLIANCE_RULE_IDS.POLICY_POSTURE_COMPLIANT:
      return signals.governancePosture === GOVERNANCE_POSTURE.COMPLIANT
        ? COMPLIANCE_RULE_STATUS.SATISFIED
        : signals.governancePosture === GOVERNANCE_POSTURE.NON_COMPLIANT
          ? COMPLIANCE_RULE_STATUS.VIOLATED
          : COMPLIANCE_RULE_STATUS.UNKNOWN;

    case COMPLIANCE_RULE_IDS.DECISION_MATRIX_FAVORABLE:
      if (signals.matrixPosture === MATRIX_POSTURE.BLOCKED_ADVISORY) {
        return COMPLIANCE_RULE_STATUS.VIOLATED;
      }
      if (
        signals.matrixPosture === MATRIX_POSTURE.PROCEED_ADVISORY ||
        signals.matrixPosture === MATRIX_POSTURE.REVIEW_REQUIRED
      ) {
        return COMPLIANCE_RULE_STATUS.SATISFIED;
      }
      return COMPLIANCE_RULE_STATUS.UNKNOWN;

    case COMPLIANCE_RULE_IDS.ROLLBACK_PLAN_AVAILABLE:
      if (
        signals.rollbackPosture === ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED ||
        signals.rollbackPosture === ROLLBACK_POSTURE.REVIEW_REQUIRED ||
        signals.rollbackPosture === ROLLBACK_POSTURE.PARTIAL_ROLLBACK_ADVISORY ||
        signals.rollbackPosture === ROLLBACK_POSTURE.FULL_ROLLBACK_ADVISORY ||
        signals.rollbackStageCount > 0
      ) {
        return COMPLIANCE_RULE_STATUS.SATISFIED;
      }
      if (signals.rollbackPosture === ROLLBACK_POSTURE.UNKNOWN) {
        return COMPLIANCE_RULE_STATUS.UNKNOWN;
      }
      return COMPLIANCE_RULE_STATUS.VIOLATED;

    case COMPLIANCE_RULE_IDS.NO_CRITICAL_RISK:
      return signals.riskLevel === RISK_LEVEL.CRITICAL
        ? COMPLIANCE_RULE_STATUS.VIOLATED
        : signals.riskLevel != null
          ? COMPLIANCE_RULE_STATUS.SATISFIED
          : COMPLIANCE_RULE_STATUS.UNKNOWN;

    case COMPLIANCE_RULE_IDS.CONSISTENCY_ENFORCED:
      return signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT
        ? COMPLIANCE_RULE_STATUS.SATISFIED
        : signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT
          ? COMPLIANCE_RULE_STATUS.VIOLATED
          : COMPLIANCE_RULE_STATUS.UNKNOWN;

    case COMPLIANCE_RULE_IDS.READINESS_GATE_ENFORCED:
      return signals.integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
        ? COMPLIANCE_RULE_STATUS.SATISFIED
        : signals.integrationStatus === INTEGRATION_STATUS.NOT_READY
          ? COMPLIANCE_RULE_STATUS.VIOLATED
          : COMPLIANCE_RULE_STATUS.UNKNOWN;

    case COMPLIANCE_RULE_IDS.ADVISORY_ONLY_BOUNDARY:
      return COMPLIANCE_RULE_STATUS.SATISFIED;

    case COMPLIANCE_RULE_IDS.GOVERNANCE_REVIEW_DOCUMENTED:
      return signals.governanceReviewDocumented
        ? COMPLIANCE_RULE_STATUS.SATISFIED
        : COMPLIANCE_RULE_STATUS.UNKNOWN;

    default:
      return COMPLIANCE_RULE_STATUS.UNKNOWN;
  }
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildComplianceRuleResults(input, signals) {
  const hasSignals = hasMeaningfulComplianceSignals(input);

  return COMPLIANCE_RULE_DEFINITIONS.map((definition) =>
    deepFreeze({
      id: definition.id,
      label: definition.label,
      status: evaluateComplianceRule(definition.id, signals, hasSignals)
    })
  );
}

/**
 * @param {ReadonlyArray<Object>} complianceRules
 * @returns {string}
 */
function resolveComplianceStatus(complianceRules) {
  const hasViolated = complianceRules.some(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.VIOLATED
  );
  const hasUnknown = complianceRules.some(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.UNKNOWN
  );
  const satisfiedCount = complianceRules.filter(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.SATISFIED
  ).length;

  if (hasViolated) {
    return COMPLIANCE_STATUS.NON_COMPLIANT;
  }

  if (hasUnknown) {
    return COMPLIANCE_STATUS.REVIEW_REQUIRED;
  }

  if (satisfiedCount === complianceRules.length) {
    return COMPLIANCE_STATUS.COMPLIANT;
  }

  return COMPLIANCE_STATUS.UNKNOWN;
}

/**
 * @param {ReadonlyArray<Object>} complianceRules
 * @param {string} complianceStatus
 * @returns {string}
 */
function buildComplianceSummary(complianceRules, complianceStatus) {
  const satisfiedCount = complianceRules.filter(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.SATISFIED
  ).length;
  const violatedCount = complianceRules.filter(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.VIOLATED
  ).length;

  if (complianceRules.every((rule) => rule.status === COMPLIANCE_RULE_STATUS.UNKNOWN)) {
    return "Recruitment workflow governance compliance validator awaits advisory prerequisite signals";
  }

  if (complianceStatus === COMPLIANCE_STATUS.COMPLIANT) {
    return `Recruitment workflow governance compliance verified with all ${complianceRules.length} rules satisfied`;
  }

  if (complianceStatus === COMPLIANCE_STATUS.NON_COMPLIANT) {
    return `Recruitment workflow governance compliance violated with ${violatedCount} rule violations`;
  }

  return `Recruitment workflow governance compliance requires review with ${satisfiedCount} of ${complianceRules.length} rules satisfied`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildComplianceResult(params) {
  return deepFreeze({
    complianceStatus: params.complianceStatus,
    complianceRules: Object.freeze(params.complianceRules.slice()),
    satisfiedCount: params.satisfiedCount,
    violatedCount: params.violatedCount,
    unknownCount: params.unknownCount,
    complianceSummary: params.complianceSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_136",
      phase: RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      autoCorrectionEnabled: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      governanceComplianceOnly: true
    })
  });
}

/**
 * Validate recruitment workflow governance compliance against policy rules.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentWorkflowGovernanceCompliance(input) {
  if (!isRecognizedComplianceInput(input) || !hasMeaningfulComplianceSignals(input)) {
    const staticRules = COMPLIANCE_RULE_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        label: definition.label,
        status: COMPLIANCE_RULE_STATUS.UNKNOWN
      })
    );

    return buildComplianceResult({
      complianceStatus: COMPLIANCE_STATUS.UNKNOWN,
      complianceRules: staticRules,
      satisfiedCount: 0,
      violatedCount: 0,
      unknownCount: staticRules.length,
      complianceSummary: buildComplianceSummary(staticRules, COMPLIANCE_STATUS.UNKNOWN)
    });
  }

  const signals = extractComplianceSignals(input);
  const complianceRules = buildComplianceRuleResults(input, signals);
  const satisfiedCount = complianceRules.filter(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.SATISFIED
  ).length;
  const violatedCount = complianceRules.filter(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.VIOLATED
  ).length;
  const unknownCount = complianceRules.filter(
    (rule) => rule.status === COMPLIANCE_RULE_STATUS.UNKNOWN
  ).length;
  const complianceStatus = resolveComplianceStatus(complianceRules);

  return buildComplianceResult({
    complianceStatus,
    complianceRules,
    satisfiedCount,
    violatedCount,
    unknownCount,
    complianceSummary: buildComplianceSummary(complianceRules, complianceStatus)
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_ENTITY,
  COMPLIANCE_STATUS,
  COMPLIANCE_RULE_STATUS,
  COMPLIANCE_RULE_IDS,
  COMPLIANCE_RULE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_METADATA,
  validateRecruitmentWorkflowGovernanceCompliance
};
