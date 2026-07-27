'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Rate Limiting (In-Process / Configuration-Driven)
 *
 * Sliding-window counters per source. No Redis.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const RATE_LIMITER_VERSION = 'MB5.1.0.0';

/**
 * @param {object} [options]
 * @param {number} [options.maxPerWindow]
 * @param {number} [options.windowMs]
 */
function createRateLimiter(options = {}) {
  const maxPerWindow =
    typeof options.maxPerWindow === 'number' &&
    Number.isFinite(options.maxPerWindow) &&
    options.maxPerWindow > 0
      ? Math.floor(options.maxPerWindow)
      : 1;
  const windowMs =
    typeof options.windowMs === 'number' &&
    Number.isFinite(options.windowMs) &&
    options.windowMs > 0
      ? Math.floor(options.windowMs)
      : 60000;

  /** @type {Map<string, number[]>} */
  const hits = new Map();

  function prune(sourceId, at) {
    const list = hits.get(sourceId) || [];
    const kept = list.filter((ts) => at - ts < windowMs);
    hits.set(sourceId, kept);
    return kept;
  }

  function allow(sourceId, at = Date.now()) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) {
      return deepFreeze({
        allowed: false,
        reason: 'INVALID_SOURCE_ID',
        remaining: 0,
      });
    }

    const kept = prune(id, at);
    if (kept.length >= maxPerWindow) {
      const oldest = kept[0];
      const retryAfterMs = Math.max(0, windowMs - (at - oldest));
      return deepFreeze({
        allowed: false,
        reason: 'RATE_LIMITED',
        sourceId: id,
        remaining: 0,
        retryAfterMs,
        maxPerWindow,
        windowMs,
      });
    }

    kept.push(at);
    hits.set(id, kept);
    return deepFreeze({
      allowed: true,
      reason: 'ALLOWED',
      sourceId: id,
      remaining: Math.max(0, maxPerWindow - kept.length),
      maxPerWindow,
      windowMs,
    });
  }

  function snapshot(at = Date.now()) {
    const bySource = {};
    for (const sourceId of hits.keys()) {
      const kept = prune(sourceId, at);
      bySource[sourceId] = {
        count: kept.length,
        remaining: Math.max(0, maxPerWindow - kept.length),
      };
    }
    return deepFreeze({
      rateLimiterVersion: RATE_LIMITER_VERSION,
      maxPerWindow,
      windowMs,
      bySource,
    });
  }

  function configure(next = {}) {
    return createRateLimiter({
      maxPerWindow:
        next.maxPerWindow != null ? next.maxPerWindow : maxPerWindow,
      windowMs: next.windowMs != null ? next.windowMs : windowMs,
    });
  }

  return {
    rateLimiterVersion: RATE_LIMITER_VERSION,
    maxPerWindow,
    windowMs,
    allow,
    snapshot,
    configure,
  };
}

module.exports = {
  RATE_LIMITER_VERSION,
  createRateLimiter,
};
