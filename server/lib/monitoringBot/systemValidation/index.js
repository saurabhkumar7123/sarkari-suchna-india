'use strict';

/**
 * Package FT-1A — Product-side System Validation facade.
 *
 * Thin composition over FT-1A System Validation & Hardening Framework.
 * Validation / advisory only. No production activation.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/finalHardening/packageFT1ASystemValidationHardeningFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side FT-1A system validation.
 * @param {object} [input]
 */
async function evaluateProductSystemValidation(input = {}) {
  const result = await framework.evaluateSystemValidationHardeningFramework(
    input
  );

  return framework.deepFreeze({
    ...result,
    productReuse: {
      mb1GovernmentSourceRegistry: true,
      mb2WebsiteChangeDetection: true,
      mb3RecruitmentExtraction: true,
      mb4PipelineIntegration: true,
      mb5ControlledScheduler: true,
      tg1TelegramNotification: true,
      rw1ReviewQueueWiring: true,
      programs1to5Complete: true,
    },
    productFacade: 'SYSTEM_VALIDATION_HARDENING',
  });
}

/**
 * Generate product-side validation report.
 * @param {object} [input]
 */
async function generateProductSystemValidationReport(input = {}) {
  const evaluation = await evaluateProductSystemValidation(input);
  return evaluation.report;
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  STAGE_ID: framework.STAGE_ID,
  APPROVED_ACTIVE_SOURCE_IDS: framework.APPROVED_ACTIVE_SOURCE_IDS,
  APPROVED_INACTIVE_SOURCE_IDS: framework.APPROVED_INACTIVE_SOURCE_IDS,
  validateEndToEndAdvisoryFlow: framework.validateEndToEndAdvisoryFlow,
  validateRegressionBaselines: framework.validateRegressionBaselines,
  validateSchedulerControls: framework.validateSchedulerControls,
  validateTelegramSafety: framework.validateTelegramSafety,
  validateReviewWorkflow: framework.validateReviewWorkflow,
  auditGovernmentSources: framework.auditGovernmentSources,
  auditConfiguration: framework.auditConfiguration,
  validateFailureInjection: framework.validateFailureInjection,
  investigateOpenHandles: framework.investigateOpenHandles,
  evaluateSystemValidationHardeningFramework:
    framework.evaluateSystemValidationHardeningFramework,
  evaluateProductSystemValidation,
  generateSystemValidationReport: framework.generateSystemValidationReport,
  generateProductSystemValidationReport,
  getSystemValidationHardeningFramework:
    framework.getSystemValidationHardeningFramework,
  getSystemValidationHardeningFrameworkIdentity:
    framework.getSystemValidationHardeningFrameworkIdentity,
};
