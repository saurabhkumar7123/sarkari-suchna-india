"use strict";

/**
 * Phase 138 — Recruitment Workflow Integration Contract Summary (Advisory Only).
 *
 * Pure advisory summary that aggregates runtime integration contract, adapter
 * interface, compatibility validation, version registry, and migration planner
 * outputs for future recruitment workflow integration review.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_PHASE = 138;

const RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_ENTITY =
  "recruitment_workflow_integration_contract_summary";

const SUMMARY_POSTURE = Object.freeze({
  INTEGRATION_CONTRACT_READY: "INTEGRATION_CONTRACT_READY",
  INTEGRATION_REVIEW_REQUIRED: "INTEGRATION_REVIEW_REQUIRED",
  INTEGRATION_BLOCKED: "INTEGRATION_BLOCKED",
  MIGRATION_REVIEW_REQUIRED: "MIGRATION_REVIEW_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

const AGGREGATED_COMPONENT = Object.freeze({
  INTEGRATION_CONTRACT: "integrationContract",
  ADAPTER_INTERFACE: "adapterInterface",
  COMPATIBILITY_VALIDATION: "compatibilityValidation",
  VERSION_REGISTRY: "versionRegistry",
  MIGRATION_PLAN: "migrationPlan"
});

const CONTRACT_POSTURE = Object.freeze({
  READY_FOR_INTEGRATION_REVIEW: "READY_FOR_INTEGRATION_REVIEW",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_INTEGRATION: "BLOCKED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const COMPATIBILITY_STATUS = Object.freeze({
  COMPATIBLE: "COMPATIBLE",
  PARTIALLY_COMPATIBLE: "PARTIALLY_COMPATIBLE",
  INCOMPATIBLE: "INCOMPATIBLE",
  UNKNOWN: "UNKNOWN"
});

const MIGRATION_POSTURE = Object.freeze({
  MIGRATION_READY: "MIGRATION_READY",
  MIGRATION_REVIEW_REQUIRED: "MIGRATION_REVIEW_REQUIRED",
  MIGRATION_BLOCKED: "MIGRATION_BLOCKED",
  NO_MIGRATION_NEEDED: "NO_MIGRATION_NEEDED",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_138",
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
  integrationContractSummaryOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137
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
    "integrationContract",
    "adapterInterface",
    "compatibilityValidation",
    "versionLifecycle",
    "migrationPlan",
    "recruitmentId"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
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
    input.integrationContract != null ||
    input.adapterInterface != null ||
    input.compatibilityValidation != null ||
    input.versionLifecycle != null ||
    input.migrationPlan != null ||
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
  const integrationContract = isPlainObject(input.integrationContract)
    ? input.integrationContract
    : {};
  const adapterInterface = isPlainObject(input.adapterInterface) ? input.adapterInterface : {};
  const compatibilityValidation = isPlainObject(input.compatibilityValidation)
    ? input.compatibilityValidation
    : {};
  const versionLifecycle = isPlainObject(input.versionLifecycle) ? input.versionLifecycle : {};
  const migrationPlan = isPlainObject(input.migrationPlan) ? input.migrationPlan : {};

  return {
    contractPosture:
      typeof integrationContract.contractPosture === "string"
        ? integrationContract.contractPosture
        : CONTRACT_POSTURE.UNKNOWN,
    adapterConformancePosture:
      typeof adapterInterface.conformancePosture === "string"
        ? adapterInterface.conformancePosture
        : "UNKNOWN",
    compatibilityStatus:
      typeof compatibilityValidation.compatibilityStatus === "string"
        ? compatibilityValidation.compatibilityStatus
        : COMPATIBILITY_STATUS.UNKNOWN,
    versionLifecycle:
      typeof versionLifecycle.lifecycle === "string" ? versionLifecycle.lifecycle : "UNKNOWN",
    migrationPosture:
      typeof migrationPlan.migrationPosture === "string"
        ? migrationPlan.migrationPosture
        : MIGRATION_POSTURE.UNKNOWN,
    satisfiedSurfaceCount:
      typeof integrationContract.satisfiedSurfaceCount === "number"
        ? integrationContract.satisfiedSurfaceCount
        : 0,
    compatibilitySatisfiedCount:
      typeof compatibilityValidation.satisfiedCount === "number"
        ? compatibilityValidation.satisfiedCount
        : 0,
    migrationRecommendedCount:
      typeof migrationPlan.recommendedCount === "number" ? migrationPlan.recommendedCount : 0,
    adapterSatisfiedCount:
      typeof adapterInterface.satisfiedCount === "number" ? adapterInterface.satisfiedCount : 0,
    integrationPermitted: versionLifecycle.integrationPermitted === true
  };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Array>}
 */
function buildAggregatedComponents(signals) {
  return Object.freeze([
    deepFreeze({
      component: AGGREGATED_COMPONENT.INTEGRATION_CONTRACT,
      posture: signals.contractPosture,
      metricCount: signals.satisfiedSurfaceCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.ADAPTER_INTERFACE,
      posture: signals.adapterConformancePosture,
      metricCount: signals.adapterSatisfiedCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.COMPATIBILITY_VALIDATION,
      posture: signals.compatibilityStatus,
      metricCount: signals.compatibilitySatisfiedCount
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.VERSION_REGISTRY,
      posture: signals.versionLifecycle,
      metricCount: signals.integrationPermitted ? 1 : 0
    }),
    deepFreeze({
      component: AGGREGATED_COMPONENT.MIGRATION_PLAN,
      posture: signals.migrationPosture,
      metricCount: signals.migrationRecommendedCount
    })
  ]);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {string}
 */
function resolveSummaryPosture(signals) {
  if (
    signals.contractPosture === CONTRACT_POSTURE.UNKNOWN &&
    signals.compatibilityStatus === COMPATIBILITY_STATUS.UNKNOWN &&
    signals.migrationPosture === MIGRATION_POSTURE.UNKNOWN
  ) {
    return SUMMARY_POSTURE.UNKNOWN;
  }

  if (
    signals.contractPosture === CONTRACT_POSTURE.BLOCKED_INTEGRATION ||
    signals.compatibilityStatus === COMPATIBILITY_STATUS.INCOMPATIBLE ||
    signals.migrationPosture === MIGRATION_POSTURE.MIGRATION_BLOCKED
  ) {
    return SUMMARY_POSTURE.INTEGRATION_BLOCKED;
  }

  if (
    signals.migrationPosture === MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED ||
    signals.migrationPosture === MIGRATION_POSTURE.MIGRATION_READY
  ) {
    return SUMMARY_POSTURE.MIGRATION_REVIEW_REQUIRED;
  }

  if (
    signals.contractPosture === CONTRACT_POSTURE.READY_FOR_INTEGRATION_REVIEW &&
    signals.compatibilityStatus === COMPATIBILITY_STATUS.COMPATIBLE &&
    signals.integrationPermitted === true
  ) {
    return SUMMARY_POSTURE.INTEGRATION_CONTRACT_READY;
  }

  return SUMMARY_POSTURE.INTEGRATION_REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} signals
 * @returns {Readonly<Array>}
 */
function buildKeyIntegrationSignals(signals) {
  const keySignals = [];

  if (signals.contractPosture !== CONTRACT_POSTURE.UNKNOWN) {
    keySignals.push(`contract:${signals.contractPosture}`);
  }
  if (signals.compatibilityStatus !== COMPATIBILITY_STATUS.UNKNOWN) {
    keySignals.push(`compatibility:${signals.compatibilityStatus}`);
  }
  if (signals.migrationPosture !== MIGRATION_POSTURE.UNKNOWN) {
    keySignals.push(`migration:${signals.migrationPosture}`);
  }
  if (signals.versionLifecycle !== "UNKNOWN") {
    keySignals.push(`lifecycle:${signals.versionLifecycle}`);
  }
  if (signals.adapterConformancePosture !== "UNKNOWN") {
    keySignals.push(`adapter:${signals.adapterConformancePosture}`);
  }

  return Object.freeze(keySignals);
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} summaryPosture
 * @returns {Readonly<Array>}
 */
function buildRecommendedIntegrationFocus(signals, summaryPosture) {
  const focus = [];

  if (summaryPosture === SUMMARY_POSTURE.UNKNOWN) {
    focus.push("Supply integration contract advisory outputs for aggregation");
    return Object.freeze(focus);
  }

  if (signals.contractPosture === CONTRACT_POSTURE.REVIEW_REQUIRED) {
    focus.push("Complete integration surface advisory coverage");
  }

  if (signals.compatibilityStatus === COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE) {
    focus.push("Resolve partial compatibility advisory signals");
  }

  if (signals.migrationPosture === MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED) {
    focus.push("Review advisory migration staging plan");
  }

  if (signals.adapterConformancePosture === "PARTIALLY_CONFORMANT") {
    focus.push("Align adapter capability declarations with interface requirements");
  }

  if (focus.length === 0) {
    focus.push("Proceed with advisory integration contract review");
  }

  return Object.freeze(focus);
}

/**
 * @param {string} summaryPosture
 * @returns {string}
 */
function buildIntegrationSummaryText(summaryPosture) {
  if (summaryPosture === SUMMARY_POSTURE.UNKNOWN) {
    return "Recruitment workflow integration contract summary could not be determined";
  }

  if (summaryPosture === SUMMARY_POSTURE.INTEGRATION_CONTRACT_READY) {
    return "Recruitment workflow integration contract summary ready for advisory runtime integration review";
  }

  if (summaryPosture === SUMMARY_POSTURE.INTEGRATION_BLOCKED) {
    return "Recruitment workflow integration contract summary blocked by incompatible advisory signals";
  }

  if (summaryPosture === SUMMARY_POSTURE.MIGRATION_REVIEW_REQUIRED) {
    return "Recruitment workflow integration contract summary requires migration advisory review";
  }

  return "Recruitment workflow integration contract summary requires advisory review before runtime coupling";
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildSummaryResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    summaryPosture: params.summaryPosture,
    integrationSummary: params.integrationSummary,
    aggregatedComponents: params.aggregatedComponents,
    keyIntegrationSignals: Object.freeze(params.keyIntegrationSignals.slice()),
    recommendedIntegrationFocus: Object.freeze(params.recommendedIntegrationFocus.slice()),
    integrationOverview: deepFreeze({
      contractPosture: params.contractPosture,
      compatibilityStatus: params.compatibilityStatus,
      migrationPosture: params.migrationPosture,
      versionLifecycle: params.versionLifecycle,
      adapterConformancePosture: params.adapterConformancePosture
    }),
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      integrationContractSummaryOnly: true
    })
  });
}

/**
 * Create recruitment workflow integration contract summary from supplied outputs.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationContractSummary(input) {
  if (!isRecognizedSummaryInput(input) || !hasMeaningfulSummarySignals(input)) {
    const emptySignals = extractAggregatedSignals({});

    return buildSummaryResult({
      recruitmentId: null,
      summaryPosture: SUMMARY_POSTURE.UNKNOWN,
      integrationSummary: buildIntegrationSummaryText(SUMMARY_POSTURE.UNKNOWN),
      aggregatedComponents: buildAggregatedComponents(emptySignals),
      keyIntegrationSignals: [],
      recommendedIntegrationFocus: buildRecommendedIntegrationFocus(
        emptySignals,
        SUMMARY_POSTURE.UNKNOWN
      ),
      contractPosture: CONTRACT_POSTURE.UNKNOWN,
      compatibilityStatus: COMPATIBILITY_STATUS.UNKNOWN,
      migrationPosture: MIGRATION_POSTURE.UNKNOWN,
      versionLifecycle: "UNKNOWN",
      adapterConformancePosture: "UNKNOWN"
    });
  }

  const recruitmentId = resolveRecruitmentId(input.recruitmentId);
  const signals = extractAggregatedSignals(input);
  const aggregatedComponents = buildAggregatedComponents(signals);
  const summaryPosture = resolveSummaryPosture(signals);
  const keyIntegrationSignals = buildKeyIntegrationSignals(signals);
  const recommendedIntegrationFocus = buildRecommendedIntegrationFocus(signals, summaryPosture);
  const integrationSummary = buildIntegrationSummaryText(summaryPosture);

  return buildSummaryResult({
    recruitmentId,
    summaryPosture,
    integrationSummary,
    aggregatedComponents,
    keyIntegrationSignals,
    recommendedIntegrationFocus,
    contractPosture: signals.contractPosture,
    compatibilityStatus: signals.compatibilityStatus,
    migrationPosture: signals.migrationPosture,
    versionLifecycle: signals.versionLifecycle,
    adapterConformancePosture: signals.adapterConformancePosture
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_ENTITY,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_INTEGRATION_CONTRACT_SUMMARY_METADATA,
  createRecruitmentWorkflowIntegrationContractSummary
};
