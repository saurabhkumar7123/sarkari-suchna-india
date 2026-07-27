"use strict";

/**
 * Phase 131 — Recruitment Workflow Advisory Recommendation Model (Advisory Only).
 *
 * Pure advisory recommendation model that generates descriptive next-focus
 * recommendations from workflow signals. No database access, no persistence,
 * no runtime imports, no side effects. No automation. No alerting.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_PHASE = 131;

const RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_ENTITY =
  "recruitment_workflow_recommendation_model";

const RECOMMENDATION_STATUS = Object.freeze({
  PROCEED: "PROCEED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_ACTION_REQUIRED: "BLOCKED_ACTION_REQUIRED",
  MONITOR_ADVISORY: "MONITOR_ADVISORY",
  UNKNOWN: "UNKNOWN"
});

const WORKFLOW_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED",
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

const EVOLUTION_STATUS = Object.freeze({
  IMPROVED: "IMPROVED",
  REGRESSED: "REGRESSED",
  STABLE: "STABLE",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const READINESS_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_131",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  recommendationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([123, 127, 128, 129, 130])
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
function isRecognizedRecommendationInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const stringFields = [
    "workflowStatus",
    "healthStatus",
    "riskLevel",
    "evolutionStatus",
    "readinessStatus"
  ];
  for (let i = 0; i < stringFields.length; i += 1) {
    const field = stringFields[i];
    if (input[field] != null && typeof input[field] !== "string") {
      return false;
    }
  }

  if (input.missingCapabilities != null && !Array.isArray(input.missingCapabilities)) {
    return false;
  }

  if (input.blockedReasons != null && !Array.isArray(input.blockedReasons)) {
    return false;
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulSignals(input) {
  const stringFields = [
    "workflowStatus",
    "healthStatus",
    "riskLevel",
    "evolutionStatus",
    "readinessStatus"
  ];
  for (let i = 0; i < stringFields.length; i += 1) {
    const field = stringFields[i];
    if (typeof input[field] === "string" && input[field].length > 0) {
      return true;
    }
  }

  if (Array.isArray(input.missingCapabilities) && input.missingCapabilities.length > 0) {
    return true;
  }

  if (Array.isArray(input.blockedReasons) && input.blockedReasons.length > 0) {
    return true;
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveEffectiveWorkflowStatus(input) {
  if (
    typeof input.readinessStatus === "string" &&
    input.readinessStatus.length > 0 &&
    input.readinessStatus !== READINESS_STATUS.UNKNOWN
  ) {
    return input.readinessStatus;
  }

  if (typeof input.workflowStatus === "string" && input.workflowStatus.length > 0) {
    return input.workflowStatus;
  }

  return WORKFLOW_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @returns {ReadonlyArray<string>}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === "string" && value[i].length > 0) {
      normalized.push(value[i]);
    }
  }

  return normalized;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isBlockedContext(input) {
  const workflowStatus = resolveEffectiveWorkflowStatus(input);
  const healthStatus =
    typeof input.healthStatus === "string" ? input.healthStatus : HEALTH_STATUS.UNKNOWN;
  const riskLevel = typeof input.riskLevel === "string" ? input.riskLevel : RISK_LEVEL.UNKNOWN;
  const evolutionStatus =
    typeof input.evolutionStatus === "string"
      ? input.evolutionStatus
      : EVOLUTION_STATUS.UNKNOWN;
  const blockedReasons = normalizeStringArray(input.blockedReasons);

  return (
    workflowStatus === WORKFLOW_STATUS.BLOCKED ||
    workflowStatus === READINESS_STATUS.BLOCKED ||
    healthStatus === HEALTH_STATUS.BLOCKED ||
    evolutionStatus === EVOLUTION_STATUS.BLOCKED ||
    riskLevel === RISK_LEVEL.CRITICAL ||
    blockedReasons.length > 0
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isProceedContext(input) {
  const workflowStatus = resolveEffectiveWorkflowStatus(input);
  const healthStatus =
    typeof input.healthStatus === "string" ? input.healthStatus : HEALTH_STATUS.UNKNOWN;
  const riskLevel = typeof input.riskLevel === "string" ? input.riskLevel : RISK_LEVEL.UNKNOWN;
  const evolutionStatus =
    typeof input.evolutionStatus === "string"
      ? input.evolutionStatus
      : EVOLUTION_STATUS.UNKNOWN;
  const missingCapabilities = normalizeStringArray(input.missingCapabilities);

  return (
    workflowStatus === WORKFLOW_STATUS.READY_FOR_STORAGE &&
    healthStatus === HEALTH_STATUS.HEALTHY &&
    riskLevel === RISK_LEVEL.LOW &&
    missingCapabilities.length === 0 &&
    (evolutionStatus === EVOLUTION_STATUS.IMPROVED ||
      evolutionStatus === EVOLUTION_STATUS.STABLE ||
      evolutionStatus === EVOLUTION_STATUS.UNKNOWN)
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isReviewRequiredContext(input) {
  const workflowStatus = resolveEffectiveWorkflowStatus(input);
  const healthStatus =
    typeof input.healthStatus === "string" ? input.healthStatus : HEALTH_STATUS.UNKNOWN;
  const riskLevel = typeof input.riskLevel === "string" ? input.riskLevel : RISK_LEVEL.UNKNOWN;
  const evolutionStatus =
    typeof input.evolutionStatus === "string"
      ? input.evolutionStatus
      : EVOLUTION_STATUS.UNKNOWN;
  const missingCapabilities = normalizeStringArray(input.missingCapabilities);

  if (
    workflowStatus === WORKFLOW_STATUS.APPROVAL_PENDING ||
    workflowStatus === WORKFLOW_STATUS.REVIEW_READY
  ) {
    return true;
  }

  if (missingCapabilities.length > 0) {
    return true;
  }

  if (
    healthStatus === HEALTH_STATUS.AT_RISK ||
    riskLevel === RISK_LEVEL.HIGH ||
    evolutionStatus === EVOLUTION_STATUS.REGRESSED
  ) {
    return true;
  }

  if (
    workflowStatus === WORKFLOW_STATUS.NOT_STARTED ||
    workflowStatus === WORKFLOW_STATUS.PARTIALLY_READY
  ) {
    return true;
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isMonitorAdvisoryContext(input) {
  const healthStatus =
    typeof input.healthStatus === "string" ? input.healthStatus : HEALTH_STATUS.UNKNOWN;
  const riskLevel = typeof input.riskLevel === "string" ? input.riskLevel : RISK_LEVEL.UNKNOWN;
  const evolutionStatus =
    typeof input.evolutionStatus === "string"
      ? input.evolutionStatus
      : EVOLUTION_STATUS.UNKNOWN;

  return (
    riskLevel === RISK_LEVEL.MEDIUM ||
    (healthStatus === HEALTH_STATUS.STABLE && evolutionStatus === EVOLUTION_STATUS.STABLE)
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveRecommendationStatus(input) {
  if (isBlockedContext(input)) {
    return RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED;
  }

  if (isProceedContext(input)) {
    return RECOMMENDATION_STATUS.PROCEED;
  }

  if (isReviewRequiredContext(input)) {
    return RECOMMENDATION_STATUS.REVIEW_REQUIRED;
  }

  if (isMonitorAdvisoryContext(input)) {
    return RECOMMENDATION_STATUS.MONITOR_ADVISORY;
  }

  return RECOMMENDATION_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} recommendationStatus
 * @returns {string[]}
 */
function buildRecommendations(input, recommendationStatus) {
  const workflowStatus = resolveEffectiveWorkflowStatus(input);
  const healthStatus =
    typeof input.healthStatus === "string" ? input.healthStatus : HEALTH_STATUS.UNKNOWN;
  const riskLevel = typeof input.riskLevel === "string" ? input.riskLevel : RISK_LEVEL.UNKNOWN;
  const evolutionStatus =
    typeof input.evolutionStatus === "string"
      ? input.evolutionStatus
      : EVOLUTION_STATUS.UNKNOWN;
  const missingCapabilities = normalizeStringArray(input.missingCapabilities);
  const blockedReasons = normalizeStringArray(input.blockedReasons);
  const recommendations = [];

  if (recommendationStatus === RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED) {
    recommendations.push("Resolve blocked workflow conditions");
    if (blockedReasons.length > 0) {
      recommendations.push("Review supplied blocked reasons before workflow advancement");
    }
    return recommendations;
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.PROCEED) {
    recommendations.push("Proceed toward storage boundary review");
    return recommendations;
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.REVIEW_REQUIRED) {
    if (workflowStatus === WORKFLOW_STATUS.APPROVAL_PENDING) {
      recommendations.push("Complete approval review");
    } else if (workflowStatus === WORKFLOW_STATUS.REVIEW_READY) {
      recommendations.push("Complete review package validation");
    } else if (
      workflowStatus === WORKFLOW_STATUS.NOT_STARTED ||
      workflowStatus === WORKFLOW_STATUS.PARTIALLY_READY
    ) {
      recommendations.push("Advance workflow readiness through required capability stages");
    } else if (missingCapabilities.length > 0) {
      recommendations.push("Address missing workflow capabilities before proceeding");
    } else if (
      healthStatus === HEALTH_STATUS.AT_RISK ||
      riskLevel === RISK_LEVEL.HIGH ||
      evolutionStatus === EVOLUTION_STATUS.REGRESSED
    ) {
      recommendations.push("Strengthen advisory signals before workflow advancement");
    } else {
      recommendations.push("Complete advisory workflow review");
    }
    return recommendations;
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.MONITOR_ADVISORY) {
    if (riskLevel === RISK_LEVEL.MEDIUM) {
      recommendations.push("Monitor advisory risk factors during workflow progression");
    } else {
      recommendations.push("Continue monitoring workflow advisory signals");
    }
    return recommendations;
  }

  return recommendations;
}

/**
 * @param {string} recommendationStatus
 * @param {ReadonlyArray<string>} recommendations
 * @returns {string}
 */
function buildPriorityFocus(recommendationStatus, recommendations) {
  if (recommendations.length > 0) {
    return recommendations[0];
  }

  switch (recommendationStatus) {
    case RECOMMENDATION_STATUS.PROCEED:
      return "Storage boundary advancement";
    case RECOMMENDATION_STATUS.REVIEW_REQUIRED:
      return "Advisory workflow review";
    case RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED:
      return "Blocked condition resolution";
    case RECOMMENDATION_STATUS.MONITOR_ADVISORY:
      return "Advisory signal monitoring";
    default:
      return "Signal clarification";
  }
}

/**
 * @param {Readonly<Object>} input
 * @param {string} recommendationStatus
 * @returns {string}
 */
function buildExplanation(input, recommendationStatus) {
  const workflowStatus = resolveEffectiveWorkflowStatus(input);
  const healthStatus =
    typeof input.healthStatus === "string" ? input.healthStatus : HEALTH_STATUS.UNKNOWN;
  const riskLevel = typeof input.riskLevel === "string" ? input.riskLevel : RISK_LEVEL.UNKNOWN;

  if (recommendationStatus === RECOMMENDATION_STATUS.UNKNOWN) {
    return "Recruitment workflow advisory recommendations could not be determined from supplied signals";
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED) {
    return "Recruitment workflow is blocked and requires resolution before advisory progression";
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.PROCEED) {
    return "Recruitment workflow signals indicate readiness to proceed toward the storage boundary";
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.REVIEW_REQUIRED) {
    if (workflowStatus === WORKFLOW_STATUS.APPROVAL_PENDING) {
      return "Recruitment workflow is awaiting approval review within the advisory boundary";
    }
    return "Recruitment workflow requires advisory review before the next workflow focus";
  }

  if (recommendationStatus === RECOMMENDATION_STATUS.MONITOR_ADVISORY) {
    if (riskLevel === RISK_LEVEL.MEDIUM) {
      return "Recruitment workflow is progressing with moderate advisory signals that warrant monitoring";
    }
    return "Recruitment workflow advisory signals are stable and should be monitored during progression";
  }

  return "Recruitment workflow advisory recommendations derived from supplied workflow signals";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildRecommendationResult(params) {
  return deepFreeze({
    recommendationStatus: params.recommendationStatus,
    recommendations: Object.freeze(params.recommendations.slice()),
    priorityFocus: params.priorityFocus,
    explanation: params.explanation,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      generatedBy: "phase_131",
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      recommendationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryRecommendationOnly: true
    })
  });
}

/**
 * Generate recruitment workflow advisory recommendations from supplied signals.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function generateRecruitmentWorkflowRecommendations(input) {
  if (!isRecognizedRecommendationInput(input) || !hasMeaningfulSignals(input)) {
    return buildRecommendationResult({
      recommendationStatus: RECOMMENDATION_STATUS.UNKNOWN,
      recommendations: [],
      priorityFocus: "Signal clarification",
      explanation:
        "Recruitment workflow advisory recommendations could not be determined from supplied signals"
    });
  }

  const recommendationStatus = resolveRecommendationStatus(input);
  const recommendations = buildRecommendations(input, recommendationStatus);
  const priorityFocus = buildPriorityFocus(recommendationStatus, recommendations);
  const explanation = buildExplanation(input, recommendationStatus);

  return buildRecommendationResult({
    recommendationStatus,
    recommendations,
    priorityFocus,
    explanation
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_PHASE,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_ENTITY,
  RECOMMENDATION_STATUS,
  WORKFLOW_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  EVOLUTION_STATUS,
  READINESS_STATUS,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA,
  generateRecruitmentWorkflowRecommendations
};
