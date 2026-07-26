"use strict";

/**
 * CIP Stage 1E — deterministic validation rules and scoring weights.
 * Reuses Stage 1A document types, Stage 1B metadata fields, and
 * Stage 1C+1D section/block taxonomies. No AI / randomness.
 */

const { DOCUMENT_TYPES, UNKNOWN_DOCUMENT_TYPE } = require("../documentClassification/documentTypes");
const { METADATA_FIELDS, IMPORTANT_DATE_FIELDS } = require("../metadataIntelligence/metadataFields");
const {
  SECTION_TYPES,
  SECTION_TYPE_LIST,
  UNKNOWN_SECTION_TYPE
} = require("../structureIntelligence/structureTypes");

/** Canonical preferred section order for recruitment-style documents. */
const PREFERRED_SECTION_ORDER = Object.freeze([
  SECTION_TYPES.SHORT_INFORMATION,
  SECTION_TYPES.IMPORTANT_DATES,
  SECTION_TYPES.APPLICATION_FEE,
  SECTION_TYPES.AGE_LIMIT,
  SECTION_TYPES.QUALIFICATION,
  SECTION_TYPES.VACANCY_DETAILS,
  SECTION_TYPES.SELECTION_PROCESS,
  SECTION_TYPES.EXAM_PATTERN,
  SECTION_TYPES.SYLLABUS,
  SECTION_TYPES.HOW_TO_APPLY,
  SECTION_TYPES.IMPORTANT_LINKS,
  SECTION_TYPES.FAQ,
  SECTION_TYPES.ADMIT_CARD,
  SECTION_TYPES.RESULT,
  SECTION_TYPES.ANSWER_KEY,
  SECTION_TYPES.CORRECTION,
  SECTION_TYPES.NOTICE,
  SECTION_TYPES.IMPORTANT_INSTRUCTIONS
]);

/**
 * Required metadata fields by document type.
 * Always includes title when any document is validated.
 */
const REQUIRED_METADATA_BY_TYPE = Object.freeze({
  new_recruitment: Object.freeze(["title", "organization", "detectedDocumentType"]),
  admit_card: Object.freeze(["title", "detectedDocumentType"]),
  result: Object.freeze(["title", "detectedDocumentType"]),
  answer_key: Object.freeze(["title", "detectedDocumentType"]),
  correction_notice: Object.freeze(["title", "detectedDocumentType"]),
  short_notice: Object.freeze(["title", "detectedDocumentType"]),
  important_notice: Object.freeze(["title", "detectedDocumentType"]),
  age_relaxation_notice: Object.freeze(["title", "detectedDocumentType"]),
  exam_pattern: Object.freeze(["title", "detectedDocumentType"]),
  syllabus: Object.freeze(["title", "detectedDocumentType"]),
  document: Object.freeze(["title"]),
  unknown: Object.freeze(["title"])
});

/**
 * Required CIP section types by document type.
 * Unknown/custom sections never count toward fulfillment.
 */
const REQUIRED_SECTIONS_BY_TYPE = Object.freeze({
  new_recruitment: Object.freeze([
    SECTION_TYPES.SHORT_INFORMATION,
    SECTION_TYPES.IMPORTANT_DATES,
    SECTION_TYPES.IMPORTANT_LINKS
  ]),
  admit_card: Object.freeze([SECTION_TYPES.ADMIT_CARD, SECTION_TYPES.IMPORTANT_LINKS]),
  result: Object.freeze([SECTION_TYPES.RESULT, SECTION_TYPES.IMPORTANT_LINKS]),
  answer_key: Object.freeze([SECTION_TYPES.ANSWER_KEY, SECTION_TYPES.IMPORTANT_LINKS]),
  correction_notice: Object.freeze([SECTION_TYPES.CORRECTION]),
  short_notice: Object.freeze([SECTION_TYPES.NOTICE]),
  important_notice: Object.freeze([SECTION_TYPES.NOTICE, SECTION_TYPES.IMPORTANT_INSTRUCTIONS]),
  age_relaxation_notice: Object.freeze([SECTION_TYPES.AGE_LIMIT]),
  exam_pattern: Object.freeze([SECTION_TYPES.EXAM_PATTERN]),
  syllabus: Object.freeze([SECTION_TYPES.SYLLABUS]),
  document: Object.freeze([]),
  unknown: Object.freeze([])
});

/** Sections that are unexpected (not wrong, but flagged) for certain types. */
const UNEXPECTED_SECTIONS_BY_TYPE = Object.freeze({
  admit_card: Object.freeze([SECTION_TYPES.RESULT, SECTION_TYPES.ANSWER_KEY]),
  result: Object.freeze([SECTION_TYPES.ADMIT_CARD, SECTION_TYPES.APPLICATION_FEE]),
  answer_key: Object.freeze([SECTION_TYPES.APPLICATION_FEE, SECTION_TYPES.HOW_TO_APPLY]),
  syllabus: Object.freeze([SECTION_TYPES.APPLICATION_FEE, SECTION_TYPES.HOW_TO_APPLY]),
  exam_pattern: Object.freeze([SECTION_TYPES.APPLICATION_FEE, SECTION_TYPES.HOW_TO_APPLY])
});

/** Date fields that should chronologically precede others when both present. */
const DATE_ORDER_PAIRS = Object.freeze([
  Object.freeze(["notificationDate", "startDate"]),
  Object.freeze(["startDate", "lastDate"]),
  Object.freeze(["lastDate", "examDate"]),
  Object.freeze(["admitCardDate", "examDate"]),
  Object.freeze(["examDate", "answerKeyDate"]),
  Object.freeze(["examDate", "resultDate"]),
  Object.freeze(["answerKeyDate", "resultDate"])
]);

/**
 * Deterministic score deductions (points from a 100 base).
 * Documented scoring model — no randomness.
 */
const SCORE_DEDUCTIONS = Object.freeze({
  error: 12,
  warning: 4,
  info: 1
});

const CATEGORY_SCORE_WEIGHTS = Object.freeze({
  metadata: 0.2,
  section: 0.25,
  block: 0.2,
  generatorCompatibility: 0.2,
  completeness: 0.15
});

/** Publish readiness thresholds (deterministic). */
const PUBLISH_THRESHOLDS = Object.freeze({
  readyMinOverall: 75,
  readyMinGenerator: 70,
  needsReviewMinOverall: 45,
  maxErrorsForReady: 0,
  maxErrorsForNeedsReview: 5
});

/** Generator-compatible canonical titles (publisher alias targets). */
const GENERATOR_KNOWN_TITLES = Object.freeze([
  "Short Information",
  "Important Dates",
  "Application Fee",
  "Age Limit",
  "Qualification",
  "Vacancy Details",
  "Vacancy",
  "Eligibility",
  "Selection Process",
  "How To Apply",
  "Important Links",
  "FAQ",
  "Important Questions",
  "Exam Pattern",
  "Syllabus",
  "Result",
  "Admit Card",
  "Answer Key",
  "Correction",
  "Notice",
  "Important Instructions"
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getRequiredMetadata(documentType) {
  const type = DOCUMENT_TYPES.includes(documentType) ? documentType : UNKNOWN_DOCUMENT_TYPE;
  return REQUIRED_METADATA_BY_TYPE[type] || REQUIRED_METADATA_BY_TYPE.unknown;
}

function getRequiredSections(documentType) {
  const type = DOCUMENT_TYPES.includes(documentType) ? documentType : UNKNOWN_DOCUMENT_TYPE;
  return REQUIRED_SECTIONS_BY_TYPE[type] || REQUIRED_SECTIONS_BY_TYPE.unknown;
}

function getUnexpectedSections(documentType) {
  return UNEXPECTED_SECTIONS_BY_TYPE[documentType] || [];
}

function preferredOrderIndex(sectionType) {
  const idx = PREFERRED_SECTION_ORDER.indexOf(sectionType);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

module.exports = {
  PREFERRED_SECTION_ORDER,
  REQUIRED_METADATA_BY_TYPE,
  REQUIRED_SECTIONS_BY_TYPE,
  UNEXPECTED_SECTIONS_BY_TYPE,
  DATE_ORDER_PAIRS,
  SCORE_DEDUCTIONS,
  CATEGORY_SCORE_WEIGHTS,
  PUBLISH_THRESHOLDS,
  GENERATOR_KNOWN_TITLES,
  ISO_DATE_RE,
  METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS,
  SECTION_TYPE_LIST,
  UNKNOWN_SECTION_TYPE,
  getRequiredMetadata,
  getRequiredSections,
  getUnexpectedSections,
  preferredOrderIndex
};
