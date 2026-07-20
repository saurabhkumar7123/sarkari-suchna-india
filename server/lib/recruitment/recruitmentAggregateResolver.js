"use strict";

/**
 * Phase 78 — Recruitment Aggregate Resolver (Read-only).
 *
 * Pure library that normalizes a collection of recruitment event records
 * belonging to one recruitment into a descriptive immutable aggregate.
 *
 * Performs no database access, no state transitions, and no business decisions.
 * Accepts plain JavaScript objects and works entirely in memory.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary is documented inline.
 */

const RECRUITMENT_AGGREGATE_RESOLVER_PHASE = 78;

const RECRUITMENT_AGGREGATE_ENTITY = "recruitment_aggregate";

/**
 * Primary event types — aligned with recruitmentDomainModel PRIMARY_EVENT_CONCEPT.
 */
const PRIMARY_EVENT_TYPES = Object.freeze(["notification", "short_notification"]);

const SUPPORTED_PRIMARY_EVENT_TYPES = Object.freeze(new Set(PRIMARY_EVENT_TYPES));

/**
 * Terminal event types — aligned with recruitmentDomainModel TERMINAL_EVENT_CONCEPT.
 */
const TERMINAL_EVENT_TYPES = Object.freeze(["final_result", "joining"]);

const SUPPORTED_TERMINAL_EVENT_TYPES = Object.freeze(new Set(TERMINAL_EVENT_TYPES));

const RECRUITMENT_AGGREGATE_METADATA = Object.freeze({
  phase: RECRUITMENT_AGGREGATE_RESOLVER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  assignsRecruitmentIds: false,
  performsStateTransitions: false
});

const RECRUITMENT_AGGREGATE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_AGGREGATE_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_AGGREGATE_RESOLVER_PHASE,
  description:
    "Normalized read-only aggregate describing recruitment events for a single recruitment.",
  primaryEventTypes: PRIMARY_EVENT_TYPES,
  terminalEventTypes: TERMINAL_EVENT_TYPES,
  metadata: RECRUITMENT_AGGREGATE_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const EMPTY_RECRUITMENT_AGGREGATE = Object.freeze({
  recruitmentId: null,
  primaryEvent: null,
  orderedEvents: Object.freeze([]),
  latestEvent: null,
  firstEvent: null,
  eventCount: 0,
  eventTypesPresent: Object.freeze([]),
  hasPrimary: false,
  lifecycleStarted: false,
  lifecycleCompleted: false
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

function normalizeFiniteNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPrimaryEventType(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_PRIMARY_EVENT_TYPES.has(normalized);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isTerminalEventType(value) {
  const normalized = normalizeString(value);
  return normalized != null && SUPPORTED_TERMINAL_EVENT_TYPES.has(normalized);
}

function getEventType(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  return normalizeString(event.event_type ?? event.eventType);
}

function getRecruitmentIdFromEvent(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  const recruitmentId = event.recruitment_id ?? event.recruitmentId;
  return recruitmentId == null ? null : recruitmentId;
}

function getEventId(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  return normalizeFiniteNumber(event.id);
}

function getSequenceOrder(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  return normalizeFiniteNumber(event.sequence_order ?? event.sequenceOrder);
}

function getCatalogOrder(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  return normalizeFiniteNumber(event.order);
}

function eventHasOrderingMetadata(event) {
  return getSequenceOrder(event) != null || getCatalogOrder(event) != null;
}

function collectionHasOrderingMetadata(events) {
  for (let i = 0; i < events.length; i += 1) {
    if (eventHasOrderingMetadata(events[i])) {
      return true;
    }
  }
  return false;
}

function getOrderingValue(event) {
  const sequenceOrder = getSequenceOrder(event);
  if (sequenceOrder != null) {
    return sequenceOrder;
  }
  const catalogOrder = getCatalogOrder(event);
  return catalogOrder != null ? catalogOrder : 0;
}

function shallowCopyEvent(event) {
  if (!isPlainObject(event)) {
    return event;
  }
  return { ...event };
}

function compareIndexedEvents(left, right) {
  const orderDifference = getOrderingValue(left.event) - getOrderingValue(right.event);
  if (orderDifference !== 0) {
    return orderDifference;
  }

  const leftId = getEventId(left.event);
  const rightId = getEventId(right.event);
  const safeLeftId = leftId == null ? Number.MAX_SAFE_INTEGER : leftId;
  const safeRightId = rightId == null ? Number.MAX_SAFE_INTEGER : rightId;
  if (safeLeftId !== safeRightId) {
    return safeLeftId - safeRightId;
  }

  return left.index - right.index;
}

function orderEvents(events) {
  const indexed = events.map((event, index) => ({ event, index }));

  if (!collectionHasOrderingMetadata(events)) {
    return indexed.map(({ event }) => shallowCopyEvent(event));
  }

  indexed.sort(compareIndexedEvents);
  return indexed.map(({ event }) => shallowCopyEvent(event));
}

function collectEventTypesPresent(orderedEvents) {
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

function findPrimaryEvent(orderedEvents) {
  for (let i = 0; i < orderedEvents.length; i += 1) {
    const event = orderedEvents[i];
    if (isPrimaryEventType(getEventType(event))) {
      return event;
    }
  }
  return null;
}

function hasTerminalEvent(orderedEvents) {
  for (let i = 0; i < orderedEvents.length; i += 1) {
    if (isTerminalEventType(getEventType(orderedEvents[i]))) {
      return true;
    }
  }
  return false;
}

function normalizeEventsInput(events) {
  if (!Array.isArray(events)) {
    return [];
  }
  return events;
}

/**
 * Resolve a read-only recruitment aggregate from recruitment event records.
 * Pure: no I/O, no mutation of input, no business decisions.
 *
 * @param {Array<Object>|null|undefined} events
 * @returns {Readonly<Object>}
 */
function resolveRecruitmentAggregate(events) {
  const normalizedEvents = normalizeEventsInput(events);

  if (normalizedEvents.length === 0) {
    return EMPTY_RECRUITMENT_AGGREGATE;
  }

  const orderedEvents = orderEvents(normalizedEvents);
  const eventCount = orderedEvents.length;
  const firstEvent = orderedEvents[0] ?? null;
  const latestEvent = orderedEvents[eventCount - 1] ?? null;
  const recruitmentId = getRecruitmentIdFromEvent(firstEvent);
  const eventTypesPresent = collectEventTypesPresent(orderedEvents);
  const primaryEvent = findPrimaryEvent(orderedEvents);
  const hasPrimary = primaryEvent != null;

  return deepFreeze({
    recruitmentId,
    primaryEvent,
    orderedEvents,
    latestEvent,
    firstEvent,
    eventCount,
    eventTypesPresent: Object.freeze(eventTypesPresent.slice()),
    hasPrimary,
    lifecycleStarted: eventCount > 0,
    lifecycleCompleted: hasTerminalEvent(orderedEvents)
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentAggregate(value) {
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

/**
 * @param {Object|null|undefined} aggregate
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateRecruitmentAggregate(aggregate) {
  const reasons = [];

  if (!isRecruitmentAggregate(aggregate)) {
    return buildValidationResult(["INVALID_AGGREGATE_SHAPE"]);
  }

  if (aggregate.eventCount > 0 && aggregate.firstEvent == null) {
    reasons.push("MISSING_FIRST_EVENT");
  }

  if (aggregate.eventCount > 0 && aggregate.latestEvent == null) {
    reasons.push("MISSING_LATEST_EVENT");
  }

  if (aggregate.hasPrimary && aggregate.primaryEvent == null) {
    reasons.push("MISSING_PRIMARY_EVENT");
  }

  if (!aggregate.hasPrimary && aggregate.primaryEvent != null) {
    reasons.push("INVALID_PRIMARY_EVENT_FLAG");
  }

  const uniqueTypeCount = new Set(
    aggregate.orderedEvents
      .map((event) => getEventType(event))
      .filter((eventType) => eventType != null)
  ).size;

  if (aggregate.eventTypesPresent.length !== uniqueTypeCount) {
    reasons.push("INVALID_EVENT_TYPES_PRESENT");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} aggregate
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentAggregate(aggregate) {
  const validation = validateRecruitmentAggregate(aggregate);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_AGGREGATE_RESOLVER_PHASE,
      entity: RECRUITMENT_AGGREGATE_ENTITY,
      valid: false,
      eventCount: 0,
      hasPrimary: false,
      lifecycleStarted: false,
      lifecycleCompleted: false,
      eventTypeCount: 0,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_AGGREGATE_RESOLVER_PHASE,
    entity: RECRUITMENT_AGGREGATE_ENTITY,
    valid: true,
    recruitmentId: aggregate.recruitmentId,
    eventCount: aggregate.eventCount,
    hasPrimary: aggregate.hasPrimary,
    lifecycleStarted: aggregate.lifecycleStarted,
    lifecycleCompleted: aggregate.lifecycleCompleted,
    eventTypeCount: aggregate.eventTypesPresent.length,
    primaryEventType: aggregate.primaryEvent != null ? getEventType(aggregate.primaryEvent) : null,
    latestEventType: aggregate.latestEvent != null ? getEventType(aggregate.latestEvent) : null,
    readOnly: true
  });
}

module.exports = {
  RECRUITMENT_AGGREGATE_RESOLVER_PHASE,
  RECRUITMENT_AGGREGATE_ENTITY,
  PRIMARY_EVENT_TYPES,
  SUPPORTED_PRIMARY_EVENT_TYPES,
  TERMINAL_EVENT_TYPES,
  SUPPORTED_TERMINAL_EVENT_TYPES,
  RECRUITMENT_AGGREGATE_DESCRIPTOR,
  RECRUITMENT_AGGREGATE_METADATA,
  VALIDATION_STATUS,
  EMPTY_RECRUITMENT_AGGREGATE,
  isPrimaryEventType,
  isTerminalEventType,
  resolveRecruitmentAggregate,
  isRecruitmentAggregate,
  validateRecruitmentAggregate,
  summarizeRecruitmentAggregate
};
