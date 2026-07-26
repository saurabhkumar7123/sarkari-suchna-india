"use strict";

/**
 * CIP Stage 3E — deterministic validation rules and scoring weights.
 * Reuses Program 1 section taxonomy and Stage 1E required-section concepts
 * read-only. Never mutates upstream engines.
 */

const { SECTION_TYPES } = require("../structureIntelligence/structureTypes");
const { NORMALIZED_HTML_DOCUMENT_FORMAT_ID } = require("../htmlExtraction/htmlExtractionTypes");
const { NORMALIZED_PDF_DOCUMENT_FORMAT_ID } = require("../pdfExtraction/pdfExtractionTypes");
const { RECRUITMENT_CORRELATION_FORMAT_ID } = require("../multiSourceCorrelation/correlationTypes");

/** Required metadata keys for any normalized extraction document. */
const REQUIRED_DOCUMENT_METADATA = Object.freeze([
  "title",
  "sourceUrl"
]);

/** Preferentially accepted title fields on Stage 3B/3C metadata objects. */
const TITLE_METADATA_FIELDS = Object.freeze(["pageTitle", "title"]);

/** Core structural sections expected on high-quality recruitment notifications. */
const CORE_RECRUITMENT_SECTIONS = Object.freeze([
  SECTION_TYPES.IMPORTANT_DATES,
  SECTION_TYPES.IMPORTANT_LINKS
]);

/** Broader preferred coverage used for section-coverage scoring. */
const PREFERRED_RECRUITMENT_SECTIONS = Object.freeze([
  SECTION_TYPES.SHORT_INFORMATION,
  SECTION_TYPES.IMPORTANT_DATES,
  SECTION_TYPES.APPLICATION_FEE,
  SECTION_TYPES.VACANCY_DETAILS,
  SECTION_TYPES.HOW_TO_APPLY,
  SECTION_TYPES.IMPORTANT_LINKS
]);

/** Score deductions from a 100 base (deterministic). */
const SCORE_DEDUCTIONS = Object.freeze({
  error: 14,
  warning: 5,
  info: 1
});

/** Weights for overall quality (must sum to 1.0). */
const SCORE_WEIGHTS = Object.freeze({
  metadataQuality: 0.2,
  structureQuality: 0.25,
  extractionQuality: 0.25,
  correlationQuality: 0.15,
  readinessSignal: 0.15
});

/** Qualitative level thresholds (inclusive lower bounds). */
const LEVEL_THRESHOLDS = Object.freeze({
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 55,
  POOR: 30
  // below POOR → BLOCKED when blocking issues exist, else POOR
});

/** Advisory readiness thresholds. */
const READINESS_THRESHOLDS = Object.freeze({
  readyMinOverall: 80,
  readyWithWarningsMinOverall: 65,
  needsReviewMinOverall: 40,
  maxBlockingForReady: 0,
  maxBlockingForReadyWithWarnings: 0,
  maxUnknownSectionRatio: 0.5,
  maxUnknownSectionRatioBlocked: 0.85
});

/** Categories contributing to each score key. */
const SCORE_CATEGORY_MAP = Object.freeze({
  metadataQuality: Object.freeze(["metadata"]),
  structureQuality: Object.freeze([
    "structure",
    "section",
    "hierarchy",
    "reading_order",
    "table"
  ]),
  extractionQuality: Object.freeze([
    "resource",
    "link",
    "extraction",
    "consistency",
    "traceability"
  ]),
  correlationQuality: Object.freeze(["correlation", "timeline", "relationship"]),
  generatorCompatibility: Object.freeze(["generator"])
});

const KNOWN_FORMAT_IDS = Object.freeze({
  html: NORMALIZED_HTML_DOCUMENT_FORMAT_ID,
  pdf: NORMALIZED_PDF_DOCUMENT_FORMAT_ID,
  correlation: RECRUITMENT_CORRELATION_FORMAT_ID
});

/** Structural block types considered non-empty content. */
const CONTENT_BLOCK_TYPES = Object.freeze([
  "paragraph",
  "list",
  "table",
  "definition_list",
  "link",
  "image",
  "section_title"
]);

module.exports = {
  REQUIRED_DOCUMENT_METADATA,
  TITLE_METADATA_FIELDS,
  CORE_RECRUITMENT_SECTIONS,
  PREFERRED_RECRUITMENT_SECTIONS,
  SCORE_DEDUCTIONS,
  SCORE_WEIGHTS,
  LEVEL_THRESHOLDS,
  READINESS_THRESHOLDS,
  SCORE_CATEGORY_MAP,
  KNOWN_FORMAT_IDS,
  CONTENT_BLOCK_TYPES
};
