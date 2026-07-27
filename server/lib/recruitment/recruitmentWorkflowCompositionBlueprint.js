"use strict";

/**
 * Phase 139 — Recruitment Workflow Composition Blueprint (Advisory Only).
 *
 * Pure advisory composition architecture describing how Phases 114–138 advisory
 * modules organize into logical architecture layers. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE = 139;

const RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_ENTITY =
  "recruitment_workflow_composition_blueprint";

const BLUEPRINT_SCHEMA_VERSION = "1.0.0";

const COMPOSITION_POSTURE = Object.freeze({
  COMPOSITION_COMPLETE: "COMPOSITION_COMPLETE",
  COMPOSITION_PARTIAL: "COMPOSITION_PARTIAL",
  COMPOSITION_UNKNOWN: "COMPOSITION_UNKNOWN"
});

const ARCHITECTURE_LAYER_IDS = Object.freeze({
  DRAFT_LIFECYCLE_FOUNDATION: "DRAFT_LIFECYCLE_FOUNDATION",
  STORAGE_REPOSITORY_BOUNDARY: "STORAGE_REPOSITORY_BOUNDARY",
  WORKFLOW_ORCHESTRATION: "WORKFLOW_ORCHESTRATION",
  TRACE_AND_CAPABILITY: "TRACE_AND_CAPABILITY",
  READINESS_AND_REPORTING: "READINESS_AND_REPORTING",
  SNAPSHOT_AND_EVOLUTION: "SNAPSHOT_AND_EVOLUTION",
  HEALTH_AND_RISK: "HEALTH_AND_RISK",
  INTELLIGENCE_SYNTHESIS: "INTELLIGENCE_SYNTHESIS",
  RECOMMENDATION_AND_TIMELINE: "RECOMMENDATION_AND_TIMELINE",
  CONSISTENCY_ASSURANCE: "CONSISTENCY_ASSURANCE",
  INTEGRATION_READINESS: "INTEGRATION_READINESS",
  CONTROLLED_INTEGRATION_PLANNING: "CONTROLLED_INTEGRATION_PLANNING",
  INTEGRATION_GOVERNANCE: "INTEGRATION_GOVERNANCE",
  SIMULATION_AND_DRY_RUN: "SIMULATION_AND_DRY_RUN",
  RUNTIME_INTEGRATION_CONTRACT: "RUNTIME_INTEGRATION_CONTRACT"
});

const MODULE_REGISTRY = Object.freeze([
  Object.freeze({ phase: 114, moduleId: "recruitmentDraftProposalEngine", layerId: ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION }),
  Object.freeze({ phase: 115, moduleId: "recruitmentDraftPersistenceBoundary", layerId: ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION }),
  Object.freeze({ phase: 116, moduleId: "recruitmentDraftApprovalGate", layerId: ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION }),
  Object.freeze({ phase: 117, moduleId: "recruitmentDraftReviewPackageBuilder", layerId: ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION }),
  Object.freeze({ phase: 118, moduleId: "recruitmentDraftStorageAdapter", layerId: ARCHITECTURE_LAYER_IDS.STORAGE_REPOSITORY_BOUNDARY }),
  Object.freeze({ phase: 119, moduleId: "recruitmentDraftRepositoryContract", layerId: ARCHITECTURE_LAYER_IDS.STORAGE_REPOSITORY_BOUNDARY }),
  Object.freeze({ phase: 120, moduleId: "recruitmentWorkflowOrchestrator", layerId: ARCHITECTURE_LAYER_IDS.WORKFLOW_ORCHESTRATION }),
  Object.freeze({ phase: 121, moduleId: "workflowDecisionTraceModel", layerId: ARCHITECTURE_LAYER_IDS.TRACE_AND_CAPABILITY }),
  Object.freeze({ phase: 122, moduleId: "recruitmentWorkflowCapabilityRegistry", layerId: ARCHITECTURE_LAYER_IDS.TRACE_AND_CAPABILITY }),
  Object.freeze({ phase: 123, moduleId: "recruitmentWorkflowReadinessAssessment", layerId: ARCHITECTURE_LAYER_IDS.READINESS_AND_REPORTING }),
  Object.freeze({ phase: 124, moduleId: "recruitmentWorkflowAdvisoryReportGenerator", layerId: ARCHITECTURE_LAYER_IDS.READINESS_AND_REPORTING }),
  Object.freeze({ phase: 125, moduleId: "recruitmentWorkflowAdvisorySnapshot", layerId: ARCHITECTURE_LAYER_IDS.SNAPSHOT_AND_EVOLUTION }),
  Object.freeze({ phase: 126, moduleId: "recruitmentWorkflowSnapshotComparison", layerId: ARCHITECTURE_LAYER_IDS.SNAPSHOT_AND_EVOLUTION }),
  Object.freeze({ phase: 127, moduleId: "recruitmentWorkflowEvolutionAnalyzer", layerId: ARCHITECTURE_LAYER_IDS.SNAPSHOT_AND_EVOLUTION }),
  Object.freeze({ phase: 128, moduleId: "recruitmentWorkflowHealthIndicator", layerId: ARCHITECTURE_LAYER_IDS.HEALTH_AND_RISK }),
  Object.freeze({ phase: 129, moduleId: "recruitmentWorkflowRiskAssessment", layerId: ARCHITECTURE_LAYER_IDS.HEALTH_AND_RISK }),
  Object.freeze({ phase: 130, moduleId: "recruitmentWorkflowIntelligenceSummary", layerId: ARCHITECTURE_LAYER_IDS.INTELLIGENCE_SYNTHESIS }),
  Object.freeze({ phase: 131, moduleId: "recruitmentWorkflowRecommendationModel", layerId: ARCHITECTURE_LAYER_IDS.RECOMMENDATION_AND_TIMELINE }),
  Object.freeze({ phase: 132, moduleId: "recruitmentWorkflowTimelineModel", layerId: ARCHITECTURE_LAYER_IDS.RECOMMENDATION_AND_TIMELINE }),
  Object.freeze({ phase: 133, moduleId: "recruitmentWorkflowConsistencyValidator", layerId: ARCHITECTURE_LAYER_IDS.CONSISTENCY_ASSURANCE }),
  Object.freeze({ phase: 134, moduleId: "recruitmentWorkflowIntegrationReadinessFramework", layerId: ARCHITECTURE_LAYER_IDS.INTEGRATION_READINESS }),
  Object.freeze({ phase: 135, moduleId: "recruitmentWorkflowIntegrationRolloutPlanner", layerId: ARCHITECTURE_LAYER_IDS.CONTROLLED_INTEGRATION_PLANNING }),
  Object.freeze({ phase: 135, moduleId: "recruitmentWorkflowFeatureActivationMatrix", layerId: ARCHITECTURE_LAYER_IDS.CONTROLLED_INTEGRATION_PLANNING }),
  Object.freeze({ phase: 135, moduleId: "recruitmentWorkflowIntegrationSafetyChecklist", layerId: ARCHITECTURE_LAYER_IDS.CONTROLLED_INTEGRATION_PLANNING }),
  Object.freeze({ phase: 135, moduleId: "recruitmentWorkflowControlledActivationStrategy", layerId: ARCHITECTURE_LAYER_IDS.CONTROLLED_INTEGRATION_PLANNING }),
  Object.freeze({ phase: 136, moduleId: "recruitmentWorkflowIntegrationGovernancePolicy", layerId: ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE }),
  Object.freeze({ phase: 136, moduleId: "recruitmentWorkflowIntegrationDecisionMatrix", layerId: ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE }),
  Object.freeze({ phase: 136, moduleId: "recruitmentWorkflowGovernanceComplianceValidator", layerId: ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE }),
  Object.freeze({ phase: 136, moduleId: "recruitmentWorkflowRollbackPlanner", layerId: ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE }),
  Object.freeze({ phase: 136, moduleId: "recruitmentWorkflowIntegrationGovernanceSummary", layerId: ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE }),
  Object.freeze({ phase: 137, moduleId: "recruitmentWorkflowScenarioLibrary", layerId: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN }),
  Object.freeze({ phase: 137, moduleId: "recruitmentWorkflowSimulationEngine", layerId: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN }),
  Object.freeze({ phase: 137, moduleId: "recruitmentWorkflowSimulationValidator", layerId: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN }),
  Object.freeze({ phase: 137, moduleId: "recruitmentWorkflowSimulationSummary", layerId: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN }),
  Object.freeze({ phase: 137, moduleId: "recruitmentWorkflowSimulationReport", layerId: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN }),
  Object.freeze({ phase: 137, moduleId: "recruitmentWorkflowDryRunExecutor", layerId: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN }),
  Object.freeze({ phase: 138, moduleId: "recruitmentWorkflowRuntimeIntegrationContract", layerId: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT }),
  Object.freeze({ phase: 138, moduleId: "recruitmentWorkflowRuntimeAdapterInterface", layerId: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT }),
  Object.freeze({ phase: 138, moduleId: "recruitmentWorkflowContractCompatibilityValidator", layerId: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT }),
  Object.freeze({ phase: 138, moduleId: "recruitmentWorkflowContractVersionRegistry", layerId: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT }),
  Object.freeze({ phase: 138, moduleId: "recruitmentWorkflowRuntimeMigrationPlanner", layerId: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT }),
  Object.freeze({ phase: 138, moduleId: "recruitmentWorkflowIntegrationContractSummary", layerId: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT })
]);

const ARCHITECTURE_LAYER_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION,
    label: "Draft lifecycle foundation advisory layer",
    order: 1,
    modulePhases: Object.freeze([114, 115, 116, 117]),
    contractSignals: Object.freeze(["draftProposal", "persistenceBoundary", "approvalGate", "reviewPackage"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.STORAGE_REPOSITORY_BOUNDARY,
    label: "Storage adapter and repository contract advisory layer",
    order: 2,
    modulePhases: Object.freeze([118, 119]),
    contractSignals: Object.freeze(["storageAdapter", "repositoryContract"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.WORKFLOW_ORCHESTRATION,
    label: "Workflow orchestration advisory layer",
    order: 3,
    modulePhases: Object.freeze([120]),
    contractSignals: Object.freeze(["workflowOrchestrator"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.TRACE_AND_CAPABILITY,
    label: "Decision trace and capability registry advisory layer",
    order: 4,
    modulePhases: Object.freeze([121, 122]),
    contractSignals: Object.freeze(["decisionTrace", "capabilityRegistry"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.READINESS_AND_REPORTING,
    label: "Readiness assessment and advisory reporting layer",
    order: 5,
    modulePhases: Object.freeze([123, 124]),
    contractSignals: Object.freeze(["readinessAssessment", "advisoryReport"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.SNAPSHOT_AND_EVOLUTION,
    label: "Snapshot, comparison, and evolution advisory layer",
    order: 6,
    modulePhases: Object.freeze([125, 126, 127]),
    contractSignals: Object.freeze(["advisorySnapshot", "snapshotComparison", "evolutionAnalysis"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.HEALTH_AND_RISK,
    label: "Health indicator and risk assessment advisory layer",
    order: 7,
    modulePhases: Object.freeze([128, 129]),
    contractSignals: Object.freeze(["healthIndicator", "riskAssessment"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.INTELLIGENCE_SYNTHESIS,
    label: "Intelligence synthesis advisory layer",
    order: 8,
    modulePhases: Object.freeze([130]),
    contractSignals: Object.freeze(["intelligenceSummary"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.RECOMMENDATION_AND_TIMELINE,
    label: "Recommendation and timeline advisory layer",
    order: 9,
    modulePhases: Object.freeze([131, 132]),
    contractSignals: Object.freeze(["recommendationModel", "timelineModel"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.CONSISTENCY_ASSURANCE,
    label: "Consistency validation advisory layer",
    order: 10,
    modulePhases: Object.freeze([133]),
    contractSignals: Object.freeze(["consistencyValidation"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.INTEGRATION_READINESS,
    label: "Integration readiness framework advisory layer",
    order: 11,
    modulePhases: Object.freeze([134]),
    contractSignals: Object.freeze(["integrationReadiness"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.CONTROLLED_INTEGRATION_PLANNING,
    label: "Controlled integration planning advisory layer",
    order: 12,
    modulePhases: Object.freeze([135]),
    contractSignals: Object.freeze(["rolloutPlanning", "activationStrategy", "safetyChecklist"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE,
    label: "Integration governance advisory layer",
    order: 13,
    modulePhases: Object.freeze([136]),
    contractSignals: Object.freeze(["governancePolicy", "complianceValidation", "rollbackPlanning"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN,
    label: "Workflow simulation and dry-run advisory layer",
    order: 14,
    modulePhases: Object.freeze([137]),
    contractSignals: Object.freeze(["simulation", "dryRun", "scenarioLibrary"])
  }),
  Object.freeze({
    id: ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT,
    label: "Runtime integration contract advisory layer",
    order: 15,
    modulePhases: Object.freeze([138]),
    contractSignals: Object.freeze(["integrationContract", "adapterInterface", "migrationPlanning"])
  })
]);

const RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE,
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
  compositionBlueprintOnly: true,
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
 * @param {string} layerId
 * @returns {Readonly<Array>}
 */
function resolveModulesForLayer(layerId) {
  const modules = [];
  for (let i = 0; i < MODULE_REGISTRY.length; i += 1) {
    if (MODULE_REGISTRY[i].layerId === layerId) {
      modules.push(MODULE_REGISTRY[i]);
    }
  }
  return Object.freeze(modules.slice());
}

/**
 * @param {Readonly<Array>} layers
 * @returns {Readonly<Array>}
 */
function buildLayeredArchitecture(layers) {
  const result = [];
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    result.push(
      deepFreeze({
        id: layer.id,
        label: layer.label,
        order: layer.order,
        modulePhases: layer.modulePhases,
        contractSignals: layer.contractSignals,
        modules: resolveModulesForLayer(layer.id)
      })
    );
  }
  return Object.freeze(result);
}

/**
 * @param {Readonly<Array>} presentLayerIds
 * @returns {string}
 */
function resolveCompositionPosture(presentLayerIds) {
  const allLayerIds = ARCHITECTURE_LAYER_DEFINITIONS.map((layer) => layer.id);
  if (presentLayerIds.length === 0) {
    return COMPOSITION_POSTURE.COMPOSITION_UNKNOWN;
  }
  if (presentLayerIds.length === allLayerIds.length) {
    return COMPOSITION_POSTURE.COMPOSITION_COMPLETE;
  }
  return COMPOSITION_POSTURE.COMPOSITION_PARTIAL;
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedCompositionInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.includedLayerIds != null && !Array.isArray(input.includedLayerIds)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function resolveIncludedLayers(input) {
  if (!Array.isArray(input.includedLayerIds) || input.includedLayerIds.length === 0) {
    return ARCHITECTURE_LAYER_DEFINITIONS;
  }

  const includedSet = new Set(input.includedLayerIds);
  return ARCHITECTURE_LAYER_DEFINITIONS.filter((layer) => includedSet.has(layer.id));
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
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowCompositionBlueprint(input) {
  const normalizedInput = isRecognizedCompositionInput(input) ? input : {};
  const includedLayers = resolveIncludedLayers(normalizedInput);
  const layeredArchitecture = buildLayeredArchitecture(includedLayers);
  const presentLayerIds = layeredArchitecture.map((layer) => layer.id);
  const compositionPosture = resolveCompositionPosture(presentLayerIds);
  const recruitmentId = resolveRecruitmentId(normalizedInput.recruitmentId);

  return deepFreeze({
    entity: RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_ENTITY,
    phase: RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE,
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    recruitmentId,
    compositionPosture,
    layerCount: layeredArchitecture.length,
    moduleCount: MODULE_REGISTRY.length,
    architectureLayers: layeredArchitecture,
    moduleRegistry: MODULE_REGISTRY,
    compositionSummary:
      compositionPosture === COMPOSITION_POSTURE.COMPOSITION_COMPLETE
        ? "Recruitment workflow advisory composition spans Phases 114–138 across fifteen architecture layers"
        : compositionPosture === COMPOSITION_POSTURE.COMPOSITION_PARTIAL
          ? "Recruitment workflow advisory composition partially specified"
          : "Recruitment workflow advisory composition could not be determined",
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_139",
      phase: RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      compositionBlueprintOnly: true
    })
  });
}

/**
 * @returns {Readonly<Object>}
 */
function getRecruitmentWorkflowCompositionBlueprint() {
  return createRecruitmentWorkflowCompositionBlueprint({});
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowCompositionBlueprint(value) {
  return (
    isPlainObject(value) &&
    value.entity === RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_ENTITY &&
    value.phase === RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE,
  RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_ENTITY,
  BLUEPRINT_SCHEMA_VERSION,
  COMPOSITION_POSTURE,
  ARCHITECTURE_LAYER_IDS,
  ARCHITECTURE_LAYER_DEFINITIONS,
  MODULE_REGISTRY,
  RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA,
  createRecruitmentWorkflowCompositionBlueprint,
  getRecruitmentWorkflowCompositionBlueprint,
  isRecruitmentWorkflowCompositionBlueprint
};
