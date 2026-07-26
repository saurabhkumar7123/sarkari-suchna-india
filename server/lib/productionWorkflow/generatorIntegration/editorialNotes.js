"use strict";

/**
 * PWP Phase 3 — Structured editorial notes (metadata only).
 */

const {
  CHANGE_TYPES
} = require("../../contentIntelligence/multiSourceCorrelation/correlationTypes");
const { RESOLUTION_DECISIONS } = require("../recruitmentResolution/resolutionTypes");
const { EDITORIAL_NOTE_CODES } = require("./integrationTypes");

const CHANGE_TYPE_TO_NOTE = Object.freeze({
  [CHANGE_TYPES.IMPORTANT_DATE]: EDITORIAL_NOTE_CODES.UPDATED_DATES,
  [CHANGE_TYPES.VACANCY_COUNT]: EDITORIAL_NOTE_CODES.UPDATED_VACANCY_COUNT,
  [CHANGE_TYPES.APPLICATION_FEE]: EDITORIAL_NOTE_CODES.UPDATED_FEE,
  [CHANGE_TYPES.ELIGIBILITY]: EDITORIAL_NOTE_CODES.UPDATED_ELIGIBILITY,
  [CHANGE_TYPES.OFFICIAL_LINK]: EDITORIAL_NOTE_CODES.UPDATED_LINKS,
  [CHANGE_TYPES.EXAM_SCHEDULE]: EDITORIAL_NOTE_CODES.UPDATED_EXAM_SCHEDULE,
  [CHANGE_TYPES.NOTIFICATION_VERSION]: EDITORIAL_NOTE_CODES.UPDATED_NOTIFICATION_VERSION,
  [CHANGE_TYPES.DOCUMENT_REVISION]: EDITORIAL_NOTE_CODES.UPDATED_NOTIFICATION_VERSION,
  [CHANGE_TYPES.SECTION_ADDED]: EDITORIAL_NOTE_CODES.SECTION_ADDED,
  [CHANGE_TYPES.SECTION_REMOVED]: EDITORIAL_NOTE_CODES.SECTION_REMOVED
});

const ROLE_HINT_TO_NOTE = Object.freeze({
  result: EDITORIAL_NOTE_CODES.UPDATED_RESULT,
  admit_card: EDITORIAL_NOTE_CODES.UPDATED_ADMIT_CARD,
  answer_key: EDITORIAL_NOTE_CODES.UPDATED_ANSWER_KEY
});

function uniqueNotes(notes) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    if (!note || seen.has(note)) continue;
    seen.add(note);
    out.push(note);
  }
  return out;
}

function notesFromChangeSummary(changeSummary) {
  const notes = [];
  const details =
    (changeSummary && Array.isArray(changeSummary.details) && changeSummary.details) || [];
  const changeTypes =
    (changeSummary && Array.isArray(changeSummary.changeTypes) && changeSummary.changeTypes) ||
    details.map((d) => d && d.changeType).filter(Boolean);

  for (const changeType of changeTypes) {
    if (CHANGE_TYPE_TO_NOTE[changeType]) {
      notes.push(CHANGE_TYPE_TO_NOTE[changeType]);
    }
  }

  for (const detail of details) {
    const field = String((detail && detail.field) || "").toLowerCase();
    const section = String((detail && detail.section) || "").toLowerCase();
    const blob = `${field} ${section}`;
    if (/result/.test(blob)) notes.push(EDITORIAL_NOTE_CODES.UPDATED_RESULT);
    if (/admit.?card/.test(blob)) notes.push(EDITORIAL_NOTE_CODES.UPDATED_ADMIT_CARD);
    if (/answer.?key/.test(blob)) notes.push(EDITORIAL_NOTE_CODES.UPDATED_ANSWER_KEY);
  }

  return notes;
}

function notesFromRoleHints(workflowContext = {}) {
  const notes = [];
  const event = workflowContext.monitoringEvent || {};
  const role =
    String(
      workflowContext.documentRole ||
        event.documentRole ||
        event.contentRole ||
        event.role ||
        ""
    ).toLowerCase();
  if (ROLE_HINT_TO_NOTE[role]) notes.push(ROLE_HINT_TO_NOTE[role]);

  const title = String(event.title || workflowContext.title || "").toLowerCase();
  if (/\bresult\b/.test(title)) notes.push(EDITORIAL_NOTE_CODES.UPDATED_RESULT);
  if (/admit\s*card/.test(title)) notes.push(EDITORIAL_NOTE_CODES.UPDATED_ADMIT_CARD);
  if (/answer\s*key/.test(title)) notes.push(EDITORIAL_NOTE_CODES.UPDATED_ANSWER_KEY);
  return notes;
}

/**
 * Build deterministic structured editorial notes for a resolution decision.
 */
function buildEditorialNotes({
  decision,
  updatePlan = null,
  workflowContext = {},
  existingRecruitment = null
} = {}) {
  const notes = [];

  switch (decision) {
    case RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT:
      notes.push(EDITORIAL_NOTE_CODES.NEW_RECRUITMENT);
      break;
    case RESOLUTION_DECISIONS.CREATE_NEW_PAGE:
      notes.push(EDITORIAL_NOTE_CODES.EXISTING_RECRUITMENT);
      notes.push(EDITORIAL_NOTE_CODES.NEW_PAGE);
      break;
    case RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE:
      notes.push(EDITORIAL_NOTE_CODES.EXISTING_RECRUITMENT);
      notes.push(EDITORIAL_NOTE_CODES.PAGE_UPDATE);
      notes.push(...notesFromChangeSummary(updatePlan && updatePlan.changeSummary));
      notes.push(...notesFromRoleHints(workflowContext));
      break;
    case RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT:
      notes.push(EDITORIAL_NOTE_CODES.EXISTING_RECRUITMENT);
      notes.push(EDITORIAL_NOTE_CODES.RECRUITMENT_METADATA_UPDATE);
      notes.push(...notesFromChangeSummary(updatePlan && updatePlan.changeSummary));
      break;
    case RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED:
      notes.push(EDITORIAL_NOTE_CODES.MANUAL_REVIEW);
      if (existingRecruitment) notes.push(EDITORIAL_NOTE_CODES.EXISTING_RECRUITMENT);
      break;
    case RESOLUTION_DECISIONS.IGNORE_DUPLICATE:
      notes.push(EDITORIAL_NOTE_CODES.DUPLICATE_IGNORED);
      break;
    case RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT:
      notes.push(EDITORIAL_NOTE_CODES.SUPERSEDED_IGNORED);
      break;
    default:
      break;
  }

  return uniqueNotes(notes);
}

module.exports = {
  CHANGE_TYPE_TO_NOTE,
  buildEditorialNotes,
  notesFromChangeSummary,
  notesFromRoleHints
};
