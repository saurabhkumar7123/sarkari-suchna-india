"use strict";

/**
 * Phase 124 — Recruitment Workflow Advisory Report Generator (Advisory Only).
 *
 * Pure advisory report generator that combines supplied workflow advisory signals
 * into a structured human-readable recruitment workflow report without storage,
 * persistence, coordinator invocation, pipeline mutations, or side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions. No report publishing behavior.
 */

const RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE = 124;

const RECRUITMENT_WORKFLOW_ADVISORY_REPORT_ENTITY =
  "recruitment_workflow_advisory_report";

const RECRUITMENT_WORKFLOW_ADVISORY_REPORT_TITLE =
  "Recruitment Workflow Advisory Report";

const WORKFLOW_STATUSES = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  REVIEW_READY: "REVIEW_READY",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
  BLOCKED: "BLOCKED"
});

const READINESS_STATUSES = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED"
});

const READINESS_SCORE_BY_STATUS = Object.freeze({
  [READINESS_STATUSES.NOT_STARTED]: 0,
  [READINESS_STATUSES.BLOCKED]: 0,
  [READINESS_STATUSES.PARTIALLY_READY]: 25,
  [READINESS_STATUSES.REVIEW_READY]: 50,
  [READINESS_STATUSES.APPROVAL_PENDING]: 75,
  [READINESS_STATUSES.READY_FOR_STORAGE]: 100
});

const WORKFLOW_STATUS_SUMMARIES = Object.freeze({
  [WORKFLOW_STATUSES.DRAFT_CREATED]:
    "Workflow has recruitment identity and requires draft proposal creation",
  [WORKFLOW_STATUSES.REVIEW_READY]:
    "Workflow has draft proposal and requires review package creation",
  [WORKFLOW_STATUSES.WAITING_FOR_APPROVAL]:
    "Workflow is waiting for approval decision",
  [WORKFLOW_STATUSES.APPROVED_FOR_STORAGE]:
    "Workflow is approved but awaiting repository contract availability",
  [WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY]:
    "Workflow is approved and ready for persistence boundary review",
  [WORKFLOW_STATUSES.BLOCKED]:
    "Workflow is blocked and requires context resolution before proceeding"
});

const RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  advisoryReportOnly: true,
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
  reportPublishing: false,
  sourcePhases: Object.freeze([120, 121, 122, 123])
});

const RECRUITMENT_WORKFLOW_ADVISORY_REPORT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_ADVISORY_REPORT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE,
  description:
    "Pure advisory report generator combining workflow advisory outputs into a structured recruitment workflow report.",
  metadata: RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA
});

const EMPTY_ADVISORY_REPORT_SUMMARY = Object.freeze({
  workflowStatus: WORKFLOW_STATUSES.BLOCKED,
  readinessStatus: READINESS_STATUSES.BLOCKED,
  readinessScore: 0,
  pendingItemCount: 1,
  recommendationCount: 1
});

const EMPTY_DECISION_TRACE_SUMMARY =
  "Workflow decision trace unavailable due to insufficient evaluation context";

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
 * @param {string|null|undefined} workflowState
 * @returns {string}
 */
function normalizeWorkflowStatus(workflowState) {
  if (typeof workflowState !== "string" || workflowState.length === 0) {
    return WORKFLOW_STATUSES.BLOCKED;
  }

  const validStatuses = Object.values(WORKFLOW_STATUSES);
  return validStatuses.includes(workflowState) ? workflowState : WORKFLOW_STATUSES.BLOCKED;
}

/**
 * @param {*} readinessAssessment
 * @returns {string}
 */
function resolveReadinessStatus(readinessAssessment) {
  if (!isPlainObject(readinessAssessment)) {
    return READINESS_STATUSES.BLOCKED;
  }

  const candidates = [readinessAssessment.readinessStatus, readinessAssessment.status];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (typeof candidate === "string" && Object.values(READINESS_STATUSES).includes(candidate)) {
      return candidate;
    }
  }

  return READINESS_STATUSES.BLOCKED;
}

/**
 * @param {*} readinessAssessment
 * @param {string} readinessStatus
 * @returns {number}
 */
function resolveReadinessScore(readinessAssessment, readinessStatus) {
  if (isPlainObject(readinessAssessment)) {
    const scoreCandidates = [readinessAssessment.readinessScore, readinessAssessment.score];
    for (let i = 0; i < scoreCandidates.length; i += 1) {
      const candidate = scoreCandidates[i];
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }

  return READINESS_SCORE_BY_STATUS[readinessStatus] ?? 0;
}

/**
 * @param {*} capabilityRegistry
 * @returns {Readonly<Object>}
 */
function buildCapabilitySummary(capabilityRegistry) {
  if (!isPlainObject(capabilityRegistry) || !Array.isArray(capabilityRegistry.capabilities)) {
    return {
      totalCapabilities: 0,
      availableCapabilities: 0,
      advisoryOnly: true,
      productionConnectedCount: 0
    };
  }

  const capabilities = capabilityRegistry.capabilities;
  let availableCapabilities = 0;
  let productionConnectedCount = 0;

  for (let i = 0; i < capabilities.length; i += 1) {
    const capability = capabilities[i];
    if (!isPlainObject(capability)) {
      continue;
    }

    if (capability.status === "available") {
      availableCapabilities += 1;
    }

    if (capability.productionConnected === true) {
      productionConnectedCount += 1;
    }
  }

  const registryAdvisoryOnly =
    isPlainObject(capabilityRegistry.metadata) &&
    capabilityRegistry.metadata.advisoryOnly === true;

  return {
    totalCapabilities: capabilities.length,
    availableCapabilities,
    advisoryOnly: registryAdvisoryOnly || productionConnectedCount === 0,
    productionConnectedCount
  };
}

/**
 * @param {*} decisionTrace
 * @returns {Readonly<Object>}
 */
function buildDecisionSummary(decisionTrace) {
  if (!isPlainObject(decisionTrace)) {
    return {
      summary: EMPTY_DECISION_TRACE_SUMMARY,
      reasoningStepCount: 0,
      pendingStepCount: 0
    };
  }

  const summary =
    typeof decisionTrace.decisionSummary === "string" && decisionTrace.decisionSummary.length > 0
      ? decisionTrace.decisionSummary
      : EMPTY_DECISION_TRACE_SUMMARY;

  const reasoningChain = Array.isArray(decisionTrace.reasoningChain)
    ? decisionTrace.reasoningChain
    : [];

  let pendingStepCount = 0;
  for (let i = 0; i < reasoningChain.length; i += 1) {
    const step = reasoningChain[i];
    if (isPlainObject(step) && step.result === "PENDING") {
      pendingStepCount += 1;
    }
  }

  return {
    summary,
    reasoningStepCount: reasoningChain.length,
    pendingStepCount
  };
}

/**
 * @param {string} workflowStatus
 * @param {string} readinessStatus
 * @param {Readonly<Object>} decisionSummary
 * @param {string|null|undefined} nextRecommendedAction
 * @returns {string}
 */
function buildReportSummary(
  workflowStatus,
  readinessStatus,
  decisionSummary,
  nextRecommendedAction
) {
  if (workflowStatus === WORKFLOW_STATUSES.WAITING_FOR_APPROVAL) {
    return WORKFLOW_STATUS_SUMMARIES[WORKFLOW_STATUSES.WAITING_FOR_APPROVAL];
  }

  if (readinessStatus === READINESS_STATUSES.APPROVAL_PENDING) {
    return WORKFLOW_STATUS_SUMMARIES[WORKFLOW_STATUSES.WAITING_FOR_APPROVAL];
  }

  if (
    workflowStatus !== WORKFLOW_STATUSES.BLOCKED &&
    WORKFLOW_STATUS_SUMMARIES[workflowStatus] != null
  ) {
    return WORKFLOW_STATUS_SUMMARIES[workflowStatus];
  }

  if (
    typeof decisionSummary.summary === "string" &&
    decisionSummary.summary !== EMPTY_DECISION_TRACE_SUMMARY
  ) {
    return decisionSummary.summary;
  }

  if (typeof nextRecommendedAction === "string" && nextRecommendedAction.length > 0) {
    return `Workflow advisory recommends: ${nextRecommendedAction}`;
  }

  return WORKFLOW_STATUS_SUMMARIES[WORKFLOW_STATUSES.BLOCKED];
}

/**
 * @param {string} workflowStatus
 * @param {string} readinessStatus
 * @param {Readonly<Object>} decisionSummary
 * @param {string|null|undefined} nextRecommendedAction
 * @returns {ReadonlyArray<string>}
 */
function derivePendingItems(
  workflowStatus,
  readinessStatus,
  decisionSummary,
  nextRecommendedAction
) {
  const pendingItems = [];

  if (workflowStatus === WORKFLOW_STATUSES.BLOCKED || readinessStatus === READINESS_STATUSES.BLOCKED) {
    pendingItems.push("Resolve blocked workflow context");
    return pendingItems;
  }

  if (
    workflowStatus === WORKFLOW_STATUSES.WAITING_FOR_APPROVAL ||
    readinessStatus === READINESS_STATUSES.APPROVAL_PENDING
  ) {
    pendingItems.push("Approval decision required");
  }

  if (workflowStatus === WORKFLOW_STATUSES.DRAFT_CREATED) {
    pendingItems.push("Draft proposal required");
  }

  if (workflowStatus === WORKFLOW_STATUSES.REVIEW_READY) {
    pendingItems.push("Review package required");
  }

  if (workflowStatus === WORKFLOW_STATUSES.APPROVED_FOR_STORAGE) {
    pendingItems.push("Repository contract availability required");
  }

  if (decisionSummary.pendingStepCount > 0 && pendingItems.length === 0) {
    pendingItems.push("Pending workflow evaluation steps require attention");
  }

  if (
    pendingItems.length === 0 &&
    typeof nextRecommendedAction === "string" &&
    nextRecommendedAction.length > 0
  ) {
    pendingItems.push(nextRecommendedAction);
  }

  if (pendingItems.length === 0) {
    pendingItems.push("No pending workflow items identified");
  }

  return pendingItems;
}

/**
 * @param {string} workflowStatus
 * @param {string} readinessStatus
 * @param {string|null|undefined} nextRecommendedAction
 * @returns {ReadonlyArray<string>}
 */
function deriveRecommendations(workflowStatus, readinessStatus, nextRecommendedAction) {
  const recommendations = [];

  if (workflowStatus === WORKFLOW_STATUSES.BLOCKED || readinessStatus === READINESS_STATUSES.BLOCKED) {
    recommendations.push("Resolve blocked workflow context");
    return recommendations;
  }

  if (
    workflowStatus === WORKFLOW_STATUSES.WAITING_FOR_APPROVAL ||
    readinessStatus === READINESS_STATUSES.APPROVAL_PENDING
  ) {
    recommendations.push("Await approval before persistence boundary");
    return recommendations;
  }

  if (workflowStatus === WORKFLOW_STATUSES.DRAFT_CREATED) {
    recommendations.push("Create draft proposal");
    return recommendations;
  }

  if (workflowStatus === WORKFLOW_STATUSES.REVIEW_READY) {
    recommendations.push("Create review package");
    return recommendations;
  }

  if (workflowStatus === WORKFLOW_STATUSES.APPROVED_FOR_STORAGE) {
    recommendations.push("Await repository contract availability");
    return recommendations;
  }

  if (workflowStatus === WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY) {
    recommendations.push("Ready for persistence boundary review");
    return recommendations;
  }

  if (typeof nextRecommendedAction === "string" && nextRecommendedAction.length > 0) {
    recommendations.push(nextRecommendedAction);
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
    recommendations.push("Prepare approval gate review");
    return recommendations;
  }

  if (readinessStatus === READINESS_STATUSES.READY_FOR_STORAGE) {
    recommendations.push("Ready for storage boundary review");
    return recommendations;
  }

  recommendations.push("Review workflow advisory context");
  return recommendations;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildAdvisoryReportResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    reportTitle: RECRUITMENT_WORKFLOW_ADVISORY_REPORT_TITLE,
    summary: params.summary,
    workflowStatus: params.workflowStatus,
    readinessSummary: deepFreeze({
      status: params.readinessStatus,
      score: params.readinessScore
    }),
    capabilitySummary: deepFreeze(params.capabilitySummary),
    decisionSummary: deepFreeze(params.decisionSummary),
    pendingItems: deepFreeze(params.pendingItems.slice()),
    recommendations: deepFreeze(params.recommendations.slice()),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      generatedBy: "phase_124",
      persistent: false,
      phase: RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      reportPublishing: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryReportOnly: true
    })
  });
}

/**
 * Generate a structured recruitment workflow advisory report from supplied signals.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function generateRecruitmentWorkflowAdvisoryReport(input) {
  try {
    if (!isPlainObject(input)) {
      const readinessStatus = READINESS_STATUSES.BLOCKED;
      const decisionSummary = buildDecisionSummary(null);

      return buildAdvisoryReportResult({
        recruitmentId: null,
        workflowStatus: WORKFLOW_STATUSES.BLOCKED,
        readinessStatus,
        readinessScore: READINESS_SCORE_BY_STATUS[readinessStatus],
        capabilitySummary: buildCapabilitySummary(null),
        decisionSummary,
        summary: WORKFLOW_STATUS_SUMMARIES[WORKFLOW_STATUSES.BLOCKED],
        pendingItems: derivePendingItems(
          WORKFLOW_STATUSES.BLOCKED,
          readinessStatus,
          decisionSummary,
          null
        ),
        recommendations: deriveRecommendations(
          WORKFLOW_STATUSES.BLOCKED,
          readinessStatus,
          null
        )
      });
    }

    const recruitmentId = hasRecruitmentIdentity(input.recruitmentId)
      ? input.recruitmentId
      : null;
    const workflowStatus = normalizeWorkflowStatus(input.workflowState);
    const nextRecommendedAction =
      typeof input.nextRecommendedAction === "string" ? input.nextRecommendedAction : null;
    const readinessStatus = resolveReadinessStatus(input.readinessAssessment);
    const readinessScore = resolveReadinessScore(input.readinessAssessment, readinessStatus);
    const capabilitySummary = buildCapabilitySummary(input.capabilityRegistry);
    const decisionSummary = buildDecisionSummary(input.decisionTrace);

    const effectiveWorkflowStatus =
      recruitmentId == null ? WORKFLOW_STATUSES.BLOCKED : workflowStatus;
    const effectiveReadinessStatus =
      recruitmentId == null ? READINESS_STATUSES.BLOCKED : readinessStatus;
    const effectiveReadinessScore =
      recruitmentId == null
        ? READINESS_SCORE_BY_STATUS[READINESS_STATUSES.BLOCKED]
        : readinessScore;

    const summary = buildReportSummary(
      effectiveWorkflowStatus,
      effectiveReadinessStatus,
      decisionSummary,
      nextRecommendedAction
    );

    const pendingItems = derivePendingItems(
      effectiveWorkflowStatus,
      effectiveReadinessStatus,
      decisionSummary,
      nextRecommendedAction
    );

    const recommendations = deriveRecommendations(
      effectiveWorkflowStatus,
      effectiveReadinessStatus,
      nextRecommendedAction
    );

    return buildAdvisoryReportResult({
      recruitmentId,
      workflowStatus: effectiveWorkflowStatus,
      readinessStatus: effectiveReadinessStatus,
      readinessScore: effectiveReadinessScore,
      capabilitySummary,
      decisionSummary,
      summary,
      pendingItems,
      recommendations
    });
  } catch {
    const readinessStatus = READINESS_STATUSES.BLOCKED;
    const decisionSummary = buildDecisionSummary(null);

    return buildAdvisoryReportResult({
      recruitmentId: null,
      workflowStatus: WORKFLOW_STATUSES.BLOCKED,
      readinessStatus,
      readinessScore: READINESS_SCORE_BY_STATUS[readinessStatus],
      capabilitySummary: buildCapabilitySummary(null),
      decisionSummary,
      summary: WORKFLOW_STATUS_SUMMARIES[WORKFLOW_STATUSES.BLOCKED],
      pendingItems: derivePendingItems(
        WORKFLOW_STATUSES.BLOCKED,
        readinessStatus,
        decisionSummary,
        null
      ),
      recommendations: deriveRecommendations(
        WORKFLOW_STATUSES.BLOCKED,
        readinessStatus,
        null
      )
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowAdvisoryReport(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.reportTitle !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.workflowStatus !== "string" ||
    !isPlainObject(value.readinessSummary) ||
    !isPlainObject(value.capabilitySummary) ||
    !isPlainObject(value.decisionSummary) ||
    !Array.isArray(value.pendingItems) ||
    !Array.isArray(value.recommendations) ||
    !isPlainObject(value.advisoryMetadata)
  ) {
    return false;
  }

  const validWorkflowStatuses = Object.values(WORKFLOW_STATUSES);
  const validReadinessStatuses = Object.values(READINESS_STATUSES);

  if (
    !validWorkflowStatuses.includes(value.workflowStatus) ||
    !validReadinessStatuses.includes(value.readinessSummary.status) ||
    typeof value.readinessSummary.score !== "number" ||
    typeof value.decisionSummary.summary !== "string" ||
    typeof value.decisionSummary.reasoningStepCount !== "number" ||
    typeof value.decisionSummary.pendingStepCount !== "number"
  ) {
    return false;
  }

  return (
    value.reportTitle === RECRUITMENT_WORKFLOW_ADVISORY_REPORT_TITLE &&
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.generatedBy === "phase_124" &&
    value.advisoryMetadata.persistent === false &&
    value.advisoryMetadata.advisoryReportOnly === true
  );
}

/**
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentWorkflowAdvisoryReport(value) {
  if (!isRecruitmentWorkflowAdvisoryReport(value)) {
    return EMPTY_ADVISORY_REPORT_SUMMARY;
  }

  return Object.freeze({
    workflowStatus: value.workflowStatus,
    readinessStatus: value.readinessSummary.status,
    readinessScore: value.readinessSummary.score,
    pendingItemCount: value.pendingItems.length,
    recommendationCount: value.recommendations.length
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_ENTITY,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_TITLE,
  WORKFLOW_STATUSES,
  READINESS_STATUSES,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA,
  EMPTY_ADVISORY_REPORT_SUMMARY,
  generateRecruitmentWorkflowAdvisoryReport,
  isRecruitmentWorkflowAdvisoryReport,
  summarizeRecruitmentWorkflowAdvisoryReport
};
