'use strict';

/**
 * Package RW-1 — Product-side Review Queue Wiring facade.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/reviewQueueWiring/packageRW1ReviewQueueWiringFramework.js'
);

const framework = require(frameworkPath);

function evaluateProductReviewQueueWiring(input = {}) {
  const result = framework.evaluateReviewQueueWiringFramework(input);
  return framework.deepFreeze({
    ...result,
    productFacade: 'REVIEW_QUEUE_WIRING',
    publishingDenied: true,
    databaseWriteDenied: true,
    automaticApprovalDenied: true,
  });
}

function wireProductAdvisoryReview(input = {}) {
  const result = framework.wireAdvisoryCandidateToReviewQueue(input);
  return framework.deepFreeze({
    ...result,
    productFacade: 'REVIEW_QUEUE_WIRING',
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  createOperatorReviewObject: framework.createOperatorReviewObject,
  generateReviewDiagnostics: framework.generateReviewDiagnostics,
  wireAdvisoryCandidateToReviewQueue:
    framework.wireAdvisoryCandidateToReviewQueue,
  wireProductAdvisoryReview,
  evaluateReviewQueueWiringFramework:
    framework.evaluateReviewQueueWiringFramework,
  evaluateProductReviewQueueWiring,
  getReviewQueueWiringFramework: framework.getReviewQueueWiringFramework,
  getReviewQueueWiringFrameworkIdentity:
    framework.getReviewQueueWiringFrameworkIdentity,
};
