"use strict";

/**
 * Phase 146 — Recruitment Rollout Simulation (Advisory Only).
 *
 * Pure advisory simulation of rollout sequence including order, checkpoint
 * progression, dependency satisfaction, simulated stop conditions, and
 * simulated rollback points. No rollout activation. No execution.
 * No database access, no persistence, no runtime imports, no side effects.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_ROLLOUT_SIMULATION_PHASE = 146;

const RECRUITMENT_ROLLOUT_SIMULATION_ENTITY = "recruitment_rollout_simulation";

const ROLLOUT_SIMULATION_SCHEMA_VERSION = "1.0.0";

const ROLLOUT_SIMULATION_STATUS = Object.freeze({
  SEQUENCE_COMPLETE: "ROLLOUT_SEQUENCE_COMPLETE",
  SEQUENCE_PARTIAL: "ROLLOUT_SEQUENCE_PARTIAL",
  SEQUENCE_STOPPED: "ROLLOUT_SEQUENCE_STOPPED",
  SEQUENCE_EMPTY: "ROLLOUT_SEQUENCE_EMPTY",
  UNKNOWN: "ROLLOUT_SEQUENCE_UNKNOWN"
});

const CHECKPOINT_PROGRESSION_STATUS = Object.freeze({
  PASSED: "PASSED",
  PENDING: "PENDING",
  BLOCKED: "BLOCKED",
  STOPPED: "STOPPED",
  SKIPPED: "SKIPPED"
});

const STOP_CONDITION_IDS = Object.freeze({
  MISSING_PREREQUISITE: "STOP_MISSING_PREREQUISITE",
  DEPENDENCY_FAILURE: "STOP_DEPENDENCY_FAILURE",
  CONFLICT_DETECTED: "STOP_CONFLICT_DETECTED",
  ROLLBACK_REQUIRED: "STOP_ROLLBACK_REQUIRED",
  RUNTIME_ACTIVATION_ATTEMPT: "STOP_RUNTIME_ACTIVATION_ATTEMPT",
  FLAG_ACTIVATION_ATTEMPT: "STOP_FLAG_ACTIVATION_ATTEMPT",
  EMPTY_PLAN: "STOP_EMPTY_PLAN"
});

const ROLLOUT_STEP_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    stepId: "ROLLOUT_BOUNDARY_ISOLATION",
    capabilityId: "CAP_BOUNDARY_ISOLATION",
    checkpointId: "CHK_BOUNDARY_DOCUMENTED",
    label: "Boundary isolation confirmation",
    dependencies: Object.freeze([]),
    rollbackPointId: "RB_POINT_BOUNDARY"
  }),
  Object.freeze({
    order: 2,
    stepId: "ROLLOUT_RUNTIME_ADAPTER",
    capabilityId: "CAP_RUNTIME_ADAPTER",
    checkpointId: "CHK_ADAPTER_INTERFACE_DEFINED",
    label: "Runtime adapter scaffold",
    dependencies: Object.freeze(["CAP_BOUNDARY_ISOLATION"]),
    rollbackPointId: "RB_POINT_ADAPTER"
  }),
  Object.freeze({
    order: 3,
    stepId: "ROLLOUT_FEATURE_FLAGS",
    capabilityId: "CAP_FEATURE_FLAGS",
    checkpointId: "CHK_FLAGS_DEFINED_NOT_ACTIVE",
    label: "Feature flag infrastructure",
    dependencies: Object.freeze(["CAP_RUNTIME_ADAPTER"]),
    rollbackPointId: "RB_POINT_FLAGS"
  }),
  Object.freeze({
    order: 4,
    stepId: "ROLLOUT_SHADOW_MODE",
    capabilityId: "CAP_SHADOW_MODE",
    checkpointId: "CHK_SHADOW_READ_ONLY",
    label: "Shadow observation readiness",
    dependencies: Object.freeze(["CAP_FEATURE_FLAGS"]),
    rollbackPointId: "RB_POINT_SHADOW"
  }),
  Object.freeze({
    order: 5,
    stepId: "ROLLOUT_GOVERNANCE_GATES",
    capabilityId: "CAP_GOVERNANCE_GATES",
    checkpointId: "CHK_GOVERNANCE_REVIEW",
    label: "Governance gate progression",
    dependencies: Object.freeze(["CAP_SHADOW_MODE"]),
    rollbackPointId: "RB_POINT_GOVERNANCE"
  }),
  Object.freeze({
    order: 6,
    stepId: "ROLLOUT_MONITORING",
    capabilityId: "CAP_MONITORING",
    checkpointId: "CHK_MONITORING_READY",
    label: "Monitoring verification",
    dependencies: Object.freeze(["CAP_GOVERNANCE_GATES"]),
    rollbackPointId: "RB_POINT_MONITORING"
  }),
  Object.freeze({
    order: 7,
    stepId: "ROLLOUT_ROLLBACK",
    capabilityId: "CAP_ROLLBACK",
    checkpointId: "CHK_ROLLBACK_VERIFIED",
    label: "Rollback readiness",
    dependencies: Object.freeze(["CAP_MONITORING", "CAP_FEATURE_FLAGS"]),
    rollbackPointId: "RB_POINT_ROLLBACK_VERIFIED"
  }),
  Object.freeze({
    order: 8,
    stepId: "ROLLOUT_CONTROLLED_COUPLING",
    capabilityId: "CAP_CONTROLLED_COUPLING",
    checkpointId: "CHK_COUPLING_NOT_ACTIVATED",
    label: "Controlled coupling planning (never activated)",
    dependencies: Object.freeze(["CAP_ROLLBACK", "CAP_GOVERNANCE_GATES"]),
    rollbackPointId: "RB_POINT_COUPLING"
  })
]);

const RECRUITMENT_ROLLOUT_SIMULATION_METADATA = Object.freeze({
  phase: RECRUITMENT_ROLLOUT_SIMULATION_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  rolloutSimulationOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  activatesAnything: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145
  ])
});

const RECRUITMENT_ROLLOUT_SIMULATION_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_ROLLOUT_SIMULATION_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_ROLLOUT_SIMULATION_PHASE,
  description:
    "Pure advisory rollout sequence simulation without rollout activation.",
  schemaVersion: ROLLOUT_SIMULATION_SCHEMA_VERSION,
  metadata: RECRUITMENT_ROLLOUT_SIMULATION_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "rolloutSimulationStatus",
  "rolloutOrder",
  "checkpointProgression",
  "dependencySatisfaction",
  "simulatedStopConditions",
  "simulatedRollbackPoints",
  "confidence",
  "generatedMetadata",
  "advisoryMetadata"
]);

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
 * @returns {string}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null || recruitmentId === "") {
    return "UNKNOWN";
  }
  return String(recruitmentId);
}

/**
 * @param {*} value
 * @returns {ReadonlyArray<string>}
 */
function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  const result = [];
  const seen = Object.create(null);
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    let id = null;
    if (typeof item === "string") {
      id = item;
    } else if (isPlainObject(item) && typeof item.id === "string") {
      id = item.id;
    } else if (isPlainObject(item) && typeof item.capabilityId === "string") {
      id = item.capabilityId;
    }
    if (id != null && seen[id] !== true) {
      seen[id] = true;
      result.push(id);
    }
  }
  result.sort();
  return Object.freeze(result);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function deriveReadyCapabilitySet(input) {
  const ready = Object.create(null);
  if (!isPlainObject(input)) {
    return Object.freeze(ready);
  }

  const sources = [
    input.readyCapabilities,
    input.completedCapabilities,
    input.capabilitySignals,
    input.supportedCapabilities,
    input.capabilities,
    input.requestedCapabilities
  ];

  if (isPlainObject(input.implementationPlan)) {
    sources.push(input.implementationPlan.supportedCapabilities);
    sources.push(input.implementationPlan.capabilities);
  }

  for (let s = 0; s < sources.length; s += 1) {
    const source = sources[s];
    if (Array.isArray(source)) {
      for (let i = 0; i < source.length; i += 1) {
        const item = source[i];
        if (typeof item === "string") {
          ready[item] = true;
        } else if (isPlainObject(item) && typeof item.id === "string") {
          if (
            item.ready === true ||
            item.complete === true ||
            item.satisfied === true ||
            item.ready == null
          ) {
            ready[item.id] = true;
          }
        } else if (isPlainObject(item) && typeof item.capabilityId === "string") {
          ready[item.capabilityId] = true;
        }
      }
    } else if (isPlainObject(source)) {
      const keys = Object.keys(source);
      for (let i = 0; i < keys.length; i += 1) {
        const value = source[keys[i]];
        if (
          value === true ||
          (isPlainObject(value) &&
            (value.ready === true || value.complete === true || value.satisfied === true))
        ) {
          ready[keys[i]] = true;
        }
      }
    }
  }

  return Object.freeze(ready);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function extractRolloutSignals(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      hasInput: false,
      hasCapabilitySignals: false,
      readySet: Object.freeze(Object.create(null)),
      activatesRuntime: false,
      enablesRollout: false,
      enablesFlags: false,
      forceStop: false,
      forceRollback: false,
      declaredStopConditions: Object.freeze([])
    });
  }

  const readySet = deriveReadyCapabilitySet(input);
  const hasCapabilitySignals =
    input.readyCapabilities != null ||
    input.completedCapabilities != null ||
    input.capabilitySignals != null ||
    input.supportedCapabilities != null ||
    input.capabilities != null ||
    input.requestedCapabilities != null ||
    (isPlainObject(input.implementationPlan) &&
      (input.implementationPlan.supportedCapabilities != null ||
        input.implementationPlan.capabilities != null));

  const plan = isPlainObject(input.implementationPlan) ? input.implementationPlan : input;

  return Object.freeze({
    hasInput: true,
    hasCapabilitySignals,
    readySet,
    activatesRuntime:
      plan.runtimeWiringEnabled === true ||
      plan.activateRuntime === true ||
      input.runtimeWiringEnabled === true ||
      input.activateRuntime === true,
    enablesRollout:
      plan.rolloutActivationEnabled === true ||
      plan.activateRollout === true ||
      input.rolloutActivationEnabled === true ||
      input.activateRollout === true,
    enablesFlags:
      plan.flagExecutionEnabled === true ||
      plan.activateFlags === true ||
      input.flagExecutionEnabled === true ||
      input.activateFlags === true,
    forceStop: input.forceStop === true || input.simulateStop === true,
    forceRollback: input.forceRollback === true || input.simulateRollback === true,
    declaredStopConditions: normalizeIdList(input.stopConditions || input.simulatedStopConditions)
  });
}

/**
 * @param {ReadonlyArray<string>} dependencies
 * @param {Readonly<Object>} readySet
 * @returns {ReadonlyArray<string>}
 */
function findMissingDependencies(dependencies, readySet) {
  const missing = [];
  for (let i = 0; i < dependencies.length; i += 1) {
    if (readySet[dependencies[i]] !== true) {
      missing.push(dependencies[i]);
    }
  }
  return Object.freeze(missing);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {{
 *   rolloutOrder: ReadonlyArray<Object>,
 *   checkpointProgression: ReadonlyArray<Object>,
 *   dependencySatisfaction: ReadonlyArray<Object>,
 *   simulatedStopConditions: ReadonlyArray<Object>,
 *   simulatedRollbackPoints: ReadonlyArray<Object>,
 *   stoppedAtOrder: number|null
 * }}
 */
function simulateRolloutSequence(signals) {
  const rolloutOrder = [];
  const checkpointProgression = [];
  const dependencySatisfaction = [];
  const simulatedStopConditions = [];
  const simulatedRollbackPoints = [];
  let stopped = false;
  let stoppedAtOrder = null;

  if (!signals.hasInput || !signals.hasCapabilitySignals) {
    simulatedStopConditions.push(
      Object.freeze({
        id: STOP_CONDITION_IDS.EMPTY_PLAN,
        order: 0,
        triggered: true,
        message: "No capability signals provided for rollout sequence simulation.",
        activated: false
      })
    );
    for (let i = 0; i < ROLLOUT_STEP_DEFINITIONS.length; i += 1) {
      const def = ROLLOUT_STEP_DEFINITIONS[i];
      rolloutOrder.push(
        Object.freeze({
          order: def.order,
          stepId: def.stepId,
          capabilityId: def.capabilityId,
          label: def.label,
          status: CHECKPOINT_PROGRESSION_STATUS.SKIPPED,
          simulated: false,
          activated: false
        })
      );
      checkpointProgression.push(
        Object.freeze({
          order: def.order,
          checkpointId: def.checkpointId,
          stepId: def.stepId,
          capabilityId: def.capabilityId,
          status: CHECKPOINT_PROGRESSION_STATUS.SKIPPED,
          progressed: false,
          activated: false
        })
      );
      dependencySatisfaction.push(
        Object.freeze({
          order: def.order,
          stepId: def.stepId,
          capabilityId: def.capabilityId,
          dependencies: def.dependencies,
          missingDependencies: def.dependencies,
          satisfied: false
        })
      );
      simulatedRollbackPoints.push(
        Object.freeze({
          order: def.order,
          rollbackPointId: def.rollbackPointId,
          stepId: def.stepId,
          capabilityId: def.capabilityId,
          available: true,
          simulated: true,
          activated: false
        })
      );
    }

    return {
      rolloutOrder: Object.freeze(rolloutOrder),
      checkpointProgression: Object.freeze(checkpointProgression),
      dependencySatisfaction: Object.freeze(dependencySatisfaction),
      simulatedStopConditions: Object.freeze(simulatedStopConditions),
      simulatedRollbackPoints: Object.freeze(simulatedRollbackPoints),
      stoppedAtOrder: null
    };
  }

  if (signals.activatesRuntime) {
    simulatedStopConditions.push(
      Object.freeze({
        id: STOP_CONDITION_IDS.RUNTIME_ACTIVATION_ATTEMPT,
        order: 0,
        triggered: true,
        message: "Runtime activation attempt detected; rollout simulation stopped.",
        activated: false
      })
    );
    stopped = true;
    stoppedAtOrder = 0;
  }

  if (signals.enablesFlags) {
    simulatedStopConditions.push(
      Object.freeze({
        id: STOP_CONDITION_IDS.FLAG_ACTIVATION_ATTEMPT,
        order: 0,
        triggered: true,
        message: "Feature flag activation attempt detected; rollout simulation stopped.",
        activated: false
      })
    );
    stopped = true;
    stoppedAtOrder = 0;
  }

  if (signals.enablesRollout) {
    simulatedStopConditions.push(
      Object.freeze({
        id: STOP_CONDITION_IDS.RUNTIME_ACTIVATION_ATTEMPT,
        order: 0,
        triggered: true,
        message: "Rollout activation attempt detected; simulation remains advisory-only.",
        activated: false
      })
    );
    stopped = true;
    stoppedAtOrder = 0;
  }

  if (signals.forceStop) {
    simulatedStopConditions.push(
      Object.freeze({
        id: STOP_CONDITION_IDS.CONFLICT_DETECTED,
        order: 0,
        triggered: true,
        message: "Forced stop condition requested for simulation.",
        activated: false
      })
    );
    stopped = true;
    stoppedAtOrder = 0;
  }

  for (let i = 0; i < ROLLOUT_STEP_DEFINITIONS.length; i += 1) {
    const def = ROLLOUT_STEP_DEFINITIONS[i];
    const missingDeps = findMissingDependencies(def.dependencies, signals.readySet);
    const capabilityReady = signals.readySet[def.capabilityId] === true;
    const depsSatisfied = missingDeps.length === 0;

    dependencySatisfaction.push(
      Object.freeze({
        order: def.order,
        stepId: def.stepId,
        capabilityId: def.capabilityId,
        dependencies: def.dependencies,
        missingDependencies: missingDeps,
        satisfied: depsSatisfied && capabilityReady
      })
    );

    let status = CHECKPOINT_PROGRESSION_STATUS.PENDING;
    let progressed = false;
    let simulated = false;

    if (stopped) {
      status = CHECKPOINT_PROGRESSION_STATUS.STOPPED;
    } else if (!depsSatisfied) {
      status = CHECKPOINT_PROGRESSION_STATUS.BLOCKED;
      simulatedStopConditions.push(
        Object.freeze({
          id: STOP_CONDITION_IDS.DEPENDENCY_FAILURE,
          order: def.order,
          triggered: true,
          message:
            "Dependency failure at " +
            def.stepId +
            ": missing " +
            missingDeps.join(", ") +
            ".",
          stepId: def.stepId,
          activated: false
        })
      );
      stopped = true;
      stoppedAtOrder = def.order;
      status = CHECKPOINT_PROGRESSION_STATUS.STOPPED;
    } else if (!capabilityReady) {
      status = CHECKPOINT_PROGRESSION_STATUS.BLOCKED;
      simulatedStopConditions.push(
        Object.freeze({
          id: STOP_CONDITION_IDS.MISSING_PREREQUISITE,
          order: def.order,
          triggered: true,
          message: "Missing prerequisite capability " + def.capabilityId + " at " + def.stepId + ".",
          stepId: def.stepId,
          activated: false
        })
      );
      stopped = true;
      stoppedAtOrder = def.order;
      status = CHECKPOINT_PROGRESSION_STATUS.STOPPED;
    } else {
      status = CHECKPOINT_PROGRESSION_STATUS.PASSED;
      progressed = true;
      simulated = true;
    }

    rolloutOrder.push(
      Object.freeze({
        order: def.order,
        stepId: def.stepId,
        capabilityId: def.capabilityId,
        label: def.label,
        status,
        simulated,
        activated: false
      })
    );

    checkpointProgression.push(
      Object.freeze({
        order: def.order,
        checkpointId: def.checkpointId,
        stepId: def.stepId,
        capabilityId: def.capabilityId,
        status,
        progressed,
        activated: false
      })
    );

    const rollbackTriggered =
      signals.forceRollback === true ||
      status === CHECKPOINT_PROGRESSION_STATUS.STOPPED ||
      status === CHECKPOINT_PROGRESSION_STATUS.BLOCKED;

    simulatedRollbackPoints.push(
      Object.freeze({
        order: def.order,
        rollbackPointId: def.rollbackPointId,
        stepId: def.stepId,
        capabilityId: def.capabilityId,
        available: true,
        simulated: true,
        triggered: rollbackTriggered && stoppedAtOrder === def.order,
        activated: false
      })
    );

    if (rollbackTriggered && stoppedAtOrder === def.order) {
      simulatedStopConditions.push(
        Object.freeze({
          id: STOP_CONDITION_IDS.ROLLBACK_REQUIRED,
          order: def.order,
          triggered: true,
          message:
            "Simulated rollback point " +
            def.rollbackPointId +
            " available at " +
            def.stepId +
            ".",
          stepId: def.stepId,
          rollbackPointId: def.rollbackPointId,
          activated: false
        })
      );
    }
  }

  simulatedStopConditions.sort(function compareStops(a, b) {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });

  return {
    rolloutOrder: Object.freeze(rolloutOrder),
    checkpointProgression: Object.freeze(checkpointProgression),
    dependencySatisfaction: Object.freeze(dependencySatisfaction),
    simulatedStopConditions: Object.freeze(simulatedStopConditions),
    simulatedRollbackPoints: Object.freeze(simulatedRollbackPoints),
    stoppedAtOrder
  };
}

/**
 * @param {ReadonlyArray<Object>} rolloutOrder
 * @param {ReadonlyArray<Object>} simulatedStopConditions
 * @param {Readonly<Object>} signals
 * @param {number|null} stoppedAtOrder
 * @returns {string}
 */
function resolveRolloutSimulationStatus(
  rolloutOrder,
  simulatedStopConditions,
  signals,
  stoppedAtOrder
) {
  if (!signals.hasInput || !signals.hasCapabilitySignals) {
    return ROLLOUT_SIMULATION_STATUS.SEQUENCE_EMPTY;
  }

  let passedCount = 0;
  for (let i = 0; i < rolloutOrder.length; i += 1) {
    if (rolloutOrder[i].status === CHECKPOINT_PROGRESSION_STATUS.PASSED) {
      passedCount += 1;
    }
  }

  if (stoppedAtOrder != null && stoppedAtOrder >= 0) {
    return ROLLOUT_SIMULATION_STATUS.SEQUENCE_STOPPED;
  }

  const hasTriggeredStop = simulatedStopConditions.some(function hasStop(s) {
    return s.triggered === true && s.id !== STOP_CONDITION_IDS.EMPTY_PLAN;
  });
  if (hasTriggeredStop && passedCount < ROLLOUT_STEP_DEFINITIONS.length) {
    return ROLLOUT_SIMULATION_STATUS.SEQUENCE_STOPPED;
  }

  if (passedCount === ROLLOUT_STEP_DEFINITIONS.length) {
    return ROLLOUT_SIMULATION_STATUS.SEQUENCE_COMPLETE;
  }
  if (passedCount > 0) {
    return ROLLOUT_SIMULATION_STATUS.SEQUENCE_PARTIAL;
  }
  return ROLLOUT_SIMULATION_STATUS.UNKNOWN;
}

/**
 * @param {ReadonlyArray<Object>} rolloutOrder
 * @param {ReadonlyArray<Object>} simulatedStopConditions
 * @param {Readonly<Object>} signals
 * @returns {number}
 */
function calculateRolloutConfidence(rolloutOrder, simulatedStopConditions, signals) {
  if (!signals.hasInput || !signals.hasCapabilitySignals) {
    return 0;
  }

  let passedCount = 0;
  for (let i = 0; i < rolloutOrder.length; i += 1) {
    if (rolloutOrder[i].status === CHECKPOINT_PROGRESSION_STATUS.PASSED) {
      passedCount += 1;
    }
  }

  let score = Math.round((passedCount / ROLLOUT_STEP_DEFINITIONS.length) * 80) + 15;
  score -= simulatedStopConditions.length * 3;

  if (signals.activatesRuntime || signals.enablesFlags || signals.enablesRollout) {
    score -= 20;
  }

  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function simulateRecruitmentRollout(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const signals = extractRolloutSignals(input);
  const sequence = simulateRolloutSequence(signals);
  const rolloutSimulationStatus = resolveRolloutSimulationStatus(
    sequence.rolloutOrder,
    sequence.simulatedStopConditions,
    signals,
    sequence.stoppedAtOrder
  );
  const confidence = calculateRolloutConfidence(
    sequence.rolloutOrder,
    sequence.simulatedStopConditions,
    signals
  );

  return deepFreeze({
    recruitmentId,
    rolloutSimulationStatus,
    rolloutOrder: sequence.rolloutOrder,
    checkpointProgression: sequence.checkpointProgression,
    dependencySatisfaction: sequence.dependencySatisfaction,
    simulatedStopConditions: sequence.simulatedStopConditions,
    simulatedRollbackPoints: sequence.simulatedRollbackPoints,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_146",
      schemaVersion: ROLLOUT_SIMULATION_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_ROLLOUT_SIMULATION_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      simulationOnly: true,
      rolloutSimulationOnly: true,
      rolloutActivationEnabled: false,
      stoppedAtOrder: sequence.stoppedAtOrder
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_146",
      phase: RECRUITMENT_ROLLOUT_SIMULATION_PHASE,
      simulationOnly: true,
      rolloutSimulationOnly: true,
      executed: false,
      activated: false,
      rolloutActivated: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false,
      activatesAnything: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentRolloutSimulation(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_RESULT_KEYS[i])) {
      return false;
    }
  }
  if (value.advisoryMetadata == null || value.advisoryMetadata.advisoryOnly !== true) {
    return false;
  }
  if (value.advisoryMetadata.executed !== false) {
    return false;
  }
  if (value.advisoryMetadata.activatesAnything !== false) {
    return false;
  }
  if (value.advisoryMetadata.rolloutActivationEnabled !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_ROLLOUT_SIMULATION_PHASE,
  RECRUITMENT_ROLLOUT_SIMULATION_ENTITY,
  ROLLOUT_SIMULATION_SCHEMA_VERSION,
  ROLLOUT_SIMULATION_STATUS,
  CHECKPOINT_PROGRESSION_STATUS,
  STOP_CONDITION_IDS,
  ROLLOUT_STEP_DEFINITIONS,
  RECRUITMENT_ROLLOUT_SIMULATION_METADATA,
  RECRUITMENT_ROLLOUT_SIMULATION_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  simulateRecruitmentRollout,
  isRecruitmentRolloutSimulation
};
