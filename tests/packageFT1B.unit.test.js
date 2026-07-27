'use strict';

/**
 * Package FT-1B — Product-side unit tests (production readiness).
 */

const {
  evaluateProductProductionReadiness,
  getProductionReadinessFramework,
  validateEnvironmentConfiguration,
  assessGoNoGo,
  DECISION_OUTCOMES,
} = require('../server/lib/monitoringBot/productionReadiness');

describe('Package FT-1B production readiness (product facade)', () => {
  test('framework identity is FT-1B ready for DEP-1 with conditions', () => {
    const framework = getProductionReadinessFramework();
    expect(framework.packageCode).toBe('FT-1B');
    expect(framework.stageId).toBe('STAGE_2_FINAL_HARDENING_AND_TESTING');
    expect(framework.assessmentOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
    expect(framework.packageSummary.canDeploy).toBe(false);
    expect(framework.packageSummary.nextPackage).toBe('DEP-1');
    expect(framework.runtimeEffects.pm2Started).toBe(false);
  });

  test('product evaluation yields GO_WITH_CONDITIONS and remains inactive', () => {
    const result = evaluateProductProductionReadiness({
      generatedAt: '2026-07-20T00:00:00.000Z',
    });
    expect(result.productReuse.ft1aSystemValidation).toBe(true);
    expect(result.productReuse.mb5ControlledScheduler).toBe(true);
    expect(result.decision).toBe(DECISION_OUTCOMES.GO_WITH_CONDITIONS);
    expect(result.eligibleForDep1).toBe(true);
    expect(result.report.allPassed).toBe(true);
    expect(result.effects.productionActivated).toBe(false);
    expect(result.effects.pm2Started).toBe(false);
    expect(result.goNoGoAssessment.requiredConditions.length).toBeGreaterThan(0);
  });

  test('environment validation report is deterministic', () => {
    const a = validateEnvironmentConfiguration();
    const b = validateEnvironmentConfiguration();
    expect(a.reportId).toBe('FT1B_ENVIRONMENT_VALIDATION_REPORT');
    expect(a.allPassed).toBe(true);
    expect(a.envExampleKeyCount).toBe(b.envExampleKeyCount);
    expect(a.checks.map((c) => c.checkId)).toEqual(b.checks.map((c) => c.checkId));
  });

  test('go/no-go requires operator authorization', () => {
    const assessment = assessGoNoGo({
      partA: validateEnvironmentConfiguration(),
    });
    expect(assessment.decision).toBe(DECISION_OUTCOMES.GO_WITH_CONDITIONS);
    expect(
      assessment.requiredConditions.some(
        (c) => c.conditionId === 'EXPLICIT_OPERATOR_AUTHORIZATION'
      )
    ).toBe(true);
  });
});
