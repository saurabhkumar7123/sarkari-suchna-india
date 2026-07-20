"use strict";

/**
 * Phase 104 — Recruitment Workflow Advisory Diagnostics Attachment (Feature-Flagged, Read-Only).
 *
 * Integrates Phase 101 snapshot consumption, Phase 102 observation views, and Phase 103
 * observation diagnostics into the existing execution diagnostics flow. Consumes existing
 * advisory information only — no coordinator invocation, no snapshot rebuild, and no
 * business analysis.
 *
 * Diagnostics are stored in an internal WeakMap keyed by pipeline outcome. Public pipeline
 * outcomes and existing execution diagnostics WeakMaps are never mutated.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const { getRecruitmentWorkflowSnapshot } = require("./recruitmentWorkflowSnapshotAdapter");
const {
  buildRecruitmentWorkflowObservationView
} = require("./recruitmentWorkflowObservationView");
const {
  buildRecruitmentWorkflowObservationDiagnostics,
  isRecruitmentWorkflowObservationDiagnostics,
  summarizeRecruitmentWorkflowObservationDiagnostics
} = require("./recruitmentWorkflowObservationDiagnosticsAdapter");

const { peekWorkflowObservation, peekWorkflowDiagnostics } = require(
  "./recruitmentWorkflowObservationRegistry"
);

const {
  peekRecruitmentWorkflowIntegration,
  peekRecruitmentPipelineDiagnostics
} = require("./recruitmentPipelineIntegrationHook");

const {
  peekRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityDiagnostics
} = require("./recruitmentCompatibilityIntegrationHook");

const {
  WORKFLOW_INTEGRATION_FLAG_ID
} = require("./recruitmentWorkflowIntegrationCoordinator");

const {
  DIAGNOSTIC_STAGE_TYPES,
  DIAGNOSTIC_STAGE_STATUSES,
  appendExecutionStage,
  finalizeExecutionTrace,
  summarizeExecutionTrace
} = require("./executionDiagnostics");

const RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE = 104;

const RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_ENTITY =
  "recruitment_workflow_diagnostics_attachment";

const RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  diagnosticsOnly: true,
  attachmentOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  observationOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  recomputesBusinessLogic: false,
  rebuildsSnapshots: false,
  rebuildsObservationViews: false,
  invokesCoordinator: false,
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID
});

const RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE,
  description:
    "Feature-flagged read-only attachment of Phase 103 observation diagnostics to pipeline outcomes.",
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
  metadata: RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA
});

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const workflowDiagnosticsAttachmentByOutcome = new WeakMap();

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
 * Resolve whether workflowIntegrationEnabled was active for an outcome.
 * Does not invoke coordinators or hooks.
 *
 * @param {Object} outcome
 * @returns {boolean}
 */
function resolveWorkflowIntegrationEnabled(outcome) {
  const snapshot = getRecruitmentWorkflowSnapshot(outcome);
  if (snapshot != null) {
    const metadata = isPlainObject(snapshot.metadata) ? snapshot.metadata : null;
    const flagState =
      metadata != null && isPlainObject(metadata.featureFlagState)
        ? metadata.featureFlagState
        : null;
    if (flagState != null) {
      return flagState.workflowIntegrationEnabled === true;
    }
  }

  const registryObservation = peekWorkflowObservation(outcome);
  if (isPlainObject(registryObservation)) {
    if (registryObservation.featureEnabled === true) {
      return true;
    }
    if (registryObservation.featureEnabled === false) {
      return false;
    }
  }

  const pipelineIntegration = peekRecruitmentWorkflowIntegration(outcome);
  if (
    isPlainObject(pipelineIntegration) &&
    isPlainObject(pipelineIntegration.integrationResult)
  ) {
    if (pipelineIntegration.integrationResult.featureEnabled === true) {
      return true;
    }
    if (pipelineIntegration.integrationResult.featureEnabled === false) {
      return false;
    }
  }

  const compatibilityIntegration = peekRecruitmentCompatibilityIntegration(outcome);
  if (
    isPlainObject(compatibilityIntegration) &&
    isPlainObject(compatibilityIntegration.integrationResult)
  ) {
    if (compatibilityIntegration.integrationResult.featureEnabled === true) {
      return true;
    }
    if (compatibilityIntegration.integrationResult.featureEnabled === false) {
      return false;
    }
  }

  return false;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekExistingExecutionDiagnostics(outcome) {
  return (
    peekRecruitmentPipelineDiagnostics(outcome) ??
    peekRecruitmentCompatibilityDiagnostics(outcome) ??
    peekWorkflowDiagnostics(outcome)
  );
}

/**
 * Additively extend execution diagnostics with Phase 103 observation diagnostics.
 * Never mutates existing diagnostics WeakMaps or their stored traces.
 *
 * @param {Object|null|undefined} existingDiagnostics
 * @param {Readonly<Object>} observationDiagnostics
 * @returns {Readonly<Object>}
 */
function buildExecutionDiagnosticsExtension(existingDiagnostics, observationDiagnostics) {
  const diagnosticsSummary =
    summarizeRecruitmentWorkflowObservationDiagnostics(observationDiagnostics);
  const existingTrace = existingDiagnostics?.fullTrace;

  if (!isPlainObject(existingTrace)) {
    return deepFreeze({
      observationDiagnostics: diagnosticsSummary,
      source: "phase_103_projection",
      appendedObservationDiagnosticsStage: false,
      architectureOnly: true,
      observationOnly: true,
      advisoryOnly: true
    });
  }

  const appendResult = appendExecutionStage(existingTrace, {
    stageType: DIAGNOSTIC_STAGE_TYPES.REVIEW,
    status: DIAGNOSTIC_STAGE_STATUSES.RECORDED,
    message: "Workflow observation diagnostics (advisory)",
    detail: deepFreeze({
      attachmentPhase: RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE,
      severity: diagnosticsSummary.severity,
      lifecycle: diagnosticsSummary.lifecycle,
      health: diagnosticsSummary.health,
      recommendation: diagnosticsSummary.recommendation,
      advisory: true,
      architectureOnly: true,
      executed: false
    })
  });

  if (appendResult.success !== true) {
    return deepFreeze({
      observationDiagnostics: diagnosticsSummary,
      source: "phase_103_projection",
      appendedObservationDiagnosticsStage: false,
      appendFailureReasons: Object.freeze(
        Array.isArray(appendResult.reasons) ? appendResult.reasons.slice() : []
      ),
      architectureOnly: true,
      observationOnly: true,
      advisoryOnly: true
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
    observationDiagnostics: diagnosticsSummary,
    architectureOnly: true,
    observationOnly: true,
    advisoryOnly: true,
    source: "appended_observation_diagnostics",
    appendedObservationDiagnosticsStage: true
  });
}

/**
 * @param {Object} outcome
 * @param {Readonly<Object>} observationDiagnostics
 * @returns {Readonly<Object>}
 */
function buildDiagnosticsAttachment(outcome, observationDiagnostics) {
  const existingDiagnostics = peekExistingExecutionDiagnostics(outcome);
  const executionExtension = buildExecutionDiagnosticsExtension(
    existingDiagnostics,
    observationDiagnostics
  );

  return deepFreeze({
    observationDiagnostics,
    diagnostics: observationDiagnostics,
    executionDiagnostics: executionExtension,
    metadata: deepFreeze({
      phase: RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE,
      advisoryOnly: true,
      architectureOnly: true,
      observationOnly: true,
      workflowIntegrationEnabled: true,
      sourcePhases: Object.freeze([101, 102, 103])
    }),
    source: "phase_103_projection"
  });
}

/**
 * Attach Phase 103 observation diagnostics to a pipeline outcome when the workflow
 * integration flag is enabled and an advisory snapshot is available.
 * Never throws. Never mutates the pipeline outcome.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function attachRecruitmentWorkflowDiagnostics(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }

  const cached = workflowDiagnosticsAttachmentByOutcome.get(outcome);
  if (cached != null) {
    return cached;
  }

  if (resolveWorkflowIntegrationEnabled(outcome) !== true) {
    return null;
  }

  try {
    const snapshot = getRecruitmentWorkflowSnapshot(outcome);
    if (snapshot == null) {
      return null;
    }

    const view = buildRecruitmentWorkflowObservationView(snapshot);
    const observationDiagnostics = buildRecruitmentWorkflowObservationDiagnostics(view);
    if (!isRecruitmentWorkflowObservationDiagnostics(observationDiagnostics)) {
      return null;
    }

    const attachment = buildDiagnosticsAttachment(outcome, observationDiagnostics);
    workflowDiagnosticsAttachmentByOutcome.set(outcome, attachment);
    return attachment;
  } catch {
    return null;
  }
}

/**
 * Read attached workflow observation diagnostics for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentWorkflowDiagnostics(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const attachment = workflowDiagnosticsAttachmentByOutcome.get(outcome);
  return attachment == null ? null : attachment;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasRecruitmentWorkflowDiagnostics(outcome) {
  return peekRecruitmentWorkflowDiagnostics(outcome) != null;
}

module.exports = {
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_PHASE,
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_ENTITY,
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_DIAGNOSTICS_ATTACHMENT_METADATA,
  attachRecruitmentWorkflowDiagnostics,
  peekRecruitmentWorkflowDiagnostics,
  hasRecruitmentWorkflowDiagnostics
};
