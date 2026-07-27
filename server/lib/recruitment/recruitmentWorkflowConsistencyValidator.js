"use strict";

/**
 * Phase 133 — Recruitment Workflow Advisory Consistency Validator (Advisory Only).
 *
 * Pure advisory validator that checks logical consistency across recruitment
 * workflow advisory outputs. No database access, no persistence, no runtime
 * imports, no side effects. No auto-correction. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_PHASE = 133;

const RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_ENTITY =
  "recruitment_workflow_consistency_validator";

const CONSISTENCY_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const TIMELINE_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  EMPTY: "EMPTY",
  UNKNOWN: "UNKNOWN"
});

const WORKFLOW_STAGES = Object.freeze({
  NOTIFICATION: "NOTIFICATION",
  APPLICATION: "APPLICATION",
  CORRECTION: "CORRECTION",
  ADMIT_CARD: "ADMIT_CARD",
  EXAM: "EXAM",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  FINAL_RESULT: "FINAL_RESULT"
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

const RECOMMENDATION_STATUS = Object.freeze({
  PROCEED: "PROCEED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_ACTION_REQUIRED: "BLOCKED_ACTION_REQUIRED",
  MONITOR_ADVISORY: "MONITOR_ADVISORY",
  UNKNOWN: "UNKNOWN"
});

const CONSISTENCY_RULE = Object.freeze({
  FINAL_RESULT_SHOULD_NOT_RECOMMEND_REVIEW: "FINAL_RESULT_SHOULD_NOT_RECOMMEND_REVIEW",
  BLOCKED_HEALTH_SHOULD_NOT_PRODUCE_LOW_RISK: "BLOCKED_HEALTH_SHOULD_NOT_PRODUCE_LOW_RISK",
  PROCEED_SHOULD_NOT_COEXIST_WITH_CRITICAL_RISK: "PROCEED_SHOULD_NOT_COEXIST_WITH_CRITICAL_RISK",
  HEALTHY_SHOULD_NOT_COEXIST_WITH_BLOCKED_TIMELINE:
    "HEALTHY_SHOULD_NOT_COEXIST_WITH_BLOCKED_TIMELINE",
  INTELLIGENCE_HEALTH_MISMATCH: "INTELLIGENCE_HEALTH_MISMATCH",
  INTELLIGENCE_RISK_MISMATCH: "INTELLIGENCE_RISK_MISMATCH"
});

const VALIDATED_AREA = Object.freeze({
  TIMELINE: "timeline",
  INTELLIGENCE_SUMMARY: "intelligenceSummary",
  HEALTH: "health",
  RISK: "risk",
  RECOMMENDATION: "recommendation"
});

const SUPPORTED_TIMELINE_STATUSES = Object.freeze(new Set(Object.values(TIMELINE_STATUS)));

const SUPPORTED_WORKFLOW_STAGES = Object.freeze(new Set(Object.values(WORKFLOW_STAGES)));

const SUPPORTED_HEALTH_STATUSES = Object.freeze(new Set(Object.values(HEALTH_STATUS)));

const SUPPORTED_RISK_LEVELS = Object.freeze(new Set(Object.values(RISK_LEVEL)));

const SUPPORTED_RECOMMENDATION_STATUSES = Object.freeze(
  new Set(Object.values(RECOMMENDATION_STATUS))
);

const RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_133",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  validationPersistence: false,
  autoCorrectionEnabled: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([128, 129, 130, 131, 132])
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
function isRecognizedConsistencyInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = ["timeline", "intelligenceSummary", "health", "risk", "recommendation"];
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
function hasMeaningfulSignals(input) {
  return (
    input.timeline != null ||
    input.intelligenceSummary != null ||
    input.health != null ||
    input.risk != null ||
    input.recommendation != null
  );
}

/**
 * @param {*} timelineInput
 * @returns {string|null}
 */
function extractTimelineStage(timelineInput) {
  if (typeof timelineInput === "string") {
    return timelineInput;
  }
  if (!isPlainObject(timelineInput)) {
    return null;
  }
  if (typeof timelineInput.currentStage === "string") {
    return timelineInput.currentStage;
  }
  if (typeof timelineInput.timelineStage === "string") {
    return timelineInput.timelineStage;
  }
  return null;
}

/**
 * @param {*} timelineInput
 * @returns {string|null}
 */
function extractTimelineStatus(timelineInput) {
  if (typeof timelineInput === "string") {
    if (timelineInput === TIMELINE_STATUS.BLOCKED) {
      return TIMELINE_STATUS.BLOCKED;
    }
    return null;
  }
  if (!isPlainObject(timelineInput)) {
    return null;
  }
  if (typeof timelineInput.timelineStatus === "string") {
    return timelineInput.timelineStatus;
  }
  return null;
}

/**
 * @param {*} healthInput
 * @returns {string|null}
 */
function extractHealthStatus(healthInput) {
  if (typeof healthInput === "string") {
    return healthInput;
  }
  if (!isPlainObject(healthInput)) {
    return null;
  }
  if (typeof healthInput.healthStatus === "string") {
    return healthInput.healthStatus;
  }
  return null;
}

/**
 * @param {*} riskInput
 * @returns {string|null}
 */
function extractRiskLevel(riskInput) {
  if (typeof riskInput === "string") {
    return riskInput;
  }
  if (!isPlainObject(riskInput)) {
    return null;
  }
  if (typeof riskInput.riskLevel === "string") {
    return riskInput.riskLevel;
  }
  return null;
}

/**
 * @param {*} recommendationInput
 * @returns {string|null}
 */
function extractRecommendationStatus(recommendationInput) {
  if (typeof recommendationInput === "string") {
    return recommendationInput;
  }
  if (!isPlainObject(recommendationInput)) {
    return null;
  }
  if (typeof recommendationInput.recommendationStatus === "string") {
    return recommendationInput.recommendationStatus;
  }
  return null;
}

/**
 * @param {*} intelligenceInput
 * @returns {{ health: string|null, risk: string|null }}
 */
function extractIntelligenceState(intelligenceInput) {
  if (!isPlainObject(intelligenceInput)) {
    return { health: null, risk: null };
  }

  const currentState = isPlainObject(intelligenceInput.currentState)
    ? intelligenceInput.currentState
    : null;

  const health =
    currentState != null && typeof currentState.health === "string"
      ? currentState.health
      : typeof intelligenceInput.healthStatus === "string"
        ? intelligenceInput.healthStatus
        : null;

  const risk =
    currentState != null && typeof currentState.risk === "string"
      ? currentState.risk
      : typeof intelligenceInput.riskLevel === "string"
        ? intelligenceInput.riskLevel
        : null;

  return { health, risk };
}

/**
 * @param {string|null} value
 * @param {Readonly<Set<string>>} supportedValues
 * @returns {string|null}
 */
function resolveKnownValue(value, supportedValues) {
  if (typeof value !== "string" || !supportedValues.has(value)) {
    return null;
  }
  return value;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractAdvisorySignals(input) {
  const rawTimelineStage = extractTimelineStage(input.timeline);
  const rawTimelineStatus = extractTimelineStatus(input.timeline);
  const rawHealthStatus = extractHealthStatus(input.health);
  const rawRiskLevel = extractRiskLevel(input.risk);
  const rawRecommendationStatus = extractRecommendationStatus(input.recommendation);
  const rawIntelligenceState = extractIntelligenceState(input.intelligenceSummary);

  return {
    timelineStage: resolveKnownValue(rawTimelineStage, SUPPORTED_WORKFLOW_STAGES),
    timelineStatus: resolveKnownValue(rawTimelineStatus, SUPPORTED_TIMELINE_STATUSES),
    healthStatus: resolveKnownValue(rawHealthStatus, SUPPORTED_HEALTH_STATUSES),
    riskLevel: resolveKnownValue(rawRiskLevel, SUPPORTED_RISK_LEVELS),
    recommendationStatus: resolveKnownValue(
      rawRecommendationStatus,
      SUPPORTED_RECOMMENDATION_STATUSES
    ),
    intelligenceState: {
      health: resolveKnownValue(rawIntelligenceState.health, SUPPORTED_HEALTH_STATUSES),
      risk: resolveKnownValue(rawIntelligenceState.risk, SUPPORTED_RISK_LEVELS)
    }
  };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {{ inconsistencies: Object[], validatedAreas: string[] }}
 */
function evaluateConsistencyRules(signals) {
  const inconsistencies = [];
  const validatedAreas = [];

  const timelineStage = signals.timelineStage;
  const timelineStatus = signals.timelineStatus;
  const healthStatus = signals.healthStatus;
  const riskLevel = signals.riskLevel;
  const recommendationStatus = signals.recommendationStatus;
  const intelligenceHealth = signals.intelligenceState.health;
  const intelligenceRisk = signals.intelligenceState.risk;

  if (timelineStage != null || recommendationStatus != null) {
    if (
      timelineStage === WORKFLOW_STAGES.FINAL_RESULT &&
      recommendationStatus === RECOMMENDATION_STATUS.REVIEW_REQUIRED
    ) {
      inconsistencies.push(
        deepFreeze({
          rule: CONSISTENCY_RULE.FINAL_RESULT_SHOULD_NOT_RECOMMEND_REVIEW,
          areas: Object.freeze([VALIDATED_AREA.TIMELINE, VALIDATED_AREA.RECOMMENDATION]),
          detail: "FINAL_RESULT timeline stage should not recommend approval review",
          observed: deepFreeze({
            timeline: timelineStage,
            recommendation: recommendationStatus
          })
        })
      );
    }
    if (timelineStage != null || recommendationStatus != null) {
      validatedAreas.push(VALIDATED_AREA.TIMELINE, VALIDATED_AREA.RECOMMENDATION);
    }
  }

  if (healthStatus != null || riskLevel != null) {
    if (healthStatus === HEALTH_STATUS.BLOCKED && riskLevel === RISK_LEVEL.LOW) {
      inconsistencies.push(
        deepFreeze({
          rule: CONSISTENCY_RULE.BLOCKED_HEALTH_SHOULD_NOT_PRODUCE_LOW_RISK,
          areas: Object.freeze([VALIDATED_AREA.HEALTH, VALIDATED_AREA.RISK]),
          detail: "BLOCKED health status should not coexist with LOW risk level",
          observed: deepFreeze({
            health: healthStatus,
            risk: riskLevel
          })
        })
      );
    }
    if (healthStatus != null || riskLevel != null) {
      validatedAreas.push(VALIDATED_AREA.HEALTH, VALIDATED_AREA.RISK);
    }
  }

  if (recommendationStatus != null || riskLevel != null) {
    if (
      recommendationStatus === RECOMMENDATION_STATUS.PROCEED &&
      riskLevel === RISK_LEVEL.CRITICAL
    ) {
      inconsistencies.push(
        deepFreeze({
          rule: CONSISTENCY_RULE.PROCEED_SHOULD_NOT_COEXIST_WITH_CRITICAL_RISK,
          areas: Object.freeze([VALIDATED_AREA.RECOMMENDATION, VALIDATED_AREA.RISK]),
          detail: "PROCEED recommendation should not coexist with CRITICAL risk level",
          observed: deepFreeze({
            recommendation: recommendationStatus,
            risk: riskLevel
          })
        })
      );
    }
    if (recommendationStatus != null) {
      if (!validatedAreas.includes(VALIDATED_AREA.RECOMMENDATION)) {
        validatedAreas.push(VALIDATED_AREA.RECOMMENDATION);
      }
    }
    if (riskLevel != null && !validatedAreas.includes(VALIDATED_AREA.RISK)) {
      validatedAreas.push(VALIDATED_AREA.RISK);
    }
  }

  if (healthStatus != null || timelineStatus != null) {
    if (healthStatus === HEALTH_STATUS.HEALTHY && timelineStatus === TIMELINE_STATUS.BLOCKED) {
      inconsistencies.push(
        deepFreeze({
          rule: CONSISTENCY_RULE.HEALTHY_SHOULD_NOT_COEXIST_WITH_BLOCKED_TIMELINE,
          areas: Object.freeze([VALIDATED_AREA.HEALTH, VALIDATED_AREA.TIMELINE]),
          detail: "HEALTHY health status should not coexist with BLOCKED timeline status",
          observed: deepFreeze({
            health: healthStatus,
            timeline: timelineStatus
          })
        })
      );
    }
    if (timelineStatus != null && !validatedAreas.includes(VALIDATED_AREA.TIMELINE)) {
      validatedAreas.push(VALIDATED_AREA.TIMELINE);
    }
    if (healthStatus != null && !validatedAreas.includes(VALIDATED_AREA.HEALTH)) {
      validatedAreas.push(VALIDATED_AREA.HEALTH);
    }
  }

  if (intelligenceHealth != null || healthStatus != null) {
    if (
      intelligenceHealth != null &&
      healthStatus != null &&
      intelligenceHealth !== healthStatus
    ) {
      inconsistencies.push(
        deepFreeze({
          rule: CONSISTENCY_RULE.INTELLIGENCE_HEALTH_MISMATCH,
          areas: Object.freeze([VALIDATED_AREA.INTELLIGENCE_SUMMARY, VALIDATED_AREA.HEALTH]),
          detail: "Intelligence summary health signal does not match health advisory output",
          observed: deepFreeze({
            intelligenceSummary: intelligenceHealth,
            health: healthStatus
          })
        })
      );
    }
    if (intelligenceHealth != null || healthStatus != null) {
      if (!validatedAreas.includes(VALIDATED_AREA.INTELLIGENCE_SUMMARY)) {
        validatedAreas.push(VALIDATED_AREA.INTELLIGENCE_SUMMARY);
      }
    }
  }

  if (intelligenceRisk != null || riskLevel != null) {
    if (intelligenceRisk != null && riskLevel != null && intelligenceRisk !== riskLevel) {
      inconsistencies.push(
        deepFreeze({
          rule: CONSISTENCY_RULE.INTELLIGENCE_RISK_MISMATCH,
          areas: Object.freeze([VALIDATED_AREA.INTELLIGENCE_SUMMARY, VALIDATED_AREA.RISK]),
          detail: "Intelligence summary risk signal does not match risk advisory output",
          observed: deepFreeze({
            intelligenceSummary: intelligenceRisk,
            risk: riskLevel
          })
        })
      );
    }
    if (intelligenceRisk != null && !validatedAreas.includes(VALIDATED_AREA.INTELLIGENCE_SUMMARY)) {
      validatedAreas.push(VALIDATED_AREA.INTELLIGENCE_SUMMARY);
    }
  }

  return {
    inconsistencies,
    validatedAreas: Object.freeze([...new Set(validatedAreas)].sort())
  };
}

/**
 * @param {string} consistencyStatus
 * @param {ReadonlyArray<Object>} inconsistencies
 * @param {ReadonlyArray<string>} validatedAreas
 * @returns {string}
 */
function buildValidationSummary(consistencyStatus, inconsistencies, validatedAreas) {
  if (consistencyStatus === CONSISTENCY_STATUS.UNKNOWN) {
    return "Recruitment workflow advisory consistency could not be determined from supplied signals";
  }

  if (consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT) {
    if (inconsistencies.length === 1) {
      return `Recruitment workflow advisory outputs are inconsistent: ${inconsistencies[0].detail}`;
    }
    return `Recruitment workflow advisory outputs are inconsistent across ${inconsistencies.length} rule checks`;
  }

  if (validatedAreas.length === 0) {
    return "Recruitment workflow advisory consistency could not be determined from supplied signals";
  }

  return "Recruitment workflow advisory outputs are logically consistent across validated areas";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildConsistencyResult(params) {
  return deepFreeze({
    consistencyStatus: params.consistencyStatus,
    inconsistencies: Object.freeze(params.inconsistencies.slice()),
    validatedAreas: Object.freeze(params.validatedAreas.slice()),
    validationSummary: params.validationSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      generatedBy: "phase_133",
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      validationPersistence: false,
      autoCorrectionEnabled: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryConsistencyOnly: true
    })
  });
}

/**
 * Validate logical consistency across recruitment workflow advisory outputs.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentWorkflowConsistency(input) {
  if (!isRecognizedConsistencyInput(input) || !hasMeaningfulSignals(input)) {
    return buildConsistencyResult({
      consistencyStatus: CONSISTENCY_STATUS.UNKNOWN,
      inconsistencies: [],
      validatedAreas: [],
      validationSummary: buildValidationSummary(CONSISTENCY_STATUS.UNKNOWN, [], [])
    });
  }

  const signals = extractAdvisorySignals(input);
  const hasResolvableSignals =
    signals.timelineStage != null ||
    signals.timelineStatus != null ||
    signals.healthStatus != null ||
    signals.riskLevel != null ||
    signals.recommendationStatus != null ||
    signals.intelligenceState.health != null ||
    signals.intelligenceState.risk != null;

  if (!hasResolvableSignals) {
    return buildConsistencyResult({
      consistencyStatus: CONSISTENCY_STATUS.UNKNOWN,
      inconsistencies: [],
      validatedAreas: [],
      validationSummary: buildValidationSummary(CONSISTENCY_STATUS.UNKNOWN, [], [])
    });
  }

  const evaluation = evaluateConsistencyRules(signals);
  const consistencyStatus =
    evaluation.inconsistencies.length > 0
      ? CONSISTENCY_STATUS.INCONSISTENT
      : evaluation.validatedAreas.length > 0
        ? CONSISTENCY_STATUS.CONSISTENT
        : CONSISTENCY_STATUS.UNKNOWN;

  return buildConsistencyResult({
    consistencyStatus,
    inconsistencies: evaluation.inconsistencies,
    validatedAreas: evaluation.validatedAreas,
    validationSummary: buildValidationSummary(
      consistencyStatus,
      evaluation.inconsistencies,
      evaluation.validatedAreas
    )
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_ENTITY,
  CONSISTENCY_STATUS,
  TIMELINE_STATUS,
  WORKFLOW_STAGES,
  HEALTH_STATUS,
  RISK_LEVEL,
  RECOMMENDATION_STATUS,
  CONSISTENCY_RULE,
  VALIDATED_AREA,
  RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA,
  validateRecruitmentWorkflowConsistency
};
