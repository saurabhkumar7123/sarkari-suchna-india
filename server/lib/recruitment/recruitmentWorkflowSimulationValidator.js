"use strict";

/**
 * Phase 137 — Recruitment Workflow Simulation Validator (Advisory Only).
 *
 * Pure advisory validator that checks consistency between simulation engine
 * outputs and dry-run executor results. No database access, no persistence,
 * no runtime imports, no side effects. No automation. Never mutates input.
 * Never persists output.
 */

const RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_PHASE = 137;

const RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_ENTITY =
  "recruitment_workflow_simulation_validator";

const VALIDATION_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  PARTIALLY_CONSISTENT: "PARTIALLY_CONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const VALIDATION_RULE_STATUS = Object.freeze({
  PASSED: "PASSED",
  FAILED: "FAILED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  UNKNOWN: "UNKNOWN"
});

const VALIDATION_RULE_IDS = Object.freeze({
  STEP_COUNT_ALIGNMENT: "STEP_COUNT_ALIGNMENT",
  BLOCKED_COUNT_ALIGNMENT: "BLOCKED_COUNT_ALIGNMENT",
  PLAN_ID_PRESENCE: "PLAN_ID_PRESENCE",
  SIMULATION_STATUS_COHERENCE: "SIMULATION_STATUS_COHERENCE",
  DRY_RUN_STATUS_COHERENCE: "DRY_RUN_STATUS_COHERENCE",
  NO_SIDE_EFFECTS: "NO_SIDE_EFFECTS",
  NO_PERSISTENCE: "NO_PERSISTENCE",
  ADVISORY_ONLY_ENFORCED: "ADVISORY_ONLY_ENFORCED",
  SCENARIO_ID_ALIGNMENT: "SCENARIO_ID_ALIGNMENT",
  RECRUITMENT_ID_ALIGNMENT: "RECRUITMENT_ID_ALIGNMENT"
});

const VALIDATION_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: VALIDATION_RULE_IDS.STEP_COUNT_ALIGNMENT,
    label: "Simulation and dry-run step counts must align"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.BLOCKED_COUNT_ALIGNMENT,
    label: "Blocked step counts must be coherent between simulation and dry-run"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.PLAN_ID_PRESENCE,
    label: "Simulation plan identifier must be present when recognized"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.SIMULATION_STATUS_COHERENCE,
    label: "Simulation status must be recognized for valid contexts"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.DRY_RUN_STATUS_COHERENCE,
    label: "Dry-run status must be coherent with simulation status"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.NO_SIDE_EFFECTS,
    label: "Dry-run must declare no side effects"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.NO_PERSISTENCE,
    label: "Dry-run must declare no persistence"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.ADVISORY_ONLY_ENFORCED,
    label: "All outputs must remain advisory-only"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.SCENARIO_ID_ALIGNMENT,
    label: "Scenario identifiers must align across simulation and dry-run"
  }),
  Object.freeze({
    id: VALIDATION_RULE_IDS.RECRUITMENT_ID_ALIGNMENT,
    label: "Recruitment identifiers must align across simulation and dry-run"
  })
]);

const RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_PHASE,
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
  simulationValidatorOnly: true,
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
 * @param {Readonly<Object>} dryRun
 * @param {string} ruleId
 * @returns {string}
 */
function evaluateValidationRule(simulation, dryRun, ruleId) {
  if (!isPlainObject(simulation) || !isPlainObject(dryRun)) {
    return VALIDATION_RULE_STATUS.UNKNOWN;
  }

  switch (ruleId) {
    case VALIDATION_RULE_IDS.STEP_COUNT_ALIGNMENT:
      return simulation.stepCount === dryRun.stepCount
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.BLOCKED_COUNT_ALIGNMENT:
      if (simulation.blockedCount === 0 && dryRun.blockedCount === 0) {
        return VALIDATION_RULE_STATUS.PASSED;
      }
      return simulation.blockedCount <= dryRun.blockedCount + simulation.pendingCount
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.PLAN_ID_PRESENCE:
      return simulation.recognized && simulation.simulationPlan && simulation.simulationPlan.planId
        ? VALIDATION_RULE_STATUS.PASSED
        : simulation.recognized === false
          ? VALIDATION_RULE_STATUS.NOT_APPLICABLE
          : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.SIMULATION_STATUS_COHERENCE:
      return simulation.simulationStatus && simulation.simulationStatus !== "SIMULATION_UNKNOWN"
        ? VALIDATION_RULE_STATUS.PASSED
        : simulation.recognized === false
          ? VALIDATION_RULE_STATUS.NOT_APPLICABLE
          : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.DRY_RUN_STATUS_COHERENCE:
      if (!dryRun.recognized) {
        return VALIDATION_RULE_STATUS.NOT_APPLICABLE;
      }
      if (simulation.simulationStatus === "SIMULATION_BLOCKED") {
        return dryRun.dryRunStatus === "DRY_RUN_BLOCKED" || dryRun.dryRunStatus === "DRY_RUN_PARTIAL"
          ? VALIDATION_RULE_STATUS.PASSED
          : VALIDATION_RULE_STATUS.FAILED;
      }
      return dryRun.dryRunStatus !== "DRY_RUN_UNKNOWN"
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.NO_SIDE_EFFECTS:
      return dryRun.sideEffects === false
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.NO_PERSISTENCE:
      return dryRun.persisted === false
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.ADVISORY_ONLY_ENFORCED:
      return simulation.advisoryMetadata &&
        simulation.advisoryMetadata.advisoryOnly === true &&
        dryRun.advisoryMetadata &&
        dryRun.advisoryMetadata.advisoryOnly === true
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.SCENARIO_ID_ALIGNMENT:
      if (simulation.scenarioId == null && dryRun.scenarioId == null) {
        return VALIDATION_RULE_STATUS.NOT_APPLICABLE;
      }
      return simulation.scenarioId === dryRun.scenarioId
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    case VALIDATION_RULE_IDS.RECRUITMENT_ID_ALIGNMENT:
      return simulation.recruitmentId === dryRun.recruitmentId
        ? VALIDATION_RULE_STATUS.PASSED
        : VALIDATION_RULE_STATUS.FAILED;

    default:
      return VALIDATION_RULE_STATUS.UNKNOWN;
  }
}

/**
 * @param {Readonly<Array>} ruleResults
 * @returns {string}
 */
function resolveValidationStatus(ruleResults) {
  if (!Array.isArray(ruleResults) || ruleResults.length === 0) {
    return VALIDATION_STATUS.UNKNOWN;
  }

  let failedCount = 0;
  let passedCount = 0;

  for (let i = 0; i < ruleResults.length; i += 1) {
    if (ruleResults[i].status === VALIDATION_RULE_STATUS.FAILED) {
      failedCount += 1;
    } else if (ruleResults[i].status === VALIDATION_RULE_STATUS.PASSED) {
      passedCount += 1;
    }
  }

  if (failedCount > 0) {
    return passedCount > 0 ? VALIDATION_STATUS.PARTIALLY_CONSISTENT : VALIDATION_STATUS.INCONSISTENT;
  }
  if (passedCount > 0) {
    return VALIDATION_STATUS.CONSISTENT;
  }

  return VALIDATION_STATUS.UNKNOWN;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentWorkflowSimulation(input) {
  if (!isPlainObject(input)) {
    return deepFreeze({
      validationStatus: VALIDATION_STATUS.UNKNOWN,
      recognized: false,
      ruleCount: VALIDATION_RULE_DEFINITIONS.length,
      passedCount: 0,
      failedCount: 0,
      notApplicableCount: VALIDATION_RULE_DEFINITIONS.length,
      validationRules: Object.freeze([]),
      validationSummary: "Simulation validator awaits simulation and dry-run outputs.",
      advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA
    });
  }

  const simulation = input.simulation;
  const dryRun = input.dryRun;

  const validationRules = VALIDATION_RULE_DEFINITIONS.map((definition) => {
    const status = evaluateValidationRule(simulation, dryRun, definition.id);
    return Object.freeze({
      id: definition.id,
      label: definition.label,
      status
    });
  });

  let passedCount = 0;
  let failedCount = 0;
  let notApplicableCount = 0;

  for (let i = 0; i < validationRules.length; i += 1) {
    const status = validationRules[i].status;
    if (status === VALIDATION_RULE_STATUS.PASSED) {
      passedCount += 1;
    } else if (status === VALIDATION_RULE_STATUS.FAILED) {
      failedCount += 1;
    } else if (status === VALIDATION_RULE_STATUS.NOT_APPLICABLE) {
      notApplicableCount += 1;
    }
  }

  const validationStatus = resolveValidationStatus(validationRules);

  return deepFreeze({
    validationStatus,
    recognized: isPlainObject(simulation) && isPlainObject(dryRun),
    ruleCount: validationRules.length,
    passedCount,
    failedCount,
    notApplicableCount,
    validationRules,
    validationSummary: `Simulation consistency validation completed with status ${validationStatus}.`,
    advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_ENTITY,
  VALIDATION_STATUS,
  VALIDATION_RULE_STATUS,
  VALIDATION_RULE_IDS,
  VALIDATION_RULE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SIMULATION_VALIDATOR_METADATA,
  validateRecruitmentWorkflowSimulation
};
