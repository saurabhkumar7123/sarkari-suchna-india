"use strict";

/**
 * Phase 126 — Recruitment Workflow Snapshot Comparison Model (Advisory Only).
 *
 * Pure advisory comparison of two supplied workflow advisory snapshots.
 * No database access, no persistence, no runtime imports, no side effects.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_PHASE = 126;

const RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_ENTITY =
  "recruitment_workflow_snapshot_comparison";

const COMPARISON_STATUS = Object.freeze({
  CHANGED: "CHANGED",
  UNCHANGED: "UNCHANGED",
  EMPTY: "EMPTY"
});

const RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_126",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  historyTracking: false,
  snapshotPersistence: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false
});

const EMPTY_NORMALIZED_SNAPSHOT = Object.freeze({
  workflowState: null,
  nextAction: null,
  readinessStatus: null,
  readinessScore: null,
  capabilityTotal: null,
  capabilityAvailable: null,
  decisionSummary: null,
  decisionTraceEntries: null,
  reportSummary: null
});

const COMPARABLE_FIELD_DEFS = Object.freeze([
  { path: "workflowSnapshot.state", key: "workflowState", category: "workflow", workflowField: "state" },
  { path: "workflowSnapshot.nextAction", key: "nextAction", category: "workflow", workflowField: "nextAction" },
  { path: "readinessSnapshot.status", key: "readinessStatus", category: "readiness", readinessField: "status" },
  { path: "readinessSnapshot.score", key: "readinessScore", category: "readiness", readinessField: "score" },
  { path: "capabilitySnapshot.total", key: "capabilityTotal", category: "capability", capabilityField: "total" },
  {
    path: "capabilitySnapshot.available",
    key: "capabilityAvailable",
    category: "capability",
    capabilityField: "available"
  },
  { path: "decisionSnapshot.summary", key: "decisionSummary", category: "decision", decisionField: "summary" },
  {
    path: "decisionSnapshot.traceEntries",
    key: "decisionTraceEntries",
    category: "decision",
    decisionField: "traceEntries"
  },
  { path: "reportSummary", key: "reportSummary", category: "report", reportField: "reportSummary" }
]);

const WORKFLOW_TRANSITION_SUMMARIES = Object.freeze({
  "WAITING_FOR_APPROVAL->READY_FOR_STORAGE":
    "Workflow readiness improved after approval completion",
  "WAITING_FOR_APPROVAL->APPROVED_FOR_STORAGE":
    "Workflow approved and advancing toward storage readiness",
  "WAITING_FOR_APPROVAL->STORAGE_BOUNDARY_READY":
    "Workflow completed approval and reached storage boundary readiness",
  "DRAFT_CREATED->REVIEW_READY": "Workflow advanced to review-ready state",
  "REVIEW_READY->WAITING_FOR_APPROVAL": "Workflow advanced to approval pending state",
  "APPROVED_FOR_STORAGE->STORAGE_BOUNDARY_READY":
    "Workflow reached storage boundary readiness after approval",
  "->BLOCKED": "Workflow entered blocked state",
  "BLOCKED->": "Workflow recovered from blocked state"
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

function valuesEqual(left, right) {
  if (left === right) {
    return true;
  }
  if (left == null && right == null) {
    return true;
  }
  return false;
}

/**
 * @param {*} snapshot
 * @returns {Readonly<Object>}
 */
function normalizeComparableSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    return EMPTY_NORMALIZED_SNAPSHOT;
  }

  const workflowSnapshot = isPlainObject(snapshot.workflowSnapshot) ? snapshot.workflowSnapshot : {};
  const readinessSnapshot = isPlainObject(snapshot.readinessSnapshot) ? snapshot.readinessSnapshot : {};
  const capabilitySnapshot = isPlainObject(snapshot.capabilitySnapshot) ? snapshot.capabilitySnapshot : {};
  const decisionSnapshot = isPlainObject(snapshot.decisionSnapshot) ? snapshot.decisionSnapshot : {};

  const workflowState =
    typeof workflowSnapshot.state === "string" && workflowSnapshot.state.length > 0
      ? workflowSnapshot.state
      : null;
  const nextAction =
    workflowSnapshot.nextAction === null
      ? null
      : typeof workflowSnapshot.nextAction === "string" && workflowSnapshot.nextAction.length > 0
        ? workflowSnapshot.nextAction
        : null;
  const readinessStatus =
    typeof readinessSnapshot.status === "string" && readinessSnapshot.status.length > 0
      ? readinessSnapshot.status
      : null;
  const readinessScore =
    typeof readinessSnapshot.score === "number" && Number.isFinite(readinessSnapshot.score)
      ? readinessSnapshot.score
      : null;
  const capabilityTotal =
    typeof capabilitySnapshot.total === "number" && Number.isFinite(capabilitySnapshot.total)
      ? capabilitySnapshot.total
      : null;
  const capabilityAvailable =
    typeof capabilitySnapshot.available === "number" && Number.isFinite(capabilitySnapshot.available)
      ? capabilitySnapshot.available
      : null;
  const decisionSummary =
    typeof decisionSnapshot.summary === "string" && decisionSnapshot.summary.length > 0
      ? decisionSnapshot.summary
      : decisionSnapshot.summary === null
        ? null
        : null;
  const decisionTraceEntries =
    typeof decisionSnapshot.traceEntries === "number" && Number.isFinite(decisionSnapshot.traceEntries)
      ? decisionSnapshot.traceEntries
      : null;
  const reportSummary =
    typeof snapshot.reportSummary === "string" && snapshot.reportSummary.length > 0
      ? snapshot.reportSummary
      : snapshot.reportSummary === null
        ? null
        : null;

  return Object.freeze({
    workflowState,
    nextAction,
    readinessStatus,
    readinessScore,
    capabilityTotal,
    capabilityAvailable,
    decisionSummary,
    decisionTraceEntries,
    reportSummary
  });
}

/**
 * @param {Readonly<Object>} normalized
 * @returns {boolean}
 */
function isEmptyNormalizedSnapshot(normalized) {
  const keys = Object.keys(normalized);
  for (let i = 0; i < keys.length; i += 1) {
    if (normalized[keys[i]] != null) {
      return false;
    }
  }
  return true;
}

/**
 * @param {*} previousValue
 * @param {*} currentValue
 * @param {Readonly<Object>} fieldDef
 * @returns {Readonly<Object>|null}
 */
function buildCategoryChange(previousValue, currentValue, fieldDef) {
  if (valuesEqual(previousValue, currentValue)) {
    return null;
  }

  if (fieldDef.category === "workflow") {
    if (fieldDef.workflowField === "state") {
      return Object.freeze({
        from: previousValue,
        to: currentValue
      });
    }

    return Object.freeze({
      field: fieldDef.workflowField,
      from: previousValue,
      to: currentValue
    });
  }

  if (fieldDef.category === "readiness") {
    return Object.freeze({
      field: fieldDef.readinessField,
      from: previousValue,
      to: currentValue
    });
  }

  if (fieldDef.category === "capability") {
    return Object.freeze({
      field: fieldDef.capabilityField,
      from: previousValue,
      to: currentValue
    });
  }

  if (fieldDef.category === "decision") {
    return Object.freeze({
      field: fieldDef.decisionField,
      from: previousValue,
      to: currentValue
    });
  }

  if (fieldDef.category === "report") {
    return Object.freeze({
      field: fieldDef.reportField,
      from: previousValue,
      to: currentValue
    });
  }

  return null;
}

/**
 * @param {Readonly<Object>} previous
 * @param {Readonly<Object>} current
 * @param {string[]} changedFields
 * @param {Readonly<Object>[]} workflowChanges
 * @param {Readonly<Object>[]} readinessChanges
 * @returns {string}
 */
function buildComparisonSummary(previous, current, changedFields, workflowChanges, readinessChanges) {
  if (changedFields.length === 0) {
    if (isEmptyNormalizedSnapshot(previous) && isEmptyNormalizedSnapshot(current)) {
      return "No advisory snapshot data to compare";
    }
    return "No advisory snapshot changes detected";
  }

  for (let i = 0; i < workflowChanges.length; i += 1) {
    const change = workflowChanges[i];
    if (change.from != null && change.to != null && change.field == null) {
      const transitionKey = `${change.from}->${change.to}`;
      if (WORKFLOW_TRANSITION_SUMMARIES[transitionKey] != null) {
        return WORKFLOW_TRANSITION_SUMMARIES[transitionKey];
      }
      if (change.to === "BLOCKED") {
        return WORKFLOW_TRANSITION_SUMMARIES["->BLOCKED"];
      }
      if (change.from === "BLOCKED") {
        return WORKFLOW_TRANSITION_SUMMARIES["BLOCKED->"];
      }
    }
  }

  for (let i = 0; i < readinessChanges.length; i += 1) {
    const change = readinessChanges[i];
    if (
      change.field === "score" &&
      typeof change.from === "number" &&
      typeof change.to === "number"
    ) {
      if (change.to > change.from) {
        return "Workflow readiness score improved";
      }
      if (change.to < change.from) {
        return "Workflow readiness score declined";
      }
    }
    if (
      change.field === "status" &&
      change.to === "READY_FOR_STORAGE" &&
      change.from === "APPROVAL_PENDING"
    ) {
      return "Workflow readiness improved after approval completion";
    }
  }

  if (changedFields.length === 1) {
    return `Advisory snapshot change detected in ${changedFields[0]}`;
  }

  return `Advisory snapshot changes detected across ${changedFields.length} fields`;
}

/**
 * Compare two advisory workflow snapshots and describe what changed.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} previousSnapshot
 * @param {Object|null|undefined} currentSnapshot
 * @returns {Readonly<Object>}
 */
function compareRecruitmentWorkflowSnapshots(previousSnapshot, currentSnapshot) {
  const previous = normalizeComparableSnapshot(previousSnapshot);
  const current = normalizeComparableSnapshot(currentSnapshot);

  const changedFields = [];
  const workflowChanges = [];
  const readinessChanges = [];
  const capabilityChanges = [];
  const decisionChanges = [];

  for (let i = 0; i < COMPARABLE_FIELD_DEFS.length; i += 1) {
    const fieldDef = COMPARABLE_FIELD_DEFS[i];
    const previousValue = previous[fieldDef.key];
    const currentValue = current[fieldDef.key];

    if (valuesEqual(previousValue, currentValue)) {
      continue;
    }

    changedFields.push(fieldDef.path);

    const categoryChange = buildCategoryChange(previousValue, currentValue, fieldDef);
    if (categoryChange == null) {
      continue;
    }

    if (fieldDef.category === "workflow") {
      workflowChanges.push(categoryChange);
    } else if (fieldDef.category === "readiness") {
      readinessChanges.push(categoryChange);
    } else if (fieldDef.category === "capability") {
      capabilityChanges.push(categoryChange);
    } else if (fieldDef.category === "decision") {
      decisionChanges.push(categoryChange);
    }
  }

  const bothEmpty = isEmptyNormalizedSnapshot(previous) && isEmptyNormalizedSnapshot(current);
  const changed = changedFields.length > 0;

  let comparisonStatus = COMPARISON_STATUS.UNCHANGED;
  if (bothEmpty) {
    comparisonStatus = COMPARISON_STATUS.EMPTY;
  } else if (changed) {
    comparisonStatus = COMPARISON_STATUS.CHANGED;
  }

  const summary = buildComparisonSummary(
    previous,
    current,
    changedFields,
    workflowChanges,
    readinessChanges
  );

  return deepFreeze({
    changed,
    comparisonStatus,
    changedFields: Object.freeze(changedFields.slice()),
    workflowChanges: Object.freeze(workflowChanges.slice()),
    readinessChanges: Object.freeze(readinessChanges.slice()),
    capabilityChanges: Object.freeze(capabilityChanges.slice()),
    decisionChanges: Object.freeze(decisionChanges.slice()),
    summary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_126",
      phase: RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      snapshotPersistence: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      advisoryComparisonOnly: true
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_PHASE,
  RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_ENTITY,
  COMPARISON_STATUS,
  RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA,
  compareRecruitmentWorkflowSnapshots
};
