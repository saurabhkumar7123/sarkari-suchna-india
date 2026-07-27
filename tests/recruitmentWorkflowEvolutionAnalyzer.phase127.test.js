"use strict";

/**
 * Phase 127 — Recruitment Workflow Advisory Evolution Analyzer tests.
 * Empty input, unknown input, stable/improved/regressed/blocked evolution,
 * signal generation, summary/metadata, determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_PHASE,
  RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_ENTITY,
  EVOLUTION_STATUS,
  PROGRESS_DIRECTION,
  RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA,
  analyzeRecruitmentWorkflowEvolution
} = require("../server/lib/recruitment/recruitmentWorkflowEvolutionAnalyzer");

const {
  compareRecruitmentWorkflowSnapshots
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotComparison");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowEvolutionAnalyzer.js";
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
  "evolutionStatus",
  "progressDirection",
  "improvementSignals",
  "regressionSignals",
  "unchangedSignals",
  "summary",
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

function buildPartialSnapshot(overrides = {}) {
  return {
    workflowSnapshot: {
      state: "WAITING_FOR_APPROVAL",
      nextAction: "Await approval decision"
    },
    readinessSnapshot: {
      status: "APPROVAL_PENDING",
      score: 75
    },
    capabilitySnapshot: {
      total: 8,
      available: 6
    },
    decisionSnapshot: {
      summary: "Approval required",
      traceEntries: 2
    },
    reportSummary: "Workflow is waiting for approval decision",
    ...overrides
  };
}

describe("Phase 127 — recruitmentWorkflowEvolutionAnalyzer", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_PHASE).toBe(127);
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_ENTITY).toBe(
        "recruitment_workflow_evolution_analyzer"
      );
      expect(EVOLUTION_STATUS.IMPROVED).toBe("IMPROVED");
      expect(EVOLUTION_STATUS.REGRESSED).toBe("REGRESSED");
      expect(EVOLUTION_STATUS.STABLE).toBe("STABLE");
      expect(EVOLUTION_STATUS.BLOCKED).toBe("BLOCKED");
      expect(EVOLUTION_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(PROGRESS_DIRECTION.FORWARD).toBe("FORWARD");
      expect(PROGRESS_DIRECTION.BACKWARD).toBe("BACKWARD");
      expect(PROGRESS_DIRECTION.UNCHANGED).toBe("UNCHANGED");
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.generatedBy).toBe("phase_127");
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.evolutionPersistence).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns unknown evolution for null, undefined, and non-object input", () => {
      for (const input of [null, undefined, "bad", 42, true]) {
        const result = analyzeRecruitmentWorkflowEvolution(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.UNKNOWN);
        expect(result.progressDirection).toBe(PROGRESS_DIRECTION.UNKNOWN);
        expect(result.improvementSignals).toEqual([]);
        expect(result.regressionSignals).toEqual([]);
        expect(result.unchangedSignals).toEqual([]);
        expect(result.summary).toBe("Workflow evolution could not be determined");
        expect(result.advisoryMetadata.generatedBy).toBe("phase_127");
      }
    });
  });

  describe("unknown input", () => {
    test("returns unknown evolution for malformed comparison results", () => {
      const malformedInputs = [
        {},
        { changed: "yes" },
        { changed: true, workflowChanges: "not-array" },
        { changed: false, comparisonStatus: 42 },
        { changed: true, readinessChanges: { field: "status" } }
      ];

      for (const input of malformedInputs) {
        const result = analyzeRecruitmentWorkflowEvolution(input);

        expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.UNKNOWN);
        expect(result.progressDirection).toBe(PROGRESS_DIRECTION.UNKNOWN);
        expect(result.summary).toBe("Workflow evolution could not be determined");
      }
    });

    test("returns unknown evolution when comparison changed but no interpretable signals exist", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        comparisonStatus: "CHANGED",
        workflowChanges: [],
        readinessChanges: [],
        capabilityChanges: [],
        decisionChanges: [],
        changedFields: ["reportSummary"],
        summary: "Advisory snapshot change detected in reportSummary"
      });

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.UNKNOWN);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.UNKNOWN);
      expect(result.improvementSignals).toEqual([]);
      expect(result.regressionSignals).toEqual([]);
    });
  });

  describe("stable comparison", () => {
    test("reports stable evolution when comparison is unchanged", () => {
      const comparison = {
        changed: false,
        comparisonStatus: "UNCHANGED",
        changedFields: [],
        workflowChanges: [],
        readinessChanges: [],
        capabilityChanges: [],
        decisionChanges: [],
        summary: "No advisory snapshot changes detected"
      };

      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.STABLE);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.UNCHANGED);
      expect(result.improvementSignals).toEqual([]);
      expect(result.regressionSignals).toEqual([]);
      expect(result.unchangedSignals).toEqual(["No workflow evolution detected"]);
      expect(result.summary).toBe("Workflow advisory state unchanged");
    });

    test("reports stable evolution from phase 126 unchanged comparison", () => {
      const snapshot = buildPartialSnapshot();
      const comparison = compareRecruitmentWorkflowSnapshots(snapshot, {
        workflowSnapshot: { ...snapshot.workflowSnapshot },
        readinessSnapshot: { ...snapshot.readinessSnapshot },
        capabilitySnapshot: { ...snapshot.capabilitySnapshot },
        decisionSnapshot: { ...snapshot.decisionSnapshot },
        reportSummary: snapshot.reportSummary
      });

      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.STABLE);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.UNCHANGED);
      expect(result.unchangedSignals).toContain("No workflow evolution detected");
    });
  });

  describe("improved workflow", () => {
    test("reports improved evolution for readiness advancing toward storage", () => {
      const comparison = {
        changed: true,
        comparisonStatus: "CHANGED",
        readinessChanges: [
          {
            field: "status",
            from: "APPROVAL_PENDING",
            to: "READY_FOR_STORAGE"
          }
        ],
        workflowChanges: [],
        capabilityChanges: [],
        decisionChanges: [],
        changedFields: ["readinessSnapshot.status"],
        summary: "Workflow readiness improved after approval completion"
      };

      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.IMPROVED);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.FORWARD);
      expect(result.improvementSignals).toEqual([
        "Readiness advanced toward storage readiness"
      ]);
      expect(result.regressionSignals).toEqual([]);
      expect(result.summary).toBe("Workflow advisory state improved");
    });

    test("reports improved evolution from phase 126 approval completion comparison", () => {
      const previous = buildPartialSnapshot();
      const current = buildPartialSnapshot({
        workflowSnapshot: {
          state: "READY_FOR_STORAGE",
          nextAction: "Ready for persistence boundary"
        },
        readinessSnapshot: {
          status: "READY_FOR_STORAGE",
          score: 100
        }
      });

      const comparison = compareRecruitmentWorkflowSnapshots(previous, current);
      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.IMPROVED);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.FORWARD);
      expect(result.improvementSignals.length).toBeGreaterThan(0);
      expect(result.regressionSignals).toEqual([]);
    });
  });

  describe("regression workflow", () => {
    test("reports regressed evolution when readiness moves backward from storage readiness", () => {
      const comparison = {
        changed: true,
        comparisonStatus: "CHANGED",
        readinessChanges: [
          {
            field: "status",
            from: "READY_FOR_STORAGE",
            to: "APPROVAL_PENDING"
          }
        ],
        workflowChanges: [],
        capabilityChanges: [],
        decisionChanges: [],
        changedFields: ["readinessSnapshot.status"],
        summary: "Workflow readiness score declined"
      };

      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.REGRESSED);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.BACKWARD);
      expect(result.regressionSignals).toEqual(["Readiness regressed from storage readiness"]);
      expect(result.summary).toBe("Workflow advisory state regressed");
    });
  });

  describe("blocked workflow", () => {
    test("reports blocked evolution when workflow enters blocked state", () => {
      const comparison = {
        changed: true,
        comparisonStatus: "CHANGED",
        workflowChanges: [
          {
            from: "WAITING_FOR_APPROVAL",
            to: "BLOCKED"
          }
        ],
        readinessChanges: [],
        capabilityChanges: [],
        decisionChanges: [],
        changedFields: ["workflowSnapshot.state"],
        summary: "Workflow entered blocked state"
      };

      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.BLOCKED);
      expect(result.progressDirection).toBe(PROGRESS_DIRECTION.BACKWARD);
      expect(result.regressionSignals).toContain("Workflow entered blocked state");
      expect(result.summary).toBe("Workflow advisory state blocked");
    });

    test("reports blocked evolution when readiness enters blocked state", () => {
      const comparison = {
        changed: true,
        comparisonStatus: "CHANGED",
        workflowChanges: [],
        readinessChanges: [
          {
            field: "status",
            from: "APPROVAL_PENDING",
            to: "BLOCKED"
          }
        ],
        capabilityChanges: [],
        decisionChanges: [],
        changedFields: ["readinessSnapshot.status"],
        summary: "Workflow readiness entered blocked state"
      };

      const result = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.BLOCKED);
      expect(result.regressionSignals).toContain("Readiness entered blocked state");
    });
  });

  describe("improvement signals", () => {
    test("detects readiness score improvement", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        comparisonStatus: "CHANGED",
        readinessChanges: [{ field: "score", from: 75, to: 100 }],
        workflowChanges: [],
        capabilityChanges: [],
        decisionChanges: []
      });

      expect(result.improvementSignals).toContain("Workflow readiness score improved");
      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.IMPROVED);
    });

    test("detects capability availability improvement", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        comparisonStatus: "CHANGED",
        capabilityChanges: [{ field: "available", from: 4, to: 6 }],
        workflowChanges: [],
        readinessChanges: [],
        decisionChanges: []
      });

      expect(result.improvementSignals).toContain("Capability availability improved");
      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.IMPROVED);
    });

    test("detects workflow recovery from blocked state", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        comparisonStatus: "CHANGED",
        workflowChanges: [{ from: "BLOCKED", to: "REVIEW_READY" }],
        readinessChanges: [],
        capabilityChanges: [],
        decisionChanges: []
      });

      expect(result.improvementSignals).toContain("Workflow recovered from blocked state");
      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.IMPROVED);
    });
  });

  describe("regression signals", () => {
    test("detects readiness score decline", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        comparisonStatus: "CHANGED",
        readinessChanges: [{ field: "score", from: 100, to: 75 }],
        workflowChanges: [],
        capabilityChanges: [],
        decisionChanges: []
      });

      expect(result.regressionSignals).toContain("Workflow readiness score declined");
      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.REGRESSED);
    });

    test("detects capability availability decline", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        comparisonStatus: "CHANGED",
        capabilityChanges: [{ field: "available", from: 6, to: 4 }],
        workflowChanges: [],
        readinessChanges: [],
        decisionChanges: []
      });

      expect(result.regressionSignals).toContain("Capability availability declined");
      expect(result.evolutionStatus).toBe(EVOLUTION_STATUS.REGRESSED);
    });
  });

  describe("unchanged signals", () => {
    test("includes unchanged signal for stable comparisons", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: false,
        comparisonStatus: "UNCHANGED",
        workflowChanges: [],
        readinessChanges: [],
        capabilityChanges: [],
        decisionChanges: []
      });

      expect(result.unchangedSignals).toEqual(["No workflow evolution detected"]);
    });
  });

  describe("summary generation", () => {
    test("generates summaries for each evolution status", () => {
      const improved = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        readinessChanges: [{ field: "status", from: "APPROVAL_PENDING", to: "READY_FOR_STORAGE" }]
      });
      const regressed = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        readinessChanges: [{ field: "status", from: "READY_FOR_STORAGE", to: "APPROVAL_PENDING" }]
      });
      const stable = analyzeRecruitmentWorkflowEvolution({
        changed: false,
        comparisonStatus: "UNCHANGED"
      });
      const blocked = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        workflowChanges: [{ from: "WAITING_FOR_APPROVAL", to: "BLOCKED" }]
      });
      const unknown = analyzeRecruitmentWorkflowEvolution(null);

      expect(improved.summary).toBe("Workflow advisory state improved");
      expect(regressed.summary).toBe("Workflow advisory state regressed");
      expect(stable.summary).toBe("Workflow advisory state unchanged");
      expect(blocked.summary).toBe("Workflow advisory state blocked");
      expect(unknown.summary).toBe("Workflow evolution could not be determined");
    });
  });

  describe("metadata validation", () => {
    test("includes advisory evolution metadata on every result", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        readinessChanges: [{ field: "status", from: "APPROVAL_PENDING", to: "READY_FOR_STORAGE" }]
      });

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_127");
      expect(result.advisoryMetadata.phase).toBe(127);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.evolutionPersistence).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryEvolutionOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_EVOLUTION_ANALYZER_METADATA.sourcePhases).toEqual([126]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical evolution analysis for identical comparison input", () => {
      const comparison = {
        changed: true,
        comparisonStatus: "CHANGED",
        readinessChanges: [
          {
            field: "status",
            from: "APPROVAL_PENDING",
            to: "READY_FOR_STORAGE"
          }
        ],
        workflowChanges: [],
        capabilityChanges: [],
        decisionChanges: []
      };

      const first = analyzeRecruitmentWorkflowEvolution(comparison);
      const second = analyzeRecruitmentWorkflowEvolution(comparison);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes evolution analysis output", () => {
      const result = analyzeRecruitmentWorkflowEvolution({
        changed: true,
        readinessChanges: [{ field: "status", from: "APPROVAL_PENDING", to: "READY_FOR_STORAGE" }]
      });

      assertAllFrozen(result);
      expect(() => {
        result.summary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.improvementSignals.push("extra");
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate comparison input or nested objects", () => {
      const comparison = {
        changed: true,
        comparisonStatus: "CHANGED",
        readinessChanges: [
          {
            field: "status",
            from: "APPROVAL_PENDING",
            to: "READY_FOR_STORAGE"
          }
        ],
        workflowChanges: [],
        capabilityChanges: [],
        decisionChanges: []
      };

      const before = JSON.stringify(comparison);
      const readinessBefore = JSON.stringify(comparison.readinessChanges[0]);

      analyzeRecruitmentWorkflowEvolution(comparison);
      analyzeRecruitmentWorkflowEvolution(comparison);

      expect(JSON.stringify(comparison)).toBe(before);
      expect(JSON.stringify(comparison.readinessChanges[0])).toBe(readinessBefore);
    });

    test("evolution analysis does not mutate process environment", () => {
      const envBefore = { ...process.env };
      analyzeRecruitmentWorkflowEvolution({
        changed: false,
        comparisonStatus: "UNCHANGED"
      });
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or evolution storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("evolutionPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveEvolution/i);
      expect(source).not.toMatch(/persistEvolution/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory evolution constraints for phase 127", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 127");
      expect(source).toContain("analyzeRecruitmentWorkflowEvolution");
      expect(source).toContain("advisoryEvolutionOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("evolution analyzer is not wired into comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
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

      expect(comparisonSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(comparisonSource).not.toMatch(/recruitmentWorkflowEvolutionAnalyzer/);
      expect(coordinatorSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(gatewaySource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(pipelineSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(workerSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(orchestratorSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(traceModelSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(registrySource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(readinessSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(reportSource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(observationRegistrySource).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowEvolutionAnalyzer/);

      const phase126Block = comparisonSource.slice(comparisonSource.indexOf("Phase 126"));
      expect(phase126Block).not.toMatch(/analyzeRecruitmentWorkflowEvolution/);
      expect(phase126Block).not.toMatch(/recruitmentWorkflowEvolutionAnalyzer/);
    });

    test("orchestrator behavior remains unchanged and independent from evolution analyzer", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("evolutionStatus");
      expect(orchestration).not.toHaveProperty("progressDirection");
      expect(orchestration).not.toHaveProperty("improvementSignals");
    });
  });
});
