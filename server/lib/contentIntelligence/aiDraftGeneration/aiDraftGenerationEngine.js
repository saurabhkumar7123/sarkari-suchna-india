"use strict";

/**
 * CIP Stage 2B — Shared AI Draft Generation Engine.
 *
 * Pipeline position:
 *   Stage 2A (payload + promptContext) → Stage 2B (this)
 *     → AI Request Package → (future LLM provider) → Normalized AI Response
 *
 * Boundaries:
 *   - Provider-agnostic request packaging + response normalization only
 *   - NEVER calls AI / LLM APIs, SDKs, or network
 *   - NEVER invents, rewrites, or summarizes content
 *   - NEVER mutates Stage 2A / Foundation outputs
 *   - Manual PDF + Automation workflows must use this same engine
 *   - No Generator / templates / publishing / monitoring /
 *     editorial / DB / PDF-extraction / API / runtime wiring
 */

const { prepareAiDraft } = require("../aiDraftPreparation");
const { buildAiRequestPackage, deepClone } = require("./requestPackageBuilder");
const { normalizeAiResponse } = require("./responseNormalizer");
const { buildDraftPolicy } = require("./draftPolicy");
const { buildExpectedOutputSchema } = require("./expectedOutputSchema");
const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  REQUEST_PACKAGE_FORMAT_ID,
  NORMALIZED_RESPONSE_FORMAT_ID,
  CONTRACT_VERSION
} = require("./generationTypes");

/**
 * Deep-freeze a plain JSON-compatible value.
 * @param {*} value
 */
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

/**
 * @typedef {Object} GenerateAiDraftInput
 * @property {object} [payload] Stage 2A AI payload
 * @property {object} [promptContext] Stage 2A prompt context
 * @property {object} [prepared] Full Stage 2A prepareAiDraft result
 * @property {object} [rawResponse] Optional raw AI response to normalize in the same call
 * @property {string} [pipeline] Workflow label: "manual_pdf" | "automation" | …
 * @property {boolean} [freeze] Deep-freeze result (default true)
 * @property {*} [text] Convenience: when payload missing, run Stage 2A first
 * @property {string} [title]
 * @property {string} [filename]
 */

function resolvePrepared(input = {}) {
  if (input.prepared && typeof input.prepared === "object") {
    return {
      payload: input.prepared.payload || null,
      promptContext: input.prepared.promptContext || null,
      fromStage2A: true,
      builtPreparation: false
    };
  }

  if (input.payload && typeof input.payload === "object") {
    return {
      payload: input.payload,
      promptContext:
        input.promptContext && typeof input.promptContext === "object"
          ? input.promptContext
          : {},
      fromStage2A: false,
      builtPreparation: false
    };
  }

  // Shared convenience path for manual PDF + automation: reuse Stage 2A unchanged
  const prepared = prepareAiDraft(input);
  return {
    payload: prepared.payload,
    promptContext: prepared.promptContext,
    fromStage2A: true,
    builtPreparation: true,
    prepared
  };
}

/**
 * Build the AI Request Package (and optionally normalize a raw response).
 * Does NOT execute any model. Provider integration is out of scope (Stage 2C+).
 *
 * @param {GenerateAiDraftInput} input
 */
function generateAiDraftPackage(input = {}) {
  const resolved = resolvePrepared(input);
  const requestPackage = buildAiRequestPackage(
    resolved.payload,
    resolved.promptContext,
    { pipeline: input.pipeline }
  );

  let normalizedResponse = null;
  if (input.rawResponse !== undefined) {
    normalizedResponse = normalizeAiResponse(input.rawResponse, {
      fallbackLanguage:
        (resolved.payload && resolved.payload.language) ||
        (resolved.promptContext && resolved.promptContext.language) ||
        null
    });
  }

  const result = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    contractVersion: CONTRACT_VERSION,
    requestPackage,
    normalizedResponse,
    draftPolicy: buildDraftPolicy(),
    expectedOutputSchema: buildExpectedOutputSchema(),
    extensions: {
      requestPackageFormatId: REQUEST_PACKAGE_FORMAT_ID,
      normalizedResponseFormatId: NORMALIZED_RESPONSE_FORMAT_ID,
      preparationBuilt: resolved.builtPreparation,
      fromStage2A: resolved.fromStage2A,
      providerAgnostic: true,
      executedModel: false,
      upstreamStageIds: Object.freeze(["CIP_1A", "CIP_1B", "CIP_1C_1D", "CIP_1E", "CIP_2A"])
    }
  };

  const cloned = deepClone(result);
  const shouldFreeze = input.freeze !== false;
  return shouldFreeze ? deepFreeze(cloned) : cloned;
}

/**
 * Build request package from an existing Stage 2A prepareAiDraft result.
 * @param {object} prepared
 * @param {object} [extra]
 */
function generateAiDraftPackageFromPrepared(prepared, extra = {}) {
  return generateAiDraftPackage({
    ...extra,
    prepared
  });
}

/**
 * Build request package from explicit payload + prompt context.
 * Shared by Manual PDF and Automation workflows.
 * @param {object} payload
 * @param {object} promptContext
 * @param {object} [extra]
 */
function generateAiDraftPackageFromPayload(payload, promptContext, extra = {}) {
  return generateAiDraftPackage({
    ...extra,
    payload,
    promptContext
  });
}

/**
 * Normalize a raw AI response only (no request package build).
 * @param {*} rawResponse
 * @param {object} [options]
 */
function normalizeDraftResponse(rawResponse, options = {}) {
  const normalized = normalizeAiResponse(rawResponse, options);
  const shouldFreeze = options.freeze !== false;
  const cloned = deepClone(normalized);
  return shouldFreeze ? deepFreeze(cloned) : cloned;
}

/**
 * Convenience: Stage 2A text path → Stage 2B request package.
 * @param {string} text
 * @param {GenerateAiDraftInput} [extra]
 */
function generateAiDraftPackageFromText(text, extra = {}) {
  return generateAiDraftPackage({ ...extra, text });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CONTRACT_VERSION,
  generateAiDraftPackage,
  generateAiDraftPackageFromPrepared,
  generateAiDraftPackageFromPayload,
  generateAiDraftPackageFromText,
  normalizeDraftResponse,
  deepFreeze
};
