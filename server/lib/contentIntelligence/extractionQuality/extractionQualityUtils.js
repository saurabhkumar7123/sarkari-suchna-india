"use strict";

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function uniqueOrdered(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = typeof item === "string" ? item : JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function clampScore(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function hasText(value) {
  return value != null && String(value).trim() !== "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return value == null ? "" : String(value);
}

function reportFingerprint(report) {
  return JSON.stringify(report);
}

module.exports = {
  deepFreeze,
  uniqueOrdered,
  clampScore,
  hasText,
  asArray,
  safeString,
  reportFingerprint
};
