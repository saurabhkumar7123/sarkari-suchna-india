'use strict';

/**
 * Package DEP-1 — Product-side Controlled Deployment facade.
 *
 * Thin composition over DEP-1 Controlled Deployment Framework.
 * Preparation / advisory only. No production activation.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/controlledDeployment/packageDEP1ControlledDeploymentFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side DEP-1 controlled deployment preparation.
 * @param {object} [input]
 */
function evaluateProductControlledDeployment(input = {}) {
  const result = framework.evaluateControlledDeploymentFramework(input);

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
      ft1bProductionReadiness: true,
      programs1to5Complete: true,
    },
    productFacade: 'CONTROLLED_DEPLOYMENT',
  });
}

/**
 * Generate product-side final deployment assessment.
 * @param {object} [input]
 */
function generateProductFinalDeploymentAssessment(input = {}) {
  const evaluation = evaluateProductControlledDeployment(input);
  return evaluation.report;
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  STAGE_ID: framework.STAGE_ID,
  DEPLOYMENT_STATES: framework.DEPLOYMENT_STATES,
  ACTIVATION_REQUIREMENTS: framework.ACTIVATION_REQUIREMENTS,
  validateDeploymentReadiness: framework.validateDeploymentReadiness,
  prepareDeploymentEnvironment: framework.prepareDeploymentEnvironment,
  validateServiceReadiness: framework.validateServiceReadiness,
  prepareDatabaseSafetyChecklist: framework.prepareDatabaseSafetyChecklist,
  buildDeploymentChecklist: framework.buildDeploymentChecklist,
  prepareHealthVerificationPlan: framework.prepareHealthVerificationPlan,
  prepareSmokeTestPlan: framework.prepareSmokeTestPlan,
  generateRollbackPackage: framework.generateRollbackPackage,
  createAuthorizationGate: framework.createAuthorizationGate,
  assessProgram678Compatibility: framework.assessProgram678Compatibility,
  validatePriorPackageBaselines: framework.validatePriorPackageBaselines,
  evaluateControlledDeploymentFramework:
    framework.evaluateControlledDeploymentFramework,
  evaluateProductControlledDeployment,
  generateFinalDeploymentAssessment: framework.generateFinalDeploymentAssessment,
  generateProductFinalDeploymentAssessment,
  getControlledDeploymentFramework: framework.getControlledDeploymentFramework,
  getControlledDeploymentFrameworkIdentity:
    framework.getControlledDeploymentFrameworkIdentity,
};
