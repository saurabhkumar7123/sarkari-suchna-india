"use strict";

/**
 * Phase 102 — Recruitment Workflow Observation View (Monitoring Projection).
 *
 * Pure read-only monitoring projection over Phase 100 advisory snapshots.
 * Field projection only — no registry access, no coordinator invocation,
 * no snapshot rebuild, and no business analysis.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No feature flag changes.
 */

const { isWorkflowAdvisorySnapshotResult } = require("./recruitmentWorkflowAdvisorySnapshot");

const RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_PHASE = 102;

const RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_ENTITY = "recruitment_workflow_observation_view";

const OBSERVATION_VIEW_STATUS = Object.freeze({
  READY: "READY",
  INCOMPLETE: "INCOMPLETE",
  UNKNOWN: "UNKNOWN"
});

const OBSERVATION_VIEW_HEALTH = Object.freeze({
  HEALTHY: "HEALTHY",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const SUPPORTED_OBSERVATION_VIEW_STATUSES = Object.freeze(
  new Set(Object.values(OBSERVATION_VIEW_STATUS))
);

const SUPPORTED_OBSERVATION_VIEW_HEALTH = Object.freeze(
  new Set(Object.values(OBSERVATION_VIEW_HEALTH))
);

const RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  projectionOnly: true,
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
  rebuildsSnapshots: false
});

const RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_PHASE,
  description:
    "Read-only monitoring projection over Phase 100 recruitment workflow advisory snapshots.",
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA
});

const EMPTY_WORKFLOW_OBSERVATION_VIEW = Object.freeze({
  status: OBSERVATION_VIEW_STATUS.UNKNOWN,
  lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
  health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
  recommendation: null,
  monitoring: Object.freeze({
    required: null,
    workflowCompleted: null
  }),
  completeness: false,
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

function normalizeLifecycle(value) {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return OBSERVATION_VIEW_HEALTH.UNKNOWN;
}

function normalizeHealth(value) {
  if (typeof value === "string" && SUPPORTED_OBSERVATION_VIEW_HEALTH.has(value)) {
    return value;
  }
  return OBSERVATION_VIEW_HEALTH.UNKNOWN;
}

function normalizeRecommendation(value) {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return null;
}

function normalizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function resolveObservationStatus(snapshotComplete) {
  return snapshotComplete === true
    ? OBSERVATION_VIEW_STATUS.READY
    : OBSERVATION_VIEW_STATUS.INCOMPLETE;
}

function projectAdvisorySummary(advisorySummary) {
  if (!isPlainObject(advisorySummary)) {
    return {
      lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
      health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
      recommendation: null,
      monitoring: {
        required: null,
        workflowCompleted: null
      }
    };
  }

  return {
    lifecycle: normalizeLifecycle(advisorySummary.currentLifecycle),
    health: normalizeHealth(advisorySummary.overallHealth),
    recommendation: normalizeRecommendation(advisorySummary.recommendedAction),
    monitoring: {
      required: normalizeBoolean(advisorySummary.monitoringRequired),
      workflowCompleted: normalizeBoolean(advisorySummary.workflowCompleted)
    }
  };
}

function buildObservationViewResult(snapshot) {
  const metadata = isPlainObject(snapshot.metadata) ? snapshot.metadata : null;
  const snapshotComplete = metadata != null && metadata.snapshotComplete === true;
  const projected = projectAdvisorySummary(snapshot.advisorySummary);

  return deepFreeze({
    status: resolveObservationStatus(snapshotComplete),
    lifecycle: projected.lifecycle,
    health: projected.health,
    recommendation: projected.recommendation,
    monitoring: deepFreeze({
      required: projected.monitoring.required,
      workflowCompleted: projected.monitoring.workflowCompleted
    }),
    completeness: snapshotComplete,
    generatedAt: snapshot.generatedAt ?? null,
    schemaVersion:
      metadata != null && typeof metadata.schemaVersion === "string"
        ? metadata.schemaVersion
        : null,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Build a monitoring-oriented projection from a Phase 100 advisory snapshot.
 * Pure: no I/O, no mutation of input, no registry or coordinator access.
 *
 * @param {Object|null|undefined} snapshot
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowObservationView(snapshot) {
  if (!isWorkflowAdvisorySnapshotResult(snapshot)) {
    return deepFreeze({ ...EMPTY_WORKFLOW_OBSERVATION_VIEW });
  }

  return buildObservationViewResult(snapshot);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowObservationView(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!SUPPORTED_OBSERVATION_VIEW_STATUSES.has(value.status)) {
    return false;
  }

  if (
    typeof value.lifecycle !== "string" ||
    !SUPPORTED_OBSERVATION_VIEW_HEALTH.has(value.health) ||
    (value.recommendation != null && typeof value.recommendation !== "string") ||
    typeof value.completeness !== "boolean" ||
    (value.generatedAt != null && typeof value.generatedAt !== "string") ||
    (value.schemaVersion != null && typeof value.schemaVersion !== "string")
  ) {
    return false;
  }

  if (!isPlainObject(value.monitoring)) {
    return false;
  }

  const monitoringFields = [value.monitoring.required, value.monitoring.workflowCompleted];
  for (let i = 0; i < monitoringFields.length; i += 1) {
    const field = monitoringFields[i];
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
 * @param {Object|null|undefined} view
 * @returns {Readonly<{ status: string, lifecycle: string, health: string, recommendation: string|null }>}
 */
function summarizeRecruitmentWorkflowObservationView(view) {
  if (!isRecruitmentWorkflowObservationView(view)) {
    return Object.freeze({
      status: OBSERVATION_VIEW_STATUS.UNKNOWN,
      lifecycle: OBSERVATION_VIEW_HEALTH.UNKNOWN,
      health: OBSERVATION_VIEW_HEALTH.UNKNOWN,
      recommendation: null
    });
  }

  return Object.freeze({
    status: view.status,
    lifecycle: view.lifecycle,
    health: view.health,
    recommendation: view.recommendation
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_ENTITY,
  OBSERVATION_VIEW_STATUS,
  OBSERVATION_VIEW_HEALTH,
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_VIEW_METADATA,
  EMPTY_WORKFLOW_OBSERVATION_VIEW,
  buildRecruitmentWorkflowObservationView,
  isRecruitmentWorkflowObservationView,
  summarizeRecruitmentWorkflowObservationView
};
