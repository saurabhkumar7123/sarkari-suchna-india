"use strict";

/**
 * Phase 140 — Recruitment Workflow Feature Flag Strategy (Advisory Only).
 *
 * Pure descriptive feature flag strategy for future controlled runtime adoption
 * of the recruitment workflow architecture. No flag execution, no runtime imports,
 * no persistence, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_PHASE = 140;

const RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_ENTITY =
  "recruitment_workflow_feature_flag_strategy";

const STRATEGY_SCHEMA_VERSION = "1.0.0";

const FLAG_STRATEGY_POSTURE = Object.freeze({
  STRATEGY_DEFINED: "STRATEGY_DEFINED",
  STRATEGY_PARTIAL: "STRATEGY_PARTIAL",
  STRATEGY_BLOCKED: "STRATEGY_BLOCKED",
  STRATEGY_UNKNOWN: "STRATEGY_UNKNOWN"
});

const FLAG_ROLLOUT_PHASE = Object.freeze({
  DISABLED: "DISABLED",
  INTERNAL_OBSERVATION: "INTERNAL_OBSERVATION",
  SHADOW_COMPARISON: "SHADOW_COMPARISON",
  LIMITED_CANARY: "LIMITED_CANARY",
  CONTROLLED_ROLLOUT: "CONTROLLED_ROLLOUT",
  FULL_ADOPTION: "FULL_ADOPTION"
});

const FLAG_ACTIVATION_STATUS = Object.freeze({
  DESCRIPTIVE_ONLY: "DESCRIPTIVE_ONLY",
  PLANNED: "PLANNED",
  DEFERRED: "DEFERRED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const FEATURE_FLAG_IDS = Object.freeze({
  ADVISORY_GATEWAY_OBSERVATION: "ADVISORY_GATEWAY_OBSERVATION",
  DRAFT_PIPELINE_SHADOW: "DRAFT_PIPELINE_SHADOW",
  ORCHESTRATION_SHADOW: "ORCHESTRATION_SHADOW",
  READINESS_GATE_PREVIEW: "READINESS_GATE_PREVIEW",
  SIMULATION_DRY_RUN_PREVIEW: "SIMULATION_DRY_RUN_PREVIEW",
  INTEGRATION_CONTRACT_PREVIEW: "INTEGRATION_CONTRACT_PREVIEW",
  GOVERNANCE_COMPLIANCE_PREVIEW: "GOVERNANCE_COMPLIANCE_PREVIEW",
  RUNTIME_COUPLING_CANARY: "RUNTIME_COUPLING_CANARY"
});

const FEATURE_FLAG_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: FEATURE_FLAG_IDS.ADVISORY_GATEWAY_OBSERVATION,
    label: "Advisory gateway observation flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.INTERNAL_OBSERVATION,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe observation-only advisory gateway coupling without runtime activation"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.DRAFT_PIPELINE_SHADOW,
    label: "Draft pipeline shadow comparison flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.SHADOW_COMPARISON,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe shadow comparison for draft pipeline advisory outputs"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.ORCHESTRATION_SHADOW,
    label: "Orchestration shadow comparison flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.SHADOW_COMPARISON,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe shadow orchestration observation without workflow mutation"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.READINESS_GATE_PREVIEW,
    label: "Readiness gate preview flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.INTERNAL_OBSERVATION,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe advisory readiness gate preview without gate execution"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.SIMULATION_DRY_RUN_PREVIEW,
    label: "Simulation dry-run preview flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.INTERNAL_OBSERVATION,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe simulation preview without dry-run execution"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.INTEGRATION_CONTRACT_PREVIEW,
    label: "Integration contract preview flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.LIMITED_CANARY,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe contract boundary preview without runtime contract wiring"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.GOVERNANCE_COMPLIANCE_PREVIEW,
    label: "Governance compliance preview flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.LIMITED_CANARY,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe governance compliance preview without enforcement"
  }),
  Object.freeze({
    id: FEATURE_FLAG_IDS.RUNTIME_COUPLING_CANARY,
    label: "Runtime coupling canary flag",
    rolloutPhase: FLAG_ROLLOUT_PHASE.CONTROLLED_ROLLOUT,
    defaultState: FLAG_ROLLOUT_PHASE.DISABLED,
    writePermitted: false,
    descriptivePurpose: "Describe controlled runtime coupling canary without production mutation"
  })
]);

const RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_PHASE,
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
  featureFlagStrategyOnly: true,
  flagExecutionEnabled: false,
  flagToggleEnabled: false,
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
function isRecognizedFeatureFlagStrategyInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.includedFlagIds != null && !Array.isArray(input.includedFlagIds)) {
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
function resolveIncludedFlags(input) {
  if (!Array.isArray(input.includedFlagIds) || input.includedFlagIds.length === 0) {
    return FEATURE_FLAG_DEFINITIONS;
  }

  const requested = new Set(input.includedFlagIds);
  return FEATURE_FLAG_DEFINITIONS.filter((flag) => requested.has(flag.id));
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} flag
 * @returns {string}
 */
function resolveFlagActivationStatus(input, flag) {
  const flagSignals = isPlainObject(input.flagSignals) ? input.flagSignals : {};
  const signal = flagSignals[flag.id];

  if (signal === "BLOCKED") {
    return FLAG_ACTIVATION_STATUS.BLOCKED;
  }
  if (signal === "DEFERRED") {
    return FLAG_ACTIVATION_STATUS.DEFERRED;
  }
  if (signal === "PLANNED") {
    return FLAG_ACTIVATION_STATUS.PLANNED;
  }

  return FLAG_ACTIVATION_STATUS.DESCRIPTIVE_ONLY;
}

/**
 * @param {Readonly<Array>} flagEvaluations
 * @returns {string}
 */
function resolveFlagStrategyPosture(flagEvaluations) {
  if (flagEvaluations.length === 0) {
    return FLAG_STRATEGY_POSTURE.STRATEGY_UNKNOWN;
  }

  const hasBlocked = flagEvaluations.some(
    (flag) => flag.activationStatus === FLAG_ACTIVATION_STATUS.BLOCKED
  );
  if (hasBlocked) {
    return FLAG_STRATEGY_POSTURE.STRATEGY_BLOCKED;
  }

  if (flagEvaluations.length < FEATURE_FLAG_DEFINITIONS.length) {
    return FLAG_STRATEGY_POSTURE.STRATEGY_PARTIAL;
  }

  return FLAG_STRATEGY_POSTURE.STRATEGY_DEFINED;
}

/**
 * @param {string} posture
 * @returns {string}
 */
function buildFeatureFlagStrategySummary(posture) {
  if (posture === FLAG_STRATEGY_POSTURE.STRATEGY_DEFINED) {
    return "Recruitment workflow feature flag strategy defined for descriptive advisory review";
  }
  if (posture === FLAG_STRATEGY_POSTURE.STRATEGY_PARTIAL) {
    return "Recruitment workflow feature flag strategy partially defined";
  }
  if (posture === FLAG_STRATEGY_POSTURE.STRATEGY_BLOCKED) {
    return "Recruitment workflow feature flag strategy blocked by advisory signals";
  }
  return "Recruitment workflow feature flag strategy could not be determined";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildFeatureFlagStrategyResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    flagStrategyPosture: params.flagStrategyPosture,
    featureFlagStrategySummary: params.featureFlagStrategySummary,
    flagCount: params.flagEvaluations.length,
    flagEvaluations: Object.freeze(params.flagEvaluations.slice()),
    descriptiveOnly: true,
    flagExecutionEnabled: false,
    flagToggleEnabled: false,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_140",
      phase: RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_PHASE,
      featureFlagStrategyOnly: true,
      descriptiveOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      flagExecutionEnabled: false,
      flagToggleEnabled: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowFeatureFlagStrategy(input) {
  if (input != null && typeof input === "object" && !isRecognizedFeatureFlagStrategyInput(input)) {
    return buildFeatureFlagStrategyResult({
      recruitmentId: null,
      flagStrategyPosture: FLAG_STRATEGY_POSTURE.STRATEGY_UNKNOWN,
      featureFlagStrategySummary: buildFeatureFlagStrategySummary(FLAG_STRATEGY_POSTURE.STRATEGY_UNKNOWN),
      flagEvaluations: []
    });
  }

  const safeInput = isPlainObject(input) ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const includedFlags = resolveIncludedFlags(safeInput);

  const flagEvaluations = includedFlags.map((flag) =>
    deepFreeze({
      flagId: flag.id,
      label: flag.label,
      rolloutPhase: flag.rolloutPhase,
      defaultState: flag.defaultState,
      activationStatus: resolveFlagActivationStatus(safeInput, flag),
      writePermitted: false,
      descriptivePurpose: flag.descriptivePurpose,
      descriptiveOnly: true,
      flagExecutionEnabled: false
    })
  );

  const flagStrategyPosture = resolveFlagStrategyPosture(flagEvaluations);
  const featureFlagStrategySummary = buildFeatureFlagStrategySummary(flagStrategyPosture);

  return buildFeatureFlagStrategyResult({
    recruitmentId,
    flagStrategyPosture,
    featureFlagStrategySummary,
    flagEvaluations
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_PHASE,
  RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_ENTITY,
  STRATEGY_SCHEMA_VERSION,
  FLAG_STRATEGY_POSTURE,
  FLAG_ROLLOUT_PHASE,
  FLAG_ACTIVATION_STATUS,
  FEATURE_FLAG_IDS,
  FEATURE_FLAG_DEFINITIONS,
  RECRUITMENT_WORKFLOW_FEATURE_FLAG_STRATEGY_METADATA,
  createRecruitmentWorkflowFeatureFlagStrategy
};
