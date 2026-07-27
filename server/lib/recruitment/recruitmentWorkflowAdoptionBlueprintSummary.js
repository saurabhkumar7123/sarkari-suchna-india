"use strict";

/**
 * Phase 140 — Recruitment Workflow Adoption Blueprint Summary (Advisory Only).
 *
 * Pure advisory summary aggregating runtime adoption blueprint, feature flag strategy,
 * shadow mode blueprint, runtime readiness gate, and production adoption playbook
 * outputs for Phases 114–139 runtime adoption review. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_PHASE = 140;

const RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_ENTITY =
  "recruitment_workflow_adoption_blueprint_summary";

const SUMMARY_SCHEMA_VERSION = "1.0.0";

const SUMMARY_POSTURE = Object.freeze({
  ADOPTION_READY: "ADOPTION_READY",
  ADOPTION_REVIEW_REQUIRED: "ADOPTION_REVIEW_REQUIRED",
  ADOPTION_BLOCKED: "ADOPTION_BLOCKED",
  READINESS_GATE_REVIEW_REQUIRED: "READINESS_GATE_REVIEW_REQUIRED",
  SHADOW_MODE_REVIEW_REQUIRED: "SHADOW_MODE_REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const AGGREGATED_COMPONENT = Object.freeze({
  RUNTIME_ADOPTION_BLUEPRINT: "runtimeAdoptionBlueprint",
  FEATURE_FLAG_STRATEGY: "featureFlagStrategy",
  SHADOW_MODE_BLUEPRINT: "shadowModeBlueprint",
  RUNTIME_READINESS_GATE: "runtimeReadinessGate",
  PRODUCTION_ADOPTION_PLAYBOOK: "productionAdoptionPlaybook"
});

const RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_140",
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
  adoptionBlueprintSummaryOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139
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
    "runtimeAdoptionBlueprint",
    "featureFlagStrategy",
    "shadowModeBlueprint",
    "runtimeReadinessGate",
    "productionAdoptionPlaybook",
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
    input.runtimeAdoptionBlueprint != null ||
    input.featureFlagStrategy != null ||
    input.shadowModeBlueprint != null ||
    input.runtimeReadinessGate != null ||
    input.productionAdoptionPlaybook != null ||
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
  const runtimeAdoptionBlueprint = isPlainObject(input.runtimeAdoptionBlueprint)
    ? input.runtimeAdoptionBlueprint
    : {};
  const featureFlagStrategy = isPlainObject(input.featureFlagStrategy) ? input.featureFlagStrategy : {};
  const shadowModeBlueprint = isPlainObject(input.shadowModeBlueprint) ? input.shadowModeBlueprint : {};
  const runtimeReadinessGate = isPlainObject(input.runtimeReadinessGate) ? input.runtimeReadinessGate : {};
  const productionAdoptionPlaybook = isPlainObject(input.productionAdoptionPlaybook)
    ? input.productionAdoptionPlaybook
    : {};

  return {
    adoptionPosture:
      typeof runtimeAdoptionBlueprint.adoptionPosture === "string"
        ? runtimeAdoptionBlueprint.adoptionPosture
        : "ADOPTION_ROADMAP_UNKNOWN",
    flagStrategyPosture:
      typeof featureFlagStrategy.flagStrategyPosture === "string"
        ? featureFlagStrategy.flagStrategyPosture
        : "STRATEGY_UNKNOWN",
    shadowModePosture:
      typeof shadowModeBlueprint.shadowModePosture === "string"
        ? shadowModeBlueprint.shadowModePosture
        : "SHADOW_UNKNOWN",
    gateStatus:
      typeof runtimeReadinessGate.gateStatus === "string" ? runtimeReadinessGate.gateStatus : "GATE_UNKNOWN",
    playbookPosture:
      typeof productionAdoptionPlaybook.playbookPosture === "string"
        ? productionAdoptionPlaybook.playbookPosture
        : "PLAYBOOK_UNKNOWN",
    roadmapStageCount:
      typeof runtimeAdoptionBlueprint.stageCount === "number" ? runtimeAdoptionBlueprint.stageCount : 0,
    flagCount: typeof featureFlagStrategy.flagCount === "number" ? featureFlagStrategy.flagCount : 0,
    shadowPhaseCount:
      typeof shadowModeBlueprint.shadowPhaseCount === "number" ? shadowModeBlueprint.shadowPhaseCount : 0,
    satisfiedCheckpointCount:
      typeof runtimeReadinessGate.satisfiedCheckpointCount === "number"
        ? runtimeReadinessGate.satisfiedCheckpointCount
        : 0,
    playbookSectionCount:
      typeof productionAdoptionPlaybook.sectionCount === "number" ? productionAdoptionPlaybook.sectionCount : 0
  };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Array>}
 */
function buildAggregatedComponents(signals) {
  return Object.freeze([
    deepFreeze({
      component: AGGREGATED_COMPONENT.RUNTIME_ADOPTION_BLUEPRINT,
      posture: signals.adoptionPosture,
      metricCount: signals.roadmapStageCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.FEATURE_FLAG_STRATEGY,
      posture: signals.flagStrategyPosture,
      metricCount: signals.flagCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.SHADOW_MODE_BLUEPRINT,
      posture: signals.shadowModePosture,
      metricCount: signals.shadowPhaseCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.RUNTIME_READINESS_GATE,
      posture: signals.gateStatus,
      metricCount: signals.satisfiedCheckpointCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.PRODUCTION_ADOPTION_PLAYBOOK,
      posture: signals.playbookPosture,
      metricCount: signals.playbookSectionCount
    })
  ]);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {string}
 */
function resolveSummaryPosture(signals) {
  const allUnknown =
    signals.adoptionPosture === "ADOPTION_ROADMAP_UNKNOWN" &&
    signals.flagStrategyPosture === "STRATEGY_UNKNOWN" &&
    signals.shadowModePosture === "SHADOW_UNKNOWN" &&
    signals.gateStatus === "GATE_UNKNOWN" &&
    signals.playbookPosture === "PLAYBOOK_UNKNOWN";

  if (allUnknown) {
    return SUMMARY_POSTURE.UNKNOWN;
  }

  if (
    signals.adoptionPosture === "ADOPTION_ROADMAP_BLOCKED" ||
    signals.gateStatus === "GATE_CLOSED" ||
    signals.playbookPosture === "PLAYBOOK_BLOCKED"
  ) {
    return SUMMARY_POSTURE.ADOPTION_BLOCKED;
  }

  if (signals.gateStatus === "GATE_CONDITIONAL") {
    return SUMMARY_POSTURE.READINESS_GATE_REVIEW_REQUIRED;
  }

  if (
    signals.shadowModePosture === "SHADOW_PARTIAL" ||
    signals.shadowModePosture === "SHADOW_UNKNOWN"
  ) {
    return SUMMARY_POSTURE.SHADOW_MODE_REVIEW_REQUIRED;
  }

  if (signals.gateStatus === "GATE_UNKNOWN") {
    return SUMMARY_POSTURE.READINESS_GATE_REVIEW_REQUIRED;
  }

  if (
    signals.adoptionPosture === "ADOPTION_ROADMAP_DEFINED" &&
    signals.flagStrategyPosture === "STRATEGY_DEFINED" &&
    signals.shadowModePosture === "SHADOW_DEFINED" &&
    signals.gateStatus === "GATE_OPEN" &&
    signals.playbookPosture === "PLAYBOOK_COMPLETE"
  ) {
    return SUMMARY_POSTURE.ADOPTION_READY;
  }

  return SUMMARY_POSTURE.ADOPTION_REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Array>}
 */
function buildKeyAdoptionSignals(signals) {
  const keySignals = [];

  if (signals.adoptionPosture !== "ADOPTION_ROADMAP_UNKNOWN") {
    keySignals.push(`adoption:${signals.adoptionPosture}`);
  }
  if (signals.flagStrategyPosture !== "STRATEGY_UNKNOWN") {
    keySignals.push(`featureFlags:${signals.flagStrategyPosture}`);
  }
  if (signals.shadowModePosture !== "SHADOW_UNKNOWN") {
    keySignals.push(`shadowMode:${signals.shadowModePosture}`);
  }
  if (signals.gateStatus !== "GATE_UNKNOWN") {
    keySignals.push(`readinessGate:${signals.gateStatus}`);
  }
  if (signals.playbookPosture !== "PLAYBOOK_UNKNOWN") {
    keySignals.push(`playbook:${signals.playbookPosture}`);
  }

  return Object.freeze(keySignals);
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} summaryPosture
 * @returns {Readonly<Array>}
 */
function buildRecommendedAdoptionFocus(signals, summaryPosture) {
  const focus = [];

  if (summaryPosture === SUMMARY_POSTURE.UNKNOWN) {
    focus.push("Supply runtime adoption blueprint advisory outputs for aggregation");
    return Object.freeze(focus);
  }

  if (signals.adoptionPosture === "ADOPTION_ROADMAP_PARTIAL") {
    focus.push("Complete runtime adoption roadmap advisory coverage");
  }

  if (signals.flagStrategyPosture === "STRATEGY_PARTIAL") {
    focus.push("Review partial feature flag strategy advisory definitions");
  }

  if (signals.shadowModePosture === "SHADOW_PARTIAL") {
    focus.push("Review partial shadow mode advisory blueprint phases");
  }

  if (signals.gateStatus === "GATE_CONDITIONAL") {
    focus.push("Resolve conditional runtime readiness gate advisory signals");
  }

  if (signals.playbookPosture === "PLAYBOOK_PARTIAL") {
    focus.push("Complete production adoption playbook documentation sections");
  }

  if (focus.length === 0) {
    focus.push("Proceed with advisory runtime adoption blueprint review");
  }

  return Object.freeze(focus);
}

/**
 * @param {string} summaryPosture
 * @returns {string}
 */
function buildAdoptionSummaryText(summaryPosture) {
  if (summaryPosture === SUMMARY_POSTURE.UNKNOWN) {
    return "Recruitment workflow adoption blueprint summary could not be determined";
  }

  if (summaryPosture === SUMMARY_POSTURE.ADOPTION_READY) {
    return "Recruitment workflow adoption blueprint summary ready for advisory review";
  }

  if (summaryPosture === SUMMARY_POSTURE.ADOPTION_BLOCKED) {
    return "Recruitment workflow adoption blueprint summary blocked by advisory signals";
  }

  if (summaryPosture === SUMMARY_POSTURE.READINESS_GATE_REVIEW_REQUIRED) {
    return "Recruitment workflow adoption blueprint summary requires readiness gate review";
  }

  if (summaryPosture === SUMMARY_POSTURE.SHADOW_MODE_REVIEW_REQUIRED) {
    return "Recruitment workflow adoption blueprint summary requires shadow mode review";
  }

  return "Recruitment workflow adoption blueprint summary requires advisory review";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildSummaryResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    summaryPosture: params.summaryPosture,
    adoptionSummary: params.adoptionSummary,
    aggregatedComponents: params.aggregatedComponents,
    keyAdoptionSignals: Object.freeze(params.keyAdoptionSignals.slice()),
    recommendedAdoptionFocus: Object.freeze(params.recommendedAdoptionFocus.slice()),
    adoptionOverview: deepFreeze({
      adoptionPosture: params.adoptionPosture,
      flagStrategyPosture: params.flagStrategyPosture,
      shadowModePosture: params.shadowModePosture,
      gateStatus: params.gateStatus,
      playbookPosture: params.playbookPosture
    }),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_140",
      phase: RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_PHASE,
      adoptionBlueprintSummaryOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowAdoptionBlueprintSummary(input) {
  if (!isRecognizedSummaryInput(input) || !hasMeaningfulSummarySignals(input)) {
    const emptySignals = extractAggregatedSignals({});

    return buildSummaryResult({
      recruitmentId: null,
      summaryPosture: SUMMARY_POSTURE.UNKNOWN,
      adoptionSummary: buildAdoptionSummaryText(SUMMARY_POSTURE.UNKNOWN),
      aggregatedComponents: buildAggregatedComponents(emptySignals),
      keyAdoptionSignals: [],
      recommendedAdoptionFocus: buildRecommendedAdoptionFocus(emptySignals, SUMMARY_POSTURE.UNKNOWN),
      adoptionPosture: "ADOPTION_ROADMAP_UNKNOWN",
      flagStrategyPosture: "STRATEGY_UNKNOWN",
      shadowModePosture: "SHADOW_UNKNOWN",
      gateStatus: "GATE_UNKNOWN",
      playbookPosture: "PLAYBOOK_UNKNOWN"
    });
  }

  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const signals = extractAggregatedSignals(input);
  const aggregatedComponents = buildAggregatedComponents(signals);
  const summaryPosture = resolveSummaryPosture(signals);
  const keyAdoptionSignals = buildKeyAdoptionSignals(signals);
  const recommendedAdoptionFocus = buildRecommendedAdoptionFocus(signals, summaryPosture);
  const adoptionSummary = buildAdoptionSummaryText(summaryPosture);

  return buildSummaryResult({
    recruitmentId,
    summaryPosture,
    adoptionSummary,
    aggregatedComponents,
    keyAdoptionSignals,
    recommendedAdoptionFocus,
    adoptionPosture: signals.adoptionPosture,
    flagStrategyPosture: signals.flagStrategyPosture,
    shadowModePosture: signals.shadowModePosture,
    gateStatus: signals.gateStatus,
    playbookPosture: signals.playbookPosture
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_ENTITY,
  SUMMARY_SCHEMA_VERSION,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_ADOPTION_BLUEPRINT_SUMMARY_METADATA,
  createRecruitmentWorkflowAdoptionBlueprintSummary
};
