"use strict";

/**
 * Phase 139 — Recruitment Workflow Architecture Blueprint Suite tests.
 * Verifies composition blueprint, execution blueprint, dependency resolver,
 * composition validator, architecture summary, future runtime mapping,
 * isolation, determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
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
} = require("../server/lib/recruitment/recruitmentWorkflowCompositionBlueprint");

const {
  RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE,
  RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_ENTITY,
  EXECUTION_SCHEMA_VERSION,
  EXECUTION_POSTURE,
  EXECUTION_STAGE_IDS,
  EXECUTION_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_METADATA,
  resolveRecruitmentWorkflowExecutionOrder,
  getRecruitmentWorkflowExecutionBlueprint,
  isRecruitmentWorkflowExecutionBlueprint
} = require("../server/lib/recruitment/recruitmentWorkflowExecutionBlueprint");

const {
  RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE,
  RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_ENTITY,
  DEPENDENCY_SCHEMA_VERSION,
  DEPENDENCY_ANALYSIS_STATUS,
  DEPENDENCY_EDGE_TYPE,
  STATIC_DEPENDENCY_GRAPH,
  RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_METADATA,
  analyzeRecruitmentWorkflowDependencies
} = require("../server/lib/recruitment/recruitmentWorkflowDependencyResolver");

const {
  RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_ENTITY,
  VALIDATION_SCHEMA_VERSION,
  VALIDATION_STATUS,
  VALIDATION_ISSUE_TYPE,
  EXPECTED_LAYER_COUNT,
  EXPECTED_PHASE_RANGE,
  RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_METADATA,
  validateRecruitmentWorkflowComposition
} = require("../server/lib/recruitment/recruitmentWorkflowCompositionValidator");

const {
  RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_ENTITY,
  SUMMARY_SCHEMA_VERSION,
  SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_METADATA,
  createRecruitmentWorkflowArchitectureBlueprintSummary
} = require("../server/lib/recruitment/recruitmentWorkflowArchitectureBlueprintSummary");

const {
  RECRUITMENT_WORKFLOW_FUTURE_RUNTIME_MAPPING_PHASE,
  RECRUITMENT_WORKFLOW_FUTURE_RUNTIME_MAPPING_ENTITY,
  MAPPING_SCHEMA_VERSION,
  RUNTIME_MAPPING_POSTURE,
  FUTURE_RUNTIME_ZONE_IDS,
  FUTURE_RUNTIME_ZONE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_FUTURE_RUNTIME_MAPPING_METADATA,
  createRecruitmentWorkflowFutureRuntimeMapping,
  getRecruitmentWorkflowFutureRuntimeMapping,
  isRecruitmentWorkflowFutureRuntimeMapping
} = require("../server/lib/recruitment/recruitmentWorkflowFutureRuntimeMapping");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");

const COMPOSITION_BLUEPRINT_PATH =
  "server/lib/recruitment/recruitmentWorkflowCompositionBlueprint.js";
const EXECUTION_BLUEPRINT_PATH =
  "server/lib/recruitment/recruitmentWorkflowExecutionBlueprint.js";
const DEPENDENCY_RESOLVER_PATH =
  "server/lib/recruitment/recruitmentWorkflowDependencyResolver.js";
const COMPOSITION_VALIDATOR_PATH =
  "server/lib/recruitment/recruitmentWorkflowCompositionValidator.js";
const ARCHITECTURE_SUMMARY_PATH =
  "server/lib/recruitment/recruitmentWorkflowArchitectureBlueprintSummary.js";
const FUTURE_RUNTIME_MAPPING_PATH =
  "server/lib/recruitment/recruitmentWorkflowFutureRuntimeMapping.js";

const PHASE_139_MODULE_PATHS = Object.freeze([
  COMPOSITION_BLUEPRINT_PATH,
  EXECUTION_BLUEPRINT_PATH,
  DEPENDENCY_RESOLVER_PATH,
  COMPOSITION_VALIDATOR_PATH,
  ARCHITECTURE_SUMMARY_PATH,
  FUTURE_RUNTIME_MAPPING_PATH
]);

const PHASE_139_EXPORT_PATTERNS = Object.freeze([
  /createRecruitmentWorkflowCompositionBlueprint/,
  /resolveRecruitmentWorkflowExecutionOrder/,
  /analyzeRecruitmentWorkflowDependencies/,
  /validateRecruitmentWorkflowComposition/,
  /createRecruitmentWorkflowArchitectureBlueprintSummary/,
  /createRecruitmentWorkflowFutureRuntimeMapping/
]);

const INTEGRATION_CONTRACT_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowRuntimeIntegrationContract.js";
const SIMULATION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSimulationEngine.js";
const GOVERNANCE_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationGovernancePolicy.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  if (Object.isFrozen(value)) {
    nodes.push(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectFrozenNodes(value[i], nodes);
    }
    return nodes;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    collectFrozenNodes(value[keys[i]], nodes);
  }
  return nodes;
}

function assertAllFrozen(value) {
  const nodes = collectFrozenNodes(value);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

function buildFullContractSignals() {
  return {
    draftProposal: true,
    persistenceBoundary: true,
    approvalGate: true,
    reviewPackage: true,
    storageAdapter: true,
    repositoryContract: true,
    workflowOrchestrator: true,
    decisionTrace: true,
    capabilityRegistry: true,
    readinessAssessment: true,
    advisoryReport: true,
    advisorySnapshot: true,
    snapshotComparison: true,
    evolutionAnalysis: true,
    healthIndicator: true,
    riskAssessment: true,
    intelligenceSummary: true,
    recommendationModel: true,
    timelineModel: true,
    consistencyValidation: true,
    integrationReadiness: true,
    rolloutPlanning: true,
    activationStrategy: true,
    safetyChecklist: true,
    governancePolicy: true,
    complianceValidation: true,
    rollbackPlanning: true,
    simulation: true,
    dryRun: true,
    scenarioLibrary: true,
    integrationContract: true,
    adapterInterface: true,
    migrationPlanning: true
  };
}

function runFullArchitectureBlueprintSuite(recruitmentId = "ARCH_BLUEPRINT_139") {
  const compositionBlueprint = createRecruitmentWorkflowCompositionBlueprint({ recruitmentId });
  const executionBlueprint = resolveRecruitmentWorkflowExecutionOrder({ recruitmentId });
  const dependencyAnalysis = analyzeRecruitmentWorkflowDependencies({ recruitmentId });
  const compositionValidation = validateRecruitmentWorkflowComposition({
    compositionBlueprint,
    executionBlueprint,
    dependencyAnalysis,
    contractSignals: buildFullContractSignals()
  });
  const futureRuntimeMapping = createRecruitmentWorkflowFutureRuntimeMapping({ recruitmentId });
  const architectureSummary = createRecruitmentWorkflowArchitectureBlueprintSummary({
    recruitmentId,
    compositionBlueprint,
    executionBlueprint,
    dependencyAnalysis,
    compositionValidation,
    futureRuntimeMapping
  });

  return {
    compositionBlueprint,
    executionBlueprint,
    dependencyAnalysis,
    compositionValidation,
    futureRuntimeMapping,
    architectureSummary
  };
}

describe("Phase 139 — recruitmentWorkflowArchitectureBlueprintSuite", () => {
  describe("exports — composition blueprint", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_PHASE).toBe(139);
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_ENTITY).toBe(
        "recruitment_workflow_composition_blueprint"
      );
      expect(BLUEPRINT_SCHEMA_VERSION).toBe("1.0.0");
      expect(COMPOSITION_POSTURE.COMPOSITION_COMPLETE).toBe("COMPOSITION_COMPLETE");
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA.generatedBy).toBe("phase_139");
    });

    test("architecture layer ids cover all fifteen layers", () => {
      expect(ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION).toBe("DRAFT_LIFECYCLE_FOUNDATION");
      expect(ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT).toBe(
        "RUNTIME_INTEGRATION_CONTRACT"
      );
      expect(ARCHITECTURE_LAYER_DEFINITIONS.length).toBe(15);
    });

    test("module registry spans phases 114 through 138", () => {
      const phases = new Set(MODULE_REGISTRY.map((item) => item.phase));
      expect(phases.has(114)).toBe(true);
      expect(phases.has(138)).toBe(true);
      expect(MODULE_REGISTRY.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe("exports — execution blueprint", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_PHASE).toBe(139);
      expect(RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_ENTITY).toBe(
        "recruitment_workflow_execution_blueprint"
      );
      expect(EXECUTION_SCHEMA_VERSION).toBe("1.0.0");
      expect(EXECUTION_POSTURE.ORDER_DEFINED).toBe("ORDER_DEFINED");
      expect(RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_METADATA.schedulerEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_METADATA.workerEnabled).toBe(false);
    });

    test("execution stage definitions span fifteen stages", () => {
      expect(EXECUTION_STAGE_DEFINITIONS.length).toBe(15);
      expect(EXECUTION_STAGE_IDS.FOUNDATION_EVALUATION).toBe("FOUNDATION_EVALUATION");
      expect(EXECUTION_STAGE_IDS.CONTRACT_EVALUATION).toBe("CONTRACT_EVALUATION");
    });
  });

  describe("exports — dependency resolver", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE).toBe(139);
      expect(RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_ENTITY).toBe(
        "recruitment_workflow_dependency_resolver"
      );
      expect(DEPENDENCY_SCHEMA_VERSION).toBe("1.0.0");
      expect(DEPENDENCY_ANALYSIS_STATUS.RESOLVED).toBe("RESOLVED");
      expect(RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_METADATA.staticAnalysisOnly).toBe(true);
    });

    test("static dependency graph covers phases 114 through 138", () => {
      expect(STATIC_DEPENDENCY_GRAPH.length).toBe(25);
      expect(STATIC_DEPENDENCY_GRAPH[0].phase).toBe(114);
      expect(STATIC_DEPENDENCY_GRAPH[STATIC_DEPENDENCY_GRAPH.length - 1].phase).toBe(138);
    });
  });

  describe("exports — composition validator", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_PHASE).toBe(139);
      expect(VALIDATION_STATUS.VALID).toBe("VALID");
      expect(VALIDATION_ISSUE_TYPE.MISSING_LAYER).toBe("MISSING_LAYER");
      expect(EXPECTED_LAYER_COUNT).toBe(15);
      expect(EXPECTED_PHASE_RANGE.min).toBe(114);
      expect(EXPECTED_PHASE_RANGE.max).toBe(138);
    });
  });

  describe("exports — architecture summary", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_PHASE).toBe(139);
      expect(SUMMARY_POSTURE.ARCHITECTURE_READY).toBe("ARCHITECTURE_READY");
      expect(AGGREGATED_COMPONENT.COMPOSITION_BLUEPRINT).toBe("compositionBlueprint");
      expect(RECRUITMENT_WORKFLOW_ARCHITECTURE_BLUEPRINT_SUMMARY_METADATA.architectureOnly).toBe(
        true
      );
    });
  });

  describe("exports — future runtime mapping", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_FUTURE_RUNTIME_MAPPING_PHASE).toBe(139);
      expect(RUNTIME_MAPPING_POSTURE.MAPPING_DEFINED).toBe("MAPPING_DEFINED");
      expect(FUTURE_RUNTIME_ZONE_IDS.CONTRACT_BOUNDARY_ZONE).toBe("CONTRACT_BOUNDARY_ZONE");
      expect(FUTURE_RUNTIME_ZONE_DEFINITIONS.length).toBe(9);
      expect(RECRUITMENT_WORKFLOW_FUTURE_RUNTIME_MAPPING_METADATA.runtimeWiringEnabled).toBe(false);
    });
  });

  describe("composition blueprint", () => {
    test("returns complete composition for default input", () => {
      const result = getRecruitmentWorkflowCompositionBlueprint();

      expect(isRecruitmentWorkflowCompositionBlueprint(result)).toBe(true);
      expect(result.compositionPosture).toBe(COMPOSITION_POSTURE.COMPOSITION_COMPLETE);
      expect(result.layerCount).toBe(15);
      expect(result.architectureLayers.length).toBe(15);
    });

    test("first layer is draft lifecycle foundation", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      const firstLayer = result.architectureLayers[0];

      expect(firstLayer.id).toBe(ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION);
      expect(firstLayer.modulePhases).toEqual([114, 115, 116, 117]);
    });

    test("last layer is runtime integration contract", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      const lastLayer = result.architectureLayers[14];

      expect(lastLayer.id).toBe(ARCHITECTURE_LAYER_IDS.RUNTIME_INTEGRATION_CONTRACT);
      expect(lastLayer.modulePhases).toEqual([138]);
    });

    test("partial composition when layer ids subset provided", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({
        includedLayerIds: [
          ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION,
          ARCHITECTURE_LAYER_IDS.WORKFLOW_ORCHESTRATION
        ]
      });

      expect(result.compositionPosture).toBe(COMPOSITION_POSTURE.COMPOSITION_PARTIAL);
      expect(result.layerCount).toBe(2);
    });

    test("each architecture layer includes modules from registry", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});

      for (let i = 0; i < result.architectureLayers.length; i += 1) {
        const layer = result.architectureLayers[i];
        expect(layer.modules.length).toBeGreaterThan(0);
      }
    });

    test("simulation layer maps to phase 137 modules", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      const simulationLayer = result.architectureLayers.find(
        (layer) => layer.id === ARCHITECTURE_LAYER_IDS.SIMULATION_AND_DRY_RUN
      );

      expect(simulationLayer).toBeDefined();
      expect(simulationLayer.modules.some((mod) => mod.moduleId === "recruitmentWorkflowSimulationEngine")).toBe(
        true
      );
    });

    test("governance layer includes phase 136 modules", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      const governanceLayer = result.architectureLayers.find(
        (layer) => layer.id === ARCHITECTURE_LAYER_IDS.INTEGRATION_GOVERNANCE
      );

      expect(governanceLayer.modules.length).toBe(5);
    });

    test("resolves recruitment id from input", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({ recruitmentId: 139001 });
      expect(result.recruitmentId).toBe("139001");
    });

    test("composition summary text reflects complete posture", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      expect(result.compositionSummary).toContain("Phases 114–138");
    });
  });

  describe("execution blueprint", () => {
    test("returns defined execution order for default input", () => {
      const result = getRecruitmentWorkflowExecutionBlueprint();

      expect(isRecruitmentWorkflowExecutionBlueprint(result)).toBe(true);
      expect(result.executionPosture).toBe(EXECUTION_POSTURE.ORDER_DEFINED);
      expect(result.stageCount).toBe(15);
    });

    test("phase evaluation order starts at phase 114", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      expect(result.phaseEvaluationOrder[0]).toBe(114);
    });

    test("phase evaluation order ends at phase 138", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      const lastPhase = result.phaseEvaluationOrder[result.phaseEvaluationOrder.length - 1];
      expect(lastPhase).toBe(138);
    });

    test("stage evaluation order is sorted by order field", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      for (let i = 1; i < result.stageEvaluationOrder.length; i += 1) {
        expect(result.stageEvaluationOrder[i].order).toBeGreaterThan(
          result.stageEvaluationOrder[i - 1].order
        );
      }
    });

    test("foundation evaluation stage includes phases 114-117", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      const foundation = result.stageEvaluationOrder.find(
        (stage) => stage.stageId === EXECUTION_STAGE_IDS.FOUNDATION_EVALUATION
      );

      expect(foundation.phases).toEqual([114, 115, 116, 117]);
    });

    test("contract evaluation stage is last", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      const lastStage = result.stageEvaluationOrder[result.stageEvaluationOrder.length - 1];
      expect(lastStage.stageId).toBe(EXECUTION_STAGE_IDS.CONTRACT_EVALUATION);
    });

    test("partial execution order when stage subset provided", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({
        includedStageIds: [EXECUTION_STAGE_IDS.FOUNDATION_EVALUATION]
      });

      expect(result.executionPosture).toBe(EXECUTION_POSTURE.ORDER_PARTIAL);
      expect(result.stageCount).toBe(1);
    });

    test("phase count matches unique phases in order", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      const uniquePhases = new Set(result.phaseEvaluationOrder);
      expect(result.phaseCount).toBe(uniquePhases.size);
    });
  });

  describe("dependency resolver", () => {
    test("resolves full dependency analysis for default input", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});

      expect(result.analysisStatus).toBe(DEPENDENCY_ANALYSIS_STATUS.RESOLVED);
      expect(result.includedPhaseCount).toBe(25);
      expect(result.dependencyEdgeCount).toBeGreaterThan(0);
    });

    test("phase 114 is a root phase with no dependencies", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      const phase114 = result.phaseAnalyses.find((item) => item.phase === 114);

      expect(phase114.directDependencies).toEqual([]);
      expect(result.rootPhases).toContain(114);
    });

    test("phase 138 depends on phase 137", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      const phase138 = result.phaseAnalyses.find((item) => item.phase === 138);

      expect(phase138.directDependencies).toContain(137);
    });

    test("phase 117 has transitive dependencies on 114", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      const phase117 = result.phaseAnalyses.find((item) => item.phase === 117);

      expect(phase117.transitiveDependencies).toContain(114);
    });

    test("no circular dependencies in static graph", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      const circular = result.phaseAnalyses.filter((item) => item.hasCircularDependency);

      expect(circular.length).toBe(0);
    });

    test("dependency edges use DIRECT edge type", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      expect(result.dependencyEdges.every((edge) => edge.edgeType === DEPENDENCY_EDGE_TYPE.DIRECT)).toBe(
        true
      );
    });

    test("partial analysis when target phase specified", () => {
      const result = analyzeRecruitmentWorkflowDependencies({ targetPhase: 120 });

      expect(result.analysisStatus).toBe(DEPENDENCY_ANALYSIS_STATUS.PARTIALLY_RESOLVED);
      expect(result.includedPhases).toContain(120);
      expect(result.includedPhases).not.toContain(138);
    });

    test("leaf phases include phase 138", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      expect(result.leafPhases).toContain(138);
    });

    test("dependency summary describes resolved analysis", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      expect(result.dependencySummary).toContain("Phases 114–138");
    });
  });

  describe("composition validator", () => {
    test("validates complete architecture blueprint suite", () => {
      const suite = runFullArchitectureBlueprintSuite();

      expect(suite.compositionValidation.validationStatus).toBe(VALIDATION_STATUS.VALID);
      expect(suite.compositionValidation.issueCount).toBe(0);
    });

    test("returns unknown for empty input", () => {
      const result = validateRecruitmentWorkflowComposition(null);
      expect(result.validationStatus).toBe(VALIDATION_STATUS.UNKNOWN);
      expect(result.issueCount).toBe(0);
    });

    test("detects missing layers for partial composition", () => {
      const compositionBlueprint = createRecruitmentWorkflowCompositionBlueprint({
        includedLayerIds: [ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION]
      });

      const result = validateRecruitmentWorkflowComposition({ compositionBlueprint });

      expect(result.validationStatus).toBe(VALIDATION_STATUS.PARTIALLY_VALID);
      expect(result.issues.some((issue) => issue.type === VALIDATION_ISSUE_TYPE.MISSING_LAYER)).toBe(
        true
      );
    });

    test("detects contract mismatch when signal missing", () => {
      const compositionBlueprint = createRecruitmentWorkflowCompositionBlueprint({});
      const contractSignals = { draftProposal: "MISSING" };

      const result = validateRecruitmentWorkflowComposition({
        compositionBlueprint,
        contractSignals
      });

      expect(
        result.issues.some((issue) => issue.type === VALIDATION_ISSUE_TYPE.CONTRACT_MISMATCH)
      ).toBe(true);
    });

    test("detects dependency gap when phases omitted", () => {
      const dependencyAnalysis = analyzeRecruitmentWorkflowDependencies({
        includedPhases: [120, 138]
      });

      const result = validateRecruitmentWorkflowComposition({ dependencyAnalysis });

      expect(result.issues.some((issue) => issue.type === VALIDATION_ISSUE_TYPE.DEPENDENCY_GAP)).toBe(
        true
      );
    });

    test("detects execution order mismatch when phases reversed", () => {
      const executionBlueprint = resolveRecruitmentWorkflowExecutionOrder({});
      const reversedOrder = Object.freeze(
        executionBlueprint.phaseEvaluationOrder.slice().reverse()
      );
      const dependencyAnalysis = analyzeRecruitmentWorkflowDependencies({});

      const result = validateRecruitmentWorkflowComposition({
        executionBlueprint: {
          phaseEvaluationOrder: reversedOrder
        },
        dependencyAnalysis
      });

      expect(
        result.issues.some((issue) => issue.type === VALIDATION_ISSUE_TYPE.EXECUTION_ORDER_MISMATCH)
      ).toBe(true);
    });

    test("validation summary reflects valid status", () => {
      const suite = runFullArchitectureBlueprintSuite();
      expect(suite.compositionValidation.validationSummary).toContain("passed");
    });
  });

  describe("future runtime mapping", () => {
    test("returns defined mapping for default input", () => {
      const result = getRecruitmentWorkflowFutureRuntimeMapping();

      expect(isRecruitmentWorkflowFutureRuntimeMapping(result)).toBe(true);
      expect(result.mappingPosture).toBe(RUNTIME_MAPPING_POSTURE.MAPPING_DEFINED);
      expect(result.zoneCount).toBe(9);
    });

    test("all runtime zones prohibit persistence", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      expect(
        result.runtimeZoneMappings.every((zone) => zone.persistencePermitted === false)
      ).toBe(true);
    });

    test("all runtime zones prohibit runtime wiring", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      expect(
        result.runtimeZoneMappings.every((zone) => zone.runtimeWiringPermitted === false)
      ).toBe(true);
    });

    test("draft intake zone maps phases 114-117", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      const zone = result.runtimeZoneMappings.find(
        (item) => item.zoneId === FUTURE_RUNTIME_ZONE_IDS.DRAFT_INTAKE_ZONE
      );

      expect(zone.modulePhases).toEqual([114, 115, 116, 117]);
    });

    test("contract boundary zone maps phase 138", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      const zone = result.runtimeZoneMappings.find(
        (item) => item.zoneId === FUTURE_RUNTIME_ZONE_IDS.CONTRACT_BOUNDARY_ZONE
      );

      expect(zone.modulePhases).toEqual([138]);
    });

    test("analytics zone spans phases 125 through 133", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      const zone = result.runtimeZoneMappings.find(
        (item) => item.zoneId === FUTURE_RUNTIME_ZONE_IDS.ANALYTICS_ZONE
      );

      expect(zone.modulePhases).toContain(130);
      expect(zone.modulePhases).toContain(133);
    });

    test("partial mapping when zone subset provided", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({
        includedZoneIds: [FUTURE_RUNTIME_ZONE_IDS.DRAFT_INTAKE_ZONE]
      });

      expect(result.mappingPosture).toBe(RUNTIME_MAPPING_POSTURE.MAPPING_PARTIAL);
      expect(result.zoneCount).toBe(1);
    });

    test("coupling guidance describes advisory-only posture", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      expect(result.couplingGuidance[0].guidance).toContain("no production wiring");
    });

    test("mapped phase count covers all advisory phases", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      expect(result.mappedPhaseCount).toBe(25);
    });
  });

  describe("architecture blueprint summary", () => {
    test("aggregates full suite into architecture ready summary", () => {
      const suite = runFullArchitectureBlueprintSuite();

      expect(suite.architectureSummary.summaryPosture).toBe(SUMMARY_POSTURE.ARCHITECTURE_READY);
      expect(suite.architectureSummary.aggregatedComponents.length).toBe(5);
    });

    test("returns unknown for empty input", () => {
      const result = createRecruitmentWorkflowArchitectureBlueprintSummary(null);
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.UNKNOWN);
    });

    test("blocked summary when validation invalid", () => {
      const compositionBlueprint = createRecruitmentWorkflowCompositionBlueprint({});
      const compositionValidation = validateRecruitmentWorkflowComposition({
        dependencyAnalysis: {
          phaseAnalyses: [
            {
              phase: 120,
              hasCircularDependency: true,
              circularPhases: [120, 117]
            }
          ],
          dependencyEdges: []
        }
      });
      const futureRuntimeMapping = createRecruitmentWorkflowFutureRuntimeMapping({});

      const result = createRecruitmentWorkflowArchitectureBlueprintSummary({
        compositionBlueprint,
        compositionValidation,
        futureRuntimeMapping
      });

      expect(compositionValidation.validationStatus).toBe(VALIDATION_STATUS.INVALID);
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.ARCHITECTURE_BLOCKED);
    });

    test("runtime mapping review required for partial mapping", () => {
      const futureRuntimeMapping = createRecruitmentWorkflowFutureRuntimeMapping({
        includedZoneIds: [FUTURE_RUNTIME_ZONE_IDS.DRAFT_INTAKE_ZONE]
      });
      const compositionBlueprint = createRecruitmentWorkflowCompositionBlueprint({});
      const executionBlueprint = resolveRecruitmentWorkflowExecutionOrder({});
      const dependencyAnalysis = analyzeRecruitmentWorkflowDependencies({});
      const compositionValidation = validateRecruitmentWorkflowComposition({
        compositionBlueprint,
        executionBlueprint,
        dependencyAnalysis,
        contractSignals: buildFullContractSignals()
      });

      const result = createRecruitmentWorkflowArchitectureBlueprintSummary({
        compositionBlueprint,
        executionBlueprint,
        dependencyAnalysis,
        compositionValidation,
        futureRuntimeMapping
      });

      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.RUNTIME_MAPPING_REVIEW_REQUIRED);
    });

    test("key architecture signals include composition and execution postures", () => {
      const suite = runFullArchitectureBlueprintSuite();
      expect(suite.architectureSummary.keyArchitectureSignals).toContain(
        `composition:${COMPOSITION_POSTURE.COMPOSITION_COMPLETE}`
      );
      expect(suite.architectureSummary.keyArchitectureSignals).toContain(
        `execution:${EXECUTION_POSTURE.ORDER_DEFINED}`
      );
    });

    test("recommended focus provided for complete suite", () => {
      const suite = runFullArchitectureBlueprintSuite();
      expect(suite.architectureSummary.recommendedArchitectureFocus.length).toBeGreaterThan(0);
    });

    test("architecture overview includes all component postures", () => {
      const suite = runFullArchitectureBlueprintSuite();
      const overview = suite.architectureSummary.architectureOverview;

      expect(overview.compositionPosture).toBe(COMPOSITION_POSTURE.COMPOSITION_COMPLETE);
      expect(overview.executionPosture).toBe(EXECUTION_POSTURE.ORDER_DEFINED);
      expect(overview.validationStatus).toBe(VALIDATION_STATUS.VALID);
      expect(overview.runtimeMappingPosture).toBe(RUNTIME_MAPPING_POSTURE.MAPPING_DEFINED);
    });
  });

  describe("full suite integration", () => {
    test("suite produces consistent phase coverage across modules", () => {
      const suite = runFullArchitectureBlueprintSuite();

      expect(suite.compositionBlueprint.layerCount).toBe(15);
      expect(suite.executionBlueprint.stageCount).toBe(15);
      expect(suite.dependencyAnalysis.includedPhaseCount).toBe(25);
      expect(suite.futureRuntimeMapping.zoneCount).toBe(9);
    });

    test("all suite outputs declare phase 139 advisory metadata", () => {
      const suite = runFullArchitectureBlueprintSuite();

      expect(suite.compositionBlueprint.advisoryMetadata.phase).toBe(139);
      expect(suite.executionBlueprint.advisoryMetadata.phase).toBe(139);
      expect(suite.dependencyAnalysis.advisoryMetadata.phase).toBe(139);
      expect(suite.compositionValidation.advisoryMetadata.phase).toBe(139);
      expect(suite.futureRuntimeMapping.advisoryMetadata.phase).toBe(139);
      expect(suite.architectureSummary.advisoryMetadata.phase).toBe(139);
    });

    test("execution order respects dependency edges", () => {
      const suite = runFullArchitectureBlueprintSuite();
      const phaseOrder = suite.executionBlueprint.phaseEvaluationOrder;
      const phaseIndex = {};
      for (let i = 0; i < phaseOrder.length; i += 1) {
        phaseIndex[phaseOrder[i]] = i;
      }

      for (let i = 0; i < suite.dependencyAnalysis.dependencyEdges.length; i += 1) {
        const edge = suite.dependencyAnalysis.dependencyEdges[i];
        expect(phaseIndex[edge.fromPhase]).toBeLessThan(phaseIndex[edge.toPhase]);
      }
    });
  });

  describe("isolation", () => {
    test("phase 139 modules do not import each other or other recruitment modules", () => {
      for (let i = 0; i < PHASE_139_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_139_MODULE_PATHS[i]);

        expect(source).toContain("Phase 139");
        expect(source).not.toMatch(/require\(["']\./);
        expect(source).not.toMatch(/require\(["']fs["']\)/);
        expect(source).not.toMatch(/require\(["']express/);
        expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
        expect(source).not.toMatch(/mysql2/);
      }
    });

    test("phase 139 modules are not referenced by prior phase production modules", () => {
      const productionSources = [
        read(INTEGRATION_CONTRACT_MODULE_PATH),
        read(SIMULATION_MODULE_PATH),
        read(GOVERNANCE_MODULE_PATH),
        read(ORCHESTRATOR_MODULE_PATH),
        read(COORDINATOR_MODULE_PATH),
        read(GATEWAY_MODULE_PATH),
        read(PIPELINE_MODULE_PATH),
        read(WORKER_MODULE_PATH)
      ];

      for (let i = 0; i < productionSources.length; i += 1) {
        for (let j = 0; j < PHASE_139_EXPORT_PATTERNS.length; j += 1) {
          expect(productionSources[i]).not.toMatch(PHASE_139_EXPORT_PATTERNS[j]);
        }
      }
    });
  });

  describe("deterministic output", () => {
    test("returns identical composition blueprint for identical input", () => {
      const input = { recruitmentId: "DET_139" };
      const first = createRecruitmentWorkflowCompositionBlueprint(input);
      const second = createRecruitmentWorkflowCompositionBlueprint(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical execution order for identical input", () => {
      const first = resolveRecruitmentWorkflowExecutionOrder({});
      const second = resolveRecruitmentWorkflowExecutionOrder({});

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical dependency analysis for identical input", () => {
      const first = analyzeRecruitmentWorkflowDependencies({});
      const second = analyzeRecruitmentWorkflowDependencies({});

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical validation for identical suite input", () => {
      const suite = runFullArchitectureBlueprintSuite();
      const input = {
        compositionBlueprint: suite.compositionBlueprint,
        executionBlueprint: suite.executionBlueprint,
        dependencyAnalysis: suite.dependencyAnalysis,
        contractSignals: buildFullContractSignals()
      };
      const first = validateRecruitmentWorkflowComposition(input);
      const second = validateRecruitmentWorkflowComposition(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical runtime mapping for identical input", () => {
      const first = createRecruitmentWorkflowFutureRuntimeMapping({});
      const second = createRecruitmentWorkflowFutureRuntimeMapping({});

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical architecture summary for identical input", () => {
      const suite = runFullArchitectureBlueprintSuite();
      const input = {
        recruitmentId: suite.architectureSummary.recruitmentId,
        compositionBlueprint: suite.compositionBlueprint,
        executionBlueprint: suite.executionBlueprint,
        dependencyAnalysis: suite.dependencyAnalysis,
        compositionValidation: suite.compositionValidation,
        futureRuntimeMapping: suite.futureRuntimeMapping
      };
      const first = createRecruitmentWorkflowArchitectureBlueprintSummary(input);
      const second = createRecruitmentWorkflowArchitectureBlueprintSummary(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes composition blueprint output", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      assertAllFrozen(result);
      expect(() => {
        result.architectureLayers.push({});
      }).toThrow();
    });

    test("deep freezes execution blueprint output", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      assertAllFrozen(result);
      expect(() => {
        result.phaseEvaluationOrder.push(999);
      }).toThrow();
    });

    test("deep freezes dependency analysis output", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      assertAllFrozen(result);
      expect(() => {
        result.dependencyEdges[0].fromPhase = 999;
      }).toThrow();
    });

    test("deep freezes composition validation output", () => {
      const result = validateRecruitmentWorkflowComposition({
        compositionBlueprint: createRecruitmentWorkflowCompositionBlueprint({})
      });
      assertAllFrozen(result);
      expect(() => {
        result.issues.push({});
      }).toThrow();
    });

    test("deep freezes future runtime mapping output", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({});
      assertAllFrozen(result);
      expect(() => {
        result.runtimeZoneMappings[0].zoneId = "CHANGED";
      }).toThrow();
    });

    test("deep freezes architecture summary output", () => {
      const suite = runFullArchitectureBlueprintSuite();
      assertAllFrozen(suite.architectureSummary);
      expect(() => {
        suite.architectureSummary.keyArchitectureSignals.push("CHANGED");
      }).toThrow();
    });

    test("does not mutate included layer ids input", () => {
      const includedLayerIds = [ARCHITECTURE_LAYER_IDS.DRAFT_LIFECYCLE_FOUNDATION];
      const before = JSON.stringify(includedLayerIds);
      createRecruitmentWorkflowCompositionBlueprint({ includedLayerIds });
      expect(JSON.stringify(includedLayerIds)).toBe(before);
    });

    test("suite does not mutate process environment", () => {
      const envBefore = { ...process.env };
      runFullArchitectureBlueprintSuite();
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("phase 139 module sources declare no persistence or integration storage", () => {
      for (let i = 0; i < PHASE_139_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_139_MODULE_PATHS[i]);

        expect(source).toContain("no persistence");
        expect(source).toContain("integrationPersistence: false");
        expect(source).toContain("historyTracking: false");
        expect(source).not.toMatch(/INSERT INTO/i);
        expect(source).not.toMatch(/UPDATE\s+/i);
        expect(source).not.toMatch(/saveArchitecture/i);
        expect(source).not.toMatch(/persistBlueprint/i);
      }
    });
  });

  describe("no runtime wiring", () => {
    test("phase 139 modules declare pure advisory contract constraints", () => {
      for (let i = 0; i < PHASE_139_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_139_MODULE_PATHS[i]);

        expect(source).toContain("Advisory Only");
        expect(source).toContain("Never mutates input");
        expect(source).toContain("No automation");
        expect(source).toContain("advisoryOnly: true");
        expect(source).toContain("executed: false");
      }
    });

    test("orchestrator behavior remains unchanged and independent from phase 139 suite", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("compositionPosture");
      expect(orchestration).not.toHaveProperty("architectureLayers");
      expect(orchestration).not.toHaveProperty("validationStatus");
      expect(orchestration).not.toHaveProperty("runtimeZoneMappings");
      expect(orchestration).not.toHaveProperty("summaryPosture");
    });

    test("suite outputs never declare executed true", () => {
      const suite = runFullArchitectureBlueprintSuite();

      expect(suite.compositionBlueprint.advisoryMetadata.executed).toBe(false);
      expect(suite.executionBlueprint.advisoryMetadata.executed).toBe(false);
      expect(suite.dependencyAnalysis.advisoryMetadata.executed).toBe(false);
      expect(suite.compositionValidation.advisoryMetadata.executed).toBe(false);
      expect(suite.futureRuntimeMapping.advisoryMetadata.executed).toBe(false);
      expect(suite.architectureSummary.advisoryMetadata.executed).toBe(false);
    });

    test("execution blueprint declares no scheduler or workers", () => {
      const source = read(EXECUTION_BLUEPRINT_PATH);
      expect(source).toContain("schedulerEnabled: false");
      expect(source).toContain("workerEnabled: false");
      expect(source).not.toMatch(/bullmq/i);
      expect(source).not.toMatch(/setInterval/i);
    });

    test("future runtime mapping declares no runtime wiring", () => {
      const source = read(FUTURE_RUNTIME_MAPPING_PATH);
      expect(source).toContain("runtimeWiringEnabled: false");
      expect(source).toContain("runtimeWiringPermitted: false");
    });
  });

  describe("no production imports", () => {
    test("phase 139 libraries have no runtime require statements", () => {
      for (let i = 0; i < PHASE_139_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_139_MODULE_PATHS[i]);
        expect(source).not.toMatch(/require\(/);
      }
    });
  });

  describe("composition blueprint — extended coverage", () => {
    test("storage repository boundary layer maps phases 118-119", () => {
      const layer = ARCHITECTURE_LAYER_DEFINITIONS.find(
        (item) => item.id === ARCHITECTURE_LAYER_IDS.STORAGE_REPOSITORY_BOUNDARY
      );
      expect(layer.modulePhases).toEqual([118, 119]);
    });

    test("intelligence synthesis layer is order 8", () => {
      const layer = ARCHITECTURE_LAYER_DEFINITIONS.find(
        (item) => item.id === ARCHITECTURE_LAYER_IDS.INTELLIGENCE_SYNTHESIS
      );
      expect(layer.order).toBe(8);
    });

    test("each layer id is unique", () => {
      const ids = ARCHITECTURE_LAYER_DEFINITIONS.map((layer) => layer.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("module registry entries reference valid layer ids", () => {
      const layerIds = new Set(Object.values(ARCHITECTURE_LAYER_IDS));
      for (let i = 0; i < MODULE_REGISTRY.length; i += 1) {
        expect(layerIds.has(MODULE_REGISTRY[i].layerId)).toBe(true);
      }
    });

    test("composition metadata source phases include 114 and 138", () => {
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA.sourcePhases).toContain(114);
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_BLUEPRINT_METADATA.sourcePhases).toContain(138);
    });
  });

  describe("execution blueprint — extended coverage", () => {
    test("governance evaluation stage is order 13", () => {
      const stage = EXECUTION_STAGE_DEFINITIONS.find(
        (item) => item.id === EXECUTION_STAGE_IDS.GOVERNANCE_EVALUATION
      );
      expect(stage.order).toBe(13);
    });

    test("simulation evaluation precedes contract evaluation", () => {
      const simulation = EXECUTION_STAGE_DEFINITIONS.find(
        (item) => item.id === EXECUTION_STAGE_IDS.SIMULATION_EVALUATION
      );
      const contract = EXECUTION_STAGE_DEFINITIONS.find(
        (item) => item.id === EXECUTION_STAGE_IDS.CONTRACT_EVALUATION
      );
      expect(simulation.order).toBeLessThan(contract.order);
    });

    test("execution metadata declares execution blueprint only", () => {
      expect(RECRUITMENT_WORKFLOW_EXECUTION_BLUEPRINT_METADATA.executionBlueprintOnly).toBe(true);
    });
  });

  describe("dependency resolver — extended coverage", () => {
    test("phase 130 depends on phases 120, 127, 128, 129", () => {
      const node = STATIC_DEPENDENCY_GRAPH.find((item) => item.phase === 130);
      expect(node.dependsOn).toEqual([120, 127, 128, 129]);
    });

    test("phase 133 depends on 130, 131, 132", () => {
      const node = STATIC_DEPENDENCY_GRAPH.find((item) => item.phase === 133);
      expect(node.dependsOn).toEqual([130, 131, 132]);
    });

    test("custom included phases filter dependency edges", () => {
      const result = analyzeRecruitmentWorkflowDependencies({
        includedPhases: [114, 115, 116]
      });
      expect(result.dependencyEdgeCount).toBe(2);
    });
  });

  describe("composition validator — extended coverage", () => {
    test("validation metadata declares composition validation only", () => {
      expect(RECRUITMENT_WORKFLOW_COMPOSITION_VALIDATOR_METADATA.compositionValidationOnly).toBe(
        true
      );
    });

    test("invalid status when circular dependency injected in analysis", () => {
      const dependencyAnalysis = {
        phaseAnalyses: [
          {
            phase: 120,
            hasCircularDependency: true,
            circularPhases: [120, 117]
          }
        ],
        dependencyEdges: []
      };

      const result = validateRecruitmentWorkflowComposition({ dependencyAnalysis });
      expect(result.validationStatus).toBe(VALIDATION_STATUS.INVALID);
    });
  });

  describe("future runtime mapping — extended coverage", () => {
    test("observability zone spans trace and readiness layers", () => {
      const zone = FUTURE_RUNTIME_ZONE_DEFINITIONS.find(
        (item) => item.id === FUTURE_RUNTIME_ZONE_IDS.OBSERVABILITY_ZONE
      );
      expect(zone.architectureLayers).toContain("TRACE_AND_CAPABILITY");
      expect(zone.architectureLayers).toContain("READINESS_AND_REPORTING");
    });

    test("integration planning zone maps phases 134-135", () => {
      const zone = FUTURE_RUNTIME_ZONE_DEFINITIONS.find(
        (item) => item.id === FUTURE_RUNTIME_ZONE_IDS.INTEGRATION_PLANNING_ZONE
      );
      expect(zone.modulePhases).toEqual([134, 135]);
    });

    test("future runtime mapping metadata declares descriptive only", () => {
      expect(RECRUITMENT_WORKFLOW_FUTURE_RUNTIME_MAPPING_METADATA.descriptiveOnly).toBe(true);
    });
  });

  describe("architecture summary — extended coverage", () => {
    test("aggregated components include all five blueprint components", () => {
      const suite = runFullArchitectureBlueprintSuite();
      const components = suite.architectureSummary.aggregatedComponents.map(
        (item) => item.component
      );

      expect(components).toContain(AGGREGATED_COMPONENT.COMPOSITION_BLUEPRINT);
      expect(components).toContain(AGGREGATED_COMPONENT.EXECUTION_BLUEPRINT);
      expect(components).toContain(AGGREGATED_COMPONENT.DEPENDENCY_ANALYSIS);
      expect(components).toContain(AGGREGATED_COMPONENT.COMPOSITION_VALIDATION);
      expect(components).toContain(AGGREGATED_COMPONENT.FUTURE_RUNTIME_MAPPING);
    });

    test("architecture summary text ready for complete suite", () => {
      const suite = runFullArchitectureBlueprintSuite();
      expect(suite.architectureSummary.architectureSummary).toContain("ready for advisory review");
    });

    test("summary schema version is 1.0.0", () => {
      expect(SUMMARY_SCHEMA_VERSION).toBe("1.0.0");
    });
  });

  describe("edge cases and input handling", () => {
    test("composition blueprint handles null input", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint(null);
      expect(result.compositionPosture).toBe(COMPOSITION_POSTURE.COMPOSITION_COMPLETE);
    });

    test("execution blueprint handles undefined input", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder(undefined);
      expect(result.executionPosture).toBe(EXECUTION_POSTURE.ORDER_DEFINED);
    });

    test("dependency analysis handles empty object input", () => {
      const result = analyzeRecruitmentWorkflowDependencies({});
      expect(result.analysisStatus).toBe(DEPENDENCY_ANALYSIS_STATUS.RESOLVED);
    });

    test("runtime mapping handles invalid recruitment id type gracefully", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({ recruitmentId: true });
      expect(result.recruitmentId).toBeNull();
    });

    test("composition blueprint unknown posture for empty layer filter with invalid ids", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({
        includedLayerIds: ["NONEXISTENT_LAYER"]
      });
      expect(result.compositionPosture).toBe(COMPOSITION_POSTURE.COMPOSITION_UNKNOWN);
      expect(result.layerCount).toBe(0);
    });

    test("dependency resolver unresolved when no phases included", () => {
      const result = analyzeRecruitmentWorkflowDependencies({ includedPhases: [] });
      expect(result.analysisStatus).toBe(DEPENDENCY_ANALYSIS_STATUS.UNRESOLVED);
    });

    test("architecture summary entity constant matches descriptor", () => {
      const suite = runFullArchitectureBlueprintSuite();
      expect(suite.architectureSummary.recruitmentId).toBe("ARCH_BLUEPRINT_139");
    });

    test("dependency resolver metadata includes all source phases", () => {
      expect(RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_METADATA.sourcePhases.length).toBe(25);
    });

    test("execution blueprint evaluation summary mentions integration contract", () => {
      const result = resolveRecruitmentWorkflowExecutionOrder({});
      expect(result.evaluationSummary).toContain("runtime integration contract");
    });

    test("composition validator recognizes empty object without signals as unknown", () => {
      const result = validateRecruitmentWorkflowComposition({});
      expect(result.validationStatus).toBe(VALIDATION_STATUS.UNKNOWN);
    });

    test("future runtime mapping unknown posture for empty zone filter", () => {
      const result = createRecruitmentWorkflowFutureRuntimeMapping({
        includedZoneIds: ["INVALID_ZONE"]
      });
      expect(result.mappingPosture).toBe(RUNTIME_MAPPING_POSTURE.MAPPING_UNKNOWN);
    });

    test("composition blueprint module count matches registry length", () => {
      const result = createRecruitmentWorkflowCompositionBlueprint({});
      expect(result.moduleCount).toBe(MODULE_REGISTRY.length);
    });
  });
});
