'use strict';

/**
 * Package DEP-1 — Product-side unit tests (controlled deployment).
 */

const {
  evaluateProductControlledDeployment,
  getControlledDeploymentFramework,
  validateDeploymentReadiness,
  createAuthorizationGate,
  DEPLOYMENT_STATES,
} = require('../server/lib/monitoringBot/controlledDeployment');

describe('Package DEP-1 controlled deployment (product facade)', () => {
  test('framework identity is DEP-1 ready for authorization without deploy', () => {
    const framework = getControlledDeploymentFramework();
    expect(framework.packageCode).toBe('DEP-1');
    expect(framework.stageId).toBe('STAGE_3_CONTROLLED_DEPLOYMENT');
    expect(framework.preparationOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
    expect(framework.deploymentExecuted).toBe(false);
    expect(framework.packageSummary.canDeploy).toBe(false);
    expect(framework.packageSummary.nextStep).toBe('OPERATOR_AUTHORIZATION');
    expect(framework.runtimeEffects.pm2Started).toBe(false);
  });

  test('product evaluation yields READY_FOR_AUTHORIZATION and remains inactive', () => {
    const result = evaluateProductControlledDeployment({
      generatedAt: '2026-07-20T00:00:00.000Z',
    });
    expect(result.productReuse.ft1bProductionReadiness).toBe(true);
    expect(result.productReuse.mb5ControlledScheduler).toBe(true);
    expect(result.deploymentState).toBe(DEPLOYMENT_STATES.READY_FOR_AUTHORIZATION);
    expect(result.report.allPassed).toBe(true);
    expect(result.effects.productionActivated).toBe(false);
    expect(result.effects.pm2Started).toBe(false);
    expect(result.effects.deployed).toBe(false);
    expect(result.authorizationGate.explicitOperatorAuthorizationMandatory).toBe(
      true
    );
  });

  test('deployment validation report is deterministic', () => {
    const a = validateDeploymentReadiness();
    const b = validateDeploymentReadiness();
    expect(a.reportId).toBe('DEP1_DEPLOYMENT_VALIDATION_REPORT');
    expect(a.allPassed).toBe(true);
    expect(a.checks.map((c) => c.checkId)).toEqual(b.checks.map((c) => c.checkId));
    expect(a.requiredServices.map((s) => s.serviceId)).toEqual(
      b.requiredServices.map((s) => s.serviceId)
    );
  });

  test('authorization gate blocks activation without operator requirements', () => {
    const gate = createAuthorizationGate({});
    expect(gate.deploymentState).toBe(DEPLOYMENT_STATES.READY_FOR_AUTHORIZATION);
    expect(gate.productionActivationAllowed).toBe(false);
    expect(gate.productionActivated).toBe(false);
    expect(
      gate.requirementStatus.some(
        (r) => r.requirementId === 'OPERATOR_AUTHORIZATION' && r.satisfied === false
      )
    ).toBe(true);
  });
});
