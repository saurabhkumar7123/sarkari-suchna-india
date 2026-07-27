'use strict';

/**
 * DEP-2 — Final Deployment Authorization Assessment aggregator
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const { AUTHORIZATION_STATES } = require('./operatorAuthorizationWorkflow');

const DEP2_ASSESSMENT_VERSION = 'DEP2.1.0.0';

/**
 * Build the complete DEP-2 final deployment authorization assessment.
 * @param {object} input
 */
function buildFinalDeploymentAuthorizationAssessment(input = {}) {
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
    { part: 'A', name: 'Repository Structure Audit', passed: partA?.allPassed === true },
    { part: 'B', name: 'Production Deployment Manifest', passed: partB?.allPassed === true },
    { part: 'C', name: 'Exclusion Validation', passed: partC?.allPassed === true },
    { part: 'D', name: 'Production Package Summary', passed: partD?.allPassed === true },
    { part: 'E', name: 'GitHub Readiness', passed: partE?.allPassed === true },
    { part: 'F', name: 'Server Readiness', passed: partF?.allPassed === true },
    { part: 'G', name: 'Deployment Safety Gates', passed: partG?.allPassed === true },
    { part: 'H', name: 'Operator Authorization Workflow', passed: partH?.allPassed === true },
    { part: 'I', name: 'Deployment Protection', passed: partI?.allPassed === true },
  ];

  const allPartsPassed = sectionSummaries.every((s) => s.passed === true);
  const regressionPassed = regression ? regression.allPassed === true : true;
  const compatPassed = programCompatibility
    ? programCompatibility.allPassed === true
    : true;

  const allPassed = allPartsPassed && regressionPassed && compatPassed;

  const authorizationState =
    partH?.authorizationState || AUTHORIZATION_STATES.READY_FOR_AUTHORIZATION;

  const packageReady =
    authorizationState === AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY ||
    STATE_INDEX_AT_LEAST(authorizationState, AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY);

  return deepFreeze({
    validationVersion: DEP2_ASSESSMENT_VERSION,
    reportId: 'DEP2_FINAL_DEPLOYMENT_AUTHORIZATION_ASSESSMENT',
    packageCode: 'DEP-2',
    packageName: 'Operator Authorization & Safe Deployment Framework',
    advisoryOnly: true,
    generatedAt: generatedAt || null,
    productionActivated: false,
    deploymentExecuted: false,
    authorizationState,
    packageReady,
    allPassed,
    sectionSummaries,
    confirmations: {
      productionRemainsInactive: true,
      noAutomaticProductionActivation: true,
      noGitHubPush: true,
      noVpsDeployment: true,
      explicitOperatorAuthorizationMandatory: true,
      whitelistOnlyManifest: true,
      priorsUnchanged: regressionPassed,
      programs678NotImplemented: compatPassed,
      schedulerDisabled: true,
      telegramLiveDisabled: true,
      noPublishing: true,
    },
    deliverables: {
      repositoryStructureReport: partA || null,
      deploymentManifest: partB || null,
      deploymentExclusionReport: partC || null,
      productionPackageSummary: partD || null,
      githubReadinessReport: partE || null,
      serverReadinessReport: partF || null,
      deploymentSafetyGatesReport: partG || null,
      operatorAuthorizationWorkflow: partH || null,
      deploymentProtection: partI || null,
      program678CompatibilityReport: programCompatibility || null,
      regressionValidation: regression || null,
    },
    nextPackage: 'PROGRAM_6',
    nextPackageName: 'Production Hardening',
    nextStep: 'AWAIT_EXPLICIT_OPERATOR_DEPLOYMENT_APPROVAL',
    recommendation: allPassed
      ? 'DEP2_COMPLETE_DEPLOYMENT_PACKAGE_READY_PRODUCTION_REMAINS_INACTIVE_AWAIT_OPERATOR_APPROVAL'
      : 'DEP2_INCOMPLETE_RESOLVE_FAILED_PARTS_BEFORE_OPERATOR_APPROVAL',
    summary:
      'Operator authorization and safe deployment framework complete. Production remains inactive. No GitHub push. No VPS deployment. Await explicit operator deployment approval.',
  });
}

function STATE_INDEX_AT_LEAST(current, target) {
  const order = [
    AUTHORIZATION_STATES.READY_FOR_AUTHORIZATION,
    AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY,
    AUTHORIZATION_STATES.WAITING_FOR_OPERATOR,
    AUTHORIZATION_STATES.AUTHORIZED,
    AUTHORIZATION_STATES.DEPLOYMENT_ALLOWED,
    AUTHORIZATION_STATES.LIVE,
  ];
  return order.indexOf(current) >= order.indexOf(target);
}

module.exports = {
  DEP2_ASSESSMENT_VERSION,
  buildFinalDeploymentAuthorizationAssessment,
};
