"use strict";

/**
 * Phase 81 — Recruitment Lifecycle State Evaluator (Read-only).
 *
 * Pure library that evaluates a descriptive suggested lifecycle state from a
 * Phase 79 recruitment timeline projection and Phase 80 lifecycle state
 * vocabulary. Descriptive only — not a state machine and performs no transitions.
 *
 * Performs no database access, no state transitions, and no business enforcement.
 * Accepts plain JavaScript objects and works entirely in memory.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — shapes documented inline.
 */

const RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE = 81;

const RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY =
  "recruitment_lifecycle_state_evaluation";

/**
 * Common recruitment lifecycle event types (Phase 79 vocabulary, inline).
 */
const COMMON_LIFECYCLE_EVENT_TYPES = Object.freeze([
  "short_notification",
  "notification",
  "application_start",
  "application_end",
  "correction",
  "admit_card",
  "exam",
  "answer_key",
  "result",
  "final_result",
  "joining"
]);

const SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES = Object.freeze(
  new Set(COMMON_LIFECYCLE_EVENT_TYPES)
);

/**
 * Lifecycle state vocabulary (Phase 80 registry, inline).
 */
const LIFECYCLE_STATE_ORDERS = Object.freeze({
  DISCOVERED: 10,
  NOTIFICATION_AVAILABLE: 20,
  APPLICATION_OPEN: 30,
  APPLICATION_CLOSED: 40,
  CORRECTION_WINDOW: 50,
  EXAM_STAGE: 60,
  ANSWER_KEY_STAGE: 70,
  RESULT_STAGE: 80,
  FINAL_RESULT_STAGE: 90,
  JOINING_STAGE: 100,
  COMPLETED: 110
});

const SUPPORTED_LIFECYCLE_STATES = Object.freeze(
  new Set(Object.keys(LIFECYCLE_STATE_ORDERS))
);

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const LIFECYCLE_STATE_EVALUATION_RULE_IDS = Object.freeze({
  NO_TIMELINE_EVENTS: "NO_TIMELINE_EVENTS",
  NOTIFICATION_AVAILABLE: "NOTIFICATION_AVAILABLE",
  APPLICATION_OPEN: "APPLICATION_OPEN",
  CORRECTION_WINDOW: "CORRECTION_WINDOW",
  EXAM_STAGE: "EXAM_STAGE",
  ANSWER_KEY_STAGE: "ANSWER_KEY_STAGE",
  RESULT_STAGE: "RESULT_STAGE",
  FINAL_RESULT_STAGE: "FINAL_RESULT_STAGE",
  JOINING_STAGE: "JOINING_STAGE",
  COMPLETED: "COMPLETED"
});

const LIFECYCLE_STATE_EVALUATION_RULES = Object.freeze([
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.NO_TIMELINE_EVENTS,
    suggestedState: "DISCOVERED",
    order: LIFECYCLE_STATE_ORDERS.DISCOVERED,
    description: "No timeline events are present on the projection."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.NOTIFICATION_AVAILABLE,
    suggestedState: "NOTIFICATION_AVAILABLE",
    order: LIFECYCLE_STATE_ORDERS.NOTIFICATION_AVAILABLE,
    description:
      "Notification or short notification event type is present on the timeline."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.APPLICATION_OPEN,
    suggestedState: "APPLICATION_OPEN",
    order: LIFECYCLE_STATE_ORDERS.APPLICATION_OPEN,
    description:
      "Application start is present while application end is not yet observed."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.CORRECTION_WINDOW,
    suggestedState: "CORRECTION_WINDOW",
    order: LIFECYCLE_STATE_ORDERS.CORRECTION_WINDOW,
    description: "Application end and correction event types are both present."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.EXAM_STAGE,
    suggestedState: "EXAM_STAGE",
    order: LIFECYCLE_STATE_ORDERS.EXAM_STAGE,
    description: "Admit card or exam event type is present on the timeline."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.ANSWER_KEY_STAGE,
    suggestedState: "ANSWER_KEY_STAGE",
    order: LIFECYCLE_STATE_ORDERS.ANSWER_KEY_STAGE,
    description: "Answer key event type is present on the timeline."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.RESULT_STAGE,
    suggestedState: "RESULT_STAGE",
    order: LIFECYCLE_STATE_ORDERS.RESULT_STAGE,
    description: "Result is present while final result is not yet observed."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.FINAL_RESULT_STAGE,
    suggestedState: "FINAL_RESULT_STAGE",
    order: LIFECYCLE_STATE_ORDERS.FINAL_RESULT_STAGE,
    description: "Final result is present while joining is not yet observed."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.JOINING_STAGE,
    suggestedState: "JOINING_STAGE",
    order: LIFECYCLE_STATE_ORDERS.JOINING_STAGE,
    description: "Joining event type is present on the timeline."
  }),
  Object.freeze({
    id: LIFECYCLE_STATE_EVALUATION_RULE_IDS.COMPLETED,
    suggestedState: "COMPLETED",
    order: LIFECYCLE_STATE_ORDERS.COMPLETED,
    description:
      "Joining is present together with lifecycle completion indicators on the projection."
  })
]);

const RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA = Object.freeze({
  phase: RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsStateTransitions: false,
  infersStateFromEvents: true,
  ruleCount: LIFECYCLE_STATE_EVALUATION_RULES.length
});

const RECRUITMENT_LIFECYCLE_STATE_EVALUATION_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
  description:
    "Deterministic descriptive lifecycle state evaluation from a recruitment timeline projection.",
  rules: LIFECYCLE_STATE_EVALUATION_RULES,
  metadata: RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA
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

const EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION = deepFreeze({
  recruitmentId: null,
  suggestedState: null,
  matchedRules: Object.freeze([]),
  evaluatedEventTypes: Object.freeze([]),
  confidence: CONFIDENCE_LEVELS.UNKNOWN,
  evaluationMetadata: deepFreeze({
    phase: RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
    valid: false,
    descriptiveOnly: true,
    readOnly: true,
    performsStateTransitions: false,
    matchedRuleCount: 0,
    unknownEventTypes: Object.freeze([]),
    invalidInput: true
  })
});

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isCommonLifecycleEventType(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES.has(normalized);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isValidLifecycleState(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_LIFECYCLE_STATES.has(normalized);
}

/**
 * Inline Phase 79 recruitment timeline projection shape check.
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentTimelineProjection(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !("recruitmentId" in value) ||
    !Array.isArray(value.timelineEvents) ||
    !Array.isArray(value.availableEventTypes) ||
    !Array.isArray(value.missingCommonEvents) ||
    typeof value.totalTimelineEvents !== "number" ||
    !("firstTimelineEvent" in value) ||
    !("latestTimelineEvent" in value)
  ) {
    return false;
  }

  if (value.totalTimelineEvents !== value.timelineEvents.length) {
    return false;
  }

  if (value.totalTimelineEvents === 0) {
    return (
      value.recruitmentId == null &&
      value.firstTimelineEvent == null &&
      value.latestTimelineEvent == null &&
      value.availableEventTypes.length === 0 &&
      value.missingCommonEvents.length === COMMON_LIFECYCLE_EVENT_TYPES.length
    );
  }

  if (value.firstTimelineEvent !== value.timelineEvents[0]) {
    return false;
  }

  if (value.latestTimelineEvent !== value.timelineEvents[value.totalTimelineEvents - 1]) {
    return false;
  }

  for (let i = 0; i < value.timelineEvents.length; i += 1) {
    const entry = value.timelineEvents[i];
    if (!isPlainObject(entry)) {
      return false;
    }
    if (
      !("eventType" in entry) ||
      typeof entry.eventOrder !== "number" ||
      !("sourceEvent" in entry) ||
      typeof entry.position !== "number"
    ) {
      return false;
    }
    if (entry.position !== i) {
      return false;
    }
    if (entry.eventOrder !== i + 1) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Object} projection
 * @param {string} eventType
 * @returns {boolean}
 */
function hasTimelineEventType(projection, eventType) {
  if (!isRecruitmentTimelineProjection(projection)) {
    return false;
  }
  const normalized = normalizeString(eventType);
  if (normalized == null) {
    return false;
  }
  return projection.availableEventTypes.includes(normalized);
}

/**
 * Completion indicators: all common lifecycle event types are represented.
 * @param {Object} projection
 * @returns {boolean}
 */
function hasLifecycleCompletionIndicators(projection) {
  if (!isRecruitmentTimelineProjection(projection)) {
    return false;
  }
  return projection.missingCommonEvents.length === 0;
}

function collectUnknownEventTypes(projection) {
  const unknown = [];
  const seen = new Set();

  for (let i = 0; i < projection.timelineEvents.length; i += 1) {
    const eventType = projection.timelineEvents[i].eventType;
    if (eventType == null) {
      if (!seen.has("__missing_event_type__")) {
        seen.add("__missing_event_type__");
        unknown.push(null);
      }
      continue;
    }
    if (!isCommonLifecycleEventType(eventType) && !seen.has(eventType)) {
      seen.add(eventType);
      unknown.push(eventType);
    }
  }

  return unknown;
}

function buildLifecycleStateOrderMap(lifecycleStateDescriptors) {
  if (!Array.isArray(lifecycleStateDescriptors) || lifecycleStateDescriptors.length === 0) {
    return LIFECYCLE_STATE_ORDERS;
  }

  const orderMap = {};
  for (let i = 0; i < lifecycleStateDescriptors.length; i += 1) {
    const descriptor = lifecycleStateDescriptors[i];
    if (!isPlainObject(descriptor)) {
      continue;
    }
    const state = normalizeString(descriptor.state);
    if (
      state != null &&
      typeof descriptor.order === "number" &&
      Number.isFinite(descriptor.order)
    ) {
      orderMap[state] = descriptor.order;
    }
  }

  return Object.keys(orderMap).length > 0 ? Object.freeze(orderMap) : LIFECYCLE_STATE_ORDERS;
}

function ruleMatches(ruleId, projection) {
  switch (ruleId) {
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.NO_TIMELINE_EVENTS:
      return projection.totalTimelineEvents === 0;
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.NOTIFICATION_AVAILABLE:
      return (
        hasTimelineEventType(projection, "notification") ||
        hasTimelineEventType(projection, "short_notification")
      );
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.APPLICATION_OPEN:
      return (
        hasTimelineEventType(projection, "application_start") &&
        !hasTimelineEventType(projection, "application_end")
      );
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.CORRECTION_WINDOW:
      return (
        hasTimelineEventType(projection, "application_end") &&
        hasTimelineEventType(projection, "correction")
      );
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.EXAM_STAGE:
      return (
        hasTimelineEventType(projection, "admit_card") ||
        hasTimelineEventType(projection, "exam")
      );
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.ANSWER_KEY_STAGE:
      return hasTimelineEventType(projection, "answer_key");
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.RESULT_STAGE:
      return (
        hasTimelineEventType(projection, "result") &&
        !hasTimelineEventType(projection, "final_result")
      );
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.FINAL_RESULT_STAGE:
      return (
        hasTimelineEventType(projection, "final_result") &&
        !hasTimelineEventType(projection, "joining")
      );
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.JOINING_STAGE:
      return hasTimelineEventType(projection, "joining");
    case LIFECYCLE_STATE_EVALUATION_RULE_IDS.COMPLETED:
      return (
        hasTimelineEventType(projection, "joining") &&
        hasLifecycleCompletionIndicators(projection)
      );
    default:
      return false;
  }
}

function collectMatchedRules(projection) {
  const matched = [];

  for (let i = 0; i < LIFECYCLE_STATE_EVALUATION_RULES.length; i += 1) {
    const rule = LIFECYCLE_STATE_EVALUATION_RULES[i];
    if (ruleMatches(rule.id, projection)) {
      matched.push(
        deepFreeze({
          id: rule.id,
          suggestedState: rule.suggestedState,
          order: rule.order,
          description: rule.description
        })
      );
    }
  }

  return matched;
}

function selectSuggestedState(matchedRules, stateOrderMap) {
  if (matchedRules.length === 0) {
    return "DISCOVERED";
  }

  let selected = matchedRules[0];
  for (let i = 1; i < matchedRules.length; i += 1) {
    const candidate = matchedRules[i];
    const selectedOrder = stateOrderMap[selected.suggestedState] ?? selected.order;
    const candidateOrder = stateOrderMap[candidate.suggestedState] ?? candidate.order;
    if (candidateOrder > selectedOrder) {
      selected = candidate;
    }
  }

  return selected.suggestedState;
}

function determineConfidence(matchedRules, unknownEventTypes, invalidInput) {
  if (invalidInput) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  if (unknownEventTypes.length > 0) {
    return CONFIDENCE_LEVELS.MEDIUM;
  }

  if (matchedRules.length === 0) {
    return CONFIDENCE_LEVELS.LOW;
  }

  if (matchedRules.length === 1) {
    return CONFIDENCE_LEVELS.HIGH;
  }

  return CONFIDENCE_LEVELS.MEDIUM;
}

function unwrapEvaluationInput(input) {
  if (
    isPlainObject(input) &&
    ("timelineProjection" in input || "lifecycleStateDescriptors" in input)
  ) {
    return {
      timelineProjection: input.timelineProjection,
      lifecycleStateDescriptors: input.lifecycleStateDescriptors ?? null
    };
  }

  return {
    timelineProjection: input,
    lifecycleStateDescriptors: null
  };
}

/**
 * Evaluate a descriptive suggested lifecycle state from a timeline projection.
 * Pure: no I/O, no mutation of input, no state transitions.
 *
 * @param {Object|null|undefined} timelineProjection
 * @returns {Readonly<Object>}
 */
function evaluateRecruitmentLifecycleState(timelineProjection) {
  const { timelineProjection: projection, lifecycleStateDescriptors } =
    unwrapEvaluationInput(timelineProjection);

  if (!isRecruitmentTimelineProjection(projection)) {
    return EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION;
  }

  const stateOrderMap = buildLifecycleStateOrderMap(lifecycleStateDescriptors);
  const matchedRules = collectMatchedRules(projection);
  const suggestedState = selectSuggestedState(matchedRules, stateOrderMap);
  const evaluatedEventTypes = Object.freeze(projection.availableEventTypes.slice());
  const unknownEventTypes = Object.freeze(collectUnknownEventTypes(projection));
  const confidence = determineConfidence(matchedRules, unknownEventTypes, false);

  return deepFreeze({
    recruitmentId: projection.recruitmentId,
    suggestedState,
    matchedRules: Object.freeze(matchedRules.slice()),
    evaluatedEventTypes,
    confidence,
    evaluationMetadata: deepFreeze({
      phase: RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
      valid: true,
      descriptiveOnly: true,
      readOnly: true,
      performsStateTransitions: false,
      matchedRuleCount: matchedRules.length,
      unknownEventTypes,
      invalidInput: false,
      hasCompletionIndicators: hasLifecycleCompletionIndicators(projection),
      totalTimelineEvents: projection.totalTimelineEvents,
      missingCommonEventCount: projection.missingCommonEvents.length
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentLifecycleStateEvaluation(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !("recruitmentId" in value) ||
    !("suggestedState" in value) ||
    !Array.isArray(value.matchedRules) ||
    !Array.isArray(value.evaluatedEventTypes) ||
    !("confidence" in value) ||
    !isPlainObject(value.evaluationMetadata)
  ) {
    return false;
  }

  if (
    value.suggestedState != null &&
    !isValidLifecycleState(value.suggestedState)
  ) {
    return false;
  }

  for (let i = 0; i < value.matchedRules.length; i += 1) {
    const rule = value.matchedRules[i];
    if (!isPlainObject(rule)) {
      return false;
    }
    if (
      typeof rule.id !== "string" ||
      typeof rule.suggestedState !== "string" ||
      typeof rule.order !== "number" ||
      typeof rule.description !== "string"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Object|null|undefined} evaluation
 * @returns {Readonly<{ valid: boolean, reasons: string[] }>}
 */
function validateRecruitmentLifecycleStateEvaluation(evaluation) {
  const reasons = [];

  if (!isRecruitmentLifecycleStateEvaluation(evaluation)) {
    return deepFreeze({
      valid: false,
      reasons: Object.freeze(["INVALID_EVALUATION_SHAPE"])
    });
  }

  if (
    evaluation.evaluationMetadata.valid === true &&
    evaluation.suggestedState == null
  ) {
    reasons.push("MISSING_SUGGESTED_STATE");
  }

  if (evaluation.evaluationMetadata.matchedRuleCount !== evaluation.matchedRules.length) {
    reasons.push("INVALID_MATCHED_RULE_COUNT");
  }

  return deepFreeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons.slice())
  });
}

/**
 * @param {Object|null|undefined} evaluation
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentLifecycleStateEvaluation(evaluation) {
  const validation = validateRecruitmentLifecycleStateEvaluation(evaluation);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
      entity: RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY,
      valid: false,
      suggestedState: null,
      confidence: CONFIDENCE_LEVELS.UNKNOWN,
      matchedRuleCount: 0,
      descriptiveOnly: true,
      readOnly: true,
      performsStateTransitions: false
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
    entity: RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY,
    valid: true,
    recruitmentId: evaluation.recruitmentId,
    suggestedState: evaluation.suggestedState,
    confidence: evaluation.confidence,
    matchedRuleCount: evaluation.matchedRules.length,
    evaluatedEventTypeCount: evaluation.evaluatedEventTypes.length,
    unknownEventTypeCount: evaluation.evaluationMetadata.unknownEventTypes.length,
    descriptiveOnly: true,
    readOnly: true,
    performsStateTransitions: false
  });
}

module.exports = {
  RECRUITMENT_LIFECYCLE_STATE_EVALUATOR_PHASE,
  RECRUITMENT_LIFECYCLE_STATE_EVALUATION_ENTITY,
  COMMON_LIFECYCLE_EVENT_TYPES,
  SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES,
  LIFECYCLE_STATE_ORDERS,
  SUPPORTED_LIFECYCLE_STATES,
  CONFIDENCE_LEVELS,
  LIFECYCLE_STATE_EVALUATION_RULE_IDS,
  LIFECYCLE_STATE_EVALUATION_RULES,
  RECRUITMENT_LIFECYCLE_STATE_EVALUATION_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_STATE_EVALUATION_METADATA,
  EMPTY_RECRUITMENT_LIFECYCLE_STATE_EVALUATION,
  isCommonLifecycleEventType,
  isValidLifecycleState,
  isRecruitmentTimelineProjection,
  hasTimelineEventType,
  hasLifecycleCompletionIndicators,
  evaluateRecruitmentLifecycleState,
  isRecruitmentLifecycleStateEvaluation,
  validateRecruitmentLifecycleStateEvaluation,
  summarizeRecruitmentLifecycleStateEvaluation
};
