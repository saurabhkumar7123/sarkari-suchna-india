"use strict";

/**
 * Phase 129 — Recruitment Workflow Advisory Risk Assessment Model (Advisory Only).
 *
 * Pure advisory risk assessment from supplied workflow advisory signals.
 * No database access, no persistence, no runtime imports, no side effects.
 * No alerting. No notifications. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_PHASE = 129;

const RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_ENTITY =
  "recruitment_workflow_risk_assessment";

const RISK_LEVEL = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

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

const READINESS_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED"
});

const RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_129",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  riskPersistence: false,
  monitoringEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([123, 127, 128])
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
function isRecognizedRiskInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const stringFields = [
    "healthStatus",
    "readinessStatus",
    "evolutionStatus"
  ];
  for (let i = 0; i < stringFields.length; i += 1) {
    const field = stringFields[i];
    if (input[field] != null && typeof input[field] !== "string") {
      return false;
    }
  }

  if (input.healthScore != null && typeof input.healthScore !== "number") {
    return false;
  }

  const arrayFields = ["missingCapabilities", "blockedReasons", "riskIndicators"];
  for (let i = 0; i < arrayFields.length; i += 1) {
    const field = arrayFields[i];
    if (input[field] != null && !Array.isArray(input[field])) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulSignals(input) {
  return (
    typeof input.healthStatus === "string" ||
    typeof input.readinessStatus === "string" ||
    typeof input.evolutionStatus === "string" ||
    typeof input.healthScore === "number" ||
    (Array.isArray(input.missingCapabilities) && input.missingCapabilities.length > 0) ||
    (Array.isArray(input.blockedReasons) && input.blockedReasons.length > 0) ||
    (Array.isArray(input.riskIndicators) && input.riskIndicators.length > 0)
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {string[]}
 */
function getMissingCapabilities(input) {
  return Array.isArray(input.missingCapabilities) ? input.missingCapabilities : [];
}

/**
 * @param {Readonly<Object>} input
 * @returns {string[]}
 */
function getBlockedReasons(input) {
  return Array.isArray(input.blockedReasons) ? input.blockedReasons : [];
}

/**
 * @param {Readonly<Object>} input
 * @returns {string[]}
 */
function getRiskIndicators(input) {
  return Array.isArray(input.riskIndicators) ? input.riskIndicators : [];
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isCriticalRiskInput(input) {
  if (input.healthStatus === HEALTH_STATUS.BLOCKED) {
    return true;
  }

  if (input.readinessStatus === READINESS_STATUS.BLOCKED) {
    return true;
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.BLOCKED) {
    return true;
  }

  return getBlockedReasons(input).length > 0;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isHighRiskInput(input) {
  if (isCriticalRiskInput(input)) {
    return false;
  }

  const missingCapabilities = getMissingCapabilities(input);

  if (
    input.evolutionStatus === EVOLUTION_STATUS.REGRESSED &&
    missingCapabilities.length > 0
  ) {
    return true;
  }

  if (input.healthStatus === HEALTH_STATUS.AT_RISK) {
    return true;
  }

  if (
    input.evolutionStatus === EVOLUTION_STATUS.REGRESSED &&
    input.readinessStatus === READINESS_STATUS.APPROVAL_PENDING
  ) {
    return true;
  }

  if (missingCapabilities.length >= 2) {
    return true;
  }

  if (
    typeof input.healthScore === "number" &&
    Number.isFinite(input.healthScore) &&
    input.healthScore > 0 &&
    input.healthScore < 25
  ) {
    return true;
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isMediumRiskInput(input) {
  if (isCriticalRiskInput(input) || isHighRiskInput(input)) {
    return false;
  }

  if (input.readinessStatus === READINESS_STATUS.APPROVAL_PENDING) {
    return true;
  }

  if (input.healthStatus === HEALTH_STATUS.STABLE) {
    return true;
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    return true;
  }

  const missingCapabilities = getMissingCapabilities(input);
  if (missingCapabilities.length === 1) {
    return true;
  }

  if (
    input.readinessStatus === READINESS_STATUS.NOT_STARTED ||
    input.readinessStatus === READINESS_STATUS.PARTIALLY_READY
  ) {
    return true;
  }

  if (
    typeof input.healthScore === "number" &&
    Number.isFinite(input.healthScore) &&
    input.healthScore >= 25 &&
    input.healthScore < 50
  ) {
    return true;
  }

  return getRiskIndicators(input).length > 0;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function isLowRiskInput(input) {
  if (
    isCriticalRiskInput(input) ||
    isHighRiskInput(input) ||
    isMediumRiskInput(input)
  ) {
    return false;
  }

  if (
    input.healthStatus === HEALTH_STATUS.HEALTHY &&
    input.readinessStatus === READINESS_STATUS.READY_FOR_STORAGE
  ) {
    return true;
  }

  if (
    input.healthStatus === HEALTH_STATUS.HEALTHY &&
    getMissingCapabilities(input).length === 0 &&
    getBlockedReasons(input).length === 0
  ) {
    return true;
  }

  if (
    input.readinessStatus === READINESS_STATUS.READY_FOR_STORAGE &&
    input.evolutionStatus !== EVOLUTION_STATUS.REGRESSED &&
    input.evolutionStatus !== EVOLUTION_STATUS.BLOCKED
  ) {
    return true;
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveRiskLevel(input) {
  if (!isRecognizedRiskInput(input) || !hasMeaningfulSignals(input)) {
    return RISK_LEVEL.UNKNOWN;
  }

  if (isCriticalRiskInput(input)) {
    return RISK_LEVEL.CRITICAL;
  }

  if (isHighRiskInput(input)) {
    return RISK_LEVEL.HIGH;
  }

  if (isMediumRiskInput(input)) {
    return RISK_LEVEL.MEDIUM;
  }

  if (isLowRiskInput(input)) {
    return RISK_LEVEL.LOW;
  }

  return RISK_LEVEL.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} riskLevel
 * @returns {string[]}
 */
function buildRiskFactors(input, riskLevel) {
  const factors = [];

  if (riskLevel === RISK_LEVEL.UNKNOWN) {
    return factors;
  }

  const blockedReasons = getBlockedReasons(input);
  for (let i = 0; i < blockedReasons.length; i += 1) {
    const reason = blockedReasons[i];
    if (typeof reason === "string" && reason.length > 0 && !factors.includes(reason)) {
      factors.push(reason);
    }
  }

  if (
    input.healthStatus === HEALTH_STATUS.BLOCKED ||
    input.readinessStatus === READINESS_STATUS.BLOCKED ||
    input.evolutionStatus === EVOLUTION_STATUS.BLOCKED
  ) {
    if (!factors.includes("Workflow blocked")) {
      factors.push("Workflow blocked");
    }
  }

  if (input.healthStatus === HEALTH_STATUS.AT_RISK) {
    factors.push("Workflow health at risk");
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    factors.push("Workflow evolution regressed");
  }

  if (input.readinessStatus === READINESS_STATUS.APPROVAL_PENDING) {
    factors.push("Approval pending");
  }

  const missingCapabilities = getMissingCapabilities(input);
  if (missingCapabilities.length > 0) {
    if (!factors.includes("Missing capabilities detected")) {
      factors.push("Missing capabilities detected");
    }

    for (let i = 0; i < missingCapabilities.length; i += 1) {
      const capability = missingCapabilities[i];
      if (typeof capability === "string" && capability.length > 0) {
        const label = `Missing capability: ${capability}`;
        if (!factors.includes(label)) {
          factors.push(label);
        }
      }
    }
  }

  if (
    input.readinessStatus === READINESS_STATUS.NOT_STARTED ||
    input.readinessStatus === READINESS_STATUS.PARTIALLY_READY
  ) {
    if (!factors.includes("Workflow readiness remains incomplete")) {
      factors.push("Workflow readiness remains incomplete");
    }
  }

  const riskIndicators = getRiskIndicators(input);
  for (let i = 0; i < riskIndicators.length; i += 1) {
    const indicator = riskIndicators[i];
    if (typeof indicator === "string" && indicator.length > 0 && !factors.includes(indicator)) {
      factors.push(indicator);
    }
  }

  return factors;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} riskLevel
 * @returns {string[]}
 */
function buildImpactAreas(input, riskLevel) {
  const areas = [];

  if (riskLevel === RISK_LEVEL.UNKNOWN || riskLevel === RISK_LEVEL.LOW) {
    return areas;
  }

  if (
    input.healthStatus === HEALTH_STATUS.BLOCKED ||
    input.healthStatus === HEALTH_STATUS.AT_RISK ||
    input.healthStatus === HEALTH_STATUS.STABLE ||
    typeof input.healthScore === "number"
  ) {
    if (!areas.includes("Advisory health")) {
      areas.push("Advisory health");
    }
  }

  if (input.readinessStatus === READINESS_STATUS.APPROVAL_PENDING) {
    areas.push("Approval workflow");
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    areas.push("Workflow evolution");
  }

  const missingCapabilities = getMissingCapabilities(input);
  if (missingCapabilities.length > 0) {
    areas.push("Capability completeness");

    const storageCapabilities = ["storage_adapter", "repository_contract", "persistence_boundary"];
    for (let i = 0; i < missingCapabilities.length; i += 1) {
      const capability = missingCapabilities[i];
      if (typeof capability === "string" && storageCapabilities.includes(capability)) {
        if (!areas.includes("Storage readiness")) {
          areas.push("Storage readiness");
        }
        break;
      }
    }
  }

  if (getBlockedReasons(input).length > 0) {
    areas.push("Workflow continuity");
  }

  if (
    input.readinessStatus === READINESS_STATUS.NOT_STARTED ||
    input.readinessStatus === READINESS_STATUS.PARTIALLY_READY ||
    input.readinessStatus === READINESS_STATUS.REVIEW_READY
  ) {
    if (!areas.includes("Readiness progression")) {
      areas.push("Readiness progression");
    }
  }

  if (riskLevel === RISK_LEVEL.CRITICAL && areas.length === 0) {
    areas.push("Workflow continuity");
  }

  return areas;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} riskLevel
 * @param {string[]} riskFactors
 * @returns {string[]}
 */
function buildMitigationSuggestions(input, riskLevel, riskFactors) {
  const suggestions = [];

  if (riskLevel === RISK_LEVEL.UNKNOWN || riskLevel === RISK_LEVEL.LOW) {
    return suggestions;
  }

  if (riskLevel === RISK_LEVEL.CRITICAL) {
    if (getBlockedReasons(input).length > 0) {
      suggestions.push("Resolve blocked reasons before proceeding");
    } else {
      suggestions.push("Resolve blocked workflow context before proceeding");
    }
  }

  if (input.evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    suggestions.push("Review workflow regression and restore prior readiness");
  }

  if (input.readinessStatus === READINESS_STATUS.APPROVAL_PENDING) {
    suggestions.push("Monitor approval decision progress");
  }

  const missingCapabilities = getMissingCapabilities(input);
  if (missingCapabilities.length > 0) {
    suggestions.push("Address missing capabilities before storage");
  }

  if (input.healthStatus === HEALTH_STATUS.AT_RISK) {
    suggestions.push("Strengthen advisory health signals before advancing workflow");
  }

  if (
    input.readinessStatus === READINESS_STATUS.NOT_STARTED ||
    input.readinessStatus === READINESS_STATUS.PARTIALLY_READY
  ) {
    suggestions.push("Advance workflow readiness through required capability stages");
  }

  if (riskLevel === RISK_LEVEL.HIGH && suggestions.length === 0) {
    suggestions.push("Reduce high-risk advisory signals before workflow advancement");
  }

  if (riskLevel === RISK_LEVEL.MEDIUM && suggestions.length === 0 && riskFactors.length > 0) {
    suggestions.push("Monitor advisory risk factors during workflow progression");
  }

  return suggestions;
}

/**
 * @param {string} riskLevel
 * @returns {string}
 */
function buildRiskSummary(riskLevel) {
  if (riskLevel === RISK_LEVEL.LOW) {
    return "Workflow advisory risk is low";
  }

  if (riskLevel === RISK_LEVEL.MEDIUM) {
    return "Workflow advisory risk is medium";
  }

  if (riskLevel === RISK_LEVEL.HIGH) {
    return "Workflow advisory risk is high";
  }

  if (riskLevel === RISK_LEVEL.CRITICAL) {
    return "Workflow advisory risk is critical";
  }

  return "Workflow advisory risk could not be determined";
}

/**
 * @param {string} riskLevel
 * @param {string[]} riskFactors
 * @param {string[]} impactAreas
 * @param {string[]} mitigationSuggestions
 * @param {string} riskSummary
 * @returns {Readonly<Object>}
 */
function buildRiskResult(
  riskLevel,
  riskFactors,
  impactAreas,
  mitigationSuggestions,
  riskSummary
) {
  return deepFreeze({
    riskLevel,
    riskFactors: Object.freeze(riskFactors.slice()),
    impactAreas: Object.freeze(impactAreas.slice()),
    mitigationSuggestions: Object.freeze(mitigationSuggestions.slice()),
    riskSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_129",
      phase: RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      riskPersistence: false,
      monitoringEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryRiskOnly: true
    })
  });
}

/**
 * Assess recruitment workflow advisory risk from supplied signals.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function assessRecruitmentWorkflowRisk(input) {
  if (!isRecognizedRiskInput(input) || !hasMeaningfulSignals(input)) {
    return buildRiskResult(
      RISK_LEVEL.UNKNOWN,
      [],
      [],
      [],
      buildRiskSummary(RISK_LEVEL.UNKNOWN)
    );
  }

  const riskLevel = resolveRiskLevel(input);
  const riskFactors = buildRiskFactors(input, riskLevel);
  const impactAreas = buildImpactAreas(input, riskLevel);
  const mitigationSuggestions = buildMitigationSuggestions(input, riskLevel, riskFactors);
  const riskSummary = buildRiskSummary(riskLevel);

  return buildRiskResult(
    riskLevel,
    riskFactors,
    impactAreas,
    mitigationSuggestions,
    riskSummary
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_PHASE,
  RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_ENTITY,
  RISK_LEVEL,
  HEALTH_STATUS,
  EVOLUTION_STATUS,
  READINESS_STATUS,
  RECRUITMENT_WORKFLOW_RISK_ASSESSMENT_METADATA,
  assessRecruitmentWorkflowRisk
};
