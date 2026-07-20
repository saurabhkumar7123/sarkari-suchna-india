"use strict";

/**
 * Phase 72 — Recruitment Action Planner (Phase 1).
 *
 * Converts Matching Results into immutable advisory Action Plans using
 * deterministic category-to-action mapping. Does not execute lifecycle
 * actions, assign recruitment IDs, or perform persistence.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  MATCHING_ENGINE_PHASE,
  MATCHING_RESULT_ENTITY,
  validateMatchingResult,
  summarizeMatchingResult
} = require("./recruitmentMatchingEngine");

const {
  MATCH_CATEGORIES,
  DEFAULT_MATCH_CATEGORY,
  isMatchCategory
} = require("./recruitmentMatchingContracts");

const ACTION_PLANNER_PHASE = 72;

const ACTION_PLAN_ENTITY = "recruitment_action_plan";

const ACTION_TYPES = Object.freeze({
  CREATE_NEW_RECRUITMENT: "create_new_recruitment",
  ATTACH_EXISTING_RECRUITMENT: "attach_existing_recruitment",
  MANUAL_REVIEW: "manual_review",
  IGNORE: "ignore"
});

const SUPPORTED_ACTION_TYPES = Object.freeze(new Set(Object.values(ACTION_TYPES)));

const DEFAULT_ACTION_TYPE = ACTION_TYPES.IGNORE;

const MATCH_CATEGORY_TO_ACTION = Object.freeze({
  [MATCH_CATEGORIES.EXACT_MATCH]: ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT,
  [MATCH_CATEGORIES.STRONG_MATCH]: ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT,
  [MATCH_CATEGORIES.PROBABLE_MATCH]: ACTION_TYPES.MANUAL_REVIEW,
  [MATCH_CATEGORIES.WEAK_MATCH]: ACTION_TYPES.MANUAL_REVIEW,
  [MATCH_CATEGORIES.MANUAL_REVIEW]: ACTION_TYPES.MANUAL_REVIEW,
  [MATCH_CATEGORIES.NO_MATCH]: ACTION_TYPES.CREATE_NEW_RECRUITMENT
});

const ACTION_TYPE_DESCRIPTOR = Object.freeze({
  create_new_recruitment: Object.freeze({
    id: ACTION_TYPES.CREATE_NEW_RECRUITMENT,
    label: "Create New Recruitment",
    description:
      "Advisory recommendation to create a new recruitment record when no shared identity match exists.",
    lifecycleExecution: false
  }),
  attach_existing_recruitment: Object.freeze({
    id: ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT,
    label: "Attach Existing Recruitment",
    description:
      "Advisory recommendation to attach the update to an existing recruitment when match confidence is high.",
    lifecycleExecution: false
  }),
  manual_review: Object.freeze({
    id: ACTION_TYPES.MANUAL_REVIEW,
    label: "Manual Review",
    description:
      "Advisory recommendation to route the update to manual review before lifecycle action.",
    lifecycleExecution: false
  }),
  ignore: Object.freeze({
    id: ACTION_TYPES.IGNORE,
    label: "Ignore",
    description:
      "Advisory recommendation to take no lifecycle action — used when planning input is invalid or inconclusive.",
    lifecycleExecution: false
  })
});

const ACTION_PLAN_METADATA = Object.freeze({
  phase: ACTION_PLANNER_PHASE,
  descriptiveOnly: true,
  architectureOnly: false,
  runtimeIntegration: true,
  actionPlanning: false,
  lifecycleExecution: false,
  persistenceEnabled: false,
  sideEffects: false,
  matchingEnginePhase: MATCHING_ENGINE_PHASE,
  assignsRecruitmentIds: false,
  queriesDatabase: false,
  performsPersistence: false
});

const ACTION_PLAN_DESCRIPTOR = Object.freeze({
  entity: ACTION_PLAN_ENTITY,
  domain: "recruitment",
  phase: ACTION_PLANNER_PHASE,
  description:
    "Deterministic advisory action plan derived from a recruitment matching result.",
  supportedActionTypes: Object.freeze(SUPPORTED_ACTION_TYPES),
  categoryActionMapping: MATCH_CATEGORY_TO_ACTION,
  metadata: ACTION_PLAN_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const PLANNING_RATIONALE_BY_ACTION = Object.freeze({
  [ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT]:
    "High-confidence match category supports attaching to an existing recruitment.",
  [ACTION_TYPES.MANUAL_REVIEW]:
    "Match category or identity signals require human review before lifecycle action.",
  [ACTION_TYPES.CREATE_NEW_RECRUITMENT]:
    "No shared identity match — advisory plan recommends creating a new recruitment.",
  [ACTION_TYPES.IGNORE]:
    "Matching result unavailable or invalid — no advisory lifecycle action recommended."
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
 * @param {string} actionType
 * @returns {boolean}
 */
function isActionType(actionType) {
  return typeof actionType === "string" && SUPPORTED_ACTION_TYPES.has(actionType);
}

function resolveMatchCategory(matchingResult) {
  const category = matchingResult?.matchCategory;
  if (isMatchCategory(category)) {
    return category;
  }
  return DEFAULT_MATCH_CATEGORY;
}

function resolveActionTypeForCategory(matchCategory) {
  const actionType = MATCH_CATEGORY_TO_ACTION[matchCategory];
  return isActionType(actionType) ? actionType : DEFAULT_ACTION_TYPE;
}

function buildPlanningRationale(actionType, matchCategory) {
  const base = PLANNING_RATIONALE_BY_ACTION[actionType] ?? PLANNING_RATIONALE_BY_ACTION.ignore;
  return `${base} (match_category=${matchCategory})`;
}

/**
 * Plan a deterministic advisory action type from a matching result.
 * Pure: no I/O, no side effects.
 *
 * @param {Object|null|undefined} matchingResult
 * @returns {string}
 */
function planRecruitmentAction(matchingResult) {
  try {
    const validation = validateMatchingResult(matchingResult);
    if (!validation.valid) {
      return ACTION_TYPES.IGNORE;
    }

    const matchCategory = resolveMatchCategory(matchingResult);
    return resolveActionTypeForCategory(matchCategory);
  } catch {
    return ACTION_TYPES.IGNORE;
  }
}

/**
 * Create an immutable action plan from a matching result.
 * Pure: no persistence, no lifecycle execution.
 *
 * @param {Object|null|undefined} matchingResult
 * @returns {Readonly<Object>|null}
 */
function createRecruitmentActionPlan(matchingResult) {
  try {
    const validation = validateMatchingResult(matchingResult);
    const matchingSummary = summarizeMatchingResult(matchingResult);
    const matchCategory = validation.valid
      ? resolveMatchCategory(matchingResult)
      : DEFAULT_MATCH_CATEGORY;
    const actionType = validation.valid
      ? resolveActionTypeForCategory(matchCategory)
      : ACTION_TYPES.IGNORE;
    const actionDescriptor = ACTION_TYPE_DESCRIPTOR[actionType] ?? ACTION_TYPE_DESCRIPTOR.ignore;

    return deepFreeze({
      phase: ACTION_PLANNER_PHASE,
      entity: ACTION_PLAN_ENTITY,
      descriptiveOnly: true,
      actionPlanning: false,
      lifecycleExecution: false,
      persistenceEnabled: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false,
      performsPersistence: false,
      matchingEnginePhase: MATCHING_ENGINE_PHASE,
      matchingResultEntity: MATCHING_RESULT_ENTITY,
      matchingResultValid: validation.valid,
      matchCategory,
      actionType,
      actionLabel: actionDescriptor.label,
      profileId: validation.valid ? (matchingResult.profileId ?? null) : null,
      reviewScenarioId: validation.valid ? (matchingResult.reviewScenarioId ?? null) : null,
      recommendsManualReview: validation.valid
        ? matchingResult.recommendsManualReview === true
        : true,
      planningRationale: buildPlanningRationale(actionType, matchCategory),
      categoryActionMapping: MATCH_CATEGORY_TO_ACTION,
      matchingSummary,
      metadata: deepFreeze({
        ...ACTION_PLAN_METADATA,
        createReason: validation.valid ? "matching_result" : "invalid_matching_result",
        matchingResultPhase: validation.valid ? matchingResult.phase : null,
        resolutionState: validation.valid ? (matchingResult.resolutionState ?? null) : null
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
function validateRecruitmentActionPlan(plan) {
  const reasons = [];

  if (!isPlainObject(plan)) {
    return buildValidationResult(["INVALID_PLAN_SHAPE"]);
  }

  if (plan.phase !== ACTION_PLANNER_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (plan.entity !== ACTION_PLAN_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (!isActionType(plan.actionType)) {
    reasons.push("INVALID_ACTION_TYPE");
  }

  if (!isMatchCategory(plan.matchCategory)) {
    reasons.push("INVALID_MATCH_CATEGORY");
  }

  if (plan.actionPlanning !== false || plan.lifecycleExecution !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (plan.assignsRecruitmentIds !== false || plan.queriesDatabase !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (plan.persistenceEnabled !== false || plan.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (plan.matchingEnginePhase !== MATCHING_ENGINE_PHASE) {
    reasons.push("INVALID_MATCHING_ENGINE_PHASE");
  }

  if (typeof plan.planningRationale !== "string" || plan.planningRationale.trim() === "") {
    reasons.push("MISSING_PLANNING_RATIONALE");
  }

  if (typeof plan.matchingResultValid !== "boolean") {
    reasons.push("INVALID_MATCHING_RESULT_VALID_FLAG");
  }

  const expectedAction = resolveActionTypeForCategory(plan.matchCategory);
  if (plan.matchingResultValid === true && plan.actionType !== expectedAction) {
    reasons.push("ACTION_TYPE_INCONSISTENT_WITH_CATEGORY");
  }

  if (plan.matchingResultValid === false && plan.actionType !== ACTION_TYPES.IGNORE) {
    reasons.push("INVALID_INPUT_MUST_MAP_TO_IGNORE");
  }

  if (
    plan.actionType === ACTION_TYPES.MANUAL_REVIEW &&
    plan.matchCategory !== MATCH_CATEGORIES.MANUAL_REVIEW &&
    plan.matchCategory !== MATCH_CATEGORIES.PROBABLE_MATCH &&
    plan.matchCategory !== MATCH_CATEGORIES.WEAK_MATCH
  ) {
    reasons.push("MANUAL_REVIEW_ACTION_CATEGORY_MISMATCH");
  }

  if (
    plan.actionType === ACTION_TYPES.ATTACH_EXISTING_RECRUITMENT &&
    plan.matchCategory !== MATCH_CATEGORIES.EXACT_MATCH &&
    plan.matchCategory !== MATCH_CATEGORIES.STRONG_MATCH
  ) {
    reasons.push("ATTACH_ACTION_CATEGORY_MISMATCH");
  }

  if (
    plan.actionType === ACTION_TYPES.CREATE_NEW_RECRUITMENT &&
    plan.matchCategory !== MATCH_CATEGORIES.NO_MATCH
  ) {
    reasons.push("CREATE_ACTION_CATEGORY_MISMATCH");
  }

  if (!isPlainObject(plan.matchingSummary)) {
    reasons.push("MISSING_MATCHING_SUMMARY");
  }

  if (!isPlainObject(plan.metadata)) {
    reasons.push("MISSING_METADATA");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} plan
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentActionPlan(plan) {
  const validation = validateRecruitmentActionPlan(plan);
  if (!validation.valid) {
    return Object.freeze({
      phase: ACTION_PLANNER_PHASE,
      entity: ACTION_PLAN_ENTITY,
      valid: false,
      actionType: DEFAULT_ACTION_TYPE,
      matchCategory: DEFAULT_MATCH_CATEGORY,
      recommendsManualReview: true,
      actionPlanning: false,
      lifecycleExecution: false,
      persistenceEnabled: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false
    });
  }

  return Object.freeze({
    phase: plan.phase,
    entity: plan.entity,
    valid: true,
    actionType: plan.actionType,
    actionLabel: plan.actionLabel,
    matchCategory: plan.matchCategory,
    profileId: plan.profileId,
    reviewScenarioId: plan.reviewScenarioId,
    recommendsManualReview: plan.recommendsManualReview,
    matchingResultValid: plan.matchingResultValid,
    planningRationale: plan.planningRationale,
    actionPlanning: false,
    lifecycleExecution: false,
    persistenceEnabled: false,
    assignsRecruitmentIds: false,
    queriesDatabase: false
  });
}

module.exports = {
  ACTION_PLANNER_PHASE,
  ACTION_PLAN_ENTITY,
  ACTION_TYPES,
  SUPPORTED_ACTION_TYPES,
  DEFAULT_ACTION_TYPE,
  MATCH_CATEGORY_TO_ACTION,
  ACTION_TYPE_DESCRIPTOR,
  ACTION_PLAN_DESCRIPTOR,
  ACTION_PLAN_METADATA,
  VALIDATION_STATUS,
  isActionType,
  planRecruitmentAction,
  createRecruitmentActionPlan,
  validateRecruitmentActionPlan,
  summarizeRecruitmentActionPlan
};
