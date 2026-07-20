"use strict";

/**
 * Phase 92 — Recruitment Pipeline Integration Hook.
 *
 * Feature-flagged, advisory-only hook that invokes the Phase 91 workflow
 * integration coordinator from inside the recruitment pipeline via the Phase 94
 * observation registry. Observations are stored in internal WeakMaps only —
 * public pipeline outcomes are never mutated.
 *
 * No Express. No database. No filesystem. No network access.
 * No routing changes. No worker changes. No persistence execution.
 */

const {
  WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  WORKFLOW_INTEGRATION_FLAG_ID,
  coordinateRecruitmentWorkflowIntegration
} = require("./recruitmentWorkflowIntegrationCoordinator");

const { peekRecruitmentCompatibility } = require("./recruitmentCompatibilityLayer");

const {
  getOrCreateWorkflowObservation,
  peekWorkflowDiagnostics
} = require("./recruitmentWorkflowObservationRegistry");

const {
  DIAGNOSTIC_STAGE_TYPES,
  DIAGNOSTIC_STAGE_STATUSES,
  createExecutionTrace,
  appendExecutionStage,
  finalizeExecutionTrace,
  summarizeExecutionTrace
} = require("./executionDiagnostics");

const PIPELINE_INTEGRATION_HOOK_PHASE = 92;

const PIPELINE_INTEGRATION_ENTITY = "recruitment_pipeline_integration_hook";

const PIPELINE_INTEGRATION_METADATA = Object.freeze({
  phase: PIPELINE_INTEGRATION_HOOK_PHASE,
  coordinatorPhase: WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
  advisoryOnly: true,
  observationOnly: true,
  architectureOnly: true,
  runtimeIntegration: true,
  persistenceEnabled: false,
  performsPersistence: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesProduction: false,
  readsEnvironmentVariables: false,
  routing: false,
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID
});

const PIPELINE_INTEGRATION_DESCRIPTOR = Object.freeze({
  entity: PIPELINE_INTEGRATION_ENTITY,
  domain: "recruitment",
  phase: PIPELINE_INTEGRATION_HOOK_PHASE,
  description:
    "Advisory pipeline hook invoking the Phase 91 workflow integration coordinator.",
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
  metadata: PIPELINE_INTEGRATION_METADATA
});

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const integrationByPipelineOutcome = new WeakMap();

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const diagnosticsByPipelineOutcome = new WeakMap();

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
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
 * @param {Object|null|undefined} featureFlags
 * @returns {boolean}
 */
function isWorkflowIntegrationFlagEnabled(featureFlags) {
  return isPlainObject(featureFlags) && featureFlags.workflowIntegrationEnabled === true;
}

/**
 * @param {Object|null|undefined} pipelineOutcome
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function buildIntegrationCoordinatorContext(pipelineOutcome, input) {
  const source = isPlainObject(input) ? input : {};
  const compatibility = peekRecruitmentCompatibility(pipelineOutcome);

  return {
    featureFlags: source.featureFlags,
    executionMode: source.executionMode,
    pipelineOutcome,
    processorResult: isPlainObject(pipelineOutcome) && isPlainObject(pipelineOutcome.result)
      ? pipelineOutcome.result
      : null,
    normalizedUpdate: compatibility?.normalizedUpdate ?? null,
    correlationId: source.correlationId,
    traceId: source.traceId,
    pipelineRunId: source.pipelineRunId,
    contextId:
      source.contextId ??
      (source.updateId != null && source.updateId !== "" ? String(source.updateId) : null)
  };
}

/**
 * @param {Object|null|undefined} existingDiagnostics
 * @param {Readonly<Object>} integrationResult
 * @param {Object} coordinatorContext
 * @returns {Readonly<Object>}
 */
function buildPipelineDiagnostics(existingDiagnostics, integrationResult, coordinatorContext) {
  const existingTrace = existingDiagnostics?.fullTrace;

  if (!isPlainObject(existingTrace)) {
    return deepFreeze({
      ...integrationResult.diagnostics,
      source: "coordinator",
      appendedIntegrationStage: false
    });
  }

  const appendResult = appendExecutionStage(existingTrace, {
    stageType: DIAGNOSTIC_STAGE_TYPES.COMPLETED,
    status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
    message: "Workflow integration coordination (advisory)",
    detail: {
      hookPhase: PIPELINE_INTEGRATION_HOOK_PHASE,
      coordinatorPhase: WORKFLOW_INTEGRATION_COORDINATOR_PHASE,
      featureEnabled: integrationResult.featureEnabled === true,
      integrationState: integrationResult.integrationState?.status ?? null,
      workflowEligible: integrationResult.workflowEligible === true
    }
  });

  if (appendResult.success !== true) {
    return deepFreeze({
      ...integrationResult.diagnostics,
      source: "coordinator",
      appendedIntegrationStage: false,
      appendFailureReasons: Object.freeze(
        Array.isArray(appendResult.reasons) ? appendResult.reasons.slice() : []
      )
    });
  }

  const finalized = finalizeExecutionTrace(appendResult.trace, {
    appendCompleted: false
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
    fullTrace: finalTrace,
    architectureOnly: true,
    observationOnly: true,
    source: "appended",
    appendedIntegrationStage: true,
    coordinatorContext: deepFreeze({
      traceId: coordinatorContext.traceId ?? null,
      correlationId: coordinatorContext.correlationId ?? null,
      pipelineRunId: coordinatorContext.pipelineRunId ?? null,
      contextId: coordinatorContext.contextId ?? null
    })
  });
}

/**
 * Attach advisory pipeline diagnostics without mutating public pipeline fields.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @param {Object|null|undefined} diagnostics
 * @returns {Readonly<Object>|null}
 */
function attachRecruitmentPipelineDiagnostics(pipelineOutcome, diagnostics) {
  if (!isPlainObject(pipelineOutcome) || !isPlainObject(diagnostics)) {
    return null;
  }

  const stored = deepFreeze({
    ...diagnostics,
    architectureOnly: true,
    observationOnly: true
  });
  diagnosticsByPipelineOutcome.set(pipelineOutcome, stored);
  return stored;
}

/**
 * Read advisory pipeline diagnostics for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentPipelineDiagnostics(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const diagnostics = diagnosticsByPipelineOutcome.get(pipelineOutcome);
  return diagnostics == null ? null : diagnostics;
}

/**
 * Read advisory workflow integration result for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentWorkflowIntegration(pipelineOutcome) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }
  const integration = integrationByPipelineOutcome.get(pipelineOutcome);
  return integration == null ? null : integration;
}

/**
 * Invoke Phase 91 coordinator from the pipeline when the master flag is enabled.
 * Never throws. Never mutates public pipeline outcome fields.
 *
 * @param {Object|null|undefined} pipelineOutcome
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>|null}
 */
function attachRecruitmentWorkflowIntegration(pipelineOutcome, input) {
  if (!isPlainObject(pipelineOutcome)) {
    return null;
  }

  const source = isPlainObject(input) ? input : {};
  if (!isWorkflowIntegrationFlagEnabled(source.featureFlags)) {
    return null;
  }

  try {
    const coordinatorContext = buildIntegrationCoordinatorContext(pipelineOutcome, source);
    const integrationResult = getOrCreateWorkflowObservation(pipelineOutcome, () =>
      coordinateRecruitmentWorkflowIntegration(coordinatorContext)
    );
    if (integrationResult == null) {
      return null;
    }
    const existingDiagnostics =
      peekRecruitmentPipelineDiagnostics(pipelineOutcome) ??
      peekWorkflowDiagnostics(pipelineOutcome);
    const pipelineDiagnostics = buildPipelineDiagnostics(
      existingDiagnostics,
      integrationResult,
      coordinatorContext
    );

    diagnosticsByPipelineOutcome.set(pipelineOutcome, pipelineDiagnostics);
    integrationByPipelineOutcome.set(
      pipelineOutcome,
      deepFreeze({
        integrationResult,
        diagnostics: pipelineDiagnostics,
        metadata: PIPELINE_INTEGRATION_METADATA,
        observationOnly: true,
        advisoryOnly: true
      })
    );

    return integrationResult;
  } catch {
    return null;
  }
}

module.exports = {
  PIPELINE_INTEGRATION_HOOK_PHASE,
  PIPELINE_INTEGRATION_ENTITY,
  PIPELINE_INTEGRATION_METADATA,
  PIPELINE_INTEGRATION_DESCRIPTOR,
  isWorkflowIntegrationFlagEnabled,
  buildIntegrationCoordinatorContext,
  attachRecruitmentPipelineDiagnostics,
  peekRecruitmentPipelineDiagnostics,
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
};
