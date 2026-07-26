"use strict";

/**
 * CIP Stage 3E — shared deterministic Extraction Quality & Validation Engine.
 *
 * Final Program 3 stage. Assesses extraction quality for Stage 3B/3C documents
 * and Stage 3D correlations before downstream intelligence.
 *
 * Manual PDF workflow and automation workflow must use this same engine.
 * Never modifies content, never repairs, never publishes, never calls AI.
 */

const engine = require("./extractionQualityEngine");
const types = require("./extractionQualityTypes");
const rules = require("./extractionQualityRules");
const utils = require("./extractionQualityUtils");
const adapter = require("./inputAdapter");
const documentValidators = require("./documentValidators");
const correlationValidators = require("./correlationValidators");
const scorer = require("./qualityScorer");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  REPORT_VERSION: engine.REPORT_VERSION,
  QUALITY_REPORT_FORMAT_ID: engine.QUALITY_REPORT_FORMAT_ID,

  // Shared primary API (manual + automation)
  assessExtractionQuality: engine.assessExtractionQuality,
  validateExtractionQuality: engine.validateExtractionQuality,
  assessNormalizedDocument: engine.assessNormalizedDocument,
  assessRecruitmentCorrelation: engine.assessRecruitmentCorrelation,
  assessDocuments: engine.assessDocuments,
  qualityReportFingerprint: engine.qualityReportFingerprint,

  // Taxonomy
  INPUT_KINDS: types.INPUT_KINDS,
  SEVERITIES: types.SEVERITIES,
  QUALITY_LEVELS: types.QUALITY_LEVELS,
  READINESS_STATES: types.READINESS_STATES,
  QUALITY_DIMENSIONS: types.QUALITY_DIMENSIONS,
  VALIDATION_CATEGORIES: types.VALIDATION_CATEGORIES,
  SCORE_KEYS: types.SCORE_KEYS,
  createFinding: types.createFinding,

  // Rules / scoring helpers
  REQUIRED_DOCUMENT_METADATA: rules.REQUIRED_DOCUMENT_METADATA,
  CORE_RECRUITMENT_SECTIONS: rules.CORE_RECRUITMENT_SECTIONS,
  PREFERRED_RECRUITMENT_SECTIONS: rules.PREFERRED_RECRUITMENT_SECTIONS,
  SCORE_DEDUCTIONS: rules.SCORE_DEDUCTIONS,
  SCORE_WEIGHTS: rules.SCORE_WEIGHTS,
  LEVEL_THRESHOLDS: rules.LEVEL_THRESHOLDS,
  READINESS_THRESHOLDS: rules.READINESS_THRESHOLDS,

  computeQualityScores: scorer.computeQualityScores,
  assessReadiness: scorer.assessReadiness,
  suggestManualChecks: scorer.suggestManualChecks,
  selectKeyFindings: scorer.selectKeyFindings,
  scoreFromFindings: scorer.scoreFromFindings,
  levelForScore: scorer.levelForScore,

  // Adapters / validators for tests and extension
  adaptInput: adapter.adaptInput,
  buildDocumentView: adapter.buildDocumentView,
  isNormalizedHtmlDocument: adapter.isNormalizedHtmlDocument,
  isNormalizedPdfDocument: adapter.isNormalizedPdfDocument,
  isRecruitmentCorrelation: adapter.isRecruitmentCorrelation,
  classifyHeading: adapter.classifyHeading,

  validateDocument: documentValidators.validateDocument,
  validateMetadata: documentValidators.validateMetadata,
  validateStructure: documentValidators.validateStructure,
  validateSectionCoverage: documentValidators.validateSectionCoverage,
  validateHeadingHierarchy: documentValidators.validateHeadingHierarchy,
  validateReadingOrder: documentValidators.validateReadingOrder,
  validateTables: documentValidators.validateTables,
  validateLinks: documentValidators.validateLinks,
  validateResources: documentValidators.validateResources,
  isStructurallyBrokenUrl: documentValidators.isStructurallyBrokenUrl,

  validateCorrelationBundle: correlationValidators.validateCorrelationBundle,
  validateCorrelation: correlationValidators.validateCorrelation,
  validateRelationships: correlationValidators.validateRelationships,
  validateTimeline: correlationValidators.validateTimeline,
  validateCrossDocumentConsistency: correlationValidators.validateCrossDocumentConsistency,
  validateGeneratorCompatibility: correlationValidators.validateGeneratorCompatibility,

  deepFreeze: utils.deepFreeze,
  reportFingerprint: utils.reportFingerprint
};
