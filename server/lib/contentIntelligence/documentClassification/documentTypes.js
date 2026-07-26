"use strict";

/**
 * CIP Stage 1A — Shared Document Classification Engine taxonomy.
 * Extensible: add new entries to DOCUMENT_TYPES + TYPE_PRECEDENCE + rules.
 */

const DOCUMENT_TYPES = Object.freeze([
  "new_recruitment",
  "admit_card",
  "result",
  "answer_key",
  "correction_notice",
  "short_notice",
  "important_notice",
  "age_relaxation_notice",
  "exam_pattern",
  "syllabus",
  "document",
  "unknown"
]);

const DOCUMENT_TYPE_LABELS = Object.freeze({
  new_recruitment: "New Recruitment",
  admit_card: "Admit Card",
  result: "Result",
  answer_key: "Answer Key",
  correction_notice: "Correction Notice",
  short_notice: "Short Notice",
  important_notice: "Important Notice",
  age_relaxation_notice: "Age Relaxation Notice",
  exam_pattern: "Exam Pattern",
  syllabus: "Syllabus",
  document: "Document",
  unknown: "Unknown"
});

/** Lower number = higher precedence when resolving conflicts. */
const TYPE_PRECEDENCE = Object.freeze({
  age_relaxation_notice: 5,
  correction_notice: 10,
  exam_pattern: 15,
  syllabus: 16,
  admit_card: 20,
  answer_key: 21,
  result: 22,
  short_notice: 25,
  new_recruitment: 30,
  important_notice: 40,
  document: 50,
  unknown: 99
});

const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

const UNKNOWN_DOCUMENT_TYPE = "unknown";

/**
 * Optional bridge to existing page/status taxonomy (read-only mapping).
 * Does not mutate Generator or publishing code.
 */
const PAGE_STATUS_HINTS = Object.freeze({
  new_recruitment: "latest job",
  admit_card: "admit card",
  result: "result",
  answer_key: "answer key",
  syllabus: "syllabus",
  document: "document"
});

function isKnownDocumentType(value) {
  return DOCUMENT_TYPES.includes(value);
}

function getDocumentTypeLabel(documentType) {
  return DOCUMENT_TYPE_LABELS[documentType] || DOCUMENT_TYPE_LABELS.unknown;
}

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  TYPE_PRECEDENCE,
  CONFIDENCE_LEVELS,
  UNKNOWN_DOCUMENT_TYPE,
  PAGE_STATUS_HINTS,
  isKnownDocumentType,
  getDocumentTypeLabel
};
