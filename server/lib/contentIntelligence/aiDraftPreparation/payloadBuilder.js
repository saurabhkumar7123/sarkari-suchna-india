"use strict";

/**
 * CIP Stage 2A — clean AI payload builder.
 * Strips parser / engine internals. Preserves ordered content verbatim.
 * Never invents, rewrites, or summarizes.
 */

const { METADATA_FIELDS, IMPORTANT_DATE_FIELDS } = require("../metadataIntelligence/metadataFields");
const { PAGE_STATUS_HINTS, getDocumentTypeLabel } = require("../documentClassification/documentTypes");

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function cloneNormalizedContent(normalizedContent) {
  if (normalizedContent == null) return null;
  return deepClone(normalizedContent);
}

/**
 * Copy only Stage 1B normalized metadata fields (no confidence / indicators).
 * @param {object|null} metadata
 */
function buildNormalizedMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;

  const out = Object.create(null);
  for (const field of METADATA_FIELDS) {
    if (field === "importantDates") {
      const src = metadata.importantDates && typeof metadata.importantDates === "object"
        ? metadata.importantDates
        : {};
      const dates = Object.create(null);
      for (const dateField of IMPORTANT_DATE_FIELDS) {
        dates[dateField] = src[dateField] != null ? src[dateField] : null;
      }
      out.importantDates = dates;
      continue;
    }
    out[field] = metadata[field] != null ? metadata[field] : null;
  }
  return out;
}

/**
 * Strip section internals; preserve order and all block content.
 * @param {object} section
 */
function buildCleanSection(section) {
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  const orderedBlocks = blocks
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((block, index) => ({
      order: block.order != null ? block.order : index,
      blockType: block.blockType || "unknown",
      originalContent: String(block.originalContent != null ? block.originalContent : ""),
      normalizedContent: cloneNormalizedContent(block.normalizedContent)
    }));

  return {
    order: section.order != null ? section.order : 0,
    sectionType: section.sectionType || "unknown",
    title: section.normalizedTitle != null ? section.normalizedTitle : section.originalTitle || null,
    normalizedTitle: section.normalizedTitle != null ? section.normalizedTitle : null,
    originalTitle: section.originalTitle != null ? section.originalTitle : null,
    generatorTitle: section.generatorTitle != null ? section.generatorTitle : null,
    isKnownSection: Boolean(section.isKnownSection),
    blocks: orderedBlocks,
    blockCount: orderedBlocks.length
  };
}

/**
 * Deduplicate warning strings / finding messages while preserving first-seen order.
 * @param {Array<string|object>} items
 * @returns {string[]}
 */
function collectUniqueWarnings(items) {
  const out = [];
  const seen = Object.create(null);
  for (const item of items || []) {
    let text = null;
    if (typeof item === "string") text = item;
    else if (item && typeof item === "object") {
      text = item.message || item.code || null;
    }
    if (!text) continue;
    const key = String(text);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(key);
  }
  return out;
}

function slimFinding(finding) {
  if (!finding || typeof finding !== "object") return null;
  const slim = {
    code: finding.code || null,
    severity: finding.severity || null,
    category: finding.category || null,
    message: finding.message || null
  };
  if (finding.path != null) slim.path = finding.path;
  if (finding.field != null) slim.field = finding.field;
  if (finding.sectionType != null) slim.sectionType = finding.sectionType;
  if (finding.blockType != null) slim.blockType = finding.blockType;
  if (finding.sectionOrder != null) slim.sectionOrder = finding.sectionOrder;
  if (finding.blockOrder != null) slim.blockOrder = finding.blockOrder;
  return slim;
}

function buildValidationSummary(validation) {
  if (!validation || typeof validation !== "object") {
    return {
      valid: false,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      findingCount: 0,
      documentType: null,
      sectionCount: 0,
      blockCount: 0,
      overallScore: null,
      publishReady: false,
      generatorCompatible: false
    };
  }
  const summary = validation.summary || {};
  return {
    valid: Boolean(summary.valid),
    errorCount: summary.errorCount || 0,
    warningCount: summary.warningCount || 0,
    infoCount: summary.infoCount || 0,
    findingCount: summary.findingCount || 0,
    documentType: summary.documentType != null ? summary.documentType : null,
    sectionCount: summary.sectionCount || 0,
    blockCount: summary.blockCount || 0,
    overallScore: summary.overallScore != null ? summary.overallScore : null,
    publishReady: Boolean(summary.publishReady),
    generatorCompatible: Boolean(summary.generatorCompatible)
  };
}

/**
 * Build the clean AI-ready payload from a validated structured document.
 *
 * @param {object} structuredDocument Stage 1C+1D output (read-only)
 * @param {object} validationResult Stage 1E output (read-only)
 */
function buildAiPayload(structuredDocument, validationResult) {
  const doc = structuredDocument && typeof structuredDocument === "object" ? structuredDocument : null;
  const validation = validationResult && typeof validationResult === "object" ? validationResult : null;

  const documentType = doc
    ? doc.documentType || "unknown"
    : (validation && validation.summary && validation.summary.documentType) || "unknown";
  const documentTypeLabel =
    (doc && doc.documentTypeLabel) || getDocumentTypeLabel(documentType);

  const classification = doc && doc.classification && typeof doc.classification === "object"
    ? doc.classification
    : null;

  const pageStatusHint =
    (classification && classification.pageStatusHint) ||
    PAGE_STATUS_HINTS[documentType] ||
    null;

  const language =
    (doc && doc.metadata && doc.metadata.documentLanguage) ||
    null;

  const sections = (doc && Array.isArray(doc.sections) ? doc.sections : [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section) => buildCleanSection(section));

  const structureWarnings = doc && Array.isArray(doc.warnings) ? doc.warnings : [];
  const validationWarnings = validation && Array.isArray(validation.warnings)
    ? validation.warnings.map((f) => slimFinding(f)).filter(Boolean)
    : [];
  const validationErrors = validation && Array.isArray(validation.errors)
    ? validation.errors.map((f) => slimFinding(f)).filter(Boolean)
    : [];

  const warningMessages = collectUniqueWarnings([
    ...structureWarnings,
    ...validationWarnings,
    ...(classification && Array.isArray(classification.warnings) ? classification.warnings : [])
  ]);

  const reviewAreas =
    validation && Array.isArray(validation.suggestedReviewAreas)
      ? validation.suggestedReviewAreas.slice()
      : [];

  return {
    documentType,
    documentTypeLabel,
    documentTypeConfidence: classification ? classification.confidence || null : null,
    pageStatusHint,
    language,
    normalizedMetadata: buildNormalizedMetadata(doc ? doc.metadata : null),
    sections,
    sectionCount: sections.length,
    blockCount: sections.reduce((n, s) => n + s.blockCount, 0),
    validationSummary: buildValidationSummary(validation),
    qualityScores: validation && validation.qualityScores
      ? deepClone(validation.qualityScores)
      : null,
    warnings: warningMessages,
    validationErrors,
    validationWarnings,
    generatorCompatibility: validation && validation.generatorCompatibility
      ? deepClone(validation.generatorCompatibility)
      : null,
    publishReadiness: validation && validation.publishReadiness
      ? deepClone(validation.publishReadiness)
      : null,
    reviewAreas
  };
}

module.exports = {
  buildAiPayload,
  buildNormalizedMetadata,
  buildCleanSection,
  buildValidationSummary,
  collectUniqueWarnings,
  slimFinding,
  deepClone
};
