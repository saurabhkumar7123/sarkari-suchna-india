"use strict";

/**
 * Phase 99 — Recruitment Workflow Advisory Summary.
 *
 * Pure library that composes advisory outputs from Phases 95–98 into one
 * normalized summary object. Aggregation only — no database access, no new
 * business analysis, no state transitions, and no production mutations.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary documented inline.
 */

const RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE = 99;

const RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY = "recruitment_workflow_advisory_summary";

/**
 * Advisory lifecycle events aligned with Phases 95–98 (no import).
 */
const ADVISORY_LIFECYCLE_EVENTS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  NOTIFICATION: "NOTIFICATION",
  APPLICATION: "APPLICATION",
  APPLICATION_CORRECTION: "APPLICATION_CORRECTION",
  EXAM_CITY: "EXAM_CITY",
  ADMIT_CARD: "ADMIT_CARD",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  FINAL_RESULT: "FINAL_RESULT",
  COUNSELLING: "COUNSELLING",
  DOCUMENT_VERIFICATION: "DOCUMENT_VERIFICATION",
  JOINING: "JOINING",
  COMPLETED: "COMPLETED"
});

const ADVISORY_LIFECYCLE_EVENT_LIST = Object.freeze(Object.values(ADVISORY_LIFECYCLE_EVENTS));

const SUPPORTED_ADVISORY_LIFECYCLE_EVENTS = Object.freeze(
  new Set(ADVISORY_LIFECYCLE_EVENT_LIST)
);

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "none"
});

const SUPPORTED_CONFIDENCE_LEVELS = Object.freeze(new Set(Object.values(CONFIDENCE_LEVELS)));

const RECOMMENDED_ACTIONS = Object.freeze({
  MONITOR: "MONITOR",
  NO_MONITORING: "NO_MONITORING",
  MANUAL_REVIEW: "MANUAL_REVIEW"
});

const SUPPORTED_RECOMMENDED_ACTIONS = Object.freeze(new Set(Object.values(RECOMMENDED_ACTIONS)));

const WORKFLOW_COMPLETENESS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  PARTIAL: "PARTIAL",
  COMPLETE: "COMPLETE"
});

const SUPPORTED_WORKFLOW_COMPLETENESS = Object.freeze(
  new Set(Object.values(WORKFLOW_COMPLETENESS))
);

const OVERALL_HEALTH = Object.freeze({
  HEALTHY: "HEALTHY",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const SUPPORTED_OVERALL_HEALTH = Object.freeze(new Set(Object.values(OVERALL_HEALTH)));

/**
 * Anomaly types from Phase 97 vocabulary (inline, for health classification only).
 */
const ANOMALY_TYPES = Object.freeze({
  INVALID_LIFECYCLE_TRANSITION: "INVALID_LIFECYCLE_TRANSITION",
  TERMINAL_STATE_VIOLATION: "TERMINAL_STATE_VIOLATION",
  DUPLICATE_LIFECYCLE_EVENT: "DUPLICATE_LIFECYCLE_EVENT",
  MISSING_EXPECTED_LIFECYCLE_EVENT: "MISSING_EXPECTED_LIFECYCLE_EVENT",
  WORKFLOW_COMPLETED_LATER_EVENT: "WORKFLOW_COMPLETED_LATER_EVENT",
  UNKNOWN_LIFECYCLE_STATE: "UNKNOWN_LIFECYCLE_STATE"
});

const CRITICAL_ANOMALY_TYPES = Object.freeze(
  new Set([
    ANOMALY_TYPES.INVALID_LIFECYCLE_TRANSITION,
    ANOMALY_TYPES.TERMINAL_STATE_VIOLATION,
    ANOMALY_TYPES.WORKFLOW_COMPLETED_LATER_EVENT
  ])
);

const RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false
});

const RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE,
  description:
    "Normalized recruitment workflow advisory summary composed from Phases 95–98 outputs.",
  lifecycleEvents: ADVISORY_LIFECYCLE_EVENT_LIST,
  overallHealthLevels: Object.freeze(Object.values(OVERALL_HEALTH)),
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  metadata: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA
});

const EMPTY_WORKFLOW_ADVISORY_SUMMARY = Object.freeze({
  currentLifecycle: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
  workflowCompleted: false,
  workflowValid: false,
  workflowCompleteness: WORKFLOW_COMPLETENESS.UNKNOWN,
  workflowTerminal: false,
  recommendedAction: RECOMMENDED_ACTIONS.MANUAL_REVIEW,
  recommendedNextEvents: Object.freeze([]),
  monitoringRequired: false,
  overallConfidence: CONFIDENCE_LEVELS.NONE,
  overallHealth: OVERALL_HEALTH.UNKNOWN,
  anomalyCount: 0,
  advisory: true,
  architectureOnly: true,
  executed: false
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
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

function normalizeAdvisoryLifecycleEvent(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const upper = normalized.toUpperCase();
  return SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(upper) ? upper : null;
}

function normalizeConfidence(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  const lower = normalized.toLowerCase();
  return SUPPORTED_CONFIDENCE_LEVELS.has(lower) ? lower : null;
}

function compareConfidenceRank(confidence) {
  switch (confidence) {
    case CONFIDENCE_LEVELS.HIGH:
      return 4;
    case CONFIDENCE_LEVELS.MEDIUM:
      return 3;
    case CONFIDENCE_LEVELS.LOW:
      return 2;
    case CONFIDENCE_LEVELS.NONE:
    default:
      return 1;
  }
}

function minConfidence(...values) {
  let best = CONFIDENCE_LEVELS.HIGH;
  let bestRank = compareConfidenceRank(best);

  for (let i = 0; i < values.length; i += 1) {
    const normalized = normalizeConfidence(values[i]);
    if (normalized == null) {
      continue;
    }
    const rank = compareConfidenceRank(normalized);
    if (rank < bestRank) {
      best = normalized;
      bestRank = rank;
    }
  }

  return best;
}

function extractLifecycleResolution(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return isPlainObject(context.lifecycleResolution) ? context.lifecycleResolution : null;
}

function extractTransitionResolution(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isPlainObject(context.transitionResolution)) {
    return context.transitionResolution;
  }

  if (isPlainObject(context.lifecycleTransitionResolution)) {
    return context.lifecycleTransitionResolution;
  }

  return null;
}

function extractWorkflowValidation(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return isPlainObject(context.workflowValidation) ? context.workflowValidation : null;
}

function extractWorkflowRecommendation(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return isPlainObject(context.workflowRecommendation) ? context.workflowRecommendation : null;
}

function extractCurrentLifecycle(lifecycleResolution, transitionResolution) {
  if (isPlainObject(transitionResolution)) {
    const fromTransition = normalizeAdvisoryLifecycleEvent(
      transitionResolution.currentLifecycleEvent
    );
    if (fromTransition != null) {
      return fromTransition;
    }
  }

  if (isPlainObject(lifecycleResolution)) {
    const fromLifecycle = normalizeAdvisoryLifecycleEvent(lifecycleResolution.lifecycleEvent);
    if (fromLifecycle != null) {
      return fromLifecycle;
    }
  }

  return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
}

function extractWorkflowCompleted(transitionResolution) {
  if (!isPlainObject(transitionResolution)) {
    return false;
  }
  return transitionResolution.workflowCompleted === true;
}

function extractWorkflowValid(workflowValidation) {
  if (!isPlainObject(workflowValidation)) {
    return false;
  }
  return workflowValidation.workflowValid === true;
}

function extractWorkflowCompleteness(workflowValidation) {
  if (!isPlainObject(workflowValidation)) {
    return WORKFLOW_COMPLETENESS.UNKNOWN;
  }
  const completeness = normalizeString(workflowValidation.workflowCompleteness);
  if (completeness != null && SUPPORTED_WORKFLOW_COMPLETENESS.has(completeness.toUpperCase())) {
    return completeness.toUpperCase();
  }
  return WORKFLOW_COMPLETENESS.UNKNOWN;
}

function extractAnomalyCount(workflowValidation) {
  if (!isPlainObject(workflowValidation)) {
    return 0;
  }
  return Array.isArray(workflowValidation.detectedAnomalies)
    ? workflowValidation.detectedAnomalies.length
    : 0;
}

function hasCriticalAnomaly(workflowValidation) {
  if (!isPlainObject(workflowValidation) || !Array.isArray(workflowValidation.detectedAnomalies)) {
    return false;
  }

  for (let i = 0; i < workflowValidation.detectedAnomalies.length; i += 1) {
    const anomaly = workflowValidation.detectedAnomalies[i];
    if (
      isPlainObject(anomaly) &&
      typeof anomaly.type === "string" &&
      CRITICAL_ANOMALY_TYPES.has(anomaly.type)
    ) {
      return true;
    }
  }

  return false;
}

function resolveOverallHealth(currentLifecycle, workflowValid, workflowValidation, anomalyCount) {
  if (currentLifecycle === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return OVERALL_HEALTH.UNKNOWN;
  }

  if (hasCriticalAnomaly(workflowValidation) || workflowValid === false) {
    if (hasCriticalAnomaly(workflowValidation)) {
      return OVERALL_HEALTH.CRITICAL;
    }

    if (anomalyCount > 0) {
      return OVERALL_HEALTH.WARNING;
    }

    return OVERALL_HEALTH.CRITICAL;
  }

  if (anomalyCount > 0) {
    return OVERALL_HEALTH.WARNING;
  }

  if (workflowValid === true && anomalyCount === 0) {
    return OVERALL_HEALTH.HEALTHY;
  }

  return OVERALL_HEALTH.UNKNOWN;
}

function extractRecommendedAction(workflowRecommendation) {
  if (!isPlainObject(workflowRecommendation)) {
    return RECOMMENDED_ACTIONS.MANUAL_REVIEW;
  }
  const action = workflowRecommendation.recommendedAction;
  return SUPPORTED_RECOMMENDED_ACTIONS.has(action) ? action : RECOMMENDED_ACTIONS.MANUAL_REVIEW;
}

function extractRecommendedNextEvents(workflowRecommendation) {
  if (!isPlainObject(workflowRecommendation) || !Array.isArray(workflowRecommendation.recommendedNextEvents)) {
    return [];
  }

  const nextEvents = [];
  for (let i = 0; i < workflowRecommendation.recommendedNextEvents.length; i += 1) {
    const event = normalizeAdvisoryLifecycleEvent(workflowRecommendation.recommendedNextEvents[i]);
    if (event != null) {
      nextEvents.push(event);
    }
  }
  return nextEvents;
}

function extractWorkflowTerminal(workflowRecommendation, transitionResolution) {
  if (isPlainObject(workflowRecommendation) && typeof workflowRecommendation.workflowTerminal === "boolean") {
    return workflowRecommendation.workflowTerminal;
  }
  return extractWorkflowCompleted(transitionResolution);
}

function extractMonitoringRequired(workflowRecommendation) {
  if (!isPlainObject(workflowRecommendation)) {
    return false;
  }
  return workflowRecommendation.monitoringRequired === true;
}

function resolveOverallConfidence(
  lifecycleResolution,
  transitionResolution,
  workflowValidation,
  workflowRecommendation,
  currentLifecycle
) {
  if (currentLifecycle === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return CONFIDENCE_LEVELS.NONE;
  }

  return minConfidence(
    lifecycleResolution?.lifecycleConfidence ?? null,
    transitionResolution?.transitionConfidence ?? null,
    workflowValidation?.validationConfidence ?? null,
    workflowRecommendation?.recommendationConfidence ?? null
  );
}

function buildAdvisorySummaryResult(context) {
  const lifecycleResolution = extractLifecycleResolution(context);
  const transitionResolution = extractTransitionResolution(context);
  const workflowValidation = extractWorkflowValidation(context);
  const workflowRecommendation = extractWorkflowRecommendation(context);

  const currentLifecycle = extractCurrentLifecycle(lifecycleResolution, transitionResolution);
  const workflowCompleted = extractWorkflowCompleted(transitionResolution);
  const workflowValid = extractWorkflowValid(workflowValidation);
  const workflowCompleteness = extractWorkflowCompleteness(workflowValidation);
  const workflowTerminal = extractWorkflowTerminal(workflowRecommendation, transitionResolution);
  const recommendedAction = extractRecommendedAction(workflowRecommendation);
  const recommendedNextEvents = extractRecommendedNextEvents(workflowRecommendation);
  const monitoringRequired = extractMonitoringRequired(workflowRecommendation);
  const anomalyCount = extractAnomalyCount(workflowValidation);
  const overallHealth = resolveOverallHealth(
    currentLifecycle,
    workflowValid,
    workflowValidation,
    anomalyCount
  );
  const overallConfidence = resolveOverallConfidence(
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    workflowRecommendation,
    currentLifecycle
  );

  return deepFreeze({
    currentLifecycle,
    workflowCompleted,
    workflowValid,
    workflowCompleteness,
    workflowTerminal,
    recommendedAction,
    recommendedNextEvents: Object.freeze(recommendedNextEvents.slice()),
    monitoringRequired,
    overallConfidence,
    overallHealth,
    anomalyCount,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Build a normalized recruitment workflow advisory summary from Phases 95–98 outputs.
 * Pure: no I/O, no mutation of input, no production side effects.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowAdvisorySummary(context) {
  if (!isPlainObject(context)) {
    return deepFreeze({ ...EMPTY_WORKFLOW_ADVISORY_SUMMARY });
  }

  return buildAdvisorySummaryResult(context);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isWorkflowAdvisorySummaryResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.currentLifecycle !== "string" ||
    !SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(value.currentLifecycle)
  ) {
    return false;
  }

  if (typeof value.workflowCompleted !== "boolean") {
    return false;
  }

  if (typeof value.workflowValid !== "boolean") {
    return false;
  }

  if (
    typeof value.workflowCompleteness !== "string" ||
    !SUPPORTED_WORKFLOW_COMPLETENESS.has(value.workflowCompleteness)
  ) {
    return false;
  }

  if (typeof value.workflowTerminal !== "boolean") {
    return false;
  }

  if (
    typeof value.recommendedAction !== "string" ||
    !SUPPORTED_RECOMMENDED_ACTIONS.has(value.recommendedAction)
  ) {
    return false;
  }

  if (!Array.isArray(value.recommendedNextEvents)) {
    return false;
  }

  for (let i = 0; i < value.recommendedNextEvents.length; i += 1) {
    if (!SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(value.recommendedNextEvents[i])) {
      return false;
    }
  }

  return (
    typeof value.monitoringRequired === "boolean" &&
    typeof value.overallConfidence === "string" &&
    SUPPORTED_CONFIDENCE_LEVELS.has(value.overallConfidence) &&
    typeof value.overallHealth === "string" &&
    SUPPORTED_OVERALL_HEALTH.has(value.overallHealth) &&
    typeof value.anomalyCount === "number" &&
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateWorkflowAdvisorySummaryResult(result) {
  if (!isWorkflowAdvisorySummaryResult(result)) {
    return deepFreeze({
      valid: false,
      status: "invalid",
      reasons: Object.freeze(["INVALID_ADVISORY_SUMMARY_SHAPE"])
    });
  }

  return deepFreeze({
    valid: true,
    status: "valid",
    reasons: Object.freeze([])
  });
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeWorkflowAdvisorySummaryResult(result) {
  const validation = validateWorkflowAdvisorySummaryResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE,
      entity: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY,
      valid: false,
      overallHealth: OVERALL_HEALTH.UNKNOWN,
      overallConfidence: CONFIDENCE_LEVELS.NONE,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE,
    entity: RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY,
    valid: true,
    currentLifecycle: result.currentLifecycle,
    overallHealth: result.overallHealth,
    overallConfidence: result.overallConfidence,
    workflowValid: result.workflowValid,
    anomalyCount: result.anomalyCount,
    recommendedAction: result.recommendedAction,
    monitoringRequired: result.monitoringRequired,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RECOMMENDED_ACTIONS,
  SUPPORTED_RECOMMENDED_ACTIONS,
  WORKFLOW_COMPLETENESS,
  SUPPORTED_WORKFLOW_COMPLETENESS,
  OVERALL_HEALTH,
  SUPPORTED_OVERALL_HEALTH,
  ANOMALY_TYPES,
  CRITICAL_ANOMALY_TYPES,
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_SUMMARY_METADATA,
  EMPTY_WORKFLOW_ADVISORY_SUMMARY,
  normalizeAdvisoryLifecycleEvent,
  buildRecruitmentWorkflowAdvisorySummary,
  isWorkflowAdvisorySummaryResult,
  validateWorkflowAdvisorySummaryResult,
  summarizeWorkflowAdvisorySummaryResult
};
