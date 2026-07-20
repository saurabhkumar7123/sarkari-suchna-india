"use strict";

/**
 * Phase 76 — Recruitment Persistence Engine (Feature-Gated).
 *
 * Consumes immutable Execution Decisions and produces immutable Persistence
 * Execution Results using deterministic, feature-gated logic. Defaults to
 * dry_run mode with executed false — no database writes in dry_run.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  EXECUTION_GATEWAY_PHASE,
  EXECUTION_DECISION_ENTITY,
  EXECUTION_DECISIONS,
  DEFAULT_EXECUTION_DECISION,
  validateExecutionDecision,
  summarizeExecutionDecision
} = require("./recruitmentExecutionGateway");

const {
  PERSISTENCE_OPERATIONS,
  DEFAULT_PERSISTENCE_OPERATION
} = require("./recruitmentPersistenceCoordinator");

const PERSISTENCE_ENGINE_PHASE = 76;

const PERSISTENCE_EXECUTION_RESULT_ENTITY = "recruitment_persistence_execution_result";

const EXECUTION_MODES = Object.freeze({
  DRY_RUN: "dry_run",
  ENABLED: "enabled"
});

const SUPPORTED_EXECUTION_MODES = Object.freeze(new Set(Object.values(EXECUTION_MODES)));

const DEFAULT_EXECUTION_MODE = EXECUTION_MODES.DRY_RUN;

const SUPPORTED_PLANNED_OPERATIONS = Object.freeze(
  new Set([
    PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT,
    PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT
  ])
);

const EXECUTION_OUTCOMES = Object.freeze({
  DRY_RUN_SIMULATED: "dry_run_simulated",
  FEATURE_GATE_BLOCKED: "feature_gate_blocked",
  SKIPPED: "skipped",
  INVALID_DECISION: "invalid_decision",
  UNSUPPORTED_OPERATION: "unsupported_operation"
});

const DEFAULT_EXECUTION_OUTCOME = EXECUTION_OUTCOMES.SKIPPED;

const EXECUTION_DECISION_TO_PLANNED_OPERATION = Object.freeze({
  [EXECUTION_DECISIONS.DRY_RUN]: Object.freeze({
    [PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT]: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT,
    [PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT]: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT
  })
});

const PLANNED_OPERATION_DESCRIPTOR = Object.freeze({
  create_recruitment: Object.freeze({
    id: PERSISTENCE_OPERATIONS.CREATE_RECRUITMENT,
    label: "Create Recruitment",
    description:
      "Planned persistence operation to create a new recruitment record — feature-gated, dry-run by default.",
    supported: true,
    performsPersistence: false
  }),
  attach_recruitment: Object.freeze({
    id: PERSISTENCE_OPERATIONS.ATTACH_RECRUITMENT,
    label: "Attach Recruitment",
    description:
      "Planned persistence operation to attach an update to an existing recruitment — feature-gated, dry-run by default.",
    supported: true,
    performsPersistence: false
  })
});

const PERSISTENCE_EXECUTION_METADATA = Object.freeze({
  phase: PERSISTENCE_ENGINE_PHASE,
  featureGated: true,
  featureGateOpen: false,
  executionMode: DEFAULT_EXECUTION_MODE,
  executed: false,
  descriptiveOnly: true,
  architectureOnly: false,
  runtimeIntegration: true,
  persistenceExecution: false,
  persistenceEnabled: false,
  performsPersistence: false,
  sideEffects: false,
  assignsRecruitmentIds: false,
  queriesDatabase: false,
  executionGatewayPhase: EXECUTION_GATEWAY_PHASE
});

const PERSISTENCE_EXECUTION_RESULT_DESCRIPTOR = Object.freeze({
  entity: PERSISTENCE_EXECUTION_RESULT_ENTITY,
  domain: "recruitment",
  phase: PERSISTENCE_ENGINE_PHASE,
  description:
    "Deterministic feature-gated persistence execution result derived from an execution decision.",
  supportedExecutionModes: Object.freeze(SUPPORTED_EXECUTION_MODES),
  supportedPlannedOperations: Object.freeze(SUPPORTED_PLANNED_OPERATIONS),
  plannedOperationDescriptors: PLANNED_OPERATION_DESCRIPTOR,
  metadata: PERSISTENCE_EXECUTION_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const OUTCOME_RATIONALE_BY_OUTCOME = Object.freeze({
  [EXECUTION_OUTCOMES.DRY_RUN_SIMULATED]:
    "Execution decision is dry_run with a supported planned operation — simulated without writes.",
  [EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED]:
    "Execution mode is enabled but feature gate remains closed — no writes performed.",
  [EXECUTION_OUTCOMES.SKIPPED]:
    "Execution decision does not map to a supported planned operation — persistence skipped.",
  [EXECUTION_OUTCOMES.INVALID_DECISION]:
    "Execution decision is invalid or unavailable — persistence execution skipped.",
  [EXECUTION_OUTCOMES.UNSUPPORTED_OPERATION]:
    "Persistence operation is not in the supported planned operations set — skipped."
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
 * @param {string} mode
 * @returns {boolean}
 */
function isExecutionMode(mode) {
  return typeof mode === "string" && SUPPORTED_EXECUTION_MODES.has(mode);
}

/**
 * @param {string} operation
 * @returns {boolean}
 */
function isPlannedOperation(operation) {
  return typeof operation === "string" && SUPPORTED_PLANNED_OPERATIONS.has(operation);
}

function normalizeExecutionMode(mode) {
  return isExecutionMode(mode) ? mode : DEFAULT_EXECUTION_MODE;
}

function resolvePersistenceOperation(decision) {
  const operation = decision?.persistenceOperation;
  return typeof operation === "string" ? operation : null;
}

function resolvePlannedOperation(decision) {
  if (!isPlainObject(decision)) {
    return null;
  }

  const executionDecision = decision.executionDecision;
  const persistenceOperation = resolvePersistenceOperation(decision);

  if (persistenceOperation == null || executionDecision == null) {
    return null;
  }

  const mapping = EXECUTION_DECISION_TO_PLANNED_OPERATION[executionDecision];
  if (!isPlainObject(mapping)) {
    return null;
  }

  const planned = mapping[persistenceOperation];
  return isPlannedOperation(planned) ? planned : null;
}

function resolveExecutionOutcome(decision, executionMode, plannedOperation) {
  const decisionValidation = isPlainObject(decision)
    ? validateExecutionDecision(decision)
    : buildValidationResult(["INVALID_DECISION_SHAPE"]);

  if (!decisionValidation.valid) {
    return EXECUTION_OUTCOMES.INVALID_DECISION;
  }

  if (plannedOperation == null) {
    const persistenceOperation = resolvePersistenceOperation(decision);
    if (
      persistenceOperation != null &&
      decision.executionDecision === EXECUTION_DECISIONS.DRY_RUN &&
      !isPlannedOperation(persistenceOperation)
    ) {
      return EXECUTION_OUTCOMES.UNSUPPORTED_OPERATION;
    }
    return EXECUTION_OUTCOMES.SKIPPED;
  }

  if (executionMode === EXECUTION_MODES.ENABLED) {
    return EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED;
  }

  return EXECUTION_OUTCOMES.DRY_RUN_SIMULATED;
}

function buildOutcomeRationale(outcome, plannedOperation, executionMode) {
  const base =
    OUTCOME_RATIONALE_BY_OUTCOME[outcome] ??
    OUTCOME_RATIONALE_BY_OUTCOME[DEFAULT_EXECUTION_OUTCOME];
  return `${base} (execution_mode=${executionMode}, planned_operation=${plannedOperation ?? "none"})`;
}

/**
 * Create an immutable persistence execution result from an execution decision.
 * Pure: no persistence execution, no database access. executed defaults to false.
 *
 * @param {Object|null|undefined} decision
 * @param {Object|null|undefined} [options]
 * @returns {Readonly<Object>|null}
 */
function createPersistenceExecutionResult(decision, options) {
  try {
    const executionMode = normalizeExecutionMode(
      isPlainObject(options) ? options.executionMode : null
    );
    const decisionValidation = isPlainObject(decision)
      ? validateExecutionDecision(decision)
      : buildValidationResult(["INVALID_DECISION_SHAPE"]);
    const decisionSummary = summarizeExecutionDecision(
      isPlainObject(decision) ? decision : null
    );
    const persistenceOperation = isPlainObject(decision)
      ? resolvePersistenceOperation(decision)
      : null;
    const plannedOperation = isPlainObject(decision) ? resolvePlannedOperation(decision) : null;
    const executionOutcome = resolveExecutionOutcome(decision, executionMode, plannedOperation);
    const operationDescriptor =
      plannedOperation != null
        ? (PLANNED_OPERATION_DESCRIPTOR[plannedOperation] ?? null)
        : null;

    return deepFreeze({
      phase: PERSISTENCE_ENGINE_PHASE,
      entity: PERSISTENCE_EXECUTION_RESULT_ENTITY,
      featureGated: true,
      featureGateOpen: false,
      executionMode,
      executed: false,
      descriptiveOnly: true,
      persistenceExecution: false,
      persistenceEnabled: false,
      performsPersistence: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false,
      executionGatewayPhase: EXECUTION_GATEWAY_PHASE,
      executionDecisionEntity: EXECUTION_DECISION_ENTITY,
      executionDecisionValid: decisionValidation.valid,
      executionDecision: isPlainObject(decision)
        ? (decision.executionDecision ?? DEFAULT_EXECUTION_DECISION)
        : DEFAULT_EXECUTION_DECISION,
      persistenceOperation: persistenceOperation ?? DEFAULT_PERSISTENCE_OPERATION,
      plannedOperation,
      plannedOperationLabel: operationDescriptor?.label ?? null,
      actionType: isPlainObject(decision) ? (decision.actionType ?? null) : null,
      actionLabel: isPlainObject(decision) ? (decision.actionLabel ?? null) : null,
      matchCategory: isPlainObject(decision) ? (decision.matchCategory ?? null) : null,
      profileId: isPlainObject(decision) ? (decision.profileId ?? null) : null,
      reviewScenarioId: isPlainObject(decision) ? (decision.reviewScenarioId ?? null) : null,
      recommendsManualReview: isPlainObject(decision)
        ? decision.recommendsManualReview === true
        : true,
      executionOutcome,
      outcomeRationale: buildOutcomeRationale(executionOutcome, plannedOperation, executionMode),
      supportedPlannedOperations: SUPPORTED_PLANNED_OPERATIONS,
      decisionSummary,
      decisionValidation,
      metadata: deepFreeze({
        ...PERSISTENCE_EXECUTION_METADATA,
        executionMode,
        createReason: decisionValidation.valid ? "execution_decision" : "invalid_execution_decision",
        executionDecisionPhase: isPlainObject(decision) ? decision.phase : null,
        persistenceCoordinatorPhase: isPlainObject(decision)
          ? decision.persistenceCoordinatorPhase
          : null
      })
    });
  } catch {
    return null;
  }
}

/**
 * Execute recruitment persistence behind a feature gate.
 * Defaults to dry_run — no database writes. Failures return null, never throw.
 *
 * @param {Object|null|undefined} decision
 * @param {Object|null|undefined} [options]
 * @returns {Readonly<Object>|null}
 */
function executeRecruitmentPersistence(decision, options) {
  try {
    const result = createPersistenceExecutionResult(decision, options);
    if (result == null) {
      return null;
    }

    // Phase 76 — all execution is feature-gated; executed remains false.
    // No database writes in dry_run; enabled mode is blocked by closed feature gate.
    return result;
  } catch {
    return null;
  }
}

/**
 * @param {*} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validatePersistenceExecutionResult(result) {
  const reasons = [];

  if (!isPlainObject(result)) {
    return buildValidationResult(["INVALID_RESULT_SHAPE"]);
  }

  if (result.phase !== PERSISTENCE_ENGINE_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (result.entity !== PERSISTENCE_EXECUTION_RESULT_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (!isExecutionMode(result.executionMode)) {
    reasons.push("INVALID_EXECUTION_MODE");
  }

  if (result.executed !== false) {
    reasons.push("EXECUTED_MUST_BE_FALSE");
  }

  if (result.featureGated !== true) {
    reasons.push("FEATURE_GATED_MUST_BE_TRUE");
  }

  if (result.featureGateOpen !== false) {
    reasons.push("FEATURE_GATE_OPEN_MUST_BE_FALSE");
  }

  if (
    result.persistenceExecution !== false ||
    result.performsPersistence !== false ||
    result.assignsRecruitmentIds !== false ||
    result.queriesDatabase !== false
  ) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (result.persistenceEnabled !== false || result.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (result.executionGatewayPhase !== EXECUTION_GATEWAY_PHASE) {
    reasons.push("INVALID_EXECUTION_GATEWAY_PHASE");
  }

  if (
    typeof result.outcomeRationale !== "string" ||
    result.outcomeRationale.trim() === ""
  ) {
    reasons.push("MISSING_OUTCOME_RATIONALE");
  }

  if (typeof result.executionDecisionValid !== "boolean") {
    reasons.push("INVALID_EXECUTION_DECISION_VALID_FLAG");
  }

  if (
    result.executionOutcome === EXECUTION_OUTCOMES.DRY_RUN_SIMULATED &&
    !isPlannedOperation(result.plannedOperation)
  ) {
    reasons.push("DRY_RUN_SIMULATED_REQUIRES_PLANNED_OPERATION");
  }

  if (
    result.plannedOperation != null &&
    !isPlannedOperation(result.plannedOperation)
  ) {
    reasons.push("INVALID_PLANNED_OPERATION");
  }

  if (
    result.executionMode === EXECUTION_MODES.DRY_RUN &&
    result.executionOutcome === EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED
  ) {
    reasons.push("DRY_RUN_MODE_OUTCOME_MISMATCH");
  }

  if (
    result.executionMode === EXECUTION_MODES.ENABLED &&
    result.executionOutcome === EXECUTION_OUTCOMES.DRY_RUN_SIMULATED
  ) {
    reasons.push("ENABLED_MODE_OUTCOME_MISMATCH");
  }

  if (result.executionDecisionValid === true && result.plannedOperation != null) {
    const expectedPlanned = resolvePlannedOperation({
      executionDecision: result.executionDecision,
      persistenceOperation: result.persistenceOperation
    });
    if (result.plannedOperation !== expectedPlanned) {
      reasons.push("PLANNED_OPERATION_INCONSISTENT_WITH_DECISION");
    }
  }

  if (!isPlainObject(result.decisionSummary)) {
    reasons.push("MISSING_DECISION_SUMMARY");
  }

  if (!isPlainObject(result.metadata)) {
    reasons.push("MISSING_METADATA");
  }

  if (!isPlainObject(result.decisionValidation)) {
    reasons.push("MISSING_DECISION_VALIDATION");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizePersistenceExecutionResult(result) {
  const validation = validatePersistenceExecutionResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: PERSISTENCE_ENGINE_PHASE,
      entity: PERSISTENCE_EXECUTION_RESULT_ENTITY,
      valid: false,
      executionMode: DEFAULT_EXECUTION_MODE,
      executed: false,
      plannedOperation: null,
      executionOutcome: DEFAULT_EXECUTION_OUTCOME,
      featureGated: true,
      featureGateOpen: false,
      persistenceExecution: false,
      persistenceEnabled: false,
      performsPersistence: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false
    });
  }

  return Object.freeze({
    phase: result.phase,
    entity: result.entity,
    valid: true,
    executionMode: result.executionMode,
    executed: false,
    plannedOperation: result.plannedOperation,
    plannedOperationLabel: result.plannedOperationLabel,
    executionOutcome: result.executionOutcome,
    executionDecision: result.executionDecision,
    persistenceOperation: result.persistenceOperation,
    actionType: result.actionType,
    actionLabel: result.actionLabel,
    matchCategory: result.matchCategory,
    profileId: result.profileId,
    executionDecisionValid: result.executionDecisionValid,
    outcomeRationale: result.outcomeRationale,
    featureGated: true,
    featureGateOpen: false,
    persistenceExecution: false,
    persistenceEnabled: false,
    performsPersistence: false,
    assignsRecruitmentIds: false,
    queriesDatabase: false
  });
}

module.exports = {
  PERSISTENCE_ENGINE_PHASE,
  PERSISTENCE_EXECUTION_RESULT_ENTITY,
  EXECUTION_MODES,
  SUPPORTED_EXECUTION_MODES,
  DEFAULT_EXECUTION_MODE,
  SUPPORTED_PLANNED_OPERATIONS,
  EXECUTION_OUTCOMES,
  DEFAULT_EXECUTION_OUTCOME,
  EXECUTION_DECISION_TO_PLANNED_OPERATION,
  PLANNED_OPERATION_DESCRIPTOR,
  PERSISTENCE_EXECUTION_RESULT_DESCRIPTOR,
  PERSISTENCE_EXECUTION_METADATA,
  VALIDATION_STATUS,
  isExecutionMode,
  isPlannedOperation,
  resolvePlannedOperation,
  createPersistenceExecutionResult,
  executeRecruitmentPersistence,
  validatePersistenceExecutionResult,
  summarizePersistenceExecutionResult
};
