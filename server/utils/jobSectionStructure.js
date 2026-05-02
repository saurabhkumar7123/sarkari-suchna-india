"use strict";

const { smartCleanJobText } = require("./smartClean");
const { detectSections, bucketsToStructuredDocument } = require("./sectionDetector");
const { validateAndRepair } = require("./validateOutput");
const { normalizeSectionFormatting } = require("./normalizeSectionFormatting");

/**
 * Deterministic sectioning from noisy PDF/OCR plain text (server).
 * @param {string} plainText
 * @returns {string}
 */
function structurePlainTextIntoSections(plainText) {
  const cleaned = smartCleanJobText(plainText);
  const buckets = detectSections(cleaned);
  return normalizeSectionFormatting(bucketsToStructuredDocument(buckets));
}

function trimShortInfoInStructuredText(text) {
  const t = String(text || "");
  const re = /\[Section:\s*ShortInfo\]\s*([\s\S]*?)(?=\n\[Section:|$)/i;
  const m = t.match(re);
  if (!m) return t;
  const body = m[1].trim();
  const two = body.split("\n").filter(Boolean).slice(0, 2).join("\n") || "—";
  const start = m.index ?? 0;
  const end = start + m[0].length;
  return `${t.slice(0, start)}[Section: ShortInfo]\n${two}${t.slice(end)}`;
}

/**
 * @param {string} aiResult
 * @param {string} cleanedSource
 * @returns {string}
 */
function finalizeStructuredJobOutput(aiResult, cleanedSource) {
  let r = normalizeSectionFormatting(
    String(aiResult || "")
      .trim()
      .replace(/\{\{TEXT\}\}/gi, "")
      .replace(/\$\{text\}/gi, "")
  );
  const srcRaw = String(cleanedSource || "").trim();
  const src = smartCleanJobText(srcRaw);
  const buckets = detectSections(src);

  const junk = /^(Input too short|No usable data found)$/i;
  if (junk.test(r)) r = "";

  if (r && /\[Section:\s*Eligibility\]/i.test(r)) {
    const v = validateAndRepair(trimShortInfoInStructuredText(r), buckets);
    return normalizeSectionFormatting(v.text);
  }
  if (r && /\[Section:/i.test(r)) {
    const v = validateAndRepair(trimShortInfoInStructuredText(r), buckets);
    return normalizeSectionFormatting(v.text);
  }

  if (src.length >= 50) {
    const v = validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections(src)), buckets);
    return normalizeSectionFormatting(v.text);
  }
  if (r.length > 0) {
    const v = validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections(r)), buckets);
    return normalizeSectionFormatting(v.text);
  }
  const v = validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections("—")), buckets);
  return normalizeSectionFormatting(v.text);
}

module.exports = {
  structurePlainTextIntoSections,
  trimShortInfoInStructuredText,
  finalizeStructuredJobOutput
};
