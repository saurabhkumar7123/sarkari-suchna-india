'use strict';

/**
 * DEP-1 — Final Deployment Assessment / Report Aggregator
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const { DEPLOYMENT_STATES } = require('./authorizationGate');

const DEPLOYMENT_ASSESSMENT_VERSION = 'DEP1.1.0.0';

/**
 * Build the complete DEP-1 final deployment assessment.
 * @param {object} input
 */
function buildFinalDeploymentAssessment(input = {}) {
  const {
    generatedAt,
    partA,
    partB,
    partC,
    partD,
    partE,
    partF,
    partG,
    partH,
    partI,
    programCompatibility,
    regression,
  } = input;

  const sectionSummaries = [
    { part: 'A', name: 'Deployment Validation', passed: partA?.allPassed === true },
    { part: 'B', name: 'Environment Preparation', passed: partB?.allPassed === true },
    { part: 'C', name: 'Service Readiness', passed: partC?.allPassed === true },
    { part: 'D', name: 'Database Safety', passed: partD?.allPassed === true },
    { part: 'E', name: 'Deployment Checklist', passed: partE?.allPassed === true },
    { part: 'F', name: 'Health Verification Plan', passed: partF?.allPassed === true },
    { part: 'G', name: 'Smoke Test Plan', passed: partG?.allPassed === true },
    { part: 'H', name: 'Rollback Package', passed: partH?.allPassed === true },
    { part: 'I', name: 'Authorization Gate', passed: partI?.allPassed === true },
  ];

  const allPartsPassed = sectionSummaries.every((s) => s.passed === true);
  const regressionPassed = regression ? regression.allPassed === true : true;
  const compatPassed = programCompatibility
    ? programCompatibility.allPassed === true
    : true;

  const allPassed = allPartsPassed && regressionPassed && compatPassed;

  const deploymentState =
    partI?.deploymentState || DEPLOYMENT_STATES.READY_FOR_AUTHORIZATION;

  return deepFreeze({
    validationVersion: DEPLOYMENT_ASSESSMENT_VERSION,
    reportId: 'DEP1_FINAL_DEPLOYMENT_ASSESSMENT',
    packageCode: 'DEP-1',
    packageName: 'Controlled Deployment Framework',
    advisoryOnly: true,
    generatedAt: generatedAt || null,
    productionActivated: false,
    deploymentExecuted: false,
    deploymentState,
    allPassed,
    sectionSummaries,
    confirmations: {
      productionRemainsInactive: true,
      noAutomaticProductionActivation: true,
      explicitOperatorAuthorizationMandatory: true,
      priorsUnchanged: regressionPassed,
      programs678NotImplemented: compatPassed,
      schedulerDisabled: true,
      telegramLiveDisabled: true,
      noPublishing: true,
    },
    deliverables: {
      deploymentReadinessReport: partA || null,
      environmentPreparationReport: partB || null,
      serviceReadinessReport: partC || null,
      databaseSafetyChecklist: partD || null,
      deploymentChecklist: partE || null,
      healthVerificationPlan: partF || null,
      smokeTestPlan: partG || null,
      rollbackPackage: partH || null,
      authorizationGate: partI || null,
      program678CompatibilityReport: programCompatibility || null,
      regressionValidation: regression || null,
    },
    nextPackage: 'PROGRAM_6',
    nextPackageName: 'Production Hardening',
    nextStep: 'OPERATOR_AUTHORIZATION',
    recommendation: allPassed
      ? 'DEP1_COMPLETE_DEPLOYMENT_PREPARED_READY_FOR_AUTHORIZATION_PRODUCTION_REMAINS_INACTIVE'
      : 'DEP1_INCOMPLETE_RESOLVE_FAILED_PARTS_BEFORE_AUTHORIZATION',
    summary:
      'System prepared for controlled deployment. Production remains inactive until explicit authorization.',
  });
}

module.exports = {
  DEPLOYMENT_ASSESSMENT_VERSION,
  buildFinalDeploymentAssessment,
};
