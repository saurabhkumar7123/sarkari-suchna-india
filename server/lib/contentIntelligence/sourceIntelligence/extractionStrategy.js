"use strict";

/**
 * CIP Stage 3A — Deterministic recommended extraction strategy.
 * Profiling recommendation only — does not extract or invoke OCR/AI.
 */

const {
  EXTRACTION_STRATEGIES,
  EXTRACTION_STRATEGY_LABELS,
  RELIABILITY_CLASSES,
  getExtractionStrategyLabel
} = require("./sourceTypes");

/**
 * @param {object} ctx
 * @param {object} ctx.capabilities
 * @param {object} ctx.reliability
 * @param {string} ctx.sourceType
 * @param {string} ctx.documentFormat
 * @returns {{
 *   strategy: string,
 *   strategyLabel: string,
 *   reasons: string[],
 *   confidence: string
 * }}
 */
function recommendExtractionStrategy(ctx = {}) {
  const capabilities = ctx.capabilities || {};
  const reliability = ctx.reliability || {};
  const reasons = [];
  const sourceType = ctx.sourceType || "unknown_source";
  const documentFormat = ctx.documentFormat || "unknown";

  const hasHtml = capabilities.hasHtml === true;
  const hasPdf = capabilities.hasPdf === true;
  const ocrLikely = capabilities.likelyOcrRequired === true;
  const isMirror = reliability.class === RELIABILITY_CLASSES.MIRROR;
  const isUnknownReliability = reliability.class === RELIABILITY_CLASSES.UNKNOWN;
  const isUnknownSource = sourceType === "unknown_source";

  // Priority 1: OCR required when deterministically indicated
  if (ocrLikely) {
    reasons.push("likely_ocr_required");
    return {
      strategy: EXTRACTION_STRATEGIES.OCR_REQUIRED,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.OCR_REQUIRED,
      reasons,
      confidence: "high"
    };
  }

  // Priority 2: Manual review for mirror / unknown authority without clear format path
  if (isMirror) {
    reasons.push("mirror_source_requires_manual_verification");
    return {
      strategy: EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.MANUAL_REVIEW_RECOMMENDED,
      reasons,
      confidence: "high"
    };
  }

  if (isUnknownSource && documentFormat === "unknown") {
    reasons.push("unknown_source_and_unknown_format");
    return {
      strategy: EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.MANUAL_REVIEW_RECOMMENDED,
      reasons,
      confidence: "medium"
    };
  }

  if (isUnknownReliability && !hasHtml && !hasPdf) {
    reasons.push("unknown_reliability_without_format_capabilities");
    return {
      strategy: EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.MANUAL_REVIEW_RECOMMENDED,
      reasons,
      confidence: "medium"
    };
  }

  // Priority 3: Combined HTML + PDF
  if (hasHtml && hasPdf) {
    reasons.push("both_html_and_pdf_available");
    return {
      strategy: EXTRACTION_STRATEGIES.HTML_PLUS_PDF,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.HTML_PLUS_PDF,
      reasons,
      confidence: "high"
    };
  }

  // Priority 4: HTML first
  if (hasHtml && !hasPdf) {
    reasons.push("html_available_without_pdf");
    return {
      strategy: EXTRACTION_STRATEGIES.HTML_FIRST,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.HTML_FIRST,
      reasons,
      confidence: "high"
    };
  }

  // Priority 5: PDF first
  if (hasPdf) {
    reasons.push("pdf_available");
    if (
      sourceType === "official_pdf" ||
      sourceType === "linked_pdf" ||
      sourceType.endsWith("_pdf")
    ) {
      reasons.push(`source_type:${sourceType}`);
    }
    return {
      strategy: EXTRACTION_STRATEGIES.PDF_FIRST,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.PDF_FIRST,
      reasons,
      confidence: "high"
    };
  }

  if (documentFormat === "html") {
    reasons.push("document_format_html");
    return {
      strategy: EXTRACTION_STRATEGIES.HTML_FIRST,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.HTML_FIRST,
      reasons,
      confidence: "medium"
    };
  }

  if (documentFormat === "pdf") {
    reasons.push("document_format_pdf");
    return {
      strategy: EXTRACTION_STRATEGIES.PDF_FIRST,
      strategyLabel: EXTRACTION_STRATEGY_LABELS.PDF_FIRST,
      reasons,
      confidence: "medium"
    };
  }

  reasons.push("insufficient_deterministic_strategy_signals");
  return {
    strategy: EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED,
    strategyLabel: EXTRACTION_STRATEGY_LABELS.MANUAL_REVIEW_RECOMMENDED,
    reasons,
    confidence: "low"
  };
}

module.exports = {
  recommendExtractionStrategy,
  getExtractionStrategyLabel
};
