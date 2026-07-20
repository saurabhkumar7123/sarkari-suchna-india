"use strict";

function parseJsonColumn(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function mergeJson(base, patch) {
  const current = parseJsonColumn(base, {}) || {};
  const updates = parseJsonColumn(patch, {}) || {};
  return { ...current, ...updates };
}

module.exports = {
  parseJsonColumn,
  stringifyJson,
  mergeJson
};
