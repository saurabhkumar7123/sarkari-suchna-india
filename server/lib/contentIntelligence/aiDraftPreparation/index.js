"use strict";

/**
 * CIP Stage 2A — Shared AI Draft Preparation Engine facade.
 *
 * First Program 2 step after CIP Foundation (1A–1E) for:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - AI draft payload + prompt context preparation only
 *   - NEVER calls AI / LLM APIs or executes prompts
 *   - NEVER invents, rewrites, or summarizes content
 *   - No Generator / templates / rendering / publishing / monitoring /
 *     editorial / DB / PDF-extraction / API changes
 *   - Does not modify Stage 1A, 1B, 1C+1D, or 1E
 */

const engine = require("./aiDraftPreparationEngine");
const payloadBuilder = require("./payloadBuilder");
const promptContextBuilder = require("./promptContextBuilder");
const types = require("./payloadTypes");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,

  // Primary API
  prepareAiDraft: engine.prepareAiDraft,
  prepareAiDraftFromValidated: engine.prepareAiDraftFromValidated,
  prepareAiDraftFromStructuredDocument: engine.prepareAiDraftFromStructuredDocument,
  prepareAiDraftFromText: engine.prepareAiDraftFromText,

  // Builders (tests + extension)
  buildAiPayload: payloadBuilder.buildAiPayload,
  buildNormalizedMetadata: payloadBuilder.buildNormalizedMetadata,
  buildCleanSection: payloadBuilder.buildCleanSection,
  buildPromptContext: promptContextBuilder.buildPromptContext,
  deepClone: payloadBuilder.deepClone,
  deepFreeze: engine.deepFreeze,

  // Taxonomy
  OUTPUT_FORMAT_ID: types.OUTPUT_FORMAT_ID,
  REQUIRED_OUTPUT_FORMAT: types.REQUIRED_OUTPUT_FORMAT,
  GENERATOR_EXPECTATION_BASE: types.GENERATOR_EXPECTATION_BASE
};
