'use strict';

/**
 * DEP-2 — Part G Deployment Safety Gates
 *
 * Deployment is prohibited until ALL gates pass.
 * Gates may be "prepared" locally; operator-verified gates remain false by default.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const SAFETY_GATES_VERSION = 'DEP2.1.0.0';

const GATE_DEFINITIONS = Object.freeze([
  {
    gateId: 'GATE_1_REPOSITORY_AUDIT',
    name: 'Repository Audit',
    part: 'A',
    operatorVerifiedRequired: false,
  },
  {
    gateId: 'GATE_2_DEPLOYMENT_MANIFEST',
    name: 'Deployment Manifest',
    part: 'B',
    operatorVerifiedRequired: false,
  },
  {
    gateId: 'GATE_3_EXCLUSION_VALIDATION',
    name: 'Exclusion Validation',
    part: 'C',
    operatorVerifiedRequired: false,
  },
  {
    gateId: 'GATE_4_BACKUP_VERIFIED',
    name: 'Backup Verified',
    part: null,
    operatorVerifiedRequired: true,
  },
  {
    gateId: 'GATE_5_ROLLBACK_VERIFIED',
    name: 'Rollback Verified',
    part: null,
    operatorVerifiedRequired: true,
  },
  {
    gateId: 'GATE_6_ENVIRONMENT_VERIFIED',
    name: 'Environment Verified',
    part: 'F',
    operatorVerifiedRequired: true,
  },
  {
    gateId: 'GATE_7_HEALTH_VERIFICATION',
    name: 'Health Verification',
    part: null,
    operatorVerifiedRequired: true,
  },
  {
    gateId: 'GATE_8_OPERATOR_AUTHORIZATION',
    name: 'Operator Authorization',
    part: 'H',
    operatorVerifiedRequired: true,
  },
]);

/**
 * Evaluate mandatory deployment safety gates.
 * @param {object} [input]
 */
function evaluateDeploymentSafetyGates(input = {}) {
  const partAPassed = input.partA ? input.partA.allPassed === true : false;
  const partBPassed = input.partB ? input.partB.allPassed === true : false;
  const partCPassed = input.partC ? input.partC.allPassed === true : false;
  const partFPassed = input.partF ? input.partF.allPassed === true : false;

  const backupVerified = input.backupVerified === true;
  const rollbackVerified = input.rollbackVerified === true;
  const environmentVerified =
    input.environmentVerified === true ||
    (input.environmentVerified !== false &&
      partFPassed &&
      input.operatorEnvironmentAck === true);
  const healthVerified = input.healthVerified === true;
  const operatorAuthorized = input.operatorAuthorized === true;

  const gates = [
    {
      gateId: 'GATE_1_REPOSITORY_AUDIT',
      name: 'Repository Audit',
      passed: partAPassed,
      prepared: partAPassed,
      operatorVerified: partAPassed,
    },
    {
      gateId: 'GATE_2_DEPLOYMENT_MANIFEST',
      name: 'Deployment Manifest',
      passed: partBPassed,
      prepared: partBPassed,
      operatorVerified: partBPassed,
    },
    {
      gateId: 'GATE_3_EXCLUSION_VALIDATION',
      name: 'Exclusion Validation',
      passed: partCPassed,
      prepared: partCPassed,
      operatorVerified: partCPassed,
    },
    {
      gateId: 'GATE_4_BACKUP_VERIFIED',
      name: 'Backup Verified',
      passed: backupVerified,
      prepared: true,
      operatorVerified: backupVerified,
    },
    {
      gateId: 'GATE_5_ROLLBACK_VERIFIED',
      name: 'Rollback Verified',
      passed: rollbackVerified,
      prepared: true,
      operatorVerified: rollbackVerified,
    },
    {
      gateId: 'GATE_6_ENVIRONMENT_VERIFIED',
      name: 'Environment Verified',
      passed: environmentVerified,
      prepared: partFPassed,
      operatorVerified: environmentVerified,
    },
    {
      gateId: 'GATE_7_HEALTH_VERIFICATION',
      name: 'Health Verification',
      passed: healthVerified,
      prepared: true,
      operatorVerified: healthVerified,
    },
    {
      gateId: 'GATE_8_OPERATOR_AUTHORIZATION',
      name: 'Operator Authorization',
      passed: operatorAuthorized,
      prepared: true,
      operatorVerified: operatorAuthorized,
    },
  ];

  const preparedGatesPassed = gates
    .filter((g) =>
      [
        'GATE_1_REPOSITORY_AUDIT',
        'GATE_2_DEPLOYMENT_MANIFEST',
        'GATE_3_EXCLUSION_VALIDATION',
      ].includes(g.gateId)
    )
    .every((g) => g.passed === true);

  const allGatesPassed = gates.every((g) => g.passed === true);
  const deploymentProhibited = !allGatesPassed;

  const checks = [
    {
      checkId: 'EIGHT_GATES_DEFINED',
      passed: gates.length === 8 && GATE_DEFINITIONS.length === 8,
    },
    {
      checkId: 'PREPARED_GATES_EVALUATED',
      passed: preparedGatesPassed,
    },
    {
      checkId: 'DEPLOYMENT_PROHIBITED_UNTIL_ALL_PASS',
      passed: deploymentProhibited === true || allGatesPassed === true,
    },
    {
      checkId: 'DEFAULT_OPERATOR_GATES_CLOSED',
      passed:
        input.operatorAuthorized === true ||
        gates
          .filter((g) =>
            [
              'GATE_4_BACKUP_VERIFIED',
              'GATE_5_ROLLBACK_VERIFIED',
              'GATE_7_HEALTH_VERIFICATION',
              'GATE_8_OPERATOR_AUTHORIZATION',
            ].includes(g.gateId)
          )
          .every((g) => g.passed === false),
    },
  ];

  return deepFreeze({
    validationVersion: SAFETY_GATES_VERSION,
    part: 'G',
    reportId: 'DEP2_DEPLOYMENT_SAFETY_GATES_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    deploymentExecuted: false,
    gateDefinitions: GATE_DEFINITIONS.slice(),
    gates,
    preparedGatesPassed,
    allGatesPassed,
    deploymentProhibited,
    deploymentAllowed: allGatesPassed,
    checks,
    allPassed: checks.every((c) => c.passed === true) && preparedGatesPassed,
    summary: allGatesPassed
      ? 'All eight deployment safety gates passed. Explicit operator deployment steps still required.'
      : 'Deployment prohibited until all eight safety gates pass. Prepared package gates may pass while operator gates remain closed.',
  });
}

module.exports = {
  SAFETY_GATES_VERSION,
  GATE_DEFINITIONS,
  evaluateDeploymentSafetyGates,
};
