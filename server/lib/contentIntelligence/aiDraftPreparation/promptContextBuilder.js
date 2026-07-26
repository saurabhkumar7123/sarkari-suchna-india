"use strict";

/**
 * CIP Stage 2A — deterministic reusable prompt context builder.
 * Describes constraints for a future AI call. Does not execute prompts.
 */

const {
  PAGE_STATUS_HINTS,
  getDocumentTypeLabel,
  DOCUMENT_TYPE_LABELS
} = require("../documentClassification/documentTypes");
const {
  getRequiredSections,
  getRequiredMetadata,
  PREFERRED_SECTION_ORDER
} = require("../validationEngine/validationRules");
const {
  REQUIRED_OUTPUT_FORMAT,
  GENERATOR_EXPECTATION_BASE
} = require("./payloadTypes");

/**
 * @param {object} payload Clean AI payload from payloadBuilder
 */
function buildPromptContext(payload) {
  const documentType = payload.documentType || "unknown";
  const documentTypeLabel =
    payload.documentTypeLabel || getDocumentTypeLabel(documentType);

  const language = payload.language || "unknown";
  const expectedPageType =
    payload.pageStatusHint || PAGE_STATUS_HINTS[documentType] || null;

  const requiredSections = getRequiredSections(documentType).slice();
  const requiredMetadata = getRequiredMetadata(documentType).slice();

  const sectionTypesPresent = (payload.sections || []).map((s) => s.sectionType);
  const generatorTitles = (payload.sections || [])
    .map((s) => s.generatorTitle)
    .filter(Boolean);

  const generatorExpectations = {
    ...GENERATOR_EXPECTATION_BASE,
    documentType,
    documentTypeLabel,
    expectedPageType,
    requiredSections,
    requiredMetadata,
    preferredSectionOrder: PREFERRED_SECTION_ORDER.slice(),
    sectionTypesPresent: sectionTypesPresent.slice(),
    generatorTitles: generatorTitles.slice(),
    compatible:
      payload.generatorCompatibility && typeof payload.generatorCompatibility.compatible === "boolean"
        ? payload.generatorCompatibility.compatible
        : null,
    compatibilityState:
      (payload.generatorCompatibility && payload.generatorCompatibility.state) || null
  };

  const validationWarnings = (payload.warnings || []).slice();
  const reviewRecommendations = (payload.reviewAreas || []).slice();

  if (payload.publishReadiness && payload.publishReadiness.ready === false) {
    const state = payload.publishReadiness.state || "not_ready";
    const msg = `Publish readiness is ${state}; draft must remain review-gated.`;
    if (!reviewRecommendations.includes(msg)) {
      reviewRecommendations.push(msg);
    }
  }

  if (documentType === "unknown") {
    const msg = "Document type is unknown; classify carefully before drafting.";
    if (!reviewRecommendations.includes(msg)) {
      reviewRecommendations.push(msg);
    }
  }

  return {
    documentType,
    documentTypeLabel,
    expectedPageType,
    language,
    generatorExpectations,
    requiredOutputFormat: {
      id: REQUIRED_OUTPUT_FORMAT.id,
      description: REQUIRED_OUTPUT_FORMAT.description,
      rules: REQUIRED_OUTPUT_FORMAT.rules.slice()
    },
    validationWarnings,
    reviewRecommendations,
    qualityHints: {
      overallScore:
        payload.qualityScores && payload.qualityScores.overall != null
          ? payload.qualityScores.overall
          : null,
      publishReady: Boolean(payload.publishReadiness && payload.publishReadiness.ready),
      valid: Boolean(payload.validationSummary && payload.validationSummary.valid)
    },
    // Stable label map for consumers (deterministic, read-only copy)
    documentTypeLabels: { ...DOCUMENT_TYPE_LABELS }
  };
}

module.exports = {
  buildPromptContext
};
