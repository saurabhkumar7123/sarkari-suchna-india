"use strict";

/**
 * Phase 128 — Recruitment Workflow Advisory Health Indicator tests.
 * Empty input, unknown state, healthy/stable/at-risk/blocked workflows,
 * health score generation, positive/risk indicators, summary/metadata,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_PHASE,
  RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_ENTITY,
  HEALTH_STATUS,
  EVOLUTION_STATUS,
  RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA,
  assessRecruitmentWorkflowHealth
} = require("../server/lib/recruitment/recruitmentWorkflowHealthIndicator");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowHealthIndicator.js";
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
  "healthStatus",
  "healthScore",
  "positiveIndicators",
  "riskIndicators",
  "healthSummary",
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

describe("Phase 128 — recruitmentWorkflowHealthIndicator", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_PHASE).toBe(128);
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_ENTITY).toBe(
        "recruitment_workflow_health_indicator"
      );
      expect(HEALTH_STATUS.HEALTHY).toBe("HEALTHY");
      expect(HEALTH_STATUS.STABLE).toBe("STABLE");
      expect(HEALTH_STATUS.AT_RISK).toBe("AT_RISK");
      expect(HEALTH_STATUS.BLOCKED).toBe("BLOCKED");
      expect(HEALTH_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(EVOLUTION_STATUS.IMPROVED).toBe("IMPROVED");
      expect(EVOLUTION_STATUS.REGRESSED).toBe("REGRESSED");
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.generatedBy).toBe("phase_128");
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.monitoringEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.alertingEnabled).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns unknown health for null, undefined, empty object, and non-object input", () => {
      for (const input of [null, undefined, {}, "bad", 42, true]) {
        const result = assessRecruitmentWorkflowHealth(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.healthStatus).toBe(HEALTH_STATUS.UNKNOWN);
        expect(result.healthScore).toBe(0);
        expect(result.positiveIndicators).toEqual([]);
        expect(result.riskIndicators).toEqual([]);
        expect(result.healthSummary).toBe("Workflow advisory health could not be determined");
        expect(result.advisoryMetadata.generatedBy).toBe("phase_128");
      }
    });
  });

  describe("unknown state", () => {
    test("returns unknown health for malformed input fields", () => {
      const malformedInputs = [
        { workflowState: 42 },
        { readinessStatus: true },
        { evolutionStatus: {} },
        { readinessScore: "high" },
        { missingCapabilities: "draft_proposal" },
        { blockedReasons: { reason: "blocked" } }
      ];

      for (const input of malformedInputs) {
        const result = assessRecruitmentWorkflowHealth(input);

        expect(result.healthStatus).toBe(HEALTH_STATUS.UNKNOWN);
        expect(result.healthScore).toBe(0);
        expect(result.healthSummary).toBe("Workflow advisory health could not be determined");
      }
    });

    test("returns unknown health when signals are insufficient to classify", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessScore: 0,
        missingCapabilities: [],
        blockedReasons: []
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.UNKNOWN);
      expect(result.positiveIndicators).toEqual([]);
      expect(result.riskIndicators).toEqual([]);
    });
  });

  describe("healthy workflow", () => {
    test("reports healthy workflow for storage-ready improved signals", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.HEALTHY);
      expect(result.healthScore).toBe(95);
      expect(result.positiveIndicators).toEqual([
        "Workflow progressing",
        "Readiness reached storage boundary",
        "No missing capabilities reported",
        "Readiness score indicates forward progress"
      ]);
      expect(result.riskIndicators).toEqual([]);
      expect(result.healthSummary).toBe("Workflow advisory health is healthy");
    });
  });

  describe("stable workflow", () => {
    test("reports stable workflow for approval pending with stable evolution", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        readinessScore: 75,
        evolutionStatus: "STABLE",
        missingCapabilities: []
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.STABLE);
      expect(result.healthScore).toBeGreaterThanOrEqual(50);
      expect(result.healthScore).toBeLessThanOrEqual(85);
      expect(result.positiveIndicators).toContain("Workflow progressing");
      expect(result.positiveIndicators).toContain(
        "Workflow awaiting approval within expected advisory boundary"
      );
      expect(result.riskIndicators).toContain("Approval decision still pending");
      expect(result.healthSummary).toBe("Workflow advisory health is stable");
    });

    test("reports stable workflow for review-ready signals", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "REVIEW_READY",
        readinessScore: 50,
        evolutionStatus: "STABLE",
        missingCapabilities: []
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.STABLE);
      expect(result.positiveIndicators).toContain("Workflow progressing");
      expect(result.positiveIndicators).toContain("Workflow reached review-ready readiness");
      expect(result.healthSummary).toBe("Workflow advisory health is stable");
    });
  });

  describe("at risk workflow", () => {
    test("reports at risk workflow when evolution regressed during approval pending", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "REGRESSED"
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.AT_RISK);
      expect(result.healthScore).toBeLessThanOrEqual(49);
      expect(result.riskIndicators).toContain("Workflow evolution regressed");
      expect(result.riskIndicators).toContain("Approval pending with declining advisory signals");
      expect(result.healthSummary).toBe("Workflow advisory health is at risk");
    });

    test("reports at risk workflow when missing capabilities remain unresolved", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "PARTIALLY_READY",
        readinessScore: 25,
        evolutionStatus: "STABLE",
        missingCapabilities: ["review_package"]
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.AT_RISK);
      expect(result.riskIndicators).toContain("Missing capabilities detected");
      expect(result.riskIndicators).toContain("Workflow readiness remains incomplete");
    });
  });

  describe("blocked workflow", () => {
    test("reports blocked workflow when workflow state is blocked", () => {
      const result = assessRecruitmentWorkflowHealth({
        workflowState: "BLOCKED",
        blockedReasons: ["Approval rejected"]
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.BLOCKED);
      expect(result.healthScore).toBe(0);
      expect(result.positiveIndicators).toEqual([]);
      expect(result.riskIndicators).toContain("Approval rejected");
      expect(result.riskIndicators).toContain("Workflow blocked");
      expect(result.healthSummary).toBe("Workflow advisory health is blocked");
    });

    test("reports blocked workflow when readiness status is blocked", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "BLOCKED",
        blockedReasons: ["Decision trace blocked"]
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.BLOCKED);
      expect(result.healthScore).toBe(0);
      expect(result.riskIndicators).toContain("Decision trace blocked");
    });
  });

  describe("health score generation", () => {
    test("caps healthy score at advisory maximum of 95", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });

      expect(result.healthScore).toBe(95);
    });

    test("reduces score for regressed evolution and missing capabilities", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        readinessScore: 75,
        evolutionStatus: "REGRESSED",
        missingCapabilities: ["approval_gate"]
      });

      expect(result.healthStatus).toBe(HEALTH_STATUS.AT_RISK);
      expect(result.healthScore).toBeLessThanOrEqual(49);
    });

    test("assigns zero score for blocked workflow", () => {
      const result = assessRecruitmentWorkflowHealth({
        workflowState: "BLOCKED",
        readinessScore: 100,
        blockedReasons: ["Rejected"]
      });

      expect(result.healthScore).toBe(0);
    });
  });

  describe("positive indicators", () => {
    test("includes progression and readiness indicators for healthy workflow", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });

      expect(result.positiveIndicators).toContain("Workflow progressing");
      expect(result.positiveIndicators).toContain("Readiness reached storage boundary");
      expect(result.positiveIndicators).toContain("No missing capabilities reported");
    });

    test("does not include positive indicators for unknown health", () => {
      const result = assessRecruitmentWorkflowHealth(null);

      expect(result.positiveIndicators).toEqual([]);
    });
  });

  describe("risk indicators", () => {
    test("includes regression and pending approval risks", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "REGRESSED"
      });

      expect(result.riskIndicators).toContain("Workflow evolution regressed");
      expect(result.riskIndicators).toContain("Approval pending with declining advisory signals");
    });

    test("includes blocked reasons as risk indicators", () => {
      const result = assessRecruitmentWorkflowHealth({
        workflowState: "BLOCKED",
        blockedReasons: ["Approval rejected", "Invalid draft context"]
      });

      expect(result.riskIndicators).toContain("Approval rejected");
      expect(result.riskIndicators).toContain("Invalid draft context");
    });
  });

  describe("summary generation", () => {
    test("generates summaries for each health status", () => {
      const healthy = assessRecruitmentWorkflowHealth({
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });
      const stable = assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        readinessScore: 75,
        evolutionStatus: "STABLE"
      });
      const atRisk = assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "REGRESSED"
      });
      const blocked = assessRecruitmentWorkflowHealth({
        workflowState: "BLOCKED",
        blockedReasons: ["Approval rejected"]
      });
      const unknown = assessRecruitmentWorkflowHealth(null);

      expect(healthy.healthSummary).toBe("Workflow advisory health is healthy");
      expect(stable.healthSummary).toBe("Workflow advisory health is stable");
      expect(atRisk.healthSummary).toBe("Workflow advisory health is at risk");
      expect(blocked.healthSummary).toBe("Workflow advisory health is blocked");
      expect(unknown.healthSummary).toBe("Workflow advisory health could not be determined");
    });
  });

  describe("metadata validation", () => {
    test("includes advisory health metadata on every result", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_128");
      expect(result.advisoryMetadata.phase).toBe(128);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.healthPersistence).toBe(false);
      expect(result.advisoryMetadata.monitoringEnabled).toBe(false);
      expect(result.advisoryMetadata.alertingEnabled).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryHealthOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_HEALTH_INDICATOR_METADATA.sourcePhases).toEqual([123, 127]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical health assessment for identical input", () => {
      const input = {
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      };

      const first = assessRecruitmentWorkflowHealth(input);
      const second = assessRecruitmentWorkflowHealth(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes health assessment output", () => {
      const result = assessRecruitmentWorkflowHealth({
        readinessStatus: "READY_FOR_STORAGE",
        readinessScore: 100,
        evolutionStatus: "IMPROVED",
        missingCapabilities: []
      });

      assertAllFrozen(result);
      expect(() => {
        result.healthSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.positiveIndicators.push("extra");
      }).toThrow();
      expect(() => {
        result.riskIndicators.push("extra");
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate health input or nested arrays", () => {
      const input = {
        workflowState: "WAITING_FOR_APPROVAL",
        readinessStatus: "APPROVAL_PENDING",
        readinessScore: 75,
        evolutionStatus: "STABLE",
        missingCapabilities: ["approval_gate"],
        blockedReasons: []
      };

      const before = JSON.stringify(input);
      const missingBefore = JSON.stringify(input.missingCapabilities);
      const blockedBefore = JSON.stringify(input.blockedReasons);

      assessRecruitmentWorkflowHealth(input);
      assessRecruitmentWorkflowHealth(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.missingCapabilities)).toBe(missingBefore);
      expect(JSON.stringify(input.blockedReasons)).toBe(blockedBefore);
    });

    test("health assessment does not mutate process environment", () => {
      const envBefore = { ...process.env };
      assessRecruitmentWorkflowHealth({
        readinessStatus: "APPROVAL_PENDING",
        evolutionStatus: "STABLE"
      });
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or health storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("healthPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveHealth/i);
      expect(source).not.toMatch(/persistHealth/i);
    });
  });

  describe("no monitoring behavior", () => {
    test("module source declares monitoring and alerting disabled", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No monitoring");
      expect(source).toContain("monitoringEnabled: false");
      expect(source).toContain("alertingEnabled: false");
      expect(source).not.toMatch(/setInterval/i);
      expect(source).not.toMatch(/setTimeout/i);
      expect(source).not.toMatch(/metrics\./i);
      expect(source).not.toMatch(/prometheus/i);
      expect(source).not.toMatch(/datadog/i);
      expect(source).not.toMatch(/sendAlert/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory health constraints for phase 128", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 128");
      expect(source).toContain("assessRecruitmentWorkflowHealth");
      expect(source).toContain("advisoryHealthOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("health indicator is not wired into evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
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

      expect(evolutionSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(evolutionSource).not.toMatch(/recruitmentWorkflowHealthIndicator/);
      expect(comparisonSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(coordinatorSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(gatewaySource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(pipelineSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(workerSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(orchestratorSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(traceModelSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(registrySource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(readinessSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(reportSource).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(observationRegistrySource).not.toMatch(/assessRecruitmentWorkflowHealth/);

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowHealthIndicator/);

      const phase126Block = comparisonSource.slice(comparisonSource.indexOf("Phase 126"));
      expect(phase126Block).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(phase126Block).not.toMatch(/recruitmentWorkflowHealthIndicator/);

      const phase127Block = evolutionSource.slice(evolutionSource.indexOf("Phase 127"));
      expect(phase127Block).not.toMatch(/assessRecruitmentWorkflowHealth/);
      expect(phase127Block).not.toMatch(/recruitmentWorkflowHealthIndicator/);
    });

    test("orchestrator behavior remains unchanged and independent from health indicator", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("healthStatus");
      expect(orchestration).not.toHaveProperty("healthScore");
      expect(orchestration).not.toHaveProperty("positiveIndicators");
    });
  });
});
