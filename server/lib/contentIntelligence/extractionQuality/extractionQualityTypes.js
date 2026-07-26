"use strict";

/**
 * CIP Stage 3E — Extraction Quality & Validation Engine taxonomy.
 * Deterministic constants only. Extensible via frozen maps.
 */

const ENGINE_ID = "CIP_EXTRACTION_QUALITY_ENGINE";
const STAGE_ID = "CIP_3E";
const ENGINE_VERSION = "1.0.0";
const REPORT_VERSION = "1.0.0";
const QUALITY_REPORT_FORMAT_ID = "cip_extraction_quality_report_v1";

const INPUT_KINDS = Object.freeze({
  NORMALIZED_HTML: "normalized_html",
  NORMALIZED_PDF: "normalized_pdf",
  RECRUITMENT_CORRELATION: "recruitment_correlation",
  MULTIPLE_DOCUMENTS: "multiple_documents",
  UNKNOWN: "unknown"
});

const SEVERITIES = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info"
});

const QUALITY_LEVELS = Object.freeze({
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  FAIR: "FAIR",
  POOR: "POOR",
  BLOCKED: "BLOCKED"
});

const READINESS_STATES = Object.freeze({
  READY: "READY",
  READY_WITH_WARNINGS: "READY_WITH_WARNINGS",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  BLOCKED: "BLOCKED"
});

const QUALITY_DIMENSIONS = Object.freeze({
  METADATA_COMPLETENESS: "metadata_completeness",
  STRUCTURE_COMPLETENESS: "structure_completeness",
  SECTION_COVERAGE: "section_coverage",
  RESOURCE_INVENTORY: "resource_inventory_quality",
  HEADING_HIERARCHY: "heading_hierarchy",
  READING_ORDER: "reading_order",
  TABLE_INTEGRITY: "table_integrity",
  LINK_INTEGRITY: "link_integrity",
  DOCUMENT_CONSISTENCY: "document_consistency",
  CROSS_DOCUMENT_CONSISTENCY: "cross_document_consistency",
  CORRELATION_QUALITY: "correlation_quality",
  GENERATOR_COMPATIBILITY: "generator_compatibility",
  WARNINGS: "warnings"
});

const VALIDATION_CATEGORIES = Object.freeze({
  METADATA: "metadata",
  STRUCTURE: "structure",
  SECTION: "section",
  RESOURCE: "resource",
  HIERARCHY: "hierarchy",
  READING_ORDER: "reading_order",
  TABLE: "table",
  LINK: "link",
  CONSISTENCY: "consistency",
  CORRELATION: "correlation",
  TIMELINE: "timeline",
  RELATIONSHIP: "relationship",
  TRACEABILITY: "traceability",
  GENERATOR: "generator",
  EXTRACTION: "extraction"
});

const SCORE_KEYS = Object.freeze([
  "metadataQuality",
  "structureQuality",
  "extractionQuality",
  "correlationQuality",
  "overallQuality",
  "overallReadiness"
]);

/**
 * Create a validation finding with mandatory traceability fields.
 *
 * @param {object} params
 * @param {string} params.rule Validation rule id
 * @param {string} params.severity
 * @param {string} params.category
 * @param {string} params.message
 * @param {string|null} [params.documentId]
 * @param {string|null} [params.sectionId]
 * @param {string|null} [params.blockId]
 * @param {string|null} [params.dimension]
 * @param {object} [params.details]
 */
function createFinding({
  rule,
  severity,
  category,
  message,
  documentId = null,
  sectionId = null,
  blockId = null,
  dimension = null,
  details = null
}) {
  const finding = {
    rule,
    severity,
    category,
    message,
    affectedDocument: documentId,
    affectedSection: sectionId,
    affectedBlock: blockId,
    validationRule: rule,
    dimension
  };
  if (details != null) finding.details = details;
  return finding;
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  REPORT_VERSION,
  QUALITY_REPORT_FORMAT_ID,
  INPUT_KINDS,
  SEVERITIES,
  QUALITY_LEVELS,
  READINESS_STATES,
  QUALITY_DIMENSIONS,
  VALIDATION_CATEGORIES,
  SCORE_KEYS,
  createFinding
};
