"use strict";

/**
 * Phase 131 — Recruitment Workflow Advisory Recommendation Model tests.
 * Empty input, unknown input, proceed/review/blocked cases, recommendations,
 * priority focus, explanation, metadata, determinism, immutability,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_PHASE,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_ENTITY,
  RECOMMENDATION_STATUS,
  WORKFLOW_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  EVOLUTION_STATUS,
  READINESS_STATUS,
  RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA,
  generateRecruitmentWorkflowRecommendations
} = require("../server/lib/recruitment/recruitmentWorkflowRecommendationModel");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRecommendationModel.js";
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
  "recommendationStatus",
  "recommendations",
  "priorityFocus",
  "explanation",
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

function buildProceedInput(overrides = {}) {
  return {
    workflowStatus: WORKFLOW_STATUS.READY_FOR_STORAGE,
    readinessStatus: READINESS_STATUS.READY_FOR_STORAGE,
    healthStatus: HEALTH_STATUS.HEALTHY,
    riskLevel: RISK_LEVEL.LOW,
    evolutionStatus: EVOLUTION_STATUS.IMPROVED,
    missingCapabilities: [],
    blockedReasons: [],
    ...overrides
  };
}

describe("Phase 131 — recruitmentWorkflowRecommendationModel", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_PHASE).toBe(131);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_ENTITY).toBe(
        "recruitment_workflow_recommendation_model"
      );
      expect(RECOMMENDATION_STATUS.PROCEED).toBe("PROCEED");
      expect(RECOMMENDATION_STATUS.REVIEW_REQUIRED).toBe("REVIEW_REQUIRED");
      expect(RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED).toBe("BLOCKED_ACTION_REQUIRED");
      expect(RECOMMENDATION_STATUS.MONITOR_ADVISORY).toBe("MONITOR_ADVISORY");
      expect(RECOMMENDATION_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.generatedBy).toBe("phase_131");
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.automationEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.alertingEnabled).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns unknown recommendations for null, undefined, empty object, and non-object input", () => {
      for (const input of [null, undefined, {}, "bad", 42, true]) {
        const result = generateRecruitmentWorkflowRecommendations(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.UNKNOWN);
        expect(result.recommendations).toEqual([]);
        expect(result.priorityFocus).toBe("Signal clarification");
        expect(result.explanation).toBe(
          "Recruitment workflow advisory recommendations could not be determined from supplied signals"
        );
        expect(result.advisoryMetadata.generatedBy).toBe("phase_131");
      }
    });

    test("returns unknown recommendations for malformed input fields", () => {
      const malformedInputs = [
        { workflowStatus: {} },
        { healthStatus: 42 },
        { riskLevel: true },
        { evolutionStatus: [] },
        { readinessStatus: null },
        { missingCapabilities: "approval_gate" },
        { blockedReasons: {} }
      ];

      for (const input of malformedInputs) {
        const result = generateRecruitmentWorkflowRecommendations(input);

        expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.UNKNOWN);
        expect(result.recommendations).toEqual([]);
      }
    });
  });

  describe("unknown input", () => {
    test("returns unknown status when signals are present but inconclusive", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: "CUSTOM_STATUS",
        healthStatus: "CUSTOM_HEALTH"
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.UNKNOWN);
      expect(result.recommendations).toEqual([]);
      expect(result.priorityFocus).toBe("Signal clarification");
    });
  });

  describe("proceed case", () => {
    test("recommends proceeding for ready storage workflow with healthy low-risk signals", () => {
      const result = generateRecruitmentWorkflowRecommendations(buildProceedInput());

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.PROCEED);
      expect(result.recommendations).toEqual(["Proceed toward storage boundary review"]);
      expect(result.priorityFocus).toBe("Proceed toward storage boundary review");
      expect(result.explanation).toBe(
        "Recruitment workflow signals indicate readiness to proceed toward the storage boundary"
      );
    });

    test("does not proceed when missing capabilities are present", () => {
      const result = generateRecruitmentWorkflowRecommendations(
        buildProceedInput({
          missingCapabilities: ["storage_adapter"]
        })
      );

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.REVIEW_REQUIRED);
      expect(result.recommendations).toContain(
        "Address missing workflow capabilities before proceeding"
      );
    });
  });

  describe("review required case", () => {
    test("recommends approval review for approval pending workflow", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: WORKFLOW_STATUS.APPROVAL_PENDING,
        readinessStatus: READINESS_STATUS.APPROVAL_PENDING,
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.MEDIUM,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.REVIEW_REQUIRED);
      expect(result.recommendations).toEqual(["Complete approval review"]);
      expect(result.priorityFocus).toBe("Complete approval review");
      expect(result.explanation).toBe(
        "Recruitment workflow is awaiting approval review within the advisory boundary"
      );
    });

    test("recommends review for regressed workflow with high risk", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: WORKFLOW_STATUS.APPROVAL_PENDING,
        readinessStatus: READINESS_STATUS.APPROVAL_PENDING,
        healthStatus: HEALTH_STATUS.AT_RISK,
        riskLevel: RISK_LEVEL.HIGH,
        evolutionStatus: EVOLUTION_STATUS.REGRESSED,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.REVIEW_REQUIRED);
      expect(result.recommendations).toEqual(["Complete approval review"]);
    });
  });

  describe("blocked case", () => {
    test("recommends blocked action for blocked workflow status", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: WORKFLOW_STATUS.BLOCKED,
        readinessStatus: READINESS_STATUS.BLOCKED,
        healthStatus: HEALTH_STATUS.BLOCKED,
        riskLevel: RISK_LEVEL.CRITICAL,
        evolutionStatus: EVOLUTION_STATUS.BLOCKED,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED);
      expect(result.recommendations).toEqual(["Resolve blocked workflow conditions"]);
      expect(result.priorityFocus).toBe("Resolve blocked workflow conditions");
      expect(result.explanation).toBe(
        "Recruitment workflow is blocked and requires resolution before advisory progression"
      );
    });

    test("includes blocked reason guidance when blocked reasons are supplied", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: WORKFLOW_STATUS.APPROVAL_PENDING,
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.LOW,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: [],
        blockedReasons: ["Approval gate rejected"]
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED);
      expect(result.recommendations).toEqual([
        "Resolve blocked workflow conditions",
        "Review supplied blocked reasons before workflow advancement"
      ]);
    });
  });

  describe("recommendations", () => {
    test("generates monitor advisory recommendations for stable medium-risk workflow", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: WORKFLOW_STATUS.REVIEW_READY,
        readinessStatus: READINESS_STATUS.REVIEW_READY,
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.MEDIUM,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.REVIEW_REQUIRED);
      expect(result.recommendations).toEqual(["Complete review package validation"]);
    });

    test("generates monitor advisory recommendations for stable workflow without review blockers", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: "STORAGE_BOUNDARY_READY",
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.MEDIUM,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.recommendationStatus).toBe(RECOMMENDATION_STATUS.MONITOR_ADVISORY);
      expect(result.recommendations).toEqual([
        "Monitor advisory risk factors during workflow progression"
      ]);
    });
  });

  describe("priority focus", () => {
    test("uses first recommendation as priority focus when recommendations exist", () => {
      const result = generateRecruitmentWorkflowRecommendations(buildProceedInput());

      expect(result.priorityFocus).toBe(result.recommendations[0]);
    });

    test("falls back to signal clarification for unknown recommendations", () => {
      const result = generateRecruitmentWorkflowRecommendations(null);

      expect(result.priorityFocus).toBe("Signal clarification");
    });
  });

  describe("explanation", () => {
    test("explains monitor advisory context for medium risk stable workflow", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: "STORAGE_BOUNDARY_READY",
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.MEDIUM,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.explanation).toBe(
        "Recruitment workflow is progressing with moderate advisory signals that warrant monitoring"
      );
    });

    test("explains review required context for review ready workflow", () => {
      const result = generateRecruitmentWorkflowRecommendations({
        workflowStatus: WORKFLOW_STATUS.REVIEW_READY,
        readinessStatus: READINESS_STATUS.REVIEW_READY,
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.LOW,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.explanation).toBe(
        "Recruitment workflow requires advisory review before the next workflow focus"
      );
    });
  });

  describe("metadata validation", () => {
    test("includes advisory recommendation metadata on every result", () => {
      const result = generateRecruitmentWorkflowRecommendations(buildProceedInput());

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_131");
      expect(result.advisoryMetadata.phase).toBe(131);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.recommendationPersistence).toBe(false);
      expect(result.advisoryMetadata.automationEnabled).toBe(false);
      expect(result.advisoryMetadata.alertingEnabled).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryRecommendationOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_RECOMMENDATION_MODEL_METADATA.sourcePhases).toEqual([
        123, 127, 128, 129, 130
      ]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical recommendations for identical input", () => {
      const input = buildProceedInput();

      const first = generateRecruitmentWorkflowRecommendations(input);
      const second = generateRecruitmentWorkflowRecommendations(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes recommendation output", () => {
      const result = generateRecruitmentWorkflowRecommendations(buildProceedInput());

      assertAllFrozen(result);
      expect(() => {
        result.recommendationStatus = "CHANGED";
      }).toThrow();
      expect(() => {
        result.recommendations.push("extra");
      }).toThrow();
      expect(() => {
        result.priorityFocus = "CHANGED";
      }).toThrow();
      expect(() => {
        result.explanation = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate recommendation input or nested arrays", () => {
      const input = {
        workflowStatus: WORKFLOW_STATUS.APPROVAL_PENDING,
        readinessStatus: READINESS_STATUS.APPROVAL_PENDING,
        healthStatus: HEALTH_STATUS.STABLE,
        riskLevel: RISK_LEVEL.MEDIUM,
        evolutionStatus: EVOLUTION_STATUS.STABLE,
        missingCapabilities: ["approval_gate"],
        blockedReasons: ["Pending reviewer"]
      };

      const before = JSON.stringify(input);
      const missingBefore = JSON.stringify(input.missingCapabilities);
      const blockedBefore = JSON.stringify(input.blockedReasons);

      generateRecruitmentWorkflowRecommendations(input);
      generateRecruitmentWorkflowRecommendations(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.missingCapabilities)).toBe(missingBefore);
      expect(JSON.stringify(input.blockedReasons)).toBe(blockedBefore);
    });

    test("recommendation model does not mutate process environment", () => {
      const envBefore = { ...process.env };
      generateRecruitmentWorkflowRecommendations(buildProceedInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or recommendation storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("recommendationPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveRecommendation/i);
      expect(source).not.toMatch(/persistRecommendation/i);
    });
  });

  describe("no automation", () => {
    test("module source declares automation and alerting disabled", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No automation");
      expect(source).toContain("automationEnabled: false");
      expect(source).toContain("alertingEnabled: false");
      expect(source).not.toMatch(/setInterval/i);
      expect(source).not.toMatch(/setTimeout/i);
      expect(source).not.toMatch(/schedule/i);
      expect(source).not.toMatch(/worker/i);
      expect(source).not.toMatch(/sendAlert/i);
      expect(source).not.toMatch(/notify/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory recommendation constraints for phase 131", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 131");
      expect(source).toContain("generateRecruitmentWorkflowRecommendations");
      expect(source).toContain("advisoryRecommendationOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("recommendation model is not wired into intelligence summary, risk assessment, health indicator, evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
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

      expect(intelligenceSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(intelligenceSource).not.toMatch(/recruitmentWorkflowRecommendationModel/);
      expect(riskSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(healthSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(evolutionSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(comparisonSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(coordinatorSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(gatewaySource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(pipelineSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(workerSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(orchestratorSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(traceModelSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(registrySource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(readinessSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(reportSource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(observationRegistrySource).not.toMatch(/generateRecruitmentWorkflowRecommendations/);

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowRecommendationModel/);

      const phase126Block = comparisonSource.slice(comparisonSource.indexOf("Phase 126"));
      expect(phase126Block).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(phase126Block).not.toMatch(/recruitmentWorkflowRecommendationModel/);

      const phase127Block = evolutionSource.slice(evolutionSource.indexOf("Phase 127"));
      expect(phase127Block).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(phase127Block).not.toMatch(/recruitmentWorkflowRecommendationModel/);

      const phase128Block = healthSource.slice(healthSource.indexOf("Phase 128"));
      expect(phase128Block).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(phase128Block).not.toMatch(/recruitmentWorkflowRecommendationModel/);

      const phase129Block = riskSource.slice(riskSource.indexOf("Phase 129"));
      expect(phase129Block).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(phase129Block).not.toMatch(/recruitmentWorkflowRecommendationModel/);

      const phase130Block = intelligenceSource.slice(intelligenceSource.indexOf("Phase 130"));
      expect(phase130Block).not.toMatch(/generateRecruitmentWorkflowRecommendations/);
      expect(phase130Block).not.toMatch(/recruitmentWorkflowRecommendationModel/);
    });

    test("orchestrator behavior remains unchanged and independent from recommendation model", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("recommendationStatus");
      expect(orchestration).not.toHaveProperty("recommendations");
      expect(orchestration).not.toHaveProperty("priorityFocus");
    });
  });
});
