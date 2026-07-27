"use strict";

/**
 * Phase 79 — Recruitment Timeline Projection Layer (Read-only).
 *
 * Pure library that projects a Phase 78 recruitment aggregate into a normalized
 * lifecycle timeline representation. Descriptive only — no state transitions.
 *
 * Performs no database access, no state transitions, and no business decisions.
 * Accepts plain JavaScript objects and works entirely in memory.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — aggregate shape documented inline.
 */

const RECRUITMENT_TIMELINE_PROJECTION_PHASE = 79;

const RECRUITMENT_TIMELINE_PROJECTION_ENTITY = "recruitment_timeline_projection";

/**
 * Common recruitment lifecycle event types recognized for timeline awareness.
 * Descriptive vocabulary only — does not imply required events.
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

const RECRUITMENT_TIMELINE_PROJECTION_METADATA = Object.freeze({
  phase: RECRUITMENT_TIMELINE_PROJECTION_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  performsStateTransitions: false,
  marksRecruitmentIncomplete: false
});

const RECRUITMENT_TIMELINE_PROJECTION_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_TIMELINE_PROJECTION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_TIMELINE_PROJECTION_PHASE,
  description:
    "Normalized read-only timeline projection describing recruitment lifecycle events.",
  commonLifecycleEventTypes: COMMON_LIFECYCLE_EVENT_TYPES,
  metadata: RECRUITMENT_TIMELINE_PROJECTION_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid"
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

const EMPTY_RECRUITMENT_TIMELINE_PROJECTION = deepFreeze({
  recruitmentId: null,
  timelineEvents: Object.freeze([]),
  availableEventTypes: Object.freeze([]),
  missingCommonEvents: Object.freeze(COMMON_LIFECYCLE_EVENT_TYPES.slice()),
  totalTimelineEvents: 0,
  firstTimelineEvent: null,
  latestTimelineEvent: null
});

function buildValidationResult(reasons) {
  const normalizedReasons = Array.isArray(reasons)
    ? reasons.filter((reason) => typeof reason === "string" && reason.trim() !== "")
    : [];

  return deepFreeze({
    valid: normalizedReasons.length === 0,
    status:
      normalizedReasons.length === 0 ? VALIDATION_STATUS.VALID : VALIDATION_STATUS.INVALID,
    reasons: Object.freeze(normalizedReasons.slice())
  });
}

function getEventType(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  return normalizeString(event.event_type ?? event.eventType);
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
 * Validates that a value matches the Phase 78 recruitment aggregate shape.
 * Inline check — no cross-module imports.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentAggregateShape(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !("recruitmentId" in value) ||
    !("primaryEvent" in value) ||
    !Array.isArray(value.orderedEvents) ||
    !("latestEvent" in value) ||
    !("firstEvent" in value) ||
    typeof value.eventCount !== "number" ||
    !Array.isArray(value.eventTypesPresent) ||
    typeof value.hasPrimary !== "boolean" ||
    typeof value.lifecycleStarted !== "boolean" ||
    typeof value.lifecycleCompleted !== "boolean"
  ) {
    return false;
  }

  if (value.eventCount !== value.orderedEvents.length) {
    return false;
  }

  if (value.eventCount === 0) {
    return (
      value.recruitmentId == null &&
      value.primaryEvent == null &&
      value.latestEvent == null &&
      value.firstEvent == null &&
      value.eventTypesPresent.length === 0 &&
      value.hasPrimary === false &&
      value.lifecycleStarted === false &&
      value.lifecycleCompleted === false
    );
  }

  if (value.firstEvent !== value.orderedEvents[0]) {
    return false;
  }

  if (value.latestEvent !== value.orderedEvents[value.eventCount - 1]) {
    return false;
  }

  if (value.hasPrimary !== (value.primaryEvent != null)) {
    return false;
  }

  if (value.lifecycleStarted !== (value.eventCount > 0)) {
    return false;
  }

  return true;
}

function collectAvailableEventTypes(orderedEvents) {
  const seen = new Set();
  const types = [];

  for (let i = 0; i < orderedEvents.length; i += 1) {
    const eventType = getEventType(orderedEvents[i]);
    if (eventType == null || seen.has(eventType)) {
      continue;
    }
    seen.add(eventType);
    types.push(eventType);
  }

  return types;
}

function collectMissingCommonEvents(availableEventTypes) {
  const present = new Set(availableEventTypes);
  const missing = [];

  for (let i = 0; i < COMMON_LIFECYCLE_EVENT_TYPES.length; i += 1) {
    const commonType = COMMON_LIFECYCLE_EVENT_TYPES[i];
    if (!present.has(commonType)) {
      missing.push(commonType);
    }
  }

  return missing;
}

function buildTimelineEvents(orderedEvents) {
  const timelineEvents = [];

  for (let position = 0; position < orderedEvents.length; position += 1) {
    const sourceEvent = orderedEvents[position];
    const eventType = getEventType(sourceEvent);

    timelineEvents.push(
      deepFreeze({
        eventType,
        eventOrder: position + 1,
        sourceEvent,
        position
      })
    );
  }

  return timelineEvents;
}

/**
 * Project a read-only recruitment timeline from a Phase 78 recruitment aggregate.
 * Pure: no I/O, no mutation of input, no business decisions.
 *
 * @param {Object|null|undefined} aggregate
 * @returns {Readonly<Object>}
 */
function createRecruitmentTimelineProjection(aggregate) {
  if (!isRecruitmentAggregateShape(aggregate)) {
    return EMPTY_RECRUITMENT_TIMELINE_PROJECTION;
  }

  if (aggregate.eventCount === 0) {
    return EMPTY_RECRUITMENT_TIMELINE_PROJECTION;
  }

  const timelineEvents = buildTimelineEvents(aggregate.orderedEvents);
  const availableEventTypes = collectAvailableEventTypes(aggregate.orderedEvents);
  const missingCommonEvents = collectMissingCommonEvents(availableEventTypes);
  const totalTimelineEvents = timelineEvents.length;

  return deepFreeze({
    recruitmentId: aggregate.recruitmentId,
    timelineEvents: Object.freeze(timelineEvents.slice()),
    availableEventTypes: Object.freeze(availableEventTypes.slice()),
    missingCommonEvents: Object.freeze(missingCommonEvents.slice()),
    totalTimelineEvents,
    firstTimelineEvent: totalTimelineEvents > 0 ? timelineEvents[0] : null,
    latestTimelineEvent:
      totalTimelineEvents > 0 ? timelineEvents[totalTimelineEvents - 1] : null
  });
}

/**
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
 * @param {Object|null|undefined} projection
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentTimelineProjection(projection) {
  const reasons = [];

  if (!isRecruitmentTimelineProjection(projection)) {
    return buildValidationResult(["INVALID_PROJECTION_SHAPE"]);
  }

  const availableSet = new Set(projection.availableEventTypes);
  if (availableSet.size !== projection.availableEventTypes.length) {
    reasons.push("INVALID_AVAILABLE_EVENT_TYPES");
  }

  for (let i = 0; i < projection.missingCommonEvents.length; i += 1) {
    const missingType = projection.missingCommonEvents[i];
    if (!isCommonLifecycleEventType(missingType)) {
      reasons.push("INVALID_MISSING_COMMON_EVENT_TYPE");
      break;
    }
    if (availableSet.has(missingType)) {
      reasons.push("MISSING_COMMON_EVENT_STILL_PRESENT");
      break;
    }
  }

  const timelineTypes = projection.timelineEvents
    .map((entry) => entry.eventType)
    .filter((eventType) => eventType != null);
  const timelineUniqueCount = new Set(timelineTypes).size;

  if (projection.availableEventTypes.length !== timelineUniqueCount) {
    reasons.push("INVALID_AVAILABLE_EVENT_TYPE_COUNT");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} projection
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentTimelineProjection(projection) {
  const validation = validateRecruitmentTimelineProjection(projection);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_TIMELINE_PROJECTION_PHASE,
      entity: RECRUITMENT_TIMELINE_PROJECTION_ENTITY,
      valid: false,
      totalTimelineEvents: 0,
      availableEventTypeCount: 0,
      missingCommonEventCount: 0,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_TIMELINE_PROJECTION_PHASE,
    entity: RECRUITMENT_TIMELINE_PROJECTION_ENTITY,
    valid: true,
    recruitmentId: projection.recruitmentId,
    totalTimelineEvents: projection.totalTimelineEvents,
    availableEventTypeCount: projection.availableEventTypes.length,
    missingCommonEventCount: projection.missingCommonEvents.length,
    firstEventType:
      projection.firstTimelineEvent != null ? projection.firstTimelineEvent.eventType : null,
    latestEventType:
      projection.latestTimelineEvent != null ? projection.latestTimelineEvent.eventType : null,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_TIMELINE_PROJECTION_PHASE,
  RECRUITMENT_TIMELINE_PROJECTION_ENTITY,
  COMMON_LIFECYCLE_EVENT_TYPES,
  SUPPORTED_COMMON_LIFECYCLE_EVENT_TYPES,
  RECRUITMENT_TIMELINE_PROJECTION_DESCRIPTOR,
  RECRUITMENT_TIMELINE_PROJECTION_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_TIMELINE_PROJECTION,
  isCommonLifecycleEventType,
  isRecruitmentAggregateShape,
  createRecruitmentTimelineProjection,
  isRecruitmentTimelineProjection,
  validateRecruitmentTimelineProjection,
  summarizeRecruitmentTimelineProjection
};
