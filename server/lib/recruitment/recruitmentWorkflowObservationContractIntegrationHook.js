"use strict";

/**
 * Phase 108 — Recruitment Workflow Observation Contract Integration Hook.
 *
 * Read-only integration hook for the Phase 107 observation contract attachment.
 * Future pipeline integration point — not wired into the pipeline in this phase.
 *
 * When the workflow integration flag is enabled via compatibility input, delegates
 * contract attachment to Phase 107 and stores the result in a dedicated hook WeakMap.
 * Public pipeline outcomes, diagnostics, and existing attachments are never mutated.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes. No pipeline wiring.
 */

const {
  attachRecruitmentWorkflowObservationContract
} = require("./recruitmentWorkflowObservationContractAttachment");

const {
  WORKFLOW_INTEGRATION_FLAG_ID
} = require("./recruitmentWorkflowIntegrationCoordinator");

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_PHASE = 108;

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_ENTITY =
  "recruitment_workflow_observation_contract_integration_hook";

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  integrationHook: true,
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
  sourcePhase: 107,
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID
});

const RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_PHASE,
  description:
    "Read-only integration hook delegating Phase 107 observation contract attachment for future pipeline wiring.",
  featureFlagId: WORKFLOW_INTEGRATION_FLAG_ID,
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA
});

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const observationContractIntegrationByOutcome = new WeakMap();

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Object|null|undefined} compatibilityInput
 * @returns {boolean}
 */
function isWorkflowIntegrationEnabled(compatibilityInput) {
  if (!isPlainObject(compatibilityInput)) {
    return false;
  }
  const featureFlags = isPlainObject(compatibilityInput.featureFlags)
    ? compatibilityInput.featureFlags
    : null;
  return featureFlags != null && featureFlags.workflowIntegrationEnabled === true;
}

/**
 * Attach observation contract integration via Phase 107 when the workflow integration
 * flag is enabled in compatibility input. Never throws. Never mutates the pipeline
 * outcome or diagnostics.
 *
 * @param {Object|null|undefined} outcome
 * @param {Object|null|undefined} compatibilityInput
 * @returns {Readonly<Object>|null}
 */
function attachRecruitmentWorkflowObservationContractIntegration(
  outcome,
  compatibilityInput
) {
  if (!isPlainObject(outcome)) {
    return null;
  }

  const cached = observationContractIntegrationByOutcome.get(outcome);
  if (cached != null) {
    return cached;
  }

  if (!isWorkflowIntegrationEnabled(compatibilityInput)) {
    return null;
  }

  try {
    const contract = attachRecruitmentWorkflowObservationContract(outcome);
    if (contract == null) {
      return null;
    }

    observationContractIntegrationByOutcome.set(outcome, contract);
    return contract;
  } catch {
    return null;
  }
}

/**
 * Read hook-stored observation contract integration for a pipeline outcome, if any.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekRecruitmentWorkflowObservationContractIntegration(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const integration = observationContractIntegrationByOutcome.get(outcome);
  return integration == null ? null : integration;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasRecruitmentWorkflowObservationContractIntegration(outcome) {
  return peekRecruitmentWorkflowObservationContractIntegration(outcome) != null;
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_ENTITY,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_CONTRACT_INTEGRATION_HOOK_METADATA,
  attachRecruitmentWorkflowObservationContractIntegration,
  peekRecruitmentWorkflowObservationContractIntegration,
  hasRecruitmentWorkflowObservationContractIntegration
};
