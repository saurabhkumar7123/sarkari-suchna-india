"use strict";

/**
 * Phase 34 — Runtime Persistence Service (architecture only).
 *
 * Interprets PersistencePolicyDecision into a structured execution result.
 * Never writes. Never touches repositories or queues. Never mutates
 * runtime state, never imports Express, and never writes files.
 *
 * Automatic persistence remains disabled. All mutating actions are blocked;
 * preview_only / skip complete as advisory no-ops.
 */

const {
  PERSISTENCE_ACTIONS,
  PERSISTENCE_REASONS
} = require("./runtimePersistencePolicy");

const EXECUTION_BLOCK_REASONS = Object.freeze({
  INVALID_DECISION: "INVALID_DECISION",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  AUTOMATION_DISABLED: "AUTOMATION_DISABLED",
  REVIEW_ENQUEUE_DISABLED: "REVIEW_ENQUEUE_DISABLED",
  EXECUTION_NOT_IMPLEMENTED: "EXECUTION_NOT_IMPLEMENTED"
});

const SUPPORTED_ACTIONS = Object.freeze(
  new Set(Object.values(PERSISTENCE_ACTIONS))
);

/**
 * @typedef {Object} PersistenceExecutionOptions
 * @property {boolean} [automaticPersistenceEnabled]
 * @property {boolean} [reviewQueueEnqueueEnabled]
 */

/**
 * @typedef {Object} PersistenceExecutionResult
 * @property {string|null} intendedAction
 * @property {string} actualAction
 * @property {boolean} executed
 * @property {boolean} executionBlocked
 * @property {boolean} advisory
 * @property {string|null} blockReason
 * @property {Object} metadata
 */

function asBool(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value === true;
}

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

function resolveFlags(decision, options) {
  const opts = isPlainObject(options) ? options : {};
  const policyMeta = isPlainObject(decision && decision.metadata)
    ? decision.metadata
    : {};

  return {
    automaticPersistenceEnabled: asBool(
      opts.automaticPersistenceEnabled,
      asBool(policyMeta.automationEnabled, false)
    ),
    reviewQueueEnqueueEnabled: asBool(
      opts.reviewQueueEnqueueEnabled,
      asBool(policyMeta.reviewQueueEnqueueEnabled, false)
    )
  };
}

function buildResult({
  intendedAction,
  actualAction,
  executed,
  executionBlocked,
  blockReason,
  metadata
}) {
  return {
    intendedAction,
    actualAction,
    executed: executed === true,
    executionBlocked: executionBlocked === true,
    advisory: true,
    blockReason: blockReason == null ? null : String(blockReason),
    metadata
  };
}

function buildMetadata({
  decision,
  flags,
  extras
}) {
  const policyReasons = Array.isArray(decision && decision.reasons)
    ? [...decision.reasons]
    : [];

  return {
    policyAction:
      decision && decision.action != null ? String(decision.action) : null,
    policyReason:
      decision && decision.reason != null ? String(decision.reason) : null,
    policyReasons,
    policyMetadata: clonePlain(decision && decision.metadata),
    automaticPersistenceEnabled: flags.automaticPersistenceEnabled,
    reviewQueueEnqueueEnabled: flags.reviewQueueEnqueueEnabled,
    sideEffects: false,
    architectureOnly: true,
    ...extras
  };
}

/**
 * Interpret a persistence policy decision into an execution result.
 * Pure: no I/O, no mutation of inputs, no side effects.
 *
 * @param {Object|null|undefined} decision - PersistencePolicyDecision
 * @param {PersistenceExecutionOptions|null|undefined} [options]
 * @returns {PersistenceExecutionResult}
 */
function executeRuntimePersistence(decision, options) {
  if (!isPlainObject(decision)) {
    const flags = resolveFlags(null, options);
    return buildResult({
      intendedAction: null,
      actualAction: PERSISTENCE_ACTIONS.SKIP,
      executed: false,
      executionBlocked: true,
      blockReason: EXECUTION_BLOCK_REASONS.INVALID_DECISION,
      metadata: buildMetadata({
        decision: null,
        flags,
        extras: {
          policyIntendedAction: null
        }
      })
    });
  }

  const flags = resolveFlags(decision, options);
  const intendedAction = normalizeAction(decision.action);
  const policyIntendedAction =
    decision.metadata && decision.metadata.intendedAction != null
      ? normalizeAction(decision.metadata.intendedAction)
      : intendedAction;

  if (intendedAction == null || !SUPPORTED_ACTIONS.has(intendedAction)) {
    return buildResult({
      intendedAction,
      actualAction: PERSISTENCE_ACTIONS.SKIP,
      executed: false,
      executionBlocked: true,
      blockReason: EXECUTION_BLOCK_REASONS.UNKNOWN_ACTION,
      metadata: buildMetadata({
        decision,
        flags,
        extras: { policyIntendedAction }
      })
    });
  }

  if (intendedAction === PERSISTENCE_ACTIONS.PERSIST) {
    if (!flags.automaticPersistenceEnabled) {
      return buildResult({
        intendedAction,
        actualAction: PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        executed: false,
        executionBlocked: true,
        blockReason: EXECUTION_BLOCK_REASONS.AUTOMATION_DISABLED,
        metadata: buildMetadata({
          decision,
          flags,
          extras: {
            policyIntendedAction,
            wouldPersistIfImplemented: true
          }
        })
      });
    }

    // Architecture only: never perform writes even when automation is enabled.
    return buildResult({
      intendedAction,
      actualAction: PERSISTENCE_ACTIONS.PERSIST,
      executed: false,
      executionBlocked: true,
      blockReason: EXECUTION_BLOCK_REASONS.EXECUTION_NOT_IMPLEMENTED,
      metadata: buildMetadata({
        decision,
        flags,
        extras: {
          policyIntendedAction,
          wouldPersistIfImplemented: true
        }
      })
    });
  }

  if (intendedAction === PERSISTENCE_ACTIONS.REVIEW) {
    if (!flags.reviewQueueEnqueueEnabled) {
      return buildResult({
        intendedAction,
        actualAction: PERSISTENCE_ACTIONS.REVIEW,
        executed: false,
        executionBlocked: true,
        blockReason: EXECUTION_BLOCK_REASONS.REVIEW_ENQUEUE_DISABLED,
        metadata: buildMetadata({
          decision,
          flags,
          extras: {
            policyIntendedAction,
            wouldReviewIfImplemented: true
          }
        })
      });
    }

    return buildResult({
      intendedAction,
      actualAction: PERSISTENCE_ACTIONS.REVIEW,
      executed: false,
      executionBlocked: true,
      blockReason: EXECUTION_BLOCK_REASONS.EXECUTION_NOT_IMPLEMENTED,
      metadata: buildMetadata({
        decision,
        flags,
        extras: {
          policyIntendedAction,
          wouldReviewIfImplemented: true
        }
      })
    });
  }

  // preview_only and skip: advisory no-ops that complete without side effects.
  return buildResult({
    intendedAction,
    actualAction: intendedAction,
    executed: true,
    executionBlocked: false,
    blockReason: null,
    metadata: buildMetadata({
      decision,
      flags,
      extras: {
        policyIntendedAction,
        noop: true,
        ...(intendedAction === PERSISTENCE_ACTIONS.PREVIEW_ONLY
          ? { policyReasonHint: PERSISTENCE_REASONS.SAFE_DEFAULT_PREVIEW }
          : {})
      }
    })
  });
}

module.exports = {
  EXECUTION_BLOCK_REASONS,
  executeRuntimePersistence
};
