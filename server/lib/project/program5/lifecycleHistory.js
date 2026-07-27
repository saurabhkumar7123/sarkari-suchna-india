'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle History (Advisory / Auditable)
 *
 * Advisory history model for lifecycle transitions:
 *   previous state, new state, timestamp, trigger source, operator, notes.
 *
 * Supports auditing. No production persistence redesign.
 * Does NOT write to databases or mutate runtime state.
 */

const {
  deepFreeze,
  normalizeLifecycleState,
} = require('./lifecycleDefinition');

const LIFECYCLE_HISTORY_VERSION = '5C.1.0.0';

const TRIGGER_SOURCES = Object.freeze({
  OPERATOR: 'OPERATOR',
  SYSTEM_ADVISORY: 'SYSTEM_ADVISORY',
  INTEGRATION: 'INTEGRATION',
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Create a single advisory history record.
 *
 * @param {object} input
 * @param {string} [input.previousState]
 * @param {string} input.newState
 * @param {string} [input.timestamp] caller-supplied for determinism
 * @param {string} [input.triggerSource]
 * @param {string} [input.operator]
 * @param {string|string[]} [input.advisoryNotes]
 * @param {boolean} [input.applied] whether transition was applied (always false in governance)
 */
function createLifecycleHistoryRecord(input = {}) {
  const previousState = normalizeLifecycleState(input.previousState);
  const newState = normalizeLifecycleState(input.newState);

  let triggerSource = TRIGGER_SOURCES.UNKNOWN;
  if (
    typeof input.triggerSource === 'string' &&
    Object.prototype.hasOwnProperty.call(
      TRIGGER_SOURCES,
      input.triggerSource.trim().toUpperCase()
    )
  ) {
    triggerSource = input.triggerSource.trim().toUpperCase();
  } else if (typeof input.triggerSource === 'string' && input.triggerSource.trim()) {
    triggerSource = input.triggerSource.trim().toUpperCase();
  }

  const notes = [];
  if (Array.isArray(input.advisoryNotes)) {
    for (let i = 0; i < input.advisoryNotes.length; i += 1) {
      notes.push(String(input.advisoryNotes[i]));
    }
  } else if (typeof input.advisoryNotes === 'string' && input.advisoryNotes.trim()) {
    notes.push(input.advisoryNotes.trim());
  }

  const timestamp =
    typeof input.timestamp === 'string' && input.timestamp.trim()
      ? input.timestamp.trim()
      : null;

  return deepFreeze({
    recordKind: 'LIFECYCLE_HISTORY_RECORD',
    historyVersion: LIFECYCLE_HISTORY_VERSION,
    advisoryOnly: true,
    persisted: false,
    productionPersistence: false,
    runtimeStateMutated: false,
    previousState,
    newState,
    timestamp,
    triggerSource,
    operator:
      typeof input.operator === 'string' && input.operator.trim()
        ? input.operator.trim()
        : null,
    advisoryNotes: notes,
    applied: false,
    automaticAdvancement: false,
  });
}

/**
 * Build an advisory history model from records / transition attempts.
 * Supports auditing. Does not redesign persistence.
 *
 * @param {object} [input]
 * @param {object[]} [input.records] raw or created records
 * @param {object[]} [input.entries] alias for records
 */
function buildLifecycleHistory(input = {}) {
  const raw = Array.isArray(input.records)
    ? input.records
    : Array.isArray(input.entries)
      ? input.entries
      : [];

  const records = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (item && item.recordKind === 'LIFECYCLE_HISTORY_RECORD') {
      records.push(item);
    } else {
      records.push(createLifecycleHistoryRecord(item || {}));
    }
  }

  const summary = {
    totalRecords: records.length,
    distinctStates: [],
    triggerSources: {},
    operators: {},
  };

  const stateSet = new Set();
  for (let i = 0; i < records.length; i += 1) {
    const r = records[i];
    if (r.previousState) stateSet.add(r.previousState);
    if (r.newState) stateSet.add(r.newState);
    summary.triggerSources[r.triggerSource] =
      (summary.triggerSources[r.triggerSource] || 0) + 1;
    const op = r.operator || 'unspecified';
    summary.operators[op] = (summary.operators[op] || 0) + 1;
  }
  summary.distinctStates = Array.from(stateSet).sort();

  return deepFreeze({
    historyId: 'CONTROLLED_LIFECYCLE_HISTORY',
    version: LIFECYCLE_HISTORY_VERSION,
    advisoryOnly: true,
    auditable: true,
    productionPersistenceRedesign: false,
    persisted: false,
    runtimeStateMutated: false,
    records,
    summary,
  });
}

/**
 * Summarize history for dashboard / report surfaces.
 * @param {object} history
 */
function summarizeLifecycleHistory(history) {
  const resolved =
    history && history.records
      ? history
      : buildLifecycleHistory({ records: [] });

  const latest =
    resolved.records.length > 0
      ? resolved.records[resolved.records.length - 1]
      : null;

  return deepFreeze({
    totalTransitions: resolved.summary.totalRecords,
    latestPreviousState: latest ? latest.previousState : null,
    latestNewState: latest ? latest.newState : null,
    latestTimestamp: latest ? latest.timestamp : null,
    latestOperator: latest ? latest.operator : null,
    latestTriggerSource: latest ? latest.triggerSource : null,
    distinctStates: resolved.summary.distinctStates.slice(),
    triggerSourceCounts: Object.assign({}, resolved.summary.triggerSources),
  });
}

module.exports = {
  LIFECYCLE_HISTORY_VERSION,
  TRIGGER_SOURCES,
  createLifecycleHistoryRecord,
  buildLifecycleHistory,
  summarizeLifecycleHistory,
};
