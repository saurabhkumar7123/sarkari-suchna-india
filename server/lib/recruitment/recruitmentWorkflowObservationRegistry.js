"use strict";

/**
 * Phase 94 — Recruitment Workflow Observation Registry.
 *
 * Centralized WeakMap-backed registry that owns workflow integration
 * observations, coordinator diagnostics, and coordinator execution state.
 * Ensures the Phase 91 coordinator executes at most once per pipeline outcome.
 *
 * No Express. No database. No filesystem. No network access.
 * No global mutable state — WeakMap storage only.
 */

const WORKFLOW_OBSERVATION_REGISTRY_PHASE = 94;

const WORKFLOW_OBSERVATION_REGISTRY_ENTITY = "recruitment_workflow_observation_registry";

const WORKFLOW_OBSERVATION_REGISTRY_METADATA = Object.freeze({
  phase: WORKFLOW_OBSERVATION_REGISTRY_PHASE,
  advisoryOnly: true,
  observationOnly: true,
  architectureOnly: true,
  persistenceEnabled: false,
  performsPersistence: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesProduction: false,
  readsEnvironmentVariables: false,
  routing: false
});

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const workflowObservationByOutcome = new WeakMap();

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const workflowDiagnosticsByOutcome = new WeakMap();

/**
 * @type {WeakMap<Object, Readonly<Object>>}
 */
const coordinatorExecutionByOutcome = new WeakMap();

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
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekWorkflowObservation(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const observation = workflowObservationByOutcome.get(outcome);
  return observation == null ? null : observation;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {boolean}
 */
function hasWorkflowObservation(outcome) {
  return peekWorkflowObservation(outcome) != null;
}

/**
 * @param {Object|null|undefined} outcome
 * @param {Object|null|undefined} observation
 * @returns {Readonly<Object>|null}
 */
function recordWorkflowObservation(outcome, observation) {
  if (!isPlainObject(outcome) || !isPlainObject(observation)) {
    return null;
  }

  const stored = deepFreeze(observation);
  workflowObservationByOutcome.set(outcome, stored);
  return stored;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekWorkflowDiagnostics(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const diagnostics = workflowDiagnosticsByOutcome.get(outcome);
  return diagnostics == null ? null : diagnostics;
}

/**
 * @param {Object|null|undefined} outcome
 * @param {Object|null|undefined} diagnostics
 * @returns {Readonly<Object>|null}
 */
function recordWorkflowDiagnostics(outcome, diagnostics) {
  if (!isPlainObject(outcome) || !isPlainObject(diagnostics)) {
    return null;
  }

  const stored = deepFreeze({
    ...diagnostics,
    architectureOnly: true,
    observationOnly: true
  });
  workflowDiagnosticsByOutcome.set(outcome, stored);
  return stored;
}

/**
 * @param {Object|null|undefined} outcome
 * @returns {Readonly<Object>|null}
 */
function peekCoordinatorExecutionState(outcome) {
  if (!isPlainObject(outcome)) {
    return null;
  }
  const state = coordinatorExecutionByOutcome.get(outcome);
  return state == null ? null : state;
}

/**
 * @param {Object|null|undefined} outcome
 * @param {() => Object|null|undefined} factory
 * @returns {Readonly<Object>|null}
 */
function getOrCreateWorkflowObservation(outcome, factory) {
  if (!isPlainObject(outcome)) {
    return null;
  }

  const existing = peekWorkflowObservation(outcome);
  if (existing != null) {
    return existing;
  }

  if (typeof factory !== "function") {
    return null;
  }

  const observation = factory();
  if (!isPlainObject(observation)) {
    return null;
  }

  recordWorkflowObservation(outcome, observation);

  if (isPlainObject(observation.diagnostics)) {
    recordWorkflowDiagnostics(outcome, observation.diagnostics);
  }

  coordinatorExecutionByOutcome.set(
    outcome,
    deepFreeze({
      executed: true,
      observationOnly: true,
      architectureOnly: true
    })
  );

  return peekWorkflowObservation(outcome);
}

module.exports = {
  WORKFLOW_OBSERVATION_REGISTRY_PHASE,
  WORKFLOW_OBSERVATION_REGISTRY_ENTITY,
  WORKFLOW_OBSERVATION_REGISTRY_METADATA,
  peekWorkflowObservation,
  hasWorkflowObservation,
  recordWorkflowObservation,
  peekWorkflowDiagnostics,
  recordWorkflowDiagnostics,
  peekCoordinatorExecutionState,
  getOrCreateWorkflowObservation
};
