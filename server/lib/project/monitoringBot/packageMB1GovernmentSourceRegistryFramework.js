'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Government Source Registry & Monitoring Configuration Framework
 *
 * Foundation for the Government Monitoring Bot.
 * Defines source registry, monitoring configuration, parser registration,
 * crawl policies, and source governance.
 *
 * This package must NOT:
 *   - perform monitoring
 *   - visit websites
 *   - schedule jobs
 *   - scrape pages
 *   - make HTTP requests
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 5 governance module identities:
 *   Pipeline Health, Monitoring Review Integration,
 *   Admin Dashboard, Publish Readiness Authorization.
 *
 * Extension points (inactive):
 *   Program 6 hardening, Program 7 operator tools,
 *   Program 8 consolidation, MB-2 website change detection.
 */

const {
  GOVERNMENT_SOURCE_REGISTRY_VERSION,
  SOURCE_CATEGORIES,
  REUSED_GOVERNANCE_MODULE_IDS,
  DEFAULT_SOURCE_CONFIG,
  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
  listGovernmentSources,
  listActiveGovernmentSources,
} = require('./governmentSourceRegistry');

const {
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
} = require('./monitoringConfiguration');

const {
  CRAWL_POLICY_VERSION,
  ROBOTS_POLICIES,
  VALID_ROBOTS_POLICIES,
  DEFAULT_CRAWL_POLICY,
  createCrawlPolicy,
  createCrawlPolicyMap,
  getDefaultCrawlPolicy,
  validateCrawlPolicyShape,
} = require('./crawlPolicy');

const {
  PARSER_REGISTRY_VERSION,
  DEFAULT_PARSER_CONFIG,
  createParserRegistration,
  createParserRegistry,
  getDefaultParserRegistry,
  getParserRegistration,
  listParserRegistrations,
} = require('./parserRegistry');

const {
  SOURCE_HEALTH_METADATA_VERSION,
  SOURCE_HEALTH,
  VALID_SOURCE_HEALTH,
  createSourceHealthMetadata,
  createSourceHealthMetadataMap,
  getSourceHealthMetadata,
  summarizeSourceHealth,
} = require('./sourceHealthMetadata');

const {
  REGISTRY_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  REQUIRED_SOURCE_FIELDS,
  URL_FIELDS,
  isValidHttpUrl,
  validateGovernmentSourceRegistry,
  generateRegistryDiagnostics,
} = require('./registryValidation');

const {
  OPERATOR_REGISTRY_DASHBOARD_VERSION,
  generateOperatorRegistryDashboard,
} = require('./operatorRegistryDashboard');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_MB1_GOVERNMENT_SOURCE_REGISTRY';
const PACKAGE_NAME =
  'Government Source Registry & Monitoring Configuration Framework';
const PACKAGE_CODE = 'MB-1';

const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';

const OBJECTIVE =
  'Create the foundation for the Government Monitoring Bot by defining source registry, monitoring configuration, parser registration, crawl policies, and source governance — without performing monitoring.';

const OUT_OF_SCOPE = Object.freeze([
  'WEBSITE_VISITS',
  'HTTP_REQUESTS',
  'SCRAPING',
  'PARSING',
  'SCHEDULERS',
  'WORKERS',
  'REDIS',
  'TELEGRAM',
  'REVIEW_CREATION',
  'PUBLISHING',
  'MONITORING_EXECUTION',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'GITHUB',
  'VPS',
  'EXPRESS_ROUTE_ACTIVATION',
  'SQL_SCHEMA_REDESIGN',
  'RUNTIME_WIRING',
]);

const CAPABILITIES = Object.freeze([
  'GOVERNMENT_SOURCE_REGISTRY',
  'MONITORING_CONFIGURATION',
  'CRAWL_POLICY',
  'PARSER_REGISTRY',
  'SOURCE_HEALTH_METADATA',
  'OPERATOR_REGISTRY_DASHBOARD',
  'REGISTRY_VALIDATION',
]);

const EXTENSION_POINTS = deepFreeze({
  PROGRAM_6_HARDENING: {
    extensionId: 'PROGRAM_6_HARDENING',
    status: 'RESERVED',
    activated: false,
    description: 'Future hardening of monitoring governance controls.',
  },
  PROGRAM_7_OPERATOR_TOOLS: {
    extensionId: 'PROGRAM_7_OPERATOR_TOOLS',
    status: 'RESERVED',
    activated: false,
    description: 'Future operator tooling surface for registry management.',
  },
  PROGRAM_8_CONSOLIDATION: {
    extensionId: 'PROGRAM_8_CONSOLIDATION',
    status: 'RESERVED',
    activated: false,
    description: 'Future consolidation of monitoring and recruitment pipelines.',
  },
  MB2_WEBSITE_CHANGE_DETECTION: {
    extensionId: 'MB2_WEBSITE_CHANGE_DETECTION',
    status: 'RESERVED',
    activated: false,
    description: 'Next package: website change detection (not activated).',
  },
});

/**
 * Evaluate / assemble the full MB-1 registry framework snapshot.
 * Configuration and diagnostics only — no monitoring execution.
 *
 * @param {object} [input]
 */
function evaluateGovernmentSourceRegistryFramework(input = {}) {
  const sourceRegistry =
    input.sourceRegistry ||
    createGovernmentSourceRegistry(
      input.sources ? { sources: input.sources } : undefined
    );

  const parserRegistry =
    input.parserRegistry ||
    createParserRegistry(
      input.parsers ? { parsers: input.parsers } : undefined
    );

  const monitoringConfiguration =
    input.monitoringConfiguration ||
    createMonitoringConfigurationMap({
      sources: sourceRegistry.sources,
      configurations: input.monitoringConfigurations,
    });

  const crawlPolicyMap =
    input.crawlPolicyMap ||
    createCrawlPolicyMap({
      sources: sourceRegistry.sources,
      policies: input.crawlPolicies,
      defaultPolicy: input.defaultCrawlPolicy,
    });

  const healthMap =
    input.healthMap ||
    createSourceHealthMetadataMap({
      sources: sourceRegistry.sources,
      healthObservations: input.healthObservations,
    });

  const validation = validateGovernmentSourceRegistry({
    sourceRegistry,
    monitoringConfiguration,
    parserRegistry,
    crawlPolicyMap,
    rawSources: input.rawSources,
  });

  const dashboard = generateOperatorRegistryDashboard({
    sourceRegistry,
    monitoringConfiguration,
    parserRegistry,
    crawlPolicyMap,
    healthMap,
    validation,
  });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    monitoringExecuted: false,
    httpRequestsPerformed: false,
    websitesVisited: false,
    jobsScheduled: false,
    pagesScraped: false,
    parsingPerformed: false,
    routesCreated: false,
    runtimeWired: false,

    sourceRegistry,
    monitoringConfiguration,
    crawlPolicyMap,
    parserRegistry,
    healthMap,
    healthSummary: summarizeSourceHealth(healthMap),
    validation,
    dashboard,

    reusedGovernanceModules: { ...REUSED_GOVERNANCE_MODULE_IDS },
    extensionPoints: EXTENSION_POINTS,

    effects: {
      monitoringExecuted: false,
      httpRequest: false,
      websiteVisit: false,
      scrape: false,
      parse: false,
      schedule: false,
      workerStarted: false,
      redisUsed: false,
      telegramSent: false,
      reviewCreated: false,
      published: false,
      routeActivated: false,
      sqlSchemaChanged: false,
      deployed: false,
    },

    readyForMB2: validation.valid,
    mb2Activated: false,
  });
}

function getGovernmentSourceRegistryFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getGovernmentSourceRegistryFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    objective: OBJECTIVE,
    gapAddressed: null,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    extensionPoints: EXTENSION_POINTS,
    reusedGovernanceModules: { ...REUSED_GOVERNANCE_MODULE_IDS },

    programs1to5PrerequisiteComplete: true,
    packageMB1Complete: true,
    packageMB2Ready: true,
    packageMB2Activated: false,
    monitoringAuthorized: false,
    httpAuthorized: false,
    scrapingAuthorized: false,
    schedulingAuthorized: false,

    safetyBoundaries: {
      websiteVisitsDenied: true,
      httpRequestsDenied: true,
      scrapingDenied: true,
      parsingDenied: true,
      schedulingDenied: true,
      workersDenied: true,
      redisDenied: true,
      telegramDenied: true,
      reviewCreationDenied: true,
      publishingDenied: true,
      monitoringExecutionDenied: true,
      routeCreationDenied: true,
      expressRouteActivationDenied: true,
      sqlSchemaRedesignDenied: true,
      runtimeWiringDenied: true,
      deploymentDenied: true,
      githubDenied: true,
      vpsDenied: true,
      hardDeniedActions: [
        'DENIED_WEBSITE_VISITS',
        'DENIED_HTTP_REQUESTS',
        'DENIED_SCRAPING',
        'DENIED_PARSING',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_TELEGRAM',
        'DENIED_REVIEW_CREATION',
        'DENIED_PUBLISHING',
        'DENIED_MONITORING_EXECUTION',
        'DENIED_ROUTE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_RUNTIME_WIRING',
        'DENIED_DEPLOYMENT',
        'DENIED_GITHUB',
        'DENIED_VPS',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_MB1',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      monitoringExecuted: false,
      httpRequestsPerformed: false,
      websitesVisited: false,
      pagesScraped: false,
      parsingPerformed: false,
      telegramSent: false,
      reviewCreated: false,
      publishingExecuted: false,
      filesystemWritten: false,
      networkAccessed: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_MB1',
      status: 'GOVERNMENT_SOURCE_REGISTRY_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete configuration-driven Government Source Registry and Monitoring Configuration Framework with no monitoring execution.',
      nextPackage: 'MB-2',
      nextPackageName: 'Website Change Detection',
      monitoringOccurs: false,
      httpRequestsOccur: false,
      runtimeBehaviorChanged: false,
    },

    recommendation:
      'MB1_COMPLETE_CONFIGURATION_ONLY_READY_FOR_MB2_NO_MONITORING_NO_HTTP',
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  STAGE_ID,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  EXTENSION_POINTS,
  GOVERNMENT_SOURCE_REGISTRY_VERSION,
  SOURCE_CATEGORIES,
  REUSED_GOVERNANCE_MODULE_IDS,
  DEFAULT_SOURCE_CONFIG,
  MONITORING_CONFIGURATION_VERSION,
  CONTENT_TYPES,
  MONITORING_PRIORITIES,
  VALID_CONTENT_TYPES,
  VALID_PRIORITIES,
  DEFAULT_INTERVAL_MS,
  DEFAULT_MONITORING_CONFIG_BY_SOURCE,
  CRAWL_POLICY_VERSION,
  ROBOTS_POLICIES,
  VALID_ROBOTS_POLICIES,
  DEFAULT_CRAWL_POLICY,
  PARSER_REGISTRY_VERSION,
  DEFAULT_PARSER_CONFIG,
  SOURCE_HEALTH_METADATA_VERSION,
  SOURCE_HEALTH,
  VALID_SOURCE_HEALTH,
  REGISTRY_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  REQUIRED_SOURCE_FIELDS,
  URL_FIELDS,
  OPERATOR_REGISTRY_DASHBOARD_VERSION,
  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
  listGovernmentSources,
  listActiveGovernmentSources,
  createSourceMonitoringConfiguration,
  createMonitoringConfigurationMap,
  getDefaultMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
  createCrawlPolicy,
  createCrawlPolicyMap,
  getDefaultCrawlPolicy,
  validateCrawlPolicyShape,
  createParserRegistration,
  createParserRegistry,
  getDefaultParserRegistry,
  getParserRegistration,
  listParserRegistrations,
  createSourceHealthMetadata,
  createSourceHealthMetadataMap,
  getSourceHealthMetadata,
  summarizeSourceHealth,
  isValidHttpUrl,
  validateGovernmentSourceRegistry,
  generateRegistryDiagnostics,
  generateOperatorRegistryDashboard,
  evaluateGovernmentSourceRegistryFramework,
  getGovernmentSourceRegistryFramework,
  getGovernmentSourceRegistryFrameworkIdentity,
};
