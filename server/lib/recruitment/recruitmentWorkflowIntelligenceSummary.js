"use strict";

/**
 * Phase 130 — Recruitment Workflow Advisory Intelligence Summary Model (Advisory Only).
 *
 * Pure advisory intelligence summary that aggregates supplied workflow advisory
 * signals into one descriptive summary. No database access, no persistence,
 * no runtime imports, no side effects. No automation. No alerting.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_PHASE = 130;

const RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_ENTITY =
  "recruitment_workflow_intelligence_summary";

const WORKFLOW_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  DRAFT_CREATED: "DRAFT_CREATED",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
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

const PROGRESS_DIRECTION = Object.freeze({
  FORWARD: "FORWARD",
  BACKWARD: "BACKWARD",
  UNCHANGED: "UNCHANGED",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_130",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  summaryPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([124, 125, 126, 127, 128, 129])
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
function isRecognizedIntelligenceInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }

  const objectFields = [
    "advisoryReport",
    "snapshot",
    "comparison",
    "evolution",
    "health",
    "risk"
  ];
  for (let i = 0; i < objectFields.length; i += 1) {
    const field = objectFields[i];
    if (input[field] != null && !isPlainObject(input[field])) {
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
  if (input.recruitmentId != null && String(input.recruitmentId).length > 0) {
    return true;
  }

  const advisoryReport = isPlainObject(input.advisoryReport) ? input.advisoryReport : null;
  if (advisoryReport != null) {
    if (
      typeof advisoryReport.workflowStatus === "string" ||
      (isPlainObject(advisoryReport.readinessSummary) &&
        typeof advisoryReport.readinessSummary.status === "string")
    ) {
      return true;
    }
  }

  const snapshot = isPlainObject(input.snapshot) ? input.snapshot : null;
  if (
    snapshot != null &&
    isPlainObject(snapshot.readinessSnapshot) &&
    typeof snapshot.readinessSnapshot.status === "string"
  ) {
    return true;
  }

  const evolution = isPlainObject(input.evolution) ? input.evolution : null;
  if (evolution != null && typeof evolution.evolutionStatus === "string") {
    return true;
  }

  const health = isPlainObject(input.health) ? input.health : null;
  if (health != null && typeof health.healthStatus === "string") {
    return true;
  }

  const risk = isPlainObject(input.risk) ? input.risk : null;
  if (risk != null && typeof risk.riskLevel === "string") {
    return true;
  }

  const comparison = isPlainObject(input.comparison) ? input.comparison : null;
  if (comparison != null && typeof comparison.comparisonStatus === "string") {
    return true;
  }

  return false;
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }

  if (typeof recruitmentId === "string" || typeof recruitmentId === "number") {
    const normalized = String(recruitmentId).trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveWorkflowStatus(input) {
  const advisoryReport = isPlainObject(input.advisoryReport) ? input.advisoryReport : null;
  if (advisoryReport != null) {
    if (
      isPlainObject(advisoryReport.readinessSummary) &&
      typeof advisoryReport.readinessSummary.status === "string" &&
      advisoryReport.readinessSummary.status.length > 0
    ) {
      return advisoryReport.readinessSummary.status;
    }

    if (
      typeof advisoryReport.workflowStatus === "string" &&
      advisoryReport.workflowStatus.length > 0
    ) {
      return advisoryReport.workflowStatus;
    }
  }

  const snapshot = isPlainObject(input.snapshot) ? input.snapshot : null;
  if (
    snapshot != null &&
    isPlainObject(snapshot.readinessSnapshot) &&
    typeof snapshot.readinessSnapshot.status === "string" &&
    snapshot.readinessSnapshot.status.length > 0
  ) {
    return snapshot.readinessSnapshot.status;
  }

  return WORKFLOW_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveHealthStatus(input) {
  const health = isPlainObject(input.health) ? input.health : null;
  if (health != null && typeof health.healthStatus === "string" && health.healthStatus.length > 0) {
    return health.healthStatus;
  }

  return HEALTH_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveRiskLevel(input) {
  const risk = isPlainObject(input.risk) ? input.risk : null;
  if (risk != null && typeof risk.riskLevel === "string" && risk.riskLevel.length > 0) {
    return risk.riskLevel;
  }

  return RISK_LEVEL.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveEvolutionStatus(input) {
  const evolution = isPlainObject(input.evolution) ? input.evolution : null;
  if (
    evolution != null &&
    typeof evolution.evolutionStatus === "string" &&
    evolution.evolutionStatus.length > 0
  ) {
    return evolution.evolutionStatus;
  }

  return EVOLUTION_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @param {string} evolutionStatus
 * @returns {string}
 */
function resolveProgressDirection(input, evolutionStatus) {
  const evolution = isPlainObject(input.evolution) ? input.evolution : null;
  if (
    evolution != null &&
    typeof evolution.progressDirection === "string" &&
    evolution.progressDirection.length > 0
  ) {
    return evolution.progressDirection;
  }

  if (evolutionStatus === EVOLUTION_STATUS.IMPROVED) {
    return PROGRESS_DIRECTION.FORWARD;
  }

  if (
    evolutionStatus === EVOLUTION_STATUS.REGRESSED ||
    evolutionStatus === EVOLUTION_STATUS.BLOCKED
  ) {
    return PROGRESS_DIRECTION.BACKWARD;
  }

  if (evolutionStatus === EVOLUTION_STATUS.STABLE) {
    return PROGRESS_DIRECTION.UNCHANGED;
  }

  return PROGRESS_DIRECTION.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @returns {number}
 */
function resolveHealthScore(input) {
  const health = isPlainObject(input.health) ? input.health : null;
  if (
    health != null &&
    typeof health.healthScore === "number" &&
    Number.isFinite(health.healthScore)
  ) {
    return health.healthScore;
  }

  return 0;
}

/**
 * @param {string} workflowStatus
 * @param {string} healthStatus
 * @param {string} riskLevel
 * @param {string} evolutionStatus
 * @returns {string}
 */
function buildIntelligenceSummary(workflowStatus, healthStatus, riskLevel, evolutionStatus) {
  if (
    healthStatus === HEALTH_STATUS.BLOCKED ||
    riskLevel === RISK_LEVEL.CRITICAL ||
    evolutionStatus === EVOLUTION_STATUS.BLOCKED ||
    workflowStatus === WORKFLOW_STATUS.BLOCKED
  ) {
    return "Recruitment workflow is blocked and requires resolution before proceeding";
  }

  if (
    healthStatus === HEALTH_STATUS.AT_RISK ||
    riskLevel === RISK_LEVEL.HIGH ||
    evolutionStatus === EVOLUTION_STATUS.REGRESSED
  ) {
    return "Recruitment workflow shows declining advisory signals and requires attention";
  }

  if (
    workflowStatus === WORKFLOW_STATUS.READY_FOR_STORAGE &&
    healthStatus === HEALTH_STATUS.HEALTHY &&
    riskLevel === RISK_LEVEL.LOW &&
    (evolutionStatus === EVOLUTION_STATUS.IMPROVED ||
      evolutionStatus === EVOLUTION_STATUS.STABLE)
  ) {
    return "Recruitment workflow is progressing normally and is ready for the next boundary";
  }

  if (workflowStatus === WORKFLOW_STATUS.APPROVAL_PENDING) {
    return "Recruitment workflow is awaiting approval within the advisory boundary";
  }

  if (riskLevel === RISK_LEVEL.MEDIUM || healthStatus === HEALTH_STATUS.STABLE) {
    return "Recruitment workflow is progressing with moderate advisory signals";
  }

  if (
    healthStatus === HEALTH_STATUS.HEALTHY &&
    riskLevel === RISK_LEVEL.LOW &&
    evolutionStatus === EVOLUTION_STATUS.IMPROVED
  ) {
    return "Recruitment workflow is progressing normally with improving advisory signals";
  }

  return "Recruitment workflow advisory intelligence could not be determined";
}

/**
 * @param {string} workflowStatus
 * @param {string} healthStatus
 * @param {string} riskLevel
 * @param {string} evolutionStatus
 * @returns {string[]}
 */
function buildKeySignals(workflowStatus, healthStatus, riskLevel, evolutionStatus) {
  const signals = [];

  if (evolutionStatus === EVOLUTION_STATUS.IMPROVED) {
    signals.push("Workflow improved");
  } else if (evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    signals.push("Workflow regressed");
  } else if (evolutionStatus === EVOLUTION_STATUS.STABLE) {
    signals.push("Workflow stable");
  } else if (evolutionStatus === EVOLUTION_STATUS.BLOCKED) {
    signals.push("Workflow blocked");
  }

  if (healthStatus === HEALTH_STATUS.HEALTHY) {
    signals.push("Health status healthy");
  } else if (healthStatus === HEALTH_STATUS.STABLE) {
    signals.push("Health status stable");
  } else if (healthStatus === HEALTH_STATUS.AT_RISK) {
    signals.push("Health status at risk");
  } else if (healthStatus === HEALTH_STATUS.BLOCKED) {
    signals.push("Health status blocked");
  }

  if (riskLevel === RISK_LEVEL.LOW) {
    signals.push("Risk level low");
  } else if (riskLevel === RISK_LEVEL.MEDIUM) {
    signals.push("Risk level medium");
  } else if (riskLevel === RISK_LEVEL.HIGH) {
    signals.push("Risk level high");
  } else if (riskLevel === RISK_LEVEL.CRITICAL) {
    signals.push("Risk level critical");
  }

  if (workflowStatus === WORKFLOW_STATUS.READY_FOR_STORAGE) {
    signals.push("Readiness reached storage boundary");
  } else if (workflowStatus === WORKFLOW_STATUS.APPROVAL_PENDING) {
    signals.push("Approval decision pending");
  } else if (workflowStatus === WORKFLOW_STATUS.BLOCKED) {
    signals.push("Workflow status blocked");
  }

  return signals;
}

/**
 * @param {string} workflowStatus
 * @param {string} healthStatus
 * @param {string} riskLevel
 * @param {string} evolutionStatus
 * @returns {string[]}
 */
function buildRecommendedFocus(workflowStatus, healthStatus, riskLevel, evolutionStatus) {
  const focus = [];

  if (
    healthStatus === HEALTH_STATUS.BLOCKED ||
    riskLevel === RISK_LEVEL.CRITICAL ||
    evolutionStatus === EVOLUTION_STATUS.BLOCKED ||
    workflowStatus === WORKFLOW_STATUS.BLOCKED
  ) {
    focus.push("Resolve blocked workflow context before proceeding");
    return focus;
  }

  if (evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    focus.push("Review workflow regression and restore prior readiness");
  }

  if (healthStatus === HEALTH_STATUS.AT_RISK || riskLevel === RISK_LEVEL.HIGH) {
    focus.push("Strengthen advisory signals before workflow advancement");
  }

  if (workflowStatus === WORKFLOW_STATUS.APPROVAL_PENDING) {
    focus.push("Monitor approval decision progress");
  }

  if (
    workflowStatus === WORKFLOW_STATUS.READY_FOR_STORAGE &&
    healthStatus === HEALTH_STATUS.HEALTHY &&
    riskLevel === RISK_LEVEL.LOW
  ) {
    focus.push("Proceed through approved workflow boundary");
    return focus;
  }

  if (riskLevel === RISK_LEVEL.MEDIUM) {
    focus.push("Monitor advisory risk factors during workflow progression");
  }

  if (
    workflowStatus === WORKFLOW_STATUS.NOT_STARTED ||
    workflowStatus === WORKFLOW_STATUS.PARTIALLY_READY
  ) {
    focus.push("Advance workflow readiness through required capability stages");
  }

  if (focus.length === 0 && healthStatus !== HEALTH_STATUS.UNKNOWN) {
    focus.push("Review advisory workflow signals");
  }

  return focus;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildIntelligenceResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    workflowStatus: params.workflowStatus,
    intelligenceSummary: params.intelligenceSummary,
    keySignals: Object.freeze(params.keySignals.slice()),
    currentState: deepFreeze({
      health: params.healthStatus,
      risk: params.riskLevel
    }),
    progression: deepFreeze({
      evolution: params.evolutionStatus,
      direction: params.progressDirection
    }),
    healthOverview: deepFreeze({
      score: params.healthScore
    }),
    riskOverview: deepFreeze({
      level: params.riskLevel
    }),
    recommendedFocus: Object.freeze(params.recommendedFocus.slice()),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      generatedBy: "phase_130",
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      summaryPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryIntelligenceOnly: true
    })
  });
}

/**
 * Create a recruitment workflow advisory intelligence summary from supplied signals.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntelligenceSummary(input) {
  if (!isRecognizedIntelligenceInput(input) || !hasMeaningfulSignals(input)) {
    return buildIntelligenceResult({
      recruitmentId: null,
      workflowStatus: WORKFLOW_STATUS.UNKNOWN,
      intelligenceSummary: "Recruitment workflow advisory intelligence could not be determined",
      keySignals: [],
      healthStatus: HEALTH_STATUS.UNKNOWN,
      riskLevel: RISK_LEVEL.UNKNOWN,
      evolutionStatus: EVOLUTION_STATUS.UNKNOWN,
      progressDirection: PROGRESS_DIRECTION.UNKNOWN,
      healthScore: 0,
      recommendedFocus: []
    });
  }

  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const workflowStatus = resolveWorkflowStatus(input);
  const healthStatus = resolveHealthStatus(input);
  const riskLevel = resolveRiskLevel(input);
  const evolutionStatus = resolveEvolutionStatus(input);
  const progressDirection = resolveProgressDirection(input, evolutionStatus);
  const healthScore = resolveHealthScore(input);
  const intelligenceSummary = buildIntelligenceSummary(
    workflowStatus,
    healthStatus,
    riskLevel,
    evolutionStatus
  );
  const keySignals = buildKeySignals(workflowStatus, healthStatus, riskLevel, evolutionStatus);
  const recommendedFocus = buildRecommendedFocus(
    workflowStatus,
    healthStatus,
    riskLevel,
    evolutionStatus
  );

  return buildIntelligenceResult({
    recruitmentId,
    workflowStatus,
    intelligenceSummary,
    keySignals,
    healthStatus,
    riskLevel,
    evolutionStatus,
    progressDirection,
    healthScore,
    recommendedFocus
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_ENTITY,
  WORKFLOW_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  EVOLUTION_STATUS,
  PROGRESS_DIRECTION,
  RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA,
  createRecruitmentWorkflowIntelligenceSummary
};
