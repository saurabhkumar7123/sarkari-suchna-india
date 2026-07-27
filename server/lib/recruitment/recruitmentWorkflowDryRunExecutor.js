"use strict";

/**
 * Phase 137 — Recruitment Workflow Dry-Run Executor (Advisory Only).
 *
 * Pure advisory dry-run executor that simulates workflow step execution without
 * side effects, persistence, or production runtime connection. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_PHASE = 137;

const RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_ENTITY = "recruitment_workflow_dry_run_executor";

const DRY_RUN_STATUS = Object.freeze({
  COMPLETED: "DRY_RUN_COMPLETED",
  PARTIAL: "DRY_RUN_PARTIAL",
  BLOCKED: "DRY_RUN_BLOCKED",
  SKIPPED: "DRY_RUN_SKIPPED",
  UNKNOWN: "DRY_RUN_UNKNOWN"
});

const DRY_RUN_STEP_OUTCOME = Object.freeze({
  SIMULATED_SUCCESS: "SIMULATED_SUCCESS",
  SIMULATED_PENDING: "SIMULATED_PENDING",
  SIMULATED_BLOCKED: "SIMULATED_BLOCKED",
  SIMULATED_SKIPPED: "SIMULATED_SKIPPED",
  SIMULATED_ADVISORY: "SIMULATED_ADVISORY"
});

const SIMULATION_STEP_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  BLOCKED: "BLOCKED",
  PENDING: "PENDING",
  SKIPPED: "SKIPPED",
  ADVISORY_ONLY: "ADVISORY_ONLY"
});

const RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_PHASE,
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
  dryRunOnly: true,
  dryRunExecutorOnly: true,
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
 * @param {string} stepStatus
 * @returns {string}
 */
function mapStepStatusToOutcome(stepStatus) {
  switch (stepStatus) {
    case SIMULATION_STEP_STATUS.SATISFIED:
      return DRY_RUN_STEP_OUTCOME.SIMULATED_SUCCESS;
    case SIMULATION_STEP_STATUS.PENDING:
      return DRY_RUN_STEP_OUTCOME.SIMULATED_PENDING;
    case SIMULATION_STEP_STATUS.BLOCKED:
      return DRY_RUN_STEP_OUTCOME.SIMULATED_BLOCKED;
    case SIMULATION_STEP_STATUS.SKIPPED:
      return DRY_RUN_STEP_OUTCOME.SIMULATED_SKIPPED;
    default:
      return DRY_RUN_STEP_OUTCOME.SIMULATED_ADVISORY;
  }
}

/**
 * @param {Readonly<Array>} stepResults
 * @returns {string}
 */
function resolveDryRunStatus(stepResults) {
  if (!Array.isArray(stepResults) || stepResults.length === 0) {
    return DRY_RUN_STATUS.UNKNOWN;
  }

  let blockedCount = 0;
  let successCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < stepResults.length; i += 1) {
    const outcome = stepResults[i].outcome;
    if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_BLOCKED) {
      blockedCount += 1;
    } else if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_SUCCESS) {
      successCount += 1;
    } else if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_PENDING) {
      pendingCount += 1;
    }
  }

  if (blockedCount > 0 && successCount === 0) {
    return DRY_RUN_STATUS.BLOCKED;
  }
  if (blockedCount > 0 || pendingCount > 0) {
    return DRY_RUN_STATUS.PARTIAL;
  }
  if (successCount === stepResults.length) {
    return DRY_RUN_STATUS.COMPLETED;
  }

  return DRY_RUN_STATUS.PARTIAL;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function executeRecruitmentWorkflowDryRun(input) {
  if (!isPlainObject(input)) {
    return deepFreeze({
      dryRunStatus: DRY_RUN_STATUS.UNKNOWN,
      recognized: false,
      stepCount: 0,
      successCount: 0,
      blockedCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      advisoryCount: 0,
      dryRunSteps: Object.freeze([]),
      dryRunSummary: "Dry-run executor awaits a recognized simulation plan.",
      sideEffects: false,
      persisted: false,
      executed: false,
      advisoryMetadata: RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA
    });
  }

  const plan = input.simulationPlan;
  const planSteps = plan && Array.isArray(plan.steps) ? plan.steps : [];

  if (planSteps.length === 0) {
    return deepFreeze({
      dryRunStatus: DRY_RUN_STATUS.SKIPPED,
      recognized: false,
      planId: plan && plan.planId ? plan.planId : null,
      stepCount: 0,
      successCount: 0,
      blockedCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      advisoryCount: 0,
      dryRunSteps: Object.freeze([]),
      dryRunSummary: "Dry-run skipped because simulation plan contains no steps.",
      sideEffects: false,
      persisted: false,
      executed: false,
      advisoryMetadata: RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA
    });
  }

  const dryRunSteps = planSteps.map((step, index) => {
    const eligible = step.dryRunEligible !== false;
    let outcome;
    if (step.status === SIMULATION_STEP_STATUS.BLOCKED) {
      outcome = DRY_RUN_STEP_OUTCOME.SIMULATED_BLOCKED;
    } else if (eligible) {
      outcome = mapStepStatusToOutcome(step.status);
    } else {
      outcome = DRY_RUN_STEP_OUTCOME.SIMULATED_SKIPPED;
    }

    return Object.freeze({
      sequence: index + 1,
      stepId: step.stepId,
      phase: step.phase,
      inputStatus: step.status,
      outcome,
      dryRunEligible: eligible,
      sideEffects: false,
      persisted: false,
      executed: false,
      advisoryOnly: true
    });
  });

  let successCount = 0;
  let blockedCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;
  let advisoryCount = 0;

  for (let i = 0; i < dryRunSteps.length; i += 1) {
    const outcome = dryRunSteps[i].outcome;
    if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_SUCCESS) {
      successCount += 1;
    } else if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_BLOCKED) {
      blockedCount += 1;
    } else if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_PENDING) {
      pendingCount += 1;
    } else if (outcome === DRY_RUN_STEP_OUTCOME.SIMULATED_SKIPPED) {
      skippedCount += 1;
    } else {
      advisoryCount += 1;
    }
  }

  const dryRunStatus = resolveDryRunStatus(dryRunSteps);

  return deepFreeze({
    dryRunStatus,
    recognized: true,
    planId: plan.planId || null,
    scenarioId: input.scenarioId || null,
    recruitmentId: input.recruitmentId || null,
    simulationStatus: input.simulationStatus || null,
    stepCount: dryRunSteps.length,
    successCount,
    blockedCount,
    pendingCount,
    skippedCount,
    advisoryCount,
    dryRunSteps,
    dryRunSummary: `Advisory dry-run completed with status ${dryRunStatus} across ${dryRunSteps.length} simulated steps.`,
    sideEffects: false,
    persisted: false,
    executed: false,
    advisoryMetadata: RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_PHASE,
  RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_ENTITY,
  DRY_RUN_STATUS,
  DRY_RUN_STEP_OUTCOME,
  SIMULATION_STEP_STATUS,
  RECRUITMENT_WORKFLOW_DRY_RUN_EXECUTOR_METADATA,
  executeRecruitmentWorkflowDryRun
};
