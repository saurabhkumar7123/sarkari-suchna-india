"use strict";

/**
 * CIP Stage 1E — Shared Content Validation & Quality Engine facade.
 *
 * Final Foundation step after Stage 1A / 1B / 1C+1D for:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - Validation + quality scoring only
 *   - NEVER modifies the structured document
 *   - No Generator / templates / rendering / publishing / monitoring /
 *     editorial / DB / PDF-extraction / AI-prompt / API changes
 *   - Does not modify Stage 1A, 1B, or 1C+1D
 */

const engine = require("./validationEngine");
const types = require("./validationTypes");
const rules = require("./validationRules");
const scorer = require("./qualityScorer");
const documentValidator = require("./documentValidator");
const metadataValidator = require("./metadataValidator");
const sectionValidator = require("./sectionValidator");
const blockValidator = require("./blockValidator");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,

  // Primary API
  validateContent: engine.validateContent,
  validateStructuredDocument: engine.validateStructuredDocument,
  validateContentFromText: engine.validateContentFromText,

  // Taxonomy
  SEVERITIES: types.SEVERITIES,
  SEVERITY_LIST: types.SEVERITY_LIST,
  VALIDATION_CATEGORIES: types.VALIDATION_CATEGORIES,
  VALIDATION_CATEGORY_LIST: types.VALIDATION_CATEGORY_LIST,
  QUALITY_SCORE_KEYS: types.QUALITY_SCORE_KEYS,
  PUBLISH_READINESS_STATES: types.PUBLISH_READINESS_STATES,
  GENERATOR_COMPATIBILITY_STATES: types.GENERATOR_COMPATIBILITY_STATES,
  createFinding: types.createFinding,

  // Rules / scoring (tests + extension)
  PREFERRED_SECTION_ORDER: rules.PREFERRED_SECTION_ORDER,
  REQUIRED_METADATA_BY_TYPE: rules.REQUIRED_METADATA_BY_TYPE,
  REQUIRED_SECTIONS_BY_TYPE: rules.REQUIRED_SECTIONS_BY_TYPE,
  SCORE_DEDUCTIONS: rules.SCORE_DEDUCTIONS,
  CATEGORY_SCORE_WEIGHTS: rules.CATEGORY_SCORE_WEIGHTS,
  PUBLISH_THRESHOLDS: rules.PUBLISH_THRESHOLDS,
  GENERATOR_KNOWN_TITLES: rules.GENERATOR_KNOWN_TITLES,
  getRequiredMetadata: rules.getRequiredMetadata,
  getRequiredSections: rules.getRequiredSections,

  computeQualityReports: scorer.computeQualityReports,
  suggestReviewAreas: scorer.suggestReviewAreas,
  scoreFromFindings: scorer.scoreFromFindings,

  // Focused validators
  validateDocument: documentValidator.validateDocument,
  validateMetadata: metadataValidator.validateMetadata,
  validateSections: sectionValidator.validateSections,
  validateBlocks: blockValidator.validateBlocks
};
