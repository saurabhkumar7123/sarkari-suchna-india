'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Operator Registry Dashboard Model (Read-Only / Advisory)
 *
 * Read-only dashboard data for operators. No routes. No UI wiring.
 * Reuses Admin Dashboard identity conceptually only.
 */

const { deepFreeze } = require('./governmentSourceRegistry');
const { summarizeSourceHealth } = require('./sourceHealthMetadata');

const OPERATOR_REGISTRY_DASHBOARD_VERSION = 'MB1.1.0.0';

/**
 * Build read-only operator registry dashboard data.
 * @param {object} [input]
 */
function generateOperatorRegistryDashboard(input = {}) {
  const sourceRegistry = input.sourceRegistry || null;
  const monitoringConfiguration = input.monitoringConfiguration || null;
  const parserRegistry = input.parserRegistry || null;
  const crawlPolicyMap = input.crawlPolicyMap || null;
  const healthMap = input.healthMap || null;
  const validation = input.validation || null;

  const sources =
    sourceRegistry && Array.isArray(sourceRegistry.sources)
      ? sourceRegistry.sources
      : [];
  const activeSources = sources.filter((s) => s.active);
  const disabledSources = sources.filter((s) => !s.active);

  const parserMapping = sources.map((source) => {
    const monCfg =
      monitoringConfiguration &&
      monitoringConfiguration.bySourceId &&
      monitoringConfiguration.bySourceId[source.sourceId]
        ? monitoringConfiguration.bySourceId[source.sourceId]
        : null;
    const parserId = monCfg ? monCfg.parserId : null;
    const parser =
      parserId &&
      parserRegistry &&
      parserRegistry.byId &&
      parserRegistry.byId[parserId]
        ? parserRegistry.byId[parserId]
        : null;

    return {
      sourceId: source.sourceId,
      displayName: source.displayName,
      active: source.active,
      parserId,
      parserVersion: parser ? parser.parserVersion : null,
      parserRegistered: Boolean(parser),
      expectedContentType: monCfg ? monCfg.expectedContentType : null,
      monitoringEnabled: monCfg ? monCfg.monitoringEnabled : null,
    };
  });

  const monitoringRows = sources.map((source) => {
    const monCfg =
      monitoringConfiguration &&
      monitoringConfiguration.bySourceId &&
      monitoringConfiguration.bySourceId[source.sourceId]
        ? monitoringConfiguration.bySourceId[source.sourceId]
        : null;
    const crawl =
      crawlPolicyMap &&
      crawlPolicyMap.bySourceId &&
      crawlPolicyMap.bySourceId[source.sourceId]
        ? crawlPolicyMap.bySourceId[source.sourceId]
        : null;

    return {
      sourceId: source.sourceId,
      displayName: source.displayName,
      monitoringEnabled: monCfg ? monCfg.monitoringEnabled : false,
      defaultIntervalMs: monCfg ? monCfg.defaultIntervalMs : null,
      priority: monCfg ? monCfg.priority : null,
      expectedContentType: monCfg ? monCfg.expectedContentType : null,
      parserId: monCfg ? monCfg.parserId : null,
      crawlDelayMs: crawl ? crawl.crawlDelayMs : null,
      robotsPolicy: crawl ? crawl.robotsPolicy : null,
      requestTimeoutMs: crawl ? crawl.requestTimeoutMs : null,
    };
  });

  const healthSummary = summarizeSourceHealth(healthMap);

  const healthRows =
    healthMap && Array.isArray(healthMap.entries)
      ? healthMap.entries.map((entry) => ({
          sourceId: entry.sourceId,
          currentHealth: entry.currentHealth,
          consecutiveFailures: entry.consecutiveFailures,
          lastSuccessfulCheck: entry.lastSuccessfulCheck,
          lastFailedCheck: entry.lastFailedCheck,
          advisoryNotes: entry.advisoryNotes,
        }))
      : [];

  return deepFreeze({
    dashboardId: 'GOVERNMENT_SOURCE_REGISTRY_OPERATOR_DASHBOARD',
    title: 'Government Source Registry & Monitoring Configuration',
    packageId: 'PACKAGE_MB1_GOVERNMENT_SOURCE_REGISTRY',
    dashboardVersion: OPERATOR_REGISTRY_DASHBOARD_VERSION,
    operatorSurface: 'ADMIN_DASHBOARD',
    readOnly: true,
    advisoryOnly: true,
    runtimeWired: false,
    featureActivated: false,
    routesCreated: false,
    httpRequests: false,
    monitoringExecution: false,
    scheduling: false,
    scraping: false,

    registeredSources: sources.map((s) => ({
      sourceId: s.sourceId,
      displayName: s.displayName,
      organization: s.organization,
      department: s.department,
      category: s.category,
      active: s.active,
      baseUrl: s.baseUrl,
    })),
    activeSources: activeSources.map((s) => ({
      sourceId: s.sourceId,
      displayName: s.displayName,
    })),
    disabledSources: disabledSources.map((s) => ({
      sourceId: s.sourceId,
      displayName: s.displayName,
    })),

    counts: {
      registered: sources.length,
      active: activeSources.length,
      disabled: disabledSources.length,
      parsers:
        parserRegistry && typeof parserRegistry.parserCount === 'number'
          ? parserRegistry.parserCount
          : 0,
      monitoringEnabled:
        monitoringConfiguration &&
        typeof monitoringConfiguration.enabledCount === 'number'
          ? monitoringConfiguration.enabledCount
          : 0,
      monitoringDisabled:
        monitoringConfiguration &&
        typeof monitoringConfiguration.disabledCount === 'number'
          ? monitoringConfiguration.disabledCount
          : 0,
    },

    parserMapping,
    monitoringConfiguration: monitoringRows,
    healthSummary,
    healthRows,

    validationSummary: validation
      ? {
          valid: validation.valid,
          diagnosticCount: validation.diagnosticCount,
          errorCount: validation.errorCount,
          warningCount: validation.warningCount,
        }
      : null,

    reusedGovernanceModules: [
      'PIPELINE_HEALTH',
      'MONITORING_REVIEW_INTEGRATION',
      'ADMIN_DASHBOARD',
      'PUBLISH_READINESS_AUTHORIZATION',
    ],
  });
}

module.exports = {
  OPERATOR_REGISTRY_DASHBOARD_VERSION,
  generateOperatorRegistryDashboard,
};
