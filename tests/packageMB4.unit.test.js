'use strict';

/**
 * Package MB-4 — Product-side unit tests (advisory pipeline integration).
 */

const {
  evaluateProductPipelineIntegration,
  integrateProductAdvisoryPipeline,
  getPipelineIntegrationFramework,
  DIAGNOSTIC_CODES,
} = require('../server/lib/monitoringBot/pipelineIntegration');

describe('Package MB-4 pipeline integration (product facade)', () => {
  test('framework identity is MB-4 advisory pipeline ready for MB-5', () => {
    const framework = getPipelineIntegrationFramework();
    expect(framework.packageCode).toBe('MB-4');
    expect(framework.manualInvocationOnly).toBe(true);
    expect(framework.packageMB4Complete).toBe(true);
    expect(framework.packageMB5Ready).toBe(true);
    expect(framework.packageMB5Activated).toBe(false);
    expect(framework.packageSummary.canIntegratePipeline).toBe(true);
    expect(framework.packageSummary.canPublish).toBe(false);
    expect(framework.runtimeEffects.publishingExecuted).toBe(false);
    expect(framework.runtimeEffects.pageGenerated).toBe(false);
    expect(framework.extensionPoints.MB5_CONTROLLED_SCHEDULER.activated).toBe(
      false
    );
  });

  test('product evaluation reuses Program 5 and MB-3', () => {
    const result = evaluateProductPipelineIntegration();
    expect(result.productReuse.mb3RecruitmentExtraction).toBe(true);
    expect(result.productReuse.program5LifecycleEngine).toBe(true);
    expect(result.productReuse.program5DraftPreparation).toBe(true);
    expect(result.productReuse.program5PublishReadiness).toBe(true);
    expect(result.productReuse.programs1to5Complete).toBe(true);
    expect(result.readyForMB5).toBe(true);
    expect(result.mb5Activated).toBe(false);
  });

  test('product integration maps extraction into Program 5 without publishing', () => {
    const result = integrateProductAdvisoryPipeline({
      sourceId: 'UPSC',
      forceExtract: true,
      body: `
        <html><body>
          <h1>UPSC CDS 2026 Notification</h1>
          <p>Advertisement No: UPSC/CDS/2026/01</p>
          <p>Organization: Union Public Service Commission</p>
          <p>Qualification: Graduate</p>
          <p>Last Date: 2026-09-01</p>
        </body></html>
      `,
      detectionResult: {
        sourceId: 'UPSC',
        detectionStatus: 'CHANGED',
        fetchUrl: 'https://www.upsc.gov.in/whats-new',
        fingerprint: { fingerprint: 'product-mb4-fp' },
      },
      timestamp: '2026-07-19T15:00:00.000Z',
    });

    expect(result.productFacade).toBe('PIPELINE_INTEGRATION');
    expect(result.publishingDenied).toBe(true);
    expect(result.pageGenerationDenied).toBe(true);
    expect(result.telegramDenied).toBe(true);
    expect(result.schedulerDenied).toBe(true);
    expect(result.runtimeActivationDenied).toBe(true);
    expect(result.effects.published).toBe(false);
    expect(result.effects.runtimeActivated).toBe(false);
    expect(result.pipelinePayload.program5Compatible).toBe(true);
    expect(result.pipelinePayload.candidate.source).toBe('UPSC');
    expect(result.program5.monitoringReview).toBeTruthy();
    expect(result.program5.lifecycle).toBeTruthy();
    expect(result.program5.publishReadiness).toBeTruthy();
    expect(result.preview.pageGenerationDenied).toBe(true);
    expect(result.diagnostics.codes.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.codes.includes(DIAGNOSTIC_CODES.READY_ADVISORY) ||
        result.diagnostics.codes.includes(DIAGNOSTIC_CODES.NOT_READY) ||
        result.diagnostics.codes.includes(DIAGNOSTIC_CODES.VALIDATION_WARN) ||
        result.diagnostics.codes.includes(DIAGNOSTIC_CODES.VALIDATION_PASS) ||
        result.diagnostics.codes.includes(DIAGNOSTIC_CODES.VALIDATION_FAIL)
    ).toBe(true);
  });
});
