"use strict";

/**
 * Authoritative recruitment lifecycle stage — derived from Events.
 *
 * Product rule:
 *   Latest valid active Event = lifecycle stage authority.
 *   recruitments.lifecycle_state = compatibility projection/cache.
 *   recruitment_extended.current_stage = optional enterprise projection/cache.
 *   Page status/title is presentation only and must never determine stage.
 *
 * Superseded / cancelled events never become current stage.
 */

const {
  mapEventStageToRecruitmentLifecycleState,
  DEFAULT_RECRUITMENT_LIFECYCLE_STATE
} = require("./productionRuntime/mapEventStageToLifecycleState");
const { normalizeEventType } = require("./lifecycleSafety");

const EXCLUDED_EVENT_STATUSES = Object.freeze(new Set(["superseded", "cancelled"]));
const PREFERRED_EVENT_STATUSES = Object.freeze(["active", "pending"]);

function parsePositiveId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function eventSortKey(event) {
  const sequence = Number(event && event.sequence_order);
  const id = Number(event && event.id) || 0;
  return {
    sequence: Number.isFinite(sequence) ? sequence : -1,
    id
  };
}

function compareEventsNewestFirst(a, b) {
  const ka = eventSortKey(a);
  const kb = eventSortKey(b);
  if (kb.sequence !== ka.sequence) return kb.sequence - ka.sequence;
  return kb.id - ka.id;
}

/**
 * Pure selection: prefer latest active, else latest pending.
 * Never selects superseded/cancelled.
 *
 * @param {Array<object>} events
 * @returns {object|null}
 */
function selectAuthoritativeEvent(events) {
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  const eligible = list.filter((event) => {
    const status = normalizeStatus(event.status);
    return !EXCLUDED_EVENT_STATUSES.has(status);
  });

  for (const preferred of PREFERRED_EVENT_STATUSES) {
    const matches = eligible
      .filter((event) => normalizeStatus(event.status) === preferred)
      .sort(compareEventsNewestFirst);
    if (matches.length) return matches[0];
  }

  // No active/pending — do not fall back to excluded statuses.
  return null;
}

function mapLifecycleStateSafe(eventType) {
  try {
    return mapEventStageToRecruitmentLifecycleState(eventType);
  } catch {
    return null;
  }
}

/**
 * Derive authoritative stage from an in-memory events list (no DB).
 *
 * @param {Array<object>} events
 * @param {{ lifecycleStateProjection?: string|null, enterpriseCurrentStage?: string|null }} [projections]
 */
function deriveAuthoritativeStageFromEvents(events, projections = {}) {
  const authoritativeEvent = selectAuthoritativeEvent(events);
  const excluded = (Array.isArray(events) ? events : [])
    .filter((event) => EXCLUDED_EVENT_STATUSES.has(normalizeStatus(event && event.status)))
    .map((event) => ({
      id: event.id != null ? Number(event.id) : null,
      event_type: normalizeEventType(event.event_type),
      status: normalizeStatus(event.status)
    }));

  if (authoritativeEvent) {
    const eventType = normalizeEventType(authoritativeEvent.event_type);
    const lifecycleState =
      mapLifecycleStateSafe(eventType) ||
      projections.lifecycleStateProjection ||
      DEFAULT_RECRUITMENT_LIFECYCLE_STATE;
    return {
      authority: "event",
      eventId: authoritativeEvent.id != null ? Number(authoritativeEvent.id) : null,
      eventType,
      eventStatus: normalizeStatus(authoritativeEvent.status),
      lifecycleState,
      enterpriseStageProjection: eventType,
      projectionCaches: {
        lifecycle_state: projections.lifecycleStateProjection || null,
        current_stage: projections.enterpriseCurrentStage || null
      },
      projectionAligned: {
        lifecycle_state:
          !projections.lifecycleStateProjection ||
          String(projections.lifecycleStateProjection) === String(lifecycleState),
        current_stage:
          !projections.enterpriseCurrentStage ||
          normalizeEventType(projections.enterpriseCurrentStage) === eventType
      },
      excluded,
      message: null
    };
  }

  const cachedLifecycle =
    projections.lifecycleStateProjection || DEFAULT_RECRUITMENT_LIFECYCLE_STATE;
  return {
    authority: "projection_fallback",
    eventId: null,
    eventType: null,
    eventStatus: null,
    lifecycleState: cachedLifecycle,
    enterpriseStageProjection: projections.enterpriseCurrentStage || null,
    projectionCaches: {
      lifecycle_state: projections.lifecycleStateProjection || null,
      current_stage: projections.enterpriseCurrentStage || null
    },
    projectionAligned: {
      lifecycle_state: true,
      current_stage: true
    },
    excluded,
    message:
      "No active/pending Event — using cached lifecycle projection only. Page status does not determine stage."
  };
}

/**
 * Async resolver. Prefer passing events to avoid DB; otherwise loads by recruitmentId.
 *
 * @param {number|string} recruitmentId
 * @param {{
 *   events?: Array<object>,
 *   lifecycleStateProjection?: string|null,
 *   enterpriseCurrentStage?: string|null,
 *   listEvents?: Function
 * }} [opts]
 */
async function getAuthoritativeRecruitmentStage(recruitmentId, opts = {}) {
  const rid = parsePositiveId(recruitmentId);
  let events = Array.isArray(opts.events) ? opts.events : null;

  if (!events && rid) {
    const listEvents =
      typeof opts.listEvents === "function"
        ? opts.listEvents
        : async (id) => {
            const recruitmentEventRepository = require("../../repositories/recruitmentEvent.repository");
            const result = await recruitmentEventRepository.listRecruitmentEventsByRecruitmentId({
              recruitment_id: id,
              limit: 50,
              page: 1
            });
            return (result && result.data) || [];
          };
    events = await listEvents(rid);
  }

  return deriveAuthoritativeStageFromEvents(events || [], {
    lifecycleStateProjection: opts.lifecycleStateProjection || null,
    enterpriseCurrentStage: opts.enterpriseCurrentStage || null
  });
}

module.exports = {
  EXCLUDED_EVENT_STATUSES,
  PREFERRED_EVENT_STATUSES,
  selectAuthoritativeEvent,
  deriveAuthoritativeStageFromEvents,
  getAuthoritativeRecruitmentStage,
  compareEventsNewestFirst
};
