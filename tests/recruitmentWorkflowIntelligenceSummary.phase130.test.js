"use strict";

/**
 * Phase 130 — Recruitment Workflow Advisory Intelligence Summary tests.
 * Empty input, basic summary creation, workflow/health/risk/evolution mapping,
 * key signals, recommended focus, metadata, determinism, immutability,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_ENTITY,
  WORKFLOW_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  EVOLUTION_STATUS,
  PROGRESS_DIRECTION,
  RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA,
  createRecruitmentWorkflowIntelligenceSummary
} = require("../server/lib/recruitment/recruitmentWorkflowIntelligenceSummary");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntelligenceSummary.js";
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
  "recruitmentId",
  "workflowStatus",
  "intelligenceSummary",
  "keySignals",
  "currentState",
  "progression",
  "healthOverview",
  "riskOverview",
  "recommendedFocus",
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

function buildHealthyStorageReadyInput(overrides = {}) {
  return {
    recruitmentId: "UP_POLICE_2026",
    advisoryReport: {
      workflowStatus: "STORAGE_BOUNDARY_READY",
      readinessSummary: {
        status: "READY_FOR_STORAGE",
        score: 100
      }
    },
    snapshot: {
      readinessSnapshot: {
        status: "READY_FOR_STORAGE",
        score: 100
      }
    },
    comparison: {
      comparisonStatus: "CHANGED",
      changed: true
    },
    evolution: {
      evolutionStatus: "IMPROVED",
      progressDirection: "FORWARD"
    },
    health: {
      healthStatus: "HEALTHY",
      healthScore: 95
    },
    risk: {
      riskLevel: "LOW"
    },
    ...overrides
  };
}

describe("Phase 130 — recruitmentWorkflowIntelligenceSummary", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_PHASE).toBe(130);
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_ENTITY).toBe(
        "recruitment_workflow_intelligence_summary"
      );
      expect(WORKFLOW_STATUS.READY_FOR_STORAGE).toBe("READY_FOR_STORAGE");
      expect(HEALTH_STATUS.HEALTHY).toBe("HEALTHY");
      expect(RISK_LEVEL.LOW).toBe("LOW");
      expect(EVOLUTION_STATUS.IMPROVED).toBe("IMPROVED");
      expect(PROGRESS_DIRECTION.FORWARD).toBe("FORWARD");
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.generatedBy).toBe("phase_130");
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.automationEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.alertingEnabled).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns unknown intelligence for null, undefined, empty object, and non-object input", () => {
      for (const input of [null, undefined, {}, "bad", 42, true]) {
        const result = createRecruitmentWorkflowIntelligenceSummary(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.recruitmentId).toBeNull();
        expect(result.workflowStatus).toBe(WORKFLOW_STATUS.UNKNOWN);
        expect(result.intelligenceSummary).toBe(
          "Recruitment workflow advisory intelligence could not be determined"
        );
        expect(result.keySignals).toEqual([]);
        expect(result.currentState).toEqual({
          health: HEALTH_STATUS.UNKNOWN,
          risk: RISK_LEVEL.UNKNOWN
        });
        expect(result.progression).toEqual({
          evolution: EVOLUTION_STATUS.UNKNOWN,
          direction: PROGRESS_DIRECTION.UNKNOWN
        });
        expect(result.healthOverview).toEqual({ score: 0 });
        expect(result.riskOverview).toEqual({ level: RISK_LEVEL.UNKNOWN });
        expect(result.recommendedFocus).toEqual([]);
        expect(result.advisoryMetadata.generatedBy).toBe("phase_130");
      }
    });

    test("returns unknown intelligence for malformed input fields", () => {
      const malformedInputs = [
        { recruitmentId: {} },
        { advisoryReport: "report" },
        { snapshot: [] },
        { comparison: 42 },
        { evolution: true },
        { health: "healthy" },
        { risk: null }
      ];

      for (const input of malformedInputs) {
        const result = createRecruitmentWorkflowIntelligenceSummary(input);

        expect(result.workflowStatus).toBe(WORKFLOW_STATUS.UNKNOWN);
        expect(result.intelligenceSummary).toBe(
          "Recruitment workflow advisory intelligence could not be determined"
        );
        expect(result.keySignals).toEqual([]);
      }
    });
  });

  describe("basic summary creation", () => {
    test("creates intelligence summary for healthy storage-ready workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      expect(result.recruitmentId).toBe("UP_POLICE_2026");
      expect(result.workflowStatus).toBe("READY_FOR_STORAGE");
      expect(result.intelligenceSummary).toBe(
        "Recruitment workflow is progressing normally and is ready for the next boundary"
      );
      expect(result.keySignals).toEqual([
        "Workflow improved",
        "Health status healthy",
        "Risk level low",
        "Readiness reached storage boundary"
      ]);
      expect(result.currentState).toEqual({
        health: "HEALTHY",
        risk: "LOW"
      });
      expect(result.progression).toEqual({
        evolution: "IMPROVED",
        direction: "FORWARD"
      });
      expect(result.healthOverview).toEqual({ score: 95 });
      expect(result.riskOverview).toEqual({ level: "LOW" });
      expect(result.recommendedFocus).toEqual(["Proceed through approved workflow boundary"]);
    });
  });

  describe("workflow status mapping", () => {
    test("prefers advisory report readiness status over workflow status", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(
        buildHealthyStorageReadyInput({
          advisoryReport: {
            workflowStatus: "WAITING_FOR_APPROVAL",
            readinessSummary: {
              status: "READY_FOR_STORAGE",
              score: 100
            }
          }
        })
      );

      expect(result.workflowStatus).toBe("READY_FOR_STORAGE");
    });

    test("falls back to advisory report workflow status when readiness summary is absent", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "TEST_001",
        advisoryReport: {
          workflowStatus: "APPROVAL_PENDING"
        },
        health: { healthStatus: "STABLE" },
        risk: { riskLevel: "MEDIUM" }
      });

      expect(result.workflowStatus).toBe("APPROVAL_PENDING");
    });

    test("falls back to snapshot readiness status when advisory report is absent", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "TEST_002",
        snapshot: {
          readinessSnapshot: {
            status: "REVIEW_READY",
            score: 50
          }
        },
        health: { healthStatus: "STABLE" },
        risk: { riskLevel: "MEDIUM" }
      });

      expect(result.workflowStatus).toBe("REVIEW_READY");
    });
  });

  describe("health summary mapping", () => {
    test("maps healthy status and score into current state and health overview", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(
        buildHealthyStorageReadyInput({
          health: {
            healthStatus: "HEALTHY",
            healthScore: 95
          }
        })
      );

      expect(result.currentState.health).toBe("HEALTHY");
      expect(result.healthOverview.score).toBe(95);
    });

    test("maps at-risk health into declining advisory summary", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(
        buildHealthyStorageReadyInput({
          health: {
            healthStatus: "AT_RISK",
            healthScore: 30
          },
          risk: { riskLevel: "HIGH" },
          evolution: {
            evolutionStatus: "REGRESSED",
            progressDirection: "BACKWARD"
          }
        })
      );

      expect(result.currentState.health).toBe("AT_RISK");
      expect(result.healthOverview.score).toBe(30);
      expect(result.intelligenceSummary).toBe(
        "Recruitment workflow shows declining advisory signals and requires attention"
      );
    });

    test("maps blocked health into blocked advisory summary", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "BLOCKED_001",
        advisoryReport: {
          readinessSummary: { status: "BLOCKED", score: 0 }
        },
        health: { healthStatus: "BLOCKED", healthScore: 0 },
        risk: { riskLevel: "CRITICAL" },
        evolution: { evolutionStatus: "BLOCKED", progressDirection: "BACKWARD" }
      });

      expect(result.currentState.health).toBe("BLOCKED");
      expect(result.intelligenceSummary).toBe(
        "Recruitment workflow is blocked and requires resolution before proceeding"
      );
    });
  });

  describe("risk summary mapping", () => {
    test("maps low risk into current state and risk overview", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      expect(result.currentState.risk).toBe("LOW");
      expect(result.riskOverview.level).toBe("LOW");
    });

    test("maps medium risk into moderate progression summary", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "MEDIUM_001",
        advisoryReport: {
          readinessSummary: { status: "REVIEW_READY", score: 50 }
        },
        health: { healthStatus: "STABLE", healthScore: 70 },
        risk: { riskLevel: "MEDIUM" },
        evolution: { evolutionStatus: "STABLE", progressDirection: "UNCHANGED" }
      });

      expect(result.currentState.risk).toBe("MEDIUM");
      expect(result.riskOverview.level).toBe("MEDIUM");
      expect(result.intelligenceSummary).toBe(
        "Recruitment workflow is progressing with moderate advisory signals"
      );
    });

    test("maps critical risk into blocked advisory summary", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "CRITICAL_001",
        advisoryReport: {
          readinessSummary: { status: "BLOCKED", score: 0 }
        },
        health: { healthStatus: "BLOCKED", healthScore: 0 },
        risk: { riskLevel: "CRITICAL" },
        evolution: { evolutionStatus: "BLOCKED", progressDirection: "BACKWARD" }
      });

      expect(result.currentState.risk).toBe("CRITICAL");
      expect(result.riskOverview.level).toBe("CRITICAL");
      expect(result.intelligenceSummary).toBe(
        "Recruitment workflow is blocked and requires resolution before proceeding"
      );
    });
  });

  describe("evolution mapping", () => {
    test("maps improved evolution and forward direction into progression", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      expect(result.progression).toEqual({
        evolution: "IMPROVED",
        direction: "FORWARD"
      });
    });

    test("maps regressed evolution into backward direction when not supplied", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "REGRESS_001",
        advisoryReport: {
          readinessSummary: { status: "APPROVAL_PENDING", score: 75 }
        },
        health: { healthStatus: "AT_RISK", healthScore: 30 },
        risk: { riskLevel: "HIGH" },
        evolution: { evolutionStatus: "REGRESSED" }
      });

      expect(result.progression).toEqual({
        evolution: "REGRESSED",
        direction: "BACKWARD"
      });
      expect(result.keySignals).toContain("Workflow regressed");
    });

    test("maps stable evolution into unchanged direction when not supplied", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "STABLE_001",
        advisoryReport: {
          readinessSummary: { status: "APPROVAL_PENDING", score: 75 }
        },
        health: { healthStatus: "STABLE", healthScore: 70 },
        risk: { riskLevel: "MEDIUM" },
        evolution: { evolutionStatus: "STABLE" }
      });

      expect(result.progression).toEqual({
        evolution: "STABLE",
        direction: "UNCHANGED"
      });
      expect(result.keySignals).toContain("Workflow stable");
    });
  });

  describe("key signal generation", () => {
    test("generates key signals for healthy low-risk improved workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      expect(result.keySignals).toEqual([
        "Workflow improved",
        "Health status healthy",
        "Risk level low",
        "Readiness reached storage boundary"
      ]);
    });

    test("generates key signals for approval pending workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "APPROVAL_001",
        advisoryReport: {
          readinessSummary: { status: "APPROVAL_PENDING", score: 75 }
        },
        health: { healthStatus: "STABLE", healthScore: 70 },
        risk: { riskLevel: "MEDIUM" },
        evolution: { evolutionStatus: "STABLE", progressDirection: "UNCHANGED" }
      });

      expect(result.keySignals).toContain("Workflow stable");
      expect(result.keySignals).toContain("Health status stable");
      expect(result.keySignals).toContain("Risk level medium");
      expect(result.keySignals).toContain("Approval decision pending");
    });

    test("does not generate key signals for empty input", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(null);

      expect(result.keySignals).toEqual([]);
    });
  });

  describe("recommended focus generation", () => {
    test("recommends proceeding through approved workflow boundary for healthy storage-ready workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      expect(result.recommendedFocus).toEqual(["Proceed through approved workflow boundary"]);
    });

    test("recommends resolving blocked context for blocked workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "BLOCKED_002",
        advisoryReport: {
          readinessSummary: { status: "BLOCKED", score: 0 }
        },
        health: { healthStatus: "BLOCKED", healthScore: 0 },
        risk: { riskLevel: "CRITICAL" },
        evolution: { evolutionStatus: "BLOCKED", progressDirection: "BACKWARD" }
      });

      expect(result.recommendedFocus).toEqual([
        "Resolve blocked workflow context before proceeding"
      ]);
    });

    test("recommends monitoring approval for approval pending workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "APPROVAL_002",
        advisoryReport: {
          readinessSummary: { status: "APPROVAL_PENDING", score: 75 }
        },
        health: { healthStatus: "STABLE", healthScore: 70 },
        risk: { riskLevel: "MEDIUM" },
        evolution: { evolutionStatus: "STABLE", progressDirection: "UNCHANGED" }
      });

      expect(result.recommendedFocus).toContain("Monitor approval decision progress");
    });

    test("recommends regression review for regressed workflow", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary({
        recruitmentId: "REGRESS_002",
        advisoryReport: {
          readinessSummary: { status: "APPROVAL_PENDING", score: 75 }
        },
        health: { healthStatus: "AT_RISK", healthScore: 30 },
        risk: { riskLevel: "HIGH" },
        evolution: { evolutionStatus: "REGRESSED", progressDirection: "BACKWARD" }
      });

      expect(result.recommendedFocus).toContain(
        "Review workflow regression and restore prior readiness"
      );
      expect(result.recommendedFocus).toContain(
        "Strengthen advisory signals before workflow advancement"
      );
    });
  });

  describe("metadata validation", () => {
    test("includes advisory intelligence metadata on every result", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_130");
      expect(result.advisoryMetadata.phase).toBe(130);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.summaryPersistence).toBe(false);
      expect(result.advisoryMetadata.automationEnabled).toBe(false);
      expect(result.advisoryMetadata.alertingEnabled).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryIntelligenceOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTELLIGENCE_SUMMARY_METADATA.sourcePhases).toEqual([
        124, 125, 126, 127, 128, 129
      ]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical intelligence summary for identical input", () => {
      const input = buildHealthyStorageReadyInput();

      const first = createRecruitmentWorkflowIntelligenceSummary(input);
      const second = createRecruitmentWorkflowIntelligenceSummary(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes intelligence summary output", () => {
      const result = createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());

      assertAllFrozen(result);
      expect(() => {
        result.intelligenceSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.keySignals.push("extra");
      }).toThrow();
      expect(() => {
        result.recommendedFocus.push("extra");
      }).toThrow();
      expect(() => {
        result.currentState.health = "CHANGED";
      }).toThrow();
      expect(() => {
        result.progression.evolution = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate intelligence input or nested objects", () => {
      const input = buildHealthyStorageReadyInput();

      const before = JSON.stringify(input);
      const advisoryBefore = JSON.stringify(input.advisoryReport);
      const snapshotBefore = JSON.stringify(input.snapshot);
      const evolutionBefore = JSON.stringify(input.evolution);
      const healthBefore = JSON.stringify(input.health);
      const riskBefore = JSON.stringify(input.risk);

      createRecruitmentWorkflowIntelligenceSummary(input);
      createRecruitmentWorkflowIntelligenceSummary(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.advisoryReport)).toBe(advisoryBefore);
      expect(JSON.stringify(input.snapshot)).toBe(snapshotBefore);
      expect(JSON.stringify(input.evolution)).toBe(evolutionBefore);
      expect(JSON.stringify(input.health)).toBe(healthBefore);
      expect(JSON.stringify(input.risk)).toBe(riskBefore);
    });

    test("intelligence summary does not mutate process environment", () => {
      const envBefore = { ...process.env };
      createRecruitmentWorkflowIntelligenceSummary(buildHealthyStorageReadyInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or summary storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("summaryPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveSummary/i);
      expect(source).not.toMatch(/persistSummary/i);
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
    test("module source declares pure advisory intelligence constraints for phase 130", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 130");
      expect(source).toContain("createRecruitmentWorkflowIntelligenceSummary");
      expect(source).toContain("advisoryIntelligenceOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("intelligence summary is not wired into risk assessment, health indicator, evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
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

      expect(riskSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(riskSource).not.toMatch(/recruitmentWorkflowIntelligenceSummary/);
      expect(healthSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(evolutionSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(comparisonSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(coordinatorSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(gatewaySource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(pipelineSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(workerSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(orchestratorSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(traceModelSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(registrySource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(readinessSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(reportSource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(observationRegistrySource).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowIntelligenceSummary/);

      const phase126Block = comparisonSource.slice(comparisonSource.indexOf("Phase 126"));
      expect(phase126Block).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(phase126Block).not.toMatch(/recruitmentWorkflowIntelligenceSummary/);

      const phase127Block = evolutionSource.slice(evolutionSource.indexOf("Phase 127"));
      expect(phase127Block).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(phase127Block).not.toMatch(/recruitmentWorkflowIntelligenceSummary/);

      const phase128Block = healthSource.slice(healthSource.indexOf("Phase 128"));
      expect(phase128Block).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(phase128Block).not.toMatch(/recruitmentWorkflowIntelligenceSummary/);

      const phase129Block = riskSource.slice(riskSource.indexOf("Phase 129"));
      expect(phase129Block).not.toMatch(/createRecruitmentWorkflowIntelligenceSummary/);
      expect(phase129Block).not.toMatch(/recruitmentWorkflowIntelligenceSummary/);
    });

    test("orchestrator behavior remains unchanged and independent from intelligence summary", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("intelligenceSummary");
      expect(orchestration).not.toHaveProperty("keySignals");
      expect(orchestration).not.toHaveProperty("recommendedFocus");
    });
  });
});
