"use strict";

/**
 * Phase 42 — Dry-Run Persistence Simulation (architecture only).
 *
 * Consumes PersistenceExecutionPlan and TransactionPlan values and produces
 * an advisory dry-run simulation report describing what would happen if a
 * future live executor ran those plans.
 *
 * Never accesses MySQL. Never calls repositories. Never executes SQL.
 * Never starts, commits, or rolls back transactions. Never enqueues queues.
 * Never modifies workers. Never enables persistence.
 *
 * Simulations are deterministic descriptions only: executed is always false;
 * architectureOnly is always true; sideEffects is always false.
 */

const {
  PERSISTENCE_ACTIONS
} = require("./runtimePersistencePolicy");

const {
  STEP_KINDS,
  TRANSACTION_SCOPES
} = require("./persistenceExecutionPipeline");

const DRY_RUN_SIMULATION_REASONS = Object.freeze({
  INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
  INVALID_TRANSACTION_PLAN: "INVALID_TRANSACTION_PLAN",
  ACTION_MISMATCH: "ACTION_MISMATCH",
  SIMULATION_GENERATED: "SIMULATION_GENERATED",
  NOOP_PREVIEW: "NOOP_PREVIEW",
  NOOP_SKIP: "NOOP_SKIP",
  UNKNOWN_ACTION: "UNKNOWN_ACTION"
});

const EXPECTED_OUTCOME_STATUSES = Object.freeze({
  WOULD_PERSIST: "would_persist",
  WOULD_ENQUEUE_REVIEW: "would_enqueue_review",
  WOULD_NOOP_PREVIEW: "would_noop_preview",
  WOULD_NOOP_SKIP: "would_noop_skip",
  INVALID_PLAN: "invalid_plan",
  UNKNOWN_ACTION: "unknown_action"
});

const MUTATION_KINDS = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  ENQUEUE: "enqueue",
  NONE: "none"
});

const REPOSITORY_OPERATION_KINDS = Object.freeze({
  LOOKUP: "lookup",
  WRITE: "write",
  ENQUEUE: "enqueue",
  OTHER: "other"
});

const SUPPORTED_ACTIONS = Object.freeze(
  new Set(Object.values(PERSISTENCE_ACTIONS))
);

const SIMULATION_PHASE = 42;

/**
 * @typedef {Object} SimulatedRepositoryOperation
 * @property {number} order
 * @property {string} stepId
 * @property {string} kind
 * @property {string|null} repository
 * @property {string|null} method
 * @property {string} description
 * @property {boolean} required
 * @property {boolean} transactional
 * @property {boolean} wouldInvoke
 * @property {boolean} invoked
 */

/**
 * @typedef {Object} SimulatedMutation
 * @property {number} order
 * @property {string} stepId
 * @property {string} kind
 * @property {string|null} target
 * @property {string|null} method
 * @property {string} description
 * @property {boolean} wouldMutate
 * @property {boolean} mutated
 */

/**
 * @typedef {Object} SimulatedTransactionBoundary
 * @property {boolean} required
 * @property {string} scope
 * @property {string|null} isolationHint
 * @property {boolean} wouldBegin
 * @property {boolean} wouldCommit
 * @property {boolean} wouldRollbackOnFailure
 * @property {boolean} begun
 * @property {boolean} committed
 * @property {boolean} rolledBack
 * @property {string[]} stepsInTransaction
 * @property {string[]} stageIds
 * @property {Object|null} unitOfWorkSummary
 */

/**
 * @typedef {Object} SimulatedExpectedOutcome
 * @property {string} status
 * @property {string} description
 * @property {boolean} successIfExecuted
 * @property {boolean} mutating
 * @property {boolean} sideEffectsIfExecuted
 * @property {boolean} noop
 */

/**
 * @typedef {Object} DryRunSimulationReport
 * @property {string|null} action
 * @property {boolean} simulated
 * @property {boolean} executed
 * @property {boolean} architectureOnly
 * @property {boolean} advisory
 * @property {SimulatedRepositoryOperation[]} repositoryOperations
 * @property {SimulatedMutation[]} mutations
 * @property {SimulatedTransactionBoundary} transactionBoundary
 * @property {SimulatedExpectedOutcome} expectedOutcome
 * @property {Object} metadata
 */

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function clonePlain(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return { ...value };
}

function normalizeAction(value) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function isValidExecutionPlan(plan) {
  if (!isPlainObject(plan)) {
    return false;
  }
  if (!Array.isArray(plan.steps)) {
    return false;
  }
  if (plan.action != null && typeof plan.action !== "string") {
    return false;
  }
  if (
    plan.transactionRequirements != null &&
    !isPlainObject(plan.transactionRequirements)
  ) {
    return false;
  }
  return true;
}

function isValidTransactionPlan(plan) {
  if (plan == null) {
    return true;
  }
  if (!isPlainObject(plan)) {
    return false;
  }
  if (!Array.isArray(plan.stages)) {
    return false;
  }
  if (plan.action != null && typeof plan.action !== "string") {
    return false;
  }
  if (typeof plan.transactionRequired !== "boolean") {
    return false;
  }
  if (plan.scope != null && typeof plan.scope !== "string") {
    return false;
  }
  return true;
}

function normalizeStep(raw, index) {
  if (!isPlainObject(raw)) {
    return null;
  }
  const id =
    raw.id == null || String(raw.id).trim() === ""
      ? `step_${index + 1}`
      : String(raw.id);
  return Object.freeze({
    order: typeof raw.order === "number" ? raw.order : index + 1,
    id,
    kind: raw.kind == null ? null : String(raw.kind),
    description: raw.description == null ? "" : String(raw.description),
    repository: raw.repository == null ? null : String(raw.repository),
    method: raw.method == null ? null : String(raw.method),
    required: raw.required === true,
    transactional: raw.transactional === true
  });
}

function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) {
    return [];
  }
  const normalized = [];
  for (let i = 0; i < rawSteps.length; i += 1) {
    const step = normalizeStep(rawSteps[i], i);
    if (step != null) {
      normalized.push(step);
    }
  }
  return normalized;
}

function classifyRepositoryOperationKind(step) {
  if (step.kind === STEP_KINDS.ENQUEUE_REVIEW) {
    return REPOSITORY_OPERATION_KINDS.ENQUEUE;
  }
  if (step.kind !== STEP_KINDS.REPOSITORY_CALL && step.repository == null) {
    return null;
  }
  const method = step.method == null ? "" : String(step.method).toLowerCase();
  if (
    method.startsWith("find") ||
    method.startsWith("get") ||
    method.startsWith("list") ||
    method.startsWith("lookup")
  ) {
    return REPOSITORY_OPERATION_KINDS.LOOKUP;
  }
  if (
    method.startsWith("create") ||
    method.startsWith("update") ||
    method.startsWith("save") ||
    method.startsWith("upsert") ||
    method.startsWith("delete")
  ) {
    return REPOSITORY_OPERATION_KINDS.WRITE;
  }
  if (method.startsWith("enqueue") || step.kind === STEP_KINDS.ENQUEUE_REVIEW) {
    return REPOSITORY_OPERATION_KINDS.ENQUEUE;
  }
  if (step.repository != null || step.method != null) {
    return REPOSITORY_OPERATION_KINDS.OTHER;
  }
  return null;
}

function isRepositoryFacingStep(step) {
  return (
    step.kind === STEP_KINDS.REPOSITORY_CALL ||
    step.kind === STEP_KINDS.ENQUEUE_REVIEW ||
    (step.repository != null && step.method != null)
  );
}

function classifyMutationKind(step) {
  if (step.kind === STEP_KINDS.ENQUEUE_REVIEW) {
    return MUTATION_KINDS.ENQUEUE;
  }
  if (step.kind === STEP_KINDS.NOOP) {
    return MUTATION_KINDS.NONE;
  }
  if (
    step.kind !== STEP_KINDS.REPOSITORY_CALL &&
    step.kind !== STEP_KINDS.ENQUEUE_REVIEW
  ) {
    return null;
  }
  const method = step.method == null ? "" : String(step.method).toLowerCase();
  if (
    method.startsWith("find") ||
    method.startsWith("get") ||
    method.startsWith("list") ||
    method.startsWith("lookup")
  ) {
    return null;
  }
  if (method.startsWith("update") || method.startsWith("upsert")) {
    return MUTATION_KINDS.UPDATE;
  }
  if (
    method.startsWith("create") ||
    method.startsWith("save") ||
    method.startsWith("delete")
  ) {
    return MUTATION_KINDS.CREATE;
  }
  if (method.startsWith("enqueue")) {
    return MUTATION_KINDS.ENQUEUE;
  }
  if (step.kind === STEP_KINDS.REPOSITORY_CALL && step.method != null) {
    return MUTATION_KINDS.CREATE;
  }
  return null;
}

function freezeRepositoryOperation(op) {
  return Object.freeze({
    order: op.order,
    stepId: String(op.stepId),
    kind: String(op.kind),
    repository: op.repository == null ? null : String(op.repository),
    method: op.method == null ? null : String(op.method),
    description: String(op.description),
    required: op.required === true,
    transactional: op.transactional === true,
    wouldInvoke: op.wouldInvoke !== false,
    invoked: false
  });
}

function freezeMutation(mutation) {
  return Object.freeze({
    order: mutation.order,
    stepId: String(mutation.stepId),
    kind: String(mutation.kind),
    target: mutation.target == null ? null : String(mutation.target),
    method: mutation.method == null ? null : String(mutation.method),
    description: String(mutation.description),
    wouldMutate: mutation.wouldMutate !== false,
    mutated: false
  });
}

function buildRepositoryOperations(steps) {
  const operations = [];
  let order = 0;
  for (const step of steps) {
    if (!isRepositoryFacingStep(step)) {
      continue;
    }
    const kind = classifyRepositoryOperationKind(step);
    if (kind == null) {
      continue;
    }
    order += 1;
    operations.push(
      freezeRepositoryOperation({
        order,
        stepId: step.id,
        kind,
        repository: step.repository,
        method: step.method,
        description:
          step.description ||
          `Would invoke ${step.repository}.${step.method} without executing it.`,
        required: step.required,
        transactional: step.transactional,
        wouldInvoke: true,
        invoked: false
      })
    );
  }
  return operations;
}

function buildMutations(steps) {
  const mutations = [];
  let order = 0;
  for (const step of steps) {
    const kind = classifyMutationKind(step);
    if (kind == null || kind === MUTATION_KINDS.NONE) {
      continue;
    }
    order += 1;
    mutations.push(
      freezeMutation({
        order,
        stepId: step.id,
        kind,
        target: step.repository,
        method: step.method,
        description:
          step.description ||
          `Would attempt ${kind} via ${step.repository}.${step.method}.`,
        wouldMutate: true,
        mutated: false
      })
    );
  }
  return mutations;
}

function summarizeUnitOfWork(transactionPlan) {
  if (!isPlainObject(transactionPlan) || !isPlainObject(transactionPlan.unitOfWork)) {
    return null;
  }
  const uow = transactionPlan.unitOfWork;
  function summarizeStage(stage) {
    if (!isPlainObject(stage)) {
      return null;
    }
    return Object.freeze({
      id: stage.id == null ? null : String(stage.id),
      kind: stage.kind == null ? null : String(stage.kind),
      planned: stage.planned !== false,
      executed: false
    });
  }
  return Object.freeze({
    begin: summarizeStage(uow.begin),
    commit: summarizeStage(uow.commit),
    rollback: summarizeStage(uow.rollback)
  });
}

function buildTransactionBoundaryFromRequirements(txnReq, steps) {
  const required = txnReq && txnReq.required === true;
  const stepsInTransaction =
    required && Array.isArray(txnReq.stepsInTransaction)
      ? txnReq.stepsInTransaction.map((id) => String(id))
      : required
        ? steps.filter((s) => s.transactional).map((s) => s.id)
        : [];

  return Object.freeze({
    required,
    scope: required
      ? txnReq.scope == null
        ? TRANSACTION_SCOPES.NONE
        : String(txnReq.scope)
      : TRANSACTION_SCOPES.NONE,
    isolationHint: required
      ? txnReq.isolationHint == null
        ? null
        : String(txnReq.isolationHint)
      : null,
    wouldBegin: required,
    wouldCommit: required,
    wouldRollbackOnFailure: required,
    begun: false,
    committed: false,
    rolledBack: false,
    stepsInTransaction: Object.freeze([...stepsInTransaction]),
    stageIds: Object.freeze([]),
    unitOfWorkSummary: null
  });
}

function buildTransactionBoundaryFromPlan(transactionPlan) {
  const required = transactionPlan.transactionRequired === true;
  const stepsInTransaction = Array.isArray(transactionPlan.stepsInTransaction)
    ? transactionPlan.stepsInTransaction.map((id) => String(id))
    : [];
  const stageIds = Array.isArray(transactionPlan.stages)
    ? transactionPlan.stages
        .filter((s) => isPlainObject(s) && s.id != null)
        .map((s) => String(s.id))
    : [];

  return Object.freeze({
    required,
    scope: required
      ? transactionPlan.scope == null
        ? TRANSACTION_SCOPES.NONE
        : String(transactionPlan.scope)
      : TRANSACTION_SCOPES.NONE,
    isolationHint: required
      ? transactionPlan.isolationHint == null
        ? null
        : String(transactionPlan.isolationHint)
      : null,
    wouldBegin: required,
    wouldCommit: required,
    wouldRollbackOnFailure: required,
    begun: false,
    committed: false,
    rolledBack: false,
    stepsInTransaction: Object.freeze([...stepsInTransaction]),
    stageIds: Object.freeze(stageIds),
    unitOfWorkSummary: summarizeUnitOfWork(transactionPlan)
  });
}

function buildExpectedOutcome(action, mutations, simulationReason) {
  if (simulationReason === DRY_RUN_SIMULATION_REASONS.INVALID_EXECUTION_PLAN) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.INVALID_PLAN,
      description:
        "Invalid execution plan: no repository operations or mutations would run.",
      successIfExecuted: false,
      mutating: false,
      sideEffectsIfExecuted: false,
      noop: true
    });
  }

  if (simulationReason === DRY_RUN_SIMULATION_REASONS.INVALID_TRANSACTION_PLAN) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.INVALID_PLAN,
      description:
        "Invalid transaction plan: dry-run refused to map a transaction boundary.",
      successIfExecuted: false,
      mutating: false,
      sideEffectsIfExecuted: false,
      noop: true
    });
  }

  if (simulationReason === DRY_RUN_SIMULATION_REASONS.ACTION_MISMATCH) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.INVALID_PLAN,
      description:
        "Execution plan action and transaction plan action disagree; simulation blocked.",
      successIfExecuted: false,
      mutating: false,
      sideEffectsIfExecuted: false,
      noop: true
    });
  }

  if (action === PERSISTENCE_ACTIONS.PERSIST) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.WOULD_PERSIST,
      description:
        "If executed, a future executor would persist recruitment and lifecycle event writes inside one transaction.",
      successIfExecuted: true,
      mutating: true,
      sideEffectsIfExecuted: true,
      noop: false
    });
  }

  if (action === PERSISTENCE_ACTIONS.REVIEW) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.WOULD_ENQUEUE_REVIEW,
      description:
        "If executed, a future executor would enqueue a review-queue item inside a review-scoped transaction.",
      successIfExecuted: true,
      mutating: true,
      sideEffectsIfExecuted: true,
      noop: false
    });
  }

  if (action === PERSISTENCE_ACTIONS.PREVIEW_ONLY) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.WOULD_NOOP_PREVIEW,
      description:
        "Preview-only path: no repository writes, queue enqueue, or transaction would occur.",
      successIfExecuted: true,
      mutating: false,
      sideEffectsIfExecuted: false,
      noop: true
    });
  }

  if (action === PERSISTENCE_ACTIONS.SKIP) {
    return Object.freeze({
      status: EXPECTED_OUTCOME_STATUSES.WOULD_NOOP_SKIP,
      description:
        "Skip path: no persistence or review side effects would occur.",
      successIfExecuted: true,
      mutating: false,
      sideEffectsIfExecuted: false,
      noop: true
    });
  }

  return Object.freeze({
    status: EXPECTED_OUTCOME_STATUSES.UNKNOWN_ACTION,
    description:
      "Unknown action: dry-run describes steps conservatively without enabling execution.",
    successIfExecuted: false,
    mutating: mutations.length > 0,
    sideEffectsIfExecuted: mutations.length > 0,
    noop: mutations.length === 0
  });
}

function resolveSimulationReason(action) {
  if (action === PERSISTENCE_ACTIONS.PREVIEW_ONLY) {
    return DRY_RUN_SIMULATION_REASONS.NOOP_PREVIEW;
  }
  if (action === PERSISTENCE_ACTIONS.SKIP) {
    return DRY_RUN_SIMULATION_REASONS.NOOP_SKIP;
  }
  if (action == null || !SUPPORTED_ACTIONS.has(action)) {
    return DRY_RUN_SIMULATION_REASONS.UNKNOWN_ACTION;
  }
  return DRY_RUN_SIMULATION_REASONS.SIMULATION_GENERATED;
}

function buildReportMetadata({
  simulationReason,
  executionPlan,
  transactionPlan,
  extras
}) {
  return {
    simulationReason: String(simulationReason),
    phase: SIMULATION_PHASE,
    sideEffects: false,
    simulatedOnly: true,
    architectureOnly: true,
    advisory: true,
    repositoriesInvoked: false,
    persistenceEnabled: false,
    transactionBegun: false,
    transactionCommitted: false,
    transactionRolledBack: false,
    sourceExecutable:
      executionPlan && executionPlan.executable === true ? true : false,
    sourceArchitectureOnly:
      executionPlan && executionPlan.architectureOnly === true,
    executionPlanAction:
      executionPlan && executionPlan.action != null
        ? String(executionPlan.action)
        : null,
    executionPlanMetadata: clonePlain(
      executionPlan && executionPlan.metadata
    ),
    transactionPlanProvided: transactionPlan != null,
    transactionPlanAction:
      transactionPlan && transactionPlan.action != null
        ? String(transactionPlan.action)
        : null,
    transactionPlanMetadata: clonePlain(
      transactionPlan && transactionPlan.metadata
    ),
    ...extras
  };
}

function buildReport({
  action,
  repositoryOperations,
  mutations,
  transactionBoundary,
  expectedOutcome,
  metadata
}) {
  return {
    action: action == null ? null : String(action),
    simulated: true,
    executed: false,
    architectureOnly: true,
    advisory: true,
    repositoryOperations,
    mutations,
    transactionBoundary,
    expectedOutcome,
    metadata
  };
}

function emptyBoundary() {
  return Object.freeze({
    required: false,
    scope: TRANSACTION_SCOPES.NONE,
    isolationHint: null,
    wouldBegin: false,
    wouldCommit: false,
    wouldRollbackOnFailure: false,
    begun: false,
    committed: false,
    rolledBack: false,
    stepsInTransaction: Object.freeze([]),
    stageIds: Object.freeze([]),
    unitOfWorkSummary: null
  });
}

function reportInvalidExecutionPlan() {
  return buildReport({
    action: null,
    repositoryOperations: [],
    mutations: [],
    transactionBoundary: emptyBoundary(),
    expectedOutcome: buildExpectedOutcome(
      null,
      [],
      DRY_RUN_SIMULATION_REASONS.INVALID_EXECUTION_PLAN
    ),
    metadata: buildReportMetadata({
      simulationReason: DRY_RUN_SIMULATION_REASONS.INVALID_EXECUTION_PLAN,
      executionPlan: null,
      transactionPlan: null,
      extras: {
        wouldWriteIfExecuted: false,
        wouldEnqueueIfExecuted: false,
        mutating: false
      }
    })
  });
}

function reportInvalidTransactionPlan(executionPlan) {
  const action = normalizeAction(executionPlan && executionPlan.action);
  return buildReport({
    action,
    repositoryOperations: [],
    mutations: [],
    transactionBoundary: emptyBoundary(),
    expectedOutcome: buildExpectedOutcome(
      action,
      [],
      DRY_RUN_SIMULATION_REASONS.INVALID_TRANSACTION_PLAN
    ),
    metadata: buildReportMetadata({
      simulationReason: DRY_RUN_SIMULATION_REASONS.INVALID_TRANSACTION_PLAN,
      executionPlan,
      transactionPlan: null,
      extras: {
        wouldWriteIfExecuted: false,
        wouldEnqueueIfExecuted: false,
        mutating: false
      }
    })
  });
}

function reportActionMismatch(executionPlan, transactionPlan) {
  const action = normalizeAction(executionPlan.action);
  return buildReport({
    action,
    repositoryOperations: [],
    mutations: [],
    transactionBoundary: emptyBoundary(),
    expectedOutcome: buildExpectedOutcome(
      action,
      [],
      DRY_RUN_SIMULATION_REASONS.ACTION_MISMATCH
    ),
    metadata: buildReportMetadata({
      simulationReason: DRY_RUN_SIMULATION_REASONS.ACTION_MISMATCH,
      executionPlan,
      transactionPlan,
      extras: {
        wouldWriteIfExecuted: false,
        wouldEnqueueIfExecuted: false,
        mutating: false,
        executionAction: action,
        transactionAction: normalizeAction(transactionPlan.action)
      }
    })
  });
}

/**
 * Simulate dry-run persistence from an execution plan and optional
 * transaction plan. Pure: no I/O, no mutation of inputs, no repository
 * invocation, and no real transactions.
 *
 * @param {Object|null|undefined} executionPlan - PersistenceExecutionPlan
 * @param {Object|null|undefined} [transactionPlan] - TransactionPlan (optional)
 * @param {Object|null|undefined} [_options] - Reserved for future simulators; ignored
 * @returns {DryRunSimulationReport}
 */
function simulateDryRunPersistence(executionPlan, transactionPlan, _options) {
  if (!isValidExecutionPlan(executionPlan)) {
    return reportInvalidExecutionPlan();
  }

  if (!isValidTransactionPlan(transactionPlan)) {
    return reportInvalidTransactionPlan(executionPlan);
  }

  const action = normalizeAction(executionPlan.action);
  if (
    transactionPlan != null &&
    transactionPlan.action != null &&
    action != null &&
    normalizeAction(transactionPlan.action) !== action
  ) {
    return reportActionMismatch(executionPlan, transactionPlan);
  }

  const steps = normalizeSteps(executionPlan.steps);
  const repositoryOperations = buildRepositoryOperations(steps);
  const mutations = buildMutations(steps);

  const transactionBoundary =
    transactionPlan == null
      ? buildTransactionBoundaryFromRequirements(
          executionPlan.transactionRequirements,
          steps
        )
      : buildTransactionBoundaryFromPlan(transactionPlan);

  const simulationReason = resolveSimulationReason(action);
  const expectedOutcome = buildExpectedOutcome(
    action,
    mutations,
    simulationReason
  );

  const wouldWrite =
    action === PERSISTENCE_ACTIONS.PERSIST && mutations.length > 0;
  const wouldEnqueue =
    action === PERSISTENCE_ACTIONS.REVIEW && mutations.length > 0;

  return buildReport({
    action,
    repositoryOperations,
    mutations,
    transactionBoundary,
    expectedOutcome,
    metadata: buildReportMetadata({
      simulationReason,
      executionPlan,
      transactionPlan,
      extras: {
        stepCount: steps.length,
        repositoryOperationCount: repositoryOperations.length,
        mutationCount: mutations.length,
        wouldWriteIfExecuted: wouldWrite,
        wouldEnqueueIfExecuted: wouldEnqueue,
        mutating: mutations.length > 0,
        noop: expectedOutcome.noop === true,
        repositoryDependencies: Array.isArray(
          executionPlan.repositoryDependencies
        )
          ? [...executionPlan.repositoryDependencies].map(String).sort()
          : []
      }
    })
  });
}

/**
 * Convenience: assert a simulation report never records execution or
 * side effects.
 *
 * @param {DryRunSimulationReport} report
 * @returns {boolean}
 */
function isDryRunSimulationArchitectureOnly(report) {
  return (
    isPlainObject(report) &&
    report.simulated === true &&
    report.executed === false &&
    report.architectureOnly === true &&
    report.advisory === true &&
    report.metadata != null &&
    report.metadata.sideEffects === false &&
    report.metadata.repositoriesInvoked === false &&
    report.metadata.persistenceEnabled === false &&
    report.metadata.transactionBegun === false &&
    report.metadata.transactionCommitted === false &&
    report.metadata.transactionRolledBack === false &&
    Array.isArray(report.repositoryOperations) &&
    report.repositoryOperations.every((op) => op.invoked === false) &&
    Array.isArray(report.mutations) &&
    report.mutations.every((m) => m.mutated === false) &&
    report.transactionBoundary != null &&
    report.transactionBoundary.begun === false &&
    report.transactionBoundary.committed === false &&
    report.transactionBoundary.rolledBack === false
  );
}

module.exports = {
  SIMULATION_PHASE,
  DRY_RUN_SIMULATION_REASONS,
  EXPECTED_OUTCOME_STATUSES,
  MUTATION_KINDS,
  REPOSITORY_OPERATION_KINDS,
  simulateDryRunPersistence,
  isDryRunSimulationArchitectureOnly
};
