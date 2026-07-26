"use strict";

/**
 * CIP Stage 3D — deterministic helpers shared by the correlation modules.
 * Pure functions only: no network, AI, OCR, clock, or randomness.
 */

const crypto = require("crypto");

function collapseWhitespace(value) {
  return String(value == null ? "" : value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Lowercased, punctuation-free key used for deterministic identity comparison. */
function identityKey(value) {
  const text = collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return text || null;
}

/** Uppercased compact key for advertisement / notification numbers. */
function identifierKey(value) {
  const text = collapseWhitespace(value)
    .toUpperCase()
    .replace(/\s+/gu, "");
  return text || null;
}

/** Canonical comparable form of a URL (never fetched). */
function urlKey(value) {
  const raw = collapseWhitespace(value);
  if (!raw || raw.startsWith("#")) return null;
  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname.replace(/\/+$/u, "") || "/";
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/+$/u, "");
  }
}

function urlHasDocumentPath(value) {
  const key = urlKey(value);
  if (!key) return false;
  try {
    const parsed = new URL(key);
    return parsed.pathname.length > 1;
  } catch {
    return /\//u.test(key.replace(/^[a-z]+:\/\//u, ""));
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

/** Millisecond value for a YYYY-MM-DD (or ISO) prefix; null when unparseable. */
function isoDateMs(value) {
  const text = collapseWhitespace(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))].sort();
}

function uniqueOrdered(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (value == null || value === "") return false;
    const key = typeof value === "string" ? value : JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokenSet(text) {
  const normalized = identityKey(text) || "";
  return new Set(normalized.split(" ").filter((token) => token.length >= 2));
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return Number((intersection / union).toFixed(4));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

module.exports = {
  collapseWhitespace,
  identityKey,
  identifierKey,
  urlKey,
  urlHasDocumentPath,
  sha256,
  isoDateMs,
  uniqueSorted,
  uniqueOrdered,
  tokenSet,
  jaccardSimilarity,
  deepFreeze
};
