"use strict";

/**
 * CIP Stage 2B — AI Request Package builder.
 * Builds a deterministic, provider-agnostic request package from Stage 2A outputs.
 * Never calls AI / network.
 */

const {
  REQUEST_PACKAGE_FORMAT_ID,
  CONTRACT_VERSION,
  SYSTEM_INSTRUCTION_LINES,
  ENGINE_VERSION
} = require("./generationTypes");
const { buildDraftPolicy } = require("./draftPolicy");
const { buildExpectedOutputSchema } = require("./expectedOutputSchema");

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeWhitespace(text) {
  if (text == null) return "";
  return String(text).replace(/\s+/g, " ").trim();
}

/**
 * Build system instructions array (deterministic).
 * @param {object} promptContext Stage 2A prompt context
 * @param {object} draftPolicy
 */
function buildSystemInstructions(promptContext, draftPolicy) {
  const lines = SYSTEM_INSTRUCTION_LINES.slice();
  const formatRules =
    promptContext &&
    promptContext.requiredOutputFormat &&
    Array.isArray(promptContext.requiredOutputFormat.rules)
      ? promptContext.requiredOutputFormat.rules
      : [];

  for (const rule of formatRules) {
    lines.push(`Output format rule: ${rule}`);
  }
  for (const ruleText of draftPolicy.ruleTexts || []) {
    lines.push(`Draft policy: ${ruleText}`);
  }
  return lines;
}

/**
 * Build compact user context from payload + prompt context.
 * @param {object} payload
 * @param {object} promptContext
 */
function buildUserContext(payload, promptContext) {
  const p = payload && typeof payload === "object" ? payload : {};
  const ctx = promptContext && typeof promptContext === "object" ? promptContext : {};

  return {
    documentType: p.documentType || ctx.documentType || "unknown",
    documentTypeLabel: p.documentTypeLabel || ctx.documentTypeLabel || null,
    expectedPageType: ctx.expectedPageType || p.pageStatusHint || null,
    language: p.language != null ? p.language : ctx.language != null ? ctx.language : null,
    sectionCount: p.sectionCount != null ? p.sectionCount : Array.isArray(p.sections) ? p.sections.length : 0,
    blockCount: p.blockCount != null ? p.blockCount : 0,
    validationWarnings: Array.isArray(ctx.validationWarnings)
      ? ctx.validationWarnings.slice()
      : Array.isArray(p.warnings)
        ? p.warnings.slice()
        : [],
    reviewRecommendations: Array.isArray(ctx.reviewRecommendations)
      ? ctx.reviewRecommendations.slice()
      : [],
    qualityHints: ctx.qualityHints
      ? deepClone(ctx.qualityHints)
      : {
          overallScore: null,
          publishReady: false,
          valid: false
        }
  };
}

/**
 * Build the deterministic AI Request Package.
 *
 * @param {object} payload Stage 2A AI payload
 * @param {object} promptContext Stage 2A prompt context
 * @param {object} [options]
 * @param {string} [options.pipeline] "manual_pdf" | "automation" | other label
 * @returns {object}
 */
function buildAiRequestPackage(payload, promptContext, options = {}) {
  const draftPolicy = buildDraftPolicy();
  const expectedOutputSchema = buildExpectedOutputSchema();
  const structuredPayload = deepClone(payload && typeof payload === "object" ? payload : {});
  const clonedPromptContext = deepClone(
    promptContext && typeof promptContext === "object" ? promptContext : {}
  );
  const systemInstructions = buildSystemInstructions(clonedPromptContext, draftPolicy);
  const userContext = buildUserContext(structuredPayload, clonedPromptContext);

  return {
    formatId: REQUEST_PACKAGE_FORMAT_ID,
    version: CONTRACT_VERSION,
    engineVersion: ENGINE_VERSION,
    pipeline: options.pipeline != null ? String(options.pipeline) : null,
    systemInstructions,
    systemInstructionsText: systemInstructions.join("\n"),
    userContext,
    structuredPayload,
    promptContext: clonedPromptContext,
    draftPolicy,
    expectedOutputSchema,
    // Convenience flat strings for providers that want a single user message later
    userMessageHints: {
      language: userContext.language,
      documentType: userContext.documentType,
      sectionSummary: (structuredPayload.sections || [])
        .map((s) => normalizeWhitespace(s.generatorTitle || s.title || s.sectionType || ""))
        .filter(Boolean)
    }
  };
}

module.exports = {
  buildAiRequestPackage,
  buildSystemInstructions,
  buildUserContext,
  deepClone,
  normalizeWhitespace
};
