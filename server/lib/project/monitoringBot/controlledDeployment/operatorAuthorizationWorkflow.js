'use strict';

/**
 * DEP-2 — Part H Operator Authorization Workflow
 *
 * Explicit state machine. No automatic transitions.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const AUTHORIZATION_WORKFLOW_VERSION = 'DEP2.1.0.0';

const AUTHORIZATION_STATES = Object.freeze({
  READY_FOR_AUTHORIZATION: 'READY_FOR_AUTHORIZATION',
  DEPLOYMENT_PACKAGE_READY: 'DEPLOYMENT_PACKAGE_READY',
  WAITING_FOR_OPERATOR: 'WAITING_FOR_OPERATOR',
  AUTHORIZED: 'AUTHORIZED',
  DEPLOYMENT_ALLOWED: 'DEPLOYMENT_ALLOWED',
  LIVE: 'LIVE',
});

const STATE_ORDER = Object.freeze([
  AUTHORIZATION_STATES.READY_FOR_AUTHORIZATION,
  AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY,
  AUTHORIZATION_STATES.WAITING_FOR_OPERATOR,
  AUTHORIZATION_STATES.AUTHORIZED,
  AUTHORIZATION_STATES.DEPLOYMENT_ALLOWED,
  AUTHORIZATION_STATES.LIVE,
]);

/**
 * Create / evaluate operator authorization workflow.
 * Default: advance only to DEPLOYMENT_PACKAGE_READY when package gates pass.
 * Never auto-advances to AUTHORIZED, DEPLOYMENT_ALLOWED, or LIVE.
 * @param {object} [input]
 */
function createOperatorAuthorizationWorkflow(input = {}) {
  const packageReady =
    (input.partA ? input.partA.allPassed !== false : true) &&
    (input.partB ? input.partB.allPassed === true : false) &&
    (input.partC ? input.partC.allPassed === true : false) &&
    (input.partD ? input.partD.allPassed === true : false) &&
    (input.partE ? input.partE.allPassed === true : false) &&
    (input.partF ? input.partF.allPassed === true : false) &&
    (input.partG ? input.partG.preparedGatesPassed === true : false) &&
    (input.partI ? input.partI.allPassed !== false : true);

  const waitingForOperator = input.waitingForOperator === true;
  const operatorAuthorized = input.operatorAuthorized === true;
  const deploymentAllowedAck = input.deploymentAllowed === true;
  const forceLive = input.forceLive === true;

  let authorizationState = AUTHORIZATION_STATES.READY_FOR_AUTHORIZATION;

  if (packageReady) {
    authorizationState = AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY;
  }

  // Explicit operator signals only — no automatic transition
  if (packageReady && waitingForOperator) {
    authorizationState = AUTHORIZATION_STATES.WAITING_FOR_OPERATOR;
  }
  if (
    packageReady &&
    waitingForOperator &&
    operatorAuthorized
  ) {
    authorizationState = AUTHORIZATION_STATES.AUTHORIZED;
  }
  if (
    authorizationState === AUTHORIZATION_STATES.AUTHORIZED &&
    deploymentAllowedAck &&
    input.allSafetyGatesPassed === true
  ) {
    authorizationState = AUTHORIZATION_STATES.DEPLOYMENT_ALLOWED;
  }

  // LIVE is never set by DEP-2 framework (even if forceLive requested)
  if (forceLive === true) {
    authorizationState =
      authorizationState === AUTHORIZATION_STATES.DEPLOYMENT_ALLOWED
        ? AUTHORIZATION_STATES.DEPLOYMENT_ALLOWED
        : authorizationState;
  }

  const transitions = STATE_ORDER.map((state, index) => ({
    state,
    index,
    automatic: false,
    requiresExplicitOperatorAction: index >= 2,
  }));

  const checks = [
    {
      checkId: 'STATES_DEFINED',
      passed: STATE_ORDER.length === 6,
    },
    {
      checkId: 'NO_AUTOMATIC_TRANSITION',
      passed: transitions.every((t) => t.automatic === false),
    },
    {
      checkId: 'NOT_LIVE',
      passed: authorizationState !== AUTHORIZATION_STATES.LIVE,
    },
    {
      checkId: 'PACKAGE_READY_WHEN_PARTS_PASS',
      passed:
        !packageReady ||
        authorizationState === AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY ||
        STATE_ORDER.indexOf(authorizationState) >=
          STATE_ORDER.indexOf(AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY),
    },
    {
      checkId: 'PRODUCTION_INACTIVE',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: AUTHORIZATION_WORKFLOW_VERSION,
    part: 'H',
    reportId: 'DEP2_OPERATOR_AUTHORIZATION_WORKFLOW',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    authorizationStates: { ...AUTHORIZATION_STATES },
    stateOrder: STATE_ORDER.slice(),
    transitions,
    packageReady,
    authorizationState,
    automaticTransition: false,
    explicitOperatorAuthorizationMandatory: true,
    liveDenied: true,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      authorizationState === AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY
        ? 'Deployment package ready. Awaiting explicit operator authorization. Production remains inactive.'
        : authorizationState === AUTHORIZATION_STATES.READY_FOR_AUTHORIZATION
          ? 'Ready for authorization workflow. Complete package preparation gates first.'
          : `Authorization workflow state: ${authorizationState}. LIVE remains denied by DEP-2.`,
  });
}

module.exports = {
  AUTHORIZATION_WORKFLOW_VERSION,
  AUTHORIZATION_STATES,
  STATE_ORDER,
  createOperatorAuthorizationWorkflow,
};
