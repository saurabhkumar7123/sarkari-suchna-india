'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Health Status Model (Advisory Only)
 *
 * Advisory health states for pipeline stages. No automatic recovery.
 * Status transitions are evaluation results from supplied observations.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const HEALTH_STATUS = Object.freeze({
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  DEGRADED: 'DEGRADED',
  BLOCKED: 'BLOCKED',
  UNKNOWN: 'UNKNOWN',
});

const HEALTH_STATUS_RANK = Object.freeze({
  HEALTHY: 0,
  WARNING: 1,
  DEGRADED: 2,
  BLOCKED: 3,
  UNKNOWN: 4,
});

const VALID_HEALTH_STATUSES = Object.freeze(Object.keys(HEALTH_STATUS));

function normalizeStatus(value) {
  if (typeof value !== 'string') return HEALTH_STATUS.UNKNOWN;
  const upper = value.trim().toUpperCase();
  if (VALID_HEALTH_STATUSES.indexOf(upper) !== -1) {
    return upper;
  }
  return HEALTH_STATUS.UNKNOWN;
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) return [];
  const notes = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === 'string' && value[i].trim()) {
      notes.push(value[i].trim());
    }
  }
  return notes;
}

/**
 * Build a stage health snapshot from observation input.
 * @param {object} input
 */
function buildStageHealthState(input = {}) {
  const stageId =
    typeof input.stageId === 'string' && input.stageId.trim()
      ? input.stageId.trim()
      : 'UNKNOWN_STAGE';
  const status = normalizeStatus(input.status);
  const summary =
    typeof input.summary === 'string' && input.summary.trim()
      ? input.summary.trim()
      : defaultSummaryForStatus(status, stageId);
  const lastEvaluatedAt =
    typeof input.lastEvaluatedAt === 'string' && input.lastEvaluatedAt.trim()
      ? input.lastEvaluatedAt.trim()
      : null;
  const advisoryNotes = normalizeNotes(input.advisoryNotes || input.notes);

  return deepFreeze({
    stageId,
    status,
    summary,
    lastEvaluatedAt,
    advisoryNotes,
    automaticRecovery: false,
    advisoryOnly: true,
  });
}

function defaultSummaryForStatus(status, stageId) {
  switch (status) {
    case HEALTH_STATUS.HEALTHY:
      return `${stageId} is healthy.`;
    case HEALTH_STATUS.WARNING:
      return `${stageId} has advisory warnings.`;
    case HEALTH_STATUS.DEGRADED:
      return `${stageId} is degraded.`;
    case HEALTH_STATUS.BLOCKED:
      return `${stageId} is blocked.`;
    default:
      return `${stageId} health is unknown.`;
  }
}

/**
 * Evaluate advisory status from observation signals.
 * Does not recover or mutate pipeline state.
 * @param {object} observation
 */
function evaluateHealthStatus(observation = {}) {
  if (observation == null || typeof observation !== 'object') {
    return HEALTH_STATUS.UNKNOWN;
  }

  if (typeof observation.status === 'string' && observation.status.trim()) {
    return normalizeStatus(observation.status);
  }

  if (observation.blocked === true || observation.blocking === true) {
    return HEALTH_STATUS.BLOCKED;
  }

  const missingPrerequisites = Array.isArray(observation.missingPrerequisites)
    ? observation.missingPrerequisites
    : [];
  if (missingPrerequisites.length > 0) {
    return HEALTH_STATUS.BLOCKED;
  }

  const dependencyIssues = Array.isArray(observation.dependencyIssues)
    ? observation.dependencyIssues
    : [];
  if (dependencyIssues.length > 0) {
    return HEALTH_STATUS.BLOCKED;
  }

  const validationFailures = Array.isArray(observation.validationFailures)
    ? observation.validationFailures
    : [];
  if (validationFailures.length > 0) {
    return HEALTH_STATUS.DEGRADED;
  }

  const configurationProblems = Array.isArray(observation.configurationProblems)
    ? observation.configurationProblems
    : [];
  if (configurationProblems.length > 0) {
    return HEALTH_STATUS.DEGRADED;
  }

  const warnings = Array.isArray(observation.warnings)
    ? observation.warnings
    : [];
  if (warnings.length > 0 || observation.warning === true) {
    return HEALTH_STATUS.WARNING;
  }

  if (observation.healthy === true || observation.ok === true) {
    return HEALTH_STATUS.HEALTHY;
  }

  if (observation.evaluated === true || observation.observed === true) {
    return HEALTH_STATUS.HEALTHY;
  }

  return HEALTH_STATUS.UNKNOWN;
}

/**
 * Advisory status transition: previous → evaluated next.
 * Never auto-recovers; BLOCKED/DEGRADED stay unless observation clears them.
 * @param {string} previousStatus
 * @param {object} observation
 */
function transitionHealthStatus(previousStatus, observation = {}) {
  const previous = normalizeStatus(previousStatus);
  const next = evaluateHealthStatus(observation);

  // Explicit status in observation always wins (advisory evaluation).
  if (
    observation &&
    typeof observation.status === 'string' &&
    observation.status.trim()
  ) {
    return deepFreeze({
      previous,
      next: normalizeStatus(observation.status),
      changed: normalizeStatus(observation.status) !== previous,
      automaticRecovery: false,
      advisoryOnly: true,
      reason: 'EXPLICIT_OBSERVATION_STATUS',
    });
  }

  // No automatic recovery: if previous was BLOCKED and observation is empty/unknown, stay BLOCKED.
  if (
    previous === HEALTH_STATUS.BLOCKED &&
    next === HEALTH_STATUS.UNKNOWN &&
    !(observation && observation.clearBlock === true)
  ) {
    return deepFreeze({
      previous,
      next: HEALTH_STATUS.BLOCKED,
      changed: false,
      automaticRecovery: false,
      advisoryOnly: true,
      reason: 'NO_AUTOMATIC_RECOVERY_FROM_BLOCKED',
    });
  }

  if (
    previous === HEALTH_STATUS.DEGRADED &&
    next === HEALTH_STATUS.UNKNOWN &&
    !(observation && observation.clearDegraded === true)
  ) {
    return deepFreeze({
      previous,
      next: HEALTH_STATUS.DEGRADED,
      changed: false,
      automaticRecovery: false,
      advisoryOnly: true,
      reason: 'NO_AUTOMATIC_RECOVERY_FROM_DEGRADED',
    });
  }

  return deepFreeze({
    previous,
    next,
    changed: next !== previous,
    automaticRecovery: false,
    advisoryOnly: true,
    reason: 'EVALUATED_FROM_OBSERVATION',
  });
}

function worseStatus(a, b) {
  const left = normalizeStatus(a);
  const right = normalizeStatus(b);
  const leftRank = HEALTH_STATUS_RANK[left];
  const rightRank = HEALTH_STATUS_RANK[right];
  // UNKNOWN should not dominate HEALTHY when aggregating known states,
  // but for "worst of" we treat UNKNOWN as least informative — prefer known severity.
  if (left === HEALTH_STATUS.UNKNOWN) return right;
  if (right === HEALTH_STATUS.UNKNOWN) return left;
  return leftRank >= rightRank ? left : right;
}

function aggregateOverallHealth(stageStates) {
  if (!Array.isArray(stageStates) || stageStates.length === 0) {
    return HEALTH_STATUS.UNKNOWN;
  }

  let overall = HEALTH_STATUS.HEALTHY;
  let sawKnown = false;

  for (let i = 0; i < stageStates.length; i += 1) {
    const status = normalizeStatus(
      stageStates[i] && stageStates[i].status
        ? stageStates[i].status
        : stageStates[i]
    );
    if (status === HEALTH_STATUS.UNKNOWN) {
      continue;
    }
    sawKnown = true;
    overall = worseStatus(overall, status);
  }

  return sawKnown ? overall : HEALTH_STATUS.UNKNOWN;
}

module.exports = {
  HEALTH_STATUS,
  HEALTH_STATUS_RANK,
  VALID_HEALTH_STATUSES,
  normalizeStatus,
  buildStageHealthState,
  evaluateHealthStatus,
  transitionHealthStatus,
  worseStatus,
  aggregateOverallHealth,
};
