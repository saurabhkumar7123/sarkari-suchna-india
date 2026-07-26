"use strict";

/**
 * CIP Stage 3A — Source capability / format / language analysis.
 * Profiling only — no OCR, no download, no content extraction.
 */

const { DOWNLOAD_REQUIREMENTS, CANDIDATE_FILE_TYPES } = require("./sourceTypes");

function asBool(value, fallback = false) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function asTriState(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

/**
 * Detect document format from explicit hints only (no network).
 * @param {object} input
 * @returns {{ documentFormat: 'html'|'pdf'|'unknown', candidateFileType: string, reasons: string[] }}
 */
function detectDocumentFormat(input = {}) {
  const reasons = [];
  const contentType = String(input.contentType || input.mimeType || "")
    .trim()
    .toLowerCase();
  const filename = String(input.filename || "").trim().toLowerCase();
  const url = String(input.url || input.sourceUrl || "").trim().toLowerCase();
  const declared = String(input.documentFormat || input.format || "")
    .trim()
    .toLowerCase();

  if (declared === "pdf" || declared === "html") {
    reasons.push(`declared_document_format:${declared}`);
    return {
      documentFormat: declared,
      candidateFileType: declared === "pdf" ? "pdf" : "html",
      reasons
    };
  }

  if (contentType.includes("application/pdf") || contentType === "pdf") {
    reasons.push("content_type_pdf");
    return { documentFormat: "pdf", candidateFileType: "pdf", reasons };
  }
  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml") ||
    contentType === "html"
  ) {
    reasons.push("content_type_html");
    return { documentFormat: "html", candidateFileType: "html", reasons };
  }

  if (/\.pdf(\?|#|$)/i.test(filename) || filename.endsWith(".pdf")) {
    reasons.push("filename_pdf_extension");
    return { documentFormat: "pdf", candidateFileType: "pdf", reasons };
  }
  if (/\.html?(\?|#|$)/i.test(filename) || /\.html?$/i.test(filename)) {
    const candidateFileType = filename.endsWith(".htm") ? "htm" : "html";
    reasons.push("filename_html_extension");
    return { documentFormat: "html", candidateFileType, reasons };
  }

  if (/\.pdf(\?|#|$)/i.test(url)) {
    reasons.push("url_pdf_extension");
    return { documentFormat: "pdf", candidateFileType: "pdf", reasons };
  }
  if (/\.html?(\?|#|$)/i.test(url)) {
    const candidateFileType = /\.htm(\?|#|$)/i.test(url) ? "htm" : "html";
    reasons.push("url_html_extension");
    return { documentFormat: "html", candidateFileType, reasons };
  }

  if (input.hasPdf === true && input.hasHtml !== true) {
    reasons.push("has_pdf_hint_without_html");
    return { documentFormat: "pdf", candidateFileType: "pdf", reasons };
  }
  if (input.hasHtml === true && input.hasPdf !== true) {
    reasons.push("has_html_hint_without_pdf");
    return { documentFormat: "html", candidateFileType: "html", reasons };
  }

  reasons.push("format_unknown");
  return {
    documentFormat: "unknown",
    candidateFileType: "unknown",
    reasons
  };
}

/**
 * Primary + secondary language from provided sample text only.
 * Reuses the Devanagari/Latin heuristic from Stage 1B (inline, no mutation).
 * @param {string} text
 * @returns {{ primaryLanguage: string, secondaryLanguage: string|null }}
 */
function detectLanguages(text) {
  const sample = String(text || "");
  if (!sample.trim()) {
    return { primaryLanguage: "unknown", secondaryLanguage: null };
  }

  const devanagariMatches = sample.match(/[\u0900-\u097F]/g);
  const latinMatches = sample.match(/[A-Za-z]/g);
  const hiCount = devanagariMatches ? devanagariMatches.length : 0;
  const enCount = latinMatches ? latinMatches.length : 0;

  if (hiCount === 0 && enCount === 0) {
    return { primaryLanguage: "unknown", secondaryLanguage: null };
  }
  if (hiCount > 0 && enCount >= 3) {
    if (enCount >= hiCount) {
      return { primaryLanguage: "en", secondaryLanguage: "hi" };
    }
    return { primaryLanguage: "hi", secondaryLanguage: "en" };
  }
  if (hiCount > 0) {
    return { primaryLanguage: "hi", secondaryLanguage: null };
  }
  if (enCount >= 3) {
    return { primaryLanguage: "en", secondaryLanguage: null };
  }
  return { primaryLanguage: "unknown", secondaryLanguage: null };
}

/**
 * Analyze source capabilities from explicit boolean hints + format.
 * Never invents structure from unread content.
 * @param {object} input
 * @param {'html'|'pdf'|'unknown'} documentFormat
 */
function analyzeCapabilities(input = {}, documentFormat = "unknown") {
  const hasPdfHint = asTriState(input.hasPdf);
  const hasHtmlHint = asTriState(input.hasHtml);
  const hasTables = asBool(input.hasTables, false);
  const hasForms = asBool(input.hasForms, false);
  const hasImages = asBool(input.hasImages, false);
  const textSelectable = asTriState(input.textSelectable);
  const isScanned = asTriState(input.isScanned);
  const declaredOcr = asTriState(input.likelyOcrRequired);
  const declaredStructured = asTriState(input.likelyStructured);
  const declaredSemi = asTriState(input.likelySemiStructured);
  const declaredUnstructured = asTriState(input.likelyUnstructured);

  const hasPdf =
    hasPdfHint !== null
      ? hasPdfHint
      : documentFormat === "pdf" || Boolean(input.linkedPdfUrl);
  const hasHtml =
    hasHtmlHint !== null
      ? hasHtmlHint
      : documentFormat === "html";

  let downloadRequirement = DOWNLOAD_REQUIREMENTS.UNKNOWN;
  if (documentFormat === "pdf" || hasPdf) {
    downloadRequirement = DOWNLOAD_REQUIREMENTS.REQUIRED;
  } else if (documentFormat === "html" && !hasPdf) {
    downloadRequirement = DOWNLOAD_REQUIREMENTS.NONE;
  } else if (hasHtml && hasPdf) {
    downloadRequirement = DOWNLOAD_REQUIREMENTS.OPTIONAL;
  }

  let likelyOcrRequired = false;
  if (declaredOcr !== null) {
    likelyOcrRequired = declaredOcr;
  } else if (isScanned === true) {
    likelyOcrRequired = true;
  } else if (documentFormat === "pdf" && textSelectable === false) {
    likelyOcrRequired = true;
  } else if (documentFormat === "pdf" && hasImages && textSelectable === null) {
    // Image-heavy PDF without selectable-text confirmation → OCR likely
    likelyOcrRequired = true;
  }

  let likelyStructured = false;
  let likelySemiStructured = false;
  let likelyUnstructured = false;

  if (declaredStructured !== null || declaredSemi !== null || declaredUnstructured !== null) {
    likelyStructured = declaredStructured === true;
    likelySemiStructured = declaredSemi === true;
    likelyUnstructured = declaredUnstructured === true;
  } else if (hasTables || hasForms) {
    likelyStructured = true;
    likelySemiStructured = false;
    likelyUnstructured = false;
  } else if (documentFormat === "html") {
    likelyStructured = false;
    likelySemiStructured = true;
    likelyUnstructured = false;
  } else if (documentFormat === "pdf" && likelyOcrRequired) {
    likelyStructured = false;
    likelySemiStructured = false;
    likelyUnstructured = true;
  } else if (documentFormat === "pdf") {
    likelyStructured = false;
    likelySemiStructured = true;
    likelyUnstructured = false;
  } else {
    likelyStructured = false;
    likelySemiStructured = false;
    likelyUnstructured = false;
  }

  return {
    downloadRequirement,
    hasPdf,
    hasHtml,
    hasTables,
    hasForms,
    hasImages,
    likelyOcrRequired,
    likelyStructured,
    likelySemiStructured,
    likelyUnstructured
  };
}

/**
 * Build language sample from profiling fields only (title/filename/hints).
 * @param {object} input
 */
function buildLanguageSample(input = {}) {
  return [input.title, input.filename, input.languageHintText, input.textSample]
    .filter((v) => v != null && String(v).trim())
    .join(" ");
}

function normalizeCandidateFileType(value) {
  if (CANDIDATE_FILE_TYPES.includes(value)) return value;
  return "unknown";
}

module.exports = {
  detectDocumentFormat,
  detectLanguages,
  analyzeCapabilities,
  buildLanguageSample,
  normalizeCandidateFileType,
  asBool,
  asTriState
};
