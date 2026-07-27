"use strict";

/**
 * Phase 143 — Recruitment Dependency Map (Advisory Only).
 *
 * Pure advisory descriptive dependency graph for recruitment advisory
 * architecture components across Phases 114–143. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_DEPENDENCY_MAP_PHASE = 143;

const RECRUITMENT_DEPENDENCY_MAP_ENTITY = "recruitment_dependency_map";

const DEPENDENCY_MAP_SCHEMA_VERSION = "1.0.0";

const DEPENDENCY_EDGE_TYPE = Object.freeze({
  DIRECT: "DIRECT",
  ADVISORY_FLOW: "ADVISORY_FLOW",
  SIGNAL_INPUT: "SIGNAL_INPUT"
});

const ADVISORY_FLOW_STAGE = Object.freeze({
  FOUNDATION: "FOUNDATION",
  WORKFLOW_INTELLIGENCE: "WORKFLOW_INTELLIGENCE",
  INTEGRATION_PLANNING: "INTEGRATION_PLANNING",
  RUNTIME_CONTRACT: "RUNTIME_CONTRACT",
  ARCHITECTURE_BLUEPRINT: "ARCHITECTURE_BLUEPRINT",
  RUNTIME_ADOPTION: "RUNTIME_ADOPTION",
  OPERATIONAL_READINESS: "OPERATIONAL_READINESS",
  OPERATIONAL_GOVERNANCE: "OPERATIONAL_GOVERNANCE",
  ARCHITECTURE_CONSOLIDATION: "ARCHITECTURE_CONSOLIDATION"
});

const ADVISORY_FLOW_ORDER = Object.freeze([
  ADVISORY_FLOW_STAGE.FOUNDATION,
  ADVISORY_FLOW_STAGE.WORKFLOW_INTELLIGENCE,
  ADVISORY_FLOW_STAGE.INTEGRATION_PLANNING,
  ADVISORY_FLOW_STAGE.RUNTIME_CONTRACT,
  ADVISORY_FLOW_STAGE.ARCHITECTURE_BLUEPRINT,
  ADVISORY_FLOW_STAGE.RUNTIME_ADOPTION,
  ADVISORY_FLOW_STAGE.OPERATIONAL_READINESS,
  ADVISORY_FLOW_STAGE.OPERATIONAL_GOVERNANCE,
  ADVISORY_FLOW_STAGE.ARCHITECTURE_CONSOLIDATION
]);

const MODULE_DEPENDENCY_GRAPH = Object.freeze([
  Object.freeze({ moduleId: "recruitmentDraftProposalEngine", phase: 114, dependsOn: Object.freeze([]) }),
  Object.freeze({ moduleId: "recruitmentDraftPersistenceBoundary", phase: 115, dependsOn: Object.freeze(["recruitmentDraftProposalEngine"]) }),
  Object.freeze({ moduleId: "recruitmentDraftApprovalGate", phase: 116, dependsOn: Object.freeze(["recruitmentDraftPersistenceBoundary"]) }),
  Object.freeze({ moduleId: "recruitmentDraftReviewPackageBuilder", phase: 117, dependsOn: Object.freeze(["recruitmentDraftProposalEngine", "recruitmentDraftApprovalGate"]) }),
  Object.freeze({ moduleId: "recruitmentDraftStorageAdapter", phase: 118, dependsOn: Object.freeze(["recruitmentDraftReviewPackageBuilder"]) }),
  Object.freeze({ moduleId: "recruitmentDraftRepositoryContract", phase: 119, dependsOn: Object.freeze(["recruitmentDraftStorageAdapter"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowOrchestrator", phase: 120, dependsOn: Object.freeze(["recruitmentDraftReviewPackageBuilder"]) }),
  Object.freeze({ moduleId: "workflowDecisionTraceModel", phase: 121, dependsOn: Object.freeze(["recruitmentWorkflowOrchestrator"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowCapabilityRegistry", phase: 122, dependsOn: Object.freeze(["workflowDecisionTraceModel"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowReadinessAssessment", phase: 123, dependsOn: Object.freeze(["recruitmentWorkflowOrchestrator", "recruitmentWorkflowCapabilityRegistry"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowAdvisoryReportGenerator", phase: 124, dependsOn: Object.freeze(["recruitmentWorkflowReadinessAssessment"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowAdvisorySnapshot", phase: 125, dependsOn: Object.freeze(["recruitmentWorkflowReadinessAssessment", "recruitmentWorkflowAdvisoryReportGenerator"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowSnapshotComparison", phase: 126, dependsOn: Object.freeze(["recruitmentWorkflowAdvisorySnapshot"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowEvolutionAnalyzer", phase: 127, dependsOn: Object.freeze(["recruitmentWorkflowSnapshotComparison"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowHealthIndicator", phase: 128, dependsOn: Object.freeze(["recruitmentWorkflowAdvisorySnapshot", "recruitmentWorkflowEvolutionAnalyzer"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRiskAssessment", phase: 129, dependsOn: Object.freeze(["recruitmentWorkflowHealthIndicator"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntelligenceSummary", phase: 130, dependsOn: Object.freeze(["recruitmentWorkflowHealthIndicator", "recruitmentWorkflowRiskAssessment"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRecommendationModel", phase: 131, dependsOn: Object.freeze(["recruitmentWorkflowIntelligenceSummary"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowTimelineModel", phase: 132, dependsOn: Object.freeze(["recruitmentWorkflowRecommendationModel"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowConsistencyValidator", phase: 133, dependsOn: Object.freeze(["recruitmentWorkflowIntelligenceSummary", "recruitmentWorkflowTimelineModel"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationReadinessFramework", phase: 134, dependsOn: Object.freeze(["recruitmentWorkflowConsistencyValidator"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationRolloutPlanner", phase: 135, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationReadinessFramework"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowFeatureActivationMatrix", phase: 135, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationRolloutPlanner"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationSafetyChecklist", phase: 135, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationRolloutPlanner"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowControlledActivationStrategy", phase: 135, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationRolloutPlanner"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationGovernancePolicy", phase: 136, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationRolloutPlanner"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationDecisionMatrix", phase: 136, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationGovernancePolicy"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowGovernanceComplianceValidator", phase: 136, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationGovernancePolicy"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRollbackPlanner", phase: 136, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationGovernancePolicy"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationGovernanceSummary", phase: 136, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationGovernancePolicy"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowScenarioLibrary", phase: 137, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationGovernanceSummary"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowSimulationEngine", phase: 137, dependsOn: Object.freeze(["recruitmentWorkflowScenarioLibrary"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowSimulationValidator", phase: 137, dependsOn: Object.freeze(["recruitmentWorkflowSimulationEngine"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowSimulationSummary", phase: 137, dependsOn: Object.freeze(["recruitmentWorkflowSimulationEngine"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowSimulationReport", phase: 137, dependsOn: Object.freeze(["recruitmentWorkflowSimulationSummary"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowDryRunExecutor", phase: 137, dependsOn: Object.freeze(["recruitmentWorkflowSimulationEngine"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRuntimeIntegrationContract", phase: 138, dependsOn: Object.freeze(["recruitmentWorkflowSimulationReport"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRuntimeAdapterInterface", phase: 138, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeIntegrationContract"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowContractCompatibilityValidator", phase: 138, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeIntegrationContract"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowContractVersionRegistry", phase: 138, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeIntegrationContract"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRuntimeMigrationPlanner", phase: 138, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeIntegrationContract"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowIntegrationContractSummary", phase: 138, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeIntegrationContract"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowCompositionBlueprint", phase: 139, dependsOn: Object.freeze(["recruitmentWorkflowIntegrationContractSummary"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowExecutionBlueprint", phase: 139, dependsOn: Object.freeze(["recruitmentWorkflowCompositionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowDependencyResolver", phase: 139, dependsOn: Object.freeze(["recruitmentWorkflowCompositionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowCompositionValidator", phase: 139, dependsOn: Object.freeze(["recruitmentWorkflowCompositionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowFutureRuntimeMapping", phase: 139, dependsOn: Object.freeze(["recruitmentWorkflowCompositionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowArchitectureBlueprintSummary", phase: 139, dependsOn: Object.freeze(["recruitmentWorkflowCompositionBlueprint", "recruitmentWorkflowDependencyResolver", "recruitmentWorkflowCompositionValidator"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRuntimeAdoptionBlueprint", phase: 140, dependsOn: Object.freeze(["recruitmentWorkflowArchitectureBlueprintSummary"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowFeatureFlagStrategy", phase: 140, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeAdoptionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowShadowModeBlueprint", phase: 140, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeAdoptionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowRuntimeReadinessGate", phase: 140, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeAdoptionBlueprint", "recruitmentWorkflowFeatureFlagStrategy"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowProductionAdoptionPlaybook", phase: 140, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeAdoptionBlueprint"]) }),
  Object.freeze({ moduleId: "recruitmentWorkflowAdoptionBlueprintSummary", phase: 140, dependsOn: Object.freeze(["recruitmentWorkflowRuntimeAdoptionBlueprint", "recruitmentWorkflowRuntimeReadinessGate", "recruitmentWorkflowProductionAdoptionPlaybook"]) }),
  Object.freeze({ moduleId: "recruitmentOperationalReadinessAssessment", phase: 141, dependsOn: Object.freeze(["recruitmentWorkflowAdoptionBlueprintSummary", "recruitmentWorkflowCapabilityRegistry", "recruitmentWorkflowIntegrationRolloutPlanner", "recruitmentWorkflowFeatureFlagStrategy", "observabilityPlanning", "diagnosticsPlanning"]) }),
  Object.freeze({ moduleId: "recruitmentGovernanceChecklist", phase: 142, dependsOn: Object.freeze(["recruitmentOperationalReadinessAssessment", "recruitmentWorkflowArchitectureBlueprintSummary", "recruitmentWorkflowIntegrationRolloutPlanner", "observabilityPlanning", "diagnosticsPlanning"]) }),
  Object.freeze({ moduleId: "recruitmentRiskAssessmentAdvisor", phase: 142, dependsOn: Object.freeze(["recruitmentGovernanceChecklist", "recruitmentOperationalReadinessAssessment", "recruitmentWorkflowIntegrationRolloutPlanner"]) }),
  Object.freeze({ moduleId: "recruitmentReleaseReadinessAdvisor", phase: 142, dependsOn: Object.freeze(["recruitmentGovernanceChecklist", "recruitmentRiskAssessmentAdvisor", "recruitmentOperationalReadinessAssessment"]) }),
  Object.freeze({ moduleId: "recruitmentOperationalSummaryBuilder", phase: 142, dependsOn: Object.freeze(["recruitmentGovernanceChecklist", "recruitmentRiskAssessmentAdvisor", "recruitmentReleaseReadinessAdvisor", "recruitmentOperationalReadinessAssessment"]) }),
  Object.freeze({ moduleId: "recruitmentArchitectureManifest", phase: 143, dependsOn: Object.freeze(["recruitmentOperationalSummaryBuilder"]) }),
  Object.freeze({ moduleId: "recruitmentDependencyMap", phase: 143, dependsOn: Object.freeze(["recruitmentArchitectureManifest"]) }),
  Object.freeze({ moduleId: "recruitmentConsistencyValidator", phase: 143, dependsOn: Object.freeze(["recruitmentArchitectureManifest", "recruitmentDependencyMap"]) }),
  Object.freeze({ moduleId: "recruitmentDocumentationRegistry", phase: 143, dependsOn: Object.freeze(["recruitmentArchitectureManifest"]) }),
  Object.freeze({ moduleId: "observabilityPlanning", phase: 141, dependsOn: Object.freeze([]), signalOnly: true }),
  Object.freeze({ moduleId: "diagnosticsPlanning", phase: 141, dependsOn: Object.freeze([]), signalOnly: true })
]);

const ADVISORY_FLOW_DEFINITIONS = Object.freeze([
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.FOUNDATION, order: 1, phaseRange: Object.freeze([114, 119]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.WORKFLOW_INTELLIGENCE]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.WORKFLOW_INTELLIGENCE, order: 2, phaseRange: Object.freeze([120, 133]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.INTEGRATION_PLANNING]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.INTEGRATION_PLANNING, order: 3, phaseRange: Object.freeze([134, 137]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.RUNTIME_CONTRACT]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.RUNTIME_CONTRACT, order: 4, phaseRange: Object.freeze([138, 138]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.ARCHITECTURE_BLUEPRINT]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.ARCHITECTURE_BLUEPRINT, order: 5, phaseRange: Object.freeze([139, 139]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.RUNTIME_ADOPTION]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.RUNTIME_ADOPTION, order: 6, phaseRange: Object.freeze([140, 140]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.OPERATIONAL_READINESS]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.OPERATIONAL_READINESS, order: 7, phaseRange: Object.freeze([141, 141]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.OPERATIONAL_GOVERNANCE]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.OPERATIONAL_GOVERNANCE, order: 8, phaseRange: Object.freeze([142, 142]), downstream: Object.freeze([ADVISORY_FLOW_STAGE.ARCHITECTURE_CONSOLIDATION]) }),
  Object.freeze({ stage: ADVISORY_FLOW_STAGE.ARCHITECTURE_CONSOLIDATION, order: 9, phaseRange: Object.freeze([143, 143]), downstream: Object.freeze([]) })
]);

const RUNTIME_ISOLATION_BOUNDARIES = Object.freeze([
  Object.freeze({ boundary: "recruitmentWorkflowOrchestrator", advisoryImportsAllowed: false, description: "Orchestrator must remain independent from advisory consolidation modules." }),
  Object.freeze({ boundary: "recruitmentWorkflowIntegrationCoordinator", advisoryImportsAllowed: false, description: "Coordinator must remain independent from advisory consolidation modules." }),
  Object.freeze({ boundary: "recruitmentWorkflowAdvisoryGateway", advisoryImportsAllowed: false, description: "Advisory gateway must not import Phase 143 consolidation modules." }),
  Object.freeze({ boundary: "runRecruitmentPipeline", advisoryImportsAllowed: false, description: "Execution pipeline must not import advisory consolidation modules." }),
  Object.freeze({ boundary: "siteWorker", advisoryImportsAllowed: false, description: "Site worker must not import advisory consolidation modules." })
]);

const RECRUITMENT_DEPENDENCY_MAP_METADATA = Object.freeze({
  phase: RECRUITMENT_DEPENDENCY_MAP_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  dependencyMapOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  staticAnalysisOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142
  ])
});

const RECRUITMENT_DEPENDENCY_MAP_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DEPENDENCY_MAP_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DEPENDENCY_MAP_PHASE,
  description:
    "Pure advisory descriptive dependency graph for recruitment advisory architecture components.",
  schemaVersion: DEPENDENCY_MAP_SCHEMA_VERSION,
  metadata: RECRUITMENT_DEPENDENCY_MAP_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "moduleRelationships",
  "advisoryFlow",
  "upstreamSummary",
  "downstreamSummary",
  "runtimeIsolationBoundaries",
  "edgeCount",
  "moduleCount",
  "advisoryMetadata"
]);

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
 * @param {*} recruitmentId
 * @returns {string}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null || recruitmentId === "") {
    return "UNKNOWN";
  }
  return String(recruitmentId);
}

/**
 * @returns {Readonly<Array>}
 */
function buildModuleRelationships() {
  const relationships = [];
  for (let i = 0; i < MODULE_DEPENDENCY_GRAPH.length; i += 1) {
    const node = MODULE_DEPENDENCY_GRAPH[i];
    const edges = [];
    for (let j = 0; j < node.dependsOn.length; j += 1) {
      edges.push(
        Object.freeze({
          from: node.dependsOn[j],
          to: node.moduleId,
          edgeType: node.signalOnly === true ? DEPENDENCY_EDGE_TYPE.SIGNAL_INPUT : DEPENDENCY_EDGE_TYPE.DIRECT
        })
      );
    }
    relationships.push(
      Object.freeze({
        moduleId: node.moduleId,
        phase: node.phase,
        dependsOn: node.dependsOn,
        downstreamCount: 0,
        edges,
        signalOnly: node.signalOnly === true
      })
    );
  }

  const downstreamCounts = {};
  for (let i = 0; i < relationships.length; i += 1) {
    const rel = relationships[i];
    for (let j = 0; j < rel.dependsOn.length; j += 1) {
      const upstream = rel.dependsOn[j];
      downstreamCounts[upstream] = (downstreamCounts[upstream] || 0) + 1;
    }
  }

  const enriched = [];
  for (let i = 0; i < relationships.length; i += 1) {
    const rel = relationships[i];
    enriched.push(
      Object.freeze({
        ...rel,
        downstreamCount: downstreamCounts[rel.moduleId] || 0
      })
    );
  }

  return Object.freeze(enriched);
}

/**
 * @param {Readonly<Array>} relationships
 * @returns {Readonly<Object>}
 */
function buildUpstreamSummary(relationships) {
  const upstreamModules = [];
  for (let i = 0; i < relationships.length; i += 1) {
    if (relationships[i].downstreamCount > 0) {
      upstreamModules.push(relationships[i].moduleId);
    }
  }
  upstreamModules.sort();
  return Object.freeze({
    label: "Upstream advisory providers",
    moduleCount: upstreamModules.length,
    modules: Object.freeze(upstreamModules.slice())
  });
}

/**
 * @param {Readonly<Array>} relationships
 * @returns {Readonly<Object>}
 */
function buildDownstreamSummary(relationships) {
  const terminalModules = [];
  for (let i = 0; i < relationships.length; i += 1) {
    if (relationships[i].downstreamCount === 0 && relationships[i].signalOnly !== true) {
      terminalModules.push(relationships[i].moduleId);
    }
  }
  terminalModules.sort();
  return Object.freeze({
    label: "Terminal advisory consumers",
    moduleCount: terminalModules.length,
    modules: Object.freeze(terminalModules.slice())
  });
}

/**
 * @param {Readonly<Array>} relationships
 * @returns {number}
 */
function countEdges(relationships) {
  let count = 0;
  for (let i = 0; i < relationships.length; i += 1) {
    count += relationships[i].edges.length;
  }
  return count;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentDependencyMap(input) {
  const safeInput = isPlainObject(input) ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const moduleRelationships = buildModuleRelationships();

  return deepFreeze({
    recruitmentId,
    moduleRelationships,
    advisoryFlow: ADVISORY_FLOW_DEFINITIONS,
    upstreamSummary: buildUpstreamSummary(moduleRelationships),
    downstreamSummary: buildDownstreamSummary(moduleRelationships),
    runtimeIsolationBoundaries: RUNTIME_ISOLATION_BOUNDARIES,
    edgeCount: countEdges(moduleRelationships),
    moduleCount: MODULE_DEPENDENCY_GRAPH.length,
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_143",
      phase: RECRUITMENT_DEPENDENCY_MAP_PHASE,
      dependencyMapOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false,
      staticAnalysisOnly: true
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDependencyMap(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_RESULT_KEYS[i])) {
      return false;
    }
  }
  if (value.advisoryMetadata == null || value.advisoryMetadata.advisoryOnly !== true) {
    return false;
  }
  if (value.advisoryMetadata.executed !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_DEPENDENCY_MAP_PHASE,
  RECRUITMENT_DEPENDENCY_MAP_ENTITY,
  DEPENDENCY_MAP_SCHEMA_VERSION,
  DEPENDENCY_EDGE_TYPE,
  ADVISORY_FLOW_STAGE,
  ADVISORY_FLOW_ORDER,
  MODULE_DEPENDENCY_GRAPH,
  ADVISORY_FLOW_DEFINITIONS,
  RUNTIME_ISOLATION_BOUNDARIES,
  RECRUITMENT_DEPENDENCY_MAP_METADATA,
  RECRUITMENT_DEPENDENCY_MAP_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentDependencyMap,
  isRecruitmentDependencyMap
};
