"use strict";

/**
 * CIP Stage 1C — Shared Section Intelligence.
 *
 * Splits raw document text into ordered sections and normalizes titles onto
 * the CIP section taxonomy while preserving original titles.
 *
 * Reuses the Generator "[Section: …]" grammar (generator/parse/sectionParse)
 * and the publisher canonical-title map (server/utils/publisherSections) for
 * downstream compatibility. Unknown/custom sections are preserved, never
 * dropped. Deterministic, no AI calls.
 */

const {
  parseSectionsFromText
} = require("../../../../generator/parse/sectionParse");

const {
  canonicalSectionTitle,
  hasExplicitSectionMarkers
} = require("../../../utils/publisherSections");

const {
  UNKNOWN_SECTION_TYPE,
  SECTION_CANONICAL_TITLES
} = require("./structureTypes");

const { buildHeadingKey, matchSectionTitle } = require("./sectionRules");

const TABLE_MARKER_RE = /^---(?:end)?table---$/i;

/**
 * Decide whether a plain-text line is an implicit section heading.
 * Conservative by design: known aliases match directly; custom headings
 * require an empty-value trailing colon or an ALL-CAPS title line.
 *
 * @param {string} line
 * @returns {{ cleanTitle: string, matches: Array<object>, custom: boolean } | null}
 */
function detectImplicitHeading(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (/=|https?:\/\//i.test(trimmed)) return null;
  if (/^(?:Q|A):/.test(trimmed)) return null;
  if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) return null;
  if (TABLE_MARKER_RE.test(trimmed)) return null;

  // A "Label: value" line is data, not a heading.
  const colonIdx = trimmed.search(/[:：]/);
  const hasColon = colonIdx > -1;
  if (hasColon && trimmed.slice(colonIdx + 1).trim()) return null;

  const key = buildHeadingKey(trimmed);
  if (!key) return null;

  const cleanTitle = trimmed.replace(/[:：\s]+$/, "").trim();
  const matches = matchSectionTitle(key);
  if (matches.length) return { cleanTitle, matches, custom: false };

  if (hasColon && key.length >= 3 && key.length <= 60 && /[a-z\u0900-\u097F]/.test(key)) {
    return { cleanTitle, matches: [], custom: true };
  }
  if (!hasColon && trimmed.length <= 48 && /^[A-Z]{2,}(?:\s+[A-Z]{2,})+$/.test(trimmed)) {
    return { cleanTitle, matches: [], custom: true };
  }
  return null;
}

/**
 * Split raw text into raw section segments, preserving order and content.
 * Explicit "[Section: …]" markers take precedence; otherwise implicit
 * heading lines are used. Content before the first heading/marker becomes
 * a preamble segment. Text without any heading becomes one segment.
 *
 * @param {string} text
 * @returns {Array<{ originalTitle: string|null, content: string, source: string,
 *   forceTable: boolean, custom: boolean, matches: Array<object> }>}
 */
function splitIntoRawSections(text) {
  const src = String(text || "").replace(/\r\n/g, "\n");
  if (!src.trim()) return [];

  if (hasExplicitSectionMarkers(src)) {
    const segments = [];
    const firstIdx = src.search(/\[\s*section\s*:/i);
    const preamble = firstIdx > 0 ? src.slice(0, firstIdx).trim() : "";
    if (preamble) {
      segments.push({
        originalTitle: null,
        content: preamble,
        source: "preamble",
        forceTable: false,
        custom: false,
        matches: []
      });
    }
    for (const section of parseSectionsFromText(src)) {
      segments.push({
        originalTitle: section.rawHeaderTitle,
        content: section.content,
        source: "marker",
        forceTable: Boolean(section.forceTable),
        custom: false,
        matches: []
      });
    }
    return segments;
  }

  const lines = src.split("\n");
  const segments = [];
  let current = {
    originalTitle: null,
    lines: [],
    source: "preamble",
    forceTable: false,
    custom: false,
    matches: []
  };

  const flush = () => {
    const content = current.lines.join("\n").trim();
    if (current.originalTitle != null || content) {
      segments.push({
        originalTitle: current.originalTitle,
        content,
        source: current.source,
        forceTable: current.forceTable,
        custom: current.custom,
        matches: current.matches
      });
    }
  };

  for (const line of lines) {
    const heading = detectImplicitHeading(line);
    if (heading) {
      flush();
      current = {
        originalTitle: line.trim(),
        lines: [],
        source: "implicit_heading",
        forceTable: false,
        custom: heading.custom,
        matches: heading.matches
      };
    } else {
      current.lines.push(line);
    }
  }
  flush();

  if (!segments.length) return [];
  if (segments.length === 1 && segments[0].originalTitle == null) {
    segments[0].source = "document";
  }
  return segments;
}

/**
 * Normalize a raw section title onto the CIP taxonomy.
 * Original title is preserved by the caller; this resolves type/canonical name.
 *
 * @param {string} rawTitle
 * @param {{ source?: string, custom?: boolean, precomputedMatches?: Array<object> }} [options]
 */
function normalizeSectionTitle(rawTitle, options = {}) {
  const raw = String(rawTitle || "");
  const forceTable = /\|\s*table\s*$/i.test(raw);
  const cleanTitle = raw
    .replace(/\|\s*table\s*$/i, "")
    .replace(/[:：\s]+$/, "")
    .trim();
  const key = buildHeadingKey(cleanTitle);
  const matches =
    options.precomputedMatches && options.precomputedMatches.length
      ? options.precomputedMatches
      : matchSectionTitle(key);
  const indicatorSource =
    options.source === "implicit_heading" ? "implicit_heading" : "title";

  if (matches.length) {
    const primary = matches[0];
    const distinctTypes = new Set(matches.map((m) => m.sectionType));
    const ambiguous = distinctTypes.size > 1;
    let confidence = primary.confidence;
    if (ambiguous && confidence === "high") confidence = "medium";

    return {
      sectionType: primary.sectionType,
      normalizedTitle: SECTION_CANONICAL_TITLES[primary.sectionType],
      confidence,
      ambiguous,
      forceTable,
      matchedIndicators: matches.map((m) => ({
        id: m.id,
        sectionType: m.sectionType,
        source: indicatorSource,
        matchedPattern: m.matchedPattern
      }))
    };
  }

  return {
    sectionType: UNKNOWN_SECTION_TYPE,
    normalizedTitle: cleanTitle || "Untitled",
    confidence: options.custom ? "low" : "none",
    ambiguous: false,
    forceTable,
    matchedIndicators: []
  };
}

/**
 * Publisher/Generator-compatible title (reuses publisherSections aliases).
 * @param {string|null} rawTitle
 */
function toGeneratorTitle(rawTitle) {
  if (rawTitle == null) return null;
  return canonicalSectionTitle(rawTitle);
}

module.exports = {
  splitIntoRawSections,
  detectImplicitHeading,
  normalizeSectionTitle,
  toGeneratorTitle
};
