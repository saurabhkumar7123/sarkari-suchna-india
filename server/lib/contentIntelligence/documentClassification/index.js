"use strict";

/**
 * CIP Stage 1A — Shared Document Classification Engine facade.
 *
 * First shared step for:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - Classification only
 *   - No section detection
 *   - No block detection
 *   - No Generator / publishing / monitoring / DB schema changes
 */

const classifier = require("./documentClassifier");
const types = require("./documentTypes");
const rules = require("./classificationRules");

const ENGINE_ID = "CIP_DOCUMENT_CLASSIFICATION_ENGINE";
const STAGE_ID = "CIP_1A";
const ENGINE_VERSION = "1.0.0";

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,

  // Primary API
  classifyDocument: classifier.classifyDocument,
  classifyDocumentFromText: classifier.classifyDocumentFromText,

  // Taxonomy (extensible)
  DOCUMENT_TYPES: types.DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS: types.DOCUMENT_TYPE_LABELS,
  TYPE_PRECEDENCE: types.TYPE_PRECEDENCE,
  CONFIDENCE_LEVELS: types.CONFIDENCE_LEVELS,
  UNKNOWN_DOCUMENT_TYPE: types.UNKNOWN_DOCUMENT_TYPE,
  PAGE_STATUS_HINTS: types.PAGE_STATUS_HINTS,
  isKnownDocumentType: types.isKnownDocumentType,
  getDocumentTypeLabel: types.getDocumentTypeLabel,

  // Internals useful for tests / extension
  CLASSIFICATION_RULES: rules.CLASSIFICATION_RULES,
  buildFieldTexts: classifier.buildFieldTexts
};
