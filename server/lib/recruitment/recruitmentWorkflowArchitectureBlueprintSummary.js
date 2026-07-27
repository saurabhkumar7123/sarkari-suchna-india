"use strict";

/**
 * Phase 139 — Recruitment Workflow Architecture Blueprint Summary (Advisory Only).
 *
 * Pure advisory summary aggregating composition blueprint, execution blueprint,
 * dependency analysis, composition validation, and future runtime mapping
 * outputs for Phases 114–138 architecture review. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_PHASE = 139;

const RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_ENTITY =
  "recruitment_workflow_architecture_blueprint_summary";

const SUMMARY_SCHEMA_VERSION = "1.0.0";

const SUMMARY_POSTURE = Object.freeze({
  ARCHITECTURE_READY: "ARCHITECTURE_READY",
  ARCHITECTURE_REVIEW_REQUIRED: "ARCHITECTURE_REVIEW_REQUIRED",
  ARCHITECTURE_BLOCKED: "ARCHITECTURE_BLOCKED",
  RUNTIME_MAPPING_REVIEW_REQUIRED: "RUNTIME_MAPPING_REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const AGGREGATED_COMPONENT = Object.freeze({
  COMPOSITION_BLUEPRINT: "compositionBlueprint",
  EXECUTION_BLUEPRINT: "executionBlueprint",
  DEPENDENCY_ANALYSIS: "dependencyAnalysis",
  COMPOSITION_VALIDATION: "compositionValidation",
  FUTURE_RUNTIME_MAPPING: "futureRuntimeMapping"
});

const COMPOSITION_POSTURE = Object.freeze({
  COMPOSITION_COMPLETE: "COMPOSITION_COMPLETE",
  COMPOSITION_PARTIAL: "COMPOSITION_PARTIAL",
  COMPOSITION_UNKNOWN: "COMPOSITION_UNKNOWN"
});

const EXECUTION_POSTURE = Object.freeze({
  ORDER_DEFINED: "ORDER_DEFINED",
  ORDER_PARTIAL: "ORDER_PARTIAL",
  ORDER_UNKNOWN: "ORDER_UNKNOWN"
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "VALID",
  PARTIALLY_VALID: "PARTIALLY_VALID",
  INVALID: "INVALID",
  UNKNOWN: "UNKNOWN"
});

const RUNTIME_MAPPING_POSTURE = Object.freeze({
  MAPPING_DEFINED: "MAPPING_DEFINED",
  MAPPING_PARTIAL: "MAPPING_PARTIAL",
  MAPPING_UNKNOWN: "MAPPING_UNKNOWN"
});

const RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_PHASE,
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
  architectureBlueprintSummaryOnly: true,
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
function isRecognizedSummaryInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "compositionBlueprint",
    "executionBlueprint",
    "dependencyAnalysis",
    "compositionValidation",
    "futureRuntimeMapping",
    "recruitmentId"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (field === "recruitmentId") {
      if (typeof value !== "string" && typeof value !== "number") {
        return false;
      }
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
function hasMeaningfulSummarySignals(input) {
  return (
    input.compositionBlueprint != null ||
    input.executionBlueprint != null ||
    input.dependencyAnalysis != null ||
    input.compositionValidation != null ||
    input.futureRuntimeMapping != null ||
    input.recruitmentId != null
  );
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractAggregatedSignals(input) {
  const compositionBlueprint = isPlainObject(input.compositionBlueprint)
    ? input.compositionBlueprint
    : {};
  const executionBlueprint = isPlainObject(input.executionBlueprint) ? input.executionBlueprint : {};
  const dependencyAnalysis = isPlainObject(input.dependencyAnalysis) ? input.dependencyAnalysis : {};
  const compositionValidation = isPlainObject(input.compositionValidation)
    ? input.compositionValidation
    : {};
  const futureRuntimeMapping = isPlainObject(input.futureRuntimeMapping) ? input.futureRuntimeMapping : {};

  return {
    compositionPosture:
      typeof compositionBlueprint.compositionPosture === "string"
        ? compositionBlueprint.compositionPosture
        : COMPOSITION_POSTURE.COMPOSITION_UNKNOWN,
    executionPosture:
      typeof executionBlueprint.executionPosture === "string"
        ? executionBlueprint.executionPosture
        : EXECUTION_POSTURE.ORDER_UNKNOWN,
    dependencyAnalysisStatus:
      typeof dependencyAnalysis.analysisStatus === "string"
        ? dependencyAnalysis.analysisStatus
        : "UNRESOLVED",
    validationStatus:
      typeof compositionValidation.validationStatus === "string"
        ? compositionValidation.validationStatus
        : VALIDATION_STATUS.UNKNOWN,
    runtimeMappingPosture:
      typeof futureRuntimeMapping.mappingPosture === "string"
        ? futureRuntimeMapping.mappingPosture
        : RUNTIME_MAPPING_POSTURE.MAPPING_UNKNOWN,
    layerCount:
      typeof compositionBlueprint.layerCount === "number" ? compositionBlueprint.layerCount : 0,
    phaseCount:
      typeof executionBlueprint.phaseCount === "number" ? executionBlueprint.phaseCount : 0,
    dependencyEdgeCount:
      typeof dependencyAnalysis.dependencyEdgeCount === "number"
        ? dependencyAnalysis.dependencyEdgeCount
        : 0,
    validationIssueCount:
      typeof compositionValidation.issueCount === "number" ? compositionValidation.issueCount : 0,
    runtimeZoneCount:
      typeof futureRuntimeMapping.zoneCount === "number" ? futureRuntimeMapping.zoneCount : 0
  };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Array>}
 */
function buildAggregatedComponents(signals) {
  return Object.freeze([
    deepFreeze({
      component: AGGREGATED_COMPONENT.COMPOSITION_BLUEPRINT,
      posture: signals.compositionPosture,
      metricCount: signals.layerCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.EXECUTION_BLUEPRINT,
      posture: signals.executionPosture,
      metricCount: signals.phaseCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.DEPENDENCY_ANALYSIS,
      posture: signals.dependencyAnalysisStatus,
      metricCount: signals.dependencyEdgeCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.COMPOSITION_VALIDATION,
      posture: signals.validationStatus,
      metricCount: signals.validationIssueCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.FUTURE_RUNTIME_MAPPING,
      posture: signals.runtimeMappingPosture,
      metricCount: signals.runtimeZoneCount
    })
  ]);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {string}
 */
function resolveSummaryPosture(signals) {
  if (
    signals.compositionPosture === COMPOSITION_POSTURE.COMPOSITION_UNKNOWN &&
    signals.executionPosture === EXECUTION_POSTURE.ORDER_UNKNOWN &&
    signals.validationStatus === VALIDATION_STATUS.UNKNOWN
  ) {
    return SUMMARY_POSTURE.UNKNOWN;
  }

  if (signals.validationStatus === VALIDATION_STATUS.INVALID) {
    return SUMMARY_POSTURE.ARCHITECTURE_BLOCKED;
  }

  if (
    signals.runtimeMappingPosture === RUNTIME_MAPPING_POSTURE.MAPPING_PARTIAL ||
    signals.runtimeMappingPosture === RUNTIME_MAPPING_POSTURE.MAPPING_UNKNOWN
  ) {
    return SUMMARY_POSTURE.RUNTIME_MAPPING_REVIEW_REQUIRED;
  }

  if (
    signals.compositionPosture === COMPOSITION_POSTURE.COMPOSITION_COMPLETE &&
    signals.executionPosture === EXECUTION_POSTURE.ORDER_DEFINED &&
    signals.validationStatus === VALIDATION_STATUS.VALID &&
    signals.runtimeMappingPosture === RUNTIME_MAPPING_POSTURE.MAPPING_DEFINED
  ) {
    return SUMMARY_POSTURE.ARCHITECTURE_READY;
  }

  return SUMMARY_POSTURE.ARCHITECTURE_REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Array>}
 */
function buildKeyArchitectureSignals(signals) {
  const keySignals = [];

  if (signals.compositionPosture !== COMPOSITION_POSTURE.COMPOSITION_UNKNOWN) {
    keySignals.push(`composition:${signals.compositionPosture}`);
  }
  if (signals.executionPosture !== EXECUTION_POSTURE.ORDER_UNKNOWN) {
    keySignals.push(`execution:${signals.executionPosture}`);
  }
  if (signals.dependencyAnalysisStatus !== "UNRESOLVED") {
    keySignals.push(`dependency:${signals.dependencyAnalysisStatus}`);
  }
  if (signals.validationStatus !== VALIDATION_STATUS.UNKNOWN) {
    keySignals.push(`validation:${signals.validationStatus}`);
  }
  if (signals.runtimeMappingPosture !== RUNTIME_MAPPING_POSTURE.MAPPING_UNKNOWN) {
    keySignals.push(`runtimeMapping:${signals.runtimeMappingPosture}`);
  }

  return Object.freeze(keySignals);
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} summaryPosture
 * @returns {Readonly<Array>}
 */
function buildRecommendedArchitectureFocus(signals, summaryPosture) {
  const focus = [];

  if (summaryPosture === SUMMARY_POSTURE.UNKNOWN) {
    focus.push("Supply architecture blueprint advisory outputs for aggregation");
    return Object.freeze(focus);
  }

  if (signals.compositionPosture === COMPOSITION_POSTURE.COMPOSITION_PARTIAL) {
    focus.push("Complete architecture layer advisory coverage");
  }

  if (signals.executionPosture === EXECUTION_POSTURE.ORDER_PARTIAL) {
    focus.push("Resolve partial execution order advisory signals");
  }

  if (signals.validationStatus === VALIDATION_STATUS.PARTIALLY_VALID) {
    focus.push("Review partial composition validation advisory findings");
  }

  if (signals.runtimeMappingPosture === RUNTIME_MAPPING_POSTURE.MAPPING_PARTIAL) {
    focus.push("Review partial future runtime mapping advisory zones");
  }

  if (focus.length === 0) {
    focus.push("Proceed with advisory architecture blueprint review");
  }

  return Object.freeze(focus);
}

/**
 * @param {string} summaryPosture
 * @returns {string}
 */
function buildArchitectureSummaryText(summaryPosture) {
  if (summaryPosture === SUMMARY_POSTURE.UNKNOWN) {
    return "Recruitment workflow architecture blueprint summary could not be determined";
  }

  if (summaryPosture === SUMMARY_POSTURE.ARCHITECTURE_READY) {
    return "Recruitment workflow architecture blueprint summary ready for advisory review";
  }

  if (summaryPosture === SUMMARY_POSTURE.ARCHITECTURE_BLOCKED) {
    return "Recruitment workflow architecture blueprint summary blocked by validation failures";
  }

  if (summaryPosture === SUMMARY_POSTURE.RUNTIME_MAPPING_REVIEW_REQUIRED) {
    return "Recruitment workflow architecture blueprint summary requires future runtime mapping review";
  }

  return "Recruitment workflow architecture blueprint summary requires advisory review";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildSummaryResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    summaryPosture: params.summaryPosture,
    architectureSummary: params.architectureSummary,
    aggregatedComponents: params.aggregatedComponents,
    keyArchitectureSignals: Object.freeze(params.keyArchitectureSignals.slice()),
    recommendedArchitectureFocus: Object.freeze(params.recommendedArchitectureFocus.slice()),
    architectureOverview: deepFreeze({
      compositionPosture: params.compositionPosture,
      executionPosture: params.executionPosture,
      dependencyAnalysisStatus: params.dependencyAnalysisStatus,
      validationStatus: params.validationStatus,
      runtimeMappingPosture: params.runtimeMappingPosture
    }),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_139",
      phase: RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      architectureBlueprintSummaryOnly: true
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowArchitectureBlueprintSummary(input) {
  if (!isRecognizedSummaryInput(input) || !hasMeaningfulSummarySignals(input)) {
    const emptySignals = extractAggregatedSignals({});

    return buildSummaryResult({
      recruitmentId: null,
      summaryPosture: SUMMARY_POSTURE.UNKNOWN,
      architectureSummary: buildArchitectureSummaryText(SUMMARY_POSTURE.UNKNOWN),
      aggregatedComponents: buildAggregatedComponents(emptySignals),
      keyArchitectureSignals: [],
      recommendedArchitectureFocus: buildRecommendedArchitectureFocus(
        emptySignals,
        SUMMARY_POSTURE.UNKNOWN
      ),
      compositionPosture: COMPOSITION_POSTURE.COMPOSITION_UNKNOWN,
      executionPosture: EXECUTION_POSTURE.ORDER_UNKNOWN,
      dependencyAnalysisStatus: "UNRESOLVED",
      validationStatus: VALIDATION_STATUS.UNKNOWN,
      runtimeMappingPosture: RUNTIME_MAPPING_POSTURE.MAPPING_UNKNOWN
    });
  }

  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const signals = extractAggregatedSignals(input);
  const aggregatedComponents = buildAggregatedComponents(signals);
  const summaryPosture = resolveSummaryPosture(signals);
  const keyArchitectureSignals = buildKeyArchitectureSignals(signals);
  const recommendedArchitectureFocus = buildRecommendedArchitectureFocus(signals, summaryPosture);
  const architectureSummary = buildArchitectureSummaryText(summaryPosture);

  return buildSummaryResult({
    recruitmentId,
    summaryPosture,
    architectureSummary,
    aggregatedComponents,
    keyArchitectureSignals,
    recommendedArchitectureFocus,
    compositionPosture: signals.compositionPosture,
    executionPosture: signals.executionPosture,
    dependencyAnalysisStatus: signals.dependencyAnalysisStatus,
    validationStatus: signals.validationStatus,
    runtimeMappingPosture: signals.runtimeMappingPosture
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_ENTITY,
  SUMMARY_SCHEMA_VERSION,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_METADATA,
  createRecruitmentWorkflowArchitectureBlueprintSummary
};
