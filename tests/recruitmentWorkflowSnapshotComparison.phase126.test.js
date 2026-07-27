"use strict";

/**
 * Phase 126 — Recruitment Workflow Snapshot Comparison Model tests.
 * Empty snapshots, identical snapshots, field-level changes, summary/metadata,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_PHASE,
  RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_ENTITY,
  COMPARISON_STATUS,
  RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA,
  compareRecruitmentWorkflowSnapshots
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotComparison");

const { createRecruitmentWorkflowAdvisorySnapshot } = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSnapshotComparison.js";
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
  "changed",
  "comparisonStatus",
  "changedFields",
  "workflowChanges",
  "readinessChanges",
  "capabilityChanges",
  "decisionChanges",
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

describe("Phase 126 — recruitmentWorkflowSnapshotComparison model", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_PHASE).toBe(126);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_ENTITY).toBe(
        "recruitment_workflow_snapshot_comparison"
      );
      expect(COMPARISON_STATUS.CHANGED).toBe("CHANGED");
      expect(COMPARISON_STATUS.UNCHANGED).toBe("UNCHANGED");
      expect(COMPARISON_STATUS.EMPTY).toBe("EMPTY");
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.generatedBy).toBe("phase_126");
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.historyTracking).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.snapshotPersistence).toBe(false);
    });
  });

  describe("empty snapshots", () => {
    test("returns empty comparison status for null, undefined, and non-object snapshots", () => {
      const nullResult = compareRecruitmentWorkflowSnapshots(null, null);
      const undefinedResult = compareRecruitmentWorkflowSnapshots(undefined, undefined);
      const mixedEmptyResult = compareRecruitmentWorkflowSnapshots(null, {});
      const stringResult = compareRecruitmentWorkflowSnapshots("bad", 42);

      for (const result of [nullResult, undefinedResult, mixedEmptyResult, stringResult]) {
        expect(result.changed).toBe(false);
        expect(result.comparisonStatus).toBe(COMPARISON_STATUS.EMPTY);
        expect(result.changedFields).toEqual([]);
        expect(result.workflowChanges).toEqual([]);
        expect(result.readinessChanges).toEqual([]);
        expect(result.capabilityChanges).toEqual([]);
        expect(result.decisionChanges).toEqual([]);
        expect(result.summary).toBe("No advisory snapshot data to compare");
        expect(result.advisoryMetadata.generatedBy).toBe("phase_126");
      }
    });
  });

  describe("identical snapshots", () => {
    test("reports unchanged when snapshots are identical", () => {
      const snapshot = buildPartialSnapshot();

      const result = compareRecruitmentWorkflowSnapshots(snapshot, {
        workflowSnapshot: { ...snapshot.workflowSnapshot },
        readinessSnapshot: { ...snapshot.readinessSnapshot },
        capabilitySnapshot: { ...snapshot.capabilitySnapshot },
        decisionSnapshot: { ...snapshot.decisionSnapshot },
        reportSummary: snapshot.reportSummary
      });

      expect(result.changed).toBe(false);
      expect(result.comparisonStatus).toBe(COMPARISON_STATUS.UNCHANGED);
      expect(result.changedFields).toEqual([]);
      expect(result.workflowChanges).toEqual([]);
      expect(result.readinessChanges).toEqual([]);
      expect(result.capabilityChanges).toEqual([]);
      expect(result.decisionChanges).toEqual([]);
      expect(result.summary).toBe("No advisory snapshot changes detected");
    });

    test("reports unchanged for identical phase 125 advisory snapshots", () => {
      const input = {
        recruitmentId: "UP_POLICE_2026",
        workflowState: {
          workflowState: "WAITING_FOR_APPROVAL",
          nextRecommendedAction: "Await approval decision"
        },
        readinessAssessment: {
          readinessStatus: "APPROVAL_PENDING",
          readinessScore: 75
        },
        advisoryReport: {
          summary: "Workflow is waiting for approval decision"
        },
        capabilityRegistry: null,
        decisionTrace: {
          decisionSummary: "Approval required",
          reasoningChain: [{ step: "APPROVAL_CHECK" }]
        }
      };

      const previous = createRecruitmentWorkflowAdvisorySnapshot(input);
      const current = createRecruitmentWorkflowAdvisorySnapshot(input);

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changed).toBe(false);
      expect(result.comparisonStatus).toBe(COMPARISON_STATUS.UNCHANGED);
    });
  });

  describe("workflow state change", () => {
    test("detects workflow state transition and matches phase 126 example shape", () => {
      const previous = {
        workflowSnapshot: {
          state: "WAITING_FOR_APPROVAL"
        },
        readinessSnapshot: {
          status: "APPROVAL_PENDING",
          score: 75
        }
      };

      const current = {
        workflowSnapshot: {
          state: "READY_FOR_STORAGE"
        },
        readinessSnapshot: {
          status: "READY_FOR_STORAGE",
          score: 100
        }
      };

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changed).toBe(true);
      expect(result.comparisonStatus).toBe(COMPARISON_STATUS.CHANGED);
      expect(result.changedFields).toEqual([
        "workflowSnapshot.state",
        "readinessSnapshot.status",
        "readinessSnapshot.score"
      ]);
      expect(result.workflowChanges).toEqual([
        {
          from: "WAITING_FOR_APPROVAL",
          to: "READY_FOR_STORAGE"
        }
      ]);
      expect(result.readinessChanges).toEqual([
        {
          field: "status",
          from: "APPROVAL_PENDING",
          to: "READY_FOR_STORAGE"
        },
        {
          field: "score",
          from: 75,
          to: 100
        }
      ]);
      expect(result.summary).toBe("Workflow readiness improved after approval completion");
      expect(result.advisoryMetadata).toMatchObject({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_126"
      });
    });
  });

  describe("readiness status change", () => {
    test("detects readiness status-only changes", () => {
      const previous = buildPartialSnapshot({
        readinessSnapshot: {
          status: "REVIEW_READY",
          score: 50
        }
      });
      const current = buildPartialSnapshot({
        readinessSnapshot: {
          status: "APPROVAL_PENDING",
          score: 50
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changed).toBe(true);
      expect(result.changedFields).toContain("readinessSnapshot.status");
      expect(result.readinessChanges).toEqual([
        {
          field: "status",
          from: "REVIEW_READY",
          to: "APPROVAL_PENDING"
        }
      ]);
    });
  });

  describe("readiness score change", () => {
    test("detects readiness score changes and generates score summary", () => {
      const previous = buildPartialSnapshot({
        workflowSnapshot: {
          state: "REVIEW_READY",
          nextAction: "Create review package"
        },
        readinessSnapshot: {
          status: "REVIEW_READY",
          score: 50
        }
      });
      const current = buildPartialSnapshot({
        workflowSnapshot: {
          state: "REVIEW_READY",
          nextAction: "Create review package"
        },
        readinessSnapshot: {
          status: "REVIEW_READY",
          score: 75
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changed).toBe(true);
      expect(result.changedFields).toEqual(["readinessSnapshot.score"]);
      expect(result.readinessChanges).toEqual([
        {
          field: "score",
          from: 50,
          to: 75
        }
      ]);
      expect(result.summary).toBe("Workflow readiness score improved");
    });
  });

  describe("capability changes", () => {
    test("detects capability availability changes", () => {
      const previous = buildPartialSnapshot({
        capabilitySnapshot: {
          total: 8,
          available: 6
        }
      });
      const current = buildPartialSnapshot({
        capabilitySnapshot: {
          total: 8,
          available: 8
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changed).toBe(true);
      expect(result.changedFields).toContain("capabilitySnapshot.available");
      expect(result.capabilityChanges).toEqual([
        {
          field: "available",
          from: 6,
          to: 8
        }
      ]);
    });

    test("detects capability total changes", () => {
      const previous = buildPartialSnapshot({
        capabilitySnapshot: {
          total: 6,
          available: 6
        }
      });
      const current = buildPartialSnapshot({
        capabilitySnapshot: {
          total: 8,
          available: 6
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changedFields).toContain("capabilitySnapshot.total");
      expect(result.capabilityChanges).toEqual([
        {
          field: "total",
          from: 6,
          to: 8
        }
      ]);
    });
  });

  describe("decision changes", () => {
    test("detects decision summary and trace entry changes", () => {
      const previous = buildPartialSnapshot({
        decisionSnapshot: {
          summary: "Approval required",
          traceEntries: 2
        }
      });
      const current = buildPartialSnapshot({
        decisionSnapshot: {
          summary: "Approval completed",
          traceEntries: 4
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changed).toBe(true);
      expect(result.changedFields).toEqual([
        "decisionSnapshot.summary",
        "decisionSnapshot.traceEntries"
      ]);
      expect(result.decisionChanges).toEqual([
        {
          field: "summary",
          from: "Approval required",
          to: "Approval completed"
        },
        {
          field: "traceEntries",
          from: 2,
          to: 4
        }
      ]);
    });
  });

  describe("workflow next action change", () => {
    test("detects next action changes with workflow field metadata", () => {
      const previous = buildPartialSnapshot({
        workflowSnapshot: {
          state: "DRAFT_CREATED",
          nextAction: "Create draft proposal"
        }
      });
      const current = buildPartialSnapshot({
        workflowSnapshot: {
          state: "DRAFT_CREATED",
          nextAction: "Create review package"
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.changedFields).toContain("workflowSnapshot.nextAction");
      expect(result.workflowChanges).toEqual([
        {
          field: "nextAction",
          from: "Create draft proposal",
          to: "Create review package"
        }
      ]);
    });
  });

  describe("changedFields generation", () => {
    test("returns expected top-level keys and ordered changed field paths", () => {
      const previous = buildPartialSnapshot();
      const current = buildPartialSnapshot({
        workflowSnapshot: {
          state: "STORAGE_BOUNDARY_READY",
          nextAction: "Review persistence boundary"
        },
        readinessSnapshot: {
          status: "READY_FOR_STORAGE",
          score: 100
        },
        capabilitySnapshot: {
          total: 8,
          available: 8
        },
        decisionSnapshot: {
          summary: "Ready for storage",
          traceEntries: 5
        },
        reportSummary: "Workflow is approved and ready for persistence boundary review"
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
      expect(result.changedFields).toEqual([
        "workflowSnapshot.state",
        "workflowSnapshot.nextAction",
        "readinessSnapshot.status",
        "readinessSnapshot.score",
        "capabilitySnapshot.available",
        "decisionSnapshot.summary",
        "decisionSnapshot.traceEntries",
        "reportSummary"
      ]);
    });
  });

  describe("summary generation", () => {
    test("generates blocked-state summary when workflow enters blocked state", () => {
      const previous = buildPartialSnapshot({
        workflowSnapshot: {
          state: "REVIEW_READY",
          nextAction: "Create review package"
        }
      });
      const current = buildPartialSnapshot({
        workflowSnapshot: {
          state: "BLOCKED",
          nextAction: null
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.summary).toBe("Workflow entered blocked state");
    });

    test("generates multi-field summary when no specific transition rule matches", () => {
      const previous = buildPartialSnapshot({
        reportSummary: "Summary A"
      });
      const current = buildPartialSnapshot({
        reportSummary: "Summary B",
        capabilitySnapshot: {
          total: 8,
          available: 7
        }
      });

      const result = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(result.summary).toBe("Advisory snapshot changes detected across 2 fields");
    });
  });

  describe("metadata validation", () => {
    test("advisory metadata declares advisory-only non-persistent comparison model", () => {
      const result = compareRecruitmentWorkflowSnapshots(
        buildPartialSnapshot(),
        buildPartialSnapshot({ reportSummary: "Changed summary" })
      );

      expect(result.advisoryMetadata).toEqual({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_126",
        phase: 126,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        snapshotPersistence: false,
        historyTracking: false,
        sideEffects: false,
        mutatesInput: false,
        advisoryComparisonOnly: true
      });
    });
  });

  describe("deterministic output", () => {
    test("returns identical comparison for identical snapshot pairs", () => {
      const previous = buildPartialSnapshot();
      const current = buildPartialSnapshot({
        readinessSnapshot: {
          status: "READY_FOR_STORAGE",
          score: 100
        }
      });

      const first = compareRecruitmentWorkflowSnapshots(previous, current);
      const second = compareRecruitmentWorkflowSnapshots(previous, current);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes comparison output", () => {
      const result = compareRecruitmentWorkflowSnapshots(
        buildPartialSnapshot(),
        buildPartialSnapshot({
          readinessSnapshot: {
            status: "READY_FOR_STORAGE",
            score: 100
          }
        })
      );

      assertAllFrozen(result);
      expect(() => {
        result.summary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.changedFields.push("extra");
      }).toThrow();
      expect(() => {
        result.workflowChanges[0].from = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate snapshot inputs or nested objects", () => {
      const previous = buildPartialSnapshot();
      const current = buildPartialSnapshot({
        readinessSnapshot: {
          status: "READY_FOR_STORAGE",
          score: 100
        }
      });

      const previousBefore = JSON.stringify(previous);
      const currentBefore = JSON.stringify(current);
      const workflowBefore = JSON.stringify(previous.workflowSnapshot);
      const readinessBefore = JSON.stringify(current.readinessSnapshot);

      compareRecruitmentWorkflowSnapshots(previous, current);
      compareRecruitmentWorkflowSnapshots(previous, current);

      expect(JSON.stringify(previous)).toBe(previousBefore);
      expect(JSON.stringify(current)).toBe(currentBefore);
      expect(JSON.stringify(previous.workflowSnapshot)).toBe(workflowBefore);
      expect(JSON.stringify(current.readinessSnapshot)).toBe(readinessBefore);
    });

    test("comparison does not mutate process environment", () => {
      const envBefore = { ...process.env };
      compareRecruitmentWorkflowSnapshots(buildPartialSnapshot(), buildPartialSnapshot());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence behavior", () => {
    test("module source declares no persistence or history tracking", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("snapshotPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveComparison/i);
      expect(source).not.toMatch(/persistComparison/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory comparison constraints for phase 126", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 126");
      expect(source).toContain("compareRecruitmentWorkflowSnapshots");
      expect(source).toContain("advisoryComparisonOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("comparison model is not wired into coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
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

      expect(coordinatorSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(gatewaySource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(pipelineSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(workerSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(orchestratorSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(traceModelSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(registrySource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(readinessSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(reportSource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(observationRegistrySource).not.toMatch(/compareRecruitmentWorkflowSnapshots/);

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/compareRecruitmentWorkflowSnapshots/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowSnapshotComparison/);
    });

    test("metadata declares no persistence, runtime connection, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.snapshotPersistence).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_COMPARISON_METADATA.historyTracking).toBe(false);
    });

    test("orchestrator behavior remains unchanged and independent from snapshot comparison model", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("comparisonStatus");
      expect(orchestration).not.toHaveProperty("changedFields");
      expect(orchestration).not.toHaveProperty("workflowChanges");
    });
  });
});
