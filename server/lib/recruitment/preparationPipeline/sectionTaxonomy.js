"use strict";

/**
 * Preparation Pipeline — section taxonomy + Generator mapping.
 *
 * AI structured data → SECTION TYPE → Generator title → publisher text.
 * AI must not decide CSS or arbitrary HTML. Existing Generator/CSS remains
 * the presentation layer.
 */

const { canonicalSectionTitle } = require("../../../utils/publisherSections");

/** Product-facing section keys (uppercase) used in extraction contracts. */
const SECTION_TAXONOMY = Object.freeze({
  SHORT_INFORMATION: "SHORT_INFORMATION",
  IMPORTANT_DATES: "IMPORTANT_DATES",
  APPLICATION_FEE: "APPLICATION_FEE",
  AGE_LIMIT: "AGE_LIMIT",
  VACANCY_DETAILS: "VACANCY_DETAILS",
  ELIGIBILITY: "ELIGIBILITY",
  EDUCATION_QUALIFICATION: "EDUCATION_QUALIFICATION",
  SELECTION_PROCESS: "SELECTION_PROCESS",
  SALARY: "SALARY",
  EXAM_PATTERN: "EXAM_PATTERN",
  SYLLABUS: "SYLLABUS",
  IMPORTANT_LINKS: "IMPORTANT_LINKS",
  DOCUMENTS_REQUIRED: "DOCUMENTS_REQUIRED",
  HOW_TO_APPLY: "HOW_TO_APPLY",
  ADMIT_CARD_DETAILS: "ADMIT_CARD_DETAILS",
  ANSWER_KEY_DETAILS: "ANSWER_KEY_DETAILS",
  RESULT_DETAILS: "RESULT_DETAILS",
  FAQ: "FAQ",
  IMPORTANT_INSTRUCTIONS: "IMPORTANT_INSTRUCTIONS",
  PHYSICAL_STANDARD: "PHYSICAL_STANDARD"
});

/** Maps taxonomy / CIP / aliases → Generator section titles. */
const SECTION_TO_GENERATOR_TITLE = Object.freeze({
  SHORT_INFORMATION: "Short Information",
  short_information: "Short Information",
  IMPORTANT_DATES: "Important Dates",
  important_dates: "Important Dates",
  APPLICATION_FEE: "Application Fee",
  application_fee: "Application Fee",
  AGE_LIMIT: "Age Limit",
  age_limit: "Age Limit",
  age_limits: "Age Limit",
  AGE_LIMITS: "Age Limit",
  VACANCY_DETAILS: "Vacancy Details",
  vacancy_details: "Vacancy Details",
  vacancy: "Vacancy Details",
  ELIGIBILITY: "Eligibility",
  eligibility: "Eligibility",
  eligibility_criteria: "Eligibility",
  ELIGIBILITY_CRITERIA: "Eligibility",
  PHYSICAL_STANDARD: "Physical Standard / PET",
  physical_standard: "Physical Standard / PET",
  EDUCATION_QUALIFICATION: "Education Qualification",
  education_qualification: "Education Qualification",
  qualification: "Qualification",
  SELECTION_PROCESS: "Selection Process",
  selection_process: "Selection Process",
  SALARY: "Salary",
  salary: "Salary",
  EXAM_PATTERN: "Exam Pattern",
  exam_pattern: "Exam Pattern",
  SYLLABUS: "Syllabus",
  syllabus: "Syllabus",
  IMPORTANT_LINKS: "Important Links",
  important_links: "Important Links",
  DOCUMENTS_REQUIRED: "Documents Required",
  documents_required: "Documents Required",
  HOW_TO_APPLY: "How To Apply",
  how_to_apply: "How To Apply",
  ADMIT_CARD_DETAILS: "Admit Card Details",
  admit_card: "Admit Card Details",
  ADMIT_CARD: "Admit Card Details",
  ANSWER_KEY_DETAILS: "Answer Key Details",
  answer_key: "Answer Key Details",
  ANSWER_KEY: "Answer Key Details",
  RESULT_DETAILS: "Result Details",
  result: "Result Details",
  RESULT: "Result Details",
  FAQ: "Important Questions",
  faq: "Important Questions",
  IMPORTANT_INSTRUCTIONS: "Important Instructions",
  important_instructions: "Important Instructions"
});

/** Suggested sections by lifecycle product type (do not force irrelevant ones). */
const SUGGESTED_SECTIONS_BY_EVENT = Object.freeze({
  NOTIFICATION: [
    "SHORT_INFORMATION",
    "IMPORTANT_DATES",
    "APPLICATION_FEE",
    "AGE_LIMIT",
    "VACANCY_DETAILS",
    "ELIGIBILITY",
    "EDUCATION_QUALIFICATION",
    "SELECTION_PROCESS",
    "HOW_TO_APPLY",
    "IMPORTANT_LINKS"
  ],
  ADMIT_CARD: [
    "SHORT_INFORMATION",
    "ADMIT_CARD_DETAILS",
    "IMPORTANT_DATES",
    "IMPORTANT_LINKS",
    "IMPORTANT_INSTRUCTIONS"
  ],
  ANSWER_KEY: [
    "SHORT_INFORMATION",
    "ANSWER_KEY_DETAILS",
    "IMPORTANT_DATES",
    "IMPORTANT_LINKS",
    "IMPORTANT_INSTRUCTIONS"
  ],
  RESULT: [
    "SHORT_INFORMATION",
    "RESULT_DETAILS",
    "IMPORTANT_DATES",
    "IMPORTANT_LINKS",
    "IMPORTANT_INSTRUCTIONS"
  ],
  OTHER_UPDATE: ["SHORT_INFORMATION", "IMPORTANT_DATES", "IMPORTANT_LINKS", "IMPORTANT_INSTRUCTIONS"]
});

function resolveGeneratorSectionTitle(sectionTypeOrTitle) {
  const raw = String(sectionTypeOrTitle || "").trim();
  if (!raw) return null;
  if (SECTION_TO_GENERATOR_TITLE[raw]) {
    return SECTION_TO_GENERATOR_TITLE[raw];
  }
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (SECTION_TO_GENERATOR_TITLE[upper]) {
    return SECTION_TO_GENERATOR_TITLE[upper];
  }
  const lower = raw.toLowerCase().replace(/\s+/g, "_");
  if (SECTION_TO_GENERATOR_TITLE[lower]) {
    return SECTION_TO_GENERATOR_TITLE[lower];
  }
  return canonicalSectionTitle(raw) || raw;
}

/**
 * Normalize AI/CIP structured sections into Generator publisher text blocks.
 * Does not invent content. Skips empty sections.
 *
 * @param {Array<{ type?: string, title?: string, value?: string, content?: string, confidence?: string, evidence?: *, missing?: boolean }>} sections
 * @param {{ eventType?: string }} [options]
 */
function mapStructuredSectionsToGenerator(sections, options = {}) {
  const list = Array.isArray(sections) ? sections : [];
  const mapped = [];
  const skipped = [];

  for (const section of list) {
    if (!section || typeof section !== "object") continue;
    if (section.missing === true) {
      skipped.push({ reason: "missing", type: section.type || section.title || null });
      continue;
    }
    const body = String(section.value != null ? section.value : section.content || "").trim();
    if (!body) {
      skipped.push({ reason: "empty", type: section.type || section.title || null });
      continue;
    }
    const title = resolveGeneratorSectionTitle(section.type || section.title || "Short Information");
    mapped.push({
      type: section.type || null,
      generatorTitle: title,
      value: body,
      confidence: section.confidence || null,
      evidence: section.evidence || null,
      uncertain: Boolean(section.uncertain || section.missing)
    });
  }

  const suggested =
    SUGGESTED_SECTIONS_BY_EVENT[String(options.eventType || "").toUpperCase()] || null;

  let publisherText = mapped
    .map((row) => `[Section: ${row.generatorTitle}]\n${row.value}`)
    .join("\n\n");

  try {
    const { normalizePublisherDocument } = require("./structuredNormalizeMerge");
    const normalized = normalizePublisherDocument(publisherText, {
      eventType: options.eventType || null,
      filterByEvent: false
    });
    if (normalized.publishContent) {
      publisherText = normalized.text;
    }
  } catch {
    /* keep raw mapped publisher text */
  }

  return Object.freeze({
    sections: Object.freeze(mapped),
    skipped: Object.freeze(skipped),
    suggestedSectionTypes: suggested ? Object.freeze([...suggested]) : null,
    publisherText,
    presentationLayer: "existing_generator_css",
    aiMustNotDecideCss: true,
    aiMustNotEmitArbitraryHtml: true
  });
}

/**
 * Build a field envelope for structured extraction outputs.
 */
function fieldEnvelope(value, { confidence = null, evidence = null, missing = false, uncertain = false } = {}) {
  const empty = value == null || String(value).trim() === "";
  return Object.freeze({
    value: empty ? null : value,
    confidence: confidence || (empty ? "none" : "medium"),
    evidence: evidence || null,
    missing: missing || empty,
    uncertain: Boolean(uncertain || missing || empty)
  });
}

module.exports = {
  SECTION_TAXONOMY,
  SECTION_TO_GENERATOR_TITLE,
  SUGGESTED_SECTIONS_BY_EVENT,
  resolveGeneratorSectionTitle,
  mapStructuredSectionsToGenerator,
  fieldEnvelope
};
