"use strict";

/**
 * Phase 147 — Recruitment Scenario Catalog (Advisory Only).
 *
 * Pure deterministic built-in implementation scenarios for advisory
 * verification. No database access, no persistence, no runtime imports,
 * no side effects. No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_SCENARIO_CATALOG_PHASE = 147;

const RECRUITMENT_SCENARIO_CATALOG_ENTITY = "recruitment_scenario_catalog";

const SCENARIO_CATALOG_SCHEMA_VERSION = "1.0.0";

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

const SCENARIO_OUTCOMES = Object.freeze({
  IMPLEMENTATION_COMPLETE_ADVISORY: "IMPLEMENTATION_COMPLETE_ADVISORY",
  IMPLEMENTATION_PARTIAL_ADVISORY: "IMPLEMENTATION_PARTIAL_ADVISORY",
  PREREQUISITES_INCOMPLETE: "PREREQUISITES_INCOMPLETE",
  DEPENDENCY_BLOCKED: "DEPENDENCY_BLOCKED",
  ROLLBACK_ADVISORY: "ROLLBACK_ADVISORY",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  OBSERVABILITY_GAP: "OBSERVABILITY_GAP",
  GOVERNANCE_REVIEW_NEEDED: "GOVERNANCE_REVIEW_NEEDED"
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

const SCENARIO_DEFINITIONS = deepFreeze([
  {
    id: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
    description:
      "Full advisory implementation plan with all stages, capabilities, execution, rollback, and boundary requirements satisfied.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      implementationStages: REQUIRED_STAGE_IDS.slice(),
      supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
      executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
      rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
      runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
      prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
      dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
      validationChecks: REQUIRED_VALIDATION_IDS.slice(),
      observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
      governanceChecks: REQUIRED_GOVERNANCE_IDS.slice(),
      prerequisitesComplete: true,
      dependenciesHealthy: true,
      validationPassed: true,
      observabilityComplete: true,
      governanceApproved: true,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.IMPLEMENTATION_COMPLETE_ADVISORY,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION,
    description:
      "Partial advisory implementation plan with some stages and capabilities present but incomplete coverage.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      implementationStages: Object.freeze([
        "STAGE_CONTRACT_ALIGNMENT",
        "STAGE_ADAPTER_SCAFFOLD"
      ]),
      supportedCapabilities: Object.freeze([
        "CAP_BOUNDARY_ISOLATION",
        "CAP_RUNTIME_ADAPTER"
      ]),
      executionRequirements: Object.freeze(["EXEC_NO_RUNTIME_WIRING"]),
      rollbackRequirements: Object.freeze(["RB_DISABLE_FLAGS"]),
      runtimeBoundaries: Object.freeze(["BOUNDARY_ORCHESTRATOR"]),
      minStageCount: 1,
      maxStageCountExclusive: REQUIRED_STAGE_IDS.length,
      prerequisitesComplete: false,
      dependenciesHealthy: true,
      validationPassed: false,
      observabilityComplete: false,
      governanceApproved: false,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.IMPLEMENTATION_PARTIAL_ADVISORY,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES,
    description:
      "Implementation plan blocked by missing advisory prerequisites required before further review.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      prerequisites: Object.freeze([]),
      prerequisitesComplete: false,
      missingPrerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
      dependenciesHealthy: true,
      validationPassed: true,
      observabilityComplete: true,
      governanceApproved: false,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.PREREQUISITES_INCOMPLETE,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE,
    description:
      "Implementation plan exhibits failed or missing stage dependencies that block advisory progression.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      dependencies: Object.freeze([]),
      dependenciesHealthy: false,
      failedDependencies: REQUIRED_DEPENDENCY_IDS.slice(),
      prerequisitesComplete: true,
      validationPassed: true,
      observabilityComplete: true,
      governanceApproved: false,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.DEPENDENCY_BLOCKED,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED,
    description:
      "Advisory signals indicate rollback readiness must be exercised before any further implementation review.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
      rollbackTriggered: true,
      prerequisitesComplete: true,
      dependenciesHealthy: false,
      validationPassed: false,
      observabilityComplete: true,
      governanceApproved: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.ROLLBACK_ADVISORY,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE,
    description:
      "Implementation plan fails one or more advisory validation checks required for readiness confirmation.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      validationChecks: Object.freeze([]),
      validationPassed: false,
      failedValidations: REQUIRED_VALIDATION_IDS.slice(),
      prerequisitesComplete: true,
      dependenciesHealthy: true,
      observabilityComplete: true,
      governanceApproved: false,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.VALIDATION_FAILED,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE,
    description:
      "Monitoring and observability checkpoints are incomplete, preventing advisory readiness confirmation.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      observabilityChecks: Object.freeze([]),
      observabilityComplete: false,
      missingObservability: REQUIRED_OBSERVABILITY_IDS.slice(),
      prerequisitesComplete: true,
      dependenciesHealthy: true,
      validationPassed: true,
      governanceApproved: false,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.OBSERVABILITY_GAP,
    advisoryOnly: true
  },
  {
    id: IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED,
    description:
      "Governance checklist or review gates are incomplete and require advisory governance review.",
    expectedInputs: {
      contractVersion: EXPECTED_CONTRACT_VERSION,
      governanceChecks: Object.freeze([]),
      governanceApproved: false,
      missingGovernance: REQUIRED_GOVERNANCE_IDS.slice(),
      prerequisitesComplete: true,
      dependenciesHealthy: true,
      validationPassed: true,
      observabilityComplete: true,
      rollbackTriggered: false
    },
    expectedOutcome: SCENARIO_OUTCOMES.GOVERNANCE_REVIEW_NEEDED,
    advisoryOnly: true
  }
]);

const SCENARIO_BY_ID = (function buildScenarioIndex() {
  const index = {};
  for (let i = 0; i < SCENARIO_DEFINITIONS.length; i += 1) {
    const scenario = SCENARIO_DEFINITIONS[i];
    index[scenario.id] = scenario;
  }
  return Object.freeze(index);
})();

const ORDERED_SCENARIO_IDS = Object.freeze(
  SCENARIO_DEFINITIONS.map(function mapId(scenario) {
    return scenario.id;
  })
);

const RECRUITMENT_SCENARIO_CATALOG_METADATA = Object.freeze({
  phase: RECRUITMENT_SCENARIO_CATALOG_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  scenarioCatalogOnly: true,
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

const RECRUITMENT_SCENARIO_CATALOG_DESCRIPTOR = Object.freeze({
  phase: RECRUITMENT_SCENARIO_CATALOG_PHASE,
  entity: RECRUITMENT_SCENARIO_CATALOG_ENTITY,
  schemaVersion: SCENARIO_CATALOG_SCHEMA_VERSION,
  description:
    "Pure built-in advisory implementation scenario catalog without execution or activation.",
  advisoryOnly: true
});

const EXPECTED_SCENARIO_KEYS = Object.freeze([
  "id",
  "description",
  "expectedInputs",
  "expectedOutcome",
  "advisoryOnly"
]);

/**
 * @returns {ReadonlyArray<string>}
 */
function listRecruitmentScenarioIds() {
  return ORDERED_SCENARIO_IDS;
}

/**
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
function listRecruitmentScenarios() {
  return SCENARIO_DEFINITIONS;
}

/**
 * @param {string} scenarioId
 * @returns {boolean}
 */
function isKnownRecruitmentScenarioId(scenarioId) {
  return (
    typeof scenarioId === "string" &&
    Object.prototype.hasOwnProperty.call(SCENARIO_BY_ID, scenarioId)
  );
}

/**
 * @param {string} scenarioId
 * @returns {Readonly<Object>|null}
 */
function getRecruitmentScenario(scenarioId) {
  if (!isKnownRecruitmentScenarioId(scenarioId)) {
    return null;
  }
  return SCENARIO_BY_ID[scenarioId];
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentScenarioDefinition(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_SCENARIO_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_SCENARIO_KEYS[i])) {
      return false;
    }
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return false;
  }
  if (typeof value.description !== "string") {
    return false;
  }
  if (value.expectedInputs == null || typeof value.expectedInputs !== "object") {
    return false;
  }
  if (typeof value.expectedOutcome !== "string") {
    return false;
  }
  if (value.advisoryOnly !== true) {
    return false;
  }
  return Object.isFrozen(value);
}

module.exports = {
  RECRUITMENT_SCENARIO_CATALOG_PHASE,
  RECRUITMENT_SCENARIO_CATALOG_ENTITY,
  SCENARIO_CATALOG_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  IMPLEMENTATION_SCENARIO_IDS,
  SCENARIO_OUTCOMES,
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
  SCENARIO_DEFINITIONS,
  ORDERED_SCENARIO_IDS,
  RECRUITMENT_SCENARIO_CATALOG_METADATA,
  RECRUITMENT_SCENARIO_CATALOG_DESCRIPTOR,
  EXPECTED_SCENARIO_KEYS,
  listRecruitmentScenarioIds,
  listRecruitmentScenarios,
  isKnownRecruitmentScenarioId,
  getRecruitmentScenario,
  isRecruitmentScenarioDefinition
};
