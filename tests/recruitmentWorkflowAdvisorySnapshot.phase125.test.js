"use strict";

/**
 * Phase 125 — Recruitment Workflow Advisory Snapshot Model tests.
 * Empty input, snapshot creation, workflow/readiness/capability/decision mapping,
 * report summary, metadata, determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_ENTITY,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION,
  PHASE_125_WORKFLOW_STATUSES,
  PHASE_125_READINESS_STATUSES,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA,
  EMPTY_ADVISORY_SNAPSHOT_SUMMARY,
  createRecruitmentWorkflowAdvisorySnapshot,
  isRecruitmentWorkflowAdvisorySnapshotModel,
  summarizeRecruitmentWorkflowAdvisorySnapshotModel
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const {
  createRecruitmentWorkflowCapabilityRegistry
} = require("../server/lib/recruitment/recruitmentWorkflowCapabilityRegistry");

const {
  assessRecruitmentWorkflowReadiness,
  WORKFLOW_CAPABILITY_IDS,
  WORKFLOW_STATE_SIGNALS
} = require("../server/lib/recruitment/recruitmentWorkflowReadinessAssessment");

const { createWorkflowDecisionTrace } = require("../server/lib/recruitment/workflowDecisionTraceModel");

const {
  generateRecruitmentWorkflowAdvisoryReport,
  WORKFLOW_STATUSES
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisoryReportGenerator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot.js";
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
  "snapshotVersion",
  "recruitmentId",
  "workflowSnapshot",
  "readinessSnapshot",
  "capabilitySnapshot",
  "decisionSnapshot",
  "reportSummary",
  "snapshotMetadata"
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

function buildApprovalPendingSnapshotInput(overrides = {}) {
  const readinessAssessment = assessRecruitmentWorkflowReadiness({
    recruitmentId: "UP_POLICE_2026",
    capabilities: {
      [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, status: "pending" }
    },
    workflowState: WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL,
    decisionTrace: {
      decisionSummary: "Approval required"
    }
  });

  const decisionTrace = createWorkflowDecisionTrace({
    workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
    nextRecommendedAction: "Await approval decision"
  });

  const capabilityRegistry = createRecruitmentWorkflowCapabilityRegistry();

  const advisoryReport = generateRecruitmentWorkflowAdvisoryReport({
    recruitmentId: "UP_POLICE_2026",
    workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
    nextRecommendedAction: "Await approval decision",
    readinessAssessment,
    decisionTrace,
    capabilityRegistry
  });

  return {
    recruitmentId: "UP_POLICE_2026",
    workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
    readinessAssessment,
    advisoryReport,
    capabilityRegistry,
    decisionTrace,
    ...overrides
  };
}

describe("Phase 125 — recruitmentWorkflowAdvisorySnapshot model", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_PHASE).toBe(125);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_ENTITY).toBe(
        "recruitment_workflow_advisory_snapshot_model"
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_VERSION).toBe("phase_125_v1");
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_DESCRIPTOR.phase).toBe(125);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.advisorySnapshotOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.snapshotPersistence).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.historyTracking).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns blocked empty advisory snapshot for null, undefined, and non-object input", () => {
      const nullResult = createRecruitmentWorkflowAdvisorySnapshot(null);
      const undefinedResult = createRecruitmentWorkflowAdvisorySnapshot(undefined);
      const stringResult = createRecruitmentWorkflowAdvisorySnapshot("bad");
      const arrayResult = createRecruitmentWorkflowAdvisorySnapshot([]);

      for (const result of [nullResult, undefinedResult, stringResult, arrayResult]) {
        expect(result.snapshotVersion).toBe("phase_125_v1");
        expect(result.recruitmentId).toBeNull();
        expect(result.workflowSnapshot).toEqual({
          state: PHASE_125_WORKFLOW_STATUSES.BLOCKED,
          nextAction: null
        });
        expect(result.readinessSnapshot).toEqual({
          status: PHASE_125_READINESS_STATUSES.BLOCKED,
          score: 0
        });
        expect(result.capabilitySnapshot).toEqual({ total: 0, available: 0 });
        expect(result.decisionSnapshot.traceEntries).toBe(0);
        expect(result.reportSummary).toBe(
          "Workflow is blocked and requires context resolution before proceeding"
        );
        expect(result.snapshotMetadata.advisoryOnly).toBe(true);
        expect(result.snapshotMetadata.persistent).toBe(false);
        expect(result.snapshotMetadata.generatedBy).toBe("phase_125");
      }
    });
  });

  describe("snapshot creation", () => {
    test("creates advisory snapshot with expected top-level keys", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot(buildApprovalPendingSnapshotInput());

      expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
      expect(result.snapshotVersion).toBe("phase_125_v1");
      expect(result.recruitmentId).toBe("UP_POLICE_2026");
      expect(isRecruitmentWorkflowAdvisorySnapshotModel(result)).toBe(true);
    });

    test("matches approval-pending advisory snapshot example shape", () => {
      const input = {
        recruitmentId: "UP_POLICE_2026",
        workflowState: {
          workflowState: PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
          nextRecommendedAction: "Await approval decision"
        },
        readinessAssessment: {
          readinessStatus: PHASE_125_READINESS_STATUSES.APPROVAL_PENDING,
          readinessScore: 75
        },
        advisoryReport: {
          summary: "Workflow is waiting for approval decision"
        },
        capabilityRegistry: createRecruitmentWorkflowCapabilityRegistry(),
        decisionTrace: {
          decisionSummary: "Approval required",
          reasoningChain: [{ step: "APPROVAL_CHECK" }, { step: "NEXT_ACTION_RECOMMENDATION" }]
        }
      };

      const result = createRecruitmentWorkflowAdvisorySnapshot(input);

      expect(result).toEqual({
        snapshotVersion: "phase_125_v1",
        recruitmentId: "UP_POLICE_2026",
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
          available: 8
        },
        decisionSnapshot: {
          summary: "Approval required",
          traceEntries: 2
        },
        reportSummary: "Workflow is waiting for approval decision",
        snapshotMetadata: {
          advisoryOnly: true,
          persistent: false,
          generatedBy: "phase_125",
          phase: 125,
          architectureOnly: true,
          executed: false,
          persistenceEnabled: false,
          snapshotPersistence: false,
          historyTracking: false,
          sideEffects: false,
          mutatesInput: false,
          advisorySnapshotOnly: true
        }
      });
    });
  });

  describe("workflow snapshot mapping", () => {
    test("maps string workflow state and next action from workflow object", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 501,
        workflowState: PHASE_125_WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: null,
        advisoryReport: { recommendations: ["Create draft proposal"] },
        capabilityRegistry: null,
        decisionTrace: null
      });

      expect(result.workflowSnapshot.state).toBe(PHASE_125_WORKFLOW_STATUSES.DRAFT_CREATED);
      expect(result.workflowSnapshot.nextAction).toBe("Create draft proposal");
    });

    test("maps orchestrator-style workflow state object", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 502,
        workflowState: {
          workflowState: PHASE_125_WORKFLOW_STATUSES.REVIEW_READY,
          nextRecommendedAction: "Create review package"
        },
        readinessAssessment: null,
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace: null
      });

      expect(result.workflowSnapshot).toEqual({
        state: PHASE_125_WORKFLOW_STATUSES.REVIEW_READY,
        nextAction: "Create review package"
      });
    });
  });

  describe("readiness snapshot mapping", () => {
    test("maps readiness status and score from assessment object", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 601,
        workflowState: PHASE_125_WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY,
        readinessAssessment: {
          status: PHASE_125_READINESS_STATUSES.READY_FOR_STORAGE,
          score: 100
        },
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace: null
      });

      expect(result.readinessSnapshot).toEqual({
        status: PHASE_125_READINESS_STATUSES.READY_FOR_STORAGE,
        score: 100
      });
    });

    test("defaults readiness score from status when score is absent", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 602,
        workflowState: PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        readinessAssessment: {
          readinessStatus: PHASE_125_READINESS_STATUSES.APPROVAL_PENDING
        },
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace: null
      });

      expect(result.readinessSnapshot).toEqual({
        status: PHASE_125_READINESS_STATUSES.APPROVAL_PENDING,
        score: 75
      });
    });
  });

  describe("capability snapshot mapping", () => {
    test("maps total and available capabilities from registry", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 701,
        workflowState: PHASE_125_WORKFLOW_STATUSES.REVIEW_READY,
        readinessAssessment: null,
        advisoryReport: null,
        capabilityRegistry: registry,
        decisionTrace: null
      });

      expect(result.capabilitySnapshot.total).toBe(registry.capabilities.length);
      expect(result.capabilitySnapshot.available).toBe(registry.capabilities.length);
      expect(result.capabilitySnapshot).toEqual({ total: 8, available: 8 });
    });

    test("returns zero capability counts for missing registry", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 702,
        workflowState: PHASE_125_WORKFLOW_STATUSES.REVIEW_READY,
        readinessAssessment: null,
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace: null
      });

      expect(result.capabilitySnapshot).toEqual({ total: 0, available: 0 });
    });
  });

  describe("decision snapshot mapping", () => {
    test("maps decision summary and trace entry count from decision trace", () => {
      const decisionTrace = createWorkflowDecisionTrace({
        workflowState: PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        nextRecommendedAction: "Await approval decision"
      });

      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 801,
        workflowState: PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        readinessAssessment: null,
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace
      });

      expect(result.decisionSnapshot.summary).toBe(decisionTrace.decisionSummary);
      expect(result.decisionSnapshot.traceEntries).toBe(decisionTrace.reasoningChain.length);
      expect(result.decisionSnapshot.traceEntries).toBeGreaterThan(0);
    });

    test("prefers traceEntries array length when present", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 802,
        workflowState: PHASE_125_WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        readinessAssessment: null,
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace: {
          decisionSummary: "Approval required",
          traceEntries: [{ signal: "approval_pending" }, { signal: "review_ready" }],
          reasoningChain: [{ step: "only-one" }]
        }
      });

      expect(result.decisionSnapshot).toEqual({
        summary: "Approval required",
        traceEntries: 2
      });
    });
  });

  describe("report summary mapping", () => {
    test("uses advisory report summary when supplied", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot(buildApprovalPendingSnapshotInput());

      expect(result.reportSummary).toBe("Workflow is waiting for approval decision");
    });

    test("derives report summary from workflow state when advisory report summary is absent", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot({
        recruitmentId: 901,
        workflowState: PHASE_125_WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: {
          readinessStatus: PHASE_125_READINESS_STATUSES.NOT_STARTED,
          readinessScore: 0
        },
        advisoryReport: null,
        capabilityRegistry: null,
        decisionTrace: null
      });

      expect(result.reportSummary).toBe(
        "Workflow has recruitment identity and requires draft proposal creation"
      );
    });
  });

  describe("metadata validation", () => {
    test("snapshot metadata declares advisory-only non-persistent snapshot model", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot(buildApprovalPendingSnapshotInput());

      expect(result.snapshotMetadata).toEqual({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_125",
        phase: 125,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        snapshotPersistence: false,
        historyTracking: false,
        sideEffects: false,
        mutatesInput: false,
        advisorySnapshotOnly: true
      });
      expect(isRecruitmentWorkflowAdvisorySnapshotModel(result)).toBe(true);
    });

    test("summarizeRecruitmentWorkflowAdvisorySnapshotModel returns frozen summary for valid snapshot", () => {
      const snapshot = createRecruitmentWorkflowAdvisorySnapshot(buildApprovalPendingSnapshotInput());
      const summary = summarizeRecruitmentWorkflowAdvisorySnapshotModel(snapshot);

      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.workflowState).toBe(snapshot.workflowSnapshot.state);
      expect(summary.readinessStatus).toBe(snapshot.readinessSnapshot.status);
      expect(summary.readinessScore).toBe(snapshot.readinessSnapshot.score);
      expect(summary.capabilityTotal).toBe(snapshot.capabilitySnapshot.total);
      expect(summary.capabilityAvailable).toBe(snapshot.capabilitySnapshot.available);
      expect(summary.decisionTraceEntries).toBe(snapshot.decisionSnapshot.traceEntries);
    });

    test("summarizeRecruitmentWorkflowAdvisorySnapshotModel returns empty summary for invalid snapshot", () => {
      expect(summarizeRecruitmentWorkflowAdvisorySnapshotModel({ invalid: true })).toBe(
        EMPTY_ADVISORY_SNAPSHOT_SUMMARY
      );
    });
  });

  describe("deterministic output", () => {
    test("returns identical snapshot for identical input", () => {
      const input = buildApprovalPendingSnapshotInput();

      const first = createRecruitmentWorkflowAdvisorySnapshot(input);
      const second = createRecruitmentWorkflowAdvisorySnapshot(input);
      const summaryA = summarizeRecruitmentWorkflowAdvisorySnapshotModel(first);
      const summaryB = summarizeRecruitmentWorkflowAdvisorySnapshotModel(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("immutability", () => {
    test("deep freezes advisory snapshot output", () => {
      const result = createRecruitmentWorkflowAdvisorySnapshot(buildApprovalPendingSnapshotInput());

      assertAllFrozen(result);
      expect(() => {
        result.reportSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.workflowSnapshot.state = "CHANGED";
      }).toThrow();
      expect(() => {
        result.readinessSnapshot.score = 0;
      }).toThrow();
      expect(() => {
        result.capabilitySnapshot.total = 0;
      }).toThrow();
      expect(() => {
        result.decisionSnapshot.traceEntries = 0;
      }).toThrow();
      expect(() => {
        result.snapshotMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("no side effects", () => {
    test("does not mutate snapshot input or nested objects", () => {
      const input = buildApprovalPendingSnapshotInput();
      const before = JSON.stringify(input);
      const readinessBefore = JSON.stringify(input.readinessAssessment);
      const reportBefore = JSON.stringify(input.advisoryReport);
      const traceBefore = JSON.stringify(input.decisionTrace);
      const registryBefore = JSON.stringify(input.capabilityRegistry);

      createRecruitmentWorkflowAdvisorySnapshot(input);
      isRecruitmentWorkflowAdvisorySnapshotModel(
        createRecruitmentWorkflowAdvisorySnapshot(input)
      );
      summarizeRecruitmentWorkflowAdvisorySnapshotModel(
        createRecruitmentWorkflowAdvisorySnapshot(input)
      );

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.readinessAssessment)).toBe(readinessBefore);
      expect(JSON.stringify(input.advisoryReport)).toBe(reportBefore);
      expect(JSON.stringify(input.decisionTrace)).toBe(traceBefore);
      expect(JSON.stringify(input.capabilityRegistry)).toBe(registryBefore);
    });

    test("snapshot creation does not mutate process environment", () => {
      const envBefore = { ...process.env };
      createRecruitmentWorkflowAdvisorySnapshot(buildApprovalPendingSnapshotInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence behavior", () => {
    test("module source declares no snapshot persistence or history tracking", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Never persists output");
      expect(source).toContain("snapshotPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveSnapshot/i);
      expect(source).not.toMatch(/persistSnapshot/i);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure advisory snapshot model constraints for phase 125", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 125");
      expect(source).toContain("createRecruitmentWorkflowAdvisorySnapshot");
      expect(source).toContain("isRecruitmentWorkflowAdvisorySnapshotModel");
      expect(source).toContain("summarizeRecruitmentWorkflowAdvisorySnapshotModel");
      expect(source).toContain("advisorySnapshotOnly");
      expect(source).toContain("Never mutates input");
    });

    test("phase 125 snapshot model has no runtime imports in its implementation block", () => {
      const source = read(MODULE_PATH);
      const phase125Block = source.slice(source.indexOf("Phase 125"));

      expect(phase125Block).not.toMatch(/require\(["']\.\//);
      expect(phase125Block).not.toMatch(/require\(["']fs["']\)/);
      expect(phase125Block).not.toMatch(/require\(["']express/);
      expect(phase125Block).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(phase125Block).not.toMatch(/require\(["']mysql2/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
    });

    test("phase 125 block does not import workflow phase modules", () => {
      const source = read(MODULE_PATH);
      const phase125Block = source.slice(source.indexOf("Phase 125"));

      expect(phase125Block).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(phase125Block).not.toMatch(/workflowDecisionTraceModel/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
    });

    test("advisory snapshot model is not wired into coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, or observation registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const readinessSource = read(READINESS_MODULE_PATH);
      const reportSource = read(REPORT_MODULE_PATH);
      const observationRegistrySource = read(OBSERVATION_REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(gatewaySource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(pipelineSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(workerSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(orchestratorSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(traceModelSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(registrySource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(readinessSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(reportSource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
      expect(observationRegistrySource).not.toMatch(/createRecruitmentWorkflowAdvisorySnapshot/);
    });

    test("metadata declares no persistence, runtime connection, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.snapshotPersistence).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_SNAPSHOT_MODEL_METADATA.historyTracking).toBe(false);
    });

    test("orchestrator behavior remains unchanged and independent from advisory snapshot model", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("snapshotVersion");
      expect(orchestration).not.toHaveProperty("workflowSnapshot");
      expect(orchestration).not.toHaveProperty("readinessSnapshot");
      expect(orchestration).not.toHaveProperty("reportSummary");
    });
  });
});
