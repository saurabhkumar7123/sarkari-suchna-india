"use strict";

/**
 * Phase 97 — Recruitment Workflow Validation & Anomaly Detection (Advisory).
 *
 * Pure library that validates recruitment workflow consistency using advisory
 * lifecycle and transition resolution outputs from Phases 95–96 together with
 * workflow-available metadata. Descriptive only — no database access,
 * no state transitions, no production mutations, and no external calls.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary documented inline.
 */

const RECRUITMENT_WORKFLOW_VALIDATOR_PHASE = 97;

const RECRUITMENT_WORKFLOW_VALIDATION_ENTITY = "recruitment_workflow_validation";

/**
 * Advisory lifecycle events aligned with Phases 95–96 (no import).
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

const VALIDATION_REASONS = Object.freeze({
  WORKFLOW_CONSISTENT: "WORKFLOW_CONSISTENT",
  ANOMALIES_DETECTED: "ANOMALIES_DETECTED",
  INCOMPLETE_WORKFLOW: "INCOMPLETE_WORKFLOW",
  UNKNOWN_WORKFLOW_STATE: "UNKNOWN_WORKFLOW_STATE",
  INVALID_INPUT: "INVALID_INPUT"
});

const SUPPORTED_VALIDATION_REASONS = Object.freeze(new Set(Object.values(VALIDATION_REASONS)));

const ANOMALY_TYPES = Object.freeze({
  INVALID_LIFECYCLE_TRANSITION: "INVALID_LIFECYCLE_TRANSITION",
  TERMINAL_STATE_VIOLATION: "TERMINAL_STATE_VIOLATION",
  DUPLICATE_LIFECYCLE_EVENT: "DUPLICATE_LIFECYCLE_EVENT",
  MISSING_EXPECTED_LIFECYCLE_EVENT: "MISSING_EXPECTED_LIFECYCLE_EVENT",
  WORKFLOW_COMPLETED_LATER_EVENT: "WORKFLOW_COMPLETED_LATER_EVENT",
  UNKNOWN_LIFECYCLE_STATE: "UNKNOWN_LIFECYCLE_STATE"
});

const SUPPORTED_ANOMALY_TYPES = Object.freeze(new Set(Object.values(ANOMALY_TYPES)));

const WORKFLOW_COMPLETENESS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  PARTIAL: "PARTIAL",
  COMPLETE: "COMPLETE"
});

const SUPPORTED_WORKFLOW_COMPLETENESS = Object.freeze(
  new Set(Object.values(WORKFLOW_COMPLETENESS))
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

const LIFECYCLE_ORDER_INDEX = Object.freeze(
  LIFECYCLE_WORKFLOW_ORDER.reduce((acc, event, index) => {
    acc[event] = index;
    return acc;
  }, {})
);

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

const DOMAIN_EVENT_TYPE_MAP = Object.freeze({
  notification: ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
  short_notification: ADVISORY_LIFECYCLE_EVENTS.NOTIFICATION,
  application: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  application_start: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  application_end: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  application_window: ADVISORY_LIFECYCLE_EVENTS.APPLICATION,
  correction: ADVISORY_LIFECYCLE_EVENTS.APPLICATION_CORRECTION,
  city_intimation: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  exam_date: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  exam_city: ADVISORY_LIFECYCLE_EVENTS.EXAM_CITY,
  admit_card: ADVISORY_LIFECYCLE_EVENTS.ADMIT_CARD,
  answer_key: ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
  objection: ADVISORY_LIFECYCLE_EVENTS.ANSWER_KEY,
  result: ADVISORY_LIFECYCLE_EVENTS.RESULT,
  final_result: ADVISORY_LIFECYCLE_EVENTS.FINAL_RESULT,
  counselling: ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
  counseling: ADVISORY_LIFECYCLE_EVENTS.COUNSELLING,
  dv: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  document_verification: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  medical: ADVISORY_LIFECYCLE_EVENTS.DOCUMENT_VERIFICATION,
  joining: ADVISORY_LIFECYCLE_EVENTS.JOINING,
  completed: ADVISORY_LIFECYCLE_EVENTS.COMPLETED,
  unknown: ADVISORY_LIFECYCLE_EVENTS.UNKNOWN
});

const RECRUITMENT_WORKFLOW_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_VALIDATOR_PHASE,
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

const RECRUITMENT_WORKFLOW_VALIDATOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_VALIDATION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_VALIDATOR_PHASE,
  description:
    "Advisory recruitment workflow validation and anomaly detection from Phases 95–96 outputs.",
  lifecycleEvents: ADVISORY_LIFECYCLE_EVENT_LIST,
  workflowOrder: LIFECYCLE_WORKFLOW_ORDER,
  anomalyTypes: Object.freeze(Object.values(ANOMALY_TYPES)),
  workflowCompletenessLevels: Object.freeze(Object.values(WORKFLOW_COMPLETENESS)),
  confidenceLevels: Object.freeze(Object.values(CONFIDENCE_LEVELS)),
  validationReasons: Object.freeze(Object.values(VALIDATION_REASONS)),
  metadata: RECRUITMENT_WORKFLOW_VALIDATOR_METADATA
});

const EMPTY_WORKFLOW_VALIDATION = Object.freeze({
  workflowValid: false,
  validationConfidence: CONFIDENCE_LEVELS.NONE,
  validationReason: VALIDATION_REASONS.UNKNOWN_WORKFLOW_STATE,
  detectedAnomalies: Object.freeze([]),
  missingExpectedEvents: Object.freeze([]),
  duplicateEvents: Object.freeze([]),
  invalidTransitions: Object.freeze([]),
  workflowCompleteness: WORKFLOW_COMPLETENESS.UNKNOWN,
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

function normalizeKey(value) {
  const normalized = normalizeString(value);
  return normalized == null ? null : normalized.toLowerCase();
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

function mapDomainEventType(value) {
  const normalized = normalizeKey(value);
  if (normalized == null) {
    return null;
  }
  return DOMAIN_EVENT_TYPE_MAP[normalized] ?? null;
}

function getForwardTransitions(event) {
  const targets = FORWARD_TRANSITIONS[event];
  return Array.isArray(targets) ? targets.slice() : [];
}

function isValidLifecycleTransition(fromEvent, toEvent) {
  const from = normalizeAdvisoryLifecycleEvent(fromEvent);
  const to = normalizeAdvisoryLifecycleEvent(toEvent);
  if (from == null || to == null) {
    return false;
  }
  if (from === to) {
    return false;
  }
  return getForwardTransitions(from).includes(to);
}

function canReachLifecycleEvent(fromEvent, toEvent, visited) {
  const from = normalizeAdvisoryLifecycleEvent(fromEvent);
  const to = normalizeAdvisoryLifecycleEvent(toEvent);
  if (from == null || to == null) {
    return false;
  }
  if (from === to) {
    return true;
  }

  const seen = visited ?? new Set();
  if (seen.has(from)) {
    return false;
  }
  seen.add(from);

  const targets = getForwardTransitions(from);
  for (let i = 0; i < targets.length; i += 1) {
    if (canReachLifecycleEvent(targets[i], to, seen)) {
      return true;
    }
  }
  return false;
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
  return isPlainObject(context.transitionResolution)
    ? context.transitionResolution
    : isPlainObject(context.lifecycleTransitionResolution)
      ? context.lifecycleTransitionResolution
      : null;
}

function extractCurrentLifecycleEvent(context, lifecycleResolution) {
  if (isPlainObject(lifecycleResolution)) {
    const resolved = normalizeAdvisoryLifecycleEvent(lifecycleResolution.lifecycleEvent);
    if (resolved != null) {
      return resolved;
    }
  }

  if (!isPlainObject(context)) {
    return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
  }

  const explicit = normalizeAdvisoryLifecycleEvent(context.lifecycleEvent);
  if (explicit != null) {
    return explicit;
  }

  const transitionResolution = extractTransitionResolution(context);
  if (isPlainObject(transitionResolution)) {
    const fromTransition = normalizeAdvisoryLifecycleEvent(
      transitionResolution.currentLifecycleEvent
    );
    if (fromTransition != null) {
      return fromTransition;
    }
  }

  const workflowContext = isPlainObject(context.workflowContext) ? context.workflowContext : null;
  if (workflowContext != null) {
    const fromWorkflow = normalizeAdvisoryLifecycleEvent(workflowContext.lifecycleEvent);
    if (fromWorkflow != null) {
      return fromWorkflow;
    }
  }

  const eligibility = isPlainObject(context.eligibility) ? context.eligibility : null;
  if (eligibility != null) {
    const mapped = mapDomainEventType(eligibility.eventType);
    if (mapped != null) {
      return mapped;
    }
  }

  return ADVISORY_LIFECYCLE_EVENTS.UNKNOWN;
}

function collectObservedLifecycleEvents(context) {
  const events = [];
  const sources = [];

  if (!isPlainObject(context)) {
    return events;
  }

  sources.push(context.observedLifecycleEvents);
  sources.push(context.lifecycleEventHistory);

  const workflowContext = isPlainObject(context.workflowContext) ? context.workflowContext : null;
  if (workflowContext != null) {
    sources.push(workflowContext.observedLifecycleEvents);
    sources.push(workflowContext.lifecycleEventHistory);
  }

  const pipelineContext = isPlainObject(context.pipelineContext) ? context.pipelineContext : null;
  if (pipelineContext != null) {
    sources.push(pipelineContext.observedLifecycleEvents);
    sources.push(pipelineContext.lifecycleEventHistory);
  }

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (!Array.isArray(source)) {
      continue;
    }
    for (let j = 0; j < source.length; j += 1) {
      const normalized = normalizeAdvisoryLifecycleEvent(source[j]);
      if (normalized != null && normalized !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
        events.push(normalized);
      }
    }
  }

  return events;
}

function buildEventSequence(context, currentEvent) {
  const observed = collectObservedLifecycleEvents(context);
  const sequence = observed.slice();

  if (
    currentEvent != null &&
    currentEvent !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN &&
    sequence[sequence.length - 1] !== currentEvent
  ) {
    sequence.push(currentEvent);
  }

  if (sequence.length === 0 && currentEvent != null) {
    sequence.push(currentEvent);
  }

  return sequence;
}

function detectDuplicateEvents(sequence) {
  const counts = {};
  const duplicates = [];

  for (let i = 0; i < sequence.length; i += 1) {
    const event = sequence[i];
    if (event === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
      continue;
    }
    counts[event] = (counts[event] ?? 0) + 1;
  }

  const keys = Object.keys(counts);
  for (let i = 0; i < keys.length; i += 1) {
    const event = keys[i];
    if (counts[event] > 1) {
      duplicates.push(event);
    }
  }

  return duplicates.sort();
}

function detectInvalidTransitions(sequence) {
  const invalid = [];

  for (let i = 1; i < sequence.length; i += 1) {
    const fromEvent = sequence[i - 1];
    const toEvent = sequence[i];
    if (!isValidLifecycleTransition(fromEvent, toEvent)) {
      invalid.push(`${fromEvent}->${toEvent}`);
    }
  }

  return invalid;
}

function inferMissingExpectedEvents(sequence, invalidTransitions) {
  const missing = new Set();

  for (let i = 0; i < invalidTransitions.length; i += 1) {
    const parts = invalidTransitions[i].split("->");
    if (parts.length !== 2) {
      continue;
    }
    const fromEvent = parts[0];
    const toEvent = parts[1];
    const fromIndex = LIFECYCLE_ORDER_INDEX[fromEvent];
    const toIndex = LIFECYCLE_ORDER_INDEX[toEvent];

    if (typeof fromIndex !== "number" || typeof toIndex !== "number" || toIndex <= fromIndex) {
      continue;
    }

    for (let j = fromIndex + 1; j < toIndex; j += 1) {
      const candidate = LIFECYCLE_WORKFLOW_ORDER[j];
      if (
        candidate !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN &&
        !sequence.includes(candidate) &&
        canReachLifecycleEvent(fromEvent, candidate) &&
        canReachLifecycleEvent(candidate, toEvent)
      ) {
        missing.add(candidate);
      }
    }
  }

  return Array.from(missing).sort((left, right) => {
    return LIFECYCLE_ORDER_INDEX[left] - LIFECYCLE_ORDER_INDEX[right];
  });
}

function detectPipelineCompletion(context) {
  const pipelineContext = isPlainObject(context?.pipelineContext) ? context.pipelineContext : null;
  if (pipelineContext == null) {
    return false;
  }

  return (
    pipelineContext.lifecycleCompleted === true ||
    pipelineContext.recruitmentCompleted === true ||
    normalizeKey(pipelineContext.lifecycleStage) === "completed"
  );
}

function detectTerminalStateViolation(sequence, transitionResolution) {
  const completedIndex = sequence.indexOf(ADVISORY_LIFECYCLE_EVENTS.COMPLETED);
  if (completedIndex === -1) {
    return false;
  }

  if (completedIndex < sequence.length - 1) {
    return true;
  }

  if (
    isPlainObject(transitionResolution) &&
    transitionResolution.terminalState === true &&
    transitionResolution.currentLifecycleEvent !== ADVISORY_LIFECYCLE_EVENTS.COMPLETED
  ) {
    return true;
  }

  return false;
}

function detectWorkflowCompletedLaterEvent(context, currentEvent, transitionResolution) {
  const pipelineCompleted = detectPipelineCompletion(context);
  const transitionCompleted =
    isPlainObject(transitionResolution) && transitionResolution.workflowCompleted === true;

  if (!pipelineCompleted && !transitionCompleted) {
    return false;
  }

  return (
    currentEvent !== ADVISORY_LIFECYCLE_EVENTS.COMPLETED &&
    currentEvent !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN
  );
}

function hasUnknownLifecycleState(context, currentEvent) {
  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return true;
  }

  if (!isPlainObject(context)) {
    return false;
  }

  const rawCandidates = [
    context.lifecycleEvent,
    isPlainObject(context.lifecycleResolution) ? context.lifecycleResolution.lifecycleEvent : null,
    isPlainObject(context.workflowContext) ? context.workflowContext.lifecycleEvent : null
  ];

  for (let i = 0; i < rawCandidates.length; i += 1) {
    const raw = normalizeString(rawCandidates[i]);
    if (raw != null && normalizeAdvisoryLifecycleEvent(raw) == null) {
      return true;
    }
  }

  return false;
}

function buildAnomaly(type, detail) {
  return deepFreeze({
    type,
    detail: detail ?? null
  });
}

function resolveWorkflowCompleteness(currentEvent, workflowValid, transitionResolution, anomalies) {
  const transitionCompleted =
    isPlainObject(transitionResolution) && transitionResolution.workflowCompleted === true;
  const terminal =
    currentEvent === ADVISORY_LIFECYCLE_EVENTS.COMPLETED ||
    (isPlainObject(transitionResolution) && transitionResolution.terminalState === true);

  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN && !transitionCompleted) {
    return WORKFLOW_COMPLETENESS.UNKNOWN;
  }

  if (terminal && workflowValid) {
    return WORKFLOW_COMPLETENESS.COMPLETE;
  }

  if (transitionCompleted && workflowValid) {
    return WORKFLOW_COMPLETENESS.COMPLETE;
  }

  if (currentEvent !== ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return WORKFLOW_COMPLETENESS.PARTIAL;
  }

  if (anomalies.length > 0) {
    return WORKFLOW_COMPLETENESS.PARTIAL;
  }

  return WORKFLOW_COMPLETENESS.UNKNOWN;
}

function resolveValidationConfidence(workflowValid, workflowCompleteness, anomalies, currentEvent) {
  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return CONFIDENCE_LEVELS.NONE;
  }

  if (workflowValid && workflowCompleteness === WORKFLOW_COMPLETENESS.COMPLETE) {
    return CONFIDENCE_LEVELS.HIGH;
  }

  if (workflowValid) {
    return CONFIDENCE_LEVELS.MEDIUM;
  }

  if (anomalies.length > 0) {
    return CONFIDENCE_LEVELS.LOW;
  }

  return CONFIDENCE_LEVELS.NONE;
}

function resolveValidationReason(workflowValid, workflowCompleteness, currentEvent) {
  if (currentEvent === ADVISORY_LIFECYCLE_EVENTS.UNKNOWN) {
    return VALIDATION_REASONS.UNKNOWN_WORKFLOW_STATE;
  }

  if (workflowValid && workflowCompleteness === WORKFLOW_COMPLETENESS.COMPLETE) {
    return VALIDATION_REASONS.WORKFLOW_CONSISTENT;
  }

  if (workflowValid) {
    return VALIDATION_REASONS.INCOMPLETE_WORKFLOW;
  }

  return VALIDATION_REASONS.ANOMALIES_DETECTED;
}

function buildValidationResult(context) {
  const lifecycleResolution = extractLifecycleResolution(context);
  const transitionResolution = extractTransitionResolution(context);
  const currentEvent = extractCurrentLifecycleEvent(context, lifecycleResolution);
  const sequence = buildEventSequence(context, currentEvent);

  const duplicateEvents = detectDuplicateEvents(sequence);
  const invalidTransitions = detectInvalidTransitions(sequence);
  const missingExpectedEvents = inferMissingExpectedEvents(sequence, invalidTransitions);

  const detectedAnomalies = [];

  if (hasUnknownLifecycleState(context, currentEvent)) {
    detectedAnomalies.push(
      buildAnomaly(ANOMALY_TYPES.UNKNOWN_LIFECYCLE_STATE, { currentEvent })
    );
  }

  for (let i = 0; i < invalidTransitions.length; i += 1) {
    detectedAnomalies.push(
      buildAnomaly(ANOMALY_TYPES.INVALID_LIFECYCLE_TRANSITION, {
        transition: invalidTransitions[i]
      })
    );
  }

  for (let i = 0; i < duplicateEvents.length; i += 1) {
    detectedAnomalies.push(
      buildAnomaly(ANOMALY_TYPES.DUPLICATE_LIFECYCLE_EVENT, {
        event: duplicateEvents[i]
      })
    );
  }

  for (let i = 0; i < missingExpectedEvents.length; i += 1) {
    detectedAnomalies.push(
      buildAnomaly(ANOMALY_TYPES.MISSING_EXPECTED_LIFECYCLE_EVENT, {
        event: missingExpectedEvents[i]
      })
    );
  }

  if (detectTerminalStateViolation(sequence, transitionResolution)) {
    detectedAnomalies.push(buildAnomaly(ANOMALY_TYPES.TERMINAL_STATE_VIOLATION, null));
  }

  if (detectWorkflowCompletedLaterEvent(context, currentEvent, transitionResolution)) {
    detectedAnomalies.push(
      buildAnomaly(ANOMALY_TYPES.WORKFLOW_COMPLETED_LATER_EVENT, {
        currentEvent
      })
    );
  }

  const workflowValid = detectedAnomalies.length === 0;
  const workflowCompleteness = resolveWorkflowCompleteness(
    currentEvent,
    workflowValid,
    transitionResolution,
    detectedAnomalies
  );
  const validationConfidence = resolveValidationConfidence(
    workflowValid,
    workflowCompleteness,
    detectedAnomalies,
    currentEvent
  );
  const validationReason = resolveValidationReason(
    workflowValid,
    workflowCompleteness,
    currentEvent
  );

  return deepFreeze({
    workflowValid,
    validationConfidence,
    validationReason,
    detectedAnomalies: Object.freeze(detectedAnomalies.slice()),
    missingExpectedEvents: Object.freeze(missingExpectedEvents.slice()),
    duplicateEvents: Object.freeze(duplicateEvents.slice()),
    invalidTransitions: Object.freeze(invalidTransitions.slice()),
    workflowCompleteness,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Validate advisory recruitment workflow consistency from Phases 95–96 outputs.
 * Pure: no I/O, no mutation of input, no production side effects.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function validateRecruitmentWorkflow(context) {
  if (!isPlainObject(context)) {
    return deepFreeze({
      ...EMPTY_WORKFLOW_VALIDATION,
      validationReason: VALIDATION_REASONS.INVALID_INPUT
    });
  }

  return buildValidationResult(context);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isWorkflowValidationResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.workflowValid !== "boolean" ||
    typeof value.validationConfidence !== "string" ||
    !SUPPORTED_CONFIDENCE_LEVELS.has(value.validationConfidence) ||
    typeof value.validationReason !== "string" ||
    !SUPPORTED_VALIDATION_REASONS.has(value.validationReason) ||
    !Array.isArray(value.detectedAnomalies) ||
    !Array.isArray(value.missingExpectedEvents) ||
    !Array.isArray(value.duplicateEvents) ||
    !Array.isArray(value.invalidTransitions) ||
    typeof value.workflowCompleteness !== "string" ||
    !SUPPORTED_WORKFLOW_COMPLETENESS.has(value.workflowCompleteness) ||
    value.advisory !== true ||
    value.architectureOnly !== true ||
    value.executed !== false
  ) {
    return false;
  }

  for (let i = 0; i < value.detectedAnomalies.length; i += 1) {
    const anomaly = value.detectedAnomalies[i];
    if (
      !isPlainObject(anomaly) ||
      typeof anomaly.type !== "string" ||
      !SUPPORTED_ANOMALY_TYPES.has(anomaly.type)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeWorkflowValidationResult(result) {
  if (!isWorkflowValidationResult(result)) {
    return Object.freeze({
      phase: RECRUITMENT_WORKFLOW_VALIDATOR_PHASE,
      entity: RECRUITMENT_WORKFLOW_VALIDATION_ENTITY,
      valid: false,
      workflowCompleteness: WORKFLOW_COMPLETENESS.UNKNOWN,
      validationConfidence: CONFIDENCE_LEVELS.NONE,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_WORKFLOW_VALIDATOR_PHASE,
    entity: RECRUITMENT_WORKFLOW_VALIDATION_ENTITY,
    valid: result.workflowValid === true,
    workflowCompleteness: result.workflowCompleteness,
    validationConfidence: result.validationConfidence,
    validationReason: result.validationReason,
    anomalyCount: result.detectedAnomalies.length,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_VALIDATION_ENTITY,
  ADVISORY_LIFECYCLE_EVENTS,
  ADVISORY_LIFECYCLE_EVENT_LIST,
  SUPPORTED_ADVISORY_LIFECYCLE_EVENTS,
  CONFIDENCE_LEVELS,
  SUPPORTED_CONFIDENCE_LEVELS,
  VALIDATION_REASONS,
  SUPPORTED_VALIDATION_REASONS,
  ANOMALY_TYPES,
  SUPPORTED_ANOMALY_TYPES,
  WORKFLOW_COMPLETENESS,
  SUPPORTED_WORKFLOW_COMPLETENESS,
  LIFECYCLE_WORKFLOW_ORDER,
  FORWARD_TRANSITIONS,
  RECRUITMENT_WORKFLOW_VALIDATOR_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_VALIDATOR_METADATA,
  EMPTY_WORKFLOW_VALIDATION,
  normalizeAdvisoryLifecycleEvent,
  isValidLifecycleTransition,
  validateRecruitmentWorkflow,
  isWorkflowValidationResult,
  summarizeWorkflowValidationResult
};
