"use strict";

/**
 * CIP Stage 1B — Shared Metadata Intelligence Engine facade.
 *
 * Second shared step after Stage 1A Document Classification for:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - Metadata identification + normalization only
 *   - No section detection
 *   - No block detection
 *   - No Generator / publishing / monitoring / DB schema changes
 *   - Does not modify Stage 1A
 */

const extractor = require("./metadataExtractor");
const fields = require("./metadataFields");
const rules = require("./metadataRules");
const normalizers = require("./metadataNormalizers");

const ENGINE_ID = extractor.ENGINE_ID;
const STAGE_ID = extractor.STAGE_ID;
const ENGINE_VERSION = extractor.ENGINE_VERSION;

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,

  // Primary API
  extractMetadata: extractor.extractMetadata,
  extractMetadataFromText: extractor.extractMetadataFromText,

  // Taxonomy (extensible)
  METADATA_FIELDS: fields.METADATA_FIELDS,
  IMPORTANT_DATE_FIELDS: fields.IMPORTANT_DATE_FIELDS,
  SOURCE_TYPES: fields.SOURCE_TYPES,
  DOCUMENT_LANGUAGES: fields.DOCUMENT_LANGUAGES,
  CONFIDENCE_LEVELS: fields.CONFIDENCE_LEVELS,
  createEmptyMetadata: fields.createEmptyMetadata,
  createEmptyImportantDates: fields.createEmptyImportantDates,
  createEmptyConfidence: fields.createEmptyConfidence,

  // Rules / normalizers for tests and extension
  FIELD_RULES: rules.FIELD_RULES,
  DATE_FIELD_RULES: rules.DATE_FIELD_RULES,
  normalizeMetadata: normalizers.normalizeMetadata,
  normalizeDateValue: normalizers.normalizeDateValue,
  normalizeOrganizationValue: normalizers.normalizeOrganizationValue,
  normalizeStateValue: normalizers.normalizeStateValue,
  normalizeQualificationValue: normalizers.normalizeQualificationValue,
  normalizeApplicationModeValue: normalizers.normalizeApplicationModeValue,
  normalizeAdvertisementNo: normalizers.normalizeAdvertisementNo,
  detectDocumentLanguage: normalizers.detectDocumentLanguage,
  normalizeSourceType: normalizers.normalizeSourceType
};
