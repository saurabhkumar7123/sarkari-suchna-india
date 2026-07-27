"use strict";

/**
 * Phase AI-2 — Event classification engine.
 *
 * Turns scored detection candidates into a single decided event type plus an
 * optional sub type, and normalizes the notice title. Unrecognised notices are
 * classified as `unknown` with their original wording preserved.
 */

const {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_TO_STAGE,
  EVENT_SUB_TYPES,
  EVENT_LIFECYCLE_STAGES
} = require("./types");
const { DETECTION_FLOOR, extractUnknownEventLabel } = require("./eventDetection");
const { collapse, round2, toKey } = require("./textUtils");

/**
 * How specific each event type is. When two candidates score within
 * `SPECIFICITY_MARGIN` of each other, the more specific one wins — otherwise a
 * generic "Notification" would swallow every notice that contains the word.
 */
const SPECIFICITY = Object.freeze({
  [EVENT_TYPES.FINAL_RESULT]: 10,
  [EVENT_TYPES.CANCELLATION]: 10,
  [EVENT_TYPES.CORRIGENDUM]: 9,
  [EVENT_TYPES.ADMIT_CARD]: 9,
  [EVENT_TYPES.ANSWER_KEY]: 9,
  [EVENT_TYPES.EXAM_CITY]: 9,
  [EVENT_TYPES.OBJECTION_WINDOW]: 9,
  [EVENT_TYPES.DV_SCHEDULE]: 9,
  [EVENT_TYPES.JOINING]: 9,
  [EVENT_TYPES.WALK_IN]: 9,
  [EVENT_TYPES.TENDER]: 9,
  [EVENT_TYPES.SCHOLARSHIP]: 9,
  [EVENT_TYPES.EXTENSION_NOTICE]: 9,
  [EVENT_TYPES.APPRENTICE]: 8,
  [EVENT_TYPES.CORRECTION]: 8,
  [EVENT_TYPES.RESULT]: 8,
  [EVENT_TYPES.EXAM_DATE]: 8,
  [EVENT_TYPES.DETAILED_ADVERTISEMENT]: 8,
  [EVENT_TYPES.SHORT_NOTICE]: 8,
  [EVENT_TYPES.PRESS_RELEASE]: 8,
  [EVENT_TYPES.REGISTRATION_CLOSE]: 7,
  [EVENT_TYPES.REGISTRATION_OPEN]: 7,
  [EVENT_TYPES.CONTRACT_RECRUITMENT]: 7,
  [EVENT_TYPES.ADMISSION]: 7,
  [EVENT_TYPES.APPLY_ONLINE]: 6,
  [EVENT_TYPES.NEW_RECRUITMENT]: 6,
  [EVENT_TYPES.RECRUITMENT_UPDATE]: 3,
  [EVENT_TYPES.NOTIFICATION]: 1,
  [EVENT_TYPES.UNKNOWN]: 0
});

const SPECIFICITY_MARGIN = 0.12;
const AMBIGUITY_MARGIN = 0.08;

/**
 * Event types that supersede another type whenever both are detected.
 * Prevents "Final Result" being reported as "Result".
 */
const SUPERSEDES = Object.freeze({
  [EVENT_TYPES.FINAL_RESULT]: [EVENT_TYPES.RESULT],
  [EVENT_TYPES.CORRIGENDUM]: [EVENT_TYPES.RECRUITMENT_UPDATE, EVENT_TYPES.NOTIFICATION],
  [EVENT_TYPES.EXTENSION_NOTICE]: [EVENT_TYPES.REGISTRATION_CLOSE, EVENT_TYPES.RECRUITMENT_UPDATE],
  [EVENT_TYPES.EXAM_CITY]: [EVENT_TYPES.EXAM_DATE],
  [EVENT_TYPES.DETAILED_ADVERTISEMENT]: [EVENT_TYPES.NOTIFICATION],
  [EVENT_TYPES.SHORT_NOTICE]: [EVENT_TYPES.NOTIFICATION],
  [EVENT_TYPES.WALK_IN]: [EVENT_TYPES.NEW_RECRUITMENT],
  [EVENT_TYPES.APPRENTICE]: [EVENT_TYPES.NEW_RECRUITMENT]
});

/** Sub types that only make sense for particular event types. */
const SUB_TYPE_SCOPE = Object.freeze({
  [EVENT_SUB_TYPES.FORM_CORRECTION]: [EVENT_TYPES.CORRECTION, EVENT_TYPES.CORRIGENDUM],
  [EVENT_SUB_TYPES.DATE_EXTENSION]: [EVENT_TYPES.EXTENSION_NOTICE, EVENT_TYPES.RECRUITMENT_UPDATE],
  [EVENT_SUB_TYPES.FEE_DATE_EXTENSION]: [EVENT_TYPES.EXTENSION_NOTICE],
  [EVENT_SUB_TYPES.CITY_INTIMATION]: [EVENT_TYPES.EXAM_CITY, EVENT_TYPES.ADMIT_CARD],
  [EVENT_SUB_TYPES.DOCUMENT_VERIFICATION]: [
    EVENT_TYPES.DV_SCHEDULE,
    EVENT_TYPES.RESULT,
    EVENT_TYPES.FINAL_RESULT
  ]
});

const TITLE_NOISE = [
  /\bclick\s+here\b/gi,
  /\bnew\s*!+/gi,
  /^\s*new\s+/i,
  /\bdownload\s+(?:pdf|here)\b/gi,
  /\bupdated?\s+on\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/gi,
  /\*+/g,
  /\u00bb|\u2192|\u27a4|\u25ba/g
];

/**
 * Clean a notice title without changing its meaning.
 * @param {string} raw
 * @returns {string}
 */
function normalizeTitle(raw) {
  let value = collapse(raw);
  if (!value) return "";
  for (const pattern of TITLE_NOISE) value = value.replace(pattern, " ");
  return collapse(value)
    .replace(/^[-–—:|,.\s]+/, "")
    .replace(/[-–—:|,\s]+$/, "")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * @param {Array<object>} titleCandidates
 * @returns {{ sourceTitle: string, titleSource: string|null, titleWeight: number }}
 */
function resolveTitle(titleCandidates = []) {
  const usable = titleCandidates
    .map((candidate) => ({ ...candidate, text: collapse(candidate.text) }))
    .filter((candidate) => candidate.text.length >= 3);
  if (!usable.length) return { sourceTitle: "", titleSource: null, titleWeight: 0 };

  // Prefer the highest-weight candidate that actually looks like a notice title.
  const scored = usable
    .map((candidate) => {
      const wordCount = candidate.text.split(/\s+/).length;
      const lengthPenalty = candidate.text.length > 200 ? 0.25 : 0;
      const stubPenalty = wordCount < 2 ? 0.2 : 0;
      return { ...candidate, effective: candidate.weight - lengthPenalty - stubPenalty };
    })
    .sort((a, b) => b.effective - a.effective);

  const best = scored[0];
  return {
    sourceTitle: best.text,
    titleSource: best.source || null,
    titleWeight: round2(Math.max(0, best.effective))
  };
}

/**
 * Apply supersede rules and specificity tie-breaking.
 * @param {Array<object>} candidates
 * @returns {Array<object>}
 */
function rankCandidates(candidates = []) {
  const eligible = candidates.filter((candidate) => candidate.score >= DETECTION_FLOOR);
  const suppressed = new Set();

  for (const candidate of eligible) {
    for (const loser of SUPERSEDES[candidate.eventType] || []) {
      const other = eligible.find((item) => item.eventType === loser);
      if (other && candidate.score >= other.score - SPECIFICITY_MARGIN) suppressed.add(loser);
    }
  }

  return eligible
    .filter((candidate) => !suppressed.has(candidate.eventType))
    .map((candidate) => ({
      ...candidate,
      specificity: SPECIFICITY[candidate.eventType] ?? 0
    }))
    .sort((a, b) => {
      if (Math.abs(a.score - b.score) <= SPECIFICITY_MARGIN && a.specificity !== b.specificity) {
        return b.specificity - a.specificity;
      }
      return b.score - a.score || b.specificity - a.specificity;
    });
}

/**
 * @param {string} eventType
 * @param {Array<object>} subTypeCandidates
 * @returns {{ subType: string|null, matchedText: string|null, score: number }}
 */
function resolveSubType(eventType, subTypeCandidates = []) {
  const allowed = subTypeCandidates.filter((candidate) => {
    const scope = SUB_TYPE_SCOPE[candidate.subType];
    return !scope || scope.includes(eventType);
  });
  if (!allowed.length) return { subType: null, matchedText: null, score: 0 };

  // A sub type that merely repeats the event type carries no extra information.
  const redundant = new Set();
  if (eventType === EVENT_TYPES.FINAL_RESULT) redundant.add(EVENT_SUB_TYPES.FINAL);
  if (eventType === EVENT_TYPES.DV_SCHEDULE) redundant.add(EVENT_SUB_TYPES.DOCUMENT_VERIFICATION);
  if (eventType === EVENT_TYPES.EXAM_CITY) redundant.add(EVENT_SUB_TYPES.CITY_INTIMATION);
  if (eventType === EVENT_TYPES.CORRECTION) redundant.add(EVENT_SUB_TYPES.FORM_CORRECTION);

  const best = allowed.find((candidate) => !redundant.has(candidate.subType)) || allowed[0];
  return { subType: best.subType, matchedText: best.matchedText, score: best.score };
}

/**
 * Decide the event type for a notice.
 *
 * @param {{
 *   analysis: object,
 *   candidates: Array<object>,
 *   subTypeCandidates: Array<object>
 * }} input
 * @returns {object}
 */
function classifyEvent(input = {}) {
  const analysis = input.analysis || {};
  const ranked = rankCandidates(input.candidates || []);
  const { sourceTitle, titleSource, titleWeight } = resolveTitle(analysis.titleCandidates || []);
  const normalizedTitle = normalizeTitle(sourceTitle);

  const primary = ranked[0] || null;
  const runnerUp = ranked[1] || null;
  const eventType = primary ? primary.eventType : EVENT_TYPES.UNKNOWN;
  const isKnownEventType = eventType !== EVENT_TYPES.UNKNOWN;
  const rawEventLabel = extractUnknownEventLabel({
    title: sourceTitle,
    lines: analysis.lines
  });

  const subType = resolveSubType(eventType, input.subTypeCandidates || []);
  const margin = primary && runnerUp ? round2(primary.score - runnerUp.score) : null;

  return {
    eventType,
    eventTypeLabel: EVENT_TYPE_LABELS[eventType] || EVENT_TYPE_LABELS[EVENT_TYPES.UNKNOWN],
    eventSubType: subType.subType,
    eventSubTypeEvidence: subType.matchedText,
    lifecycleStage: EVENT_TYPE_TO_STAGE[eventType] || EVENT_LIFECYCLE_STAGES.UNKNOWN,
    isKnownEventType,
    // Original wording is always kept, even when the type is recognised.
    rawEventLabel,
    classificationScore: primary ? primary.score : 0,
    evidence: primary ? primary.evidence : [],
    candidates: ranked.slice(0, 5).map((candidate) => ({
      eventType: candidate.eventType,
      score: candidate.score,
      specificity: candidate.specificity,
      topZone: candidate.topZone
    })),
    ambiguity: {
      isAmbiguous: Boolean(runnerUp && margin !== null && margin <= AMBIGUITY_MARGIN),
      runnerUpEventType: runnerUp ? runnerUp.eventType : null,
      margin
    },
    sourceTitle,
    titleSource,
    titleWeight,
    normalizedTitle,
    normalizedTitleKey: toKey(normalizedTitle)
  };
}

module.exports = {
  SPECIFICITY,
  SPECIFICITY_MARGIN,
  AMBIGUITY_MARGIN,
  SUPERSEDES,
  normalizeTitle,
  resolveTitle,
  rankCandidates,
  resolveSubType,
  classifyEvent
};
