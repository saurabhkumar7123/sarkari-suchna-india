"use strict";

/**
 * Advanced text normalization for PDF / OCR extraction quality.
 * Handles unicode, spacing, broken lines, merged words, headers/footers, watermarks.
 *
 * IMPORTANT: never rewrite `https://` or join unrelated newlines — that destroys
 * section headings and link rows used by the Generator publisher format.
 */

const PAGE_NOISE =
  /^(?:page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|\d+\s*\/\s*\d+|page\s*\|\s*\d+|\(\s*-?\s*\d+\s*-?\s*\)|\d{1,3})$/i;
const WATERMARK_NOISE =
  /\b(confidential|draft\s*only|not\s*for\s*circulation|sample\s*copy|watermark|do\s*not\s*copy)\b/i;
const REPEATED_CHAR = /(.)\1{8,}/;

/**
 * @param {string} text
 * @returns {string}
 */
function unicodeNormalize(text) {
  const s = String(text || "");
  try {
    return s.normalize("NFC");
  } catch {
    return s;
  }
}

/**
 * Collapse "Q u a l i f i c a t i o n" style spaced Latin words.
 * @param {string} line
 * @returns {string}
 */
function fixSpacedWordsLine(line) {
  const s = String(line || "").trim();
  if (s.length < 6) return line;
  const parts = s.split(/\s+/);
  if (parts.length < 4) return line;
  const latinSingles = parts.filter((p) => p.length === 1 && /[A-Za-z]/.test(p)).length;
  if (latinSingles / parts.length >= 0.45) return parts.join("");
  return line;
}

/**
 * Fix common OCR / PDF merges: "AgeLimit", "LastDate", "ApplyOnline".
 * @param {string} text
 * @returns {string}
 */
function fixMergedWords(text) {
  return String(text || "")
    .replace(/\b(Age|Last|Apply|Start|End|Exam|Fee|Post|Total|Online|Official)(Limit|Date|Online|Website|Posts?|Payment|Card|Key)\b/g, "$1 $2")
    .replace(/\b(आयु)(सीमा)\b/g, "$1 $2")
    .replace(/\b(अंतिम)(तिथि)\b/g, "$1 $2");
}

const MONTH_ALT =
  "January|February|March|April|May|June|July|August|September|October|November|December";

/**
 * Rejoin PDF superscript ordinals split across lines:
 * "23\\nrd\\nAugust,\\n2026" → "23rd August 2026"
 * Does not invent missing day numbers.
 * @param {string} text
 * @returns {string}
 */
function joinSplitOrdinalDates(text) {
  const months = MONTH_ALT;
  return String(text || "")
    .replace(
      new RegExp(
        `(\\d{1,2})\\s*\\n+\\s*(st|nd|rd|th)\\s*\\n+\\s*(${months})\\s*,?\\s*\\n+\\s*(\\d{4})`,
        "gi"
      ),
      "$1$2 $3 $4"
    )
    .replace(
      new RegExp(
        `(\\d{1,2})\\s*\\n+\\s*(st|nd|rd|th)\\s*\\n+\\s*(${months})\\s*,?\\s*(\\d{4})`,
        "gi"
      ),
      "$1$2 $3 $4"
    )
    .replace(
      new RegExp(
        `(\\d{1,2})\\s*\\n+\\s*(st|nd|rd|th)\\s+(${months})\\s*,?\\s*\\n+\\s*(\\d{4})`,
        "gi"
      ),
      "$1$2 $3 $4"
    )
    .replace(
      new RegExp(
        `(\\d{1,2})\\s+(st|nd|rd|th)\\s*\\n+\\s*(${months})\\s*,?\\s*\\n+\\s*(\\d{4})`,
        "gi"
      ),
      "$1$2 $3 $4"
    )
    .replace(new RegExp(`(\\d{1,2})\\s*\\n+\\s*(st|nd|rd|th)\\b`, "gi"), "$1$2")
    .replace(new RegExp(`\\b(\\d{1,2})\\s+(st|nd|rd|th)\\s+(${months})\\b`, "gi"), "$1$2 $3");
}

/**
 * Rejoin only hyphenated mid-word line breaks. Do not collapse paragraph newlines.
 * @param {string} text
 * @returns {string}
 */
function fixBrokenLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/([A-Za-z\u0900-\u097F])-\s*\n+\s*([A-Za-z\u0900-\u097F])/g, "$1$2");
}

/**
 * Whitespace normalize while preserving newlines and URL schemes.
 * @param {string} text
 * @returns {string}
 */
function normalizeSpacing(text) {
  return String(text || "")
    .replace(/[\t\f\v\u00a0\u2000-\u200b\u202f\u205f\u3000]+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isNoiseLine(line) {
  const t = String(line || "").trim();
  if (!t) return false;
  if (PAGE_NOISE.test(t)) return true;
  if (WATERMARK_NOISE.test(t) && t.length < 80) return true;
  if (REPEATED_CHAR.test(t) && t.length < 40) return true;
  if (/^[.\-_=*]{4,}$/.test(t)) return true;
  return false;
}

/**
 * Drop repeated header/footer candidates that appear ≥3 times.
 * @param {string} text
 * @returns {string}
 */
function stripRepeatedHeadersFooters(text) {
  const lines = String(text || "").split("\n");
  const counts = new Map();
  for (const raw of lines) {
    const t = raw.trim();
    if (!t || t.length < 8 || t.length > 120) continue;
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(t)) continue;
    if (/https?:\/\//i.test(t)) continue;
    const key = t.toLowerCase().replace(/\s+/g, " ");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const drop = new Set();
  for (const [key, n] of counts.entries()) {
    if (n >= 3) drop.add(key);
  }
  if (!drop.size) return String(text || "");

  const seenDrop = new Set();
  const out = [];
  for (const raw of lines) {
    const t = raw.trim();
    const key = t.toLowerCase().replace(/\s+/g, " ");
    if (drop.has(key)) {
      if (seenDrop.has(key)) continue;
      seenDrop.add(key);
    }
    out.push(raw);
  }
  return out.join("\n");
}

/**
 * Full advanced normalization pipeline for extracted PDF text.
 * @param {string} text
 * @returns {string}
 */
function advancedNormalize(text) {
  let t = unicodeNormalize(String(text || ""));
  t = fixBrokenLines(t);
  t = joinSplitOrdinalDates(t);
  t = t
    .split("\n")
    .map((line) => fixSpacedWordsLine(line))
    .join("\n");
  t = t
    .split("\n")
    .map((line) => fixMergedWords(line))
    .join("\n");
  t = stripRepeatedHeadersFooters(t);
  t = t
    .split("\n")
    .filter((line) => !isNoiseLine(line))
    .join("\n");
  t = normalizeSpacing(t);
  t = joinSplitOrdinalDates(t);
  t = normalizeSpacing(t);
  return t;
}

/**
 * Soft clean for AI conversion — removes annexure blocks and pure legal noise,
 * but PRESERVES How To Apply / Syllabus / Instructions for section detection.
 * @param {string} text
 * @returns {string}
 */
function softCleanForStructuring(text) {
  const raw = advancedNormalize(text).replace(/\{\{TEXT\}\}/gi, "").replace(/\$\{text\}/gi, "");
  const lines = raw.split("\n");
  const out = [];
  let annexSkip = false;
  for (const line of lines) {
    const tr = line.trim();
    if (/^annexure\b/i.test(tr) || /^परिशिष्ट\b/.test(tr)) {
      annexSkip = true;
      continue;
    }
    if (annexSkip) {
      if (!tr) {
        annexSkip = false;
        continue;
      }
      // Exit annexure skip when a clear new section heading appears
      if (
        /^(important\s+dates|application\s+fee|vacancy|eligibility|selection|how\s+to\s+apply|age\s+limit)\b/i.test(
          tr
        )
      ) {
        annexSkip = false;
        out.push(line);
        continue;
      }
      if (tr.length > 80 && /\d{1,2}[./-]\d{1,2}/.test(tr)) {
        annexSkip = false;
        out.push(line);
      }
      continue;
    }
    // Drop RTI / writ / tribunal legal noise, but keep post-code department /
    // allocation rows whose employer name legitimately contains "Tribunal".
    if (/\b(rti|right\s+to\s+information|writ\s+petition|tribunal)\b/i.test(tr) && tr.length > 40) {
      if (!/^[A-Z]{1,3}\d{2,4}\s+\S+/i.test(tr)) continue;
    }
    out.push(line);
  }
  return normalizeSpacing(out.join("\n"));
}

module.exports = {
  unicodeNormalize,
  fixSpacedWordsLine,
  fixMergedWords,
  fixBrokenLines,
  joinSplitOrdinalDates,
  normalizeSpacing,
  isNoiseLine,
  stripRepeatedHeadersFooters,
  advancedNormalize,
  softCleanForStructuring
};
