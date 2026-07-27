'use strict';

/**
 * GOVERNMENT MONITORING BOT — Combined Package
 * MB-5 Controlled Scheduler + TG-1 Telegram Notification + RW-1 Review Queue Wiring
 *
 * Completes the operational advisory workflow:
 *   Government Source → Controlled Scheduler → Website Change Detection
 *   → Recruitment Extraction → Program 5 Advisory Pipeline
 *   → Telegram Notification → Operator Review Queue → Draft Ready
 *
 * This package MUST remain controlled.
 * No automatic publishing. No automatic approval. No production deployment.
 *
 * Scheduler DISABLED by default.
 * No background execution unless explicitly invoked.
 * No cron installation. No OS services.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const {
  getGovernmentSourceRegistryFramework,
} = require('../packageMB1GovernmentSourceRegistryFramework');
const {
  getWebsiteChangeDetectionFramework,
} = require('../websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework');
const {
  getRecruitmentExtractionFramework,
} = require('../recruitmentExtraction/packageMB3RecruitmentExtractionFramework');
const {
  getPipelineIntegrationFramework,
  evaluatePipelineIntegrationFramework,
} = require('../pipelineIntegration/packageMB4PipelineIntegrationFramework');

const {
  CONTROLLED_SCHEDULER_VERSION,
  HEALTH_STATUSES,
  createControlledScheduler,
} = require('./controlledScheduler');
const {
  EXECUTION_COORDINATOR_VERSION,
  coordinateSourceExecution,
} = require('./executionCoordinator');
const {
  EXECUTION_RESULT_VERSION,
  createExecutionResult,
} = require('./executionResult');
const {
  LOCKING_VERSION,
  createSourceLockManager,
} = require('./locking');
const {
  RATE_LIMITER_VERSION,
  createRateLimiter,
} = require('./rateLimiter');
const {
  COOLDOWN_VERSION,
  createCooldownTracker,
} = require('./cooldown');
const {
  EXECUTION_HISTORY_VERSION,
  createExecutionHistory,
} = require('./executionHistory');
const {
  HEALTH_REPORTING_VERSION,
  generateSchedulerHealthReport,
} = require('./healthReporting');
const {
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,
  FinalHardeningExtension,
  ProductionReadinessExtension,
  ControlledDeploymentExtension,
  OperatorAuthorizationSafeDeploymentExtension,
} = require('./extensionPoints');

const tg1 = require('../telegramNotification/packageTG1TelegramNotificationFramework');
const rw1 = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');

const FRAMEWORK_VERSION = '1.0.0';
const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_MB5_CONTROLLED_SCHEDULER';
const PACKAGE_NAME = 'Controlled Scheduler';
const PACKAGE_CODE = 'MB-5';
const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';
const COMBINED_PACKAGE = 'MB-5 + TG-1 + RW-1';

const OBJECTIVE =
  'Complete the operational advisory workflow with a controlled scheduler, Telegram notification, and review queue wiring — without automatic publishing, approval, or production deployment.';

const OUT_OF_SCOPE = Object.freeze([
  'AUTOMATIC_PUBLISHING',
  'AUTOMATIC_APPROVAL',
  'PRODUCTION_DEPLOYMENT',
  'OS_CRON',
  'OS_SERVICES',
  'BACKGROUND_WORKERS',
  'AUTOMATIC_RETRIES',
  'EXPRESS_ROUTE_ACTIVATION',
  'GITHUB_DEPLOYMENT',
  'SQL_SCHEMA_REDESIGN',
  'REDIS',
  'RUNTIME_DEPLOYMENT',
]);

const PROHIBITED = Object.freeze([
  'PUBLISH_EXECUTION',
  'AUTOMATIC_APPROVAL',
  'CRON_INSTALLATION',
  'OS_SERVICE_INSTALLATION',
  'WORKER_ACTIVATION',
  'EXPRESS_ROUTES',
  'GITHUB_DEPLOYMENT',
  'VPS_DEPLOYMENT',
  'SQL_SCHEMA_CHANGES',
  'REDIS_DEPENDENCY',
  'AUTOMATIC_RETRIES',
]);

const CAPABILITIES = Object.freeze([
  'MANUAL_ENABLE_DISABLE',
  'SOURCE_SELECTION',
  'PER_SOURCE_INTERVAL',
  'CONCURRENCY_LIMITS',
  'LOCKING',
  'RATE_LIMITING',
  'COOLDOWN',
  'GRACEFUL_CANCELLATION',
  'EXECUTION_TIMEOUT',
  'ADVISORY_EXECUTION_HISTORY',
  'HEALTH_REPORTING',
  'EXECUTION_COORDINATOR',
  'IMMUTABLE_EXECUTION_RESULT',
  'TELEGRAM_NOTIFICATION_TG1',
  'REVIEW_QUEUE_WIRING_RW1',
]);

function getControlledSchedulerFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    combinedPackage: COMBINED_PACKAGE,
  });
}

function getControlledSchedulerFramework() {
  const mb1 = getGovernmentSourceRegistryFramework();
  const mb2 = getWebsiteChangeDetectionFramework();
  const mb3 = getRecruitmentExtractionFramework();
  const mb4 = getPipelineIntegrationFramework();
  const tg = tg1.getTelegramNotificationFramework();
  const rw = rw1.getReviewQueueWiringFramework();

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
    combinedPackage: COMBINED_PACKAGE,
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
    packageMB4PrerequisiteComplete: true,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
    packageMB3Unchanged: true,
    packageMB4Unchanged: true,
    packageMB5Complete: true,
    packageTG1Complete: true,
    packageRW1Complete: true,
    packageMB5Activated: true,
    schedulerDisabledByDefault: true,

    mb1Identity: { packageCode: mb1.packageCode },
    mb2Identity: { packageCode: mb2.packageCode },
    mb3Identity: { packageCode: mb3.packageCode },
    mb4Identity: {
      packageCode: mb4.packageCode,
      packageMB5Ready: mb4.packageMB5Ready,
      packageMB5Activated: mb4.packageMB5Activated,
    },
    tg1Identity: { packageCode: tg.packageCode },
    rw1Identity: { packageCode: rw.packageCode },

    safetyBoundaries: {
      publishingDenied: true,
      automaticApprovalDenied: true,
      schedulerDisabledByDefault: true,
      backgroundExecutionDenied: true,
      cronDenied: true,
      osServicesDenied: true,
      automaticRetriesDenied: true,
      workerActivationDenied: true,
      expressRoutesDenied: true,
      runtimeDeploymentDenied: true,
      githubDeploymentDenied: true,
      sqlSchemaRedesignDenied: true,
      redisDenied: true,
      databaseWritesDenied: true,
      productionCredentialsDenied: true,
      hardDeniedActions: [
        'DENIED_PUBLISHING',
        'DENIED_AUTOMATIC_APPROVAL',
        'DENIED_CRON',
        'DENIED_OS_SERVICES',
        'DENIED_AUTOMATIC_RETRIES',
        'DENIED_WORKERS',
        'DENIED_EXPRESS_ROUTES',
        'DENIED_REDIS',
        'DENIED_DATABASE_WRITES',
        'DENIED_PRODUCTION_DEPLOYMENT',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_MB5',
      schedulerEnabledByDefault: false,
      backgroundLoopStarted: false,
      cronInstalled: false,
      osServiceStarted: false,
      automaticRetriesEnabled: false,
      workerStarted: false,
      routesCreated: false,
      redisUsed: false,
      databaseWritten: false,
      telegramAutoSent: false,
      publishingExecuted: false,
      automaticApprovalExecuted: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
    },

    workflow: Object.freeze([
      'GOVERNMENT_SOURCE',
      'CONTROLLED_SCHEDULER',
      'WEBSITE_CHANGE_DETECTION',
      'RECRUITMENT_EXTRACTION',
      'PROGRAM_5_ADVISORY_PIPELINE',
      'TELEGRAM_NOTIFICATION',
      'OPERATOR_REVIEW_QUEUE',
      'DRAFT_READY',
    ]),

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_MB5_TG1_RW1',
      status: 'CONTROLLED_OPERATIONS_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver controlled operational advisory workflow ending at Draft Ready without publishing.',
      nextPackage: 'FT-1',
      nextPackageName: 'Final Hardening & Testing',
      canScheduleControlled: true,
      canNotifyOperators: true,
      canWireReviewQueue: true,
      canPublish: false,
      canAutoApprove: false,
      runtimeBehaviorChanged: false,
    },

    recommendation:
      'MB5_TG1_RW1_COMPLETE_CONTROLLED_ADVISORY_WORKFLOW_READY_FOR_FT1_NO_PUBLISHING_NO_AUTO_APPROVAL',
  });
}

function evaluateControlledSchedulerFramework(input = {}) {
  const mb4Evaluation =
    input.mb4Evaluation || evaluatePipelineIntegrationFramework(input);

  const scheduler = createControlledScheduler(input.schedulerOptions || {});

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    combinedPackage: COMBINED_PACKAGE,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    manualInvocationOnly: true,
    mb4Evaluation,
    extensionPoints: EXTENSION_POINTS,
    capabilities: CAPABILITIES.slice(),
    schedulerHealth: scheduler.getHealth(),
    tg1: tg1.evaluateTelegramNotificationFramework(input.telegram || {}),
    rw1: rw1.evaluateReviewQueueWiringFramework(input.review || {}),
    effects: {
      published: false,
      approved: false,
      cronInstalled: false,
      osServiceStarted: false,
      backgroundStarted: false,
      automaticRetries: false,
      workerStarted: false,
      routeActivated: false,
      redisUsed: false,
      databaseWritten: false,
      telegramAutoSent: false,
    },
    readyForFT1: true,
    packageMB1Unchanged: true,
    packageMB2Unchanged: true,
    packageMB3Unchanged: true,
    packageMB4Unchanged: true,
  });
}

/**
 * Run one controlled advisory cycle for a source (explicit invocation helper).
 * @param {object} [input]
 */
async function runControlledAdvisoryCycle(input = {}) {
  return coordinateSourceExecution(input);
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  STAGE_ID,
  COMBINED_PACKAGE,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,

  CONTROLLED_SCHEDULER_VERSION,
  EXECUTION_COORDINATOR_VERSION,
  EXECUTION_RESULT_VERSION,
  LOCKING_VERSION,
  RATE_LIMITER_VERSION,
  COOLDOWN_VERSION,
  EXECUTION_HISTORY_VERSION,
  HEALTH_REPORTING_VERSION,
  EXTENSION_POINTS_VERSION,
  EXTENSION_POINTS,
  HEALTH_STATUSES,

  deepFreeze,
  createControlledScheduler,
  coordinateSourceExecution,
  runControlledAdvisoryCycle,
  createExecutionResult,
  createSourceLockManager,
  createRateLimiter,
  createCooldownTracker,
  createExecutionHistory,
  generateSchedulerHealthReport,

  HardeningExtension,
  OperatorAnalyticsExtension,
  ConsolidationExtension,
  FinalHardeningExtension,
  ProductionReadinessExtension,
  ControlledDeploymentExtension,
  OperatorAuthorizationSafeDeploymentExtension,

  // TG-1 re-exports
  TEMPLATE_KINDS: tg1.TEMPLATE_KINDS,
  createNotificationPolicy: tg1.createNotificationPolicy,
  resolveNotificationDecision: tg1.resolveNotificationDecision,
  formatTelegramMessage: tg1.formatTelegramMessage,
  buildNotificationTemplatePayload: tg1.buildNotificationTemplatePayload,
  createNullTransport: tg1.createNullTransport,
  createMemoryTransport: tg1.createMemoryTransport,
  deliverTelegramNotification: tg1.deliverTelegramNotification,
  getTelegramNotificationFramework: tg1.getTelegramNotificationFramework,

  // RW-1 re-exports
  DIAGNOSTIC_CODES: rw1.DIAGNOSTIC_CODES,
  createOperatorReviewObject: rw1.createOperatorReviewObject,
  generateReviewDiagnostics: rw1.generateReviewDiagnostics,
  wireAdvisoryCandidateToReviewQueue: rw1.wireAdvisoryCandidateToReviewQueue,
  getReviewQueueWiringFramework: rw1.getReviewQueueWiringFramework,

  evaluateControlledSchedulerFramework,
  getControlledSchedulerFramework,
  getControlledSchedulerFrameworkIdentity,
};
