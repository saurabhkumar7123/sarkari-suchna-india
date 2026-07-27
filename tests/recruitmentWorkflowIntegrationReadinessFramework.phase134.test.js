"use strict";

/**
 * Phase 134 — Recruitment Workflow Integration Readiness Framework tests.
 * Empty input, unknown input, not ready, partially ready, ready for controlled integration,
 * dependency graph generation, checkpoint generation, missing prerequisite detection,
 * summary generation, metadata, determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_ENTITY,
  INTEGRATION_STATUS,
  READINESS_LEVEL,
  CHECKPOINT_STATUS,
  CONSISTENCY_STATUS,
  RECOMMENDATION_STATUS,
  READINESS_ASSESSMENT_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  CAPABILITY_IDS,
  CHECKPOINT_IDS,
  PHASE_DEPENDENCY_GRAPH,
  RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA,
  createRecruitmentWorkflowIntegrationReadinessFramework
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationReadinessFramework");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationReadinessFramework.js";
const CONSISTENCY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowConsistencyValidator.js";
const TIMELINE_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowTimelineModel.js";
const RECOMMENDATION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRecommendationModel.js";
const INTELLIGENCE_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntelligenceSummary.js";
const RISK_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRiskAssessment.js";
const HEALTH_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowHealthIndicator.js";
const EVOLUTION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowEvolutionAnalyzer.js";
const COMPARISON_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSnapshotComparison.js";
const SNAPSHOT_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const TRACE_MODEL_MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowCapabilityRegistry.js";
const READINESS_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowReadinessAssessment.js";
const REPORT_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryReportGenerator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const OBSERVATION_REGISTRY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_RESULT_KEYS = Object.freeze([
  "integrationStatus",
  "readinessLevel",
  "dependencyGraph",
  "integrationCheckpoints",
  "missingPrerequisites",
  "integrationSummary",
  "advisoryMetadata"
]);

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

function buildAllCapabilities(overrides = {}) {
  return {
    [CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
    [CAPABILITY_IDS.PERSISTENCE_BOUNDARY]: { available: true, ready: true },
    [CAPABILITY_IDS.APPROVAL_GATE]: { available: true, ready: true, approvalState: "approved" },
    [CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
    [CAPABILITY_IDS.STORAGE_ADAPTER]: { available: true, ready: true },
    [CAPABILITY_IDS.REPOSITORY_CONTRACT]: { available: true, ready: true },
    [CAPABILITY_IDS.WORKFLOW_ORCHESTRATOR]: { available: true, ready: true },
    [CAPABILITY_IDS.DECISION_TRACE_MODEL]: { available: true, ready: true },
    ...overrides
  };
}

function buildReadyForControlledIntegrationInput(overrides = {}) {
  return {
    capabilities: buildAllCapabilities(),
    readinessAssessment: {
      readinessStatus: READINESS_ASSESSMENT_STATUS.READY_FOR_STORAGE,
      readinessScore: 100
    },
    recommendation: {
      recommendationStatus: RECOMMENDATION_STATUS.PROCEED
    },
    consistencyValidation: {
      consistencyStatus: CONSISTENCY_STATUS.CONSISTENT
    },
    timeline: {
      currentStage: "FINAL_RESULT",
      timelineStatus: "COMPLETED"
    },
    intelligenceSummary: {
      currentState: {
        health: HEALTH_STATUS.HEALTHY,
        risk: RISK_LEVEL.LOW
      },
      intelligenceSummary: "Workflow advisory signals are aligned for controlled integration review"
    },
    ...overrides
  };
}

function buildPartiallyReadyInput(overrides = {}) {
  return {
    capabilities: {
      [CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
      [CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true }
    },
    readinessAssessment: {
      readinessStatus: READINESS_ASSESSMENT_STATUS.PARTIALLY_READY,
      readinessScore: 25
    },
    recommendation: {
      recommendationStatus: RECOMMENDATION_STATUS.REVIEW_REQUIRED
    },
    timeline: {
      currentStage: "APPLICATION",
      timelineStatus: "IN_PROGRESS"
    },
    ...overrides
  };
}

function buildNotReadyInput(overrides = {}) {
  return {
    capabilities: {
      [CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true }
    },
    readinessAssessment: {
      readinessStatus: READINESS_ASSESSMENT_STATUS.BLOCKED
    },
    recommendation: {
      recommendationStatus: RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED
    },
    consistencyValidation: {
      consistencyStatus: CONSISTENCY_STATUS.INCONSISTENT
    },
    intelligenceSummary: {
      currentState: {
        health: HEALTH_STATUS.BLOCKED,
        risk: RISK_LEVEL.CRITICAL
      }
    },
    ...overrides
  };
}

describe("Phase 134 — recruitmentWorkflowIntegrationReadinessFramework", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_PHASE).toBe(134);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_ENTITY).toBe(
        "recruitment_workflow_integration_readiness_framework"
      );
      expect(INTEGRATION_STATUS.NOT_READY).toBe("NOT_READY");
      expect(INTEGRATION_STATUS.PARTIALLY_READY).toBe("PARTIALLY_READY");
      expect(INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION).toBe(
        "READY_FOR_CONTROLLED_INTEGRATION"
      );
      expect(INTEGRATION_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(READINESS_LEVEL.READY_FOR_CONTROLLED_INTEGRATION).toBe(
        "READY_FOR_CONTROLLED_INTEGRATION"
      );
      expect(CHECKPOINT_IDS.CONTROLLED_INTEGRATION_GATE).toBe("CONTROLLED_INTEGRATION_GATE");
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.generatedBy).toBe(
        "phase_134"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.automationEnabled).toBe(
        false
      );
    });
  });

  describe("empty input", () => {
    test("returns unknown readiness for null, undefined, empty object, and non-object input", () => {
      for (const input of [null, undefined, {}, "bad", 42, true]) {
        const result = createRecruitmentWorkflowIntegrationReadinessFramework(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.integrationStatus).toBe(INTEGRATION_STATUS.UNKNOWN);
        expect(result.readinessLevel).toBe(READINESS_LEVEL.UNKNOWN);
        expect(result.integrationCheckpoints).toEqual([]);
        expect(result.missingPrerequisites).toEqual([]);
        expect(result.integrationSummary).toBe(
          "Recruitment workflow advisory integration readiness could not be determined from supplied signals"
        );
        expect(result.advisoryMetadata.generatedBy).toBe("phase_134");
      }
    });

    test("returns unknown readiness for malformed input fields", () => {
      const malformedInputs = [
        { capabilities: [] },
        { readinessAssessment: 42 },
        { recommendation: true },
        { consistencyValidation: null },
        { timeline: [] },
        { intelligenceSummary: 99 }
      ];

      for (const input of malformedInputs) {
        const result = createRecruitmentWorkflowIntegrationReadinessFramework(input);

        expect(result.integrationStatus).toBe(INTEGRATION_STATUS.UNKNOWN);
        expect(result.readinessLevel).toBe(READINESS_LEVEL.UNKNOWN);
        expect(result.integrationCheckpoints).toEqual([]);
      }
    });
  });

  describe("unknown input", () => {
    test("returns unknown status when signals are present but inconclusive", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework({
        readinessAssessment: { readinessStatus: "CUSTOM_STATUS" },
        recommendation: { recommendationStatus: "CUSTOM_RECOMMENDATION" },
        timeline: { currentStage: "CUSTOM_STAGE" }
      });

      expect(result.integrationStatus).toBe(INTEGRATION_STATUS.UNKNOWN);
      expect(result.readinessLevel).toBe(READINESS_LEVEL.UNKNOWN);
      expect(result.integrationCheckpoints).toEqual([]);
      expect(result.missingPrerequisites).toEqual([]);
    });
  });

  describe("not ready", () => {
    test("reports not ready for blocked workflow with inconsistent advisory outputs", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(buildNotReadyInput());

      expect(result.integrationStatus).toBe(INTEGRATION_STATUS.NOT_READY);
      expect(result.readinessLevel).toBe(READINESS_LEVEL.NOT_READY);
      expect(result.missingPrerequisites.length).toBeGreaterThan(0);
      expect(result.integrationSummary).toContain("not ready");
    });

    test("flags blocked readiness assessment as missing prerequisite", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(buildNotReadyInput());

      expect(result.missingPrerequisites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            phase: 123,
            id: "readiness_assessment",
            reason: "Workflow readiness assessment is blocked"
          })
        ])
      );
    });

    test("flags inconsistent validation as missing prerequisite", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(buildNotReadyInput());

      expect(result.missingPrerequisites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            phase: 133,
            id: "consistency_validator",
            reason: "Advisory consistency validation reports inconsistent outputs"
          })
        ])
      );
    });
  });

  describe("partially ready", () => {
    test("reports partially ready when only foundational capabilities are satisfied", () => {
      const result =
        createRecruitmentWorkflowIntegrationReadinessFramework(buildPartiallyReadyInput());

      expect(result.integrationStatus).toBe(INTEGRATION_STATUS.PARTIALLY_READY);
      expect(result.readinessLevel).toBe(READINESS_LEVEL.PARTIALLY_READY);
      expect(result.integrationCheckpoints.length).toBeGreaterThan(0);
      expect(result.missingPrerequisites.length).toBeGreaterThan(0);
      expect(result.integrationSummary).toContain("partially ready");
    });

    test("includes satisfied and missing checkpoints for partial readiness", () => {
      const result =
        createRecruitmentWorkflowIntegrationReadinessFramework(buildPartiallyReadyInput());

      const satisfied = result.integrationCheckpoints.filter(
        (checkpoint) => checkpoint.status === CHECKPOINT_STATUS.SATISFIED
      );
      const missing = result.integrationCheckpoints.filter(
        (checkpoint) => checkpoint.status === CHECKPOINT_STATUS.MISSING
      );

      expect(satisfied.length).toBeGreaterThan(0);
      expect(missing.length).toBeGreaterThan(0);
      expect(result.integrationCheckpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: CHECKPOINT_IDS.FOUNDATIONAL_DRAFT_PIPELINE })
        ])
      );
    });
  });

  describe("ready for controlled integration", () => {
    test("reports ready for controlled integration when all advisory checkpoints align", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput()
      );

      expect(result.integrationStatus).toBe(INTEGRATION_STATUS.READY_FOR_CONTROLLED_INTEGRATION);
      expect(result.readinessLevel).toBe(READINESS_LEVEL.READY_FOR_CONTROLLED_INTEGRATION);
      expect(result.integrationSummary).toContain("ready for controlled integration");
    });

    test("marks controlled integration gate checkpoint as satisfied", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput()
      );

      const controlledGate = result.integrationCheckpoints.find(
        (checkpoint) => checkpoint.id === CHECKPOINT_IDS.CONTROLLED_INTEGRATION_GATE
      );

      expect(controlledGate).toBeDefined();
      expect(controlledGate.status).toBe(CHECKPOINT_STATUS.SATISFIED);
      expect(controlledGate.phases).toEqual([134]);
    });

    test("accepts monitor advisory recommendation for controlled integration readiness", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput({
          recommendation: { recommendationStatus: RECOMMENDATION_STATUS.MONITOR_ADVISORY }
        })
      );

      expect(result.readinessLevel).toBe(READINESS_LEVEL.READY_FOR_CONTROLLED_INTEGRATION);
    });
  });

  describe("dependency graph generation", () => {
    test("returns static dependency graph covering phases 114 through 133", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework({});

      expect(result.dependencyGraph).toHaveLength(20);
      expect(result.dependencyGraph[0]).toEqual(
        expect.objectContaining({
          phase: 114,
          id: "draft_proposal",
          dependencies: []
        })
      );
      expect(result.dependencyGraph[19]).toEqual(
        expect.objectContaining({
          phase: 133,
          id: "consistency_validator",
          dependencies: [128, 129, 130, 131, 132]
        })
      );
    });

    test("exported phase dependency graph matches result dependency graph", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildPartiallyReadyInput()
      );

      expect(JSON.stringify(result.dependencyGraph)).toBe(JSON.stringify(PHASE_DEPENDENCY_GRAPH));
    });

    test("dependency graph is identical regardless of input signals", () => {
      const emptyResult = createRecruitmentWorkflowIntegrationReadinessFramework({});
      const readyResult = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput()
      );

      expect(JSON.stringify(emptyResult.dependencyGraph)).toBe(
        JSON.stringify(readyResult.dependencyGraph)
      );
    });
  });

  describe("checkpoint generation", () => {
    test("generates integration checkpoints with expected identifiers", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildPartiallyReadyInput()
      );

      const checkpointIds = result.integrationCheckpoints.map((checkpoint) => checkpoint.id);

      expect(checkpointIds).toEqual(
        expect.arrayContaining([
          CHECKPOINT_IDS.FOUNDATIONAL_DRAFT_PIPELINE,
          CHECKPOINT_IDS.STORAGE_BOUNDARY,
          CHECKPOINT_IDS.ORCHESTRATION_BOUNDARY,
          CHECKPOINT_IDS.TRACE_AND_REGISTRY,
          CHECKPOINT_IDS.READINESS_AND_REPORTING,
          CHECKPOINT_IDS.SNAPSHOT_ANALYSIS,
          CHECKPOINT_IDS.HEALTH_AND_RISK,
          CHECKPOINT_IDS.INTELLIGENCE_AGGREGATION,
          CHECKPOINT_IDS.RECOMMENDATION_AND_TIMELINE,
          CHECKPOINT_IDS.CONSISTENCY_VALIDATION,
          CHECKPOINT_IDS.CONTROLLED_INTEGRATION_GATE
        ])
      );
      expect(result.integrationCheckpoints).toHaveLength(11);
    });

    test("each checkpoint includes label, phases, and status", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput()
      );

      for (let i = 0; i < result.integrationCheckpoints.length; i += 1) {
        const checkpoint = result.integrationCheckpoints[i];
        expect(typeof checkpoint.id).toBe("string");
        expect(typeof checkpoint.label).toBe("string");
        expect(Array.isArray(checkpoint.phases)).toBe(true);
        expect(Object.values(CHECKPOINT_STATUS)).toContain(checkpoint.status);
      }
    });
  });

  describe("missing prerequisite detection", () => {
    test("identifies missing foundational prerequisites for partial capability coverage", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework({
        capabilities: {
          [CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true }
        },
        readinessAssessment: {
          readinessStatus: READINESS_ASSESSMENT_STATUS.PARTIALLY_READY
        }
      });

      expect(result.missingPrerequisites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ phase: 115, id: "persistence_boundary" }),
          expect.objectContaining({ phase: 116, id: "approval_gate" }),
          expect.objectContaining({ phase: 117, id: "review_package" })
        ])
      );
    });

    test("sorts missing prerequisites by phase number", () => {
      const result =
        createRecruitmentWorkflowIntegrationReadinessFramework(buildPartiallyReadyInput());

      const phases = result.missingPrerequisites.map((entry) => entry.phase);
      const sortedPhases = [...phases].sort((left, right) => left - right);

      expect(phases).toEqual(sortedPhases);
    });
  });

  describe("summary generation", () => {
    test("describes unknown integration readiness", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework({});

      expect(result.integrationSummary).toBe(
        "Recruitment workflow advisory integration readiness could not be determined from supplied signals"
      );
    });

    test("describes ready for controlled integration", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput()
      );

      expect(result.integrationSummary).toContain("ready for controlled integration");
      expect(result.integrationSummary).toContain("checkpoints satisfied");
    });

    test("describes partially ready integration posture", () => {
      const result =
        createRecruitmentWorkflowIntegrationReadinessFramework(buildPartiallyReadyInput());

      expect(result.integrationSummary).toContain("partially ready");
    });

    test("describes not ready integration posture", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(buildNotReadyInput());

      expect(result.integrationSummary).toContain("not ready");
    });
  });

  describe("metadata", () => {
    test("includes advisory integration readiness metadata on every result", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildReadyForControlledIntegrationInput()
      );

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_134");
      expect(result.advisoryMetadata.phase).toBe(134);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.integrationPersistence).toBe(false);
      expect(result.advisoryMetadata.automationEnabled).toBe(false);
      expect(result.advisoryMetadata.alertingEnabled).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.integrationReadinessOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.runtimeIntegration).toBe(
        false
      );
      expect(
        RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.mutatesProduction
      ).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA.sourcePhases).toEqual([
        114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
        132, 133
      ]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical integration readiness for identical input", () => {
      const input = buildReadyForControlledIntegrationInput();

      const first = createRecruitmentWorkflowIntegrationReadinessFramework(input);
      const second = createRecruitmentWorkflowIntegrationReadinessFramework(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes integration readiness output", () => {
      const result = createRecruitmentWorkflowIntegrationReadinessFramework(
        buildPartiallyReadyInput()
      );

      assertAllFrozen(result);
      expect(() => {
        result.integrationStatus = "CHANGED";
      }).toThrow();
      expect(() => {
        result.integrationCheckpoints.push({});
      }).toThrow();
      expect(() => {
        result.missingPrerequisites.push({});
      }).toThrow();
      expect(() => {
        result.integrationSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
      expect(() => {
        result.dependencyGraph[0].phase = 999;
      }).toThrow();
      expect(() => {
        result.integrationCheckpoints[0].status = "CHANGED";
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate integration readiness input or nested advisory objects", () => {
      const input = buildReadyForControlledIntegrationInput();

      const before = JSON.stringify(input);
      const capabilitiesBefore = JSON.stringify(input.capabilities);
      const readinessBefore = JSON.stringify(input.readinessAssessment);
      const intelligenceBefore = JSON.stringify(input.intelligenceSummary);

      createRecruitmentWorkflowIntegrationReadinessFramework(input);
      createRecruitmentWorkflowIntegrationReadinessFramework(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.capabilities)).toBe(capabilitiesBefore);
      expect(JSON.stringify(input.readinessAssessment)).toBe(readinessBefore);
      expect(JSON.stringify(input.intelligenceSummary)).toBe(intelligenceBefore);
    });

    test("integration readiness framework does not mutate process environment", () => {
      const envBefore = { ...process.env };
      createRecruitmentWorkflowIntegrationReadinessFramework(buildReadyForControlledIntegrationInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or integration storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("integrationPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveIntegration/i);
      expect(source).not.toMatch(/persistIntegration/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory integration readiness constraints for phase 134", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 134");
      expect(source).toContain("createRecruitmentWorkflowIntegrationReadinessFramework");
      expect(source).toContain("integrationReadinessOnly");
      expect(source).toContain("Never mutates input");
      expect(source).toContain("No automation");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("integration readiness framework is not wired into consistency validator, timeline model, recommendation model, intelligence summary, risk assessment, health indicator, evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
      const consistencySource = read(CONSISTENCY_MODULE_PATH);
      const timelineSource = read(TIMELINE_MODULE_PATH);
      const recommendationSource = read(RECOMMENDATION_MODULE_PATH);
      const intelligenceSource = read(INTELLIGENCE_MODULE_PATH);
      const riskSource = read(RISK_MODULE_PATH);
      const healthSource = read(HEALTH_MODULE_PATH);
      const evolutionSource = read(EVOLUTION_MODULE_PATH);
      const comparisonSource = read(COMPARISON_MODULE_PATH);
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const readinessSource = read(READINESS_MODULE_PATH);
      const reportSource = read(REPORT_MODULE_PATH);
      const snapshotSource = read(SNAPSHOT_MODULE_PATH);
      const observationRegistrySource = read(OBSERVATION_REGISTRY_MODULE_PATH);

      const frameworkPattern = /createRecruitmentWorkflowIntegrationReadinessFramework|recruitmentWorkflowIntegrationReadinessFramework/;

      expect(consistencySource).not.toMatch(frameworkPattern);
      expect(timelineSource).not.toMatch(frameworkPattern);
      expect(recommendationSource).not.toMatch(frameworkPattern);
      expect(intelligenceSource).not.toMatch(frameworkPattern);
      expect(riskSource).not.toMatch(frameworkPattern);
      expect(healthSource).not.toMatch(frameworkPattern);
      expect(evolutionSource).not.toMatch(frameworkPattern);
      expect(comparisonSource).not.toMatch(frameworkPattern);
      expect(coordinatorSource).not.toMatch(frameworkPattern);
      expect(gatewaySource).not.toMatch(frameworkPattern);
      expect(pipelineSource).not.toMatch(frameworkPattern);
      expect(workerSource).not.toMatch(frameworkPattern);
      expect(orchestratorSource).not.toMatch(frameworkPattern);
      expect(traceModelSource).not.toMatch(frameworkPattern);
      expect(registrySource).not.toMatch(frameworkPattern);
      expect(readinessSource).not.toMatch(frameworkPattern);
      expect(reportSource).not.toMatch(frameworkPattern);
      expect(snapshotSource).not.toMatch(frameworkPattern);
      expect(observationRegistrySource).not.toMatch(frameworkPattern);

      const phase128Block = healthSource.slice(healthSource.indexOf("Phase 128"));
      expect(phase128Block).not.toMatch(frameworkPattern);

      const phase129Block = riskSource.slice(riskSource.indexOf("Phase 129"));
      expect(phase129Block).not.toMatch(frameworkPattern);

      const phase130Block = intelligenceSource.slice(intelligenceSource.indexOf("Phase 130"));
      expect(phase130Block).not.toMatch(frameworkPattern);

      const phase131Block = recommendationSource.slice(recommendationSource.indexOf("Phase 131"));
      expect(phase131Block).not.toMatch(frameworkPattern);

      const phase132Block = timelineSource.slice(timelineSource.indexOf("Phase 132"));
      expect(phase132Block).not.toMatch(frameworkPattern);

      const phase133Block = consistencySource.slice(consistencySource.indexOf("Phase 133"));
      expect(phase133Block).not.toMatch(frameworkPattern);
    });

    test("orchestrator behavior remains unchanged and independent from integration readiness framework", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("integrationStatus");
      expect(orchestration).not.toHaveProperty("readinessLevel");
      expect(orchestration).not.toHaveProperty("dependencyGraph");
    });
  });
});
