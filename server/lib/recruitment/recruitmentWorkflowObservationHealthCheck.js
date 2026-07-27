"use strict";

/**
 * Phase 111 — Recruitment Workflow Observation Health Check Library.
 *
 * Pure read-only health evaluation for Phase 110 consumed observation contracts.
 * Assesses contract availability, observation completeness, and projected health
 * fields without attaching, building, or invoking coordinators or pipeline hooks.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  EMPTY_CONSUMER_SUMMARY,
  getRecruitmentWorkflowObservationContract,
  hasRecruitmentWorkflowObservationContract,
  summarizeRecruitmentWorkflowObservationContract
} = require("./recruitmentWorkflowObservationConsumer");

const RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_PHASE = 111;

const RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_ENTITY =
  "recruitment_workflow_observation_health_check";

const OBSERVATION_HEALTH_CHECK_STATUS = Object.freeze({
  READY: "READY",
  INCOMPLETE: "INCOMPLETE",
  UNAVAILABLE: "UNAVAILABLE",
  UNKNOWN: "UNKNOWN"
});

const OBSERVATION_VIEW_STATUS_READY = "READY";
const OBSERVATION_VIEW_STATUS_INCOMPLETE = "INCOMPLETE";

const RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  healthCheckOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  contractOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  mutatesDiagnostics: false,
  performsStateTransitions: false,
  recomputesBusinessLogic: false,
  rebuildsSnapshots: false,
  rebuildsObservationViews: false,
  rebuildsDiagnostics: false,
  rebuildsAttachments: false,
  rebuildsContracts: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  sourcePhase: 110
});

const RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_PHASE,
  description:
    "Read-only health check library evaluating Phase 110 consumed recruitment workflow observation contracts.",
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA
});

const EMPTY_HEALTH_SUMMARY = Object.freeze({
  status: OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN,
  available: false,
  contractAvailable: false,
  observationAvailable: false,
  reason: "MALFORMED_HEALTH_RESULT"
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Object} contract
 * @returns {string|null}
 */
function resolveObservationStatusFromContract(contract) {
  if (!isPlainObject(contract) || !isPlainObject(contract.observation)) {
    return null;
  }

  const bundle = contract.observation;

  if (isPlainObject(bundle.diagnostics) && typeof bundle.diagnostics.status === "string") {
    return bundle.diagnostics.status;
  }

  if (isPlainObject(bundle.observation) && typeof bundle.observation.status === "string") {
    return bundle.observation.status;
  }

  return null;
}

/**
 * @param {Object|null} contract
 * @returns {boolean}
 */
function isObservationBundlePresent(contract) {
  if (!isPlainObject(contract) || !isPlainObject(contract.observation)) {
    return false;
  }

  const bundle = contract.observation;
  return (
    bundle.snapshot != null ||
    isPlainObject(bundle.observation) ||
    isPlainObject(bundle.diagnostics) ||
    bundle.attachment != null
  );
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildHealthCheckResult(params) {
  const summary = params.summary ?? EMPTY_CONSUMER_SUMMARY;

  return Object.freeze({
    available: params.available === true,
    contractAvailable: params.contractAvailable === true,
    observationAvailable: params.observationAvailable === true,
    lifecycle: summary.lifecycle,
    health: summary.health,
    severity: summary.severity,
    recommendation: summary.recommendation,
    monitoringRequired: summary.monitoringRequired,
    workflowCompleted: summary.workflowCompleted,
    status: params.status,
    reason: params.reason,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Evaluate recruitment workflow observation health for a pipeline outcome.
 * Never throws. Never mutates the outcome. Never attaches or builds contracts.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>}
 */
function checkRecruitmentWorkflowObservationHealth(outcome) {
  if (!isPlainObject(outcome)) {
    return buildHealthCheckResult({
      status: OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN,
      contractAvailable: false,
      observationAvailable: false,
      available: false,
      summary: EMPTY_CONSUMER_SUMMARY,
      reason: "MALFORMED_OUTCOME"
    });
  }

  const contractAvailable = hasRecruitmentWorkflowObservationContract(outcome);
  const summary = summarizeRecruitmentWorkflowObservationContract(outcome);

  if (!contractAvailable) {
    return buildHealthCheckResult({
      status: OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE,
      contractAvailable: false,
      observationAvailable: false,
      available: false,
      summary,
      reason: "CONTRACT_UNAVAILABLE"
    });
  }

  const contract = getRecruitmentWorkflowObservationContract(outcome);
  const observationAvailable = isObservationBundlePresent(contract);
  const observationStatus = resolveObservationStatusFromContract(contract);

  if (observationStatus === OBSERVATION_VIEW_STATUS_READY) {
    return buildHealthCheckResult({
      status: OBSERVATION_HEALTH_CHECK_STATUS.READY,
      contractAvailable: true,
      observationAvailable: true,
      available: true,
      summary,
      reason: "OBSERVATION_READY"
    });
  }

  if (
    observationStatus === OBSERVATION_VIEW_STATUS_INCOMPLETE ||
    observationStatus === OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN
  ) {
    return buildHealthCheckResult({
      status: OBSERVATION_HEALTH_CHECK_STATUS.INCOMPLETE,
      contractAvailable: true,
      observationAvailable,
      available: false,
      summary,
      reason: "OBSERVATION_INCOMPLETE"
    });
  }

  return buildHealthCheckResult({
    status: OBSERVATION_HEALTH_CHECK_STATUS.INCOMPLETE,
    contractAvailable: true,
    observationAvailable,
    available: false,
    summary,
    reason: "OBSERVATION_INCOMPLETE"
  });
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasHealthyRecruitmentWorkflowObservation(outcome) {
  const result = checkRecruitmentWorkflowObservationHealth(outcome);
  return result.status === OBSERVATION_HEALTH_CHECK_STATUS.READY;
}

/**
 * Summarize a recruitment workflow observation health check result.
 *
 * @param {Object|null|undefined} result
 * @returns {Readonly<{
 *   status: string,
 *   available: boolean,
 *   contractAvailable: boolean,
 *   observationAvailable: boolean,
 *   reason: string
 * }>}
 */
function summarizeRecruitmentWorkflowObservationHealth(result) {
  if (
    !isPlainObject(result) ||
    result.advisory !== true ||
    result.architectureOnly !== true ||
    result.executed !== false ||
    typeof result.status !== "string"
  ) {
    return EMPTY_HEALTH_SUMMARY;
  }

  return Object.freeze({
    status: result.status,
    available: result.available === true,
    contractAvailable: result.contractAvailable === true,
    observationAvailable: result.observationAvailable === true,
    reason: typeof result.reason === "string" ? result.reason : "UNKNOWN"
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_ENTITY,
  OBSERVATION_HEALTH_CHECK_STATUS,
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_HEALTH_CHECK_METADATA,
  EMPTY_HEALTH_SUMMARY,
  checkRecruitmentWorkflowObservationHealth,
  hasHealthyRecruitmentWorkflowObservation,
  summarizeRecruitmentWorkflowObservationHealth
};
