"use strict";

/**
 * Phase 135 — Recruitment Workflow Integration Safety Checklist (Advisory Only).
 *
 * Pure advisory checklist that validates integration prerequisites for future
 * controlled production integration of the recruitment workflow architecture.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_PHASE = 135;

const RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_ENTITY =
  "recruitment_workflow_integration_safety_checklist";

const SAFETY_CHECK_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  UNSATISFIED: "UNSATISFIED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  UNKNOWN: "UNKNOWN"
});

const SAFETY_POSTURE = Object.freeze({
  SAFE_TO_PLAN: "SAFE_TO_PLAN",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNSAFE_TO_PROCEED: "UNSAFE_TO_PROCEED",
  UNKNOWN: "UNKNOWN"
});

const SAFETY_CHECK_IDS = Object.freeze({
  INTEGRATION_READINESS_CONFIRMED: "INTEGRATION_READINESS_CONFIRMED",
  CONSISTENCY_VALIDATION_PASSED: "CONSISTENCY_VALIDATION_PASSED",
  FOUNDATIONAL_PIPELINE_COMPLETE: "FOUNDATIONAL_PIPELINE_COMPLETE",
  STORAGE_BOUNDARY_VERIFIED: "STORAGE_BOUNDARY_VERIFIED",
  ORCHESTRATION_BOUNDARY_VERIFIED: "ORCHESTRATION_BOUNDARY_VERIFIED",
  HEALTH_SIGNALS_ACCEPTABLE: "HEALTH_SIGNALS_ACCEPTABLE",
  RISK_SIGNALS_ACCEPTABLE: "RISK_SIGNALS_ACCEPTABLE",
  RECOMMENDATION_ALIGNED: "RECOMMENDATION_ALIGNED",
  NO_BLOCKED_READINESS: "NO_BLOCKED_READINESS",
  CONTROLLED_GATE_READY: "CONTROLLED_GATE_READY"
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

const READINESS_ASSESSMENT_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED"
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

const SAFETY_CHECK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: SAFETY_CHECK_IDS.INTEGRATION_READINESS_CONFIRMED,
    label: "Integration readiness confirmed",
    rolloutStageId: "CONTROLLED_INTEGRATION_GATE"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.CONSISTENCY_VALIDATION_PASSED,
    label: "Consistency validation passed",
    rolloutStageId: "CONSISTENCY_VALIDATION"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.FOUNDATIONAL_PIPELINE_COMPLETE,
    label: "Foundational pipeline complete",
    rolloutStageId: "FOUNDATIONAL_PIPELINE"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.STORAGE_BOUNDARY_VERIFIED,
    label: "Storage boundary verified",
    rolloutStageId: "STORAGE_BOUNDARY"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.ORCHESTRATION_BOUNDARY_VERIFIED,
    label: "Orchestration boundary verified",
    rolloutStageId: "ORCHESTRATION_BOUNDARY"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.HEALTH_SIGNALS_ACCEPTABLE,
    label: "Health signals acceptable",
    rolloutStageId: "HEALTH_AND_RISK"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.RISK_SIGNALS_ACCEPTABLE,
    label: "Risk signals acceptable",
    rolloutStageId: "HEALTH_AND_RISK"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.RECOMMENDATION_ALIGNED,
    label: "Recommendation aligned",
    rolloutStageId: "RECOMMENDATION_AND_TIMELINE"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.NO_BLOCKED_READINESS,
    label: "No blocked readiness assessment",
    rolloutStageId: "READINESS_AND_REPORTING"
  }),
  Object.freeze({
    id: SAFETY_CHECK_IDS.CONTROLLED_GATE_READY,
    label: "Controlled integration gate ready",
    rolloutStageId: "CONTROLLED_INTEGRATION_GATE"
  })
]);

const RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_135",
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
  safetyChecklistOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134
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
function isRecognizedSafetyInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "integrationReadiness",
    "readinessAssessment",
    "recommendation",
    "consistencyValidation",
    "intelligenceSummary",
    "moduleSignals"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string") {
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
function hasMeaningfulSafetySignals(input) {
  return (
    input.integrationReadiness != null ||
    input.readinessAssessment != null ||
    input.recommendation != null ||
    input.consistencyValidation != null ||
    input.intelligenceSummary != null ||
    input.moduleSignals != null
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractSafetySignals(input) {
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

  return {
    integrationStatus,
    readinessStatus,
    recommendationStatus,
    consistencyStatus,
    healthStatus,
    riskLevel,
    satisfiedPhases
  };
}

/**
 * @param {string} checkId
 * @param {Readonly<Object>} signals
 * @param {boolean} hasSignals
 * @returns {string}
 */
function evaluateSafetyCheck(checkId, signals, hasSignals) {
  if (!hasSignals) {
    return SAFETY_CHECK_STATUS.UNKNOWN;
  }

  switch (checkId) {
    case SAFETY_CHECK_IDS.INTEGRATION_READINESS_CONFIRMED:
      return signals.integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
        ? SAFETY_CHECK_STATUS.SATISFIED
        : signals.integrationStatus === INTEGRATION_STATUS.UNKNOWN
          ? SAFETY_CHECK_STATUS.UNKNOWN
          : SAFETY_CHECK_STATUS.UNSATISFIED;

    case SAFETY_CHECK_IDS.CONSISTENCY_VALIDATION_PASSED:
      return signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT
        ? SAFETY_CHECK_STATUS.SATISFIED
        : signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT
          ? SAFETY_CHECK_STATUS.UNSATISFIED
          : SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.FOUNDATIONAL_PIPELINE_COMPLETE:
      return [114, 115, 116, 117].every((phase) => signals.satisfiedPhases.has(phase))
        ? SAFETY_CHECK_STATUS.SATISFIED
        : signals.satisfiedPhases.size > 0
          ? SAFETY_CHECK_STATUS.UNSATISFIED
          : SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.STORAGE_BOUNDARY_VERIFIED:
      return [118, 119].every((phase) => signals.satisfiedPhases.has(phase))
        ? SAFETY_CHECK_STATUS.SATISFIED
        : signals.satisfiedPhases.has(118) || signals.satisfiedPhases.has(119)
          ? SAFETY_CHECK_STATUS.UNSATISFIED
          : SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.ORCHESTRATION_BOUNDARY_VERIFIED:
      return signals.satisfiedPhases.has(120)
        ? SAFETY_CHECK_STATUS.SATISFIED
        : SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.HEALTH_SIGNALS_ACCEPTABLE:
      if (signals.healthStatus === HEALTH_STATUS.BLOCKED) {
        return SAFETY_CHECK_STATUS.UNSATISFIED;
      }
      if (
        signals.healthStatus === HEALTH_STATUS.HEALTHY ||
        signals.healthStatus === HEALTH_STATUS.STABLE ||
        signals.healthStatus === HEALTH_STATUS.AT_RISK
      ) {
        return SAFETY_CHECK_STATUS.SATISFIED;
      }
      return SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.RISK_SIGNALS_ACCEPTABLE:
      if (signals.riskLevel === RISK_LEVEL.CRITICAL || signals.riskLevel === RISK_LEVEL.HIGH) {
        return SAFETY_CHECK_STATUS.UNSATISFIED;
      }
      if (
        signals.riskLevel === RISK_LEVEL.LOW ||
        signals.riskLevel === RISK_LEVEL.MEDIUM
      ) {
        return SAFETY_CHECK_STATUS.SATISFIED;
      }
      return SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.RECOMMENDATION_ALIGNED:
      if (
        signals.recommendationStatus === RECOMMENDATION_STATUS.PROCEED ||
        signals.recommendationStatus === RECOMMENDATION_STATUS.MONITOR_ADVISORY
      ) {
        return SAFETY_CHECK_STATUS.SATISFIED;
      }
      if (signals.recommendationStatus === RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED) {
        return SAFETY_CHECK_STATUS.UNSATISFIED;
      }
      return SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.NO_BLOCKED_READINESS:
      return signals.readinessStatus === READINESS_ASSESSMENT_STATUS.BLOCKED
        ? SAFETY_CHECK_STATUS.UNSATISFIED
        : signals.readinessStatus != null
          ? SAFETY_CHECK_STATUS.SATISFIED
          : SAFETY_CHECK_STATUS.UNKNOWN;

    case SAFETY_CHECK_IDS.CONTROLLED_GATE_READY:
      if (signals.integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION) {
        return SAFETY_CHECK_STATUS.SATISFIED;
      }
      if (signals.integrationStatus === INTEGRATION_STATUS.NOT_READY) {
        return SAFETY_CHECK_STATUS.UNSATISFIED;
      }
      return SAFETY_CHECK_STATUS.UNKNOWN;

    default:
      return SAFETY_CHECK_STATUS.UNKNOWN;
  }
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildSafetyChecklistItems(input, signals) {
  const hasSignals = hasMeaningfulSafetySignals(input);

  return SAFETY_CHECK_DEFINITIONS.map((definition) =>
    deepFreeze({
      id: definition.id,
      label: definition.label,
      rolloutStageId: definition.rolloutStageId,
      status: evaluateSafetyCheck(definition.id, signals, hasSignals)
    })
  );
}

/**
 * @param {ReadonlyArray<Object>} checklistItems
 * @returns {string}
 */
function resolveSafetyPosture(checklistItems) {
  const hasUnknown = checklistItems.some(
    (item) => item.status === SAFETY_CHECK_STATUS.UNKNOWN
  );
  const hasUnsatisfied = checklistItems.some(
    (item) => item.status === SAFETY_CHECK_STATUS.UNSATISFIED
  );
  const satisfiedCount = checklistItems.filter(
    (item) => item.status === SAFETY_CHECK_STATUS.SATISFIED
  ).length;

  if (hasUnsatisfied) {
    return SAFETY_POSTURE.UNSAFE_TO_PROCEED;
  }

  if (hasUnknown) {
    return SAFETY_POSTURE.REVIEW_REQUIRED;
  }

  if (satisfiedCount === checklistItems.length) {
    return SAFETY_POSTURE.SAFE_TO_PLAN;
  }

  return SAFETY_POSTURE.UNKNOWN;
}

/**
 * @param {ReadonlyArray<Object>} checklistItems
 * @param {string} safetyPosture
 * @returns {string}
 */
function buildSafetySummary(checklistItems, safetyPosture) {
  const satisfiedCount = checklistItems.filter(
    (item) => item.status === SAFETY_CHECK_STATUS.SATISFIED
  ).length;
  const unsatisfiedCount = checklistItems.filter(
    (item) => item.status === SAFETY_CHECK_STATUS.UNSATISFIED
  ).length;

  if (checklistItems.every((item) => item.status === SAFETY_CHECK_STATUS.UNKNOWN)) {
    return "Recruitment workflow integration safety checklist awaits advisory prerequisite signals";
  }

  if (safetyPosture === SAFETY_POSTURE.SAFE_TO_PLAN) {
    return `Recruitment workflow integration safety checklist passed with all ${checklistItems.length} prerequisites satisfied`;
  }

  if (safetyPosture === SAFETY_POSTURE.UNSAFE_TO_PROCEED) {
    return `Recruitment workflow integration safety checklist blocked with ${unsatisfiedCount} unsatisfied prerequisites`;
  }

  return `Recruitment workflow integration safety checklist requires review with ${satisfiedCount} of ${checklistItems.length} prerequisites satisfied`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildSafetyChecklistResult(params) {
  return deepFreeze({
    checklistItems: Object.freeze(params.checklistItems.slice()),
    satisfiedCount: params.satisfiedCount,
    unsatisfiedCount: params.unsatisfiedCount,
    unknownCount: params.unknownCount,
    safetyPosture: params.safetyPosture,
    safetySummary: params.safetySummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_135",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      safetyChecklistOnly: true
    })
  });
}

/**
 * Create recruitment workflow integration safety checklist.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationSafetyChecklist(input) {
  if (!isRecognizedSafetyInput(input) || !hasMeaningfulSafetySignals(input)) {
    const staticItems = SAFETY_CHECK_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        label: definition.label,
        rolloutStageId: definition.rolloutStageId,
        status: SAFETY_CHECK_STATUS.UNKNOWN
      })
    );

    return buildSafetyChecklistResult({
      checklistItems: staticItems,
      satisfiedCount: 0,
      unsatisfiedCount: 0,
      unknownCount: staticItems.length,
      safetyPosture: SAFETY_POSTURE.UNKNOWN,
      safetySummary: buildSafetySummary(staticItems, SAFETY_POSTURE.UNKNOWN)
    });
  }

  const signals = extractSafetySignals(input);
  const checklistItems = buildSafetyChecklistItems(input, signals);
  const satisfiedCount = checklistItems.filter(
    (item) => item.status === SAFETY_CHECK_STATUS.SATISFIED
  ).length;
  const unsatisfiedCount = checklistItems.filter(
    (item) => item.status === SAFETY_CHECK_STATUS.UNSATISFIED
  ).length;
  const unknownCount = checklistItems.filter(
    (item) => item.status === SAFETY_CHECK_STATUS.UNKNOWN
  ).length;
  const safetyPosture = resolveSafetyPosture(checklistItems);

  return buildSafetyChecklistResult({
    checklistItems,
    satisfiedCount,
    unsatisfiedCount,
    unknownCount,
    safetyPosture,
    safetySummary: buildSafetySummary(checklistItems, safetyPosture)
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_ENTITY,
  SAFETY_CHECK_STATUS,
  SAFETY_POSTURE,
  SAFETY_CHECK_IDS,
  SAFETY_CHECK_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_SAFETY_CHECKLIST_METADATA,
  createRecruitmentWorkflowIntegrationSafetyChecklist
};
