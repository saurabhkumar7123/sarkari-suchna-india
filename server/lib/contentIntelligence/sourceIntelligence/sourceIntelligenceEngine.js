"use strict";

/**
 * CIP Stage 3A — Shared Source Intelligence Engine.
 *
 * Analyzes WHAT a source is before extraction.
 * Manual PDF workflow and automation workflow use this exact engine.
 *
 * Boundaries:
 *   - Profiling only
 *   - No AI / OCR / network / download / content extraction
 *   - No Generator / Publishing / Monitoring / Editorial / DB changes
 *   - Does not modify Program 1 or Program 2
 */

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  PROFILE_VERSION,
  SOURCE_PROFILE_FORMAT_ID,
  getSourceTypeLabel
} = require("./sourceTypes");

const { extractHostname } = require("./officialDomains");
const {
  detectDocumentFormat,
  detectLanguages,
  analyzeCapabilities,
  buildLanguageSample,
  normalizeCandidateFileType
} = require("./sourceAnalyzer");
const { buildSearchBlobs, classifySourceType } = require("./sourceClassifier");
const { assessReliability } = require("./reliabilityAssessor");
const { detectRelationships } = require("./relationshipDetector");
const { recommendExtractionStrategy } = require("./extractionStrategy");

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function stableClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pickUrl(input = {}) {
  const raw = input.url || input.sourceUrl || null;
  if (raw == null || raw === "") return null;
  return String(raw).trim() || null;
}

function collectWarnings(...groups) {
  const out = [];
  const seen = Object.create(null);
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const warning of group) {
      const text = String(warning || "").trim();
      if (!text || seen[text]) continue;
      seen[text] = true;
      out.push(text);
    }
  }
  return out;
}

/**
 * @typedef {Object} AnalyzeSourceInput
 * @property {string} [url]
 * @property {string} [sourceUrl]
 * @property {string} [filename]
 * @property {string} [title]
 * @property {string} [contentType]
 * @property {string} [mimeType]
 * @property {string} [documentFormat]
 * @property {string} [officialDomain]
 * @property {string} [officialWebsite]
 * @property {string} [linkedFromUrl]
 * @property {boolean} [isLinkedPdf]
 * @property {boolean} [hasPdf]
 * @property {boolean} [hasHtml]
 * @property {boolean} [hasTables]
 * @property {boolean} [hasForms]
 * @property {boolean} [hasImages]
 * @property {boolean} [textSelectable]
 * @property {boolean} [isScanned]
 * @property {boolean} [likelyOcrRequired]
 * @property {string} [parentNotificationUrl]
 * @property {string} [notificationUrl]
 * @property {string} [textSample]
 * @property {string} [languageHintText]
 * @property {boolean} [freeze]
 */

/**
 * Build a deterministic Source Profile for the given source descriptors.
 * @param {AnalyzeSourceInput} input
 */
function analyzeSource(input = {}) {
  const sourceUrl = pickUrl(input);
  const sourceDomain = extractHostname(sourceUrl) || extractHostname(input.sourceDomain) || null;
  const filename = input.filename != null ? String(input.filename).trim() || null : null;

  const formatInfo = detectDocumentFormat(input);
  const documentFormat = formatInfo.documentFormat;
  const candidateFileType = normalizeCandidateFileType(formatInfo.candidateFileType);

  const reliability = assessReliability(input, sourceDomain);

  const blobs = buildSearchBlobs(input);
  const isLinkedPdf =
    documentFormat === "pdf" &&
    (input.isLinkedPdf === true ||
      Boolean(input.linkedFromUrl) ||
      input.linkedFromHtml === true);

  const classification = classifySourceType({
    documentFormat,
    isOfficial: reliability.isOfficial,
    isLinkedPdf,
    blobs
  });

  const languageSample = buildLanguageSample(input);
  const languages = detectLanguages(languageSample);

  // Allow explicit language overrides only when valid
  let primaryLanguage = languages.primaryLanguage;
  let secondaryLanguage = languages.secondaryLanguage;
  if (input.primaryLanguage === "en" || input.primaryLanguage === "hi") {
    primaryLanguage = input.primaryLanguage;
  }
  if (input.secondaryLanguage === "en" || input.secondaryLanguage === "hi") {
    secondaryLanguage = input.secondaryLanguage;
  } else if (input.secondaryLanguage === null) {
    secondaryLanguage = null;
  }

  const capabilities = analyzeCapabilities(input, documentFormat);

  // Linked PDF often implies HTML parent + PDF child
  if (isLinkedPdf && !capabilities.hasHtml && input.linkedFromUrl) {
    capabilities.hasHtml = true;
    if (capabilities.downloadRequirement === "required") {
      // keep required for PDF download
    }
  }

  const relationships = detectRelationships(input, classification.sourceType, blobs);

  const recommendedExtractionStrategy = recommendExtractionStrategy({
    capabilities,
    reliability,
    sourceType: classification.sourceType,
    documentFormat
  });

  const warnings = collectWarnings(
    reliability.warnings,
    documentFormat === "unknown" ? ["Document format could not be determined deterministically."] : [],
    classification.sourceType === "unknown_source"
      ? ["Source type classified as unknown_source."]
      : [],
    !sourceUrl ? ["Source URL not provided."] : []
  );

  const contentType =
    input.contentType != null
      ? String(input.contentType).trim() || null
      : input.mimeType != null
        ? String(input.mimeType).trim() || null
        : null;

  const profile = {
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    profileVersion: PROFILE_VERSION,
    formatId: SOURCE_PROFILE_FORMAT_ID,

    identity: {
      sourceUrl,
      sourceDomain,
      officialDomain: reliability.officialDomain,
      filename,
      contentType,
      candidateFileType
    },

    classification: {
      sourceType: classification.sourceType,
      sourceTypeLabel: getSourceTypeLabel(classification.sourceType),
      documentFormat,
      primaryLanguage,
      secondaryLanguage,
      confidence: classification.confidence,
      matchedIndicators: classification.matchedIndicators.slice(),
      reasoning: classification.reasoning,
      formatReasons: formatInfo.reasons.slice()
    },

    reliability: {
      class: reliability.class,
      confidence: reliability.confidence,
      reasons: reliability.reasons.slice(),
      warnings: reliability.warnings.slice()
    },

    relationships: {
      role: relationships.role,
      relatedTo: relationships.relatedTo,
      relationshipType: relationships.relationshipType,
      parentIndicators: relationships.parentIndicators.slice(),
      confidence: relationships.confidence,
      reasons: relationships.reasons.slice()
    },

    capabilities: {
      downloadRequirement: capabilities.downloadRequirement,
      hasPdf: capabilities.hasPdf,
      hasHtml: capabilities.hasHtml,
      hasTables: capabilities.hasTables,
      hasForms: capabilities.hasForms,
      hasImages: capabilities.hasImages,
      likelyOcrRequired: capabilities.likelyOcrRequired,
      likelyStructured: capabilities.likelyStructured,
      likelySemiStructured: capabilities.likelySemiStructured,
      likelyUnstructured: capabilities.likelyUnstructured
    },

    warnings,
    recommendedExtractionStrategy,

    // Convenience top-level mirrors for callers
    sourceType: classification.sourceType,
    documentFormat,
    primaryLanguage,
    secondaryLanguage
  };

  const shouldFreeze = input.freeze !== false;
  return shouldFreeze ? deepFreeze(profile) : profile;
}

/**
 * Convenience: analyze from a bare URL string.
 * @param {string} url
 * @param {object} [extra]
 */
function analyzeSourceFromUrl(url, extra = {}) {
  return analyzeSource({ ...extra, url });
}

/**
 * Convenience: analyze a local/manual PDF descriptor.
 * @param {object} input
 */
function analyzeSourceFromPdf(input = {}) {
  return analyzeSource({
    ...input,
    documentFormat: input.documentFormat || "pdf",
    hasPdf: input.hasPdf !== false,
    contentType: input.contentType || input.mimeType || "application/pdf"
  });
}

/**
 * Convenience: analyze an HTML page descriptor.
 * @param {object} input
 */
function analyzeSourceFromHtml(input = {}) {
  return analyzeSource({
    ...input,
    documentFormat: input.documentFormat || "html",
    hasHtml: input.hasHtml !== false,
    contentType: input.contentType || input.mimeType || "text/html"
  });
}

/**
 * Determinism helper for tests: serialize stable profile keys.
 * @param {object} profile
 */
function profileFingerprint(profile) {
  const clone = stableClone(profile);
  return JSON.stringify(clone);
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  PROFILE_VERSION,
  SOURCE_PROFILE_FORMAT_ID,
  analyzeSource,
  analyzeSourceFromUrl,
  analyzeSourceFromPdf,
  analyzeSourceFromHtml,
  deepFreeze,
  profileFingerprint
};
