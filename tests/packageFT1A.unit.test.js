'use strict';

/**
 * Package FT-1A — Product-side unit tests (system validation).
 */

const {
  evaluateProductSystemValidation,
  getSystemValidationHardeningFramework,
  APPROVED_ACTIVE_SOURCE_IDS,
  auditGovernmentSources,
  investigateOpenHandles,
} = require('../server/lib/monitoringBot/systemValidation');

describe('Package FT-1A system validation (product facade)', () => {
  test('framework identity is FT-1A ready for FT-1B', () => {
    const framework = getSystemValidationHardeningFramework();
    expect(framework.packageCode).toBe('FT-1A');
    expect(framework.stageId).toBe('STAGE_2_FINAL_HARDENING_AND_TESTING');
    expect(framework.validationOnly).toBe(true);
    expect(framework.productionActivated).toBe(false);
    expect(framework.packageSummary.canPublish).toBe(false);
    expect(framework.packageSummary.nextPackage).toBe('FT-1B');
    expect(framework.runtimeEffects.cronInstalled).toBe(false);
  });

  test('product evaluation validates all parts and is ready for FT-1B', async () => {
    const result = await evaluateProductSystemValidation({
      generatedAt: '2026-07-20T00:00:00.000Z',
    });
    expect(result.productReuse.mb5ControlledScheduler).toBe(true);
    expect(result.productReuse.tg1TelegramNotification).toBe(true);
    expect(result.productReuse.rw1ReviewQueueWiring).toBe(true);
    expect(result.readyForFT1B).toBe(true);
    expect(result.report.allPassed).toBe(true);
    expect(result.effects.productionActivated).toBe(false);
    expect(result.report.confirmations.schedulerSafe).toBe(true);
    expect(result.report.confirmations.telegramSafe).toBe(true);
  }, 60000);

  test('source audit confirms approved government sources only', async () => {
    const audit = await auditGovernmentSources();
    expect(audit.allPassed).toBe(true);
    expect([...audit.activeSourceIds].sort()).toEqual(
      [...APPROVED_ACTIVE_SOURCE_IDS].sort()
    );
    expect(audit.thirdPartyInRegistry).toHaveLength(0);
  });

  test('open handle investigation does not change runtime behavior', () => {
    const investigation = investigateOpenHandles();
    expect(investigation.runtimeBehaviorChanged).toBe(false);
    expect(investigation.findings.length).toBeGreaterThan(0);
    expect(investigation.detectOpenHandlesCommand).toContain('detectOpenHandles');
  });
});
