'use strict';

/**
 * Package MB-3 — Product-side Recruitment Extraction facade.
 *
 * Thin composition layer over the Government Monitoring Bot MB-3 framework.
 * Advisory extraction only.
 * No publishing. No Telegram. No scheduler. No Express routes. No database writes.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/recruitmentExtraction/packageMB3RecruitmentExtractionFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side recruitment extraction framework (advisory assembly).
 * @param {object} [input]
 */
function evaluateProductRecruitmentExtraction(input = {}) {
  const result = framework.evaluateRecruitmentExtractionFramework(input);

  return framework.deepFreeze({
    ...result,
    productReuse: {
      mb1GovernmentSourceRegistry: true,
      mb1ParserRegistry: true,
      mb2WebsiteChangeDetection: true,
      programs1to5Complete: true,
    },
  });
}

/**
 * Extract recruitment from content (advisory).
 * @param {object} input
 */
function extractProductRecruitment(input = {}) {
  const result = framework.extractRecruitment(input);

  return framework.deepFreeze({
    ...result,
    productFacade: 'RECRUITMENT_EXTRACTION',
    publishingDenied: true,
    telegramDenied: true,
    schedulerDenied: true,
    databaseWriteDenied: true,
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  EXTRACTION_STATUSES: framework.EXTRACTION_STATUSES,
  DUPLICATE_STATUS: framework.DUPLICATE_STATUS,
  CANDIDATE_STATUSES: framework.CANDIDATE_STATUSES,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  APPLICATION_MODES: framework.APPLICATION_MODES,
  CONTENT_TYPES: framework.CONTENT_TYPES,
  EXTENSION_POINTS: framework.EXTENSION_POINTS,
  createStructuredRecruitment: framework.createStructuredRecruitment,
  validateStructuredRecruitment: framework.validateStructuredRecruitment,
  extractFromHtml: framework.extractFromHtml,
  extractFromRss: framework.extractFromRss,
  extractFromXml: framework.extractFromXml,
  extractFromPdf: framework.extractFromPdf,
  generateExtractionDiagnostics: framework.generateExtractionDiagnostics,
  detectAdvisoryDuplicate: framework.detectAdvisoryDuplicate,
  buildAdvisoryCandidate: framework.buildAdvisoryCandidate,
  extractRecruitment: framework.extractRecruitment,
  evaluateRecruitmentExtractionFramework:
    framework.evaluateRecruitmentExtractionFramework,
  evaluateProductRecruitmentExtraction,
  extractProductRecruitment,
  getRecruitmentExtractionFramework:
    framework.getRecruitmentExtractionFramework,
  getRecruitmentExtractionFrameworkIdentity:
    framework.getRecruitmentExtractionFrameworkIdentity,
};
