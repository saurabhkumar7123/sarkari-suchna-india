"use strict";

/**
 * Phase 113 — Recruitment Workflow Advisory Gateway.
 *
 * Single read-only advisory gateway aggregating Phase 101 snapshot consumption,
 * Phase 105 observation service, Phase 110 contract consumer, Phase 111 health
 * check, and Phase 112 rollout readiness without recomputation, attachment,
 * coordinator invocation, or pipeline mutations.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  getRecruitmentWorkflowSnapshot
} = require("./recruitmentWorkflowSnapshotAdapter");

const {
  getRecruitmentWorkflowObservation,
  isRecruitmentWorkflowObservation
} = require("./recruitmentWorkflowObservationService");

const {
  getRecruitmentWorkflowObservationContract
} = require("./recruitmentWorkflowObservationConsumer");

const {
  checkRecruitmentWorkflowObservationHealth,
  summarizeRecruitmentWorkflowObservationHealth
} = require("./recruitmentWorkflowObservationHealthCheck");

const {
  evaluateRecruitmentWorkflowObservationRolloutReadiness,
  summarizeRecruitmentWorkflowObservationRolloutReadiness,
  ROLLOUT_READINESS_STATUS
} = require("./recruitmentWorkflowObservationRolloutReadiness");

const RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE = 113;

const RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_ENTITY = "recruitment_workflow_advisory_gateway";

const GATEWAY_RECOMMENDATION_ACTION = Object.freeze({
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA"
});

const RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  gatewayOnly: true,
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
  sourcePhases: Object.freeze([101, 105, 110, 111, 112])
});

const RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE,
  description:
    "Read-only advisory gateway aggregating Phase 101–112 recruitment workflow advisory outputs.",
  metadata: RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA
});

const EMPTY_GATEWAY_SUMMARY = Object.freeze({
  available: false,
  action: GATEWAY_RECOMMENDATION_ACTION.INSUFFICIENT_DATA,
  lifecycle: "UNKNOWN",
  health: "UNKNOWN",
  rolloutStatus: ROLLOUT_READINESS_STATUS.UNKNOWN,
  healthStatus: "UNKNOWN",
  contractAvailable: false,
  observationAvailable: false,
  monitoringRequired: null,
  workflowCompleted: null
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
 * @param {Readonly<Object>|null|undefined} rolloutReadiness
 * @returns {string}
 */
function resolveGatewayRecommendationAction(rolloutReadiness) {
  if (!isPlainObject(rolloutReadiness) || typeof rolloutReadiness.status !== "string") {
    return GATEWAY_RECOMMENDATION_ACTION.INSUFFICIENT_DATA;
  }

  if (rolloutReadiness.status === ROLLOUT_READINESS_STATUS.READY) {
    return GATEWAY_RECOMMENDATION_ACTION.READY_FOR_CONTROLLED_INTEGRATION;
  }

  if (rolloutReadiness.status === ROLLOUT_READINESS_STATUS.NOT_READY) {
    return GATEWAY_RECOMMENDATION_ACTION.REVIEW_REQUIRED;
  }

  return GATEWAY_RECOMMENDATION_ACTION.INSUFFICIENT_DATA;
}

/**
 * @param {Readonly<Object>} health
 * @param {Readonly<Object>} rolloutReadiness
 * @returns {Readonly<Object>}
 */
function buildGatewayRecommendation(health, rolloutReadiness) {
  const healthObj = isPlainObject(health) ? health : null;
  const rolloutObj = isPlainObject(rolloutReadiness) ? rolloutReadiness : null;

  return Object.freeze({
    lifecycle:
      healthObj != null && typeof healthObj.lifecycle === "string"
        ? healthObj.lifecycle
        : rolloutObj != null && typeof rolloutObj.lifecycle === "string"
          ? rolloutObj.lifecycle
          : "UNKNOWN",
    health:
      healthObj != null && typeof healthObj.health === "string"
        ? healthObj.health
        : rolloutObj != null && typeof rolloutObj.health === "string"
          ? rolloutObj.health
          : "UNKNOWN",
    action: resolveGatewayRecommendationAction(rolloutReadiness),
    monitoringRequired:
      healthObj != null && typeof healthObj.monitoringRequired === "boolean"
        ? healthObj.monitoringRequired
        : null,
    workflowCompleted:
      healthObj != null && typeof healthObj.workflowCompleted === "boolean"
        ? healthObj.workflowCompleted
        : null
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildGatewayResult(params) {
  return deepFreeze({
    available: params.available === true,
    snapshot: params.snapshot ?? null,
    observation: params.observation ?? null,
    contract: params.contract ?? null,
    health: params.health ?? null,
    rolloutReadiness: params.rolloutReadiness ?? null,
    recommendation: params.recommendation,
    metadata: Object.freeze({
      phase: RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE,
      advisory: true,
      architectureOnly: true,
      executed: false
    })
  });
}

/**
 * Aggregate recruitment workflow advisory outputs for a pipeline outcome.
 * Never throws. Never mutates the outcome. Never attaches or invokes coordinators.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>}
 */
function getRecruitmentWorkflowAdvisoryGateway(outcome) {
  if (!isPlainObject(outcome)) {
    const emptyRecommendation = buildGatewayRecommendation(null, null);
    return buildGatewayResult({
      available: false,
      snapshot: null,
      observation: null,
      contract: null,
      health: null,
      rolloutReadiness: null,
      recommendation: emptyRecommendation
    });
  }

  try {
    const snapshot = getRecruitmentWorkflowSnapshot(outcome);
    const observation = getRecruitmentWorkflowObservation(outcome);
    const contract = getRecruitmentWorkflowObservationContract(outcome);
    const health = checkRecruitmentWorkflowObservationHealth(outcome);
    const rolloutReadiness = evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome);
    const recommendation = buildGatewayRecommendation(health, rolloutReadiness);

    return buildGatewayResult({
      available: health.available === true,
      snapshot,
      observation: isRecruitmentWorkflowObservation(observation) ? observation : null,
      contract,
      health,
      rolloutReadiness,
      recommendation
    });
  } catch {
    const emptyRecommendation = buildGatewayRecommendation(null, null);
    return buildGatewayResult({
      available: false,
      snapshot: null,
      observation: null,
      contract: null,
      health: null,
      rolloutReadiness: null,
      recommendation: emptyRecommendation
    });
  }
}

/**
 * @param {Object|null|undefined} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowAdvisoryGateway(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    typeof value.available !== "boolean" ||
    !isPlainObject(value.recommendation) ||
    !isPlainObject(value.metadata)
  ) {
    return false;
  }

  const metadata = value.metadata;
  const recommendation = value.recommendation;

  if (
    metadata.phase !== RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE ||
    metadata.advisory !== true ||
    metadata.architectureOnly !== true ||
    metadata.executed !== false
  ) {
    return false;
  }

  if (
    typeof recommendation.lifecycle !== "string" ||
    typeof recommendation.health !== "string" ||
    typeof recommendation.action !== "string"
  ) {
    return false;
  }

  if (
    (value.snapshot != null && !isPlainObject(value.snapshot)) ||
    (value.observation != null && !isRecruitmentWorkflowObservation(value.observation)) ||
    (value.contract != null && !isPlainObject(value.contract)) ||
    (value.health != null && !isPlainObject(value.health)) ||
    (value.rolloutReadiness != null && !isPlainObject(value.rolloutReadiness))
  ) {
    return false;
  }

  return true;
}

/**
 * Summarize a recruitment workflow advisory gateway result.
 *
 * @param {Object|null|undefined} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentWorkflowAdvisoryGateway(value) {
  if (!isRecruitmentWorkflowAdvisoryGateway(value)) {
    return EMPTY_GATEWAY_SUMMARY;
  }

  const healthSummary = isPlainObject(value.health)
    ? summarizeRecruitmentWorkflowObservationHealth(value.health)
    : null;
  const rolloutSummary = isPlainObject(value.rolloutReadiness)
    ? summarizeRecruitmentWorkflowObservationRolloutReadiness(value.rolloutReadiness)
    : null;

  return Object.freeze({
    available: value.available === true,
    action: value.recommendation.action,
    lifecycle: value.recommendation.lifecycle,
    health: value.recommendation.health,
    rolloutStatus:
      rolloutSummary != null ? rolloutSummary.status : ROLLOUT_READINESS_STATUS.UNKNOWN,
    healthStatus: healthSummary != null ? healthSummary.status : "UNKNOWN",
    contractAvailable:
      rolloutSummary != null ? rolloutSummary.contractAvailable === true : false,
    observationAvailable:
      rolloutSummary != null ? rolloutSummary.observationAvailable === true : false,
    monitoringRequired:
      typeof value.recommendation.monitoringRequired === "boolean"
        ? value.recommendation.monitoringRequired
        : null,
    workflowCompleted:
      typeof value.recommendation.workflowCompleted === "boolean"
        ? value.recommendation.workflowCompleted
        : null
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_ENTITY,
  GATEWAY_RECOMMENDATION_ACTION,
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_GATEWAY_METADATA,
  EMPTY_GATEWAY_SUMMARY,
  getRecruitmentWorkflowAdvisoryGateway,
  isRecruitmentWorkflowAdvisoryGateway,
  summarizeRecruitmentWorkflowAdvisoryGateway
};
