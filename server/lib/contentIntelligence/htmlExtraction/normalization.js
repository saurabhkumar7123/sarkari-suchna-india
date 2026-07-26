"use strict";

const path = require("path");

function normalizeWhitespace(value) {
  return String(value == null ? "" : value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
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

function isHidden($, element) {
  let current = element;
  while (current && current.type !== "root") {
    if (current.type === "tag") {
      const node = $(current);
      const style = String(node.attr("style") || "")
        .toLowerCase()
        .replace(/\s+/gu, "");
      const className = String(node.attr("class") || "").toLowerCase();
      if (
        node.attr("hidden") !== undefined ||
        node.attr("aria-hidden") === "true" ||
        style.includes("display:none") ||
        style.includes("visibility:hidden") ||
        /(^|\s)(sr-only|visually-hidden|decorative)(\s|$)/u.test(className)
      ) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function attributesOf($, element, names) {
  const node = $(element);
  const output = {};
  for (const name of names) {
    const value = node.attr(name);
    if (value !== undefined) output[name] = normalizeWhitespace(value);
  }
  return output;
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

module.exports = {
  normalizeWhitespace,
  normalizeUrl,
  fileExtension,
  isHidden,
  attributesOf,
  deepFreeze,
  documentFingerprint
};
