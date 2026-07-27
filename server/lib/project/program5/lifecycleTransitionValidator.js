'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle Transition Validator (Deterministic / Advisory)
 *
 * Validates:
 *   - Missing prerequisites
 *   - Invalid transitions
 *   - State consistency
 *   - Dependency violations
 *
 * Generates diagnostics only. Never modifies state automatically.
 */

const {
  deepFreeze,
  normalizeLifecycleState,
  getDefaultLifecycleDefinition,
} = require('./lifecycleDefinition');
const {
  getDefaultLifecycleTransitionRules,
  isLifecycleTransitionAllowed,
  listAllowedNextStates,
} = require('./lifecycleTransitionRules');
const {
  getDefaultLifecycleGateRegistry,
  evaluateLifecycleGates,
} = require('./lifecycleGates');

const LIFECYCLE_TRANSITION_VALIDATOR_VERSION = '5C.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

const DIAGNOSTIC_CODES = Object.freeze({
  INVALID_FROM_STATE: 'INVALID_FROM_STATE',
  INVALID_TO_STATE: 'INVALID_TO_STATE',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  STATE_CONSISTENCY_MISMATCH: 'STATE_CONSISTENCY_MISMATCH',
  MISSING_PREREQUISITES: 'MISSING_PREREQUISITES',
  GATE_FAILURE: 'GATE_FAILURE',
  GATE_MISSING: 'GATE_MISSING',
  DEPENDENCY_VIOLATION: 'DEPENDENCY_VIOLATION',
  TERMINAL_STATE_TRANSITION: 'TERMINAL_STATE_TRANSITION',
  SAME_STATE_TRANSITION: 'SAME_STATE_TRANSITION',
});

function pushDiagnostic(list, code, severity, message, detail) {
  list.push({
    code,
    severity,
    message,
    detail: detail || null,
    automaticCorrection: false,
  });
}

/**
 * Deterministically validate a proposed lifecycle transition.
 *
 * @param {object} input
 * @param {string} input.fromState
 * @param {string} input.toState
 * @param {string} [input.currentState] claimed current state for consistency check
 * @param {object} [input.gateObservations]
 * @param {string[]} [input.satisfiedDependencies] upstream states considered complete
 * @param {object} [input.definition]
 * @param {object} [input.rules]
 * @param {object} [input.gateRegistry]
 */
function validateLifecycleTransition(input = {}) {
  const definition = input.definition || getDefaultLifecycleDefinition();
  const rules =
    input.rules || getDefaultLifecycleTransitionRules(definition);
  const gateRegistry =
    input.gateRegistry || getDefaultLifecycleGateRegistry(definition);

  const fromId = normalizeLifecycleState(input.fromState);
  const toId = normalizeLifecycleState(input.toState);
  const currentId = normalizeLifecycleState(input.currentState);

  const diagnostics = [];
  let transitionAllowed = false;

  if (!fromId || !definition.byId[fromId]) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_CODES.INVALID_FROM_STATE,
      DIAGNOSTIC_SEVERITY.ERROR,
      `From state is not a recognized lifecycle state: ${String(input.fromState)}`,
      { fromState: input.fromState }
    );
  }

  if (!toId || !definition.byId[toId]) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_CODES.INVALID_TO_STATE,
      DIAGNOSTIC_SEVERITY.ERROR,
      `To state is not a recognized lifecycle state: ${String(input.toState)}`,
      { toState: input.toState }
    );
  }

  if (
    currentId &&
    fromId &&
    currentId !== fromId
  ) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_CODES.STATE_CONSISTENCY_MISMATCH,
      DIAGNOSTIC_SEVERITY.ERROR,
      `Claimed current state (${currentId}) does not match transition from-state (${fromId})`,
      { currentState: currentId, fromState: fromId }
    );
  }

  if (fromId && toId && fromId === toId) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_CODES.SAME_STATE_TRANSITION,
      DIAGNOSTIC_SEVERITY.WARNING,
      'Transition from a state to itself is not a progression',
      { state: fromId }
    );
  }

  if (fromId && definition.byId[fromId] && definition.byId[fromId].terminal && toId) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_CODES.TERMINAL_STATE_TRANSITION,
      DIAGNOSTIC_SEVERITY.ERROR,
      `Cannot transition out of terminal state ${fromId}`,
      { fromState: fromId, toState: toId }
    );
  }

  if (fromId && toId && definition.byId[fromId] && definition.byId[toId]) {
    transitionAllowed = isLifecycleTransitionAllowed(fromId, toId, rules);
    if (!transitionAllowed) {
      pushDiagnostic(
        diagnostics,
        DIAGNOSTIC_CODES.INVALID_TRANSITION,
        DIAGNOSTIC_SEVERITY.ERROR,
        `Transition ${fromId} → ${toId} is not allowed by lifecycle rules`,
        {
          fromState: fromId,
          toState: toId,
          allowedNext: listAllowedNextStates(fromId, rules),
        }
      );
    }
  }

  // Dependency: target state's order should not skip upstream (advisory)
  const satisfiedDependencies = new Set(
    (Array.isArray(input.satisfiedDependencies)
      ? input.satisfiedDependencies
      : fromId
        ? [fromId]
        : []
    )
      .map(normalizeLifecycleState)
      .filter(Boolean)
  );

  if (fromId && toId && definition.byId[fromId] && definition.byId[toId]) {
    const fromOrder = definition.byId[fromId].order;
    const toOrder = definition.byId[toId].order;
    // Branch cases (APPROVED/REJECTED) share similar order — skip strict order check when transition allowed
    if (
      transitionAllowed &&
      toOrder > fromOrder + 1 &&
      toId !== 'REJECTED' &&
      toId !== 'APPROVED'
    ) {
      // Only flag if intermediate states are not in satisfiedDependencies
      const intermediates = definition.states.filter(
        (s) => s.order > fromOrder && s.order < toOrder && !s.terminal
      );
      const missingDeps = intermediates
        .map((s) => s.stateId)
        .filter((id) => !satisfiedDependencies.has(id) && id !== toId);
      if (missingDeps.length > 0) {
        pushDiagnostic(
          diagnostics,
          DIAGNOSTIC_CODES.DEPENDENCY_VIOLATION,
          DIAGNOSTIC_SEVERITY.ERROR,
          `Dependency violation: intermediate states not satisfied before ${toId}`,
          { missingDependencies: missingDeps }
        );
      }
    }
  }

  const gateEvaluation = toId
    ? evaluateLifecycleGates(toId, input.gateObservations || {}, gateRegistry)
    : null;

  if (gateEvaluation) {
    for (let i = 0; i < gateEvaluation.failed.length; i += 1) {
      pushDiagnostic(
        diagnostics,
        DIAGNOSTIC_CODES.GATE_FAILURE,
        DIAGNOSTIC_SEVERITY.ERROR,
        `Gate failed for target state ${toId}: ${gateEvaluation.failed[i]}`,
        { gateId: gateEvaluation.failed[i], targetState: toId }
      );
    }
    for (let i = 0; i < gateEvaluation.missing.length; i += 1) {
      pushDiagnostic(
        diagnostics,
        DIAGNOSTIC_CODES.GATE_MISSING,
        DIAGNOSTIC_SEVERITY.ERROR,
        `Required gate not satisfied for target state ${toId}: ${gateEvaluation.missing[i]}`,
        { gateId: gateEvaluation.missing[i], targetState: toId }
      );
    }
    if (gateEvaluation.missing.length || gateEvaluation.failed.length) {
      pushDiagnostic(
        diagnostics,
        DIAGNOSTIC_CODES.MISSING_PREREQUISITES,
        DIAGNOSTIC_SEVERITY.ERROR,
        'Missing prerequisites for proposed transition (gates not satisfied)',
        {
          missingGates: gateEvaluation.missing.slice(),
          failedGates: gateEvaluation.failed.slice(),
        }
      );
    }
  }

  const errorCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.ERROR
  ).length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.WARNING
  ).length;

  const valid =
    transitionAllowed &&
    errorCount === 0 &&
    Boolean(fromId) &&
    Boolean(toId);

  return deepFreeze({
    validatorId: 'CONTROLLED_LIFECYCLE_TRANSITION_VALIDATOR',
    version: LIFECYCLE_TRANSITION_VALIDATOR_VERSION,
    advisoryOnly: true,
    automaticCorrection: false,
    stateMutation: false,
    fromState: fromId,
    toState: toId,
    currentState: currentId,
    transitionAllowed,
    valid,
    diagnostics,
    gateEvaluation,
    allowedNextStates: fromId ? listAllowedNextStates(fromId, rules) : [],
    summary: {
      errorCount,
      warningCount,
      diagnosticCount: diagnostics.length,
      valid,
      transitionAllowed,
      gatesBlocking: Boolean(gateEvaluation && gateEvaluation.blocking),
    },
  });
}

module.exports = {
  LIFECYCLE_TRANSITION_VALIDATOR_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  validateLifecycleTransition,
};
