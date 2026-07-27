'use strict';

/**
 * Package MB-3 — Product-side unit tests (advisory recruitment extraction).
 */

const {
  EXTRACTION_STATUSES,
  DUPLICATE_STATUS,
  evaluateProductRecruitmentExtraction,
  extractProductRecruitment,
  getRecruitmentExtractionFramework,
  createStructuredRecruitment,
  detectAdvisoryDuplicate,
} = require('../server/lib/monitoringBot/recruitmentExtraction');

describe('Package MB-3 recruitment extraction (product facade)', () => {
  test('framework identity is MB-3 advisory extraction ready for MB-4', () => {
    const framework = getRecruitmentExtractionFramework();
    expect(framework.packageCode).toBe('MB-3');
    expect(framework.manualInvocationOnly).toBe(true);
    expect(framework.packageMB3Complete).toBe(true);
    expect(framework.packageMB4Ready).toBe(true);
    expect(framework.packageMB4Activated).toBe(false);
    expect(framework.packageSummary.canExtractJobs).toBe(true);
    expect(framework.packageSummary.canPublish).toBe(false);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.telegramSent).toBe(false);
    expect(framework.extensionPoints.MB5_CONTROLLED_SCHEDULER.activated).toBe(
      false
    );
  });

  test('product evaluation reuses MB-1 parser registry and MB-2', () => {
    const result = evaluateProductRecruitmentExtraction();
    expect(result.productReuse.mb1GovernmentSourceRegistry).toBe(true);
    expect(result.productReuse.mb1ParserRegistry).toBe(true);
    expect(result.productReuse.mb2WebsiteChangeDetection).toBe(true);
    expect(result.productReuse.programs1to5Complete).toBe(true);
    expect(result.readyForMB4).toBe(true);
    expect(result.mb4Activated).toBe(false);
    expect(result.parserRegistry.byId.PARSER_SSC_HTML_V1).toBeTruthy();
  });

  test('product extraction creates advisory candidate without publishing', () => {
    const result = extractProductRecruitment({
      sourceId: 'SSC_NIC',
      forceExtract: true,
      body: `
        <html><body>
          <h1>SSC CHSL 2026 Notification</h1>
          <p>Advertisement No: SSC/CHSL/2026/01</p>
          <p>Last Date: 2026-08-01</p>
          <p>Total Vacancies: 1200</p>
        </body></html>
      `,
      detectionResult: {
        sourceId: 'SSC_NIC',
        detectionStatus: 'CHANGED',
        fetchUrl: 'https://ssc.nic.in/Portal/LatestNews',
        fingerprint: { fingerprint: 'product-fp-1' },
      },
    });

    expect(result.publishingDenied).toBe(true);
    expect(result.telegramDenied).toBe(true);
    expect(result.schedulerDenied).toBe(true);
    expect(result.databaseWriteDenied).toBe(true);
    expect(result.effects.published).toBe(false);
    expect(result.candidate).toBeTruthy();
    expect(result.recruitment.sourceId).toBe('SSC_NIC');
    expect([
      EXTRACTION_STATUSES.EXTRACTED,
      EXTRACTION_STATUSES.PARTIAL,
    ]).toContain(result.extractionStatus);
  });

  test('duplicate detection remains advisory', () => {
    const recruitment = createStructuredRecruitment({
      sourceId: 'IBPS',
      recruitmentTitle: 'IBPS PO',
      advertisementNumber: 'IBPS/PO/1',
      officialUrl: 'https://www.ibps.in',
      confidenceScore: 0.8,
    });
    const duplicate = detectAdvisoryDuplicate({
      recruitment,
      existingRecruitments: [recruitment],
    });
    expect(duplicate.duplicateStatus).toBe(DUPLICATE_STATUS.EXACT_DUPLICATE);
    expect(duplicate.mergeDenied).toBe(true);
  });
});
