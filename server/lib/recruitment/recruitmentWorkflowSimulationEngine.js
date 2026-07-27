"use strict";

/**
 * Phase 137 — Recruitment Workflow Simulation Engine (Advisory Only).
 *
 * Pure advisory simulation engine that models the complete recruitment workflow
 * architecture without connecting to production runtime. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_PHASE = 137;

const RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_ENTITY = "recruitment_workflow_simulation_engine";

const SIMULATION_STATUS = Object.freeze({
  COMPLETE: "SIMULATION_COMPLETE",
  BLOCKED: "SIMULATION_BLOCKED",
  AWAITING_APPROVAL: "SIMULATION_AWAITING_APPROVAL",
  STORAGE_READY: "SIMULATION_STORAGE_READY",
  REGRESSION: "SIMULATION_REGRESSION",
  RECOVERY: "SIMULATION_RECOVERY",
  UNKNOWN: "SIMULATION_UNKNOWN"
});

const WORKFLOW_STATE = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  REVIEW_READY: "REVIEW_READY",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  APPROVED_FOR_STORAGE: "APPROVED_FOR_STORAGE",
  STORAGE_BOUNDARY_READY: "STORAGE_BOUNDARY_READY",
  BLOCKED: "BLOCKED",
  REGRESSION_DETECTED: "REGRESSION_DETECTED",
  RECOVERY_IN_PROGRESS: "RECOVERY_IN_PROGRESS"
});

const SIMULATION_STEP_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  BLOCKED: "BLOCKED",
  PENDING: "PENDING",
  SKIPPED: "SKIPPED",
  ADVISORY_ONLY: "ADVISORY_ONLY"
});

const SIMULATION_STEP_IDS = Object.freeze({
  DRAFT_PROPOSAL: "DRAFT_PROPOSAL",
  PERSISTENCE_BOUNDARY: "PERSISTENCE_BOUNDARY",
  APPROVAL_GATE: "APPROVAL_GATE",
  REVIEW_PACKAGE: "REVIEW_PACKAGE",
  STORAGE_ADAPTER: "STORAGE_ADAPTER",
  REPOSITORY_CONTRACT: "REPOSITORY_CONTRACT",
  ORCHESTRATION: "ORCHESTRATION",
  TRACE_AND_REGISTRY: "TRACE_AND_REGISTRY",
  READINESS_ASSESSMENT: "READINESS_ASSESSMENT",
  SNAPSHOT_ANALYSIS: "SNAPSHOT_ANALYSIS",
  HEALTH_AND_RISK: "HEALTH_AND_RISK",
  INTELLIGENCE_AGGREGATION: "INTELLIGENCE_AGGREGATION",
  CONSISTENCY_VALIDATION: "CONSISTENCY_VALIDATION",
  INTEGRATION_READINESS: "INTEGRATION_READINESS",
  CONTROLLED_INTEGRATION: "CONTROLLED_INTEGRATION",
  GOVERNANCE_REVIEW: "GOVERNANCE_REVIEW"
});

const SIMULATION_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: SIMULATION_STEP_IDS.DRAFT_PROPOSAL, phase: 114, label: "Draft proposal advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.PERSISTENCE_BOUNDARY, phase: 115, label: "Persistence boundary advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.APPROVAL_GATE, phase: 116, label: "Approval gate advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.REVIEW_PACKAGE, phase: 117, label: "Review package advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.STORAGE_ADAPTER, phase: 118, label: "Storage adapter advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.REPOSITORY_CONTRACT, phase: 119, label: "Repository contract advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.ORCHESTRATION, phase: 120, label: "Workflow orchestration advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.TRACE_AND_REGISTRY, phase: 121, label: "Trace and registry advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.READINESS_ASSESSMENT, phase: 123, label: "Readiness assessment advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.SNAPSHOT_ANALYSIS, phase: 125, label: "Snapshot analysis advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.HEALTH_AND_RISK, phase: 128, label: "Health and risk advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.INTELLIGENCE_AGGREGATION, phase: 130, label: "Intelligence aggregation advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.CONSISTENCY_VALIDATION, phase: 133, label: "Consistency validation advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.INTEGRATION_READINESS, phase: 134, label: "Integration readiness advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.CONTROLLED_INTEGRATION, phase: 135, label: "Controlled integration advisory" }),
  Object.freeze({ id: SIMULATION_STEP_IDS.GOVERNANCE_REVIEW, phase: 136, label: "Governance review advisory" })
]);

const RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_137",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  simulationOnly: true,
  simulationEngineOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136
  ])
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
 * @param {Readonly<Object>} context
 * @param {string} stepId
 * @returns {string}
 */
function evaluateStepStatus(context, stepId) {
  if (!isPlainObject(context) || context.recruitmentId == null) {
    return SIMULATION_STEP_STATUS.BLOCKED;
  }

  switch (stepId) {
    case SIMULATION_STEP_IDS.DRAFT_PROPOSAL:
      return context.draftProposal && context.draftProposal.present
        ? SIMULATION_STEP_STATUS.SATISFIED
        : SIMULATION_STEP_STATUS.BLOCKED;

    case SIMULATION_STEP_IDS.PERSISTENCE_BOUNDARY:
      return context.persistenceBoundary && context.persistenceBoundary.ready
        ? SIMULATION_STEP_STATUS.SATISFIED
        : SIMULATION_STEP_STATUS.ADVISORY_ONLY;

    case SIMULATION_STEP_IDS.APPROVAL_GATE: {
      const approval = context.approval && context.approval.status;
      if (approval === "APPROVED") {
        return SIMULATION_STEP_STATUS.SATISFIED;
      }
      if (approval === "PENDING" || approval === "NEEDS_REVIEW") {
        return SIMULATION_STEP_STATUS.PENDING;
      }
      return SIMULATION_STEP_STATUS.BLOCKED;
    }

    case SIMULATION_STEP_IDS.REVIEW_PACKAGE:
      return context.reviewPackage && context.reviewPackage.present
        ? SIMULATION_STEP_STATUS.SATISFIED
        : SIMULATION_STEP_STATUS.BLOCKED;

    case SIMULATION_STEP_IDS.STORAGE_ADAPTER:
    case SIMULATION_STEP_IDS.REPOSITORY_CONTRACT:
      return context.storageBoundary && context.storageBoundary.ready
        ? SIMULATION_STEP_STATUS.SATISFIED
        : SIMULATION_STEP_STATUS.PENDING;

    case SIMULATION_STEP_IDS.ORCHESTRATION:
      return context.workflowState && context.workflowState !== WORKFLOW_STATE.BLOCKED
        ? SIMULATION_STEP_STATUS.ADVISORY_ONLY
        : SIMULATION_STEP_STATUS.BLOCKED;

    case SIMULATION_STEP_IDS.CONSISTENCY_VALIDATION: {
      const consistency = context.consistencyValidation && context.consistencyValidation.consistencyStatus;
      return consistency === "INCONSISTENT"
        ? SIMULATION_STEP_STATUS.BLOCKED
        : SIMULATION_STEP_STATUS.SATISFIED;
    }

    case SIMULATION_STEP_IDS.INTEGRATION_READINESS: {
      const integration = context.integrationReadiness && context.integrationReadiness.integrationStatus;
      if (integration === "NOT_READY") {
        return SIMULATION_STEP_STATUS.BLOCKED;
      }
      if (integration === "PARTIALLY_READY") {
        return SIMULATION_STEP_STATUS.PENDING;
      }
      return SIMULATION_STEP_STATUS.SATISFIED;
    }

    case SIMULATION_STEP_IDS.GOVERNANCE_REVIEW:
      return context.governanceReview && context.governanceReview.complete
        ? SIMULATION_STEP_STATUS.SATISFIED
        : SIMULATION_STEP_STATUS.ADVISORY_ONLY;

    default:
      return SIMULATION_STEP_STATUS.ADVISORY_ONLY;
  }
}

/**
 * @param {Readonly<Object>} context
 * @returns {string}
 */
function resolveSimulationStatus(context) {
  if (!isPlainObject(context)) {
    return SIMULATION_STATUS.UNKNOWN;
  }

  const state = context.workflowState;

  if (state === WORKFLOW_STATE.BLOCKED || context.recruitmentId == null) {
    return SIMULATION_STATUS.BLOCKED;
  }
  if (state === WORKFLOW_STATE.WAITING_FOR_APPROVAL) {
    return SIMULATION_STATUS.AWAITING_APPROVAL;
  }
  if (state === WORKFLOW_STATE.REGRESSION_DETECTED) {
    return SIMULATION_STATUS.REGRESSION;
  }
  if (state === WORKFLOW_STATE.RECOVERY_IN_PROGRESS) {
    return SIMULATION_STATUS.RECOVERY;
  }
  if (state === WORKFLOW_STATE.STORAGE_BOUNDARY_READY) {
    return SIMULATION_STATUS.STORAGE_READY;
  }
  if (
    state === WORKFLOW_STATE.APPROVED_FOR_STORAGE ||
    state === WORKFLOW_STATE.REVIEW_READY ||
    state === WORKFLOW_STATE.DRAFT_CREATED
  ) {
    return SIMULATION_STATUS.COMPLETE;
  }

  return SIMULATION_STATUS.UNKNOWN;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function simulateRecruitmentWorkflow(input) {
  if (!isPlainObject(input)) {
    return deepFreeze({
      simulationStatus: SIMULATION_STATUS.UNKNOWN,
      workflowState: WORKFLOW_STATE.BLOCKED,
      recognized: false,
      stepCount: SIMULATION_STEP_DEFINITIONS.length,
      satisfiedCount: 0,
      blockedCount: SIMULATION_STEP_DEFINITIONS.length,
      pendingCount: 0,
      simulationSteps: Object.freeze([]),
      simulationPlan: Object.freeze({
        planId: null,
        steps: Object.freeze([]),
        advisoryOnly: true,
        executed: false
      }),
      simulationSummary: "Simulation engine awaits a recognized advisory workflow context.",
      advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA
    });
  }

  const simulationSteps = SIMULATION_STEP_DEFINITIONS.map((definition) => {
    const status = evaluateStepStatus(input, definition.id);
    return Object.freeze({
      id: definition.id,
      phase: definition.phase,
      label: definition.label,
      status,
      advisoryOnly: true,
      executed: false
    });
  });

  let satisfiedCount = 0;
  let blockedCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < simulationSteps.length; i += 1) {
    const status = simulationSteps[i].status;
    if (status === SIMULATION_STEP_STATUS.SATISFIED) {
      satisfiedCount += 1;
    } else if (status === SIMULATION_STEP_STATUS.BLOCKED) {
      blockedCount += 1;
    } else if (status === SIMULATION_STEP_STATUS.PENDING) {
      pendingCount += 1;
    }
  }

  const simulationStatus = resolveSimulationStatus(input);
  const workflowState = input.workflowState || WORKFLOW_STATE.BLOCKED;

  const planSteps = simulationSteps.map((step) =>
    Object.freeze({
      stepId: step.id,
      phase: step.phase,
      status: step.status,
      dryRunEligible: step.status !== SIMULATION_STEP_STATUS.BLOCKED
    })
  );

  return deepFreeze({
    simulationStatus,
    workflowState,
    recognized: input.recognized !== false,
    scenarioId: input.scenarioId || null,
    recruitmentId: input.recruitmentId || null,
    stepCount: simulationSteps.length,
    satisfiedCount,
    blockedCount,
    pendingCount,
    advisoryOnlyCount: simulationSteps.length - satisfiedCount - blockedCount - pendingCount,
    simulationSteps,
    simulationPlan: Object.freeze({
      planId: `sim-plan-${input.scenarioId || "unknown"}-${input.recruitmentId || "none"}`,
      steps: deepFreeze(planSteps),
      advisoryOnly: true,
      executed: false,
      simulationOnly: true
    }),
    simulationSummary: `Advisory simulation completed with status ${simulationStatus} across ${simulationSteps.length} workflow steps.`,
    advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_ENTITY,
  SIMULATION_STATUS,
  WORKFLOW_STATE,
  SIMULATION_STEP_STATUS,
  SIMULATION_STEP_IDS,
  SIMULATION_STEP_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SIMULATION_ENGINE_METADATA,
  simulateRecruitmentWorkflow
};
