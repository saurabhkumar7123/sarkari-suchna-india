'use strict';

/**
 * Package MB-2 — Product-side unit tests (manual website change detection).
 */

const {
  DETECTION_STATUS,
  CHANGE_CLASSES,
  DIAGNOSTIC_CODES,
  CONTENT_TYPES,
  evaluateProductWebsiteChangeDetection,
  detectProductWebsiteChange,
  getWebsiteChangeDetectionFramework,
  generateContentFingerprint,
} = require('../server/lib/monitoringBot/websiteChangeDetection');

describe('Package MB-2 website change detection (product facade)', () => {
  test('framework identity is MB-2 manual detection ready for MB-3', () => {
    const framework = getWebsiteChangeDetectionFramework();
    expect(framework.packageCode).toBe('MB-2');
    expect(framework.manualInvocationOnly).toBe(true);
    expect(framework.packageMB2Complete).toBe(true);
    expect(framework.packageMB3Ready).toBe(true);
    expect(framework.packageMB3Activated).toBe(false);
    expect(framework.packageSummary.canDetectChange).toBe(true);
    expect(framework.packageSummary.canExtractJobs).toBe(false);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.telegramSent).toBe(false);
    expect(framework.extensionPoints.MB3_RECRUITMENT_EXTRACTION.activated).toBe(
      false
    );
  });

  test('product evaluation reuses MB-1 registry configuration', () => {
    const result = evaluateProductWebsiteChangeDetection();
    expect(result.productReuse.mb1GovernmentSourceRegistry).toBe(true);
    expect(result.productReuse.mb1MonitoringConfiguration).toBe(true);
    expect(result.productReuse.programs1to5Complete).toBe(true);
    expect(result.readyForMB3).toBe(true);
    expect(result.mb3Activated).toBe(false);
    expect(result.sourceRegistry.byId.SSC_NIC).toBeTruthy();
    expect(
      result.monitoringConfiguration.bySourceId.SSC_NIC.expectedContentType
    ).toBe(CONTENT_TYPES.HTML);
  });

  test('product manual detection can report change without extraction', async () => {
    const previous = generateContentFingerprint({
      body: '<html><body>Before</body></html>',
      contentType: CONTENT_TYPES.HTML,
      sourceId: 'IBPS',
    });

    const result = await detectProductWebsiteChange({
      sourceId: 'IBPS',
      previousFingerprint: previous,
      transport: async () => ({
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: Buffer.from('<html><body>After</body></html>'),
      }),
    });

    expect(result.detectionStatus).toBe(DETECTION_STATUS.CHANGED);
    expect(result.extractionDenied).toBe(true);
    expect(result.reviewDenied).toBe(true);
    expect(result.telegramDenied).toBe(true);
    expect(result.publishingDenied).toBe(true);
    expect(result.effects.recruitmentExtracted).toBe(false);
    expect(result.classification.classification).toBe(
      CHANGE_CLASSES.CONTENT_UPDATED
    );
    expect(result.diagnostics.codes).toContain(DIAGNOSTIC_CODES.CHANGE_DETECTED);
  });
});
