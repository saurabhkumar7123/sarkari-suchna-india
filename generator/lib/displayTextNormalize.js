"use strict";

const { escapeHtml } = require("../../server/utils/escapeHtml");

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const URL_OR_EMAIL_RE =
  /(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const LATIN_WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function isDisplayTextCapitalizeEnabled() {
  return String(process.env.DISPLAY_TEXT_CAPITALIZE || "").trim() === "1";
}

/**
 * All-caps tokens up to this length are treated as acronyms (UP, AI, SSC, UPSC).
 */
const MAX_ACRONYM_LEN = 5;

function isAcronymWord(word) {
  return word.length >= 2 && word.length <= MAX_ACRONYM_LEN && /^[A-Z]+$/.test(word);
}

/**
 * @param {string} word
 */
function capitalizeLatinWord(word) {
  if (!word) return word;
  if (isAcronymWord(word)) return word;
  if (/^[A-Z]+$/.test(word)) {
    return word.charAt(0) + word.slice(1).toLowerCase();
  }
  if (/^[A-Z][a-z]+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * @param {string} segment
 * @param {"title"|"sentence"} mode
 */
function normalizeLatinSegment(segment, mode) {
  if (mode === "sentence") {
    return segment.replace(/(?:^|[.!?]\s+)([a-z])/g, (m, ch) => m.replace(ch, ch.toUpperCase()));
  }
  return applyTitleCaseToLatin(segment);
}

function applyTitleCaseToLatin(segment) {
  return segment.replace(LATIN_WORD_RE, (word) => capitalizeLatinWord(word));
}

/**
 * Deterministic display capitalization for Latin text; Devanagari and URLs untouched.
 * @param {string} text
 * @param {{ mode?: "title"|"sentence", enabled?: boolean }} [options]
 * @returns {string}
 */
function normalizeDisplayText(text, options = {}) {
  const enabled = options.enabled !== undefined ? options.enabled : isDisplayTextCapitalizeEnabled();
  if (!enabled) return String(text ?? "");

  const src = String(text ?? "");
  if (!src || !/[A-Za-z]/.test(src)) return src;

  const placeholders = [];
  let work = src.replace(URL_OR_EMAIL_RE, (match) => {
    const token = `\u0000U${placeholders.length}\u0000`;
    placeholders.push(match);
    return token;
  });

  work = work.replace(/([\u0900-\u097F]+)|([^\u0900-\u097F]+)/g, (full, deva, latin) => {
    if (deva) return deva;
    if (latin) {
      const mode =
        options.mode ||
        (latin.trim().length > 160 && /[.!?]\s/.test(latin) ? "sentence" : "title");
      return normalizeLatinSegment(latin, mode);
    }
    return full;
  });

  placeholders.forEach((value, i) => {
    work = work.replace(`\u0000U${i}\u0000`, () => value);
  });

  return work;
}

/**
 * Normalize for display, then HTML-escape.
 * @param {string} text
 * @param {{ mode?: "title"|"sentence" }} [options]
 */
function escapeDisplayText(text, options = {}) {
  return escapeHtml(normalizeDisplayText(text, options));
}

module.exports = {
  isDisplayTextCapitalizeEnabled,
  normalizeDisplayText,
  escapeDisplayText,
  capitalizeLatinWord,
  isAcronymWord
};
