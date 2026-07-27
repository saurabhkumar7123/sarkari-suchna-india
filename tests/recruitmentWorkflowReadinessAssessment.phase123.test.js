"use strict";

/**
 * Phase 123 — Recruitment Workflow Readiness Assessment tests.
 * Empty input, no capabilities, partial readiness, review ready, approval pending,
 * storage ready, blocked state, capability assessment, recommendations, metadata,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE,
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_ENTITY,
  READINESS_STATUSES,
  WORKFLOW_CAPABILITY_IDS,
  WORKFLOW_STATE_SIGNALS,
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA,
  EMPTY_READINESS_ASSESSMENT_SUMMARY,
  assessRecruitmentWorkflowReadiness,
  isRecruitmentWorkflowReadinessAssessment,
  summarizeRecruitmentWorkflowReadiness
} = require("../server/lib/recruitment/recruitmentWorkflowReadinessAssessment");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowReadinessAssessment.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const TRACE_MODEL_MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowCapabilityRegistry.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const OBSERVATION_REGISTRY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "readinessStatus",
  "readinessScore",
  "capabilityAssessment",
  "missingCapabilities",
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

function buildDraftOnlyInput(overrides = {}) {
  return {
    recruitmentId: 101,
    capabilities: {
      [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true }
    },
    workflowState: WORKFLOW_STATE_SIGNALS.DRAFT_CREATED,
    decisionTrace: null,
    ...overrides
  };
}

function buildReviewReadyInput(overrides = {}) {
  return {
    recruitmentId: 202,
    capabilities: {
      [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true }
    },
    workflowState: WORKFLOW_STATE_SIGNALS.REVIEW_READY,
    decisionTrace: {
      decisionSummary: "Workflow has draft proposal and requires review package creation"
    },
    ...overrides
  };
}

function buildApprovalPendingInput(overrides = {}) {
  return {
    recruitmentId: 303,
    capabilities: {
      [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, ready: false, status: "pending" }
    },
    workflowState: WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL,
    decisionTrace: {
      decisionSummary:
        "Workflow is waiting for approval because review package exists but approval decision is pending",
      reasoningChain: [
        { step: "REVIEW_PACKAGE_CHECK", result: "PASS", explanation: "Review package available" },
        { step: "APPROVAL_CHECK", result: "PENDING", explanation: "Approval decision required" }
      ]
    },
    ...overrides
  };
}

function buildStorageReadyInput(overrides = {}) {
  return {
    recruitmentId: 404,
    capabilities: {
      [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
      [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, ready: true, approvalState: "approved" },
      [WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER]: { available: true },
      [WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT]: { available: true }
    },
    workflowState: WORKFLOW_STATE_SIGNALS.STORAGE_BOUNDARY_READY,
    decisionTrace: {
      decisionSummary: "Workflow is approved and repository contract is available"
    },
    ...overrides
  };
}

describe("Phase 123 — recruitmentWorkflowReadinessAssessment", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_PHASE).toBe(123);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_ENTITY).toBe(
        "recruitment_workflow_readiness_assessment"
      );
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_DESCRIPTOR.phase).toBe(123);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.readinessAssessmentOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.persistent).toBe(false);
      expect(READINESS_STATUSES.NOT_STARTED).toBe("NOT_STARTED");
      expect(READINESS_STATUSES.READY_FOR_STORAGE).toBe("READY_FOR_STORAGE");
    });
  });

  describe("empty input", () => {
    test("returns blocked assessment for null, undefined, or non-object input", () => {
      const nullResult = assessRecruitmentWorkflowReadiness(null);
      const undefinedResult = assessRecruitmentWorkflowReadiness(undefined);
      const stringResult = assessRecruitmentWorkflowReadiness("invalid");

      expect(Object.keys(nullResult).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
      expect(nullResult.readinessStatus).toBe(READINESS_STATUSES.BLOCKED);
      expect(nullResult.readinessScore).toBe(0);
      expect(nullResult.recruitmentId).toBeNull();
      expect(nullResult.recommendations).toEqual(["Resolve blocked workflow context"]);
      expect(undefinedResult).toEqual(nullResult);
      expect(stringResult).toEqual(nullResult);
      expect(isRecruitmentWorkflowReadinessAssessment(nullResult)).toBe(true);
      expect(summarizeRecruitmentWorkflowReadiness(nullResult).readinessStatus).toBe(
        READINESS_STATUSES.BLOCKED
      );
    });

    test("returns blocked assessment for missing recruitment identity", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: null,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.DRAFT_CREATED
      });

      expect(result.readinessStatus).toBe(READINESS_STATUSES.BLOCKED);
      expect(result.recruitmentId).toBeNull();
      expect(result.recommendations).toContain("Resolve blocked workflow context");
    });
  });

  describe("no capabilities", () => {
    test("returns NOT_STARTED when recruitment identity exists but no capabilities are available", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: 55,
        capabilities: {},
        workflowState: WORKFLOW_STATE_SIGNALS.DRAFT_CREATED,
        decisionTrace: null
      });

      expect(result.readinessStatus).toBe(READINESS_STATUSES.NOT_STARTED);
      expect(result.readinessScore).toBe(0);
      expect(result.recommendations).toEqual(["Create draft proposal"]);
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]).toEqual({
        available: false,
        ready: false
      });
    });

    test("returns NOT_STARTED when capabilities are present but none are available", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: 56,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: false },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { present: false }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.DRAFT_CREATED
      });

      expect(result.readinessStatus).toBe(READINESS_STATUSES.NOT_STARTED);
      expect(result.missingCapabilities).toContain(WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL);
    });
  });

  describe("partial readiness", () => {
    test("returns PARTIALLY_READY when only draft proposal capability is available", () => {
      const result = assessRecruitmentWorkflowReadiness(buildDraftOnlyInput());

      expect(result.readinessStatus).toBe(READINESS_STATUSES.PARTIALLY_READY);
      expect(result.readinessScore).toBe(25);
      expect(result.recruitmentId).toBe(101);
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]).toEqual({
        available: true,
        ready: true
      });
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]).toEqual({
        available: false,
        ready: false
      });
      expect(result.missingCapabilities).toContain(WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE);
      expect(result.recommendations).toEqual(["Create review package"]);
    });
  });

  describe("review ready state", () => {
    test("returns REVIEW_READY when draft and review package capabilities are available", () => {
      const result = assessRecruitmentWorkflowReadiness(buildReviewReadyInput());

      expect(result.readinessStatus).toBe(READINESS_STATUSES.REVIEW_READY);
      expect(result.readinessScore).toBe(50);
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]).toEqual({
        available: true,
        ready: true
      });
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]).toEqual({
        available: true,
        ready: true
      });
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("approval pending state", () => {
    test("returns APPROVAL_PENDING when review is complete and approval is pending", () => {
      const result = assessRecruitmentWorkflowReadiness(buildApprovalPendingInput());

      expect(result.readinessStatus).toBe(READINESS_STATUSES.APPROVAL_PENDING);
      expect(result.readinessScore).toBe(75);
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]).toEqual({
        available: true,
        ready: false
      });
      expect(result.recommendations).toEqual(["Await approval decision"]);
    });
  });

  describe("storage ready state", () => {
    test("returns READY_FOR_STORAGE when approval is approved and storage capability is available", () => {
      const result = assessRecruitmentWorkflowReadiness(buildStorageReadyInput());

      expect(result.readinessStatus).toBe(READINESS_STATUSES.READY_FOR_STORAGE);
      expect(result.readinessScore).toBe(100);
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]).toEqual({
        available: true,
        ready: true
      });
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER]).toEqual({
        available: true,
        ready: true
      });
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT]).toEqual({
        available: true,
        ready: true
      });
      expect(result.recommendations).toEqual(["Ready for storage boundary review"]);
    });
  });

  describe("blocked state", () => {
    test("returns BLOCKED when workflow state is blocked", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: 77,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.BLOCKED,
        decisionTrace: {
          decisionSummary: "Workflow is blocked because recruitment identity is required"
        }
      });

      expect(result.readinessStatus).toBe(READINESS_STATUSES.BLOCKED);
      expect(result.readinessScore).toBe(0);
      expect(result.recommendations).toContain("Resolve blocked workflow context");
    });

    test("returns BLOCKED when decision trace indicates blocked workflow", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: 78,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.REVIEW_READY,
        decisionTrace: {
          decisionSummary: "Workflow is blocked because approval was rejected",
          reasoningChain: [
            { step: "APPROVAL_CHECK", result: "BLOCKED", explanation: "Approval rejected" }
          ]
        }
      });

      expect(result.readinessStatus).toBe(READINESS_STATUSES.BLOCKED);
      expect(result.recommendations).toContain("Resolve blocked workflow context");
    });

    test("returns BLOCKED when approval is rejected", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: 79,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true },
          [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, approvalState: "rejected" }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.WAITING_FOR_APPROVAL
      });

      expect(result.readinessStatus).toBe(READINESS_STATUSES.BLOCKED);
      expect(result.recommendations).toContain("Resolve approval rejection before proceeding");
    });
  });

  describe("capability assessment output", () => {
    test("assesses all workflow capabilities with available and ready flags", () => {
      const result = assessRecruitmentWorkflowReadiness(buildApprovalPendingInput());

      expect(result.capabilityAssessment).toEqual(
        expect.objectContaining({
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
          [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, ready: false },
          [WORKFLOW_CAPABILITY_IDS.PERSISTENCE_BOUNDARY]: { available: false, ready: false },
          [WORKFLOW_CAPABILITY_IDS.STORAGE_ADAPTER]: { available: false, ready: false },
          [WORKFLOW_CAPABILITY_IDS.REPOSITORY_CONTRACT]: { available: false, ready: false }
        })
      );
    });

    test("recognizes capability availability from status aliases", () => {
      const result = assessRecruitmentWorkflowReadiness({
        recruitmentId: 88,
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { status: "available" },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { present: true }
        },
        workflowState: WORKFLOW_STATE_SIGNALS.REVIEW_READY
      });

      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL].available).toBe(
        true
      );
      expect(result.capabilityAssessment[WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE].available).toBe(
        true
      );
    });
  });

  describe("recommendation generation", () => {
    test("generates descriptive recommendations for each readiness status", () => {
      const notStarted = assessRecruitmentWorkflowReadiness({
        recruitmentId: 1,
        capabilities: {},
        workflowState: WORKFLOW_STATE_SIGNALS.DRAFT_CREATED
      });
      const partial = assessRecruitmentWorkflowReadiness(buildDraftOnlyInput({ recruitmentId: 2 }));
      const reviewReady = assessRecruitmentWorkflowReadiness(
        buildReviewReadyInput({ recruitmentId: 3 })
      );
      const approvalPending = assessRecruitmentWorkflowReadiness(
        buildApprovalPendingInput({ recruitmentId: 4 })
      );
      const storageReady = assessRecruitmentWorkflowReadiness(
        buildStorageReadyInput({ recruitmentId: 5 })
      );

      expect(notStarted.recommendations).toEqual(["Create draft proposal"]);
      expect(partial.recommendations).toEqual(["Create review package"]);
      expect(reviewReady.recommendations.length).toBeGreaterThan(0);
      expect(approvalPending.recommendations).toEqual(["Await approval decision"]);
      expect(storageReady.recommendations).toEqual(["Ready for storage boundary review"]);
    });
  });

  describe("metadata validation", () => {
    test("advisory metadata declares advisory-only non-persistent assessment", () => {
      const result = assessRecruitmentWorkflowReadiness(buildApprovalPendingInput());

      expect(result.advisoryMetadata).toEqual({
        advisoryOnly: true,
        persistent: false,
        phase: 123,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        sideEffects: false,
        mutatesInput: false,
        readinessAssessmentOnly: true
      });
      expect(isRecruitmentWorkflowReadinessAssessment(result)).toBe(true);
    });

    test("summarizeRecruitmentWorkflowReadiness returns frozen summary for valid assessment", () => {
      const assessment = assessRecruitmentWorkflowReadiness(buildReviewReadyInput());
      const summary = summarizeRecruitmentWorkflowReadiness(assessment);

      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.readinessStatus).toBe(assessment.readinessStatus);
      expect(summary.readinessScore).toBe(assessment.readinessScore);
      expect(summary.missingCapabilityCount).toBe(assessment.missingCapabilities.length);
      expect(summary.recommendationCount).toBe(assessment.recommendations.length);
    });

    test("summarizeRecruitmentWorkflowReadiness returns empty summary for invalid assessment", () => {
      expect(summarizeRecruitmentWorkflowReadiness({ invalid: true })).toBe(
        EMPTY_READINESS_ASSESSMENT_SUMMARY
      );
    });
  });

  describe("deterministic result", () => {
    test("returns identical assessment for identical input", () => {
      const input = buildApprovalPendingInput();

      const first = assessRecruitmentWorkflowReadiness(input);
      const second = assessRecruitmentWorkflowReadiness(input);
      const summaryA = summarizeRecruitmentWorkflowReadiness(first);
      const summaryB = summarizeRecruitmentWorkflowReadiness(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("immutability", () => {
    test("deep freezes readiness assessment output", () => {
      const result = assessRecruitmentWorkflowReadiness(buildStorageReadyInput());

      assertAllFrozen(result);
      expect(() => {
        result.readinessStatus = "CHANGED";
      }).toThrow();
      expect(() => {
        result.missingCapabilities.push("changed");
      }).toThrow();
      expect(() => {
        result.recommendations.push("changed");
      }).toThrow();
      expect(() => {
        result.capabilityAssessment.draft_proposal.available = false;
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("no side effects", () => {
    test("does not mutate assessment input or nested objects", () => {
      const input = buildApprovalPendingInput({
        capabilities: {
          [WORKFLOW_CAPABILITY_IDS.DRAFT_PROPOSAL]: { available: true, ready: true },
          [WORKFLOW_CAPABILITY_IDS.REVIEW_PACKAGE]: { available: true, ready: true },
          [WORKFLOW_CAPABILITY_IDS.APPROVAL_GATE]: { available: true, status: "pending" }
        },
        decisionTrace: {
          decisionSummary: "pending approval",
          reasoningChain: [{ step: "APPROVAL_CHECK", result: "PENDING" }]
        }
      });
      const before = JSON.stringify(input);
      const capabilitiesBefore = JSON.stringify(input.capabilities);
      const traceBefore = JSON.stringify(input.decisionTrace);

      assessRecruitmentWorkflowReadiness(input);
      isRecruitmentWorkflowReadinessAssessment(assessRecruitmentWorkflowReadiness(input));
      summarizeRecruitmentWorkflowReadiness(assessRecruitmentWorkflowReadiness(input));

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.capabilities)).toBe(capabilitiesBefore);
      expect(JSON.stringify(input.decisionTrace)).toBe(traceBefore);
    });

    test("assessment does not mutate process environment", () => {
      const envBefore = { ...process.env };
      assessRecruitmentWorkflowReadiness(buildReviewReadyInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure readiness assessment constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 123");
      expect(source).toContain("assessRecruitmentWorkflowReadiness");
      expect(source).toContain("isRecruitmentWorkflowReadinessAssessment");
      expect(source).toContain("summarizeRecruitmentWorkflowReadiness");
      expect(source).toContain("READINESS_STATUSES");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("readinessAssessmentOnly");
      expect(source).toContain("Never mutates input");
      expect(source).toContain("No runtime module imports");
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
    });

    test("readiness assessment is not wired into coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, or observation registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const observationRegistrySource = read(OBSERVATION_REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(gatewaySource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(orchestratorSource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(traceModelSource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
      expect(observationRegistrySource).not.toMatch(/recruitmentWorkflowReadinessAssessment/);
    });

    test("metadata declares no persistence, runtime connection, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_READINESS_ASSESSMENT_METADATA.connectsToStorage).toBe(false);
    });

    test("orchestrator behavior remains unchanged and independent from readiness assessment", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("readinessStatus");
      expect(orchestration).not.toHaveProperty("readinessScore");
      expect(orchestration).not.toHaveProperty("capabilityAssessment");
    });
  });
});
