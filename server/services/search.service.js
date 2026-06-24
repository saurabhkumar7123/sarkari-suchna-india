const logger = require("../utils/logger");
const pageRepository = require("../repositories/page.repository");
const { getCache, setCache } = require("./cache.services");
const redis = require("../config/redis");

function normalizeText(text) {
  return (text || "").toLowerCase().trim();
}

function pageMatchesQuery(page, query) {
  const q = normalizeText(query);
  if (!q) return false;
  const fields = [page.title, page.category, page.post_name, page.slug];
  return fields.some((field) => normalizeText(field).includes(q));
}

async function search(query) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];

  const cacheKey = `search:multi:${q}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fall through to DB
    }
  }

  const likeQuery = `%${q}%`;
  let rows = [];
  try {
    rows = await pageRepository.searchByFullText(q);
  } catch (err) {
    logger.warn("fulltext search failed, using LIKE fallback", { message: err.message });
    rows = await pageRepository.searchByLike(likeQuery);
  }
  if (!rows.length) {
    rows = await pageRepository.searchByLike(likeQuery);
  }

  const result = rows
    .filter((p) => pageMatchesQuery(p, q))
    .map((p) => ({
      title: p.title,
      url: "/" + p.slug,
      status: (p.status || "").toUpperCase()
    }));

  if (result.length) await setCache(cacheKey, result, 300);
  return result;
}

async function searchSuggest(query) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];

  const cacheKey = `suggest:${q}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fall through
    }
  }

  const rows = await pageRepository.suggestByTitlePrefix(q);

  const result = rows.map((p) => ({
    title: p.title,
    url: "/" + p.slug,
    status: (p.status || "").toUpperCase()
  }));

  if (result.length) await setCache(cacheKey, result, 300);
  return result;
}

async function clearSearchCache() {
  if (!redis.isOpen) return;
  try {
    for (const match of ["search:title:*", "search:*", "suggest:*"]) {
      const batch = [];
      for await (const key of redis.scanIterator({ MATCH: match, COUNT: 100 })) {
        batch.push(key);
        if (batch.length >= 50) {
          await redis.del(batch);
          batch.length = 0;
        }
      }
      if (batch.length) await redis.del(batch);
    }
  } catch (e) {
    logger.warn("clearSearchCache failed", { message: e.message });
  }
}

module.exports = {
  search,
  searchSuggest,
  clearSearchCache,
  pageMatchesQuery
};
