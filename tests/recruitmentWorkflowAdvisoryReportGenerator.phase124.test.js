"use strict";

/**
 * Phase 124 — Recruitment Workflow Advisory Report Generator tests.
 * Empty input, basic report creation, workflow status mapping, readiness summary,
 * capability summary, decision trace summary, pending items, recommendations,
 * metadata, determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_ENTITY,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_TITLE,
  WORKFLOW_STATUSES,
  READINESS_STATUSES,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA,
  EMPTY_ADVISORY_REPORT_SUMMARY,
  generateRecruitmentWorkflowAdvisoryReport,
  isRecruitmentWorkflowAdvisoryReport,
  summarizeRecruitmentWorkflowAdvisoryReport
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisoryReportGenerator");

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

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryReportGenerator.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const TRACE_MODEL_MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowCapabilityRegistry.js";
const READINESS_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowReadinessAssessment.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const OBSERVATION_REGISTRY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "reportTitle",
  "summary",
  "workflowStatus",
  "readinessSummary",
  "capabilitySummary",
  "decisionSummary",
  "pendingItems",
  "recommendations",
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

function buildApprovalPendingReportInput(overrides = {}) {
  const readinessAssessment = assessRecruitmentWorkflowReadiness({
    recruitmentId: "UP_POLICE_2026",
    capabilities: {
      [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, status: "pending" }
    },
    workflowState: WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL,
    decisionTrace: {
      decisionSummary:
        "Workflow is waiting for approval because review package exists but approval decision is pending"
    }
  });

  const decisionTrace = createWorkflowDecisionTrace({
    workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
    nextRecommendedAction: "Await approval decision"
  });

  return {
    recruitmentId: "UP_POLICE_2026",
    workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
    nextRecommendedAction: "Await approval decision",
    readinessAssessment,
    decisionTrace,
    capabilityRegistry: createRecruitmentWorkflowCapabilityRegistry(),
    ...overrides
  };
}

describe("Phase 124 — recruitmentWorkflowAdvisoryReportGenerator", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_PHASE).toBe(124);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_ENTITY).toBe(
        "recruitment_workflow_advisory_report"
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_TITLE).toBe(
        "Recruitment Workflow Advisory Report"
      );
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_DESCRIPTOR.phase).toBe(124);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.advisoryReportOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.reportPublishing).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns blocked advisory report for null, undefined, or non-object input", () => {
      const nullResult = generateRecruitmentWorkflowAdvisoryReport(null);
      const undefinedResult = generateRecruitmentWorkflowAdvisoryReport(undefined);
      const stringResult = generateRecruitmentWorkflowAdvisoryReport("invalid");

      expect(Object.keys(nullResult).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
      expect(nullResult.recruitmentId).toBeNull();
      expect(nullResult.workflowStatus).toBe(WORKFLOW_STATUSES.BLOCKED);
      expect(nullResult.readinessSummary).toEqual({ status: READINESS_STATUSES.BLOCKED, score: 0 });
      expect(nullResult.pendingItems).toEqual(["Resolve blocked workflow context"]);
      expect(nullResult.recommendations).toEqual(["Resolve blocked workflow context"]);
      expect(undefinedResult).toEqual(nullResult);
      expect(stringResult).toEqual(nullResult);
      expect(isRecruitmentWorkflowAdvisoryReport(nullResult)).toBe(true);
      expect(summarizeRecruitmentWorkflowAdvisoryReport(nullResult).workflowStatus).toBe(
        WORKFLOW_STATUSES.BLOCKED
      );
    });

    test("returns blocked report for missing recruitment identity", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: null,
        workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        nextRecommendedAction: "Await approval decision",
        readinessAssessment: { readinessStatus: READINESS_STATUSES.APPROVAL_PENDING, readinessScore: 75 },
        decisionTrace: { decisionSummary: "pending approval" },
        capabilityRegistry: createRecruitmentWorkflowCapabilityRegistry()
      });

      expect(result.recruitmentId).toBeNull();
      expect(result.workflowStatus).toBe(WORKFLOW_STATUSES.BLOCKED);
      expect(result.readinessSummary.status).toBe(READINESS_STATUSES.BLOCKED);
    });
  });

  describe("basic report creation", () => {
    test("creates advisory report matching the phase 124 example shape", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport(buildApprovalPendingReportInput());

      expect(result.recruitmentId).toBe("UP_POLICE_2026");
      expect(result.reportTitle).toBe("Recruitment Workflow Advisory Report");
      expect(result.summary).toBe("Workflow is waiting for approval decision");
      expect(result.workflowStatus).toBe(WORKFLOW_STATUSES.WAITING_FOR_APPROVAL);
      expect(result.readinessSummary).toEqual({
        status: READINESS_STATUSES.APPROVAL_PENDING,
        score: 75
      });
      expect(result.pendingItems).toEqual(["Approval decision required"]);
      expect(result.recommendations).toEqual(["Await approval before persistence boundary"]);
      expect(result.advisoryMetadata).toEqual(
        expect.objectContaining({
          advisoryOnly: true,
          generatedBy: "phase_124",
          persistent: false
        })
      );
      expect(isRecruitmentWorkflowAdvisoryReport(result)).toBe(true);
    });
  });

  describe("workflow status mapping", () => {
    test("maps known workflow states to workflowStatus output", () => {
      const draftCreated = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 1,
        workflowState: WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.NOT_STARTED, readinessScore: 0 },
        decisionTrace: null,
        capabilityRegistry: null
      });
      const reviewReady = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 2,
        workflowState: WORKFLOW_STATUSES.REVIEW_READY,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.REVIEW_READY, readinessScore: 50 },
        decisionTrace: null,
        capabilityRegistry: null
      });
      const storageReady = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 3,
        workflowState: WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY,
        readinessAssessment: {
          readinessStatus: READINESS_STATUSES.READY_FOR_STORAGE,
          readinessScore: 100
        },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(draftCreated.workflowStatus).toBe(WORKFLOW_STATUSES.DRAFT_CREATED);
      expect(reviewReady.workflowStatus).toBe(WORKFLOW_STATUSES.REVIEW_READY);
      expect(storageReady.workflowStatus).toBe(WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY);
    });

    test("normalizes unknown workflow state to BLOCKED", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 9,
        workflowState: "UNKNOWN_STATE",
        readinessAssessment: { readinessStatus: READINESS_STATUSES.PARTIALLY_READY, readinessScore: 25 },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(result.workflowStatus).toBe(WORKFLOW_STATUSES.BLOCKED);
    });
  });

  describe("readiness summary", () => {
    test("extracts readiness status and score from phase 123 assessment output", () => {
      const readinessAssessment = assessRecruitmentWorkflowReadiness({
        recruitmentId: 202,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.REVIEW_READY
      });

      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 202,
        workflowState: WORKFLOW_STATUSES.REVIEW_READY,
        nextRecommendedAction: "Create review package",
        readinessAssessment,
        decisionTrace: null,
        capabilityRegistry: createRecruitmentWorkflowCapabilityRegistry()
      });

      expect(result.readinessSummary).toEqual({
        status: READINESS_STATUSES.REVIEW_READY,
        score: 50
      });
    });

    test("accepts direct status and score fields on readinessAssessment", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 303,
        workflowState: WORKFLOW_STATUSES.APPROVED_FOR_STORAGE,
        readinessAssessment: { status: READINESS_STATUSES.READY_FOR_STORAGE, score: 100 },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(result.readinessSummary).toEqual({
        status: READINESS_STATUSES.READY_FOR_STORAGE,
        score: 100
      });
    });
  });

  describe("capability summary", () => {
    test("summarizes capability registry advisory catalog", () => {
      const registry = createRecruitmentWorkflowCapabilityRegistry();
      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 404,
        workflowState: WORKFLOW_STATUSES.REVIEW_READY,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.REVIEW_READY, readinessScore: 50 },
        decisionTrace: null,
        capabilityRegistry: registry
      });

      expect(result.capabilitySummary).toEqual({
        totalCapabilities: 8,
        availableCapabilities: 8,
        advisoryOnly: true,
        productionConnectedCount: 0
      });
    });

    test("returns empty capability summary when registry is missing", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 405,
        workflowState: WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.NOT_STARTED, readinessScore: 0 },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(result.capabilitySummary).toEqual({
        totalCapabilities: 0,
        availableCapabilities: 0,
        advisoryOnly: true,
        productionConnectedCount: 0
      });
    });
  });

  describe("decision trace summary", () => {
    test("summarizes decision trace from phase 121 output", () => {
      const decisionTrace = createWorkflowDecisionTrace({
        workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        nextRecommendedAction: "Await approval decision"
      });

      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 505,
        workflowState: WORKFLOW_STATUSES.WAITING_FOR_APPROVAL,
        nextRecommendedAction: "Await approval decision",
        readinessAssessment: {
          readinessStatus: READINESS_STATUSES.APPROVAL_PENDING,
          readinessScore: 75
        },
        decisionTrace,
        capabilityRegistry: null
      });

      expect(result.decisionSummary.summary).toContain("waiting for approval");
      expect(result.decisionSummary.reasoningStepCount).toBeGreaterThan(0);
      expect(typeof result.decisionSummary.pendingStepCount).toBe("number");
    });

    test("uses fallback decision summary when trace is unavailable", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 506,
        workflowState: WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.NOT_STARTED, readinessScore: 0 },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(result.decisionSummary.summary).toBe(
        "Workflow decision trace unavailable due to insufficient evaluation context"
      );
      expect(result.decisionSummary.reasoningStepCount).toBe(0);
      expect(result.decisionSummary.pendingStepCount).toBe(0);
    });
  });

  describe("pending items generation", () => {
    test("generates pending items for approval, draft, review, and blocked states", () => {
      const approvalPending = generateRecruitmentWorkflowAdvisoryReport(
        buildApprovalPendingReportInput({ recruitmentId: 601 })
      );
      const draftCreated = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 602,
        workflowState: WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.NOT_STARTED, readinessScore: 0 },
        decisionTrace: null,
        capabilityRegistry: null
      });
      const reviewReady = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 603,
        workflowState: WORKFLOW_STATUSES.REVIEW_READY,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.REVIEW_READY, readinessScore: 50 },
        decisionTrace: null,
        capabilityRegistry: null
      });
      const blocked = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 604,
        workflowState: WORKFLOW_STATUSES.BLOCKED,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.BLOCKED, readinessScore: 0 },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(approvalPending.pendingItems).toContain("Approval decision required");
      expect(draftCreated.pendingItems).toContain("Draft proposal required");
      expect(reviewReady.pendingItems).toContain("Review package required");
      expect(blocked.pendingItems).toContain("Resolve blocked workflow context");
    });
  });

  describe("recommendations generation", () => {
    test("generates descriptive recommendations for workflow states", () => {
      const approvalPending = generateRecruitmentWorkflowAdvisoryReport(
        buildApprovalPendingReportInput({ recruitmentId: 701 })
      );
      const draftCreated = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 702,
        workflowState: WORKFLOW_STATUSES.DRAFT_CREATED,
        readinessAssessment: { readinessStatus: READINESS_STATUSES.NOT_STARTED, readinessScore: 0 },
        decisionTrace: null,
        capabilityRegistry: null
      });
      const storageReady = generateRecruitmentWorkflowAdvisoryReport({
        recruitmentId: 703,
        workflowState: WORKFLOW_STATUSES.STORAGE_BOUNDARY_READY,
        readinessAssessment: {
          readinessStatus: READINESS_STATUSES.READY_FOR_STORAGE,
          readinessScore: 100
        },
        decisionTrace: null,
        capabilityRegistry: null
      });

      expect(approvalPending.recommendations).toEqual([
        "Await approval before persistence boundary"
      ]);
      expect(draftCreated.recommendations).toEqual(["Create draft proposal"]);
      expect(storageReady.recommendations).toEqual(["Ready for persistence boundary review"]);
    });
  });

  describe("metadata validation", () => {
    test("advisory metadata declares advisory-only non-persistent report generation", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport(buildApprovalPendingReportInput());

      expect(result.advisoryMetadata).toEqual({
        advisoryOnly: true,
        generatedBy: "phase_124",
        persistent: false,
        phase: 124,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        reportPublishing: false,
        sideEffects: false,
        mutatesInput: false,
        advisoryReportOnly: true
      });
      expect(isRecruitmentWorkflowAdvisoryReport(result)).toBe(true);
    });

    test("summarizeRecruitmentWorkflowAdvisoryReport returns frozen summary for valid report", () => {
      const report = generateRecruitmentWorkflowAdvisoryReport(buildApprovalPendingReportInput());
      const summary = summarizeRecruitmentWorkflowAdvisoryReport(report);

      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.workflowStatus).toBe(report.workflowStatus);
      expect(summary.readinessStatus).toBe(report.readinessSummary.status);
      expect(summary.readinessScore).toBe(report.readinessSummary.score);
      expect(summary.pendingItemCount).toBe(report.pendingItems.length);
      expect(summary.recommendationCount).toBe(report.recommendations.length);
    });

    test("summarizeRecruitmentWorkflowAdvisoryReport returns empty summary for invalid report", () => {
      expect(summarizeRecruitmentWorkflowAdvisoryReport({ invalid: true })).toBe(
        EMPTY_ADVISORY_REPORT_SUMMARY
      );
    });
  });

  describe("deterministic output", () => {
    test("returns identical report for identical input", () => {
      const input = buildApprovalPendingReportInput();

      const first = generateRecruitmentWorkflowAdvisoryReport(input);
      const second = generateRecruitmentWorkflowAdvisoryReport(input);
      const summaryA = summarizeRecruitmentWorkflowAdvisoryReport(first);
      const summaryB = summarizeRecruitmentWorkflowAdvisoryReport(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("immutability", () => {
    test("deep freezes advisory report output", () => {
      const result = generateRecruitmentWorkflowAdvisoryReport(buildApprovalPendingReportInput());

      assertAllFrozen(result);
      expect(() => {
        result.summary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.pendingItems.push("changed");
      }).toThrow();
      expect(() => {
        result.recommendations.push("changed");
      }).toThrow();
      expect(() => {
        result.readinessSummary.status = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("no side effects", () => {
    test("does not mutate report input or nested objects", () => {
      const input = buildApprovalPendingReportInput();
      const before = JSON.stringify(input);
      const readinessBefore = JSON.stringify(input.readinessAssessment);
      const traceBefore = JSON.stringify(input.decisionTrace);
      const registryBefore = JSON.stringify(input.capabilityRegistry);

      generateRecruitmentWorkflowAdvisoryReport(input);
      isRecruitmentWorkflowAdvisoryReport(generateRecruitmentWorkflowAdvisoryReport(input));
      summarizeRecruitmentWorkflowAdvisoryReport(
        generateRecruitmentWorkflowAdvisoryReport(input)
      );

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.readinessAssessment)).toBe(readinessBefore);
      expect(JSON.stringify(input.decisionTrace)).toBe(traceBefore);
      expect(JSON.stringify(input.capabilityRegistry)).toBe(registryBefore);
    });

    test("report generation does not mutate process environment", () => {
      const envBefore = { ...process.env };
      generateRecruitmentWorkflowAdvisoryReport(buildApprovalPendingReportInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure advisory report generator constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 124");
      expect(source).toContain("generateRecruitmentWorkflowAdvisoryReport");
      expect(source).toContain("isRecruitmentWorkflowAdvisoryReport");
      expect(source).toContain("summarizeRecruitmentWorkflowAdvisoryReport");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("advisoryReportOnly");
      expect(source).toContain("Never mutates input");
      expect(source).toContain("No runtime module imports");
      expect(source).toContain("No report publishing behavior");
    });

    test("module has no runtime imports or filesystem access", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([]);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("module does not import workflow phase modules", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/recruitmentDraftProposalEngine/);
      expect(source).not.toMatch(/recruitmentDraftPersistenceBoundary/);
      expect(source).not.toMatch(/recruitmentDraftApprovalGate/);
      expect(source).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
      expect(source).not.toMatch(/recruitmentDraftStorageAdapter/);
      expect(source).not.toMatch(/recruitmentDraftRepositoryContract/);
      expect(source).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(source).not.toMatch(/workflowDecisionTraceModel/);
      expect(source).not.toMatch(/recruitmentWorkflowCapabilityRegistry/);
      expect(source).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
    });

    test("advisory report generator is not wired into coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, or observation registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const readinessSource = read(READINESS_MODULE_PATH);
      const observationRegistrySource = read(OBSERVATION_REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(gatewaySource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(orchestratorSource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(traceModelSource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(readinessSource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
      expect(observationRegistrySource).not.toMatch(/recruitmentWorkflowAdvisoryReportGenerator/);
    });

    test("metadata declares no persistence, runtime connection, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.connectsToStorage).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ADVISORY_REPORT_METADATA.reportPublishing).toBe(false);
    });

    test("orchestrator behavior remains unchanged and independent from advisory report generator", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("reportTitle");
      expect(orchestration).not.toHaveProperty("pendingItems");
      expect(orchestration).not.toHaveProperty("readinessSummary");
    });
  });
});
