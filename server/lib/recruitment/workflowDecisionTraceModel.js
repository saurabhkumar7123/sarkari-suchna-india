"use strict";

/**
 * Phase 121 — Workflow Decision Trace & Audit Model (Advisory Only).
 *
 * Pure advisory model that converts workflow evaluation information into a
 * structured decision trace explaining why a workflow orchestrator reached a
 * particular recommendation without storage, logging integration, coordinator
 * invocation, pipeline mutations, or any side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No audit storage. No persistence behavior.
 */

const {
  RECRUITMENT_WORKFLOW_STATES,
  RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS,
  RECRUITMENT_WORKFLOW_BLOCKED_REASONS
} = require("./recruitmentWorkflowOrchestrator");

const RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE = 121;

const RECRUITMENT_WORKFLOW_DECISION_TRACE_ENTITY = "workflow_decision_trace";

const WORKFLOW_DECISION_REASONING_RESULTS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  PENDING: "PENDING",
  BLOCKED: "BLOCKED",
  SKIP: "SKIP",
  UNKNOWN: "UNKNOWN"
});

const WORKFLOW_DECISION_EVALUATION_STEPS = Object.freeze({
  WORKFLOW_STATE_RESOLUTION: "WORKFLOW_STATE_RESOLUTION",
  CONTEXT_VALIDATION: "CONTEXT_VALIDATION",
  RECRUITMENT_IDENTITY_CHECK: "RECRUITMENT_IDENTITY_CHECK",
  DRAFT_PROPOSAL_CHECK: "DRAFT_PROPOSAL_CHECK",
  REVIEW_PACKAGE_CHECK: "REVIEW_PACKAGE_CHECK",
  APPROVAL_CHECK: "APPROVAL_CHECK",
  REPOSITORY_CONTRACT_CHECK: "REPOSITORY_CONTRACT_CHECK",
  STORAGE_BOUNDARY_CHECK: "STORAGE_BOUNDARY_CHECK",
  BLOCKED_REASON_CHECK: "BLOCKED_REASON_CHECK",
  NEXT_ACTION_RECOMMENDATION: "NEXT_ACTION_RECOMMENDATION"
});

const RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  decisionTraceOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  createsDrafts: false,
  publishesPages: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  connectsToStorage: false,
  auditStorage: false,
  loggingIntegration: false,
  sourcePhases: Object.freeze([120])
});

const RECRUITMENT_WORKFLOW_DECISION_TRACE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_DECISION_TRACE_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE,
  description:
    "Pure advisory decision trace model explaining why workflow orchestration reached a recommendation.",
  metadata: RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA
});

const EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY = Object.freeze({
  decisionSummary: "Workflow decision trace unavailable due to insufficient evaluation context",
  reasoningStepCount: 0,
  traceEntryCount: 0,
  workflowState: null,
  nextRecommendedAction: null
});

const BLOCKED_REASON_EXPLANATIONS = Object.freeze({
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.INVALID_CONTEXT]: "Workflow evaluation context is invalid",
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_RECRUITMENT_ID]:
    "Recruitment identity is required before workflow can proceed",
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_DRAFT_PROPOSAL]:
    "Draft proposal is required for the current workflow path",
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_REVIEW_PACKAGE]:
    "Review package is required for the current workflow path",
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_APPROVAL_STATE]:
    "Approval state is required for the current workflow path",
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.APPROVAL_REJECTED]:
    "Approval was rejected and workflow cannot continue",
  [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.INSUFFICIENT_WORKFLOW_CONTEXT]:
    "Workflow context is insufficient to determine the next advisory step"
});

const WORKFLOW_STATE_SUMMARIES = Object.freeze({
  [RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED]:
    "Workflow has recruitment identity and requires draft proposal creation",
  [RECRUITMENT_WORKFLOW_STATES.REVIEW_READY]:
    "Workflow has draft proposal and requires review package creation",
  [RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL]:
    "Workflow is waiting for approval because review package exists but approval decision is pending",
  [RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE]:
    "Workflow is approved but awaiting repository contract availability",
  [RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY]:
    "Workflow is approved and repository contract is available; ready for persistence boundary",
  [RECRUITMENT_WORKFLOW_STATES.BLOCKED]:
    "Workflow is blocked and requires context resolution before proceeding"
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function normalizeStepName(value) {
  if (typeof value !== "string" || value.length === 0) {
    return WORKFLOW_DECISION_EVALUATION_STEPS.WORKFLOW_STATE_RESOLUTION;
  }

  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

/**
 * @param {*} value
 * @returns {string}
 */
function normalizeReasoningResult(value) {
  if (typeof value !== "string" || value.length === 0) {
    return WORKFLOW_DECISION_REASONING_RESULTS.UNKNOWN;
  }

  const normalized = value.trim().toUpperCase();
  const validResults = Object.values(WORKFLOW_DECISION_REASONING_RESULTS);
  if (validResults.includes(normalized)) {
    return normalized;
  }

  if (
    normalized === "INVALID" ||
    normalized === "INVALID_CONTEXT" ||
    normalized === "MISSING" ||
    normalized === "MISSING_DRAFT_PROPOSAL" ||
    normalized === "MISSING_REVIEW_PACKAGE" ||
    normalized === "MISSING_RECRUITMENT_ID" ||
    normalized === "REJECTED" ||
    normalized === "BLOCKED" ||
    normalized === "INSUFFICIENT_CONTEXT" ||
    normalized === "FAIL" ||
    normalized === "FAILED"
  ) {
    return WORKFLOW_DECISION_REASONING_RESULTS.FAIL;
  }

  if (
    normalized === "PENDING" ||
    normalized === "NEEDS_REVIEW" ||
    normalized === "UNAVAILABLE" ||
    normalized === "WAITING"
  ) {
    return WORKFLOW_DECISION_REASONING_RESULTS.PENDING;
  }

  if (
    normalized === "READY" ||
    normalized === "AVAILABLE" ||
    normalized === "APPROVED" ||
    normalized === "PASS" ||
    normalized === "PASSED" ||
    normalized === "SUCCESS"
  ) {
    return WORKFLOW_DECISION_REASONING_RESULTS.PASS;
  }

  if (normalized === "SKIP" || normalized === "SKIPPED") {
    return WORKFLOW_DECISION_REASONING_RESULTS.SKIP;
  }

  return WORKFLOW_DECISION_REASONING_RESULTS.UNKNOWN;
}

/**
 * @param {string} step
 * @param {string} result
 * @returns {string}
 */
function buildDefaultStepExplanation(step, result) {
  if (result === WORKFLOW_DECISION_REASONING_RESULTS.PASS) {
    return `${step.replace(/_/g, " ").toLowerCase()} satisfied`;
  }
  if (result === WORKFLOW_DECISION_REASONING_RESULTS.PENDING) {
    return `${step.replace(/_/g, " ").toLowerCase()} pending`;
  }
  if (
    result === WORKFLOW_DECISION_REASONING_RESULTS.FAIL ||
    result === WORKFLOW_DECISION_REASONING_RESULTS.BLOCKED
  ) {
    return `${step.replace(/_/g, " ").toLowerCase()} not satisfied`;
  }
  return `${step.replace(/_/g, " ").toLowerCase()} evaluated`;
}

/**
 * @param {*} step
 * @returns {Readonly<Object>|null}
 */
function normalizeEvaluationStep(step) {
  if (!isPlainObject(step)) {
    return null;
  }

  const stepName = normalizeStepName(step.step ?? step.name ?? step.id);
  const result = normalizeReasoningResult(step.result ?? step.outcome);
  const explanation =
    typeof step.explanation === "string" && step.explanation.length > 0
      ? step.explanation
      : typeof step.reason === "string" && step.reason.length > 0
        ? step.reason
        : typeof step.detail === "string" && step.detail.length > 0
          ? step.detail
          : buildDefaultStepExplanation(stepName, result);

  return {
    step: stepName,
    result,
    explanation
  };
}

/**
 * @param {ReadonlyArray<*>} evaluationSteps
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function normalizeEvaluationSteps(evaluationSteps) {
  if (!Array.isArray(evaluationSteps)) {
    return [];
  }

  const normalized = [];
  for (let i = 0; i < evaluationSteps.length; i += 1) {
    const entry = normalizeEvaluationStep(evaluationSteps[i]);
    if (entry != null) {
      normalized.push(entry);
    }
  }
  return normalized;
}

/**
 * @param {string|null|undefined} workflowState
 * @returns {boolean}
 */
function isKnownWorkflowState(workflowState) {
  return Object.values(RECRUITMENT_WORKFLOW_STATES).includes(workflowState);
}

/**
 * @param {string|null|undefined} nextRecommendedAction
 * @returns {boolean}
 */
function isKnownRecommendedAction(nextRecommendedAction) {
  return Object.values(RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS).includes(nextRecommendedAction);
}

/**
 * @param {ReadonlyArray<string>} blockedReasons
 * @returns {ReadonlyArray<string>}
 */
function normalizeBlockedReasons(blockedReasons) {
  if (!Array.isArray(blockedReasons)) {
    return [];
  }

  const validReasons = Object.values(RECRUITMENT_WORKFLOW_BLOCKED_REASONS);
  const normalized = [];
  for (let i = 0; i < blockedReasons.length; i += 1) {
    const reason = blockedReasons[i];
    if (typeof reason === "string" && validReasons.includes(reason)) {
      normalized.push(reason);
    }
  }
  return normalized;
}

/**
 * @param {string} workflowState
 * @param {ReadonlyArray<string>} blockedReasons
 * @returns {string}
 */
function buildBlockedSummary(blockedReasons) {
  if (blockedReasons.length === 0) {
    return WORKFLOW_STATE_SUMMARIES[RECRUITMENT_WORKFLOW_STATES.BLOCKED];
  }

  const explanations = blockedReasons.map(
    (reason) => BLOCKED_REASON_EXPLANATIONS[reason] ?? reason.replace(/_/g, " ").toLowerCase()
  );

  if (explanations.length === 1) {
    return `Workflow is blocked because ${explanations[0]}`;
  }

  return `Workflow is blocked because ${explanations.join("; ")}`;
}

/**
 * @param {string|null|undefined} workflowState
 * @param {ReadonlyArray<string>} blockedReasons
 * @param {string|null|undefined} nextRecommendedAction
 * @returns {string}
 */
function buildDecisionSummary(workflowState, blockedReasons, nextRecommendedAction) {
  if (!isKnownWorkflowState(workflowState)) {
    return EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY.decisionSummary;
  }

  if (workflowState === RECRUITMENT_WORKFLOW_STATES.BLOCKED) {
    return buildBlockedSummary(blockedReasons);
  }

  const baseSummary = WORKFLOW_STATE_SUMMARIES[workflowState];
  if (typeof nextRecommendedAction === "string" && nextRecommendedAction.length > 0) {
    return `${baseSummary}; next recommended action is ${nextRecommendedAction}`;
  }

  return baseSummary;
}

/**
 * @param {string} source
 * @param {string} workflowState
 * @param {ReadonlyArray<string>} blockedReasons
 * @returns {string}
 */
function deriveSignalImpact(source, workflowState, blockedReasons) {
  if (workflowState === RECRUITMENT_WORKFLOW_STATES.BLOCKED) {
    return "workflow blocked";
  }

  if (workflowState === RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL) {
    if (source === "approvalState" || source === "approvalDecision") {
      return "workflow paused";
    }
    return "approval required";
  }

  if (workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY) {
    if (source === "repositoryContractAvailability") {
      return "persistence boundary ready";
    }
    return "storage path enabled";
  }

  if (workflowState === RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE) {
    if (source === "repositoryContractAvailability") {
      return "awaiting repository contract";
    }
    return "approved for storage preparation";
  }

  if (blockedReasons.length > 0) {
    return "contributes to blocked workflow";
  }

  return "informs workflow recommendation";
}

/**
 * @param {*} signal
 * @param {string|null|undefined} workflowState
 * @param {ReadonlyArray<string>} blockedReasons
 * @returns {Readonly<Object>|null}
 */
function normalizeSourceSignal(signal, workflowState, blockedReasons) {
  if (!isPlainObject(signal)) {
    return null;
  }

  const source =
    typeof signal.source === "string" && signal.source.length > 0 ? signal.source : "unknown";

  const observation =
    typeof signal.observation === "string" && signal.observation.length > 0
      ? signal.observation
      : typeof signal.value === "string" && signal.value.length > 0
        ? signal.value
        : typeof signal.status === "string" && signal.status.length > 0
          ? signal.status
          : signal.present === true
            ? "present"
            : signal.present === false
              ? "missing"
              : "unspecified";

  const impact =
    typeof signal.impact === "string" && signal.impact.length > 0
      ? signal.impact
      : deriveSignalImpact(source, workflowState, blockedReasons);

  return {
    source,
    observation,
    impact
  };
}

/**
 * @param {ReadonlyArray<*>} sourceSignals
 * @param {string|null|undefined} workflowState
 * @param {ReadonlyArray<string>} blockedReasons
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function normalizeSourceSignals(sourceSignals, workflowState, blockedReasons) {
  if (!Array.isArray(sourceSignals)) {
    return [];
  }

  const normalized = [];
  for (let i = 0; i < sourceSignals.length; i += 1) {
    const entry = normalizeSourceSignal(sourceSignals[i], workflowState, blockedReasons);
    if (entry != null) {
      normalized.push(entry);
    }
  }
  return normalized;
}

/**
 * @param {string|null|undefined} workflowState
 * @param {ReadonlyArray<string>} blockedReasons
 * @param {ReadonlyArray<Readonly<Object>>} sourceSignals
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function deriveReasoningChain(workflowState, blockedReasons, sourceSignals) {
  const chain = [];

  if (!isKnownWorkflowState(workflowState)) {
    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.CONTEXT_VALIDATION,
      result: WORKFLOW_DECISION_REASONING_RESULTS.FAIL,
      explanation: "Workflow state is missing or unrecognized"
    });
    return chain;
  }

  chain.push({
    step: WORKFLOW_DECISION_EVALUATION_STEPS.WORKFLOW_STATE_RESOLUTION,
    result:
      workflowState === RECRUITMENT_WORKFLOW_STATES.BLOCKED
        ? WORKFLOW_DECISION_REASONING_RESULTS.BLOCKED
        : WORKFLOW_DECISION_REASONING_RESULTS.PASS,
    explanation:
      WORKFLOW_STATE_SUMMARIES[workflowState] ??
      `Workflow resolved to ${workflowState.replace(/_/g, " ").toLowerCase()}`
  });

  if (workflowState === RECRUITMENT_WORKFLOW_STATES.BLOCKED) {
    for (let i = 0; i < blockedReasons.length; i += 1) {
      const reason = blockedReasons[i];
      chain.push({
        step: WORKFLOW_DECISION_EVALUATION_STEPS.BLOCKED_REASON_CHECK,
        result: WORKFLOW_DECISION_REASONING_RESULTS.BLOCKED,
        explanation: BLOCKED_REASON_EXPLANATIONS[reason] ?? reason
      });
    }
    return chain;
  }

  const hasDraftSignal = sourceSignals.some(
    (signal) =>
      signal.source === "draftProposal" &&
      signal.observation !== "missing" &&
      signal.observation !== "unspecified"
  );
  const hasReviewSignal = sourceSignals.some(
    (signal) =>
      signal.source === "reviewPackage" &&
      signal.observation !== "missing" &&
      signal.observation !== "unspecified"
  );
  const approvalSignal = sourceSignals.find(
    (signal) => signal.source === "approvalState" || signal.source === "approvalDecision"
  );
  const repositorySignal = sourceSignals.find(
    (signal) => signal.source === "repositoryContractAvailability"
  );

  if (
    workflowState === RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED ||
    hasDraftSignal ||
    workflowState !== RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
  ) {
    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.RECRUITMENT_IDENTITY_CHECK,
      result: WORKFLOW_DECISION_REASONING_RESULTS.PASS,
      explanation: "Recruitment identity available for workflow evaluation"
    });
  }

  if (
    workflowState === RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.REVIEW_READY ||
    hasDraftSignal
  ) {
    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.DRAFT_PROPOSAL_CHECK,
      result:
        workflowState === RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
          ? WORKFLOW_DECISION_REASONING_RESULTS.PENDING
          : WORKFLOW_DECISION_REASONING_RESULTS.PASS,
      explanation:
        workflowState === RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
          ? "Draft proposal required before review can begin"
          : "Draft proposal available"
    });
  }

  if (
    workflowState === RECRUITMENT_WORKFLOW_STATES.REVIEW_READY ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY ||
    hasReviewSignal
  ) {
    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.REVIEW_PACKAGE_CHECK,
      result:
        workflowState === RECRUITMENT_WORKFLOW_STATES.REVIEW_READY
          ? WORKFLOW_DECISION_REASONING_RESULTS.PENDING
          : WORKFLOW_DECISION_REASONING_RESULTS.PASS,
      explanation:
        workflowState === RECRUITMENT_WORKFLOW_STATES.REVIEW_READY
          ? "Review package required after draft proposal"
          : "Review package available"
    });
  }

  if (
    workflowState === RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY ||
    approvalSignal != null
  ) {
    let approvalResult = WORKFLOW_DECISION_REASONING_RESULTS.PENDING;
    let approvalExplanation = "Approval decision required";

    if (workflowState === RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE) {
      approvalResult = WORKFLOW_DECISION_REASONING_RESULTS.PASS;
      approvalExplanation = "Approval granted";
    } else if (workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY) {
      approvalResult = WORKFLOW_DECISION_REASONING_RESULTS.PASS;
      approvalExplanation = "Approval granted for storage path";
    } else if (approvalSignal != null) {
      const observation = approvalSignal.observation.toLowerCase();
      if (observation === "approved") {
        approvalResult = WORKFLOW_DECISION_REASONING_RESULTS.PASS;
        approvalExplanation = "Approval granted";
      } else if (observation === "rejected") {
        approvalResult = WORKFLOW_DECISION_REASONING_RESULTS.FAIL;
        approvalExplanation = "Approval rejected";
      } else if (observation === "needs_review" || observation === "pending") {
        approvalResult = WORKFLOW_DECISION_REASONING_RESULTS.PENDING;
        approvalExplanation = "Approval decision required";
      }
    }

    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.APPROVAL_CHECK,
      result: approvalResult,
      explanation: approvalExplanation
    });
  }

  if (
    workflowState === RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE ||
    workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY ||
    repositorySignal != null
  ) {
    const repositoryAvailable =
      workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY ||
      repositorySignal?.observation === "available" ||
      repositorySignal?.observation === "true";

    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.REPOSITORY_CONTRACT_CHECK,
      result: repositoryAvailable
        ? WORKFLOW_DECISION_REASONING_RESULTS.PASS
        : WORKFLOW_DECISION_REASONING_RESULTS.PENDING,
      explanation: repositoryAvailable
        ? "Repository contract available"
        : "Repository contract unavailable"
    });
  }

  if (workflowState === RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY) {
    chain.push({
      step: WORKFLOW_DECISION_EVALUATION_STEPS.STORAGE_BOUNDARY_CHECK,
      result: WORKFLOW_DECISION_REASONING_RESULTS.PASS,
      explanation: "Persistence boundary ready for advisory handoff"
    });
  }

  return chain;
}

/**
 * @param {string|null|undefined} nextRecommendedAction
 * @param {ReadonlyArray<Readonly<Object>>} reasoningChain
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function appendNextActionStep(nextRecommendedAction, reasoningChain) {
  if (!isKnownRecommendedAction(nextRecommendedAction)) {
    return reasoningChain;
  }

  return reasoningChain.concat({
    step: WORKFLOW_DECISION_EVALUATION_STEPS.NEXT_ACTION_RECOMMENDATION,
    result: WORKFLOW_DECISION_REASONING_RESULTS.PASS,
    explanation: `Next recommended action: ${nextRecommendedAction}`
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildDecisionTraceResult(params) {
  return deepFreeze({
    decisionSummary: params.decisionSummary,
    reasoningChain: deepFreeze(params.reasoningChain.slice()),
    traceEntries: deepFreeze(params.traceEntries.slice()),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      auditStorage: false,
      loggingIntegration: false,
      sideEffects: false,
      mutatesInput: false
    })
  });
}

/**
 * Convert workflow evaluation information into a structured advisory decision trace.
 * Never throws. Never mutates input. Never persists or logs output.
 *
 * @param {Object|null|undefined} evaluation
 * @returns {Readonly<Object>}
 */
function createWorkflowDecisionTrace(evaluation) {
  try {
    if (!isPlainObject(evaluation)) {
      return buildDecisionTraceResult({
        decisionSummary: EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY.decisionSummary,
        reasoningChain: [],
        traceEntries: []
      });
    }

    const workflowState =
      typeof evaluation.workflowState === "string" ? evaluation.workflowState : null;
    const nextRecommendedAction =
      typeof evaluation.nextRecommendedAction === "string"
        ? evaluation.nextRecommendedAction
        : null;
    const blockedReasons = normalizeBlockedReasons(evaluation.blockedReasons);

    const traceEntries = normalizeSourceSignals(
      evaluation.sourceSignals,
      workflowState,
      blockedReasons
    );

    let reasoningChain = normalizeEvaluationSteps(evaluation.evaluationSteps);
    if (reasoningChain.length === 0) {
      reasoningChain = deriveReasoningChain(workflowState, blockedReasons, traceEntries);
    }
    reasoningChain = appendNextActionStep(nextRecommendedAction, reasoningChain);

    const decisionSummary = buildDecisionSummary(
      workflowState,
      blockedReasons,
      nextRecommendedAction
    );

    return buildDecisionTraceResult({
      decisionSummary,
      reasoningChain,
      traceEntries
    });
  } catch {
    return buildDecisionTraceResult({
      decisionSummary: EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY.decisionSummary,
      reasoningChain: [],
      traceEntries: []
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isWorkflowDecisionTrace(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.decisionSummary !== "string" ||
    !Array.isArray(value.reasoningChain) ||
    !Array.isArray(value.traceEntries) ||
    !isPlainObject(value.advisoryMetadata)
  ) {
    return false;
  }

  const validResults = Object.values(WORKFLOW_DECISION_REASONING_RESULTS);
  for (let i = 0; i < value.reasoningChain.length; i += 1) {
    const step = value.reasoningChain[i];
    if (
      !isPlainObject(step) ||
      typeof step.step !== "string" ||
      typeof step.explanation !== "string" ||
      !validResults.includes(step.result)
    ) {
      return false;
    }
  }

  for (let i = 0; i < value.traceEntries.length; i += 1) {
    const entry = value.traceEntries[i];
    if (
      !isPlainObject(entry) ||
      typeof entry.source !== "string" ||
      typeof entry.observation !== "string" ||
      typeof entry.impact !== "string"
    ) {
      return false;
    }
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.persistent === false &&
    value.advisoryMetadata.persistenceEnabled === false &&
    value.advisoryMetadata.auditStorage === false
  );
}

/**
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeWorkflowDecisionTrace(value) {
  if (!isWorkflowDecisionTrace(value)) {
    return EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY;
  }

  return Object.freeze({
    decisionSummary: value.decisionSummary,
    reasoningStepCount: value.reasoningChain.length,
    traceEntryCount: value.traceEntries.length,
    workflowState: null,
    nextRecommendedAction: null
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE,
  RECRUITMENT_WORKFLOW_DECISION_TRACE_ENTITY,
  WORKFLOW_DECISION_REASONING_RESULTS,
  WORKFLOW_DECISION_EVALUATION_STEPS,
  RECRUITMENT_WORKFLOW_DECISION_TRACE_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA,
  EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY,
  createWorkflowDecisionTrace,
  isWorkflowDecisionTrace,
  summarizeWorkflowDecisionTrace
};
