"use strict";

/**
 * Phase 107 — Recruitment Workflow Observation Contract Runtime Attachment.
 *
 * Feature-flagged runtime attachment of the Phase 106 observation integration
 * contract to pipeline outcomes. First runtime consumer of the official
 * observation contract. Consumes existing advisory information only — no
 * coordinator invocation, no snapshot rebuild, and no business analysis.
 *
 * Contracts are stored in an internal WeakMap keyed by pipeline outcome.
 * Public pipeline outcomes are never mutated.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  buildRecruitmentWorkflowObservationContract,
  isRecruitmentWorkflowObservationContract
} = require("./recruitmentWorkflowObservationIntegrationContract");

const { getRecruitmentWorkflowSnapshot } = require("./recruitmentWorkflowSnapshotAdapter");

const { peekWorkflowObservation } = require("./recruitmentWorkflowObservationRegistry");

const { peekRecruitmentWorkflowIntegration } = require("./recruitmentPipelineIntegrationHook");

const { peekRecruitmentCompatibilityIntegration } = require(
  "./recruitmentCompatibilityIntegrationHook"
);

const {
  WORKFLOW_INTEGRATION_FLAG_ID
} = require("./recruitmentWorkflowIntegrationCoordinator");

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_PHASE = 107;

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_ENTITY =
  "recruitment_workflow_observation_contract_attachment";

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  attachmentOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  contractOnly: true,
  runtimeIntegration: true,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  recomputesBusinessLogic: false,
  rebuildsSnapshots: false,
  rebuildsObservationViews: false,
  rebuildsDiagnostics: false,
  rebuildsAttachments: false,
  invokesCoordinator: false,
  sourcePhase: 106,
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID
});

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_PHASE,
  description:
    "Feature-flagged read-only attachment of Phase 106 observation integration contracts to pipeline outcomes.",
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA
});

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const observationContractAttachmentByOutcome = new WeakMap();

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
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
 * Attach the Phase 106 observation integration contract to a pipeline outcome
 * when the workflow integration flag is enabled. Never throws. Never mutates
 * the pipeline outcome.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function attachRecruitmentWorkflowObservationContract(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }

  const cached = observationContractAttachmentByOutcome.get(outcome);
  if (cached != null) {
    return cached;
  }

  if (resolveWorkflowIntegrationEnabled(outcome) !== true) {
    return null;
  }

  try {
    const contract = buildRecruitmentWorkflowObservationContract(outcome);
    if (!isRecruitmentWorkflowObservationContract(contract)) {
      return null;
    }

    observationContractAttachmentByOutcome.set(outcome, contract);
    return contract;
  } catch {
    return null;
  }
}

/**
 * Read attached observation integration contract for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentWorkflowObservationContract(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const attachment = observationContractAttachmentByOutcome.get(outcome);
  return attachment == null ? null : attachment;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasRecruitmentWorkflowObservationContract(outcome) {
  return peekRecruitmentWorkflowObservationContract(outcome) != null;
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_ATTACHMENT_METADATA,
  attachRecruitmentWorkflowObservationContract,
  peekRecruitmentWorkflowObservationContract,
  hasRecruitmentWorkflowObservationContract
};
