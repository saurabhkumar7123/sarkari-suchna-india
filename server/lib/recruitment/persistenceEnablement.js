"use strict";

/**
 * Phase 44 — Feature Flagged Persistence Enablement Framework (architecture only).
 *
 * Evaluates whether future persistence or review-queue execution would be
 * allowed given an execution mode and feature-control flags.
 *
 * Never enables persistence. Never enables review queues.
 * Never writes database data. Never calls repositories.
 * Never modifies workers. Never changes runtime behavior.
 * Never starts transactions.
 *
 * Decisions are deterministic, side-effect-free, and advisory only:
 * architectureOnly is always true; executed is always false;
 * persistenceEnabled remains false in metadata.
 */

const ENABLEMENT_PHASE = 44;

const EXECUTION_MODES = Object.freeze({
  PREVIEW: "preview",
  DRY_RUN: "dry_run",
  LIVE: "live"
});

const SUPPORTED_EXECUTION_MODES = Object.freeze(
  new Set(Object.values(EXECUTION_MODES))
);

const ENABLEMENT_CAPABILITIES = Object.freeze({
  PERSISTENCE: "persistence",
  REVIEW_ENQUEUE: "review_enqueue",
  BOTH: "both"
});

const ENABLEMENT_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  INVALID_EXECUTION_MODE: "INVALID_EXECUTION_MODE",
  INVALID_FEATURE_FLAGS: "INVALID_FEATURE_FLAGS",
  INVALID_CAPABILITY: "INVALID_CAPABILITY",
  PIPELINE_DISABLED: "PIPELINE_DISABLED",
  AUTOMATION_DISABLED: "AUTOMATION_DISABLED",
  REVIEW_ENQUEUE_DISABLED: "REVIEW_ENQUEUE_DISABLED",
  PREVIEW_MODE: "PREVIEW_MODE",
  DRY_RUN_MODE: "DRY_RUN_MODE",
  LIVE_MODE_SAFETY_BLOCK: "LIVE_MODE_SAFETY_BLOCK",
  PERSISTENCE_ALLOWED: "PERSISTENCE_ALLOWED",
  REVIEW_ENQUEUE_ALLOWED: "REVIEW_ENQUEUE_ALLOWED",
  SAFE_DEFAULT_DISABLED: "SAFE_DEFAULT_DISABLED"
});

const DEFAULT_FEATURE_FLAGS = Object.freeze({
  pipelineEnabled: true,
  automaticPersistenceEnabled: false,
  reviewQueueEnqueueEnabled: false
});

/**
 * @typedef {Object} EnablementFeatureFlags
 * @property {boolean} [pipelineEnabled]
 * @property {boolean} [automaticPersistenceEnabled]
 * @property {boolean} [reviewQueueEnqueueEnabled]
 */

/**
 * @typedef {Object} PersistenceEnablementConfig
 * @property {string} [executionMode]
 * @property {EnablementFeatureFlags} [featureFlags]
 * @property {string} [capability]
 */

/**
 * @typedef {Object} EnablementFeatureState
 * @property {boolean} pipelineEnabled
 * @property {boolean} automaticPersistenceEnabled
 * @property {boolean} reviewQueueEnqueueEnabled
 */

/**
 * @typedef {Object} CapabilityEnablementVerdict
 * @property {boolean} allowed
 * @property {boolean} blocked
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} PersistenceEnablementDecision
 * @property {boolean} allowed
 * @property {boolean} blocked
 * @property {string} executionMode
 * @property {EnablementFeatureState} featureState
 * @property {CapabilityEnablementVerdict} persistence
 * @property {CapabilityEnablementVerdict} reviewEnqueue
 * @property {string} reason
 * @property {string[]} reasons
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 * @property {boolean} advisory
 * @property {Object} metadata
 */

/**
 * @typedef {Object} EnablementConfigValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} reasons
 */

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asBool(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value === true;
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

function normalizeCapability(value) {
  if (value == null || value === "") {
    return ENABLEMENT_CAPABILITIES.BOTH;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? ENABLEMENT_CAPABILITIES.BOTH : normalized;
}

/**
 * Fail-safe defaults aligned with Phase 33 PersistenceFeatureFlags:
 * - automaticPersistenceEnabled → false
 * - reviewQueueEnqueueEnabled → false
 * - pipelineEnabled → true when omitted
 *
 * @param {EnablementFeatureFlags|null|undefined} flags
 * @returns {EnablementFeatureState}
 */
function resolveFeatureState(flags) {
  const source = isPlainObject(flags) ? flags : {};
  return {
    pipelineEnabled: asBool(source.pipelineEnabled, DEFAULT_FEATURE_FLAGS.pipelineEnabled),
    automaticPersistenceEnabled: asBool(
      source.automaticPersistenceEnabled,
      DEFAULT_FEATURE_FLAGS.automaticPersistenceEnabled
    ),
    reviewQueueEnqueueEnabled: asBool(
      source.reviewQueueEnqueueEnabled,
      DEFAULT_FEATURE_FLAGS.reviewQueueEnqueueEnabled
    )
  };
}

/**
 * @returns {PersistenceEnablementConfig}
 */
function createDefaultEnablementConfig() {
  return {
    executionMode: EXECUTION_MODES.LIVE,
    featureFlags: {
      pipelineEnabled: DEFAULT_FEATURE_FLAGS.pipelineEnabled,
      automaticPersistenceEnabled:
        DEFAULT_FEATURE_FLAGS.automaticPersistenceEnabled,
      reviewQueueEnqueueEnabled: DEFAULT_FEATURE_FLAGS.reviewQueueEnqueueEnabled
    },
    capability: ENABLEMENT_CAPABILITIES.BOTH
  };
}

/**
 * Validate an enablement configuration without evaluating allow/block.
 *
 * @param {PersistenceEnablementConfig|null|undefined} config
 * @returns {EnablementConfigValidationResult}
 */
function validateEnablementConfig(config) {
  if (!isPlainObject(config)) {
    return {
      valid: false,
      errors: ["enablement config must be an object"],
      reasons: sortReasons([ENABLEMENT_REASONS.INVALID_CONFIGURATION])
    };
  }

  const errors = [];
  const reasons = [];

  const mode = normalizeMode(config.executionMode);
  if (mode == null) {
    errors.push("executionMode is required");
    reasons.push(ENABLEMENT_REASONS.INVALID_CONFIGURATION);
  } else if (!SUPPORTED_EXECUTION_MODES.has(mode)) {
    errors.push("executionMode is unsupported");
    reasons.push(ENABLEMENT_REASONS.INVALID_EXECUTION_MODE);
  }

  if (
    config.featureFlags !== undefined &&
    config.featureFlags !== null &&
    !isPlainObject(config.featureFlags)
  ) {
    errors.push("featureFlags must be an object when provided");
    reasons.push(ENABLEMENT_REASONS.INVALID_FEATURE_FLAGS);
  }

  if (config.capability !== undefined && config.capability !== null) {
    const capability = normalizeCapability(config.capability);
    if (
      capability !== ENABLEMENT_CAPABILITIES.PERSISTENCE &&
      capability !== ENABLEMENT_CAPABILITIES.REVIEW_ENQUEUE &&
      capability !== ENABLEMENT_CAPABILITIES.BOTH
    ) {
      errors.push("capability is unsupported");
      reasons.push(ENABLEMENT_REASONS.INVALID_CAPABILITY);
    }
  }

  if (errors.length === 0) {
    return {
      valid: true,
      errors: [],
      reasons: [ENABLEMENT_REASONS.VALID]
    };
  }

  return {
    valid: false,
    errors,
    reasons: sortReasons(reasons)
  };
}

function buildCapabilityVerdict(reasons) {
  const sorted = sortReasons(reasons);
  const allowed =
    sorted.includes(ENABLEMENT_REASONS.PERSISTENCE_ALLOWED) ||
    sorted.includes(ENABLEMENT_REASONS.REVIEW_ENQUEUE_ALLOWED);
  const blocked = !allowed;
  return {
    allowed,
    blocked,
    reasons: sorted
  };
}

function evaluatePersistenceCapability(executionMode, featureState) {
  const reasons = [];

  if (!featureState.pipelineEnabled) {
    reasons.push(ENABLEMENT_REASONS.PIPELINE_DISABLED);
    return buildCapabilityVerdict(reasons);
  }

  if (executionMode === EXECUTION_MODES.PREVIEW) {
    reasons.push(ENABLEMENT_REASONS.PREVIEW_MODE);
    return buildCapabilityVerdict(reasons);
  }

  if (executionMode === EXECUTION_MODES.DRY_RUN) {
    reasons.push(ENABLEMENT_REASONS.DRY_RUN_MODE);
    return buildCapabilityVerdict(reasons);
  }

  // LIVE mode
  if (!featureState.automaticPersistenceEnabled) {
    reasons.push(ENABLEMENT_REASONS.AUTOMATION_DISABLED);
    reasons.push(ENABLEMENT_REASONS.LIVE_MODE_SAFETY_BLOCK);
    reasons.push(ENABLEMENT_REASONS.SAFE_DEFAULT_DISABLED);
    return buildCapabilityVerdict(reasons);
  }

  reasons.push(ENABLEMENT_REASONS.PERSISTENCE_ALLOWED);
  return buildCapabilityVerdict(reasons);
}

function evaluateReviewEnqueueCapability(executionMode, featureState) {
  const reasons = [];

  if (!featureState.pipelineEnabled) {
    reasons.push(ENABLEMENT_REASONS.PIPELINE_DISABLED);
    return buildCapabilityVerdict(reasons);
  }

  if (executionMode === EXECUTION_MODES.PREVIEW) {
    reasons.push(ENABLEMENT_REASONS.PREVIEW_MODE);
    return buildCapabilityVerdict(reasons);
  }

  if (executionMode === EXECUTION_MODES.DRY_RUN) {
    reasons.push(ENABLEMENT_REASONS.DRY_RUN_MODE);
    return buildCapabilityVerdict(reasons);
  }

  // LIVE mode
  if (!featureState.reviewQueueEnqueueEnabled) {
    reasons.push(ENABLEMENT_REASONS.REVIEW_ENQUEUE_DISABLED);
    reasons.push(ENABLEMENT_REASONS.LIVE_MODE_SAFETY_BLOCK);
    reasons.push(ENABLEMENT_REASONS.SAFE_DEFAULT_DISABLED);
    return buildCapabilityVerdict(reasons);
  }

  reasons.push(ENABLEMENT_REASONS.REVIEW_ENQUEUE_ALLOWED);
  return buildCapabilityVerdict(reasons);
}

function buildInvalidDecision(errors, reasonCodes, featureState, executionMode) {
  const reasons = sortReasons(reasonCodes);
  const emptyVerdict = {
    allowed: false,
    blocked: true,
    reasons: [...reasons]
  };

  return {
    allowed: false,
    blocked: true,
    executionMode: executionMode == null ? null : executionMode,
    featureState: {
      pipelineEnabled: featureState.pipelineEnabled,
      automaticPersistenceEnabled: featureState.automaticPersistenceEnabled,
      reviewQueueEnqueueEnabled: featureState.reviewQueueEnqueueEnabled
    },
    persistence: emptyVerdict,
    reviewEnqueue: {
      allowed: false,
      blocked: true,
      reasons: [...reasons]
    },
    reason: reasons[0] || ENABLEMENT_REASONS.INVALID_CONFIGURATION,
    reasons,
    architectureOnly: true,
    executed: false,
    advisory: true,
    metadata: {
      phase: ENABLEMENT_PHASE,
      sideEffects: false,
      persistenceEnabled: false,
      automationEnabled: false,
      queueEnqueueEnabled: false,
      configurationValid: false,
      validationErrors: [...errors],
      requestedCapability: null,
      wouldEnablePersistence: false,
      wouldEnableReviewEnqueue: false
    }
  };
}

/**
 * Evaluate whether future persistence / review enqueue would be allowed.
 * Pure: no I/O, no mutation of inputs, no side effects, no enablement.
 *
 * Advisory semantics:
 * - `persistence.allowed` / `reviewEnqueue.allowed` describe what a future
 *   executor *would* permit under the given mode + flags.
 * - This module never turns persistence or queues on; metadata always keeps
 *   persistenceEnabled / automationEnabled / queueEnqueueEnabled false.
 *
 * @param {PersistenceEnablementConfig|null|undefined} config
 * @returns {PersistenceEnablementDecision}
 */
function evaluatePersistenceEnablement(config) {
  if (!isPlainObject(config)) {
    return buildInvalidDecision(
      ["enablement config must be an object"],
      [ENABLEMENT_REASONS.INVALID_CONFIGURATION],
      resolveFeatureState(null),
      null
    );
  }

  const featureState = resolveFeatureState(config.featureFlags);
  const mode = normalizeMode(config.executionMode);
  const capability = normalizeCapability(config.capability);
  const validation = validateEnablementConfig(config);

  if (!validation.valid) {
    return buildInvalidDecision(
      validation.errors,
      validation.reasons,
      featureState,
      mode
    );
  }

  const persistence = evaluatePersistenceCapability(mode, featureState);
  const reviewEnqueue = evaluateReviewEnqueueCapability(mode, featureState);

  let allowed;
  if (capability === ENABLEMENT_CAPABILITIES.PERSISTENCE) {
    allowed = persistence.allowed;
  } else if (capability === ENABLEMENT_CAPABILITIES.REVIEW_ENQUEUE) {
    allowed = reviewEnqueue.allowed;
  } else {
    allowed = persistence.allowed && reviewEnqueue.allowed;
  }

  const combinedReasons = sortReasons([
    ...persistence.reasons,
    ...reviewEnqueue.reasons
  ]);

  return {
    allowed,
    blocked: !allowed,
    executionMode: mode,
    featureState: {
      pipelineEnabled: featureState.pipelineEnabled,
      automaticPersistenceEnabled: featureState.automaticPersistenceEnabled,
      reviewQueueEnqueueEnabled: featureState.reviewQueueEnqueueEnabled
    },
    persistence: {
      allowed: persistence.allowed,
      blocked: persistence.blocked,
      reasons: [...persistence.reasons]
    },
    reviewEnqueue: {
      allowed: reviewEnqueue.allowed,
      blocked: reviewEnqueue.blocked,
      reasons: [...reviewEnqueue.reasons]
    },
    reason: combinedReasons[0] || ENABLEMENT_REASONS.SAFE_DEFAULT_DISABLED,
    reasons: combinedReasons,
    architectureOnly: true,
    executed: false,
    advisory: true,
    metadata: {
      phase: ENABLEMENT_PHASE,
      sideEffects: false,
      persistenceEnabled: false,
      automationEnabled: false,
      queueEnqueueEnabled: false,
      configurationValid: true,
      validationErrors: [],
      requestedCapability: capability,
      wouldEnablePersistence: persistence.allowed,
      wouldEnableReviewEnqueue: reviewEnqueue.allowed
    }
  };
}

/**
 * Guard: confirm a value looks like an architecture-only enablement decision.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isPersistenceEnablementArchitectureOnly(value) {
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
  if (!isPlainObject(value.metadata)) {
    return false;
  }
  if (value.metadata.persistenceEnabled !== false) {
    return false;
  }
  if (value.metadata.sideEffects !== false) {
    return false;
  }
  if (value.metadata.automationEnabled !== false) {
    return false;
  }
  if (value.metadata.queueEnqueueEnabled !== false) {
    return false;
  }
  if (value.metadata.phase !== ENABLEMENT_PHASE) {
    return false;
  }
  return true;
}

module.exports = {
  ENABLEMENT_PHASE,
  EXECUTION_MODES,
  SUPPORTED_EXECUTION_MODES,
  ENABLEMENT_CAPABILITIES,
  ENABLEMENT_REASONS,
  DEFAULT_FEATURE_FLAGS,
  createDefaultEnablementConfig,
  resolveFeatureState,
  validateEnablementConfig,
  evaluatePersistenceEnablement,
  isPersistenceEnablementArchitectureOnly
};
