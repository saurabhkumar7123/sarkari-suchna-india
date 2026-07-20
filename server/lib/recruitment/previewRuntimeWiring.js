"use strict";

/**
 * Phase 41 — Preview-First Runtime Wiring (observation only).
 *
 * Integrates Phases 33–40 into a single advisory chain for the live
 * recruitment runtime preview path:
 *
 *   ExecutionContext → Policy → Persistence Service → Execution Plan →
 *   Transaction Plan → Audit Events → preview metadata
 *
 * Phase 48 — also attaches runtimeCapabilityRegistry (read-only) to the
 * runtime result for observation. The registry is never consumed, never
 * used for branching, and never affects advisory metadata projected to
 * workers.
 *
 * Phase 51 — also resolves one capability via the Runtime Capability
 * Resolver and stores it in an internal observation context only. The
 * resolved capability is never exposed publicly, never projected into
 * metadata, never used for branching/enablement/execution, and never
 * changes runtime outputs.
 *
 * Phase 58 — Preview Advisory preparation inspects the existing normalized
 * capability consumption. Inspection is observation-only and does not alter
 * advisory output, metadata, rendering, or runtime state.
 *
 * Phase 59 — advisory inspection fulfills the Preview Integration Contract
 * (read-only) instead of reading the capability consumer directly.
 *
 * Never writes to a database. Never calls repositories. Never enqueues
 * reviews. Never begins, commits, or rolls back transactions. Never
 * enables automation or changes publishing behavior.
 *
 * Feature-safe: automation and review enqueue flags are forced off;
 * execution mode is always preview when this wiring runs.
 */

const {
  EXECUTION_MODES,
  createExecutionContext,
  isExecutionContextArchitectureOnly,
  toAuditCorrelation
} = require("./executionContext");

const {
  RUNTIME_MODES,
  evaluateRuntimePersistencePolicy
} = require("./runtimePersistencePolicy");

const {
  executeRuntimePersistence
} = require("./runtimePersistenceService");

const {
  buildPersistenceExecutionPlan,
  isPlanArchitectureOnly
} = require("./persistenceExecutionPipeline");

const {
  buildTransactionPlan,
  isTransactionPlanArchitectureOnly
} = require("./transactionCoordinator");

const {
  createPolicyDecisionAuditEvent,
  createExecutionPlanAuditEvent,
  createTransactionPlanAuditEvent,
  createPersistenceOutcomeAuditEvent,
  isAuditEventArchitectureOnly
} = require("./auditTrail");

const {
  attachRuntimeCapabilityRegistry
} = require("./runtimeCapabilityRegistryIntegration");

const {
  observeRuntimeCapability,
  inspectPreviewAdvisoryCapability
} = require("./runtimeCapabilityObservation");

const WIRING_PHASE = 41;

const WIRING_REASONS = Object.freeze({
  ENABLED: "WIRING_ENABLED",
  DISABLED: "WIRING_DISABLED",
  INVALID_INPUT: "INVALID_INPUT"
});

/**
 * @typedef {Object} PreviewRuntimeWiringResult
 * @property {boolean} enabled
 * @property {boolean} observationOnly
 * @property {boolean} architectureOnly
 * @property {boolean} sideEffects
 * @property {string} reason
 * @property {Object|null} context
 * @property {Object|null} policyDecision
 * @property {Object|null} persistenceOutcome
 * @property {Object|null} executionPlan
 * @property {Object|null} transactionPlan
 * @property {Object[]} auditEvents
 * @property {Object} metadata
 * @property {Object} capabilityRegistry Phase 48 — read-only catalog attachment
 * Phase 51 stores resolved capability observation in an internal WeakMap only
 * (never a public field; never projected into advisory metadata).
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

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function clonePlain(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return { ...value };
}

function extractProcessorResult(input) {
  if (isPlainObject(input.processorResult)) {
    return input.processorResult;
  }
  if (isPlainObject(input.pipelineOutcome) && isPlainObject(input.pipelineOutcome.result)) {
    return input.pipelineOutcome.result;
  }
  return null;
}

function extractLifecycleState(selectedRecruitment) {
  if (!isPlainObject(selectedRecruitment)) {
    return null;
  }
  return (
    normalizeString(selectedRecruitment.lifecycleState) ||
    normalizeString(selectedRecruitment.lifecycle_state) ||
    normalizeString(selectedRecruitment.state) ||
    null
  );
}

function extractRecruitmentId(selectedRecruitment, processorResult) {
  if (isPlainObject(selectedRecruitment) && selectedRecruitment.id != null) {
    return normalizeString(selectedRecruitment.id);
  }
  if (isPlainObject(processorResult) && processorResult.recruitmentId != null) {
    return normalizeString(processorResult.recruitmentId);
  }
  return null;
}

function buildDisabledResult(reason, extras) {
  // Phase 48 — attach registry read-only; never consumed for decisions.
  // Phase 51 — resolve one capability into internal observation only.
  return observeRuntimeCapability(
    attachRuntimeCapabilityRegistry({
      enabled: false,
      observationOnly: true,
      architectureOnly: true,
      sideEffects: false,
      reason: String(reason),
      context: null,
      policyDecision: null,
      persistenceOutcome: null,
      executionPlan: null,
      transactionPlan: null,
      auditEvents: [],
      metadata: {
        wiringPhase: WIRING_PHASE,
        sideEffects: false,
        advisory: true,
        architectureOnly: true,
        persistenceEnabled: false,
        automationEnabled: false,
        reviewQueueEnqueueEnabled: false,
        observationOnly: true,
        ...(isPlainObject(extras) ? extras : {})
      }
    })
  );
}

/**
 * Map live pipeline observation inputs into a PersistencePolicyContext.
 * Always forces preview / automation-off safety defaults.
 *
 * @param {Object} input
 * @returns {Object}
 */
function buildPolicyContextFromRuntime(input) {
  const eligibility = isPlainObject(input.eligibility) ? input.eligibility : null;
  const processorResult = extractProcessorResult(input);
  const selectedRecruitment = isPlainObject(processorResult)
    ? processorResult.selectedRecruitment
    : null;
  const matchResult =
    (eligibility && eligibility.matchResult) ||
    (processorResult && processorResult.matchResult) ||
    null;
  const eventType =
    (eligibility && eligibility.eventType) ||
    (processorResult && processorResult.eventType) ||
    null;
  const lifecycleState = extractLifecycleState(selectedRecruitment);
  const reviewRequired =
    eligibility != null && String(eligibility.status || "").toLowerCase() === "manual_review";

  const callerFlags = isPlainObject(input.featureFlags) ? input.featureFlags : {};

  return {
    featureFlags: {
      pipelineEnabled: asBool(callerFlags.pipelineEnabled, true),
      // Hard safety: never allow automation through this wiring layer.
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    runtimeMode: RUNTIME_MODES.PREVIEW,
    previewMode: true,
    eligibility,
    reviewRequired,
    matcherConfidence:
      eligibility && eligibility.confidence != null
        ? eligibility.confidence
        : matchResult && matchResult.confidence != null
          ? matchResult.confidence
          : null,
    matchResult: isPlainObject(matchResult) ? matchResult : null,
    existingRecruitmentMatch: null,
    eventType,
    lifecycleState,
    lookupSummary: isPlainObject(input.lookupSummary) ? input.lookupSummary : null
  };
}

function summarizeContext(context) {
  if (!isPlainObject(context)) {
    return null;
  }
  return {
    contextId: context.contextId,
    correlationId: context.correlationId,
    pipelineRunId: context.pipelineRunId,
    parentContextId: context.parentContextId,
    executionMode: context.executionMode,
    sourceModule: context.sourceModule,
    recruitment: clonePlain(context.recruitment),
    architectureOnly: context.architectureOnly === true
  };
}

function summarizePolicyDecision(decision) {
  if (!isPlainObject(decision)) {
    return null;
  }
  return {
    action: decision.action != null ? String(decision.action) : null,
    reason: decision.reason != null ? String(decision.reason) : null,
    reasons: Array.isArray(decision.reasons) ? [...decision.reasons] : [],
    intendedAction:
      decision.metadata && decision.metadata.intendedAction != null
        ? String(decision.metadata.intendedAction)
        : null,
    wouldPersistIfAutomationEnabled:
      decision.metadata &&
      decision.metadata.wouldPersistIfAutomationEnabled === true,
    wouldReviewIfEnqueueEnabled:
      decision.metadata && decision.metadata.wouldReviewIfEnqueueEnabled === true,
    previewMode:
      decision.metadata && decision.metadata.previewMode === true,
    automationEnabled:
      decision.metadata && decision.metadata.automationEnabled === true
  };
}

function summarizePersistenceOutcome(result) {
  if (!isPlainObject(result)) {
    return null;
  }
  return {
    intendedAction:
      result.intendedAction == null ? null : String(result.intendedAction),
    actualAction: result.actualAction == null ? null : String(result.actualAction),
    executed: result.executed === true,
    executionBlocked: result.executionBlocked === true,
    advisory: result.advisory !== false,
    blockReason: result.blockReason == null ? null : String(result.blockReason)
  };
}

function summarizeExecutionPlan(plan) {
  if (!isPlainObject(plan)) {
    return null;
  }
  return {
    action: plan.action == null ? null : String(plan.action),
    executable: plan.executable === true,
    architectureOnly: plan.architectureOnly === true,
    stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
    stepIds: Array.isArray(plan.steps)
      ? plan.steps.map((step) => String(step.id))
      : [],
    transactionRequired:
      plan.transactionRequirements &&
      plan.transactionRequirements.required === true,
    transactionScope:
      plan.transactionRequirements && plan.transactionRequirements.scope != null
        ? String(plan.transactionRequirements.scope)
        : null,
    planReason:
      plan.metadata && plan.metadata.planReason != null
        ? String(plan.metadata.planReason)
        : null
  };
}

function summarizeTransactionPlan(plan) {
  if (!isPlainObject(plan)) {
    return null;
  }
  return {
    action: plan.action == null ? null : String(plan.action),
    transactionRequired: plan.transactionRequired === true,
    scope: plan.scope == null ? null : String(plan.scope),
    isolationHint: plan.isolationHint == null ? null : String(plan.isolationHint),
    executable: plan.executable === true,
    architectureOnly: plan.architectureOnly === true,
    stageCount: Array.isArray(plan.stages) ? plan.stages.length : 0,
    orderedStepIds: Array.isArray(plan.orderedStepIds)
      ? [...plan.orderedStepIds]
      : [],
    planReason:
      plan.metadata && plan.metadata.planReason != null
        ? String(plan.metadata.planReason)
        : null,
    transactionBegun:
      plan.metadata && plan.metadata.transactionBegun === true,
    transactionCommitted:
      plan.metadata && plan.metadata.transactionCommitted === true,
    transactionRolledBack:
      plan.metadata && plan.metadata.transactionRolledBack === true
  };
}

function summarizeAuditEvent(event) {
  if (!isPlainObject(event)) {
    return null;
  }
  return {
    eventId: event.eventId == null ? null : String(event.eventId),
    eventType: event.eventType == null ? null : String(event.eventType),
    action: event.action == null ? null : String(event.action),
    reason: event.reason == null ? null : String(event.reason),
    executionStatus:
      event.executionStatus == null ? null : String(event.executionStatus),
    correlationId:
      event.correlation && event.correlation.correlationId != null
        ? String(event.correlation.correlationId)
        : null,
    pipelineStage:
      event.correlation && event.correlation.pipelineStage != null
        ? String(event.correlation.pipelineStage)
        : null,
    architectureOnly: event.architectureOnly === true,
    persisted: event.persisted === true,
    written: event.written === true
  };
}

/**
 * Project a full wiring result into compact advisory metadata for
 * preview/debug attachment (additive; no side effects).
 *
 * @param {PreviewRuntimeWiringResult|null|undefined} result
 * @returns {Object}
 */
function toPreviewAdvisoryMetadata(result) {
  // Phase 58/59 — advisory-path observation only via the Preview Integration
  // Contract. The normalized capability is deliberately not projected or used
  // to select any advisory fields.
  const consumedCapability = inspectPreviewAdvisoryCapability(result);
  void consumedCapability;

  if (!isPlainObject(result) || result.enabled !== true) {
    return {
      observationOnly: true,
      architectureOnly: true,
      enabled: false,
      wiringPhase: WIRING_PHASE,
      sideEffects: false,
      persistenceEnabled: false,
      automationEnabled: false,
      reason:
        isPlainObject(result) && result.reason != null
          ? String(result.reason)
          : WIRING_REASONS.DISABLED,
      auditEventCount: 0
    };
  }

  return {
    observationOnly: true,
    architectureOnly: true,
    enabled: true,
    wiringPhase: WIRING_PHASE,
    sideEffects: false,
    persistenceEnabled: false,
    automationEnabled: false,
    reason: WIRING_REASONS.ENABLED,
    correlationId:
      result.context && result.context.correlationId != null
        ? String(result.context.correlationId)
        : null,
    pipelineRunId:
      result.context && result.context.pipelineRunId != null
        ? String(result.context.pipelineRunId)
        : null,
    context: summarizeContext(result.context),
    policyDecision: summarizePolicyDecision(result.policyDecision),
    persistenceOutcome: summarizePersistenceOutcome(result.persistenceOutcome),
    executionPlan: summarizeExecutionPlan(result.executionPlan),
    transactionPlan: summarizeTransactionPlan(result.transactionPlan),
    auditEvents: Array.isArray(result.auditEvents)
      ? result.auditEvents.map(summarizeAuditEvent).filter(Boolean)
      : [],
    auditEventCount: Array.isArray(result.auditEvents)
      ? result.auditEvents.length
      : 0
  };
}

/**
 * Run the preview-first lifecycle architecture chain (observation only).
 * Pure orchestration: no I/O, no mutation of inputs, no persistence.
 *
 * @param {Object|null|undefined} input
 * @param {boolean} [input.enabled=true] Feature guard — false skips the chain
 * @param {Object|null} [input.eligibility]
 * @param {Object|null} [input.processorResult]
 * @param {Object|null} [input.pipelineOutcome]
 * @param {Object|null} [input.lookupSummary]
 * @param {number|string|null} [input.updateId]
 * @param {Object|null} [input.notice]
 * @param {Object|null} [input.featureFlags]
 * @returns {PreviewRuntimeWiringResult}
 */
function runPreviewRuntimeWiring(input) {
  if (!isPlainObject(input)) {
    return buildDisabledResult(WIRING_REASONS.INVALID_INPUT, {
      invalidInput: true
    });
  }

  if (asBool(input.enabled, true) !== true) {
    return buildDisabledResult(WIRING_REASONS.DISABLED, {
      callerDisabled: true
    });
  }

  const processorResult = extractProcessorResult(input);
  const selectedRecruitment =
    processorResult && isPlainObject(processorResult.selectedRecruitment)
      ? processorResult.selectedRecruitment
      : null;
  const eligibility = isPlainObject(input.eligibility) ? input.eligibility : null;
  const eventType =
    (eligibility && eligibility.eventType) ||
    (processorResult && processorResult.eventType) ||
    null;
  const lifecycleState = extractLifecycleState(selectedRecruitment);
  const recruitmentId = extractRecruitmentId(selectedRecruitment, processorResult);
  const updateId =
    input.updateId != null && input.updateId !== ""
      ? String(input.updateId)
      : null;

  const context = createExecutionContext({
    executionMode: EXECUTION_MODES.PREVIEW,
    sourceModule: "previewRuntimeWiring",
    recruitment: {
      recruitmentId,
      lifecycleEventType: eventType != null ? String(eventType) : null,
      lifecycleState,
      eventRef: updateId
    },
    metadata: {
      wiringPhase: WIRING_PHASE,
      observationOnly: true,
      updateId,
      lookupStatus:
        isPlainObject(input.lookupSummary) && input.lookupSummary.status != null
          ? String(input.lookupSummary.status)
          : null
    }
  });

  const policyContext = buildPolicyContextFromRuntime(input);
  const policyDecision = evaluateRuntimePersistencePolicy(policyContext);
  const persistenceOutcome = executeRuntimePersistence(policyDecision, {
    automaticPersistenceEnabled: false,
    reviewQueueEnqueueEnabled: false
  });
  const executionPlan = buildPersistenceExecutionPlan(policyDecision);
  const transactionPlan = buildTransactionPlan(executionPlan);

  const baseCorrelation = toAuditCorrelation(context, {
    pipelineStage: "preview_wiring",
    sourceModule: "previewRuntimeWiring"
  });

  const policyAudit = createPolicyDecisionAuditEvent(
    policyDecision,
    { ...baseCorrelation, pipelineStage: "policy" },
    { metadata: { wiringPhase: WIRING_PHASE } }
  );
  const planAudit = createExecutionPlanAuditEvent(
    executionPlan,
    {
      ...baseCorrelation,
      parentEventId: policyAudit.eventId,
      pipelineStage: "pipeline"
    },
    { metadata: { wiringPhase: WIRING_PHASE } }
  );
  const transactionAudit = createTransactionPlanAuditEvent(
    transactionPlan,
    {
      ...baseCorrelation,
      parentEventId: planAudit.eventId,
      pipelineStage: "transaction"
    },
    { metadata: { wiringPhase: WIRING_PHASE } }
  );
  const outcomeAudit = createPersistenceOutcomeAuditEvent(
    persistenceOutcome,
    {
      ...baseCorrelation,
      parentEventId: transactionAudit.eventId,
      pipelineStage: "outcome"
    },
    { metadata: { wiringPhase: WIRING_PHASE } }
  );

  const auditEvents = [
    policyAudit,
    planAudit,
    transactionAudit,
    outcomeAudit
  ];

  // Phase 48 — attach registry read-only; never consumed for decisions.
  // Phase 51 — resolve one capability into internal observation only.
  return observeRuntimeCapability(
    attachRuntimeCapabilityRegistry({
      enabled: true,
      observationOnly: true,
      architectureOnly: true,
      sideEffects: false,
      reason: WIRING_REASONS.ENABLED,
      context,
      policyDecision,
      persistenceOutcome,
      executionPlan,
      transactionPlan,
      auditEvents,
      metadata: {
        wiringPhase: WIRING_PHASE,
        sideEffects: false,
        advisory: true,
        architectureOnly: true,
        persistenceEnabled: false,
        automationEnabled: false,
        reviewQueueEnqueueEnabled: false,
        observationOnly: true,
        contextArchitectureOnly: isExecutionContextArchitectureOnly(context),
        planArchitectureOnly: isPlanArchitectureOnly(executionPlan),
        transactionArchitectureOnly:
          isTransactionPlanArchitectureOnly(transactionPlan),
        auditsArchitectureOnly: auditEvents.every(isAuditEventArchitectureOnly)
      }
    })
  );
}

/**
 * Safe helper for workers: never throws; returns advisory metadata or
 * a disabled stub on unexpected failure.
 *
 * @param {Object|null|undefined} input
 * @returns {Object} compact preview advisory metadata
 */
function buildPreviewLifecycleArchitecture(input) {
  try {
    return toPreviewAdvisoryMetadata(runPreviewRuntimeWiring(input));
  } catch {
    return toPreviewAdvisoryMetadata(
      buildDisabledResult(WIRING_REASONS.DISABLED, {
        wiringError: true
      })
    );
  }
}

module.exports = {
  WIRING_PHASE,
  WIRING_REASONS,
  runPreviewRuntimeWiring,
  toPreviewAdvisoryMetadata,
  buildPreviewLifecycleArchitecture,
  buildPolicyContextFromRuntime
};
