"use strict";

/**
 * Phase 73 — Worker Execution Integration (Observation Mode).
 *
 * Observes advisory Action Plans from Phase 72 without executing lifecycle
 * actions, performing persistence, or invoking generators. Pure deterministic
 * functions only — no database, filesystem, network, or environment access.
 *
 * Worker may observe Action Plans. Worker must NOT execute Action Plans.
 * Failures never affect pipeline execution.
 */

const {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
  ACTION_TYPES,
  validateRecruitmentActionPlan,
  summarizeRecruitmentActionPlan
} = require("./recruitmentActionPlanner");

const WORKER_OBSERVATION_PHASE = 73;

const OBSERVATION_ENTITY = "recruitment_worker_action_observation";

const OBSERVATION_STATES = Object.freeze({
  IGNORED: "ignored",
  PLANNED: "planned",
  DEFERRED: "deferred",
  MANUAL_REVIEW: "manual_review",
  NOT_AVAILABLE: "not_available"
});

const SUPPORTED_OBSERVATION_STATES = Object.freeze(
  new Set(Object.values(OBSERVATION_STATES))
);

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const OBSERVATION_METADATA = Object.freeze({
  phase: WORKER_OBSERVATION_PHASE,
  observationOnly: true,
  workerExecution: false,
  lifecycleExecution: false,
  actionPlanning: false,
  persistenceEnabled: false,
  performsPersistence: false,
  queriesDatabase: false,
  sideEffects: false,
  assignsRecruitmentIds: false,
  actionPlannerPhase: ACTION_PLANNER_PHASE
});

const OBSERVATION_DESCRIPTOR = Object.freeze({
  entity: OBSERVATION_ENTITY,
  domain: "recruitment",
  phase: WORKER_OBSERVATION_PHASE,
  description:
    "Deterministic worker-side observation of an advisory recruitment action plan.",
  supportedStates: Object.freeze(SUPPORTED_OBSERVATION_STATES),
  metadata: OBSERVATION_METADATA
});

const ACTION_TYPE_TO_OBSERVATION_STATE = Object.freeze({
  [ACTION_TYPES.IGNORE]: OBSERVATION_STATES.IGNORED,
  [ACTION_TYPES.MANUAL_REVIEW]: OBSERVATION_STATES.MANUAL_REVIEW,
  [ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT]: OBSERVATION_STATES.PLANNED,
  [ACTION_TYPES.CREATE_NEW_RECRUITMENT]: OBSERVATION_STATES.DEFERRED
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

function buildValidationResult(reasons) {
  const normalizedReasons = Array.isArray(reasons)
    ? reasons.filter((reason) => typeof reason === "string" && reason.trim() !== "")
    : [];

  let status = VALIDATION_STATUS.VALID;
  if (normalizedReasons.length > 0) {
    status =
      normalizedReasons.some((reason) => reason.startsWith("MISSING_")) ||
      normalizedReasons.some((reason) => reason.startsWith("INVALID_"))
        ? VALIDATION_STATUS.INCOMPLETE
        : VALIDATION_STATUS.INVALID;
  }

  return deepFreeze({
    valid: normalizedReasons.length === 0,
    status,
    reasons: Object.freeze(normalizedReasons.slice())
  });
}

/**
 * @param {string} state
 * @returns {boolean}
 */
function isObservationState(state) {
  return typeof state === "string" && SUPPORTED_OBSERVATION_STATES.has(state);
}

/**
 * @param {Object|null|undefined} actionPlan
 * @returns {string}
 */
function resolveObservationState(actionPlan) {
  if (!isPlainObject(actionPlan)) {
    return OBSERVATION_STATES.NOT_AVAILABLE;
  }

  const actionType = actionPlan.actionType;
  const mapped = ACTION_TYPE_TO_OBSERVATION_STATE[actionType];
  return isObservationState(mapped) ? mapped : OBSERVATION_STATES.NOT_AVAILABLE;
}

function buildDiagnostics(observationState, planValidation) {
  return deepFreeze({
    observationRecorded: true,
    executionBlocked: true,
    observationMode: true,
    observationState,
    planAvailable: observationState !== OBSERVATION_STATES.NOT_AVAILABLE,
    planValid: planValidation.valid === true,
    executionReason: "worker_observation_mode"
  });
}

function buildSafeDefaultObservation() {
  const planValidation = buildValidationResult(["OBSERVATION_FAILURE"]);
  return deepFreeze({
    phase: WORKER_OBSERVATION_PHASE,
    entity: OBSERVATION_ENTITY,
    observationOnly: true,
    workerExecution: false,
    lifecycleExecution: false,
    actionPlanning: false,
    persistenceEnabled: false,
    performsPersistence: false,
    queriesDatabase: false,
    sideEffects: false,
    assignsRecruitmentIds: false,
    observationState: OBSERVATION_STATES.NOT_AVAILABLE,
    actionPlanPhase: null,
    actionPlanEntity: null,
    actionType: null,
    actionLabel: null,
    matchCategory: null,
    matchingResultValid: null,
    recommendsManualReview: true,
    planValidation,
    planSummary: summarizeRecruitmentActionPlan(null),
    diagnostics: buildDiagnostics(OBSERVATION_STATES.NOT_AVAILABLE, planValidation),
    metadata: deepFreeze({
      ...OBSERVATION_METADATA,
      createReason: "observation_failure"
    })
  });
}

/**
 * Observe an advisory action plan in worker observation mode.
 * Pure: no I/O, no persistence, no generator calls, no execution.
 *
 * @param {Object|null|undefined} actionPlan
 * @returns {Readonly<Object>}
 */
function observeRecruitmentActionPlan(actionPlan) {
  try {
    const planValidation = isPlainObject(actionPlan)
      ? validateRecruitmentActionPlan(actionPlan)
      : buildValidationResult(["INVALID_PLAN_SHAPE"]);

    const observationState = resolveObservationState(actionPlan);
    const planSummary = summarizeRecruitmentActionPlan(
      isPlainObject(actionPlan) ? actionPlan : null
    );

    return deepFreeze({
      phase: WORKER_OBSERVATION_PHASE,
      entity: OBSERVATION_ENTITY,
      observationOnly: true,
      workerExecution: false,
      lifecycleExecution: false,
      actionPlanning: false,
      persistenceEnabled: false,
      performsPersistence: false,
      queriesDatabase: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      observationState,
      actionPlanPhase: isPlainObject(actionPlan) ? (actionPlan.phase ?? null) : null,
      actionPlanEntity: isPlainObject(actionPlan) ? (actionPlan.entity ?? null) : null,
      actionType: isPlainObject(actionPlan) ? (actionPlan.actionType ?? null) : null,
      actionLabel: isPlainObject(actionPlan) ? (actionPlan.actionLabel ?? null) : null,
      matchCategory: isPlainObject(actionPlan) ? (actionPlan.matchCategory ?? null) : null,
      matchingResultValid: isPlainObject(actionPlan)
        ? typeof actionPlan.matchingResultValid === "boolean"
          ? actionPlan.matchingResultValid
          : null
        : null,
      recommendsManualReview: isPlainObject(actionPlan)
        ? actionPlan.recommendsManualReview === true
        : true,
      planValidation,
      planSummary,
      diagnostics: buildDiagnostics(observationState, planValidation),
      metadata: deepFreeze({
        ...OBSERVATION_METADATA,
        createReason: isPlainObject(actionPlan) ? "action_plan" : "missing_action_plan",
        actionPlannerEntity: isPlainObject(actionPlan) ? ACTION_PLAN_ENTITY : null
      })
    });
  } catch {
    return buildSafeDefaultObservation();
  }
}

/**
 * @param {*} observation
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateObservedAction(observation) {
  const reasons = [];

  if (!isPlainObject(observation)) {
    return buildValidationResult(["INVALID_OBSERVATION_SHAPE"]);
  }

  if (observation.phase !== WORKER_OBSERVATION_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (observation.entity !== OBSERVATION_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (observation.observationOnly !== true) {
    reasons.push("OBSERVATION_ONLY_MUST_BE_TRUE");
  }

  if (observation.workerExecution !== false || observation.lifecycleExecution !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (
    observation.persistenceEnabled !== false ||
    observation.performsPersistence !== false ||
    observation.queriesDatabase !== false
  ) {
    reasons.push("PERSISTENCE_FLAGS_MUST_BE_FALSE");
  }

  if (observation.sideEffects !== false || observation.assignsRecruitmentIds !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (!isObservationState(observation.observationState)) {
    reasons.push("INVALID_OBSERVATION_STATE");
  }

  if (!isPlainObject(observation.planValidation)) {
    reasons.push("MISSING_PLAN_VALIDATION");
  } else if (typeof observation.planValidation.valid !== "boolean") {
    reasons.push("INVALID_PLAN_VALIDATION");
  }

  if (!isPlainObject(observation.planSummary)) {
    reasons.push("MISSING_PLAN_SUMMARY");
  }

  if (!isPlainObject(observation.diagnostics)) {
    reasons.push("MISSING_DIAGNOSTICS");
  } else {
    if (observation.diagnostics.executionBlocked !== true) {
      reasons.push("DIAGNOSTICS_EXECUTION_MUST_BE_BLOCKED");
    }
    if (observation.diagnostics.observationMode !== true) {
      reasons.push("DIAGNOSTICS_OBSERVATION_MODE_REQUIRED");
    }
    if (observation.diagnostics.observationState !== observation.observationState) {
      reasons.push("DIAGNOSTICS_STATE_MISMATCH");
    }
  }

  if (!isPlainObject(observation.metadata)) {
    reasons.push("MISSING_METADATA");
  }

  if (
    observation.observationState === OBSERVATION_STATES.NOT_AVAILABLE &&
    observation.actionType != null
  ) {
    reasons.push("NOT_AVAILABLE_STATE_ACTION_TYPE_CONFLICT");
  }

  if (
    isPlainObject(observation.planValidation) &&
    observation.planValidation.valid === true &&
    observation.observationState === OBSERVATION_STATES.NOT_AVAILABLE
  ) {
    reasons.push("VALID_PLAN_CANNOT_BE_NOT_AVAILABLE");
  }

  const expectedState = resolveObservationState(
    observation.actionType == null
      ? null
      : {
          actionType: observation.actionType,
          matchCategory: observation.matchCategory
        }
  );

  if (
    observation.actionType != null &&
    isObservationState(expectedState) &&
    expectedState !== OBSERVATION_STATES.NOT_AVAILABLE &&
    observation.observationState !== expectedState
  ) {
    reasons.push("OBSERVATION_STATE_INCONSISTENT_WITH_ACTION_TYPE");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} observation
 * @returns {Readonly<Object>}
 */
function summarizeObservedAction(observation) {
  const validation = validateObservedAction(observation);
  if (!validation.valid) {
    return Object.freeze({
      phase: WORKER_OBSERVATION_PHASE,
      entity: OBSERVATION_ENTITY,
      valid: false,
      observationState: OBSERVATION_STATES.NOT_AVAILABLE,
      actionType: null,
      matchCategory: null,
      workerExecution: false,
      lifecycleExecution: false,
      persistenceEnabled: false,
      performsPersistence: false,
      executionBlocked: true,
      observationMode: true
    });
  }

  return Object.freeze({
    phase: observation.phase,
    entity: observation.entity,
    valid: true,
    observationState: observation.observationState,
    actionType: observation.actionType,
    actionLabel: observation.actionLabel,
    matchCategory: observation.matchCategory,
    matchingResultValid: observation.matchingResultValid,
    recommendsManualReview: observation.recommendsManualReview,
    planValid: observation.planValidation.valid === true,
    workerExecution: false,
    lifecycleExecution: false,
    persistenceEnabled: false,
    performsPersistence: false,
    executionBlocked: observation.diagnostics.executionBlocked === true,
    observationMode: observation.diagnostics.observationMode === true
  });
}

module.exports = {
  WORKER_OBSERVATION_PHASE,
  OBSERVATION_ENTITY,
  OBSERVATION_STATES,
  SUPPORTED_OBSERVATION_STATES,
  VALIDATION_STATUS,
  OBSERVATION_METADATA,
  OBSERVATION_DESCRIPTOR,
  ACTION_TYPE_TO_OBSERVATION_STATE,
  isObservationState,
  resolveObservationState,
  observeRecruitmentActionPlan,
  validateObservedAction,
  summarizeObservedAction
};
