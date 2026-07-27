'use strict';

/**
 * Package DEP-2 — Product-side Operator Authorization & Safe Deployment facade.
 *
 * Thin composition over DEP-2 framework.
 * Authorization / advisory only. No production activation.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/controlledDeployment/packageDEP2OperatorAuthorizationSafeDeploymentFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side DEP-2 operator authorization & safe deployment.
 * @param {object} [input]
 */
function evaluateProductOperatorAuthorizationSafeDeployment(input = {}) {
  const result = framework.evaluateOperatorAuthorizationSafeDeploymentFramework(
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
      ft1aSystemValidation: true,
      ft1bProductionReadiness: true,
      dep1ControlledDeployment: true,
      programs1to5Complete: true,
    },
    productFacade: 'OPERATOR_AUTHORIZATION_SAFE_DEPLOYMENT',
  });
}

/**
 * Generate product-side final deployment authorization assessment.
 * @param {object} [input]
 */
function generateProductFinalDeploymentAuthorizationAssessment(input = {}) {
  const evaluation = evaluateProductOperatorAuthorizationSafeDeployment(input);
  return evaluation.report;
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  STAGE_ID: framework.STAGE_ID,
  AUTHORIZATION_STATES: framework.AUTHORIZATION_STATES,
  GATE_DEFINITIONS: framework.GATE_DEFINITIONS,
  auditRepositoryStructure: framework.auditRepositoryStructure,
  generateDeploymentManifest: framework.generateDeploymentManifest,
  writeDeploymentManifestFile: framework.writeDeploymentManifestFile,
  validateDeploymentExclusions: framework.validateDeploymentExclusions,
  generateProductionPackageSummary: framework.generateProductionPackageSummary,
  assessGitHubReadiness: framework.assessGitHubReadiness,
  assessServerReadiness: framework.assessServerReadiness,
  evaluateDeploymentSafetyGates: framework.evaluateDeploymentSafetyGates,
  createOperatorAuthorizationWorkflow:
    framework.createOperatorAuthorizationWorkflow,
  evaluateDeploymentProtection: framework.evaluateDeploymentProtection,
  assessDep2Program678Compatibility:
    framework.assessDep2Program678Compatibility,
  validatePriorPackageBaselines: framework.validatePriorPackageBaselines,
  evaluateOperatorAuthorizationSafeDeploymentFramework:
    framework.evaluateOperatorAuthorizationSafeDeploymentFramework,
  evaluateProductOperatorAuthorizationSafeDeployment,
  generateFinalDeploymentAuthorizationAssessment:
    framework.generateFinalDeploymentAuthorizationAssessment,
  generateProductFinalDeploymentAuthorizationAssessment,
  getOperatorAuthorizationSafeDeploymentFramework:
    framework.getOperatorAuthorizationSafeDeploymentFramework,
  getOperatorAuthorizationSafeDeploymentFrameworkIdentity:
    framework.getOperatorAuthorizationSafeDeploymentFrameworkIdentity,
};
