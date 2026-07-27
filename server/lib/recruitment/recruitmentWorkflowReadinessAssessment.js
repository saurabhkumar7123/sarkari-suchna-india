"use strict";

/**
 * Phase 123 — Recruitment Workflow Readiness Assessment Model (Advisory Only).
 *
 * Pure advisory readiness assessment that evaluates apparent recruitment workflow
 * readiness from supplied capability signals and workflow information without
 * storage, persistence, coordinator invocation, pipeline mutations, or side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE = 123;

const RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_ENTITY =
  "recruitment_workflow_readiness_assessment";

const READINESS_STATUSES = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED"
});

const WORKFLOW_CAPABILITY_IDS = Object.freeze({
  DRAFT_PROPOSAL: "draft_proposal",
  PERSISTENCE_BOUNDARY: "persistence_boundary",
  APPROVAL_GATE: "approval_gate",
  REVIEW_PACKAGE: "review_package",
  STORAGE_ADAPTER: "storage_adapter",
  REPOSITORY_CONTRACT: "repository_contract",
  WORKFLOW_ORCHESTRATOR: "workflow_orchestrator",
  DECISION_TRACE_MODEL: "decision_trace_model"
});

const WORKFLOW_STATE_SIGNALS = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  REVIEW_READY: "REVIEW_READY",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
  BLOCKED: "BLOCKED"
});

const APPROVAL_SIGNALS = Object.freeze({
  APPROVED: "approved",
  PENDING: "pending",
  REJECTED: "rejected",
  NEEDS_REVIEW: "needs_review"
});

const READINESS_SCORE_BY_STATUS = Object.freeze({
  [READINESS_STATUSES.NOT_STARTED]: 0,
  [READINESS_STATUSES.BLOCKED]: 0,
  [READINESS_STATUSES.PARTIALLY_READY]: 25,
  [READINESS_STATUSES.REVIEW_READY]: 50,
  [READINESS_STATUSES.APPROVAL_PENDING]: 75,
  [READINESS_STATUSES.READY_FOR_STORAGE]: 100
});

const ASSESSMENT_CAPABILITY_ORDER = Object.freeze([
  WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL,
  WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE,
  WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE,
  WORKFLOW_CAPABILITY_IDS.PERSISTENCE_BOUNDARY,
  WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER,
  WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT
]);

const RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  readinessAssessmentOnly: true,
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
  sourcePhases: Object.freeze([114, 115, 116, 117, 118, 119, 120, 121, 122])
});

const RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE,
  description:
    "Pure advisory readiness assessment model evaluating recruitment workflow readiness from supplied capability signals.",
  metadata: RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA
});

const EMPTY_READINESS_ASSESSMENT_SUMMARY = Object.freeze({
  readinessStatus: READINESS_STATUSES.BLOCKED,
  readinessScore: READINESS_SCORE_BY_STATUS[READINESS_STATUSES.BLOCKED],
  missingCapabilityCount: ASSESSMENT_CAPABILITY_ORDER.length,
  recommendationCount: 1
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
 * @param {*} capabilitySignal
 * @returns {boolean}
 */
function isCapabilityAvailable(capabilitySignal) {
  if (!isPlainObject(capabilitySignal)) {
    return false;
  }

  if (capabilitySignal.available === true || capabilitySignal.present === true) {
    return true;
  }

  if (typeof capabilitySignal.status === "string") {
    const status = capabilitySignal.status.toLowerCase();
    return status === "available" || status === "present" || status === "ready";
  }

  return false;
}

/**
 * @param {*} capabilitySignal
 * @returns {boolean}
 */
function isCapabilityReady(capabilitySignal) {
  if (!isPlainObject(capabilitySignal)) {
    return false;
  }

  if (capabilitySignal.ready === true) {
    return true;
  }

  if (typeof capabilitySignal.status === "string") {
    return capabilitySignal.status.toLowerCase() === "ready";
  }

  return false;
}

/**
 * @param {*} approvalSignal
 * @returns {string|null}
 */
function normalizeApprovalState(approvalSignal) {
  if (!isPlainObject(approvalSignal)) {
    return null;
  }

  const candidates = [
    approvalSignal.approvalState,
    approvalSignal.state,
    approvalSignal.status,
    approvalSignal.observation,
    approvalSignal.decision
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (typeof candidate !== "string" || candidate.length === 0) {
      continue;
    }

    const normalized = candidate.trim().toLowerCase();
    if (
      normalized === APPROVAL_SIGNALS.APPROVED ||
      normalized === APPROVAL_SIGNALS.PENDING ||
      normalized === APPROVAL_SIGNALS.REJECTED ||
      normalized === APPROVAL_SIGNALS.NEEDS_REVIEW
    ) {
      return normalized;
    }
  }

  if (approvalSignal.approved === true) {
    return APPROVAL_SIGNALS.APPROVED;
  }

  if (approvalSignal.rejected === true) {
    return APPROVAL_SIGNALS.REJECTED;
  }

  if (approvalSignal.pending === true) {
    return APPROVAL_SIGNALS.PENDING;
  }

  return null;
}

/**
 * @param {Readonly<Object>} capabilities
 * @returns {string|null}
 */
function resolveApprovalState(capabilities) {
  const approvalSignal = capabilities[WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE];
  const approvalState = normalizeApprovalState(approvalSignal);

  if (approvalState != null) {
    return approvalState;
  }

  if (isCapabilityReady(approvalSignal)) {
    return APPROVAL_SIGNALS.APPROVED;
  }

  if (isCapabilityAvailable(approvalSignal)) {
    return APPROVAL_SIGNALS.PENDING;
  }

  return null;
}

/**
 * @param {*} decisionTrace
 * @returns {boolean}
 */
function isDecisionTraceBlocked(decisionTrace) {
  if (!isPlainObject(decisionTrace)) {
    return false;
  }

  if (
    typeof decisionTrace.decisionSummary === "string" &&
    decisionTrace.decisionSummary.toLowerCase().includes("blocked")
  ) {
    return true;
  }

  if (!Array.isArray(decisionTrace.reasoningChain)) {
    return false;
  }

  for (let i = 0; i < decisionTrace.reasoningChain.length; i += 1) {
    const step = decisionTrace.reasoningChain[i];
    if (
      isPlainObject(step) &&
      typeof step.result === "string" &&
      (step.result === "BLOCKED" || step.result === "FAIL")
    ) {
      if (step.result === "BLOCKED") {
        return true;
      }

      const explanation = typeof step.explanation === "string" ? step.explanation.toLowerCase() : "";
      if (explanation.includes("rejected") || explanation.includes("invalid")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * @param {string|null|undefined} workflowState
 * @returns {boolean}
 */
function isBlockedWorkflowState(workflowState) {
  return workflowState === WORKFLOW_STATE_SIGNALS.BLOCKED;
}

/**
 * @param {*} recruitmentId
 * @returns {boolean}
 */
function hasRecruitmentIdentity(recruitmentId) {
  if (typeof recruitmentId === "number") {
    return Number.isFinite(recruitmentId);
  }

  if (typeof recruitmentId === "string") {
    return recruitmentId.trim().length > 0;
  }

  return false;
}

/**
 * @param {Readonly<Object>} capabilities
 * @returns {number}
 */
function countAvailableCapabilities(capabilities) {
  let count = 0;
  const keys = Object.keys(capabilities);
  for (let i = 0; i < keys.length; i += 1) {
    if (isCapabilityAvailable(capabilities[keys[i]])) {
      count += 1;
    }
  }
  return count;
}

/**
 * @param {Readonly<Object>} capabilities
 * @returns {boolean}
 */
function hasDraftProposalCapability(capabilities) {
  return isCapabilityAvailable(capabilities[WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]);
}

/**
 * @param {Readonly<Object>} capabilities
 * @returns {boolean}
 */
function hasReviewPackageCapability(capabilities) {
  return isCapabilityAvailable(capabilities[WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]);
}

/**
 * @param {Readonly<Object>} capabilities
 * @returns {boolean}
 */
function hasStorageCapability(capabilities) {
  return (
    isCapabilityAvailable(capabilities[WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER]) ||
    isCapabilityAvailable(capabilities[WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT])
  );
}

/**
 * @param {Readonly<Object>} params
 * @returns {string}
 */
function resolveReadinessStatus(params) {
  const {
    recruitmentId,
    capabilities,
    workflowState,
    decisionTrace,
    approvalState,
    draftAvailable,
    reviewAvailable,
    storageAvailable,
    availableCapabilityCount
  } = params;

  if (!hasRecruitmentIdentity(recruitmentId)) {
    return READINESS_STATUSES.BLOCKED;
  }

  if (
    isBlockedWorkflowState(workflowState) ||
    isDecisionTraceBlocked(decisionTrace) ||
    approvalState === APPROVAL_SIGNALS.REJECTED
  ) {
    return READINESS_STATUSES.BLOCKED;
  }

  if (availableCapabilityCount === 0) {
    return READINESS_STATUSES.NOT_STARTED;
  }

  const approvalApproved = approvalState === APPROVAL_SIGNALS.APPROVED;
  const approvalPending =
    approvalState === APPROVAL_SIGNALS.PENDING ||
    approvalState === APPROVAL_SIGNALS.NEEDS_REVIEW ||
    workflowState === WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL;

  if (approvalApproved && storageAvailable) {
    return READINESS_STATUSES.READY_FOR_STORAGE;
  }

  if (
    draftAvailable &&
    reviewAvailable &&
    (approvalPending ||
      workflowState === WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL ||
      workflowState === WORKFLOW_STATE_SIGNALS.APPROVED_FOR_STORAGE)
  ) {
    if (approvalPending && !approvalApproved) {
      return READINESS_STATUSES.APPROVAL_PENDING;
    }
  }

  if (draftAvailable && reviewAvailable) {
    if (approvalPending) {
      return READINESS_STATUSES.APPROVAL_PENDING;
    }

    if (
      workflowState === WORKFLOW_STATE_SIGNALS.REVIEW_READY ||
      workflowState === WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL
    ) {
      return workflowState === WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL
        ? READINESS_STATUSES.APPROVAL_PENDING
        : READINESS_STATUSES.REVIEW_READY;
    }

    return READINESS_STATUSES.REVIEW_READY;
  }

  if (draftAvailable) {
    return READINESS_STATUSES.PARTIALLY_READY;
  }

  if (availableCapabilityCount > 0) {
    return READINESS_STATUSES.PARTIALLY_READY;
  }

  return READINESS_STATUSES.NOT_STARTED;
}

/**
 * @param {string} capabilityId
 * @param {Readonly<Object>} capabilities
 * @param {string} readinessStatus
 * @param {string|null} approvalState
 * @returns {Readonly<{ available: boolean, ready: boolean }>}
 */
function assessCapabilityEntry(capabilityId, capabilities, readinessStatus, approvalState) {
  const signal = capabilities[capabilityId];
  const available = isCapabilityAvailable(signal);
  let ready = isCapabilityReady(signal);

  if (!ready && available) {
    if (capabilityId === WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL) {
      ready =
        readinessStatus !== READINESS_STATUSES.NOT_STARTED &&
        readinessStatus !== READINESS_STATUSES.BLOCKED;
    } else if (capabilityId === WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE) {
      ready =
        readinessStatus === READINESS_STATUSES.REVIEW_READY ||
        readinessStatus === READINESS_STATUSES.APPROVAL_PENDING ||
        readinessStatus === READINESS_STATUSES.READY_FOR_STORAGE;
    } else if (capabilityId === WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE) {
      ready = approvalState === APPROVAL_SIGNALS.APPROVED;
    } else if (
      capabilityId === WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER ||
      capabilityId === WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT
    ) {
      ready = readinessStatus === READINESS_STATUSES.READY_FOR_STORAGE;
    } else if (capabilityId === WORKFLOW_CAPABILITY_IDS.PERSISTENCE_BOUNDARY) {
      ready = readinessStatus === READINESS_STATUSES.READY_FOR_STORAGE;
    }
  }

  return {
    available,
    ready
  };
}

/**
 * @param {Readonly<Object>} capabilities
 * @param {string} readinessStatus
 * @param {string|null} approvalState
 * @returns {Readonly<Object>}
 */
function buildCapabilityAssessment(capabilities, readinessStatus, approvalState) {
  const assessment = {};

  for (let i = 0; i < ASSESSMENT_CAPABILITY_ORDER.length; i += 1) {
    const capabilityId = ASSESSMENT_CAPABILITY_ORDER[i];
    assessment[capabilityId] = assessCapabilityEntry(
      capabilityId,
      capabilities,
      readinessStatus,
      approvalState
    );
  }

  return assessment;
}

/**
 * @param {Readonly<Object>} capabilityAssessment
 * @param {string} readinessStatus
 * @returns {ReadonlyArray<string>}
 */
function deriveMissingCapabilities(capabilityAssessment, readinessStatus) {
  const missing = [];

  const requiredByStatus = {
    [READINESS_STATUSES.NOT_STARTED]: [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL],
    [READINESS_STATUSES.PARTIALLY_READY]: [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE],
    [READINESS_STATUSES.REVIEW_READY]: [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE],
    [READINESS_STATUSES.APPROVAL_PENDING]: [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE],
    [READINESS_STATUSES.READY_FOR_STORAGE]: [
      WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER,
      WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT
    ],
    [READINESS_STATUSES.BLOCKED]: []
  };

  const required = requiredByStatus[readinessStatus] ?? [];

  for (let i = 0; i < required.length; i += 1) {
    const capabilityId = required[i];
    const entry = capabilityAssessment[capabilityId];
    if (entry == null || entry.available !== true) {
      missing.push(capabilityId);
    }
  }

  if (readinessStatus === READINESS_STATUSES.PARTIALLY_READY) {
    const reviewEntry = capabilityAssessment[WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE];
    if (reviewEntry != null && reviewEntry.available !== true) {
      if (!missing.includes(WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE)) {
        missing.push(WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE);
      }
    }
  }

  if (readinessStatus === READINESS_STATUSES.READY_FOR_STORAGE) {
    const storageEntry = capabilityAssessment[WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER];
    const repositoryEntry = capabilityAssessment[WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT];
    if (
      (storageEntry == null || storageEntry.available !== true) &&
      (repositoryEntry == null || repositoryEntry.available !== true)
    ) {
      if (!missing.includes(WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER)) {
        missing.push(WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER);
      }
    }
  }

  return missing;
}

/**
 * @param {string} readinessStatus
 * @param {ReadonlyArray<string>} missingCapabilities
 * @param {string|null} approvalState
 * @returns {ReadonlyArray<string>}
 */
function buildRecommendations(readinessStatus, missingCapabilities, approvalState) {
  const recommendations = [];

  if (readinessStatus === READINESS_STATUSES.BLOCKED) {
    if (approvalState === APPROVAL_SIGNALS.REJECTED) {
      recommendations.push("Resolve approval rejection before proceeding");
    } else {
      recommendations.push("Resolve blocked workflow context");
    }
    return recommendations;
  }

  if (readinessStatus === READINESS_STATUSES.NOT_STARTED) {
    recommendations.push("Create draft proposal");
    return recommendations;
  }

  if (readinessStatus === READINESS_STATUSES.PARTIALLY_READY) {
    recommendations.push("Create review package");
    return recommendations;
  }

  if (readinessStatus === READINESS_STATUSES.REVIEW_READY) {
    if (missingCapabilities.includes(WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE)) {
      recommendations.push("Prepare approval gate review");
    } else {
      recommendations.push("Create review package");
    }
    return recommendations;
  }

  if (readinessStatus === READINESS_STATUSES.APPROVAL_PENDING) {
    recommendations.push("Await approval decision");
    return recommendations;
  }

  if (readinessStatus === READINESS_STATUSES.READY_FOR_STORAGE) {
    recommendations.push("Ready for storage boundary review");
    return recommendations;
  }

  return recommendations;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildReadinessAssessmentResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    readinessStatus: params.readinessStatus,
    readinessScore: params.readinessScore,
    capabilityAssessment: deepFreeze(params.capabilityAssessment),
    missingCapabilities: deepFreeze(params.missingCapabilities.slice()),
    recommendations: deepFreeze(params.recommendations.slice()),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      readinessAssessmentOnly: true
    })
  });
}

/**
 * Evaluate recruitment workflow readiness from supplied advisory inputs.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function assessRecruitmentWorkflowReadiness(input) {
  try {
    if (!isPlainObject(input)) {
      return buildReadinessAssessmentResult({
        recruitmentId: null,
        readinessStatus: READINESS_STATUSES.BLOCKED,
        readinessScore: READINESS_SCORE_BY_STATUS[READINESS_STATUSES.BLOCKED],
        capabilityAssessment: buildCapabilityAssessment(
          {},
          READINESS_STATUSES.BLOCKED,
          null
        ),
        missingCapabilities: [...ASSESSMENT_CAPABILITY_ORDER],
        recommendations: buildRecommendations(READINESS_STATUSES.BLOCKED, [], null)
      });
    }

    const recruitmentId = input.recruitmentId ?? null;
    const capabilities = isPlainObject(input.capabilities) ? input.capabilities : {};
    const workflowState =
      typeof input.workflowState === "string" ? input.workflowState : null;
    const decisionTrace = isPlainObject(input.decisionTrace) ? input.decisionTrace : null;

    const approvalState = resolveApprovalState(capabilities);
    const draftAvailable = hasDraftProposalCapability(capabilities);
    const reviewAvailable = hasReviewPackageCapability(capabilities);
    const storageAvailable = hasStorageCapability(capabilities);
    const availableCapabilityCount = countAvailableCapabilities(capabilities);

    const readinessStatus = resolveReadinessStatus({
      recruitmentId,
      capabilities,
      workflowState,
      decisionTrace,
      approvalState,
      draftAvailable,
      reviewAvailable,
      storageAvailable,
      availableCapabilityCount
    });

    const capabilityAssessment = buildCapabilityAssessment(
      capabilities,
      readinessStatus,
      approvalState
    );
    const missingCapabilities = deriveMissingCapabilities(capabilityAssessment, readinessStatus);
    const recommendations = buildRecommendations(
      readinessStatus,
      missingCapabilities,
      approvalState
    );

    return buildReadinessAssessmentResult({
      recruitmentId: hasRecruitmentIdentity(recruitmentId) ? recruitmentId : null,
      readinessStatus,
      readinessScore: READINESS_SCORE_BY_STATUS[readinessStatus] ?? 0,
      capabilityAssessment,
      missingCapabilities,
      recommendations
    });
  } catch {
    return buildReadinessAssessmentResult({
      recruitmentId: null,
      readinessStatus: READINESS_STATUSES.BLOCKED,
      readinessScore: READINESS_SCORE_BY_STATUS[READINESS_STATUSES.BLOCKED],
      capabilityAssessment: buildCapabilityAssessment({}, READINESS_STATUSES.BLOCKED, null),
      missingCapabilities: [...ASSESSMENT_CAPABILITY_ORDER],
      recommendations: buildRecommendations(READINESS_STATUSES.BLOCKED, [], null)
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowReadinessAssessment(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validStatuses = Object.values(READINESS_STATUSES);

  if (
    !validStatuses.includes(value.readinessStatus) ||
    typeof value.readinessScore !== "number" ||
    !isPlainObject(value.capabilityAssessment) ||
    !Array.isArray(value.missingCapabilities) ||
    !Array.isArray(value.recommendations) ||
    !isPlainObject(value.advisoryMetadata)
  ) {
    return false;
  }

  for (let i = 0; i < ASSESSMENT_CAPABILITY_ORDER.length; i += 1) {
    const capabilityId = ASSESSMENT_CAPABILITY_ORDER[i];
    const entry = value.capabilityAssessment[capabilityId];
    if (
      !isPlainObject(entry) ||
      typeof entry.available !== "boolean" ||
      typeof entry.ready !== "boolean"
    ) {
      return false;
    }
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.persistent === false &&
    value.advisoryMetadata.persistenceEnabled === false &&
    value.advisoryMetadata.readinessAssessmentOnly === true
  );
}

/**
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentWorkflowReadiness(value) {
  if (!isRecruitmentWorkflowReadinessAssessment(value)) {
    return EMPTY_READINESS_ASSESSMENT_SUMMARY;
  }

  return Object.freeze({
    readinessStatus: value.readinessStatus,
    readinessScore: value.readinessScore,
    missingCapabilityCount: value.missingCapabilities.length,
    recommendationCount: value.recommendations.length
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE,
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_ENTITY,
  READINESS_STATUSES,
  WORKFLOW_CAPABILITY_IDS,
  WORKFLOW_STATE_SIGNALS,
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA,
  EMPTY_READINESS_ASSESSMENT_SUMMARY,
  assessRecruitmentWorkflowReadiness,
  isRecruitmentWorkflowReadinessAssessment,
  summarizeRecruitmentWorkflowReadiness
};
