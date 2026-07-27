"use strict";

/**
 * Phase 128 — Recruitment Workflow Advisory Health Indicator Model (Advisory Only).
 *
 * Pure advisory health assessment from supplied workflow signals.
 * No database access, no persistence, no runtime imports, no side effects.
 * No monitoring. No alerting. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_PHASE = 128;

const RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_ENTITY =
  "recruitment_workflow_health_indicator";

const HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  STABLE: "STABLE",
  AT_RISK: "AT_RISK",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const EVOLUTION_STATUS = Object.freeze({
  IMPROVED: "IMPROVED",
  REGRESSED: "REGRESSED",
  STABLE: "STABLE",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const READINESS_STATUS_SCORE = Object.freeze({
  NOT_STARTED: 0,
  BLOCKED: 0,
  PARTIALLY_READY: 25,
  REVIEW_READY: 50,
  APPROVAL_PENDING: 75,
  READY_FOR_STORAGE: 100
});

const RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_128",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  healthPersistence: false,
  monitoringEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([123, 127])
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
function isRecognizedHealthInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const stringFields = ["workflowState", "readinessStatus", "evolutionStatus"];
  for (let i = 0; i < stringFields.length; i += 1) {
    const field = stringFields[i];
    if (input[field] != null && typeof input[field] !== "string") {
      return false;
    }
  }

  if (input.readinessScore != null && typeof input.readinessScore !== "number") {
    return false;
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
  return (
    typeof input.workflowState === "string" ||
    typeof input.readinessStatus === "string" ||
    typeof input.evolutionStatus === "string" ||
    typeof input.readinessScore === "number" ||
    (Array.isArray(input.missingCapabilities) && input.missingCapabilities.length > 0) ||
    (Array.isArray(input.blockedReasons) && input.blockedReasons.length > 0)
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {number}
 */
function resolveBaseReadinessScore(input) {
  if (typeof input.readinessScore === "number" && Number.isFinite(input.readinessScore)) {
    return Math.max(0, Math.min(100, input.readinessScore));
  }

  if (
    typeof input.readinessStatus === "string" &&
    READINESS_STATUS_SCORE[input.readinessStatus] != null
  ) {
    return READINESS_STATUS_SCORE[input.readinessStatus];
  }

  return 0;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isBlockedInput(input) {
  if (input.workflowState === "BLOCKED") {
    return true;
  }

  if (input.readinessStatus === "BLOCKED") {
    return true;
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.BLOCKED) {
    return true;
  }

  return Array.isArray(input.blockedReasons) && input.blockedReasons.length > 0;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isHealthyInput(input) {
  const missingCapabilities = Array.isArray(input.missingCapabilities)
    ? input.missingCapabilities
    : [];

  if (input.readinessStatus !== "READY_FOR_STORAGE") {
    return false;
  }

  if (missingCapabilities.length > 0) {
    return false;
  }

  if (isBlockedInput(input)) {
    return false;
  }

  if (
    input.evolutionStatus === EVOLUTION_STATUS.REGRESSED ||
    input.evolutionStatus === EVOLUTION_STATUS.BLOCKED
  ) {
    return false;
  }

  const baseScore = resolveBaseReadinessScore(input);
  return baseScore >= 75;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isAtRiskInput(input) {
  if (isBlockedInput(input)) {
    return false;
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    return true;
  }

  const missingCapabilities = Array.isArray(input.missingCapabilities)
    ? input.missingCapabilities
    : [];

  if (missingCapabilities.length > 0 && input.readinessStatus !== "READY_FOR_STORAGE") {
    return true;
  }

  if (
    input.readinessStatus === "APPROVAL_PENDING" &&
    input.evolutionStatus === EVOLUTION_STATUS.REGRESSED
  ) {
    return true;
  }

  const baseScore = resolveBaseReadinessScore(input);
  if (baseScore > 0 && baseScore < 50) {
    return true;
  }

  if (
    input.readinessStatus === "NOT_STARTED" ||
    input.readinessStatus === "PARTIALLY_READY"
  ) {
    return missingCapabilities.length > 0;
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isStableInput(input) {
  if (isBlockedInput(input) || isAtRiskInput(input) || isHealthyInput(input)) {
    return false;
  }

  if (!hasMeaningfulSignals(input)) {
    return false;
  }

  if (
    input.evolutionStatus === EVOLUTION_STATUS.STABLE ||
    input.evolutionStatus === EVOLUTION_STATUS.IMPROVED ||
    input.readinessStatus === "APPROVAL_PENDING" ||
    input.readinessStatus === "REVIEW_READY" ||
    input.readinessStatus === "PARTIALLY_READY"
  ) {
    return true;
  }

  const baseScore = resolveBaseReadinessScore(input);
  return baseScore >= 50 && baseScore < 100;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveHealthStatus(input) {
  if (!isRecognizedHealthInput(input) || !hasMeaningfulSignals(input)) {
    return HEALTH_STATUS.UNKNOWN;
  }

  if (isBlockedInput(input)) {
    return HEALTH_STATUS.BLOCKED;
  }

  if (isHealthyInput(input)) {
    return HEALTH_STATUS.HEALTHY;
  }

  if (isAtRiskInput(input)) {
    return HEALTH_STATUS.AT_RISK;
  }

  if (isStableInput(input)) {
    return HEALTH_STATUS.STABLE;
  }

  return HEALTH_STATUS.UNKNOWN;
}

/**
 * @param {string} healthStatus
 * @param {number} rawScore
 * @returns {number}
 */
function applyHealthStatusScoreCap(healthStatus, rawScore) {
  if (healthStatus === HEALTH_STATUS.HEALTHY) {
    return Math.min(95, Math.max(70, rawScore));
  }

  if (healthStatus === HEALTH_STATUS.STABLE) {
    return Math.min(85, Math.max(50, rawScore));
  }

  if (healthStatus === HEALTH_STATUS.AT_RISK) {
    return Math.min(49, Math.max(15, rawScore));
  }

  if (healthStatus === HEALTH_STATUS.BLOCKED) {
    return 0;
  }

  return 0;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} healthStatus
 * @returns {number}
 */
function computeHealthScore(input, healthStatus) {
  if (healthStatus === HEALTH_STATUS.UNKNOWN) {
    return 0;
  }

  let rawScore = resolveBaseReadinessScore(input);
  const missingCount = Array.isArray(input.missingCapabilities)
    ? input.missingCapabilities.length
    : 0;
  const blockedCount = Array.isArray(input.blockedReasons) ? input.blockedReasons.length : 0;

  if (input.evolutionStatus === EVOLUTION_STATUS.IMPROVED) {
    rawScore += 5;
  } else if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    rawScore -= 20;
  } else if (input.evolutionStatus === EVOLUTION_STATUS.UNKNOWN) {
    rawScore -= 10;
  } else if (input.evolutionStatus === EVOLUTION_STATUS.BLOCKED) {
    rawScore = 0;
  }

  rawScore -= missingCount * 5;
  rawScore -= blockedCount * 10;
  rawScore = Math.max(0, Math.min(100, rawScore));

  return applyHealthStatusScoreCap(healthStatus, rawScore);
}

/**
 * @param {Readonly<Object>} input
 * @param {string} healthStatus
 * @returns {string[]}
 */
function buildPositiveIndicators(input, healthStatus) {
  const indicators = [];

  if (healthStatus === HEALTH_STATUS.UNKNOWN || healthStatus === HEALTH_STATUS.BLOCKED) {
    return indicators;
  }

  if (
    input.evolutionStatus === EVOLUTION_STATUS.IMPROVED ||
    input.evolutionStatus === EVOLUTION_STATUS.STABLE
  ) {
    if (!indicators.includes("Workflow progressing")) {
      indicators.push("Workflow progressing");
    }
  }

  if (input.readinessStatus === "READY_FOR_STORAGE") {
    indicators.push("Readiness reached storage boundary");
  }

  if (input.readinessStatus === "REVIEW_READY") {
    indicators.push("Workflow reached review-ready readiness");
  }

  if (input.readinessStatus === "APPROVAL_PENDING" && healthStatus === HEALTH_STATUS.STABLE) {
    indicators.push("Workflow awaiting approval within expected advisory boundary");
  }

  const missingCapabilities = Array.isArray(input.missingCapabilities)
    ? input.missingCapabilities
    : [];

  if (missingCapabilities.length === 0 && hasMeaningfulSignals(input)) {
    indicators.push("No missing capabilities reported");
  }

  if (
    typeof input.readinessScore === "number" &&
    input.readinessScore >= 75 &&
    healthStatus !== HEALTH_STATUS.AT_RISK
  ) {
    indicators.push("Readiness score indicates forward progress");
  }

  return indicators;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} healthStatus
 * @returns {string[]}
 */
function buildRiskIndicators(input, healthStatus) {
  const indicators = [];

  if (healthStatus === HEALTH_STATUS.UNKNOWN) {
    return indicators;
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    indicators.push("Workflow evolution regressed");
  }

  if (input.readinessStatus === "APPROVAL_PENDING" && healthStatus === HEALTH_STATUS.AT_RISK) {
    indicators.push("Approval pending with declining advisory signals");
  } else if (input.readinessStatus === "APPROVAL_PENDING") {
    indicators.push("Approval decision still pending");
  }

  const missingCapabilities = Array.isArray(input.missingCapabilities)
    ? input.missingCapabilities
    : [];

  if (missingCapabilities.length > 0) {
    indicators.push("Missing capabilities detected");
  }

  const blockedReasons = Array.isArray(input.blockedReasons) ? input.blockedReasons : [];
  for (let i = 0; i < blockedReasons.length; i += 1) {
    const reason = blockedReasons[i];
    if (typeof reason === "string" && reason.length > 0 && !indicators.includes(reason)) {
      indicators.push(reason);
    }
  }

  if (input.workflowState === "BLOCKED" || input.readinessStatus === "BLOCKED") {
    if (!indicators.includes("Workflow blocked")) {
      indicators.push("Workflow blocked");
    }
  }

  if (
    input.readinessStatus === "NOT_STARTED" ||
    input.readinessStatus === "PARTIALLY_READY"
  ) {
    indicators.push("Workflow readiness remains incomplete");
  }

  return indicators;
}

/**
 * @param {string} healthStatus
 * @returns {string}
 */
function buildHealthSummary(healthStatus) {
  if (healthStatus === HEALTH_STATUS.HEALTHY) {
    return "Workflow advisory health is healthy";
  }

  if (healthStatus === HEALTH_STATUS.STABLE) {
    return "Workflow advisory health is stable";
  }

  if (healthStatus === HEALTH_STATUS.AT_RISK) {
    return "Workflow advisory health is at risk";
  }

  if (healthStatus === HEALTH_STATUS.BLOCKED) {
    return "Workflow advisory health is blocked";
  }

  return "Workflow advisory health could not be determined";
}

/**
 * @param {string} healthStatus
 * @param {number} healthScore
 * @param {string[]} positiveIndicators
 * @param {string[]} riskIndicators
 * @param {string} healthSummary
 * @returns {Readonly<Object>}
 */
function buildHealthResult(
  healthStatus,
  healthScore,
  positiveIndicators,
  riskIndicators,
  healthSummary
) {
  return deepFreeze({
    healthStatus,
    healthScore,
    positiveIndicators: Object.freeze(positiveIndicators.slice()),
    riskIndicators: Object.freeze(riskIndicators.slice()),
    healthSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_128",
      phase: RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      healthPersistence: false,
      monitoringEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryHealthOnly: true
    })
  });
}

/**
 * Assess recruitment workflow advisory health from supplied signals.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function assessRecruitmentWorkflowHealth(input) {
  if (!isRecognizedHealthInput(input) || !hasMeaningfulSignals(input)) {
    return buildHealthResult(HEALTH_STATUS.UNKNOWN, 0, [], [], buildHealthSummary(HEALTH_STATUS.UNKNOWN));
  }

  const healthStatus = resolveHealthStatus(input);
  const healthScore = computeHealthScore(input, healthStatus);
  const positiveIndicators = buildPositiveIndicators(input, healthStatus);
  const riskIndicators = buildRiskIndicators(input, healthStatus);
  const healthSummary = buildHealthSummary(healthStatus);

  return buildHealthResult(
    healthStatus,
    healthScore,
    positiveIndicators,
    riskIndicators,
    healthSummary
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_PHASE,
  RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_ENTITY,
  HEALTH_STATUS,
  EVOLUTION_STATUS,
  RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA,
  assessRecruitmentWorkflowHealth
};
