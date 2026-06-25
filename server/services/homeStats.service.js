"use strict";

const pageRepository = require("../repositories/page.repository");
const { getCache, setCache, delCache } = require("./cache.services");
const { allBoardHubs, BOARD_SLUG_SET } = require("../lib/boardHubs");
const { ALLOWED_JOB_QUALIFICATIONS, ALLOWED_JOB_STATES, normalizeStateSlug } = require("../lib/structuredFields");
const {
  buildDepartmentPath,
  buildQualificationPath,
  buildStatePath
} = require("../lib/taxonomySlugs");

const CACHE_KEY = "home:taxonomy-stats:v1";
const TTL_SEC = parseInt(process.env.CACHE_HOME_TAXONOMY_TTL || "300", 10);

/** Display labels aligned with Finder / generator qualification options. */
const QUALIFICATION_REGISTRY = [
  { slug: "10th", label: "10th" },
  { slug: "12th", label: "12th" },
  { slug: "iti", label: "ITI" },
  { slug: "diploma", label: "Diploma" },
  { slug: "graduation", label: "Graduation" },
  { slug: "post graduation", label: "Post Graduation" },
  { slug: "phd", label: "PhD" }
];

/** Display labels aligned with Finder state options + whitelist. */
const STATE_REGISTRY = [
  { slug: "central", label: "Central" },
  { slug: "uttar pradesh", label: "Uttar Pradesh" },
  { slug: "bihar", label: "Bihar" },
  { slug: "madhya pradesh", label: "Madhya Pradesh" },
  { slug: "rajasthan", label: "Rajasthan" },
  { slug: "other", label: "Other" },
  { slug: "delhi", label: "Delhi" },
  { slug: "uttarakhand", label: "Uttarakhand" }
];

/**
 * @typedef {{ slug: string, label: string, href: string, count: number }} PopularBoardRow
 * @typedef {{ slug: string, label: string, href: string, count: number }} PopularQualificationRow
 * @typedef {{ slug: string, label: string, href: string, count: number }} PopularStateRow
 */

function buildQualificationHref(slug) {
  return buildQualificationPath(slug);
}

function buildStateHref(slug) {
  return buildStatePath(slug);
}

function mergeStateCountSlug(slug) {
  return normalizeStateSlug(slug) || "";
}

function addStateCount(countBySlug, slug, pageCount) {
  const canonical = mergeStateCountSlug(slug);
  if (!canonical || !ALLOWED_JOB_STATES.has(canonical)) return;
  countBySlug.set(canonical, (countBySlug.get(canonical) || 0) + pageCount);
}

function buildPopularQualificationsFromCounts(rows) {
  const countBySlug = new Map();

  for (const row of rows) {
    const slug = String(row.slug || "").trim().toLowerCase();
    if (!slug || !ALLOWED_JOB_QUALIFICATIONS.has(slug)) continue;
    countBySlug.set(slug, Number(row.page_count) || 0);
  }

  return QUALIFICATION_REGISTRY.map((entry) => ({
    slug: entry.slug,
    label: entry.label,
    href: buildQualificationHref(entry.slug),
    count: countBySlug.get(entry.slug) || 0
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildPopularStatesFromCounts(rows) {
  const countBySlug = new Map();

  for (const row of rows) {
    addStateCount(countBySlug, row.slug, Number(row.page_count) || 0);
  }

  return STATE_REGISTRY.map((entry) => ({
    slug: entry.slug,
    label: entry.label,
    href: buildStateHref(entry.slug),
    count: countBySlug.get(entry.slug) || 0
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Aggregate taxonomy counts; keep whitelist values with count > 0.
 * @returns {Promise<{ generatedAt: string, boards: PopularBoardRow[], qualifications: PopularQualificationRow[], states: PopularStateRow[] }>}
 */
function buildBrowseQualificationsFromCounts(rows) {
  const countBySlug = new Map();

  for (const row of rows) {
    const slug = String(row.slug || "").trim().toLowerCase();
    if (!slug || !ALLOWED_JOB_QUALIFICATIONS.has(slug)) continue;
    countBySlug.set(slug, Number(row.page_count) || 0);
  }

  return QUALIFICATION_REGISTRY.map((entry) => ({
    slug: entry.slug,
    label: entry.label,
    href: buildQualificationHref(entry.slug),
    count: countBySlug.get(entry.slug) || 0
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildBrowseStatesFromCounts(rows) {
  const countBySlug = new Map();

  for (const row of rows) {
    addStateCount(countBySlug, row.slug, Number(row.page_count) || 0);
  }

  return STATE_REGISTRY.map((entry) => ({
    slug: entry.slug,
    label: entry.label,
    href: buildStateHref(entry.slug),
    count: countBySlug.get(entry.slug) || 0
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildBrowseBoardsFromCounts(rows) {
  const countByDept = new Map();
  for (const row of rows) {
    const slug = String(row.slug || "").trim().toLowerCase();
    if (!slug || !BOARD_SLUG_SET.has(slug)) continue;
    countByDept.set(slug, Number(row.page_count) || 0);
  }

  return allBoardHubs()
    .map((hub) => ({
      slug: hub.slug,
      label: hub.label,
      href: buildDepartmentPath(hub.slug),
      count: countByDept.get(hub.slug) || 0
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Full browse lists for /categories — every registry item, not just count > 0.
 */
async function getBrowseCategoryLists() {
  const [departmentRows, qualificationRows, stateRows] = await Promise.all([
    pageRepository.selectDepartmentCounts(),
    pageRepository.selectQualificationCounts(),
    pageRepository.selectStateCounts()
  ]);

  return {
    boards: buildBrowseBoardsFromCounts(departmentRows),
    qualifications: buildBrowseQualificationsFromCounts(qualificationRows),
    states: buildBrowseStatesFromCounts(stateRows)
  };
}

async function recomputeTaxonomyStats() {
  const [departmentRows, qualificationRows, stateRows] = await Promise.all([
    pageRepository.selectDepartmentCounts(),
    pageRepository.selectQualificationCounts(),
    pageRepository.selectStateCounts()
  ]);

  const countByDept = new Map();
  for (const row of departmentRows) {
    const slug = String(row.slug || "").trim().toLowerCase();
    if (!slug || !BOARD_SLUG_SET.has(slug)) continue;
    countByDept.set(slug, Number(row.page_count) || 0);
  }

  const boards = allBoardHubs()
    .map((hub) => ({
      slug: hub.slug,
      label: hub.label,
      href: buildDepartmentPath(hub.slug),
      count: countByDept.get(hub.slug) || 0
    }))
    .filter((board) => board.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const qualifications = buildPopularQualificationsFromCounts(qualificationRows);
  const states = buildPopularStatesFromCounts(stateRows);

  const stats = {
    generatedAt: new Date().toISOString(),
    boards,
    qualifications,
    states
  };

  await setCache(CACHE_KEY, stats, TTL_SEC);
  return stats;
}

/**
 * @param {{ refresh?: boolean }} [opts]
 */
async function getTaxonomyStats(opts = {}) {
  if (opts.refresh) {
    return recomputeTaxonomyStats();
  }

  const cached = await getCache(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (
        parsed &&
        Array.isArray(parsed.boards) &&
        Array.isArray(parsed.qualifications) &&
        Array.isArray(parsed.states)
      ) {
        return parsed;
      }
    } catch {
      // cache miss — recompute below
    }
  }

  return recomputeTaxonomyStats();
}

/**
 * Active board hubs only (count > 0), sorted by popularity.
 * @returns {Promise<PopularBoardRow[]>}
 */
async function getPopularBoards() {
  const stats = await getTaxonomyStats();
  return Array.isArray(stats.boards) ? stats.boards : [];
}

/**
 * Active qualifications only (count > 0), sorted by popularity.
 * @returns {Promise<PopularQualificationRow[]>}
 */
async function getPopularQualifications() {
  const stats = await getTaxonomyStats();
  return Array.isArray(stats.qualifications) ? stats.qualifications : [];
}

/**
 * Active states only (count > 0), sorted by popularity.
 * @returns {Promise<PopularStateRow[]>}
 */
async function getPopularStates() {
  const stats = await getTaxonomyStats();
  return Array.isArray(stats.states) ? stats.states : [];
}

async function invalidateTaxonomyStats() {
  await delCache(CACHE_KEY);
}

module.exports = {
  CACHE_KEY,
  TTL_SEC,
  QUALIFICATION_REGISTRY,
  STATE_REGISTRY,
  buildQualificationHref,
  buildStateHref,
  getTaxonomyStats,
  getPopularBoards,
  getPopularQualifications,
  getPopularStates,
  getBrowseCategoryLists,
  buildBrowseBoardsFromCounts,
  buildBrowseQualificationsFromCounts,
  buildBrowseStatesFromCounts,
  recomputeTaxonomyStats,
  invalidateTaxonomyStats
};
