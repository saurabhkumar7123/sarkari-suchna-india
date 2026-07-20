"use strict";

/**
 * Phase 96 — Recruitment Lifecycle Transition Resolution (Advisory).
 *
 * Pure library that resolves valid forward and backward lifecycle transitions
 * from the advisory lifecycle event produced by Phase 95 together with
 * workflow-available metadata. Descriptive only — no database access,
 * no state transitions, no production mutations, and no external calls.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary documented inline.
 */

const RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE = 96;

const RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY =
  "recruitment_lifecycle_transition_resolution";

/**
 * Advisory lifecycle events aligned with Phase 95 (no import).
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

const TRANSITION_REASONS = Object.freeze({
  RESOLVED_FROM_LIFECYCLE_EVENT: "RESOLVED_FROM_LIFECYCLE_EVENT",
  EXPLICIT_CURRENT_EVENT: "EXPLICIT_CURRENT_EVENT",
  TERMINAL_STATE_REACHED: "TERMINAL_STATE_REACHED",
  UNKNOWN_CURRENT_EVENT: "UNKNOWN_CURRENT_EVENT",
  PIPELINE_COMPLETION_DETECTED: "PIPELINE_COMPLETION_DETECTED",
  INVALID_INPUT: "INVALID_INPUT"
});

const SUPPORTED_TRANSITION_REASONS = Object.freeze(new Set(Object.values(TRANSITION_REASONS)));

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
 * Explicit forward transition table.
 * Single-step transitions only; optional stages may be skipped along a path.
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

const PREVIOUS_TRANSITIONS = buildPreviousTransitions(FORWARD_TRANSITIONS);

const RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA = Object.freeze({
  phase: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE,
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

const RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE,
  description:
    "Advisory recruitment lifecycle transition resolution from Phase 95 lifecycle events.",
  lifecycleEvents: ADVISORY_LIFECYCLE_EVENT_LIST,
  workflowOrder: LIFECYCLE_WORKFLOW_ORDER,
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  transitionReasons: Object.freeze(Object.values(TRANSITION_REASONS)),
  metadata: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_LIFECYCLE_TRANSITION_RESOLUTION = Object.freeze({
  currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
  nextAllowedEvents: Object.freeze([ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION]),
  previousAllowedEvents: Object.freeze([]),
  terminalState: false,
  workflowCompleted: false,
  transitionConfidence: CONFIDENCE_LEVELS.NONE,
  transitionReason: TRANSITION_REASONS.UNKNOWN_CURRENT_EVENT,
  architectureOnly: true,
  advisory: true,
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

function buildValidationResult(reasons) {
  const normalizedReasons = Array.isArray(reasons)
    ? reasons.filter((reason) => typeof reason === "string" && reason.trim() !== "")
    : [];

  let status = VALIDATION_STATUS.VALID;
  if (normalizedReasons.length > 0) {
    status =
      normalizedReasons.some((reason) => reason.startsWith("MISSING_")) ||
      normalizedReasons.some((reason) => reason.startsWith("INVALID_"))
        ? VALIDATION_STATUS.INCOMPLETE
        : VALIDATION_STATUS.INVALID;
  }

  return deepFreeze({
    valid: normalizedReasons.length === 0,
    status,
    reasons: Object.freeze(normalizedReasons.slice())
  });
}

function buildPreviousTransitions(forwardTransitions) {
  const previous = {};

  for (let i = 0; i < ADVISORY_LIFECYCLE_EVENT_LIST.length; i += 1) {
    previous[ADVISORY_LIFECYCLE_EVENT_LIST[i]] = [];
  }

  const fromKeys = Object.keys(forwardTransitions);
  for (let i = 0; i < fromKeys.length; i += 1) {
    const fromEvent = fromKeys[i];
    const targets = forwardTransitions[fromEvent];
    if (!Array.isArray(targets)) {
      continue;
    }
    for (let j = 0; j < targets.length; j += 1) {
      const toEvent = targets[j];
      if (!Array.isArray(previous[toEvent])) {
        previous[toEvent] = [];
      }
      if (!previous[toEvent].includes(fromEvent)) {
        previous[toEvent].push(fromEvent);
      }
    }
  }

  const frozenPrevious = {};
  const previousKeys = Object.keys(previous);
  for (let i = 0; i < previousKeys.length; i += 1) {
    const event = previousKeys[i];
    frozenPrevious[event] = Object.freeze(previous[event].slice());
  }

  return Object.freeze(frozenPrevious);
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

function getForwardTransitions(event) {
  const targets = FORWARD_TRANSITIONS[event];
  return Array.isArray(targets) ? targets.slice() : [];
}

function getPreviousTransitions(event) {
  const sources = PREVIOUS_TRANSITIONS[event];
  return Array.isArray(sources) ? sources.slice() : [];
}

function extractCurrentLifecycleEvent(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  const lifecycleResolution = context.lifecycleResolution;
  if (isPlainObject(lifecycleResolution)) {
    const resolved = normalizeAdvisoryLifecycleEvent(lifecycleResolution.lifecycleEvent);
    if (resolved != null) {
      return {
        event: resolved,
        confidence: normalizeConfidence(lifecycleResolution.lifecycleConfidence),
        explicit: false,
        source: "lifecycleResolution"
      };
    }
  }

  const explicit = normalizeAdvisoryLifecycleEvent(context.lifecycleEvent);
  if (explicit != null) {
    return {
      event: explicit,
      confidence: normalizeConfidence(context.lifecycleConfidence),
      explicit: true,
      source: "lifecycleEvent"
    };
  }

  const current = normalizeAdvisoryLifecycleEvent(context.currentLifecycleEvent);
  if (current != null) {
    return {
      event: current,
      confidence: normalizeConfidence(context.transitionConfidence),
      explicit: true,
      source: "currentLifecycleEvent"
    };
  }

  return null;
}

function detectPipelineCompletion(context) {
  const pipelineContext = context.pipelineContext;
  if (!isPlainObject(pipelineContext)) {
    return false;
  }

  return (
    pipelineContext.lifecycleCompleted === true ||
    pipelineContext.recruitmentCompleted === true ||
    normalizeString(pipelineContext.lifecycleStage)?.toLowerCase() === "completed"
  );
}

function resolveTransitionConfidence(currentEvent, extracted, context) {
  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return CONFIDENCE_LEVELS.NONE;
  }

  if (extracted != null && extracted.confidence != null) {
    return extracted.confidence;
  }

  if (detectPipelineCompletion(context)) {
    return CONFIDENCE_LEVELS.MEDIUM;
  }

  if (extracted != null && extracted.explicit === true) {
    return CONFIDENCE_LEVELS.HIGH;
  }

  return CONFIDENCE_LEVELS.MEDIUM;
}

function resolveTransitionReason(currentEvent, extracted, workflowCompleted) {
  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return TRANSITION_REASONS.UNKNOWN_CURRENT_EVENT;
  }

  if (workflowCompleted) {
    return TRANSITION_REASONS.TERMINAL_STATE_REACHED;
  }

  if (extracted != null && extracted.explicit === true) {
    return TRANSITION_REASONS.EXPLICIT_CURRENT_EVENT;
  }

  if (extracted != null && extracted.source === "lifecycleResolution") {
    return TRANSITION_REASONS.RESOLVED_FROM_LIFECYCLE_EVENT;
  }

  return TRANSITION_REASONS.RESOLVED_FROM_LIFECYCLE_EVENT;
}

function buildTransitionResult(currentEvent, extracted, context, options) {
  const promotedFromPipeline = options?.promotedFromPipeline === true;
  const nextAllowedEvents = getForwardTransitions(currentEvent);
  const previousAllowedEvents = getPreviousTransitions(currentEvent);
  const pipelineCompleted = detectPipelineCompletion(context);
  const terminalState = currentEvent === ADVISORY_LIFECYCLE_EVENTS.COMPLETED;
  const workflowCompleted = terminalState || pipelineCompleted;
  const transitionConfidence = resolveTransitionConfidence(currentEvent, extracted, context);
  let transitionReason;
  if (promotedFromPipeline) {
    transitionReason = TRANSITION_REASONS.PIPELINE_COMPLETION_DETECTED;
  } else if (pipelineCompleted && !terminalState) {
    transitionReason = TRANSITION_REASONS.PIPELINE_COMPLETION_DETECTED;
  } else {
    transitionReason = resolveTransitionReason(currentEvent, extracted, workflowCompleted);
  }

  return deepFreeze({
    currentLifecycleEvent: currentEvent,
    nextAllowedEvents: Object.freeze(nextAllowedEvents),
    previousAllowedEvents: Object.freeze(previousAllowedEvents),
    terminalState,
    workflowCompleted,
    transitionConfidence,
    transitionReason,
    architectureOnly: true,
    advisory: true,
    executed: false
  });
}

/**
 * Determine whether a single-step forward lifecycle transition is allowed.
 *
 * @param {string|null|undefined} fromEvent
 * @param {string|null|undefined} toEvent
 * @returns {boolean}
 */
function isValidLifecycleTransition(fromEvent, toEvent) {
  const from = normalizeAdvisoryLifecycleEvent(fromEvent);
  const to = normalizeAdvisoryLifecycleEvent(toEvent);
  if (from == null || to == null) {
    return false;
  }

  return getForwardTransitions(from).includes(to);
}

/**
 * Resolve advisory recruitment lifecycle transitions from workflow context.
 * Pure: no I/O, no mutation of input, no production side effects.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function resolveRecruitmentLifecycleTransition(context) {
  if (!isPlainObject(context)) {
    return deepFreeze({
      ...EMPTY_LIFECYCLE_TRANSITION_RESOLUTION,
      transitionReason: TRANSITION_REASONS.INVALID_INPUT
    });
  }

  const extracted = extractCurrentLifecycleEvent(context);
  const currentEvent = extracted?.event ?? ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;

  if (detectPipelineCompletion(context) && currentEvent !== ADVISORY_LIFECYCLE_EVENTS.COMPLETED) {
    return buildTransitionResult(ADVISORY_LIFECYCLE_EVENTS.COMPLETED, extracted, context, {
      promotedFromPipeline: true
    });
  }

  return buildTransitionResult(currentEvent, extracted, context);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isLifecycleTransitionResolutionResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.currentLifecycleEvent !== "string" ||
    !SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(value.currentLifecycleEvent)
  ) {
    return false;
  }

  if (!Array.isArray(value.nextAllowedEvents) || !Array.isArray(value.previousAllowedEvents)) {
    return false;
  }

  for (let i = 0; i < value.nextAllowedEvents.length; i += 1) {
    if (!SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(value.nextAllowedEvents[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.previousAllowedEvents.length; i += 1) {
    if (!SUPPORTED_ADVISORY_LIFECYCLE_EVENTS.has(value.previousAllowedEvents[i])) {
      return false;
    }
  }

  return (
    typeof value.terminalState === "boolean" &&
    typeof value.workflowCompleted === "boolean" &&
    typeof value.transitionConfidence === "string" &&
    SUPPORTED_CONFIDENCE_LEVELS.has(value.transitionConfidence) &&
    typeof value.transitionReason === "string" &&
    SUPPORTED_TRANSITION_REASONS.has(value.transitionReason) &&
    value.architectureOnly === true &&
    value.advisory === true &&
    value.executed === false
  );
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateLifecycleTransitionResolutionResult(result) {
  if (!isLifecycleTransitionResolutionResult(result)) {
    return buildValidationResult(["INVALID_TRANSITION_SHAPE"]);
  }

  return buildValidationResult([]);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeLifecycleTransitionResolutionResult(result) {
  const validation = validateLifecycleTransitionResolutionResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE,
      entity: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY,
      valid: false,
      currentLifecycleEvent: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN,
      transitionConfidence: CONFIDENCE_LEVELS.NONE,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE,
    entity: RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY,
    valid: true,
    currentLifecycleEvent: result.currentLifecycleEvent,
    nextAllowedCount: result.nextAllowedEvents.length,
    previousAllowedCount: result.previousAllowedEvents.length,
    terminalState: result.terminalState,
    workflowCompleted: result.workflowCompleted,
    transitionConfidence: result.transitionConfidence,
    transitionReason: result.transitionReason,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_PHASE,
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLUTION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  TRANSITION_REASONS,
  SUPPORTED_TRANSITION_REASONS,
  LIFECYCLE_WORKFLOW_ORDER,
  FORWARD_TRANSITIONS,
  PREVIOUS_TRANSITIONS,
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_TRANSITION_RESOLVER_METADATA,
  VALIDATION_STATUS,
  EMPTY_LIFECYCLE_TRANSITION_RESOLUTION,
  normalizeAdvisoryLifecycleEvent,
  isValidLifecycleTransition,
  resolveRecruitmentLifecycleTransition,
  isLifecycleTransitionResolutionResult,
  validateLifecycleTransitionResolutionResult,
  summarizeLifecycleTransitionResolutionResult
};
