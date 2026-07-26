"use strict";

/**
 * CIP Stage 3A — Shared Source Intelligence Engine taxonomy.
 * Deterministic constants only. Extensible via frozen maps.
 */

const ENGINE_ID = "CIP_SOURCE_INTELLIGENCE_ENGINE";
const STAGE_ID = "CIP_3A";
const ENGINE_VERSION = "1.0.0";
const PROFILE_VERSION = "1.0.0";
const SOURCE_PROFILE_FORMAT_ID = "cip_source_profile_v1";

/** Supported source profile types (WHAT the source is). */
const SOURCE_TYPES = Object.freeze([
  "official_html_page",
  "official_pdf",
  "linked_pdf",
  "corrigendum_pdf",
  "result_pdf",
  "admit_card_pdf",
  "answer_key_pdf",
  "notice_pdf",
  "unknown_source"
]);

const SOURCE_TYPE_LABELS = Object.freeze({
  official_html_page: "Official HTML Page",
  official_pdf: "Official PDF",
  linked_pdf: "Linked PDF",
  corrigendum_pdf: "Corrigendum PDF",
  result_pdf: "Result PDF",
  admit_card_pdf: "Admit Card PDF",
  answer_key_pdf: "Answer Key PDF",
  notice_pdf: "Notice PDF",
  unknown_source: "Unknown Source"
});

/** Lower number = higher precedence when resolving PDF specialty conflicts. */
const SOURCE_TYPE_PRECEDENCE = Object.freeze({
  corrigendum_pdf: 10,
  admit_card_pdf: 20,
  answer_key_pdf: 21,
  result_pdf: 22,
  notice_pdf: 30,
  linked_pdf: 40,
  official_pdf: 50,
  official_html_page: 60,
  unknown_source: 99
});

const DOCUMENT_FORMATS = Object.freeze(["html", "pdf", "unknown"]);

const LANGUAGES = Object.freeze(["en", "hi", "unknown"]);

const RELIABILITY_CLASSES = Object.freeze({
  OFFICIAL: "official_source",
  MIRROR: "mirror_source",
  UNKNOWN: "unknown_source"
});

const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "none"]);

const DOWNLOAD_REQUIREMENTS = Object.freeze({
  REQUIRED: "required",
  OPTIONAL: "optional",
  NONE: "none",
  UNKNOWN: "unknown"
});

const RELATIONSHIP_ROLES = Object.freeze({
  NOTIFICATION: "notification",
  CORRIGENDUM: "corrigendum",
  ADMIT_CARD: "admit_card",
  RESULT: "result",
  ANSWER_KEY: "answer_key",
  NOTICE: "notice",
  UNKNOWN: "unknown"
});

/** Deterministic parent→child relationship codes. */
const RELATIONSHIP_TYPES = Object.freeze({
  NOTIFICATION_TO_CORRIGENDUM: "notification->corrigendum",
  NOTIFICATION_TO_ADMIT_CARD: "notification->admit_card",
  NOTIFICATION_TO_RESULT: "notification->result",
  NOTIFICATION_TO_ANSWER_KEY: "notification->answer_key",
  NOTIFICATION_TO_NOTICE: "notification->notice"
});

const EXTRACTION_STRATEGIES = Object.freeze({
  HTML_FIRST: "HTML_FIRST",
  PDF_FIRST: "PDF_FIRST",
  HTML_PLUS_PDF: "HTML_PLUS_PDF",
  OCR_REQUIRED: "OCR_REQUIRED",
  MANUAL_REVIEW_RECOMMENDED: "MANUAL_REVIEW_RECOMMENDED"
});

const EXTRACTION_STRATEGY_LABELS = Object.freeze({
  HTML_FIRST: "HTML First",
  PDF_FIRST: "PDF First",
  HTML_PLUS_PDF: "HTML + PDF",
  OCR_REQUIRED: "OCR Required",
  MANUAL_REVIEW_RECOMMENDED: "Manual Review Recommended"
});

const CANDIDATE_FILE_TYPES = Object.freeze([
  "html",
  "pdf",
  "htm",
  "unknown"
]);

function isKnownSourceType(value) {
  return SOURCE_TYPES.includes(value);
}

function getSourceTypeLabel(sourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || SOURCE_TYPE_LABELS.unknown_source;
}

function getExtractionStrategyLabel(strategy) {
  return EXTRACTION_STRATEGY_LABELS[strategy] || EXTRACTION_STRATEGY_LABELS.MANUAL_REVIEW_RECOMMENDED;
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  PROFILE_VERSION,
  SOURCE_PROFILE_FORMAT_ID,
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_PRECEDENCE,
  DOCUMENT_FORMATS,
  LANGUAGES,
  RELIABILITY_CLASSES,
  CONFIDENCE_LEVELS,
  DOWNLOAD_REQUIREMENTS,
  RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPES,
  EXTRACTION_STRATEGIES,
  EXTRACTION_STRATEGY_LABELS,
  CANDIDATE_FILE_TYPES,
  isKnownSourceType,
  getSourceTypeLabel,
  getExtractionStrategyLabel
};
