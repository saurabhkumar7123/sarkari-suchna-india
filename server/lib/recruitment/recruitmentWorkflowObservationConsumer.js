"use strict";

/**
 * Phase 110 — Recruitment Workflow Observation Consumer API.
 *
 * Read-only consumer boundary for retrieving Phase 109 attached
 * Recruitment Workflow Observation Contracts via the Phase 108
 * integration hook store.
 *
 * Never attaches. Never builds. Never invokes coordinators or pipeline hooks.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  peekRecruitmentWorkflowObservationContractIntegration
} = require("./recruitmentWorkflowObservationContractIntegrationHook");

const RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_PHASE = 110;

const RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_ENTITY =
  "recruitment_workflow_observation_consumer";

const RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  consumerOnly: true,
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
  sourcePhase: 108
});

const RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_PHASE,
  description:
    "Read-only consumer API for Phase 108 attached recruitment workflow observation contracts.",
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA
});

const EMPTY_CONSUMER_SUMMARY = Object.freeze({
  lifecycle: "UNKNOWN",
  health: "UNKNOWN",
  severity: "UNKNOWN",
  recommendation: null,
  monitoringRequired: null,
  workflowCompleted: null
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Project summary fields from an attached observation contract.
 * No recomputation — diagnostics fields are read as stored.
 *
 * @param {Object} contract
 * @returns {Readonly<Object>}
 */
function projectSummaryFromContract(contract) {
  const diagnostics =
    isPlainObject(contract) &&
    isPlainObject(contract.observation) &&
    isPlainObject(contract.observation.diagnostics)
      ? contract.observation.diagnostics
      : null;

  if (diagnostics == null) {
    return EMPTY_CONSUMER_SUMMARY;
  }

  return Object.freeze({
    lifecycle: diagnostics.lifecycle,
    health: diagnostics.health,
    severity: diagnostics.severity,
    recommendation: diagnostics.recommendation,
    monitoringRequired: diagnostics.monitoringRequired,
    workflowCompleted: diagnostics.workflowCompleted
  });
}

/**
 * Return the attached Phase 106 observation contract for a pipeline outcome, if any.
 * Never attaches, builds, or invokes coordinators or pipeline hooks.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function getRecruitmentWorkflowObservationContract(outcome) {
  return peekRecruitmentWorkflowObservationContractIntegration(outcome);
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasRecruitmentWorkflowObservationContract(outcome) {
  return peekRecruitmentWorkflowObservationContractIntegration(outcome) != null;
}

/**
 * Summarize the attached observation contract for a pipeline outcome.
 * Projects stored diagnostics only — no recomputation.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<{
 *   lifecycle: string,
 *   health: string,
 *   severity: string,
 *   recommendation: string|null,
 *   monitoringRequired: boolean|null,
 *   workflowCompleted: boolean|null
 * }>}
 */
function summarizeRecruitmentWorkflowObservationContract(outcome) {
  const contract = peekRecruitmentWorkflowObservationContractIntegration(outcome);
  if (contract == null) {
    return EMPTY_CONSUMER_SUMMARY;
  }
  return projectSummaryFromContract(contract);
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONSUMER_METADATA,
  EMPTY_CONSUMER_SUMMARY,
  getRecruitmentWorkflowObservationContract,
  hasRecruitmentWorkflowObservationContract,
  summarizeRecruitmentWorkflowObservationContract
};
