"use strict";

/**
 * Phase 140 — Recruitment Workflow Runtime Adoption Blueprint (Advisory Only).
 *
 * Pure advisory blueprint describing how the recruitment workflow architecture
 * spanning Phases 114–139 can eventually be adopted into runtime safely.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_PHASE = 140;

const RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_ENTITY =
  "recruitment_workflow_runtime_adoption_blueprint";

const BLUEPRINT_SCHEMA_VERSION = "1.0.0";

const ADOPTION_POSTURE = Object.freeze({
  ADOPTION_ROADMAP_DEFINED: "ADOPTION_ROADMAP_DEFINED",
  ADOPTION_ROADMAP_PARTIAL: "ADOPTION_ROADMAP_PARTIAL",
  ADOPTION_ROADMAP_BLOCKED: "ADOPTION_ROADMAP_BLOCKED",
  ADOPTION_ROADMAP_UNKNOWN: "ADOPTION_ROADMAP_UNKNOWN"
});

const ADOPTION_ROADMAP_STAGE_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PLANNED: "PLANNED",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  BLOCKED: "BLOCKED",
  DEFERRED: "DEFERRED",
  UNKNOWN: "UNKNOWN"
});

const ADOPTION_ROADMAP_STAGE_IDS = Object.freeze({
  ARCHITECTURE_BLUEPRINT_REVIEW: "ARCHITECTURE_BLUEPRINT_REVIEW",
  RUNTIME_MAPPING_REVIEW: "RUNTIME_MAPPING_REVIEW",
  FEATURE_FLAG_PLANNING: "FEATURE_FLAG_PLANNING",
  SHADOW_MODE_PLANNING: "SHADOW_MODE_PLANNING",
  READINESS_GATE_EVALUATION: "READINESS_GATE_EVALUATION",
  CONTROLLED_COUPLING_PLANNING: "CONTROLLED_COUPLING_PLANNING",
  PRODUCTION_ADOPTION_REVIEW: "PRODUCTION_ADOPTION_REVIEW"
});

const ADOPTION_ROADMAP_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.ARCHITECTURE_BLUEPRINT_REVIEW,
    order: 1,
    label: "Architecture Blueprint Review",
    sourcePhases: Object.freeze([139]),
    prerequisiteStageIds: Object.freeze([]),
    advisoryPurpose: "Review Phase 139 architecture blueprint advisory outputs before runtime adoption planning"
  }),
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.RUNTIME_MAPPING_REVIEW,
    order: 2,
    label: "Future Runtime Mapping Review",
    sourcePhases: Object.freeze([139]),
    prerequisiteStageIds: Object.freeze([ADOPTION_ROADMAP_STAGE_IDS.ARCHITECTURE_BLUEPRINT_REVIEW]),
    advisoryPurpose: "Validate future runtime zone mapping advisory posture before coupling planning"
  }),
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.FEATURE_FLAG_PLANNING,
    order: 3,
    label: "Feature Flag Strategy Planning",
    sourcePhases: Object.freeze([140]),
    prerequisiteStageIds: Object.freeze([ADOPTION_ROADMAP_STAGE_IDS.RUNTIME_MAPPING_REVIEW]),
    advisoryPurpose: "Define descriptive feature flag rollout strategy without runtime flag execution"
  }),
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.SHADOW_MODE_PLANNING,
    order: 4,
    label: "Shadow Mode Observation Planning",
    sourcePhases: Object.freeze([140]),
    prerequisiteStageIds: Object.freeze([ADOPTION_ROADMAP_STAGE_IDS.FEATURE_FLAG_PLANNING]),
    advisoryPurpose: "Plan read-only shadow observation without write execution"
  }),
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.READINESS_GATE_EVALUATION,
    order: 5,
    label: "Runtime Readiness Gate Evaluation",
    sourcePhases: Object.freeze([140]),
    prerequisiteStageIds: Object.freeze([ADOPTION_ROADMAP_STAGE_IDS.SHADOW_MODE_PLANNING]),
    advisoryPurpose: "Evaluate advisory readiness signals before controlled runtime coupling"
  }),
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.CONTROLLED_COUPLING_PLANNING,
    order: 6,
    label: "Controlled Runtime Coupling Planning",
    sourcePhases: Object.freeze([134, 135, 136, 137, 138]),
    prerequisiteStageIds: Object.freeze([ADOPTION_ROADMAP_STAGE_IDS.READINESS_GATE_EVALUATION]),
    advisoryPurpose: "Plan controlled advisory-to-runtime coupling boundaries without wiring"
  }),
  Object.freeze({
    id: ADOPTION_ROADMAP_STAGE_IDS.PRODUCTION_ADOPTION_REVIEW,
    order: 7,
    label: "Production Adoption Review",
    sourcePhases: Object.freeze([140]),
    prerequisiteStageIds: Object.freeze([ADOPTION_ROADMAP_STAGE_IDS.CONTROLLED_COUPLING_PLANNING]),
    advisoryPurpose: "Final advisory review before any future production adoption decision"
  })
]);

const RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_PHASE,
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
  runtimeAdoptionBlueprintOnly: true,
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
function isRecognizedAdoptionBlueprintInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.includedStageIds != null && !Array.isArray(input.includedStageIds)) {
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
function resolveIncludedStages(input) {
  if (!Array.isArray(input.includedStageIds) || input.includedStageIds.length === 0) {
    return ADOPTION_ROADMAP_STAGE_DEFINITIONS;
  }

  const requested = new Set(input.includedStageIds);
  return ADOPTION_ROADMAP_STAGE_DEFINITIONS.filter((stage) => requested.has(stage.id));
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} stage
 * @returns {string}
 */
function resolveStageStatus(input, stage) {
  const architectureSummary = isPlainObject(input.architectureSummary) ? input.architectureSummary : {};
  const futureRuntimeMapping = isPlainObject(input.futureRuntimeMapping) ? input.futureRuntimeMapping : {};
  const readinessGate = isPlainObject(input.readinessGate) ? input.readinessGate : {};
  const governanceCompliance = isPlainObject(input.governanceCompliance) ? input.governanceCompliance : {};

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.ARCHITECTURE_BLUEPRINT_REVIEW) {
    if (architectureSummary.summaryPosture === "ARCHITECTURE_READY") {
      return ADOPTION_ROADMAP_STAGE_STATUS.READY_FOR_REVIEW;
    }
    if (architectureSummary.summaryPosture === "ARCHITECTURE_BLOCKED") {
      return ADOPTION_ROADMAP_STAGE_STATUS.BLOCKED;
    }
    if (architectureSummary.summaryPosture != null) {
      return ADOPTION_ROADMAP_STAGE_STATUS.PLANNED;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.RUNTIME_MAPPING_REVIEW) {
    if (futureRuntimeMapping.mappingPosture === "MAPPING_DEFINED") {
      return ADOPTION_ROADMAP_STAGE_STATUS.READY_FOR_REVIEW;
    }
    if (futureRuntimeMapping.mappingPosture === "MAPPING_PARTIAL") {
      return ADOPTION_ROADMAP_STAGE_STATUS.PLANNED;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.FEATURE_FLAG_PLANNING) {
    if (input.featureFlagStrategy != null) {
      return ADOPTION_ROADMAP_STAGE_STATUS.PLANNED;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.SHADOW_MODE_PLANNING) {
    if (input.shadowModeBlueprint != null) {
      return ADOPTION_ROADMAP_STAGE_STATUS.PLANNED;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.READINESS_GATE_EVALUATION) {
    if (readinessGate.gateStatus === "GATE_OPEN") {
      return ADOPTION_ROADMAP_STAGE_STATUS.READY_FOR_REVIEW;
    }
    if (readinessGate.gateStatus === "GATE_CONDITIONAL") {
      return ADOPTION_ROADMAP_STAGE_STATUS.PLANNED;
    }
    if (readinessGate.gateStatus === "GATE_CLOSED") {
      return ADOPTION_ROADMAP_STAGE_STATUS.BLOCKED;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.CONTROLLED_COUPLING_PLANNING) {
    if (governanceCompliance.governancePosture === "COMPLIANT") {
      return ADOPTION_ROADMAP_STAGE_STATUS.PLANNED;
    }
    if (governanceCompliance.governancePosture === "NON_COMPLIANT") {
      return ADOPTION_ROADMAP_STAGE_STATUS.BLOCKED;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  if (stage.id === ADOPTION_ROADMAP_STAGE_IDS.PRODUCTION_ADOPTION_REVIEW) {
    if (input.productionAdoptionPlaybook != null && readinessGate.gateStatus === "GATE_OPEN") {
      return ADOPTION_ROADMAP_STAGE_STATUS.READY_FOR_REVIEW;
    }
    return ADOPTION_ROADMAP_STAGE_STATUS.NOT_STARTED;
  }

  return ADOPTION_ROADMAP_STAGE_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Array>} stageEvaluations
 * @returns {string}
 */
function resolveAdoptionPosture(stageEvaluations) {
  if (stageEvaluations.length === 0) {
    return ADOPTION_POSTURE.ADOPTION_ROADMAP_UNKNOWN;
  }

  const hasBlocked = stageEvaluations.some(
    (stage) => stage.stageStatus === ADOPTION_ROADMAP_STAGE_STATUS.BLOCKED
  );
  if (hasBlocked) {
    return ADOPTION_POSTURE.ADOPTION_ROADMAP_BLOCKED;
  }

  if (stageEvaluations.length < ADOPTION_ROADMAP_STAGE_DEFINITIONS.length) {
    return ADOPTION_POSTURE.ADOPTION_ROADMAP_PARTIAL;
  }

  const allNotBlocked = stageEvaluations.every(
    (stage) => stage.stageStatus !== ADOPTION_ROADMAP_STAGE_STATUS.BLOCKED
  );

  if (allNotBlocked && stageEvaluations.length === ADOPTION_ROADMAP_STAGE_DEFINITIONS.length) {
    return ADOPTION_POSTURE.ADOPTION_ROADMAP_DEFINED;
  }

  return ADOPTION_POSTURE.ADOPTION_ROADMAP_PARTIAL;
}

/**
 * @param {string} adoptionPosture
 * @returns {string}
 */
function buildAdoptionBlueprintSummary(adoptionPosture) {
  if (adoptionPosture === ADOPTION_POSTURE.ADOPTION_ROADMAP_DEFINED) {
    return "Recruitment workflow runtime adoption blueprint defined for advisory review";
  }
  if (adoptionPosture === ADOPTION_POSTURE.ADOPTION_ROADMAP_PARTIAL) {
    return "Recruitment workflow runtime adoption blueprint partially defined";
  }
  if (adoptionPosture === ADOPTION_POSTURE.ADOPTION_ROADMAP_BLOCKED) {
    return "Recruitment workflow runtime adoption blueprint blocked by advisory signals";
  }
  if (adoptionPosture === ADOPTION_POSTURE.ADOPTION_ROADMAP_UNKNOWN) {
    return "Recruitment workflow runtime adoption blueprint could not be determined";
  }
  return "Recruitment workflow runtime adoption blueprint requires advisory review";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildAdoptionBlueprintResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    adoptionPosture: params.adoptionPosture,
    adoptionBlueprintSummary: params.adoptionBlueprintSummary,
    stageCount: params.stageEvaluations.length,
    roadmapStageEvaluations: Object.freeze(params.stageEvaluations.slice()),
    phaseCoverage: deepFreeze({
      minPhase: 114,
      maxPhase: 139,
      adoptionPlanningPhase: 140
    }),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_140",
      phase: RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_PHASE,
      runtimeAdoptionBlueprintOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      runtimeWiringEnabled: false,
      schedulerEnabled: false,
      workerEnabled: false
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowRuntimeAdoptionBlueprint(input) {
  if (input != null && typeof input === "object" && !isRecognizedAdoptionBlueprintInput(input)) {
    return buildAdoptionBlueprintResult({
      recruitmentId: null,
      adoptionPosture: ADOPTION_POSTURE.ADOPTION_ROADMAP_UNKNOWN,
      adoptionBlueprintSummary: buildAdoptionBlueprintSummary(ADOPTION_POSTURE.ADOPTION_ROADMAP_UNKNOWN),
      stageEvaluations: []
    });
  }

  const safeInput = isPlainObject(input) ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const includedStages = resolveIncludedStages(safeInput);

  const stageEvaluations = includedStages.map((stage) =>
    deepFreeze({
      stageId: stage.id,
      order: stage.order,
      label: stage.label,
      stageStatus: resolveStageStatus(safeInput, stage),
      sourcePhases: stage.sourcePhases,
      advisoryPurpose: stage.advisoryPurpose
    })
  );

  const adoptionPosture = resolveAdoptionPosture(stageEvaluations);
  const adoptionBlueprintSummary = buildAdoptionBlueprintSummary(adoptionPosture);

  return buildAdoptionBlueprintResult({
    recruitmentId,
    adoptionPosture,
    adoptionBlueprintSummary,
    stageEvaluations
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function getRecruitmentWorkflowRuntimeAdoptionBlueprint(input) {
  return createRecruitmentWorkflowRuntimeAdoptionBlueprint(input);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowRuntimeAdoptionBlueprint(value) {
  return (
    isPlainObject(value) &&
    value.adoptionPosture != null &&
    Array.isArray(value.roadmapStageEvaluations) &&
    value.advisoryMetadata != null &&
    value.advisoryMetadata.runtimeAdoptionBlueprintOnly === true
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_ENTITY,
  BLUEPRINT_SCHEMA_VERSION,
  ADOPTION_POSTURE,
  ADOPTION_ROADMAP_STAGE_STATUS,
  ADOPTION_ROADMAP_STAGE_IDS,
  ADOPTION_ROADMAP_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_ADOPTION_BLUEPRINT_METADATA,
  createRecruitmentWorkflowRuntimeAdoptionBlueprint,
  getRecruitmentWorkflowRuntimeAdoptionBlueprint,
  isRecruitmentWorkflowRuntimeAdoptionBlueprint
};
