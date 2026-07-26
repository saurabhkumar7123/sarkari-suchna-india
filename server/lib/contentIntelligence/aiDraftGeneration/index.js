"use strict";

/**
 * CIP Stage 2B — Shared AI Draft Generation Engine facade.
 *
 * Consumes Stage 2A (AI Payload + Prompt Context) for:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Boundaries:
 *   - AI Request Package + Response Normalization only
 *   - NEVER calls AI / LLM APIs, SDKs, or network
 *   - NEVER invents, rewrites, or summarizes content
 *   - No Generator / templates / rendering / publishing / monitoring /
 *     editorial / DB / PDF-extraction / API changes
 *   - Does not modify Foundation or Stage 2A
 */

const engine = require("./aiDraftGenerationEngine");
const requestPackageBuilder = require("./requestPackageBuilder");
const responseNormalizer = require("./responseNormalizer");
const draftPolicy = require("./draftPolicy");
const expectedOutputSchema = require("./expectedOutputSchema");
const types = require("./generationTypes");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  CONTRACT_VERSION: engine.CONTRACT_VERSION,

  // Primary API
  generateAiDraftPackage: engine.generateAiDraftPackage,
  generateAiDraftPackageFromPrepared: engine.generateAiDraftPackageFromPrepared,
  generateAiDraftPackageFromPayload: engine.generateAiDraftPackageFromPayload,
  generateAiDraftPackageFromText: engine.generateAiDraftPackageFromText,
  normalizeDraftResponse: engine.normalizeDraftResponse,

  // Builders / normalizers (tests + extension)
  buildAiRequestPackage: requestPackageBuilder.buildAiRequestPackage,
  buildSystemInstructions: requestPackageBuilder.buildSystemInstructions,
  buildUserContext: requestPackageBuilder.buildUserContext,
  normalizeAiResponse: responseNormalizer.normalizeAiResponse,
  buildDraftPolicy: draftPolicy.buildDraftPolicy,
  buildExpectedOutputSchema: expectedOutputSchema.buildExpectedOutputSchema,
  deepClone: requestPackageBuilder.deepClone,
  deepFreeze: engine.deepFreeze,

  // Taxonomy
  REQUEST_PACKAGE_FORMAT_ID: types.REQUEST_PACKAGE_FORMAT_ID,
  NORMALIZED_RESPONSE_FORMAT_ID: types.NORMALIZED_RESPONSE_FORMAT_ID,
  EXPECTED_OUTPUT_SCHEMA_ID: types.EXPECTED_OUTPUT_SCHEMA_ID,
  DRAFT_POLICY_ID: types.DRAFT_POLICY_ID,
  DRAFT_POLICY_RULES: draftPolicy.DRAFT_POLICY_RULES,
  EXPECTED_OUTPUT_FIELDS: expectedOutputSchema.EXPECTED_OUTPUT_FIELDS,
  SYSTEM_INSTRUCTION_LINES: types.SYSTEM_INSTRUCTION_LINES
};
