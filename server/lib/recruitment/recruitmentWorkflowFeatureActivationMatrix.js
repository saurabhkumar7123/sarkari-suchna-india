"use strict";

/**
 * Phase 135 — Recruitment Workflow Feature Activation Matrix (Advisory Only).
 *
 * Pure advisory matrix mapping recruitment workflow advisory modules to rollout
 * stages for future controlled production integration planning. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_PHASE = 135;

const RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_ENTITY =
  "recruitment_workflow_feature_activation_matrix";

const ACTIVATION_STATUS = Object.freeze({
  INACTIVE: "INACTIVE",
  PLANNED: "PLANNED",
  READY_FOR_ACTIVATION: "READY_FOR_ACTIVATION",
  ACTIVATED: "ACTIVATED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const ACTIVATION_MODE = Object.freeze({
  ADVISORY_ONLY: "ADVISORY_ONLY"
});

const ROLLOUT_STAGE_IDS = Object.freeze({
  FOUNDATIONAL_PIPELINE: "FOUNDATIONAL_PIPELINE",
  STORAGE_BOUNDARY: "STORAGE_BOUNDARY",
  ORCHESTRATION_BOUNDARY: "ORCHESTRATION_BOUNDARY",
  TRACE_AND_REGISTRY: "TRACE_AND_REGISTRY",
  READINESS_AND_REPORTING: "READINESS_AND_REPORTING",
  SNAPSHOT_ANALYSIS: "SNAPSHOT_ANALYSIS",
  HEALTH_AND_RISK: "HEALTH_AND_RISK",
  INTELLIGENCE_AGGREGATION: "INTELLIGENCE_AGGREGATION",
  RECOMMENDATION_AND_TIMELINE: "RECOMMENDATION_AND_TIMELINE",
  CONSISTENCY_VALIDATION: "CONSISTENCY_VALIDATION",
  CONTROLLED_INTEGRATION_GATE: "CONTROLLED_INTEGRATION_GATE"
});

const ADVISORY_MODULE_IDS = Object.freeze({
  DRAFT_PROPOSAL: "draft_proposal",
  PERSISTENCE_BOUNDARY: "persistence_boundary",
  APPROVAL_GATE: "approval_gate",
  REVIEW_PACKAGE: "review_package",
  STORAGE_ADAPTER: "storage_adapter",
  REPOSITORY_CONTRACT: "repository_contract",
  WORKFLOW_ORCHESTRATOR: "workflow_orchestrator",
  DECISION_TRACE_MODEL: "decision_trace_model",
  CAPABILITY_REGISTRY: "capability_registry",
  READINESS_ASSESSMENT: "readiness_assessment",
  ADVISORY_REPORT_GENERATOR: "advisory_report_generator",
  ADVISORY_SNAPSHOT: "advisory_snapshot",
  SNAPSHOT_COMPARISON: "snapshot_comparison",
  EVOLUTION_ANALYZER: "evolution_analyzer",
  HEALTH_INDICATOR: "health_indicator",
  RISK_ASSESSMENT: "risk_assessment",
  INTELLIGENCE_SUMMARY: "intelligence_summary",
  RECOMMENDATION_MODEL: "recommendation_model",
  TIMELINE_MODEL: "timeline_model",
  CONSISTENCY_VALIDATOR: "consistency_validator",
  INTEGRATION_READINESS_FRAMEWORK: "integration_readiness_framework"
});

const ACTIVATION_MATRIX_DEFINITIONS = Object.freeze([
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.DRAFT_PROPOSAL,
    phase: 114,
    rolloutStageId: ROLLOUT_STAGE_IDS.FOUNDATIONAL_PIPELINE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.PERSISTENCE_BOUNDARY,
    phase: 115,
    rolloutStageId: ROLLOUT_STAGE_IDS.FOUNDATIONAL_PIPELINE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.APPROVAL_GATE,
    phase: 116,
    rolloutStageId: ROLLOUT_STAGE_IDS.FOUNDATIONAL_PIPELINE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.REVIEW_PACKAGE,
    phase: 117,
    rolloutStageId: ROLLOUT_STAGE_IDS.FOUNDATIONAL_PIPELINE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.STORAGE_ADAPTER,
    phase: 118,
    rolloutStageId: ROLLOUT_STAGE_IDS.STORAGE_BOUNDARY,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.REPOSITORY_CONTRACT,
    phase: 119,
    rolloutStageId: ROLLOUT_STAGE_IDS.STORAGE_BOUNDARY,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.WORKFLOW_ORCHESTRATOR,
    phase: 120,
    rolloutStageId: ROLLOUT_STAGE_IDS.ORCHESTRATION_BOUNDARY,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.DECISION_TRACE_MODEL,
    phase: 121,
    rolloutStageId: ROLLOUT_STAGE_IDS.TRACE_AND_REGISTRY,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.CAPABILITY_REGISTRY,
    phase: 122,
    rolloutStageId: ROLLOUT_STAGE_IDS.TRACE_AND_REGISTRY,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.READINESS_ASSESSMENT,
    phase: 123,
    rolloutStageId: ROLLOUT_STAGE_IDS.READINESS_AND_REPORTING,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.ADVISORY_REPORT_GENERATOR,
    phase: 124,
    rolloutStageId: ROLLOUT_STAGE_IDS.READINESS_AND_REPORTING,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.ADVISORY_SNAPSHOT,
    phase: 125,
    rolloutStageId: ROLLOUT_STAGE_IDS.SNAPSHOT_ANALYSIS,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.SNAPSHOT_COMPARISON,
    phase: 126,
    rolloutStageId: ROLLOUT_STAGE_IDS.SNAPSHOT_ANALYSIS,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.EVOLUTION_ANALYZER,
    phase: 127,
    rolloutStageId: ROLLOUT_STAGE_IDS.SNAPSHOT_ANALYSIS,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.HEALTH_INDICATOR,
    phase: 128,
    rolloutStageId: ROLLOUT_STAGE_IDS.HEALTH_AND_RISK,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.RISK_ASSESSMENT,
    phase: 129,
    rolloutStageId: ROLLOUT_STAGE_IDS.HEALTH_AND_RISK,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.INTELLIGENCE_SUMMARY,
    phase: 130,
    rolloutStageId: ROLLOUT_STAGE_IDS.INTELLIGENCE_AGGREGATION,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.RECOMMENDATION_MODEL,
    phase: 131,
    rolloutStageId: ROLLOUT_STAGE_IDS.RECOMMENDATION_AND_TIMELINE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.TIMELINE_MODEL,
    phase: 132,
    rolloutStageId: ROLLOUT_STAGE_IDS.RECOMMENDATION_AND_TIMELINE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.CONSISTENCY_VALIDATOR,
    phase: 133,
    rolloutStageId: ROLLOUT_STAGE_IDS.CONSISTENCY_VALIDATION,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  }),
  Object.freeze({
    moduleId: ADVISORY_MODULE_IDS.INTEGRATION_READINESS_FRAMEWORK,
    phase: 134,
    rolloutStageId: ROLLOUT_STAGE_IDS.CONTROLLED_INTEGRATION_GATE,
    activationMode: ACTIVATION_MODE.ADVISORY_ONLY
  })
]);

const RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_135",
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
  activationMatrixOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134
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
function isRecognizedMatrixInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = ["moduleSignals", "activatedModules", "rolloutStageId"];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (field === "rolloutStageId" && typeof value === "string") {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulMatrixSignals(input) {
  return input.moduleSignals != null || input.activatedModules != null;
}

/**
 * @param {*} signal
 * @returns {boolean}
 */
function isActivationSignalSatisfied(signal) {
  if (!isPlainObject(signal)) {
    return false;
  }
  return (
    signal.activated === true ||
    signal.satisfied === true ||
    signal.ready === true ||
    signal.available === true
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Set<string>>}
 */
function deriveActivatedModuleIds(input) {
  const activated = new Set();

  if (isPlainObject(input.activatedModules)) {
    const keys = Object.keys(input.activatedModules);
    for (let i = 0; i < keys.length; i += 1) {
      if (isActivationSignalSatisfied(input.activatedModules[keys[i]])) {
        activated.add(keys[i]);
      }
    }
  }

  if (isPlainObject(input.moduleSignals)) {
    const keys = Object.keys(input.moduleSignals);
    for (let i = 0; i < keys.length; i += 1) {
      if (isActivationSignalSatisfied(input.moduleSignals[keys[i]])) {
        activated.add(keys[i]);
      }
    }
  }

  return activated;
}

/**
 * @param {string} moduleId
 * @param {Readonly<Set<string>>} activatedModuleIds
 * @param {boolean} hasSignals
 * @returns {string}
 */
function resolveActivationStatus(moduleId, activatedModuleIds, hasSignals) {
  if (!hasSignals) {
    return ACTIVATION_STATUS.UNKNOWN;
  }

  if (activatedModuleIds.has(moduleId)) {
    return ACTIVATION_STATUS.ACTIVATED;
  }

  return ACTIVATION_STATUS.PLANNED;
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Set<string>>} activatedModuleIds
 * @returns {ReadonlyArray<Object>}
 */
function buildActivationMatrixRows(input, activatedModuleIds) {
  const hasSignals = hasMeaningfulMatrixSignals(input);
  const filterStageId =
    typeof input.rolloutStageId === "string" ? input.rolloutStageId : null;

  return ACTIVATION_MATRIX_DEFINITIONS.filter((definition) => {
    if (filterStageId == null) {
      return true;
    }
    return definition.rolloutStageId === filterStageId;
  }).map((definition) =>
    deepFreeze({
      moduleId: definition.moduleId,
      phase: definition.phase,
      rolloutStageId: definition.rolloutStageId,
      activationMode: definition.activationMode,
      activationStatus: resolveActivationStatus(
        definition.moduleId,
        activatedModuleIds,
        hasSignals
      )
    })
  );
}

/**
 * @param {ReadonlyArray<Object>} matrixRows
 * @returns {string}
 */
function buildMatrixSummary(matrixRows) {
  if (matrixRows.length === 0) {
    return "Recruitment workflow feature activation matrix has no matching advisory modules";
  }

  const activatedCount = matrixRows.filter(
    (row) => row.activationStatus === ACTIVATION_STATUS.ACTIVATED
  ).length;
  const plannedCount = matrixRows.filter(
    (row) => row.activationStatus === ACTIVATION_STATUS.PLANNED
  ).length;
  const unknownCount = matrixRows.filter(
    (row) => row.activationStatus === ACTIVATION_STATUS.UNKNOWN
  ).length;

  if (unknownCount === matrixRows.length) {
    return `Recruitment workflow feature activation matrix defines ${matrixRows.length} advisory modules awaiting rollout signals`;
  }

  return `Recruitment workflow feature activation matrix maps ${matrixRows.length} advisory modules with ${activatedCount} activated and ${plannedCount} planned`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildMatrixResult(params) {
  return deepFreeze({
    activationMatrix: Object.freeze(params.activationMatrix.slice()),
    activatedModuleCount: params.activatedModuleCount,
    plannedModuleCount: params.plannedModuleCount,
    matrixSummary: params.matrixSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_135",
      phase: RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      activationMatrixOnly: true
    })
  });
}

/**
 * Create recruitment workflow feature activation matrix.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowFeatureActivationMatrix(input) {
  if (!isRecognizedMatrixInput(input)) {
    const staticRows = ACTIVATION_MATRIX_DEFINITIONS.map((definition) =>
      deepFreeze({
        moduleId: definition.moduleId,
        phase: definition.phase,
        rolloutStageId: definition.rolloutStageId,
        activationMode: definition.activationMode,
        activationStatus: ACTIVATION_STATUS.UNKNOWN
      })
    );

    return buildMatrixResult({
      activationMatrix: staticRows,
      activatedModuleCount: 0,
      plannedModuleCount: 0,
      matrixSummary: buildMatrixSummary(staticRows)
    });
  }

  const activatedModuleIds = deriveActivatedModuleIds(input);
  const activationMatrix = buildActivationMatrixRows(input, activatedModuleIds);
  const activatedModuleCount = activationMatrix.filter(
    (row) => row.activationStatus === ACTIVATION_STATUS.ACTIVATED
  ).length;
  const plannedModuleCount = activationMatrix.filter(
    (row) => row.activationStatus === ACTIVATION_STATUS.PLANNED
  ).length;

  return buildMatrixResult({
    activationMatrix,
    activatedModuleCount,
    plannedModuleCount,
    matrixSummary: buildMatrixSummary(activationMatrix)
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_PHASE,
  RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_ENTITY,
  ACTIVATION_STATUS,
  ACTIVATION_MODE,
  ROLLOUT_STAGE_IDS,
  ADVISORY_MODULE_IDS,
  ACTIVATION_MATRIX_DEFINITIONS,
  RECRUITMENT_WORKFLOW_FEATURE_ACTIVATION_MATRIX_METADATA,
  createRecruitmentWorkflowFeatureActivationMatrix
};
