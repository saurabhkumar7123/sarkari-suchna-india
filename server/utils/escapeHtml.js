"use strict";
const { getBaseUrl } = require("./baseUrl");

/**
 * Escape text for safe insertion into HTML text nodes and quoted attributes.
 * Security: prevents stored XSS when user/admin/AI content is interpolated into templates.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Allow only http(s) absolute URLs, or safe same-origin relative paths.
 * Rejects javascript:, data:, vbscript:, and protocol-relative //evil URLs.
 */
function sanitizeUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "#";

  const lower = raw.slice(0, 11).toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return "#";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    if (/[<>"'`\s]/.test(raw)) return "#";
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    /* ignore */
  }
  return "#";
}

/**
 * Convert root-relative paths to absolute URLs.
 * Keeps existing absolute URLs untouched.
 */
function resolveUrl(path) {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) {
    const base = getBaseUrl();
    if (!base) return raw;
    return `${base}${raw}`;
  }
  return raw;
}

/**
 * Restrict dynamic path segments (slug, tag) so they cannot break out of URL paths or inject markup.
 */
function safeUrlSegment(str) {
  return String(str ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^\.+/, "")
    .slice(0, 200);
}

module.exports = { escapeHtml, sanitizeUrl, safeUrlSegment, resolveUrl };
