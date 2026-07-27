"use strict";

/**
 * Phase 139 — Recruitment Workflow Composition Validator (Advisory Only).
 *
 * Pure advisory validator that detects missing architecture layers, circular
 * dependencies, and contract mismatches across Phases 114–138 composition
 * blueprints. No database access, no persistence, no runtime imports,
 * no side effects. No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE = 139;

const RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_ENTITY =
  "recruitment_workflow_composition_validator";

const VALIDATION_SCHEMA_VERSION = "1.0.0";

const VALIDATION_STATUS = Object.freeze({
  VALID: "VALID",
  PARTIALLY_VALID: "PARTIALLY_VALID",
  INVALID: "INVALID",
  UNKNOWN: "UNKNOWN"
});

const VALIDATION_ISSUE_TYPE = Object.freeze({
  MISSING_LAYER: "MISSING_LAYER",
  CIRCULAR_DEPENDENCY: "CIRCULAR_DEPENDENCY",
  CONTRACT_MISMATCH: "CONTRACT_MISMATCH",
  EXECUTION_ORDER_MISMATCH: "EXECUTION_ORDER_MISMATCH",
  DEPENDENCY_GAP: "DEPENDENCY_GAP"
});

const EXPECTED_LAYER_COUNT = 15;

const EXPECTED_PHASE_RANGE = Object.freeze({ min: 114, max: 138 });

const RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_139",
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
  executed: false,
  compositionValidationOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138
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
function isRecognizedValidationInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const objectFields = [
    "compositionBlueprint",
    "executionBlueprint",
    "dependencyAnalysis",
    "contractSignals"
  ];

  for (let i = 0; i < objectFields.length; i += 1) {
    const field = objectFields[i];
    const value = input[field];
    if (value != null && !isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulValidationSignals(input) {
  return (
    input.compositionBlueprint != null ||
    input.executionBlueprint != null ||
    input.dependencyAnalysis != null ||
    input.contractSignals != null
  );
}

/**
 * @param {Readonly<Object>} compositionBlueprint
 * @returns {Readonly<Array>}
 */
function detectMissingLayers(compositionBlueprint) {
  const issues = [];
  const layers = Array.isArray(compositionBlueprint.architectureLayers)
    ? compositionBlueprint.architectureLayers
    : [];
  const presentLayerIds = layers.map((layer) => layer.id);

  if (layers.length < EXPECTED_LAYER_COUNT) {
    issues.push(
      deepFreeze({
        type: VALIDATION_ISSUE_TYPE.MISSING_LAYER,
        message: `Expected ${EXPECTED_LAYER_COUNT} architecture layers, found ${layers.length}`,
        missingCount: EXPECTED_LAYER_COUNT - layers.length,
        presentLayerIds: Object.freeze(presentLayerIds.slice())
      })
    );
  }

  return Object.freeze(issues);
}

/**
 * @param {Readonly<Object>} dependencyAnalysis
 * @returns {Readonly<Array>}
 */
function detectCircularDependencies(dependencyAnalysis) {
  const issues = [];
  const phaseAnalyses = Array.isArray(dependencyAnalysis.phaseAnalyses)
    ? dependencyAnalysis.phaseAnalyses
    : [];

  for (let i = 0; i < phaseAnalyses.length; i += 1) {
    const analysis = phaseAnalyses[i];
    if (analysis.hasCircularDependency === true) {
      issues.push(
        deepFreeze({
          type: VALIDATION_ISSUE_TYPE.CIRCULAR_DEPENDENCY,
          message: `Circular dependency detected at phase ${analysis.phase}`,
          phase: analysis.phase,
          circularPhases: analysis.circularPhases
        })
      );
    }
  }

  return Object.freeze(issues);
}

/**
 * @param {Readonly<Object>} contractSignals
 * @param {Readonly<Object>} compositionBlueprint
 * @returns {Readonly<Array>}
 */
function detectContractMismatches(contractSignals, compositionBlueprint) {
  const issues = [];
  const layers = Array.isArray(compositionBlueprint.architectureLayers)
    ? compositionBlueprint.architectureLayers
    : [];

  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const requiredSignals = Array.isArray(layer.contractSignals) ? layer.contractSignals : [];

    for (let j = 0; j < requiredSignals.length; j += 1) {
      const signal = requiredSignals[j];
      if (contractSignals[signal] === false || contractSignals[signal] === "MISSING") {
        issues.push(
          deepFreeze({
            type: VALIDATION_ISSUE_TYPE.CONTRACT_MISMATCH,
            message: `Contract signal '${signal}' missing for layer '${layer.id}'`,
            layerId: layer.id,
            signal
          })
        );
      }
    }
  }

  return Object.freeze(issues);
}

/**
 * @param {Readonly<Object>} executionBlueprint
 * @param {Readonly<Object>} dependencyAnalysis
 * @returns {Readonly<Array>}
 */
function detectExecutionOrderMismatches(executionBlueprint, dependencyAnalysis) {
  const issues = [];
  const phaseOrder = Array.isArray(executionBlueprint.phaseEvaluationOrder)
    ? executionBlueprint.phaseEvaluationOrder
    : [];
  const dependencyEdges = Array.isArray(dependencyAnalysis.dependencyEdges)
    ? dependencyAnalysis.dependencyEdges
    : [];

  const phaseIndex = {};
  for (let i = 0; i < phaseOrder.length; i += 1) {
    phaseIndex[phaseOrder[i]] = i;
  }

  for (let i = 0; i < dependencyEdges.length; i += 1) {
    const edge = dependencyEdges[i];
    const fromIndex = phaseIndex[edge.fromPhase];
    const toIndex = phaseIndex[edge.toPhase];

    if (fromIndex != null && toIndex != null && fromIndex >= toIndex) {
      issues.push(
        deepFreeze({
          type: VALIDATION_ISSUE_TYPE.EXECUTION_ORDER_MISMATCH,
          message: `Phase ${edge.fromPhase} must evaluate before phase ${edge.toPhase}`,
          fromPhase: edge.fromPhase,
          toPhase: edge.toPhase
        })
      );
    }
  }

  return Object.freeze(issues);
}

/**
 * @param {Readonly<Object>} dependencyAnalysis
 * @returns {Readonly<Array>}
 */
function detectDependencyGaps(dependencyAnalysis) {
  const issues = [];
  const includedPhases = Array.isArray(dependencyAnalysis.includedPhases)
    ? dependencyAnalysis.includedPhases
    : [];
  const includedSet = new Set(includedPhases);
  const phaseAnalyses = Array.isArray(dependencyAnalysis.phaseAnalyses)
    ? dependencyAnalysis.phaseAnalyses
    : [];

  for (let i = 0; i < phaseAnalyses.length; i += 1) {
    const analysis = phaseAnalyses[i];
    const directDeps = Array.isArray(analysis.directDependencies) ? analysis.directDependencies : [];

    for (let j = 0; j < directDeps.length; j += 1) {
      const dep = directDeps[j];
      if (!includedSet.has(dep)) {
        issues.push(
          deepFreeze({
            type: VALIDATION_ISSUE_TYPE.DEPENDENCY_GAP,
            message: `Phase ${analysis.phase} depends on missing phase ${dep}`,
            phase: analysis.phase,
            missingDependency: dep
          })
        );
      }
    }
  }

  return Object.freeze(issues);
}

/**
 * @param {Readonly<Array>} issues
 * @returns {string}
 */
function resolveValidationStatus(issues) {
  if (issues.length === 0) {
    return VALIDATION_STATUS.VALID;
  }

  const hasCritical = issues.some(
    (issue) =>
      issue.type === VALIDATION_ISSUE_TYPE.CIRCULAR_DEPENDENCY ||
      issue.type === VALIDATION_ISSUE_TYPE.CONTRACT_MISMATCH
  );

  if (hasCritical) {
    return VALIDATION_STATUS.INVALID;
  }

  return VALIDATION_STATUS.PARTIALLY_VALID;
}

/**
 * @param {string} validationStatus
 * @returns {string}
 */
function buildValidationSummary(validationStatus) {
  if (validationStatus === VALIDATION_STATUS.VALID) {
    return "Recruitment workflow composition blueprint validation passed";
  }
  if (validationStatus === VALIDATION_STATUS.INVALID) {
    return "Recruitment workflow composition blueprint validation failed";
  }
  if (validationStatus === VALIDATION_STATUS.PARTIALLY_VALID) {
    return "Recruitment workflow composition blueprint validation partially passed";
  }
  return "Recruitment workflow composition blueprint validation could not be determined";
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentWorkflowComposition(input) {
  if (!isRecognizedValidationInput(input) || !hasMeaningfulValidationSignals(input)) {
    return deepFreeze({
      entity: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_ENTITY,
      phase: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
      schemaVersion: VALIDATION_SCHEMA_VERSION,
      validationStatus: VALIDATION_STATUS.UNKNOWN,
      issueCount: 0,
      issues: Object.freeze([]),
      validationSummary: buildValidationSummary(VALIDATION_STATUS.UNKNOWN),
      advisoryMetadata: deepFreeze({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_139",
        phase: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        integrationPersistence: false,
        automationEnabled: false,
        alertingEnabled: false,
        historyTracking: false,
        sideEffects: false,
        mutatesInput: false,
        compositionValidationOnly: true
      })
    });
  }

  const compositionBlueprint = isPlainObject(input.compositionBlueprint)
    ? input.compositionBlueprint
    : {};
  const executionBlueprint = isPlainObject(input.executionBlueprint) ? input.executionBlueprint : {};
  const dependencyAnalysis = isPlainObject(input.dependencyAnalysis) ? input.dependencyAnalysis : {};
  const contractSignals = isPlainObject(input.contractSignals) ? input.contractSignals : {};

  const issues = [];
  issues.push(...detectMissingLayers(compositionBlueprint));
  issues.push(...detectCircularDependencies(dependencyAnalysis));
  issues.push(...detectContractMismatches(contractSignals, compositionBlueprint));
  issues.push(...detectExecutionOrderMismatches(executionBlueprint, dependencyAnalysis));
  issues.push(...detectDependencyGaps(dependencyAnalysis));

  const frozenIssues = Object.freeze(issues.slice());
  const validationStatus = resolveValidationStatus(frozenIssues);

  return deepFreeze({
    entity: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_ENTITY,
    phase: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    validationStatus,
    issueCount: frozenIssues.length,
    issues: frozenIssues,
    expectedPhaseRange: EXPECTED_PHASE_RANGE,
    expectedLayerCount: EXPECTED_LAYER_COUNT,
    validationSummary: buildValidationSummary(validationStatus),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_139",
      phase: RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      compositionValidationOnly: true
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_ENTITY,
  VALIDATION_SCHEMA_VERSION,
  VALIDATION_STATUS,
  VALIDATION_ISSUE_TYPE,
  EXPECTED_LAYER_COUNT,
  EXPECTED_PHASE_RANGE,
  RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_METADATA,
  validateRecruitmentWorkflowComposition
};
