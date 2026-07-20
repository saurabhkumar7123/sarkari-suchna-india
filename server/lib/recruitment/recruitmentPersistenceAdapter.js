"use strict";

/**
 * Phase 77 — Recruitment Persistence Adapter (Execution Boundary).
 *
 * Consumes immutable Persistence Execution Results and produces immutable
 * Adapter Results using deterministic logic. Defaults to connected false
 * with executed false — no database connectivity or writes.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  PERSISTENCE_ENGINE_PHASE,
  PERSISTENCE_EXECUTION_RESULT_ENTITY,
  EXECUTION_OUTCOMES,
  DEFAULT_EXECUTION_OUTCOME,
  validatePersistenceExecutionResult,
  summarizePersistenceExecutionResult
} = require("./recruitmentPersistenceEngine");

const PERSISTENCE_ADAPTER_PHASE = 77;

const PERSISTENCE_ADAPTER_RESULT_ENTITY = "recruitment_persistence_adapter_result";

const ADAPTER_STATES = Object.freeze({
  NOT_CONNECTED: "not_connected",
  DRY_RUN: "dry_run",
  BLOCKED: "blocked",
  EXECUTED: "executed"
});

const SUPPORTED_ADAPTER_STATES = Object.freeze(new Set(Object.values(ADAPTER_STATES)));

const DEFAULT_ADAPTER_STATE = ADAPTER_STATES.NOT_CONNECTED;

const EXECUTION_OUTCOME_TO_ADAPTER_STATE = Object.freeze({
  [EXECUTION_OUTCOMES.DRY_RUN_SIMULATED]: ADAPTER_STATES.DRY_RUN,
  [EXECUTION_OUTCOMES.FEATURE_GATE_BLOCKED]: ADAPTER_STATES.BLOCKED,
  [EXECUTION_OUTCOMES.SKIPPED]: ADAPTER_STATES.BLOCKED,
  [EXECUTION_OUTCOMES.INVALID_DECISION]: ADAPTER_STATES.NOT_CONNECTED,
  [EXECUTION_OUTCOMES.UNSUPPORTED_OPERATION]: ADAPTER_STATES.BLOCKED
});

const PERSISTENCE_ADAPTER_METADATA = Object.freeze({
  phase: PERSISTENCE_ADAPTER_PHASE,
  connected: false,
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
  persistenceEnginePhase: PERSISTENCE_ENGINE_PHASE
});

const PERSISTENCE_ADAPTER_RESULT_DESCRIPTOR = Object.freeze({
  entity: PERSISTENCE_ADAPTER_RESULT_ENTITY,
  domain: "recruitment",
  phase: PERSISTENCE_ADAPTER_PHASE,
  description:
    "Deterministic persistence adapter result derived from a persistence execution result.",
  supportedAdapterStates: SUPPORTED_ADAPTER_STATES,
  executionOutcomeMapping: EXECUTION_OUTCOME_TO_ADAPTER_STATE,
  metadata: PERSISTENCE_ADAPTER_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const ADAPTER_RATIONALE_BY_STATE = Object.freeze({
  [ADAPTER_STATES.NOT_CONNECTED]:
    "Persistence execution result is invalid or unavailable — adapter not connected.",
  [ADAPTER_STATES.DRY_RUN]:
    "Persistence execution was dry-run simulated — adapter reports dry_run without writes.",
  [ADAPTER_STATES.BLOCKED]:
    "Persistence execution was blocked or skipped — adapter reports blocked without writes.",
  [ADAPTER_STATES.EXECUTED]:
    "Persistence execution completed — adapter reports executed (reserved for future phases)."
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
function isAdapterState(state) {
  return typeof state === "string" && SUPPORTED_ADAPTER_STATES.has(state);
}

function resolveExecutionOutcome(executionResult) {
  if (!isPlainObject(executionResult)) {
    return null;
  }
  const outcome = executionResult.executionOutcome;
  return typeof outcome === "string" ? outcome : null;
}

function resolveAdapterState(executionResult, executionResultValidation) {
  if (!executionResultValidation.valid) {
    return ADAPTER_STATES.NOT_CONNECTED;
  }

  const executionOutcome = resolveExecutionOutcome(executionResult);
  if (executionOutcome == null) {
    return DEFAULT_ADAPTER_STATE;
  }

  const mapped = EXECUTION_OUTCOME_TO_ADAPTER_STATE[executionOutcome];
  return isAdapterState(mapped) ? mapped : DEFAULT_ADAPTER_STATE;
}

function buildAdapterRationale(adapterState, executionOutcome) {
  const base =
    ADAPTER_RATIONALE_BY_STATE[adapterState] ??
    ADAPTER_RATIONALE_BY_STATE[DEFAULT_ADAPTER_STATE];
  return `${base} (execution_outcome=${executionOutcome ?? "none"}, adapter_state=${adapterState})`;
}

/**
 * Create an immutable persistence adapter result from a persistence execution result.
 * Pure: no persistence execution, no database access. connected defaults to false.
 *
 * @param {Object|null|undefined} executionResult
 * @param {Object|null|undefined} [options]
 * @returns {Readonly<Object>|null}
 */
function createPersistenceAdapterResult(executionResult, options) {
  try {
    const executionResultValidation = isPlainObject(executionResult)
      ? validatePersistenceExecutionResult(executionResult)
      : buildValidationResult(["INVALID_EXECUTION_RESULT_SHAPE"]);
    const executionSummary = summarizePersistenceExecutionResult(
      isPlainObject(executionResult) ? executionResult : null
    );
    const executionOutcome = isPlainObject(executionResult)
      ? (resolveExecutionOutcome(executionResult) ?? DEFAULT_EXECUTION_OUTCOME)
      : DEFAULT_EXECUTION_OUTCOME;
    const adapterState = resolveAdapterState(executionResult, executionResultValidation);

    return deepFreeze({
      phase: PERSISTENCE_ADAPTER_PHASE,
      entity: PERSISTENCE_ADAPTER_RESULT_ENTITY,
      connected: false,
      executed: false,
      descriptiveOnly: true,
      persistenceExecution: false,
      persistenceEnabled: false,
      performsPersistence: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false,
      persistenceEnginePhase: PERSISTENCE_ENGINE_PHASE,
      persistenceExecutionResultEntity: PERSISTENCE_EXECUTION_RESULT_ENTITY,
      executionResultValid: executionResultValidation.valid,
      executionOutcome,
      adapterState,
      adapterRationale: buildAdapterRationale(adapterState, executionOutcome),
      supportedAdapterStates: SUPPORTED_ADAPTER_STATES,
      executionMode: isPlainObject(executionResult) ? (executionResult.executionMode ?? null) : null,
      plannedOperation: isPlainObject(executionResult) ? (executionResult.plannedOperation ?? null) : null,
      plannedOperationLabel: isPlainObject(executionResult)
        ? (executionResult.plannedOperationLabel ?? null)
        : null,
      executionDecision: isPlainObject(executionResult)
        ? (executionResult.executionDecision ?? null)
        : null,
      persistenceOperation: isPlainObject(executionResult)
        ? (executionResult.persistenceOperation ?? null)
        : null,
      actionType: isPlainObject(executionResult) ? (executionResult.actionType ?? null) : null,
      actionLabel: isPlainObject(executionResult) ? (executionResult.actionLabel ?? null) : null,
      matchCategory: isPlainObject(executionResult) ? (executionResult.matchCategory ?? null) : null,
      profileId: isPlainObject(executionResult) ? (executionResult.profileId ?? null) : null,
      reviewScenarioId: isPlainObject(executionResult)
        ? (executionResult.reviewScenarioId ?? null)
        : null,
      recommendsManualReview: isPlainObject(executionResult)
        ? executionResult.recommendsManualReview === true
        : true,
      executionSummary,
      executionResultValidation,
      metadata: deepFreeze({
        ...PERSISTENCE_ADAPTER_METADATA,
        createReason: executionResultValidation.valid
          ? "persistence_execution_result"
          : "invalid_persistence_execution_result",
        persistenceEnginePhase: isPlainObject(executionResult) ? executionResult.phase : null,
        executionGatewayPhase: isPlainObject(executionResult)
          ? executionResult.executionGatewayPhase
          : null,
        optionsProvided: isPlainObject(options)
      })
    });
  } catch {
    return null;
  }
}

/**
 * Execute the persistence adapter at the execution boundary.
 * Failures return null, never throw.
 *
 * @param {Object|null|undefined} executionResult
 * @param {Object|null|undefined} [options]
 * @returns {Readonly<Object>|null}
 */
function executePersistenceAdapter(executionResult, options) {
  try {
    const result = createPersistenceAdapterResult(executionResult, options);
    if (result == null) {
      return null;
    }

    // Phase 77 — adapter is execution-boundary only; connected and executed remain false.
    return result;
  } catch {
    return null;
  }
}

/**
 * @param {*} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validatePersistenceAdapterResult(result) {
  const reasons = [];

  if (!isPlainObject(result)) {
    return buildValidationResult(["INVALID_RESULT_SHAPE"]);
  }

  if (result.phase !== PERSISTENCE_ADAPTER_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (result.entity !== PERSISTENCE_ADAPTER_RESULT_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (result.connected !== false) {
    reasons.push("CONNECTED_MUST_BE_FALSE");
  }

  if (result.executed !== false) {
    reasons.push("EXECUTED_MUST_BE_FALSE");
  }

  if (!isAdapterState(result.adapterState)) {
    reasons.push("INVALID_ADAPTER_STATE");
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

  if (result.persistenceEnginePhase !== PERSISTENCE_ENGINE_PHASE) {
    reasons.push("INVALID_PERSISTENCE_ENGINE_PHASE");
  }

  if (result.persistenceExecutionResultEntity !== PERSISTENCE_EXECUTION_RESULT_ENTITY) {
    reasons.push("INVALID_PERSISTENCE_EXECUTION_RESULT_ENTITY");
  }

  if (
    typeof result.adapterRationale !== "string" ||
    result.adapterRationale.trim() === ""
  ) {
    reasons.push("MISSING_ADAPTER_RATIONALE");
  }

  if (typeof result.executionResultValid !== "boolean") {
    reasons.push("INVALID_EXECUTION_RESULT_VALID_FLAG");
  }

  if (result.executionResultValid === true) {
    const expectedState = resolveAdapterState(
      {
        executionOutcome: result.executionOutcome
      },
      { valid: true }
    );
    if (result.adapterState !== expectedState) {
      reasons.push("ADAPTER_STATE_INCONSISTENT_WITH_EXECUTION_OUTCOME");
    }
  } else if (result.adapterState !== ADAPTER_STATES.NOT_CONNECTED) {
    reasons.push("INVALID_RESULT_REQUIRES_NOT_CONNECTED");
  }

  if (result.adapterState === ADAPTER_STATES.EXECUTED) {
    reasons.push("EXECUTED_ADAPTER_STATE_NOT_SUPPORTED_IN_PHASE_77");
  }

  if (!isPlainObject(result.executionSummary)) {
    reasons.push("MISSING_EXECUTION_SUMMARY");
  }

  if (!isPlainObject(result.metadata)) {
    reasons.push("MISSING_METADATA");
  }

  if (!isPlainObject(result.executionResultValidation)) {
    reasons.push("MISSING_EXECUTION_RESULT_VALIDATION");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizePersistenceAdapterResult(result) {
  const validation = validatePersistenceAdapterResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: PERSISTENCE_ADAPTER_PHASE,
      entity: PERSISTENCE_ADAPTER_RESULT_ENTITY,
      valid: false,
      connected: false,
      executed: false,
      adapterState: DEFAULT_ADAPTER_STATE,
      executionOutcome: DEFAULT_EXECUTION_OUTCOME,
      plannedOperation: null,
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
    connected: false,
    executed: false,
    adapterState: result.adapterState,
    executionOutcome: result.executionOutcome,
    executionResultValid: result.executionResultValid,
    plannedOperation: result.plannedOperation,
    plannedOperationLabel: result.plannedOperationLabel,
    executionDecision: result.executionDecision,
    persistenceOperation: result.persistenceOperation,
    actionType: result.actionType,
    actionLabel: result.actionLabel,
    matchCategory: result.matchCategory,
    profileId: result.profileId,
    adapterRationale: result.adapterRationale,
    persistenceExecution: false,
    persistenceEnabled: false,
    performsPersistence: false,
    assignsRecruitmentIds: false,
    queriesDatabase: false
  });
}

module.exports = {
  PERSISTENCE_ADAPTER_PHASE,
  PERSISTENCE_ADAPTER_RESULT_ENTITY,
  ADAPTER_STATES,
  SUPPORTED_ADAPTER_STATES,
  DEFAULT_ADAPTER_STATE,
  EXECUTION_OUTCOME_TO_ADAPTER_STATE,
  PERSISTENCE_ADAPTER_RESULT_DESCRIPTOR,
  PERSISTENCE_ADAPTER_METADATA,
  VALIDATION_STATUS,
  isAdapterState,
  resolveAdapterState,
  createPersistenceAdapterResult,
  executePersistenceAdapter,
  validatePersistenceAdapterResult,
  summarizePersistenceAdapterResult
};
