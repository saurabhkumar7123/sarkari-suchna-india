'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Source Execution Locking (In-Process / Advisory)
 *
 * Prevents concurrent execution of the same source.
 * No Redis. No distributed locks.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const LOCKING_VERSION = 'MB5.1.0.0';

/**
 * Create an in-process source lock manager.
 * @param {object} [options]
 * @param {number} [options.defaultTtlMs]
 */
function createSourceLockManager(options = {}) {
  const locks = new Map();
  const defaultTtlMs =
    typeof options.defaultTtlMs === 'number' &&
    Number.isFinite(options.defaultTtlMs) &&
    options.defaultTtlMs > 0
      ? Math.floor(options.defaultTtlMs)
      : 120000;

  function nowMs() {
    return Date.now();
  }

  function purgeExpired(sourceId, at = nowMs()) {
    const existing = locks.get(sourceId);
    if (!existing) return;
    if (existing.expiresAt <= at) {
      locks.delete(sourceId);
    }
  }

  function tryAcquire(sourceId, holderId, ttlMs) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) {
      return deepFreeze({
        acquired: false,
        reason: 'INVALID_SOURCE_ID',
        sourceId: null,
      });
    }

    const at = nowMs();
    purgeExpired(id, at);

    if (locks.has(id)) {
      const existing = locks.get(id);
      return deepFreeze({
        acquired: false,
        reason: 'ALREADY_LOCKED',
        sourceId: id,
        holderId: existing.holderId,
        expiresAt: existing.expiresAt,
      });
    }

    const ttl =
      typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0
        ? Math.floor(ttlMs)
        : defaultTtlMs;
    const holder =
      typeof holderId === 'string' && holderId.trim()
        ? holderId.trim()
        : `lock_${at}`;

    locks.set(id, {
      holderId: holder,
      acquiredAt: at,
      expiresAt: at + ttl,
    });

    return deepFreeze({
      acquired: true,
      reason: 'ACQUIRED',
      sourceId: id,
      holderId: holder,
      expiresAt: at + ttl,
    });
  }

  function release(sourceId, holderId) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) {
      return deepFreeze({ released: false, reason: 'INVALID_SOURCE_ID' });
    }

    const existing = locks.get(id);
    if (!existing) {
      return deepFreeze({ released: false, reason: 'NOT_LOCKED', sourceId: id });
    }

    if (
      typeof holderId === 'string' &&
      holderId.trim() &&
      existing.holderId !== holderId.trim()
    ) {
      return deepFreeze({
        released: false,
        reason: 'HOLDER_MISMATCH',
        sourceId: id,
        holderId: existing.holderId,
      });
    }

    locks.delete(id);
    return deepFreeze({ released: true, reason: 'RELEASED', sourceId: id });
  }

  function isLocked(sourceId) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) return false;
    purgeExpired(id);
    return locks.has(id);
  }

  function snapshot() {
    const at = nowMs();
    const entries = [];
    for (const [sourceId, lock] of locks.entries()) {
      if (lock.expiresAt <= at) {
        locks.delete(sourceId);
        continue;
      }
      entries.push({
        sourceId,
        holderId: lock.holderId,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
      });
    }
    return deepFreeze({
      lockingVersion: LOCKING_VERSION,
      activeLocks: entries,
      count: entries.length,
    });
  }

  return {
    lockingVersion: LOCKING_VERSION,
    tryAcquire,
    release,
    isLocked,
    snapshot,
  };
}

module.exports = {
  LOCKING_VERSION,
  createSourceLockManager,
};
