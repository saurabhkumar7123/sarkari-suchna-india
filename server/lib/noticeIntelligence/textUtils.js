"use strict";

/**
 * Phase AI-2 shared text helpers.
 * Deliberately dependency-free so every engine in this module stays deterministic.
 */

const { LANGUAGES } = require("./types");

const DEVANAGARI = /[\u0900-\u097F]/;
const DEVANAGARI_GLOBAL = /[\u0900-\u097F]/g;
const LATIN_GLOBAL = /[A-Za-z]/g;

/**
 * @param {*} value
 * @returns {string}
 */
function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * Collapse all whitespace runs into single spaces.
 * @param {*} value
 * @returns {string}
 */
function collapse(value) {
  return toText(value).replace(/\s+/g, " ").trim();
}

/**
 * Lowercased, whitespace-collapsed lookup key.
 * @param {*} value
 * @returns {string}
 */
function toKey(value) {
  return collapse(value).toLowerCase();
}

/**
 * Comparison key with punctuation removed — used for fingerprints and dedupe.
 * @param {*} value
 * @returns {string}
 */
function toComparableKey(value) {
  return toKey(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {number} value
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number}
 */
function clamp(value, min = 0, max = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Round to 2 decimals so scores stay stable across runs and snapshots.
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasDevanagari(text) {
  return DEVANAGARI.test(toText(text));
}

/**
 * Script mix statistics for language detection.
 * @param {string} text
 * @returns {{ devanagari: number, latin: number, total: number, devanagariRatio: number }}
 */
function scriptStats(text) {
  const s = toText(text);
  const devanagari = (s.match(DEVANAGARI_GLOBAL) || []).length;
  const latin = (s.match(LATIN_GLOBAL) || []).length;
  const total = devanagari + latin;
  return {
    devanagari,
    latin,
    total,
    devanagariRatio: total ? round2(devanagari / total) : 0
  };
}

/**
 * Classify content language as English, Hindi, or mixed Hindi-English.
 * @param {string} text
 * @returns {{ language: string, stats: object }}
 */
function detectLanguage(text) {
  const stats = scriptStats(text);
  if (!stats.total) return { language: LANGUAGES.UNKNOWN, stats };
  if (stats.devanagari === 0) return { language: LANGUAGES.ENGLISH, stats };
  if (stats.latin === 0) return { language: LANGUAGES.HINDI, stats };
  if (stats.devanagariRatio >= 0.85) return { language: LANGUAGES.HINDI, stats };
  if (stats.devanagariRatio <= 0.08) return { language: LANGUAGES.ENGLISH, stats };
  return { language: LANGUAGES.MIXED, stats };
}

/**
 * Split into trimmed, non-empty lines.
 * @param {string} text
 * @returns {string[]}
 */
function toLines(text) {
  return toText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Stable de-duplication that keeps first occurrence order.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyFn
 * @returns {T[]}
 */
function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Recursively freeze advisory output so downstream stages cannot mutate it.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

module.exports = {
  toText,
  collapse,
  toKey,
  toComparableKey,
  clamp,
  round2,
  hasDevanagari,
  scriptStats,
  detectLanguage,
  toLines,
  uniqueBy,
  deepFreeze
};
