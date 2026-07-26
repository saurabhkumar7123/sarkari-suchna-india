"use strict";

/**
 * CIP Stage 3E — Extraction Quality & Validation Engine.
 *
 * Shared deterministic service for manual PDF and automation workflows.
 * Assesses extraction quality, structural completeness, correlation
 * consistency, and downstream readiness. Never modifies content, never
 * repairs, never publishes, never calls AI/OCR/network.
 *
 * Boundaries:
 *   - Does not modify Program 1, Program 2, or Stages 3A–3D
 *   - Does not modify Generator, Publishing, Monitoring, Editorial,
 *     Database, Runtime, or AI
 */

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  REPORT_VERSION,
  QUALITY_REPORT_FORMAT_ID,
  SEVERITIES
} = require("./extractionQualityTypes");
const { deepFreeze, uniqueOrdered, asArray } = require("./extractionQualityUtils");
const { adaptInput } = require("./inputAdapter");
const { validateDocument } = require("./documentValidators");
const { validateCorrelationBundle } = require("./correlationValidators");
const {
  computeQualityScores,
  assessReadiness,
  suggestManualChecks,
  selectKeyFindings,
  buildSummary
} = require("./qualityScorer");

function normalizeOptions(options) {
  return options && typeof options === "object" ? options : {};
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

function countBy(items, key) {
  const output = {};
  for (const item of items) {
    const value = item[key] || "unknown";
    output[value] = (output[value] || 0) + 1;
  }
  return output;
}

function buildDimensionSummary(findings) {
  const byDimension = {};
  for (const finding of findings) {
    const dimension = finding.dimension || "unspecified";
    if (!byDimension[dimension]) {
      byDimension[dimension] = { error: 0, warning: 0, info: 0, total: 0 };
    }
    byDimension[dimension][finding.severity] =
      (byDimension[dimension][finding.severity] || 0) + 1;
    byDimension[dimension].total += 1;
  }
  return byDimension;
}

/**
 * Assess extraction quality for supported Stage 3E inputs.
 *
 * @param {*} input Normalized HTML document, Normalized PDF document,
 *   Canonical Recruitment Correlation, array of documents, or unknown descriptor.
 * @param {object} [options]
 * @param {boolean} [options.freeze=true]
 * @returns Quality report object.
 */
function assessExtractionQuality(input, options = {}) {
  const opts = normalizeOptions(options);
  const adapted = adaptInput(input);
  const documents = adapted.documents;
  const correlation = adapted.correlation;
  const inputKind = adapted.inputKind;

  const findings = [];

  for (const warning of adapted.warnings) {
    findings.push({
      rule: "INPUT_WARNING",
      severity: SEVERITIES.WARNING,
      category: "extraction",
      message: warning,
      affectedDocument: null,
      affectedSection: null,
      affectedBlock: null,
      validationRule: "INPUT_WARNING",
      dimension: "warnings"
    });
  }

  if (!documents.length) {
    findings.push({
      rule: "INPUT_EMPTY",
      severity: SEVERITIES.ERROR,
      category: "extraction",
      message: "No documents available for quality assessment.",
      affectedDocument: null,
      affectedSection: null,
      affectedBlock: null,
      validationRule: "INPUT_EMPTY",
      dimension: "warnings"
    });
  }

  for (const view of documents) {
    findings.push(...validateDocument(view));
  }
  findings.push(...validateCorrelationBundle(documents, correlation));

  const hasCorrelation = correlation != null;
  const scores = computeQualityScores(findings, { hasCorrelation });
  const readiness = assessReadiness(findings, scores);
  const partitioned = partitionFindings(findings);
  const keyFindings = selectKeyFindings(findings);
  const suggestedManualChecks = suggestManualChecks(findings, readiness);
  const summary = buildSummary({
    inputKind,
    documents,
    scores,
    readiness,
    findings
  });

  const report = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    version: REPORT_VERSION,
    formatId: QUALITY_REPORT_FORMAT_ID,
    inputKind,
    documentsAssessed: documents.map((view) => ({
      documentId: view.documentId,
      inputIndex: view.inputIndex,
      kind: view.kind,
      formatId: view.formatId,
      stageId: view.stageId,
      engineId: view.engineId,
      title: view.title,
      sourceUrl: view.sourceUrl,
      sectionCount: asArray(view.sections).length,
      contentBlockCount: asArray(view.contentBlocks).length,
      resourceCount: asArray(view.resourceList).length,
      isNormalized: view.isNormalized,
      trace: view.trace
    })),
    correlationPresent: hasCorrelation,
    correlationSummary: hasCorrelation
      ? {
          formatId: correlation.formatId || null,
          correlationConfidence: correlation.correlationConfidence || null,
          documentCount: asArray(correlation.documents).length,
          unrelatedDocumentCount: asArray(correlation.unrelatedDocumentIds).length,
          timelineLength: asArray(correlation.timeline).length,
          recruitmentKey:
            (correlation.recruitmentIdentity && correlation.recruitmentIdentity.recruitmentKey) ||
            null
        }
      : null,
    scores,
    validationResults: findings,
    keyFindings,
    warnings: partitioned.warnings,
    blockingIssues: partitioned.errors,
    information: partitioned.information,
    suggestedManualChecks,
    readiness,
    dimensions: buildDimensionSummary(findings),
    summary,
    stats: {
      documentCount: documents.length,
      findingCount: findings.length,
      findingsBySeverity: countBy(findings, "severity"),
      findingsByCategory: countBy(findings, "category"),
      errorCount: partitioned.errors.length,
      warningCount: partitioned.warnings.length,
      infoCount: partitioned.information.length
    }
  };

  return opts.freeze === false ? report : deepFreeze(report);
}

/** Convenience aliases for shared manual + automation workflows. */
function validateExtractionQuality(input, options = {}) {
  return assessExtractionQuality(input, options);
}

function assessNormalizedDocument(document, options = {}) {
  return assessExtractionQuality(document, options);
}

function assessRecruitmentCorrelation(correlation, options = {}) {
  return assessExtractionQuality(correlation, options);
}

function assessDocuments(documents, options = {}) {
  return assessExtractionQuality(documents, options);
}

function qualityReportFingerprint(report) {
  return JSON.stringify(report);
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  REPORT_VERSION,
  QUALITY_REPORT_FORMAT_ID,
  assessExtractionQuality,
  validateExtractionQuality,
  assessNormalizedDocument,
  assessRecruitmentCorrelation,
  assessDocuments,
  qualityReportFingerprint,
  deepFreeze,
  uniqueOrdered
};
