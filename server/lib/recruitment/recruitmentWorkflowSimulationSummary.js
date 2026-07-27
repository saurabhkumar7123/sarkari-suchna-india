"use strict";

/**
 * Phase 137 — Recruitment Workflow Simulation Summary (Advisory Only).
 *
 * Pure advisory summary that aggregates simulation engine, dry-run executor,
 * and simulation validator outputs for recruitment workflow advisory review.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_PHASE = 137;

const RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_ENTITY = "recruitment_workflow_simulation_summary";

const SUMMARY_POSTURE = Object.freeze({
  SIMULATION_READY: "SIMULATION_READY",
  SIMULATION_BLOCKED: "SIMULATION_BLOCKED",
  SIMULATION_REVIEW_REQUIRED: "SIMULATION_REVIEW_REQUIRED",
  SIMULATION_REGRESSION: "SIMULATION_REGRESSION",
  SIMULATION_RECOVERY: "SIMULATION_RECOVERY",
  UNKNOWN: "UNKNOWN"
});

const AGGREGATED_COMPONENT = Object.freeze({
  SIMULATION: "simulation",
  DRY_RUN: "dryRun",
  VALIDATION: "validation",
  SCENARIO: "scenario"
});

const SIMULATION_STATUS = Object.freeze({
  COMPLETE: "SIMULATION_COMPLETE",
  BLOCKED: "SIMULATION_BLOCKED",
  AWAITING_APPROVAL: "SIMULATION_AWAITING_APPROVAL",
  STORAGE_READY: "SIMULATION_STORAGE_READY",
  REGRESSION: "SIMULATION_REGRESSION",
  RECOVERY: "SIMULATION_RECOVERY",
  UNKNOWN: "SIMULATION_UNKNOWN"
});

const VALIDATION_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  PARTIALLY_CONSISTENT: "PARTIALLY_CONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const DRY_RUN_STATUS = Object.freeze({
  COMPLETED: "DRY_RUN_COMPLETED",
  PARTIAL: "DRY_RUN_PARTIAL",
  BLOCKED: "DRY_RUN_BLOCKED",
  SKIPPED: "DRY_RUN_SKIPPED",
  UNKNOWN: "DRY_RUN_UNKNOWN"
});

const RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_PHASE,
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
  simulationSummaryOnly: true,
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
 * @param {Readonly<Object>} simulation
 * @param {Readonly<Object>} validation
 * @returns {string}
 */
function resolveSummaryPosture(simulation, validation) {
  if (!isPlainObject(simulation)) {
    return SUMMARY_POSTURE.UNKNOWN;
  }

  const simStatus = simulation.simulationStatus;

  if (simStatus === SIMULATION_STATUS.BLOCKED) {
    return SUMMARY_POSTURE.SIMULATION_BLOCKED;
  }
  if (simStatus === SIMULATION_STATUS.REGRESSION) {
    return SUMMARY_POSTURE.SIMULATION_REGRESSION;
  }
  if (simStatus === SIMULATION_STATUS.RECOVERY) {
    return SUMMARY_POSTURE.SIMULATION_RECOVERY;
  }
  if (
    validation &&
    (validation.validationStatus === VALIDATION_STATUS.INCONSISTENT ||
      validation.validationStatus === VALIDATION_STATUS.PARTIALLY_CONSISTENT)
  ) {
    return SUMMARY_POSTURE.SIMULATION_REVIEW_REQUIRED;
  }
  if (
    simStatus === SIMULATION_STATUS.COMPLETE ||
    simStatus === SIMULATION_STATUS.STORAGE_READY ||
    simStatus === SIMULATION_STATUS.AWAITING_APPROVAL
  ) {
    return SUMMARY_POSTURE.SIMULATION_READY;
  }

  return SUMMARY_POSTURE.UNKNOWN;
}

/**
 * @param {Readonly<Object>} simulation
 * @param {Readonly<Object>} dryRun
 * @param {Readonly<Object>} validation
 * @param {Readonly<Object>} scenario
 * @returns {Readonly<Array>}
 */
function buildKeySimulationSignals(simulation, dryRun, validation, scenario) {
  const signals = [];

  if (scenario && scenario.id) {
    signals.push(`scenario:${scenario.id}`);
  }
  if (simulation && simulation.simulationStatus) {
    signals.push(`simulation:${simulation.simulationStatus}`);
  }
  if (dryRun && dryRun.dryRunStatus) {
    signals.push(`dryRun:${dryRun.dryRunStatus}`);
  }
  if (validation && validation.validationStatus) {
    signals.push(`validation:${validation.validationStatus}`);
  }
  if (simulation && simulation.workflowState) {
    signals.push(`workflowState:${simulation.workflowState}`);
  }

  return deepFreeze(signals);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowSimulationSummary(input) {
  if (!isPlainObject(input)) {
    return deepFreeze({
      summaryPosture: SUMMARY_POSTURE.UNKNOWN,
      recognized: false,
      aggregatedComponents: Object.freeze([]),
      keySimulationSignals: Object.freeze([]),
      simulationSummary: "Simulation summary awaits advisory simulation suite outputs.",
      advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA
    });
  }

  const simulation = input.simulation;
  const dryRun = input.dryRun;
  const validation = input.validation;
  const scenario = input.scenario;

  const summaryPosture = resolveSummaryPosture(simulation, validation);
  const keySimulationSignals = buildKeySimulationSignals(simulation, dryRun, validation, scenario);

  const aggregatedComponents = Object.freeze([
    Object.freeze({
      component: AGGREGATED_COMPONENT.SCENARIO,
      present: isPlainObject(scenario),
      scenarioId: scenario && scenario.id ? scenario.id : null
    }),
    Object.freeze({
      component: AGGREGATED_COMPONENT.SIMULATION,
      present: isPlainObject(simulation),
      simulationStatus: simulation && simulation.simulationStatus ? simulation.simulationStatus : null,
      stepCount: simulation && simulation.stepCount != null ? simulation.stepCount : 0,
      satisfiedCount: simulation && simulation.satisfiedCount != null ? simulation.satisfiedCount : 0,
      blockedCount: simulation && simulation.blockedCount != null ? simulation.blockedCount : 0
    }),
    Object.freeze({
      component: AGGREGATED_COMPONENT.DRY_RUN,
      present: isPlainObject(dryRun),
      dryRunStatus: dryRun && dryRun.dryRunStatus ? dryRun.dryRunStatus : null,
      successCount: dryRun && dryRun.successCount != null ? dryRun.successCount : 0,
      blockedCount: dryRun && dryRun.blockedCount != null ? dryRun.blockedCount : 0
    }),
    Object.freeze({
      component: AGGREGATED_COMPONENT.VALIDATION,
      present: isPlainObject(validation),
      validationStatus:
        validation && validation.validationStatus ? validation.validationStatus : null,
      passedCount: validation && validation.passedCount != null ? validation.passedCount : 0,
      failedCount: validation && validation.failedCount != null ? validation.failedCount : 0
    })
  ]);

  return deepFreeze({
    summaryPosture,
    recognized:
      isPlainObject(simulation) && isPlainObject(dryRun) && isPlainObject(validation),
    recruitmentId: input.recruitmentId || (simulation && simulation.recruitmentId) || null,
    scenarioId: (scenario && scenario.id) || (simulation && simulation.scenarioId) || null,
    aggregatedComponents,
    keySimulationSignals,
    simulationStatus: simulation && simulation.simulationStatus ? simulation.simulationStatus : null,
    dryRunStatus: dryRun && dryRun.dryRunStatus ? dryRun.dryRunStatus : null,
    validationStatus:
      validation && validation.validationStatus ? validation.validationStatus : null,
    workflowState: simulation && simulation.workflowState ? simulation.workflowState : null,
    simulationSummary: `Advisory simulation summary posture is ${summaryPosture} with ${keySimulationSignals.length} key signals.`,
    advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_ENTITY,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  SIMULATION_STATUS,
  VALIDATION_STATUS,
  DRY_RUN_STATUS,
  RECRUITMENT_WORKFLOW_SIMULATION_SUMMARY_METADATA,
  createRecruitmentWorkflowSimulationSummary
};
