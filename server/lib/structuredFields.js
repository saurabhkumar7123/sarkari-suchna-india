"use strict";

const { BOARD_SLUG_SET } = require("./boardHubs");
const logger = require("../utils/logger");

/**
 * Structured field architecture (approved):
 *   department    → Board / Organization (single value, optional)
 *   qualification → Eligibility (future multi-value, optional)
 *   state         → Recruitment coverage area (future multi-value, optional)
 *   category      → Topics / tags (separate column — not handled here)
 */

function stripInvisible(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/** Lowercase, collapsed whitespace — matches repository normalizeStructuredColumn. */
function normalizeStructuredFieldValue(value) {
  if (value == null) return null;
  const s = stripInvisible(String(value))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s || null;
}

/**
 * Canonical qualification slugs for Finder / generator.
 * "graduation" is the stored slug for approved label "Graduate".
 */
const ALLOWED_JOB_QUALIFICATIONS = new Set([
  "10th",
  "12th",
  "iti",
  "diploma",
  "graduation",
  "post graduation",
  "phd"
]);

/** Canonical state coverage slugs for Finder (single-select today). */
const ALLOWED_JOB_STATES = new Set([
  "all india",
  "uttar pradesh",
  "bihar",
  "madhya pradesh",
  "rajasthan",
  "other",
  "delhi",
  "uttarakhand"
]);

/** Board department slugs — must match boardHubs.js and pages.department for /tag/{board}. */
const ALLOWED_JOB_DEPARTMENTS = BOARD_SLUG_SET;

function isValidBoardDepartment(value) {
  const normalized = normalizeStructuredFieldValue(value);
  if (!normalized) return true;
  return ALLOWED_JOB_DEPARTMENTS.has(normalized);
}

/**
 * @param {unknown} value
 * @returns {string | null} Human-readable reason when invalid; null when valid or empty.
 */
function getInvalidDepartmentReason(value) {
  const normalized = normalizeStructuredFieldValue(value);
  if (!normalized) return null;
  if (ALLOWED_JOB_DEPARTMENTS.has(normalized)) return null;
  return (
    `department "${normalized}" is not a registered board slug — ` +
    "page will not appear on any board hub (/tag/{board})"
  );
}

/**
 * Logs a warning when a non-empty department is not in the board whitelist.
 * Does not block publish — backward compatible with legacy/custom values.
 * @param {unknown} department
 * @param {Record<string, unknown>} [meta]
 */
function auditInvalidBoardDepartment(department, meta = {}) {
  const reason = getInvalidDepartmentReason(department);
  if (!reason) return;
  logger.warn("invalid board department on page save", {
    reason,
    department: normalizeStructuredFieldValue(department),
    ...meta
  });
}

// ---------------------------------------------------------------------------
// State coverage — future multi-value preparation (Phase 1: single value only)
// ---------------------------------------------------------------------------

/** Future storage delimiter when pages.state holds multiple coverage areas. */
const STATE_COVERAGE_DELIMITER = ",";

/**
 * Parse stored pages.state into a normalized coverage set.
 * Phase 1: returns at most one slug. Phase 2: split on STATE_COVERAGE_DELIMITER.
 * @param {unknown} stored
 * @returns {string[]}
 */
function parseStateCoverageSet(stored) {
  if (stored == null || stored === "") return [];
  const raw = stripInvisible(String(stored)).trim().toLowerCase();
  if (!raw) return [];
  // Phase 2 migration: uncomment split path and dual-read single values.
  // if (raw.includes(STATE_COVERAGE_DELIMITER)) {
  //   return [...new Set(raw.split(STATE_COVERAGE_DELIMITER).map(normalizeStructuredFieldValue).filter(Boolean))];
  // }
  return [raw.replace(/\s+/g, " ")];
}

/**
 * Whether a stored coverage set matches a Finder state filter.
 * Mirrors buildJobsWhere logic: specific state includes nationally scoped rows.
 * @param {unknown} storedState
 * @param {unknown} filterState
 */
function stateCoverageMatchesFilter(storedState, filterState) {
  const filter = normalizeStructuredFieldValue(filterState);
  if (!filter) return true;
  const coverage = parseStateCoverageSet(storedState);
  if (!coverage.length) return false;
  if (filter === "all india") return coverage.includes("all india");
  return coverage.includes(filter) || coverage.includes("all india");
}

// ---------------------------------------------------------------------------
// Qualification eligibility — future multi-value preparation (Phase 1: single)
// ---------------------------------------------------------------------------

/** Future storage delimiter when pages.qualification holds multiple levels. */
const QUALIFICATION_DELIMITER = ",";

/**
 * Parse stored pages.qualification into a normalized eligibility set.
 * Phase 1: returns at most one slug. Phase 2: split on QUALIFICATION_DELIMITER.
 * @param {unknown} stored
 * @returns {string[]}
 */
function parseQualificationSet(stored) {
  if (stored == null || stored === "") return [];
  const raw = stripInvisible(String(stored)).trim().toLowerCase();
  if (!raw) return [];
  return [raw.replace(/\s+/g, " ")];
}

/**
 * Whether stored eligibility matches a Finder qualification filter.
 * Phase 2: any-set-member match (e.g. RRB ALP stored as "12th,iti").
 * @param {unknown} storedQualification
 * @param {unknown} filterQualification
 */
function qualificationSetMatchesFilter(storedQualification, filterQualification) {
  const filter = normalizeStructuredFieldValue(filterQualification);
  if (!filter) return true;
  const levels = parseQualificationSet(storedQualification);
  if (!levels.length) return false;
  return levels.includes(filter);
}

module.exports = {
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_STATES,
  ALLOWED_JOB_DEPARTMENTS,
  STATE_COVERAGE_DELIMITER,
  QUALIFICATION_DELIMITER,
  normalizeStructuredFieldValue,
  isValidBoardDepartment,
  getInvalidDepartmentReason,
  auditInvalidBoardDepartment,
  parseStateCoverageSet,
  stateCoverageMatchesFilter,
  parseQualificationSet,
  qualificationSetMatchesFilter
};
