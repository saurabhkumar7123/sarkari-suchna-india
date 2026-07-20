"use strict";

/**
 * Phase 38 — Transaction Coordinator / Unit of Work (architecture only).
 *
 * Transforms PersistenceExecutionPlan values into advisory transaction
 * (unit-of-work) plans that describe planned begin / commit / rollback
 * boundaries around ordered execution steps.
 *
 * Never begins, commits, or rolls back a real transaction. Never
 * executes repository methods. Never accesses databases, queues,
 * Express, or the filesystem. Never mutates runtime state, workers,
 * or feature flags. Never enables persistence.
 *
 * Plans are deterministic descriptions only: executable is always false.
 */

const {
  TRANSACTION_SCOPES
} = require("./persistenceExecutionPipeline");

const TRANSACTION_PLAN_REASONS = Object.freeze({
  INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
  TRANSACTION_REQUIRED: "TRANSACTION_REQUIRED",
  NO_TRANSACTION: "NO_TRANSACTION",
  TRANSACTION_PLAN_GENERATED: "TRANSACTION_PLAN_GENERATED"
});

const TRANSACTION_STAGE_KINDS = Object.freeze({
  BEGIN: "begin",
  COMMIT: "commit",
  ROLLBACK: "rollback",
  STEP: "step",
  NOOP: "noop"
});

/**
 * @typedef {Object} TransactionStage
 * @property {number} order
 * @property {string} id
 * @property {string} kind
 * @property {string} description
 * @property {boolean} planned
 * @property {boolean} executed
 * @property {string|null} stepId
 * @property {boolean} transactional
 * @property {string} path
 */

/**
 * @typedef {Object} TransactionUnitOfWork
 * @property {TransactionStage|null} begin
 * @property {TransactionStage|null} commit
 * @property {TransactionStage|null} rollback
 */

/**
 * @typedef {Object} TransactionPlan
 * @property {string|null} action
 * @property {boolean} transactionRequired
 * @property {string} scope
 * @property {string|null} isolationHint
 * @property {boolean} executable
 * @property {boolean} architectureOnly
 * @property {TransactionStage[]} stages
 * @property {string[]} orderedStepIds
 * @property {string[]} stepsInTransaction
 * @property {TransactionUnitOfWork} unitOfWork
 * @property {TransactionStage|null} rollbackStage
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

function freezeStage(stage) {
  return Object.freeze({
    order: stage.order,
    id: String(stage.id),
    kind: String(stage.kind),
    description: String(stage.description),
    planned: stage.planned !== false,
    executed: stage.executed === true,
    stepId: stage.stepId == null ? null : String(stage.stepId),
    transactional: stage.transactional === true,
    path: stage.path == null ? "success" : String(stage.path)
  });
}

function buildStage(partial) {
  return freezeStage({
    order: partial.order,
    id: partial.id,
    kind: partial.kind,
    description: partial.description,
    planned: true,
    executed: false,
    stepId: partial.stepId,
    transactional: partial.transactional === true,
    path: partial.path == null ? "success" : partial.path
  });
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

function normalizeTransactionRequirements(raw, steps) {
  const stepIds = new Set(steps.map((s) => s.id));
  const fromSteps = steps.filter((s) => s.transactional).map((s) => s.id);

  if (!isPlainObject(raw)) {
    return Object.freeze({
      required: fromSteps.length > 0,
      scope:
        fromSteps.length > 0
          ? TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT
          : TRANSACTION_SCOPES.NONE,
      isolationHint: fromSteps.length > 0 ? "READ_COMMITTED" : null,
      stepsInTransaction: Object.freeze([...fromSteps])
    });
  }

  const declaredIds = Array.isArray(raw.stepsInTransaction)
    ? raw.stepsInTransaction
        .filter((id) => id != null && id !== "")
        .map((id) => String(id))
        .filter((id) => stepIds.has(id))
    : [];

  const stepsInTransaction =
    declaredIds.length > 0
      ? declaredIds
      : fromSteps;

  const required =
    raw.required === true || stepsInTransaction.length > 0;

  let scope;
  if (raw.scope != null && String(raw.scope).trim() !== "") {
    scope = String(raw.scope);
  } else if (!required) {
    scope = TRANSACTION_SCOPES.NONE;
  } else {
    scope = TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT;
  }

  const isolationHint =
    raw.isolationHint == null || raw.isolationHint === ""
      ? required
        ? "READ_COMMITTED"
        : null
      : String(raw.isolationHint);

  return Object.freeze({
    required,
    scope: required ? scope : TRANSACTION_SCOPES.NONE,
    isolationHint: required ? isolationHint : null,
    stepsInTransaction: Object.freeze(
      required ? [...stepsInTransaction] : []
    )
  });
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

function buildPlanMetadata({
  planReason,
  executionPlan,
  extras
}) {
  return {
    planReason: String(planReason),
    sideEffects: false,
    planOnly: true,
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
    ...extras
  };
}

function buildRollbackStage() {
  return buildStage({
    order: 0,
    id: "rollback_transaction",
    kind: TRANSACTION_STAGE_KINDS.ROLLBACK,
    description:
      "Planned rollback boundary for a future unit-of-work executor on failure.",
    stepId: null,
    transactional: true,
    path: "failure"
  });
}

function buildBeginStage(order, isolationHint) {
  const isolation =
    isolationHint == null ? "default" : String(isolationHint);
  return buildStage({
    order,
    id: "begin_transaction",
    kind: TRANSACTION_STAGE_KINDS.BEGIN,
    description: `Planned transaction begin (isolation hint: ${isolation}).`,
    stepId: null,
    transactional: true,
    path: "success"
  });
}

function buildCommitStage(order) {
  return buildStage({
    order,
    id: "commit_transaction",
    kind: TRANSACTION_STAGE_KINDS.COMMIT,
    description: "Planned transaction commit after in-scope steps succeed.",
    stepId: null,
    transactional: true,
    path: "success"
  });
}

function buildStepStage(order, step, inTransactionSet) {
  const inTxn = inTransactionSet.has(step.id);
  const kind =
    step.kind === "noop"
      ? TRANSACTION_STAGE_KINDS.NOOP
      : TRANSACTION_STAGE_KINDS.STEP;
  return buildStage({
    order,
    id: `stage_${step.id}`,
    kind,
    description:
      step.description ||
      `Planned execution of step '${step.id}' without running it.`,
    stepId: step.id,
    transactional: inTxn,
    path: "success"
  });
}

function buildUnitOfWork(begin, commit, rollback) {
  return Object.freeze({
    begin: begin == null ? null : begin,
    commit: commit == null ? null : commit,
    rollback: rollback == null ? null : rollback
  });
}

function finalizeStages(stages) {
  return stages.map((stage, index) => {
    if (stage.order === index + 1) {
      return stage;
    }
    return freezeStage({ ...stage, order: index + 1 });
  });
}

function buildTransactionPlanResult({
  action,
  transactionRequired,
  scope,
  isolationHint,
  stages,
  orderedStepIds,
  stepsInTransaction,
  unitOfWork,
  rollbackStage,
  metadata
}) {
  return {
    action: action == null ? null : String(action),
    transactionRequired: transactionRequired === true,
    scope: String(scope),
    isolationHint: isolationHint == null ? null : String(isolationHint),
    executable: false,
    architectureOnly: true,
    stages: finalizeStages(stages),
    orderedStepIds: Object.freeze([...orderedStepIds]),
    stepsInTransaction: Object.freeze([...stepsInTransaction]),
    unitOfWork,
    rollbackStage: rollbackStage == null ? null : rollbackStage,
    metadata
  };
}

function planWithoutTransaction(executionPlan, steps, txnReq, planReason) {
  const stages = steps.map((step, index) =>
    buildStepStage(index + 1, step, new Set())
  );

  return buildTransactionPlanResult({
    action: executionPlan && executionPlan.action,
    transactionRequired: false,
    scope: TRANSACTION_SCOPES.NONE,
    isolationHint: null,
    stages,
    orderedStepIds: steps.map((s) => s.id),
    stepsInTransaction: [],
    unitOfWork: buildUnitOfWork(null, null, null),
    rollbackStage: null,
    metadata: buildPlanMetadata({
      planReason,
      executionPlan,
      extras: {
        transactionScope: TRANSACTION_SCOPES.NONE,
        wouldBeginIfExecuted: false,
        wouldCommitIfExecuted: false,
        wouldRollbackIfFailed: false,
        mutatingBoundary: false,
        sourceTransactionRequired: txnReq ? txnReq.required === true : false
      }
    })
  });
}

function planInvalid() {
  return buildTransactionPlanResult({
    action: null,
    transactionRequired: false,
    scope: TRANSACTION_SCOPES.NONE,
    isolationHint: null,
    stages: [
      buildStage({
        order: 1,
        id: "noop_invalid_plan",
        kind: TRANSACTION_STAGE_KINDS.NOOP,
        description:
          "Invalid execution plan: no transaction boundary planned.",
        stepId: null,
        transactional: false,
        path: "success"
      })
    ],
    orderedStepIds: [],
    stepsInTransaction: [],
    unitOfWork: buildUnitOfWork(null, null, null),
    rollbackStage: null,
    metadata: buildPlanMetadata({
      planReason: TRANSACTION_PLAN_REASONS.INVALID_EXECUTION_PLAN,
      executionPlan: null,
      extras: {
        transactionScope: TRANSACTION_SCOPES.NONE,
        wouldBeginIfExecuted: false,
        wouldCommitIfExecuted: false,
        wouldRollbackIfFailed: false,
        mutatingBoundary: false,
        sourceTransactionRequired: false
      }
    })
  });
}

function planWithTransaction(executionPlan, steps, txnReq) {
  const inTransactionSet = new Set(txnReq.stepsInTransaction);
  const orderedStepIds = steps.map((s) => s.id);
  const stages = [];
  let order = 0;
  let begun = false;
  let inside = false;
  let beginStage = null;
  let commitStage = null;

  function nextOrder() {
    order += 1;
    return order;
  }

  for (const step of steps) {
    const inTxn = inTransactionSet.has(step.id);

    if (inTxn && !begun) {
      beginStage = buildBeginStage(nextOrder(), txnReq.isolationHint);
      stages.push(beginStage);
      begun = true;
      inside = true;
    }

    if (!inTxn && inside) {
      commitStage = buildCommitStage(nextOrder());
      stages.push(commitStage);
      inside = false;
    }

    stages.push(buildStepStage(nextOrder(), step, inTransactionSet));
  }

  if (inside) {
    commitStage = buildCommitStage(nextOrder());
    stages.push(commitStage);
  }

  if (begun && commitStage == null) {
    commitStage = buildCommitStage(nextOrder());
    stages.push(commitStage);
  }

  if (!begun) {
    beginStage = buildBeginStage(nextOrder(), txnReq.isolationHint);
    commitStage = buildCommitStage(nextOrder());
    stages.push(beginStage, commitStage);
  }

  const rollbackStage = freezeStage({
    ...buildRollbackStage(),
    order: 0
  });

  return buildTransactionPlanResult({
    action: executionPlan.action,
    transactionRequired: true,
    scope: txnReq.scope,
    isolationHint: txnReq.isolationHint,
    stages,
    orderedStepIds,
    stepsInTransaction: txnReq.stepsInTransaction,
    unitOfWork: buildUnitOfWork(beginStage, commitStage, rollbackStage),
    rollbackStage,
    metadata: buildPlanMetadata({
      planReason: TRANSACTION_PLAN_REASONS.TRANSACTION_PLAN_GENERATED,
      executionPlan,
      extras: {
        transactionScope: txnReq.scope,
        wouldBeginIfExecuted: true,
        wouldCommitIfExecuted: true,
        wouldRollbackIfFailed: true,
        mutatingBoundary: true,
        sourceTransactionRequired: true,
        boundaryReason: TRANSACTION_PLAN_REASONS.TRANSACTION_REQUIRED
      }
    })
  });
}

/**
 * Build an advisory unit-of-work transaction plan from an execution plan.
 * Pure: no I/O, no mutation of inputs, no repository or SQL execution,
 * and no real begin/commit/rollback.
 *
 * @param {Object|null|undefined} executionPlan - PersistenceExecutionPlan
 * @param {Object|null|undefined} [_options] - Reserved for future coordinators; ignored
 * @returns {TransactionPlan}
 */
function buildTransactionPlan(executionPlan, _options) {
  if (!isValidExecutionPlan(executionPlan)) {
    return planInvalid();
  }

  const steps = normalizeSteps(executionPlan.steps);
  const txnReq = normalizeTransactionRequirements(
    executionPlan.transactionRequirements,
    steps
  );

  if (!txnReq.required) {
    return planWithoutTransaction(
      executionPlan,
      steps,
      txnReq,
      TRANSACTION_PLAN_REASONS.NO_TRANSACTION
    );
  }

  return planWithTransaction(executionPlan, steps, txnReq);
}

/**
 * Convenience: assert a transaction plan never marks itself executable
 * and never records a begun/committed/rolled-back transaction.
 *
 * @param {TransactionPlan} plan
 * @returns {boolean}
 */
function isTransactionPlanArchitectureOnly(plan) {
  return (
    isPlainObject(plan) &&
    plan.executable === false &&
    plan.architectureOnly === true &&
    plan.metadata != null &&
    plan.metadata.sideEffects === false &&
    plan.metadata.repositoriesInvoked === false &&
    plan.metadata.transactionBegun === false &&
    plan.metadata.transactionCommitted === false &&
    plan.metadata.transactionRolledBack === false &&
    plan.stages.every(
      (stage) => stage.planned === true && stage.executed === false
    )
  );
}

module.exports = {
  TRANSACTION_PLAN_REASONS,
  TRANSACTION_STAGE_KINDS,
  TRANSACTION_SCOPES,
  buildTransactionPlan,
  isTransactionPlanArchitectureOnly
};
