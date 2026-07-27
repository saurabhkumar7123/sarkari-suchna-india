"use strict";

/**
 * Phase 136 — Recruitment Workflow Integration Governance Summary (Advisory Only).
 *
 * Pure advisory summary that aggregates governance policy, decision matrix,
 * rollback plan, and compliance validation outputs for future controlled
 * integration governance review. No database access, no persistence, no runtime
 * imports, no side effects. No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_PHASE = 136;

const RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_ENTITY =
  "recruitment_workflow_integration_governance_summary";

const GOVERNANCE_SUMMARY_POSTURE = Object.freeze({
  READY_FOR_GOVERNANCE_REVIEW: "READY_FOR_GOVERNANCE_REVIEW",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_GOVERNANCE: "BLOCKED_GOVERNANCE",
  UNKNOWN: "UNKNOWN"
});

const AGGREGATED_COMPONENT = Object.freeze({
  GOVERNANCE_POLICY: "governancePolicy",
  DECISION_MATRIX: "decisionMatrix",
  ROLLBACK_PLAN: "rollbackPlan",
  COMPLIANCE_VALIDATION: "complianceValidation"
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

const COMPLIANCE_STATUS = Object.freeze({
  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_PHASE,
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
  governanceSummaryOnly: true,
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
function isRecognizedGovernanceSummaryInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "governancePolicy",
    "decisionMatrix",
    "rollbackPlan",
    "complianceValidation",
    "recruitmentId"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
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
function hasMeaningfulGovernanceSummarySignals(input) {
  return (
    input.governancePolicy != null ||
    input.decisionMatrix != null ||
    input.rollbackPlan != null ||
    input.complianceValidation != null ||
    input.recruitmentId != null
  );
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
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractAggregatedSignals(input) {
  const governancePolicy = isPlainObject(input.governancePolicy) ? input.governancePolicy : {};
  const decisionMatrix = isPlainObject(input.decisionMatrix) ? input.decisionMatrix : {};
  const rollbackPlan = isPlainObject(input.rollbackPlan) ? input.rollbackPlan : {};
  const complianceValidation = isPlainObject(input.complianceValidation)
    ? input.complianceValidation
    : {};

  return {
    governancePosture:
      typeof governancePolicy.governancePosture === "string"
        ? governancePolicy.governancePosture
        : GOVERNANCE_POSTURE.UNKNOWN,
    matrixPosture:
      typeof decisionMatrix.matrixPosture === "string"
        ? decisionMatrix.matrixPosture
        : MATRIX_POSTURE.UNKNOWN,
    rollbackPosture:
      typeof rollbackPlan.rollbackPosture === "string"
        ? rollbackPlan.rollbackPosture
        : ROLLBACK_POSTURE.UNKNOWN,
    complianceStatus:
      typeof complianceValidation.complianceStatus === "string"
        ? complianceValidation.complianceStatus
        : COMPLIANCE_STATUS.UNKNOWN,
    policyEnforcedCount:
      typeof governancePolicy.enforcedCount === "number" ? governancePolicy.enforcedCount : 0,
    matrixFavorableCount:
      typeof decisionMatrix.favorableCount === "number" ? decisionMatrix.favorableCount : 0,
    rollbackRecommendedCount:
      typeof rollbackPlan.recommendedCount === "number" ? rollbackPlan.recommendedCount : 0,
    complianceSatisfiedCount:
      typeof complianceValidation.satisfiedCount === "number"
        ? complianceValidation.satisfiedCount
        : 0
  };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildAggregatedComponents(signals) {
  return Object.freeze([
    deepFreeze({
      component: AGGREGATED_COMPONENT.GOVERNANCE_POLICY,
      posture: signals.governancePosture,
      metricCount: signals.policyEnforcedCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.DECISION_MATRIX,
      posture: signals.matrixPosture,
      metricCount: signals.matrixFavorableCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.ROLLBACK_PLAN,
      posture: signals.rollbackPosture,
      metricCount: signals.rollbackRecommendedCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.COMPLIANCE_VALIDATION,
      posture: signals.complianceStatus,
      metricCount: signals.complianceSatisfiedCount
    })
  ]);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {string}
 */
function resolveGovernanceSummaryPosture(signals) {
  if (
    signals.governancePosture === GOVERNANCE_POSTURE.UNKNOWN &&
    signals.matrixPosture === MATRIX_POSTURE.UNKNOWN &&
    signals.rollbackPosture === ROLLBACK_POSTURE.UNKNOWN &&
    signals.complianceStatus === COMPLIANCE_STATUS.UNKNOWN
  ) {
    return GOVERNANCE_SUMMARY_POSTURE.UNKNOWN;
  }

  if (
    signals.governancePosture === GOVERNANCE_POSTURE.NON_COMPLIANT ||
    signals.matrixPosture === MATRIX_POSTURE.BLOCKED_ADVISORY ||
    signals.complianceStatus === COMPLIANCE_STATUS.NON_COMPLIANT
  ) {
    return GOVERNANCE_SUMMARY_POSTURE.BLOCKED_GOVERNANCE;
  }

  if (
    signals.governancePosture === GOVERNANCE_POSTURE.COMPLIANT &&
    signals.matrixPosture === MATRIX_POSTURE.PROCEED_ADVISORY &&
    signals.complianceStatus === COMPLIANCE_STATUS.COMPLIANT
  ) {
    return GOVERNANCE_SUMMARY_POSTURE.READY_FOR_GOVERNANCE_REVIEW;
  }

  return GOVERNANCE_SUMMARY_POSTURE.REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} summaryPosture
 * @returns {string[]}
 */
function buildKeyGovernanceSignals(signals) {
  const keySignals = [];

  if (signals.governancePosture === GOVERNANCE_POSTURE.COMPLIANT) {
    keySignals.push("Governance policy compliant");
  } else if (signals.governancePosture === GOVERNANCE_POSTURE.NON_COMPLIANT) {
    keySignals.push("Governance policy non-compliant");
  }

  if (signals.matrixPosture === MATRIX_POSTURE.PROCEED_ADVISORY) {
    keySignals.push("Decision matrix favorable");
  } else if (signals.matrixPosture === MATRIX_POSTURE.BLOCKED_ADVISORY) {
    keySignals.push("Decision matrix blocked");
  }

  if (signals.rollbackPosture === ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED) {
    keySignals.push("No rollback recommended");
  } else if (
    signals.rollbackPosture === ROLLBACK_POSTURE.FULL_ROLLBACK_ADVISORY ||
    signals.rollbackPosture === ROLLBACK_POSTURE.PARTIAL_ROLLBACK_ADVISORY
  ) {
    keySignals.push("Advisory rollback stages recommended");
  }

  if (signals.complianceStatus === COMPLIANCE_STATUS.COMPLIANT) {
    keySignals.push("Governance compliance verified");
  } else if (signals.complianceStatus === COMPLIANCE_STATUS.NON_COMPLIANT) {
    keySignals.push("Governance compliance violated");
  }

  return keySignals;
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} summaryPosture
 * @returns {string[]}
 */
function buildRecommendedGovernanceFocus(signals, summaryPosture) {
  const focus = [];

  if (summaryPosture === GOVERNANCE_SUMMARY_POSTURE.BLOCKED_GOVERNANCE) {
    focus.push("Resolve governance blockers before integration planning");
    return focus;
  }

  if (summaryPosture === GOVERNANCE_SUMMARY_POSTURE.READY_FOR_GOVERNANCE_REVIEW) {
    focus.push("Proceed with controlled integration governance review");
    return focus;
  }

  if (signals.governancePosture === GOVERNANCE_POSTURE.REVIEW_REQUIRED) {
    focus.push("Complete governance policy review");
  }

  if (signals.matrixPosture === MATRIX_POSTURE.REVIEW_REQUIRED) {
    focus.push("Review decision matrix dimensions");
  }

  if (signals.complianceStatus === COMPLIANCE_STATUS.REVIEW_REQUIRED) {
    focus.push("Verify governance compliance prerequisites");
  }

  if (focus.length === 0 && summaryPosture === GOVERNANCE_SUMMARY_POSTURE.UNKNOWN) {
    focus.push("Supply governance advisory outputs for aggregation");
  }

  return focus;
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} summaryPosture
 * @returns {string}
 */
function buildGovernanceSummaryText(signals, summaryPosture) {
  if (summaryPosture === GOVERNANCE_SUMMARY_POSTURE.UNKNOWN) {
    return "Recruitment workflow integration governance summary could not be determined";
  }

  if (summaryPosture === GOVERNANCE_SUMMARY_POSTURE.READY_FOR_GOVERNANCE_REVIEW) {
    return "Recruitment workflow integration governance summary ready for controlled governance review";
  }

  if (summaryPosture === GOVERNANCE_SUMMARY_POSTURE.BLOCKED_GOVERNANCE) {
    return "Recruitment workflow integration governance summary blocked by non-compliant advisory signals";
  }

  return "Recruitment workflow integration governance summary requires advisory review before proceeding";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildGovernanceSummaryResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    governanceSummaryPosture: params.governanceSummaryPosture,
    governanceSummary: params.governanceSummary,
    aggregatedComponents: params.aggregatedComponents,
    keyGovernanceSignals: Object.freeze(params.keyGovernanceSignals.slice()),
    recommendedGovernanceFocus: Object.freeze(params.recommendedGovernanceFocus.slice()),
    governanceOverview: deepFreeze({
      policyPosture: params.policyPosture,
      matrixPosture: params.matrixPosture,
      rollbackPosture: params.rollbackPosture,
      complianceStatus: params.complianceStatus
    }),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_136",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      governanceSummaryOnly: true
    })
  });
}

/**
 * Create recruitment workflow integration governance summary from supplied outputs.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationGovernanceSummary(input) {
  if (!isRecognizedGovernanceSummaryInput(input) || !hasMeaningfulGovernanceSummarySignals(input)) {
    return buildGovernanceSummaryResult({
      recruitmentId: null,
      governanceSummaryPosture: GOVERNANCE_SUMMARY_POSTURE.UNKNOWN,
      governanceSummary: buildGovernanceSummaryText(
        {
          governancePosture: GOVERNANCE_POSTURE.UNKNOWN,
          matrixPosture: MATRIX_POSTURE.UNKNOWN,
          rollbackPosture: ROLLBACK_POSTURE.UNKNOWN,
          complianceStatus: COMPLIANCE_STATUS.UNKNOWN
        },
        GOVERNANCE_SUMMARY_POSTURE.UNKNOWN
      ),
      aggregatedComponents: buildAggregatedComponents({
        governancePosture: GOVERNANCE_POSTURE.UNKNOWN,
        matrixPosture: MATRIX_POSTURE.UNKNOWN,
        rollbackPosture: ROLLBACK_POSTURE.UNKNOWN,
        complianceStatus: COMPLIANCE_STATUS.UNKNOWN,
        policyEnforcedCount: 0,
        matrixFavorableCount: 0,
        rollbackRecommendedCount: 0,
        complianceSatisfiedCount: 0
      }),
      keyGovernanceSignals: [],
      recommendedGovernanceFocus: ["Supply governance advisory outputs for aggregation"],
      policyPosture: GOVERNANCE_POSTURE.UNKNOWN,
      matrixPosture: MATRIX_POSTURE.UNKNOWN,
      rollbackPosture: ROLLBACK_POSTURE.UNKNOWN,
      complianceStatus: COMPLIANCE_STATUS.UNKNOWN
    });
  }

  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const signals = extractAggregatedSignals(input);
  const aggregatedComponents = buildAggregatedComponents(signals);
  const governanceSummaryPosture = resolveGovernanceSummaryPosture(signals);
  const keyGovernanceSignals = buildKeyGovernanceSignals(signals);
  const recommendedGovernanceFocus = buildRecommendedGovernanceFocus(
    signals,
    governanceSummaryPosture
  );
  const governanceSummary = buildGovernanceSummaryText(signals, governanceSummaryPosture);

  return buildGovernanceSummaryResult({
    recruitmentId,
    governanceSummaryPosture,
    governanceSummary,
    aggregatedComponents,
    keyGovernanceSignals,
    recommendedGovernanceFocus,
    policyPosture: signals.governancePosture,
    matrixPosture: signals.matrixPosture,
    rollbackPosture: signals.rollbackPosture,
    complianceStatus: signals.complianceStatus
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_ENTITY,
  GOVERNANCE_SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_METADATA,
  createRecruitmentWorkflowIntegrationGovernanceSummary
};
