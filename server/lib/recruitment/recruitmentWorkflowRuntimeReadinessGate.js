"use strict";

/**
 * Phase 140 — Recruitment Workflow Runtime Readiness Gate (Advisory Only).
 *
 * Pure advisory readiness gate that evaluates advisory signals only before any
 * future controlled runtime adoption. No gate execution, no persistence,
 * no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_PHASE = 140;

const RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_ENTITY =
  "recruitment_workflow_runtime_readiness_gate";

const GATE_SCHEMA_VERSION = "1.0.0";

const GATE_STATUS = Object.freeze({
  GATE_OPEN: "GATE_OPEN",
  GATE_CONDITIONAL: "GATE_CONDITIONAL",
  GATE_CLOSED: "GATE_CLOSED",
  GATE_UNKNOWN: "GATE_UNKNOWN"
});

const CHECKPOINT_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  PARTIALLY_SATISFIED: "PARTIALLY_SATISFIED",
  NOT_SATISFIED: "NOT_SATISFIED",
  UNKNOWN: "UNKNOWN"
});

const READINESS_CHECKPOINT_IDS = Object.freeze({
  ARCHITECTURE_BLUEPRINT_READY: "ARCHITECTURE_BLUEPRINT_READY",
  RUNTIME_MAPPING_DEFINED: "RUNTIME_MAPPING_DEFINED",
  GOVERNANCE_COMPLIANT: "GOVERNANCE_COMPLIANT",
  SIMULATION_VALIDATED: "SIMULATION_VALIDATED",
  INTEGRATION_CONTRACT_READY: "INTEGRATION_CONTRACT_READY",
  FEATURE_FLAG_STRATEGY_DEFINED: "FEATURE_FLAG_STRATEGY_DEFINED",
  SHADOW_MODE_PLANNED: "SHADOW_MODE_PLANNED",
  NO_PRODUCTION_MUTATION: "NO_PRODUCTION_MUTATION"
});

const READINESS_CHECKPOINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.ARCHITECTURE_BLUEPRINT_READY,
    label: "Architecture blueprint advisory outputs ready",
    category: "ARCHITECTURE",
    requiredSignal: "architectureSummary.summaryPosture",
    expectedValue: "ARCHITECTURE_READY"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.RUNTIME_MAPPING_DEFINED,
    label: "Future runtime mapping advisory posture defined",
    category: "RUNTIME_MAPPING",
    requiredSignal: "futureRuntimeMapping.mappingPosture",
    expectedValue: "MAPPING_DEFINED"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.GOVERNANCE_COMPLIANT,
    label: "Governance compliance advisory posture compliant",
    category: "GOVERNANCE",
    requiredSignal: "governanceCompliance.governancePosture",
    expectedValue: "COMPLIANT"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.SIMULATION_VALIDATED,
    label: "Simulation advisory validation satisfied",
    category: "SIMULATION",
    requiredSignal: "simulationValidation.validationStatus",
    expectedValue: "VALID"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.INTEGRATION_CONTRACT_READY,
    label: "Integration contract advisory readiness satisfied",
    category: "CONTRACT",
    requiredSignal: "integrationContract.contractStatus",
    expectedValue: "CONTRACT_READY"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.FEATURE_FLAG_STRATEGY_DEFINED,
    label: "Feature flag strategy advisory posture defined",
    category: "FEATURE_FLAGS",
    requiredSignal: "featureFlagStrategy.flagStrategyPosture",
    expectedValue: "STRATEGY_DEFINED"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.SHADOW_MODE_PLANNED,
    label: "Shadow mode advisory blueprint planned",
    category: "SHADOW_MODE",
    requiredSignal: "shadowModeBlueprint.shadowModePosture",
    expectedValue: "SHADOW_DEFINED"
  }),
  Object.freeze({
    id: READINESS_CHECKPOINT_IDS.NO_PRODUCTION_MUTATION,
    label: "Advisory-only posture with no production mutation",
    category: "SAFETY",
    requiredSignal: "advisoryPosture.noProductionMutation",
    expectedValue: true
  })
]);

const RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_140",
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
  runtimeReadinessGateOnly: true,
  gateExecutionEnabled: false,
  advisorySignalsOnly: true,
  runtimeWiringEnabled: false,
  schedulerEnabled: false,
  workerEnabled: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139
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
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedReadinessGateInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  return true;
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {Readonly<Object>} input
 * @param {string} signalPath
 * @returns {*}
 */
function resolveSignalValue(input, signalPath) {
  const parts = signalPath.split(".");
  let current = input;

  for (let i = 0; i < parts.length; i += 1) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[parts[i]];
  }

  return current;
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} checkpoint
 * @returns {string}
 */
function evaluateCheckpoint(input, checkpoint) {
  const actualValue = resolveSignalValue(input, checkpoint.requiredSignal);

  if (actualValue === undefined || actualValue === null) {
    return CHECKPOINT_STATUS.UNKNOWN;
  }

  if (checkpoint.expectedValue === true) {
    return actualValue === true ? CHECKPOINT_STATUS.SATISFIED : CHECKPOINT_STATUS.NOT_SATISFIED;
  }

  if (typeof checkpoint.expectedValue === "string") {
    if (actualValue === checkpoint.expectedValue) {
      return CHECKPOINT_STATUS.SATISFIED;
    }
    if (typeof actualValue === "string" && actualValue.includes("PARTIAL")) {
      return CHECKPOINT_STATUS.PARTIALLY_SATISFIED;
    }
    return CHECKPOINT_STATUS.NOT_SATISFIED;
  }

  return CHECKPOINT_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Array>} checkpointEvaluations
 * @returns {string}
 */
function resolveGateStatus(checkpointEvaluations) {
  if (checkpointEvaluations.length === 0) {
    return GATE_STATUS.GATE_UNKNOWN;
  }

  const notSatisfied = checkpointEvaluations.filter(
    (checkpoint) => checkpoint.checkpointStatus === CHECKPOINT_STATUS.NOT_SATISFIED
  );
  if (notSatisfied.length > 0) {
    return GATE_STATUS.GATE_CLOSED;
  }

  const partial = checkpointEvaluations.filter(
    (checkpoint) => checkpoint.checkpointStatus === CHECKPOINT_STATUS.PARTIALLY_SATISFIED
  );
  if (partial.length > 0) {
    return GATE_STATUS.GATE_CONDITIONAL;
  }

  const unknown = checkpointEvaluations.filter(
    (checkpoint) => checkpoint.checkpointStatus === CHECKPOINT_STATUS.UNKNOWN
  );
  if (unknown.length > 0) {
    return GATE_STATUS.GATE_UNKNOWN;
  }

  const allSatisfied = checkpointEvaluations.every(
    (checkpoint) => checkpoint.checkpointStatus === CHECKPOINT_STATUS.SATISFIED
  );
  if (allSatisfied) {
    return GATE_STATUS.GATE_OPEN;
  }

  return GATE_STATUS.GATE_CONDITIONAL;
}

/**
 * @param {string} gateStatus
 * @returns {string}
 */
function buildReadinessGateSummary(gateStatus) {
  if (gateStatus === GATE_STATUS.GATE_OPEN) {
    return "Recruitment workflow runtime readiness gate open based on advisory signals";
  }
  if (gateStatus === GATE_STATUS.GATE_CONDITIONAL) {
    return "Recruitment workflow runtime readiness gate conditionally open pending advisory review";
  }
  if (gateStatus === GATE_STATUS.GATE_CLOSED) {
    return "Recruitment workflow runtime readiness gate closed by advisory signal evaluation";
  }
  return "Recruitment workflow runtime readiness gate status could not be determined";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildReadinessGateResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    schemaVersion: GATE_SCHEMA_VERSION,
    gateStatus: params.gateStatus,
    readinessGateSummary: params.readinessGateSummary,
    checkpointCount: params.checkpointEvaluations.length,
    satisfiedCheckpointCount: params.satisfiedCheckpointCount,
    checkpointEvaluations: Object.freeze(params.checkpointEvaluations.slice()),
    advisorySignalsOnly: true,
    gateExecutionEnabled: false,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_140",
      phase: RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_PHASE,
      runtimeReadinessGateOnly: true,
      advisorySignalsOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      gateExecutionEnabled: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function evaluateRecruitmentWorkflowRuntimeReadinessGate(input) {
  if (!isRecognizedReadinessGateInput(input)) {
    return buildReadinessGateResult({
      recruitmentId: null,
      gateStatus: GATE_STATUS.GATE_UNKNOWN,
      readinessGateSummary: buildReadinessGateSummary(GATE_STATUS.GATE_UNKNOWN),
      checkpointEvaluations: [],
      satisfiedCheckpointCount: 0
    });
  }

  const safeInput = input || {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);

  const checkpointEvaluations = READINESS_CHECKPOINT_DEFINITIONS.map((checkpoint) =>
    deepFreeze({
      checkpointId: checkpoint.id,
      label: checkpoint.label,
      category: checkpoint.category,
      checkpointStatus: evaluateCheckpoint(safeInput, checkpoint),
      requiredSignal: checkpoint.requiredSignal,
      expectedValue: checkpoint.expectedValue
    })
  );

  const satisfiedCheckpointCount = checkpointEvaluations.filter(
    (checkpoint) => checkpoint.checkpointStatus === CHECKPOINT_STATUS.SATISFIED
  ).length;

  const gateStatus = resolveGateStatus(checkpointEvaluations);
  const readinessGateSummary = buildReadinessGateSummary(gateStatus);

  return buildReadinessGateResult({
    recruitmentId,
    gateStatus,
    readinessGateSummary,
    checkpointEvaluations,
    satisfiedCheckpointCount
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_ENTITY,
  GATE_SCHEMA_VERSION,
  GATE_STATUS,
  CHECKPOINT_STATUS,
  READINESS_CHECKPOINT_IDS,
  READINESS_CHECKPOINT_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_READINESS_GATE_METADATA,
  evaluateRecruitmentWorkflowRuntimeReadinessGate
};
