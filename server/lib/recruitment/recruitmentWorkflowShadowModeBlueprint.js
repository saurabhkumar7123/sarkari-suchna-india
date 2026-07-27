"use strict";

/**
 * Phase 140 — Recruitment Workflow Shadow Mode Blueprint (Advisory Only).
 *
 * Pure descriptive shadow mode blueprint for future read-only runtime observation
 * during recruitment workflow adoption. Shadow mode never executes writes.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_PHASE = 140;

const RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_ENTITY =
  "recruitment_workflow_shadow_mode_blueprint";

const SHADOW_SCHEMA_VERSION = "1.0.0";

const SHADOW_MODE_POSTURE = Object.freeze({
  SHADOW_DEFINED: "SHADOW_DEFINED",
  SHADOW_PARTIAL: "SHADOW_PARTIAL",
  SHADOW_BLOCKED: "SHADOW_BLOCKED",
  SHADOW_UNKNOWN: "SHADOW_UNKNOWN"
});

const SHADOW_OBSERVATION_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  OBSERVATION_ONLY: "OBSERVATION_ONLY",
  COMPARISON_READY: "COMPARISON_READY",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const SHADOW_MODE_PHASE_IDS = Object.freeze({
  DRAFT_PIPELINE_SHADOW: "DRAFT_PIPELINE_SHADOW",
  STORAGE_BOUNDARY_SHADOW: "STORAGE_BOUNDARY_SHADOW",
  ORCHESTRATION_SHADOW: "ORCHESTRATION_SHADOW",
  ADVISORY_GATEWAY_SHADOW: "ADVISORY_GATEWAY_SHADOW",
  READINESS_ASSESSMENT_SHADOW: "READINESS_ASSESSMENT_SHADOW",
  SIMULATION_SHADOW: "SIMULATION_SHADOW",
  GOVERNANCE_SHADOW: "GOVERNANCE_SHADOW",
  CONTRACT_BOUNDARY_SHADOW: "CONTRACT_BOUNDARY_SHADOW"
});

const SHADOW_MODE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.DRAFT_PIPELINE_SHADOW,
    label: "Draft pipeline shadow observation",
    sourcePhases: Object.freeze([114, 115, 116, 117]),
    observationType: "READ_ONLY_COMPARISON",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.STORAGE_BOUNDARY_SHADOW,
    label: "Storage boundary shadow observation",
    sourcePhases: Object.freeze([118, 119]),
    observationType: "BOUNDARY_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.ORCHESTRATION_SHADOW,
    label: "Orchestration shadow observation",
    sourcePhases: Object.freeze([120]),
    observationType: "COORDINATION_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.ADVISORY_GATEWAY_SHADOW,
    label: "Advisory gateway shadow observation",
    sourcePhases: Object.freeze([113]),
    observationType: "GATEWAY_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.READINESS_ASSESSMENT_SHADOW,
    label: "Readiness assessment shadow observation",
    sourcePhases: Object.freeze([123, 134]),
    observationType: "READINESS_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.SIMULATION_SHADOW,
    label: "Simulation shadow observation",
    sourcePhases: Object.freeze([137]),
    observationType: "SIMULATION_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.GOVERNANCE_SHADOW,
    label: "Governance shadow observation",
    sourcePhases: Object.freeze([136]),
    observationType: "GOVERNANCE_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  }),
  Object.freeze({
    id: SHADOW_MODE_PHASE_IDS.CONTRACT_BOUNDARY_SHADOW,
    label: "Contract boundary shadow observation",
    sourcePhases: Object.freeze([138]),
    observationType: "CONTRACT_OBSERVATION_ONLY",
    writeExecutionPermitted: false
  })
]);

const RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_PHASE,
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
  shadowModeBlueprintOnly: true,
  writeExecutionPermitted: false,
  writeExecutionEnabled: false,
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
function isRecognizedShadowModeInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.includedShadowPhaseIds != null && !Array.isArray(input.includedShadowPhaseIds)) {
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
 * @returns {Readonly<Array>}
 */
function resolveIncludedShadowPhases(input) {
  if (!Array.isArray(input.includedShadowPhaseIds) || input.includedShadowPhaseIds.length === 0) {
    return SHADOW_MODE_DEFINITIONS;
  }

  const requested = new Set(input.includedShadowPhaseIds);
  return SHADOW_MODE_DEFINITIONS.filter((phase) => requested.has(phase.id));
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} shadowPhase
 * @returns {string}
 */
function resolveShadowObservationStatus(input, shadowPhase) {
  const shadowSignals = isPlainObject(input.shadowSignals) ? input.shadowSignals : {};
  const signal = shadowSignals[shadowPhase.id];

  if (signal === "BLOCKED") {
    return SHADOW_OBSERVATION_STATUS.BLOCKED;
  }
  if (signal === "COMPARISON_READY") {
    return SHADOW_OBSERVATION_STATUS.COMPARISON_READY;
  }
  if (signal === "OBSERVATION_ONLY") {
    return SHADOW_OBSERVATION_STATUS.OBSERVATION_ONLY;
  }
  if (signal === "PLANNED") {
    return SHADOW_OBSERVATION_STATUS.PLANNED;
  }

  return SHADOW_OBSERVATION_STATUS.PLANNED;
}

/**
 * @param {Readonly<Array>} shadowEvaluations
 * @returns {string}
 */
function resolveShadowModePosture(shadowEvaluations) {
  if (shadowEvaluations.length === 0) {
    return SHADOW_MODE_POSTURE.SHADOW_UNKNOWN;
  }

  const hasBlocked = shadowEvaluations.some(
    (phase) => phase.observationStatus === SHADOW_OBSERVATION_STATUS.BLOCKED
  );
  if (hasBlocked) {
    return SHADOW_MODE_POSTURE.SHADOW_BLOCKED;
  }

  if (shadowEvaluations.length < SHADOW_MODE_DEFINITIONS.length) {
    return SHADOW_MODE_POSTURE.SHADOW_PARTIAL;
  }

  return SHADOW_MODE_POSTURE.SHADOW_DEFINED;
}

/**
 * @param {string} posture
 * @returns {string}
 */
function buildShadowModeSummary(posture) {
  if (posture === SHADOW_MODE_POSTURE.SHADOW_DEFINED) {
    return "Recruitment workflow shadow mode blueprint defined for read-only advisory observation";
  }
  if (posture === SHADOW_MODE_POSTURE.SHADOW_PARTIAL) {
    return "Recruitment workflow shadow mode blueprint partially defined";
  }
  if (posture === SHADOW_MODE_POSTURE.SHADOW_BLOCKED) {
    return "Recruitment workflow shadow mode blueprint blocked by advisory signals";
  }
  return "Recruitment workflow shadow mode blueprint could not be determined";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildShadowModeResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    schemaVersion: SHADOW_SCHEMA_VERSION,
    shadowModePosture: params.shadowModePosture,
    shadowModeSummary: params.shadowModeSummary,
    shadowPhaseCount: params.shadowEvaluations.length,
    shadowPhaseEvaluations: Object.freeze(params.shadowEvaluations.slice()),
    writeExecutionPermitted: false,
    writeExecutionEnabled: false,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_140",
      phase: RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_PHASE,
      shadowModeBlueprintOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      writeExecutionPermitted: false,
      writeExecutionEnabled: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowShadowModeBlueprint(input) {
  if (input != null && typeof input === "object" && !isRecognizedShadowModeInput(input)) {
    return buildShadowModeResult({
      recruitmentId: null,
      shadowModePosture: SHADOW_MODE_POSTURE.SHADOW_UNKNOWN,
      shadowModeSummary: buildShadowModeSummary(SHADOW_MODE_POSTURE.SHADOW_UNKNOWN),
      shadowEvaluations: []
    });
  }

  const safeInput = isPlainObject(input) ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const includedPhases = resolveIncludedShadowPhases(safeInput);

  const shadowEvaluations = includedPhases.map((shadowPhase) =>
    deepFreeze({
      shadowPhaseId: shadowPhase.id,
      label: shadowPhase.label,
      sourcePhases: shadowPhase.sourcePhases,
      observationType: shadowPhase.observationType,
      observationStatus: resolveShadowObservationStatus(safeInput, shadowPhase),
      writeExecutionPermitted: false,
      writeExecutionEnabled: false
    })
  );

  const shadowModePosture = resolveShadowModePosture(shadowEvaluations);
  const shadowModeSummary = buildShadowModeSummary(shadowModePosture);

  return buildShadowModeResult({
    recruitmentId,
    shadowModePosture,
    shadowModeSummary,
    shadowEvaluations
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_PHASE,
  RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_ENTITY,
  SHADOW_SCHEMA_VERSION,
  SHADOW_MODE_POSTURE,
  SHADOW_OBSERVATION_STATUS,
  SHADOW_MODE_PHASE_IDS,
  SHADOW_MODE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_SHADOW_MODE_BLUEPRINT_METADATA,
  createRecruitmentWorkflowShadowModeBlueprint
};
