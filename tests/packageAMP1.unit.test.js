'use strict';

/**
 * Package AMP-1 — Product-side unit tests (advisory recruitment intelligence).
 */

const {
  PACKAGE_CODE,
  processProductRecruitmentIntelligence,
  processRecruitmentIntelligence,
  getRecruitmentIntelligenceBrainFramework,
  classifyStageFromNotification,
  matchRecruitment,
  recoverRecruitmentHistory,
  detectDuplicates,
  computeConfidence,
  detectMissingInformation,
  validateRecruitment,
  evaluateDraftReadiness,
  decidePageAction,
  mapToRendererSections,
  buildGeneratorPayload,
  UPDATE_DECISION,
  PAGE_DECISION,
  CANONICAL_SECTIONS,
} = require('../server/lib/recruitment/recruitmentIntelligenceBrain');

const FULL_NOTIFICATION = {
  title: 'IBPS PO 2026 Notification - Advt No. CRP-PO/01/2026',
  url: 'https://www.ibps.in/notification/po-2026',
  department: 'ibps',
  organization: 'IBPS',
  advertisementNumber: 'CRP-PO/01/2026',
  eligibility: 'Graduation',
  selectionProcess: 'Prelims, Mains, Interview',
  totalPosts: 4000,
  postName: 'Probationary Officer',
  importantDates: [
    { label: 'Online Apply Start Date', date: '2026-06-01' },
    { label: 'Last Date', date: '2026-07-01' },
  ],
  importantLinks: [
    { label: 'Apply Online', url: 'https://www.ibps.in/apply' },
  ],
};

describe('Package AMP-1 Recruitment Intelligence Brain (product advisory)', () => {
  test('framework identity is AMP-1 advisory-only', () => {
    const framework = getRecruitmentIntelligenceBrainFramework();
    expect(framework.packageCode).toBe('AMP-1');
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.recruitmentPipelineEnabled).toBe(false);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.pipelineEnabled).toBe(false);
    expect(framework.runtimeEffects.pagePublished).toBe(false);
    expect(framework.runtimeEffects.schedulerActivated).toBe(false);
    expect(framework.runtimeEffects.workerActivated).toBe(false);
    expect(framework.safetyBoundaries.htmlGenerationDenied).toBe(true);
    expect(framework.safetyBoundaries.pipelineActivationDenied).toBe(true);
    expect(framework.program5AutomationAuthorized).toBe(false);
  });

  test('product processing reuses Program 5 identities', () => {
    const result = processProductRecruitmentIntelligence({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });

    expect(result.productReuse.draftPreparation).toBe(true);
    expect(result.productReuse.controlledLifecycleEngine).toBe(true);
    expect(result.productReuse.monitoringReviewIntegration).toBe(true);
    expect(result.productReuse.generator).toBe(true);
    expect(result.productReuse.recruitmentOperations).toBe(true);
    expect(result.effects.productionDraftCreated).toBe(false);
    expect(result.effects.recruitmentPipelineActivated).toBe(false);
    expect(result.effects.pipelineEnabled).toBe(false);
    expect(result.editorialAlignment.reusedModule).toBe('RECRUITMENT_INTELLIGENCE_BRAIN');
  });

  test('creates complete recruitment object from vacancy notification', () => {
    const result = processRecruitmentIntelligence({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });

    const obj = result.recruitmentObject;
    expect(obj.recruitmentName).toContain('IBPS PO');
    expect(obj.advertisementNumber).toBe('CRP-PO/01/2026');
    expect(obj.department).toBe('ibps');
    expect(obj.currentStage).toBe('vacancy');
    expect(obj.timeline.length).toBeGreaterThan(0);
    expect(obj.confidenceScore).toBeGreaterThan(0);
    expect(obj.schemaVersion).toMatch(/^AMP1/);
    expect(obj.metadata.advisoryOnly).toBe(true);
  });

  test('classifies lifecycle stages correctly', () => {
    expect(classifyStageFromNotification({ title: 'Admit Card Download SSC CGL 2026' }).stage).toBe('admit_card');
    expect(classifyStageFromNotification({ title: 'Final Result SSC CGL 2026' }).stage).toBe('final_result');
    expect(classifyStageFromNotification({ title: 'Corrigendum to Notification' }).stage).toBe('correction');
    expect(classifyStageFromNotification({ title: 'Answer Key Published' }).stage).toBe('answer_key');
    expect(classifyStageFromNotification({ eventType: 'dv', title: 'DV Schedule' }).stage).toBe('dv');
  });

  test('matches existing recruitment by advertisement number', () => {
    const match = matchRecruitment(
      { title: 'SSC CGL Admit Card', advertisementNumber: 'CGL/01/2026', department: 'ssc' },
      [{ recruitmentId: 'r1', advertisementNumber: 'CGL/01/2026', organization: 'ssc', recruitmentName: 'SSC CGL 2026' }]
    );
    expect(match.match).toBe(true);
    expect(match.recruitmentId).toBe('r1');
    expect(match.confidence).toBeGreaterThanOrEqual(50);
  });

  test('does not create new recruitment when match is confident', () => {
    const result = processRecruitmentIntelligence({
      notification: {
        title: 'SSC CGL 2026 Tier-I Result',
        eventType: 'result',
        advertisementNumber: 'CGL/01/2026',
        department: 'ssc',
      },
      existingRecruitments: [
        {
          recruitmentId: 'r1',
          recruitmentName: 'SSC CGL 2026',
          advertisementNumber: 'CGL/01/2026',
          organization: 'ssc',
          department: 'ssc',
        },
      ],
      generatedAt: '2026-10-01T10:00:00.000Z',
    });

    expect(result.matchResult.match).toBe(true);
    expect(result.updateDecision.decision).toBe(UPDATE_DECISION.UPDATE_EXISTING_RECRUITMENT);
    expect(result.recruitmentObject.currentStage).toBe('result');
  });

  test('recovers history when first notification is admit card', () => {
    const recovery = recoverRecruitmentHistory({
      notification: {
        title: 'SSC CGL 2026 Admit Card',
        advertisementNumber: 'CGL/01/2026',
        department: 'ssc',
      },
      sourceSearchResults: [
        {
          title: 'SSC CGL 2026 Notification Advt CGL/01/2026',
          url: 'https://ssc.nic.in/notif',
          eligibility: 'Graduation',
          selectionProcess: 'CBT',
          advertisementNumber: 'CGL/01/2026',
          department: 'ssc',
          relevanceScore: 90,
        },
      ],
    });

    expect(recovery.historyRecovered).toBe(true);
    expect(recovery.hasPrimaryNotification).toBe(true);
    expect(recovery.mergedRecruitment.eligibility).toBe('Graduation');
  });

  test('detects stage context with previous and next stages', () => {
    const result = processRecruitmentIntelligence({
      notification: {
        title: 'SSC CGL 2026 Answer Key',
        eventType: 'answer_key',
        advertisementNumber: 'CGL/01/2026',
        department: 'ssc',
      },
      existingRecruitments: [
        {
          recruitmentId: 'r1',
          recruitmentName: 'SSC CGL 2026',
          advertisementNumber: 'CGL/01/2026',
          organization: 'ssc',
          history: [
            { stage: 'vacancy', eventType: 'notification' },
            { stage: 'admit_card', eventType: 'admit_card' },
          ],
        },
      ],
      generatedAt: '2026-09-01T10:00:00.000Z',
    });

    expect(result.recruitmentObject.currentStage).toBe('answer_key');
    expect(result.recruitmentObject.previousStage).toBeTruthy();
    expect(Array.isArray(result.recruitmentObject.possibleNextStages)).toBe(true);
    expect(Array.isArray(result.recruitmentObject.missingStages)).toBe(true);
  });

  test('duplicate detection ignores duplicate notifications', () => {
    const dup = detectDuplicates({
      notification: FULL_NOTIFICATION,
      existingNotifications: [FULL_NOTIFICATION],
    });
    expect(dup.isDuplicate).toBe(true);

    const result = processRecruitmentIntelligence({
      notification: FULL_NOTIFICATION,
      existingNotifications: [FULL_NOTIFICATION],
      generatedAt: '2026-06-01T10:00:00.000Z',
    });
    expect(result.updateDecision.decision).toBe(UPDATE_DECISION.IGNORE_DUPLICATE);
  });

  test('confidence engine produces 0-100 with explanation', () => {
    const result = processRecruitmentIntelligence({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });
    expect(result.confidence.score).toBeGreaterThanOrEqual(0);
    expect(result.confidence.score).toBeLessThanOrEqual(100);
    expect(result.confidence.explanation.length).toBeGreaterThan(0);
  });

  test('missing information engine detects gaps', () => {
    const missing = detectMissingInformation({ recruitmentName: 'Test' });
    expect(missing.missingCount).toBeGreaterThan(0);
    expect(missing.complete).toBe(false);
  });

  test('validation engine validates URLs and dates', () => {
    const valid = validateRecruitment({
      officialWebsite: 'https://ssc.nic.in',
      officialNotification: 'https://ssc.nic.in/notif',
      importantDates: [{ label: 'Last Date', date: '2026-05-15' }],
      importantLinks: [{ label: 'PDF', url: 'https://ssc.nic.in/a.pdf' }],
      timeline: [{ order: 10, stage: 'vacancy' }],
    });
    expect(valid.valid).toBe(true);

    const invalid = validateRecruitment({
      officialWebsite: 'not-a-url',
      importantDates: [{ label: 'Bad', date: 'not-a-date' }],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.length).toBeGreaterThan(0);
  });

  test('draft readiness evaluates readiness', () => {
    const result = processRecruitmentIntelligence({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });
    expect(result.draftReadiness).toBeDefined();
    expect(typeof result.draftReadiness.ready).toBe('boolean');
    expect(Array.isArray(result.draftReadiness.reasons)).toBe(true);
  });

  test('page decision engine recommends actions', () => {
    const page = decidePageAction({
      updateDecision: { decision: UPDATE_DECISION.CREATE_NEW_RECRUITMENT },
      draftReadiness: { ready: true, reasons: [] },
      duplicateResult: { isDuplicate: false },
    });
    expect(page.decision).toBe(PAGE_DECISION.CREATE_NEW_PAGE);
  });

  test('renderer compatibility produces generator sections without HTML', () => {
    const sections = mapToRendererSections({
      recruitmentName: 'Test Recruitment',
      advertisementNumber: 'TEST/01/2026',
      eligibility: 'Graduation',
      importantDates: [{ label: 'Last Date', date: '2026-05-15' }],
      vacancy: { postName: 'Clerk', totalPosts: 100 },
    });

    expect(sections[CANONICAL_SECTIONS.SHORT_INFORMATION]).toBeTruthy();
    expect(sections[CANONICAL_SECTIONS.IMPORTANT_DATES]).toContain('Last Date');
    expect(sections[CANONICAL_SECTIONS.ELIGIBILITY]).toBe('Graduation');

    const payload = buildGeneratorPayload({
      recruitmentName: 'Test',
      importantDates: [{ label: 'Last Date', date: '2026-05-15' }],
      eligibility: 'Grad',
      vacancy: { postName: 'Clerk', totalPosts: 100 },
      selectionProcess: 'CBT',
    });
    expect(payload.data).toContain('[Section:');
    expect(payload.htmlGenerated).toBe(false);
    expect(payload.rendererCompatible).toBe(true);
  });

  test('output is deep frozen and has no production effects', () => {
    const result = processProductRecruitmentIntelligence({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recruitmentObject)).toBe(true);
    expect(result.effects.productionActivated).toBe(false);
    expect(result.effects.pagePublished).toBe(false);
    expect(result.effects.draftCreated).toBe(false);
    expect(result.effects.dbWritten).toBe(false);
    expect(result.effects.schedulerActivated).toBe(false);
    expect(result.effects.workerActivated).toBe(false);
  });
});
