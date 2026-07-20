'use strict';

const {
  PACKAGE_CODE,
  WORKFLOW_STATES,
  APPROVAL_STATES,
  FAILURE_ACTIONS,
  runProductAutomationWorkflow,
  runAutomationWorkflow,
  createWorkflowStateMachine,
  createDraftDifference,
  buildDraftPackage,
  buildTelegramReviewMessage,
  buildApprovalWorkflowModel,
  buildReviewQueue,
  createAutomationAuditLog,
  collectWorkflowMetrics,
  evaluateFailureRecovery,
  createWorkflowVersionRecord,
  getAutomationWorkflowFramework,
} = require('../server/lib/recruitment/automationWorkflow');

const FULL_NOTIFICATION = {
  title: 'IBPS PO 2026 Notification - Advt No. CRP-PO/01/2026',
  url: 'https://www.ibps.in/notification/po-2026',
  sourceUrl: 'https://www.ibps.in',
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
  importantLinks: [{ label: 'Apply Online', url: 'https://www.ibps.in/apply' }],
};

describe('Package AMP-2 Automation Workflow (product advisory)', () => {
  test('framework identity is AMP-2 advisory-only', () => {
    const framework = getAutomationWorkflowFramework();
    expect(framework.packageCode).toBe('AMP-2');
    expect(PACKAGE_CODE).toBe('AMP-2');
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.productionReady).toBe(true);
    expect(framework.productionEnabled).toBe(false);
    expect(framework.recruitmentPipelineEnabled).toBe(false);
    expect(framework.safetyBoundaries.pipelineActivationDenied).toBe(true);
    expect(framework.runtimeEffects.schedulerActivated).toBe(false);
    expect(framework.runtimeEffects.published).toBe(false);
  });

  test('product workflow composes AMP-1 into draft and review artifacts', () => {
    const result = runProductAutomationWorkflow({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });

    expect(result.recruitmentObject.recruitmentName).toContain('IBPS PO');
    expect(result.workflowStateMachine.currentState).toBe(WORKFLOW_STATES.DRAFT_READY);
    expect(result.draftPackage.recruitmentId).toBe(result.recruitmentObject.recruitmentId);
    expect(result.draftPreview.previewOnly).toBe(true);
    expect(result.telegramReview.placeholdersOnly).toBe(true);
    expect(result.approvalWorkflow.state).toBe(APPROVAL_STATES.DRAFT);
    expect(result.reviewQueue.items).toHaveLength(1);
    expect(result.auditLog.entryCount).toBeGreaterThanOrEqual(6);
    expect(result.productReuse.amp1RecruitmentBrain).toBe(true);
    expect(result.effects.recruitmentPipelineActivated).toBe(false);
  });

  test('state machine exposes deterministic transitions', () => {
    const machine = createWorkflowStateMachine({
      currentState: WORKFLOW_STATES.REVIEW_PENDING,
    });
    expect(machine.allowedTransitions).toContain(WORKFLOW_STATES.APPROVED);
    expect(machine.allowedTransitions).toContain(WORKFLOW_STATES.REJECTED);
    expect(machine.retryable).toBe(true);
  });

  test('difference engine detects section, date, and link changes', () => {
    const diff = createDraftDifference({
      previousVersion: {
        shortInfo: 'A',
        importantDates: [{ label: 'Last Date', date: '2026-07-01' }],
        importantLinks: [{ label: 'Apply', url: 'https://old.example/apply' }],
      },
      currentVersion: {
        shortInfo: 'B',
        importantDates: [{ label: 'Last Date', date: '2026-07-10' }],
        importantLinks: [{ label: 'Apply', url: 'https://new.example/apply' }],
        newSection: 'Added',
      },
    });

    expect(diff.updatedSections.length).toBeGreaterThan(0);
    expect(diff.addedSections).toContain('newSection');
    expect(diff.changedDates.length).toBeGreaterThan(0);
    expect(diff.changedLinks.length).toBeGreaterThan(0);
    expect(diff.hasChanges).toBe(true);
  });

  test('draft package includes review-critical fields', () => {
    const workflow = runAutomationWorkflow({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });

    const draftPackage = buildDraftPackage({
      recruitmentObject: workflow.recruitmentObject,
      generatorPayload: workflow.generatorPayload,
      validation: workflow.validation,
      confidence: workflow.intelligenceResult.confidence,
      previousVersion: { shortInfo: 'Old' },
    });

    expect(draftPackage.structuredContent).toBeDefined();
    expect(draftPackage.generatorPayload).toBeDefined();
    expect(draftPackage.validationReport).toBeDefined();
    expect(draftPackage.previousVersion).toBeTruthy();
    expect(typeof draftPackage.changeSummary).toBe('string');
    expect(draftPackage.nextExpectedStage).toBe(WORKFLOW_STATES.REVIEW_PENDING);
  });

  test('telegram builder remains placeholder-only', () => {
    const message = buildTelegramReviewMessage({
      recruitment: 'IBPS PO 2026',
      recruitmentId: 'ibps-po-2026',
      currentStage: WORKFLOW_STATES.REVIEW_PENDING,
      decision: 'CREATE_NEW_PAGE',
      confidence: 91,
      warnings: ['LOW_CONFIDENCE'],
      summary: '1 updated section',
    });

    expect(message.sendDenied).toBe(true);
    expect(message.message.placeholders.reviewLink).toContain('PLACEHOLDER');
    expect(message.text).toContain('Publish: [PUBLISH_PLACEHOLDER_FUTURE_ONLY]');
  });

  test('approval workflow remains manual-only', () => {
    const approval = buildApprovalWorkflowModel({
      state: APPROVAL_STATES.IN_REVIEW,
      decision: 'PENDING_REVIEW',
    });
    expect(approval.manualOnly).toBe(true);
    expect(approval.allowedStates).toContain(APPROVAL_STATES.FUTURE_PUBLISH);
  });

  test('review queue, audit log, metrics, and versions are deterministic', () => {
    const queue = buildReviewQueue({
      recruitmentId: 'ibps-po-2026',
      confidence: 89,
      department: 'ibps',
      currentStage: WORKFLOW_STATES.REVIEW_PENDING,
      createdAt: '2026-06-01T10:00:00.000Z',
      warnings: ['LOW_CONFIDENCE'],
    });
    const audit = createAutomationAuditLog({
      generatedAt: '2026-06-01T10:00:00.000Z',
      entries: [{ eventType: 'Draft', state: WORKFLOW_STATES.DRAFT_READY }],
    });
    const metrics = collectWorkflowMetrics({
      records: [
        {
          draftCreated: true,
          updated: true,
          merged: false,
          duplicate: false,
          validationValid: true,
          confidence: 89,
          department: 'ibps',
          currentState: WORKFLOW_STATES.DRAFT_READY,
        },
      ],
    });
    const version = createWorkflowVersionRecord({
      entityId: 'ibps-po-2026',
      scope: 'draft',
      sequence: 2,
      generatedAt: '2026-06-01T10:00:00.000Z',
      previousVersionTag: 'AMP2.draft.1',
      content: { a: 1 },
    });

    expect(queue.items[0].priority).toBe('HIGH');
    expect(audit.entryCount).toBe(1);
    expect(metrics.draftCount).toBe(1);
    expect(metrics.updateCount).toBe(1);
    expect(version.versionTag).toBe('AMP2.draft.2');
    expect(version.previousVersionTag).toBe('AMP2.draft.1');
  });

  test('failure recovery supports retry/resume/abort/manual review/rollback', () => {
    const recovery = evaluateFailureRecovery({
      state: WORKFLOW_STATES.FAILED,
      reason: 'VALIDATION_REVIEW_REQUIRED',
      retryCount: 1,
      rollbackState: WORKFLOW_STATES.MATCHING,
    });

    expect(recovery.supportedActions).toEqual(
      expect.arrayContaining([
        FAILURE_ACTIONS.RETRY,
        FAILURE_ACTIONS.RESUME,
        FAILURE_ACTIONS.ABORT,
        FAILURE_ACTIONS.MANUAL_REVIEW,
        FAILURE_ACTIONS.ROLLBACK_STATE,
      ])
    );
    expect(recovery.productionRollbackDenied).toBe(true);
  });

  test('output is deep frozen and has no production effects', () => {
    const result = runProductAutomationWorkflow({
      notification: FULL_NOTIFICATION,
      generatedAt: '2026-06-01T10:00:00.000Z',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recruitmentObject)).toBe(true);
    expect(result.effects.productionActivated).toBe(false);
    expect(result.effects.published).toBe(false);
    expect(result.effects.telegramSent).toBe(false);
    expect(result.effects.reviewQueuePersisted).toBe(false);
    expect(result.effects.schedulerActivated).toBe(false);
    expect(result.effects.workerActivated).toBe(false);
    expect(result.safety.recruitmentPipelineEnabled).toBe(false);
  });
});
