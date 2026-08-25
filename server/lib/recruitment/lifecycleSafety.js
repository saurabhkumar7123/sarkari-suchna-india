"use strict";

/**
 * Production persistence boundary for recruitment lifecycle writes.
 *
 * Advisory planners (PWP / AMP-1 / action planner / AI-3) may still emit
 * CREATE_NEW_RECRUITMENT. This module is the only gate that persistence
 * code is allowed to consult. Downstream / unknown events can never create
 * a recruitment, regardless of planner output.
 */

const ANNOUNCEMENT_EVENT_TYPES = Object.freeze(["notification", "short_notification"]);

const DOWNSTREAM_EVENT_TYPES = Object.freeze([
  "correction",
  "exam_date",
  "city_intimation",
  "admit_card",
  "answer_key",
  "objection",
  "result",
  "final_result",
  "dv",
  "medical",
  "joining"
]);

const MATCH_LEVELS = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  AMBIGUOUS: "AMBIGUOUS",
  HARD_NEGATIVE: "HARD_NEGATIVE",
  NO_MATCH: "NO_MATCH"
});

const CREATION_MODES = Object.freeze({
  FORBIDDEN: "forbidden",
  PROPOSE: "propose",
  ELIGIBLE: "eligible"
});

const PERSISTENCE_DECISIONS = Object.freeze({
  ATTACH: "ATTACH",
  NEEDS_MATCHING: "NEEDS_MATCHING",
  UNBOUND: "UNBOUND",
  CREATE_ELIGIBLE: "CREATE_ELIGIBLE",
  IGNORE: "IGNORE"
});

function normalizeEventType(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return text || "unknown";
}

function isAnnouncementEvent(eventType) {
  return ANNOUNCEMENT_EVENT_TYPES.includes(normalizeEventType(eventType));
}

function isDownstreamEvent(eventType) {
  return DOWNSTREAM_EVENT_TYPES.includes(normalizeEventType(eventType));
}

function isUnknownEvent(eventType) {
  const normalized = normalizeEventType(eventType);
  return normalized === "unknown" || normalized === "";
}

function hasHighIdentity(identity = {}) {
  const advertisementNo = String(identity.advertisementNo || identity.advertisement_no || "").trim();
  if (advertisementNo) return true;

  const organization = String(identity.organization || identity.department || "").trim();
  const examOrPost = String(identity.examName || identity.exam_name || identity.postName || identity.post_name || "").trim();
  const year = identity.recruitmentYear || identity.cycle_year || identity.cycleYear || identity.year;
  const yearOk = year != null && String(year).trim() !== "" && Number.isFinite(Number(year));
  return Boolean(organization && examOrPost && yearOk);
}

/**
 * Execution-boundary rule: recruitment rows may be created only for genuine
 * announcements with strong identity and no parent match.
 *
 * The worker may persist a recruitment only when mode === ELIGIBLE.
 * Downstream / unknown / Important Notice never reach ELIGIBLE.
 */
function evaluateRecruitmentCreation({ eventType, matchLevel, identity } = {}) {
  const type = normalizeEventType(eventType);
  const level = String(matchLevel || MATCH_LEVELS.NO_MATCH).toUpperCase();

  if (isDownstreamEvent(type) || isUnknownEvent(type)) {
    return Object.freeze({
      allowed: false,
      mode: CREATION_MODES.FORBIDDEN,
      reason: isDownstreamEvent(type)
        ? "downstream_event_cannot_create_recruitment"
        : "unknown_event_cannot_create_recruitment"
    });
  }

  if (!isAnnouncementEvent(type)) {
    return Object.freeze({
      allowed: false,
      mode: CREATION_MODES.FORBIDDEN,
      reason: "event_type_not_announcement"
    });
  }

  if (level === MATCH_LEVELS.HIGH || level === MATCH_LEVELS.AMBIGUOUS || level === MATCH_LEVELS.MEDIUM) {
    return Object.freeze({
      allowed: false,
      mode: CREATION_MODES.FORBIDDEN,
      reason: "parent_match_exists_or_is_ambiguous"
    });
  }

  if (level === MATCH_LEVELS.HARD_NEGATIVE) {
    return Object.freeze({
      allowed: false,
      mode: CREATION_MODES.FORBIDDEN,
      reason: "identity_hard_negative"
    });
  }

  if (!hasHighIdentity(identity)) {
    return Object.freeze({
      allowed: false,
      mode: CREATION_MODES.PROPOSE,
      reason: "announcement_identity_insufficient"
    });
  }

  return Object.freeze({
    allowed: true,
    mode: CREATION_MODES.ELIGIBLE,
    reason: "announcement_no_match_high_identity"
  });
}

/**
 * Block advisory CREATE_NEW_* decisions from reaching persistence for
 * downstream / unknown events.
 */
function guardPersistenceCreateDecision(advisoryDecision, eventType) {
  const decision = String(advisoryDecision || "").toUpperCase();
  const isCreate =
    decision.includes("CREATE_NEW") ||
    decision === "CREATE_NEW_RECRUITMENT" ||
    decision === "CREATE_NEW";

  if (!isCreate) {
    return Object.freeze({ allowed: false, blocked: false, reason: "not_a_create_decision" });
  }

  if (isDownstreamEvent(eventType) || isUnknownEvent(eventType)) {
    return Object.freeze({
      allowed: false,
      blocked: true,
      reason: "advisory_create_blocked_for_non_announcement"
    });
  }

  return Object.freeze({
    allowed: false,
    blocked: true,
    reason: "advisory_create_cannot_persist_directly"
  });
}

function resolvePersistenceDecision({
  eventType,
  matchLevel,
  identity,
  advisoryDecision
} = {}) {
  const type = normalizeEventType(eventType);
  const level = String(matchLevel || MATCH_LEVELS.NO_MATCH).toUpperCase();
  const createGuard = guardPersistenceCreateDecision(advisoryDecision, type);

  if (level === MATCH_LEVELS.HIGH) {
    return Object.freeze({
      decision: PERSISTENCE_DECISIONS.ATTACH,
      reason: "high_confidence_match",
      createGuard
    });
  }

  if (level === MATCH_LEVELS.AMBIGUOUS || level === MATCH_LEVELS.MEDIUM) {
    return Object.freeze({
      decision: PERSISTENCE_DECISIONS.NEEDS_MATCHING,
      reason: level === MATCH_LEVELS.AMBIGUOUS ? "ambiguous_match" : "medium_match_requires_human",
      createGuard
    });
  }

  if (level === MATCH_LEVELS.HARD_NEGATIVE) {
    return Object.freeze({
      decision: PERSISTENCE_DECISIONS.NEEDS_MATCHING,
      reason: "hard_negative_identity_conflict",
      createGuard
    });
  }

  const creation = evaluateRecruitmentCreation({ eventType: type, matchLevel: level, identity });
  if (isDownstreamEvent(type) || isUnknownEvent(type)) {
    return Object.freeze({
      decision: PERSISTENCE_DECISIONS.NEEDS_MATCHING,
      reason: "downstream_or_unknown_without_parent",
      createGuard,
      creation
    });
  }

  if (creation.mode === CREATION_MODES.ELIGIBLE) {
    return Object.freeze({
      decision: PERSISTENCE_DECISIONS.CREATE_ELIGIBLE,
      reason: creation.reason,
      createGuard,
      creation
    });
  }

  if (creation.mode === CREATION_MODES.PROPOSE) {
    return Object.freeze({
      decision: PERSISTENCE_DECISIONS.NEEDS_MATCHING,
      reason: creation.reason,
      createGuard,
      creation
    });
  }

  return Object.freeze({
    decision: PERSISTENCE_DECISIONS.UNBOUND,
    reason: creation.reason || "no_match_unbound",
    createGuard,
    creation
  });
}

function canAutoAttach(matchLevel) {
  return String(matchLevel || "").toUpperCase() === MATCH_LEVELS.HIGH;
}

module.exports = {
  ANNOUNCEMENT_EVENT_TYPES,
  DOWNSTREAM_EVENT_TYPES,
  MATCH_LEVELS,
  CREATION_MODES,
  PERSISTENCE_DECISIONS,
  normalizeEventType,
  isAnnouncementEvent,
  isDownstreamEvent,
  isUnknownEvent,
  hasHighIdentity,
  evaluateRecruitmentCreation,
  guardPersistenceCreateDecision,
  resolvePersistenceDecision,
  canAutoAttach
};
