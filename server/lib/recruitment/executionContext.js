"use strict";

/**
 * Phase 40 — Execution Context & Correlation Layer (architecture only).
 *
 * Creates and validates shared execution / correlation contexts for future
 * recruitment lifecycle processing (policy → pipeline → transaction → audit).
 *
 * Never writes to a database. Never accesses MySQL, queues, Express, or the
 * filesystem. Never mutates runtime state, workers, feature flags, audit
 * storage, or persistence. Never enables automation.
 *
 * Contexts are deterministic, side-effect-free descriptions only:
 * architectureOnly is always true; no persistence or propagation I/O occurs.
 */

const EXECUTION_MODES = Object.freeze({
  LIVE: "live",
  PREVIEW: "preview",
  DRY_RUN: "dry_run"
});

const SUPPORTED_EXECUTION_MODES = Object.freeze(
  new Set(Object.values(EXECUTION_MODES))
);

const CONTEXT_VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  UNSUPPORTED_EXECUTION_MODE: "UNSUPPORTED_EXECUTION_MODE",
  INVALID_FIELD: "INVALID_FIELD",
  INVALID_PARENT: "INVALID_PARENT"
});

const REQUIRED_CONTEXT_FIELDS = Object.freeze([
  "contextId",
  "correlationId",
  "pipelineRunId",
  "parentContextId",
  "executionMode",
  "sourceModule",
  "recruitment",
  "metadata",
  "architectureOnly"
]);

const REQUIRED_RECRUITMENT_FIELDS = Object.freeze([
  "recruitmentId",
  "lifecycleEventType",
  "lifecycleState",
  "eventRef"
]);

/**
 * @typedef {Object} RecruitmentAssociation
 * @property {string|null} recruitmentId
 * @property {string|null} lifecycleEventType
 * @property {string|null} lifecycleState
 * @property {string|null} eventRef
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {string} contextId
 * @property {string|null} correlationId
 * @property {string|null} pipelineRunId
 * @property {string|null} parentContextId
 * @property {string} executionMode
 * @property {string|null} sourceModule
 * @property {RecruitmentAssociation} recruitment
 * @property {Object} metadata
 * @property {boolean} architectureOnly
 */

/**
 * @typedef {Object} ContextValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} reasons
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

function cloneDeepPlain(value, depth) {
  if (depth <= 0) {
    return null;
  }
  if (value == null) {
    return null;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "object" && item != null
        ? cloneDeepPlain(item, depth - 1)
        : item
    );
  }
  const out = {};
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const child = value[key];
    if (typeof child === "object" && child != null) {
      out[key] = cloneDeepPlain(child, depth - 1);
    } else {
      out[key] = child;
    }
  }
  return out;
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function sortReasons(reasons) {
  return [...reasons].sort((a, b) => a.localeCompare(b));
}

function stableSerialize(value) {
  if (value == null) {
    return "null";
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

function simpleFingerprint(text) {
  let hash = 0;
  const input = String(text);
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function deriveContextId(parts) {
  return `ctx_${simpleFingerprint(stableSerialize(parts))}`;
}

function deriveCorrelationId(parts) {
  return `corr_${simpleFingerprint(stableSerialize(parts))}`;
}

function derivePipelineRunId(parts) {
  return `run_${simpleFingerprint(stableSerialize(parts))}`;
}

function normalizeExecutionMode(value, fallback) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return fallback;
  }
  return SUPPORTED_EXECUTION_MODES.has(normalized) ? normalized : fallback;
}

function freezeRecruitment(association) {
  return {
    recruitmentId:
      association.recruitmentId == null
        ? null
        : String(association.recruitmentId),
    lifecycleEventType:
      association.lifecycleEventType == null
        ? null
        : String(association.lifecycleEventType),
    lifecycleState:
      association.lifecycleState == null
        ? null
        : String(association.lifecycleState),
    eventRef: association.eventRef == null ? null : String(association.eventRef)
  };
}

function normalizeRecruitment(raw) {
  if (!isPlainObject(raw)) {
    return freezeRecruitment({
      recruitmentId: null,
      lifecycleEventType: null,
      lifecycleState: null,
      eventRef: null
    });
  }
  return freezeRecruitment({
    recruitmentId: normalizeString(raw.recruitmentId),
    lifecycleEventType: normalizeString(
      raw.lifecycleEventType != null ? raw.lifecycleEventType : raw.eventType
    ),
    lifecycleState: normalizeString(raw.lifecycleState),
    eventRef: normalizeString(
      raw.eventRef != null ? raw.eventRef : raw.eventId
    )
  });
}

function buildDefaultMetadata(extras) {
  const safeExtras = isPlainObject(extras) ? { ...extras } : {};
  delete safeExtras.sideEffects;
  delete safeExtras.advisory;
  delete safeExtras.architectureOnly;
  delete safeExtras.persisted;
  delete safeExtras.written;
  delete safeExtras.propagated;
  delete safeExtras.persistenceEnabled;
  delete safeExtras.automationEnabled;
  return {
    ...safeExtras,
    sideEffects: false,
    advisory: true,
    architectureOnly: true,
    persisted: false,
    written: false,
    propagated: false,
    persistenceEnabled: false,
    automationEnabled: false
  };
}

function mergeMetadata(parentMeta, childMeta) {
  const parent = isPlainObject(parentMeta) ? cloneDeepPlain(parentMeta, 6) || {} : {};
  const child = isPlainObject(childMeta) ? cloneDeepPlain(childMeta, 6) || {} : {};
  return buildDefaultMetadata({ ...parent, ...child });
}

function buildContextShell(partial) {
  const executionMode = normalizeExecutionMode(
    partial.executionMode,
    EXECUTION_MODES.PREVIEW
  );
  const sourceModule = normalizeString(partial.sourceModule);
  const recruitment = normalizeRecruitment(partial.recruitment);
  const parentContextId = normalizeString(partial.parentContextId);
  const metadata = buildDefaultMetadata(
    isPlainObject(partial.metadata)
      ? cloneDeepPlain(partial.metadata, 6)
      : null
  );

  const correlationId =
    normalizeString(partial.correlationId) ||
    deriveCorrelationId({
      pipelineRunId: normalizeString(partial.pipelineRunId),
      sourceModule,
      recruitment,
      executionMode
    });

  const pipelineRunId =
    normalizeString(partial.pipelineRunId) ||
    derivePipelineRunId({
      correlationId,
      sourceModule,
      recruitment,
      executionMode
    });

  const contextId =
    normalizeString(partial.contextId) ||
    deriveContextId({
      correlationId,
      pipelineRunId,
      parentContextId,
      executionMode,
      sourceModule,
      recruitment,
      metadataKeys: Object.keys(metadata).sort((a, b) => a.localeCompare(b))
    });

  return {
    contextId,
    correlationId,
    pipelineRunId,
    parentContextId,
    executionMode,
    sourceModule,
    recruitment,
    metadata,
    architectureOnly: true
  };
}

/**
 * Create an architecture-only execution context from structured input.
 * Pure: no I/O, no mutation of inputs, no persistence or propagation.
 *
 * @param {Object|null|undefined} input
 * @returns {ExecutionContext}
 */
function createExecutionContext(input) {
  if (!isPlainObject(input)) {
    return buildContextShell({
      executionMode: EXECUTION_MODES.PREVIEW,
      sourceModule: null,
      recruitment: null,
      parentContextId: null,
      metadata: {
        createReason: CONTEXT_VALIDATION_REASONS.INVALID_INPUT,
        invalidInput: true
      }
    });
  }

  const requestedMode = normalizeString(input.executionMode);
  const modeSupported =
    requestedMode == null || SUPPORTED_EXECUTION_MODES.has(requestedMode);

  const recruitment = isPlainObject(input.recruitment)
    ? input.recruitment
    : {
        recruitmentId: input.recruitmentId,
        lifecycleEventType:
          input.lifecycleEventType != null
            ? input.lifecycleEventType
            : input.eventType,
        lifecycleState: input.lifecycleState,
        eventRef: input.eventRef != null ? input.eventRef : input.eventId
      };

  return buildContextShell({
    contextId: input.contextId,
    correlationId: input.correlationId,
    pipelineRunId: input.pipelineRunId,
    parentContextId: input.parentContextId,
    executionMode: modeSupported
      ? input.executionMode
      : EXECUTION_MODES.PREVIEW,
    sourceModule: input.sourceModule,
    recruitment,
    metadata: {
      ...(isPlainObject(input.metadata) ? input.metadata : {}),
      createReason: modeSupported
        ? CONTEXT_VALIDATION_REASONS.VALID
        : CONTEXT_VALIDATION_REASONS.UNSUPPORTED_EXECUTION_MODE,
      requestedExecutionMode: requestedMode
    }
  });
}

/**
 * Create a child execution context that preserves correlation and pipeline
 * run identity from a parent context while establishing a parent link.
 *
 * Child overrides may adjust sourceModule, recruitment fields, and metadata;
 * correlationId and pipelineRunId are preserved unless explicitly overridden
 * (explicit override is allowed only for advanced callers and is recorded).
 *
 * @param {Object|null|undefined} parent
 * @param {Object|null|undefined} [overrides]
 * @returns {ExecutionContext}
 */
function createChildContext(parent, overrides) {
  const opts = isPlainObject(overrides) ? overrides : {};

  if (!isPlainObject(parent)) {
    const requestedMode = normalizeString(opts.executionMode);
    const modeSupported =
      requestedMode == null || SUPPORTED_EXECUTION_MODES.has(requestedMode);
    return buildContextShell({
      correlationId: opts.correlationId,
      pipelineRunId: opts.pipelineRunId,
      parentContextId: null,
      executionMode: modeSupported
        ? opts.executionMode
        : EXECUTION_MODES.PREVIEW,
      sourceModule: opts.sourceModule,
      recruitment: opts.recruitment,
      metadata: {
        ...(isPlainObject(opts.metadata) ? opts.metadata : {}),
        createReason: CONTEXT_VALIDATION_REASONS.INVALID_PARENT,
        invalidParent: true,
        childContext: true,
        requestedExecutionMode: requestedMode
      }
    });
  }

  const parentRecruitment = normalizeRecruitment(parent.recruitment);
  const overrideRecruitment = isPlainObject(opts.recruitment)
    ? opts.recruitment
    : {};

  const mergedRecruitment = {
    recruitmentId:
      overrideRecruitment.recruitmentId !== undefined
        ? overrideRecruitment.recruitmentId
        : parentRecruitment.recruitmentId,
    lifecycleEventType:
      overrideRecruitment.lifecycleEventType !== undefined
        ? overrideRecruitment.lifecycleEventType
        : overrideRecruitment.eventType !== undefined
          ? overrideRecruitment.eventType
          : parentRecruitment.lifecycleEventType,
    lifecycleState:
      overrideRecruitment.lifecycleState !== undefined
        ? overrideRecruitment.lifecycleState
        : parentRecruitment.lifecycleState,
    eventRef:
      overrideRecruitment.eventRef !== undefined
        ? overrideRecruitment.eventRef
        : overrideRecruitment.eventId !== undefined
          ? overrideRecruitment.eventId
          : parentRecruitment.eventRef
  };

  const correlationPreserved =
    opts.correlationId === undefined ||
    normalizeString(opts.correlationId) === normalizeString(parent.correlationId);
  const pipelineRunPreserved =
    opts.pipelineRunId === undefined ||
    normalizeString(opts.pipelineRunId) === normalizeString(parent.pipelineRunId);

  return buildContextShell({
    contextId: opts.contextId,
    correlationId:
      opts.correlationId !== undefined
        ? opts.correlationId
        : parent.correlationId,
    pipelineRunId:
      opts.pipelineRunId !== undefined
        ? opts.pipelineRunId
        : parent.pipelineRunId,
    parentContextId: parent.contextId,
    executionMode:
      opts.executionMode !== undefined
        ? opts.executionMode
        : parent.executionMode,
    sourceModule:
      opts.sourceModule !== undefined
        ? opts.sourceModule
        : parent.sourceModule,
    recruitment: mergedRecruitment,
    metadata: {
      ...mergeMetadata(parent.metadata, opts.metadata),
      createReason: CONTEXT_VALIDATION_REASONS.VALID,
      childContext: true,
      parentContextId: parent.contextId == null ? null : String(parent.contextId),
      correlationPreserved,
      pipelineRunPreserved
    }
  });
}

/**
 * Validate an execution context without writing or mutating it.
 *
 * @param {Object|null|undefined} context
 * @returns {ContextValidationResult}
 */
function validateExecutionContext(context) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(context)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["context must be a plain object"]),
      reasons: Object.freeze([CONTEXT_VALIDATION_REASONS.INVALID_INPUT])
    });
  }

  for (const field of REQUIRED_CONTEXT_FIELDS) {
    if (context[field] === undefined) {
      errors.push(`missing required field: ${field}`);
      reasons.push(CONTEXT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (context.contextId != null && typeof context.contextId !== "string") {
    errors.push("contextId must be a string");
    reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
  } else if (
    typeof context.contextId === "string" &&
    context.contextId.trim() === ""
  ) {
    errors.push("contextId must be non-empty");
    reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
  }

  for (const nullableString of [
    "correlationId",
    "pipelineRunId",
    "parentContextId",
    "sourceModule"
  ]) {
    if (
      context[nullableString] != null &&
      typeof context[nullableString] !== "string"
    ) {
      errors.push(`${nullableString} must be a string or null`);
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
  }

  if (
    context.executionMode != null &&
    !SUPPORTED_EXECUTION_MODES.has(String(context.executionMode))
  ) {
    errors.push(`unsupported executionMode: ${context.executionMode}`);
    reasons.push(CONTEXT_VALIDATION_REASONS.UNSUPPORTED_EXECUTION_MODE);
  }

  if (context.recruitment !== undefined && !isPlainObject(context.recruitment)) {
    errors.push("recruitment must be a plain object");
    reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
  } else if (isPlainObject(context.recruitment)) {
    for (const key of REQUIRED_RECRUITMENT_FIELDS) {
      if (!(key in context.recruitment)) {
        errors.push(`recruitment missing field: ${key}`);
        reasons.push(CONTEXT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      } else if (
        context.recruitment[key] != null &&
        typeof context.recruitment[key] !== "string"
      ) {
        errors.push(`recruitment.${key} must be a string or null`);
        reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
      }
    }
  }

  if (context.architectureOnly !== true) {
    errors.push("architectureOnly must be true");
    reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (context.metadata !== undefined && !isPlainObject(context.metadata)) {
    errors.push("metadata must be a plain object");
    reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
  } else if (isPlainObject(context.metadata)) {
    if (context.metadata.sideEffects === true) {
      errors.push("metadata.sideEffects must not be true");
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (context.metadata.persisted === true) {
      errors.push("metadata.persisted must not be true");
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (context.metadata.written === true) {
      errors.push("metadata.written must not be true");
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (context.metadata.propagated === true) {
      errors.push("metadata.propagated must not be true");
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (context.metadata.persistenceEnabled === true) {
      errors.push("metadata.persistenceEnabled must not be true");
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (context.metadata.automationEnabled === true) {
      errors.push("metadata.automationEnabled must not be true");
      reasons.push(CONTEXT_VALIDATION_REASONS.INVALID_FIELD);
    }
  }

  const uniqueReasons = sortReasons([...new Set(reasons)]);
  const valid = errors.length === 0;
  if (valid) {
    uniqueReasons.length = 0;
    uniqueReasons.push(CONTEXT_VALIDATION_REASONS.VALID);
  }

  return Object.freeze({
    valid,
    errors: Object.freeze([...errors]),
    reasons: Object.freeze(uniqueReasons)
  });
}

/**
 * Convenience: whether a value is a valid architecture-only execution context.
 *
 * @param {Object|null|undefined} context
 * @returns {boolean}
 */
function isValidExecutionContext(context) {
  return validateExecutionContext(context).valid === true;
}

/**
 * Convenience: assert a context never claims side effects, persistence,
 * write, propagation, or automation enablement.
 *
 * @param {ExecutionContext} context
 * @returns {boolean}
 */
function isExecutionContextArchitectureOnly(context) {
  return (
    isPlainObject(context) &&
    context.architectureOnly === true &&
    context.metadata != null &&
    context.metadata.sideEffects === false &&
    context.metadata.persisted === false &&
    context.metadata.written === false &&
    context.metadata.propagated === false &&
    context.metadata.persistenceEnabled === false &&
    context.metadata.automationEnabled === false
  );
}

/**
 * @param {string|null|undefined} mode
 * @returns {boolean}
 */
function isSupportedExecutionMode(mode) {
  return mode != null && SUPPORTED_EXECUTION_MODES.has(String(mode).trim());
}

/**
 * Project an execution context into the AuditCorrelation-compatible shape
 * used by Phase 39 (advisory only; no audit write).
 *
 * @param {Object|null|undefined} context
 * @param {Object|null|undefined} [extras]
 * @returns {{ correlationId: string|null, parentEventId: string|null, pipelineStage: string|null, sourceModule: string|null }}
 */
function toAuditCorrelation(context, extras) {
  const extra = isPlainObject(extras) ? extras : {};
  if (!isPlainObject(context)) {
    return {
      correlationId: null,
      parentEventId: normalizeString(extra.parentEventId),
      pipelineStage: normalizeString(extra.pipelineStage),
      sourceModule: normalizeString(extra.sourceModule)
    };
  }
  return {
    correlationId: normalizeString(context.correlationId),
    parentEventId: normalizeString(
      extra.parentEventId != null ? extra.parentEventId : context.parentContextId
    ),
    pipelineStage: normalizeString(extra.pipelineStage),
    sourceModule: normalizeString(
      extra.sourceModule != null ? extra.sourceModule : context.sourceModule
    )
  };
}

module.exports = {
  EXECUTION_MODES,
  CONTEXT_VALIDATION_REASONS,
  REQUIRED_CONTEXT_FIELDS,
  REQUIRED_RECRUITMENT_FIELDS,
  createExecutionContext,
  createChildContext,
  validateExecutionContext,
  isValidExecutionContext,
  isExecutionContextArchitectureOnly,
  isSupportedExecutionMode,
  toAuditCorrelation
};
