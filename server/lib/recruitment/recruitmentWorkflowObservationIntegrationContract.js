"use strict";

/**
 * Phase 106 — Recruitment Workflow Observation Integration Contract.
 *
 * Pure integration contract that exposes the Phase 105 observation service
 * as the official consumption boundary for future runtime integrations,
 * monitoring, admin tooling, diagnostics, and health inspection.
 *
 * No recomputation. No business analysis. No attachment creation. No mutation.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No coordinator. No registry. No pipeline. No compatibility layer.
 */

const {
  getRecruitmentWorkflowObservation,
  isRecruitmentWorkflowObservation,
  EMPTY_OBSERVATION_SUMMARY
} = require("./recruitmentWorkflowObservationService");

const RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE = 106;

const RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_ENTITY =
  "recruitment_workflow_observation_integration_contract";

const RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION = "1.0.0";

const RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  contractOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  invokesCoordinator: false,
  sourcePhase: 105
});

const RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
  description:
    "Immutable integration contract wrapping Phase 105 recruitment workflow observation bundles.",
  schemaVersion: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION,
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA
});

const EMPTY_CONTRACT_SUMMARY = Object.freeze({
  lifecycle: EMPTY_OBSERVATION_SUMMARY.lifecycle,
  health: EMPTY_OBSERVATION_SUMMARY.health,
  severity: EMPTY_OBSERVATION_SUMMARY.severity,
  recommendation: EMPTY_OBSERVATION_SUMMARY.recommendation
});

const EXPECTED_CONTRACT_KEYS = Object.freeze([
  "observation",
  "metadata",
  "advisory",
  "architectureOnly",
  "executed"
]);

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
 * Build an immutable recruitment workflow observation integration contract.
 * Never throws. Never mutates the outcome. Never invokes coordinators or attachments.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>}
 */
function buildRecruitmentWorkflowObservationContract(outcome) {
  let observation;
  try {
    observation = getRecruitmentWorkflowObservation(outcome);
  } catch {
    observation = getRecruitmentWorkflowObservation(null);
  }

  return deepFreeze({
    observation,
    metadata: deepFreeze({
      phase: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
      schemaVersion: RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION
    }),
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowObservationContract(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!isRecruitmentWorkflowObservation(value.observation)) {
    return false;
  }

  if (!isPlainObject(value.metadata)) {
    return false;
  }

  if (
    value.metadata.phase !== RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE ||
    value.metadata.schemaVersion !==
      RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION
  ) {
    return false;
  }

  return (
    value.advisory === true &&
    value.architectureOnly === true &&
    value.executed === false
  );
}

/**
 * Summarize a recruitment workflow observation integration contract.
 * Reuses Phase 105 summary field semantics.
 *
 * @param {Object|null|undefined} contract
 * @returns {Readonly<{
 *   lifecycle: string,
 *   health: string,
 *   severity: string,
 *   recommendation: string|null
 * }>}
 */
function summarizeRecruitmentWorkflowObservationContract(contract) {
  if (!isRecruitmentWorkflowObservationContract(contract)) {
    return EMPTY_CONTRACT_SUMMARY;
  }

  const phase105Summary = summarizeRecruitmentWorkflowObservationFromBundle(
    contract.observation
  );

  return Object.freeze({
    lifecycle: phase105Summary.lifecycle,
    health: phase105Summary.health,
    severity: phase105Summary.severity,
    recommendation: phase105Summary.recommendation
  });
}

/**
 * Derive Phase 105 summary fields from an observation bundle.
 * Mirrors summarizeRecruitmentWorkflowObservation field selection.
 *
 * @param {Object} bundle
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentWorkflowObservationFromBundle(bundle) {
  if (!isRecruitmentWorkflowObservation(bundle)) {
    return EMPTY_CONTRACT_SUMMARY;
  }

  const diagnostics = bundle.diagnostics;
  if (!isPlainObject(diagnostics)) {
    return EMPTY_CONTRACT_SUMMARY;
  }

  return Object.freeze({
    lifecycle: diagnostics.lifecycle,
    health: diagnostics.health,
    severity: diagnostics.severity,
    recommendation: diagnostics.recommendation
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_SCHEMA_VERSION,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_INTEGRATION_CONTRACT_METADATA,
  EMPTY_CONTRACT_SUMMARY,
  EXPECTED_CONTRACT_KEYS,
  buildRecruitmentWorkflowObservationContract,
  isRecruitmentWorkflowObservationContract,
  summarizeRecruitmentWorkflowObservationContract
};
