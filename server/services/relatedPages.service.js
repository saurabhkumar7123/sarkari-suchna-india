"use strict";

const pageRepository = require("../repositories/page.repository");
const { pickRelatedPages } = require("../lib/relatedPagesScoring");
const { getCache, setCache, delCache } = require("./cache.services");

const RELATED_CACHE_TTL_SEC = parseInt(process.env.CACHE_RELATED_TTL || "120", 10);
const RELATED_POOL_LIMIT = parseInt(process.env.RELATED_CANDIDATE_POOL || "150", 10);
const RELATED_CACHE_PREFIX = "related:v2:";

function useLegacyRelated() {
  return String(process.env.RELATED_JOBS_LEGACY || "").trim() === "1";
}

/**
 * @param {string} slug
 * @param {number} [limit]
 * @returns {Promise<{ title: string, slug: string }[]>}
 */
async function getRelatedPagesForSlug(slug, limit = 6) {
  const cleanSlug = String(slug || "")
    .trim()
    .replace(/\.html$/i, "");
  if (!cleanSlug) return [];

  if (useLegacyRelated()) {
    return pageRepository.selectRelated(cleanSlug, limit);
  }

  const cacheKey = `${RELATED_CACHE_PREFIX}${cleanSlug}:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // miss
    }
  }

  const [anchor, candidates] = await Promise.all([
    pageRepository.findRelatedAnchorBySlug(cleanSlug),
    pageRepository.selectRelatedCandidates(cleanSlug, RELATED_POOL_LIMIT)
  ]);

  const rows = pickRelatedPages(anchor, candidates, limit);

  await setCache(cacheKey, rows, RELATED_CACHE_TTL_SEC);
  return rows;
}

/**
 * @param {string[]} slugs
 */
async function invalidateRelatedCaches(slugs = []) {
  const keys = new Set();
  for (const slug of slugs) {
    const s = String(slug || "").trim();
    if (!s) continue;
    for (const limit of [6, 8, 12]) {
      keys.add(`${RELATED_CACHE_PREFIX}${s}:${limit}`);
    }
  }
  for (const k of keys) {
    await delCache(k);
  }
}

module.exports = {
  getRelatedPagesForSlug,
  invalidateRelatedCaches,
  useLegacyRelated
};
