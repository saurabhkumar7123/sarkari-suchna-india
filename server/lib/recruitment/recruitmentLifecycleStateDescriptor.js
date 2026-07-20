"use strict";

/**
 * Phase 80 — Recruitment Lifecycle State Descriptor (Read-only).
 *
 * Pure library defining descriptive lifecycle states for recruitment processing.
 * Provides a stable vocabulary and metadata layer for future lifecycle state
 * machine work. Does not implement state transitions, infer state from events,
 * or access runtime infrastructure.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules.
 */

const RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE = 80;

const RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_ENTITY = "recruitment_lifecycle_state";

const REQUIRED_DESCRIPTOR_FIELDS = Object.freeze([
  "state",
  "label",
  "order",
  "description",
  "terminal"
]);

const LIFECYCLE_STATE_VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  DUPLICATE_STATE: "DUPLICATE_STATE",
  DUPLICATE_ORDER: "DUPLICATE_ORDER",
  INVALID_ORDER_SEQUENCE: "INVALID_ORDER_SEQUENCE",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD: "INVALID_FIELD",
  MISSING_TERMINAL_STATE: "MISSING_TERMINAL_STATE",
  MULTIPLE_TERMINAL_STATES: "MULTIPLE_TERMINAL_STATES",
  TERMINAL_NOT_LAST: "TERMINAL_NOT_LAST"
});

/**
 * Frozen descriptor registry for recruitment lifecycle processing states.
 * @type {readonly Object[]}
 */
const RECRUITMENT_LIFECYCLE_STATES = Object.freeze([
  Object.freeze({
    state: "DISCOVERED",
    label: "Discovered",
    order: 10,
    description:
      "Recruitment has been identified from a source but lifecycle processing has not yet begun.",
    terminal: false
  }),
  Object.freeze({
    state: "NOTIFICATION_AVAILABLE",
    label: "Notification Available",
    order: 20,
    description:
      "Official notification or advertisement material is available for review and publication.",
    terminal: false
  }),
  Object.freeze({
    state: "APPLICATION_OPEN",
    label: "Application Open",
    order: 30,
    description:
      "Candidates may submit applications during the active application window.",
    terminal: false
  }),
  Object.freeze({
    state: "APPLICATION_CLOSED",
    label: "Application Closed",
    order: 40,
    description:
      "The application submission window has closed; no new applications are accepted.",
    terminal: false
  }),
  Object.freeze({
    state: "CORRECTION_WINDOW",
    label: "Correction Window",
    order: 50,
    description:
      "Candidates may correct or update submitted application details within the allowed period.",
    terminal: false
  }),
  Object.freeze({
    state: "EXAM_STAGE",
    label: "Exam Stage",
    order: 60,
    description:
      "Examination-related activity is in progress, including admit card release and exam conduct.",
    terminal: false
  }),
  Object.freeze({
    state: "ANSWER_KEY_STAGE",
    label: "Answer Key Stage",
    order: 70,
    description:
      "Provisional or final answer key publication and related objection windows are active.",
    terminal: false
  }),
  Object.freeze({
    state: "RESULT_STAGE",
    label: "Result Stage",
    order: 80,
    description:
      "Preliminary or stage-wise results have been published and are under active review.",
    terminal: false
  }),
  Object.freeze({
    state: "FINAL_RESULT_STAGE",
    label: "Final Result Stage",
    order: 90,
    description:
      "Final merit or selection outcome has been published for the recruitment cycle.",
    terminal: false
  }),
  Object.freeze({
    state: "JOINING_STAGE",
    label: "Joining Stage",
    order: 100,
    description:
      "Appointment, joining, or onboarding instructions are being issued to selected candidates.",
    terminal: false
  }),
  Object.freeze({
    state: "COMPLETED",
    label: "Completed",
    order: 110,
    description:
      "Recruitment lifecycle processing is complete; no further lifecycle progression is expected.",
    terminal: true
  })
]);

const RECRUITMENT_LIFECYCLE_STATE_BY_STATE = Object.freeze(
  RECRUITMENT_LIFECYCLE_STATES.reduce((acc, descriptor) => {
    acc[descriptor.state] = descriptor;
    return acc;
  }, {})
);

const SUPPORTED_LIFECYCLE_STATES = Object.freeze(
  new Set(RECRUITMENT_LIFECYCLE_STATES.map((descriptor) => descriptor.state))
);

const TERMINAL_LIFECYCLE_STATES = Object.freeze(
  RECRUITMENT_LIFECYCLE_STATES.filter((descriptor) => descriptor.terminal).map(
    (descriptor) => descriptor.state
  )
);

const RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA = Object.freeze({
  phase: RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsStateTransitions: false,
  infersStateFromEvents: false,
  stateCount: RECRUITMENT_LIFECYCLE_STATES.length,
  terminalStates: TERMINAL_LIFECYCLE_STATES
});

const RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE,
  description:
    "Frozen descriptive registry of recruitment lifecycle processing states.",
  states: RECRUITMENT_LIFECYCLE_STATES,
  metadata: RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA
});

function normalizeLifecycleState(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

/**
 * @param {string|null|undefined} state
 * @returns {Readonly<Object>|null}
 */
function getLifecycleStateDescriptor(state) {
  const normalized = normalizeLifecycleState(state);
  if (normalized == null) {
    return null;
  }
  return RECRUITMENT_LIFECYCLE_STATE_BY_STATE[normalized] ?? null;
}

/**
 * @param {*} state
 * @returns {boolean}
 */
function isValidLifecycleState(state) {
  const normalized = normalizeLifecycleState(state);
  if (normalized == null) {
    return false;
  }
  return SUPPORTED_LIFECYCLE_STATES.has(normalized);
}

/**
 * @param {*} state
 * @returns {boolean}
 */
function isTerminalLifecycleState(state) {
  const descriptor = getLifecycleStateDescriptor(state);
  return descriptor != null && descriptor.terminal === true;
}

/**
 * @param {*} state
 * @returns {number|null}
 */
function getLifecycleStateOrder(state) {
  const descriptor = getLifecycleStateDescriptor(state);
  return descriptor != null ? descriptor.order : null;
}

/**
 * @returns {readonly Object[]}
 */
function listLifecycleStatesInOrder() {
  return RECRUITMENT_LIFECYCLE_STATES;
}

function validateDescriptorShape(descriptor, errors, reasons) {
  if (descriptor == null || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    errors.push("descriptor must be a plain object");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_FIELD);
    return;
  }

  for (let i = 0; i < REQUIRED_DESCRIPTOR_FIELDS.length; i += 1) {
    const field = REQUIRED_DESCRIPTOR_FIELDS[i];
    if (!Object.prototype.hasOwnProperty.call(descriptor, field)) {
      errors.push(`missing required descriptor field: ${field}`);
      reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (typeof descriptor.state !== "string" || descriptor.state.trim() === "") {
    errors.push("descriptor.state must be a non-empty string");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (typeof descriptor.label !== "string" || descriptor.label.trim() === "") {
    errors.push("descriptor.label must be a non-empty string");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (
    typeof descriptor.order !== "number" ||
    !Number.isFinite(descriptor.order) ||
    descriptor.order < 0
  ) {
    errors.push("descriptor.order must be a non-negative finite number");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (typeof descriptor.description !== "string" || descriptor.description.trim() === "") {
    errors.push("descriptor.description must be a non-empty string");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (typeof descriptor.terminal !== "boolean") {
    errors.push("descriptor.terminal must be a boolean");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_FIELD);
  }
}

function sortReasons(reasons) {
  return Object.freeze([...new Set(reasons)].sort());
}

/**
 * Validates the canonical lifecycle state descriptor registry for integrity.
 * @returns {Readonly<{ valid: boolean, errors: string[], reasons: string[] }>}
 */
function validateLifecycleStateDescriptor() {
  const errors = [];
  const reasons = [];
  const seenStates = new Set();
  const seenOrders = new Set();
  let previousOrder = -1;
  let terminalCount = 0;
  let lastTerminalIndex = -1;

  for (let i = 0; i < RECRUITMENT_LIFECYCLE_STATES.length; i += 1) {
    const descriptor = RECRUITMENT_LIFECYCLE_STATES[i];
    validateDescriptorShape(descriptor, errors, reasons);

    if (seenStates.has(descriptor.state)) {
      errors.push(`duplicate lifecycle state: ${descriptor.state}`);
      reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.DUPLICATE_STATE);
    } else {
      seenStates.add(descriptor.state);
    }

    if (seenOrders.has(descriptor.order)) {
      errors.push(`duplicate lifecycle state order: ${descriptor.order}`);
      reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.DUPLICATE_ORDER);
    } else {
      seenOrders.add(descriptor.order);
    }

    if (descriptor.order <= previousOrder) {
      errors.push(
        `lifecycle state order must be strictly increasing: ${descriptor.state} (${descriptor.order})`
      );
      reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.INVALID_ORDER_SEQUENCE);
    }
    previousOrder = descriptor.order;

    if (descriptor.terminal === true) {
      terminalCount += 1;
      lastTerminalIndex = i;
    }
  }

  if (terminalCount === 0) {
    errors.push("registry must include at least one terminal lifecycle state");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.MISSING_TERMINAL_STATE);
  }

  if (terminalCount > 1) {
    errors.push("registry must include exactly one terminal lifecycle state");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.MULTIPLE_TERMINAL_STATES);
  }

  if (
    terminalCount === 1 &&
    lastTerminalIndex !== RECRUITMENT_LIFECYCLE_STATES.length - 1
  ) {
    errors.push("terminal lifecycle state must be the last state in order");
    reasons.push(LIFECYCLE_STATE_VALIDATION_REASONS.TERMINAL_NOT_LAST);
  }

  const normalizedReasons =
    errors.length === 0
      ? Object.freeze([LIFECYCLE_STATE_VALIDATION_REASONS.VALID])
      : sortReasons(reasons);

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors.slice()),
    reasons: normalizedReasons
  });
}

/**
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentLifecycleStateDescriptors() {
  return Object.freeze({
    phase: RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE,
    entity: RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_ENTITY,
    stateCount: RECRUITMENT_LIFECYCLE_STATES.length,
    terminalStates: TERMINAL_LIFECYCLE_STATES,
    firstState: RECRUITMENT_LIFECYCLE_STATES[0].state,
    lastState:
      RECRUITMENT_LIFECYCLE_STATES[RECRUITMENT_LIFECYCLE_STATES.length - 1].state,
    descriptiveOnly: true,
    readOnly: true,
    runtimeIntegration: false,
    performsStateTransitions: false,
    infersStateFromEvents: false
  });
}

module.exports = {
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_PHASE,
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_ENTITY,
  RECRUITMENT_LIFECYCLE_STATES,
  RECRUITMENT_LIFECYCLE_STATE_BY_STATE,
  SUPPORTED_LIFECYCLE_STATES,
  TERMINAL_LIFECYCLE_STATES,
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_STATE_DESCRIPTOR_METADATA,
  LIFECYCLE_STATE_VALIDATION_REASONS,
  getLifecycleStateDescriptor,
  isValidLifecycleState,
  isTerminalLifecycleState,
  getLifecycleStateOrder,
  listLifecycleStatesInOrder,
  validateLifecycleStateDescriptor,
  summarizeRecruitmentLifecycleStateDescriptors
};
