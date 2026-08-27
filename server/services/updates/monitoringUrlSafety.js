"use strict";

/**
 * Write-time monitoring URL safety: normalize for duplicate compare,
 * reject non-http(s), private/internal hosts, and non-official hosts.
 * Does not rewrite stored URLs aggressively — only validation + compare keys.
 */

const {
  isApprovedOfficialMonitoringUrl,
  extractHostname
} = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i
];

function createHttpError(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Normalize URL for duplicate comparison only (does not change stored value).
 * - trim
 * - lowercase hostname
 * - strip default ports
 * - strip trailing slash on pathname (except root)
 * - drop hash
 * - keep query string (semantically significant)
 * - do not force http↔https conversion
 */
function normalizeMonitoringUrlForCompare(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "";
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return "";

  const host = parsed.hostname.toLowerCase();
  let port = parsed.port;
  if (
    (protocol === "http:" && port === "80") ||
    (protocol === "https:" && port === "443")
  ) {
    port = "";
  }

  let pathname = parsed.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const auth = parsed.username
    ? `${encodeURIComponent(parsed.username)}${parsed.password ? `:${encodeURIComponent(parsed.password)}` : ""}@`
    : "";
  const portPart = port ? `:${port}` : "";
  const search = parsed.search || "";
  return `${protocol}//${auth}${host}${portPart}${pathname}${search}`;
}

function isPrivateOrInternalHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return true;
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(host));
}

/**
 * Validate a monitoring URL for write / activation.
 * @returns {{ ok: true, url: string, hostname: string, compareKey: string } | never throws}
 */
function assertSafeOfficialMonitoringUrl(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) {
    throw createHttpError(400, "Monitoring URL is required.", "MONITORING_URL_REQUIRED");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw createHttpError(400, "Monitoring URL is malformed.", "MONITORING_URL_MALFORMED");
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw createHttpError(
      400,
      "Monitoring URL must use http or https.",
      "MONITORING_URL_PROTOCOL"
    );
  }

  const hostname = extractHostname(url) || parsed.hostname.toLowerCase();
  if (!hostname) {
    throw createHttpError(400, "Monitoring URL hostname is missing.", "MONITORING_URL_HOST");
  }

  if (isPrivateOrInternalHostname(hostname) || isPrivateOrInternalHostname(parsed.hostname)) {
    throw createHttpError(
      400,
      "Monitoring URL must not target private or internal hosts.",
      "MONITORING_URL_PRIVATE"
    );
  }

  if (!isApprovedOfficialMonitoringUrl(url)) {
    throw createHttpError(
      400,
      "Monitoring URL host is not an approved official source.",
      "MONITORING_URL_NOT_OFFICIAL"
    );
  }

  const compareKey = normalizeMonitoringUrlForCompare(url);
  if (!compareKey) {
    throw createHttpError(400, "Monitoring URL is malformed.", "MONITORING_URL_MALFORMED");
  }

  return { ok: true, url, hostname, compareKey };
}

function urlsAreDuplicateNormalized(a, b) {
  const left = normalizeMonitoringUrlForCompare(a);
  const right = normalizeMonitoringUrlForCompare(b);
  if (!left || !right) return false;
  return left === right;
}

module.exports = {
  normalizeMonitoringUrlForCompare,
  assertSafeOfficialMonitoringUrl,
  isPrivateOrInternalHostname,
  urlsAreDuplicateNormalized,
  createHttpError
};
