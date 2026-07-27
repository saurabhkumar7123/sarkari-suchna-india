"use strict";

/**
 * Phase 147 — Recruitment Scenario Evaluator (Advisory Only).
 *
 * Pure advisory evaluation of an implementation plan against a selected
 * scenario. No database access, no persistence, no runtime imports,
 * no side effects. No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_SCENARIO_EVALUATOR_PHASE = 147;

const RECRUITMENT_SCENARIO_EVALUATOR_ENTITY = "recruitment_scenario_evaluator";

const SCENARIO_EVALUATOR_SCHEMA_VERSION = "1.0.0";

const EXPECTED_CONTRACT_VERSION = "1.0.0";

const IMPLEMENTATION_SCENARIO_IDS = Object.freeze({
  COMPLETE_IMPLEMENTATION: "COMPLETE_IMPLEMENTATION",
  PARTIAL_IMPLEMENTATION: "PARTIAL_IMPLEMENTATION",
  MISSING_PREREQUISITES: "MISSING_PREREQUISITES",
  DEPENDENCY_FAILURE: "DEPENDENCY_FAILURE",
  ROLLBACK_REQUIRED: "ROLLBACK_REQUIRED",
  VALIDATION_FAILURE: "VALIDATION_FAILURE",
  OBSERVABILITY_INCOMPLETE: "OBSERVABILITY_INCOMPLETE",
  GOVERNANCE_REVIEW_REQUIRED: "GOVERNANCE_REVIEW_REQUIRED"
});

const SCENARIO_STATUS = Object.freeze({
  MATCHED: "SCENARIO_MATCHED",
  PARTIAL: "SCENARIO_PARTIAL",
  UNMATCHED: "SCENARIO_UNMATCHED",
  INVALID: "SCENARIO_INVALID",
  EMPTY: "SCENARIO_EMPTY",
  UNKNOWN: "SCENARIO_UNKNOWN"
});

const CONDITION_STATUS = Object.freeze({
  MATCHED: "MATCHED",
  UNMET: "UNMET",
  UNKNOWN: "UNKNOWN"
});

const FINDING_SEVERITY = Object.freeze({
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
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

const REQUIRED_PREREQUISITE_IDS = Object.freeze([
  "PREREQ_CONTRACT_DEFINED",
  "PREREQ_ADAPTER_INTERFACE",
  "PREREQ_FEATURE_FLAG_STRATEGY",
  "PREREQ_GOVERNANCE_CHECKLIST",
  "PREREQ_ROLLBACK_PLAN"
]);

const REQUIRED_DEPENDENCY_IDS = Object.freeze([
  "DEP_CONTRACT_ALIGNMENT",
  "DEP_ADAPTER_SCAFFOLD",
  "DEP_FLAG_INFRASTRUCTURE",
  "DEP_SHADOW_OBSERVATION",
  "DEP_GOVERNANCE_GATES"
]);

const REQUIRED_VALIDATION_IDS = Object.freeze([
  "VAL_CONTRACT_COMPLIANCE",
  "VAL_STAGE_COVERAGE",
  "VAL_CAPABILITY_COVERAGE",
  "VAL_BOUNDARY_ISOLATION",
  "VAL_ROLLBACK_READINESS"
]);

const REQUIRED_OBSERVABILITY_IDS = Object.freeze([
  "OBS_MONITORING_CHECKPOINTS",
  "OBS_SHADOW_SIGNALS",
  "OBS_HEALTH_INDICATORS",
  "OBS_DIAGNOSTICS_ATTACHMENT"
]);

const REQUIRED_GOVERNANCE_IDS = Object.freeze([
  "GOV_CHECKLIST_COMPLETE",
  "GOV_REVIEW_GATE",
  "GOV_APPROVAL_PATH",
  "GOV_RISK_ACKNOWLEDGED"
]);

const BUILTIN_EXPECTED_OUTCOMES = Object.freeze({
  COMPLETE_IMPLEMENTATION: "IMPLEMENTATION_COMPLETE_ADVISORY",
  PARTIAL_IMPLEMENTATION: "IMPLEMENTATION_PARTIAL_ADVISORY",
  MISSING_PREREQUISITES: "PREREQUISITES_INCOMPLETE",
  DEPENDENCY_FAILURE: "DEPENDENCY_BLOCKED",
  ROLLBACK_REQUIRED: "ROLLBACK_ADVISORY",
  VALIDATION_FAILURE: "VALIDATION_FAILED",
  OBSERVABILITY_INCOMPLETE: "OBSERVABILITY_GAP",
  GOVERNANCE_REVIEW_REQUIRED: "GOVERNANCE_REVIEW_NEEDED"
});

const RECRUITMENT_SCENARIO_EVALUATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  evaluationOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  activated: false,
  activatesAnything: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  sourcePhases: Object.freeze([145, 146, 147])
});

const RECRUITMENT_SCENARIO_EVALUATOR_DESCRIPTOR = Object.freeze({
  phase: RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
  entity: RECRUITMENT_SCENARIO_EVALUATOR_ENTITY,
  schemaVersion: SCENARIO_EVALUATOR_SCHEMA_VERSION,
  description:
    "Pure advisory scenario evaluator for implementation plans without execution or activation.",
  advisoryOnly: true
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "scenarioId",
  "scenarioStatus",
  "matchedConditions",
  "unmetConditions",
  "findings",
  "recommendations",
  "confidence",
  "expectedOutcome",
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
 * @param {*} value
 * @returns {string}
 */
function resolveRecruitmentId(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "UNKNOWN";
}

/**
 * @param {*} value
 * @returns {ReadonlyArray<string>}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  const seen = Object.create(null);
  const result = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== "string" || item.length === 0) {
      continue;
    }
    if (seen[item] === true) {
      continue;
    }
    seen[item] = true;
    result.push(item);
  }
  result.sort();
  return Object.freeze(result);
}

/**
 * @param {ReadonlyArray<string>} actual
 * @param {ReadonlyArray<string>} required
 * @returns {boolean}
 */
function containsAll(actual, required) {
  const set = Object.create(null);
  for (let i = 0; i < actual.length; i += 1) {
    set[actual[i]] = true;
  }
  for (let j = 0; j < required.length; j += 1) {
    if (set[required[j]] !== true) {
      return false;
    }
  }
  return true;
}

/**
 * @param {ReadonlyArray<string>} actual
 * @param {ReadonlyArray<string>} required
 * @returns {ReadonlyArray<string>}
 */
function missingFrom(actual, required) {
  const set = Object.create(null);
  for (let i = 0; i < actual.length; i += 1) {
    set[actual[i]] = true;
  }
  const missing = [];
  for (let j = 0; j < required.length; j += 1) {
    if (set[required[j]] !== true) {
      missing.push(required[j]);
    }
  }
  missing.sort();
  return Object.freeze(missing);
}

/**
 * @param {*} value
 * @param {boolean} defaultValue
 * @returns {boolean|null}
 */
function resolveBoolean(value, defaultValue) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return defaultValue;
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
      available: false,
      contractVersion: null,
      implementationStages: Object.freeze([]),
      supportedCapabilities: Object.freeze([]),
      executionRequirements: Object.freeze([]),
      rollbackRequirements: Object.freeze([]),
      runtimeBoundaries: Object.freeze([]),
      prerequisites: Object.freeze([]),
      dependencies: Object.freeze([]),
      validationChecks: Object.freeze([]),
      observabilityChecks: Object.freeze([]),
      governanceChecks: Object.freeze([]),
      prerequisitesComplete: null,
      dependenciesHealthy: null,
      validationPassed: null,
      observabilityComplete: null,
      governanceApproved: null,
      rollbackTriggered: null
    });
  }

  const stages = normalizeStringArray(plan.implementationStages);
  const capabilities = normalizeStringArray(plan.supportedCapabilities);
  const execution = normalizeStringArray(plan.executionRequirements);
  const rollback = normalizeStringArray(plan.rollbackRequirements);
  const boundaries = normalizeStringArray(plan.runtimeBoundaries);
  const prerequisites = normalizeStringArray(plan.prerequisites);
  const dependencies = normalizeStringArray(plan.dependencies);
  const validationChecks = normalizeStringArray(plan.validationChecks);
  const observabilityChecks = normalizeStringArray(plan.observabilityChecks);
  const governanceChecks = normalizeStringArray(plan.governanceChecks);

  const prerequisitesComplete = resolveBoolean(
    plan.prerequisitesComplete,
    prerequisites.length > 0 && containsAll(prerequisites, REQUIRED_PREREQUISITE_IDS)
  );
  const dependenciesHealthy = resolveBoolean(
    plan.dependenciesHealthy,
    dependencies.length > 0 && containsAll(dependencies, REQUIRED_DEPENDENCY_IDS)
  );
  const validationPassed = resolveBoolean(
    plan.validationPassed,
    validationChecks.length > 0 && containsAll(validationChecks, REQUIRED_VALIDATION_IDS)
  );
  const observabilityComplete = resolveBoolean(
    plan.observabilityComplete,
    observabilityChecks.length > 0 &&
      containsAll(observabilityChecks, REQUIRED_OBSERVABILITY_IDS)
  );
  const governanceApproved = resolveBoolean(
    plan.governanceApproved,
    governanceChecks.length > 0 && containsAll(governanceChecks, REQUIRED_GOVERNANCE_IDS)
  );
  const rollbackTriggered = resolveBoolean(plan.rollbackTriggered, false);

  return Object.freeze({
    available: true,
    contractVersion:
      typeof plan.contractVersion === "string" ? plan.contractVersion : null,
    implementationStages: stages,
    supportedCapabilities: capabilities,
    executionRequirements: execution,
    rollbackRequirements: rollback,
    runtimeBoundaries: boundaries,
    prerequisites: prerequisites,
    dependencies: dependencies,
    validationChecks: validationChecks,
    observabilityChecks: observabilityChecks,
    governanceChecks: governanceChecks,
    prerequisitesComplete: prerequisitesComplete,
    dependenciesHealthy: dependenciesHealthy,
    validationPassed: validationPassed,
    observabilityComplete: observabilityComplete,
    governanceApproved: governanceApproved,
    rollbackTriggered: rollbackTriggered
  });
}

/**
 * @param {string} id
 * @param {string} label
 * @param {boolean|null} matched
 * @param {string} detail
 * @returns {Readonly<Object>}
 */
function buildCondition(id, label, matched, detail) {
  let status = CONDITION_STATUS.UNKNOWN;
  if (matched === true) {
    status = CONDITION_STATUS.MATCHED;
  } else if (matched === false) {
    status = CONDITION_STATUS.UNMET;
  }
  return Object.freeze({
    id: id,
    label: label,
    status: status,
    matched: matched === true,
    detail: detail
  });
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} scenarioId
 * @param {Readonly<Object>|null} expectedInputs
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function buildConditionsForScenario(signals, scenarioId, expectedInputs) {
  const conditions = [];
  const inputs = isPlainObject(expectedInputs) ? expectedInputs : Object.freeze({});

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION) {
    conditions.push(
      buildCondition(
        "CONTRACT_VERSION",
        "Contract version matches expected",
        signals.contractVersion === EXPECTED_CONTRACT_VERSION,
        "contractVersion=" + String(signals.contractVersion)
      )
    );
    conditions.push(
      buildCondition(
        "ALL_STAGES",
        "All implementation stages present",
        containsAll(signals.implementationStages, REQUIRED_STAGE_IDS),
        "missing=" + missingFrom(signals.implementationStages, REQUIRED_STAGE_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "ALL_CAPABILITIES",
        "All supported capabilities present",
        containsAll(signals.supportedCapabilities, REQUIRED_CAPABILITY_IDS),
        "missing=" +
          missingFrom(signals.supportedCapabilities, REQUIRED_CAPABILITY_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "ALL_EXECUTION",
        "All execution requirements present",
        containsAll(signals.executionRequirements, REQUIRED_EXECUTION_IDS),
        "missing=" +
          missingFrom(signals.executionRequirements, REQUIRED_EXECUTION_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "ALL_ROLLBACK",
        "All rollback requirements present",
        containsAll(signals.rollbackRequirements, REQUIRED_ROLLBACK_IDS),
        "missing=" +
          missingFrom(signals.rollbackRequirements, REQUIRED_ROLLBACK_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "ALL_BOUNDARIES",
        "All runtime boundaries present",
        containsAll(signals.runtimeBoundaries, REQUIRED_BOUNDARY_IDS),
        "missing=" + missingFrom(signals.runtimeBoundaries, REQUIRED_BOUNDARY_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "PREREQUISITES_COMPLETE",
        "Prerequisites marked complete",
        signals.prerequisitesComplete === true,
        "prerequisitesComplete=" + String(signals.prerequisitesComplete)
      )
    );
    conditions.push(
      buildCondition(
        "DEPENDENCIES_HEALTHY",
        "Dependencies marked healthy",
        signals.dependenciesHealthy === true,
        "dependenciesHealthy=" + String(signals.dependenciesHealthy)
      )
    );
    conditions.push(
      buildCondition(
        "VALIDATION_PASSED",
        "Validation marked passed",
        signals.validationPassed === true,
        "validationPassed=" + String(signals.validationPassed)
      )
    );
    conditions.push(
      buildCondition(
        "OBSERVABILITY_COMPLETE",
        "Observability marked complete",
        signals.observabilityComplete === true,
        "observabilityComplete=" + String(signals.observabilityComplete)
      )
    );
    conditions.push(
      buildCondition(
        "GOVERNANCE_APPROVED",
        "Governance marked approved",
        signals.governanceApproved === true,
        "governanceApproved=" + String(signals.governanceApproved)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION) {
    const stageCount = signals.implementationStages.length;
    const maxExclusive =
      typeof inputs.maxStageCountExclusive === "number"
        ? inputs.maxStageCountExclusive
        : REQUIRED_STAGE_IDS.length;
    const minCount = typeof inputs.minStageCount === "number" ? inputs.minStageCount : 1;
    conditions.push(
      buildCondition(
        "CONTRACT_VERSION",
        "Contract version matches expected",
        signals.contractVersion === EXPECTED_CONTRACT_VERSION,
        "contractVersion=" + String(signals.contractVersion)
      )
    );
    conditions.push(
      buildCondition(
        "PARTIAL_STAGES",
        "Stage coverage is partial",
        stageCount >= minCount && stageCount < maxExclusive,
        "stageCount=" + String(stageCount)
      )
    );
    conditions.push(
      buildCondition(
        "NOT_FULL_CAPABILITIES",
        "Capabilities are incomplete",
        !containsAll(signals.supportedCapabilities, REQUIRED_CAPABILITY_IDS),
        "capabilityCount=" + String(signals.supportedCapabilities.length)
      )
    );
    conditions.push(
      buildCondition(
        "PREREQUISITES_INCOMPLETE_FLAG",
        "Prerequisites incomplete for partial plan",
        signals.prerequisitesComplete === false,
        "prerequisitesComplete=" + String(signals.prerequisitesComplete)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES) {
    conditions.push(
      buildCondition(
        "PREREQUISITES_INCOMPLETE",
        "Prerequisites are incomplete",
        signals.prerequisitesComplete === false,
        "prerequisitesComplete=" + String(signals.prerequisitesComplete)
      )
    );
    conditions.push(
      buildCondition(
        "MISSING_PREREQ_IDS",
        "Required prerequisite ids are missing",
        missingFrom(signals.prerequisites, REQUIRED_PREREQUISITE_IDS).length > 0,
        "missing=" +
          missingFrom(signals.prerequisites, REQUIRED_PREREQUISITE_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "DEPENDENCIES_HEALTHY",
        "Dependencies remain healthy",
        signals.dependenciesHealthy === true,
        "dependenciesHealthy=" + String(signals.dependenciesHealthy)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE) {
    conditions.push(
      buildCondition(
        "DEPENDENCIES_UNHEALTHY",
        "Dependencies are unhealthy",
        signals.dependenciesHealthy === false,
        "dependenciesHealthy=" + String(signals.dependenciesHealthy)
      )
    );
    conditions.push(
      buildCondition(
        "MISSING_DEPENDENCY_IDS",
        "Required dependency ids are missing",
        missingFrom(signals.dependencies, REQUIRED_DEPENDENCY_IDS).length > 0,
        "missing=" + missingFrom(signals.dependencies, REQUIRED_DEPENDENCY_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "PREREQUISITES_COMPLETE",
        "Prerequisites remain complete",
        signals.prerequisitesComplete === true,
        "prerequisitesComplete=" + String(signals.prerequisitesComplete)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED) {
    conditions.push(
      buildCondition(
        "ROLLBACK_TRIGGERED",
        "Rollback is triggered",
        signals.rollbackTriggered === true,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_REQUIREMENTS_PRESENT",
        "Rollback requirements are documented",
        containsAll(signals.rollbackRequirements, REQUIRED_ROLLBACK_IDS),
        "missing=" +
          missingFrom(signals.rollbackRequirements, REQUIRED_ROLLBACK_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "DEPENDENCIES_UNHEALTHY",
        "Dependencies indicate failure context",
        signals.dependenciesHealthy === false,
        "dependenciesHealthy=" + String(signals.dependenciesHealthy)
      )
    );
    conditions.push(
      buildCondition(
        "VALIDATION_FAILED_CONTEXT",
        "Validation indicates failure context",
        signals.validationPassed === false,
        "validationPassed=" + String(signals.validationPassed)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE) {
    conditions.push(
      buildCondition(
        "VALIDATION_FAILED",
        "Validation did not pass",
        signals.validationPassed === false,
        "validationPassed=" + String(signals.validationPassed)
      )
    );
    conditions.push(
      buildCondition(
        "MISSING_VALIDATION_IDS",
        "Required validation checks are missing",
        missingFrom(signals.validationChecks, REQUIRED_VALIDATION_IDS).length > 0,
        "missing=" +
          missingFrom(signals.validationChecks, REQUIRED_VALIDATION_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "PREREQUISITES_COMPLETE",
        "Prerequisites remain complete",
        signals.prerequisitesComplete === true,
        "prerequisitesComplete=" + String(signals.prerequisitesComplete)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE) {
    conditions.push(
      buildCondition(
        "OBSERVABILITY_INCOMPLETE",
        "Observability is incomplete",
        signals.observabilityComplete === false,
        "observabilityComplete=" + String(signals.observabilityComplete)
      )
    );
    conditions.push(
      buildCondition(
        "MISSING_OBSERVABILITY_IDS",
        "Required observability checks are missing",
        missingFrom(signals.observabilityChecks, REQUIRED_OBSERVABILITY_IDS).length > 0,
        "missing=" +
          missingFrom(signals.observabilityChecks, REQUIRED_OBSERVABILITY_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "VALIDATION_PASSED",
        "Validation remains passed",
        signals.validationPassed === true,
        "validationPassed=" + String(signals.validationPassed)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED) {
    conditions.push(
      buildCondition(
        "GOVERNANCE_NOT_APPROVED",
        "Governance is not approved",
        signals.governanceApproved === false,
        "governanceApproved=" + String(signals.governanceApproved)
      )
    );
    conditions.push(
      buildCondition(
        "MISSING_GOVERNANCE_IDS",
        "Required governance checks are missing",
        missingFrom(signals.governanceChecks, REQUIRED_GOVERNANCE_IDS).length > 0,
        "missing=" +
          missingFrom(signals.governanceChecks, REQUIRED_GOVERNANCE_IDS).join(",")
      )
    );
    conditions.push(
      buildCondition(
        "PREREQUISITES_COMPLETE",
        "Prerequisites remain complete",
        signals.prerequisitesComplete === true,
        "prerequisitesComplete=" + String(signals.prerequisitesComplete)
      )
    );
    conditions.push(
      buildCondition(
        "ROLLBACK_NOT_TRIGGERED",
        "Rollback not triggered",
        signals.rollbackTriggered === false,
        "rollbackTriggered=" + String(signals.rollbackTriggered)
      )
    );
    return Object.freeze(conditions);
  }

  conditions.push(
    buildCondition(
      "UNKNOWN_SCENARIO",
      "Scenario id is unrecognized",
      false,
      "scenarioId=" + String(scenarioId)
    )
  );
  return Object.freeze(conditions);
}

/**
 * @param {ReadonlyArray<Readonly<Object>>} conditions
 * @returns {{matched: ReadonlyArray<Readonly<Object>>, unmet: ReadonlyArray<Readonly<Object>>}}
 */
function partitionConditions(conditions) {
  const matched = [];
  const unmet = [];
  for (let i = 0; i < conditions.length; i += 1) {
    const condition = conditions[i];
    if (condition.status === CONDITION_STATUS.MATCHED) {
      matched.push(condition);
    } else {
      unmet.push(condition);
    }
  }
  matched.sort(function sortMatched(a, b) {
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  unmet.sort(function sortUnmet(a, b) {
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  return {
    matched: Object.freeze(matched),
    unmet: Object.freeze(unmet)
  };
}

/**
 * @param {string} scenarioId
 * @param {ReadonlyArray<Readonly<Object>>} matched
 * @param {ReadonlyArray<Readonly<Object>>} unmet
 * @param {boolean} signalsAvailable
 * @param {boolean} scenarioKnown
 * @returns {string}
 */
function resolveScenarioStatus(scenarioId, matched, unmet, signalsAvailable, scenarioKnown) {
  if (!scenarioKnown) {
    return SCENARIO_STATUS.INVALID;
  }
  if (!signalsAvailable) {
    return SCENARIO_STATUS.EMPTY;
  }
  if (matched.length === 0 && unmet.length === 0) {
    return SCENARIO_STATUS.UNKNOWN;
  }
  if (unmet.length === 0) {
    return SCENARIO_STATUS.MATCHED;
  }
  if (matched.length === 0) {
    return SCENARIO_STATUS.UNMATCHED;
  }
  return SCENARIO_STATUS.PARTIAL;
}

/**
 * @param {string} scenarioId
 * @param {string} scenarioStatus
 * @param {ReadonlyArray<Readonly<Object>>} unmet
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function buildFindings(scenarioId, scenarioStatus, unmet) {
  const findings = [];
  if (scenarioStatus === SCENARIO_STATUS.INVALID) {
    findings.push(
      Object.freeze({
        id: "FINDING_INVALID_SCENARIO",
        severity: FINDING_SEVERITY.HIGH,
        message: "Selected scenario id is invalid or unrecognized."
      })
    );
  }
  if (scenarioStatus === SCENARIO_STATUS.EMPTY) {
    findings.push(
      Object.freeze({
        id: "FINDING_EMPTY_PLAN",
        severity: FINDING_SEVERITY.MEDIUM,
        message: "No implementation plan signals were available for evaluation."
      })
    );
  }
  for (let i = 0; i < unmet.length; i += 1) {
    const condition = unmet[i];
    let severity = FINDING_SEVERITY.MEDIUM;
    if (
      scenarioId === IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED ||
      scenarioId === IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE
    ) {
      severity = FINDING_SEVERITY.HIGH;
    }
    if (condition.id === "UNKNOWN_SCENARIO") {
      severity = FINDING_SEVERITY.HIGH;
    }
    findings.push(
      Object.freeze({
        id: "FINDING_" + condition.id,
        severity: severity,
        message: "Unmet condition: " + condition.label + " (" + condition.detail + ")"
      })
    );
  }
  findings.sort(function sortFindings(a, b) {
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  return Object.freeze(findings);
}

/**
 * @param {string} scenarioId
 * @param {string} scenarioStatus
 * @param {ReadonlyArray<Readonly<Object>>} unmet
 * @returns {ReadonlyArray<string>}
 */
function buildRecommendations(scenarioId, scenarioStatus, unmet) {
  const recommendations = [];
  if (scenarioStatus === SCENARIO_STATUS.MATCHED) {
    recommendations.push(
      "Scenario conditions matched; proceed to advisory decision matrix review."
    );
  } else if (scenarioStatus === SCENARIO_STATUS.PARTIAL) {
    recommendations.push(
      "Resolve unmet scenario conditions before treating the scenario as matched."
    );
  } else if (scenarioStatus === SCENARIO_STATUS.UNMATCHED) {
    recommendations.push(
      "Implementation plan does not match selected scenario; revise plan or select another scenario."
    );
  } else if (scenarioStatus === SCENARIO_STATUS.EMPTY) {
    recommendations.push("Provide a complete implementation plan for scenario evaluation.");
  } else if (scenarioStatus === SCENARIO_STATUS.INVALID) {
    recommendations.push("Select a built-in scenario id from the advisory scenario catalog.");
  }

  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES) {
    recommendations.push("Complete missing prerequisites before next advisory review.");
  }
  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE) {
    recommendations.push("Repair failed dependencies and re-evaluate dependency health.");
  }
  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED) {
    recommendations.push("Execute advisory rollback verification checkpoints.");
  }
  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE) {
    recommendations.push("Re-run advisory validation checks and remediate failures.");
  }
  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE) {
    recommendations.push("Complete observability and monitoring checkpoints.");
  }
  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED) {
    recommendations.push("Complete governance checklist and obtain advisory review.");
  }
  if (scenarioId === IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION) {
    recommendations.push("Expand implementation coverage toward complete advisory readiness.");
  }
  if (unmet.length > 0) {
    recommendations.push(
      "Address " + String(unmet.length) + " unmet condition(s) identified by scenario evaluation."
    );
  }

  recommendations.sort();
  return Object.freeze(recommendations);
}

/**
 * @param {string} scenarioStatus
 * @param {number} matchedCount
 * @param {number} totalCount
 * @param {boolean} signalsAvailable
 * @returns {number}
 */
function calculateConfidence(scenarioStatus, matchedCount, totalCount, signalsAvailable) {
  if (scenarioStatus === SCENARIO_STATUS.INVALID) {
    return 0;
  }
  if (!signalsAvailable || scenarioStatus === SCENARIO_STATUS.EMPTY) {
    return 10;
  }
  if (totalCount === 0) {
    return 20;
  }
  let score = Math.round((matchedCount / totalCount) * 100);
  if (scenarioStatus === SCENARIO_STATUS.MATCHED) {
    score = Math.max(score, 90);
  } else if (scenarioStatus === SCENARIO_STATUS.PARTIAL) {
    score = Math.min(score, 79);
    score = Math.max(score, 40);
  } else if (scenarioStatus === SCENARIO_STATUS.UNMATCHED) {
    score = Math.min(score, 35);
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
 * @returns {{scenarioId: string, scenarioKnown: boolean, expectedInputs: Readonly<Object>|null, expectedOutcome: string|null}}
 */
function resolveScenarioSelection(input) {
  const safeInput = isPlainObject(input) ? input : {};
  let scenarioId = null;
  let expectedInputs = null;
  let expectedOutcome = null;

  if (isPlainObject(safeInput.scenario)) {
    if (typeof safeInput.scenario.id === "string") {
      scenarioId = safeInput.scenario.id;
    }
    if (isPlainObject(safeInput.scenario.expectedInputs)) {
      expectedInputs = safeInput.scenario.expectedInputs;
    }
    if (typeof safeInput.scenario.expectedOutcome === "string") {
      expectedOutcome = safeInput.scenario.expectedOutcome;
    }
  }

  if (typeof safeInput.scenarioId === "string" && safeInput.scenarioId.length > 0) {
    scenarioId = safeInput.scenarioId;
  }

  const knownIds = IMPLEMENTATION_SCENARIO_IDS;
  const scenarioKnown =
    scenarioId != null &&
    Object.prototype.hasOwnProperty.call(BUILTIN_EXPECTED_OUTCOMES, scenarioId);

  if (expectedOutcome == null && scenarioKnown) {
    expectedOutcome = BUILTIN_EXPECTED_OUTCOMES[scenarioId];
  }

  return {
    scenarioId: scenarioId == null ? "UNKNOWN" : scenarioId,
    scenarioKnown: scenarioKnown,
    expectedInputs: expectedInputs,
    expectedOutcome: expectedOutcome
  };
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function evaluateRecruitmentScenario(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const selection = resolveScenarioSelection(safeInput);
  const plan = isPlainObject(safeInput.implementationPlan)
    ? safeInput.implementationPlan
    : safeInput.plan;
  const signals = extractPlanSignals(plan);

  if (!hasInput) {
    return deepFreeze({
      recruitmentId: recruitmentId,
      scenarioId: "UNKNOWN",
      scenarioStatus: SCENARIO_STATUS.EMPTY,
      matchedConditions: Object.freeze([]),
      unmetConditions: Object.freeze([]),
      findings: Object.freeze([
        Object.freeze({
          id: "FINDING_EMPTY_INPUT",
          severity: FINDING_SEVERITY.MEDIUM,
          message: "No evaluation input was provided."
        })
      ]),
      recommendations: Object.freeze([
        "Provide scenarioId and implementationPlan for advisory scenario evaluation."
      ]),
      confidence: 0,
      expectedOutcome: null,
      generatedMetadata: Object.freeze({
        generatedAt: "deterministic",
        generatedBy: "phase_147",
        schemaVersion: SCENARIO_EVALUATOR_SCHEMA_VERSION,
        deterministic: true,
        phase: RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
        advisoryOnly: true,
        runtimeImpact: "none",
        evaluationOnly: true
      }),
      advisoryMetadata: Object.freeze({
        advisoryOnly: true,
        descriptiveOnly: true,
        persistent: false,
        generatedBy: "phase_147",
        phase: RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
        evaluationOnly: true,
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

  const conditions = buildConditionsForScenario(
    signals,
    selection.scenarioId,
    selection.expectedInputs
  );
  const partitioned = partitionConditions(conditions);
  const scenarioStatus = resolveScenarioStatus(
    selection.scenarioId,
    partitioned.matched,
    partitioned.unmet,
    signals.available,
    selection.scenarioKnown
  );
  const findings = buildFindings(
    selection.scenarioId,
    scenarioStatus,
    partitioned.unmet
  );
  const recommendations = buildRecommendations(
    selection.scenarioId,
    scenarioStatus,
    partitioned.unmet
  );
  const confidence = calculateConfidence(
    scenarioStatus,
    partitioned.matched.length,
    conditions.length,
    signals.available
  );

  return deepFreeze({
    recruitmentId: recruitmentId,
    scenarioId: selection.scenarioId,
    scenarioStatus: scenarioStatus,
    matchedConditions: partitioned.matched,
    unmetConditions: partitioned.unmet,
    findings: findings,
    recommendations: recommendations,
    confidence: confidence,
    expectedOutcome: selection.expectedOutcome,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_147",
      schemaVersion: SCENARIO_EVALUATOR_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      evaluationOnly: true,
      expectedContractVersion: EXPECTED_CONTRACT_VERSION
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_147",
      phase: RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
      evaluationOnly: true,
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
function isRecruitmentScenarioEvaluation(value) {
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
  RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
  RECRUITMENT_SCENARIO_EVALUATOR_ENTITY,
  SCENARIO_EVALUATOR_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  IMPLEMENTATION_SCENARIO_IDS,
  SCENARIO_STATUS,
  CONDITION_STATUS,
  FINDING_SEVERITY,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  REQUIRED_PREREQUISITE_IDS,
  REQUIRED_DEPENDENCY_IDS,
  REQUIRED_VALIDATION_IDS,
  REQUIRED_OBSERVABILITY_IDS,
  REQUIRED_GOVERNANCE_IDS,
  RECRUITMENT_SCENARIO_EVALUATOR_METADATA,
  RECRUITMENT_SCENARIO_EVALUATOR_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  evaluateRecruitmentScenario,
  isRecruitmentScenarioEvaluation
};
