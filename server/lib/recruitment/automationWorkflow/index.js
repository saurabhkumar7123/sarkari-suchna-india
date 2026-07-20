'use strict';

/**
 * Package AMP-2 / AMP-4B — Product-side Automation Workflow facade.
 *
 * Thin composition layer over the AMP-2 framework with production persistence
 * when feature flags permit. Publishing remains manual-only.
 */

const path = require('path');
const { getAutomationFlags } = require('../../../config/automationFlags');
const workflowEnterpriseRepository = require('../../../repositories/enterprise/workflowEnterprise.repository');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/program5/packageAMP2AutomationWorkflowFramework.js'
);

const framework = require(frameworkPath);

function runProductAutomationWorkflow(input = {}) {
  const result = framework.runAutomationWorkflow({
    ...input,
    generatedAt: input.generatedAt || new Date().toISOString(),
  });

  return Object.freeze({
    ...result,
    workflowState: result.workflowStateMachine?.currentState || result.workflowState,
    productReuse: Object.freeze({
      amp1RecruitmentBrain: true,
      draftPreparation: true,
      reviewQueue: true,
      telegramReview: true,
      workflowVersioning: true,
    }),
    editorialAlignment: Object.freeze({
      reusedModule: 'AUTOMATION_WORKFLOW',
      reviewReady: true,
      publishReady: false,
      manualApprovalOnly: true,
    }),
    effects: Object.freeze({
      ...result.effects,
      productionEnabled: getAutomationFlags().RECRUITMENT_PIPELINE_ENABLED === true,
      recruitmentPipelineActivated: getAutomationFlags().RECRUITMENT_PIPELINE_ENABLED === true,
      autoPublishBlocked: getAutomationFlags().AUTO_PUBLISH_ENABLED !== true,
    }),
  });
}

async function persistWorkflowTransition(workflowResult, input = {}) {
  const recruitmentId =
    workflowResult.recruitmentObject?.recruitmentId ||
    input.recruitmentId ||
    input.updateId ||
    'unknown';
  const workflowKey = `runtime:${recruitmentId}:${input.updateId || Date.now()}`;
  const failureRecovery = workflowResult.failureRecovery || {};
  const currentState = workflowResult.workflowStateMachine?.currentState || workflowResult.workflowState || 'detected';

  const existing = await workflowEnterpriseRepository.getByKey(workflowKey);
  if (!existing) {
    return workflowEnterpriseRepository.createWorkflow({
      workflow_key: workflowKey,
      workflow_version: 1,
      current_state: currentState,
      retry_count: failureRecovery.retryCount || 0,
      failure_reason: failureRecovery.reason || null,
      rollback_point: failureRecovery.rollbackState || null,
      state_json: {
        orchestratorVersion: workflowResult.orchestratorVersion,
        updateId: input.updateId || null,
      },
      history_json: [
        {
          state: currentState,
          at: new Date().toISOString(),
          event: 'production_orchestration',
        },
      ],
      started_at: new Date().toISOString(),
    });
  }

  return workflowEnterpriseRepository.updateWorkflow(
    workflowKey,
    {
      current_state: currentState,
      retry_count: failureRecovery.retryCount || existing.retry_count || 0,
      failure_reason: failureRecovery.reason || existing.failure_reason,
      rollback_point: failureRecovery.rollbackState || existing.rollback_point,
      history_entry: {
        state: currentState,
        at: new Date().toISOString(),
        event: 'production_transition',
      },
      lock_version: existing.lock_version,
    },
    { changeSummary: `Production workflow -> ${currentState}` }
  );
}

async function runProductionAutomationWorkflow(input = {}) {
  const flags = getAutomationFlags();
  const workflowResult = runProductAutomationWorkflow(input);
  const productionEnabled = flags.RECRUITMENT_PIPELINE_ENABLED === true;

  let persistedWorkflow = null;
  if (productionEnabled) {
    try {
      persistedWorkflow = await persistWorkflowTransition(workflowResult, input);
    } catch (err) {
      persistedWorkflow = { error: err.message || String(err) };
    }
  }

  return Object.freeze({
    ...workflowResult,
    persistedWorkflow,
    effects: Object.freeze({
      ...workflowResult.effects,
      workflowPersisted: Boolean(persistedWorkflow && !persistedWorkflow.error),
      reviewQueuePersisted: productionEnabled,
      draftPersisted: flags.AUTO_DRAFT_ENABLED === true,
      telegramSent: false,
      published: false,
      autoPublishBlocked: flags.AUTO_PUBLISH_ENABLED !== true,
    }),
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  FRAMEWORK_VERSION: framework.FRAMEWORK_VERSION,
  WORKFLOW_STATES: framework.WORKFLOW_STATES,
  APPROVAL_STATES: framework.APPROVAL_STATES,
  FAILURE_ACTIONS: framework.FAILURE_ACTIONS,
  STATE_SEQUENCE: framework.STATE_SEQUENCE,
  runProductAutomationWorkflow,
  runProductionAutomationWorkflow,
  runAutomationWorkflow: framework.runAutomationWorkflow,
  createWorkflowVersionRecord: framework.createWorkflowVersionRecord,
  createWorkflowStateMachine: framework.createWorkflowStateMachine,
  createDraftDifference: framework.createDraftDifference,
  buildDraftPackage: framework.buildDraftPackage,
  coordinateDraftGeneration: framework.coordinateDraftGeneration,
  buildTelegramReviewMessage: framework.buildTelegramReviewMessage,
  buildApprovalWorkflowModel: framework.buildApprovalWorkflowModel,
  buildReviewQueue: framework.buildReviewQueue,
  createAutomationAuditLog: framework.createAutomationAuditLog,
  collectWorkflowMetrics: framework.collectWorkflowMetrics,
  evaluateFailureRecovery: framework.evaluateFailureRecovery,
  createSafetyEnvelope: framework.createSafetyEnvelope,
  createWorkflowDiagram: framework.createWorkflowDiagram,
  getAutomationWorkflowFramework: framework.getAutomationWorkflowFramework,
  getAutomationWorkflowFrameworkIdentity: framework.getAutomationWorkflowFrameworkIdentity,
};
