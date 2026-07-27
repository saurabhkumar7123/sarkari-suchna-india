'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Advisory Execution History (In-Memory / Immutable Entries)
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const EXECUTION_HISTORY_VERSION = 'MB5.1.0.0';

/**
 * @param {object} [options]
 * @param {number} [options.maxEntries]
 */
function createExecutionHistory(options = {}) {
  const maxEntries =
    typeof options.maxEntries === 'number' &&
    Number.isFinite(options.maxEntries) &&
    options.maxEntries > 0
      ? Math.floor(options.maxEntries)
      : 100;

  /** @type {object[]} */
  const entries = [];

  function record(summary) {
    const frozen = deepFreeze({
      ...(summary && typeof summary === 'object' ? summary : {}),
      historyVersion: EXECUTION_HISTORY_VERSION,
      recordedAt:
        summary && typeof summary.finished === 'string'
          ? summary.finished
          : new Date().toISOString(),
    });
    entries.push(frozen);
    while (entries.length > maxEntries) {
      entries.shift();
    }
    return frozen;
  }

  function list(limit) {
    const n =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : entries.length;
    return deepFreeze(entries.slice(Math.max(0, entries.length - n)));
  }

  function forSource(sourceId, limit) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    const filtered = id
      ? entries.filter((entry) => entry.source === id || entry.sourceId === id)
      : entries.slice();
    const n =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : filtered.length;
    return deepFreeze(filtered.slice(Math.max(0, filtered.length - n)));
  }

  function clear() {
    entries.length = 0;
    return deepFreeze({ cleared: true });
  }

  function snapshot() {
    return deepFreeze({
      historyVersion: EXECUTION_HISTORY_VERSION,
      maxEntries,
      count: entries.length,
      entries: entries.slice(),
    });
  }

  return {
    historyVersion: EXECUTION_HISTORY_VERSION,
    maxEntries,
    record,
    list,
    forSource,
    clear,
    snapshot,
  };
}

module.exports = {
  EXECUTION_HISTORY_VERSION,
  createExecutionHistory,
};
