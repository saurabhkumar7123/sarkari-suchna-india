"use strict";

/**
 * Phase AI-4 — Language quality detection (suggestions only).
 */

const { LANGUAGE_ISSUE_CODES, SEVERITY } = require("./types");
const {
  BROKEN_UNICODE_RE,
  OCR_ARTIFACT_RE,
  splitSentences,
  toKey,
  toLines,
  detectLanguage,
  collapse
} = require("./draftUtils");

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {string} suggestion
 * @param {object} [extra]
 * @returns {object}
 */
function langIssue(code, severity, message, suggestion, extra = {}) {
  return {
    code,
    severity,
    message,
    suggestion,
    advisoryOnly: true,
    appliesChanges: false,
    ...extra
  };
}

/**
 * @param {object} draft
 * @returns {{ issues: object[], language: string, explanation: string }}
 */
function analyzeLanguageQuality(draft) {
  const issues = [];
  const text = draft.fullText || "";
  const languageInfo = detectLanguage(text);

  // Flag mixed-script drafts (and per-section mixes) so editors can normalize wording.
  if (languageInfo.language === "mixed" || languageInfo.language === "hi-en") {
    issues.push(
      langIssue(
        LANGUAGE_ISSUE_CODES.MIXED_HINDI_ENGLISH,
        SEVERITY.LOW,
        "Draft mixes Hindi and English wording.",
        "Prefer one primary language per section, or keep official terms in English with Hindi in parentheses."
      )
    );
  } else {
    for (const sec of draft.sections || []) {
      const stats = detectLanguage(sec.content).stats;
      if (stats.devanagari > 5 && stats.latin > 12 && stats.devanagariRatio > 0.08 && stats.devanagariRatio < 0.9) {
        issues.push(
          langIssue(
            LANGUAGE_ISSUE_CODES.MIXED_HINDI_ENGLISH,
            SEVERITY.LOW,
            `Section "${sec.generatorTitle}" mixes Hindi and English wording.`,
            "Prefer one primary language per section, or keep official terms in English with Hindi in parentheses.",
            { sectionType: sec.sectionType }
          )
        );
        break;
      }
    }
  }

  if (BROKEN_UNICODE_RE.test(text)) {
    issues.push(
      langIssue(
        LANGUAGE_ISSUE_CODES.BROKEN_UNICODE,
        SEVERITY.HIGH,
        "Broken Unicode / mojibake characters detected.",
        "Re-extract or re-encode the source PDF/text to fix corrupted characters (Ã, â€™, )."
      )
    );
  }

  const sentences = splitSentences(text);
  const seen = new Map();
  for (const sentence of sentences) {
    const key = toKey(sentence);
    if (key.length < 25) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const repeats = [...seen.entries()].filter(([, count]) => count >= 2);
  if (repeats.length) {
    issues.push(
      langIssue(
        LANGUAGE_ISSUE_CODES.REPEATED_SENTENCES,
        SEVERITY.MEDIUM,
        `Found ${repeats.length} repeated sentence(s).`,
        "Remove duplicate sentences so each fact appears once.",
        { examples: repeats.slice(0, 3).map(([s]) => s.slice(0, 120)) }
      )
    );
  }

  const ocrHits = toLines(text).filter((line) => OCR_ARTIFACT_RE.test(line));
  if (ocrHits.length >= 2 || (ocrHits.length >= 1 && /\|{3,}/.test(text))) {
    issues.push(
      langIssue(
        LANGUAGE_ISSUE_CODES.OCR_ARTIFACTS,
        SEVERITY.HIGH,
        "OCR artifacts detected (pipe runs, spaced letters, or glyph noise).",
        "Clean OCR noise before editorial review; re-check tables and headings manually.",
        { examples: ocrHits.slice(0, 3).map((l) => collapse(l).slice(0, 100)) }
      )
    );
  }

  // Formatting: many lines with trailing spaces patterns, inconsistent bullets, bare pipes
  const lines = toLines(text);
  const messyBullets = lines.filter((l) => /^[\-\*•]\s*$/.test(l) || /^\d+\.\s*$/.test(l)).length;
  const barePipes = lines.filter((l) => /^\|+$/.test(l) || /\|\s*\|/).length;
  if (messyBullets >= 2 || barePipes >= 3) {
    issues.push(
      langIssue(
        LANGUAGE_ISSUE_CODES.FORMATTING_PROBLEMS,
        SEVERITY.MEDIUM,
        "Formatting problems detected (empty bullets or broken table pipes).",
        "Normalize lists and tables; remove empty bullet markers and repair pipe tables."
      )
    );
  }

  return {
    issues,
    language: languageInfo.language,
    languageStats: languageInfo.stats,
    explanation:
      issues.length === 0
        ? "No significant language quality issues detected."
        : `Detected ${issues.length} language quality issue(s); suggestions only — draft was not modified.`
  };
}

module.exports = {
  analyzeLanguageQuality
};
