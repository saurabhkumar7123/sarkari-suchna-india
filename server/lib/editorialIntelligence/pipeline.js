"use strict";

/**
 * Phase AI-4 — Editorial Intelligence pipeline.
 *
 * Notice Intelligence → Recruitment Matching → Editorial Intelligence →
 * Generator Draft → Editorial Review
 *
 * This pass is pure and advisory. It never publishes, never mutates the draft,
 * never touches Production Workflow / Generator UI / Monitoring / AUTO_PUBLISH.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const { buildDraftModel } = require("./draftModel");
const { analyzeCompleteness } = require("./completeness");
const { validateCrossSections } = require("./crossSectionValidation");
const { detectMissingInformation } = require("./missingInformation");
const { analyzeLanguageQuality } = require("./languageQuality");
const { validateLinks } = require("./linkValidation");
const { recommendSectionOrder } = require("./sectionOrdering");
const { buildEditorSuggestions } = require("./suggestions");
const { computeQualityScores, computeAnalysisConfidence } = require("./qualityScores");
const { buildEditorSummary } = require("./summary");
const {
  EDITORIAL_FIELD,
  attachEditorialIntelligence,
  buildEditorialReport
} = require("./report");
const { ENGINE_VERSION, FORMAT_ID } = require("./types");

/**
 * Run the full Phase AI-4 editorial intelligence pass.
 *
 * @param {object|string} input draft text, structured doc, draft object, or enriched event
 * @param {{
 *   profile?: string,
 *   eventType?: string,
 *   title?: string,
 *   now?: Date,
 *   noticeIntelligence?: object,
 *   recruitmentMatching?: object
 * }} [options]
 * @returns {{
 *   editorialIntelligence: object,
 *   draft: object,
 *   completeness: object,
 *   validationIssues: object,
 *   missingInformation: object,
 *   languageQuality: object,
 *   linkValidation: object,
 *   sectionOrdering: object,
 *   editorSuggestions: object[],
 *   qualityScores: object,
 *   confidence: object,
 *   editorSummary: object,
 *   meta: object
 * }}
 */
function analyzeEditorialDraft(input, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const startedAt = Date.now();

  const draft = buildDraftModel(input, options);
  const completeness = analyzeCompleteness(draft);
  const validationIssues = validateCrossSections(draft);
  const missingInformation = detectMissingInformation(draft);
  const languageQuality = analyzeLanguageQuality(draft);
  const linkValidation = validateLinks(draft);
  const sectionOrdering = recommendSectionOrder(draft);

  // Merge link + ordering issues into the validation surface editors see
  const mergedValidation = {
    issues: [
      ...(validationIssues.issues || []),
      ...(linkValidation.issues || []),
      ...(sectionOrdering.issues || [])
    ],
    counts: null,
    explanation: validationIssues.explanation
  };
  mergedValidation.counts = {
    critical: mergedValidation.issues.filter((i) => i.severity === "Critical").length,
    high: mergedValidation.issues.filter((i) => i.severity === "High").length,
    medium: mergedValidation.issues.filter((i) => i.severity === "Medium").length,
    low: mergedValidation.issues.filter((i) => i.severity === "Low").length,
    total: mergedValidation.issues.length
  };
  mergedValidation.explanation =
    mergedValidation.counts.total === 0
      ? "No validation issues detected."
      : `Found ${mergedValidation.counts.total} validation issue(s): ${mergedValidation.counts.critical} critical, ${mergedValidation.counts.high} high, ${mergedValidation.counts.medium} medium, ${mergedValidation.counts.low} low.`;

  const editorSuggestions = buildEditorSuggestions({
    draft,
    missingInformation,
    validationIssues: mergedValidation,
    languageQuality,
    linkValidation,
    sectionOrdering
  });

  const qualityScores = computeQualityScores({
    draft,
    completeness,
    validationIssues: mergedValidation,
    missingInformation,
    languageQuality,
    linkValidation,
    sectionOrdering
  });

  const confidence = computeAnalysisConfidence({ draft });

  const editorSummary = buildEditorSummary({
    draft,
    qualityScores,
    missingInformation,
    validationIssues: mergedValidation,
    editorSuggestions,
    confidence,
    languageQuality,
    linkValidation
  });

  const editorialIntelligence = buildEditorialReport({
    draft,
    completeness,
    validationIssues: mergedValidation,
    missingInformation,
    languageQuality,
    linkValidation,
    sectionOrdering,
    editorSuggestions,
    qualityScores,
    confidence,
    editorSummary,
    generatedAt: now.toISOString()
  });

  return {
    editorialIntelligence,
    draft,
    completeness,
    validationIssues: mergedValidation,
    missingInformation,
    languageQuality,
    linkValidation,
    sectionOrdering,
    editorSuggestions,
    qualityScores,
    confidence,
    editorSummary,
    meta: deepFreeze({
      formatId: FORMAT_ID,
      engineVersion: ENGINE_VERSION,
      draftSource: draft.source,
      profile: draft.profile,
      sectionCount: (draft.sections || []).length,
      suggestionCount: editorSuggestions.length,
      durationMs: Date.now() - startedAt
    })
  };
}

/**
 * Convenience: return the original object plus one additive namespaced key.
 * @param {object} target
 * @param {object} [options]
 * @returns {object}
 */
function enrichWithEditorialIntelligence(target, options = {}) {
  const result = analyzeEditorialDraft(target, options);
  if (target && typeof target === "object") {
    return attachEditorialIntelligence(target, result.editorialIntelligence);
  }
  return {
    draftText: typeof target === "string" ? target : "",
    [EDITORIAL_FIELD]: result.editorialIntelligence
  };
}

module.exports = {
  EDITORIAL_FIELD,
  analyzeEditorialDraft,
  enrichWithEditorialIntelligence
};
