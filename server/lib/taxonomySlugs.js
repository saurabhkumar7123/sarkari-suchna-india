"use strict";

const { ALLOWED_JOB_QUALIFICATIONS, ALLOWED_JOB_STATES } = require("./structuredFields");

function toTaxonomyPathSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizePathSegment(segment) {
  return decodeURIComponent(String(segment || ""))
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function resolveQualificationFromPath(pathSlug) {
  const normalized = normalizePathSegment(pathSlug);
  if (!normalized || !ALLOWED_JOB_QUALIFICATIONS.has(normalized)) return null;
  return normalized;
}

function resolveStateFromPath(pathSlug) {
  const normalized = normalizePathSegment(pathSlug);
  if (!normalized || !ALLOWED_JOB_STATES.has(normalized)) return null;
  return normalized;
}

function buildDepartmentPath(slug) {
  const value = String(slug || "").trim().toLowerCase();
  return value ? `/department/${encodeURIComponent(value)}` : "/department";
}

/** @deprecated Legacy alias — canonical URLs use buildDepartmentPath */
function buildBoardPath(slug) {
  return buildDepartmentPath(slug);
}

function buildQualificationPath(slug) {
  const value = toTaxonomyPathSlug(slug);
  return value ? `/qualification/${encodeURIComponent(value)}` : "/qualification";
}

function buildStatePath(slug) {
  const value = toTaxonomyPathSlug(slug);
  return value ? `/state/${encodeURIComponent(value)}` : "/state";
}

module.exports = {
  toTaxonomyPathSlug,
  normalizePathSegment,
  resolveQualificationFromPath,
  resolveStateFromPath,
  buildDepartmentPath,
  buildBoardPath,
  buildQualificationPath,
  buildStatePath
};
