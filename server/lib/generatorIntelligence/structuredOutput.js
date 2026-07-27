"use strict";

/**
 * Build normalized structured document compatible with Generator publisher compile.
 */

const { FORMAT_ID, ENGINE_VERSION, SECTION_TYPES, SECTION_TYPE_TO_TITLE } = require("./types");
const { detectDocumentSections } = require("./sectionDetection");
const { validateStructuredDocument } = require("./fieldValidation");

/**
 * Heuristic document title from short information / first lines.
 * @param {object[]} sections
 * @param {string} cleaned
 * @returns {string}
 */
function inferTitle(sections, cleaned) {
  const short = sections.find((s) => s.sectionType === SECTION_TYPES.SHORT_INFORMATION);
  if (short?.lines?.[0]) return String(short.lines[0]).slice(0, 180);
  const first = String(cleaned || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 12 && l.length < 180);
  return first || "";
}

/**
 * @param {string} rawText
 * @param {{ sourceName?: string, languageHint?: string }} [options]
 */
function buildStructuredDocument(rawText, options = {}) {
  const detected = detectDocumentSections(rawText);
  const sections = (detected.sections || []).map((sec, idx) => ({
    order: idx,
    sectionType: sec.sectionType,
    title: sec.title || SECTION_TYPE_TO_TITLE[sec.sectionType] || "Other",
    generatorTitle:
      SECTION_TYPE_TO_TITLE[sec.sectionType] ||
      (sec.sectionType === SECTION_TYPES.UNKNOWN ? sec.title : sec.title),
    isKnownSection: Boolean(sec.isKnownSection),
    confidence: sec.confidence,
    blocks: sec.blocks || [],
    originalContent: sec.originalContent || (sec.lines || []).join("\n"),
    forceTable: Boolean(
      (sec.blocks || []).some((b) => b.type === "table" && (b.kind === "vacancy" || b.kind === "reservation"))
    )
  }));

  const metadata = {
    title: inferTitle(sections, detected.cleaned),
    sourceName: options.sourceName || null,
    languageHint: options.languageHint || detectLanguageHint(detected.cleaned),
    pageCount: null,
    extractedAt: new Date().toISOString(),
    detectionMode: detected.mode
  };

  const structured = {
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    metadata,
    sections,
    tables: (detected.tables || []).map((t) => ({
      kind: t.kind,
      csvBody: t.csvBody,
      rows: t.rows,
      confidence: t.confidence,
      eligible: t.eligible
    })),
    links: detected.links || [],
    warnings: [],
    extensions: {
      cleanedTextLength: String(detected.cleaned || "").length,
      sectionCount: sections.length
    }
  };

  const validation = validateStructuredDocument(structured);
  structured.validation = validation;
  structured.warnings = validation.issues.slice();

  return structured;
}

/**
 * @param {string} text
 * @returns {string}
 */
function detectLanguageHint(text) {
  const s = String(text || "");
  const hindi = (s.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  if (hindi > 40 && hindi > latin * 0.35) return "hi-en";
  if (hindi > 20) return "hi-en";
  return "en";
}

module.exports = {
  buildStructuredDocument,
  inferTitle,
  detectLanguageHint
};
