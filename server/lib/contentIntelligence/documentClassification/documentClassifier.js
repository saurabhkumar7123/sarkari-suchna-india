"use strict";

/**
 * CIP Stage 1A — Shared Document Classification Engine.
 *
 * Pure reusable service for both:
 *   1. Manual PDF Pipeline
 *   2. Automatic Government Website Pipeline
 *
 * Classification only — no section/block detection, no Generator changes.
 * Reuses normalizeRecruitmentNoticeText from eventTypeClassifier.
 */

const {
  normalizeRecruitmentNoticeText
} = require("../../recruitment/eventTypeClassifier");

const {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  TYPE_PRECEDENCE,
  CONFIDENCE_LEVELS,
  UNKNOWN_DOCUMENT_TYPE,
  PAGE_STATUS_HINTS,
  isKnownDocumentType,
  getDocumentTypeLabel
} = require("./documentTypes");

const {
  CLASSIFICATION_RULES,
  CIP_ABBREVIATION_REPLACEMENTS
} = require("./classificationRules");

const SOURCE_WEIGHT = Object.freeze({
  title: 3,
  headings: 2.5,
  filename: 2,
  url: 1.5,
  metadata: 1.5,
  text: 1,
  content: 1,
  body: 1
});

/**
 * @typedef {Object} ClassifyDocumentInput
 * @property {string} [title]
 * @property {string|string[]} [headings]
 * @property {string} [text]
 * @property {string} [content]
 * @property {string} [filename]
 * @property {string} [url]
 * @property {Object} [metadata]
 * @property {string} [metadata.status]
 * @property {string} [metadata.category]
 * @property {string} [metadata.documentType]
 * @property {string} [metadata.type]
 */

/**
 * @typedef {Object} MatchedIndicator
 * @property {string} id
 * @property {string} documentType
 * @property {string} source
 * @property {'high'|'medium'|'low'} confidence
 * @property {string} [matchedPattern]
 */

/**
 * @typedef {Object} ClassifyDocumentResult
 * @property {string} documentType
 * @property {string} documentTypeLabel
 * @property {'high'|'medium'|'low'|'none'} confidence
 * @property {MatchedIndicator[]} matchedIndicators
 * @property {string} reasoning
 * @property {string[]} warnings
 * @property {string} normalizedText
 * @property {string|null} pageStatusHint
 * @property {Object} scores
 */

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyCipAbbreviations(value) {
  let text = ` ${value} `;
  for (const [pattern, replacement] of CIP_ABBREVIATION_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return collapseWhitespace(text);
}

function headingsToString(headings) {
  if (!headings) return "";
  if (Array.isArray(headings)) {
    return headings.map((h) => collapseWhitespace(h)).filter(Boolean).join(" ");
  }
  return collapseWhitespace(headings);
}

function metadataToString(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return "";
  const parts = [
    metadata.documentType,
    metadata.type,
    metadata.category,
    metadata.status,
    metadata.title
  ];
  return collapseWhitespace(parts.filter(Boolean).join(" "));
}

/**
 * Build field-scoped normalized snippets for weighted matching.
 * Reuses eventTypeClassifier normalization for consistency.
 * @param {ClassifyDocumentInput} input
 */
function buildFieldTexts(input = {}) {
  const title = applyCipAbbreviations(
    normalizeRecruitmentNoticeText({ title: input.title || "" })
  );
  const headings = applyCipAbbreviations(
    normalizeRecruitmentNoticeText({ title: headingsToString(input.headings) })
  );
  const filename = applyCipAbbreviations(
    normalizeRecruitmentNoticeText({
      title: String(input.filename || "").replace(/[-_+.]/g, " ")
    })
  );
  const url = applyCipAbbreviations(
    normalizeRecruitmentNoticeText({ url: input.url || "" })
  );
  const metadata = applyCipAbbreviations(
    normalizeRecruitmentNoticeText({ title: metadataToString(input.metadata) })
  );
  const bodyRaw = input.text || input.content || "";
  const text = applyCipAbbreviations(
    normalizeRecruitmentNoticeText({ content: bodyRaw })
  );

  const combined = collapseWhitespace(
    [title, headings, filename, url, metadata, text].filter(Boolean).join(" ")
  );

  return { title, headings, filename, url, metadata, text, combined };
}

function findMatchedPattern(rule, fieldText) {
  for (const pattern of rule.patterns) {
    const match = fieldText.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function collectMatches(fieldTexts) {
  /** @type {MatchedIndicator[]} */
  const matches = [];
  const sources = [
    ["title", fieldTexts.title],
    ["headings", fieldTexts.headings],
    ["filename", fieldTexts.filename],
    ["url", fieldTexts.url],
    ["metadata", fieldTexts.metadata],
    ["text", fieldTexts.text]
  ];

  for (const rule of CLASSIFICATION_RULES) {
    for (const [source, fieldText] of sources) {
      if (!fieldText) continue;
      const matchedPattern = findMatchedPattern(rule, fieldText);
      if (!matchedPattern) continue;
      matches.push({
        id: rule.id,
        documentType: rule.documentType,
        source,
        confidence: rule.confidence,
        matchedPattern,
        weight: SOURCE_WEIGHT[source] ?? 1
      });
    }
  }

  return matches;
}

function scoreByType(matches) {
  const confRank = { high: 3, medium: 2, low: 1, none: 0 };
  const scores = Object.create(null);

  for (const match of matches) {
    const type = match.documentType;
    if (!scores[type]) {
      scores[type] = { score: 0, indicators: [], bestConfidence: "none" };
    }
    const bump = (confRank[match.confidence] || 0) * (match.weight || 1);
    scores[type].score += bump;
    scores[type].indicators.push(match);
    if ((confRank[match.confidence] || 0) > (confRank[scores[type].bestConfidence] || 0)) {
      scores[type].bestConfidence = match.confidence;
    }
  }

  return scores;
}

function pickBestType(scores) {
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;

  entries.sort((a, b) => {
    const [typeA, scoreA] = a;
    const [typeB, scoreB] = b;
    if (scoreB.score !== scoreA.score) return scoreB.score - scoreA.score;
    const precA = TYPE_PRECEDENCE[typeA] ?? 99;
    const precB = TYPE_PRECEDENCE[typeB] ?? 99;
    if (precA !== precB) return precA - precB;
    return String(typeA).localeCompare(String(typeB));
  });

  return { documentType: entries[0][0], detail: entries[0][1], ranked: entries };
}

function resolveConfidence(best, ranked) {
  if (!best) return "none";
  let confidence = best.detail.bestConfidence || "none";
  const competitors = ranked.filter(([type]) => type !== best.documentType);

  if (competitors.length === 0) return confidence;

  const bestPrec = TYPE_PRECEDENCE[best.documentType] ?? 99;
  const bestScore = best.detail.score;
  const nearest = competitors[0];
  const nearestScore = nearest[1].score;
  const nearestPrec = TYPE_PRECEDENCE[nearest[0]] ?? 99;

  const closeScore = nearestScore >= bestScore * 0.7;
  const closePrecedence = Math.abs(nearestPrec - bestPrec) <= 10;

  if (closeScore && closePrecedence) {
    if (confidence === "high") return "medium";
    if (confidence === "medium") return "low";
    return "low";
  }

  return confidence;
}

function buildReasoning(best, confidence, indicators) {
  if (!best) {
    return "No document-type indicators matched title, headings, metadata, filename, URL, or body text.";
  }

  const label = getDocumentTypeLabel(best.documentType);
  const sources = [...new Set(indicators.map((i) => i.source))];
  const patterns = [...new Set(indicators.map((i) => i.matchedPattern).filter(Boolean))];
  const patternPreview = patterns.slice(0, 4).join(", ");

  return (
    `Classified as ${label} (${best.documentType}) with ${confidence} confidence ` +
    `from ${indicators.length} indicator(s) in ${sources.join(", ")}` +
    (patternPreview ? `; matched: ${patternPreview}` : "") +
    "."
  );
}

function buildWarnings(best, ranked, fieldTexts, confidence) {
  const warnings = [];

  if (!fieldTexts.combined) {
    warnings.push("Empty input: no title, headings, text, filename, URL, or metadata provided.");
    return warnings;
  }

  if (!best) {
    warnings.push("Unable to classify document type; returned Unknown.");
    return warnings;
  }

  if (confidence === "low" || confidence === "medium") {
    warnings.push(`Classification confidence is ${confidence}; review recommended.`);
  }

  if (ranked.length > 1) {
    const runnerUp = ranked[1];
    const runnerLabel = getDocumentTypeLabel(runnerUp[0]);
    if (runnerUp[1].score >= best.detail.score * 0.7) {
      warnings.push(
        `Ambiguous signals: runner-up ${runnerLabel} scored ${runnerUp[1].score.toFixed(1)} vs ${best.detail.score.toFixed(1)}.`
      );
    }
  }

  if (!fieldTexts.title && !fieldTexts.headings) {
    warnings.push("No title or headings provided; classification relied on weaker fields.");
  }

  return warnings;
}

/**
 * Classify a government/recruitment document.
 * Safe for both manual PDF and automatic website pipelines.
 *
 * @param {ClassifyDocumentInput} input
 * @returns {ClassifyDocumentResult}
 */
function classifyDocument(input = {}) {
  const fieldTexts = buildFieldTexts(input);

  if (!fieldTexts.combined) {
    return {
      documentType: UNKNOWN_DOCUMENT_TYPE,
      documentTypeLabel: getDocumentTypeLabel(UNKNOWN_DOCUMENT_TYPE),
      confidence: "none",
      matchedIndicators: [],
      reasoning: "No document-type indicators matched title, headings, metadata, filename, URL, or body text.",
      warnings: ["Empty input: no title, headings, text, filename, URL, or metadata provided."],
      normalizedText: "",
      pageStatusHint: null,
      scores: {}
    };
  }

  const matches = collectMatches(fieldTexts);
  const scores = scoreByType(matches);
  const best = pickBestType(scores);

  if (!best || !isKnownDocumentType(best.documentType) || best.documentType === UNKNOWN_DOCUMENT_TYPE) {
    return {
      documentType: UNKNOWN_DOCUMENT_TYPE,
      documentTypeLabel: getDocumentTypeLabel(UNKNOWN_DOCUMENT_TYPE),
      confidence: "none",
      matchedIndicators: [],
      reasoning: "No document-type indicators matched title, headings, metadata, filename, URL, or body text.",
      warnings: ["Unable to classify document type; returned Unknown."],
      normalizedText: fieldTexts.combined,
      pageStatusHint: null,
      scores: Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [k, Number(v.score.toFixed(2))])
      )
    };
  }

  const indicators = best.detail.indicators.map(
    ({ id, documentType, source, confidence, matchedPattern }) => ({
      id,
      documentType,
      source,
      confidence,
      matchedPattern
    })
  );

  const confidence = resolveConfidence(best, best.ranked);
  const reasoning = buildReasoning(best, confidence, indicators);
  const warnings = buildWarnings(best, best.ranked, fieldTexts, confidence);

  return {
    documentType: best.documentType,
    documentTypeLabel: getDocumentTypeLabel(best.documentType),
    confidence,
    matchedIndicators: indicators,
    reasoning,
    warnings,
    normalizedText: fieldTexts.combined,
    pageStatusHint: PAGE_STATUS_HINTS[best.documentType] || null,
    scores: Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Number(v.score.toFixed(2))])
    )
  };
}

/**
 * Convenience: classify from plain extracted PDF/parser text only.
 * @param {string} text
 * @param {ClassifyDocumentInput} [extra]
 */
function classifyDocumentFromText(text, extra = {}) {
  return classifyDocument({ ...extra, text });
}

module.exports = {
  classifyDocument,
  classifyDocumentFromText,
  buildFieldTexts,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  TYPE_PRECEDENCE,
  CONFIDENCE_LEVELS,
  UNKNOWN_DOCUMENT_TYPE,
  PAGE_STATUS_HINTS,
  CLASSIFICATION_RULES,
  isKnownDocumentType,
  getDocumentTypeLabel
};
