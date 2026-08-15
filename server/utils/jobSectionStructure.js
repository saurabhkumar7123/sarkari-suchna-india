"use strict";

const { smartCleanJobText } = require("./smartClean");
const { detectSections, bucketsToPublisherDocument } = require("./sectionDetector");
const { validateAndRepair } = require("./validateOutput");
const { normalizeSectionFormatting } = require("./normalizeSectionFormatting");
const { tryPreserveStructuredInput } = require("./publisherSections");
const { applyCanonicalPublisherFormat } = require("./canonicalPublisherFormat");

function finishPublisherText(text) {
  return applyCanonicalPublisherFormat(normalizeSectionFormatting(text));
}

/**
 * Deterministic sectioning from noisy PDF/OCR plain text (server).
 * @param {string} plainText
 * @returns {string}
 */
function structurePlainTextIntoSections(plainText) {
  const cleaned = smartCleanJobText(plainText);
  const buckets = detectSections(cleaned);
  return finishPublisherText(bucketsToPublisherDocument(buckets));
}

function trimShortInfoInStructuredText(text) {
  const t = String(text || "");
  const re = /\[Section:\s*(Short\s*Information|ShortInfo)\]\s*([\s\S]*?)(?=\n\[Section:|$)/i;
  const m = t.match(re);
  if (!m) return t;
  const body = m[2].trim();
  const lines = body.split("\n").filter(Boolean);
  const kept = lines.join("\n") || "—";
  const start = m.index ?? 0;
  const end = start + m[0].length;
  return `${t.slice(0, start)}[Section: Short Information]\n${kept}${t.slice(end)}`;
}

/**
 * @param {string} aiResult
 * @param {string} cleanedSource
 * @returns {string}
 */
function finalizeStructuredJobOutput(aiResult, cleanedSource) {
  const preserved = tryPreserveStructuredInput(cleanedSource);
  if (preserved) {
    return finishPublisherText(preserved);
  }

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

  if (r && /\[Section:\s*(Eligibility|Short\s*Information|ShortInfo|Important\s*Dates|ImportantDates)\]/i.test(r)) {
    const v = validateAndRepair(trimShortInfoInStructuredText(r), buckets);
    return finishPublisherText(v.text);
  }
  if (r && /\[Section:/i.test(r)) {
    const v = validateAndRepair(trimShortInfoInStructuredText(r), buckets);
    return finishPublisherText(v.text);
  }

  if (src.length >= 50) {
    const v = validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections(src)), buckets);
    return finishPublisherText(v.text);
  }
  if (r.length > 0) {
    const v = validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections(r)), buckets);
    return finishPublisherText(v.text);
  }
  const v = validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections("—")), buckets);
  return finishPublisherText(v.text);
}

module.exports = {
  structurePlainTextIntoSections,
  trimShortInfoInStructuredText,
  finalizeStructuredJobOutput,
  finishPublisherText
};
