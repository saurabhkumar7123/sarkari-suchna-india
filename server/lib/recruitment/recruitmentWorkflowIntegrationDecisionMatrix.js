"use strict";

/**
 * Phase 136 — Recruitment Workflow Integration Decision Matrix (Advisory Only).
 *
 * Pure advisory decision matrix that evaluates readiness, consistency,
 * recommendation, health, and risk dimensions for future controlled integration.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_PHASE = 136;

const RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_ENTITY =
  "recruitment_workflow_integration_decision_matrix";

const MATRIX_DIMENSION = Object.freeze({
  READINESS: "readiness",
  CONSISTENCY: "consistency",
  RECOMMENDATION: "recommendation",
  HEALTH: "health",
  RISK: "risk"
});

const MATRIX_EVALUATION_STATUS = Object.freeze({
  FAVORABLE: "FAVORABLE",
  NEUTRAL: "NEUTRAL",
  UNFAVORABLE: "UNFAVORABLE",
  UNKNOWN: "UNKNOWN"
});

const MATRIX_POSTURE = Object.freeze({
  PROCEED_ADVISORY: "PROCEED_ADVISORY",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_ADVISORY: "BLOCKED_ADVISORY",
  UNKNOWN: "UNKNOWN"
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

const MATRIX_DIMENSION_DEFINITIONS = Object.freeze([
  Object.freeze({
    dimension: MATRIX_DIMENSION.READINESS,
    label: "Integration Readiness"
  }),
  Object.freeze({
    dimension: MATRIX_DIMENSION.CONSISTENCY,
    label: "Advisory Consistency"
  }),
  Object.freeze({
    dimension: MATRIX_DIMENSION.RECOMMENDATION,
    label: "Recommendation Alignment"
  }),
  Object.freeze({
    dimension: MATRIX_DIMENSION.HEALTH,
    label: "Workflow Health"
  }),
  Object.freeze({
    dimension: MATRIX_DIMENSION.RISK,
    label: "Workflow Risk"
  })
]);

const RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_PHASE,
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
  decisionMatrixOnly: true,
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
function isRecognizedDecisionMatrixInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "integrationReadiness",
    "readinessAssessment",
    "recommendation",
    "consistencyValidation",
    "intelligenceSummary",
    "health",
    "risk"
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
function hasMeaningfulDecisionMatrixSignals(input) {
  return (
    input.integrationReadiness != null ||
    input.readinessAssessment != null ||
    input.recommendation != null ||
    input.consistencyValidation != null ||
    input.intelligenceSummary != null ||
    input.health != null ||
    input.risk != null
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractDecisionMatrixSignals(input) {
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
  const healthInput = isPlainObject(input.health) ? input.health : {};
  const riskInput = isPlainObject(input.risk) ? input.risk : {};

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
    typeof healthInput.healthStatus === "string"
      ? healthInput.healthStatus
      : typeof currentState.health === "string"
        ? currentState.health
        : typeof intelligenceSummary.healthStatus === "string"
          ? intelligenceSummary.healthStatus
          : null;

  const riskLevel =
    typeof riskInput.riskLevel === "string"
      ? riskInput.riskLevel
      : typeof currentState.risk === "string"
        ? currentState.risk
        : typeof intelligenceSummary.riskLevel === "string"
          ? intelligenceSummary.riskLevel
          : null;

  return {
    integrationStatus,
    readinessStatus,
    recommendationStatus,
    consistencyStatus,
    healthStatus,
    riskLevel
  };
}

/**
 * @param {string} dimension
 * @param {Readonly<Object>} signals
 * @param {boolean} hasSignals
 * @returns {string}
 */
function evaluateMatrixDimension(dimension, signals, hasSignals) {
  if (!hasSignals) {
    return MATRIX_EVALUATION_STATUS.UNKNOWN;
  }

  switch (dimension) {
    case MATRIX_DIMENSION.READINESS:
      if (signals.integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION) {
        return MATRIX_EVALUATION_STATUS.FAVORABLE;
      }
      if (signals.integrationStatus === INTEGRATION_STATUS.PARTIALLY_READY) {
        return MATRIX_EVALUATION_STATUS.NEUTRAL;
      }
      if (signals.integrationStatus === INTEGRATION_STATUS.NOT_READY) {
        return MATRIX_EVALUATION_STATUS.UNFAVORABLE;
      }
      return MATRIX_EVALUATION_STATUS.UNKNOWN;

    case MATRIX_DIMENSION.CONSISTENCY:
      if (signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT) {
        return MATRIX_EVALUATION_STATUS.FAVORABLE;
      }
      if (signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT) {
        return MATRIX_EVALUATION_STATUS.UNFAVORABLE;
      }
      return MATRIX_EVALUATION_STATUS.UNKNOWN;

    case MATRIX_DIMENSION.RECOMMENDATION:
      if (signals.recommendationStatus === RECOMMENDATION_STATUS.PROCEED) {
        return MATRIX_EVALUATION_STATUS.FAVORABLE;
      }
      if (
        signals.recommendationStatus === RECOMMENDATION_STATUS.MONITOR_ADVISORY ||
        signals.recommendationStatus === RECOMMENDATION_STATUS.REVIEW_REQUIRED
      ) {
        return MATRIX_EVALUATION_STATUS.NEUTRAL;
      }
      if (signals.recommendationStatus === RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED) {
        return MATRIX_EVALUATION_STATUS.UNFAVORABLE;
      }
      return MATRIX_EVALUATION_STATUS.UNKNOWN;

    case MATRIX_DIMENSION.HEALTH:
      if (signals.healthStatus === HEALTH_STATUS.HEALTHY) {
        return MATRIX_EVALUATION_STATUS.FAVORABLE;
      }
      if (
        signals.healthStatus === HEALTH_STATUS.STABLE ||
        signals.healthStatus === HEALTH_STATUS.AT_RISK
      ) {
        return MATRIX_EVALUATION_STATUS.NEUTRAL;
      }
      if (signals.healthStatus === HEALTH_STATUS.BLOCKED) {
        return MATRIX_EVALUATION_STATUS.UNFAVORABLE;
      }
      return MATRIX_EVALUATION_STATUS.UNKNOWN;

    case MATRIX_DIMENSION.RISK:
      if (signals.riskLevel === RISK_LEVEL.LOW) {
        return MATRIX_EVALUATION_STATUS.FAVORABLE;
      }
      if (signals.riskLevel === RISK_LEVEL.MEDIUM) {
        return MATRIX_EVALUATION_STATUS.NEUTRAL;
      }
      if (signals.riskLevel === RISK_LEVEL.HIGH || signals.riskLevel === RISK_LEVEL.CRITICAL) {
        return MATRIX_EVALUATION_STATUS.UNFAVORABLE;
      }
      return MATRIX_EVALUATION_STATUS.UNKNOWN;

    default:
      return MATRIX_EVALUATION_STATUS.UNKNOWN;
  }
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildMatrixRows(input, signals) {
  const hasSignals = hasMeaningfulDecisionMatrixSignals(input);

  return MATRIX_DIMENSION_DEFINITIONS.map((definition) => {
    const evaluationStatus = evaluateMatrixDimension(definition.dimension, signals, hasSignals);
    return deepFreeze({
      dimension: definition.dimension,
      label: definition.label,
      evaluationStatus,
      signalValue: resolveSignalValue(definition.dimension, signals)
    });
  });
}

/**
 * @param {string} dimension
 * @param {Readonly<Object>} signals
 * @returns {string|null}
 */
function resolveSignalValue(dimension, signals) {
  switch (dimension) {
    case MATRIX_DIMENSION.READINESS:
      return signals.integrationStatus;
    case MATRIX_DIMENSION.CONSISTENCY:
      return signals.consistencyStatus;
    case MATRIX_DIMENSION.RECOMMENDATION:
      return signals.recommendationStatus;
    case MATRIX_DIMENSION.HEALTH:
      return signals.healthStatus;
    case MATRIX_DIMENSION.RISK:
      return signals.riskLevel;
    default:
      return null;
  }
}

/**
 * @param {ReadonlyArray<Object>} matrixRows
 * @returns {string}
 */
function resolveMatrixPosture(matrixRows) {
  const hasUnfavorable = matrixRows.some(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.UNFAVORABLE
  );
  const hasUnknown = matrixRows.some(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.UNKNOWN
  );
  const favorableCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.FAVORABLE
  ).length;

  if (hasUnfavorable) {
    return MATRIX_POSTURE.BLOCKED_ADVISORY;
  }

  if (hasUnknown) {
    return MATRIX_POSTURE.REVIEW_REQUIRED;
  }

  if (favorableCount === matrixRows.length) {
    return MATRIX_POSTURE.PROCEED_ADVISORY;
  }

  return MATRIX_POSTURE.REVIEW_REQUIRED;
}

/**
 * @param {ReadonlyArray<Object>} matrixRows
 * @param {string} matrixPosture
 * @returns {string}
 */
function buildMatrixSummary(matrixRows, matrixPosture) {
  const favorableCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.FAVORABLE
  ).length;
  const unfavorableCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.UNFAVORABLE
  ).length;

  if (matrixRows.every((row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.UNKNOWN)) {
    return "Recruitment workflow integration decision matrix awaits advisory prerequisite signals";
  }

  if (matrixPosture === MATRIX_POSTURE.PROCEED_ADVISORY) {
    return `Recruitment workflow integration decision matrix favorable across all ${matrixRows.length} dimensions`;
  }

  if (matrixPosture === MATRIX_POSTURE.BLOCKED_ADVISORY) {
    return `Recruitment workflow integration decision matrix blocked with ${unfavorableCount} unfavorable dimensions`;
  }

  return `Recruitment workflow integration decision matrix requires review with ${favorableCount} of ${matrixRows.length} dimensions favorable`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildDecisionMatrixResult(params) {
  return deepFreeze({
    matrixRows: Object.freeze(params.matrixRows.slice()),
    favorableCount: params.favorableCount,
    neutralCount: params.neutralCount,
    unfavorableCount: params.unfavorableCount,
    unknownCount: params.unknownCount,
    matrixPosture: params.matrixPosture,
    matrixSummary: params.matrixSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_136",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      decisionMatrixOnly: true
    })
  });
}

/**
 * Create recruitment workflow integration decision matrix.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationDecisionMatrix(input) {
  if (!isRecognizedDecisionMatrixInput(input) || !hasMeaningfulDecisionMatrixSignals(input)) {
    const staticRows = MATRIX_DIMENSION_DEFINITIONS.map((definition) =>
      deepFreeze({
        dimension: definition.dimension,
        label: definition.label,
        evaluationStatus: MATRIX_EVALUATION_STATUS.UNKNOWN,
        signalValue: null
      })
    );

    return buildDecisionMatrixResult({
      matrixRows: staticRows,
      favorableCount: 0,
      neutralCount: 0,
      unfavorableCount: 0,
      unknownCount: staticRows.length,
      matrixPosture: MATRIX_POSTURE.UNKNOWN,
      matrixSummary: buildMatrixSummary(staticRows, MATRIX_POSTURE.UNKNOWN)
    });
  }

  const signals = extractDecisionMatrixSignals(input);
  const matrixRows = buildMatrixRows(input, signals);
  const favorableCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.FAVORABLE
  ).length;
  const neutralCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.NEUTRAL
  ).length;
  const unfavorableCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.UNFAVORABLE
  ).length;
  const unknownCount = matrixRows.filter(
    (row) => row.evaluationStatus === MATRIX_EVALUATION_STATUS.UNKNOWN
  ).length;
  const matrixPosture = resolveMatrixPosture(matrixRows);

  return buildDecisionMatrixResult({
    matrixRows,
    favorableCount,
    neutralCount,
    unfavorableCount,
    unknownCount,
    matrixPosture,
    matrixSummary: buildMatrixSummary(matrixRows, matrixPosture)
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_ENTITY,
  MATRIX_DIMENSION,
  MATRIX_EVALUATION_STATUS,
  MATRIX_POSTURE,
  MATRIX_DIMENSION_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_METADATA,
  createRecruitmentWorkflowIntegrationDecisionMatrix
};
