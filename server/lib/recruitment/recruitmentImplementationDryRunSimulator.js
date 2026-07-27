"use strict";

/**
 * Phase 146 — Recruitment Implementation Dry-Run Simulator (Advisory Only).
 *
 * Pure advisory dry-run simulation of a proposed implementation plan.
 * Evaluates stages, capabilities, prerequisites, dependencies, conflicts,
 * and simulated readiness without executing or activating anything.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE = 146;

const RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_ENTITY =
  "recruitment_implementation_dry_run_simulator";

const DRY_RUN_SIMULATOR_SCHEMA_VERSION = "1.0.0";

const EXPECTED_CONTRACT_VERSION = "1.0.0";

const SIMULATION_STATUS = Object.freeze({
  COMPLETE: "SIMULATION_COMPLETE",
  PARTIAL: "SIMULATION_PARTIAL",
  BLOCKED: "SIMULATION_BLOCKED",
  EMPTY: "SIMULATION_EMPTY",
  UNKNOWN: "SIMULATION_UNKNOWN"
});

const STAGE_EVALUATION_STATUS = Object.freeze({
  SIMULATED: "SIMULATED",
  MISSING: "MISSING",
  BLOCKED: "BLOCKED",
  CONFLICT: "CONFLICT",
  SKIPPED: "SKIPPED"
});

const READINESS_STATUS = Object.freeze({
  READY: "READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  NOT_READY: "NOT_READY",
  UNKNOWN: "UNKNOWN"
});

const REQUIRED_STAGE_IDS = Object.freeze([
  "STAGE_CONTRACT_ALIGNMENT",
  "STAGE_ADAPTER_SCAFFOLD",
  "STAGE_FEATURE_FLAG_INFRASTRUCTURE",
  "STAGE_SHADOW_OBSERVATION",
  "STAGE_GOVERNANCE_GATES",
  "STAGE_CONTROLLED_COUPLING",
  "STAGE_MONITORING_VERIFICATION",
  "STAGE_ROLLBACK_READINESS"
]);

const REQUIRED_CAPABILITY_IDS = Object.freeze([
  "CAP_RUNTIME_ADAPTER",
  "CAP_FEATURE_FLAGS",
  "CAP_SHADOW_MODE",
  "CAP_GOVERNANCE_GATES",
  "CAP_CONTROLLED_COUPLING",
  "CAP_MONITORING",
  "CAP_ROLLBACK",
  "CAP_BOUNDARY_ISOLATION"
]);

const REQUIRED_EXECUTION_IDS = Object.freeze([
  "EXEC_NO_RUNTIME_WIRING",
  "EXEC_NO_FEATURE_FLAG_ACTIVATION",
  "EXEC_NO_ROLLOUT",
  "EXEC_NO_DB_WRITES",
  "EXEC_NO_FILESYSTEM_WRITES",
  "EXEC_NO_PUBLISHING",
  "EXEC_DETERMINISTIC_PLANNING"
]);

const REQUIRED_ROLLBACK_IDS = Object.freeze([
  "RB_DISABLE_FLAGS",
  "RB_DISCONNECT_ADAPTER",
  "RB_RESTORE_ISOLATION",
  "RB_NO_PERSISTED_SIDE_EFFECTS",
  "RB_VERIFICATION_CHECKPOINT"
]);

const REQUIRED_BOUNDARY_IDS = Object.freeze([
  "BOUNDARY_ORCHESTRATOR",
  "BOUNDARY_COORDINATOR",
  "BOUNDARY_WORKER",
  "BOUNDARY_GATEWAY",
  "BOUNDARY_PIPELINE"
]);

const STAGE_DEPENDENCY_MAP = Object.freeze({
  STAGE_CONTRACT_ALIGNMENT: Object.freeze([]),
  STAGE_ADAPTER_SCAFFOLD: Object.freeze(["STAGE_CONTRACT_ALIGNMENT"]),
  STAGE_FEATURE_FLAG_INFRASTRUCTURE: Object.freeze(["STAGE_ADAPTER_SCAFFOLD"]),
  STAGE_SHADOW_OBSERVATION: Object.freeze(["STAGE_FEATURE_FLAG_INFRASTRUCTURE"]),
  STAGE_GOVERNANCE_GATES: Object.freeze(["STAGE_SHADOW_OBSERVATION"]),
  STAGE_MONITORING_VERIFICATION: Object.freeze(["STAGE_GOVERNANCE_GATES"]),
  STAGE_ROLLBACK_READINESS: Object.freeze(["STAGE_MONITORING_VERIFICATION"]),
  STAGE_CONTROLLED_COUPLING: Object.freeze([
    "STAGE_GOVERNANCE_GATES",
    "STAGE_ROLLBACK_READINESS"
  ])
});

const CAPABILITY_PREREQUISITE_MAP = Object.freeze({
  CAP_BOUNDARY_ISOLATION: Object.freeze([]),
  CAP_RUNTIME_ADAPTER: Object.freeze(["CAP_BOUNDARY_ISOLATION"]),
  CAP_FEATURE_FLAGS: Object.freeze(["CAP_RUNTIME_ADAPTER"]),
  CAP_SHADOW_MODE: Object.freeze(["CAP_FEATURE_FLAGS"]),
  CAP_GOVERNANCE_GATES: Object.freeze(["CAP_SHADOW_MODE"]),
  CAP_MONITORING: Object.freeze(["CAP_GOVERNANCE_GATES"]),
  CAP_ROLLBACK: Object.freeze(["CAP_MONITORING", "CAP_FEATURE_FLAGS"]),
  CAP_CONTROLLED_COUPLING: Object.freeze([
    "CAP_BOUNDARY_ISOLATION",
    "CAP_RUNTIME_ADAPTER",
    "CAP_FEATURE_FLAGS",
    "CAP_SHADOW_MODE",
    "CAP_GOVERNANCE_GATES",
    "CAP_MONITORING",
    "CAP_ROLLBACK"
  ])
});

const STAGE_ORDER = Object.freeze({
  STAGE_CONTRACT_ALIGNMENT: 1,
  STAGE_ADAPTER_SCAFFOLD: 2,
  STAGE_FEATURE_FLAG_INFRASTRUCTURE: 3,
  STAGE_SHADOW_OBSERVATION: 4,
  STAGE_GOVERNANCE_GATES: 5,
  STAGE_CONTROLLED_COUPLING: 6,
  STAGE_MONITORING_VERIFICATION: 7,
  STAGE_ROLLBACK_READINESS: 8
});

const RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  dryRunOnly: true,
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

const RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE,
  description:
    "Pure advisory dry-run simulator for proposed implementation plans without execution.",
  schemaVersion: DRY_RUN_SIMULATOR_SCHEMA_VERSION,
  metadata: RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "simulationStatus",
  "evaluatedStages",
  "simulatedCapabilities",
  "prerequisiteChecks",
  "dependencyChecks",
  "detectedConflicts",
  "simulatedReadiness",
  "recommendations",
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
 * @returns {*|null}
 */
function resolveImplementationPlan(input) {
  if (!isPlainObject(input)) {
    return null;
  }
  if (isPlainObject(input.implementationPlan)) {
    return input.implementationPlan;
  }

  const planFields = [
    "contractVersion",
    "implementationStages",
    "stages",
    "requestedStages",
    "supportedCapabilities",
    "capabilities",
    "requestedCapabilities",
    "executionRequirements",
    "rollbackRequirements",
    "runtimeBoundaries"
  ];
  for (let i = 0; i < planFields.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(input, planFields[i])) {
      return input;
    }
  }
  return null;
}

/**
 * @param {*} plan
 * @returns {Readonly<Object>}
 */
function extractPlanSignals(plan) {
  if (!isPlainObject(plan)) {
    return Object.freeze({
      hasPlan: false,
      contractVersion: null,
      stages: Object.freeze([]),
      capabilities: Object.freeze([]),
      executionRequirements: Object.freeze([]),
      rollbackRequirements: Object.freeze([]),
      runtimeBoundaries: Object.freeze([]),
      activatesRuntime: false,
      enablesRollout: false,
      enablesFlags: false,
      performsDbWrites: false,
      performsFilesystemWrites: false,
      publishesContent: false
    });
  }

  return Object.freeze({
    hasPlan: true,
    contractVersion:
      typeof plan.contractVersion === "string" ? plan.contractVersion : null,
    stages: normalizeIdList(
      plan.implementationStages || plan.stages || plan.requestedStages
    ),
    capabilities: normalizeIdList(
      plan.supportedCapabilities || plan.capabilities || plan.requestedCapabilities
    ),
    executionRequirements: normalizeIdList(
      plan.executionRequirements || plan.acknowledgedExecutionRequirements
    ),
    rollbackRequirements: normalizeIdList(
      plan.rollbackRequirements || plan.acknowledgedRollbackRequirements
    ),
    runtimeBoundaries: normalizeIdList(
      plan.runtimeBoundaries || plan.acknowledgedRuntimeBoundaries
    ),
    activatesRuntime: plan.runtimeWiringEnabled === true || plan.activateRuntime === true,
    enablesRollout: plan.rolloutActivationEnabled === true || plan.activateRollout === true,
    enablesFlags: plan.flagExecutionEnabled === true || plan.activateFlags === true,
    performsDbWrites: plan.persistenceEnabled === true || plan.dbWrites === true,
    performsFilesystemWrites: plan.filesystemWrites === true,
    publishesContent: plan.publishContent === true || plan.publishingEnabled === true
  });
}

/**
 * @param {ReadonlyArray<string>} present
 * @returns {Readonly<Object>}
 */
function buildPresentSet(present) {
  const set = Object.create(null);
  for (let i = 0; i < present.length; i += 1) {
    set[present[i]] = true;
  }
  return Object.freeze(set);
}

/**
 * @param {ReadonlyArray<string>} required
 * @param {Readonly<Object>} presentSet
 * @returns {boolean}
 */
function allPresent(required, presentSet) {
  for (let i = 0; i < required.length; i += 1) {
    if (presentSet[required[i]] !== true) {
      return false;
    }
  }
  return true;
}

/**
 * @param {ReadonlyArray<string>} required
 * @param {Readonly<Object>} presentSet
 * @returns {ReadonlyArray<string>}
 */
function findMissing(required, presentSet) {
  const missing = [];
  for (let i = 0; i < required.length; i += 1) {
    if (presentSet[required[i]] !== true) {
      missing.push(required[i]);
    }
  }
  return Object.freeze(missing);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function evaluateStages(signals) {
  const stageSet = buildPresentSet(signals.stages);
  const evaluations = [];

  for (let i = 0; i < REQUIRED_STAGE_IDS.length; i += 1) {
    const stageId = REQUIRED_STAGE_IDS[i];
    const deps = STAGE_DEPENDENCY_MAP[stageId] || Object.freeze([]);
    const missingDeps = findMissing(deps, stageSet);
    const present = stageSet[stageId] === true;

    let status = STAGE_EVALUATION_STATUS.MISSING;
    if (present && missingDeps.length === 0) {
      status = STAGE_EVALUATION_STATUS.SIMULATED;
    } else if (present && missingDeps.length > 0) {
      status = STAGE_EVALUATION_STATUS.BLOCKED;
    } else if (!present && missingDeps.length > 0) {
      status = STAGE_EVALUATION_STATUS.BLOCKED;
    }

    evaluations.push(
      Object.freeze({
        stageId,
        order: STAGE_ORDER[stageId] || i + 1,
        present,
        status,
        dependencies: deps,
        missingDependencies: missingDeps,
        simulated: status === STAGE_EVALUATION_STATUS.SIMULATED,
        activated: false
      })
    );
  }

  evaluations.sort(function compareStages(a, b) {
    return a.order - b.order;
  });

  return Object.freeze(evaluations);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function simulateCapabilities(signals) {
  const capabilitySet = buildPresentSet(signals.capabilities);
  const simulated = [];

  for (let i = 0; i < REQUIRED_CAPABILITY_IDS.length; i += 1) {
    const capabilityId = REQUIRED_CAPABILITY_IDS[i];
    const prerequisites = CAPABILITY_PREREQUISITE_MAP[capabilityId] || Object.freeze([]);
    const missingPrerequisites = findMissing(prerequisites, capabilitySet);
    const present = capabilitySet[capabilityId] === true;
    const prerequisitesSatisfied = missingPrerequisites.length === 0;

    simulated.push(
      Object.freeze({
        capabilityId,
        order: i + 1,
        present,
        prerequisites,
        missingPrerequisites,
        prerequisitesSatisfied,
        simulated: present && prerequisitesSatisfied,
        activated: false
      })
    );
  }

  simulated.sort(function compareCaps(a, b) {
    if (a.capabilityId < b.capabilityId) {
      return -1;
    }
    if (a.capabilityId > b.capabilityId) {
      return 1;
    }
    return 0;
  });

  return Object.freeze(simulated);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildPrerequisiteChecks(signals) {
  const capabilitySet = buildPresentSet(signals.capabilities);
  const checks = [];

  for (let i = 0; i < REQUIRED_CAPABILITY_IDS.length; i += 1) {
    const capabilityId = REQUIRED_CAPABILITY_IDS[i];
    const prerequisites = CAPABILITY_PREREQUISITE_MAP[capabilityId] || Object.freeze([]);
    const missing = findMissing(prerequisites, capabilitySet);
    checks.push(
      Object.freeze({
        capabilityId,
        prerequisites,
        missingPrerequisites: missing,
        satisfied: missing.length === 0 && capabilitySet[capabilityId] === true,
        checkType: "prerequisite"
      })
    );
  }

  checks.sort(function compareChecks(a, b) {
    if (a.capabilityId < b.capabilityId) {
      return -1;
    }
    if (a.capabilityId > b.capabilityId) {
      return 1;
    }
    return 0;
  });

  return Object.freeze(checks);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildDependencyChecks(signals) {
  const stageSet = buildPresentSet(signals.stages);
  const checks = [];

  for (let i = 0; i < REQUIRED_STAGE_IDS.length; i += 1) {
    const stageId = REQUIRED_STAGE_IDS[i];
    const dependencies = STAGE_DEPENDENCY_MAP[stageId] || Object.freeze([]);
    const missing = findMissing(dependencies, stageSet);
    checks.push(
      Object.freeze({
        stageId,
        dependencies,
        missingDependencies: missing,
        satisfied: missing.length === 0 && stageSet[stageId] === true,
        checkType: "dependency"
      })
    );
  }

  checks.sort(function compareDeps(a, b) {
    const orderA = STAGE_ORDER[a.stageId] || 0;
    const orderB = STAGE_ORDER[b.stageId] || 0;
    return orderA - orderB;
  });

  return Object.freeze(checks);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function detectConflicts(signals) {
  const conflicts = [];

  if (!signals.hasPlan) {
    return Object.freeze(conflicts);
  }

  if (signals.activatesRuntime) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_RUNTIME_WIRING",
        severity: "ERROR",
        message: "Plan enables runtime wiring which conflicts with dry-run isolation.",
        category: "execution"
      })
    );
  }
  if (signals.enablesRollout) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_ROLLOUT_ACTIVATION",
        severity: "ERROR",
        message: "Plan enables rollout activation which conflicts with dry-run isolation.",
        category: "execution"
      })
    );
  }
  if (signals.enablesFlags) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_FLAG_EXECUTION",
        severity: "ERROR",
        message: "Plan enables feature flag execution which conflicts with dry-run isolation.",
        category: "execution"
      })
    );
  }
  if (signals.performsDbWrites) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_DB_WRITES",
        severity: "ERROR",
        message: "Plan indicates database writes which conflict with dry-run isolation.",
        category: "persistence"
      })
    );
  }
  if (signals.performsFilesystemWrites) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_FS_WRITES",
        severity: "ERROR",
        message: "Plan indicates filesystem writes which conflict with dry-run isolation.",
        category: "persistence"
      })
    );
  }
  if (signals.publishesContent) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_PUBLISHING",
        severity: "ERROR",
        message: "Plan indicates content publishing which conflicts with dry-run isolation.",
        category: "publishing"
      })
    );
  }
  if (
    signals.contractVersion != null &&
    signals.contractVersion !== EXPECTED_CONTRACT_VERSION
  ) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_CONTRACT_VERSION",
        severity: "WARNING",
        message:
          "Plan contractVersion differs from expected " + EXPECTED_CONTRACT_VERSION + ".",
        category: "contract"
      })
    );
  }

  const stageSet = buildPresentSet(signals.stages);
  if (
    stageSet.STAGE_CONTROLLED_COUPLING === true &&
    stageSet.STAGE_ROLLBACK_READINESS !== true
  ) {
    conflicts.push(
      Object.freeze({
        id: "CONFLICT_COUPLING_WITHOUT_ROLLBACK",
        severity: "ERROR",
        message:
          "Controlled coupling stage present without rollback readiness stage.",
        category: "dependency"
      })
    );
  }

  conflicts.sort(function compareConflicts(a, b) {
    if (a.category < b.category) {
      return -1;
    }
    if (a.category > b.category) {
      return 1;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });

  return Object.freeze(conflicts);
}

/**
 * @param {ReadonlyArray<Object>} evaluatedStages
 * @param {ReadonlyArray<Object>} simulatedCapabilities
 * @param {ReadonlyArray<Object>} detectedConflicts
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Object>}
 */
function resolveSimulatedReadiness(
  evaluatedStages,
  simulatedCapabilities,
  detectedConflicts,
  signals
) {
  if (!signals.hasPlan) {
    return Object.freeze({
      status: READINESS_STATUS.UNKNOWN,
      readinessScore: 0,
      stagesSimulated: 0,
      stagesTotal: REQUIRED_STAGE_IDS.length,
      capabilitiesSimulated: 0,
      capabilitiesTotal: REQUIRED_CAPABILITY_IDS.length,
      conflictCount: 0
    });
  }

  let stagesSimulated = 0;
  for (let i = 0; i < evaluatedStages.length; i += 1) {
    if (evaluatedStages[i].simulated === true) {
      stagesSimulated += 1;
    }
  }

  let capabilitiesSimulated = 0;
  for (let i = 0; i < simulatedCapabilities.length; i += 1) {
    if (simulatedCapabilities[i].simulated === true) {
      capabilitiesSimulated += 1;
    }
  }

  const execSet = buildPresentSet(signals.executionRequirements);
  const rollbackSet = buildPresentSet(signals.rollbackRequirements);
  const boundarySet = buildPresentSet(signals.runtimeBoundaries);

  const execOk = allPresent(REQUIRED_EXECUTION_IDS, execSet);
  const rollbackOk = allPresent(REQUIRED_ROLLBACK_IDS, rollbackSet);
  const boundaryOk = allPresent(REQUIRED_BOUNDARY_IDS, boundarySet);
  const versionOk = signals.contractVersion === EXPECTED_CONTRACT_VERSION;

  const totalUnits =
    REQUIRED_STAGE_IDS.length +
    REQUIRED_CAPABILITY_IDS.length +
    3;
  let satisfied =
    stagesSimulated +
    capabilitiesSimulated +
    (execOk ? 1 : 0) +
    (rollbackOk ? 1 : 0) +
    (boundaryOk ? 1 : 0);
  if (versionOk) {
    satisfied += 0;
  }

  let readinessScore = Math.round((satisfied / totalUnits) * 100);
  readinessScore -= detectedConflicts.length * 8;
  if (!versionOk && signals.contractVersion != null) {
    readinessScore -= 10;
  }
  if (signals.contractVersion == null) {
    readinessScore -= 15;
  }
  if (readinessScore < 0) {
    readinessScore = 0;
  }
  if (readinessScore > 100) {
    readinessScore = 100;
  }

  let status = READINESS_STATUS.NOT_READY;
  if (
    readinessScore >= 90 &&
    detectedConflicts.length === 0 &&
    stagesSimulated === REQUIRED_STAGE_IDS.length &&
    capabilitiesSimulated === REQUIRED_CAPABILITY_IDS.length
  ) {
    status = READINESS_STATUS.READY;
  } else if (readinessScore >= 40) {
    status = READINESS_STATUS.PARTIALLY_READY;
  }

  return Object.freeze({
    status,
    readinessScore,
    stagesSimulated,
    stagesTotal: REQUIRED_STAGE_IDS.length,
    capabilitiesSimulated,
    capabilitiesTotal: REQUIRED_CAPABILITY_IDS.length,
    conflictCount: detectedConflicts.length,
    executionRequirementsSatisfied: execOk,
    rollbackRequirementsSatisfied: rollbackOk,
    runtimeBoundariesSatisfied: boundaryOk,
    contractVersionCompatible: versionOk
  });
}

/**
 * @param {Readonly<Object>} simulatedReadiness
 * @param {ReadonlyArray<Object>} detectedConflicts
 * @param {ReadonlyArray<Object>} prerequisiteChecks
 * @param {ReadonlyArray<Object>} dependencyChecks
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<string>}
 */
function buildRecommendations(
  simulatedReadiness,
  detectedConflicts,
  prerequisiteChecks,
  dependencyChecks,
  signals
) {
  const recommendations = [];

  if (!signals.hasPlan) {
    recommendations.push(
      "Provide an implementation plan with stages, capabilities, and contract acknowledgments."
    );
    return Object.freeze(recommendations);
  }

  if (signals.contractVersion == null) {
    recommendations.push(
      "Declare contractVersion " + EXPECTED_CONTRACT_VERSION + " on the implementation plan."
    );
  } else if (signals.contractVersion !== EXPECTED_CONTRACT_VERSION) {
    recommendations.push(
      "Align contractVersion to expected " + EXPECTED_CONTRACT_VERSION + "."
    );
  }

  for (let i = 0; i < dependencyChecks.length; i += 1) {
    const check = dependencyChecks[i];
    if (check.missingDependencies.length > 0) {
      recommendations.push(
        "Satisfy stage dependencies for " +
          check.stageId +
          ": " +
          check.missingDependencies.join(", ") +
          "."
      );
    } else if (check.satisfied !== true) {
      recommendations.push("Include required stage " + check.stageId + " in the plan.");
    }
  }

  for (let i = 0; i < prerequisiteChecks.length; i += 1) {
    const check = prerequisiteChecks[i];
    if (check.missingPrerequisites.length > 0) {
      recommendations.push(
        "Satisfy capability prerequisites for " +
          check.capabilityId +
          ": " +
          check.missingPrerequisites.join(", ") +
          "."
      );
    } else if (check.satisfied !== true) {
      recommendations.push(
        "Include required capability " + check.capabilityId + " in the plan."
      );
    }
  }

  for (let i = 0; i < detectedConflicts.length; i += 1) {
    recommendations.push(
      "Resolve conflict " + detectedConflicts[i].id + ": " + detectedConflicts[i].message
    );
  }

  if (simulatedReadiness.executionRequirementsSatisfied !== true) {
    recommendations.push("Acknowledge all mandatory execution requirements.");
  }
  if (simulatedReadiness.rollbackRequirementsSatisfied !== true) {
    recommendations.push("Acknowledge all mandatory rollback requirements.");
  }
  if (simulatedReadiness.runtimeBoundariesSatisfied !== true) {
    recommendations.push("Acknowledge all protected runtime boundaries.");
  }

  if (
    simulatedReadiness.status === READINESS_STATUS.READY &&
    detectedConflicts.length === 0
  ) {
    recommendations.push(
      "Dry-run simulation indicates plan readiness; keep advisory-only until a dedicated implementation phase."
    );
  }

  recommendations.sort();
  return Object.freeze(recommendations);
}

/**
 * @param {Readonly<Object>} simulatedReadiness
 * @param {ReadonlyArray<Object>} detectedConflicts
 * @param {Readonly<Object>} signals
 * @returns {string}
 */
function resolveSimulationStatus(simulatedReadiness, detectedConflicts, signals) {
  if (!signals.hasPlan) {
    return SIMULATION_STATUS.EMPTY;
  }
  if (detectedConflicts.length > 0 && simulatedReadiness.readinessScore < 40) {
    return SIMULATION_STATUS.BLOCKED;
  }
  if (simulatedReadiness.status === READINESS_STATUS.READY && detectedConflicts.length === 0) {
    return SIMULATION_STATUS.COMPLETE;
  }
  if (simulatedReadiness.status === READINESS_STATUS.PARTIALLY_READY) {
    return SIMULATION_STATUS.PARTIAL;
  }
  if (simulatedReadiness.status === READINESS_STATUS.NOT_READY) {
    return SIMULATION_STATUS.BLOCKED;
  }
  return SIMULATION_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} simulatedReadiness
 * @param {ReadonlyArray<Object>} detectedConflicts
 * @param {Readonly<Object>} signals
 * @returns {number}
 */
function calculateConfidence(simulatedReadiness, detectedConflicts, signals) {
  if (!signals.hasPlan) {
    return 0;
  }

  let score = 30;
  score += Math.round(simulatedReadiness.readinessScore * 0.6);
  score -= detectedConflicts.length * 5;

  if (signals.contractVersion === EXPECTED_CONTRACT_VERSION) {
    score += 10;
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
function simulateRecruitmentImplementationDryRun(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const signals = extractPlanSignals(resolveImplementationPlan(input));

  const evaluatedStages = evaluateStages(signals);
  const simulatedCapabilities = simulateCapabilities(signals);
  const prerequisiteChecks = buildPrerequisiteChecks(signals);
  const dependencyChecks = buildDependencyChecks(signals);
  const detectedConflicts = detectConflicts(signals);
  const simulatedReadiness = resolveSimulatedReadiness(
    evaluatedStages,
    simulatedCapabilities,
    detectedConflicts,
    signals
  );
  const recommendations = buildRecommendations(
    simulatedReadiness,
    detectedConflicts,
    prerequisiteChecks,
    dependencyChecks,
    signals
  );
  const simulationStatus = resolveSimulationStatus(
    simulatedReadiness,
    detectedConflicts,
    signals
  );
  const confidence = calculateConfidence(simulatedReadiness, detectedConflicts, signals);

  return deepFreeze({
    recruitmentId,
    simulationStatus,
    evaluatedStages,
    simulatedCapabilities,
    prerequisiteChecks,
    dependencyChecks,
    detectedConflicts,
    simulatedReadiness,
    recommendations,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_146",
      schemaVersion: DRY_RUN_SIMULATOR_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      simulationOnly: true,
      dryRunOnly: true,
      expectedContractVersion: EXPECTED_CONTRACT_VERSION
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_146",
      phase: RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE,
      simulationOnly: true,
      dryRunOnly: true,
      executed: false,
      activated: false,
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
function isRecruitmentImplementationDryRunSimulation(value) {
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
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE,
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_ENTITY,
  DRY_RUN_SIMULATOR_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  SIMULATION_STATUS,
  STAGE_EVALUATION_STATUS,
  READINESS_STATUS,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  STAGE_DEPENDENCY_MAP,
  CAPABILITY_PREREQUISITE_MAP,
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA,
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  simulateRecruitmentImplementationDryRun,
  isRecruitmentImplementationDryRunSimulation
};
