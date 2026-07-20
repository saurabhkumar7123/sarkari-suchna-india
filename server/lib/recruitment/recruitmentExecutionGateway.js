"use strict";

/**
 * Phase 75 — Recruitment Execution Gateway (Feature-Gated).
 *
 * Converts immutable Persistence Plans into immutable Execution Decisions using
 * deterministic operation-to-decision mapping. Does not execute persistence,
 * perform writes, or access databases.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  PERSISTENCE_COORDINATOR_PHASE,
  PERSISTENCE_PLAN_ENTITY,
  PERSISTENCE_OPERATIONS,
  DEFAULT_PERSISTENCE_OPERATION,
  validatePersistencePlan,
  summarizePersistencePlan
} = require("./recruitmentPersistenceCoordinator");

const EXECUTION_GATEWAY_PHASE = 75;

const EXECUTION_DECISION_ENTITY = "recruitment_execution_decision";

const EXECUTION_DECISIONS = Object.freeze({
  ALLOWED: "allowed",
  BLOCKED: "blocked",
  DRY_RUN: "dry_run",
  MANUAL_REVIEW: "manual_review"
});

const SUPPORTED_EXECUTION_DECISIONS = Object.freeze(
  new Set(Object.values(EXECUTION_DECISIONS))
);

const DEFAULT_EXECUTION_DECISION = EXECUTION_DECISIONS.BLOCKED;

const PERSISTENCE_OPERATION_TO_EXECUTION_DECISION = Object.freeze({
  [PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT]: EXECUTION_DECISIONS.DRY_RUN,
  [PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT]: EXECUTION_DECISIONS.DRY_RUN,
  [PERSISTENCE_OPERATIONS.MANUAL_REVIEW]: EXECUTION_DECISIONS.MANUAL_REVIEW,
  [PERSISTENCE_OPERATIONS.SKIP]: EXECUTION_DECISIONS.BLOCKED,
  [PERSISTENCE_OPERATIONS.NONE]: EXECUTION_DECISIONS.BLOCKED
});

const DECISION_DESCRIPTOR = Object.freeze({
  allowed: Object.freeze({
    id: EXECUTION_DECISIONS.ALLOWED,
    label: "Allowed",
    description:
      "Execution is eligible in principle but remains feature-gated — no writes are performed.",
    executionAllowed: false,
    dryRun: true,
    performsPersistence: false
  }),
  blocked: Object.freeze({
    id: EXECUTION_DECISIONS.BLOCKED,
    label: "Blocked",
    description:
      "Execution is blocked — persistence operation is skip, none, or unmapped.",
    executionAllowed: false,
    dryRun: true,
    performsPersistence: false
  }),
  dry_run: Object.freeze({
    id: EXECUTION_DECISIONS.DRY_RUN,
    label: "Dry Run",
    description:
      "Dry-run execution decision for create or attach persistence operations — no writes.",
    executionAllowed: false,
    dryRun: true,
    performsPersistence: false
  }),
  manual_review: Object.freeze({
    id: EXECUTION_DECISIONS.MANUAL_REVIEW,
    label: "Manual Review",
    description:
      "Execution deferred to manual review — no automatic persistence.",
    executionAllowed: false,
    dryRun: true,
    performsPersistence: false
  })
});

const EXECUTION_DECISION_METADATA = Object.freeze({
  phase: EXECUTION_GATEWAY_PHASE,
  featureGated: true,
  executionAllowed: false,
  dryRun: true,
  descriptiveOnly: true,
  architectureOnly: false,
  runtimeIntegration: true,
  persistenceExecution: false,
  persistenceEnabled: false,
  performsPersistence: false,
  sideEffects: false,
  assignsRecruitmentIds: false,
  queriesDatabase: false,
  persistenceCoordinatorPhase: PERSISTENCE_COORDINATOR_PHASE
});

const EXECUTION_DECISION_DESCRIPTOR = Object.freeze({
  entity: EXECUTION_DECISION_ENTITY,
  domain: "recruitment",
  phase: EXECUTION_GATEWAY_PHASE,
  description:
    "Deterministic feature-gated execution decision derived from a dry-run persistence plan.",
  supportedDecisions: Object.freeze(SUPPORTED_EXECUTION_DECISIONS),
  operationDecisionMapping: PERSISTENCE_OPERATION_TO_EXECUTION_DECISION,
  metadata: EXECUTION_DECISION_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const ELIGIBILITY_RATIONALE_BY_DECISION = Object.freeze({
  [EXECUTION_DECISIONS.DRY_RUN]:
    "Persistence plan maps to create or attach — feature-gated dry_run decision without writes.",
  [EXECUTION_DECISIONS.MANUAL_REVIEW]:
    "Persistence plan requires manual review — execution decision is manual_review.",
  [EXECUTION_DECISIONS.BLOCKED]:
    "Persistence plan is skip, none, or unmapped — execution decision is blocked.",
  [EXECUTION_DECISIONS.ALLOWED]:
    "Execution eligibility is allowed in principle but remains feature-gated."
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
 * @param {string} decision
 * @returns {boolean}
 */
function isExecutionDecision(decision) {
  return typeof decision === "string" && SUPPORTED_EXECUTION_DECISIONS.has(decision);
}

function resolvePersistenceOperation(persistencePlan) {
  const operation = persistencePlan?.persistenceOperation;
  return typeof operation === "string" ? operation : null;
}

function resolveExecutionDecisionForOperation(operation) {
  if (operation == null) {
    return DEFAULT_EXECUTION_DECISION;
  }

  const mapped = PERSISTENCE_OPERATION_TO_EXECUTION_DECISION[operation];
  if (isExecutionDecision(mapped)) {
    return mapped;
  }

  return DEFAULT_EXECUTION_DECISION;
}

function buildEligibilityRationale(decision, persistenceOperation) {
  const base =
    ELIGIBILITY_RATIONALE_BY_DECISION[decision] ??
    ELIGIBILITY_RATIONALE_BY_DECISION[DEFAULT_EXECUTION_DECISION];
  return `${base} (persistence_operation=${persistenceOperation ?? "unavailable"})`;
}

/**
 * Evaluate deterministic execution eligibility from a persistence plan.
 * Pure: no I/O, no side effects.
 *
 * @param {Object|null|undefined} persistencePlan
 * @returns {string}
 */
function evaluateExecutionEligibility(persistencePlan) {
  try {
    if (!isPlainObject(persistencePlan)) {
      return DEFAULT_EXECUTION_DECISION;
    }

    const persistenceOperation = resolvePersistenceOperation(persistencePlan);
    if (persistenceOperation == null) {
      return DEFAULT_EXECUTION_DECISION;
    }

    return resolveExecutionDecisionForOperation(persistenceOperation);
  } catch {
    return DEFAULT_EXECUTION_DECISION;
  }
}

/**
 * Create an immutable feature-gated execution decision from a persistence plan.
 * Pure: no persistence execution, no database access.
 *
 * @param {Object|null|undefined} persistencePlan
 * @returns {Readonly<Object>|null}
 */
function createExecutionDecision(persistencePlan) {
  try {
    const planValidation = isPlainObject(persistencePlan)
      ? validatePersistencePlan(persistencePlan)
      : buildValidationResult(["INVALID_PERSISTENCE_PLAN_SHAPE"]);
    const persistencePlanSummary = summarizePersistencePlan(
      isPlainObject(persistencePlan) ? persistencePlan : null
    );
    const persistenceOperation = isPlainObject(persistencePlan)
      ? resolvePersistenceOperation(persistencePlan)
      : null;
    const executionDecision = evaluateExecutionEligibility(persistencePlan);
    const decisionDescriptor =
      DECISION_DESCRIPTOR[executionDecision] ?? DECISION_DESCRIPTOR.blocked;

    return deepFreeze({
      phase: EXECUTION_GATEWAY_PHASE,
      entity: EXECUTION_DECISION_ENTITY,
      featureGated: true,
      executionAllowed: false,
      dryRun: true,
      descriptiveOnly: true,
      persistenceExecution: false,
      persistenceEnabled: false,
      performsPersistence: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false,
      persistenceCoordinatorPhase: PERSISTENCE_COORDINATOR_PHASE,
      persistencePlanEntity: PERSISTENCE_PLAN_ENTITY,
      persistencePlanValid: planValidation.valid,
      persistenceOperation: persistenceOperation ?? DEFAULT_PERSISTENCE_OPERATION,
      actionType: isPlainObject(persistencePlan) ? (persistencePlan.actionType ?? null) : null,
      actionLabel: isPlainObject(persistencePlan) ? (persistencePlan.actionLabel ?? null) : null,
      matchCategory: isPlainObject(persistencePlan)
        ? (persistencePlan.matchCategory ?? null)
        : null,
      profileId: isPlainObject(persistencePlan) ? (persistencePlan.profileId ?? null) : null,
      reviewScenarioId: isPlainObject(persistencePlan)
        ? (persistencePlan.reviewScenarioId ?? null)
        : null,
      recommendsManualReview: isPlainObject(persistencePlan)
        ? persistencePlan.recommendsManualReview === true
        : true,
      executionDecision,
      decisionLabel: decisionDescriptor.label,
      eligibilityRationale: buildEligibilityRationale(executionDecision, persistenceOperation),
      operationDecisionMapping: PERSISTENCE_OPERATION_TO_EXECUTION_DECISION,
      persistencePlanSummary,
      planValidation: planValidation,
      metadata: deepFreeze({
        ...EXECUTION_DECISION_METADATA,
        createReason: planValidation.valid ? "persistence_plan" : "invalid_persistence_plan",
        persistencePlanPhase: isPlainObject(persistencePlan) ? persistencePlan.phase : null,
        actionPlanValid: isPlainObject(persistencePlan)
          ? persistencePlan.actionPlanValid === true
          : false
      })
    });
  } catch {
    return null;
  }
}

/**
 * @param {*} decision
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateExecutionDecision(decision) {
  const reasons = [];

  if (!isPlainObject(decision)) {
    return buildValidationResult(["INVALID_DECISION_SHAPE"]);
  }

  if (decision.phase !== EXECUTION_GATEWAY_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (decision.entity !== EXECUTION_DECISION_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (!isExecutionDecision(decision.executionDecision)) {
    reasons.push("INVALID_EXECUTION_DECISION");
  }

  if (decision.executionAllowed !== false) {
    reasons.push("EXECUTION_ALLOWED_MUST_BE_FALSE");
  }

  if (decision.dryRun !== true) {
    reasons.push("DRY_RUN_MUST_BE_TRUE");
  }

  if (decision.persistenceExecution !== false || decision.performsPersistence !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (decision.assignsRecruitmentIds !== false || decision.queriesDatabase !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (decision.persistenceEnabled !== false || decision.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (decision.featureGated !== true) {
    reasons.push("FEATURE_GATED_MUST_BE_TRUE");
  }

  if (decision.persistenceCoordinatorPhase !== PERSISTENCE_COORDINATOR_PHASE) {
    reasons.push("INVALID_PERSISTENCE_COORDINATOR_PHASE");
  }

  if (
    typeof decision.eligibilityRationale !== "string" ||
    decision.eligibilityRationale.trim() === ""
  ) {
    reasons.push("MISSING_ELIGIBILITY_RATIONALE");
  }

  if (typeof decision.persistencePlanValid !== "boolean") {
    reasons.push("INVALID_PERSISTENCE_PLAN_VALID_FLAG");
  }

  if (decision.persistencePlanValid === true && decision.persistenceOperation != null) {
    const expectedDecision = resolveExecutionDecisionForOperation(decision.persistenceOperation);
    if (decision.executionDecision !== expectedDecision) {
      reasons.push("DECISION_INCONSISTENT_WITH_PERSISTENCE_OPERATION");
    }
  }

  if (
    decision.executionDecision === EXECUTION_DECISIONS.DRY_RUN &&
    decision.persistenceOperation !== PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT &&
    decision.persistenceOperation !== PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT
  ) {
    reasons.push("DRY_RUN_OPERATION_MISMATCH");
  }

  if (
    decision.executionDecision === EXECUTION_DECISIONS.MANUAL_REVIEW &&
    decision.persistenceOperation !== PERSISTENCE_OPERATIONS.MANUAL_REVIEW
  ) {
    reasons.push("MANUAL_REVIEW_OPERATION_MISMATCH");
  }

  if (
    decision.executionDecision === EXECUTION_DECISIONS.BLOCKED &&
    decision.persistenceOperation !== PERSISTENCE_OPERATIONS.SKIP &&
    decision.persistenceOperation !== PERSISTENCE_OPERATIONS.NONE
  ) {
    reasons.push("BLOCKED_OPERATION_MISMATCH");
  }

  if (!isPlainObject(decision.persistencePlanSummary)) {
    reasons.push("MISSING_PERSISTENCE_PLAN_SUMMARY");
  }

  if (!isPlainObject(decision.metadata)) {
    reasons.push("MISSING_METADATA");
  }

  if (!isPlainObject(decision.planValidation)) {
    reasons.push("MISSING_PLAN_VALIDATION");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} decision
 * @returns {Readonly<Object>}
 */
function summarizeExecutionDecision(decision) {
  const validation = validateExecutionDecision(decision);
  if (!validation.valid) {
    return Object.freeze({
      phase: EXECUTION_GATEWAY_PHASE,
      entity: EXECUTION_DECISION_ENTITY,
      valid: false,
      executionDecision: DEFAULT_EXECUTION_DECISION,
      persistenceOperation: DEFAULT_PERSISTENCE_OPERATION,
      actionType: null,
      executionAllowed: false,
      dryRun: true,
      featureGated: true,
      persistenceExecution: false,
      persistenceEnabled: false,
      performsPersistence: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false
    });
  }

  return Object.freeze({
    phase: decision.phase,
    entity: decision.entity,
    valid: true,
    executionDecision: decision.executionDecision,
    decisionLabel: decision.decisionLabel,
    persistenceOperation: decision.persistenceOperation,
    actionType: decision.actionType,
    actionLabel: decision.actionLabel,
    matchCategory: decision.matchCategory,
    profileId: decision.profileId,
    reviewScenarioId: decision.reviewScenarioId,
    recommendsManualReview: decision.recommendsManualReview,
    persistencePlanValid: decision.persistencePlanValid,
    eligibilityRationale: decision.eligibilityRationale,
    executionAllowed: false,
    dryRun: true,
    featureGated: true,
    persistenceExecution: false,
    persistenceEnabled: false,
    performsPersistence: false,
    assignsRecruitmentIds: false,
    queriesDatabase: false
  });
}

module.exports = {
  EXECUTION_GATEWAY_PHASE,
  EXECUTION_DECISION_ENTITY,
  EXECUTION_DECISIONS,
  SUPPORTED_EXECUTION_DECISIONS,
  DEFAULT_EXECUTION_DECISION,
  PERSISTENCE_OPERATION_TO_EXECUTION_DECISION,
  DECISION_DESCRIPTOR,
  EXECUTION_DECISION_DESCRIPTOR,
  EXECUTION_DECISION_METADATA,
  VALIDATION_STATUS,
  isExecutionDecision,
  evaluateExecutionEligibility,
  createExecutionDecision,
  validateExecutionDecision,
  summarizeExecutionDecision
};
