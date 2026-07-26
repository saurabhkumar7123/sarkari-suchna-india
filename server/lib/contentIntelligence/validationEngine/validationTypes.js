"use strict";

/**
 * CIP Stage 1E — Content Validation & Quality Engine taxonomy.
 * Extensible: add severities, categories, scores, or readiness states here.
 */

const SEVERITIES = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info"
});

const SEVERITY_LIST = Object.freeze(Object.values(SEVERITIES));

const VALIDATION_CATEGORIES = Object.freeze({
  DOCUMENT: "document",
  METADATA: "metadata",
  SECTION: "section",
  BLOCK: "block",
  ORDERING: "ordering",
  GENERATOR: "generator",
  COMPLETENESS: "completeness",
  CONSISTENCY: "consistency"
});

const VALIDATION_CATEGORY_LIST = Object.freeze(Object.values(VALIDATION_CATEGORIES));

const QUALITY_SCORE_KEYS = Object.freeze([
  "overall",
  "metadata",
  "section",
  "block",
  "generatorCompatibility",
  "publishReadiness"
]);

const PUBLISH_READINESS_STATES = Object.freeze({
  READY: "ready",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked"
});

const GENERATOR_COMPATIBILITY_STATES = Object.freeze({
  COMPATIBLE: "compatible",
  PARTIAL: "partial",
  INCOMPATIBLE: "incompatible"
});

function createFinding(code, severity, category, message, extra = {}) {
  const finding = {
    code,
    severity,
    category,
    message
  };
  if (extra.path != null) finding.path = extra.path;
  if (extra.sectionOrder != null) finding.sectionOrder = extra.sectionOrder;
  if (extra.blockOrder != null) finding.blockOrder = extra.blockOrder;
  if (extra.field != null) finding.field = extra.field;
  if (extra.sectionType != null) finding.sectionType = extra.sectionType;
  if (extra.blockType != null) finding.blockType = extra.blockType;
  if (extra.details != null) finding.details = extra.details;
  return finding;
}

module.exports = {
  SEVERITIES,
  SEVERITY_LIST,
  VALIDATION_CATEGORIES,
  VALIDATION_CATEGORY_LIST,
  QUALITY_SCORE_KEYS,
  PUBLISH_READINESS_STATES,
  GENERATOR_COMPATIBILITY_STATES,
  createFinding
};
