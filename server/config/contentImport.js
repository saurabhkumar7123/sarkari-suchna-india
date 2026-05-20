"use strict";

function envFlag(name, defaultWhenUnset) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultWhenUnset;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Default enabled when unset (production default per spec). */
function isContentImportEnabled() {
  return envFlag("CONTENT_IMPORT_ENABLED", true);
}

/** Default off — legacy static HTML path is rollback-only. */
function isLegacyCsvStaticHtmlEnabled() {
  return envFlag("CSV_LEGACY_STATIC_HTML", false);
}

/** Structured import_group,section,line → canonical content at import time. Default on. */
function isStructuredCsvImportEnabled() {
  return envFlag("CONTENT_IMPORT_STRUCTURED", true);
}

const MAX_CSV_FILE_BYTES = parseInt(process.env.CONTENT_IMPORT_MAX_FILE_BYTES || String(2 * 1024 * 1024), 10);
const MAX_CSV_ROWS = parseInt(process.env.CONTENT_IMPORT_MAX_ROWS || "200", 10);
const MAX_CONTENT_CHARS = parseInt(process.env.CONTENT_IMPORT_MAX_CONTENT_CHARS || "500000", 10);

module.exports = {
  isContentImportEnabled,
  isLegacyCsvStaticHtmlEnabled,
  isStructuredCsvImportEnabled,
  MAX_CSV_FILE_BYTES,
  MAX_CSV_ROWS,
  MAX_CONTENT_CHARS
};
