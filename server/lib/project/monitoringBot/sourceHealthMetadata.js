'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Source Health Metadata (Read-Only / Advisory)
 *
 * Advisory health metadata for registered sources.
 * Read-only model. No monitoring execution. No HTTP checks.
 */

const { deepFreeze } = require('./governmentSourceRegistry');

const SOURCE_HEALTH_METADATA_VERSION = 'MB1.1.0.0';

const SOURCE_HEALTH = Object.freeze({
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  DEGRADED: 'DEGRADED',
  FAILING: 'FAILING',
  UNKNOWN: 'UNKNOWN',
  INACTIVE: 'INACTIVE',
});

const VALID_SOURCE_HEALTH = Object.freeze(Object.values(SOURCE_HEALTH));

/**
 * Create read-only advisory health metadata for one source.
 * @param {object} [input]
 */
function createSourceHealthMetadata(input = {}) {
  const sourceId =
    typeof input.sourceId === 'string' && input.sourceId.trim()
      ? input.sourceId.trim()
      : 'UNKNOWN_SOURCE';

  const consecutiveFailures =
    typeof input.consecutiveFailures === 'number' &&
    Number.isFinite(input.consecutiveFailures) &&
    input.consecutiveFailures >= 0
      ? Math.floor(input.consecutiveFailures)
      : 0;

  let currentHealth =
    typeof input.currentHealth === 'string' &&
    VALID_SOURCE_HEALTH.includes(input.currentHealth.trim())
      ? input.currentHealth.trim()
      : SOURCE_HEALTH.UNKNOWN;

  if (input.active === false) {
    currentHealth = SOURCE_HEALTH.INACTIVE;
  } else if (
    currentHealth === SOURCE_HEALTH.UNKNOWN &&
    consecutiveFailures >= 3
  ) {
    currentHealth = SOURCE_HEALTH.FAILING;
  } else if (
    currentHealth === SOURCE_HEALTH.UNKNOWN &&
    consecutiveFailures >= 1
  ) {
    currentHealth = SOURCE_HEALTH.WARNING;
  }

  const advisoryNotes = Array.isArray(input.advisoryNotes)
    ? input.advisoryNotes
        .filter((n) => typeof n === 'string' && n.trim())
        .map((n) => n.trim())
    : [];

  return deepFreeze({
    metadataVersion: SOURCE_HEALTH_METADATA_VERSION,
    sourceId,
    lastSuccessfulCheck:
      typeof input.lastSuccessfulCheck === 'string'
        ? input.lastSuccessfulCheck
        : null,
    lastFailedCheck:
      typeof input.lastFailedCheck === 'string' ? input.lastFailedCheck : null,
    consecutiveFailures,
    currentHealth,
    advisoryNotes,
    readOnly: true,
    advisoryOnly: true,
    monitoringExecuted: false,
    httpCheckPerformed: false,
    productionRecord: false,
  });
}

/**
 * Build health metadata map for sources.
 * @param {object} [options]
 * @param {Array<object>} [options.sources]
 * @param {object|Array} [options.healthObservations]
 */
function createSourceHealthMetadataMap(options = {}) {
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const observations = {};

  if (Array.isArray(options.healthObservations)) {
    for (let i = 0; i < options.healthObservations.length; i += 1) {
      const obs = options.healthObservations[i] || {};
      if (typeof obs.sourceId === 'string' && obs.sourceId.trim()) {
        observations[obs.sourceId.trim()] = obs;
      }
    }
  } else if (
    options.healthObservations &&
    typeof options.healthObservations === 'object'
  ) {
    Object.keys(options.healthObservations).forEach((key) => {
      observations[key] = {
        sourceId: key,
        ...options.healthObservations[key],
      };
    });
  }

  const bySourceId = {};
  const entries = [];

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i] || {};
    const sourceId = source.sourceId;
    if (!sourceId) continue;
    const obs = observations[sourceId] || {};
    const meta = createSourceHealthMetadata({
      sourceId,
      active: source.active,
      ...obs,
    });
    bySourceId[sourceId] = meta;
    entries.push(meta);
  }

  // Observation-only entries without a source record
  Object.keys(observations).forEach((sourceId) => {
    if (!bySourceId[sourceId]) {
      const meta = createSourceHealthMetadata({
        sourceId,
        ...observations[sourceId],
      });
      bySourceId[sourceId] = meta;
      entries.push(meta);
    }
  });

  entries.sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  const healthCounts = {};
  for (let i = 0; i < VALID_SOURCE_HEALTH.length; i += 1) {
    healthCounts[VALID_SOURCE_HEALTH[i]] = 0;
  }
  for (let i = 0; i < entries.length; i += 1) {
    healthCounts[entries[i].currentHealth] =
      (healthCounts[entries[i].currentHealth] || 0) + 1;
  }

  return deepFreeze({
    metadataVersion: SOURCE_HEALTH_METADATA_VERSION,
    readOnly: true,
    advisoryOnly: true,
    monitoringExecuted: false,
    httpCheckPerformed: false,
    entryCount: entries.length,
    entries,
    bySourceId,
    healthCounts,
    healthStatuses: { ...SOURCE_HEALTH },
  });
}

function getSourceHealthMetadata(map, sourceId) {
  if (!map || !map.bySourceId || typeof sourceId !== 'string') {
    return null;
  }
  return map.bySourceId[sourceId] || null;
}

function summarizeSourceHealth(map) {
  if (!map) {
    return deepFreeze({
      total: 0,
      healthy: 0,
      warning: 0,
      degraded: 0,
      failing: 0,
      unknown: 0,
      inactive: 0,
      advisoryOnly: true,
    });
  }
  const counts = map.healthCounts || {};
  return deepFreeze({
    total: map.entryCount || 0,
    healthy: counts[SOURCE_HEALTH.HEALTHY] || 0,
    warning: counts[SOURCE_HEALTH.WARNING] || 0,
    degraded: counts[SOURCE_HEALTH.DEGRADED] || 0,
    failing: counts[SOURCE_HEALTH.FAILING] || 0,
    unknown: counts[SOURCE_HEALTH.UNKNOWN] || 0,
    inactive: counts[SOURCE_HEALTH.INACTIVE] || 0,
    advisoryOnly: true,
    readOnly: true,
  });
}

module.exports = {
  SOURCE_HEALTH_METADATA_VERSION,
  SOURCE_HEALTH,
  VALID_SOURCE_HEALTH,
  createSourceHealthMetadata,
  createSourceHealthMetadataMap,
  getSourceHealthMetadata,
  summarizeSourceHealth,
};
