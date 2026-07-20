"use strict";

/**
 * Phase 91 — Recruitment Workflow Integration Coordinator.
 *
 * Pure orchestration entry point for the Recruitment Business Workflow.
 * Coordinates existing Phase 20–90 libraries through a single advisory
 * integration flow without database writes, external API calls, routing,
 * or production mutations.
 *
 * Flow:
 *   input → runtime capability detection → feature flag evaluation →
 *   workflow eligibility → recruitment persistence adapter (read-only) →
 *   diagnostics → integration result
 *
 * Feature flag OFF short-circuits safely without affecting production.
 *
 * No Express. No database. No filesystem. No network access.
 * No routing. No production mutations.
 */

const {
  ELIGIBILITY_STATUS,
  evaluateRecruitmentEligibility
} = require("./recruitmentEligibility");

const {
  EXECUTION_MODES,
  DEFAULT_FEATURE_FLAGS,
  ENABLEMENT_REASONS,
  resolveFeatureState,
  evaluatePersistenceEnablement
} = require("./persistenceEnablement");

const {
  FEATURE_FLAG_IDS
} = require("./featureFlagIntegrationDesign");

const {
  createCapabilityRegistry,
  summarizeCapabilityRegistry,
  validateCapabilityRegistry
} = require("./runtimeCapabilityRegistry");

const {
  getRuntimeCapabilityRegistry
} = require("./runtimeCapabilityRegistryIntegration");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentActionPlan,
  peekRecruitmentPersistencePlan,
  peekRecruitmentPersistenceAdapterResult,
  summarizeRecruitmentActionPlan,
  summarizePersistencePlan,
  summarizePersistenceAdapterResult
} = require("./recruitmentCompatibilityLayer");

const {
  REVIEW_WORKFLOW_EVENTS,
  createReviewWorkflowItem,
  planReviewWorkflowTransition
} = require("./reviewWorkflow");

const {
  DIAGNOSTIC_STAGE_TYPES,
  DIAGNOSTIC_STAGE_STATUSES,
  TRACE_STATUSES,
  createExecutionTrace,
  appendExecutionStage,
  finalizeExecutionTrace,
  summarizeExecutionTrace
} = require("./executionDiagnostics");

const { resolveRecruitmentLifecycleEvent } = require("./recruitmentLifecycleEventResolver");

const { resolveRecruitmentLifecycleTransition } = require("./recruitmentLifecycleTransitionResolver");

const { validateRecruitmentWorkflow } = require("./recruitmentWorkflowValidator");

const { recommendRecruitmentWorkflowAction } = require("./recruitmentWorkflowRecommendationEngine");

const { buildRecruitmentWorkflowAdvisorySummary } = require("./recruitmentWorkflowAdvisorySummary");

const { buildRecruitmentWorkflowAdvisorySnapshot } = require("./recruitmentWorkflowAdvisorySnapshot");

const WORKFLOW_INTEGRATION_COORDINATOR_PHASE = 91;

const WORKFLOW_INTEGRATION_ENTITY = "recruitment_workflow_integration_result";

const WORKFLOW_INTEGRATION_FLAG_ID = "RECRUITMENT_WORKFLOW_INTEGRATION_ENABLED";

const INTEGRATION_STATES = Object.freeze({
  SHORT_CIRCUITED: "short_circuited",
  COORDINATED: "coordinated",
  PARTIAL: "partial",
  INELIGIBLE: "ineligible"
});

const SUPPORTED_INTEGRATION_STATES = Object.freeze(
  new Set(Object.values(INTEGRATION_STATES))
);

const COORDINATOR_REASONS = Object.freeze({
  FEATURE_DISABLED: "FEATURE_DISABLED",
  INVALID_CONTEXT: "INVALID_CONTEXT",
  COORDINATION_COMPLETE: "COORDINATION_COMPLETE",
  PARTIAL_INPUT: "PARTIAL_INPUT",
  WORKFLOW_INELIGIBLE: "WORKFLOW_INELIGIBLE"
});

const DEFAULT_WORKFLOW_FEATURE_FLAGS = Object.freeze({
  workflowIntegrationEnabled: false,
  pipelineEnabled: DEFAULT_FEATURE_FLAGS.pipelineEnabled,
  automaticPersistenceEnabled: DEFAULT_FEATURE_FLAGS.automaticPersistenceEnabled,
  reviewQueueEnqueueEnabled: DEFAULT_FEATURE_FLAGS.reviewQueueEnqueueEnabled
});

const WORKFLOW_INTEGRATION_METADATA = Object.freeze({
  phase: WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  pureOrchestration: true,
  readOnly: true,
  architectureOnly: true,
  observationOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  performsPersistence: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  readsEnvironmentVariables: false,
  routing: false
});

const WORKFLOW_INTEGRATION_DESCRIPTOR = Object.freeze({
  entity: WORKFLOW_INTEGRATION_ENTITY,
  domain: "recruitment",
  phase: WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  description:
    "Feature-flagged integration coordinator orchestrating recruitment workflow libraries.",
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
  integrationStates: Object.freeze(Object.values(INTEGRATION_STATES)),
  metadata: WORKFLOW_INTEGRATION_METADATA
});

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

function normalizeExecutionMode(value) {
  const normalized = normalizeString(value);
  if (normalized == null) {
    return EXECUTION_MODES.PREVIEW;
  }
  const lower = normalized.toLowerCase();
  if (
    lower === EXECUTION_MODES.PREVIEW ||
    lower === EXECUTION_MODES.DRY_RUN ||
    lower === EXECUTION_MODES.LIVE
  ) {
    return lower;
  }
  return EXECUTION_MODES.PREVIEW;
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * Resolve workflow integration feature flags from context.
 * Master gate defaults to disabled for production safety.
 *
 * @param {Object|null|undefined} flags
 * @returns {Readonly<Object>}
 */
function resolveWorkflowFeatureFlags(flags) {
  const source = isPlainObject(flags) ? flags : {};
  const base = resolveFeatureState(source);

  return deepFreeze({
    workflowIntegrationEnabled: asBool(
      source.workflowIntegrationEnabled,
      DEFAULT_WORKFLOW_FEATURE_FLAGS.workflowIntegrationEnabled
    ),
    pipelineEnabled: base.pipelineEnabled,
    automaticPersistenceEnabled: base.automaticPersistenceEnabled,
    reviewQueueEnqueueEnabled: base.reviewQueueEnqueueEnabled
  });
}

/**
 * Normalize coordinator context from caller input.
 *
 * @param {*} context
 * @returns {Readonly<Object>|null}
 */
function normalizeCoordinatorContext(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  const featureFlags = resolveWorkflowFeatureFlags(context.featureFlags);
  const processorResult = isPlainObject(context.processorResult)
    ? context.processorResult
    : isPlainObject(context.pipelineOutcome) && isPlainObject(context.pipelineOutcome.result)
      ? context.pipelineOutcome.result
      : null;

  return deepFreeze({
    featureFlags,
    executionMode: normalizeExecutionMode(context.executionMode),
    processorResult,
    pipelineOutcome: isPlainObject(context.pipelineOutcome) ? context.pipelineOutcome : null,
    normalizedUpdate: isPlainObject(context.normalizedUpdate) ? context.normalizedUpdate : null,
    correlationId: normalizeString(context.correlationId),
    traceId: normalizeString(context.traceId),
    pipelineRunId: normalizeString(context.pipelineRunId),
    contextId: normalizeString(context.contextId)
  });
}

function buildCapabilityDetection() {
  const registry = getRuntimeCapabilityRegistry();
  const validation = validateCapabilityRegistry(registry);
  const summary = summarizeCapabilityRegistry(registry);

  return deepFreeze({
    registryPhase: registry.phase,
    validationValid: validation.valid === true,
    validationReasons: Object.freeze(
      Array.isArray(validation.reasons) ? validation.reasons.slice() : []
    ),
    summary,
    totalCapabilities: summary.totalCapabilities,
    availableCount: summary.availableCount,
    wiredCount: summary.wiredCount,
    architectureOnly: true,
    observationOnly: true
  });
}

function buildFeatureFlagEvaluation(featureFlags, executionMode) {
  const enablement = evaluatePersistenceEnablement({
    executionMode,
    featureFlags: {
      pipelineEnabled: featureFlags.pipelineEnabled,
      automaticPersistenceEnabled: featureFlags.automaticPersistenceEnabled,
      reviewQueueEnqueueEnabled: featureFlags.reviewQueueEnqueueEnabled
    },
    capability: "both"
  });

  return deepFreeze({
    workflowIntegrationFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
    pipelineFlagId: FEATURE_FLAG_IDS.RECRUITMENT_PIPELINE,
    workflowIntegrationEnabled: featureFlags.workflowIntegrationEnabled === true,
    pipelineEnabled: featureFlags.pipelineEnabled === true,
    automaticPersistenceEnabled: featureFlags.automaticPersistenceEnabled === true,
    reviewQueueEnqueueEnabled: featureFlags.reviewQueueEnqueueEnabled === true,
    enablementAllowed: enablement.allowed === true,
    enablementBlocked: enablement.blocked === true,
    enablementReason: enablement.reason,
    enablementReasons: Object.freeze(
      Array.isArray(enablement.reasons) ? enablement.reasons.slice() : []
    ),
    featureState: deepFreeze({
      workflowIntegrationEnabled: featureFlags.workflowIntegrationEnabled === true,
      pipelineEnabled: featureFlags.pipelineEnabled === true,
      automaticPersistenceEnabled: featureFlags.automaticPersistenceEnabled === true,
      reviewQueueEnqueueEnabled: featureFlags.reviewQueueEnqueueEnabled === true
    }),
    architectureOnly: enablement.architectureOnly === true,
    executed: false,
    advisory: true
  });
}

function buildWorkflowEligibility(processorResult) {
  if (!isPlainObject(processorResult)) {
    return deepFreeze({
      eligible: false,
      status: ELIGIBILITY_STATUS.INELIGIBLE,
      reasons: Object.freeze(["MISSING_PROCESSOR_RESULT"]),
      confidence: null,
      eventType: null,
      candidateCount: 0,
      architectureOnly: true,
      observationOnly: true
    });
  }

  const eligibility = evaluateRecruitmentEligibility(processorResult);

  return deepFreeze({
    eligible: eligibility.eligible === true,
    status: eligibility.status,
    reasons: Object.freeze(
      Array.isArray(eligibility.reasons) ? eligibility.reasons.slice() : []
    ),
    confidence: eligibility.confidence,
    eventType: eligibility.eventType,
    candidateCount:
      typeof eligibility.candidateCount === "number" ? eligibility.candidateCount : 0,
    matchResult: eligibility.matchResult,
    lookupSummary: eligibility.lookupSummary,
    architectureOnly: true,
    observationOnly: true
  });
}

function buildReadOnlyPersistenceAdapter(normalizedContext) {
  const { pipelineOutcome, normalizedUpdate } = normalizedContext;

  if (!isPlainObject(pipelineOutcome)) {
    return deepFreeze({
      available: false,
      adapterState: null,
      connected: false,
      executed: false,
      queriesDatabase: false,
      summary: summarizePersistenceAdapterResult(null),
      reasons: Object.freeze(["MISSING_PIPELINE_OUTCOME"])
    });
  }

  try {
    attachRecruitmentCompatibility(pipelineOutcome, {
      normalizedUpdate: normalizedUpdate ?? undefined
    });
  } catch {
    return deepFreeze({
      available: false,
      adapterState: null,
      connected: false,
      executed: false,
      queriesDatabase: false,
      summary: summarizePersistenceAdapterResult(null),
      reasons: Object.freeze(["COMPATIBILITY_ATTACH_FAILED"])
    });
  }

  const adapterResult = peekRecruitmentPersistenceAdapterResult(pipelineOutcome);
  const summary = summarizePersistenceAdapterResult(adapterResult);

  return deepFreeze({
    available: adapterResult != null,
    adapterState: adapterResult?.adapterState ?? null,
    connected: false,
    executed: false,
    queriesDatabase: false,
    summary,
    reasons: Object.freeze(
      adapterResult == null ? ["ADAPTER_RESULT_UNAVAILABLE"] : ["ADAPTER_OBSERVED"]
    )
  });
}

function buildLifecycleResolutionContext(normalizedContext, eligibility) {
  const { processorResult, pipelineOutcome, normalizedUpdate } = normalizedContext;
  const notice = isPlainObject(normalizedUpdate) ? normalizedUpdate.notice : null;

  const pageMetadata = {};
  if (isPlainObject(processorResult)) {
    pageMetadata.title = processorResult.noticeTitle ?? processorResult.title ?? null;
    pageMetadata.content =
      processorResult.content ?? processorResult.noticeContent ?? processorResult.body ?? null;
    pageMetadata.url = processorResult.url ?? processorResult.noticeUrl ?? null;
    pageMetadata.eventType = processorResult.eventType ?? null;
  }
  if (isPlainObject(notice)) {
    pageMetadata.title = pageMetadata.title ?? notice.title ?? null;
    pageMetadata.content = pageMetadata.content ?? notice.content ?? null;
    pageMetadata.url = pageMetadata.url ?? notice.url ?? null;
  }

  const pipelineContext = isPlainObject(pipelineOutcome)
    ? {
        updateId: pipelineOutcome.updateId ?? null,
        skipped: pipelineOutcome.skipped === true,
        eventType: pipelineOutcome.eventType ?? null,
        lifecycleEvent: pipelineOutcome.lifecycleEvent ?? null,
        lifecycleCompleted: pipelineOutcome.lifecycleCompleted === true,
        recruitmentCompleted: pipelineOutcome.recruitmentCompleted === true,
        lifecycleStage: pipelineOutcome.lifecycleStage ?? null
      }
    : null;

  return {
    eventType: eligibility.eventType ?? processorResult?.eventType ?? null,
    pageMetadata,
    recruitmentMetadata: isPlainObject(processorResult?.selectedRecruitment)
      ? processorResult.selectedRecruitment
      : null,
    workflowContext: {
      eventType: eligibility.eventType ?? processorResult?.eventType ?? null,
      eligibility
    },
    pipelineContext,
    eligibility,
    processorResult: isPlainObject(processorResult) ? processorResult : null
  };
}

function buildLifecycleTransitionContext(normalizedContext, eligibility, lifecycleResolution) {
  const { pipelineOutcome } = normalizedContext;

  const pipelineContext = isPlainObject(pipelineOutcome)
    ? {
        updateId: pipelineOutcome.updateId ?? null,
        skipped: pipelineOutcome.skipped === true,
        eventType: pipelineOutcome.eventType ?? null,
        lifecycleEvent: pipelineOutcome.lifecycleEvent ?? null,
        lifecycleCompleted: pipelineOutcome.lifecycleCompleted === true,
        recruitmentCompleted: pipelineOutcome.recruitmentCompleted === true,
        lifecycleStage: pipelineOutcome.lifecycleStage ?? null
      }
    : null;

  return {
    lifecycleResolution,
    lifecycleEvent: lifecycleResolution?.lifecycleEvent ?? null,
    lifecycleConfidence: lifecycleResolution?.lifecycleConfidence ?? null,
    workflowContext: {
      eventType: eligibility.eventType ?? null,
      eligibility
    },
    pipelineContext
  };
}

function buildWorkflowValidationContext(
  normalizedContext,
  eligibility,
  lifecycleResolution,
  lifecycleTransitionResolution
) {
  const { pipelineOutcome } = normalizedContext;

  const pipelineContext = isPlainObject(pipelineOutcome)
    ? {
        updateId: pipelineOutcome.updateId ?? null,
        skipped: pipelineOutcome.skipped === true,
        eventType: pipelineOutcome.eventType ?? null,
        lifecycleEvent: pipelineOutcome.lifecycleEvent ?? null,
        lifecycleCompleted: pipelineOutcome.lifecycleCompleted === true,
        recruitmentCompleted: pipelineOutcome.recruitmentCompleted === true,
        lifecycleStage: pipelineOutcome.lifecycleStage ?? null,
        observedLifecycleEvents: Array.isArray(pipelineOutcome.observedLifecycleEvents)
          ? pipelineOutcome.observedLifecycleEvents.slice()
          : null,
        lifecycleEventHistory: Array.isArray(pipelineOutcome.lifecycleEventHistory)
          ? pipelineOutcome.lifecycleEventHistory.slice()
          : null
      }
    : null;

  return {
    lifecycleResolution,
    transitionResolution: lifecycleTransitionResolution,
    workflowContext: {
      eventType: eligibility.eventType ?? null,
      eligibility,
      observedLifecycleEvents: Array.isArray(pipelineOutcome?.observedLifecycleEvents)
        ? pipelineOutcome.observedLifecycleEvents.slice()
        : null,
      lifecycleEventHistory: Array.isArray(pipelineOutcome?.lifecycleEventHistory)
        ? pipelineOutcome.lifecycleEventHistory.slice()
        : null
    },
    eligibility,
    pipelineContext
  };
}

function buildWorkflowAdvisorySnapshotContext(
  normalizedContext,
  eligibility,
  lifecycleResolution,
  lifecycleTransitionResolution,
  workflowValidation,
  workflowRecommendation,
  workflowAdvisorySummary
) {
  return {
    lifecycleResolution,
    transitionResolution: lifecycleTransitionResolution,
    workflowValidation,
    workflowRecommendation,
    workflowAdvisorySummary,
    featureFlags: normalizedContext.featureFlags,
    workflowContext: {
      eventType: eligibility.eventType ?? null,
      eligibility
    },
    eligibility
  };
}

function buildWorkflowAdvisorySummaryContext(
  normalizedContext,
  eligibility,
  lifecycleResolution,
  lifecycleTransitionResolution,
  workflowValidation,
  workflowRecommendation
) {
  const { pipelineOutcome } = normalizedContext;

  const pipelineContext = isPlainObject(pipelineOutcome)
    ? {
        updateId: pipelineOutcome.updateId ?? null,
        skipped: pipelineOutcome.skipped === true,
        eventType: pipelineOutcome.eventType ?? null,
        lifecycleEvent: pipelineOutcome.lifecycleEvent ?? null,
        lifecycleCompleted: pipelineOutcome.lifecycleCompleted === true,
        recruitmentCompleted: pipelineOutcome.recruitmentCompleted === true,
        lifecycleStage: pipelineOutcome.lifecycleStage ?? null
      }
    : null;

  return {
    lifecycleResolution,
    transitionResolution: lifecycleTransitionResolution,
    workflowValidation,
    workflowRecommendation,
    workflowContext: {
      eventType: eligibility.eventType ?? null,
      eligibility
    },
    eligibility,
    pipelineContext
  };
}

function buildWorkflowRecommendationContext(
  normalizedContext,
  eligibility,
  lifecycleResolution,
  lifecycleTransitionResolution,
  workflowValidation
) {
  const { pipelineOutcome } = normalizedContext;

  const pipelineContext = isPlainObject(pipelineOutcome)
    ? {
        updateId: pipelineOutcome.updateId ?? null,
        skipped: pipelineOutcome.skipped === true,
        eventType: pipelineOutcome.eventType ?? null,
        lifecycleEvent: pipelineOutcome.lifecycleEvent ?? null,
        lifecycleCompleted: pipelineOutcome.lifecycleCompleted === true,
        recruitmentCompleted: pipelineOutcome.recruitmentCompleted === true,
        lifecycleStage: pipelineOutcome.lifecycleStage ?? null
      }
    : null;

  return {
    lifecycleResolution,
    transitionResolution: lifecycleTransitionResolution,
    workflowValidation,
    workflowContext: {
      eventType: eligibility.eventType ?? null,
      eligibility
    },
    eligibility,
    pipelineContext
  };
}

function buildPlannedWorkflow(
  normalizedContext,
  eligibility,
  lifecycleResolution,
  lifecycleTransitionResolution,
  workflowValidation,
  workflowRecommendation,
  workflowAdvisorySummary,
  workflowAdvisorySnapshot
) {
  const { pipelineOutcome, processorResult } = normalizedContext;
  const actionPlan =
    isPlainObject(pipelineOutcome) ? peekRecruitmentActionPlan(pipelineOutcome) : null;
  const persistencePlan =
    isPlainObject(pipelineOutcome) ? peekRecruitmentPersistencePlan(pipelineOutcome) : null;

  let reviewWorkflowTransition = null;
  if (isPlainObject(processorResult)) {
    const reviewItem = processorResult.reviewItem;
    const workflowInput = isPlainObject(reviewItem)
      ? reviewItem
      : {
          title:
            processorResult.noticeTitle ??
            processorResult.title ??
            "Recruitment update",
          eventType: eligibility.eventType,
          recruitmentId: processorResult.recruitmentId ?? null,
          matchResult: eligibility.matchResult,
          confidence: eligibility.confidence
        };

    const workflowItem = createReviewWorkflowItem(workflowInput);
    reviewWorkflowTransition = planReviewWorkflowTransition(
      workflowItem,
      REVIEW_WORKFLOW_EVENTS.START_REVIEW
    );
  }

  const resolvedLifecycle =
    lifecycleResolution ??
    resolveRecruitmentLifecycleEvent(
      buildLifecycleResolutionContext(normalizedContext, eligibility)
    );

  const resolvedTransition =
    lifecycleTransitionResolution ??
    resolveRecruitmentLifecycleTransition(
      buildLifecycleTransitionContext(normalizedContext, eligibility, resolvedLifecycle)
    );

  const resolvedValidation =
    workflowValidation ??
    validateRecruitmentWorkflow(
      buildWorkflowValidationContext(
        normalizedContext,
        eligibility,
        resolvedLifecycle,
        resolvedTransition
      )
    );

  const resolvedRecommendation =
    workflowRecommendation ??
    recommendRecruitmentWorkflowAction(
      buildWorkflowRecommendationContext(
        normalizedContext,
        eligibility,
        resolvedLifecycle,
        resolvedTransition,
        resolvedValidation
      )
    );

  const resolvedAdvisorySummary =
    workflowAdvisorySummary ??
    buildRecruitmentWorkflowAdvisorySummary(
      buildWorkflowAdvisorySummaryContext(
        normalizedContext,
        eligibility,
        resolvedLifecycle,
        resolvedTransition,
        resolvedValidation,
        resolvedRecommendation
      )
    );

  const resolvedAdvisorySnapshot =
    workflowAdvisorySnapshot ??
    buildRecruitmentWorkflowAdvisorySnapshot(
      buildWorkflowAdvisorySnapshotContext(
        normalizedContext,
        eligibility,
        resolvedLifecycle,
        resolvedTransition,
        resolvedValidation,
        resolvedRecommendation,
        resolvedAdvisorySummary
      )
    );

  return deepFreeze({
    actionPlanSummary: summarizeRecruitmentActionPlan(actionPlan),
    persistencePlanSummary: summarizePersistencePlan(persistencePlan),
    reviewWorkflowTransition,
    lifecycleEvent: resolvedLifecycle.lifecycleEvent,
    lifecycleConfidence: resolvedLifecycle.lifecycleConfidence,
    resolutionReason: resolvedLifecycle.resolutionReason,
    currentLifecycleEvent: resolvedTransition.currentLifecycleEvent,
    nextAllowedEvents: resolvedTransition.nextAllowedEvents,
    workflowCompleted: resolvedTransition.workflowCompleted,
    terminalState: resolvedTransition.terminalState,
    transitionConfidence: resolvedTransition.transitionConfidence,
    workflowValid: resolvedValidation.workflowValid,
    workflowCompleteness: resolvedValidation.workflowCompleteness,
    detectedAnomalies: resolvedValidation.detectedAnomalies,
    validationConfidence: resolvedValidation.validationConfidence,
    validationReason: resolvedValidation.validationReason,
    recommendedAction: resolvedRecommendation.recommendedAction,
    recommendedNextEvents: resolvedRecommendation.recommendedNextEvents,
    recommendationPriority: resolvedRecommendation.recommendationPriority,
    recommendationConfidence: resolvedRecommendation.recommendationConfidence,
    monitoringRequired: resolvedRecommendation.monitoringRequired,
    workflowTerminal: resolvedRecommendation.workflowTerminal,
    workflowAdvisorySummary: resolvedAdvisorySummary,
    workflowAdvisorySnapshot: resolvedAdvisorySnapshot,
    architectureOnly: true,
    executed: false,
    advisory: true
  });
}

function appendCoordinatorStage(trace, stageType, message, detail, status) {
  const result = appendExecutionStage(trace, {
    stageType,
    status: status ?? DIAGNOSTIC_STAGE_STATUSES.RECORDED,
    message,
    detail: isPlainObject(detail) ? detail : {},
    reasons: []
  });
  return result.trace;
}

function buildDiagnostics(normalizedContext, stages) {
  let trace = createExecutionTrace({
    traceId: normalizedContext.traceId,
    correlationId: normalizedContext.correlationId,
    pipelineRunId: normalizedContext.pipelineRunId,
    contextId: normalizedContext.contextId,
    metadata: {
      coordinatorPhase: WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
      observationOnly: true,
      architectureOnly: true
    }
  });

  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    trace = appendCoordinatorStage(
      trace,
      stage.stageType,
      stage.message,
      stage.detail,
      stage.status
    );
  }

  const finalized = finalizeExecutionTrace(trace, {
    appendCompleted: true,
    message: "Workflow integration coordination complete"
  });

  const finalTrace = finalized.trace;
  const summary = summarizeExecutionTrace(finalTrace);

  return deepFreeze({
    trace: deepFreeze({
      traceId: finalTrace.traceId,
      correlationId: finalTrace.correlationId,
      pipelineRunId: finalTrace.pipelineRunId,
      contextId: finalTrace.contextId,
      status: finalTrace.status,
      stageCount: Array.isArray(finalTrace.stages) ? finalTrace.stages.length : 0,
      architectureOnly: finalTrace.architectureOnly === true,
      executed: false,
      advisory: true
    }),
    summary,
    architectureOnly: true,
    observationOnly: true
  });
}

function buildIntegrationState(status, reason, extras) {
  return deepFreeze({
    status,
    phase: WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
    entity: WORKFLOW_INTEGRATION_ENTITY,
    reason,
    observationOnly: true,
    executed: false,
    persistenceEnabled: false,
    sideEffects: false,
    mutatesProduction: false,
    ...(isPlainObject(extras) ? extras : {})
  });
}

function buildShortCircuitResult(normalizedContext, reason) {
  const featureFlags = normalizedContext?.featureFlags ?? resolveWorkflowFeatureFlags(null);
  const capabilityRegistry = createCapabilityRegistry();
  const capabilities = deepFreeze({
    detection: buildCapabilityDetection(),
    catalogRegistry: summarizeCapabilityRegistry(capabilityRegistry),
    architectureOnly: true,
    observationOnly: true
  });

  const diagnostics = buildDiagnostics(normalizedContext ?? {}, [
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
      message: "Workflow integration coordinator invoked",
      detail: { shortCircuited: true },
      status: DIAGNOSTIC_STAGE_STATUSES.SKIPPED
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.ENABLEMENT,
      message: "Workflow integration feature flag disabled — short-circuit",
      detail: {
        workflowIntegrationEnabled: false,
        reason: reason ?? COORDINATOR_REASONS.FEATURE_DISABLED
      },
      status: DIAGNOSTIC_STAGE_STATUSES.BLOCKED
    }
  ]);

  return deepFreeze({
    featureEnabled: false,
    workflowEligible: false,
    capabilities,
    diagnostics,
    plannedWorkflow: null,
    integrationState: buildIntegrationState(
      INTEGRATION_STATES.SHORT_CIRCUITED,
      reason ?? COORDINATOR_REASONS.FEATURE_DISABLED,
      {
        workflowIntegrationEnabled: false,
        pipelineEnabled: featureFlags.pipelineEnabled === true
      }
    ),
    metadata: deepFreeze({
      ...WORKFLOW_INTEGRATION_METADATA,
      shortCircuited: true,
      coordinationComplete: false,
      featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID
    })
  });
}

function resolveIntegrationStatus(eligibility, adapterObservation) {
  if (eligibility.eligible !== true) {
    return eligibility.status === ELIGIBILITY_STATUS.INELIGIBLE
      ? INTEGRATION_STATES.INELIGIBLE
      : INTEGRATION_STATES.PARTIAL;
  }
  if (adapterObservation.available !== true) {
    return INTEGRATION_STATES.PARTIAL;
  }
  return INTEGRATION_STATES.COORDINATED;
}

/**
 * Orchestrate recruitment workflow integration across Phase 20–90 libraries.
 * Pure advisory coordination — no production side effects.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function coordinateRecruitmentWorkflowIntegration(context) {
  const normalizedContext = normalizeCoordinatorContext(context);

  if (normalizedContext == null) {
    return buildShortCircuitResult(null, COORDINATOR_REASONS.INVALID_CONTEXT);
  }

  if (normalizedContext.featureFlags.workflowIntegrationEnabled !== true) {
    return buildShortCircuitResult(normalizedContext, COORDINATOR_REASONS.FEATURE_DISABLED);
  }

  const capabilities = deepFreeze({
    detection: buildCapabilityDetection(),
    architectureOnly: true,
    observationOnly: true
  });

  const featureEvaluation = buildFeatureFlagEvaluation(
    normalizedContext.featureFlags,
    normalizedContext.executionMode
  );

  const eligibility = buildWorkflowEligibility(normalizedContext.processorResult);
  const adapterObservation = buildReadOnlyPersistenceAdapter(normalizedContext);
  const lifecycleResolution = resolveRecruitmentLifecycleEvent(
    buildLifecycleResolutionContext(normalizedContext, eligibility)
  );
  const lifecycleTransitionResolution = resolveRecruitmentLifecycleTransition(
    buildLifecycleTransitionContext(normalizedContext, eligibility, lifecycleResolution)
  );
  const workflowValidation = validateRecruitmentWorkflow(
    buildWorkflowValidationContext(
      normalizedContext,
      eligibility,
      lifecycleResolution,
      lifecycleTransitionResolution
    )
  );
  const workflowRecommendation = recommendRecruitmentWorkflowAction(
    buildWorkflowRecommendationContext(
      normalizedContext,
      eligibility,
      lifecycleResolution,
      lifecycleTransitionResolution,
      workflowValidation
    )
  );
  const workflowAdvisorySummary = buildRecruitmentWorkflowAdvisorySummary(
    buildWorkflowAdvisorySummaryContext(
      normalizedContext,
      eligibility,
      lifecycleResolution,
      lifecycleTransitionResolution,
      workflowValidation,
      workflowRecommendation
    )
  );
  const workflowAdvisorySnapshot = buildRecruitmentWorkflowAdvisorySnapshot(
    buildWorkflowAdvisorySnapshotContext(
      normalizedContext,
      eligibility,
      lifecycleResolution,
      lifecycleTransitionResolution,
      workflowValidation,
      workflowRecommendation,
      workflowAdvisorySummary
    )
  );
  const plannedWorkflow = buildPlannedWorkflow(
    normalizedContext,
    eligibility,
    lifecycleResolution,
    lifecycleTransitionResolution,
    workflowValidation,
    workflowRecommendation,
    workflowAdvisorySummary,
    workflowAdvisorySnapshot
  );

  const diagnostics = buildDiagnostics(normalizedContext, [
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.CONTEXT,
      message: "Runtime capability detection",
      detail: {
        totalCapabilities: capabilities.detection.totalCapabilities,
        availableCount: capabilities.detection.availableCount,
        wiredCount: capabilities.detection.wiredCount
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.ENABLEMENT,
      message: "Feature flag evaluation",
      detail: {
        workflowIntegrationEnabled: featureEvaluation.workflowIntegrationEnabled,
        pipelineEnabled: featureEvaluation.pipelineEnabled,
        enablementAllowed: featureEvaluation.enablementAllowed,
        enablementReason: featureEvaluation.enablementReason
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Workflow eligibility evaluation",
      detail: {
        eligible: eligibility.eligible,
        status: eligibility.status,
        reasonCount: eligibility.reasons.length
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.ADAPTER,
      message: "Read-only persistence adapter observation",
      detail: {
        available: adapterObservation.available,
        adapterState: adapterObservation.adapterState,
        connected: false,
        executed: false,
        queriesDatabase: false
      },
      status:
        adapterObservation.available === true
          ? DIAGNOSTIC_STAGE_STATUSES.RECORDED
          : DIAGNOSTIC_STAGE_STATUSES.SKIPPED
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Lifecycle event resolution",
      detail: {
        lifecycleEvent: lifecycleResolution.lifecycleEvent,
        lifecycleConfidence: lifecycleResolution.lifecycleConfidence,
        resolutionReason: lifecycleResolution.resolutionReason,
        advisory: true,
        architectureOnly: true,
        executed: false
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Lifecycle transition resolution",
      detail: {
        currentLifecycleEvent: lifecycleTransitionResolution.currentLifecycleEvent,
        nextAllowedEvents: lifecycleTransitionResolution.nextAllowedEvents,
        workflowCompleted: lifecycleTransitionResolution.workflowCompleted,
        terminalState: lifecycleTransitionResolution.terminalState,
        transitionConfidence: lifecycleTransitionResolution.transitionConfidence,
        transitionReason: lifecycleTransitionResolution.transitionReason,
        advisory: true,
        architectureOnly: true,
        executed: false
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Workflow validation",
      detail: {
        workflowValid: workflowValidation.workflowValid,
        workflowCompleteness: workflowValidation.workflowCompleteness,
        validationConfidence: workflowValidation.validationConfidence,
        validationReason: workflowValidation.validationReason,
        anomalyCount: workflowValidation.detectedAnomalies.length,
        advisory: true,
        architectureOnly: true,
        executed: false
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Workflow recommendation",
      detail: {
        recommendedAction: workflowRecommendation.recommendedAction,
        recommendedNextEvents: workflowRecommendation.recommendedNextEvents,
        recommendationPriority: workflowRecommendation.recommendationPriority,
        recommendationConfidence: workflowRecommendation.recommendationConfidence,
        recommendationReason: workflowRecommendation.recommendationReason,
        monitoringRequired: workflowRecommendation.monitoringRequired,
        workflowTerminal: workflowRecommendation.workflowTerminal,
        advisory: true,
        architectureOnly: true,
        executed: false
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Workflow advisory summary",
      detail: {
        currentLifecycle: workflowAdvisorySummary.currentLifecycle,
        overallHealth: workflowAdvisorySummary.overallHealth,
        overallConfidence: workflowAdvisorySummary.overallConfidence,
        workflowValid: workflowAdvisorySummary.workflowValid,
        anomalyCount: workflowAdvisorySummary.anomalyCount,
        recommendedAction: workflowAdvisorySummary.recommendedAction,
        monitoringRequired: workflowAdvisorySummary.monitoringRequired,
        advisory: true,
        architectureOnly: true,
        executed: false
      }
    },
    {
      stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
      message: "Workflow advisory snapshot",
      detail: {
        version: workflowAdvisorySnapshot.version,
        schemaVersion: workflowAdvisorySnapshot.metadata.schemaVersion,
        snapshotComplete: workflowAdvisorySnapshot.metadata.snapshotComplete,
        generatedAt: workflowAdvisorySnapshot.generatedAt,
        advisory: true,
        architectureOnly: true,
        executed: false
      }
    }
  ]);

  const workflowEligible = eligibility.eligible === true;
  const integrationStatus = resolveIntegrationStatus(eligibility, adapterObservation);
  const coordinationReason =
    integrationStatus === INTEGRATION_STATES.COORDINATED
      ? COORDINATOR_REASONS.COORDINATION_COMPLETE
      : integrationStatus === INTEGRATION_STATES.INELIGIBLE
        ? COORDINATOR_REASONS.WORKFLOW_INELIGIBLE
        : COORDINATOR_REASONS.PARTIAL_INPUT;

  return deepFreeze({
    featureEnabled: true,
    workflowEligible,
    capabilities,
    diagnostics,
    plannedWorkflow,
    integrationState: buildIntegrationState(integrationStatus, coordinationReason, {
      workflowIntegrationEnabled: true,
      pipelineEnabled: featureEvaluation.pipelineEnabled,
      enablementAllowed: featureEvaluation.enablementAllowed,
      eligibilityStatus: eligibility.status,
      adapterAvailable: adapterObservation.available === true
    }),
    metadata: deepFreeze({
      ...WORKFLOW_INTEGRATION_METADATA,
      shortCircuited: false,
      coordinationComplete: true,
      featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
      executionMode: normalizedContext.executionMode,
      enablementReason: featureEvaluation.enablementReason
    })
  });
}

module.exports = {
  WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  WORKFLOW_INTEGRATION_ENTITY,
  WORKFLOW_INTEGRATION_FLAG_ID,
  INTEGRATION_STATES,
  SUPPORTED_INTEGRATION_STATES,
  COORDINATOR_REASONS,
  DEFAULT_WORKFLOW_FEATURE_FLAGS,
  WORKFLOW_INTEGRATION_METADATA,
  WORKFLOW_INTEGRATION_DESCRIPTOR,
  coordinateRecruitmentWorkflowIntegration
};
