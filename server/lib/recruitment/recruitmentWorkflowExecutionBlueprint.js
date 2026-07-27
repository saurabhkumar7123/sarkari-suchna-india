"use strict";

/**
 * Phase 139 — Recruitment Workflow Execution Blueprint (Advisory Only).
 *
 * Pure advisory execution blueprint that defines evaluation order for Phases
 * 114–138 advisory modules. Describes ordering only — no execution, no
 * scheduler, no workers, no runtime imports, no persistence, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE = 139;

const RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_ENTITY =
  "recruitment_workflow_execution_blueprint";

const EXECUTION_SCHEMA_VERSION = "1.0.0";

const EXECUTION_POSTURE = Object.freeze({
  ORDER_DEFINED: "ORDER_DEFINED",
  ORDER_PARTIAL: "ORDER_PARTIAL",
  ORDER_UNKNOWN: "ORDER_UNKNOWN"
});

const EXECUTION_STAGE_IDS = Object.freeze({
  FOUNDATION_EVALUATION: "FOUNDATION_EVALUATION",
  BOUNDARY_EVALUATION: "BOUNDARY_EVALUATION",
  ORCHESTRATION_EVALUATION: "ORCHESTRATION_EVALUATION",
  TRACE_EVALUATION: "TRACE_EVALUATION",
  REPORTING_EVALUATION: "REPORTING_EVALUATION",
  SNAPSHOT_EVALUATION: "SNAPSHOT_EVALUATION",
  HEALTH_RISK_EVALUATION: "HEALTH_RISK_EVALUATION",
  INTELLIGENCE_EVALUATION: "INTELLIGENCE_EVALUATION",
  RECOMMENDATION_EVALUATION: "RECOMMENDATION_EVALUATION",
  CONSISTENCY_EVALUATION: "CONSISTENCY_EVALUATION",
  READINESS_EVALUATION: "READINESS_EVALUATION",
  ACTIVATION_EVALUATION: "ACTIVATION_EVALUATION",
  GOVERNANCE_EVALUATION: "GOVERNANCE_EVALUATION",
  SIMULATION_EVALUATION: "SIMULATION_EVALUATION",
  CONTRACT_EVALUATION: "CONTRACT_EVALUATION"
});

const EXECUTION_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: EXECUTION_STAGE_IDS.FOUNDATION_EVALUATION, order: 1, phases: Object.freeze([114, 115, 116, 117]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.BOUNDARY_EVALUATION, order: 2, phases: Object.freeze([118, 119]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.ORCHESTRATION_EVALUATION, order: 3, phases: Object.freeze([120]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.TRACE_EVALUATION, order: 4, phases: Object.freeze([121, 122]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.REPORTING_EVALUATION, order: 5, phases: Object.freeze([123, 124]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.SNAPSHOT_EVALUATION, order: 6, phases: Object.freeze([125, 126, 127]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.HEALTH_RISK_EVALUATION, order: 7, phases: Object.freeze([128, 129]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.INTELLIGENCE_EVALUATION, order: 8, phases: Object.freeze([130]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.RECOMMENDATION_EVALUATION, order: 9, phases: Object.freeze([131, 132]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.CONSISTENCY_EVALUATION, order: 10, phases: Object.freeze([133]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.READINESS_EVALUATION, order: 11, phases: Object.freeze([134]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.ACTIVATION_EVALUATION, order: 12, phases: Object.freeze([135]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.GOVERNANCE_EVALUATION, order: 13, phases: Object.freeze([136]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.SIMULATION_EVALUATION, order: 14, phases: Object.freeze([137]) }),
  Object.freeze({ id: EXECUTION_STAGE_IDS.CONTRACT_EVALUATION, order: 15, phases: Object.freeze([138]) })
]);

const RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_139",
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
  executionBlueprintOnly: true,
  schedulerEnabled: false,
  workerEnabled: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138
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
 * @param {Readonly<Array>} stages
 * @returns {Readonly<Array>}
 */
function buildPhaseEvaluationOrder(stages) {
  const phases = [];
  for (let i = 0; i < stages.length; i += 1) {
    const stagePhases = stages[i].phases;
    for (let j = 0; j < stagePhases.length; j += 1) {
      phases.push(stagePhases[j]);
    }
  }
  return Object.freeze(phases.slice());
}

/**
 * @param {Readonly<Array>} stages
 * @returns {Readonly<Array>}
 */
function buildStageEvaluationOrder(stages) {
  const ordered = stages
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((stage) =>
      deepFreeze({
        stageId: stage.id,
        order: stage.order,
        phases: stage.phases
      })
    );
  return Object.freeze(ordered);
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedExecutionInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.includedStageIds != null && !Array.isArray(input.includedStageIds)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function resolveIncludedStages(input) {
  if (!Array.isArray(input.includedStageIds) || input.includedStageIds.length === 0) {
    return EXECUTION_STAGE_DEFINITIONS;
  }

  const includedSet = new Set(input.includedStageIds);
  return EXECUTION_STAGE_DEFINITIONS.filter((stage) => includedSet.has(stage.id));
}

/**
 * @param {Readonly<Array>} stages
 * @returns {string}
 */
function resolveExecutionPosture(stages) {
  if (stages.length === 0) {
    return EXECUTION_POSTURE.ORDER_UNKNOWN;
  }
  if (stages.length === EXECUTION_STAGE_DEFINITIONS.length) {
    return EXECUTION_POSTURE.ORDER_DEFINED;
  }
  return EXECUTION_POSTURE.ORDER_PARTIAL;
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
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function resolveRecruitmentWorkflowExecutionOrder(input) {
  const normalizedInput = isRecognizedExecutionInput(input) ? input : {};
  const includedStages = resolveIncludedStages(normalizedInput);
  const stageEvaluationOrder = buildStageEvaluationOrder(includedStages);
  const phaseEvaluationOrder = buildPhaseEvaluationOrder(
    includedStages.slice().sort((left, right) => left.order - right.order)
  );
  const executionPosture = resolveExecutionPosture(includedStages);
  const recruitmentId = resolveRecruitmentId(normalizedInput.recruitmentId);

  return deepFreeze({
    entity: RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_ENTITY,
    phase: RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE,
    schemaVersion: EXECUTION_SCHEMA_VERSION,
    recruitmentId,
    executionPosture,
    stageCount: stageEvaluationOrder.length,
    phaseCount: phaseEvaluationOrder.length,
    stageEvaluationOrder,
    phaseEvaluationOrder,
    evaluationSummary:
      executionPosture === EXECUTION_POSTURE.ORDER_DEFINED
        ? "Advisory evaluation order defined from draft foundation through runtime integration contract"
        : executionPosture === EXECUTION_POSTURE.ORDER_PARTIAL
          ? "Advisory evaluation order partially defined"
          : "Advisory evaluation order could not be determined",
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_139",
      phase: RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      executionBlueprintOnly: true,
      schedulerEnabled: false,
      workerEnabled: false
    })
  });
}

/**
 * @returns {Readonly<Object>}
 */
function getRecruitmentWorkflowExecutionBlueprint() {
  return resolveRecruitmentWorkflowExecutionOrder({});
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowExecutionBlueprint(value) {
  return (
    isPlainObject(value) &&
    value.entity === RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_ENTITY &&
    value.phase === RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE,
  RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_ENTITY,
  EXECUTION_SCHEMA_VERSION,
  EXECUTION_POSTURE,
  EXECUTION_STAGE_IDS,
  EXECUTION_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_METADATA,
  resolveRecruitmentWorkflowExecutionOrder,
  getRecruitmentWorkflowExecutionBlueprint,
  isRecruitmentWorkflowExecutionBlueprint
};
