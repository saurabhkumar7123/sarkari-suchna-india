"use strict";

/**
 * Phase 45 — Controlled Runtime Execution Adapter (architecture only).
 *
 * Bridges enablement decisions and future persistence execution by consuming
 * execution context, persistence decision, enablement decision, execution
 * plan, and transaction plan — then returning a controlled execution outcome.
 *
 * Supported outcomes: preview_only | dry_run | blocked | executor_not_available
 *
 * Never performs real execution. Never writes database data.
 * Never calls repositories. Never starts transactions.
 * Never enqueues queues. Never modifies workers.
 * Never enables live automation.
 *
 * Outcomes are deterministic, side-effect-free, and advisory only:
 * architectureOnly is always true; executed is always false;
 * persistenceEnabled / automationEnabled remain false in metadata.
 */

const {
  EXECUTION_MODES,
  isExecutionContextArchitectureOnly,
  isValidExecutionContext
} = require("./executionContext");

const {
  PERSISTENCE_ACTIONS
} = require("./runtimePersistencePolicy");

const {
  isPlanArchitectureOnly
} = require("./persistenceExecutionPipeline");

const {
  isTransactionPlanArchitectureOnly
} = require("./transactionCoordinator");

const {
  isPersistenceEnablementArchitectureOnly
} = require("./persistenceEnablement");

const EXECUTION_ADAPTER_PHASE = 45;

const CONTROLLED_EXECUTION_OUTCOMES = Object.freeze({
  PREVIEW_ONLY: "preview_only",
  DRY_RUN: "dry_run",
  BLOCKED: "blocked",
  EXECUTOR_NOT_AVAILABLE: "executor_not_available"
});

const SUPPORTED_CONTROLLED_EXECUTION_OUTCOMES = Object.freeze(
  new Set(Object.values(CONTROLLED_EXECUTION_OUTCOMES))
);

const CONTROLLED_EXECUTION_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_EXECUTION_CONTEXT: "INVALID_EXECUTION_CONTEXT",
  INVALID_PERSISTENCE_DECISION: "INVALID_PERSISTENCE_DECISION",
  INVALID_ENABLEMENT_DECISION: "INVALID_ENABLEMENT_DECISION",
  INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
  INVALID_TRANSACTION_PLAN: "INVALID_TRANSACTION_PLAN",
  PREVIEW_MODE: "PREVIEW_MODE",
  DRY_RUN_MODE: "DRY_RUN_MODE",
  ENABLEMENT_BLOCKED: "ENABLEMENT_BLOCKED",
  LIVE_MODE_SAFETY_BLOCK: "LIVE_MODE_SAFETY_BLOCK",
  EXECUTOR_NOT_AVAILABLE: "EXECUTOR_NOT_AVAILABLE",
  EXECUTOR_NOT_WIRED: "EXECUTOR_NOT_WIRED",
  ARCHITECTURE_ONLY_GUARD: "ARCHITECTURE_ONLY_GUARD"
});

const SUPPORTED_EXECUTION_MODES = Object.freeze(
  new Set([
    EXECUTION_MODES.PREVIEW,
    EXECUTION_MODES.DRY_RUN,
    EXECUTION_MODES.LIVE
  ])
);

const SUPPORTED_PERSISTENCE_ACTIONS = Object.freeze(
  new Set(Object.values(PERSISTENCE_ACTIONS))
);

/**
 * @typedef {Object} ControlledExecutionAdapterInput
 * @property {Object} [executionContext]
 * @property {Object} [persistenceDecision]
 * @property {Object} [enablementDecision]
 * @property {Object} [executionPlan]
 * @property {Object} [transactionPlan]
 */

/**
 * @typedef {Object} ControlledExecutionOutcome
 * @property {string} outcome
 * @property {boolean} executed
 * @property {boolean} blocked
 * @property {boolean} architectureOnly
 * @property {boolean} advisory
 * @property {string|null} executionMode
 * @property {string|null} persistenceAction
 * @property {string} reason
 * @property {string[]} reasons
 * @property {Object} metadata
 */

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function sortReasons(reasons) {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function normalizeMode(value) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function normalizeAction(value) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function clonePlain(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return { ...value };
}

function isPersistenceDecisionShape(decision) {
  if (!isPlainObject(decision)) {
    return false;
  }
  const action = normalizeAction(decision.action);
  if (action == null || !SUPPORTED_PERSISTENCE_ACTIONS.has(action)) {
    return false;
  }
  if (decision.reason != null && typeof decision.reason !== "string") {
    return false;
  }
  if (decision.reasons != null && !Array.isArray(decision.reasons)) {
    return false;
  }
  if (decision.metadata != null && !isPlainObject(decision.metadata)) {
    return false;
  }
  return true;
}

/**
 * Controlling mode prefers execution context, then enablement decision.
 *
 * @param {Object|null} executionContext
 * @param {Object|null} enablementDecision
 * @returns {string|null}
 */
function resolveControllingMode(executionContext, enablementDecision) {
  const contextMode = isPlainObject(executionContext)
    ? normalizeMode(executionContext.executionMode)
    : null;
  if (contextMode != null && SUPPORTED_EXECUTION_MODES.has(contextMode)) {
    return contextMode;
  }

  const enablementMode = isPlainObject(enablementDecision)
    ? normalizeMode(enablementDecision.executionMode)
    : null;
  if (enablementMode != null && SUPPORTED_EXECUTION_MODES.has(enablementMode)) {
    return enablementMode;
  }

  return null;
}

function buildOutcome({
  outcome,
  reasons,
  executionMode,
  persistenceAction,
  enablementAllowed,
  enablementBlocked,
  validationErrors,
  contextId,
  correlationId,
  pipelineRunId,
  planAction,
  transactionRequired,
  featureState
}) {
  const sorted = sortReasons(reasons);
  const blocked =
    outcome === CONTROLLED_EXECUTION_OUTCOMES.BLOCKED ||
    outcome === CONTROLLED_EXECUTION_OUTCOMES.EXECUTOR_NOT_AVAILABLE;

  return {
    outcome,
    executed: false,
    blocked,
    architectureOnly: true,
    advisory: true,
    executionMode: executionMode == null ? null : executionMode,
    persistenceAction: persistenceAction == null ? null : persistenceAction,
    reason: sorted[0] || CONTROLLED_EXECUTION_REASONS.INVALID_INPUT,
    reasons: sorted,
    metadata: {
      phase: EXECUTION_ADAPTER_PHASE,
      sideEffects: false,
      architectureOnly: true,
      advisory: true,
      executed: false,
      persistenceEnabled: false,
      automationEnabled: false,
      queueEnqueueEnabled: false,
      repositoriesInvoked: false,
      transactionBegun: false,
      transactionCommitted: false,
      transactionRolledBack: false,
      executorInvoked: false,
      executorAvailable: false,
      executorWired: false,
      realExecution: false,
      validationErrors: Array.isArray(validationErrors)
        ? [...validationErrors]
        : [],
      contextId: contextId == null ? null : contextId,
      correlationId: correlationId == null ? null : correlationId,
      pipelineRunId: pipelineRunId == null ? null : pipelineRunId,
      enablementAllowed: enablementAllowed === true,
      enablementBlocked: enablementBlocked !== false,
      planAction: planAction == null ? null : planAction,
      transactionRequired: transactionRequired === true,
      featureState: featureState == null ? null : clonePlain(featureState),
      wouldExecuteIfExecutorAvailable:
        outcome === CONTROLLED_EXECUTION_OUTCOMES.EXECUTOR_NOT_AVAILABLE,
      controlledOutcome: outcome
    }
  };
}

function validateAdapterInput(input) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: ["adapter input must be an object"],
      reasons: sortReasons([CONTROLLED_EXECUTION_REASONS.INVALID_INPUT])
    };
  }

  const {
    executionContext,
    persistenceDecision,
    enablementDecision,
    executionPlan,
    transactionPlan
  } = input;

  if (!isPlainObject(executionContext)) {
    errors.push("executionContext must be an object");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_EXECUTION_CONTEXT);
  } else if (
    !isValidExecutionContext(executionContext) ||
    !isExecutionContextArchitectureOnly(executionContext)
  ) {
    errors.push("executionContext is invalid or not architecture-only");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_EXECUTION_CONTEXT);
  }

  if (!isPersistenceDecisionShape(persistenceDecision)) {
    errors.push("persistenceDecision must be a valid policy decision");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_PERSISTENCE_DECISION);
  }

  if (!isPlainObject(enablementDecision)) {
    errors.push("enablementDecision must be an object");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_ENABLEMENT_DECISION);
  } else if (!isPersistenceEnablementArchitectureOnly(enablementDecision)) {
    errors.push("enablementDecision is not architecture-only");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_ENABLEMENT_DECISION);
  }

  if (!isPlainObject(executionPlan)) {
    errors.push("executionPlan must be an object");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_EXECUTION_PLAN);
  } else if (!isPlanArchitectureOnly(executionPlan)) {
    errors.push("executionPlan is not architecture-only");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_EXECUTION_PLAN);
  }

  if (!isPlainObject(transactionPlan)) {
    errors.push("transactionPlan must be an object");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_TRANSACTION_PLAN);
  } else if (!isTransactionPlanArchitectureOnly(transactionPlan)) {
    errors.push("transactionPlan is not architecture-only");
    reasons.push(CONTROLLED_EXECUTION_REASONS.INVALID_TRANSACTION_PLAN);
  }

  if (errors.length === 0) {
    return {
      valid: true,
      errors: [],
      reasons: [CONTROLLED_EXECUTION_REASONS.VALID]
    };
  }

  return {
    valid: false,
    errors,
    reasons: sortReasons(reasons)
  };
}

function extractOutcomeFields(input) {
  const executionContext = isPlainObject(input && input.executionContext)
    ? input.executionContext
    : null;
  const persistenceDecision = isPlainObject(input && input.persistenceDecision)
    ? input.persistenceDecision
    : null;
  const enablementDecision = isPlainObject(input && input.enablementDecision)
    ? input.enablementDecision
    : null;
  const executionPlan = isPlainObject(input && input.executionPlan)
    ? input.executionPlan
    : null;
  const transactionPlan = isPlainObject(input && input.transactionPlan)
    ? input.transactionPlan
    : null;

  return {
    executionMode: resolveControllingMode(executionContext, enablementDecision),
    persistenceAction: persistenceDecision
      ? normalizeAction(persistenceDecision.action)
      : null,
    enablementAllowed:
      enablementDecision != null && enablementDecision.allowed === true,
    enablementBlocked:
      enablementDecision == null || enablementDecision.blocked !== false,
    contextId: executionContext ? executionContext.contextId : null,
    correlationId: executionContext ? executionContext.correlationId : null,
    pipelineRunId: executionContext ? executionContext.pipelineRunId : null,
    planAction: executionPlan ? normalizeAction(executionPlan.action) : null,
    transactionRequired:
      transactionPlan != null && transactionPlan.transactionRequired === true,
    featureState:
      enablementDecision && isPlainObject(enablementDecision.featureState)
        ? enablementDecision.featureState
        : null
  };
}

/**
 * Adapt controlled runtime inputs into an architecture-only execution outcome.
 * Pure: no I/O, no mutation of inputs, no real execution, no side effects.
 *
 * Decision table:
 * - invalid inputs → blocked
 * - controlling mode preview → preview_only
 * - controlling mode dry_run → dry_run
 * - live + enablement blocked → blocked
 * - live + enablement allowed → executor_not_available
 *   (no live executor is wired in this architecture phase)
 *
 * @param {ControlledExecutionAdapterInput|null|undefined} input
 * @param {Object|null|undefined} [_options] - Reserved for future executors; ignored
 * @returns {ControlledExecutionOutcome}
 */
function adaptControlledRuntimeExecution(input, _options) {
  const fields = extractOutcomeFields(input);
  const validation = validateAdapterInput(input);

  if (!validation.valid) {
    return buildOutcome({
      outcome: CONTROLLED_EXECUTION_OUTCOMES.BLOCKED,
      reasons: [
        ...validation.reasons,
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD
      ],
      executionMode: fields.executionMode,
      persistenceAction: fields.persistenceAction,
      enablementAllowed: fields.enablementAllowed,
      enablementBlocked: fields.enablementBlocked,
      validationErrors: validation.errors,
      contextId: fields.contextId,
      correlationId: fields.correlationId,
      pipelineRunId: fields.pipelineRunId,
      planAction: fields.planAction,
      transactionRequired: fields.transactionRequired,
      featureState: fields.featureState
    });
  }

  const {
    executionContext,
    persistenceDecision,
    enablementDecision,
    executionPlan,
    transactionPlan
  } = input;

  const executionMode = resolveControllingMode(
    executionContext,
    enablementDecision
  );
  const persistenceAction = normalizeAction(persistenceDecision.action);
  const featureState = isPlainObject(enablementDecision.featureState)
    ? enablementDecision.featureState
    : null;

  const baseFields = {
    executionMode,
    persistenceAction,
    enablementAllowed: enablementDecision.allowed === true,
    enablementBlocked: enablementDecision.blocked !== false,
    validationErrors: [],
    contextId: executionContext.contextId,
    correlationId: executionContext.correlationId,
    pipelineRunId: executionContext.pipelineRunId,
    planAction: normalizeAction(executionPlan.action),
    transactionRequired: transactionPlan.transactionRequired === true,
    featureState
  };

  if (executionMode === EXECUTION_MODES.PREVIEW) {
    return buildOutcome({
      ...baseFields,
      outcome: CONTROLLED_EXECUTION_OUTCOMES.PREVIEW_ONLY,
      reasons: [
        CONTROLLED_EXECUTION_REASONS.PREVIEW_MODE,
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD
      ]
    });
  }

  if (executionMode === EXECUTION_MODES.DRY_RUN) {
    return buildOutcome({
      ...baseFields,
      outcome: CONTROLLED_EXECUTION_OUTCOMES.DRY_RUN,
      reasons: [
        CONTROLLED_EXECUTION_REASONS.DRY_RUN_MODE,
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD
      ]
    });
  }

  // LIVE mode (or unresolved mode treated as blocked safety path)
  if (executionMode !== EXECUTION_MODES.LIVE) {
    return buildOutcome({
      ...baseFields,
      outcome: CONTROLLED_EXECUTION_OUTCOMES.BLOCKED,
      reasons: [
        CONTROLLED_EXECUTION_REASONS.INVALID_INPUT,
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD
      ],
      validationErrors: ["executionMode could not be resolved"]
    });
  }

  if (enablementDecision.blocked === true || enablementDecision.allowed !== true) {
    const enablementReasons = Array.isArray(enablementDecision.reasons)
      ? enablementDecision.reasons.filter((r) => typeof r === "string")
      : [];
    return buildOutcome({
      ...baseFields,
      outcome: CONTROLLED_EXECUTION_OUTCOMES.BLOCKED,
      reasons: sortReasons([
        CONTROLLED_EXECUTION_REASONS.ENABLEMENT_BLOCKED,
        CONTROLLED_EXECUTION_REASONS.LIVE_MODE_SAFETY_BLOCK,
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD,
        ...enablementReasons
      ])
    });
  }

  // Enablement would allow live work, but no real executor exists yet.
  return buildOutcome({
    ...baseFields,
    outcome: CONTROLLED_EXECUTION_OUTCOMES.EXECUTOR_NOT_AVAILABLE,
    reasons: [
      CONTROLLED_EXECUTION_REASONS.EXECUTOR_NOT_AVAILABLE,
      CONTROLLED_EXECUTION_REASONS.EXECUTOR_NOT_WIRED,
      CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD
    ]
  });
}

/**
 * Guard: confirm a value looks like an architecture-only controlled outcome.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isControlledExecutionArchitectureOnly(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  if (value.architectureOnly !== true) {
    return false;
  }
  if (value.executed !== false) {
    return false;
  }
  if (value.advisory !== true) {
    return false;
  }
  if (
    value.outcome == null ||
    !SUPPORTED_CONTROLLED_EXECUTION_OUTCOMES.has(value.outcome)
  ) {
    return false;
  }
  if (!isPlainObject(value.metadata)) {
    return false;
  }
  if (value.metadata.phase !== EXECUTION_ADAPTER_PHASE) {
    return false;
  }
  if (value.metadata.sideEffects !== false) {
    return false;
  }
  if (value.metadata.persistenceEnabled !== false) {
    return false;
  }
  if (value.metadata.automationEnabled !== false) {
    return false;
  }
  if (value.metadata.queueEnqueueEnabled !== false) {
    return false;
  }
  if (value.metadata.repositoriesInvoked !== false) {
    return false;
  }
  if (value.metadata.executorInvoked !== false) {
    return false;
  }
  if (value.metadata.executorAvailable !== false) {
    return false;
  }
  if (value.metadata.realExecution !== false) {
    return false;
  }
  if (value.metadata.transactionBegun !== false) {
    return false;
  }
  if (value.metadata.transactionCommitted !== false) {
    return false;
  }
  if (value.metadata.transactionRolledBack !== false) {
    return false;
  }
  return true;
}

module.exports = {
  EXECUTION_ADAPTER_PHASE,
  CONTROLLED_EXECUTION_OUTCOMES,
  SUPPORTED_CONTROLLED_EXECUTION_OUTCOMES,
  CONTROLLED_EXECUTION_REASONS,
  adaptControlledRuntimeExecution,
  isControlledExecutionArchitectureOnly,
  validateAdapterInput,
  resolveControllingMode
};
