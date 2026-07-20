"use strict";

/**
 * Phase 46 — Execution Diagnostics & Observability Framework (architecture only).
 *
 * Records execution stages into a deterministic execution trace for advisory
 * observability of the Recruitment Lifecycle pipe (context → policy →
 * enablement → execution_plan → transaction_plan → audit → review →
 * adapter → completed).
 *
 * Never writes to database. Never writes files. Never uses console logging.
 * Never modifies workers. Never enables persistence. Never changes runtime
 * behavior. Never calls repositories. Never starts transactions.
 * Never enqueues queues.
 *
 * Traces are deterministic, side-effect-free, and advisory only:
 * architectureOnly is always true; executed is always false;
 * persistenceEnabled / sideEffects remain false in metadata.
 *
 * Phase 62 — may receive normalized Preview Integration Contract output via
 * the Phase 62 integration hook only. Capability observations are stored in
 * an internal WeakMap and never projected into traces, summaries, metadata,
 * or runtime outputs.
 */

const EXECUTION_DIAGNOSTICS_PHASE = 46;
const CAPABILITY_OBSERVATION_PHASE = 62;

const DIAGNOSTIC_STAGE_TYPES = Object.freeze({
  CONTEXT: "context",
  POLICY: "policy",
  ENABLEMENT: "enablement",
  EXECUTION_PLAN: "execution_plan",
  TRANSACTION_PLAN: "transaction_plan",
  AUDIT: "audit",
  REVIEW: "review",
  ADAPTER: "adapter",
  COMPLETED: "completed"
});

const SUPPORTED_DIAGNOSTIC_STAGE_TYPES = Object.freeze(
  new Set(Object.values(DIAGNOSTIC_STAGE_TYPES))
);

const DIAGNOSTIC_STAGE_STATUSES = Object.freeze({
  RECORDED: "recorded",
  SKIPPED: "skipped",
  BLOCKED: "blocked",
  COMPLETED: "completed"
});

const SUPPORTED_DIAGNOSTIC_STAGE_STATUSES = Object.freeze(
  new Set(Object.values(DIAGNOSTIC_STAGE_STATUSES))
);

const TRACE_STATUSES = Object.freeze({
  OPEN: "open",
  FINALIZED: "finalized",
  INVALID: "invalid"
});

const SUPPORTED_TRACE_STATUSES = Object.freeze(
  new Set(Object.values(TRACE_STATUSES))
);

const DIAGNOSTIC_VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD: "INVALID_FIELD",
  INVALID_STAGE_TYPE: "INVALID_STAGE_TYPE",
  INVALID_STAGE_STATUS: "INVALID_STAGE_STATUS",
  INVALID_TRACE_STATUS: "INVALID_TRACE_STATUS",
  TRACE_FINALIZED: "TRACE_FINALIZED",
  TRACE_INVALID: "TRACE_INVALID",
  TRACE_NOT_ARCHITECTURE_ONLY: "TRACE_NOT_ARCHITECTURE_ONLY"
});

const REQUIRED_TRACE_FIELDS = Object.freeze([
  "traceId",
  "correlationId",
  "pipelineRunId",
  "contextId",
  "status",
  "stages",
  "summary",
  "architectureOnly",
  "executed",
  "advisory",
  "metadata"
]);

const REQUIRED_STAGE_FIELDS = Object.freeze([
  "stageId",
  "stageType",
  "status",
  "order",
  "message",
  "detail",
  "reasons",
  "architectureOnly",
  "executed",
  "advisory"
]);

/**
 * @typedef {Object} DiagnosticStageInput
 * @property {string} [stageType]
 * @property {string} [status]
 * @property {string|null} [message]
 * @property {Object|null} [detail]
 * @property {string[]} [reasons]
 * @property {string} [stageId]
 */

/**
 * @typedef {Object} DiagnosticStage
 * @property {string} stageId
 * @property {string} stageType
 * @property {string} status
 * @property {number} order
 * @property {string|null} message
 * @property {Object|null} detail
 * @property {string[]} reasons
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 * @property {boolean} advisory
 */

/**
 * @typedef {Object} ExecutionTraceSummary
 * @property {number} stageCount
 * @property {string[]} stageTypes
 * @property {Object} statusCounts
 * @property {boolean} hasCompletedStage
 * @property {number} blockedStageCount
 * @property {number} skippedStageCount
 * @property {number} recordedStageCount
 * @property {boolean} open
 * @property {boolean} finalized
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 * @property {boolean} sideEffects
 * @property {boolean} persistenceEnabled
 * @property {string} reason
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} ExecutionTrace
 * @property {string|null} traceId
 * @property {string|null} correlationId
 * @property {string|null} pipelineRunId
 * @property {string|null} contextId
 * @property {string} status
 * @property {DiagnosticStage[]} stages
 * @property {ExecutionTraceSummary|null} summary
 * @property {boolean} architectureOnly
 * @property {boolean} executed
 * @property {boolean} advisory
 * @property {Object} metadata
 */

/**
 * @typedef {Object} DiagnosticValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} DiagnosticMutationResult
 * @property {boolean} success
 * @property {string[]} errors
 * @property {string[]} reasons
 * @property {ExecutionTrace} trace
 * @property {DiagnosticStage|null} stage
 */

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Internal capability observation store keyed by runtime result objects.
 * Not enumerable, not JSON-serializable, not a public field.
 * @type {WeakMap<Object, Readonly<Object>|null>}
 */
const observedCapabilityByRuntime = new WeakMap();

/**
 * Verify normalized Preview Integration Contract output shape without
 * importing the contract module (no module imports in this file).
 *
 * @param {*} value
 * @returns {boolean}
 */
function isExecutionDiagnosticsContractCapabilityInfo(value) {
  return (
    isPlainObject(value) &&
    value.phase === 55 &&
    value.readOnly === true &&
    value.informational === true &&
    Object.prototype.hasOwnProperty.call(value, "capabilityId")
  );
}

/**
 * Phase 62 — observe contract-fulfilled capability information supplied by
 * the integration hook. Never accesses registry, resolver, observation,
 * validation, awareness, context, or context read directly. Never modifies
 * execution traces or diagnostic outputs. Never branches on capability values.
 *
 * @param {Object|null|undefined} runtimeObject
 * @param {Readonly<Object>|null|undefined} capabilityInfo contract output
 * @returns {Readonly<Object>|null}
 */
function observeExecutionDiagnosticsCapability(runtimeObject, capabilityInfo) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }

  try {
    const normalized = isExecutionDiagnosticsContractCapabilityInfo(capabilityInfo)
      ? capabilityInfo
      : null;
    observedCapabilityByRuntime.set(runtimeObject, normalized);
    void normalized;
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Read the internal capability observation for a runtime result, if any.
 * For architecture / tests only — not part of public trace projections.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function peekExecutionDiagnosticsCapabilityObservation(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }
  const observation = observedCapabilityByRuntime.get(runtimeObject);
  return observation === undefined ? null : observation;
}

function sortReasons(reasons) {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function clonePlain(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return { ...value };
}

function cloneStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function normalizeOptionalId(value) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function normalizeStageType(value) {
  if (value == null || value === "") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function normalizeStageStatus(value) {
  if (value == null || value === "") {
    return DIAGNOSTIC_STAGE_STATUSES.RECORDED;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" ? DIAGNOSTIC_STAGE_STATUSES.RECORDED : normalized;
}

function emptyStatusCounts() {
  return {
    [DIAGNOSTIC_STAGE_STATUSES.RECORDED]: 0,
    [DIAGNOSTIC_STAGE_STATUSES.SKIPPED]: 0,
    [DIAGNOSTIC_STAGE_STATUSES.BLOCKED]: 0,
    [DIAGNOSTIC_STAGE_STATUSES.COMPLETED]: 0
  };
}

function buildTraceMetadata(extra) {
  return {
    phase: EXECUTION_DIAGNOSTICS_PHASE,
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
    consoleLogging: false,
    fileWrites: false,
    databaseWrites: false,
    ...(isPlainObject(extra) ? clonePlain(extra) : {}),
    phase: EXECUTION_DIAGNOSTICS_PHASE,
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
    consoleLogging: false,
    fileWrites: false,
    databaseWrites: false
  };
}

function buildStageId(stageType, order, providedId) {
  const provided = normalizeOptionalId(providedId);
  if (provided != null) {
    return provided;
  }
  const padded = String(order).padStart(3, "0");
  return `stage_${padded}_${stageType}`;
}

/**
 * @param {DiagnosticStageInput} input
 * @param {number} order
 * @returns {DiagnosticStage}
 */
function buildStage(input, order) {
  const stageType = normalizeStageType(input.stageType);
  const status = normalizeStageStatus(input.status);
  const reasons = sortReasons(cloneStringArray(input.reasons));
  const message =
    input.message == null || input.message === ""
      ? null
      : String(input.message);

  return {
    stageId: buildStageId(stageType, order, input.stageId),
    stageType,
    status,
    order,
    message,
    detail: clonePlain(input.detail),
    reasons,
    architectureOnly: true,
    executed: false,
    advisory: true
  };
}

/**
 * @param {DiagnosticStage} stage
 * @returns {DiagnosticStage}
 */
function cloneStage(stage) {
  return {
    stageId: String(stage.stageId),
    stageType: String(stage.stageType),
    status: String(stage.status),
    order: Number(stage.order),
    message: stage.message == null ? null : String(stage.message),
    detail: clonePlain(stage.detail),
    reasons: cloneStringArray(stage.reasons),
    architectureOnly: true,
    executed: false,
    advisory: true
  };
}

/**
 * @param {ExecutionTraceSummary|null} summary
 * @returns {ExecutionTraceSummary|null}
 */
function cloneSummary(summary) {
  if (!isPlainObject(summary)) {
    return null;
  }
  return {
    stageCount: Number(summary.stageCount) || 0,
    stageTypes: cloneStringArray(summary.stageTypes),
    statusCounts: {
      ...emptyStatusCounts(),
      ...(isPlainObject(summary.statusCounts)
        ? clonePlain(summary.statusCounts)
        : {})
    },
    hasCompletedStage: summary.hasCompletedStage === true,
    blockedStageCount: Number(summary.blockedStageCount) || 0,
    skippedStageCount: Number(summary.skippedStageCount) || 0,
    recordedStageCount: Number(summary.recordedStageCount) || 0,
    open: summary.open === true,
    finalized: summary.finalized === true,
    architectureOnly: true,
    executed: false,
    sideEffects: false,
    persistenceEnabled: false,
    reason: String(summary.reason || DIAGNOSTIC_VALIDATION_REASONS.VALID),
    reasons: sortReasons(cloneStringArray(summary.reasons))
  };
}

/**
 * @param {ExecutionTrace} trace
 * @returns {ExecutionTrace}
 */
function cloneTrace(trace) {
  return {
    traceId: trace.traceId == null ? null : String(trace.traceId),
    correlationId:
      trace.correlationId == null ? null : String(trace.correlationId),
    pipelineRunId:
      trace.pipelineRunId == null ? null : String(trace.pipelineRunId),
    contextId: trace.contextId == null ? null : String(trace.contextId),
    status: String(trace.status),
    stages: Array.isArray(trace.stages)
      ? trace.stages.map((stage) => cloneStage(stage))
      : [],
    summary: cloneSummary(trace.summary),
    architectureOnly: true,
    executed: false,
    advisory: true,
    metadata: buildTraceMetadata(trace.metadata)
  };
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isSupportedDiagnosticStageType(value) {
  const normalized = normalizeStageType(value);
  return normalized != null && SUPPORTED_DIAGNOSTIC_STAGE_TYPES.has(normalized);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isSupportedDiagnosticStageStatus(value) {
  const normalized =
    value == null || value === ""
      ? DIAGNOSTIC_STAGE_STATUSES.RECORDED
      : String(value).trim().toLowerCase();
  return SUPPORTED_DIAGNOSTIC_STAGE_STATUSES.has(normalized);
}

/**
 * Validate a stage input before append (does not require order/stageId).
 *
 * @param {*} input
 * @returns {DiagnosticValidationResult}
 */
function validateStageInput(input) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: ["stage input must be a plain object"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT])
    };
  }

  const stageType = normalizeStageType(input.stageType);
  if (stageType == null) {
    errors.push("stageType is required");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
  } else if (!SUPPORTED_DIAGNOSTIC_STAGE_TYPES.has(stageType)) {
    errors.push(`unsupported stageType: ${stageType}`);
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_TYPE);
  }

  const status = normalizeStageStatus(input.status);
  if (!SUPPORTED_DIAGNOSTIC_STAGE_STATUSES.has(status)) {
    errors.push(`unsupported stage status: ${status}`);
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_STATUS);
  }

  if (input.message != null && typeof input.message !== "string") {
    errors.push("message must be a string or null");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (input.detail != null && !isPlainObject(input.detail)) {
    errors.push("detail must be a plain object or null");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (input.reasons != null && !Array.isArray(input.reasons)) {
    errors.push("reasons must be an array when provided");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (input.stageId != null && typeof input.stageId !== "string") {
    errors.push("stageId must be a string when provided");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  const sorted = sortReasons(reasons);
  if (sorted.length === 0) {
    sorted.push(DIAGNOSTIC_VALIDATION_REASONS.VALID);
  }

  return {
    valid: errors.length === 0,
    errors,
    reasons: sorted
  };
}

/**
 * Validate a fully built diagnostic stage record.
 *
 * @param {*} stage
 * @returns {DiagnosticValidationResult}
 */
function validateExecutionStage(stage) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(stage)) {
    return {
      valid: false,
      errors: ["stage must be a plain object"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT])
    };
  }

  for (const field of REQUIRED_STAGE_FIELDS) {
    if (!(field in stage)) {
      errors.push(`missing required stage field: ${field}`);
      reasons.push(DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (stage.stageId == null || String(stage.stageId).trim() === "") {
    errors.push("stageId is required");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
  }

  if (!isSupportedDiagnosticStageType(stage.stageType)) {
    errors.push(`unsupported stageType: ${String(stage.stageType)}`);
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_TYPE);
  }

  if (
    stage.status == null ||
    !SUPPORTED_DIAGNOSTIC_STAGE_STATUSES.has(String(stage.status))
  ) {
    errors.push(`unsupported stage status: ${String(stage.status)}`);
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_STAGE_STATUS);
  }

  if (typeof stage.order !== "number" || !Number.isFinite(stage.order)) {
    errors.push("order must be a finite number");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (stage.message != null && typeof stage.message !== "string") {
    errors.push("message must be a string or null");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (stage.detail != null && !isPlainObject(stage.detail)) {
    errors.push("detail must be a plain object or null");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (!Array.isArray(stage.reasons)) {
    errors.push("reasons must be an array");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (stage.architectureOnly !== true) {
    errors.push("architectureOnly must be true");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (stage.executed !== false) {
    errors.push("executed must be false");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (stage.advisory !== true) {
    errors.push("advisory must be true");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  const sorted = sortReasons(reasons);
  if (sorted.length === 0) {
    sorted.push(DIAGNOSTIC_VALIDATION_REASONS.VALID);
  }

  return {
    valid: errors.length === 0,
    errors,
    reasons: sorted
  };
}

/**
 * Validate an execution trace record.
 *
 * @param {*} trace
 * @returns {DiagnosticValidationResult}
 */
function validateExecutionTrace(trace) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(trace)) {
    return {
      valid: false,
      errors: ["trace must be a plain object"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT])
    };
  }

  for (const field of REQUIRED_TRACE_FIELDS) {
    if (!(field in trace)) {
      errors.push(`missing required trace field: ${field}`);
      reasons.push(DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (trace.traceId == null || String(trace.traceId).trim() === "") {
    errors.push("traceId is required");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
  }

  if (
    trace.status == null ||
    !SUPPORTED_TRACE_STATUSES.has(String(trace.status))
  ) {
    errors.push(`unsupported trace status: ${String(trace.status)}`);
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_TRACE_STATUS);
  }

  if (!Array.isArray(trace.stages)) {
    errors.push("stages must be an array");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  } else {
    for (let i = 0; i < trace.stages.length; i += 1) {
      const stageResult = validateExecutionStage(trace.stages[i]);
      if (!stageResult.valid) {
        errors.push(
          `stages[${i}] invalid: ${stageResult.errors.join("; ") || "unknown"}`
        );
        reasons.push(...stageResult.reasons.filter((r) => r !== "VALID"));
      }
    }
  }

  if (trace.summary != null && !isPlainObject(trace.summary)) {
    errors.push("summary must be a plain object or null");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (trace.architectureOnly !== true) {
    errors.push("architectureOnly must be true");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (trace.executed !== false) {
    errors.push("executed must be false");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (trace.advisory !== true) {
    errors.push("advisory must be true");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (!isPlainObject(trace.metadata)) {
    errors.push("metadata must be a plain object");
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
  } else {
    if (trace.metadata.phase !== EXECUTION_DIAGNOSTICS_PHASE) {
      errors.push("metadata.phase must be 46");
      reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (trace.metadata.sideEffects !== false) {
      errors.push("metadata.sideEffects must be false");
      reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (trace.metadata.persistenceEnabled !== false) {
      errors.push("metadata.persistenceEnabled must be false");
      reasons.push(DIAGNOSTIC_VALIDATION_REASONS.INVALID_FIELD);
    }
  }

  const sorted = sortReasons(reasons);
  if (sorted.length === 0) {
    sorted.push(DIAGNOSTIC_VALIDATION_REASONS.VALID);
  }

  return {
    valid: errors.length === 0,
    errors,
    reasons: sorted
  };
}

/**
 * Create an open architecture-only execution trace.
 *
 * @param {Object} [input]
 * @returns {ExecutionTrace}
 */
function createExecutionTrace(input) {
  const source = isPlainObject(input) ? input : {};
  const traceId = normalizeOptionalId(source.traceId);

  return {
    traceId,
    correlationId: normalizeOptionalId(source.correlationId),
    pipelineRunId: normalizeOptionalId(source.pipelineRunId),
    contextId: normalizeOptionalId(source.contextId),
    status: TRACE_STATUSES.OPEN,
    stages: [],
    summary: null,
    architectureOnly: true,
    executed: false,
    advisory: true,
    metadata: buildTraceMetadata(source.metadata)
  };
}

/**
 * Build a deterministic summary for the current trace stages.
 *
 * @param {ExecutionTrace|*} trace
 * @returns {ExecutionTraceSummary}
 */
function summarizeExecutionTrace(trace) {
  const stages = isPlainObject(trace) && Array.isArray(trace.stages)
    ? trace.stages
    : [];
  const statusCounts = emptyStatusCounts();
  const stageTypes = [];
  let blockedStageCount = 0;
  let skippedStageCount = 0;
  let recordedStageCount = 0;
  let hasCompletedStage = false;
  const reasons = [];

  for (const stage of stages) {
    if (!isPlainObject(stage)) {
      continue;
    }
    const type =
      stage.stageType == null ? null : String(stage.stageType);
    if (type != null) {
      stageTypes.push(type);
      if (type === DIAGNOSTIC_STAGE_TYPES.COMPLETED) {
        hasCompletedStage = true;
      }
    }
    const status =
      stage.status == null ? null : String(stage.status);
    if (status != null && Object.prototype.hasOwnProperty.call(statusCounts, status)) {
      statusCounts[status] += 1;
    }
    if (status === DIAGNOSTIC_STAGE_STATUSES.BLOCKED) {
      blockedStageCount += 1;
    }
    if (status === DIAGNOSTIC_STAGE_STATUSES.SKIPPED) {
      skippedStageCount += 1;
    }
    if (status === DIAGNOSTIC_STAGE_STATUSES.RECORDED) {
      recordedStageCount += 1;
    }
  }

  const status =
    isPlainObject(trace) && trace.status != null
      ? String(trace.status)
      : TRACE_STATUSES.INVALID;
  const open = status === TRACE_STATUSES.OPEN;
  const finalized = status === TRACE_STATUSES.FINALIZED;

  if (status === TRACE_STATUSES.INVALID) {
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.TRACE_INVALID);
  } else if (stages.length === 0) {
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.VALID);
  } else {
    reasons.push(DIAGNOSTIC_VALIDATION_REASONS.VALID);
  }

  if (blockedStageCount > 0) {
    reasons.push(DIAGNOSTIC_STAGE_STATUSES.BLOCKED.toUpperCase());
  }
  if (skippedStageCount > 0) {
    reasons.push(DIAGNOSTIC_STAGE_STATUSES.SKIPPED.toUpperCase());
  }

  const sorted = sortReasons(reasons);

  return {
    stageCount: stages.length,
    stageTypes,
    statusCounts: { ...statusCounts },
    hasCompletedStage,
    blockedStageCount,
    skippedStageCount,
    recordedStageCount,
    open,
    finalized,
    architectureOnly: true,
    executed: false,
    sideEffects: false,
    persistenceEnabled: false,
    reason: sorted[0],
    reasons: sorted
  };
}

/**
 * Append a diagnostic stage; returns a new trace (never mutates input).
 *
 * @param {ExecutionTrace|*} trace
 * @param {DiagnosticStageInput|*} stageInput
 * @returns {DiagnosticMutationResult}
 */
function appendExecutionStage(trace, stageInput) {
  if (!isPlainObject(trace)) {
    const empty = createExecutionTrace({});
    empty.status = TRACE_STATUSES.INVALID;
    return {
      success: false,
      errors: ["trace must be a plain object"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT]),
      trace: empty,
      stage: null
    };
  }

  if (trace.architectureOnly !== true || trace.executed !== false) {
    return {
      success: false,
      errors: ["trace is not architecture-only"],
      reasons: sortReasons([
        DIAGNOSTIC_VALIDATION_REASONS.TRACE_NOT_ARCHITECTURE_ONLY
      ]),
      trace: cloneTrace(trace),
      stage: null
    };
  }

  const base = cloneTrace(trace);

  if (base.status === TRACE_STATUSES.FINALIZED) {
    return {
      success: false,
      errors: ["cannot append to a finalized trace"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.TRACE_FINALIZED]),
      trace: base,
      stage: null
    };
  }

  if (base.status === TRACE_STATUSES.INVALID) {
    return {
      success: false,
      errors: ["cannot append to an invalid trace"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.TRACE_INVALID]),
      trace: base,
      stage: null
    };
  }

  const inputValidation = validateStageInput(stageInput);
  if (!inputValidation.valid) {
    return {
      success: false,
      errors: inputValidation.errors,
      reasons: inputValidation.reasons,
      trace: base,
      stage: null
    };
  }

  const order = base.stages.length;
  const stage = buildStage(stageInput, order);
  base.stages.push(stage);
  base.summary = null;

  return {
    success: true,
    errors: [],
    reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.VALID]),
    trace: base,
    stage: cloneStage(stage)
  };
}

/**
 * Finalize a trace: optionally ensure a completed stage, attach summary,
 * set status to finalized. Never mutates the input trace.
 *
 * @param {ExecutionTrace|*} trace
 * @param {Object} [options]
 * @param {boolean} [options.appendCompleted=true]
 * @param {string|null} [options.message]
 * @returns {DiagnosticMutationResult}
 */
function finalizeExecutionTrace(trace, options) {
  const opts = isPlainObject(options) ? options : {};
  const appendCompleted = opts.appendCompleted !== false;

  if (!isPlainObject(trace)) {
    const empty = createExecutionTrace({});
    empty.status = TRACE_STATUSES.INVALID;
    return {
      success: false,
      errors: ["trace must be a plain object"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.INVALID_INPUT]),
      trace: empty,
      stage: null
    };
  }

  if (trace.architectureOnly !== true || trace.executed !== false) {
    return {
      success: false,
      errors: ["trace is not architecture-only"],
      reasons: sortReasons([
        DIAGNOSTIC_VALIDATION_REASONS.TRACE_NOT_ARCHITECTURE_ONLY
      ]),
      trace: cloneTrace(trace),
      stage: null
    };
  }

  const base = cloneTrace(trace);

  if (base.status === TRACE_STATUSES.INVALID) {
    return {
      success: false,
      errors: ["cannot finalize an invalid trace"],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.TRACE_INVALID]),
      trace: base,
      stage: null
    };
  }

  if (base.traceId == null || String(base.traceId).trim() === "") {
    return {
      success: false,
      errors: ["traceId is required to finalize"],
      reasons: sortReasons([
        DIAGNOSTIC_VALIDATION_REASONS.MISSING_REQUIRED_FIELD
      ]),
      trace: base,
      stage: null
    };
  }

  // Idempotent finalize: re-summarize and return finalized clone.
  if (base.status === TRACE_STATUSES.FINALIZED) {
    base.summary = summarizeExecutionTrace(base);
    base.summary.finalized = true;
    base.summary.open = false;
    return {
      success: true,
      errors: [],
      reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.VALID]),
      trace: base,
      stage: null
    };
  }

  let completedStage = null;
  const hasCompleted = base.stages.some(
    (stage) => stage.stageType === DIAGNOSTIC_STAGE_TYPES.COMPLETED
  );

  if (appendCompleted && !hasCompleted) {
    completedStage = buildStage(
      {
        stageType: DIAGNOSTIC_STAGE_TYPES.COMPLETED,
        status: DIAGNOSTIC_STAGE_STATUSES.COMPLETED,
        message:
          opts.message == null || opts.message === ""
            ? "execution diagnostics completed"
            : String(opts.message),
        reasons: [DIAGNOSTIC_VALIDATION_REASONS.VALID]
      },
      base.stages.length
    );
    base.stages.push(completedStage);
  }

  base.status = TRACE_STATUSES.FINALIZED;
  base.summary = summarizeExecutionTrace(base);
  base.summary.finalized = true;
  base.summary.open = false;

  return {
    success: true,
    errors: [],
    reasons: sortReasons([DIAGNOSTIC_VALIDATION_REASONS.VALID]),
    trace: base,
    stage: completedStage == null ? null : cloneStage(completedStage)
  };
}

/**
 * Guard: confirm a value looks like an architecture-only execution trace.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isExecutionTraceArchitectureOnly(value) {
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
  if (!Array.isArray(value.stages)) {
    return false;
  }
  if (!isPlainObject(value.metadata)) {
    return false;
  }
  if (value.metadata.phase !== EXECUTION_DIAGNOSTICS_PHASE) {
    return false;
  }
  if (value.metadata.sideEffects !== false) {
    return false;
  }
  if (value.metadata.persistenceEnabled !== false) {
    return false;
  }
  if (value.metadata.consoleLogging !== false) {
    return false;
  }
  if (value.metadata.fileWrites !== false) {
    return false;
  }
  if (value.metadata.databaseWrites !== false) {
    return false;
  }
  return true;
}

module.exports = {
  EXECUTION_DIAGNOSTICS_PHASE,
  CAPABILITY_OBSERVATION_PHASE,
  DIAGNOSTIC_STAGE_TYPES,
  SUPPORTED_DIAGNOSTIC_STAGE_TYPES,
  DIAGNOSTIC_STAGE_STATUSES,
  SUPPORTED_DIAGNOSTIC_STAGE_STATUSES,
  TRACE_STATUSES,
  SUPPORTED_TRACE_STATUSES,
  DIAGNOSTIC_VALIDATION_REASONS,
  REQUIRED_TRACE_FIELDS,
  REQUIRED_STAGE_FIELDS,
  createExecutionTrace,
  appendExecutionStage,
  finalizeExecutionTrace,
  summarizeExecutionTrace,
  validateExecutionTrace,
  validateExecutionStage,
  validateStageInput,
  isSupportedDiagnosticStageType,
  isSupportedDiagnosticStageStatus,
  isExecutionTraceArchitectureOnly,
  observeExecutionDiagnosticsCapability,
  peekExecutionDiagnosticsCapabilityObservation
};
