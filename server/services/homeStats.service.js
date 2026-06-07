"use strict";

const pageRepository = require("../repositories/page.repository");
const { getCache, setCache, delCache } = require("./cache.services");
const { allBoardHubs, BOARD_SLUG_SET } = require("../lib/boardHubs");

const CACHE_KEY = "home:taxonomy-stats:v1";
const TTL_SEC = parseInt(process.env.CACHE_HOME_TAXONOMY_TTL || "300", 10);

/**
 * @typedef {{ slug: string, label: string, href: string, count: number }} PopularBoardRow
 */

/**
 * Aggregate department counts, keep whitelist boards with count > 0.
 * @returns {Promise<{ generatedAt: string, boards: PopularBoardRow[] }>}
 */
async function recomputeTaxonomyStats() {
  const rows = await pageRepository.selectDepartmentCounts();
  const countBySlug = new Map();

  for (const row of rows) {
    const slug = String(row.slug || "").trim().toLowerCase();
    if (!slug || !BOARD_SLUG_SET.has(slug)) continue;
    countBySlug.set(slug, Number(row.page_count) || 0);
  }

  const boards = allBoardHubs()
    .map((hub) => ({
      slug: hub.slug,
      label: hub.label,
      href: `/tag/${hub.slug}`,
      count: countBySlug.get(hub.slug) || 0
    }))
    .filter((board) => board.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const stats = {
    generatedAt: new Date().toISOString(),
    boards
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
      if (parsed && Array.isArray(parsed.boards)) {
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

async function invalidateTaxonomyStats() {
  await delCache(CACHE_KEY);
}

module.exports = {
  CACHE_KEY,
  TTL_SEC,
  getTaxonomyStats,
  getPopularBoards,
  recomputeTaxonomyStats,
  invalidateTaxonomyStats
};
