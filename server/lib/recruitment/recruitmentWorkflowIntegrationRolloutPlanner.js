"use strict";

/**
 * Phase 135 — Recruitment Workflow Integration Rollout Planner (Advisory Only).
 *
 * Pure advisory planner that defines staged rollout for future controlled production
 * integration of the recruitment workflow advisory architecture (Phases 114–134).
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_PHASE = 135;

const RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_ENTITY =
  "recruitment_workflow_integration_rollout_planner";

const ROLLOUT_STAGE_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  READY: "READY",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const INTEGRATION_STATUS = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const ROLLOUT_STAGE_IDS = Object.freeze({
  PLANNING_REVIEW: "PLANNING_REVIEW",
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
  CONTROLLED_INTEGRATION_GATE: "CONTROLLED_INTEGRATION_GATE",
  ACTIVATION_PLANNING: "ACTIVATION_PLANNING"
});

const ROLLOUT_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.PLANNING_REVIEW,
    order: 1,
    label: "Planning Review",
    modulePhases: Object.freeze([]),
    prerequisiteStageIds: Object.freeze([])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.FOUNDATIONAL_PIPELINE,
    order: 2,
    label: "Foundational Draft Pipeline",
    modulePhases: Object.freeze([114, 115, 116, 117]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.PLANNING_REVIEW])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.STORAGE_BOUNDARY,
    order: 3,
    label: "Storage Boundary",
    modulePhases: Object.freeze([118, 119]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.FOUNDATIONAL_PIPELINE])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.ORCHESTRATION_BOUNDARY,
    order: 4,
    label: "Orchestration Boundary",
    modulePhases: Object.freeze([120]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.STORAGE_BOUNDARY])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.TRACE_AND_REGISTRY,
    order: 5,
    label: "Trace and Registry",
    modulePhases: Object.freeze([121, 122]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.ORCHESTRATION_BOUNDARY])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.READINESS_AND_REPORTING,
    order: 6,
    label: "Readiness and Reporting",
    modulePhases: Object.freeze([123, 124]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.TRACE_AND_REGISTRY])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.SNAPSHOT_ANALYSIS,
    order: 7,
    label: "Snapshot Analysis",
    modulePhases: Object.freeze([125, 126, 127]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.READINESS_AND_REPORTING])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.HEALTH_AND_RISK,
    order: 8,
    label: "Health and Risk",
    modulePhases: Object.freeze([128, 129]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.SNAPSHOT_ANALYSIS])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.INTELLIGENCE_AGGREGATION,
    order: 9,
    label: "Intelligence Aggregation",
    modulePhases: Object.freeze([130]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.HEALTH_AND_RISK])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.RECOMMENDATION_AND_TIMELINE,
    order: 10,
    label: "Recommendation and Timeline",
    modulePhases: Object.freeze([131, 132]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.INTELLIGENCE_AGGREGATION])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.CONSISTENCY_VALIDATION,
    order: 11,
    label: "Consistency Validation",
    modulePhases: Object.freeze([133]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.RECOMMENDATION_AND_TIMELINE])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.CONTROLLED_INTEGRATION_GATE,
    order: 12,
    label: "Controlled Integration Gate",
    modulePhases: Object.freeze([134]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.CONSISTENCY_VALIDATION])
  }),
  Object.freeze({
    id: ROLLOUT_STAGE_IDS.ACTIVATION_PLANNING,
    order: 13,
    label: "Activation Planning",
    modulePhases: Object.freeze([135]),
    prerequisiteStageIds: Object.freeze([ROLLOUT_STAGE_IDS.CONTROLLED_INTEGRATION_GATE])
  })
]);

const RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_PHASE,
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
  rolloutPlanningOnly: true,
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
function isRecognizedRolloutInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = ["integrationReadiness", "moduleSignals", "capabilities"];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string") {
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
function hasMeaningfulRolloutSignals(input) {
  return (
    input.integrationReadiness != null ||
    input.moduleSignals != null ||
    input.capabilities != null
  );
}

/**
 * @param {*} signal
 * @returns {boolean}
 */
function isModuleSignalSatisfied(signal) {
  if (!isPlainObject(signal)) {
    return false;
  }
  return signal.satisfied === true || signal.ready === true || signal.available === true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Set<number>>}
 */
function deriveSatisfiedPhases(input) {
  const satisfied = new Set();

  if (isPlainObject(input.moduleSignals)) {
    const keys = Object.keys(input.moduleSignals);
    for (let i = 0; i < keys.length; i += 1) {
      const phase = Number(keys[i]);
      if (Number.isInteger(phase) && isModuleSignalSatisfied(input.moduleSignals[keys[i]])) {
        satisfied.add(phase);
      }
    }
  }

  if (isPlainObject(input.capabilities)) {
    const capKeys = Object.keys(input.capabilities);
    for (let i = 0; i < capKeys.length; i += 1) {
      if (isModuleSignalSatisfied(input.capabilities[capKeys[i]])) {
        satisfied.add(114);
        break;
      }
    }
  }

  if (isPlainObject(input.integrationReadiness)) {
    const status = input.integrationReadiness.integrationStatus;
    if (status === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION) {
      for (let phase = 114; phase <= 134; phase += 1) {
        satisfied.add(phase);
      }
    } else if (status === INTEGRATION_STATUS.PARTIALLY_READY) {
      satisfied.add(134);
    }
  }

  return satisfied;
}

/**
 * @param {ReadonlyArray<number>} modulePhases
 * @param {Readonly<Set<number>>} satisfiedPhases
 * @returns {string}
 */
function resolveStageStatusFromPhases(modulePhases, satisfiedPhases) {
  if (modulePhases.length === 0) {
    return ROLLOUT_STAGE_STATUS.READY;
  }

  const satisfiedCount = modulePhases.filter((phase) => satisfiedPhases.has(phase)).length;

  if (satisfiedCount === modulePhases.length) {
    return ROLLOUT_STAGE_STATUS.READY;
  }
  if (satisfiedCount > 0) {
    return ROLLOUT_STAGE_STATUS.IN_PROGRESS;
  }
  return ROLLOUT_STAGE_STATUS.NOT_STARTED;
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Set<number>>} satisfiedPhases
 * @returns {ReadonlyArray<Object>}
 */
function buildRolloutStages(input, satisfiedPhases) {
  const integrationStatus = isPlainObject(input.integrationReadiness)
    ? input.integrationReadiness.integrationStatus
    : null;

  const stageStatusById = new Map();

  for (let i = 0; i < ROLLOUT_STAGE_DEFINITIONS.length; i += 1) {
    const definition = ROLLOUT_STAGE_DEFINITIONS[i];
    let status = resolveStageStatusFromPhases(definition.modulePhases, satisfiedPhases);

    if (
      definition.id === ROLLOUT_STAGE_IDS.CONTROLLED_INTEGRATION_GATE &&
      integrationStatus === INTEGRATION_STATUS.NOT_READY
    ) {
      status = ROLLOUT_STAGE_STATUS.BLOCKED;
    }

    if (
      definition.id === ROLLOUT_STAGE_IDS.ACTIVATION_PLANNING &&
      integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION
    ) {
      status = ROLLOUT_STAGE_STATUS.READY;
    }

    for (let j = 0; j < definition.prerequisiteStageIds.length; j += 1) {
      const prerequisiteId = definition.prerequisiteStageIds[j];
      const prerequisiteStatus = stageStatusById.get(prerequisiteId);
      if (
        prerequisiteStatus != null &&
        prerequisiteStatus !== ROLLOUT_STAGE_STATUS.READY &&
        status === ROLLOUT_STAGE_STATUS.READY
      ) {
        status = ROLLOUT_STAGE_STATUS.IN_PROGRESS;
      }
    }

    stageStatusById.set(definition.id, status);

    deepFreeze({
      id: definition.id,
      order: definition.order,
      label: definition.label,
      modulePhases: Object.freeze(definition.modulePhases.slice()),
      prerequisiteStageIds: Object.freeze(definition.prerequisiteStageIds.slice()),
      status
    });
  }

  return ROLLOUT_STAGE_DEFINITIONS.map((definition) => {
    const status = stageStatusById.get(definition.id) || ROLLOUT_STAGE_STATUS.UNKNOWN;
    return deepFreeze({
      id: definition.id,
      order: definition.order,
      label: definition.label,
      modulePhases: Object.freeze(definition.modulePhases.slice()),
      prerequisiteStageIds: Object.freeze(definition.prerequisiteStageIds.slice()),
      status
    });
  });
}

/**
 * @param {ReadonlyArray<Object>} rolloutStages
 * @returns {string|null}
 */
function resolveCurrentRolloutStage(rolloutStages) {
  let currentStage = ROLLOUT_STAGE_IDS.PLANNING_REVIEW;

  for (let i = 0; i < rolloutStages.length; i += 1) {
    const stage = rolloutStages[i];
    if (stage.status === ROLLOUT_STAGE_STATUS.READY) {
      currentStage = stage.id;
    } else if (
      stage.status === ROLLOUT_STAGE_STATUS.IN_PROGRESS ||
      stage.status === ROLLOUT_STAGE_STATUS.BLOCKED
    ) {
      return stage.id;
    }
  }

  return currentStage;
}

/**
 * @param {ReadonlyArray<Object>} rolloutStages
 * @param {string|null} currentStageId
 * @returns {string|null}
 */
function resolveRecommendedNextStage(rolloutStages, currentStageId) {
  if (currentStageId == null) {
    return ROLLOUT_STAGE_IDS.PLANNING_REVIEW;
  }

  const currentIndex = rolloutStages.findIndex((stage) => stage.id === currentStageId);
  if (currentIndex < 0) {
    return null;
  }

  const current = rolloutStages[currentIndex];
  if (current.status === ROLLOUT_STAGE_STATUS.IN_PROGRESS) {
    return current.id;
  }

  if (currentIndex + 1 < rolloutStages.length) {
    return rolloutStages[currentIndex + 1].id;
  }

  return null;
}

/**
 * @param {ReadonlyArray<Object>} rolloutStages
 * @param {string|null} currentStageId
 * @param {string|null} recommendedNextStageId
 * @returns {string}
 */
function buildRolloutSummary(rolloutStages, currentStageId, recommendedNextStageId) {
  if (rolloutStages.length === 0) {
    return "Recruitment workflow integration rollout plan could not be determined from supplied signals";
  }

  const readyCount = rolloutStages.filter(
    (stage) => stage.status === ROLLOUT_STAGE_STATUS.READY
  ).length;

  if (readyCount === rolloutStages.length) {
    return `Recruitment workflow integration rollout is fully planned with all ${rolloutStages.length} stages ready for advisory review`;
  }

  const current = rolloutStages.find((stage) => stage.id === currentStageId);
  const currentLabel = current != null ? current.label : "unknown stage";

  if (recommendedNextStageId != null && recommendedNextStageId !== currentStageId) {
    const next = rolloutStages.find((stage) => stage.id === recommendedNextStageId);
    const nextLabel = next != null ? next.label : recommendedNextStageId;
    return `Recruitment workflow integration rollout is at ${currentLabel} with ${readyCount} of ${rolloutStages.length} stages ready; next advisory stage is ${nextLabel}`;
  }

  return `Recruitment workflow integration rollout is at ${currentLabel} with ${readyCount} of ${rolloutStages.length} stages ready`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildRolloutPlanResult(params) {
  return deepFreeze({
    rolloutStages: Object.freeze(params.rolloutStages.slice()),
    currentStageId: params.currentStageId,
    recommendedNextStageId: params.recommendedNextStageId,
    rolloutSummary: params.rolloutSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_135",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      rolloutPlanningOnly: true
    })
  });
}

/**
 * Create recruitment workflow integration rollout plan.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationRolloutPlan(input) {
  if (!isRecognizedRolloutInput(input) || !hasMeaningfulRolloutSignals(input)) {
    const staticStages = ROLLOUT_STAGE_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        order: definition.order,
        label: definition.label,
        modulePhases: Object.freeze(definition.modulePhases.slice()),
        prerequisiteStageIds: Object.freeze(definition.prerequisiteStageIds.slice()),
        status: ROLLOUT_STAGE_STATUS.UNKNOWN
      })
    );

    return buildRolloutPlanResult({
      rolloutStages: staticStages,
      currentStageId: null,
      recommendedNextStageId: ROLLOUT_STAGE_IDS.PLANNING_REVIEW,
      rolloutSummary: buildRolloutSummary(staticStages, null, ROLLOUT_STAGE_IDS.PLANNING_REVIEW)
    });
  }

  const satisfiedPhases = deriveSatisfiedPhases(input);
  const rolloutStages = buildRolloutStages(input, satisfiedPhases);
  const currentStageId = resolveCurrentRolloutStage(rolloutStages);
  const recommendedNextStageId = resolveRecommendedNextStage(rolloutStages, currentStageId);
  const rolloutSummary = buildRolloutSummary(
    rolloutStages,
    currentStageId,
    recommendedNextStageId
  );

  return buildRolloutPlanResult({
    rolloutStages,
    currentStageId,
    recommendedNextStageId,
    rolloutSummary
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_ENTITY,
  ROLLOUT_STAGE_STATUS,
  ROLLOUT_STAGE_IDS,
  INTEGRATION_STATUS,
  ROLLOUT_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_ROLLOUT_PLANNER_METADATA,
  createRecruitmentWorkflowIntegrationRolloutPlan
};
