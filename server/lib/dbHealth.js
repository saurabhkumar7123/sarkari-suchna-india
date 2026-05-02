const db = require("../config/db");

let cache = { ok: true, checkedAt: 0 };
const TTL_MS = parseInt(process.env.DB_HEALTH_CACHE_MS || "3000", 10);

/**
 * Cached lightweight DB ping for readiness / middleware.
 * @param {boolean} [force=false]
 */
async function isUp(force = false) {
  const now = Date.now();
  if (!force && now - cache.checkedAt < TTL_MS) {
    return cache.ok;
  }
  try {
    await db.query("SELECT 1 AS ok");
    cache = { ok: true, checkedAt: now };
    return true;
  } catch {
    cache = { ok: false, checkedAt: now };
    return false;
  }
}

function invalidate() {
  cache.checkedAt = 0;
}

module.exports = { isUp, invalidate };
