"use strict";

/**
 * CIP Stage 2B — Expected Output Schema for any LLM response.
 * Provider-agnostic. No OpenAI / Gemini / Claude shapes.
 */

const { EXPECTED_OUTPUT_SCHEMA_ID } = require("./generationTypes");
const { OUTPUT_FORMAT_ID } = require("../aiDraftPreparation/payloadTypes");

/**
 * Canonical field definitions for the expected LLM draft output.
 * Used for documentation inside the request package and for normalization.
 */
const EXPECTED_OUTPUT_FIELDS = Object.freeze({
  document: Object.freeze({
    required: true,
    description: "Top-level draft document container."
  }),
  metadata: Object.freeze({
    required: false,
    description: "Normalized document metadata (optional)."
  }),
  sections: Object.freeze({
    required: true,
    description: "Ordered list of draft sections."
  }),
  blocks: Object.freeze({
    required: false,
    description: "Blocks live under sections; listed here as a supported concept."
  }),
  warnings: Object.freeze({
    required: false,
    description: "Non-fatal drafting warnings."
  }),
  notes: Object.freeze({
    required: false,
    description: "Optional editorial / drafting notes."
  }),
  confidence: Object.freeze({
    required: false,
    description: "Optional overall confidence score (0–1 or 0–100)."
  })
});

/**
 * Build the Expected Output Schema embedded in every AI Request Package.
 */
function buildExpectedOutputSchema() {
  return {
    id: EXPECTED_OUTPUT_SCHEMA_ID,
    version: "1.0.0",
    outputFormatId: OUTPUT_FORMAT_ID,
    description:
      "Provider-independent structured draft. Return a single JSON object matching this schema.",
    rootType: "object",
    fields: { ...EXPECTED_OUTPUT_FIELDS },
    shape: {
      document: {
        documentType: "string|null",
        documentTypeLabel: "string|null",
        language: "string|null",
        title: "string|null",
        pageStatusHint: "string|null"
      },
      metadata: "object|null",
      sections: [
        {
          order: "number",
          sectionType: "string",
          title: "string|null",
          generatorTitle: "string|null",
          blocks: [
            {
              order: "number",
              blockType: "string",
              originalContent: "string",
              normalizedContent: "any|null"
            }
          ]
        }
      ],
      warnings: ["string"],
      notes: ["string"],
      confidence: "number|null"
    },
    requiredRoots: Object.freeze(["document", "sections"]),
    optionalRoots: Object.freeze(["metadata", "warnings", "notes", "confidence", "blocks"])
  };
}

module.exports = {
  EXPECTED_OUTPUT_FIELDS,
  buildExpectedOutputSchema
};
