'use strict';

/**
 * Package DEP-2 — Product-side unit tests (operator authorization).
 */

const {
  evaluateProductOperatorAuthorizationSafeDeployment,
  getOperatorAuthorizationSafeDeploymentFramework,
  generateDeploymentManifest,
  createOperatorAuthorizationWorkflow,
  AUTHORIZATION_STATES,
} = require('../server/lib/monitoringBot/operatorAuthorization');

describe('Package DEP-2 operator authorization (product facade)', () => {
  test('framework identity is DEP-2 ready without deploy', () => {
    const framework = getOperatorAuthorizationSafeDeploymentFramework();
    expect(framework.packageCode).toBe('DEP-2');
    expect(framework.stageId).toBe('STAGE_3_CONTROLLED_DEPLOYMENT');
    expect(framework.authorizationOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
    expect(framework.deploymentExecuted).toBe(false);
    expect(framework.packageSummary.canDeploy).toBe(false);
    expect(framework.packageSummary.nextStep).toBe(
      'AWAIT_EXPLICIT_OPERATOR_DEPLOYMENT_APPROVAL'
    );
    expect(framework.runtimeEffects.githubPushed).toBe(false);
  });

  test('product evaluation yields DEPLOYMENT_PACKAGE_READY and remains inactive', () => {
    const result = evaluateProductOperatorAuthorizationSafeDeployment({
      generatedAt: '2026-07-20T00:00:00.000Z',
    });
    expect(result.productReuse.dep1ControlledDeployment).toBe(true);
    expect(result.productReuse.ft1bProductionReadiness).toBe(true);
    expect(result.authorizationState).toBe(
      AUTHORIZATION_STATES.DEPLOYMENT_PACKAGE_READY
    );
    expect(result.report.allPassed).toBe(true);
    expect(result.effects.productionActivated).toBe(false);
    expect(result.effects.githubPushed).toBe(false);
    expect(result.effects.live).toBe(false);
    expect(
      result.operatorAuthorizationWorkflow.explicitOperatorAuthorizationMandatory
    ).toBe(true);
  });

  test('deployment manifest is deterministic whitelist-only', () => {
    const a = generateDeploymentManifest();
    const b = generateDeploymentManifest();
    expect(a.reportId).toBe('DEP2_DEPLOYMENT_MANIFEST');
    expect(a.manifest.approach).toBe('WHITELIST_ONLY');
    expect(a.allPassed).toBe(true);
    expect(a.manifest.files).toEqual(b.manifest.files);
  });

  test('authorization workflow does not auto-advance to LIVE', () => {
    const workflow = createOperatorAuthorizationWorkflow({});
    expect(workflow.authorizationState).not.toBe(AUTHORIZATION_STATES.LIVE);
    expect(workflow.productionActivated).toBe(false);
    expect(workflow.automaticTransition).toBe(false);
  });
});
