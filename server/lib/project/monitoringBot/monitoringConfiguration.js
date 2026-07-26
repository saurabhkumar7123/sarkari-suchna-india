'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Monitoring Configuration (Configuration-Driven / Advisory Only)
 *
 * Per-source monitoring metadata. No execution. No scheduling.
 */

const { deepFreeze } = require('./governmentSourceRegistry');

const MONITORING_CONFIGURATION_VERSION = 'MB1.1.0.0';

const CONTENT_TYPES = Object.freeze({
  HTML: 'HTML',
  PDF: 'PDF',
  RSS: 'RSS',
  JSON: 'JSON',
  XML: 'XML',
});

const MONITORING_PRIORITIES = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const VALID_CONTENT_TYPES = Object.freeze(Object.values(CONTENT_TYPES));
const VALID_PRIORITIES = Object.freeze(Object.values(MONITORING_PRIORITIES));

const DEFAULT_INTERVAL_MS = 3600000;

/**
 * Default monitoring configuration keyed by source ID.
 * Configuration only — never triggers monitoring jobs.
 */
const DEFAULT_MONITORING_CONFIG_BY_SOURCE = deepFreeze({
  SSC_NIC: {
    monitoringEnabled: true,
    defaultIntervalMs: DEFAULT_INTERVAL_MS,
    priority: MONITORING_PRIORITIES.HIGH,
    expectedContentType: CONTENT_TYPES.HTML,
    parserId: 'PARSER_SSC_HTML_V1',
  },
  UPSC: {
    monitoringEnabled: true,
    defaultIntervalMs: DEFAULT_INTERVAL_MS,
    priority: MONITORING_PRIORITIES.HIGH,
    expectedContentType: CONTENT_TYPES.HTML,
    parserId: 'PARSER_UPSC_HTML_V1',
  },
  IBPS: {
    monitoringEnabled: true,
    defaultIntervalMs: DEFAULT_INTERVAL_MS * 2,
    priority: MONITORING_PRIORITIES.NORMAL,
    expectedContentType: CONTENT_TYPES.HTML,
    parserId: 'PARSER_IBPS_HTML_V1',
  },
  RRB: {
    monitoringEnabled: true,
    defaultIntervalMs: DEFAULT_INTERVAL_MS * 2,
    priority: MONITORING_PRIORITIES.NORMAL,
    expectedContentType: CONTENT_TYPES.HTML,
    parserId: 'PARSER_RRB_HTML_V1',
  },
  NTA: {
    monitoringEnabled: false,
    defaultIntervalMs: DEFAULT_INTERVAL_MS * 3,
    priority: MONITORING_PRIORITIES.LOW,
    expectedContentType: CONTENT_TYPES.HTML,
    parserId: 'PARSER_NTA_HTML_V1',
  },
});

function normalizeContentType(value) {
  if (typeof value === 'string' && VALID_CONTENT_TYPES.includes(value.trim())) {
    return value.trim();
  }
  return CONTENT_TYPES.HTML;
}

function normalizePriority(value) {
  if (typeof value === 'string' && VALID_PRIORITIES.includes(value.trim())) {
    return value.trim();
  }
  return MONITORING_PRIORITIES.NORMAL;
}

function normalizeInterval(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return fallback;
}

/**
 * Create monitoring configuration for a single source.
 * @param {object} [input]
 */
function createSourceMonitoringConfiguration(input = {}) {
  const sourceId =
    typeof input.sourceId === 'string' && input.sourceId.trim()
      ? input.sourceId.trim()
      : 'UNKNOWN_SOURCE';

  const defaults = DEFAULT_MONITORING_CONFIG_BY_SOURCE[sourceId] || {};

  return deepFreeze({
    sourceId,
    monitoringEnabled:
      typeof input.monitoringEnabled === 'boolean'
        ? input.monitoringEnabled
        : defaults.monitoringEnabled !== false,
    defaultIntervalMs: normalizeInterval(
      input.defaultIntervalMs != null
        ? input.defaultIntervalMs
        : defaults.defaultIntervalMs,
      DEFAULT_INTERVAL_MS
    ),
    priority: normalizePriority(
      input.priority != null ? input.priority : defaults.priority
    ),
    expectedContentType: normalizeContentType(
      input.expectedContentType != null
        ? input.expectedContentType
        : defaults.expectedContentType
    ),
    parserId:
      typeof input.parserId === 'string' && input.parserId.trim()
        ? input.parserId.trim()
        : typeof defaults.parserId === 'string'
          ? defaults.parserId
          : '',
    configurationVersion: MONITORING_CONFIGURATION_VERSION,
    advisoryOnly: true,
    executionDenied: true,
    schedulingDenied: true,
  });
}

/**
 * Build monitoring configuration map for a registry of sources.
 * @param {object} [options]
 * @param {Array<object>} [options.sources] Registry sources
 * @param {object|Array} [options.configurations] Overrides by sourceId or list
 */
function createMonitoringConfigurationMap(options = {}) {
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const overrides = {};

  if (Array.isArray(options.configurations)) {
    for (let i = 0; i < options.configurations.length; i += 1) {
      const cfg = options.configurations[i] || {};
      if (typeof cfg.sourceId === 'string' && cfg.sourceId.trim()) {
        overrides[cfg.sourceId.trim()] = cfg;
      }
    }
  } else if (options.configurations && typeof options.configurations === 'object') {
    Object.keys(options.configurations).forEach((key) => {
      overrides[key] = { sourceId: key, ...options.configurations[key] };
    });
  }

  const bySourceId = {};
  const configurations = [];

  const sourceIds =
    sources.length > 0
      ? sources.map((s) => s.sourceId)
      : Object.keys(DEFAULT_MONITORING_CONFIG_BY_SOURCE);

  const seen = new Set();
  for (let i = 0; i < sourceIds.length; i += 1) {
    const sourceId = sourceIds[i];
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);
    const cfg = createSourceMonitoringConfiguration({
      sourceId,
      ...(overrides[sourceId] || {}),
    });
    bySourceId[sourceId] = cfg;
    configurations.push(cfg);
  }

  // Include explicit override-only entries not present in sources
  Object.keys(overrides).forEach((sourceId) => {
    if (!seen.has(sourceId)) {
      const cfg = createSourceMonitoringConfiguration({
        sourceId,
        ...overrides[sourceId],
      });
      bySourceId[sourceId] = cfg;
      configurations.push(cfg);
    }
  });

  configurations.sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  return deepFreeze({
    configurationVersion: MONITORING_CONFIGURATION_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    executionDenied: true,
    schedulingDenied: true,
    monitoringJobsDenied: true,
    contentTypes: { ...CONTENT_TYPES },
    priorities: { ...MONITORING_PRIORITIES },
    configurationCount: configurations.length,
    enabledCount: configurations.filter((c) => c.monitoringEnabled).length,
    disabledCount: configurations.filter((c) => !c.monitoringEnabled).length,
    configurations,
    bySourceId,
  });
}

function getDefaultMonitoringConfigurationMap(sources) {
  return createMonitoringConfigurationMap({ sources });
}

function getSourceMonitoringConfiguration(map, sourceId) {
  if (!map || !map.bySourceId || typeof sourceId !== 'string') {
    return null;
  }
  return map.bySourceId[sourceId] || null;
}

module.exports = {
  MONITORING_CONFIGURATION_VERSION,
  CONTENT_TYPES,
  MONITORING_PRIORITIES,
  VALID_CONTENT_TYPES,
  VALID_PRIORITIES,
  DEFAULT_INTERVAL_MS,
  DEFAULT_MONITORING_CONFIG_BY_SOURCE,
  createSourceMonitoringConfiguration,
  createMonitoringConfigurationMap,
  getDefaultMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
};
