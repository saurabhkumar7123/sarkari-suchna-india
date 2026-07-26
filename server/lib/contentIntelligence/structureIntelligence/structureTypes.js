"use strict";

/**
 * CIP Combined Stage 1C + 1D — shared section + block taxonomy.
 * Extensible: add a section type here plus a rule in sectionRules.js,
 * or a block type here plus a builder in blockEngine.js.
 */

const SECTION_TYPES = Object.freeze({
  SHORT_INFORMATION: "short_information",
  IMPORTANT_DATES: "important_dates",
  APPLICATION_FEE: "application_fee",
  AGE_LIMIT: "age_limit",
  QUALIFICATION: "qualification",
  VACANCY_DETAILS: "vacancy_details",
  SELECTION_PROCESS: "selection_process",
  HOW_TO_APPLY: "how_to_apply",
  IMPORTANT_LINKS: "important_links",
  FAQ: "faq",
  EXAM_PATTERN: "exam_pattern",
  SYLLABUS: "syllabus",
  RESULT: "result",
  ADMIT_CARD: "admit_card",
  ANSWER_KEY: "answer_key",
  CORRECTION: "correction",
  NOTICE: "notice",
  IMPORTANT_INSTRUCTIONS: "important_instructions"
});

const SECTION_TYPE_LIST = Object.freeze(Object.values(SECTION_TYPES));

const UNKNOWN_SECTION_TYPE = "unknown";

/** Canonical display titles per CIP section type. */
const SECTION_CANONICAL_TITLES = Object.freeze({
  [SECTION_TYPES.SHORT_INFORMATION]: "Short Information",
  [SECTION_TYPES.IMPORTANT_DATES]: "Important Dates",
  [SECTION_TYPES.APPLICATION_FEE]: "Application Fee",
  [SECTION_TYPES.AGE_LIMIT]: "Age Limit",
  [SECTION_TYPES.QUALIFICATION]: "Qualification",
  [SECTION_TYPES.VACANCY_DETAILS]: "Vacancy Details",
  [SECTION_TYPES.SELECTION_PROCESS]: "Selection Process",
  [SECTION_TYPES.HOW_TO_APPLY]: "How To Apply",
  [SECTION_TYPES.IMPORTANT_LINKS]: "Important Links",
  [SECTION_TYPES.FAQ]: "FAQ",
  [SECTION_TYPES.EXAM_PATTERN]: "Exam Pattern",
  [SECTION_TYPES.SYLLABUS]: "Syllabus",
  [SECTION_TYPES.RESULT]: "Result",
  [SECTION_TYPES.ADMIT_CARD]: "Admit Card",
  [SECTION_TYPES.ANSWER_KEY]: "Answer Key",
  [SECTION_TYPES.CORRECTION]: "Correction",
  [SECTION_TYPES.NOTICE]: "Notice",
  [SECTION_TYPES.IMPORTANT_INSTRUCTIONS]: "Important Instructions"
});

const BLOCK_TYPES = Object.freeze({
  PARAGRAPH: "paragraph",
  TABLE: "table",
  KEY_VALUE: "key_value",
  DATE_ROW: "date_row",
  LIST: "list",
  FAQ: "faq",
  LINK: "link",
  MULTI_LINK: "multi_link",
  MIXED: "mixed",
  RICH_TEXT: "rich_text"
});

const BLOCK_TYPE_LIST = Object.freeze(Object.values(BLOCK_TYPES));

const UNKNOWN_BLOCK_TYPE = "unknown";

const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

function isKnownSectionType(type) {
  return SECTION_TYPE_LIST.includes(type);
}

function isKnownBlockType(type) {
  return BLOCK_TYPE_LIST.includes(type);
}

function getCanonicalSectionTitle(sectionType) {
  return SECTION_CANONICAL_TITLES[sectionType] || null;
}

module.exports = {
  SECTION_TYPES,
  SECTION_TYPE_LIST,
  UNKNOWN_SECTION_TYPE,
  SECTION_CANONICAL_TITLES,
  BLOCK_TYPES,
  BLOCK_TYPE_LIST,
  UNKNOWN_BLOCK_TYPE,
  CONFIDENCE_LEVELS,
  isKnownSectionType,
  isKnownBlockType,
  getCanonicalSectionTitle
};
