"use strict";

/**
 * Phase 112 — Recruitment Workflow Observation Rollout Readiness Evaluator.
 *
 * Pure read-only rollout readiness evaluation for Phase 111 observation health.
 * Assesses whether existing observation contracts are healthy enough for controlled
 * rollout without attaching, building, or invoking coordinators or pipeline hooks.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  OBSERVATION_HEALTH_CHECK_STATUS,
  checkRecruitmentWorkflowObservationHealth,
  summarizeRecruitmentWorkflowObservationHealth
} = require("./recruitmentWorkflowObservationHealthCheck");

const RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_PHASE = 112;

const RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_ENTITY =
  "recruitment_workflow_observation_rollout_readiness";

const ROLLOUT_READINESS_STATUS = Object.freeze({
  READY: "READY",
  NOT_READY: "NOT_READY",
  UNKNOWN: "UNKNOWN"
});

const ROLLOUT_READINESS_BLOCKERS = Object.freeze({
  CONTRACT_UNAVAILABLE: "CONTRACT_UNAVAILABLE",
  OBSERVATION_INCOMPLETE: "OBSERVATION_INCOMPLETE",
  HEALTH_UNKNOWN: "HEALTH_UNKNOWN",
  MALFORMED_OUTCOME: "MALFORMED_OUTCOME"
});

const RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  rolloutReadinessOnly: true,
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
  sourcePhase: 111
});

const RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_PHASE,
  description:
    "Read-only rollout readiness evaluator projecting Phase 111 recruitment workflow observation health.",
  metadata: RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA
});

const EMPTY_ROLLOUT_READINESS_SUMMARY = Object.freeze({
  ready: false,
  status: ROLLOUT_READINESS_STATUS.UNKNOWN,
  healthStatus: OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN,
  contractAvailable: false,
  observationAvailable: false,
  blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN]),
  readinessReason: ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Object|null|undefined} health
 * @returns {boolean}
 */
function isValidHealthResult(health) {
  return (
    isPlainObject(health) &&
    health.advisory === true &&
    health.architectureOnly === true &&
    health.executed === false &&
    typeof health.status === "string"
  );
}

/**
 * @param {Object|null|undefined} result
 * @returns {boolean}
 */
function isValidRolloutReadinessResult(result) {
  return (
    isPlainObject(result) &&
    result.advisory === true &&
    result.architectureOnly === true &&
    result.executed === false &&
    typeof result.status === "string" &&
    typeof result.healthStatus === "string" &&
    Array.isArray(result.blockers)
  );
}

/**
 * @param {Readonly<Object>} health
 * @returns {Readonly<{ status: string, ready: boolean, blockers: ReadonlyArray<string>, readinessReason: string }>}
 */
function resolveRolloutReadinessFromHealth(health) {
  if (!isValidHealthResult(health)) {
    return Object.freeze({
      status: ROLLOUT_READINESS_STATUS.UNKNOWN,
      ready: false,
      blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN]),
      readinessReason: ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN
    });
  }

  const healthStatus = health.status;
  const contractAvailable = health.contractAvailable === true;
  const observationAvailable = health.observationAvailable === true;
  const healthReason =
    typeof health.reason === "string" ? health.reason : ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN;

  if (healthStatus === OBSERVATION_HEALTH_CHECK_STATUS.UNKNOWN) {
    if (healthReason === ROLLOUT_READINESS_BLOCKERS.MALFORMED_OUTCOME) {
      return Object.freeze({
        status: ROLLOUT_READINESS_STATUS.UNKNOWN,
        ready: false,
        blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.MALFORMED_OUTCOME]),
        readinessReason: ROLLOUT_READINESS_BLOCKERS.MALFORMED_OUTCOME
      });
    }

    return Object.freeze({
      status: ROLLOUT_READINESS_STATUS.UNKNOWN,
      ready: false,
      blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN]),
      readinessReason: healthReason
    });
  }

  if (
    healthStatus === OBSERVATION_HEALTH_CHECK_STATUS.READY &&
    contractAvailable &&
    observationAvailable
  ) {
    return Object.freeze({
      status: ROLLOUT_READINESS_STATUS.READY,
      ready: true,
      blockers: Object.freeze([]),
      readinessReason: healthReason
    });
  }

  if (healthStatus === OBSERVATION_HEALTH_CHECK_STATUS.UNAVAILABLE || !contractAvailable) {
    return Object.freeze({
      status: ROLLOUT_READINESS_STATUS.NOT_READY,
      ready: false,
      blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.CONTRACT_UNAVAILABLE]),
      readinessReason:
        healthReason === "CONTRACT_UNAVAILABLE"
          ? healthReason
          : ROLLOUT_READINESS_BLOCKERS.CONTRACT_UNAVAILABLE
    });
  }

  if (healthStatus === OBSERVATION_HEALTH_CHECK_STATUS.INCOMPLETE || !observationAvailable) {
    return Object.freeze({
      status: ROLLOUT_READINESS_STATUS.NOT_READY,
      ready: false,
      blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.OBSERVATION_INCOMPLETE]),
      readinessReason:
        healthReason === "OBSERVATION_INCOMPLETE"
          ? healthReason
          : ROLLOUT_READINESS_BLOCKERS.OBSERVATION_INCOMPLETE
    });
  }

  return Object.freeze({
    status: ROLLOUT_READINESS_STATUS.UNKNOWN,
    ready: false,
    blockers: Object.freeze([ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN]),
    readinessReason: healthReason
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildRolloutReadinessResult(params) {
  return Object.freeze({
    ready: params.ready === true,
    status: params.status,
    healthStatus: params.healthStatus,
    observationAvailable: params.observationAvailable === true,
    contractAvailable: params.contractAvailable === true,
    lifecycle: params.lifecycle,
    health: params.health,
    severity: params.severity,
    recommendation: params.recommendation,
    blockers: params.blockers,
    readinessReason: params.readinessReason,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
}

/**
 * Evaluate recruitment workflow observation rollout readiness for a pipeline outcome.
 * Never throws. Never mutates the outcome. Never attaches or builds contracts.
 *
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>}
 */
function evaluateRecruitmentWorkflowObservationRolloutReadiness(outcome) {
  const health = checkRecruitmentWorkflowObservationHealth(outcome);
  const healthSummary = summarizeRecruitmentWorkflowObservationHealth(health);
  const rollout = resolveRolloutReadinessFromHealth(health);

  return buildRolloutReadinessResult({
    ready: rollout.ready,
    status: rollout.status,
    healthStatus: healthSummary.status,
    observationAvailable: healthSummary.observationAvailable,
    contractAvailable: healthSummary.contractAvailable,
    lifecycle: health.lifecycle,
    health: health.health,
    severity: health.severity,
    recommendation: health.recommendation,
    blockers: rollout.blockers,
    readinessReason: rollout.readinessReason
  });
}

/**
 * @param {Object|null|undefined} result
 * @returns {boolean}
 */
function isRecruitmentWorkflowObservationRolloutReady(result) {
  if (!isValidRolloutReadinessResult(result)) {
    return false;
  }

  return result.ready === true && result.status === ROLLOUT_READINESS_STATUS.READY;
}

/**
 * Summarize a recruitment workflow observation rollout readiness result.
 *
 * @param {Object|null|undefined} result
 * @returns {Readonly<{
 *   ready: boolean,
 *   status: string,
 *   healthStatus: string,
 *   contractAvailable: boolean,
 *   observationAvailable: boolean,
 *   blockers: ReadonlyArray<string>,
 *   readinessReason: string
 * }>}
 */
function summarizeRecruitmentWorkflowObservationRolloutReadiness(result) {
  if (!isValidRolloutReadinessResult(result)) {
    return EMPTY_ROLLOUT_READINESS_SUMMARY;
  }

  return Object.freeze({
    ready: result.ready === true,
    status: result.status,
    healthStatus: result.healthStatus,
    contractAvailable: result.contractAvailable === true,
    observationAvailable: result.observationAvailable === true,
    blockers: Object.freeze([...result.blockers]),
    readinessReason:
      typeof result.readinessReason === "string"
        ? result.readinessReason
        : ROLLOUT_READINESS_BLOCKERS.HEALTH_UNKNOWN
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_PHASE,
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_ENTITY,
  ROLLOUT_READINESS_STATUS,
  ROLLOUT_READINESS_BLOCKERS,
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_OBSERVATION_ROLLOUT_READINESS_METADATA,
  EMPTY_ROLLOUT_READINESS_SUMMARY,
  evaluateRecruitmentWorkflowObservationRolloutReadiness,
  isRecruitmentWorkflowObservationRolloutReady,
  summarizeRecruitmentWorkflowObservationRolloutReadiness
};
