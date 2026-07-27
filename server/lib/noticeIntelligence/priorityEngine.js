"use strict";

/**
 * Phase AI-2 — Priority engine.
 *
 * Assigns an advisory priority to a classified event. Priority is a hint for
 * downstream review ordering only; it does not gate or trigger any workflow.
 */

const { EVENT_TYPES, PRIORITY_LEVELS, PRIORITY_RANK } = require("./types");
const { clamp, round2 } = require("./textUtils");

/** Baseline priority per event type. */
const BASE_PRIORITY = Object.freeze({
  [EVENT_TYPES.RESULT]: PRIORITY_LEVELS.CRITICAL,
  [EVENT_TYPES.FINAL_RESULT]: PRIORITY_LEVELS.CRITICAL,
  [EVENT_TYPES.ADMIT_CARD]: PRIORITY_LEVELS.CRITICAL,

  [EVENT_TYPES.ANSWER_KEY]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.EXAM_DATE]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.EXAM_CITY]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.NEW_RECRUITMENT]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.DETAILED_ADVERTISEMENT]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.DV_SCHEDULE]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.CANCELLATION]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.REGISTRATION_CLOSE]: PRIORITY_LEVELS.HIGH,
  [EVENT_TYPES.OBJECTION_WINDOW]: PRIORITY_LEVELS.HIGH,

  [EVENT_TYPES.CORRECTION]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.CORRIGENDUM]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.EXTENSION_NOTICE]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.APPLY_ONLINE]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.REGISTRATION_OPEN]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.RECRUITMENT_UPDATE]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.SHORT_NOTICE]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.JOINING]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.APPRENTICE]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.WALK_IN]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.CONTRACT_RECRUITMENT]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.ADMISSION]: PRIORITY_LEVELS.MEDIUM,
  [EVENT_TYPES.NOTIFICATION]: PRIORITY_LEVELS.MEDIUM,

  [EVENT_TYPES.PRESS_RELEASE]: PRIORITY_LEVELS.LOW,
  [EVENT_TYPES.TENDER]: PRIORITY_LEVELS.LOW,
  [EVENT_TYPES.SCHOLARSHIP]: PRIORITY_LEVELS.LOW,
  [EVENT_TYPES.UNKNOWN]: PRIORITY_LEVELS.LOW
});

const BASE_SCORE = Object.freeze({
  [PRIORITY_LEVELS.CRITICAL]: 0.9,
  [PRIORITY_LEVELS.HIGH]: 0.7,
  [PRIORITY_LEVELS.MEDIUM]: 0.45,
  [PRIORITY_LEVELS.LOW]: 0.2
});

/**
 * Thresholds sit above the reachable ceiling of the tier below, so positive
 * modifiers order events inside a band instead of promoting every confident
 * recruitment notice into CRITICAL.
 */
const SCORE_THRESHOLDS = Object.freeze({
  CRITICAL: 0.86,
  HIGH: 0.62,
  MEDIUM: 0.4
});

const URGENT_SUB_TYPES = new Set(["revised", "postponed", "re_exam", "withdrawn"]);
const MINOR_NOTICE_TYPES = new Set([
  EVENT_TYPES.NOTIFICATION,
  EVENT_TYPES.RECRUITMENT_UPDATE,
  EVENT_TYPES.UNKNOWN
]);

const RECENT_WINDOW_DAYS = 7;

/**
 * @param {number} score
 * @returns {string}
 */
function scoreToPriority(score) {
  if (score >= SCORE_THRESHOLDS.CRITICAL) return PRIORITY_LEVELS.CRITICAL;
  if (score >= SCORE_THRESHOLDS.HIGH) return PRIORITY_LEVELS.HIGH;
  if (score >= SCORE_THRESHOLDS.MEDIUM) return PRIORITY_LEVELS.MEDIUM;
  return PRIORITY_LEVELS.LOW;
}

/**
 * @param {string|null} isoDate
 * @param {Date} now
 * @returns {number|null}
 */
function daysSince(isoDate, now) {
  if (!isoDate) return null;
  const published = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(published)) return null;
  return Math.floor((now.getTime() - published) / 86400000);
}

/**
 * Assign advisory priority for a classified notice event.
 *
 * @param {{
 *   classification: object,
 *   references?: object,
 *   department?: object,
 *   recruitmentCandidate?: object,
 *   analysis?: object,
 *   overallConfidence?: number
 * }} input
 * @param {{ now?: Date }} [options]
 * @returns {{
 *   priority: string,
 *   rank: number,
 *   basePriority: string,
 *   score: number,
 *   modifiers: Array<object>,
 *   reasons: string[]
 * }}
 */
function assignPriority(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const classification = input.classification || {};
  const references = input.references || {};
  const department = input.department || {};
  const analysis = input.analysis || {};
  const recruitmentCandidate = input.recruitmentCandidate || {};
  const eventType = classification.eventType || EVENT_TYPES.UNKNOWN;

  const basePriority = BASE_PRIORITY[eventType] || PRIORITY_LEVELS.LOW;
  let score = BASE_SCORE[basePriority];
  const modifiers = [];
  const reasons = [`Base priority ${basePriority} for event type "${eventType}".`];

  const addModifier = (name, delta, reason) => {
    if (!delta) return;
    score += delta;
    modifiers.push({ name, delta: round2(delta), reason });
    reasons.push(reason);
  };

  if (recruitmentCandidate.isRecruitmentCandidate) {
    addModifier(
      "recruitment_candidate",
      0.06,
      "Notice is a recruitment matching candidate, so it is more actionable."
    );
  }

  const age = daysSince(references.publicationDate, now);
  if (age !== null && age >= 0 && age <= RECENT_WINDOW_DAYS) {
    addModifier(
      "recent_publication",
      0.05,
      `Published ${age} day(s) ago, within the ${RECENT_WINDOW_DAYS}-day recency window.`
    );
  }

  if (Number(classification.classificationScore) >= 0.85) {
    addModifier("strong_classification", 0.04, "Event type was detected with strong evidence.");
  }

  if (URGENT_SUB_TYPES.has(classification.eventSubType)) {
    addModifier(
      "urgent_sub_type",
      0.05,
      `Sub type "${classification.eventSubType}" indicates a change candidates must act on.`
    );
  }

  const overallConfidence = Number(input.overallConfidence);
  if (Number.isFinite(overallConfidence) && overallConfidence < 0.5) {
    addModifier(
      "low_confidence",
      -0.1,
      "Overall classification confidence is below 0.5, so priority is reduced pending review."
    );
  }

  const looksMinor =
    MINOR_NOTICE_TYPES.has(eventType) &&
    !department.isKnownOrganization &&
    !references.advertisementNumber &&
    Number(analysis.characterCount || 0) < 400;
  if (looksMinor) {
    addModifier(
      "minor_website_notice",
      -0.08,
      "Short generic website notice with no identified department or advertisement number."
    );
  }

  if (eventType === EVENT_TYPES.UNKNOWN) {
    addModifier("unknown_event_type", -0.05, "Event type could not be recognised.");
  }

  const finalScore = round2(clamp(score, 0, 1));
  const priority = scoreToPriority(finalScore);

  return {
    priority,
    rank: PRIORITY_RANK[priority],
    basePriority,
    score: finalScore,
    modifiers,
    reasons
  };
}

module.exports = {
  BASE_PRIORITY,
  BASE_SCORE,
  SCORE_THRESHOLDS,
  scoreToPriority,
  daysSince,
  assignPriority
};
