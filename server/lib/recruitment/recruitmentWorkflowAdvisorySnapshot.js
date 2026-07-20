"use strict";

/**
 * Phase 100 — Recruitment Workflow Advisory Snapshot (Read API).
 *
 * Pure read-only snapshot assembler for advisory outputs from Phases 95–99.
 * Aggregation only — no database access, no recomputation of business logic,
 * no state transitions, and no production mutations.
 *
 * No Express. No database. No filesystem. No network access.
 * No imports from other recruitment modules — vocabulary documented inline.
 */

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE = 100;

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY = "recruitment_workflow_advisory_snapshot";

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION = 1;

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION = "1.0.0";

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  recomputesBusinessLogic: false
});

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
  description:
    "Stable read-only advisory snapshot composed from Phases 95–99 workflow outputs.",
  snapshotVersion: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION,
  schemaVersion: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION,
  metadata: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA
});

const EMPTY_WORKFLOW_ADVISORY_SNAPSHOT = Object.freeze({
  version: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION,
  generatedAt: null,
  advisorySummary: null,
  lifecycle: null,
  transition: null,
  validation: null,
  recommendation: null,
  metadata: Object.freeze({
    phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
    schemaVersion: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION,
    featureFlagState: null,
    snapshotComplete: false
  }),
  advisory: true,
  architectureOnly: true,
  executed: false
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
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

function isAdvisorySection(value) {
  return (
    isPlainObject(value) &&
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

function snapshotValue(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    const copied = [];
    for (let i = 0; i < value.length; i += 1) {
      copied.push(snapshotValue(value[i]));
    }
    return copied;
  }
  const copied = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    copied[keys[i]] = snapshotValue(value[keys[i]]);
  }
  return copied;
}

function snapshotAdvisorySection(value) {
  if (!isAdvisorySection(value)) {
    return null;
  }
  return deepFreeze(snapshotValue(value));
}

function extractGeneratedAt(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  const generatedAt = normalizeString(context.generatedAt);
  if (generatedAt == null) {
    return null;
  }
  const parsed = Date.parse(generatedAt);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function extractLifecycleResolution(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return snapshotAdvisorySection(context.lifecycleResolution);
}

function extractTransitionResolution(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isAdvisorySection(context.transitionResolution)) {
    return snapshotAdvisorySection(context.transitionResolution);
  }

  if (isAdvisorySection(context.lifecycleTransitionResolution)) {
    return snapshotAdvisorySection(context.lifecycleTransitionResolution);
  }

  return null;
}

function extractWorkflowValidation(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return snapshotAdvisorySection(context.workflowValidation);
}

function extractWorkflowRecommendation(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return snapshotAdvisorySection(context.workflowRecommendation);
}

function extractWorkflowAdvisorySummary(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return snapshotAdvisorySection(context.workflowAdvisorySummary);
}

function extractFeatureFlagState(context) {
  if (!isPlainObject(context) || !isPlainObject(context.featureFlags)) {
    return null;
  }

  const flags = context.featureFlags;
  return deepFreeze({
    workflowIntegrationEnabled: flags.workflowIntegrationEnabled === true,
    pipelineEnabled: flags.pipelineEnabled === true,
    automaticPersistenceEnabled: flags.automaticPersistenceEnabled === true,
    reviewQueueEnqueueEnabled: flags.reviewQueueEnqueueEnabled === true
  });
}

function resolveSnapshotComplete(
  advisorySummary,
  lifecycle,
  transition,
  validation,
  recommendation
) {
  return (
    advisorySummary != null &&
    lifecycle != null &&
    transition != null &&
    validation != null &&
    recommendation != null
  );
}

function buildSnapshotMetadata(context, snapshotComplete) {
  return deepFreeze({
    phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
    schemaVersion: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION,
    featureFlagState: extractFeatureFlagState(context),
    snapshotComplete
  });
}

function buildSnapshotResult(context) {
  const advisorySummary = extractWorkflowAdvisorySummary(context);
  const lifecycle = extractLifecycleResolution(context);
  const transition = extractTransitionResolution(context);
  const validation = extractWorkflowValidation(context);
  const recommendation = extractWorkflowRecommendation(context);
  const snapshotComplete = resolveSnapshotComplete(
    advisorySummary,
    lifecycle,
    transition,
    validation,
    recommendation
  );

  return deepFreeze({
    version: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION,
    generatedAt: extractGeneratedAt(context),
    advisorySummary,
    lifecycle,
    transition,
    validation,
    recommendation,
    metadata: buildSnapshotMetadata(context, snapshotComplete),
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Build a stable read-only recruitment workflow advisory snapshot from Phases 95–99 outputs.
 * Pure: no I/O, no mutation of input, no production side effects, no recomputation.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowAdvisorySnapshot(context) {
  if (!isPlainObject(context)) {
    return deepFreeze({ ...EMPTY_WORKFLOW_ADVISORY_SNAPSHOT });
  }

  return buildSnapshotResult(context);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isWorkflowAdvisorySnapshotResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.version !== RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION ||
    (value.generatedAt != null && typeof value.generatedAt !== "string")
  ) {
    return false;
  }

  if (!isPlainObject(value.metadata)) {
    return false;
  }

  if (
    value.metadata.phase !== RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE ||
    value.metadata.schemaVersion !== RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION ||
    typeof value.metadata.snapshotComplete !== "boolean"
  ) {
    return false;
  }

  const sections = [
    value.advisorySummary,
    value.lifecycle,
    value.transition,
    value.validation,
    value.recommendation
  ];

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (section != null && !isAdvisorySection(section)) {
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
 * @param {Object|null|undefined} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateWorkflowAdvisorySnapshotResult(result) {
  if (!isWorkflowAdvisorySnapshotResult(result)) {
    return deepFreeze({
      valid: false,
      status: "invalid",
      reasons: Object.freeze(["INVALID_ADVISORY_SNAPSHOT_SHAPE"])
    });
  }

  const reasons = [];
  if (result.metadata.snapshotComplete !== true) {
    reasons.push("INCOMPLETE_ADVISORY_SNAPSHOT");
  }

  return deepFreeze({
    valid: true,
    status: reasons.length === 0 ? "complete" : "partial",
    reasons: Object.freeze(reasons.slice())
  });
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeWorkflowAdvisorySnapshotResult(result) {
  const validation = validateWorkflowAdvisorySnapshotResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
      entity: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY,
      valid: false,
      snapshotComplete: false,
      readOnly: true
    });
  }

  return Object.freeze({
    phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
    entity: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY,
    valid: true,
    version: result.version,
    schemaVersion: result.metadata.schemaVersion,
    snapshotComplete: result.metadata.snapshotComplete,
    generatedAt: result.generatedAt,
    readOnly: true
  });
}

// ---------------------------------------------------------------------------
// Phase 125 — Recruitment Workflow Advisory Snapshot Model (Advisory Only)
// ---------------------------------------------------------------------------

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE = 125;

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_ENTITY =
  "recruitment_workflow_advisory_snapshot_model";

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION = "phase_125_v1";

const PHASE_125_WORKFLOW_STATUSES = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  REVIEW_READY: "REVIEW_READY",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
  BLOCKED: "BLOCKED"
});

const PHASE_125_READINESS_STATUSES = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED"
});

const PHASE_125_READINESS_SCORE_BY_STATUS = Object.freeze({
  [PHASE_125_READINESS_STATUSES.NOT_STARTED]: 0,
  [PHASE_125_READINESS_STATUSES.BLOCKED]: 0,
  [PHASE_125_READINESS_STATUSES.PARTIALLY_READY]: 25,
  [PHASE_125_READINESS_STATUSES.REVIEW_READY]: 50,
  [PHASE_125_READINESS_STATUSES.APPROVAL_PENDING]: 75,
  [PHASE_125_READINESS_STATUSES.READY_FOR_STORAGE]: 100
});

const PHASE_125_WORKFLOW_STATUS_SUMMARIES = Object.freeze({
  [PHASE_125_WORKFLOW_STATUSES.DRAFT_CREATED]:
    "Workflow has recruitment identity and requires draft proposal creation",
  [PHASE_125_WORKFLOW_STATUSES.REVIEW_READY]:
    "Workflow has draft proposal and requires review package creation",
  [PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL]:
    "Workflow is waiting for approval decision",
  [PHASE_125_WORKFLOW_STATUSES.APPROVED_FOR_STORAGE]:
    "Workflow is approved but awaiting repository contract availability",
  [PHASE_125_WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY]:
    "Workflow is approved and ready for persistence boundary review",
  [PHASE_125_WORKFLOW_STATUSES.BLOCKED]:
    "Workflow is blocked and requires context resolution before proceeding"
});

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  advisorySnapshotOnly: true,
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
  historyTracking: false,
  snapshotPersistence: false,
  sourcePhases: Object.freeze([120, 121, 122, 123, 124])
});

const RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE,
  description:
    "Pure advisory snapshot model representing complete workflow advisory state at a point in time.",
  snapshotVersion: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION,
  metadata: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA
});

const EMPTY_ADVISORY_SNAPSHOT_SUMMARY = Object.freeze({
  workflowState: PHASE_125_WORKFLOW_STATUSES.BLOCKED,
  readinessStatus: PHASE_125_READINESS_STATUSES.BLOCKED,
  readinessScore: 0,
  capabilityTotal: 0,
  capabilityAvailable: 0,
  decisionTraceEntries: 0
});

const EMPTY_DECISION_SNAPSHOT_SUMMARY =
  "Workflow decision trace unavailable due to insufficient evaluation context";

/**
 * @param {*} recruitmentId
 * @returns {boolean}
 */
function phase125HasRecruitmentIdentity(recruitmentId) {
  if (typeof recruitmentId === "number") {
    return Number.isFinite(recruitmentId);
  }

  if (typeof recruitmentId === "string") {
    return recruitmentId.trim().length > 0;
  }

  return false;
}

/**
 * @param {*} workflowState
 * @returns {string}
 */
function phase125ResolveWorkflowState(workflowState) {
  if (typeof workflowState === "string" && workflowState.length > 0) {
    const validStatuses = Object.values(PHASE_125_WORKFLOW_STATUSES);
    return validStatuses.includes(workflowState) ? workflowState : PHASE_125_WORKFLOW_STATUSES.BLOCKED;
  }

  if (isPlainObject(workflowState)) {
    const candidates = [workflowState.workflowState, workflowState.state];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (typeof candidate === "string" && candidate.length > 0) {
        const validStatuses = Object.values(PHASE_125_WORKFLOW_STATUSES);
        return validStatuses.includes(candidate)
          ? candidate
          : PHASE_125_WORKFLOW_STATUSES.BLOCKED;
      }
    }
  }

  return PHASE_125_WORKFLOW_STATUSES.BLOCKED;
}

/**
 * @param {*} workflowState
 * @param {*} advisoryReport
 * @param {*} decisionTrace
 * @returns {string|null}
 */
function phase125ResolveNextAction(workflowState, advisoryReport, decisionTrace) {
  if (isPlainObject(workflowState) && typeof workflowState.nextRecommendedAction === "string") {
    const action = workflowState.nextRecommendedAction.trim();
    if (action.length > 0) {
      return action;
    }
  }

  if (
    isPlainObject(advisoryReport) &&
    Array.isArray(advisoryReport.recommendations) &&
    advisoryReport.recommendations.length > 0 &&
    typeof advisoryReport.recommendations[0] === "string" &&
    advisoryReport.recommendations[0].length > 0
  ) {
    return advisoryReport.recommendations[0];
  }

  if (
    isPlainObject(decisionTrace) &&
    typeof decisionTrace.nextRecommendedAction === "string" &&
    decisionTrace.nextRecommendedAction.length > 0
  ) {
    return decisionTrace.nextRecommendedAction;
  }

  return null;
}

/**
 * @param {*} readinessAssessment
 * @returns {string}
 */
function phase125ResolveReadinessStatus(readinessAssessment) {
  if (!isPlainObject(readinessAssessment)) {
    return PHASE_125_READINESS_STATUSES.BLOCKED;
  }

  const candidates = [readinessAssessment.readinessStatus, readinessAssessment.status];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (
      typeof candidate === "string" &&
      Object.values(PHASE_125_READINESS_STATUSES).includes(candidate)
    ) {
      return candidate;
    }
  }

  return PHASE_125_READINESS_STATUSES.BLOCKED;
}

/**
 * @param {*} readinessAssessment
 * @param {string} readinessStatus
 * @returns {number}
 */
function phase125ResolveReadinessScore(readinessAssessment, readinessStatus) {
  if (isPlainObject(readinessAssessment)) {
    const scoreCandidates = [readinessAssessment.readinessScore, readinessAssessment.score];
    for (let i = 0; i < scoreCandidates.length; i += 1) {
      const candidate = scoreCandidates[i];
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }

  return PHASE_125_READINESS_SCORE_BY_STATUS[readinessStatus] ?? 0;
}

/**
 * @param {*} capabilityRegistry
 * @returns {Readonly<Object>}
 */
function phase125BuildCapabilitySnapshot(capabilityRegistry) {
  if (!isPlainObject(capabilityRegistry) || !Array.isArray(capabilityRegistry.capabilities)) {
    return {
      total: 0,
      available: 0
    };
  }

  const capabilities = capabilityRegistry.capabilities;
  let available = 0;

  for (let i = 0; i < capabilities.length; i += 1) {
    const capability = capabilities[i];
    if (isPlainObject(capability) && capability.status === "available") {
      available += 1;
    }
  }

  return {
    total: capabilities.length,
    available
  };
}

/**
 * @param {*} decisionTrace
 * @returns {Readonly<Object>}
 */
function phase125BuildDecisionSnapshot(decisionTrace) {
  if (!isPlainObject(decisionTrace)) {
    return {
      summary: EMPTY_DECISION_SNAPSHOT_SUMMARY,
      traceEntries: 0
    };
  }

  const summary =
    typeof decisionTrace.decisionSummary === "string" && decisionTrace.decisionSummary.length > 0
      ? decisionTrace.decisionSummary
      : EMPTY_DECISION_SNAPSHOT_SUMMARY;

  if (Array.isArray(decisionTrace.traceEntries) && decisionTrace.traceEntries.length > 0) {
    return {
      summary,
      traceEntries: decisionTrace.traceEntries.length
    };
  }

  const reasoningChain = Array.isArray(decisionTrace.reasoningChain)
    ? decisionTrace.reasoningChain
    : [];

  return {
    summary,
    traceEntries: reasoningChain.length
  };
}

/**
 * @param {*} advisoryReport
 * @param {string} workflowState
 * @param {string} readinessStatus
 * @param {Readonly<Object>} decisionSnapshot
 * @param {string|null} nextAction
 * @returns {string}
 */
function phase125ResolveReportSummary(
  advisoryReport,
  workflowState,
  readinessStatus,
  decisionSnapshot,
  nextAction
) {
  if (isPlainObject(advisoryReport)) {
    if (typeof advisoryReport.summary === "string" && advisoryReport.summary.length > 0) {
      return advisoryReport.summary;
    }

    if (typeof advisoryReport.reportSummary === "string" && advisoryReport.reportSummary.length > 0) {
      return advisoryReport.reportSummary;
    }
  }

  if (workflowState === PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL) {
    return PHASE_125_WORKFLOW_STATUS_SUMMARIES[PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL];
  }

  if (readinessStatus === PHASE_125_READINESS_STATUSES.APPROVAL_PENDING) {
    return PHASE_125_WORKFLOW_STATUS_SUMMARIES[PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL];
  }

  if (
    workflowState !== PHASE_125_WORKFLOW_STATUSES.BLOCKED &&
    PHASE_125_WORKFLOW_STATUS_SUMMARIES[workflowState] != null
  ) {
    return PHASE_125_WORKFLOW_STATUS_SUMMARIES[workflowState];
  }

  if (
    typeof decisionSnapshot.summary === "string" &&
    decisionSnapshot.summary !== EMPTY_DECISION_SNAPSHOT_SUMMARY
  ) {
    return decisionSnapshot.summary;
  }

  if (typeof nextAction === "string" && nextAction.length > 0) {
    return `Workflow advisory recommends: ${nextAction}`;
  }

  return PHASE_125_WORKFLOW_STATUS_SUMMARIES[PHASE_125_WORKFLOW_STATUSES.BLOCKED];
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function phase125BuildSnapshotResult(params) {
  return deepFreeze({
    snapshotVersion: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION,
    recruitmentId: params.recruitmentId,
    workflowSnapshot: deepFreeze({
      state: params.workflowState,
      nextAction: params.nextAction
    }),
    readinessSnapshot: deepFreeze({
      status: params.readinessStatus,
      score: params.readinessScore
    }),
    capabilitySnapshot: deepFreeze(params.capabilitySnapshot),
    decisionSnapshot: deepFreeze(params.decisionSnapshot),
    reportSummary: params.reportSummary,
    snapshotMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_125",
      phase: RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      snapshotPersistence: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisorySnapshotOnly: true
    })
  });
}

/**
 * Create an immutable advisory snapshot from supplied workflow information.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowAdvisorySnapshot(input) {
  try {
    if (!isPlainObject(input)) {
      const readinessStatus = PHASE_125_READINESS_STATUSES.BLOCKED;
      const decisionSnapshot = phase125BuildDecisionSnapshot(null);

      return phase125BuildSnapshotResult({
        recruitmentId: null,
        workflowState: PHASE_125_WORKFLOW_STATUSES.BLOCKED,
        nextAction: null,
        readinessStatus,
        readinessScore: PHASE_125_READINESS_SCORE_BY_STATUS[readinessStatus],
        capabilitySnapshot: phase125BuildCapabilitySnapshot(null),
        decisionSnapshot,
        reportSummary: PHASE_125_WORKFLOW_STATUS_SUMMARIES[PHASE_125_WORKFLOW_STATUSES.BLOCKED]
      });
    }

    const recruitmentId = phase125HasRecruitmentIdentity(input.recruitmentId)
      ? input.recruitmentId
      : null;
    const workflowState = phase125ResolveWorkflowState(input.workflowState);
    const readinessStatus = phase125ResolveReadinessStatus(input.readinessAssessment);
    const readinessScore = phase125ResolveReadinessScore(input.readinessAssessment, readinessStatus);
    const capabilitySnapshot = phase125BuildCapabilitySnapshot(input.capabilityRegistry);
    const decisionSnapshot = phase125BuildDecisionSnapshot(input.decisionTrace);
    const nextAction = phase125ResolveNextAction(
      input.workflowState,
      input.advisoryReport,
      input.decisionTrace
    );

    const effectiveWorkflowState =
      recruitmentId == null ? PHASE_125_WORKFLOW_STATUSES.BLOCKED : workflowState;
    const effectiveReadinessStatus =
      recruitmentId == null ? PHASE_125_READINESS_STATUSES.BLOCKED : readinessStatus;
    const effectiveReadinessScore =
      recruitmentId == null
        ? PHASE_125_READINESS_SCORE_BY_STATUS[PHASE_125_READINESS_STATUSES.BLOCKED]
        : readinessScore;

    const reportSummary = phase125ResolveReportSummary(
      input.advisoryReport,
      effectiveWorkflowState,
      effectiveReadinessStatus,
      decisionSnapshot,
      nextAction
    );

    return phase125BuildSnapshotResult({
      recruitmentId,
      workflowState: effectiveWorkflowState,
      nextAction,
      readinessStatus: effectiveReadinessStatus,
      readinessScore: effectiveReadinessScore,
      capabilitySnapshot,
      decisionSnapshot,
      reportSummary
    });
  } catch {
    const readinessStatus = PHASE_125_READINESS_STATUSES.BLOCKED;
    const decisionSnapshot = phase125BuildDecisionSnapshot(null);

    return phase125BuildSnapshotResult({
      recruitmentId: null,
      workflowState: PHASE_125_WORKFLOW_STATUSES.BLOCKED,
      nextAction: null,
      readinessStatus,
      readinessScore: PHASE_125_READINESS_SCORE_BY_STATUS[readinessStatus],
      capabilitySnapshot: phase125BuildCapabilitySnapshot(null),
      decisionSnapshot,
      reportSummary: PHASE_125_WORKFLOW_STATUS_SUMMARIES[PHASE_125_WORKFLOW_STATUSES.BLOCKED]
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowAdvisorySnapshotModel(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.snapshotVersion !== RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION ||
    !isPlainObject(value.workflowSnapshot) ||
    !isPlainObject(value.readinessSnapshot) ||
    !isPlainObject(value.capabilitySnapshot) ||
    !isPlainObject(value.decisionSnapshot) ||
    typeof value.reportSummary !== "string" ||
    !isPlainObject(value.snapshotMetadata)
  ) {
    return false;
  }

  const validWorkflowStatuses = Object.values(PHASE_125_WORKFLOW_STATUSES);
  const validReadinessStatuses = Object.values(PHASE_125_READINESS_STATUSES);

  if (
    !validWorkflowStatuses.includes(value.workflowSnapshot.state) ||
    (typeof value.workflowSnapshot.nextAction !== "string" &&
      value.workflowSnapshot.nextAction !== null) ||
    !validReadinessStatuses.includes(value.readinessSnapshot.status) ||
    typeof value.readinessSnapshot.score !== "number" ||
    typeof value.capabilitySnapshot.total !== "number" ||
    typeof value.capabilitySnapshot.available !== "number" ||
    typeof value.decisionSnapshot.summary !== "string" ||
    typeof value.decisionSnapshot.traceEntries !== "number"
  ) {
    return false;
  }

  return (
    value.snapshotMetadata.advisoryOnly === true &&
    value.snapshotMetadata.generatedBy === "phase_125" &&
    value.snapshotMetadata.persistent === false &&
    value.snapshotMetadata.advisorySnapshotOnly === true
  );
}

/**
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentWorkflowAdvisorySnapshotModel(value) {
  if (!isRecruitmentWorkflowAdvisorySnapshotModel(value)) {
    return EMPTY_ADVISORY_SNAPSHOT_SUMMARY;
  }

  return Object.freeze({
    workflowState: value.workflowSnapshot.state,
    readinessStatus: value.readinessSnapshot.status,
    readinessScore: value.readinessSnapshot.score,
    capabilityTotal: value.capabilitySnapshot.total,
    capabilityAvailable: value.capabilitySnapshot.available,
    decisionTraceEntries: value.decisionSnapshot.traceEntries
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_ENTITY,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_VERSION,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_SCHEMA_VERSION,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_METADATA,
  EMPTY_WORKFLOW_ADVISORY_SNAPSHOT,
  buildRecruitmentWorkflowAdvisorySnapshot,
  isWorkflowAdvisorySnapshotResult,
  validateWorkflowAdvisorySnapshotResult,
  summarizeWorkflowAdvisorySnapshotResult,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_ENTITY,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION,
  PHASE_125_WORKFLOW_STATUSES,
  PHASE_125_READINESS_STATUSES,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA,
  EMPTY_ADVISORY_SNAPSHOT_SUMMARY,
  createRecruitmentWorkflowAdvisorySnapshot,
  isRecruitmentWorkflowAdvisorySnapshotModel,
  summarizeRecruitmentWorkflowAdvisorySnapshotModel
};
