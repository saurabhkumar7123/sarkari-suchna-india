'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-4
 * Pipeline Integration Framework
 *
 * Integrates MB-3 advisory candidates with Program 5 advisory pipeline.
 *
 * This package must NOT:
 *   - activate runtime automation
 *   - publish anything
 *   - generate public pages
 *   - send Telegram messages
 *   - schedule jobs / start workers
 *   - persist to database / Redis
 *   - wire Express routes
 *
 * Advisory only. Configuration-driven. Deterministic.
 * Reuses Program 5A–5F and MB-3 extraction outputs.
 *
 * Extension points (inactive):
 *   MB-5 Controlled Scheduler,
 *   Program 6 Hardening, Program 7 Operator Analytics,
 *   Program 8 Consolidation.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const {
  getRecruitmentExtractionFramework,
  evaluateRecruitmentExtractionFramework,
  extractRecruitment,
} = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');

const {
  getGovernmentSourceRegistryFramework,
} = require('../packageMB1GovernmentSourceRegistryFramework');

const {
  getWebsiteChangeDetectionFramework,
} = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');

const {
  ADVISORY_PIPELINE_PAYLOAD_VERSION,
  mapToAdvisoryPipelinePayload,
} = require('./advisoryPipelinePayload');

const {
  PREVIEW_PAYLOAD_VERSION,
  generateAdvisoryPreviewPayload,
} = require('./previewPayload');

const {
  INTEGRATION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  generateIntegrationDiagnostics,
} = require('./integrationDiagnostics');

const {
  PIPELINE_INTEGRATOR_VERSION,
  integrateAdvisoryCandidateWithPipeline,
} = require('./pipelineIntegrator');

const {
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  ControlledSchedulerExtension,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,
} = require('./extensionPoints');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_MB4_PIPELINE_INTEGRATION';
const PACKAGE_NAME = 'Pipeline Integration Framework';
const PACKAGE_CODE = 'MB-4';
const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';

const OBJECTIVE =
  'Integrate advisory recruitment candidates with the existing Program 5 advisory pipeline — without runtime activation, publishing, Telegram, or scheduling.';

const OUT_OF_SCOPE = Object.freeze([
  'TELEGRAM',
  'SCHEDULER',
  'WORKERS',
  'CRON',
  'PUBLISHING',
  'PAGE_GENERATION',
  'REVIEW_QUEUE_RUNTIME',
  'DATABASE_WRITES',
  'REDIS',
  'EXPRESS_ROUTES',
  'PRODUCTION_WIRING',
  'RUNTIME_ACTIVATION',
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
  'PUBLISH_EXECUTION',
]);

const CAPABILITIES = Object.freeze([
  'ADVISORY_PIPELINE_PAYLOAD',
  'PROGRAM5_COMPATIBLE_MAPPING',
  'ADVISORY_PREVIEW_PAYLOAD',
  'INTEGRATION_DIAGNOSTICS',
  'LIFECYCLE_ENGINE_REUSE',
  'DRAFT_PREPARATION_REUSE',
  'CANDIDATE_RESOLUTION_REUSE',
  'PUBLISH_READINESS_REUSE',
  'MONITORING_REVIEW_REUSE',
  'PIPELINE_HEALTH_REUSE',
]);

/**
 * End-to-end advisory flow: extract (optional) → map → Program 5 integrate.
 * @param {object} [input]
 */
function runAdvisoryPipelineIntegration(input = {}) {
  const src = input && typeof input === 'object' ? input : {};

  let extraction = src.extraction || null;
  if (!extraction && (src.body != null || src.content != null || src.html != null)) {
    extraction = extractRecruitment(src);
  }

  return integrateAdvisoryCandidateWithPipeline({
    ...src,
    extraction,
    candidate: src.candidate || (extraction && extraction.candidate),
    recruitment: src.recruitment || (extraction && extraction.recruitment),
    duplicate: src.duplicate || (extraction && extraction.duplicate),
  });
}

function getPipelineIntegrationFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getPipelineIntegrationFramework() {
  const mb1 = getGovernmentSourceRegistryFramework();
  const mb2 = getWebsiteChangeDetectionFramework();
  const mb3 = getRecruitmentExtractionFramework();

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
    packageMB3PrerequisiteComplete: true,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
    packageMB3Unchanged: true,
    packageMB4Complete: true,
    packageMB5Ready: true,
    packageMB5Activated: false,

    mb1Identity: { packageCode: mb1.packageCode },
    mb2Identity: { packageCode: mb2.packageCode },
    mb3Identity: {
      packageCode: mb3.packageCode,
      packageMB3Complete: mb3.packageMB3Complete,
      packageMB4Activated: mb3.packageMB4Activated,
    },

    safetyBoundaries: {
      publishingDenied: true,
      pageGenerationDenied: true,
      telegramDenied: true,
      schedulerDenied: true,
      cronDenied: true,
      workersDenied: true,
      databaseWritesDenied: true,
      redisDenied: true,
      expressRoutesDenied: true,
      reviewQueueRuntimeDenied: true,
      productionWiringDenied: true,
      runtimeActivationDenied: true,
      hardDeniedActions: [
        'DENIED_PUBLISHING',
        'DENIED_PAGE_GENERATION',
        'DENIED_TELEGRAM',
        'DENIED_SCHEDULER',
        'DENIED_WORKERS',
        'DENIED_DATABASE_WRITES',
        'DENIED_REDIS',
        'DENIED_EXPRESS_ROUTES',
        'DENIED_RUNTIME_ACTIVATION',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_MB4',
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
      pageGenerated: false,
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
      summaryIdentity: 'SUMMARY_PACKAGE_MB4',
      status: 'PIPELINE_INTEGRATION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver an advisory Pipeline Integration Framework that maps extracted recruitments into Program 5 without runtime activation.',
      nextPackage: 'MB-5',
      nextPackageName: 'Controlled Scheduler',
      canIntegratePipeline: true,
      canPublish: false,
      canNotifyOperators: false,
      runtimeBehaviorChanged: false,
    },

    recommendation:
      'MB4_COMPLETE_ADVISORY_PIPELINE_INTEGRATION_ONLY_READY_FOR_MB5_NO_PUBLISHING_NO_TELEGRAM_NO_SCHEDULER',
  });
}

function evaluatePipelineIntegrationFramework(input = {}) {
  const mb3Evaluation =
    input.mb3Evaluation ||
    evaluateRecruitmentExtractionFramework({
      sources: input.sources,
      sourceRegistry: input.sourceRegistry,
      monitoringConfigurations: input.monitoringConfigurations,
      monitoringConfiguration: input.monitoringConfiguration,
      parsers: input.parsers,
      parserRegistry: input.parserRegistry,
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
    manualInvocationOnly: true,

    mb3Evaluation,
    extensionPoints: EXTENSION_POINTS,
    capabilities: CAPABILITIES.slice(),

    effects: {
      published: false,
      pageGenerated: false,
      telegramSent: false,
      databaseWritten: false,
      redisUsed: false,
      schedulerStarted: false,
      workerStarted: false,
      routeActivated: false,
      runtimeActivated: false,
      reviewQueueCreated: false,
    },

    readyForMB5: true,
    mb5Activated: false,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
    packageMB3Unchanged: true,
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

  ADVISORY_PIPELINE_PAYLOAD_VERSION,
  PREVIEW_PAYLOAD_VERSION,
  INTEGRATION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  PIPELINE_INTEGRATOR_VERSION,
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,

  deepFreeze,
  mapToAdvisoryPipelinePayload,
  generateAdvisoryPreviewPayload,
  generateIntegrationDiagnostics,
  integrateAdvisoryCandidateWithPipeline,
  runAdvisoryPipelineIntegration,
  extractRecruitment,

  ControlledSchedulerExtension,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,

  evaluatePipelineIntegrationFramework,
  getPipelineIntegrationFramework,
  getPipelineIntegrationFrameworkIdentity,
};
