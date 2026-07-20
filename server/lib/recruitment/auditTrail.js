"use strict";

/**
 * Phase 39 — Audit Trail & Execution History Architecture (architecture only).
 *
 * Creates and validates advisory audit records that can represent future
 * recruitment lifecycle policy decisions, execution plans, transaction plans,
 * and persistence outcomes.
 *
 * Never writes audit records. Never accesses databases, MySQL, queues,
 * Express, or the filesystem. Never mutates runtime state, workers, or
 * feature flags. Never enables persistence or automation.
 *
 * Records are deterministic descriptions only: persisted/written are always
 * false; architectureOnly is always true.
 */

const AUDIT_EVENT_TYPES = Object.freeze({
  POLICY_DECISION: "policy_decision",
  EXECUTION_PLAN: "execution_plan",
  TRANSACTION_PLAN: "transaction_plan",
  PERSISTENCE_OUTCOME: "persistence_outcome"
});

const SUPPORTED_EVENT_TYPES = Object.freeze(
  new Set(Object.values(AUDIT_EVENT_TYPES))
);

const AUDIT_EXECUTION_STATUSES = Object.freeze({
  ADVISORY: "advisory",
  PLANNED: "planned",
  BLOCKED: "blocked",
  COMPLETED_NOOP: "completed_noop",
  NOT_PERSISTED: "not_persisted"
});

const AUDIT_VALIDATION_REASONS = Object.freeze({
  VALID: "VALID",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  UNSUPPORTED_EVENT_TYPE: "UNSUPPORTED_EVENT_TYPE",
  INVALID_FIELD: "INVALID_FIELD"
});

const REQUIRED_AUDIT_FIELDS = Object.freeze([
  "eventId",
  "eventType",
  "action",
  "reasons",
  "executionStatus",
  "correlation",
  "architectureOnly",
  "persisted",
  "written",
  "metadata"
]);

/**
 * @typedef {Object} AuditCorrelation
 * @property {string|null} correlationId
 * @property {string|null} parentEventId
 * @property {string|null} pipelineStage
 * @property {string|null} sourceModule
 */

/**
 * @typedef {Object} AuditTransactionInfo
 * @property {boolean} required
 * @property {string|null} scope
 * @property {string|null} isolationHint
 * @property {boolean} begun
 * @property {boolean} committed
 * @property {boolean} rolledBack
 * @property {string[]} stepsInTransaction
 */

/**
 * @typedef {Object} AuditEvent
 * @property {string} eventId
 * @property {string} eventType
 * @property {string|null} action
 * @property {string|null} reason
 * @property {string[]} reasons
 * @property {string|null} confidence
 * @property {string|null} lifecycleEventType
 * @property {string} executionStatus
 * @property {AuditTransactionInfo|null} transaction
 * @property {AuditCorrelation} correlation
 * @property {Object} context
 * @property {Object|null} payload
 * @property {boolean} architectureOnly
 * @property {boolean} persisted
 * @property {boolean} written
 * @property {Object} metadata
 */

/**
 * @typedef {Object} AuditValidationResult
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

function normalizeReasons(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const reason = normalizeString(item);
    if (reason == null || seen.has(reason)) {
      continue;
    }
    seen.add(reason);
    out.push(reason);
  }
  return out;
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

function deriveEventId(parts) {
  return `audit_${simpleFingerprint(stableSerialize(parts))}`;
}

function freezeCorrelation(correlation) {
  return {
    correlationId:
      correlation.correlationId == null
        ? null
        : String(correlation.correlationId),
    parentEventId:
      correlation.parentEventId == null
        ? null
        : String(correlation.parentEventId),
    pipelineStage:
      correlation.pipelineStage == null
        ? null
        : String(correlation.pipelineStage),
    sourceModule:
      correlation.sourceModule == null ? null : String(correlation.sourceModule)
  };
}

function normalizeCorrelation(raw) {
  if (!isPlainObject(raw)) {
    return freezeCorrelation({
      correlationId: null,
      parentEventId: null,
      pipelineStage: null,
      sourceModule: null
    });
  }
  return freezeCorrelation({
    correlationId: normalizeString(raw.correlationId),
    parentEventId: normalizeString(raw.parentEventId),
    pipelineStage: normalizeString(raw.pipelineStage),
    sourceModule: normalizeString(raw.sourceModule)
  });
}

function freezeTransaction(info) {
  return {
    required: info.required === true,
    scope: info.scope == null ? null : String(info.scope),
    isolationHint:
      info.isolationHint == null ? null : String(info.isolationHint),
    begun: false,
    committed: false,
    rolledBack: false,
    stepsInTransaction: Array.isArray(info.stepsInTransaction)
      ? info.stepsInTransaction
          .filter((id) => id != null && id !== "")
          .map((id) => String(id))
      : []
  };
}

function normalizeTransaction(raw) {
  if (raw == null) {
    return null;
  }
  if (!isPlainObject(raw)) {
    return freezeTransaction({
      required: false,
      scope: null,
      isolationHint: null,
      stepsInTransaction: []
    });
  }
  return freezeTransaction({
    required: raw.required === true,
    scope: normalizeString(raw.scope),
    isolationHint: normalizeString(raw.isolationHint),
    stepsInTransaction: Array.isArray(raw.stepsInTransaction)
      ? raw.stepsInTransaction
      : []
  });
}

function normalizeExecutionStatus(value, fallback) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return fallback;
  }
  const known = new Set(Object.values(AUDIT_EXECUTION_STATUSES));
  return known.has(normalized) ? normalized : fallback;
}

function normalizeEventType(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return null;
  }
  return SUPPORTED_EVENT_TYPES.has(normalized) ? normalized : normalized;
}

function buildDefaultMetadata(extras) {
  const safeExtras = isPlainObject(extras) ? { ...extras } : {};
  delete safeExtras.sideEffects;
  delete safeExtras.advisory;
  delete safeExtras.architectureOnly;
  delete safeExtras.auditWritten;
  delete safeExtras.persistenceEnabled;
  delete safeExtras.automationEnabled;
  return {
    ...safeExtras,
    sideEffects: false,
    advisory: true,
    architectureOnly: true,
    auditWritten: false,
    persistenceEnabled: false,
    automationEnabled: false
  };
}

function buildAuditEventShell(partial) {
  const reasons = sortReasons(normalizeReasons(partial.reasons));
  const reason =
    normalizeString(partial.reason) ||
    (reasons.length > 0 ? reasons[0] : null);
  const eventType = normalizeEventType(partial.eventType);
  const action = normalizeString(partial.action);
  const correlation = normalizeCorrelation(partial.correlation);
  const context = clonePlain(partial.context) || {};
  const payload =
    partial.payload == null ? null : cloneDeepPlain(partial.payload, 6) || {};
  const transaction = normalizeTransaction(partial.transaction);
  const executionStatus = normalizeExecutionStatus(
    partial.executionStatus,
    AUDIT_EXECUTION_STATUSES.ADVISORY
  );

  const eventId =
    normalizeString(partial.eventId) ||
    deriveEventId({
      eventType,
      action,
      reasons,
      reason,
      executionStatus,
      correlation,
      confidence: normalizeString(partial.confidence),
      lifecycleEventType: normalizeString(partial.lifecycleEventType)
    });

  const metadata = buildDefaultMetadata(
    isPlainObject(partial.metadata) ? clonePlain(partial.metadata) : null
  );

  return {
    eventId,
    eventType:
      eventType == null ? AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME : eventType,
    action,
    reason,
    reasons,
    confidence: normalizeString(partial.confidence),
    lifecycleEventType: normalizeString(partial.lifecycleEventType),
    executionStatus,
    transaction,
    correlation,
    context,
    payload,
    architectureOnly: true,
    persisted: false,
    written: false,
    metadata
  };
}

/**
 * Create an advisory audit event record from structured input.
 * Pure: no I/O, no mutation of inputs, no persistence write.
 *
 * @param {Object|null|undefined} input
 * @returns {AuditEvent}
 */
function createAuditEvent(input) {
  if (!isPlainObject(input)) {
    return buildAuditEventShell({
      eventType: AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME,
      action: null,
      reason: AUDIT_VALIDATION_REASONS.INVALID_INPUT,
      reasons: [AUDIT_VALIDATION_REASONS.INVALID_INPUT],
      executionStatus: AUDIT_EXECUTION_STATUSES.NOT_PERSISTED,
      correlation: null,
      context: { invalidInput: true },
      payload: null,
      metadata: {
        createReason: AUDIT_VALIDATION_REASONS.INVALID_INPUT
      }
    });
  }

  const eventType = normalizeEventType(input.eventType);
  const supported =
    eventType != null && SUPPORTED_EVENT_TYPES.has(eventType);

  return buildAuditEventShell({
    eventId: input.eventId,
    eventType: supported
      ? eventType
      : AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME,
    action: input.action,
    reason: input.reason,
    reasons:
      Array.isArray(input.reasons) && input.reasons.length > 0
        ? input.reasons
        : input.reason != null
          ? [input.reason]
          : supported
            ? []
            : [AUDIT_VALIDATION_REASONS.UNSUPPORTED_EVENT_TYPE],
    confidence: input.confidence,
    lifecycleEventType: input.lifecycleEventType,
    executionStatus: input.executionStatus,
    transaction: input.transaction,
    correlation: input.correlation,
    context: input.context,
    payload: input.payload,
    metadata: {
      ...(isPlainObject(input.metadata) ? input.metadata : {}),
      createReason: supported
        ? AUDIT_VALIDATION_REASONS.VALID
        : AUDIT_VALIDATION_REASONS.UNSUPPORTED_EVENT_TYPE,
      requestedEventType: eventType
    }
  });
}

function extractConfidence(source) {
  if (!isPlainObject(source)) {
    return null;
  }
  if (source.confidence != null) {
    return normalizeString(source.confidence);
  }
  if (isPlainObject(source.metadata) && source.metadata.confidence != null) {
    return normalizeString(source.metadata.confidence);
  }
  if (isPlainObject(source.eligibility) && source.eligibility.confidence != null) {
    return normalizeString(source.eligibility.confidence);
  }
  return null;
}

function extractLifecycleEventType(source) {
  if (!isPlainObject(source)) {
    return null;
  }
  if (source.lifecycleEventType != null) {
    return normalizeString(source.lifecycleEventType);
  }
  if (source.eventType != null && typeof source.eventType === "string") {
    const candidate = normalizeString(source.eventType);
    if (
      candidate != null &&
      !SUPPORTED_EVENT_TYPES.has(candidate) &&
      candidate !== "policy_decision"
    ) {
      return candidate;
    }
  }
  if (isPlainObject(source.metadata) && source.metadata.eventType != null) {
    return normalizeString(source.metadata.eventType);
  }
  if (isPlainObject(source.eligibility) && source.eligibility.eventType != null) {
    return normalizeString(source.eligibility.eventType);
  }
  return null;
}

/**
 * Build an audit event from a PersistencePolicyDecision-like object.
 *
 * @param {Object|null|undefined} decision
 * @param {Object|null|undefined} [correlation]
 * @param {Object|null|undefined} [options]
 * @returns {AuditEvent}
 */
function createPolicyDecisionAuditEvent(decision, correlation, options) {
  const opts = isPlainObject(options) ? options : {};
  if (!isPlainObject(decision)) {
    return createAuditEvent({
      eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
      action: null,
      reason: AUDIT_VALIDATION_REASONS.INVALID_INPUT,
      reasons: [AUDIT_VALIDATION_REASONS.INVALID_INPUT],
      executionStatus: AUDIT_EXECUTION_STATUSES.NOT_PERSISTED,
      correlation: {
        ...(isPlainObject(correlation) ? correlation : {}),
        pipelineStage: "policy",
        sourceModule: "runtimePersistencePolicy"
      },
      context: { invalidDecision: true },
      payload: null,
      eventId: opts.eventId
    });
  }

  const reasons = Array.isArray(decision.reasons)
    ? decision.reasons
    : decision.reason != null
      ? [decision.reason]
      : [];

  return createAuditEvent({
    eventId: opts.eventId,
    eventType: AUDIT_EVENT_TYPES.POLICY_DECISION,
    action: decision.action,
    reason: decision.reason,
    reasons,
    confidence: extractConfidence(decision) || extractConfidence(decision.metadata),
    lifecycleEventType:
      extractLifecycleEventType(decision) ||
      extractLifecycleEventType(decision.metadata),
    executionStatus: AUDIT_EXECUTION_STATUSES.ADVISORY,
    transaction: null,
    correlation: {
      ...(isPlainObject(correlation) ? correlation : {}),
      pipelineStage:
        (correlation && correlation.pipelineStage) || "policy",
      sourceModule:
        (correlation && correlation.sourceModule) ||
        "runtimePersistencePolicy"
    },
    context: {
      intendedAction:
        decision.metadata && decision.metadata.intendedAction != null
          ? String(decision.metadata.intendedAction)
          : null,
      automationEnabled:
        decision.metadata && decision.metadata.automationEnabled === true,
      previewMode:
        decision.metadata && decision.metadata.previewMode === true
    },
    payload: decision,
    metadata: opts.metadata
  });
}

/**
 * Build an audit event from a PersistenceExecutionPlan-like object.
 *
 * @param {Object|null|undefined} plan
 * @param {Object|null|undefined} [correlation]
 * @param {Object|null|undefined} [options]
 * @returns {AuditEvent}
 */
function createExecutionPlanAuditEvent(plan, correlation, options) {
  const opts = isPlainObject(options) ? options : {};
  if (!isPlainObject(plan)) {
    return createAuditEvent({
      eventType: AUDIT_EVENT_TYPES.EXECUTION_PLAN,
      action: null,
      reason: AUDIT_VALIDATION_REASONS.INVALID_INPUT,
      reasons: [AUDIT_VALIDATION_REASONS.INVALID_INPUT],
      executionStatus: AUDIT_EXECUTION_STATUSES.NOT_PERSISTED,
      correlation: {
        ...(isPlainObject(correlation) ? correlation : {}),
        pipelineStage: "pipeline",
        sourceModule: "persistenceExecutionPipeline"
      },
      context: { invalidPlan: true },
      payload: null,
      eventId: opts.eventId
    });
  }

  const txn = isPlainObject(plan.transactionRequirements)
    ? plan.transactionRequirements
    : null;
  const planReason =
    plan.metadata && plan.metadata.planReason != null
      ? String(plan.metadata.planReason)
      : "PLAN_RECORDED";

  return createAuditEvent({
    eventId: opts.eventId,
    eventType: AUDIT_EVENT_TYPES.EXECUTION_PLAN,
    action: plan.action,
    reason: planReason,
    reasons: [planReason],
    confidence: extractConfidence(plan) || extractConfidence(plan.metadata),
    lifecycleEventType:
      extractLifecycleEventType(plan) || extractLifecycleEventType(plan.metadata),
    executionStatus: AUDIT_EXECUTION_STATUSES.PLANNED,
    transaction: txn
      ? {
          required: txn.required === true,
          scope: txn.scope,
          isolationHint: txn.isolationHint,
          stepsInTransaction: txn.stepsInTransaction
        }
      : null,
    correlation: {
      ...(isPlainObject(correlation) ? correlation : {}),
      pipelineStage:
        (correlation && correlation.pipelineStage) || "pipeline",
      sourceModule:
        (correlation && correlation.sourceModule) ||
        "persistenceExecutionPipeline"
    },
    context: {
      executable: plan.executable === true,
      architectureOnly: plan.architectureOnly === true,
      stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
      repositoryDependencies: Array.isArray(plan.repositoryDependencies)
        ? [...plan.repositoryDependencies]
        : []
    },
    payload: plan,
    metadata: opts.metadata
  });
}

/**
 * Build an audit event from a TransactionPlan-like object.
 *
 * @param {Object|null|undefined} plan
 * @param {Object|null|undefined} [correlation]
 * @param {Object|null|undefined} [options]
 * @returns {AuditEvent}
 */
function createTransactionPlanAuditEvent(plan, correlation, options) {
  const opts = isPlainObject(options) ? options : {};
  if (!isPlainObject(plan)) {
    return createAuditEvent({
      eventType: AUDIT_EVENT_TYPES.TRANSACTION_PLAN,
      action: null,
      reason: AUDIT_VALIDATION_REASONS.INVALID_INPUT,
      reasons: [AUDIT_VALIDATION_REASONS.INVALID_INPUT],
      executionStatus: AUDIT_EXECUTION_STATUSES.NOT_PERSISTED,
      correlation: {
        ...(isPlainObject(correlation) ? correlation : {}),
        pipelineStage: "transaction",
        sourceModule: "transactionCoordinator"
      },
      context: { invalidPlan: true },
      payload: null,
      eventId: opts.eventId
    });
  }

  const planReason =
    plan.metadata && plan.metadata.planReason != null
      ? String(plan.metadata.planReason)
      : "TRANSACTION_PLAN_RECORDED";

  return createAuditEvent({
    eventId: opts.eventId,
    eventType: AUDIT_EVENT_TYPES.TRANSACTION_PLAN,
    action: plan.action,
    reason: planReason,
    reasons: [planReason],
    confidence: extractConfidence(plan) || extractConfidence(plan.metadata),
    lifecycleEventType:
      extractLifecycleEventType(plan) || extractLifecycleEventType(plan.metadata),
    executionStatus: AUDIT_EXECUTION_STATUSES.PLANNED,
    transaction: {
      required: plan.transactionRequired === true,
      scope: plan.scope,
      isolationHint: plan.isolationHint,
      stepsInTransaction: plan.stepsInTransaction
    },
    correlation: {
      ...(isPlainObject(correlation) ? correlation : {}),
      pipelineStage:
        (correlation && correlation.pipelineStage) || "transaction",
      sourceModule:
        (correlation && correlation.sourceModule) || "transactionCoordinator"
    },
    context: {
      executable: plan.executable === true,
      architectureOnly: plan.architectureOnly === true,
      stageCount: Array.isArray(plan.stages) ? plan.stages.length : 0,
      orderedStepIds: Array.isArray(plan.orderedStepIds)
        ? [...plan.orderedStepIds]
        : []
    },
    payload: plan,
    metadata: opts.metadata
  });
}

/**
 * Build an audit event from a PersistenceExecutionResult-like object
 * (future persistence outcome).
 *
 * @param {Object|null|undefined} result
 * @param {Object|null|undefined} [correlation]
 * @param {Object|null|undefined} [options]
 * @returns {AuditEvent}
 */
function createPersistenceOutcomeAuditEvent(result, correlation, options) {
  const opts = isPlainObject(options) ? options : {};
  if (!isPlainObject(result)) {
    return createAuditEvent({
      eventType: AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME,
      action: null,
      reason: AUDIT_VALIDATION_REASONS.INVALID_INPUT,
      reasons: [AUDIT_VALIDATION_REASONS.INVALID_INPUT],
      executionStatus: AUDIT_EXECUTION_STATUSES.NOT_PERSISTED,
      correlation: {
        ...(isPlainObject(correlation) ? correlation : {}),
        pipelineStage: "outcome",
        sourceModule: "runtimePersistenceService"
      },
      context: { invalidResult: true },
      payload: null,
      eventId: opts.eventId
    });
  }

  let executionStatus = AUDIT_EXECUTION_STATUSES.NOT_PERSISTED;
  if (result.executionBlocked === true) {
    executionStatus = AUDIT_EXECUTION_STATUSES.BLOCKED;
  } else if (result.executed === true) {
    executionStatus = AUDIT_EXECUTION_STATUSES.COMPLETED_NOOP;
  } else if (result.advisory === true) {
    executionStatus = AUDIT_EXECUTION_STATUSES.ADVISORY;
  }

  const reasons = [];
  if (result.blockReason != null) {
    reasons.push(String(result.blockReason));
  }
  if (
    result.metadata &&
    Array.isArray(result.metadata.policyReasons)
  ) {
    for (const item of result.metadata.policyReasons) {
      if (item != null && item !== "") {
        reasons.push(String(item));
      }
    }
  }
  if (reasons.length === 0) {
    reasons.push("OUTCOME_RECORDED");
  }

  return createAuditEvent({
    eventId: opts.eventId,
    eventType: AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME,
    action: result.actualAction != null ? result.actualAction : result.intendedAction,
    reason: reasons[0],
    reasons,
    confidence: extractConfidence(result) || extractConfidence(result.metadata),
    lifecycleEventType:
      extractLifecycleEventType(result) ||
      extractLifecycleEventType(result.metadata),
    executionStatus,
    transaction: null,
    correlation: {
      ...(isPlainObject(correlation) ? correlation : {}),
      pipelineStage:
        (correlation && correlation.pipelineStage) || "outcome",
      sourceModule:
        (correlation && correlation.sourceModule) ||
        "runtimePersistenceService"
    },
    context: {
      intendedAction:
        result.intendedAction == null ? null : String(result.intendedAction),
      actualAction:
        result.actualAction == null ? null : String(result.actualAction),
      executed: result.executed === true,
      executionBlocked: result.executionBlocked === true,
      advisory: result.advisory !== false,
      blockReason:
        result.blockReason == null ? null : String(result.blockReason)
    },
    payload: result,
    metadata: opts.metadata
  });
}

/**
 * Validate an audit event record without writing or mutating it.
 *
 * @param {Object|null|undefined} event
 * @returns {AuditValidationResult}
 */
function validateAuditEvent(event) {
  const errors = [];
  const reasons = [];

  if (!isPlainObject(event)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["event must be a plain object"]),
      reasons: Object.freeze([AUDIT_VALIDATION_REASONS.INVALID_INPUT])
    });
  }

  for (const field of REQUIRED_AUDIT_FIELDS) {
    if (event[field] === undefined) {
      errors.push(`missing required field: ${field}`);
      reasons.push(AUDIT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
    }
  }

  if (event.eventType != null && !SUPPORTED_EVENT_TYPES.has(String(event.eventType))) {
    errors.push(`unsupported eventType: ${event.eventType}`);
    reasons.push(AUDIT_VALIDATION_REASONS.UNSUPPORTED_EVENT_TYPE);
  }

  if (event.eventId != null && typeof event.eventId !== "string") {
    errors.push("eventId must be a string");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  } else if (
    typeof event.eventId === "string" &&
    event.eventId.trim() === ""
  ) {
    errors.push("eventId must be non-empty");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.action != null && typeof event.action !== "string") {
    errors.push("action must be a string or null");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.reasons !== undefined && !Array.isArray(event.reasons)) {
    errors.push("reasons must be an array");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (
    event.executionStatus != null &&
    !Object.values(AUDIT_EXECUTION_STATUSES).includes(
      String(event.executionStatus)
    )
  ) {
    errors.push(`unsupported executionStatus: ${event.executionStatus}`);
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.correlation !== undefined && !isPlainObject(event.correlation)) {
    errors.push("correlation must be a plain object");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  } else if (isPlainObject(event.correlation)) {
    for (const key of [
      "correlationId",
      "parentEventId",
      "pipelineStage",
      "sourceModule"
    ]) {
      if (!(key in event.correlation)) {
        errors.push(`correlation missing field: ${key}`);
        reasons.push(AUDIT_VALIDATION_REASONS.MISSING_REQUIRED_FIELD);
      }
    }
  }

  if (
    event.transaction !== undefined &&
    event.transaction !== null &&
    !isPlainObject(event.transaction)
  ) {
    errors.push("transaction must be a plain object or null");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.architectureOnly !== true) {
    errors.push("architectureOnly must be true");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.persisted !== false) {
    errors.push("persisted must be false for architecture-only audit events");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.written !== false) {
    errors.push("written must be false for architecture-only audit events");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  }

  if (event.metadata !== undefined && !isPlainObject(event.metadata)) {
    errors.push("metadata must be a plain object");
    reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
  } else if (isPlainObject(event.metadata)) {
    if (event.metadata.sideEffects === true) {
      errors.push("metadata.sideEffects must not be true");
      reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (event.metadata.auditWritten === true) {
      errors.push("metadata.auditWritten must not be true");
      reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
    }
    if (event.metadata.persistenceEnabled === true) {
      errors.push("metadata.persistenceEnabled must not be true");
      reasons.push(AUDIT_VALIDATION_REASONS.INVALID_FIELD);
    }
  }

  const uniqueReasons = sortReasons([...new Set(reasons)]);
  const valid = errors.length === 0;
  if (valid) {
    uniqueReasons.length = 0;
    uniqueReasons.push(AUDIT_VALIDATION_REASONS.VALID);
  }

  return Object.freeze({
    valid,
    errors: Object.freeze([...errors]),
    reasons: Object.freeze(uniqueReasons)
  });
}

/**
 * @param {string|null|undefined} eventType
 * @returns {boolean}
 */
function isSupportedAuditEventType(eventType) {
  return (
    eventType != null && SUPPORTED_EVENT_TYPES.has(String(eventType).trim())
  );
}

/**
 * Convenience: assert an audit event never claims to have been written
 * or to have enabled persistence/side effects.
 *
 * @param {AuditEvent} event
 * @returns {boolean}
 */
function isAuditEventArchitectureOnly(event) {
  return (
    isPlainObject(event) &&
    event.architectureOnly === true &&
    event.persisted === false &&
    event.written === false &&
    event.metadata != null &&
    event.metadata.sideEffects === false &&
    event.metadata.auditWritten === false &&
    event.metadata.persistenceEnabled === false &&
    (event.transaction == null ||
      (event.transaction.begun === false &&
        event.transaction.committed === false &&
        event.transaction.rolledBack === false))
  );
}

module.exports = {
  AUDIT_EVENT_TYPES,
  AUDIT_EXECUTION_STATUSES,
  AUDIT_VALIDATION_REASONS,
  REQUIRED_AUDIT_FIELDS,
  createAuditEvent,
  createPolicyDecisionAuditEvent,
  createExecutionPlanAuditEvent,
  createTransactionPlanAuditEvent,
  createPersistenceOutcomeAuditEvent,
  validateAuditEvent,
  isSupportedAuditEventType,
  isAuditEventArchitectureOnly
};
