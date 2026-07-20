"use strict";

/**
 * Phase 105 — Recruitment Workflow Observation Service (Read-Only Facade).
 *
 * Single read-only consumption boundary for recruitment workflow observations.
 * Composes Phase 101 snapshot consumption, Phase 102 observation views,
 * Phase 103 observation diagnostics, and Phase 104 diagnostics attachments
 * without coordinator invocation, registry access, pipeline execution, or
 * business analysis recomputation.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot
} = require("./recruitmentWorkflowSnapshotAdapter");

const {
  buildRecruitmentWorkflowObservationView,
  isRecruitmentWorkflowObservationView
} = require("./recruitmentWorkflowObservationView");

const {
  buildRecruitmentWorkflowObservationDiagnostics,
  isRecruitmentWorkflowObservationDiagnostics,
  summarizeRecruitmentWorkflowObservationDiagnostics,
  DIAGNOSTICS_SEVERITY
} = require("./recruitmentWorkflowObservationDiagnosticsAdapter");

const { peekRecruitmentWorkflowDiagnostics } = require(
  "./recruitmentWorkflowDiagnosticsAttachment"
);

const RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_PHASE = 105;

const RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_ENTITY = "recruitment_workflow_observation_service";

const RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  facadeOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
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
  sourcePhases: Object.freeze([101, 102, 103, 104])
});

const RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_PHASE,
  description:
    "Read-only facade composing Phase 101–104 recruitment workflow observation artifacts.",
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA
});

const EMPTY_OBSERVATION_SUMMARY = Object.freeze({
  lifecycle: "UNKNOWN",
  health: "UNKNOWN",
  recommendation: null,
  severity: DIAGNOSTICS_SEVERITY.UNKNOWN,
  monitoringRequired: null
});

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
 * @param {*} attachment
 * @returns {boolean}
 */
function isDiagnosticsAttachmentShape(attachment) {
  if (!isPlainObject(attachment)) {
    return false;
  }

  return (
    isRecruitmentWorkflowObservationDiagnostics(attachment.observationDiagnostics) &&
    attachment.diagnostics === attachment.observationDiagnostics &&
    isPlainObject(attachment.executionDiagnostics) &&
    isPlainObject(attachment.metadata) &&
    typeof attachment.source === "string"
  );
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowObservationBundle(outcome) {
  const snapshot = getRecruitmentWorkflowSnapshot(outcome);
  const observation = buildRecruitmentWorkflowObservationView(snapshot);
  const diagnostics = buildRecruitmentWorkflowObservationDiagnostics(observation);
  const attachment = peekRecruitmentWorkflowDiagnostics(outcome);

  return deepFreeze({
    snapshot: snapshot ?? null,
    observation,
    diagnostics,
    attachment: attachment ?? null,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Read the composed recruitment workflow observation for a pipeline outcome.
 * Never throws. Never mutates the outcome. Never invokes coordinators or attachments.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>}
 */
function getRecruitmentWorkflowObservation(outcome) {
  if (!isPlainObject(outcome)) {
    return buildRecruitmentWorkflowObservationBundle(null);
  }

  try {
    return buildRecruitmentWorkflowObservationBundle(outcome);
  } catch {
    return buildRecruitmentWorkflowObservationBundle(null);
  }
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasRecruitmentWorkflowObservation(outcome) {
  return hasRecruitmentWorkflowSnapshot(outcome);
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<{
 *   lifecycle: string,
 *   health: string,
 *   recommendation: string|null,
 *   severity: string,
 *   monitoringRequired: boolean|null
 * }>}
 */
function summarizeRecruitmentWorkflowObservation(outcome) {
  const bundle = getRecruitmentWorkflowObservation(outcome);
  const diagnosticsSummary = summarizeRecruitmentWorkflowObservationDiagnostics(bundle.diagnostics);

  return Object.freeze({
    lifecycle: diagnosticsSummary.lifecycle,
    health: diagnosticsSummary.health,
    recommendation: diagnosticsSummary.recommendation,
    severity: diagnosticsSummary.severity,
    monitoringRequired: isRecruitmentWorkflowObservationDiagnostics(bundle.diagnostics)
      ? bundle.diagnostics.monitoringRequired
      : null
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowObservation(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    (value.snapshot != null && !isPlainObject(value.snapshot)) ||
    !isRecruitmentWorkflowObservationView(value.observation) ||
    !isRecruitmentWorkflowObservationDiagnostics(value.diagnostics) ||
    (value.attachment != null && !isDiagnosticsAttachmentShape(value.attachment))
  ) {
    return false;
  }

  return (
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_SERVICE_METADATA,
  EMPTY_OBSERVATION_SUMMARY,
  getRecruitmentWorkflowObservation,
  hasRecruitmentWorkflowObservation,
  summarizeRecruitmentWorkflowObservation,
  isRecruitmentWorkflowObservation
};
