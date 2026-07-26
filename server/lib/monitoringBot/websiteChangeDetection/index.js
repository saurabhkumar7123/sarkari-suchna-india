'use strict';

/**
 * Package MB-2 — Product-side Website Change Detection facade.
 *
 * Thin composition layer over the Government Monitoring Bot MB-2 framework.
 * Manual change detection only.
 * No recruitment extraction. No review queue. No Telegram. No publishing.
 * No Express routes. No scheduler. No workers.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/websiteChangeDetection/packageMB2WebsiteChangeDetectionFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side website change detection framework (advisory assembly).
 * Does not perform HTTP by itself.
 *
 * @param {object} [input]
 */
function evaluateProductWebsiteChangeDetection(input = {}) {
  const result = framework.evaluateWebsiteChangeDetectionFramework(input);

  return framework.deepFreeze({
    ...result,
    productReuse: {
      mb1GovernmentSourceRegistry: true,
      mb1MonitoringConfiguration: true,
      mb1CrawlPolicy: true,
      programs1to5Complete: true,
    },
  });
}

/**
 * Manually detect whether a registered source changed.
 * @param {object} input
 */
async function detectProductWebsiteChange(input = {}) {
  const result = await framework.detectWebsiteChange(input);

  return framework.deepFreeze({
    ...result,
    productFacade: 'WEBSITE_CHANGE_DETECTION',
    extractionDenied: true,
    reviewDenied: true,
    telegramDenied: true,
    publishingDenied: true,
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  DETECTION_STATUS: framework.DETECTION_STATUS,
  DETECTION_RESULT_STATUSES: framework.DETECTION_RESULT_STATUSES,
  CHANGE_CLASSES: framework.CHANGE_CLASSES,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  FINGERPRINT_ALGORITHMS: framework.FINGERPRINT_ALGORITHMS,
  EXTENSION_POINTS: framework.EXTENSION_POINTS,
  CONTENT_TYPES: framework.CONTENT_TYPES,
  fetchSource: framework.fetchSource,
  collectResponseMetadata: framework.collectResponseMetadata,
  generateContentFingerprint: framework.generateContentFingerprint,
  detectChange: framework.detectChange,
  classifyDetectedChange: framework.classifyDetectedChange,
  generateDetectionDiagnostics: framework.generateDetectionDiagnostics,
  createDetectionResult: framework.createDetectionResult,
  detectWebsiteChange: framework.detectWebsiteChange,
  evaluateWebsiteChangeDetectionFramework:
    framework.evaluateWebsiteChangeDetectionFramework,
  evaluateProductWebsiteChangeDetection,
  detectProductWebsiteChange,
  getWebsiteChangeDetectionFramework:
    framework.getWebsiteChangeDetectionFramework,
  getWebsiteChangeDetectionFrameworkIdentity:
    framework.getWebsiteChangeDetectionFrameworkIdentity,
};
