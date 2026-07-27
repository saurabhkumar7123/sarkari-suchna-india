"use strict";

/**
 * Phase 135 — Recruitment Workflow Controlled Activation Strategy (Advisory Only).
 *
 * Pure advisory strategy defining recommended activation order for recruitment
 * workflow advisory modules during future controlled production integration.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_PHASE = 135;

const RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_ENTITY =
  "recruitment_workflow_controlled_activation_strategy";

const ACTIVATION_STRATEGY_STATUS = Object.freeze({
  PENDING: "PENDING",
  RECOMMENDED: "RECOMMENDED",
  DEFERRED: "DEFERRED",
  BLOCKED: "BLOCKED",
  COMPLETE: "COMPLETE",
  UNKNOWN: "UNKNOWN"
});

const STRATEGY_POSTURE = Object.freeze({
  READY_TO_SEQUENCE: "READY_TO_SEQUENCE",
  PARTIAL_SEQUENCE: "PARTIAL_SEQUENCE",
  BLOCKED_SEQUENCE: "BLOCKED_SEQUENCE",
  UNKNOWN: "UNKNOWN"
});

const ACTIVATION_ORDER_DEFINITIONS = Object.freeze([
  Object.freeze({
    order: 1,
    moduleId: "draft_proposal",
    phase: 114,
    label: "Draft Proposal Engine",
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    order: 2,
    moduleId: "persistence_boundary",
    phase: 115,
    label: "Persistence Boundary",
    dependencies: Object.freeze([114])
  }),
  Object.freeze({
    order: 3,
    moduleId: "approval_gate",
    phase: 116,
    label: "Approval Gate",
    dependencies: Object.freeze([115])
  }),
  Object.freeze({
    order: 4,
    moduleId: "review_package",
    phase: 117,
    label: "Review Package Builder",
    dependencies: Object.freeze([114, 115, 116])
  }),
  Object.freeze({
    order: 5,
    moduleId: "storage_adapter",
    phase: 118,
    label: "Storage Adapter",
    dependencies: Object.freeze([117])
  }),
  Object.freeze({
    order: 6,
    moduleId: "repository_contract",
    phase: 119,
    label: "Repository Contract",
    dependencies: Object.freeze([118])
  }),
  Object.freeze({
    order: 7,
    moduleId: "workflow_orchestrator",
    phase: 120,
    label: "Workflow Orchestrator",
    dependencies: Object.freeze([114, 115, 116, 117, 118, 119])
  }),
  Object.freeze({
    order: 8,
    moduleId: "decision_trace_model",
    phase: 121,
    label: "Decision Trace Model",
    dependencies: Object.freeze([120])
  }),
  Object.freeze({
    order: 9,
    moduleId: "capability_registry",
    phase: 122,
    label: "Capability Registry",
    dependencies: Object.freeze([114, 115, 116, 117, 118, 119, 120, 121])
  }),
  Object.freeze({
    order: 10,
    moduleId: "readiness_assessment",
    phase: 123,
    label: "Readiness Assessment",
    dependencies: Object.freeze([122])
  }),
  Object.freeze({
    order: 11,
    moduleId: "advisory_report_generator",
    phase: 124,
    label: "Advisory Report Generator",
    dependencies: Object.freeze([123])
  }),
  Object.freeze({
    order: 12,
    moduleId: "advisory_snapshot",
    phase: 125,
    label: "Advisory Snapshot",
    dependencies: Object.freeze([124])
  }),
  Object.freeze({
    order: 13,
    moduleId: "snapshot_comparison",
    phase: 126,
    label: "Snapshot Comparison",
    dependencies: Object.freeze([125])
  }),
  Object.freeze({
    order: 14,
    moduleId: "evolution_analyzer",
    phase: 127,
    label: "Evolution Analyzer",
    dependencies: Object.freeze([126])
  }),
  Object.freeze({
    order: 15,
    moduleId: "health_indicator",
    phase: 128,
    label: "Health Indicator",
    dependencies: Object.freeze([127])
  }),
  Object.freeze({
    order: 16,
    moduleId: "risk_assessment",
    phase: 129,
    label: "Risk Assessment",
    dependencies: Object.freeze([128])
  }),
  Object.freeze({
    order: 17,
    moduleId: "intelligence_summary",
    phase: 130,
    label: "Intelligence Summary",
    dependencies: Object.freeze([124, 125, 126, 127, 128, 129])
  }),
  Object.freeze({
    order: 18,
    moduleId: "recommendation_model",
    phase: 131,
    label: "Recommendation Model",
    dependencies: Object.freeze([123, 127, 128, 129, 130])
  }),
  Object.freeze({
    order: 19,
    moduleId: "timeline_model",
    phase: 132,
    label: "Timeline Model",
    dependencies: Object.freeze([131])
  }),
  Object.freeze({
    order: 20,
    moduleId: "consistency_validator",
    phase: 133,
    label: "Consistency Validator",
    dependencies: Object.freeze([128, 129, 130, 131, 132])
  }),
  Object.freeze({
    order: 21,
    moduleId: "integration_readiness_framework",
    phase: 134,
    label: "Integration Readiness Framework",
    dependencies: Object.freeze([133])
  })
]);

const RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_135",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  activationStrategyOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134
  ])
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
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedStrategyInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = ["activatedModules", "moduleSignals", "blockedPhases"];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulStrategySignals(input) {
  return input.activatedModules != null || input.moduleSignals != null;
}

/**
 * @param {*} signal
 * @returns {boolean}
 */
function isModuleActivated(signal) {
  if (!isPlainObject(signal)) {
    return false;
  }
  return signal.activated === true || signal.satisfied === true || signal.complete === true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {{ activatedPhases: Readonly<Set<number>>, blockedPhases: Readonly<Set<number>> }}
 */
function deriveActivationState(input) {
  const activatedPhases = new Set();
  const blockedPhases = new Set();

  const sources = [input.activatedModules, input.moduleSignals];
  for (let s = 0; s < sources.length; s += 1) {
    const source = sources[s];
    if (!isPlainObject(source)) {
      continue;
    }
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i += 1) {
      const phase = Number(keys[i]);
      if (Number.isInteger(phase) && isModuleActivated(source[keys[i]])) {
        activatedPhases.add(phase);
      }
    }
  }

  if (isPlainObject(input.blockedPhases)) {
    const keys = Object.keys(input.blockedPhases);
    for (let i = 0; i < keys.length; i += 1) {
      const phase = Number(keys[i]);
      if (Number.isInteger(phase) && input.blockedPhases[keys[i]] === true) {
        blockedPhases.add(phase);
      }
    }
  }

  return { activatedPhases, blockedPhases };
}

/**
 * @param {Readonly<Object>} definition
 * @param {Readonly<Set<number>>} activatedPhases
 * @param {Readonly<Set<number>>} blockedPhases
 * @param {boolean} hasSignals
 * @returns {string}
 */
function resolveStrategyStatus(definition, activatedPhases, blockedPhases, hasSignals) {
  if (!hasSignals) {
    return ACTIVATION_STRATEGY_STATUS.UNKNOWN;
  }

  if (activatedPhases.has(definition.phase)) {
    return ACTIVATION_STRATEGY_STATUS.COMPLETE;
  }

  if (blockedPhases.has(definition.phase)) {
    return ACTIVATION_STRATEGY_STATUS.BLOCKED;
  }

  const dependenciesMet = definition.dependencies.every((phase) => activatedPhases.has(phase));

  if (!dependenciesMet) {
    const hasPartialDeps = definition.dependencies.some((phase) => activatedPhases.has(phase));
    return hasPartialDeps ? ACTIVATION_STRATEGY_STATUS.DEFERRED : ACTIVATION_STRATEGY_STATUS.PENDING;
  }

  return ACTIVATION_STRATEGY_STATUS.RECOMMENDED;
}

/**
 * @param {Readonly<Object>} input
 * @param {{ activatedPhases: Readonly<Set<number>>, blockedPhases: Readonly<Set<number>> }} state
 * @returns {ReadonlyArray<Object>}
 */
function buildActivationSequence(input, state) {
  const hasSignals = hasMeaningfulStrategySignals(input);

  return ACTIVATION_ORDER_DEFINITIONS.map((definition) =>
    deepFreeze({
      order: definition.order,
      moduleId: definition.moduleId,
      phase: definition.phase,
      label: definition.label,
      dependencies: Object.freeze(definition.dependencies.slice()),
      strategyStatus: resolveStrategyStatus(
        definition,
        state.activatedPhases,
        state.blockedPhases,
        hasSignals
      )
    })
  );
}

/**
 * @param {ReadonlyArray<Object>} activationSequence
 * @returns {ReadonlyArray<Object>}
 */
function deriveRecommendedActivations(activationSequence) {
  return activationSequence.filter(
    (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.RECOMMENDED
  );
}

/**
 * @param {ReadonlyArray<Object>} activationSequence
 * @returns {ReadonlyArray<Object>}
 */
function deriveBlockedActivations(activationSequence) {
  return activationSequence.filter(
    (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.BLOCKED
  );
}

/**
 * @param {ReadonlyArray<Object>} activationSequence
 * @returns {string}
 */
function resolveStrategyPosture(activationSequence) {
  const hasUnknown = activationSequence.some(
    (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.UNKNOWN
  );
  const hasBlocked = activationSequence.some(
    (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.BLOCKED
  );
  const completeCount = activationSequence.filter(
    (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.COMPLETE
  ).length;

  if (hasUnknown) {
    return STRATEGY_POSTURE.UNKNOWN;
  }

  if (hasBlocked) {
    return STRATEGY_POSTURE.BLOCKED_SEQUENCE;
  }

  if (completeCount === activationSequence.length) {
    return STRATEGY_POSTURE.READY_TO_SEQUENCE;
  }

  if (completeCount > 0) {
    return STRATEGY_POSTURE.PARTIAL_SEQUENCE;
  }

  return STRATEGY_POSTURE.UNKNOWN;
}

/**
 * @param {ReadonlyArray<Object>} activationSequence
 * @param {ReadonlyArray<Object>} recommendedActivations
 * @param {string} strategyPosture
 * @returns {string}
 */
function buildStrategySummary(activationSequence, recommendedActivations, strategyPosture) {
  const completeCount = activationSequence.filter(
    (entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.COMPLETE
  ).length;

  if (activationSequence.every((entry) => entry.strategyStatus === ACTIVATION_STRATEGY_STATUS.UNKNOWN)) {
    return `Recruitment workflow controlled activation strategy defines ${activationSequence.length} advisory modules in dependency order`;
  }

  if (strategyPosture === STRATEGY_POSTURE.READY_TO_SEQUENCE && completeCount === activationSequence.length) {
    return `Recruitment workflow controlled activation strategy completed all ${activationSequence.length} advisory modules`;
  }

  if (recommendedActivations.length === 1) {
    return `Recruitment workflow controlled activation strategy recommends activating ${recommendedActivations[0].label} next (${completeCount} of ${activationSequence.length} complete)`;
  }

  if (recommendedActivations.length > 1) {
    return `Recruitment workflow controlled activation strategy recommends ${recommendedActivations.length} modules for next activation (${completeCount} of ${activationSequence.length} complete)`;
  }

  return `Recruitment workflow controlled activation strategy has ${completeCount} of ${activationSequence.length} advisory modules complete`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildStrategyResult(params) {
  return deepFreeze({
    activationSequence: Object.freeze(params.activationSequence.slice()),
    recommendedActivations: Object.freeze(params.recommendedActivations.slice()),
    blockedActivations: Object.freeze(params.blockedActivations.slice()),
    strategyPosture: params.strategyPosture,
    strategySummary: params.strategySummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_135",
      phase: RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      activationStrategyOnly: true
    })
  });
}

/**
 * Create recruitment workflow controlled activation strategy.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowControlledActivationStrategy(input) {
  if (!isRecognizedStrategyInput(input) || !hasMeaningfulStrategySignals(input)) {
    const staticSequence = ACTIVATION_ORDER_DEFINITIONS.map((definition) =>
      deepFreeze({
        order: definition.order,
        moduleId: definition.moduleId,
        phase: definition.phase,
        label: definition.label,
        dependencies: Object.freeze(definition.dependencies.slice()),
        strategyStatus: ACTIVATION_STRATEGY_STATUS.UNKNOWN
      })
    );

    return buildStrategyResult({
      activationSequence: staticSequence,
      recommendedActivations: [],
      blockedActivations: [],
      strategyPosture: STRATEGY_POSTURE.UNKNOWN,
      strategySummary: buildStrategySummary(staticSequence, [], STRATEGY_POSTURE.UNKNOWN)
    });
  }

  const state = deriveActivationState(input);
  const activationSequence = buildActivationSequence(input, state);
  const recommendedActivations = deriveRecommendedActivations(activationSequence);
  const blockedActivations = deriveBlockedActivations(activationSequence);
  const strategyPosture = resolveStrategyPosture(activationSequence);

  return buildStrategyResult({
    activationSequence,
    recommendedActivations,
    blockedActivations,
    strategyPosture,
    strategySummary: buildStrategySummary(
      activationSequence,
      recommendedActivations,
      strategyPosture
    )
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_PHASE,
  RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_ENTITY,
  ACTIVATION_STRATEGY_STATUS,
  STRATEGY_POSTURE,
  ACTIVATION_ORDER_DEFINITIONS,
  RECRUITMENT_WORKFLOW_CONTROLLED_ACTIVATION_STRATEGY_METADATA,
  createRecruitmentWorkflowControlledActivationStrategy
};
