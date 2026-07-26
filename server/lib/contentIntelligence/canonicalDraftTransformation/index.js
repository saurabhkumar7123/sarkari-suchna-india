"use strict";

/**
 * CIP Stage 2D — Shared Canonical Draft Transformation Engine.
 *
 * Deterministically transforms a Stage 2C governed AI draft into the
 * Generator's native data model. Manual PDF and automation workflows
 * use the same exported engine.
 *
 * Never calls a model, network, Generator runtime, or provider SDK.
 * Never invents, rewrites, or summarizes content.
 */

const engine = require("./canonicalDraftTransformationEngine");
const types = require("./transformationTypes");
const sectionMapper = require("./sectionMapper");
const builder = require("./generatorDocumentBuilder");
const compatibility = require("./compatibilityReport");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  TRANSFORMATION_VERSION: engine.TRANSFORMATION_VERSION,
  GENERATOR_READY_FORMAT_ID: types.GENERATOR_READY_FORMAT_ID,
  COMPATIBILITY_STATUSES: types.COMPATIBILITY_STATUSES,
  SECTION_TYPE_TO_GENERATOR_TITLE: types.SECTION_TYPE_TO_GENERATOR_TITLE,
  BLOCK_TYPE_TO_GENERATOR_CONTENT_TYPE: types.BLOCK_TYPE_TO_GENERATOR_CONTENT_TYPE,
  SUPPORTED_GENERATOR_MAPPINGS: types.SUPPORTED_GENERATOR_MAPPINGS,

  transformCanonicalDraft: engine.transformCanonicalDraft,
  transformFromGovernedDraft: engine.transformFromGovernedDraft,
  transformFromGovernanceResult: engine.transformFromGovernanceResult,

  mapSection: sectionMapper.mapSection,
  mapBlock: sectionMapper.mapBlock,
  buildGeneratorMetadata: builder.buildGeneratorMetadata,
  buildGeneratorText: builder.buildGeneratorText,
  buildTraceability: builder.buildTraceability,
  reverseMappedSections: engine.reverseMappedSections,
  buildCompatibilityReport: compatibility.buildCompatibilityReport,
  deepFreeze: engine.deepFreeze
};
