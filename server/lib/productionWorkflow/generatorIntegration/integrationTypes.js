"use strict";

/**
 * PWP Phase 3 — Generator Integration taxonomy.
 * Deterministic constants only. No AI. No rendering.
 */

const ENGINE_ID = "PWP_GENERATOR_INTEGRATION_LAYER";
const ENGINE_VERSION = "1.0.0";
const PHASE = "PHASE_3";
const DRAFT_PACKAGE_FORMAT_ID = "pwp_generator_draft_package_v1";
const GENERATOR_CONTRACT_FORMAT_ID = "pwp_generator_contract_v1";

/** Draft package kinds prepared for the existing Generator. */
const DRAFT_TYPES = Object.freeze({
  FULL_RECRUITMENT_DRAFT: "FULL_RECRUITMENT_DRAFT",
  FULL_PAGE_DRAFT: "FULL_PAGE_DRAFT",
  PAGE_UPDATE_DRAFT: "PAGE_UPDATE_DRAFT",
  RECRUITMENT_METADATA_UPDATE: "RECRUITMENT_METADATA_UPDATE",
  REVIEW_ONLY: "REVIEW_ONLY",
  NONE: "NONE"
});

/** Explicit section actions — Generator must never guess. */
const SECTION_ACTIONS = Object.freeze({
  ADD: "ADD",
  UPDATE: "UPDATE",
  REMOVE: "REMOVE",
  NO_CHANGE: "NO_CHANGE"
});

/** Structured editorial note codes (metadata only). */
const EDITORIAL_NOTE_CODES = Object.freeze({
  NEW_RECRUITMENT: "New Recruitment",
  EXISTING_RECRUITMENT: "Existing Recruitment",
  UPDATED_DATES: "Updated Dates",
  UPDATED_VACANCY_COUNT: "Updated Vacancy Count",
  UPDATED_FEE: "Updated Fee",
  UPDATED_ELIGIBILITY: "Updated Eligibility",
  UPDATED_LINKS: "Updated Links",
  UPDATED_RESULT: "Updated Result",
  UPDATED_ADMIT_CARD: "Updated Admit Card",
  UPDATED_ANSWER_KEY: "Updated Answer Key",
  UPDATED_EXAM_SCHEDULE: "Updated Exam Schedule",
  UPDATED_NOTIFICATION_VERSION: "Updated Notification Version",
  SECTION_ADDED: "Section Added",
  SECTION_REMOVED: "Section Removed",
  MANUAL_REVIEW: "Manual Review Required",
  DUPLICATE_IGNORED: "Duplicate Ignored",
  SUPERSEDED_IGNORED: "Superseded Document Ignored",
  RECRUITMENT_METADATA_UPDATE: "Recruitment Metadata Update",
  PAGE_UPDATE: "Existing Page Update",
  NEW_PAGE: "New Page Draft"
});

/** Decisions that produce a Generator-facing package. */
const GENERATOR_PACKAGE_DECISIONS = Object.freeze([
  "CREATE_NEW_RECRUITMENT",
  "CREATE_NEW_PAGE",
  "UPDATE_EXISTING_PAGE",
  "UPDATE_EXISTING_RECRUITMENT"
]);

/** Decisions that produce no Generator package. */
const NO_PACKAGE_DECISIONS = Object.freeze([
  "IGNORE_DUPLICATE",
  "SUPERSEDED_DOCUMENT"
]);

/** Decisions that produce a review-only package (no Generator call). */
const REVIEW_ONLY_DECISIONS = Object.freeze(["MANUAL_REVIEW_REQUIRED"]);

module.exports = {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  DRAFT_PACKAGE_FORMAT_ID,
  GENERATOR_CONTRACT_FORMAT_ID,
  DRAFT_TYPES,
  SECTION_ACTIONS,
  EDITORIAL_NOTE_CODES,
  GENERATOR_PACKAGE_DECISIONS,
  NO_PACKAGE_DECISIONS,
  REVIEW_ONLY_DECISIONS
};
