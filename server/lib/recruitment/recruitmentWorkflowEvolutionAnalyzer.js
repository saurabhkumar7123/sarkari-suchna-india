"use strict";

/**
 * Phase 127 — Recruitment Workflow Advisory Evolution Analyzer (Advisory Only).
 *
 * Pure advisory evolution analysis of a supplied snapshot comparison result.
 * No database access, no persistence, no runtime imports, no side effects.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_PHASE = 127;

const RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_ENTITY =
  "recruitment_workflow_evolution_analyzer";

const EVOLUTION_STATUS = Object.freeze({
  IMPROVED: "IMPROVED",
  REGRESSED: "REGRESSED",
  STABLE: "STABLE",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const PROGRESS_DIRECTION = Object.freeze({
  FORWARD: "FORWARD",
  BACKWARD: "BACKWARD",
  UNCHANGED: "UNCHANGED",
  UNKNOWN: "UNKNOWN"
});

const READINESS_STATUS_RANK = Object.freeze({
  NOT_STARTED: 0,
  BLOCKED: 0,
  PARTIALLY_READY: 25,
  REVIEW_READY: 50,
  APPROVAL_PENDING: 75,
  READY_FOR_STORAGE: 100
});

const WORKFLOW_STATE_RANK = Object.freeze({
  BLOCKED: 0,
  DRAFT_CREATED: 10,
  REVIEW_READY: 20,
  WAITING_FOR_APPROVAL: 30,
  APPROVED_FOR_STORAGE: 40,
  STORAGE_BOUNDARY_READY: 50
});

const READINESS_IMPROVEMENT_MESSAGES = Object.freeze({
  "APPROVAL_PENDING->READY_FOR_STORAGE": "Readiness advanced toward storage readiness",
  "->READY_FOR_STORAGE": "Readiness advanced toward storage readiness",
  "->REVIEW_READY": "Readiness advanced toward review readiness",
  "->APPROVAL_PENDING": "Readiness advanced toward approval readiness"
});

const READINESS_REGRESSION_MESSAGES = Object.freeze({
  "READY_FOR_STORAGE->APPROVAL_PENDING": "Readiness regressed from storage readiness",
  "READY_FOR_STORAGE->": "Readiness regressed from storage readiness",
  "->BLOCKED": "Readiness entered blocked state",
  "->NOT_STARTED": "Readiness regressed to not started"
});

const WORKFLOW_IMPROVEMENT_MESSAGES = Object.freeze({
  "DRAFT_CREATED->REVIEW_READY": "Workflow advanced to review-ready state",
  "REVIEW_READY->WAITING_FOR_APPROVAL": "Workflow advanced to approval pending state",
  "WAITING_FOR_APPROVAL->APPROVED_FOR_STORAGE":
    "Workflow approved and advancing toward storage readiness",
  "WAITING_FOR_APPROVAL->READY_FOR_STORAGE": "Workflow readiness improved after approval completion",
  "APPROVED_FOR_STORAGE->STORAGE_BOUNDARY_READY":
    "Workflow reached storage boundary readiness after approval",
  "BLOCKED->": "Workflow recovered from blocked state"
});

const WORKFLOW_REGRESSION_MESSAGES = Object.freeze({
  "->BLOCKED": "Workflow entered blocked state",
  "STORAGE_BOUNDARY_READY->APPROVED_FOR_STORAGE": "Workflow regressed from storage boundary readiness",
  "APPROVED_FOR_STORAGE->WAITING_FOR_APPROVAL": "Workflow regressed to approval pending state",
  "WAITING_FOR_APPROVAL->REVIEW_READY": "Workflow regressed from approval pending state",
  "REVIEW_READY->DRAFT_CREATED": "Workflow regressed from review-ready state"
});

const RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_127",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  historyTracking: false,
  snapshotPersistence: false,
  evolutionPersistence: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  sourcePhases: Object.freeze([126])
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
 * @param {*} comparisonResult
 * @returns {boolean}
 */
function isRecognizedComparisonResult(comparisonResult) {
  if (!isPlainObject(comparisonResult)) {
    return false;
  }

  if (typeof comparisonResult.changed !== "boolean") {
    return false;
  }

  if (
    comparisonResult.comparisonStatus != null &&
    typeof comparisonResult.comparisonStatus !== "string"
  ) {
    return false;
  }

  const arrayFields = [
    "workflowChanges",
    "readinessChanges",
    "capabilityChanges",
    "decisionChanges",
    "changedFields"
  ];

  for (let i = 0; i < arrayFields.length; i += 1) {
    const field = arrayFields[i];
    if (comparisonResult[field] != null && !Array.isArray(comparisonResult[field])) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string|null|undefined} value
 * @param {Readonly<Object>} rankMap
 * @returns {number|null}
 */
function rankValue(value, rankMap) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  if (rankMap[value] == null) {
    return null;
  }
  return rankMap[value];
}

/**
 * @param {Readonly<Object>} change
 * @returns {string}
 */
function workflowTransitionKey(change) {
  const from = typeof change.from === "string" ? change.from : "";
  const to = typeof change.to === "string" ? change.to : "";
  return `${from}->${to}`;
}

/**
 * @param {Readonly<Object>} change
 * @returns {string}
 */
function readinessTransitionKey(change) {
  const from = typeof change.from === "string" ? change.from : "";
  const to = typeof change.to === "string" ? change.to : "";
  return `${from}->${to}`;
}

/**
 * @param {Readonly<Object>} change
 * @param {string[]} improvementSignals
 * @param {string[]} regressionSignals
 * @returns {boolean}
 */
function analyzeWorkflowChange(change, improvementSignals, regressionSignals) {
  if (!isPlainObject(change)) {
    return false;
  }

  const transitionKey = workflowTransitionKey(change);
  const fromRank = rankValue(change.from, WORKFLOW_STATE_RANK);
  const toRank = rankValue(change.to, WORKFLOW_STATE_RANK);

  if (change.to === "BLOCKED") {
    const message =
      WORKFLOW_REGRESSION_MESSAGES["->BLOCKED"] || "Workflow entered blocked state";
    if (!regressionSignals.includes(message)) {
      regressionSignals.push(message);
    }
    return true;
  }

  if (change.from === "BLOCKED" && change.to !== "BLOCKED") {
    const message =
      WORKFLOW_IMPROVEMENT_MESSAGES["BLOCKED->"] || "Workflow recovered from blocked state";
    if (!improvementSignals.includes(message)) {
      improvementSignals.push(message);
    }
    return false;
  }

  if (WORKFLOW_IMPROVEMENT_MESSAGES[transitionKey] != null) {
    const message = WORKFLOW_IMPROVEMENT_MESSAGES[transitionKey];
    if (!improvementSignals.includes(message)) {
      improvementSignals.push(message);
    }
    return false;
  }

  if (WORKFLOW_REGRESSION_MESSAGES[transitionKey] != null) {
    const message = WORKFLOW_REGRESSION_MESSAGES[transitionKey];
    if (!regressionSignals.includes(message)) {
      regressionSignals.push(message);
    }
    return false;
  }

  if (fromRank != null && toRank != null) {
    if (toRank > fromRank) {
      const message = `Workflow state advanced from ${change.from} to ${change.to}`;
      if (!improvementSignals.includes(message)) {
        improvementSignals.push(message);
      }
      return false;
    }
    if (toRank < fromRank) {
      const message = `Workflow state regressed from ${change.from} to ${change.to}`;
      if (!regressionSignals.includes(message)) {
        regressionSignals.push(message);
      }
      return false;
    }
  }

  return false;
}

/**
 * @param {Readonly<Object>} change
 * @param {string[]} improvementSignals
 * @param {string[]} regressionSignals
 * @returns {boolean}
 */
function analyzeReadinessChange(change, improvementSignals, regressionSignals) {
  if (!isPlainObject(change)) {
    return false;
  }

  if (change.field === "score") {
    if (typeof change.from === "number" && typeof change.to === "number") {
      if (change.to > change.from) {
        const message = "Workflow readiness score improved";
        if (!improvementSignals.includes(message)) {
          improvementSignals.push(message);
        }
        return false;
      }
      if (change.to < change.from) {
        const message = "Workflow readiness score declined";
        if (!regressionSignals.includes(message)) {
          regressionSignals.push(message);
        }
        return false;
      }
    }
    return false;
  }

  if (change.field !== "status") {
    return false;
  }

  const transitionKey = readinessTransitionKey(change);

  if (change.to === "BLOCKED") {
    const message =
      READINESS_REGRESSION_MESSAGES["->BLOCKED"] || "Readiness entered blocked state";
    if (!regressionSignals.includes(message)) {
      regressionSignals.push(message);
    }
    return true;
  }

  if (READINESS_IMPROVEMENT_MESSAGES[transitionKey] != null) {
    const message = READINESS_IMPROVEMENT_MESSAGES[transitionKey];
    if (!improvementSignals.includes(message)) {
      improvementSignals.push(message);
    }
    return false;
  }

  if (READINESS_REGRESSION_MESSAGES[transitionKey] != null) {
    const message = READINESS_REGRESSION_MESSAGES[transitionKey];
    if (!regressionSignals.includes(message)) {
      regressionSignals.push(message);
    }
    return false;
  }

  const fromRank = rankValue(change.from, READINESS_STATUS_RANK);
  const toRank = rankValue(change.to, READINESS_STATUS_RANK);

  if (fromRank != null && toRank != null) {
    if (toRank > fromRank) {
      const message = `Readiness status advanced from ${change.from} to ${change.to}`;
      if (!improvementSignals.includes(message)) {
        improvementSignals.push(message);
      }
      return false;
    }
    if (toRank < fromRank) {
      const message = `Readiness status regressed from ${change.from} to ${change.to}`;
      if (!regressionSignals.includes(message)) {
        regressionSignals.push(message);
      }
      return false;
    }
  }

  return false;
}

/**
 * @param {Readonly<Object>} change
 * @param {string[]} improvementSignals
 * @param {string[]} regressionSignals
 */
function analyzeCapabilityChange(change, improvementSignals, regressionSignals) {
  if (!isPlainObject(change)) {
    return;
  }

  if (change.field === "available") {
    if (typeof change.from === "number" && typeof change.to === "number") {
      if (change.to > change.from) {
        const message = "Capability availability improved";
        if (!improvementSignals.includes(message)) {
          improvementSignals.push(message);
        }
      } else if (change.to < change.from) {
        const message = "Capability availability declined";
        if (!regressionSignals.includes(message)) {
          regressionSignals.push(message);
        }
      }
    }
    return;
  }

  if (change.field === "total") {
    if (typeof change.from === "number" && typeof change.to === "number" && change.to < change.from) {
      const message = "Capability scope reduced";
      if (!regressionSignals.includes(message)) {
        regressionSignals.push(message);
      }
    }
  }
}

/**
 * @param {string} evolutionStatus
 * @param {string} progressDirection
 * @param {Readonly<Object>|null|undefined} comparisonResult
 * @returns {string}
 */
function buildEvolutionSummary(evolutionStatus, progressDirection, comparisonResult) {
  if (evolutionStatus === EVOLUTION_STATUS.IMPROVED) {
    if (
      comparisonResult != null &&
      typeof comparisonResult.summary === "string" &&
      comparisonResult.summary.length > 0
    ) {
      return "Workflow advisory state improved";
    }
    return "Workflow advisory state improved";
  }

  if (evolutionStatus === EVOLUTION_STATUS.REGRESSED) {
    return "Workflow advisory state regressed";
  }

  if (evolutionStatus === EVOLUTION_STATUS.STABLE) {
    return "Workflow advisory state unchanged";
  }

  if (evolutionStatus === EVOLUTION_STATUS.BLOCKED) {
    return "Workflow advisory state blocked";
  }

  if (progressDirection === PROGRESS_DIRECTION.UNCHANGED) {
    return "Workflow advisory state unchanged";
  }

  return "Workflow evolution could not be determined";
}

/**
 * @param {string} evolutionStatus
 * @param {string} progressDirection
 * @param {string[]} improvementSignals
 * @param {string[]} regressionSignals
 * @param {string[]} unchangedSignals
 * @param {string} summary
 * @returns {Readonly<Object>}
 */
function buildEvolutionResult(
  evolutionStatus,
  progressDirection,
  improvementSignals,
  regressionSignals,
  unchangedSignals,
  summary
) {
  return deepFreeze({
    evolutionStatus,
    progressDirection,
    improvementSignals: Object.freeze(improvementSignals.slice()),
    regressionSignals: Object.freeze(regressionSignals.slice()),
    unchangedSignals: Object.freeze(unchangedSignals.slice()),
    summary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_127",
      phase: RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      snapshotPersistence: false,
      evolutionPersistence: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryEvolutionOnly: true
    })
  });
}

/**
 * Analyze a snapshot comparison result and describe workflow progress direction.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} comparisonResult
 * @returns {Readonly<Object>}
 */
function analyzeRecruitmentWorkflowEvolution(comparisonResult) {
  if (!isRecognizedComparisonResult(comparisonResult)) {
    return buildEvolutionResult(
      EVOLUTION_STATUS.UNKNOWN,
      PROGRESS_DIRECTION.UNKNOWN,
      [],
      [],
      [],
      "Workflow evolution could not be determined"
    );
  }

  const changed = comparisonResult.changed === true;
  const comparisonStatus = comparisonResult.comparisonStatus;
  const workflowChanges = Array.isArray(comparisonResult.workflowChanges)
    ? comparisonResult.workflowChanges
    : [];
  const readinessChanges = Array.isArray(comparisonResult.readinessChanges)
    ? comparisonResult.readinessChanges
    : [];
  const capabilityChanges = Array.isArray(comparisonResult.capabilityChanges)
    ? comparisonResult.capabilityChanges
    : [];

  const improvementSignals = [];
  const regressionSignals = [];
  const unchangedSignals = [];
  let blockedEntry = false;

  for (let i = 0; i < workflowChanges.length; i += 1) {
    if (analyzeWorkflowChange(workflowChanges[i], improvementSignals, regressionSignals)) {
      blockedEntry = true;
    }
  }

  for (let i = 0; i < readinessChanges.length; i += 1) {
    if (analyzeReadinessChange(readinessChanges[i], improvementSignals, regressionSignals)) {
      blockedEntry = true;
    }
  }

  for (let i = 0; i < capabilityChanges.length; i += 1) {
    analyzeCapabilityChange(capabilityChanges[i], improvementSignals, regressionSignals);
  }

  if (blockedEntry) {
    return buildEvolutionResult(
      EVOLUTION_STATUS.BLOCKED,
      PROGRESS_DIRECTION.BACKWARD,
      Object.freeze(improvementSignals.slice()),
      Object.freeze(regressionSignals.slice()),
      [],
      buildEvolutionSummary(EVOLUTION_STATUS.BLOCKED, PROGRESS_DIRECTION.BACKWARD, comparisonResult)
    );
  }

  if (!changed || comparisonStatus === "UNCHANGED") {
    unchangedSignals.push("No workflow evolution detected");
    return buildEvolutionResult(
      EVOLUTION_STATUS.STABLE,
      PROGRESS_DIRECTION.UNCHANGED,
      [],
      [],
      unchangedSignals,
      buildEvolutionSummary(EVOLUTION_STATUS.STABLE, PROGRESS_DIRECTION.UNCHANGED, comparisonResult)
    );
  }

  if (comparisonStatus === "EMPTY" && !changed) {
    return buildEvolutionResult(
      EVOLUTION_STATUS.UNKNOWN,
      PROGRESS_DIRECTION.UNKNOWN,
      [],
      [],
      [],
      "Workflow evolution could not be determined"
    );
  }

  if (improvementSignals.length === 0 && regressionSignals.length === 0 && changed) {
    return buildEvolutionResult(
      EVOLUTION_STATUS.UNKNOWN,
      PROGRESS_DIRECTION.UNKNOWN,
      [],
      [],
      [],
      "Workflow evolution could not be determined"
    );
  }

  let evolutionStatus = EVOLUTION_STATUS.STABLE;
  let progressDirection = PROGRESS_DIRECTION.UNCHANGED;

  if (improvementSignals.length > 0 && regressionSignals.length === 0) {
    evolutionStatus = EVOLUTION_STATUS.IMPROVED;
    progressDirection = PROGRESS_DIRECTION.FORWARD;
  } else if (regressionSignals.length > 0 && improvementSignals.length === 0) {
    evolutionStatus = EVOLUTION_STATUS.REGRESSED;
    progressDirection = PROGRESS_DIRECTION.BACKWARD;
  } else if (improvementSignals.length > regressionSignals.length) {
    evolutionStatus = EVOLUTION_STATUS.IMPROVED;
    progressDirection = PROGRESS_DIRECTION.FORWARD;
  } else if (regressionSignals.length > improvementSignals.length) {
    evolutionStatus = EVOLUTION_STATUS.REGRESSED;
    progressDirection = PROGRESS_DIRECTION.BACKWARD;
  } else if (improvementSignals.length > 0 && regressionSignals.length > 0) {
    evolutionStatus = EVOLUTION_STATUS.STABLE;
    progressDirection = PROGRESS_DIRECTION.UNCHANGED;
    unchangedSignals.push("Mixed workflow evolution signals offset each other");
  }

  return buildEvolutionResult(
    evolutionStatus,
    progressDirection,
    improvementSignals,
    regressionSignals,
    unchangedSignals,
    buildEvolutionSummary(evolutionStatus, progressDirection, comparisonResult)
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_PHASE,
  RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_ENTITY,
  EVOLUTION_STATUS,
  PROGRESS_DIRECTION,
  RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA,
  analyzeRecruitmentWorkflowEvolution
};
