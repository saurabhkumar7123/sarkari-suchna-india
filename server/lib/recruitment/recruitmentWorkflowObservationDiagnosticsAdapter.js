"use strict";

/**
 * Phase 103 — Recruitment Workflow Observation Diagnostics Adapter (Advisory).
 *
 * Pure read-only diagnostics projection over Phase 102 observation views.
 * Field projection and severity mapping only — no registry access, no coordinator
 * invocation, no snapshot rebuild, no observation view rebuild, and no business
 * analysis.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No feature flag changes.
 */

const {
  OBSERVATION_VIEW_STATUS,
  OBSERVATION_VIEW_HEALTH,
  isRecruitmentWorkflowObservationView
} = require("./recruitmentWorkflowObservationView");

const RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_PHASE = 103;

const RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_ENTITY =
  "recruitment_workflow_observation_diagnostics_adapter";

const DIAGNOSTICS_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  UNKNOWN: "UNKNOWN"
});

const SUPPORTED_DIAGNOSTICS_SEVERITIES = Object.freeze(
  new Set(Object.values(DIAGNOSTICS_SEVERITY))
);

const SUPPORTED_OBSERVATION_VIEW_STATUSES = Object.freeze(
  new Set(Object.values(OBSERVATION_VIEW_STATUS))
);

const SUPPORTED_OBSERVATION_VIEW_HEALTH = Object.freeze(
  new Set(Object.values(OBSERVATION_VIEW_HEALTH))
);

const RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  diagnosticsOnly: true,
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
  rebuildsObservationViews: false,
  rebuildsSnapshots: false
});

const RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_PHASE,
  description:
    "Read-only diagnostics projection over Phase 102 recruitment workflow observation views.",
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA
});

const EMPTY_WORKFLOW_OBSERVATION_DIAGNOSTICS = Object.freeze({
  status: OBSERVATION_VIEW_STATUS.UNKNOWN,
  severity: DIAGNOSTICS_SEVERITY.UNKNOWN,
  lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
  health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
  recommendation: null,
  monitoringRequired: null,
  workflowCompleted: null,
  snapshotComplete: false,
  generatedAt: null,
  schemaVersion: null,
  advisory: true,
  architectureOnly: true,
  executed: false
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

function resolveDiagnosticsSeverity(status, health) {
  if (
    status === OBSERVATION_VIEW_STATUS.UNKNOWN ||
    status === OBSERVATION_VIEW_STATUS.INCOMPLETE
  ) {
    return DIAGNOSTICS_SEVERITY.UNKNOWN;
  }

  if (status === OBSERVATION_VIEW_STATUS.READY) {
    if (health === OBSERVATION_VIEW_HEALTH.HEALTHY) {
      return DIAGNOSTICS_SEVERITY.INFO;
    }
    if (health === OBSERVATION_VIEW_HEALTH.WARNING) {
      return DIAGNOSTICS_SEVERITY.WARNING;
    }
    if (health === OBSERVATION_VIEW_HEALTH.CRITICAL) {
      return DIAGNOSTICS_SEVERITY.ERROR;
    }
    return DIAGNOSTICS_SEVERITY.UNKNOWN;
  }

  return DIAGNOSTICS_SEVERITY.UNKNOWN;
}

function projectMonitoringFields(monitoring) {
  if (!isPlainObject(monitoring)) {
    return {
      monitoringRequired: null,
      workflowCompleted: null
    };
  }

  return {
    monitoringRequired:
      typeof monitoring.required === "boolean" ? monitoring.required : null,
    workflowCompleted:
      typeof monitoring.workflowCompleted === "boolean" ? monitoring.workflowCompleted : null
  };
}

function buildDiagnosticsResult(view) {
  const monitoring = projectMonitoringFields(view.monitoring);

  return deepFreeze({
    status: view.status,
    severity: resolveDiagnosticsSeverity(view.status, view.health),
    lifecycle: view.lifecycle,
    health: view.health,
    recommendation: view.recommendation,
    monitoringRequired: monitoring.monitoringRequired,
    workflowCompleted: monitoring.workflowCompleted,
    snapshotComplete: view.completeness === true,
    generatedAt: view.generatedAt ?? null,
    schemaVersion: view.schemaVersion ?? null,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Build a normalized diagnostics payload from a Phase 102 observation view.
 * Pure: no I/O, no mutation of input, no registry or coordinator access.
 *
 * @param {Object|null|undefined} view
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowObservationDiagnostics(view) {
  if (!isRecruitmentWorkflowObservationView(view)) {
    return deepFreeze({ ...EMPTY_WORKFLOW_OBSERVATION_DIAGNOSTICS });
  }

  return buildDiagnosticsResult(view);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowObservationDiagnostics(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !SUPPORTED_OBSERVATION_VIEW_STATUSES.has(value.status) ||
    !SUPPORTED_DIAGNOSTICS_SEVERITIES.has(value.severity) ||
    typeof value.lifecycle !== "string" ||
    !SUPPORTED_OBSERVATION_VIEW_HEALTH.has(value.health) ||
    (value.recommendation != null && typeof value.recommendation !== "string") ||
    typeof value.snapshotComplete !== "boolean" ||
    (value.generatedAt != null && typeof value.generatedAt !== "string") ||
    (value.schemaVersion != null && typeof value.schemaVersion !== "string")
  ) {
    return false;
  }

  const booleanOrNullFields = [value.monitoringRequired, value.workflowCompleted];
  for (let i = 0; i < booleanOrNullFields.length; i += 1) {
    const field = booleanOrNullFields[i];
    if (field != null && typeof field !== "boolean") {
      return false;
    }
  }

  return (
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

/**
 * @param {Object|null|undefined} payload
 * @returns {Readonly<{ severity: string, lifecycle: string, health: string, recommendation: string|null }>}
 */
function summarizeRecruitmentWorkflowObservationDiagnostics(payload) {
  if (!isRecruitmentWorkflowObservationDiagnostics(payload)) {
    return Object.freeze({
      severity: DIAGNOSTICS_SEVERITY.UNKNOWN,
      lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
      health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
      recommendation: null
    });
  }

  return Object.freeze({
    severity: payload.severity,
    lifecycle: payload.lifecycle,
    health: payload.health,
    recommendation: payload.recommendation
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_ENTITY,
  DIAGNOSTICS_SEVERITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_DIAGNOSTICS_ADAPTER_METADATA,
  EMPTY_WORKFLOW_OBSERVATION_DIAGNOSTICS,
  buildRecruitmentWorkflowObservationDiagnostics,
  isRecruitmentWorkflowObservationDiagnostics,
  summarizeRecruitmentWorkflowObservationDiagnostics
};
