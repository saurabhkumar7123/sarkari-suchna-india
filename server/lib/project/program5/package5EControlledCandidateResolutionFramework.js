'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Controlled Candidate Resolution & Deduplication Framework
 *
 * Identifies potentially related recruitment candidates and provides
 * advisory merge recommendations.
 *
 * This package must never merge, delete, overwrite, or modify
 * production data automatically.
 *
 * Everything remains operator-controlled.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 4 / 5A–5D module identities:
 *   Monitoring Review Integration, Controlled Lifecycle Engine,
 *   Draft Preparation, Recruitment Operations, Editorial Review,
 *   Shared Preview, Pipeline Health.
 */

const {
  CANDIDATE_IDENTITY_CONTRACT_VERSION,
  REUSED_MODULE_IDS,
  DEFAULT_IDENTITY_FIELD_CATALOG,
  deepFreeze,
  createCandidateIdentityContract,
  getDefaultCandidateIdentityContract,
  createCandidateIdentityModel,
} = require('./candidateIdentityContract');

const {
  IDENTITY_FINGERPRINT_ENGINE_VERSION,
  FINGERPRINT_CLASSES,
  DEFAULT_FINGERPRINT_FIELD_CONFIG,
  DEFAULT_FINGERPRINT_THRESHOLDS,
  generateIdentityFingerprint,
  compareIdentityFingerprints,
} = require('./identityFingerprintEngine');

const {
  DUPLICATE_DETECTION_VERSION,
  DUPLICATE_RELATION_TYPES,
  DIAGNOSTIC_SEVERITY,
  detectCandidateDuplicates,
} = require('./duplicateDetectionEngine');

const {
  CANDIDATE_RESOLUTION_ENGINE_VERSION,
  resolveRelatedCandidates,
} = require('./candidateResolutionEngine');

const {
  MERGE_RECOMMENDATION_VERSION,
  MERGE_RECOMMENDATIONS,
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  generateMergeRecommendations,
} = require('./mergeRecommendationEngine');

const {
  RESOLUTION_PREVIEW_MODEL_VERSION,
  SHARED_PREVIEW_REUSE,
  buildResolutionPreviewModel,
} = require('./resolutionPreviewModel');

const {
  RESOLUTION_REPORT_VERSION,
  generateResolutionReport,
} = require('./resolutionReport');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING';
const PACKAGE_ID = 'PACKAGE_5E_CONTROLLED_CANDIDATE_RESOLUTION';
const PACKAGE_NAME = 'Controlled Candidate Resolution & Deduplication Framework';
const PACKAGE_CODE = '5E';

const GAP_ADDRESSED = 'GAP_FC_DEDUPE_GROUPING';

const OBJECTIVE =
  'Create a controlled Candidate Resolution & Deduplication Framework that identifies potentially related recruitment candidates and provides advisory merge recommendations — never merging production data automatically.';

const OUT_OF_SCOPE = Object.freeze([
  'AUTOMATIC_MERGE',
  'AUTOMATIC_DELETION',
  'AUTOMATIC_OVERWRITE',
  'DATABASE_WRITES',
  'SCHEDULERS',
  'WORKERS',
  'REDIS',
  'POLLING',
  'PUBLISHING',
  'RUNTIME_ACTIVATION',
  'AI_MATCHING',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'GITHUB',
  'VPS',
  'SQL_SCHEMA_REDESIGN',
  'RUNTIME_WIRING',
  'PRODUCTION_MODIFICATIONS',
  'AUTOMATIC_CANDIDATE_RESOLUTION',
]);

const CAPABILITIES = Object.freeze([
  'CANDIDATE_IDENTITY_CONTRACT',
  'IDENTITY_FINGERPRINT_ENGINE',
  'DUPLICATE_DETECTION',
  'CANDIDATE_RESOLUTION_ENGINE',
  'MERGE_RECOMMENDATION',
  'RESOLUTION_PREVIEW',
  'RESOLUTION_REPORT',
]);

/**
 * Run the full advisory Candidate Resolution & Deduplication pipeline.
 * Pure / deterministic. No side effects. No production merges.
 *
 * @param {object} [input]
 * @param {object[]} [input.candidates]
 * @param {object} [input.fingerprintOptions]
 * @param {object} [input.recommendationThresholds]
 * @param {object} [input.sharedPreviewSnapshot]
 * @param {string} [input.generatedTimestamp]
 */
function resolveControlledCandidates(input = {}) {
  const detection = detectCandidateDuplicates({
    candidates: input.candidates || [],
    fingerprintOptions: input.fingerprintOptions,
  });

  const resolution = resolveRelatedCandidates({
    detection,
    fingerprintOptions: input.fingerprintOptions,
  });

  const mergeRecommendations = generateMergeRecommendations({
    resolution,
    thresholds: input.recommendationThresholds,
  });

  const preview = buildResolutionPreviewModel({
    resolution,
    mergeRecommendations,
    detection,
    sharedPreviewSnapshot: input.sharedPreviewSnapshot,
    generatedAt: input.generatedTimestamp || '1970-01-01T00:00:00.000Z',
  });

  const report = generateResolutionReport({
    detection,
    resolution,
    mergeRecommendations,
    preview,
  });

  return deepFreeze({
    advisoryOnly: true,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    configurationDriven: true,
    detection,
    resolution,
    mergeRecommendations,
    preview,
    report,
    effects: {
      candidatesMerged: false,
      candidatesDeleted: false,
      candidatesOverwritten: false,
      productionDataModified: false,
      databaseWritten: false,
      automaticResolutionExecuted: false,
      schedulerStarted: false,
      workerStarted: false,
      redisUsed: false,
      pollingEnabled: false,
      publishingExecuted: false,
      runtimeAutomationActivated: false,
      aiMatchingUsed: false,
      externalApiCalled: false,
    },
  });
}

function getControlledCandidateResolutionFrameworkIdentity() {
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

function getControlledCandidateResolutionFramework() {
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
    package5BComplete: true,
    package5CComplete: true,
    package5DComplete: true,
    package5FReady: true,

    advisoryOnlyFlags: {
      advisoryOnly: true,
      identifiesRelatedCandidatesOnly: true,
      providesAdvisoryMergeRecommendations: true,
      mergesCandidatesAutomatically: false,
      deletesCandidatesAutomatically: false,
      overwritesProductionData: false,
      activatesRuntimeAutomation: false,
      aiMatching: false,
      executionEngine: false,
    },

    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),

    contractVersion: CANDIDATE_IDENTITY_CONTRACT_VERSION,
    fingerprintEngineVersion: IDENTITY_FINGERPRINT_ENGINE_VERSION,
    duplicateDetectionVersion: DUPLICATE_DETECTION_VERSION,
    resolutionEngineVersion: CANDIDATE_RESOLUTION_ENGINE_VERSION,
    mergeRecommendationVersion: MERGE_RECOMMENDATION_VERSION,
    previewModelVersion: RESOLUTION_PREVIEW_MODEL_VERSION,
    reportVersion: RESOLUTION_REPORT_VERSION,

    fingerprintClasses: Object.values(FINGERPRINT_CLASSES),
    duplicateRelationTypes: Object.values(DUPLICATE_RELATION_TYPES),
    mergeRecommendations: Object.values(MERGE_RECOMMENDATIONS),
    diagnosticSeverities: Object.values(DIAGNOSTIC_SEVERITY),
    reusedModules: REUSED_MODULE_IDS,
    defaultIdentityFieldCatalog: DEFAULT_IDENTITY_FIELD_CATALOG,
    defaultFingerprintFieldConfig: DEFAULT_FINGERPRINT_FIELD_CONFIG,
    defaultFingerprintThresholds: DEFAULT_FINGERPRINT_THRESHOLDS,
    defaultRecommendationThresholds: DEFAULT_RECOMMENDATION_THRESHOLDS,
    sharedPreviewReuse: SHARED_PREVIEW_REUSE,

    safetyBoundaries: {
      boundariesIdentity:
        'SAFETY_PACKAGE_5E_CONTROLLED_CANDIDATE_RESOLUTION',
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
      automaticMergeDenied: true,
      automaticDeletionDenied: true,
      automaticOverwriteDenied: true,
      automaticCandidateResolutionDenied: true,
      aiMatchingDenied: true,
      runtimeActivationDenied: true,
      githubDenied: true,
      deploymentDenied: true,
      vpsDenied: true,
      productionChangesDenied: true,
      hardDeniedActions: [
        'DENIED_RUNTIME_WIRING',
        'DENIED_FEATURE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_DATABASE_WRITES',
        'DENIED_AUTOMATIC_MERGE',
        'DENIED_AUTOMATIC_DELETION',
        'DENIED_AUTOMATIC_OVERWRITE',
        'DENIED_AUTOMATIC_CANDIDATE_RESOLUTION',
        'DENIED_PUBLISHING',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_POLLING',
        'DENIED_AI_MATCHING',
        'DENIED_RUNTIME_ACTIVATION',
        'DENIED_GITHUB',
        'DENIED_DEPLOYMENT',
        'DENIED_VPS',
        'DENIED_PRODUCTION_CHANGES',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_5E',
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
      candidatesMerged: false,
      candidatesDeleted: false,
      candidatesOverwritten: false,
      automaticResolutionExecuted: false,
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
      summaryIdentity: 'SUMMARY_PACKAGE_5E',
      status: 'CANDIDATE_RESOLUTION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete advisory Candidate Resolution & Deduplication Framework so operators can inspect duplicate candidates, identity relationships, and merge recommendations without automatic merges.',
      nextPackage: '5F',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      automaticMergeAuthorized: false,
      automaticCandidateResolutionAuthorized: false,
    },

    recommendation:
      'CANDIDATE_RESOLUTION_FRAMEWORK_COMPLETE_ADVISORY_ONLY_READY_FOR_PACKAGE_5F',
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
  CANDIDATE_IDENTITY_CONTRACT_VERSION,
  REUSED_MODULE_IDS,
  DEFAULT_IDENTITY_FIELD_CATALOG,
  IDENTITY_FINGERPRINT_ENGINE_VERSION,
  FINGERPRINT_CLASSES,
  DEFAULT_FINGERPRINT_FIELD_CONFIG,
  DEFAULT_FINGERPRINT_THRESHOLDS,
  DUPLICATE_DETECTION_VERSION,
  DUPLICATE_RELATION_TYPES,
  DIAGNOSTIC_SEVERITY,
  CANDIDATE_RESOLUTION_ENGINE_VERSION,
  MERGE_RECOMMENDATION_VERSION,
  MERGE_RECOMMENDATIONS,
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  RESOLUTION_PREVIEW_MODEL_VERSION,
  SHARED_PREVIEW_REUSE,
  RESOLUTION_REPORT_VERSION,
  deepFreeze,
  createCandidateIdentityContract,
  getDefaultCandidateIdentityContract,
  createCandidateIdentityModel,
  generateIdentityFingerprint,
  compareIdentityFingerprints,
  detectCandidateDuplicates,
  resolveRelatedCandidates,
  generateMergeRecommendations,
  buildResolutionPreviewModel,
  generateResolutionReport,
  resolveControlledCandidates,
  getControlledCandidateResolutionFramework,
  getControlledCandidateResolutionFrameworkIdentity,
};
