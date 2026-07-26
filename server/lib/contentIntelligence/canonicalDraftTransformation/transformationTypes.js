"use strict";

/**
 * CIP Stage 2D — Canonical Draft Transformation types and constants.
 */

const ENGINE_ID = "CIP_CANONICAL_DRAFT_TRANSFORMATION_ENGINE";
const STAGE_ID = "CIP_2D";
const ENGINE_VERSION = "1.0.0";
const TRANSFORMATION_VERSION = "1.0.0";
const GENERATOR_READY_FORMAT_ID = "cip_generator_ready_document_v1";

const COMPATIBILITY_STATUSES = Object.freeze({
  COMPATIBLE: "compatible",
  PARTIAL: "partial",
  INCOMPATIBLE: "incompatible"
});

/** CIP sectionType → Generator display title (Foundation SECTION_CANONICAL_TITLES). */
const SECTION_TYPE_TO_GENERATOR_TITLE = Object.freeze({
  short_information: "Short Information",
  important_dates: "Important Dates",
  application_fee: "Application Fee",
  age_limit: "Age Limit",
  qualification: "Qualification",
  vacancy_details: "Vacancy Details",
  selection_process: "Selection Process",
  how_to_apply: "How To Apply",
  important_links: "Important Links",
  faq: "FAQ",
  exam_pattern: "Exam Pattern",
  syllabus: "Syllabus",
  result: "Result",
  admit_card: "Admit Card",
  answer_key: "Answer Key",
  correction: "Correction",
  notice: "Notice",
  important_instructions: "Important Instructions",
  unknown: null
});

/**
 * CIP blockType → Generator editor CONTENT_TYPES (server/utils/sectionEditorModel).
 * Unknown / unmatched types map to mixed and are preserved as raw body text.
 */
const BLOCK_TYPE_TO_GENERATOR_CONTENT_TYPE = Object.freeze({
  paragraph: "paragraph",
  table: "table",
  key_value: "dates",
  date_row: "dates",
  list: "list",
  faq: "faq",
  link: "links",
  multi_link: "links",
  mixed: "mixed",
  rich_text: "mixed",
  unknown: "mixed"
});

/** All Generator-facing mapping labels Stage 2D advertises as supported. */
const SUPPORTED_GENERATOR_MAPPINGS = Object.freeze([
  "Paragraph",
  "Short Information",
  "Important Dates",
  "Application Fee",
  "Age Limit",
  "Qualification",
  "Vacancy Details",
  "Selection Process",
  "How To Apply",
  "Important Links",
  "FAQ",
  "Exam Pattern",
  "Syllabus",
  "Result",
  "Admit Card",
  "Answer Key",
  "Correction",
  "Notice",
  "Instructions",
  "Table",
  "Key Value",
  "Date Row",
  "Link",
  "Multi Link",
  "List",
  "Rich Text",
  "Mixed",
  "Unknown"
]);

function warning(code, severity, message, extra = {}) {
  const value = { code, severity, message };
  for (const key of Object.keys(extra).sort()) {
    if (extra[key] !== undefined) value[key] = extra[key];
  }
  return value;
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  TRANSFORMATION_VERSION,
  GENERATOR_READY_FORMAT_ID,
  COMPATIBILITY_STATUSES,
  SECTION_TYPE_TO_GENERATOR_TITLE,
  BLOCK_TYPE_TO_GENERATOR_CONTENT_TYPE,
  SUPPORTED_GENERATOR_MAPPINGS,
  warning
};
