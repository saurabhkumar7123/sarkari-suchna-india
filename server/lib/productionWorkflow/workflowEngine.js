"use strict";

/**
 * PWP Phase 1 — Production Workflow Engine.
 *
 * Orchestrates existing production modules into one deterministic pipeline.
 * No new intelligence / extraction / monitoring / generator engines.
 */

const crypto = require("crypto");
const {
  WORKFLOW_STATES,
  STAGE_IDS,
  STAGE_TO_STATE,
  PIPELINE_STAGE_ORDER
} = require("./workflowStates");
const { STAGE_STATUS, createStageInput, isStageSuccess } = require("./pipelineContracts");
const {
  createAuditTrail,
  logTransition,
  recordStageExecution,
  recordSkippedStage,
  finalizeAuditTrail,
  buildWorkflowReport
} = require("./auditTrail");
const {
  buildFailureReport,
  advisoryFromStageFailure,
  buildRetryAdvisory
} = require("./failureHandling");
const { assertAutoPublishDisabled } = require("./publishingPolicy");
const { STAGE_RUNNERS } = require("./stageRunners");

const ORCHESTRATOR_ID = "PWP_PRODUCTION_WORKFLOW_ENGINE";
const ORCHESTRATOR_VERSION = "2.0.0";
const PHASE = "PHASE_2";

function createWorkflowId(seed) {
  if (seed && typeof seed === "string" && seed.trim()) return seed.trim();
  return `pwp_${crypto.randomBytes(8).toString("hex")}`;
}

function resolveMonitoringEvent(input = {}) {
  return (
    input.monitoringEvent ||
    input.event ||
    input.notice ||
    input.notification ||
    input
  );
}

/**
 * Execute the Production Workflow Program pipeline (Phase 1 + Phase 2 resolution).
 *
 * @param {object} [input]
 * @param {object} [input.monitoringEvent]
 * @param {string} [input.workflowId]
 * @param {string|number} [input.recruitmentId]
 * @returns {Promise<object>} final workflow state + report
 */
async function runProductionWorkflow(input = {}) {
  const startedAt = new Date().toISOString();
  const monitoringEvent = resolveMonitoringEvent(input);
  const workflowId = createWorkflowId(input.workflowId || monitoringEvent.workflowId);
  const recruitmentId = input.recruitmentId || monitoringEvent.recruitmentId || null;
  const publishingPolicy = assertAutoPublishDisabled();

  const audit = createAuditTrail({ workflowId, startedAt });
  const stageResults = {};
  const workflowContext = {
    monitoringEvent,
    input,
    publishingPolicy,
    orchestratorId: ORCHESTRATOR_ID,
    orchestratorVersion: ORCHESTRATOR_VERSION,
    phase: PHASE,
    existingRecruitment:
      input.existingRecruitment ||
      monitoringEvent.existingRecruitment ||
      null,
    existingPage: input.existingPage || monitoringEvent.existingPage || null
  };

  let currentState = null;
  let currentPayload = null;
  let sourceProfile = null;
  let previousStage = null;
  let failed = false;
  let failureReport = null;
  let retryAdvisory = buildRetryAdvisory({ retryPossible: false });

  for (let index = 0; index < PIPELINE_STAGE_ORDER.length; index += 1) {
    const stageId = PIPELINE_STAGE_ORDER[index];

    if (failed) {
      recordSkippedStage(audit, stageId, "upstream_failure");
      continue;
    }

    const runner = STAGE_RUNNERS[stageId];
    if (typeof runner !== "function") {
      failed = true;
      currentState = WORKFLOW_STATES.FAILED;
      failureReport = buildFailureReport({
        workflowId,
        failedStage: stageId,
        previousState: currentState,
        errors: [{ code: "MISSING_RUNNER", message: `No runner for ${stageId}` }],
        blockingReason: `missing_runner:${stageId}`
      });
      retryAdvisory = advisoryFromStageFailure(stageId, failureReport.errors);
      logTransition(audit, {
        fromState: previousStage ? STAGE_TO_STATE[previousStage] : null,
        toState: WORKFLOW_STATES.FAILED,
        stageId,
        status: STAGE_STATUS.FAILED,
        message: failureReport.blockingReason
      });
      recordStageExecution(audit, stageId, {
        status: STAGE_STATUS.FAILED,
        warnings: [],
        errors: failureReport.errors
      });
      continue;
    }

    const stageInput = createStageInput({
      workflowId,
      recruitmentId,
      sourceProfile,
      currentPayload,
      previousStage,
      workflowContext
    });

    const stageStarted = Date.now();
    let result;
    try {
      result = await Promise.resolve(runner(stageInput));
    } catch (err) {
      result = {
        status: STAGE_STATUS.FAILED,
        payload: currentPayload,
        warnings: [],
        errors: [{ code: "STAGE_EXCEPTION", message: err.message || String(err) }],
        executionSummary: { stageId, exception: true }
      };
    }
    const durationMs = Date.now() - stageStarted;

    stageResults[stageId] = result;
    recordStageExecution(audit, stageId, result, {
      at: new Date().toISOString(),
      durationMs
    });

    const fromState = currentState;
    if (!isStageSuccess(result)) {
      failed = true;
      currentState = WORKFLOW_STATES.FAILED;
      failureReport = buildFailureReport({
        workflowId,
        failedStage: stageId,
        previousState: fromState,
        errors: result.errors,
        warnings: result.warnings,
        payload: result.payload,
        blockingReason:
          (result.errors && result.errors[0] && (result.errors[0].message || result.errors[0].code)) ||
          `${stageId}_failed`
      });
      retryAdvisory = advisoryFromStageFailure(stageId, result.errors);
      logTransition(audit, {
        fromState,
        toState: WORKFLOW_STATES.FAILED,
        stageId,
        status: STAGE_STATUS.FAILED,
        message: failureReport.blockingReason,
        durationMs
      });
      previousStage = stageId;
      continue;
    }

    currentPayload = result.payload;
    if (result.payload && result.payload.sourceProfile) {
      sourceProfile = result.payload.sourceProfile;
    }

    // Manual publish gate may hold at READY_FOR_REVIEW.
    if (
      stageId === STAGE_IDS.MANUAL_PUBLISH_GATE &&
      result.executionSummary &&
      result.executionSummary.finalWorkflowState === WORKFLOW_STATES.READY_FOR_REVIEW
    ) {
      currentState = WORKFLOW_STATES.READY_FOR_REVIEW;
    } else {
      currentState = STAGE_TO_STATE[stageId] || currentState;
    }

    logTransition(audit, {
      fromState,
      toState: currentState,
      stageId,
      status: STAGE_STATUS.SUCCESS,
      message: (result.executionSummary && result.executionSummary.stage) || stageId,
      durationMs
    });
    previousStage = stageId;

    // Phase 2 resolution may halt draft/editorial downstream stages.
    if (result.executionSummary && result.executionSummary.haltPipeline === true) {
      currentState =
        result.executionSummary.haltFinalState ||
        STAGE_TO_STATE[stageId] ||
        currentState;
      for (let skipIndex = index + 1; skipIndex < PIPELINE_STAGE_ORDER.length; skipIndex += 1) {
        recordSkippedStage(
          audit,
          PIPELINE_STAGE_ORDER[skipIndex],
          result.executionSummary.haltReason || "resolution_routing_halt"
        );
      }
      break;
    }
  }

  if (!failed && !currentState) {
    currentState = WORKFLOW_STATES.FAILED;
    failed = true;
    failureReport = buildFailureReport({
      workflowId,
      failedStage: null,
      previousState: null,
      errors: [{ code: "EMPTY_PIPELINE", message: "no stages executed" }],
      blockingReason: "empty_pipeline"
    });
  }

  finalizeAuditTrail(audit, failed ? WORKFLOW_STATES.FAILED : currentState);

  const report = buildWorkflowReport(audit, {
    orchestratorId: ORCHESTRATOR_ID,
    orchestratorVersion: ORCHESTRATOR_VERSION,
    phase: PHASE,
    publishingPolicy,
    failureReport,
    retryAdvisory
  });

  return Object.freeze({
    orchestratorId: ORCHESTRATOR_ID,
    orchestratorVersion: ORCHESTRATOR_VERSION,
    phase: PHASE,
    workflowId,
    recruitmentId,
    status: failed ? STAGE_STATUS.FAILED : STAGE_STATUS.SUCCESS,
    finalState: failed ? WORKFLOW_STATES.FAILED : currentState,
    payload: currentPayload,
    sourceProfile,
    stageResults,
    report,
    failureReport,
    retryAdvisory,
    publishingPolicy,
    published: false,
    autoPublishBlocked: true,
    effects: Object.freeze({
      persistence: false,
      autoPublish: false,
      generatorCalledIntelligence: false,
      editorialAutoApproved: false,
      networkUsed: false
    })
  });
}

module.exports = {
  ORCHESTRATOR_ID,
  ORCHESTRATOR_VERSION,
  PHASE,
  runProductionWorkflow,
  createWorkflowId
};
