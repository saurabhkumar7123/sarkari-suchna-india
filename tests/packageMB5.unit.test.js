'use strict';

/**
 * Package MB-5 — Product-side unit tests (controlled scheduler + TG-1 + RW-1).
 */

const {
  evaluateProductControlledScheduler,
  createProductControlledScheduler,
  runProductControlledAdvisoryCycle,
  getControlledSchedulerFramework,
  TEMPLATE_KINDS,
  formatTelegramMessage,
  createMemoryTransport,
  deliverTelegramNotification,
  wireAdvisoryCandidateToReviewQueue,
} = require('../server/lib/monitoringBot/controlledScheduler');

describe('Package MB-5 controlled scheduler (product facade)', () => {
  test('framework identity is MB-5 combined package ready for FT-1', () => {
    const framework = getControlledSchedulerFramework();
    expect(framework.packageCode).toBe('MB-5');
    expect(framework.combinedPackage).toBe('MB-5 + TG-1 + RW-1');
    expect(framework.manualInvocationOnly).toBe(true);
    expect(framework.packageMB5Complete).toBe(true);
    expect(framework.packageTG1Complete).toBe(true);
    expect(framework.packageRW1Complete).toBe(true);
    expect(framework.schedulerDisabledByDefault).toBe(true);
    expect(framework.packageSummary.canPublish).toBe(false);
    expect(framework.runtimeEffects.publishingExecuted).toBe(false);
    expect(framework.runtimeEffects.cronInstalled).toBe(false);
    expect(framework.extensionPoints.PROGRAM_6_HARDENING.activated).toBe(false);
    expect(framework.packageSummary.nextPackage).toBe('FT-1');
  });

  test('product evaluation reuses MB-1..4, TG-1, RW-1, Program 5', () => {
    const result = evaluateProductControlledScheduler();
    expect(result.productReuse.mb4PipelineIntegration).toBe(true);
    expect(result.productReuse.tg1TelegramNotification).toBe(true);
    expect(result.productReuse.rw1ReviewQueueWiring).toBe(true);
    expect(result.productReuse.programs1to5Complete).toBe(true);
    expect(result.readyForFT1).toBe(true);
    expect(result.schedulerHealth.enabled).toBe(false);
    expect(result.effects.published).toBe(false);
  });

  test('product scheduler disabled by default', async () => {
    const scheduler = createProductControlledScheduler();
    expect(scheduler.isEnabled()).toBe(false);
    const blocked = await scheduler.invoke({ sourceIds: ['UPSC'] });
    expect(blocked.invoked).toBe(false);
    expect(blocked.reason).toBe('SCHEDULER_DISABLED');
  });

  test('product controlled cycle generates review without publishing', async () => {
    const result = await runProductControlledAdvisoryCycle({
      sourceId: 'UPSC',
      detectionResult: {
        sourceId: 'UPSC',
        detectionStatus: 'CHANGED',
        fetchUrl: 'https://www.upsc.gov.in/whats-new',
        fingerprint: { fingerprint: 'product-mb5-fp' },
        timestamp: '2026-07-19T16:00:00.000Z',
      },
      body: `
        <html><body>
          <h1>UPSC CDS 2026 Notification</h1>
          <p>Advertisement No: UPSC/CDS/2026/01</p>
          <p>Organization: Union Public Service Commission</p>
          <p>Department: UPSC</p>
          <p>Qualification: Graduate</p>
          <p>Last Date: 2026-09-01</p>
        </body></html>
      `,
      allowNotificationDelivery: true,
      notificationTransport: createMemoryTransport(),
      timestamp: '2026-07-19T16:00:00.000Z',
    });

    expect(result.productFacade).toBe('CONTROLLED_SCHEDULER');
    expect(result.publishingDenied).toBe(true);
    expect(result.automaticApprovalDenied).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.extractionResult).toBeTruthy();
    expect(result.pipelineResult).toBeTruthy();
    expect(result.notificationResult).toBeTruthy();
    expect(result.reviewResult).toBeTruthy();
    expect(result.reviewResult.databaseWriteDenied).toBe(true);
    expect(result.effects.published).toBe(false);
  });

  test('telegram template and delivery stay credential-free', async () => {
    const formatted = formatTelegramMessage({
      kind: TEMPLATE_KINDS.SUCCESS,
      recruitmentTitle: 'Product Test',
      department: 'Test',
      source: 'UPSC',
      confidence: 0.75,
      detectionTime: '2026-07-19T16:00:00.000Z',
      reviewIdentifier: 'rev-1',
      summary: 'Summary',
      officialUrl: 'https://www.upsc.gov.in',
    });
    expect(formatted.text).toContain('Title: Product Test');

    const delivery = await deliverTelegramNotification({
      allowDelivery: false,
      context: { success: true },
      recruitmentTitle: 'Product Test',
      source: 'UPSC',
    });
    expect(delivery.skipped).toBe(true);
    expect(delivery.productionCredentialsUsed).toBe(false);
  });

  test('review wiring payload remains non-persistent', () => {
    const wired = wireAdvisoryCandidateToReviewQueue({
      candidate: {
        candidateId: 'c-product',
        source: 'IBPS',
        sourceUrl: 'https://www.ibps.in',
        title: 'IBPS PO',
        confidence: 0.82,
      },
      pipelineResult: {
        pipelinePayload: {
          candidate: {
            candidateId: 'c-product',
            source: 'IBPS',
            sourceUrl: 'https://www.ibps.in',
            title: 'IBPS PO',
            confidence: 0.82,
          },
          confidence: 0.82,
          duplicateStatus: 'UNIQUE',
        },
        preview: { previewId: 'preview-1' },
        program5: {
          monitoringReview: { validation: { status: 'PASS' } },
          lifecycle: {},
          draft: { draftReady: true },
          resolution: {},
          publishReadiness: {},
        },
      },
    });

    expect(wired.productionQueueInsert).toBe(false);
    expect(wired.operatorReview.candidateId).toBe('c-product');
    expect(wired.diagnostics.readinessSummary.publishReady).toBe(false);
  });
});
