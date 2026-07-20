"use strict";

/**
 * Phase 74 — Recruitment Persistence Coordinator (Dry-Run Mode).
 *
 * Converts advisory Action Plans into immutable Persistence Plans using
 * deterministic action-to-operation mapping. Does not execute persistence,
 * assign recruitment IDs, or access databases.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
  ACTION_TYPES,
  validateRecruitmentActionPlan,
  summarizeRecruitmentActionPlan
} = require("./recruitmentActionPlanner");

const PERSISTENCE_COORDINATOR_PHASE = 74;

const PERSISTENCE_PLAN_ENTITY = "recruitment_persistence_plan";

const PERSISTENCE_OPERATIONS = Object.freeze({
  CREATE_RECRUITMENT: "create_recruitment",
  ATTACH_RECRUITMENT: "attach_recruitment",
  MANUAL_REVIEW: "manual_review",
  SKIP: "skip",
  NONE: "none"
});

const SUPPORTED_PERSISTENCE_OPERATIONS = Object.freeze(
  new Set(Object.values(PERSISTENCE_OPERATIONS))
);

const DEFAULT_PERSISTENCE_OPERATION = PERSISTENCE_OPERATIONS.NONE;

const ACTION_TYPE_TO_PERSISTENCE_OPERATION = Object.freeze({
  [ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT]: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT,
  [ACTION_TYPES.CREATE_NEW_RECRUITMENT]: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT,
  [ACTION_TYPES.MANUAL_REVIEW]: PERSISTENCE_OPERATIONS.MANUAL_REVIEW,
  [ACTION_TYPES.IGNORE]: PERSISTENCE_OPERATIONS.NONE
});

const OPERATION_DESCRIPTOR = Object.freeze({
  create_recruitment: Object.freeze({
    id: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT,
    label: "Create Recruitment",
    description:
      "Dry-run persistence plan to create a new recruitment record when no shared identity match exists.",
    performsPersistence: false,
    dryRunOnly: true
  }),
  attach_recruitment: Object.freeze({
    id: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT,
    label: "Attach Recruitment",
    description:
      "Dry-run persistence plan to attach the update to an existing recruitment when match confidence is high.",
    performsPersistence: false,
    dryRunOnly: true
  }),
  manual_review: Object.freeze({
    id: PERSISTENCE_OPERATIONS.MANUAL_REVIEW,
    label: "Manual Review",
    description:
      "Dry-run persistence plan to route the update to manual review before any write.",
    performsPersistence: false,
    dryRunOnly: true
  }),
  skip: Object.freeze({
    id: PERSISTENCE_OPERATIONS.SKIP,
    label: "Skip",
    description:
      "Dry-run persistence plan explicitly skips persistence for an unmapped or inconclusive action type.",
    performsPersistence: false,
    dryRunOnly: true
  }),
  none: Object.freeze({
    id: PERSISTENCE_OPERATIONS.NONE,
    label: "None",
    description:
      "Dry-run persistence plan with no persistence operation — advisory ignore or invalid input.",
    performsPersistence: false,
    dryRunOnly: true
  })
});

const PERSISTENCE_PLAN_METADATA = Object.freeze({
  phase: PERSISTENCE_COORDINATOR_PHASE,
  dryRunOnly: true,
  descriptiveOnly: true,
  architectureOnly: false,
  runtimeIntegration: true,
  persistencePlanning: false,
  persistenceEnabled: false,
  performsPersistence: false,
  sideEffects: false,
  assignsRecruitmentIds: false,
  queriesDatabase: false,
  actionPlannerPhase: ACTION_PLANNER_PHASE
});

const PERSISTENCE_PLAN_DESCRIPTOR = Object.freeze({
  entity: PERSISTENCE_PLAN_ENTITY,
  domain: "recruitment",
  phase: PERSISTENCE_COORDINATOR_PHASE,
  description:
    "Deterministic dry-run persistence plan derived from an advisory recruitment action plan.",
  supportedOperations: Object.freeze(SUPPORTED_PERSISTENCE_OPERATIONS),
  actionOperationMapping: ACTION_TYPE_TO_PERSISTENCE_OPERATION,
  metadata: PERSISTENCE_PLAN_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const PLANNING_RATIONALE_BY_OPERATION = Object.freeze({
  [PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT]:
    "Action plan recommends attaching to an existing recruitment — dry-run maps to attach_recruitment.",
  [PERSISTENCE_OPERATIONS.MANUAL_REVIEW]:
    "Action plan requires manual review — dry-run maps to manual_review without writes.",
  [PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT]:
    "Action plan recommends creating a new recruitment — dry-run maps to create_recruitment.",
  [PERSISTENCE_OPERATIONS.SKIP]:
    "Action type is not mapped to a persistence operation — dry-run explicitly skips.",
  [PERSISTENCE_OPERATIONS.NONE]:
    "Action plan is ignore or unavailable — dry-run persistence operation is none."
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
 * @param {string} operation
 * @returns {boolean}
 */
function isPersistenceOperation(operation) {
  return typeof operation === "string" && SUPPORTED_PERSISTENCE_OPERATIONS.has(operation);
}

function resolveActionType(actionPlan) {
  const actionType = actionPlan?.actionType;
  return typeof actionType === "string" ? actionType : null;
}

function resolvePersistenceOperationForActionType(actionType) {
  if (actionType == null) {
    return DEFAULT_PERSISTENCE_OPERATION;
  }

  const mapped = ACTION_TYPE_TO_PERSISTENCE_OPERATION[actionType];
  if (isPersistenceOperation(mapped)) {
    return mapped;
  }

  return PERSISTENCE_OPERATIONS.SKIP;
}

function buildPlanningRationale(operation, actionType) {
  const base =
    PLANNING_RATIONALE_BY_OPERATION[operation] ?? PLANNING_RATIONALE_BY_OPERATION.none;
  return `${base} (action_type=${actionType ?? "unavailable"})`;
}

/**
 * Plan a deterministic dry-run persistence operation from an action plan.
 * Pure: no I/O, no side effects.
 *
 * @param {Object|null|undefined} actionPlan
 * @returns {string}
 */
function planRecruitmentPersistence(actionPlan) {
  try {
    if (!isPlainObject(actionPlan)) {
      return DEFAULT_PERSISTENCE_OPERATION;
    }

    const actionType = resolveActionType(actionPlan);
    if (actionType === ACTION_TYPES.IGNORE) {
      return PERSISTENCE_OPERATIONS.NONE;
    }

    const planValidation = validateRecruitmentActionPlan(actionPlan);
    if (!planValidation.valid && actionType !== ACTION_TYPES.IGNORE) {
      return actionType == null ? DEFAULT_PERSISTENCE_OPERATION : PERSISTENCE_OPERATIONS.SKIP;
    }

    return resolvePersistenceOperationForActionType(actionType);
  } catch {
    return DEFAULT_PERSISTENCE_OPERATION;
  }
}

/**
 * Create an immutable dry-run persistence plan from an action plan.
 * Pure: no persistence, no database access.
 *
 * @param {Object|null|undefined} actionPlan
 * @returns {Readonly<Object>|null}
 */
function createPersistencePlan(actionPlan) {
  try {
    const planValidation = isPlainObject(actionPlan)
      ? validateRecruitmentActionPlan(actionPlan)
      : buildValidationResult(["INVALID_ACTION_PLAN_SHAPE"]);
    const actionPlanSummary = summarizeRecruitmentActionPlan(
      isPlainObject(actionPlan) ? actionPlan : null
    );
    const actionType = isPlainObject(actionPlan) ? resolveActionType(actionPlan) : null;
    const persistenceOperation = planRecruitmentPersistence(actionPlan);
    const operationDescriptor =
      OPERATION_DESCRIPTOR[persistenceOperation] ?? OPERATION_DESCRIPTOR.none;

    return deepFreeze({
      phase: PERSISTENCE_COORDINATOR_PHASE,
      entity: PERSISTENCE_PLAN_ENTITY,
      dryRunOnly: true,
      descriptiveOnly: true,
      persistencePlanning: false,
      persistenceEnabled: false,
      performsPersistence: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false,
      actionPlannerPhase: ACTION_PLANNER_PHASE,
      actionPlanEntity: ACTION_PLAN_ENTITY,
      actionPlanValid: planValidation.valid,
      actionType,
      actionLabel: isPlainObject(actionPlan) ? (actionPlan.actionLabel ?? null) : null,
      matchCategory: isPlainObject(actionPlan) ? (actionPlan.matchCategory ?? null) : null,
      profileId: isPlainObject(actionPlan) ? (actionPlan.profileId ?? null) : null,
      reviewScenarioId: isPlainObject(actionPlan)
        ? (actionPlan.reviewScenarioId ?? null)
        : null,
      recommendsManualReview: isPlainObject(actionPlan)
        ? actionPlan.recommendsManualReview === true
        : true,
      persistenceOperation,
      operationLabel: operationDescriptor.label,
      planningRationale: buildPlanningRationale(persistenceOperation, actionType),
      actionOperationMapping: ACTION_TYPE_TO_PERSISTENCE_OPERATION,
      actionPlanSummary,
      planValidation: planValidation,
      metadata: deepFreeze({
        ...PERSISTENCE_PLAN_METADATA,
        createReason: planValidation.valid ? "action_plan" : "invalid_action_plan",
        actionPlanPhase: isPlainObject(actionPlan) ? actionPlan.phase : null,
        matchingResultValid: isPlainObject(actionPlan)
          ? actionPlan.matchingResultValid === true
          : false
      })
    });
  } catch {
    return null;
  }
}

/**
 * @param {*} plan
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validatePersistencePlan(plan) {
  const reasons = [];

  if (!isPlainObject(plan)) {
    return buildValidationResult(["INVALID_PLAN_SHAPE"]);
  }

  if (plan.phase !== PERSISTENCE_COORDINATOR_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (plan.entity !== PERSISTENCE_PLAN_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (!isPersistenceOperation(plan.persistenceOperation)) {
    reasons.push("INVALID_PERSISTENCE_OPERATION");
  }

  if (plan.dryRunOnly !== true) {
    reasons.push("DRY_RUN_ONLY_MUST_BE_TRUE");
  }

  if (plan.persistencePlanning !== false || plan.performsPersistence !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (plan.assignsRecruitmentIds !== false || plan.queriesDatabase !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (plan.persistenceEnabled !== false || plan.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (plan.actionPlannerPhase !== ACTION_PLANNER_PHASE) {
    reasons.push("INVALID_ACTION_PLANNER_PHASE");
  }

  if (typeof plan.planningRationale !== "string" || plan.planningRationale.trim() === "") {
    reasons.push("MISSING_PLANNING_RATIONALE");
  }

  if (typeof plan.actionPlanValid !== "boolean") {
    reasons.push("INVALID_ACTION_PLAN_VALID_FLAG");
  }

  if (plan.actionPlanValid === true && plan.actionType != null) {
    const expectedOperation = resolvePersistenceOperationForActionType(plan.actionType);
    if (plan.persistenceOperation !== expectedOperation) {
      reasons.push("OPERATION_INCONSISTENT_WITH_ACTION_TYPE");
    }
  }

  if (plan.actionPlanValid === false && plan.actionType === ACTION_TYPES.IGNORE) {
    if (plan.persistenceOperation !== PERSISTENCE_OPERATIONS.NONE) {
      reasons.push("INVALID_INPUT_IGNORE_MUST_MAP_TO_NONE");
    }
  }

  if (
    plan.persistenceOperation === PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT &&
    plan.actionType !== ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT
  ) {
    reasons.push("ATTACH_OPERATION_ACTION_TYPE_MISMATCH");
  }

  if (
    plan.persistenceOperation === PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT &&
    plan.actionType !== ACTION_TYPES.CREATE_NEW_RECRUITMENT
  ) {
    reasons.push("CREATE_OPERATION_ACTION_TYPE_MISMATCH");
  }

  if (
    plan.persistenceOperation === PERSISTENCE_OPERATIONS.MANUAL_REVIEW &&
    plan.actionType !== ACTION_TYPES.MANUAL_REVIEW
  ) {
    reasons.push("MANUAL_REVIEW_OPERATION_ACTION_TYPE_MISMATCH");
  }

  if (!isPlainObject(plan.actionPlanSummary)) {
    reasons.push("MISSING_ACTION_PLAN_SUMMARY");
  }

  if (!isPlainObject(plan.metadata)) {
    reasons.push("MISSING_METADATA");
  }

  if (!isPlainObject(plan.planValidation)) {
    reasons.push("MISSING_PLAN_VALIDATION");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} plan
 * @returns {Readonly<Object>}
 */
function summarizePersistencePlan(plan) {
  const validation = validatePersistencePlan(plan);
  if (!validation.valid) {
    return Object.freeze({
      phase: PERSISTENCE_COORDINATOR_PHASE,
      entity: PERSISTENCE_PLAN_ENTITY,
      valid: false,
      persistenceOperation: DEFAULT_PERSISTENCE_OPERATION,
      actionType: null,
      dryRunOnly: true,
      persistencePlanning: false,
      persistenceEnabled: false,
      performsPersistence: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false
    });
  }

  return Object.freeze({
    phase: plan.phase,
    entity: plan.entity,
    valid: true,
    persistenceOperation: plan.persistenceOperation,
    operationLabel: plan.operationLabel,
    actionType: plan.actionType,
    actionLabel: plan.actionLabel,
    matchCategory: plan.matchCategory,
    profileId: plan.profileId,
    reviewScenarioId: plan.reviewScenarioId,
    recommendsManualReview: plan.recommendsManualReview,
    actionPlanValid: plan.actionPlanValid,
    planningRationale: plan.planningRationale,
    dryRunOnly: true,
    persistencePlanning: false,
    persistenceEnabled: false,
    performsPersistence: false,
    assignsRecruitmentIds: false,
    queriesDatabase: false
  });
}

module.exports = {
  PERSISTENCE_COORDINATOR_PHASE,
  PERSISTENCE_PLAN_ENTITY,
  PERSISTENCE_OPERATIONS,
  SUPPORTED_PERSISTENCE_OPERATIONS,
  DEFAULT_PERSISTENCE_OPERATION,
  ACTION_TYPE_TO_PERSISTENCE_OPERATION,
  OPERATION_DESCRIPTOR,
  PERSISTENCE_PLAN_DESCRIPTOR,
  PERSISTENCE_PLAN_METADATA,
  VALIDATION_STATUS,
  isPersistenceOperation,
  planRecruitmentPersistence,
  createPersistencePlan,
  validatePersistencePlan,
  summarizePersistencePlan
};
