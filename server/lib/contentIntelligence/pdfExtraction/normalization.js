"use strict";

const path = require("path");

function normalizeWhitespace(value) {
  return String(value == null ? "" : value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeMultiline(value) {
  return String(value == null ? "" : value)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/gu, " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function joinBrokenParagraph(lines) {
  if (!Array.isArray(lines) || !lines.length) return "";
  let text = lines[0];
  for (let i = 1; i < lines.length; i += 1) {
    const prev = text;
    const next = lines[i];
    if (/[-\u2010-\u2015]$/u.test(prev) && /^[A-Za-z\u0900-\u0D7F]/u.test(next)) {
      text = prev.replace(/[-\u2010-\u2015]$/u, "") + next;
    } else if (
      /[A-Za-z0-9\u0900-\u0D7F,;:]$/u.test(prev) &&
      /^[a-z\u0900-\u0D7F]/u.test(next)
    ) {
      text = `${prev} ${next}`;
    } else {
      text = `${prev} ${next}`;
    }
  }
  return normalizeWhitespace(text);
}

function normalizeUrl(value, baseUrl) {
  const raw = normalizeWhitespace(value);
  if (!raw) return null;
  if (raw.startsWith("#")) return raw;

  try {
    if (baseUrl) return new URL(raw, baseUrl).href;
    return new URL(raw).href;
  } catch {
    return raw;
  }
}

function fileExtension(url) {
  if (!url || String(url).startsWith("#")) return "";
  try {
    const pathname = new URL(url, "https://deterministic.invalid").pathname;
    return path.posix.extname(pathname).toLowerCase();
  } catch {
    return path.posix.extname(String(url).split(/[?#]/u)[0]).toLowerCase();
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function documentFingerprint(document) {
  return JSON.stringify(document);
}

function uniqueOrdered(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countBy(items, key) {
  const output = {};
  for (const item of items) {
    const value = item[key] || "unknown";
    output[value] = (output[value] || 0) + 1;
  }
  return output;
}

module.exports = {
  normalizeWhitespace,
  normalizeMultiline,
  joinBrokenParagraph,
  normalizeUrl,
  fileExtension,
  deepFreeze,
  documentFingerprint,
  uniqueOrdered,
  countBy
};
