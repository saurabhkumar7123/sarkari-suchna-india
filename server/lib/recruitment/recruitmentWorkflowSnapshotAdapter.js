"use strict";

/**
 * Phase 101 — Recruitment Workflow Advisory Snapshot Consumption Adapter (Read-Only).
 *
 * Official internal entry point for runtime consumers (admin monitoring,
 * diagnostics, logging, dashboards) to read the Phase 100 advisory snapshot
 * from pipeline outcomes via existing observation mechanisms.
 *
 * Consumption only — no snapshot rebuild, no business logic recomputation,
 * no coordinator invocation, and no pipeline or outcome mutations.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No feature flag changes.
 */

const { peekWorkflowObservation } = require("./recruitmentWorkflowObservationRegistry");
const { peekRecruitmentWorkflowIntegration } = require("./recruitmentPipelineIntegrationHook");
const { peekRecruitmentCompatibilityIntegration } = require("./recruitmentCompatibilityIntegrationHook");
const { isWorkflowAdvisorySnapshotResult } = require("./recruitmentWorkflowAdvisorySnapshot");

const RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_PHASE = 101;

const RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_ENTITY = "recruitment_workflow_snapshot_adapter";

const RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  consumptionOnly: true,
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

const RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_PHASE,
  description:
    "Read-only consumption adapter for Phase 100 recruitment workflow advisory snapshots.",
  metadata: RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolve the coordinator observation from existing WeakMap-backed mechanisms.
 * Does not invoke coordinators, hooks, or factories.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function resolveWorkflowObservation(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }

  const registryObservation = peekWorkflowObservation(outcome);
  if (registryObservation != null) {
    return registryObservation;
  }

  const pipelineIntegration = peekRecruitmentWorkflowIntegration(outcome);
  if (isPlainObject(pipelineIntegration) && isPlainObject(pipelineIntegration.integrationResult)) {
    return pipelineIntegration.integrationResult;
  }

  const compatibilityIntegration = peekRecruitmentCompatibilityIntegration(outcome);
  if (
    isPlainObject(compatibilityIntegration) &&
    isPlainObject(compatibilityIntegration.integrationResult)
  ) {
    return compatibilityIntegration.integrationResult;
  }

  return null;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function extractAdvisorySnapshot(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }

  try {
    const observation = resolveWorkflowObservation(outcome);
    if (!isPlainObject(observation) || !isPlainObject(observation.plannedWorkflow)) {
      return null;
    }

    const snapshot = observation.plannedWorkflow.workflowAdvisorySnapshot;
    if (!isWorkflowAdvisorySnapshotResult(snapshot)) {
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Read the Phase 100 advisory snapshot for a pipeline outcome, if present.
 * Never throws. Never mutates the outcome. Never rebuilds snapshots.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function getRecruitmentWorkflowSnapshot(outcome) {
  return extractAdvisorySnapshot(outcome);
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasRecruitmentWorkflowSnapshot(outcome) {
  return extractAdvisorySnapshot(outcome) != null;
}

/**
 * Build a lightweight summary from the advisory snapshot attached to an outcome.
 * Returns null when no valid snapshot is available.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<{
 *   currentLifecycle: string|null,
 *   overallHealth: string|null,
 *   workflowCompleted: boolean|null,
 *   recommendedAction: string|null,
 *   monitoringRequired: boolean|null,
 *   snapshotComplete: boolean
 * }>|null}
 */
function summarizeRecruitmentWorkflowSnapshot(outcome) {
  const snapshot = extractAdvisorySnapshot(outcome);
  if (snapshot == null) {
    return null;
  }

  const advisorySummary = isPlainObject(snapshot.advisorySummary) ? snapshot.advisorySummary : null;
  const metadata = isPlainObject(snapshot.metadata) ? snapshot.metadata : null;

  return Object.freeze({
    currentLifecycle:
      advisorySummary != null && typeof advisorySummary.currentLifecycle === "string"
        ? advisorySummary.currentLifecycle
        : null,
    overallHealth:
      advisorySummary != null && typeof advisorySummary.overallHealth === "string"
        ? advisorySummary.overallHealth
        : null,
    workflowCompleted:
      advisorySummary != null && typeof advisorySummary.workflowCompleted === "boolean"
        ? advisorySummary.workflowCompleted
        : null,
    recommendedAction:
      advisorySummary != null && typeof advisorySummary.recommendedAction === "string"
        ? advisorySummary.recommendedAction
        : null,
    monitoringRequired:
      advisorySummary != null && typeof advisorySummary.monitoringRequired === "boolean"
        ? advisorySummary.monitoringRequired
        : null,
    snapshotComplete: metadata != null && metadata.snapshotComplete === true
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_PHASE,
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_ENTITY,
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA,
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot,
  summarizeRecruitmentWorkflowSnapshot
};
