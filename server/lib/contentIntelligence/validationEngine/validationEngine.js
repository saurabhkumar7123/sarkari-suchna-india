"use strict";

/**
 * CIP Stage 1E — Shared Content Validation & Quality Engine.
 *
 * Pipeline position:
 *   Stage 1A → Stage 1B → Stage 1C+1D → Stage 1E (this)
 *
 * Validates a structured document produced by Stage 1C+1D.
 * NEVER modifies the document. Validation only.
 * Deterministic, no AI, no external dependencies, no DB/runtime wiring.
 */

const { structureDocument } = require("../structureIntelligence");

const { validateDocument } = require("./documentValidator");
const { validateMetadata } = require("./metadataValidator");
const { validateSections } = require("./sectionValidator");
const { validateBlocks } = require("./blockValidator");
const { computeQualityReports, suggestReviewAreas } = require("./qualityScorer");
const { SEVERITIES, QUALITY_SCORE_KEYS } = require("./validationTypes");

const ENGINE_ID = "CIP_CONTENT_VALIDATION_ENGINE";
const STAGE_ID = "CIP_1E";
const ENGINE_VERSION = "1.0.0";

/**
 * @typedef {Object} ValidateDocumentInput
 * @property {object} [structuredDocument] Stage 1C+1D output to validate (preferred)
 * @property {string} [title]
 * @property {string} [text]
 * @property {string} [content]
 * @property {string} [filename]
 * @property {string} [url]
 * @property {object} [metadata]
 * @property {object} [classification]
 * @property {object} [metadataResult]
 * @property {boolean} [skipStructure] When true and structuredDocument missing, fail
 */

function resolveStructuredDocument(input = {}) {
  if (input.structuredDocument && typeof input.structuredDocument === "object") {
    return { document: input.structuredDocument, built: false };
  }
  if (input.skipStructure) {
    return { document: null, built: false };
  }
  // Convenience: build via Stage 1C+1D without mutating anything shared
  const document = structureDocument({
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
  });
  return { document, built: true };
}

function partitionFindings(findings) {
  const errors = [];
  const warnings = [];
  const information = [];
  for (const finding of findings) {
    if (finding.severity === SEVERITIES.ERROR) errors.push(finding);
    else if (finding.severity === SEVERITIES.WARNING) warnings.push(finding);
    else information.push(finding);
  }
  return { errors, warnings, information };
}

function countByCategory(findings) {
  const counts = Object.create(null);
  for (const finding of findings) {
    const key = finding.category || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Validate a structured document (or build one from raw input via 1C+1D).
 * The input structured document is never mutated.
 *
 * @param {ValidateDocumentInput} input
 */
function validateContent(input = {}) {
  const resolved = resolveStructuredDocument(input);
  const structuredDocument = resolved.document;

  // Shallow freeze guard: work on findings only; never write to document fields
  const findings = [];

  if (!structuredDocument) {
    findings.push({
      code: "VAL_NO_DOCUMENT",
      severity: SEVERITIES.ERROR,
      category: "document",
      message: "No structured document available for validation."
    });
  } else {
    findings.push(...validateDocument(structuredDocument));
    findings.push(...validateMetadata(structuredDocument));
    findings.push(...validateSections(structuredDocument));
    findings.push(...validateBlocks(structuredDocument));
  }

  // Stable deterministic ordering: severity rank, then code, then path
  const severityRank = {
    [SEVERITIES.ERROR]: 0,
    [SEVERITIES.WARNING]: 1,
    [SEVERITIES.INFO]: 2
  };
  findings.sort((a, b) => {
    const sr = (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9);
    if (sr !== 0) return sr;
    const codeCmp = String(a.code || "").localeCompare(String(b.code || ""));
    if (codeCmp !== 0) return codeCmp;
    return String(a.path || "").localeCompare(String(b.path || ""));
  });

  const { errors, warnings, information } = partitionFindings(findings);
  const { scores, generatorCompatibility, publishReadiness } = computeQualityReports(findings);
  const suggestedReviewAreas = suggestReviewAreas(findings);

  const summary = {
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    infoCount: information.length,
    findingCount: findings.length,
    documentType: structuredDocument ? structuredDocument.documentType : null,
    sectionCount: structuredDocument ? structuredDocument.sectionCount || 0 : 0,
    blockCount: structuredDocument ? structuredDocument.blockCount || 0 : 0,
    categoryCounts: countByCategory(findings),
    overallScore: scores.overall,
    publishReady: publishReadiness.ready,
    generatorCompatible: generatorCompatibility.compatible
  };

  return {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    summary,
    errors,
    warnings,
    information,
    findings,
    qualityScores: scores,
    generatorCompatibility,
    publishReadiness,
    suggestedReviewAreas,
    // Read-only reference echo (same object identity; never mutated by this engine)
    structuredDocumentRef: structuredDocument
      ? {
          engineId: structuredDocument.engineId,
          stageId: structuredDocument.stageId,
          documentType: structuredDocument.documentType,
          sectionCount: structuredDocument.sectionCount,
          blockCount: structuredDocument.blockCount
        }
      : null,
    extensions: {
      structuredDocumentBuilt: resolved.built,
      scoreKeys: QUALITY_SCORE_KEYS.slice()
    }
  };
}

/**
 * Convenience: validate from Stage 1C+1D structured document only.
 * @param {object} structuredDocument
 * @param {object} [extra]
 */
function validateStructuredDocument(structuredDocument, extra = {}) {
  return validateContent({ ...extra, structuredDocument, skipStructure: true });
}

/**
 * Convenience: structure then validate from raw text.
 * @param {string} text
 * @param {ValidateDocumentInput} [extra]
 */
function validateContentFromText(text, extra = {}) {
  return validateContent({ ...extra, text });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  validateContent,
  validateStructuredDocument,
  validateContentFromText,
  resolveStructuredDocument,
  partitionFindings
};
