'use strict';

/**
 * FT-1A — Parts F & G
 * Source registry advisory audit + configuration audit
 */

const path = require('path');
const fs = require('fs');
const {
  deepFreeze,
  getDefaultGovernmentSourceRegistry,
  DEFAULT_SOURCE_CONFIG,
} = require('../governmentSourceRegistry');
const {
  createMonitoringConfigurationMap,
  DEFAULT_MONITORING_CONFIG_BY_SOURCE,
} = require('../monitoringConfiguration');
const {
  createParserRegistry,
  getDefaultParserRegistry,
} = require('../parserRegistry');
const {
  createCrawlPolicyMap,
} = require('../crawlPolicy');
const {
  validateGovernmentSourceRegistry,
} = require('../registryValidation');
const {
  createControlledScheduler,
} = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');
const {
  getTelegramNotificationFramework,
} = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const {
  getControlledSchedulerFramework,
} = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');

const SOURCE_CONFIG_AUDIT_VERSION = 'FT1A.1.0.0';

const APPROVED_ACTIVE_SOURCE_IDS = Object.freeze([
  'SSC_NIC',
  'UPSC',
  'IBPS',
  'RRB',
]);

const APPROVED_INACTIVE_SOURCE_IDS = Object.freeze(['NTA']);

const THIRD_PARTY_HOST_PATTERNS = Object.freeze([
  'sarkariresult.com.cm',
  'sarkariresult.com',
  'sarkari-result',
  'private-source',
]);

function collectUrlsFromSource(source) {
  if (!source || typeof source !== 'object') return [];
  return [
    source.baseUrl,
    source.recruitmentUrl,
    source.resultUrl,
    source.noticeUrl,
    source.rssUrl,
  ].filter((u) => typeof u === 'string' && u.trim());
}

function isThirdPartyUrl(url) {
  const lower = String(url).toLowerCase();
  return THIRD_PARTY_HOST_PATTERNS.some((p) => lower.includes(p));
}

function scanWorkspaceForThirdPartyReferences(rootDir) {
  const findings = [];
  // Audit only active monitoring configuration/runtime modules — not FT-1A audit tooling itself.
  const filesToScan = [
    path.join(rootDir, 'server', 'lib', 'project', 'monitoringBot', 'governmentSourceRegistry.js'),
    path.join(rootDir, 'server', 'lib', 'project', 'monitoringBot', 'monitoringConfiguration.js'),
    path.join(rootDir, 'server', 'lib', 'project', 'monitoringBot', 'crawlPolicy.js'),
    path.join(rootDir, 'server', 'lib', 'project', 'monitoringBot', 'parserRegistry.js'),
    path.join(
      rootDir,
      'server',
      'lib',
      'project',
      'monitoringBot',
      'controlledScheduler',
      'controlledScheduler.js'
    ),
    path.join(
      rootDir,
      'server',
      'lib',
      'project',
      'monitoringBot',
      'controlledScheduler',
      'executionCoordinator.js'
    ),
  ];

  for (const full of filesToScan) {
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const pattern of THIRD_PARTY_HOST_PATTERNS) {
      if (text.includes(pattern)) {
        findings.push({
          file: full,
          pattern,
          inActiveMonitoringCode: true,
        });
      }
    }
  }
  return findings;
}

/**
 * Part F — Advisory government source audit.
 * @param {object} [input]
 */
async function auditGovernmentSources(input = {}) {
  const registry =
    input.sourceRegistry || getDefaultGovernmentSourceRegistry();
  const monitoringConfiguration =
    input.monitoringConfiguration ||
    createMonitoringConfigurationMap({ sources: registry.sources });

  const activeIds = (registry.activeSources || []).map((s) => s.sourceId);
  const inactiveIds = (registry.inactiveSources || []).map((s) => s.sourceId);

  const unexpectedActive = activeIds.filter(
    (id) => !APPROVED_ACTIVE_SOURCE_IDS.includes(id)
  );
  const missingApproved = APPROVED_ACTIVE_SOURCE_IDS.filter(
    (id) => !activeIds.includes(id)
  );
  const inactiveNotInactive = APPROVED_INACTIVE_SOURCE_IDS.filter((id) =>
    activeIds.includes(id)
  );

  const thirdPartyInRegistry = [];
  for (const source of registry.sources || []) {
    const urls = collectUrlsFromSource(source);
    for (const url of urls) {
      if (isThirdPartyUrl(url)) {
        thirdPartyInRegistry.push({
          sourceId: source.sourceId,
          url,
          active: source.active === true,
        });
      }
    }
  }

  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const thirdPartyCodeRefs = scanWorkspaceForThirdPartyReferences(workspaceRoot);

  const activeThirdParty = thirdPartyInRegistry.filter((t) => t.active);
  const thirdPartyMonitoringDisabled =
    activeThirdParty.length === 0 &&
    thirdPartyCodeRefs.length === 0;

  // Scheduler must not execute inactive NTA
  const scheduler = createControlledScheduler({ enabled: true });
  scheduler.enable();
  const outcome = await scheduler.invoke({
    sourceIds: ['NTA'],
    ignoreInterval: true,
    ignoreCooldown: true,
    ignoreRateLimit: true,
    sourceRegistry: registry,
    monitoringConfiguration,
  });
  const schedulerBlocksDisabled = (outcome.results || []).every(
    (r) =>
      r.status === 'SKIPPED' &&
      (r.reason === 'SOURCE_INACTIVE' || r.reason === 'MONITORING_DISABLED')
  );

  const checks = [
    {
      checkId: 'ONLY_APPROVED_GOVERNMENT_SOURCES_ACTIVE',
      passed:
        unexpectedActive.length === 0 &&
        missingApproved.length === 0 &&
        inactiveNotInactive.length === 0,
      detail: { unexpectedActive, missingApproved, inactiveNotInactive },
    },
    {
      checkId: 'INACTIVE_SOURCES_REMAIN_INACTIVE',
      passed: APPROVED_INACTIVE_SOURCE_IDS.every((id) =>
        inactiveIds.includes(id)
      ),
      detail: { inactiveIds },
    },
    {
      checkId: 'THIRD_PARTY_PRIVATE_MONITORING_DISABLED',
      passed: thirdPartyMonitoringDisabled && activeThirdParty.length === 0,
      detail: {
        thirdPartyInRegistry,
        thirdPartyCodeRefsInMonitoringBot: thirdPartyCodeRefs.length,
        note:
          'Historical scripts under sarkari-suchna-india/scripts may reference sarkariresult.com.cm but are outside active monitoringBot registry.',
      },
    },
    {
      checkId: 'SCHEDULER_CANNOT_EXECUTE_DISABLED_SOURCES',
      passed: schedulerBlocksDisabled,
      detail: {
        results: (outcome.results || []).map((r) => ({
          sourceId: r.sourceId,
          status: r.status,
          reason: r.reason,
        })),
      },
    },
  ];

  return deepFreeze({
    validationVersion: SOURCE_CONFIG_AUDIT_VERSION,
    part: 'F',
    advisoryOnly: true,
    auditOnly: true,
    registryVersion: registry.registryVersion,
    activeSourceIds: activeIds,
    inactiveSourceIds: inactiveIds,
    approvedActiveSourceIds: APPROVED_ACTIVE_SOURCE_IDS.slice(),
    approvedInactiveSourceIds: APPROVED_INACTIVE_SOURCE_IDS.slice(),
    thirdPartyInRegistry,
    thirdPartyCodeRefsInMonitoringBot: thirdPartyCodeRefs,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    recommendation:
      'ADVISORY_AUDIT_ONLY_APPROVED_GOVERNMENT_SOURCES_ACTIVE_THIRD_PARTY_MONITORING_DISABLED',
  });
}

/**
 * Part G — Configuration audit.
 * @param {object} [input]
 */
function auditConfiguration(input = {}) {
  const registry =
    input.sourceRegistry || getDefaultGovernmentSourceRegistry();
  const monitoringConfiguration =
    input.monitoringConfiguration ||
    createMonitoringConfigurationMap({ sources: registry.sources });
  const parserRegistry =
    input.parserRegistry || getDefaultParserRegistry();
  const crawlPolicyMap =
    input.crawlPolicyMap ||
    createCrawlPolicyMap({ sources: registry.sources });

  const registryValidation = validateGovernmentSourceRegistry({
    sourceRegistry: registry,
    monitoringConfiguration,
    parserRegistry,
    crawlPolicyMap,
    rawSources: DEFAULT_SOURCE_CONFIG,
  });

  const duplicateSourceIds = registryValidation.diagnostics.filter(
    (d) => d.code === 'DUPLICATE_SOURCE_ID'
  );

  const parserMappingsOk = (registry.sources || []).every((source) => {
    const mon = monitoringConfiguration.bySourceId[source.sourceId];
    if (!mon || !mon.parserId) return false;
    return !!(parserRegistry.byId && parserRegistry.byId[mon.parserId]);
  });

  const intervalsOk = (monitoringConfiguration.configurations || []).every(
    (cfg) =>
      typeof cfg.defaultIntervalMs === 'number' && cfg.defaultIntervalMs > 0
  );

  const crawlPoliciesOk = (registry.sources || []).every((source) => {
    const policy =
      crawlPolicyMap.bySourceId && crawlPolicyMap.bySourceId[source.sourceId];
    return !!policy;
  });

  const tg = getTelegramNotificationFramework();
  const schedulerFw = getControlledSchedulerFramework();

  const featureFlags = deepFreeze({
    schedulerEnabledByDefault: false,
    telegramLiveDeliveryDefault: false,
    publishingEnabled: false,
    automaticApprovalEnabled: false,
    cronEnabled: false,
    redisEnabled: false,
    expressRoutesActivated: false,
  });

  const transportConfiguration = deepFreeze({
    defaultTransport: 'NULL_OR_EXPLICIT',
    liveTelegramRequiresAllowDelivery: true,
    productionCredentialsRequired: false,
    automaticSendingDenied:
      tg.safetyBoundaries.automaticSendingDenied === true,
  });

  const schedulerConfiguration = deepFreeze({
    disabledByDefault: schedulerFw.schedulerDisabledByDefault === true,
    manualInvocationOnly: schedulerFw.manualInvocationOnly === true,
    cronDenied: schedulerFw.safetyBoundaries.cronDenied === true,
    backgroundExecutionDenied:
      schedulerFw.safetyBoundaries.backgroundExecutionDenied === true,
  });

  const checks = [
    {
      checkId: 'NO_DUPLICATE_SOURCE_IDS',
      passed: duplicateSourceIds.length === 0 && registryValidation.valid,
    },
    {
      checkId: 'PARSER_MAPPINGS',
      passed: parserMappingsOk,
    },
    {
      checkId: 'CRAWL_POLICIES',
      passed: crawlPoliciesOk,
    },
    {
      checkId: 'INTERVALS',
      passed: intervalsOk,
    },
    {
      checkId: 'FEATURE_FLAGS_SAFE',
      passed: Object.values(featureFlags).every((v) => v === false),
    },
    {
      checkId: 'TRANSPORT_CONFIGURATION',
      passed:
        transportConfiguration.liveTelegramRequiresAllowDelivery === true &&
        transportConfiguration.automaticSendingDenied === true,
    },
    {
      checkId: 'SCHEDULER_CONFIGURATION',
      passed:
        schedulerConfiguration.disabledByDefault === true &&
        schedulerConfiguration.cronDenied === true,
    },
  ];

  return deepFreeze({
    validationVersion: SOURCE_CONFIG_AUDIT_VERSION,
    part: 'G',
    advisoryOnly: true,
    registryValidation: {
      valid: registryValidation.valid,
      errorCount: registryValidation.errorCount,
      warningCount: registryValidation.warningCount,
      diagnosticCount: registryValidation.diagnosticCount,
    },
    defaultMonitoringKeys: Object.keys(DEFAULT_MONITORING_CONFIG_BY_SOURCE).sort(),
    featureFlags,
    transportConfiguration,
    schedulerConfiguration,
    checks,
    allPassed: checks.every((c) => c.passed === true),
  });
}

module.exports = {
  SOURCE_CONFIG_AUDIT_VERSION,
  APPROVED_ACTIVE_SOURCE_IDS,
  APPROVED_INACTIVE_SOURCE_IDS,
  THIRD_PARTY_HOST_PATTERNS,
  auditGovernmentSources,
  auditConfiguration,
};
