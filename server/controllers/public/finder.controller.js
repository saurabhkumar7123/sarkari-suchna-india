const finderService = require("../../services/finder.service");
const asyncHandler = require("../../utils/asyncHandler");
const { getCache, setCache } = require("../../services/cache.services");

const FINDER_TTL_SEC = Math.min(
  300,
  Math.max(60, parseInt(process.env.CACHE_FINDER_TTL || "120", 10))
);

function buildFinderCacheKey(req) {
  const routePath = req.baseUrl && req.path ? `${req.baseUrl}${req.path}` : req.originalUrl || "/api/finder";
  const q = req && req.query ? new URLSearchParams(req.query).toString() : "";
  return `finder:${routePath}${q ? `?${q}` : ""}`;
}

const getFinderData = asyncHandler(async (req, res) => {
  const cacheKey = buildFinderCacheKey(req);
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");
      return res.json(parsed);
    } catch {
      // corrupted cache entry -> fallback to DB
    }
  }

  const data = await finderService.getFinderData();
  await setCache(cacheKey, data, FINDER_TTL_SEC);
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  res.json(data);
});

module.exports = { getFinderData };
