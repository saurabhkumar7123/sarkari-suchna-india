"use strict";

/**
 * CIP Stage 2A — Shared AI Draft Preparation Engine.
 *
 * Pipeline position:
 *   Stage 1A → 1B → 1C+1D → 1E → Stage 2A (this) → future AI model
 *
 * Transforms a validated CIP structured document into a deterministic
 * AI-ready payload + reusable prompt context.
 *
 * Boundaries:
 *   - Preparation only — NEVER calls AI / LLM APIs
 *   - NEVER invents, rewrites, or summarizes content
 *   - NEVER mutates Foundation outputs
 *   - No Generator / templates / publishing / monitoring /
 *     editorial / DB / PDF-extraction / API / runtime wiring
 */

const { structureDocument } = require("../structureIntelligence");
const {
  validateContent,
  validateStructuredDocument,
  validateContentFromText
} = require("../validationEngine");

const { buildAiPayload, deepClone } = require("./payloadBuilder");
const { buildPromptContext } = require("./promptContextBuilder");
const { REQUIRED_OUTPUT_FORMAT, OUTPUT_FORMAT_ID } = require("./payloadTypes");

const ENGINE_ID = "CIP_AI_DRAFT_PREPARATION_ENGINE";
const STAGE_ID = "CIP_2A";
const ENGINE_VERSION = "1.0.0";

/**
 * Deep-freeze a plain JSON-compatible value (deterministic immutability).
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

function foundationInputFrom(input = {}) {
  return {
    title: input.title,
    headings: input.headings,
    text: input.text || input.content,
    filename: input.filename,
    url: input.url,
    notificationUrl: input.notificationUrl,
    officialWebsite: input.officialWebsite,
    sourceType: input.sourceType,
    contentType: input.contentType,
    pipeline: input.pipeline,
    source: input.source,
    metadata: input.metadata,
    classification: input.classification,
    metadataResult: input.metadataResult,
    skipClassification: input.skipClassification,
    skipMetadata: input.skipMetadata
  };
}

/**
 * @typedef {Object} PrepareAiDraftInput
 * @property {object} [structuredDocument] Stage 1C+1D output (preferred with validation)
 * @property {object} [validationResult] Stage 1E output
 * @property {boolean} [skipValidation] When true and structuredDocument given, skip 1E
 * @property {string} [title]
 * @property {string} [text]
 * @property {string} [content]
 * @property {string} [filename]
 * @property {string} [url]
 * @property {object} [metadata]
 * @property {object} [classification]
 * @property {object} [metadataResult]
 * @property {boolean} [freeze] Deep-freeze result (default true)
 */

function resolveInputs(input = {}) {
  const structuredDocument =
    input.structuredDocument && typeof input.structuredDocument === "object"
      ? input.structuredDocument
      : null;
  let validationResult =
    input.validationResult && typeof input.validationResult === "object"
      ? input.validationResult
      : null;

  if (structuredDocument) {
    let builtValidation = false;
    if (!validationResult && !input.skipValidation) {
      validationResult = validateStructuredDocument(structuredDocument);
      builtValidation = true;
    }
    return {
      structuredDocument,
      validationResult,
      builtValidation,
      builtStructure: false
    };
  }

  // Structure once, validate once — shared by manual PDF + automation convenience paths
  const structured = structureDocument(foundationInputFrom(input));
  const validation = validateStructuredDocument(structured);
  return {
    structuredDocument: structured,
    validationResult: validation,
    builtValidation: true,
    builtStructure: true
  };
}

/**
 * Prepare a deterministic AI draft payload + prompt context.
 * Inputs are never mutated. Result is deep-cloned (and frozen by default).
 *
 * @param {PrepareAiDraftInput} input
 */
function prepareAiDraft(input = {}) {
  const resolved = resolveInputs(input);
  const { structuredDocument, validationResult } = resolved;

  const payload = buildAiPayload(structuredDocument, validationResult);
  const promptContext = buildPromptContext(payload);

  const result = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    payload,
    promptContext,
    extensions: {
      validationBuilt: resolved.builtValidation,
      structureBuilt: resolved.builtStructure,
      outputFormatId: OUTPUT_FORMAT_ID,
      foundationStageIds: Object.freeze(["CIP_1A", "CIP_1B", "CIP_1C_1D", "CIP_1E"])
    }
  };

  // Deep clone so callers cannot mutate internal builder objects via shared refs
  const cloned = deepClone(result);
  const shouldFreeze = input.freeze !== false;
  return shouldFreeze ? deepFreeze(cloned) : cloned;
}

/**
 * Prepare from Stage 1E validation + Stage 1C+1D structured document.
 * @param {object} validationResult
 * @param {object} structuredDocument
 * @param {object} [extra]
 */
function prepareAiDraftFromValidated(validationResult, structuredDocument, extra = {}) {
  return prepareAiDraft({
    ...extra,
    validationResult,
    structuredDocument
  });
}

/**
 * Prepare from a structured document (runs Stage 1E then Stage 2A).
 * @param {object} structuredDocument
 * @param {object} [extra]
 */
function prepareAiDraftFromStructuredDocument(structuredDocument, extra = {}) {
  return prepareAiDraft({
    ...extra,
    structuredDocument
  });
}

/**
 * Convenience: structure → validate → prepare from raw text.
 * @param {string} text
 * @param {PrepareAiDraftInput} [extra]
 */
function prepareAiDraftFromText(text, extra = {}) {
  return prepareAiDraft({ ...extra, text });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  prepareAiDraft,
  prepareAiDraftFromValidated,
  prepareAiDraftFromStructuredDocument,
  prepareAiDraftFromText,
  deepFreeze,
  // Re-export for tests / wiring without changing Foundation modules
  validateContent,
  validateStructuredDocument,
  validateContentFromText,
  REQUIRED_OUTPUT_FORMAT,
  OUTPUT_FORMAT_ID
};
