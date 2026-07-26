"use strict";

/**
 * CIP Combined Stage 1C + 1D — Shared Section + Block Intelligence facade.
 *
 * Third shared step after Stage 1A (classification) and Stage 1B (metadata)
 * for:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - Section detection + normalization (1C) and block detection (1D) only
 *   - No validation (future Stage 1E)
 *   - No Generator / templates / rendering / publishing / monitoring /
 *     editorial / DB / PDF-extraction / AI-prompt / API changes
 *   - Does not modify Stage 1A or Stage 1B
 */

const engine = require("./structureEngine");
const types = require("./structureTypes");
const rules = require("./sectionRules");
const sectionEngine = require("./sectionEngine");
const blockEngine = require("./blockEngine");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,

  // Primary API
  structureDocument: engine.structureDocument,
  structureDocumentFromText: engine.structureDocumentFromText,

  // Section intelligence (Stage 1C)
  splitIntoRawSections: sectionEngine.splitIntoRawSections,
  detectImplicitHeading: sectionEngine.detectImplicitHeading,
  normalizeSectionTitle: sectionEngine.normalizeSectionTitle,
  toGeneratorTitle: sectionEngine.toGeneratorTitle,

  // Block intelligence (Stage 1D)
  parseBlocks: blockEngine.parseBlocks,
  classifyLineKind: blockEngine.classifyLineKind,
  stripRichTags: blockEngine.stripRichTags,

  // Taxonomy (extensible)
  SECTION_TYPES: types.SECTION_TYPES,
  SECTION_TYPE_LIST: types.SECTION_TYPE_LIST,
  UNKNOWN_SECTION_TYPE: types.UNKNOWN_SECTION_TYPE,
  SECTION_CANONICAL_TITLES: types.SECTION_CANONICAL_TITLES,
  BLOCK_TYPES: types.BLOCK_TYPES,
  BLOCK_TYPE_LIST: types.BLOCK_TYPE_LIST,
  UNKNOWN_BLOCK_TYPE: types.UNKNOWN_BLOCK_TYPE,
  CONFIDENCE_LEVELS: types.CONFIDENCE_LEVELS,
  isKnownSectionType: types.isKnownSectionType,
  isKnownBlockType: types.isKnownBlockType,
  getCanonicalSectionTitle: types.getCanonicalSectionTitle,

  // Rules for tests and extension
  SECTION_RULES: rules.SECTION_RULES,
  buildHeadingKey: rules.buildHeadingKey,
  matchSectionTitle: rules.matchSectionTitle
};
