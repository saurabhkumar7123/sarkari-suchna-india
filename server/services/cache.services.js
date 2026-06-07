const redis = require("../config/redis");
const logger = require("../utils/logger");
const memCache = require("../config/cache");

function shouldUseMemoryFallback() {
  // Default: disable local memory cache in production for stateless horizontal scaling.
  const envToggle = String(process.env.CACHE_USE_MEMORY_FALLBACK || "").toLowerCase().trim();
  if (envToggle === "1" || envToggle === "true" || envToggle === "yes") return true;
  if (envToggle === "0" || envToggle === "false" || envToggle === "no") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Safe GET — Redis first, then in-memory fallback (NodeCache).
 */
async function getCache(key) {
  try {
    if (redis.isOpen) {
      const v = await redis.get(key);
      if (v != null) return v;
    }
  } catch (e) {
    logger.warn("Redis GET failed", { key, message: e.message });
  }
  if (!shouldUseMemoryFallback()) return null;
  const m = memCache.get(key);
  return m != null ? String(m) : null;
}

/**
 * SET with TTL (seconds) — writes Redis when available, always mirrors to memory for resilience.
 */
async function setCache(key, data, ttlSec = 300) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  try {
    if (redis.isOpen) {
      await redis.set(key, payload, { EX: ttlSec });
    }
  } catch (e) {
    logger.warn("Redis SET failed", { key, message: e.message });
  }
  if (shouldUseMemoryFallback()) {
    memCache.set(key, payload, ttlSec);
  }
}

async function delCache(key) {
  try {
    if (redis.isOpen) {
      await redis.del(key);
    }
  } catch (e) {
    logger.warn("Redis DEL failed", { key, message: e.message });
  }
  if (shouldUseMemoryFallback()) {
    memCache.del(key);
  }
}

/**
 * After page create/update/delete/restore/republish — clears list/detail/finder/search/board caches.
 * @param {string[]} slugs
 */
async function invalidatePageCaches(slugs = []) {
  const keys = new Set();
  for (const slug of slugs) {
    if (slug) keys.add(`page:detail:${slug}`);
  }
  keys.add("pages:topviews");
  keys.add("home:taxonomy-stats:v1");
  keys.add("finder:all");

  try {
    const { invalidateRelatedCaches } = require("./relatedPages.service");
    await invalidateRelatedCaches(slugs);
  } catch (e) {
    logger.warn("invalidateRelatedCaches failed", { message: e.message });
  }

  for (const k of keys) {
    await delCache(k);
  }

  if (redis.isOpen) {
    try {
      for await (const key of redis.scanIterator({ MATCH: "pages:list:*", COUNT: 200 })) {
        await delCache(key);
      }
      for await (const key of redis.scanIterator({ MATCH: "finder:*", COUNT: 200 })) {
        await delCache(key);
      }
      for await (const key of redis.scanIterator({ MATCH: "pages:board:*", COUNT: 200 })) {
        await delCache(key);
      }
    } catch (e) {
      logger.warn("invalidatePageCaches scan failed", { message: e.message });
    }
  }

  try {
    const { clearSearchCache } = require("./search.service");
    await clearSearchCache();
  } catch (e) {
    logger.warn("clearSearchCache failed", { message: e.message });
  }

  if (shouldUseMemoryFallback()) {
    memCache.flushAll();
  }
}

/**
 * @deprecated use setCache — kept for older callers
 */
async function setCacheLegacy(key, data, ttl = 300) {
  return setCache(key, data, ttl);
}

module.exports = {
  getCache,
  setCache,
  setCacheLegacy,
  delCache,
  invalidatePageCaches
};
