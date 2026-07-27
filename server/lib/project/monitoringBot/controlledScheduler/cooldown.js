'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Cooldown Tracking (In-Process)
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const COOLDOWN_VERSION = 'MB5.1.0.0';

/**
 * @param {object} [options]
 * @param {number} [options.defaultCooldownMs]
 */
function createCooldownTracker(options = {}) {
  const defaultCooldownMs =
    typeof options.defaultCooldownMs === 'number' &&
    Number.isFinite(options.defaultCooldownMs) &&
    options.defaultCooldownMs >= 0
      ? Math.floor(options.defaultCooldownMs)
      : 0;

  /** @type {Map<string, { lastFinishedAt: number, cooldownMs: number }>} */
  const state = new Map();

  function resolveCooldownMs(sourceId, overrideMs) {
    if (
      typeof overrideMs === 'number' &&
      Number.isFinite(overrideMs) &&
      overrideMs >= 0
    ) {
      return Math.floor(overrideMs);
    }
    const existing = state.get(sourceId);
    if (existing) return existing.cooldownMs;
    return defaultCooldownMs;
  }

  function canRun(sourceId, at = Date.now(), cooldownMsOverride) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) {
      return deepFreeze({
        allowed: false,
        reason: 'INVALID_SOURCE_ID',
        remainingMs: 0,
      });
    }

    const existing = state.get(id);
    const cooldownMs = resolveCooldownMs(id, cooldownMsOverride);
    if (!existing || cooldownMs <= 0) {
      return deepFreeze({
        allowed: true,
        reason: 'READY',
        sourceId: id,
        remainingMs: 0,
        cooldownMs,
      });
    }

    const elapsed = at - existing.lastFinishedAt;
    if (elapsed >= cooldownMs) {
      return deepFreeze({
        allowed: true,
        reason: 'READY',
        sourceId: id,
        remainingMs: 0,
        cooldownMs,
      });
    }

    return deepFreeze({
      allowed: false,
      reason: 'COOLDOWN_ACTIVE',
      sourceId: id,
      remainingMs: cooldownMs - elapsed,
      cooldownMs,
      lastFinishedAt: existing.lastFinishedAt,
    });
  }

  function markFinished(sourceId, at = Date.now(), cooldownMsOverride) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) {
      return deepFreeze({ recorded: false, reason: 'INVALID_SOURCE_ID' });
    }

    const cooldownMs = resolveCooldownMs(id, cooldownMsOverride);
    state.set(id, { lastFinishedAt: at, cooldownMs });
    return deepFreeze({
      recorded: true,
      sourceId: id,
      lastFinishedAt: at,
      cooldownMs,
    });
  }

  function setCooldown(sourceId, cooldownMs) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) return false;
    const ms =
      typeof cooldownMs === 'number' &&
      Number.isFinite(cooldownMs) &&
      cooldownMs >= 0
        ? Math.floor(cooldownMs)
        : defaultCooldownMs;
    const existing = state.get(id) || { lastFinishedAt: 0, cooldownMs: ms };
    state.set(id, { ...existing, cooldownMs: ms });
    return true;
  }

  function snapshot(at = Date.now()) {
    const bySource = {};
    for (const [sourceId, entry] of state.entries()) {
      const check = canRun(sourceId, at, entry.cooldownMs);
      bySource[sourceId] = {
        lastFinishedAt: entry.lastFinishedAt,
        cooldownMs: entry.cooldownMs,
        remainingMs: check.remainingMs,
        ready: check.allowed,
      };
    }
    return deepFreeze({
      cooldownVersion: COOLDOWN_VERSION,
      defaultCooldownMs,
      bySource,
    });
  }

  return {
    cooldownVersion: COOLDOWN_VERSION,
    defaultCooldownMs,
    canRun,
    markFinished,
    setCooldown,
    snapshot,
  };
}

module.exports = {
  COOLDOWN_VERSION,
  createCooldownTracker,
};
