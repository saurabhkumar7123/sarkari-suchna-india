"use strict";

/**
 * Phase 120 — Recruitment Workflow Orchestration Boundary.
 *
 * Pure advisory workflow orchestrator that coordinates Phase 114-119 recruitment
 * lifecycle advisory outputs into descriptive workflow state guidance without
 * database access, storage connection, coordinator invocation, pipeline mutations,
 * or any side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const { isRecruitmentDraftProposal } = require("./recruitmentDraftProposalEngine");

const { isRecruitmentDraftReviewPackage } = require("./recruitmentDraftReviewPackageBuilder");

const {
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  isRecruitmentDraftApproval
} = require("./recruitmentDraftApprovalGate");

const RECRUITMENT_WORKFLOW_ORCHESTRATOR_PHASE = 120;

const RECRUITMENT_WORKFLOW_ORCHESTRATOR_ENTITY = "recruitment_workflow_orchestrator";

const RECRUITMENT_WORKFLOW_STATES = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  REVIEW_READY: "REVIEW_READY",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
  BLOCKED: "BLOCKED"
});

const RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS = Object.freeze({
  CREATE_DRAFT_PROPOSAL: "Create draft proposal",
  CREATE_REVIEW_PACKAGE: "Create review package",
  AWAIT_APPROVAL_DECISION: "Await approval decision",
  AWAIT_REPOSITORY_CONTRACT: "Await repository contract availability",
  READY_FOR_PERSISTENCE_BOUNDARY: "Ready for persistence boundary",
  RESOLVE_BLOCKED_CONTEXT: "Resolve blocked workflow context"
});

const RECRUITMENT_WORKFLOW_BLOCKED_REASONS = Object.freeze({
  INVALID_CONTEXT: "INVALID_CONTEXT",
  MISSING_RECRUITMENT_ID: "MISSING_RECRUITMENT_ID",
  MISSING_DRAFT_PROPOSAL: "MISSING_DRAFT_PROPOSAL",
  MISSING_REVIEW_PACKAGE: "MISSING_REVIEW_PACKAGE",
  MISSING_APPROVAL_STATE: "MISSING_APPROVAL_STATE",
  APPROVAL_REJECTED: "APPROVAL_REJECTED",
  INSUFFICIENT_WORKFLOW_CONTEXT: "INSUFFICIENT_WORKFLOW_CONTEXT"
});

const RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ORCHESTRATOR_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  workflowOrchestratorOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
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
  sourcePhases: Object.freeze([114, 115, 116, 117, 118, 119])
});

const RECRUITMENT_WORKFLOW_ORCHESTRATOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_ORCHESTRATOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_ORCHESTRATOR_PHASE,
  description:
    "Pure advisory workflow orchestrator coordinating Phase 114-119 recruitment lifecycle outputs into descriptive workflow guidance.",
  metadata: RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA
});

const EMPTY_WORKFLOW_ORCHESTRATION_SUMMARY = Object.freeze({
  workflowState: RECRUITMENT_WORKFLOW_STATES.BLOCKED,
  nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.RESOLVE_BLOCKED_CONTEXT,
  blockedReasonCount: 1,
  recruitmentId: null,
  eventType: null
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
 * @param {Readonly<Object>|null|undefined} context
 * @returns {Readonly<Object>|null}
 */
function resolveApprovalState(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isRecruitmentDraftApproval(context.approvalState)) {
    return context.approvalState;
  }

  if (isRecruitmentDraftApproval(context.approvalDecision)) {
    return context.approvalDecision;
  }

  return null;
}

/**
 * @param {string|null|undefined} recruitmentId
 * @returns {boolean}
 */
function hasRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return false;
  }

  if (typeof recruitmentId === "number" && Number.isFinite(recruitmentId)) {
    return true;
  }

  if (typeof recruitmentId === "string" && recruitmentId.length > 0) {
    return true;
  }

  return false;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildOrchestrationResult(params) {
  return deepFreeze({
    workflowState: params.workflowState,
    nextRecommendedAction: params.nextRecommendedAction,
    blockedReasons: deepFreeze(params.blockedReasons.slice()),
    advisoryTrace: deepFreeze(params.advisoryTrace.slice()),
    recruitmentId: params.recruitmentId ?? null,
    eventType: params.eventType ?? null,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * @param {ReadonlyArray<string>} blockedReasons
 * @param {ReadonlyArray<Readonly<Object>>} advisoryTrace
 * @param {string|null|undefined} recruitmentId
 * @param {string|null|undefined} eventType
 * @returns {Readonly<Object>}
 */
function buildBlockedResult(blockedReasons, advisoryTrace, recruitmentId, eventType) {
  return buildOrchestrationResult({
    workflowState: RECRUITMENT_WORKFLOW_STATES.BLOCKED,
    nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.RESOLVE_BLOCKED_CONTEXT,
    blockedReasons,
    advisoryTrace,
    recruitmentId,
    eventType
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function appendTraceEntry(advisoryTrace, entry) {
  advisoryTrace.push(deepFreeze({ ...entry }));
  return advisoryTrace;
}

/**
 * Coordinate advisory recruitment workflow state from Phase 114-119 outputs.
 * Never throws. Never mutates input. Never connects to storage or databases.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function orchestrateRecruitmentWorkflow(context) {
  const advisoryTrace = [];

  try {
    if (!isPlainObject(context)) {
      appendTraceEntry(advisoryTrace, {
        step: "context_validation",
        outcome: "invalid_context"
      });
      return buildBlockedResult(
        [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.INVALID_CONTEXT],
        advisoryTrace,
        null,
        null
      );
    }

    const recruitmentId = context.recruitmentId ?? null;
    const eventType = context.eventType ?? null;
    const draftProposal = context.draftProposal;
    const reviewPackage = context.reviewPackage;
    const approvalState = resolveApprovalState(context);
    const repositoryContractAvailable = context.repositoryContractAvailability === true;

    const hasDraft = isRecruitmentDraftProposal(draftProposal);
    const hasReview = isRecruitmentDraftReviewPackage(reviewPackage);
    const hasApproval = approvalState != null;

    appendTraceEntry(advisoryTrace, {
      step: "context_received",
      recruitmentId,
      eventType,
      hasDraftProposal: hasDraft,
      hasReviewPackage: hasReview,
      hasApprovalState: hasApproval,
      repositoryContractAvailable
    });

    if (!hasRecruitmentId(recruitmentId)) {
      appendTraceEntry(advisoryTrace, {
        step: "recruitment_identity",
        outcome: "missing_recruitment_id"
      });
      return buildBlockedResult(
        [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_RECRUITMENT_ID],
        advisoryTrace,
        recruitmentId,
        eventType
      );
    }

    if (hasApproval && approvalState.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.REJECTED) {
      appendTraceEntry(advisoryTrace, {
        step: "approval_evaluation",
        outcome: "rejected",
        reason: approvalState.reason
      });
      return buildBlockedResult(
        [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.APPROVAL_REJECTED],
        advisoryTrace,
        recruitmentId,
        eventType
      );
    }

    if (hasApproval && approvalState.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED) {
      const blockedReasons = [];

      if (!hasDraft) {
        blockedReasons.push(RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_DRAFT_PROPOSAL);
      }
      if (!hasReview) {
        blockedReasons.push(RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_REVIEW_PACKAGE);
      }

      if (blockedReasons.length > 0) {
        appendTraceEntry(advisoryTrace, {
          step: "approved_path_validation",
          outcome: "blocked",
          blockedReasons: blockedReasons.slice()
        });
        return buildBlockedResult(blockedReasons, advisoryTrace, recruitmentId, eventType);
      }

      if (repositoryContractAvailable) {
        appendTraceEntry(advisoryTrace, {
          step: "storage_boundary",
          outcome: "ready"
        });
        return buildOrchestrationResult({
          workflowState: RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY,
          nextRecommendedAction:
            RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.READY_FOR_PERSISTENCE_BOUNDARY,
          blockedReasons: [],
          advisoryTrace,
          recruitmentId,
          eventType
        });
      }

      appendTraceEntry(advisoryTrace, {
        step: "repository_contract",
        outcome: "unavailable"
      });
      return buildOrchestrationResult({
        workflowState: RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE,
        nextRecommendedAction:
          RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_REPOSITORY_CONTRACT,
        blockedReasons: [],
        advisoryTrace,
        recruitmentId,
        eventType
      });
    }

    if (hasReview) {
      if (!hasDraft) {
        appendTraceEntry(advisoryTrace, {
          step: "review_package_validation",
          outcome: "missing_draft_proposal"
        });
        return buildBlockedResult(
          [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_DRAFT_PROPOSAL],
          advisoryTrace,
          recruitmentId,
          eventType
        );
      }

      if (
        !hasApproval ||
        approvalState.approvalStatus === RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      ) {
        appendTraceEntry(advisoryTrace, {
          step: "approval_evaluation",
          outcome: "pending",
          approvalStatus: hasApproval ? approvalState.approvalStatus : "MISSING"
        });
        return buildOrchestrationResult({
          workflowState: RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL,
          nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_APPROVAL_DECISION,
          blockedReasons: [],
          advisoryTrace,
          recruitmentId,
          eventType
        });
      }
    }

    if (hasDraft && !hasReview) {
      appendTraceEntry(advisoryTrace, {
        step: "review_package",
        outcome: "missing"
      });
      return buildOrchestrationResult({
        workflowState: RECRUITMENT_WORKFLOW_STATES.REVIEW_READY,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.CREATE_REVIEW_PACKAGE,
        blockedReasons: [],
        advisoryTrace,
        recruitmentId,
        eventType
      });
    }

    if (!hasDraft) {
      appendTraceEntry(advisoryTrace, {
        step: "draft_proposal",
        outcome: "missing"
      });
      return buildOrchestrationResult({
        workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.CREATE_DRAFT_PROPOSAL,
        blockedReasons: [],
        advisoryTrace,
        recruitmentId,
        eventType
      });
    }

    appendTraceEntry(advisoryTrace, {
      step: "workflow_resolution",
      outcome: "insufficient_context"
    });
    return buildBlockedResult(
      [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.INSUFFICIENT_WORKFLOW_CONTEXT],
      advisoryTrace,
      recruitmentId,
      eventType
    );
  } catch {
    return buildBlockedResult(
      [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.INVALID_CONTEXT],
      advisoryTrace,
      null,
      null
    );
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowOrchestrationResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validStates = Object.values(RECRUITMENT_WORKFLOW_STATES);
  const validActions = Object.values(RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS);

  if (
    !validStates.includes(value.workflowState) ||
    !validActions.includes(value.nextRecommendedAction) ||
    !Array.isArray(value.blockedReasons) ||
    !Array.isArray(value.advisoryTrace)
  ) {
    return false;
  }

  const validBlockedReasons = Object.values(RECRUITMENT_WORKFLOW_BLOCKED_REASONS);
  for (let i = 0; i < value.blockedReasons.length; i += 1) {
    if (!validBlockedReasons.includes(value.blockedReasons[i])) {
      return false;
    }
  }

  for (let i = 0; i < value.advisoryTrace.length; i += 1) {
    if (!isPlainObject(value.advisoryTrace[i])) {
      return false;
    }
  }

  if (value.workflowState === RECRUITMENT_WORKFLOW_STATES.BLOCKED) {
    if (value.blockedReasons.length === 0) {
      return false;
    }
    if (
      value.nextRecommendedAction !==
      RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.RESOLVE_BLOCKED_CONTEXT
    ) {
      return false;
    }
  }

  return (
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

/**
 * Summarize a recruitment workflow orchestration result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentWorkflowOrchestration(value) {
  if (!isRecruitmentWorkflowOrchestrationResult(value)) {
    return EMPTY_WORKFLOW_ORCHESTRATION_SUMMARY;
  }

  return Object.freeze({
    workflowState: value.workflowState,
    nextRecommendedAction: value.nextRecommendedAction,
    blockedReasonCount: value.blockedReasons.length,
    recruitmentId: value.recruitmentId ?? null,
    eventType: value.eventType ?? null
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_PHASE,
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_ENTITY,
  RECRUITMENT_WORKFLOW_STATES,
  RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS,
  RECRUITMENT_WORKFLOW_BLOCKED_REASONS,
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA,
  EMPTY_WORKFLOW_ORCHESTRATION_SUMMARY,
  orchestrateRecruitmentWorkflow,
  isRecruitmentWorkflowOrchestrationResult,
  summarizeRecruitmentWorkflowOrchestration
};
