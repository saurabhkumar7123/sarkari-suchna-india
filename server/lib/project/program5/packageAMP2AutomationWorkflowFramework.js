'use strict';

/**
 * AUTOMATION MATURITY PROGRAM — Package AMP-2
 * Automation Workflow (Bot -> AI -> Draft -> Telegram Review)
 *
 * Complete advisory orchestration layer for future recruitment automation.
 * Production-ready but production-disabled.
 */

const { deepFreeze } = require('../recruitmentIntelligence/utils');
const {
  AUTOMATION_ORCHESTRATOR_VERSION,
  runAutomationWorkflow,
} = require('../automationWorkflow/automationWorkflowOrchestrator');
const {
  WORKFLOW_MODULES_VERSION,
  WORKFLOW_STATES,
  APPROVAL_STATES,
  FAILURE_ACTIONS,
  STATE_SEQUENCE,
  createWorkflowVersionRecord,
  createWorkflowStateMachine,
  createDraftDifference,
  buildDraftPackage,
  coordinateDraftGeneration,
  buildTelegramReviewMessage,
  buildApprovalWorkflowModel,
  buildReviewQueue,
  createAutomationAuditLog,
  collectWorkflowMetrics,
  evaluateFailureRecovery,
  createSafetyEnvelope,
  createWorkflowDiagram,
} = require('../automationWorkflow/workflowModules');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'AUTOMATION_MATURITY_PROGRAM';
const PACKAGE_ID = 'PACKAGE_AMP2_AUTOMATION_WORKFLOW';
const PACKAGE_NAME = 'Automation Workflow';
const PACKAGE_CODE = 'AMP-2';
const GAP_ADDRESSED = 'GAP_AMP2_AUTOMATION_WORKFLOW';

const OBJECTIVE =
  'Build the complete orchestration workflow that connects bot detection, AMP-1 intelligence, draft preparation, Telegram review preparation, manual approval modeling, auditability, metrics, and failure recovery without activating production automation.';

const OUT_OF_SCOPE = Object.freeze([
  'PRODUCTION_PUBLISHING',
  'AUTOMATIC_PUBLISHING',
  'SCHEDULER_ACTIVATION',
  'WORKER_ACTIVATION',
  'PRODUCTION_DEPLOYMENT',
  'PRODUCTION_ROUTE_CHANGES',
  'CRON_ACTIVATION',
  'LIVE_CRAWLING',
  'DATABASE_MIGRATION',
  'RUNTIME_WIRING',
]);

const PROHIBITED = Object.freeze([
  'RECRUITMENT_PIPELINE_ENABLED_TRUE',
  'PRODUCTION_AUTOMATION_ACTIVATION',
  'AUTOMATIC_REVIEW_QUEUE_PERSISTENCE',
  'AUTOMATIC_TELEGRAM_SEND',
  'PUBLISH_EXECUTION',
  'WORKER_STARTUP',
  'CRON_STARTUP',
]);

const CAPABILITIES = Object.freeze([
  'AUTOMATION_ORCHESTRATOR',
  'WORKFLOW_STATE_MACHINE',
  'DRAFT_GENERATION_COORDINATOR',
  'DRAFT_PACKAGE_BUILDER',
  'DRAFT_DIFFERENCE_ENGINE',
  'TELEGRAM_MESSAGE_BUILDER',
  'APPROVAL_WORKFLOW_MODEL',
  'REVIEW_QUEUE',
  'AUTOMATION_AUDIT_LOG',
  'WORKFLOW_METRICS',
  'FAILURE_RECOVERY',
  'WORKFLOW_VERSIONING',
  'RENDERER_COMPATIBILITY',
]);

const REUSED_MODULE_IDS = Object.freeze({
  AMP1_RECRUITMENT_BRAIN: 'PACKAGE_AMP1_RECRUITMENT_INTELLIGENCE_BRAIN',
  DRAFT_PREPARATION: 'PACKAGE_5D_DRAFT_PREPARATION_FRAMEWORK',
  TELEGRAM_NOTIFICATION: 'PACKAGE_TG1_TELEGRAM_NOTIFICATION',
  REVIEW_QUEUE_WIRING: 'PACKAGE_RW1_REVIEW_QUEUE_WIRING',
  PIPELINE_INTEGRATION: 'PACKAGE_MB4_PIPELINE_INTEGRATION',
});

function getAutomationWorkflowFramework() {
  return deepFreeze({
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    frameworkVersion: FRAMEWORK_VERSION,
    orchestratorVersion: AUTOMATION_ORCHESTRATOR_VERSION,
    workflowModulesVersion: WORKFLOW_MODULES_VERSION,
    gapAddressed: GAP_ADDRESSED,
    objective: OBJECTIVE,
    advisoryOnly: true,
    productionReady: true,
    productionEnabled: false,
    recruitmentPipelineEnabled: false,
    configurationDriven: true,
    deterministic: true,
    versioned: true,
    capabilities: CAPABILITIES,
    outOfScope: OUT_OF_SCOPE,
    prohibited: PROHIBITED,
    reusedModules: REUSED_MODULE_IDS,
    workflowStates: WORKFLOW_STATES,
    approvalStates: APPROVAL_STATES,
    failureActions: FAILURE_ACTIONS,
    stateSequence: STATE_SEQUENCE,
    safetyBoundaries: {
      pipelineActivationDenied: true,
      productionPublishingDenied: true,
      automaticPublishingDenied: true,
      schedulerActivationDenied: true,
      workerActivationDenied: true,
      deploymentDenied: true,
      routeChangesDenied: true,
      cronActivationDenied: true,
      liveCrawlingDenied: true,
      dbMigrationDenied: true,
      reviewQueuePersistenceDenied: true,
      telegramAutoSendDenied: true,
    },
    runtimeEffects: {
      pipelineEnabled: false,
      productionActivated: false,
      draftPersisted: false,
      published: false,
      telegramSent: false,
      reviewQueuePersisted: false,
      schedulerActivated: false,
      workerActivated: false,
      cronActivated: false,
      liveCrawlingActivated: false,
      databaseWritten: false,
      routeChanged: false,
    },
    safetyEnvelope: createSafetyEnvelope(),
    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_AMP2',
      status: 'AUTOMATION_WORKFLOW_COMPLETE',
      purpose:
        'Deliver a cohesive advisory automation workflow layer that makes AMP-3 admin integration plug-and-play while preserving full production safety.',
      nextIntegration: 'AMP-3',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      pipelineActivationAuthorized: false,
      publishingAuthorized: false,
    },
    recommendation: 'AUTOMATION_WORKFLOW_COMPLETE_ADVISORY_ONLY',
  });
}

function getAutomationWorkflowFrameworkIdentity() {
  const framework = getAutomationWorkflowFramework();
  return deepFreeze({
    programId: framework.programId,
    packageId: framework.packageId,
    packageCode: framework.packageCode,
    frameworkVersion: framework.frameworkVersion,
    advisoryOnly: framework.advisoryOnly,
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  GAP_ADDRESSED,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  REUSED_MODULE_IDS,
  WORKFLOW_STATES,
  APPROVAL_STATES,
  FAILURE_ACTIONS,
  STATE_SEQUENCE,
  AUTOMATION_ORCHESTRATOR_VERSION,
  WORKFLOW_MODULES_VERSION,
  runAutomationWorkflow,
  createWorkflowVersionRecord,
  createWorkflowStateMachine,
  createDraftDifference,
  buildDraftPackage,
  coordinateDraftGeneration,
  buildTelegramReviewMessage,
  buildApprovalWorkflowModel,
  buildReviewQueue,
  createAutomationAuditLog,
  collectWorkflowMetrics,
  evaluateFailureRecovery,
  createSafetyEnvelope,
  createWorkflowDiagram,
  getAutomationWorkflowFramework,
  getAutomationWorkflowFrameworkIdentity,
};
