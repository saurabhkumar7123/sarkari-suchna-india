'use strict';

/**
 * AMP-2 Automation Workflow Orchestrator.
 *
 * Advisory-only orchestration layer:
 * bot/update input -> AMP-1 intelligence -> draft package -> review artifacts.
 *
 * No persistence. No Telegram sending. No publishing.
 */

const { deepFreeze, pickString } = require('../recruitmentIntelligence/utils');
const {
  processRecruitmentIntelligence,
} = require('../recruitmentIntelligence/recruitmentBrainOrchestrator');
const {
  WORKFLOW_MODULES_VERSION,
  WORKFLOW_STATES,
  APPROVAL_STATES,
  createWorkflowVersionRecord,
  createWorkflowStateMachine,
  createDraftDifference,
  coordinateDraftGeneration,
  buildTelegramReviewMessage,
  buildApprovalWorkflowModel,
  buildReviewQueue,
  createAutomationAuditLog,
  collectWorkflowMetrics,
  evaluateFailureRecovery,
  createSafetyEnvelope,
  createWorkflowDiagram,
} = require('./workflowModules');

const AUTOMATION_ORCHESTRATOR_VERSION = 'AMP2.1.0.0';

function deriveWorkflowState(intelligenceResult) {
  if (!intelligenceResult || !intelligenceResult.validation) {
    return WORKFLOW_STATES.DETECTED;
  }
  if (intelligenceResult.validation.valid === false) {
    return WORKFLOW_STATES.REVIEW_PENDING;
  }
  if (intelligenceResult.draftReadiness && intelligenceResult.draftReadiness.ready) {
    return WORKFLOW_STATES.DRAFT_READY;
  }
  return WORKFLOW_STATES.VALIDATED;
}

function buildAuditEntries(result, workflowState, generatedAt) {
  return [
    {
      eventType: 'Detection',
      state: WORKFLOW_STATES.DETECTED,
      message: 'Recruitment notification detected for advisory processing.',
      timestamp: generatedAt,
    },
    {
      eventType: 'Matching',
      state: WORKFLOW_STATES.MATCHING,
      message: result.matchResult && result.matchResult.match ? 'Matched existing recruitment.' : 'No existing recruitment match found.',
      timestamp: generatedAt,
    },
    {
      eventType: 'History Recovery',
      state: WORKFLOW_STATES.HISTORY_RECOVERY,
      message:
        result.historyRecovery && result.historyRecovery.historyRecovered
          ? 'Recovered historical lifecycle context.'
          : 'No historical recovery required.',
      timestamp: generatedAt,
    },
    {
      eventType: 'Validation',
      state: WORKFLOW_STATES.VALIDATED,
      message:
        result.validation && result.validation.valid
          ? 'Recruitment object validated successfully.'
          : 'Validation requires manual review.',
      timestamp: generatedAt,
      retryable: result.validation && result.validation.valid === false,
    },
    {
      eventType: 'Draft',
      state: WORKFLOW_STATES.DRAFT_READY,
      message: 'Draft package and preview prepared for manual review.',
      timestamp: generatedAt,
    },
    {
      eventType: 'Telegram Build',
      state: WORKFLOW_STATES.TELEGRAM_PENDING,
      message: 'Telegram review message prepared as placeholder-only payload.',
      timestamp: generatedAt,
    },
    {
      eventType: 'Approval',
      state: workflowState,
      message: 'Approval remains manual-only and future publish is disabled.',
      timestamp: generatedAt,
    },
  ];
}

function buildMetricsRecord(input) {
  return {
    draftCreated: input.workflowState === WORKFLOW_STATES.DRAFT_READY,
    updated: Boolean(input.updateDecision && /UPDATE/i.test(input.updateDecision.decision || '')),
    merged: Boolean(input.historyRecovery && input.historyRecovery.historyRecovered),
    duplicate: Boolean(input.duplicateResult && input.duplicateResult.isDuplicate),
    validationValid: Boolean(input.validation && input.validation.valid),
    confidence:
      typeof input.confidence?.score === 'number' ? input.confidence.score : 0,
    department:
      pickString(input.recruitmentObject?.department) || 'UNKNOWN',
    reviewTimeMs: 0,
    processingTimeMs: 0,
    currentState: input.workflowState,
  };
}

/**
 * Run the advisory automation workflow.
 *
 * @param {object} [input]
 */
function runAutomationWorkflow(input = {}) {
  const generatedAt = pickString(input.generatedAt) || '1970-01-01T00:00:00.000Z';
  const intelligenceResult =
    input.intelligenceResult ||
    processRecruitmentIntelligence({
      notification: input.notification || {},
      existingRecruitments: input.existingRecruitments || [],
      existingNotifications: input.existingNotifications || [],
      existingPages: input.existingPages || [],
      sourceSearchResults: input.sourceSearchResults || [],
      existingPage: input.existingPage || null,
      generatedAt,
    });

  const workflowState = deriveWorkflowState(intelligenceResult);
  const stateMachine = createWorkflowStateMachine({
    currentState: workflowState,
  });

  const workflowVersion = createWorkflowVersionRecord({
    entityId: intelligenceResult.recruitmentObject?.recruitmentId,
    scope: 'workflow',
    sequence: input.versionSequence || 1,
    generatedAt,
    previousVersionTag: pickString(input.previousWorkflowVersionTag) || null,
    content: {
      currentStage: intelligenceResult.recruitmentObject?.currentStage,
      workflowState,
      generatorPayload: intelligenceResult.generatorPayload,
    },
  });

  const draftVersion = createWorkflowVersionRecord({
    entityId: intelligenceResult.recruitmentObject?.recruitmentId,
    scope: 'draft',
    sequence: input.draftVersionSequence || 1,
    generatedAt,
    previousVersionTag: pickString(input.previousDraftVersionTag) || null,
    content: intelligenceResult.generatorPayload,
  });

  const stateVersion = createWorkflowVersionRecord({
    entityId: intelligenceResult.recruitmentObject?.recruitmentId,
    scope: 'state',
    sequence: input.stateVersionSequence || 1,
    generatedAt,
    previousVersionTag: pickString(input.previousStateVersionTag) || null,
    content: {
      state: workflowState,
      currentStage: intelligenceResult.recruitmentObject?.currentStage,
    },
  });

  const difference = createDraftDifference({
    previousVersion:
      input.previousRecruitmentVersion ||
      input.previousRendererSections ||
      null,
    currentVersion:
      intelligenceResult.recruitmentObject?.rendererSections ||
      intelligenceResult.rendererSections ||
      {},
  });

  const draftCoordination = coordinateDraftGeneration({
    recruitmentObject: intelligenceResult.recruitmentObject,
    generatorPayload: intelligenceResult.generatorPayload,
    validation: intelligenceResult.validation,
    confidence: intelligenceResult.confidence,
    warnings: intelligenceResult.reviewFlags,
    timeline: intelligenceResult.timeline && intelligenceResult.timeline.timeline,
    missingInformation: intelligenceResult.missingResult && intelligenceResult.missingResult.missingInformation,
    previousVersion:
      input.previousRecruitmentVersion ||
      input.previousRendererSections ||
      null,
    decision:
      intelligenceResult.pageDecision?.decision ||
      intelligenceResult.updateDecision?.decision,
    generatedAt,
  });

  const approvalWorkflow = buildApprovalWorkflowModel({
    state: APPROVAL_STATES.DRAFT,
    decision: 'MANUAL_REVIEW_REQUIRED',
  });

  const reviewQueue = buildReviewQueue({
    recruitmentId: intelligenceResult.recruitmentObject?.recruitmentId,
    confidence: intelligenceResult.confidence?.score,
    department: intelligenceResult.recruitmentObject?.department,
    currentStage: workflowState,
    createdAt: generatedAt,
    warnings: intelligenceResult.reviewFlags,
  });

  const telegramReview = buildTelegramReviewMessage({
    recruitment: intelligenceResult.recruitmentObject?.recruitmentName,
    recruitmentId: intelligenceResult.recruitmentObject?.recruitmentId,
    currentStage: workflowState,
    decision:
      intelligenceResult.pageDecision?.decision ||
      intelligenceResult.updateDecision?.decision ||
      'MANUAL_REVIEW_REQUIRED',
    confidence: intelligenceResult.confidence?.score,
    warnings: intelligenceResult.reviewFlags,
    summary: difference.reviewSummary,
  });

  const failureRecovery = evaluateFailureRecovery({
    state:
      intelligenceResult.validation && intelligenceResult.validation.valid === false
        ? WORKFLOW_STATES.FAILED
        : workflowState,
    reason:
      intelligenceResult.validation && intelligenceResult.validation.valid === false
        ? 'VALIDATION_REVIEW_REQUIRED'
        : 'NO_FAILURE',
    retryCount:
      typeof input.retryCount === 'number' ? input.retryCount : 0,
    rollbackState: WORKFLOW_STATES.MATCHING,
  });

  const auditLog = createAutomationAuditLog({
    generatedAt,
    entries: buildAuditEntries(intelligenceResult, workflowState, generatedAt),
  });

  const metrics = collectWorkflowMetrics({
    records: [
      buildMetricsRecord({
        ...intelligenceResult,
        workflowState,
      }),
    ],
  });

  return deepFreeze({
    orchestratorVersion: AUTOMATION_ORCHESTRATOR_VERSION,
    workflowModulesVersion: WORKFLOW_MODULES_VERSION,
    advisoryOnly: true,
    productionReady: true,
    productionEnabled: false,
    workflowStateMachine: stateMachine,
    intelligenceResult,
    recruitmentObject: intelligenceResult.recruitmentObject,
    historyRecovery: intelligenceResult.historyRecovery,
    validation: intelligenceResult.validation,
    generatorPayload: intelligenceResult.generatorPayload,
    draftCoordination,
    draftPackage: draftCoordination.draftPackage,
    draftPreview: draftCoordination.draftPreview,
    difference,
    telegramReview,
    approvalWorkflow,
    reviewQueue,
    auditLog,
    metrics,
    failureRecovery,
    versions: {
      workflow: workflowVersion,
      draft: draftVersion,
      state: stateVersion,
    },
    workflowDiagram: createWorkflowDiagram(),
    safety: createSafetyEnvelope(),
    effects: {
      productionActivated: false,
      recruitmentPipelineEnabled: false,
      pipelineEnabled: false,
      draftCreated: false,
      draftPersisted: false,
      telegramSent: false,
      reviewQueuePersisted: false,
      approved: false,
      published: false,
      schedulerActivated: false,
      workerActivated: false,
      cronActivated: false,
      liveCrawlingActivated: false,
      dbWritten: false,
      routeChanged: false,
    },
  });
}

module.exports = {
  AUTOMATION_ORCHESTRATOR_VERSION,
  runAutomationWorkflow,
};
