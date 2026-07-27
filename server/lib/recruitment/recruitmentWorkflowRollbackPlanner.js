"use strict";

/**
 * Phase 136 — Recruitment Workflow Rollback Planner (Advisory Only).
 *
 * Pure advisory rollback planner that recommends staged rollback sequences for
 * future controlled recruitment workflow integration reversal. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_PHASE = 136;

const RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_ENTITY = "recruitment_workflow_rollback_planner";

const ROLLBACK_STAGE_STATUS = Object.freeze({
  RECOMMENDED: "RECOMMENDED",
  OPTIONAL: "OPTIONAL",
  NOT_RECOMMENDED: "NOT_RECOMMENDED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const ROLLBACK_POSTURE = Object.freeze({
  FULL_ROLLBACK_ADVISORY: "FULL_ROLLBACK_ADVISORY",
  PARTIAL_ROLLBACK_ADVISORY: "PARTIAL_ROLLBACK_ADVISORY",
  NO_ROLLBACK_NEEDED: "NO_ROLLBACK_NEEDED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const INTEGRATION_STATUS = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  STABLE: "STABLE",
  AT_RISK: "AT_RISK",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const RISK_LEVEL = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const ROLLBACK_STAGE_IDS = Object.freeze({
  DEACTIVATE_ACTIVATION_PLANNING: "DEACTIVATE_ACTIVATION_PLANNING",
  REVERT_CONTROLLED_INTEGRATION_GATE: "REVERT_CONTROLLED_INTEGRATION_GATE",
  REVERT_CONSISTENCY_VALIDATION: "REVERT_CONSISTENCY_VALIDATION",
  REVERT_RECOMMENDATION_TIMELINE: "REVERT_RECOMMENDATION_TIMELINE",
  REVERT_INTELLIGENCE_AGGREGATION: "REVERT_INTELLIGENCE_AGGREGATION",
  REVERT_HEALTH_RISK: "REVERT_HEALTH_RISK",
  REVERT_SNAPSHOT_ANALYSIS: "REVERT_SNAPSHOT_ANALYSIS",
  REVERT_READINESS_REPORTING: "REVERT_READINESS_REPORTING",
  REVERT_TRACE_REGISTRY: "REVERT_TRACE_REGISTRY",
  REVERT_ORCHESTRATION_BOUNDARY: "REVERT_ORCHESTRATION_BOUNDARY",
  REVERT_STORAGE_BOUNDARY: "REVERT_STORAGE_BOUNDARY",
  REVERT_FOUNDATIONAL_PIPELINE: "REVERT_FOUNDATIONAL_PIPELINE",
  DOCUMENT_ROLLBACK_COMPLETION: "DOCUMENT_ROLLBACK_COMPLETION"
});

const ROLLBACK_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.DEACTIVATE_ACTIVATION_PLANNING,
    order: 1,
    label: "Deactivate activation planning advisory modules",
    modulePhases: Object.freeze([135]),
    prerequisiteStageIds: Object.freeze([])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_CONTROLLED_INTEGRATION_GATE,
    order: 2,
    label: "Revert controlled integration gate readiness",
    modulePhases: Object.freeze([134]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.DEACTIVATE_ACTIVATION_PLANNING])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_CONSISTENCY_VALIDATION,
    order: 3,
    label: "Revert consistency validation advisory state",
    modulePhases: Object.freeze([133]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_CONTROLLED_INTEGRATION_GATE])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_RECOMMENDATION_TIMELINE,
    order: 4,
    label: "Revert recommendation and timeline advisory modules",
    modulePhases: Object.freeze([131, 132]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_CONSISTENCY_VALIDATION])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_INTELLIGENCE_AGGREGATION,
    order: 5,
    label: "Revert intelligence aggregation advisory state",
    modulePhases: Object.freeze([130]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_RECOMMENDATION_TIMELINE])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_HEALTH_RISK,
    order: 6,
    label: "Revert health and risk advisory signals",
    modulePhases: Object.freeze([128, 129]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_INTELLIGENCE_AGGREGATION])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_SNAPSHOT_ANALYSIS,
    order: 7,
    label: "Revert snapshot analysis advisory modules",
    modulePhases: Object.freeze([125, 126, 127]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_HEALTH_RISK])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_READINESS_REPORTING,
    order: 8,
    label: "Revert readiness and reporting advisory state",
    modulePhases: Object.freeze([123, 124]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_SNAPSHOT_ANALYSIS])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_TRACE_REGISTRY,
    order: 9,
    label: "Revert trace and registry advisory modules",
    modulePhases: Object.freeze([121, 122]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_READINESS_REPORTING])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_ORCHESTRATION_BOUNDARY,
    order: 10,
    label: "Revert orchestration boundary advisory state",
    modulePhases: Object.freeze([120]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_TRACE_REGISTRY])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_STORAGE_BOUNDARY,
    order: 11,
    label: "Revert storage boundary advisory modules",
    modulePhases: Object.freeze([118, 119]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_ORCHESTRATION_BOUNDARY])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.REVERT_FOUNDATIONAL_PIPELINE,
    order: 12,
    label: "Revert foundational draft pipeline advisory state",
    modulePhases: Object.freeze([114, 115, 116, 117]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_STORAGE_BOUNDARY])
  }),
  Object.freeze({
    id: ROLLBACK_STAGE_IDS.DOCUMENT_ROLLBACK_COMPLETION,
    order: 13,
    label: "Document advisory rollback completion and baseline verification",
    modulePhases: Object.freeze([]),
    prerequisiteStageIds: Object.freeze([ROLLBACK_STAGE_IDS.REVERT_FOUNDATIONAL_PIPELINE])
  })
]);

const RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_136",
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
  rollbackPlannerOnly: true,
  executesRollback: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135
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
function isRecognizedRollbackInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "integrationReadiness",
    "intelligenceSummary",
    "activatedModules",
    "moduleSignals",
    "rollbackTrigger"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "boolean") {
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
function hasMeaningfulRollbackSignals(input) {
  return (
    input.integrationReadiness != null ||
    input.intelligenceSummary != null ||
    input.activatedModules != null ||
    input.moduleSignals != null ||
    input.rollbackTrigger != null
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractRollbackSignals(input) {
  const integrationReadiness = isPlainObject(input.integrationReadiness)
    ? input.integrationReadiness
    : {};
  const intelligenceSummary = isPlainObject(input.intelligenceSummary)
    ? input.intelligenceSummary
    : {};
  const rollbackTrigger = isPlainObject(input.rollbackTrigger) ? input.rollbackTrigger : {};

  const integrationStatus =
    typeof integrationReadiness.integrationStatus === "string"
      ? integrationReadiness.integrationStatus
      : typeof integrationReadiness.readinessLevel === "string"
        ? integrationReadiness.readinessLevel
        : null;

  const currentState = isPlainObject(intelligenceSummary.currentState)
    ? intelligenceSummary.currentState
    : {};

  const healthStatus =
    typeof currentState.health === "string"
      ? currentState.health
      : typeof intelligenceSummary.healthStatus === "string"
        ? intelligenceSummary.healthStatus
        : null;

  const riskLevel =
    typeof currentState.risk === "string"
      ? currentState.risk
      : typeof intelligenceSummary.riskLevel === "string"
        ? intelligenceSummary.riskLevel
        : null;

  const activatedPhases = new Set();
  if (isPlainObject(input.activatedModules)) {
    const keys = Object.keys(input.activatedModules);
    for (let i = 0; i < keys.length; i += 1) {
      const phase = Number(keys[i]);
      const module = input.activatedModules[keys[i]];
      if (Number.isInteger(phase) && isPlainObject(module) && module.activated === true) {
        activatedPhases.add(phase);
      }
    }
  }

  if (isPlainObject(input.moduleSignals)) {
    const keys = Object.keys(input.moduleSignals);
    for (let i = 0; i < keys.length; i += 1) {
      const phase = Number(keys[i]);
      const signal = input.moduleSignals[keys[i]];
      if (
        Number.isInteger(phase) &&
        isPlainObject(signal) &&
        (signal.activated === true || signal.satisfied === true)
      ) {
        activatedPhases.add(phase);
      }
    }
  }

  const rollbackRequested =
    rollbackTrigger.requested === true ||
    rollbackTrigger.rollbackRequested === true ||
    input.rollbackRequested === true;

  const criticalFailure =
    rollbackTrigger.criticalFailure === true ||
    healthStatus === HEALTH_STATUS.BLOCKED ||
    riskLevel === RISK_LEVEL.CRITICAL;

  return {
    integrationStatus,
    healthStatus,
    riskLevel,
    activatedPhases,
    rollbackRequested,
    criticalFailure
  };
}

/**
 * @param {Readonly<Object>} definition
 * @param {Readonly<Object>} signals
 * @param {ReadonlyMap<string, string>} stageStatusMap
 * @param {boolean} hasSignals
 * @returns {string}
 */
function evaluateRollbackStageStatus(definition, signals, stageStatusMap, hasSignals) {
  if (!hasSignals) {
    return ROLLBACK_STAGE_STATUS.UNKNOWN;
  }

  if (signals.criticalFailure) {
    return ROLLBACK_STAGE_STATUS.RECOMMENDED;
  }

  if (
    signals.integrationStatus === INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION &&
    !signals.rollbackRequested
  ) {
    return ROLLBACK_STAGE_STATUS.NOT_RECOMMENDED;
  }

  if (!signals.rollbackRequested && signals.integrationStatus === INTEGRATION_STATUS.NOT_READY) {
    return ROLLBACK_STAGE_STATUS.NOT_RECOMMENDED;
  }

  const prerequisitesMet = definition.prerequisiteStageIds.every((stageId) => {
    const prereqStatus = stageStatusMap.get(stageId);
    return (
      prereqStatus === ROLLBACK_STAGE_STATUS.RECOMMENDED ||
      prereqStatus === ROLLBACK_STAGE_STATUS.OPTIONAL ||
      prereqStatus === ROLLBACK_STAGE_STATUS.NOT_RECOMMENDED
    );
  });

  if (!prerequisitesMet && definition.prerequisiteStageIds.length > 0) {
    return ROLLBACK_STAGE_STATUS.BLOCKED;
  }

  const hasActivatedModules = definition.modulePhases.some((phase) =>
    signals.activatedPhases.has(phase)
  );

  if (definition.id === ROLLBACK_STAGE_IDS.DOCUMENT_ROLLBACK_COMPLETION) {
    return signals.rollbackRequested
      ? ROLLBACK_STAGE_STATUS.RECOMMENDED
      : ROLLBACK_STAGE_STATUS.OPTIONAL;
  }

  if (signals.rollbackRequested) {
    return hasActivatedModules
      ? ROLLBACK_STAGE_STATUS.RECOMMENDED
      : ROLLBACK_STAGE_STATUS.OPTIONAL;
  }

  if (signals.integrationStatus === INTEGRATION_STATUS.PARTIALLY_READY && hasActivatedModules) {
    return ROLLBACK_STAGE_STATUS.OPTIONAL;
  }

  return ROLLBACK_STAGE_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildRollbackStages(input, signals) {
  const hasSignals = hasMeaningfulRollbackSignals(input);
  const stageStatusMap = new Map();

  const stages = ROLLBACK_STAGE_DEFINITIONS.map((definition) => {
    const status = evaluateRollbackStageStatus(definition, signals, stageStatusMap, hasSignals);
    stageStatusMap.set(definition.id, status);

    return deepFreeze({
      id: definition.id,
      order: definition.order,
      label: definition.label,
      modulePhases: Object.freeze(definition.modulePhases.slice()),
      prerequisiteStageIds: Object.freeze(definition.prerequisiteStageIds.slice()),
      status
    });
  });

  return stages;
}

/**
 * @param {ReadonlyArray<Object>} rollbackStages
 * @returns {string}
 */
function resolveRollbackPosture(rollbackStages) {
  const recommendedCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.RECOMMENDED
  ).length;
  const notRecommendedCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.NOT_RECOMMENDED
  ).length;

  if (rollbackStages.every((stage) => stage.status === ROLLBACK_STAGE_STATUS.UNKNOWN)) {
    return ROLLBACK_POSTURE.UNKNOWN;
  }

  if (notRecommendedCount === rollbackStages.length) {
    return ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED;
  }

  if (recommendedCount >= 10) {
    return ROLLBACK_POSTURE.FULL_ROLLBACK_ADVISORY;
  }

  if (recommendedCount > 0) {
    return ROLLBACK_POSTURE.PARTIAL_ROLLBACK_ADVISORY;
  }

  return ROLLBACK_POSTURE.REVIEW_REQUIRED;
}

/**
 * @param {ReadonlyArray<Object>} rollbackStages
 * @returns {ReadonlyArray<Object>}
 */
function deriveRecommendedRollbackStages(rollbackStages) {
  return rollbackStages.filter((stage) => stage.status === ROLLBACK_STAGE_STATUS.RECOMMENDED);
}

/**
 * @param {ReadonlyArray<Object>} rollbackStages
 * @param {string} rollbackPosture
 * @returns {string}
 */
function buildRollbackSummary(rollbackStages, rollbackPosture) {
  const recommendedCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.RECOMMENDED
  ).length;

  if (rollbackStages.every((stage) => stage.status === ROLLBACK_STAGE_STATUS.UNKNOWN)) {
    return "Recruitment workflow rollback planner awaits advisory prerequisite signals";
  }

  if (rollbackPosture === ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED) {
    return "Recruitment workflow rollback planner reports no rollback stages recommended";
  }

  if (rollbackPosture === ROLLBACK_POSTURE.FULL_ROLLBACK_ADVISORY) {
    return `Recruitment workflow rollback planner recommends full advisory rollback across ${recommendedCount} stages`;
  }

  if (rollbackPosture === ROLLBACK_POSTURE.PARTIAL_ROLLBACK_ADVISORY) {
    return `Recruitment workflow rollback planner recommends partial advisory rollback across ${recommendedCount} stages`;
  }

  return `Recruitment workflow rollback planner requires review with ${recommendedCount} recommended stages`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildRollbackPlanResult(params) {
  return deepFreeze({
    rollbackStages: Object.freeze(params.rollbackStages.slice()),
    recommendedStages: Object.freeze(params.recommendedStages.slice()),
    recommendedCount: params.recommendedCount,
    optionalCount: params.optionalCount,
    notRecommendedCount: params.notRecommendedCount,
    unknownCount: params.unknownCount,
    rollbackPosture: params.rollbackPosture,
    rollbackSummary: params.rollbackSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_136",
      phase: RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      rollbackPlannerOnly: true,
      executesRollback: false
    })
  });
}

/**
 * Create recruitment workflow advisory rollback plan.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowRollbackPlan(input) {
  if (!isRecognizedRollbackInput(input) || !hasMeaningfulRollbackSignals(input)) {
    const staticStages = ROLLBACK_STAGE_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        order: definition.order,
        label: definition.label,
        modulePhases: Object.freeze(definition.modulePhases.slice()),
        prerequisiteStageIds: Object.freeze(definition.prerequisiteStageIds.slice()),
        status: ROLLBACK_STAGE_STATUS.UNKNOWN
      })
    );

    return buildRollbackPlanResult({
      rollbackStages: staticStages,
      recommendedStages: [],
      recommendedCount: 0,
      optionalCount: 0,
      notRecommendedCount: 0,
      unknownCount: staticStages.length,
      rollbackPosture: ROLLBACK_POSTURE.UNKNOWN,
      rollbackSummary: buildRollbackSummary(staticStages, ROLLBACK_POSTURE.UNKNOWN)
    });
  }

  const signals = extractRollbackSignals(input);
  const rollbackStages = buildRollbackStages(input, signals);
  const recommendedStages = deriveRecommendedRollbackStages(rollbackStages);
  const recommendedCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.RECOMMENDED
  ).length;
  const optionalCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.OPTIONAL
  ).length;
  const notRecommendedCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.NOT_RECOMMENDED
  ).length;
  const unknownCount = rollbackStages.filter(
    (stage) => stage.status === ROLLBACK_STAGE_STATUS.UNKNOWN
  ).length;
  const rollbackPosture = resolveRollbackPosture(rollbackStages);

  return buildRollbackPlanResult({
    rollbackStages,
    recommendedStages,
    recommendedCount,
    optionalCount,
    notRecommendedCount,
    unknownCount,
    rollbackPosture,
    rollbackSummary: buildRollbackSummary(rollbackStages, rollbackPosture)
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_PHASE,
  RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_ENTITY,
  ROLLBACK_STAGE_STATUS,
  ROLLBACK_POSTURE,
  ROLLBACK_STAGE_IDS,
  ROLLBACK_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_METADATA,
  createRecruitmentWorkflowRollbackPlan
};
