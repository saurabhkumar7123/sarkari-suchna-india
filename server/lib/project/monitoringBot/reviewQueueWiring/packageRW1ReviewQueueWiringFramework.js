'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package RW-1
 * Review Queue Wiring Framework
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  OPERATOR_REVIEW_OBJECT_VERSION,
  createOperatorReviewObject,
} = require('./operatorReviewObject');
const {
  REVIEW_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_CODES,
  generateReviewDiagnostics,
} = require('./reviewDiagnostics');
const {
  REVIEW_QUEUE_WIRING_VERSION,
  wireAdvisoryCandidateToReviewQueue,
} = require('./reviewQueueWiring');

const FRAMEWORK_VERSION = '1.0.0';
const PROGRAM_ID = 'GOVERNMENT_MONITORING_BOT';
const PACKAGE_ID = 'PACKAGE_RW1_REVIEW_QUEUE_WIRING';
const PACKAGE_NAME = 'Review Queue Wiring';
const PACKAGE_CODE = 'RW-1';
const STAGE_ID = 'STAGE_1_GOVERNMENT_MONITORING_BOT';

const OBJECTIVE =
  'Integrate advisory candidates into the existing Program 5 review workflow without database writes, automatic approval, or publishing.';

const OUT_OF_SCOPE = Object.freeze([
  'DATABASE_WRITES',
  'AUTOMATIC_APPROVAL',
  'PUBLISHING',
  'REDIS',
  'EXPRESS_ROUTES',
  'SQL_SCHEMA_REDESIGN',
  'PRODUCTION_QUEUE_INSERT',
]);

const PROHIBITED = Object.freeze([
  'PUBLISH_EXECUTION',
  'AUTOMATIC_APPROVAL',
  'DATABASE_PERSISTENCE',
  'GITHUB_DEPLOYMENT',
  'VPS_DEPLOYMENT',
]);

const CAPABILITIES = Object.freeze([
  'OPERATOR_REVIEW_OBJECT',
  'REVIEW_DIAGNOSTICS',
  'ADVISORY_REVIEW_PAYLOAD',
  'SHARED_PREVIEW_REUSE',
  'LIFECYCLE_REUSE',
  'DRAFT_PREPARATION_REUSE',
  'CANDIDATE_RESOLUTION_REUSE',
  'PUBLISH_READINESS_REUSE',
]);

function getReviewQueueWiringFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageName: PACKAGE_NAME,
    packageCode: PACKAGE_CODE,
    stageId: STAGE_ID,
  });
}

function getReviewQueueWiringFramework() {
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
    packageRW1Complete: true,
    safetyBoundaries: {
      publishingDenied: true,
      automaticApprovalDenied: true,
      databaseWritesDenied: true,
      redisDenied: true,
      expressRoutesDenied: true,
      productionQueueInsertDenied: true,
    },
    runtimeEffects: {
      databaseWritten: false,
      approved: false,
      published: false,
      reviewQueuePersisted: false,
      routesCreated: false,
    },
    packageSummary: {
      status: 'REVIEW_QUEUE_WIRING_FRAMEWORK_COMPLETE',
      nextPackage: 'FT-1',
      canGenerateReviewPayload: true,
      canApprove: false,
      canPublish: false,
    },
    recommendation:
      'RW1_COMPLETE_ADVISORY_REVIEW_WIRING_ONLY_NO_DB_WRITES_NO_AUTO_APPROVAL_NO_PUBLISHING',
  });
}

function evaluateReviewQueueWiringFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    packageCode: PACKAGE_CODE,
    advisoryOnly: true,
    readyForOperatorReview: true,
    publishingDenied: true,
    effects: {
      databaseWritten: false,
      approved: false,
      published: false,
    },
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
  OPERATOR_REVIEW_OBJECT_VERSION,
  REVIEW_DIAGNOSTICS_VERSION,
  REVIEW_QUEUE_WIRING_VERSION,
  DIAGNOSTIC_CODES,
  deepFreeze,
  createOperatorReviewObject,
  generateReviewDiagnostics,
  wireAdvisoryCandidateToReviewQueue,
  evaluateReviewQueueWiringFramework,
  getReviewQueueWiringFramework,
  getReviewQueueWiringFrameworkIdentity,
};
