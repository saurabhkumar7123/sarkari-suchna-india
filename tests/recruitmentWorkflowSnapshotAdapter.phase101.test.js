"use strict";

/**
 * Phase 101 — Recruitment Workflow Advisory Snapshot Consumption Adapter tests.
 * Snapshot exists/missing, malformed input, determinism, immutability,
 * summary generation, backward compatibility, and no persistence.
 */

const fs = require("fs");
const path = require("path");

jest.mock("../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator", () => {
  const actual = jest.requireActual(
    "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
  );
  return {
    ...actual,
    coordinateRecruitmentWorkflowIntegration: jest.fn(
      actual.coordinateRecruitmentWorkflowIntegration
    )
  };
});

const {
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_PHASE,
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_ENTITY,
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA,
  getRecruitmentWorkflowSnapshot,
  hasRecruitmentWorkflowSnapshot,
  summarizeRecruitmentWorkflowSnapshot
} = require("../server/lib/recruitment/recruitmentWorkflowSnapshotAdapter");

const {
  isWorkflowAdvisorySnapshotResult
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot");

const {
  peekWorkflowObservation,
  recordWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const {
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentCompatibilityIntegration,
  peekRecruitmentCompatibilityIntegration
} = require("../server/lib/recruitment/recruitmentCompatibilityIntegrationHook");

const {
  attachRecruitmentCompatibility,
  buildRecruitmentCompatibilityContext,
  peekRecruitmentCompatibility
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSnapshotAdapter.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for Tier 1 Advertisement Number CGL-01/2026",
    url: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
    ...overrides
  };
}

function candidate(overrides = {}) {
  return {
    id: 1,
    department: "ssc",
    post_name: "Combined Graduate Level",
    exam_name: "CGL",
    cycle_year: 2026,
    advertisement_no: "CGL-01/2026",
    ...overrides
  };
}

function mockProcessorResult() {
  return {
    status: PROCESS_RESULT_STATUS.SUCCESS,
    warnings: [],
    eventType: "admit_card",
    selectedRecruitment: candidate(),
    reviewItem: { title: notice().title, eventType: "admit_card", status: "pending" }
  };
}

function enabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 101,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-101-trace",
    ...overrides
  };
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

describe("Phase 101 — recruitmentWorkflowSnapshotAdapter", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_PHASE).toBe(101);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_ENTITY).toBe(
        "recruitment_workflow_snapshot_adapter"
      );
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_DESCRIPTOR.phase).toBe(101);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.consumptionOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.rebuildsSnapshots).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.persistenceEnabled).toBe(false);
    });
  });

  describe("snapshot exists", () => {
    test("returns advisory snapshot after pipeline integration", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 101 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput());

      const snapshot = getRecruitmentWorkflowSnapshot(outcome);

      expect(snapshot).not.toBeNull();
      expect(isWorkflowAdvisorySnapshotResult(snapshot)).toBe(true);
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(true);
      expect(snapshot).toBe(peekWorkflowObservation(outcome).plannedWorkflow.workflowAdvisorySnapshot);
    });

    test("returns advisory snapshot after full pipeline run", () => {
      const processDetection = jest.fn().mockReturnValue(mockProcessorResult());
      const result = runRecruitmentPipeline({
        notice: notice(),
        candidateRecruitments: [candidate()],
        isEnabled: true,
        processDetection,
        updateId: 101,
        featureFlags: { workflowIntegrationEnabled: true },
        traceId: "pipeline-101"
      });

      const snapshot = getRecruitmentWorkflowSnapshot(result);

      expect(snapshot).not.toBeNull();
      expect(snapshot.metadata.snapshotComplete).toBe(true);
      expect(snapshot.advisorySummary).not.toBeNull();
    });

    test("reads snapshot via compatibility integration observation", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 102 };
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 102 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 102 }), context);

      const snapshot = getRecruitmentWorkflowSnapshot(outcome);

      expect(snapshot).not.toBeNull();
      expect(snapshot).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult.plannedWorkflow
          .workflowAdvisorySnapshot
      );
    });
  });

  describe("snapshot missing", () => {
    test("returns null when workflow integration flag is off", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 103 };

      attachRecruitmentWorkflowIntegration(outcome, {
        notice: notice(),
        featureFlags: { workflowIntegrationEnabled: false }
      });

      expect(getRecruitmentWorkflowSnapshot(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(false);
      expect(summarizeRecruitmentWorkflowSnapshot(outcome)).toBeNull();
    });

    test("returns null for unrelated outcome objects", () => {
      expect(getRecruitmentWorkflowSnapshot(null)).toBeNull();
      expect(getRecruitmentWorkflowSnapshot(undefined)).toBeNull();
      expect(getRecruitmentWorkflowSnapshot({})).toBeNull();
      expect(hasRecruitmentWorkflowSnapshot(null)).toBe(false);
    });

    test("returns null when observation has no plannedWorkflow", () => {
      const outcome = { updateId: 104 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: null,
        diagnostics: {}
      });

      expect(getRecruitmentWorkflowSnapshot(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(false);
    });
  });

  describe("malformed outcome", () => {
    test("returns null for invalid snapshot shape on plannedWorkflow", () => {
      const outcome = { updateId: 105 };
      recordWorkflowObservation(outcome, {
        featureEnabled: true,
        plannedWorkflow: {
          workflowAdvisorySnapshot: { invalid: true },
          architectureOnly: true,
          advisory: true,
          executed: false
        },
        diagnostics: {}
      });

      expect(getRecruitmentWorkflowSnapshot(outcome)).toBeNull();
      expect(hasRecruitmentWorkflowSnapshot(outcome)).toBe(false);
      expect(summarizeRecruitmentWorkflowSnapshot(outcome)).toBeNull();
    });

    test("never throws for malformed inputs", () => {
      expect(() => getRecruitmentWorkflowSnapshot("bad")).not.toThrow();
      expect(() => getRecruitmentWorkflowSnapshot([])).not.toThrow();
      expect(() => hasRecruitmentWorkflowSnapshot(42)).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowSnapshot(Symbol("x"))).not.toThrow();
    });
  });

  describe("deterministic behavior", () => {
    test("repeated reads return the same snapshot reference", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 106 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 106 }));

      const first = getRecruitmentWorkflowSnapshot(outcome);
      const second = getRecruitmentWorkflowSnapshot(outcome);
      const third = hasRecruitmentWorkflowSnapshot(outcome);

      expect(second).toBe(first);
      expect(third).toBe(true);
      expect(summarizeRecruitmentWorkflowSnapshot(outcome)).toEqual(
        summarizeRecruitmentWorkflowSnapshot(outcome)
      );
    });
  });

  describe("immutability", () => {
    test("does not mutate the pipeline outcome object", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 107 };
      const snapshotBefore = JSON.stringify(outcome);

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 107 }));
      getRecruitmentWorkflowSnapshot(outcome);
      summarizeRecruitmentWorkflowSnapshot(outcome);

      expect(JSON.stringify(outcome)).toBe(snapshotBefore);
      expect(outcome).not.toHaveProperty("workflowAdvisorySnapshot");
      expect(outcome).not.toHaveProperty("plannedWorkflow");
    });

    test("returned snapshot and summary remain frozen", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 108 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 108 }));

      const snapshot = getRecruitmentWorkflowSnapshot(outcome);
      const summary = summarizeRecruitmentWorkflowSnapshot(outcome);

      assertAllFrozen(snapshot);
      assertAllFrozen(summary);

      expect(() => {
        snapshot.version = 99;
      }).toThrow();
      expect(() => {
        summary.currentLifecycle = "MUTATED";
      }).toThrow();
    });
  });

  describe("summary generation", () => {
    test("returns lightweight summary fields from advisory snapshot", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 109 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 109 }));

      const snapshot = getRecruitmentWorkflowSnapshot(outcome);
      const summary = summarizeRecruitmentWorkflowSnapshot(outcome);

      expect(summary).toEqual({
        currentLifecycle: snapshot.advisorySummary.currentLifecycle,
        overallHealth: snapshot.advisorySummary.overallHealth,
        workflowCompleted: snapshot.advisorySummary.workflowCompleted,
        recommendedAction: snapshot.advisorySummary.recommendedAction,
        monitoringRequired: snapshot.advisorySummary.monitoringRequired,
        snapshotComplete: true
      });
      expect(summary.currentLifecycle).toBe("ADMIT_CARD");
      expect(typeof summary.workflowCompleted).toBe("boolean");
      expect(typeof summary.monitoringRequired).toBe("boolean");
    });

    test("summary returns null when snapshot is unavailable", () => {
      expect(summarizeRecruitmentWorkflowSnapshot({})).toBeNull();
    });
  });

  describe("backward compatibility", () => {
    test("does not alter existing registry or hook observations", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 110 };
      attachRecruitmentCompatibility(outcome, {
        notice: notice(),
        updateId: 110,
        featureFlags: { workflowIntegrationEnabled: false }
      });

      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 110 }));

      const registryBefore = peekWorkflowObservation(outcome);
      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const compatibilityBefore = peekRecruitmentCompatibility(outcome);

      getRecruitmentWorkflowSnapshot(outcome);
      summarizeRecruitmentWorkflowSnapshot(outcome);

      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekRecruitmentCompatibility(outcome)).toBe(compatibilityBefore);
    });

    test("compatibility hook path still resolves the same snapshot", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 111 };
      const context = buildRecruitmentCompatibilityContext(enabledInput({ updateId: 111 }));

      attachRecruitmentCompatibilityIntegration(outcome, enabledInput({ updateId: 111 }), context);

      expect(getRecruitmentWorkflowSnapshot(outcome)).toBe(
        peekRecruitmentCompatibilityIntegration(outcome).integrationResult.plannedWorkflow
          .workflowAdvisorySnapshot
      );
      expect(getRecruitmentWorkflowSnapshot(outcome)).toBe(
        peekWorkflowObservation(outcome).plannedWorkflow.workflowAdvisorySnapshot
      );
    });
  });

  describe("no persistence", () => {
    test("adapter metadata declares no persistence or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_SNAPSHOT_ADAPTER_METADATA.rebuildsSnapshots).toBe(false);
    });

    test("consumed snapshot remains advisory-only with no execution", () => {
      const outcome = { skipped: false, result: mockProcessorResult(), updateId: 112 };
      attachRecruitmentWorkflowIntegration(outcome, enabledInput({ updateId: 112 }));

      const snapshot = getRecruitmentWorkflowSnapshot(outcome);

      expect(snapshot.advisory).toBe(true);
      expect(snapshot.architectureOnly).toBe(true);
      expect(snapshot.executed).toBe(false);
    });
  });

  describe("architecture boundaries", () => {
    test("module source declares pure consumption constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 101");
      expect(source).toContain("getRecruitmentWorkflowSnapshot");
      expect(source).toContain("hasRecruitmentWorkflowSnapshot");
      expect(source).toContain("summarizeRecruitmentWorkflowSnapshot");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("consumptionOnly");
      expect(source).toContain("rebuildsSnapshots");
    });

    test("module does not import express, database drivers, or filesystem APIs", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
    });

    test("module does not rebuild snapshots or invoke the coordinator", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/buildRecruitmentWorkflowAdvisorySnapshot/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/getOrCreateWorkflowObservation/);
      expect(source).not.toMatch(/attachRecruitmentWorkflowIntegration/);
      expect(source).not.toMatch(/attachRecruitmentCompatibilityIntegration/);
    });

    test("adapter is not wired into coordinator, pipeline, compatibility layer, or worker", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const compatibilitySource = read(COMPATIBILITY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(compatibilitySource).not.toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowSnapshotAdapter/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowSnapshotAdapter/);
    });

    test("adapter reuses observation registry and hook peek helpers only", () => {
      const source = read(MODULE_PATH);

      expect(source).toMatch(/recruitmentWorkflowObservationRegistry/);
      expect(source).toMatch(/peekWorkflowObservation/);
      expect(source).toMatch(/peekRecruitmentWorkflowIntegration/);
      expect(source).toMatch(/peekRecruitmentCompatibilityIntegration/);
      expect(source).toMatch(/isWorkflowAdvisorySnapshotResult/);
    });
  });
});
