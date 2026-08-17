"use strict";

/**
 * CIP Stage 3A — Shared Source Intelligence Engine facade.
 *
 * First Program 3 step: describe WHAT a source is before extraction.
 *
 * Shared by:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - Source profiling only
 *   - NEVER calls AI / OCR / network / download / extraction parsers
 *   - No Generator / Publishing / Monitoring / Editorial / DB /
 *     PDF-extraction / API / runtime wiring
 *   - Does not modify Program 1 or Program 2
 */

const engine = require("./sourceIntelligenceEngine");
const types = require("./sourceTypes");
const domains = require("./officialDomains");
const classifier = require("./sourceClassifier");
const analyzer = require("./sourceAnalyzer");
const reliability = require("./reliabilityAssessor");
const relationships = require("./relationshipDetector");
const strategy = require("./extractionStrategy");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  PROFILE_VERSION: engine.PROFILE_VERSION,
  SOURCE_PROFILE_FORMAT_ID: types.SOURCE_PROFILE_FORMAT_ID,

  // Primary API
  analyzeSource: engine.analyzeSource,
  analyzeSourceFromUrl: engine.analyzeSourceFromUrl,
  analyzeSourceFromPdf: engine.analyzeSourceFromPdf,
  analyzeSourceFromHtml: engine.analyzeSourceFromHtml,

  // Taxonomy
  SOURCE_TYPES: types.SOURCE_TYPES,
  SOURCE_TYPE_LABELS: types.SOURCE_TYPE_LABELS,
  SOURCE_TYPE_PRECEDENCE: types.SOURCE_TYPE_PRECEDENCE,
  DOCUMENT_FORMATS: types.DOCUMENT_FORMATS,
  LANGUAGES: types.LANGUAGES,
  RELIABILITY_CLASSES: types.RELIABILITY_CLASSES,
  CONFIDENCE_LEVELS: types.CONFIDENCE_LEVELS,
  DOWNLOAD_REQUIREMENTS: types.DOWNLOAD_REQUIREMENTS,
  RELATIONSHIP_ROLES: types.RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPES: types.RELATIONSHIP_TYPES,
  EXTRACTION_STRATEGIES: types.EXTRACTION_STRATEGIES,
  EXTRACTION_STRATEGY_LABELS: types.EXTRACTION_STRATEGY_LABELS,
  CANDIDATE_FILE_TYPES: types.CANDIDATE_FILE_TYPES,
  isKnownSourceType: types.isKnownSourceType,
  getSourceTypeLabel: types.getSourceTypeLabel,
  getExtractionStrategyLabel: types.getExtractionStrategyLabel,

  // Internals (tests / extension)
  OFFICIAL_HOST_SUFFIXES: domains.OFFICIAL_HOST_SUFFIXES,
  KNOWN_MIRROR_HOSTS: domains.KNOWN_MIRROR_HOSTS,
  REGISTRY_OFFICIAL_HOSTS: domains.REGISTRY_OFFICIAL_HOSTS,
  extractHostname: domains.extractHostname,
  isOfficialHostSuffix: domains.isOfficialHostSuffix,
  isKnownMirrorHost: domains.isKnownMirrorHost,
  resolveOfficialDomain: domains.resolveOfficialDomain,
  isApprovedOfficialMonitoringUrl: domains.isApprovedOfficialMonitoringUrl,

  SPECIALTY_PDF_RULES: classifier.SPECIALTY_PDF_RULES,
  buildSearchBlobs: classifier.buildSearchBlobs,
  classifySourceType: classifier.classifySourceType,

  detectDocumentFormat: analyzer.detectDocumentFormat,
  detectLanguages: analyzer.detectLanguages,
  analyzeCapabilities: analyzer.analyzeCapabilities,
  buildLanguageSample: analyzer.buildLanguageSample,

  assessReliability: reliability.assessReliability,
  detectRelationships: relationships.detectRelationships,
  recommendExtractionStrategy: strategy.recommendExtractionStrategy,

  deepFreeze: engine.deepFreeze,
  profileFingerprint: engine.profileFingerprint
};
