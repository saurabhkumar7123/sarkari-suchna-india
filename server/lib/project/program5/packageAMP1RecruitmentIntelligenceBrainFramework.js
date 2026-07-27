'use strict';

/**
 * AUTOMATION MATURITY PROGRAM — Package AMP-1
 * AI Recruitment Brain & Recruitment Intelligence Engine
 *
 * Complete advisory Recruitment Intelligence Brain.
 * Builds structured Recruitment Objects — never HTML/CSS/pages.
 *
 * This package must NOT activate production automation.
 * RECRUITMENT_PIPELINE_ENABLED must remain FALSE.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 5 module identities:
 *   Draft Preparation, Controlled Lifecycle Engine,
 *   Monitoring Review Integration, Recruitment Operations.
 */

const { deepFreeze } = require('../recruitmentIntelligence/utils');
const { RECRUITMENT_OBJECT_SCHEMA_VERSION } = require('../recruitmentIntelligence/recruitmentObjectModel');
const { LIFECYCLE_INTELLIGENCE_VERSION } = require('../recruitmentIntelligence/lifecycleIntelligence');
const { HISTORY_RECOVERY_VERSION } = require('../recruitmentIntelligence/historyRecoveryEngine');
const { ORCHESTRATOR_VERSION, processRecruitmentIntelligence } = require('../recruitmentIntelligence/recruitmentBrainOrchestrator');
const { matchRecruitment, MATCH_DECISION } = require('../recruitmentIntelligence/recruitmentMatchingEngine');
const { recoverRecruitmentHistory } = require('../recruitmentIntelligence/historyRecoveryEngine');
const { buildTimeline } = require('../recruitmentIntelligence/timelineBuilder');
const { decideUpdateAction, UPDATE_DECISION } = require('../recruitmentIntelligence/updateIntelligenceEngine');
const { detectDuplicates } = require('../recruitmentIntelligence/duplicateDetectionEngine');
const { computeConfidence } = require('../recruitmentIntelligence/confidenceEngine');
const { detectMissingInformation } = require('../recruitmentIntelligence/missingInformationEngine');
const { validateRecruitment } = require('../recruitmentIntelligence/validationEngine');
const { evaluateDraftReadiness } = require('../recruitmentIntelligence/draftReadinessEngine');
const { decidePageAction, PAGE_DECISION } = require('../recruitmentIntelligence/pageDecisionEngine');
const {
  mapToRendererSections,
  buildGeneratorPayload,
  buildGeneratorDataField,
  CANONICAL_SECTIONS,
} = require('../recruitmentIntelligence/rendererCompatibility');
const {
  classifyStageFromNotification,
  detectStageContext,
  listAllStages,
} = require('../recruitmentIntelligence/lifecycleIntelligence');
const {
  createEmptyRecruitmentObject,
  deriveRecruitmentId,
  REVIEW_FLAG_CODES,
  RECRUITMENT_STATUS,
} = require('../recruitmentIntelligence/recruitmentObjectModel');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'AUTOMATION_MATURITY_PROGRAM';
const PACKAGE_ID = 'PACKAGE_AMP1_RECRUITMENT_INTELLIGENCE_BRAIN';
const PACKAGE_NAME = 'AI Recruitment Brain & Recruitment Intelligence Engine';
const PACKAGE_CODE = 'AMP-1';

const GAP_ADDRESSED = 'GAP_AMP1_RECRUITMENT_INTELLIGENCE_BRAIN';

const OBJECTIVE =
  'Build the complete Recruitment Intelligence Brain that understands entire recruitment lifecycles, produces structured Recruitment Objects, and prepares future automation — without activating production.';

const OUT_OF_SCOPE = Object.freeze([
  'PRODUCTION_AUTOMATION',
  'PAGE_PUBLISHING',
  'AUTOMATIC_PAGE_PUBLISHING',
  'SCHEDULER_ACTIVATION',
  'WORKER_ACTIVATION',
  'PRODUCTION_TRAFFIC_CHANGES',
  'DATABASE_MIGRATION',
  'RUNTIME_WIRING',
  'HTML_GENERATION',
  'CSS_GENERATION',
  'PAGE_TEMPLATE_GENERATION',
]);

const PROHIBITED = Object.freeze([
  'RECRUITMENT_PIPELINE_ENABLED_TRUE',
  'AUTOMATIC_PERSISTENCE',
  'PRODUCTION_PUBLISHING',
  'DEPLOYMENT_CHANGES',
  'API_BEHAVIOR_CHANGE',
  'SQL_SCHEMA_REDESIGN',
]);

const CAPABILITIES = Object.freeze([
  'RECRUITMENT_BRAIN',
  'LIFECYCLE_INTELLIGENCE',
  'RECRUITMENT_MATCHING',
  'HISTORY_RECOVERY',
  'CURRENT_STAGE_DETECTION',
  'TIMELINE_BUILDER',
  'UPDATE_INTELLIGENCE',
  'DUPLICATE_DETECTION',
  'CONFIDENCE_ENGINE',
  'DRAFT_READINESS',
  'MISSING_INFORMATION_ENGINE',
  'VALIDATION_ENGINE',
  'PAGE_DECISION_ENGINE',
  'STRUCTURED_OUTPUT',
  'RENDERER_COMPATIBILITY',
]);

const REUSED_MODULE_IDS = Object.freeze({
  DRAFT_PREPARATION: 'PACKAGE_5D_DRAFT_PREPARATION',
  CONTROLLED_LIFECYCLE: 'PACKAGE_5C_CONTROLLED_LIFECYCLE_ENGINE',
  MONITORING_REVIEW: 'PACKAGE_5B_MONITORING_REVIEW_INTEGRATION',
  RECRUITMENT_OPERATIONS: 'RECRUITMENT_OPERATIONS',
  GENERATOR: 'GENERATOR',
});

function getRecruitmentIntelligenceBrainFramework() {
  return deepFreeze({
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    frameworkVersion: FRAMEWORK_VERSION,
    schemaVersion: RECRUITMENT_OBJECT_SCHEMA_VERSION,
    orchestratorVersion: ORCHESTRATOR_VERSION,
    lifecycleVersion: LIFECYCLE_INTELLIGENCE_VERSION,
    historyRecoveryVersion: HISTORY_RECOVERY_VERSION,
    gapAddressed: GAP_ADDRESSED,
    objective: OBJECTIVE,
    advisoryOnly: true,
    program5AutomationAuthorized: false,
    recruitmentPipelineEnabled: false,

    capabilities: CAPABILITIES,
    outOfScope: OUT_OF_SCOPE,
    prohibited: PROHIBITED,
    reusedModules: REUSED_MODULE_IDS,

    safetyBoundaries: {
      routeCreationDenied: true,
      productionWiringDenied: true,
      pipelineActivationDenied: true,
      publishingDenied: true,
      schedulerActivationDenied: true,
      workerActivationDenied: true,
      htmlGenerationDenied: true,
      dbMigrationDenied: true,
      automaticPersistenceDenied: true,
    },

    runtimeEffects: {
      routesCreated: false,
      pipelineEnabled: false,
      productionBehaviorChanged: false,
      pagePublished: false,
      draftCreated: false,
      schedulerActivated: false,
      workerActivated: false,
      productionImpact: false,
      featureActivated: false,
      automaticProcessingEnabled: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_AMP1',
      status: 'RECRUITMENT_INTELLIGENCE_BRAIN_COMPLETE',
      purpose:
        'Deliver a complete advisory Recruitment Intelligence Brain that produces structured Recruitment Objects for future automation consumption.',
      nextIntegration: 'AMP-2',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      pipelineActivationAuthorized: false,
    },

    recommendation: 'RECRUITMENT_INTELLIGENCE_BRAIN_COMPLETE_ADVISORY_ONLY',
  });
}

function getRecruitmentIntelligenceBrainFrameworkIdentity() {
  const fw = getRecruitmentIntelligenceBrainFramework();
  return deepFreeze({
    programId: fw.programId,
    packageId: fw.packageId,
    packageCode: fw.packageCode,
    frameworkVersion: fw.frameworkVersion,
    advisoryOnly: fw.advisoryOnly,
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
  RECRUITMENT_OBJECT_SCHEMA_VERSION,
  REVIEW_FLAG_CODES,
  RECRUITMENT_STATUS,
  MATCH_DECISION,
  UPDATE_DECISION,
  PAGE_DECISION,
  CANONICAL_SECTIONS,
  deepFreeze,
  processRecruitmentIntelligence,
  createEmptyRecruitmentObject,
  deriveRecruitmentId,
  classifyStageFromNotification,
  detectStageContext,
  listAllStages,
  matchRecruitment,
  recoverRecruitmentHistory,
  buildTimeline,
  decideUpdateAction,
  detectDuplicates,
  computeConfidence,
  detectMissingInformation,
  validateRecruitment,
  evaluateDraftReadiness,
  decidePageAction,
  mapToRendererSections,
  buildGeneratorPayload,
  buildGeneratorDataField,
  getRecruitmentIntelligenceBrainFramework,
  getRecruitmentIntelligenceBrainFrameworkIdentity,
};
