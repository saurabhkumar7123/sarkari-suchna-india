'use strict';

/**
 * PROGRAM 5 — Package 5C
 * Lifecycle Readiness Report (Read-Only / Advisory)
 *
 * Advisory report containing:
 *   - Current lifecycle state
 *   - Remaining gates
 *   - Missing prerequisites
 *   - Recommended next step
 *   - Transition diagnostics
 */

const {
  deepFreeze,
  normalizeLifecycleState,
  getDefaultLifecycleDefinition,
} = require('./lifecycleDefinition');
const {
  getDefaultLifecycleTransitionRules,
  listAllowedNextStates,
} = require('./lifecycleTransitionRules');
const {
  getDefaultLifecycleGateRegistry,
  evaluateLifecycleGates,
  listGatesForState,
} = require('./lifecycleGates');
const { validateLifecycleTransition } = require('./lifecycleTransitionValidator');

const LIFECYCLE_READINESS_REPORT_VERSION = '5C.1.0.0';

function recommendNextStep(currentState, allowedNext, gateEval, diagnostics) {
  if (!currentState) {
    return {
      code: 'SET_CURRENT_STATE',
      priority: 'HIGH',
      message: 'Provide a current lifecycle state to evaluate readiness.',
    };
  }

  if (allowedNext.length === 0) {
    return {
      code: 'NO_FURTHER_TRANSITIONS',
      priority: 'INFO',
      message: `State ${currentState} has no allowed next transitions (terminal or complete).`,
    };
  }

  if (gateEval && gateEval.blocking) {
    const remaining = gateEval.missing.concat(gateEval.failed);
    return {
      code: 'SATISFY_REMAINING_GATES',
      priority: 'HIGH',
      message: `Satisfy remaining gates before entering ${allowedNext[0]}: ${remaining.join(', ')}`,
      targetState: allowedNext[0],
      remainingGates: remaining,
    };
  }

  const errorDiagnostics = (diagnostics || []).filter(
    (d) => d.severity === 'ERROR'
  );
  if (errorDiagnostics.length > 0) {
    return {
      code: 'RESOLVE_TRANSITION_DIAGNOSTICS',
      priority: 'HIGH',
      message:
        'Resolve transition diagnostics before proposing the next lifecycle step. No automatic correction is performed.',
    };
  }

  return {
    code: 'PROPOSE_NEXT_TRANSITION',
    priority: 'MEDIUM',
    message: `Recommended next advisory step: ${currentState} → ${allowedNext[0]}`,
    targetState: allowedNext[0],
  };
}

/**
 * Generate a read-only lifecycle readiness report.
 *
 * @param {object} [input]
 * @param {string} [input.currentState]
 * @param {string} [input.proposedNextState]
 * @param {object} [input.gateObservations]
 * @param {string[]} [input.satisfiedDependencies]
 * @param {object} [input.definition]
 * @param {object} [input.rules]
 * @param {object} [input.gateRegistry]
 */
function generateLifecycleReadinessReport(input = {}) {
  const definition = input.definition || getDefaultLifecycleDefinition();
  const rules =
    input.rules || getDefaultLifecycleTransitionRules(definition);
  const gateRegistry =
    input.gateRegistry || getDefaultLifecycleGateRegistry(definition);

  const currentState = normalizeLifecycleState(input.currentState);
  const allowedNext = currentState
    ? listAllowedNextStates(currentState, rules)
    : [];

  const proposedNextState =
    normalizeLifecycleState(input.proposedNextState) ||
    (allowedNext.length === 1 ? allowedNext[0] : null);

  let gateEvaluation = null;
  let transitionValidation = null;
  let remainingGates = [];
  let missingPrerequisites = [];

  if (proposedNextState) {
    gateEvaluation = evaluateLifecycleGates(
      proposedNextState,
      input.gateObservations || {},
      gateRegistry
    );
    remainingGates = gateEvaluation.missing.concat(gateEvaluation.failed);
    missingPrerequisites = remainingGates.slice();

    if (currentState) {
      transitionValidation = validateLifecycleTransition({
        fromState: currentState,
        toState: proposedNextState,
        currentState,
        gateObservations: input.gateObservations || {},
        satisfiedDependencies: input.satisfiedDependencies,
        definition,
        rules,
        gateRegistry,
      });
    }
  } else if (allowedNext.length > 0) {
    // Aggregate remaining gates across all allowed next states
    const remainingSet = new Set();
    for (let i = 0; i < allowedNext.length; i += 1) {
      const evalNext = evaluateLifecycleGates(
        allowedNext[i],
        input.gateObservations || {},
        gateRegistry
      );
      for (let j = 0; j < evalNext.missing.length; j += 1) {
        remainingSet.add(evalNext.missing[j]);
      }
      for (let j = 0; j < evalNext.failed.length; j += 1) {
        remainingSet.add(evalNext.failed[j]);
      }
    }
    remainingGates = Array.from(remainingSet);
    missingPrerequisites = remainingGates.slice();
    gateEvaluation = evaluateLifecycleGates(
      allowedNext[0],
      input.gateObservations || {},
      gateRegistry
    );
  }

  const diagnostics =
    (transitionValidation && transitionValidation.diagnostics) || [];

  const recommendedNextStep = recommendNextStep(
    currentState,
    allowedNext,
    gateEvaluation,
    diagnostics
  );

  const stateMeta = currentState ? definition.byId[currentState] : null;

  return deepFreeze({
    reportId: 'CONTROLLED_LIFECYCLE_READINESS_REPORT',
    version: LIFECYCLE_READINESS_REPORT_VERSION,
    packageId: 'PACKAGE_5C_CONTROLLED_LIFECYCLE_ENGINE',
    advisoryOnly: true,
    readOnly: true,
    automaticAdvancement: false,
    stateMutation: false,
    publishing: false,
    currentLifecycleState: currentState,
    currentStateLabel: stateMeta ? stateMeta.label : null,
    allowedNextStates: allowedNext,
    proposedNextState,
    remainingGates,
    missingPrerequisites,
    recommendedNextStep,
    transitionDiagnostics: diagnostics,
    gateEvaluation,
    transitionValidation: transitionValidation
      ? {
          valid: transitionValidation.valid,
          transitionAllowed: transitionValidation.transitionAllowed,
          summary: transitionValidation.summary,
        }
      : null,
    gatesForCurrentNext:
      allowedNext.length > 0
        ? listGatesForState(allowedNext[0], gateRegistry).map((g) => g.gateId)
        : [],
  });
}

module.exports = {
  LIFECYCLE_READINESS_REPORT_VERSION,
  generateLifecycleReadinessReport,
};
