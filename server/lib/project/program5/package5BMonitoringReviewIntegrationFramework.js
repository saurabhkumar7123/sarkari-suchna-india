'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Monitoring → Review Integration Framework
 *
 * Controlled integration framework that safely connects future monitoring
 * results to the existing Human Review workflow.
 *
 * Architecture only. Does NOT execute monitoring.
 * Does NOT create runtime automation.
 * Does NOT publish content.
 * Does NOT insert into production queues.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 4 / 5A module identities:
 *   Editorial Review, Shared Preview, Pipeline Health,
 *   Recruitment Operations, SEO Diagnostics.
 */

const {
  MONITORING_CANDIDATE_CONTRACT_VERSION,
  MONITORING_CANDIDATE_SCHEMA_VERSION,
  VALIDATION_STATUS,
  RECRUITMENT_TYPES,
  REQUIRED_CANDIDATE_FIELDS,
  createMonitoringCandidate,
  validateMonitoringCandidateContract,
  deepFreeze,
} = require('./monitoringCandidateContract');

const {
  CANDIDATE_NORMALIZATION_VERSION,
  normalizeTitle,
  normalizeDepartment,
  normalizeQualification,
  normalizeState,
  normalizeRecruitmentCategory,
  normalizeImportantDates,
  normalizeMonitoringCandidate,
} = require('./candidateNormalization');

const {
  CANDIDATE_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  validateMonitoringCandidate,
} = require('./candidateValidation');

const {
  CONFIDENCE_MAPPING_VERSION,
  CONFIDENCE_BANDS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  mapConfidenceBand,
  createConfidenceMapper,
} = require('./confidenceMapping');

const {
  REVIEW_QUEUE_ADAPTER_VERSION,
  EDITORIAL_WORKFLOW_STATES,
  REUSED_MODULE_IDS,
  adaptCandidateToReviewPayload,
} = require('./reviewQueueAdapter');

const {
  INTEGRATION_DIAGNOSTICS_VERSION,
  PREREQUISITES,
  buildIntegrationDiagnostics,
} = require('./integrationDiagnostics');

const {
  PREVIEW_SIMULATION_VERSION,
  simulateReviewPayloadPreview,
} = require('./previewSimulation');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING';
const PACKAGE_ID = 'PACKAGE_5B_MONITORING_REVIEW_INTEGRATION';
const PACKAGE_NAME = 'Monitoring → Review Integration Framework';
const PACKAGE_CODE = '5B';

const GAP_ADDRESSED = 'GAP_FC_MONITORING_REVIEW_INTEGRATION';

const OBJECTIVE =
  'Create a controlled integration framework that safely connects future monitoring results to the existing Human Review workflow.';

const OUT_OF_SCOPE = Object.freeze([
  'MONITORING_JOBS',
  'POLLING',
  'SCHEDULERS',
  'WORKERS',
  'REDIS',
  'PUBLISHING',
  'AUTOMATIC_DRAFT_CREATION',
  'AUTOMATIC_REVIEW_CREATION',
  'AUTOMATIC_APPROVAL',
  'AI_CLASSIFICATION',
  'RUNTIME_EXECUTION',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'GITHUB',
  'VPS',
  'SQL_SCHEMA_REDESIGN',
  'RUNTIME_WIRING',
  'FEATURE_ACTIVATION',
  'PRODUCTION_QUEUE_INSERTION',
]);

const CAPABILITIES = Object.freeze([
  'MONITORING_CANDIDATE_CONTRACT',
  'CANDIDATE_NORMALIZATION',
  'CANDIDATE_VALIDATION',
  'REVIEW_QUEUE_ADAPTER',
  'CONFIDENCE_MAPPING',
  'INTEGRATION_DIAGNOSTICS',
  'PREVIEW_SIMULATION',
]);

/**
 * Run the full advisory Monitoring → Review integration pipeline.
 * Pure / deterministic. No side effects.
 *
 * @param {object} [input]
 * @param {object} [input.candidate] raw or contract candidate
 * @param {object} [input.normalizationConfig]
 * @param {object} [input.confidenceThresholds]
 * @param {object} [input.validationOptions]
 * @param {object} [input.adapterOptions]
 * @param {object} [input.previewOptions]
 * @param {string[]} [input.availablePrerequisites]
 */
function integrateMonitoringCandidateToReview(input = {}) {
  const normalization = normalizeMonitoringCandidate(
    input.candidate || {},
    input.normalizationConfig || {}
  );
  const candidate = normalization.candidate;

  const validation = validateMonitoringCandidate(
    candidate,
    input.validationOptions || {}
  );

  const adapter = adaptCandidateToReviewPayload(candidate, {
    ...(input.adapterOptions || {}),
    validation,
    normalization,
    confidenceThresholds: input.confidenceThresholds || {},
  });

  const preview = simulateReviewPayloadPreview({
    adapter,
    candidate,
    validation,
    ...(input.previewOptions || {}),
  });

  const diagnostics = buildIntegrationDiagnostics({
    normalization,
    validation,
    adapter,
    confidence: adapter.confidence,
    preview,
    availablePrerequisites: input.availablePrerequisites,
  });

  return deepFreeze({
    advisoryOnly: true,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    candidate,
    contract: validateMonitoringCandidateContract(candidate),
    normalization,
    validation,
    adapter,
    confidence: adapter.confidence,
    preview,
    diagnostics,
    effects: {
      monitoringExecuted: false,
      runtimeAutomationCreated: false,
      contentPublished: false,
      productionQueueInserted: false,
      persisted: false,
    },
  });
}

function getMonitoringReviewIntegrationFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    advisoryOnly: true,
  });
}

function getMonitoringReviewIntegrationFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    productionSafe: true,
    program5PackageStarted: true,
    program5AutomationAuthorized: false,
    package5AComplete: true,
    package5CReady: true,

    advisoryOnlyFlags: {
      advisoryOnly: true,
      executesMonitoringJobs: false,
      createsRuntimeAutomation: false,
      publishesContent: false,
      insertsProductionQueues: false,
      automaticApproval: false,
      aiClassification: false,
      executionEngine: false,
    },

    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),

    contractVersion: MONITORING_CANDIDATE_CONTRACT_VERSION,
    schemaVersion: MONITORING_CANDIDATE_SCHEMA_VERSION,
    normalizationVersion: CANDIDATE_NORMALIZATION_VERSION,
    validationVersion: CANDIDATE_VALIDATION_VERSION,
    confidenceMappingVersion: CONFIDENCE_MAPPING_VERSION,
    adapterVersion: REVIEW_QUEUE_ADAPTER_VERSION,
    diagnosticsVersion: INTEGRATION_DIAGNOSTICS_VERSION,
    previewSimulationVersion: PREVIEW_SIMULATION_VERSION,

    confidenceBands: Object.values(CONFIDENCE_BANDS),
    defaultConfidenceThresholds: DEFAULT_CONFIDENCE_THRESHOLDS,
    validationStatuses: Object.values(VALIDATION_STATUS),
    recruitmentTypes: Object.values(RECRUITMENT_TYPES),
    requiredCandidateFields: REQUIRED_CANDIDATE_FIELDS.slice(),
    editorialWorkflowStates: EDITORIAL_WORKFLOW_STATES,
    reusedModules: REUSED_MODULE_IDS,
    prerequisites: PREREQUISITES.slice(),

    safetyBoundaries: {
      boundariesIdentity: 'SAFETY_PACKAGE_5B_MONITORING_REVIEW_INTEGRATION',
      advisoryOnly: true,
      runtimeIntegrationDenied: true,
      featureActivationDenied: true,
      sqlSchemaRedesignDenied: true,
      databaseChangesDenied: true,
      apiCreationDenied: true,
      routeCreationDenied: true,
      schedulerDenied: true,
      workerDenied: true,
      redisDenied: true,
      pollingDenied: true,
      publishingDenied: true,
      autoApprovalDenied: true,
      aiClassificationDenied: true,
      githubDenied: true,
      deploymentDenied: true,
      vpsDenied: true,
      productionChangesDenied: true,
      monitoringExecutionDenied: true,
      productionQueueInsertionDenied: true,
      automaticReviewCreationDenied: true,
      automaticDraftCreationDenied: true,
      hardDeniedActions: [
        'DENIED_RUNTIME_WIRING',
        'DENIED_FEATURE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_MONITORING_EXECUTION',
        'DENIED_POLLING',
        'DENIED_PUBLISHING',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_AUTO_APPROVAL',
        'DENIED_AI_CLASSIFICATION',
        'DENIED_PRODUCTION_QUEUE_INSERTION',
        'DENIED_AUTOMATIC_REVIEW_CREATION',
        'DENIED_AUTOMATIC_DRAFT_CREATION',
        'DENIED_GITHUB',
        'DENIED_DEPLOYMENT',
        'DENIED_VPS',
        'DENIED_PRODUCTION_CHANGES',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_5B',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      pollingEnabled: false,
      publishingExecuted: false,
      monitoringJobsExecuted: false,
      productionQueueInserted: false,
      filesystemWritten: false,
      networkAccessed: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
      automaticProcessingEnabled: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_5B',
      status: 'MONITORING_REVIEW_INTEGRATION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete advisory Monitoring → Review Integration framework for safe candidate-to-review payload transformation.',
      nextPackage: '5C',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      monitoringExecutionAuthorized: false,
      productionQueueInsertionAuthorized: false,
    },

    recommendation:
      'MONITORING_REVIEW_INTEGRATION_FRAMEWORK_COMPLETE_ADVISORY_ONLY_READY_FOR_PACKAGE_5C',
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
  MONITORING_CANDIDATE_CONTRACT_VERSION,
  MONITORING_CANDIDATE_SCHEMA_VERSION,
  VALIDATION_STATUS,
  RECRUITMENT_TYPES,
  REQUIRED_CANDIDATE_FIELDS,
  CANDIDATE_NORMALIZATION_VERSION,
  CANDIDATE_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  CONFIDENCE_MAPPING_VERSION,
  CONFIDENCE_BANDS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  REVIEW_QUEUE_ADAPTER_VERSION,
  EDITORIAL_WORKFLOW_STATES,
  REUSED_MODULE_IDS,
  INTEGRATION_DIAGNOSTICS_VERSION,
  PREREQUISITES,
  PREVIEW_SIMULATION_VERSION,
  createMonitoringCandidate,
  validateMonitoringCandidateContract,
  normalizeTitle,
  normalizeDepartment,
  normalizeQualification,
  normalizeState,
  normalizeRecruitmentCategory,
  normalizeImportantDates,
  normalizeMonitoringCandidate,
  validateMonitoringCandidate,
  mapConfidenceBand,
  createConfidenceMapper,
  adaptCandidateToReviewPayload,
  buildIntegrationDiagnostics,
  simulateReviewPayloadPreview,
  integrateMonitoringCandidateToReview,
  getMonitoringReviewIntegrationFramework,
  getMonitoringReviewIntegrationFrameworkIdentity,
  deepFreeze,
};
