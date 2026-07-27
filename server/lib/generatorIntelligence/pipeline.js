"use strict";

/**
 * Phase AI-1 quality pipeline orchestrator.
 * PDF text → advanced normalize → section detection → structured JSON → validate → publisher text.
 */

const { buildStructuredDocument } = require("./structuredOutput");
const { compileToPublisherText } = require("./publisherCompile");
const { advancedNormalize, softCleanForStructuring } = require("./textNormalization");
const { ENGINE_VERSION, FORMAT_ID } = require("./types");

/**
 * Run full quality conversion on extracted / pasted notification text.
 * @param {string} rawText
 * @param {{ sourceName?: string, languageHint?: string }} [options]
 * @returns {{
 *   result: string,
 *   structured: object,
 *   validation: object,
 *   meta: object
 * }}
 */
function runGeneratorIntelligencePipeline(rawText, options = {}) {
  const input = String(rawText || "");
  const structured = buildStructuredDocument(input, options);
  const result = compileToPublisherText(structured);
  const validation = structured.validation || {
    ok: false,
    overallConfidence: 0,
    sections: [],
    issues: ["missing_validation"],
    summary: {}
  };

  return {
    result,
    structured,
    validation,
    meta: {
      formatId: FORMAT_ID,
      engineVersion: ENGINE_VERSION,
      inputLength: input.length,
      cleanedLength: structured?.extensions?.cleanedTextLength || 0,
      sectionCount: structured?.sections?.length || 0,
      overallConfidence: validation.overallConfidence,
      detectionMode: structured?.metadata?.detectionMode || null
    }
  };
}

/**
 * Normalize PDF extraction text only (used by extract service).
 * @param {string} text
 * @returns {string}
 */
function improveExtractedPdfText(text) {
  return advancedNormalize(text);
}

/**
 * Soft-clean helper exported for callers that only need pre-structure cleanup.
 * @param {string} text
 * @returns {string}
 */
function prepareTextForConversion(text) {
  return softCleanForStructuring(text);
}

module.exports = {
  runGeneratorIntelligencePipeline,
  improveExtractedPdfText,
  prepareTextForConversion
};
