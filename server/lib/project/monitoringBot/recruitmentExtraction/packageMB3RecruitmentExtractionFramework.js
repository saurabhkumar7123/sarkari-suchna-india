'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Recruitment Extraction Framework
 *
 * Extracts structured recruitment data after MB-2 change detection.
 *
 * This package must NOT:
 *   - publish anything
 *   - send Telegram messages
 *   - schedule jobs / start workers
 *   - persist to database / Redis
 *   - create production review queues
 *   - wire Express routes
 *
 * Advisory only. Configuration-driven. Deterministic.
 * Reuses MB-1 parser registry and MB-2 detection results.
 *
 * Extension points (inactive):
 *   MB-4 Pipeline Integration, MB-5 Controlled Scheduler,
 *   Program 6 Hardening, Program 7 Operator Analytics,
 *   Program 8 Consolidation.
 */

const {
  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
} = require('../governmentSourceRegistry');

const {
  CONTENT_TYPES,
  createMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
} = require('../monitoringConfiguration');

const {
  createParserRegistry,
  getDefaultParserRegistry,
  getParserRegistration,
  listParserRegistrations,
} = require('../parserRegistry');

const {
  evaluateGovernmentSourceRegistryFramework,
  getGovernmentSourceRegistryFramework,
} = require('../packageMB1GovernmentSourceRegistryFramework');

const {
  getWebsiteChangeDetectionFramework,
  evaluateWebsiteChangeDetectionFramework,
  DETECTION_STATUS,
  DETECTION_RESULT_STATUSES,
} = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');

const {
  STRUCTURED_RECRUITMENT_MODEL_VERSION,
  STRUCTURED_RECRUITMENT_SCHEMA_VERSION,
  APPLICATION_MODES,
  REQUIRED_RECRUITMENT_FIELDS,
  OPTIONAL_RECRUITMENT_FIELDS,
  createStructuredRecruitment,
  validateStructuredRecruitment,
} = require('./structuredRecruitmentModel');

const {
  EXTRACTION_PARSERS_VERSION,
  PARSER_CAPABILITIES,
  extractFromHtml,
  extractFromRss,
  extractFromXml,
  extractFromPdf,
  extractByContentType,
} = require('./extractionParsers');

const {
  EXTRACTION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  generateExtractionDiagnostics,
} = require('./extractionDiagnostics');

const {
  DUPLICATE_DETECTION_VERSION,
  DUPLICATE_STATUS,
  generateRecruitmentFingerprint,
  detectAdvisoryDuplicate,
} = require('./duplicateDetection');

const {
  CANDIDATE_BUILDER_VERSION,
  CANDIDATE_STATUSES,
  buildAdvisoryCandidate,
} = require('./candidateBuilder');

const {
  EXTRACTION_ENGINE_VERSION,
  EXTRACTION_STATUSES,
  extractRecruitment,
} = require('./extractionEngine');

const {
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  PipelineIntegrationExtension,
  ControlledSchedulerExtension,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,
} = require('./extensionPoints');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_MB3_RECRUITMENT_EXTRACTION';
const PACKAGE_NAME = 'Recruitment Extraction Framework';
const PACKAGE_CODE = 'MB-3';
const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';

const OBJECTIVE =
  'Implement the Recruitment Extraction Framework so a detected government website change can be converted into a structured advisory recruitment object and advisory candidate — without publishing, Telegram, or scheduling.';

const OUT_OF_SCOPE = Object.freeze([
  'TELEGRAM',
  'SCHEDULER',
  'WORKERS',
  'CRON',
  'PUBLISHING',
  'REVIEW_QUEUE_RUNTIME',
  'DATABASE_WRITES',
  'REDIS',
  'EXPRESS_ROUTES',
  'PRODUCTION_WIRING',
]);

const PROHIBITED = Object.freeze([
  'EXPRESS_ROUTES',
  'GITHUB_DEPLOYMENT',
  'VPS_DEPLOYMENT',
  'SQL_SCHEMA_CHANGES',
  'SCHEDULER_ACTIVATION',
  'WORKER_ACTIVATION',
  'TELEGRAM_NOTIFICATION',
  'PUBLIC_PAGE_GENERATION',
]);

const CAPABILITIES = Object.freeze([
  'HTML_EXTRACTION',
  'RSS_EXTRACTION',
  'XML_EXTRACTION',
  'PDF_EXTRACTION_INTERFACE',
  'STRUCTURED_RECRUITMENT_MODEL',
  'EXTRACTION_DIAGNOSTICS',
  'ADVISORY_DUPLICATE_DETECTION',
  'ADVISORY_CANDIDATE_BUILDER',
  'PARSER_REGISTRY_REUSE',
]);

function getRecruitmentExtractionFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getRecruitmentExtractionFramework() {
  const mb1 = getGovernmentSourceRegistryFramework();
  const mb2 = getWebsiteChangeDetectionFramework();

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    manualInvocationOnly: true,
    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),
    extensionPoints: EXTENSION_POINTS,

    packageMB1PrerequisiteComplete: true,
    packageMB2PrerequisiteComplete: true,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
    packageMB3Complete: true,
    packageMB4Ready: true,
    packageMB4Activated: false,
    packageMB5Ready: false,
    packageMB5Activated: false,

    mb1Identity: {
      packageCode: mb1.packageCode,
      packageMB1Complete: mb1.packageMB1Complete,
    },
    mb2Identity: {
      packageCode: mb2.packageCode,
      packageMB2Complete: mb2.packageMB2Complete,
      packageMB3Activated: mb2.packageMB3Activated,
    },

    safetyBoundaries: {
      publishingDenied: true,
      telegramDenied: true,
      schedulerDenied: true,
      cronDenied: true,
      workersDenied: true,
      databaseWritesDenied: true,
      redisDenied: true,
      expressRoutesDenied: true,
      reviewQueueRuntimeDenied: true,
      productionWiringDenied: true,
      pageGenerationDenied: true,
      hardDeniedActions: [
        'DENIED_PUBLISHING',
        'DENIED_TELEGRAM',
        'DENIED_SCHEDULER',
        'DENIED_WORKERS',
        'DENIED_DATABASE_WRITES',
        'DENIED_REDIS',
        'DENIED_EXPRESS_ROUTES',
        'DENIED_REVIEW_QUEUE_RUNTIME',
        'DENIED_PRODUCTION_WIRING',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_MB3',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      telegramSent: false,
      publishingExecuted: false,
      reviewQueueCreated: false,
      filesystemWritten: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
      backgroundWorkerStarted: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_MB3',
      status: 'RECRUITMENT_EXTRACTION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver an advisory Recruitment Extraction Framework that converts detected source changes into structured recruitments and advisory candidates.',
      nextPackage: 'MB-4',
      nextPackageName: 'Pipeline Integration',
      canExtractJobs: true,
      canCreateAdvisoryCandidates: true,
      canNotifyOperators: false,
      canPublish: false,
      runtimeBehaviorChanged: false,
    },

    recommendation:
      'MB3_COMPLETE_ADVISORY_EXTRACTION_ONLY_READY_FOR_MB4_NO_PUBLISHING_NO_TELEGRAM_NO_SCHEDULER',
  });
}

/**
 * Assemble an MB-3 framework snapshot (configuration + identity).
 */
function evaluateRecruitmentExtractionFramework(input = {}) {
  const mb1Evaluation =
    input.mb1Evaluation ||
    evaluateGovernmentSourceRegistryFramework({
      sources: input.sources,
      sourceRegistry: input.sourceRegistry,
      monitoringConfigurations: input.monitoringConfigurations,
      monitoringConfiguration: input.monitoringConfiguration,
      crawlPolicies: input.crawlPolicies,
      crawlPolicyMap: input.crawlPolicyMap,
      parsers: input.parsers,
      parserRegistry: input.parserRegistry,
    });

  const mb2Evaluation =
    input.mb2Evaluation ||
    evaluateWebsiteChangeDetectionFramework({
      mb1Evaluation,
      sources: input.sources,
      sourceRegistry: input.sourceRegistry,
      monitoringConfigurations: input.monitoringConfigurations,
      monitoringConfiguration: input.monitoringConfiguration,
    });

  const parserRegistry =
    input.parserRegistry ||
    mb1Evaluation.parserRegistry ||
    createParserRegistry({ parsers: input.parsers });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    manualInvocationOnly: true,

    mb1Evaluation,
    mb2Evaluation,
    sourceRegistry: mb1Evaluation.sourceRegistry,
    monitoringConfiguration: mb1Evaluation.monitoringConfiguration,
    parserRegistry,

    extensionPoints: EXTENSION_POINTS,
    capabilities: CAPABILITIES.slice(),

    effects: {
      published: false,
      telegramSent: false,
      databaseWritten: false,
      redisUsed: false,
      schedulerStarted: false,
      workerStarted: false,
      routeActivated: false,
      reviewQueueCreated: false,
    },

    readyForMB4: true,
    mb4Activated: false,
    readyForMB5: false,
    mb5Activated: false,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
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

  STRUCTURED_RECRUITMENT_MODEL_VERSION,
  STRUCTURED_RECRUITMENT_SCHEMA_VERSION,
  APPLICATION_MODES,
  REQUIRED_RECRUITMENT_FIELDS,
  OPTIONAL_RECRUITMENT_FIELDS,
  EXTRACTION_PARSERS_VERSION,
  PARSER_CAPABILITIES,
  EXTRACTION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  DUPLICATE_DETECTION_VERSION,
  DUPLICATE_STATUS,
  CANDIDATE_BUILDER_VERSION,
  CANDIDATE_STATUSES,
  EXTRACTION_ENGINE_VERSION,
  EXTRACTION_STATUSES,
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  CONTENT_TYPES,
  DETECTION_STATUS,
  DETECTION_RESULT_STATUSES,

  deepFreeze,
  createGovernmentSourceRegistry,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
  createMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
  createParserRegistry,
  getDefaultParserRegistry,
  getParserRegistration,
  listParserRegistrations,

  createStructuredRecruitment,
  validateStructuredRecruitment,
  extractFromHtml,
  extractFromRss,
  extractFromXml,
  extractFromPdf,
  extractByContentType,
  generateExtractionDiagnostics,
  generateRecruitmentFingerprint,
  detectAdvisoryDuplicate,
  buildAdvisoryCandidate,
  extractRecruitment,

  PipelineIntegrationExtension,
  ControlledSchedulerExtension,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,

  evaluateRecruitmentExtractionFramework,
  getRecruitmentExtractionFramework,
  getRecruitmentExtractionFrameworkIdentity,
};
