'use strict';

/**
 * Package FT-1B — Product-side Production Readiness facade.
 *
 * Thin composition over FT-1B Production Readiness Framework.
 * Assessment / advisory only. No production activation.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/finalHardening/packageFT1BProductionReadinessFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side FT-1B production readiness.
 * @param {object} [input]
 */
function evaluateProductProductionReadiness(input = {}) {
  const result = framework.evaluateProductionReadinessFramework(input);

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
      ft1aSystemValidation: true,
      programs1to5Complete: true,
    },
    productFacade: 'PRODUCTION_READINESS',
  });
}

/**
 * Generate product-side production readiness report.
 * @param {object} [input]
 */
function generateProductProductionReadinessReport(input = {}) {
  const evaluation = evaluateProductProductionReadiness(input);
  return evaluation.report;
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  STAGE_ID: framework.STAGE_ID,
  DECISION_OUTCOMES: framework.DECISION_OUTCOMES,
  validateEnvironmentConfiguration: framework.validateEnvironmentConfiguration,
  assessStartupShutdownReadiness: framework.assessStartupShutdownReadiness,
  assessDependencyReadiness: framework.assessDependencyReadiness,
  reviewSecurityConfiguration: framework.reviewSecurityConfiguration,
  assessBackupRollbackReadiness: framework.assessBackupRollbackReadiness,
  assessObservabilityReadiness: framework.assessObservabilityReadiness,
  createPerformanceBaseline: framework.createPerformanceBaseline,
  buildReleaseReadinessChecklist: framework.buildReleaseReadinessChecklist,
  assessGoNoGo: framework.assessGoNoGo,
  assessProgram678Compatibility: framework.assessProgram678Compatibility,
  validatePriorPackageBaselines: framework.validatePriorPackageBaselines,
  evaluateProductionReadinessFramework:
    framework.evaluateProductionReadinessFramework,
  evaluateProductProductionReadiness,
  generateProductionReadinessReport: framework.generateProductionReadinessReport,
  generateProductProductionReadinessReport,
  getProductionReadinessFramework: framework.getProductionReadinessFramework,
  getProductionReadinessFrameworkIdentity:
    framework.getProductionReadinessFrameworkIdentity,
};
