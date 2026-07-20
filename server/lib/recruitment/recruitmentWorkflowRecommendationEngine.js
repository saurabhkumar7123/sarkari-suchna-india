"use strict";

/**
 * Phase 98 — Recruitment Workflow Recommendation Engine (Advisory).
 *
 * Pure library that suggests the next business workflow action based on
 * advisory lifecycle resolution, transition resolution, and workflow
 * validation outputs from Phases 95–97 together with workflow-available
 * metadata. Descriptive only — no database access, no state transitions,
 * no production mutations, and no external calls.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary documented inline.
 */

const RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE = 98;

const RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY = "recruitment_workflow_recommendation";

/**
 * Advisory lifecycle events aligned with Phases 95–97 (no import).
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

const RECOMMENDATION_REASONS = Object.freeze({
  MONITOR_NEXT_LIFECYCLE_EVENTS: "MONITOR_NEXT_LIFECYCLE_EVENTS",
  WORKFLOW_TERMINAL_REACHED: "WORKFLOW_TERMINAL_REACHED",
  UNKNOWN_WORKFLOW_STATE: "UNKNOWN_WORKFLOW_STATE",
  ANOMALIES_ELEVATE_PRIORITY: "ANOMALIES_ELEVATE_PRIORITY",
  INVALID_INPUT: "INVALID_INPUT"
});

const SUPPORTED_RECOMMENDATION_REASONS = Object.freeze(
  new Set(Object.values(RECOMMENDATION_REASONS))
);

const RECOMMENDATION_PRIORITY = Object.freeze({
  NONE: 0,
  NORMAL: 1,
  ELEVATED: 2,
  URGENT: 3
});

const SUPPORTED_RECOMMENDATION_PRIORITIES = Object.freeze(
  new Set(Object.values(RECOMMENDATION_PRIORITY))
);

/**
 * Canonical recruitment workflow order (advisory).
 */
const LIFECYCLE_WORKFLOW_ORDER = Object.freeze([
  ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
  ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
  ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION,
  ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
  ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
  ADVISORY_LIFECYCLE_EVENTS.RESULT,
  ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT,
  ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
  ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  ADVISORY_LIFECYCLE_EVENTS.JOINING,
  ADVISORY_LIFECYCLE_EVENTS.COMPLETED
]);

/**
 * Explicit forward transition table (Phase 96 vocabulary, inline).
 */
const FORWARD_TRANSITIONS = Object.freeze({
  [ADVISORY_LIFECYCLE_EVENTS.UNKNOWN]: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION]),
  [ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION]: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.APPLICATION]),
  [ADVISORY_LIFECYCLE_EVENTS.APPLICATION]: Object.freeze([
    ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION,
    ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
    ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
  ]),
  [ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION]: Object.freeze([
    ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
    ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD
  ]),
  [ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY]: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD]),
  [ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD]: Object.freeze([
    ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
    ADVISORY_LIFECYCLE_EVENTS.RESULT
  ]),
  [ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY]: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.RESULT]),
  [ADVISORY_LIFECYCLE_EVENTS.RESULT]: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT]),
  [ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT]: Object.freeze([
    ADVISORY_LIFECYCLE_EVENTS.COUNSELLING
  ]),
  [ADVISORY_LIFECYCLE_EVENTS.COUNSELLING]: Object.freeze([
    ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION
  ]),
  [ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION]: Object.freeze([
    ADVISORY_LIFECYCLE_EVENTS.JOINING
  ]),
  [ADVISORY_LIFECYCLE_EVENTS.JOINING]: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.COMPLETED]),
  [ADVISORY_LIFECYCLE_EVENTS.COMPLETED]: Object.freeze([])
});

const RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE,
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

const RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE,
  description:
    "Advisory recruitment workflow recommendation engine from Phases 95–97 outputs.",
  lifecycleEvents: ADVISORY_LIFECYCLE_EVENT_LIST,
  workflowOrder: LIFECYCLE_WORKFLOW_ORDER,
  recommendedActions: Object.freeze(Object.values(RECOMMENDED_ACTIONS)),
  recommendationReasons: Object.freeze(Object.values(RECOMMENDATION_REASONS)),
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  metadata: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA
});

const EMPTY_WORKFLOW_RECOMMENDATION = Object.freeze({
  recommendedAction: RECOMMENDED_ACTIONS.MANUAL_REVIEW,
  recommendedNextEvents: Object.freeze([]),
  recommendationPriority: RECOMMENDATION_PRIORITY.ELEVATED,
  recommendationConfidence: CONFIDENCE_LEVELS.NONE,
  recommendationReason: RECOMMENDATION_REASONS.INVALID_INPUT,
  monitoringRequired: false,
  workflowTerminal: false,
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

  if (isPlainObject(context.workflowValidation)) {
    return context.workflowValidation;
  }

  return null;
}

function extractCurrentLifecycleEvent(context, lifecycleResolution, transitionResolution) {
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

  if (!isPlainObject(context)) {
    return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
  }

  const explicit = normalizeAdvisoryLifecycleEvent(context.lifecycleEvent);
  if (explicit != null) {
    return explicit;
  }

  return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
}

function getForwardTransitions(event) {
  const targets = FORWARD_TRANSITIONS[event];
  return Array.isArray(targets) ? targets.slice() : [];
}

function resolveRecommendedNextEvents(currentEvent, transitionResolution) {
  if (isPlainObject(transitionResolution) && Array.isArray(transitionResolution.nextAllowedEvents)) {
    const nextEvents = [];
    for (let i = 0; i < transitionResolution.nextAllowedEvents.length; i += 1) {
      const event = normalizeAdvisoryLifecycleEvent(transitionResolution.nextAllowedEvents[i]);
      if (event != null) {
        nextEvents.push(event);
      }
    }
    return nextEvents;
  }

  return getForwardTransitions(currentEvent);
}

function isWorkflowTerminal(transitionResolution) {
  if (!isPlainObject(transitionResolution)) {
    return false;
  }
  return transitionResolution.workflowCompleted === true;
}

function countAnomalies(workflowValidation) {
  if (!isPlainObject(workflowValidation)) {
    return 0;
  }
  return Array.isArray(workflowValidation.detectedAnomalies)
    ? workflowValidation.detectedAnomalies.length
    : 0;
}

function resolveRecommendationPriority(currentEvent, anomalyCount, workflowTerminal) {
  if (workflowTerminal || currentEvent === ADVISORY_LIFECYCLE_EVENTS.COMPLETED) {
    return RECOMMENDATION_PRIORITY.NONE;
  }

  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    let priority = RECOMMENDATION_PRIORITY.ELEVATED;
    if (anomalyCount > 0) {
      priority = Math.min(
        RECOMMENDATION_PRIORITY.URGENT,
        priority + anomalyCount
      );
    }
    return priority;
  }

  let priority = RECOMMENDATION_PRIORITY.NORMAL;
  if (anomalyCount > 0) {
    priority = Math.min(RECOMMENDATION_PRIORITY.URGENT, priority + anomalyCount);
  }

  return priority;
}

function resolveRecommendationConfidence(
  lifecycleResolution,
  transitionResolution,
  workflowValidation,
  currentEvent
) {
  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return CONFIDENCE_LEVELS.NONE;
  }

  const lifecycleConfidence = lifecycleResolution?.lifecycleConfidence ?? null;
  const transitionConfidence = transitionResolution?.transitionConfidence ?? null;
  const validationConfidence = workflowValidation?.validationConfidence ?? null;

  return minConfidence(lifecycleConfidence, transitionConfidence, validationConfidence);
}

function resolveRecommendedAction(currentEvent, recommendedNextEvents, workflowTerminal) {
  if (workflowTerminal || currentEvent === ADVISORY_LIFECYCLE_EVENTS.COMPLETED) {
    return RECOMMENDED_ACTIONS.NO_MONITORING;
  }

  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return RECOMMENDED_ACTIONS.MANUAL_REVIEW;
  }

  if (recommendedNextEvents.length > 0) {
    return RECOMMENDED_ACTIONS.MONITOR;
  }

  return RECOMMENDED_ACTIONS.MANUAL_REVIEW;
}

function resolveRecommendationReason(
  currentEvent,
  recommendedAction,
  anomalyCount,
  workflowTerminal
) {
  if (workflowTerminal || currentEvent === ADVISORY_LIFECYCLE_EVENTS.COMPLETED) {
    return RECOMMENDATION_REASONS.WORKFLOW_TERMINAL_REACHED;
  }

  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return RECOMMENDATION_REASONS.UNKNOWN_WORKFLOW_STATE;
  }

  if (anomalyCount > 0) {
    return RECOMMENDATION_REASONS.ANOMALIES_ELEVATE_PRIORITY;
  }

  if (recommendedAction === RECOMMENDED_ACTIONS.MONITOR) {
    return RECOMMENDATION_REASONS.MONITOR_NEXT_LIFECYCLE_EVENTS;
  }

  return RECOMMENDATION_REASONS.UNKNOWN_WORKFLOW_STATE;
}

function buildRecommendationResult(context) {
  const lifecycleResolution = extractLifecycleResolution(context);
  const transitionResolution = extractTransitionResolution(context);
  const workflowValidation = extractWorkflowValidation(context);
  const currentEvent = extractCurrentLifecycleEvent(
    context,
    lifecycleResolution,
    transitionResolution
  );
  const recommendedNextEvents = resolveRecommendedNextEvents(currentEvent, transitionResolution);
  const workflowTerminal = isWorkflowTerminal(transitionResolution);
  const anomalyCount = countAnomalies(workflowValidation);
  const recommendedAction = resolveRecommendedAction(
    currentEvent,
    recommendedNextEvents,
    workflowTerminal
  );
  const recommendationPriority = resolveRecommendationPriority(
    currentEvent,
    anomalyCount,
    workflowTerminal
  );
  const recommendationConfidence = resolveRecommendationConfidence(
    lifecycleResolution,
    transitionResolution,
    workflowValidation,
    currentEvent
  );
  const recommendationReason = resolveRecommendationReason(
    currentEvent,
    recommendedAction,
    anomalyCount,
    workflowTerminal
  );
  const monitoringRequired =
    recommendedAction === RECOMMENDED_ACTIONS.MONITOR && recommendedNextEvents.length > 0;

  return deepFreeze({
    recommendedAction,
    recommendedNextEvents: Object.freeze(recommendedNextEvents.slice()),
    recommendationPriority,
    recommendationConfidence,
    recommendationReason,
    monitoringRequired,
    workflowTerminal,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Recommend the next advisory recruitment workflow action from Phases 95–97 outputs.
 * Pure: no I/O, no mutation of input, no production side effects.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function recommendRecruitmentWorkflowAction(context) {
  if (!isPlainObject(context)) {
    return deepFreeze({
      ...EMPTY_WORKFLOW_RECOMMENDATION,
      recommendationReason: RECOMMENDATION_REASONS.INVALID_INPUT
    });
  }

  return buildRecommendationResult(context);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isWorkflowRecommendationResult(value) {
  if (!isPlainObject(value)) {
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
    typeof value.recommendationPriority === "number" &&
    SUPPORTED_RECOMMENDATION_PRIORITIES.has(value.recommendationPriority) &&
    typeof value.recommendationConfidence === "string" &&
    SUPPORTED_CONFIDENCE_LEVELS.has(value.recommendationConfidence) &&
    typeof value.recommendationReason === "string" &&
    SUPPORTED_RECOMMENDATION_REASONS.has(value.recommendationReason) &&
    typeof value.monitoringRequired === "boolean" &&
    typeof value.workflowTerminal === "boolean" &&
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateWorkflowRecommendationResult(result) {
  if (!isWorkflowRecommendationResult(result)) {
    return deepFreeze({
      valid: false,
      status: "invalid",
      reasons: Object.freeze(["INVALID_RECOMMENDATION_SHAPE"])
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
function summarizeWorkflowRecommendationResult(result) {
  const validation = validateWorkflowRecommendationResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE,
      entity: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY,
      valid: false,
      recommendedAction: RECOMMENDED_ACTIONS.MANUAL_REVIEW,
      recommendationConfidence: CONFIDENCE_LEVELS.NONE,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE,
    entity: RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY,
    valid: true,
    recommendedAction: result.recommendedAction,
    recommendedNextEventCount: result.recommendedNextEvents.length,
    recommendationPriority: result.recommendationPriority,
    recommendationConfidence: result.recommendationConfidence,
    recommendationReason: result.recommendationReason,
    monitoringRequired: result.monitoringRequired,
    workflowTerminal: result.workflowTerminal,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_PHASE,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  RECOMMENDED_ACTIONS,
  SUPPORTED_RECOMMENDED_ACTIONS,
  RECOMMENDATION_REASONS,
  SUPPORTED_RECOMMENDATION_REASONS,
  RECOMMENDATION_PRIORITY,
  SUPPORTED_RECOMMENDATION_PRIORITIES,
  LIFECYCLE_WORKFLOW_ORDER,
  FORWARD_TRANSITIONS,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_ENGINE_METADATA,
  EMPTY_WORKFLOW_RECOMMENDATION,
  normalizeAdvisoryLifecycleEvent,
  recommendRecruitmentWorkflowAction,
  isWorkflowRecommendationResult,
  validateWorkflowRecommendationResult,
  summarizeWorkflowRecommendationResult
};
