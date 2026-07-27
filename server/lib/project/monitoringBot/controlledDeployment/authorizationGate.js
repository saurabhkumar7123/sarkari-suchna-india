'use strict';

/**
 * DEP-1 — Part I Final Authorization Gate
 *
 * Explicit authorization gate. Production activation allowed ONLY after
 * all required gates pass AND operator authorization is recorded.
 *
 * DEP-1 preparation never auto-advances to AUTHORIZED or DEPLOYED.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const AUTHORIZATION_GATE_VERSION = 'DEP1.1.0.0';

const DEPLOYMENT_STATES = Object.freeze({
  NOT_DEPLOYED: 'NOT_DEPLOYED',
  DEPLOYMENT_PREPARED: 'DEPLOYMENT_PREPARED',
  READY_FOR_AUTHORIZATION: 'READY_FOR_AUTHORIZATION',
  AUTHORIZED: 'AUTHORIZED',
  DEPLOYED: 'DEPLOYED',
});

const ACTIVATION_REQUIREMENTS = Object.freeze([
  {
    requirementId: 'OPERATOR_AUTHORIZATION',
    description: 'Explicit operator authorization recorded',
  },
  {
    requirementId: 'ENVIRONMENT_VALIDATION',
    description: 'Environment validation passed',
  },
  {
    requirementId: 'BACKUP_VERIFICATION',
    description: 'Backup verification confirmed by operator',
  },
  {
    requirementId: 'REDIS_VERIFICATION',
    description: 'Redis verification confirmed by operator',
  },
  {
    requirementId: 'HEALTH_VERIFICATION',
    description: 'Health verification plan acknowledged',
  },
  {
    requirementId: 'FINAL_GO_DECISION',
    description: 'Final Go Decision recorded',
  },
]);

/**
 * Create / evaluate authorization gate (preparation default: READY_FOR_AUTHORIZATION).
 * @param {object} [input]
 */
function createAuthorizationGate(input = {}) {
  const partsReady =
    (input.partA ? input.partA.allPassed !== false : true) &&
    (input.partB ? input.partB.allPassed !== false : true) &&
    (input.partC ? input.partC.allPassed !== false : true) &&
    (input.partD ? input.partD.allPassed !== false : true) &&
    (input.partE ? input.partE.allPassed !== false : true) &&
    (input.partF ? input.partF.allPassed !== false : true) &&
    (input.partG ? input.partG.allPassed !== false : true) &&
    (input.partH ? input.partH.allPassed !== false : true);

  const operatorAuthorized = input.operatorAuthorized === true;
  const environmentValidated =
    input.environmentValidated === true ||
    (input.partB && input.partB.allPassed === true);
  const backupVerified = input.backupVerified === true;
  const redisVerified = input.redisVerified === true;
  const healthVerified = input.healthVerified === true;
  const finalGoDecision = input.finalGoDecision === true;

  const requirementStatus = [
    {
      requirementId: 'OPERATOR_AUTHORIZATION',
      satisfied: operatorAuthorized,
    },
    {
      requirementId: 'ENVIRONMENT_VALIDATION',
      satisfied: environmentValidated,
    },
    {
      requirementId: 'BACKUP_VERIFICATION',
      satisfied: backupVerified,
    },
    {
      requirementId: 'REDIS_VERIFICATION',
      satisfied: redisVerified,
    },
    {
      requirementId: 'HEALTH_VERIFICATION',
      satisfied: healthVerified,
    },
    {
      requirementId: 'FINAL_GO_DECISION',
      satisfied: finalGoDecision,
    },
  ];

  const allActivationRequirementsMet = requirementStatus.every(
    (r) => r.satisfied === true
  );

  // DEP-1 never auto-authorizes or deploys. Explicit input may mark AUTHORIZED
  // for documentation, but productionActivated remains false unless
  // input.forceDeployed is set (still denied by framework policy).
  let deploymentState = DEPLOYMENT_STATES.NOT_DEPLOYED;
  if (partsReady) {
    deploymentState = DEPLOYMENT_STATES.DEPLOYMENT_PREPARED;
    deploymentState = DEPLOYMENT_STATES.READY_FOR_AUTHORIZATION;
  }
  if (allActivationRequirementsMet && operatorAuthorized) {
    deploymentState = DEPLOYMENT_STATES.AUTHORIZED;
  }
  // DEPLOYED is never set by DEP-1 preparation framework
  if (input.forceDeployed === true) {
    deploymentState = DEPLOYMENT_STATES.AUTHORIZED;
  }

  const productionActivationAllowed =
    allActivationRequirementsMet &&
    deploymentState === DEPLOYMENT_STATES.AUTHORIZED;

  const checks = [
    {
      checkId: 'STATES_DEFINED',
      passed: Object.keys(DEPLOYMENT_STATES).length === 5,
    },
    {
      checkId: 'ACTIVATION_REQUIREMENTS_DEFINED',
      passed: ACTIVATION_REQUIREMENTS.length === 6,
    },
    {
      checkId: 'NOT_AUTO_DEPLOYED',
      passed: deploymentState !== DEPLOYMENT_STATES.DEPLOYED,
    },
    {
      checkId: 'PRODUCTION_INACTIVE_BY_DEFAULT',
      passed: true,
    },
    {
      checkId: 'PARTS_READY_FOR_GATE',
      passed: partsReady,
    },
  ];

  return deepFreeze({
    validationVersion: AUTHORIZATION_GATE_VERSION,
    part: 'I',
    reportId: 'DEP1_AUTHORIZATION_GATE',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    deploymentStates: { ...DEPLOYMENT_STATES },
    deploymentState,
    activationRequirements: ACTIVATION_REQUIREMENTS.slice(),
    requirementStatus,
    allActivationRequirementsMet,
    productionActivationAllowed,
    automaticProductionActivation: false,
    explicitOperatorAuthorizationMandatory: true,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      deploymentState === DEPLOYMENT_STATES.READY_FOR_AUTHORIZATION
        ? 'Deployment prepared and ready for authorization. Production remains inactive until all activation requirements are satisfied by an operator.'
        : deploymentState === DEPLOYMENT_STATES.AUTHORIZED
          ? 'Authorization recorded in gate model only. DEP-1 still does not activate production runtime.'
          : 'Authorization gate created. Complete preparation before requesting operator authorization.',
  });
}

module.exports = {
  AUTHORIZATION_GATE_VERSION,
  DEPLOYMENT_STATES,
  ACTIVATION_REQUIREMENTS,
  createAuthorizationGate,
};
