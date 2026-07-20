"use strict";

/**
 * Phase 37 — Persistence Execution Pipeline (architecture only).
 *
 * Converts advisory PersistencePolicyDecision values into ordered
 * execution plans that describe future persistence flow.
 *
 * Never executes repository methods. Never accesses databases, queues,
 * Express, or the filesystem. Never mutates runtime state, workers,
 * or feature flags. Never enables persistence.
 *
 * Plans are deterministic descriptions only: executable is always false.
 */

const {
  PERSISTENCE_ACTIONS
} = require("./runtimePersistencePolicy");

const {
  REPOSITORY_DOMAINS
} = require("./persistenceRepositoryContracts");

const PIPELINE_PLAN_REASONS = Object.freeze({
  INVALID_DECISION: "INVALID_DECISION",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  PLAN_GENERATED: "PLAN_GENERATED",
  NOOP_PREVIEW: "NOOP_PREVIEW",
  NOOP_SKIP: "NOOP_SKIP"
});

const STEP_KINDS = Object.freeze({
  VALIDATE_GUARD: "validate_guard",
  REPOSITORY_CALL: "repository_call",
  ENQUEUE_REVIEW: "enqueue_review",
  NOOP: "noop",
  FINALIZE: "finalize"
});

const TRANSACTION_SCOPES = Object.freeze({
  NONE: "none",
  RECRUITMENT_AND_EVENT: "recruitment_and_event",
  REVIEW_ONLY: "review_only"
});

const SUPPORTED_ACTIONS = Object.freeze(
  new Set(Object.values(PERSISTENCE_ACTIONS))
);

/**
 * @typedef {Object} PersistenceExecutionStep
 * @property {number} order
 * @property {string} id
 * @property {string} kind
 * @property {string} description
 * @property {string|null} repository
 * @property {string|null} method
 * @property {boolean} required
 * @property {boolean} transactional
 */

/**
 * @typedef {Object} PersistenceTransactionRequirements
 * @property {boolean} required
 * @property {string} scope
 * @property {string|null} isolationHint
 * @property {string[]} stepsInTransaction
 */

/**
 * @typedef {Object} PersistenceExecutionPlan
 * @property {string} action
 * @property {boolean} executable
 * @property {boolean} architectureOnly
 * @property {PersistenceExecutionStep[]} steps
 * @property {string[]} repositoryDependencies
 * @property {PersistenceTransactionRequirements} transactionRequirements
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

function freezeStep(step) {
  return Object.freeze({
    order: step.order,
    id: step.id,
    kind: step.kind,
    description: step.description,
    repository: step.repository == null ? null : String(step.repository),
    method: step.method == null ? null : String(step.method),
    required: step.required === true,
    transactional: step.transactional === true
  });
}

function buildStep(partial) {
  return freezeStep({
    order: partial.order,
    id: partial.id,
    kind: partial.kind,
    description: partial.description,
    repository: partial.repository,
    method: partial.method,
    required: partial.required !== false,
    transactional: partial.transactional === true
  });
}

function buildTransactionRequirements({
  required,
  scope,
  isolationHint,
  stepsInTransaction
}) {
  const stepIds = Array.isArray(stepsInTransaction)
    ? [...stepsInTransaction]
    : [];
  return Object.freeze({
    required: required === true,
    scope: scope == null ? TRANSACTION_SCOPES.NONE : String(scope),
    isolationHint: isolationHint == null ? null : String(isolationHint),
    stepsInTransaction: Object.freeze(stepIds)
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v != null && v !== ""))].sort();
}

function buildPlanMetadata({
  decision,
  planReason,
  intendedAction,
  extras
}) {
  const policyReasons = Array.isArray(decision && decision.reasons)
    ? [...decision.reasons]
    : [];

  return {
    planReason: String(planReason),
    intendedAction: intendedAction == null ? null : String(intendedAction),
    policyAction:
      decision && decision.action != null ? String(decision.action) : null,
    policyReason:
      decision && decision.reason != null ? String(decision.reason) : null,
    policyReasons,
    policyMetadata: clonePlain(decision && decision.metadata),
    sideEffects: false,
    planOnly: true,
    architectureOnly: true,
    repositoriesInvoked: false,
    persistenceEnabled: false,
    ...extras
  };
}

function buildPlan({
  action,
  steps,
  repositoryDependencies,
  transactionRequirements,
  metadata
}) {
  const orderedSteps = steps.map((step, index) => {
    if (step.order === index + 1) {
      return step;
    }
    return freezeStep({ ...step, order: index + 1 });
  });

  return {
    action: String(action),
    executable: false,
    architectureOnly: true,
    steps: orderedSteps,
    repositoryDependencies: uniqueSorted(repositoryDependencies),
    transactionRequirements,
    metadata
  };
}

function planPersist(decision, intendedAction, policyIntendedAction) {
  const steps = [
    buildStep({
      order: 1,
      id: "validate_persist_guards",
      kind: STEP_KINDS.VALIDATE_GUARD,
      description:
        "Validate eligibility, identity signals, and automation preconditions before writes.",
      repository: null,
      method: null,
      required: true,
      transactional: false
    }),
    buildStep({
      order: 2,
      id: "resolve_recruitment_identity",
      kind: STEP_KINDS.REPOSITORY_CALL,
      description:
        "Look up existing recruitment candidates by advertisement number and lookup filters.",
      repository: REPOSITORY_DOMAINS.RECRUITMENT,
      method: "findCandidatesForLookup",
      required: true,
      transactional: true
    }),
    buildStep({
      order: 3,
      id: "persist_recruitment",
      kind: STEP_KINDS.REPOSITORY_CALL,
      description:
        "Create or update the recruitment entity via the recruitment repository contract.",
      repository: REPOSITORY_DOMAINS.RECRUITMENT,
      method: "createRecruitment",
      required: true,
      transactional: true
    }),
    buildStep({
      order: 4,
      id: "persist_recruitment_event",
      kind: STEP_KINDS.REPOSITORY_CALL,
      description:
        "Create the lifecycle event bound to the recruitment via the event repository contract.",
      repository: REPOSITORY_DOMAINS.RECRUITMENT_EVENT,
      method: "createRecruitmentEvent",
      required: true,
      transactional: true
    }),
    buildStep({
      order: 5,
      id: "finalize_persist",
      kind: STEP_KINDS.FINALIZE,
      description:
        "Mark the planned persist transaction boundary for a future executor.",
      repository: null,
      method: null,
      required: true,
      transactional: false
    })
  ];

  const transactionalIds = steps
    .filter((step) => step.transactional)
    .map((step) => step.id);

  return buildPlan({
    action: PERSISTENCE_ACTIONS.PERSIST,
    steps,
    repositoryDependencies: [
      REPOSITORY_DOMAINS.RECRUITMENT,
      REPOSITORY_DOMAINS.RECRUITMENT_EVENT
    ],
    transactionRequirements: buildTransactionRequirements({
      required: true,
      scope: TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT,
      isolationHint: "READ_COMMITTED",
      stepsInTransaction: transactionalIds
    }),
    metadata: buildPlanMetadata({
      decision,
      planReason: PIPELINE_PLAN_REASONS.PLAN_GENERATED,
      intendedAction,
      extras: {
        policyIntendedAction,
        wouldWriteIfExecuted: true,
        mutating: true
      }
    })
  });
}

function planReview(decision, intendedAction, policyIntendedAction) {
  const steps = [
    buildStep({
      order: 1,
      id: "validate_review_guards",
      kind: STEP_KINDS.VALIDATE_GUARD,
      description:
        "Validate review signals and enqueue preconditions before creating a review item.",
      repository: null,
      method: null,
      required: true,
      transactional: false
    }),
    buildStep({
      order: 2,
      id: "enqueue_review_item",
      kind: STEP_KINDS.ENQUEUE_REVIEW,
      description:
        "Create a pending review-queue item via the review repository contract.",
      repository: REPOSITORY_DOMAINS.REVIEW,
      method: "createReviewItem",
      required: true,
      transactional: true
    }),
    buildStep({
      order: 3,
      id: "finalize_review",
      kind: STEP_KINDS.FINALIZE,
      description:
        "Mark the planned review enqueue boundary for a future executor.",
      repository: null,
      method: null,
      required: true,
      transactional: false
    })
  ];

  const transactionalIds = steps
    .filter((step) => step.transactional)
    .map((step) => step.id);

  return buildPlan({
    action: PERSISTENCE_ACTIONS.REVIEW,
    steps,
    repositoryDependencies: [REPOSITORY_DOMAINS.REVIEW],
    transactionRequirements: buildTransactionRequirements({
      required: true,
      scope: TRANSACTION_SCOPES.REVIEW_ONLY,
      isolationHint: "READ_COMMITTED",
      stepsInTransaction: transactionalIds
    }),
    metadata: buildPlanMetadata({
      decision,
      planReason: PIPELINE_PLAN_REASONS.PLAN_GENERATED,
      intendedAction,
      extras: {
        policyIntendedAction,
        wouldEnqueueIfExecuted: true,
        mutating: true
      }
    })
  });
}

function planPreviewOnly(decision, intendedAction, policyIntendedAction) {
  const steps = [
    buildStep({
      order: 1,
      id: "noop_preview",
      kind: STEP_KINDS.NOOP,
      description:
        "Advisory preview-only path: no repository writes or queue enqueue.",
      repository: null,
      method: null,
      required: true,
      transactional: false
    })
  ];

  return buildPlan({
    action: PERSISTENCE_ACTIONS.PREVIEW_ONLY,
    steps,
    repositoryDependencies: [],
    transactionRequirements: buildTransactionRequirements({
      required: false,
      scope: TRANSACTION_SCOPES.NONE,
      isolationHint: null,
      stepsInTransaction: []
    }),
    metadata: buildPlanMetadata({
      decision,
      planReason: PIPELINE_PLAN_REASONS.NOOP_PREVIEW,
      intendedAction,
      extras: {
        policyIntendedAction,
        wouldWriteIfExecuted: false,
        mutating: false,
        noop: true
      }
    })
  });
}

function planSkip(decision, intendedAction, planReason, policyIntendedAction) {
  const steps = [
    buildStep({
      order: 1,
      id: "noop_skip",
      kind: STEP_KINDS.NOOP,
      description: "Skip path: no persistence or review side effects planned.",
      repository: null,
      method: null,
      required: true,
      transactional: false
    })
  ];

  return buildPlan({
    action: PERSISTENCE_ACTIONS.SKIP,
    steps,
    repositoryDependencies: [],
    transactionRequirements: buildTransactionRequirements({
      required: false,
      scope: TRANSACTION_SCOPES.NONE,
      isolationHint: null,
      stepsInTransaction: []
    }),
    metadata: buildPlanMetadata({
      decision,
      planReason,
      intendedAction,
      extras: {
        policyIntendedAction:
          policyIntendedAction === undefined ? null : policyIntendedAction,
        wouldWriteIfExecuted: false,
        mutating: false,
        noop: true
      }
    })
  });
}

/**
 * Build an ordered persistence execution plan from an advisory decision.
 * Pure: no I/O, no mutation of inputs, no repository invocation.
 *
 * @param {Object|null|undefined} decision - PersistencePolicyDecision
 * @param {Object|null|undefined} [_options] - Reserved for future planners; ignored
 * @returns {PersistenceExecutionPlan}
 */
function buildPersistenceExecutionPlan(decision, _options) {
  if (!isPlainObject(decision)) {
    return planSkip(
      null,
      null,
      PIPELINE_PLAN_REASONS.INVALID_DECISION,
      null
    );
  }

  const intendedAction = normalizeAction(decision.action);
  const policyIntendedAction =
    decision.metadata && decision.metadata.intendedAction != null
      ? normalizeAction(decision.metadata.intendedAction)
      : intendedAction;

  if (intendedAction == null || !SUPPORTED_ACTIONS.has(intendedAction)) {
    return planSkip(
      decision,
      intendedAction,
      PIPELINE_PLAN_REASONS.UNKNOWN_ACTION,
      policyIntendedAction
    );
  }

  if (intendedAction === PERSISTENCE_ACTIONS.PERSIST) {
    return planPersist(decision, intendedAction, policyIntendedAction);
  }
  if (intendedAction === PERSISTENCE_ACTIONS.REVIEW) {
    return planReview(decision, intendedAction, policyIntendedAction);
  }
  if (intendedAction === PERSISTENCE_ACTIONS.PREVIEW_ONLY) {
    return planPreviewOnly(decision, intendedAction, policyIntendedAction);
  }

  return planSkip(
    decision,
    intendedAction,
    PIPELINE_PLAN_REASONS.NOOP_SKIP,
    policyIntendedAction
  );
}

/**
 * Convenience: assert a plan never marks itself executable.
 * @param {PersistenceExecutionPlan} plan
 * @returns {boolean}
 */
function isPlanArchitectureOnly(plan) {
  return (
    isPlainObject(plan) &&
    plan.executable === false &&
    plan.architectureOnly === true &&
    plan.metadata != null &&
    plan.metadata.sideEffects === false &&
    plan.metadata.repositoriesInvoked === false
  );
}

module.exports = {
  PIPELINE_PLAN_REASONS,
  STEP_KINDS,
  TRANSACTION_SCOPES,
  buildPersistenceExecutionPlan,
  isPlanArchitectureOnly
};
