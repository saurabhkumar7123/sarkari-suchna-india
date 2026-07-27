"use strict";

/**
 * Phase 120 — Recruitment Workflow Orchestrator tests.
 * Empty input, draft only, draft + review package, approval pending/approved,
 * repository unavailable, blocked scenarios, advisory trace, determinism,
 * immutability, and architecture boundaries.
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
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_PHASE,
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_ENTITY,
  RECRUITMENT_WORKFLOW_STATES,
  RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS,
  RECRUITMENT_WORKFLOW_BLOCKED_REASONS,
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA,
  EMPTY_WORKFLOW_ORCHESTRATION_SUMMARY,
  orchestrateRecruitmentWorkflow,
  isRecruitmentWorkflowOrchestrationResult,
  summarizeRecruitmentWorkflowOrchestration
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const {
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  RECRUITMENT_DRAFT_APPROVED_OPERATIONS,
  evaluateRecruitmentDraftApproval
} = require("../server/lib/recruitment/recruitmentDraftApprovalGate");

const {
  createRecruitmentDraftPersistenceRequest
} = require("../server/lib/recruitment/recruitmentDraftPersistenceBoundary");

const {
  createRecruitmentDraftProposal
} = require("../server/lib/recruitment/recruitmentDraftProposalEngine");

const {
  createRecruitmentDraftReviewPackage
} = require("../server/lib/recruitment/recruitmentDraftReviewPackageBuilder");

const {
  getRecruitmentWorkflowAdvisoryGateway
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisoryGateway");

const {
  attachRecruitmentWorkflowIntegration,
  peekRecruitmentWorkflowIntegration
} = require("../server/lib/recruitment/recruitmentPipelineIntegrationHook");

const {
  attachRecruitmentWorkflowObservationContractIntegration,
  peekRecruitmentWorkflowObservationContractIntegration
} = require("../server/lib/recruitment/recruitmentWorkflowObservationContractIntegrationHook");

const {
  attachRecruitmentWorkflowDiagnostics,
  peekRecruitmentWorkflowDiagnostics
} = require("../server/lib/recruitment/recruitmentWorkflowDiagnosticsAttachment");

const {
  peekWorkflowObservation
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRegistry");

const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");
const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Notification",
    content: "Apply online for Combined Graduate Level Examination 2026",
    url: "https://ssc.nic.in/cgl-2026-notification.pdf",
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

function mockProcessorResult(eventType = "notification") {
  return {
    status: PROCESS_RESULT_STATUS.SUCCESS,
    warnings: [],
    eventType,
    selectedRecruitment: candidate(),
    reviewItem: { title: notice().title, eventType, status: "pending" }
  };
}

function enabledInput(overrides = {}) {
  return {
    notice: notice(),
    updateId: 120,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-120-trace",
    ...overrides
  };
}

function attachIntegratedContract(outcome, input = enabledInput()) {
  attachRecruitmentWorkflowIntegration(outcome, input);
  return attachRecruitmentWorkflowObservationContractIntegration(outcome, input);
}

function buildReadyAdvisoryContext(overrides = {}) {
  const outcome = {
    skipped: false,
    result: mockProcessorResult(overrides.eventType ?? "notification"),
    updateId: overrides.updateId ?? 2001
  };
  attachIntegratedContract(outcome, enabledInput({ updateId: outcome.updateId }));
  attachRecruitmentWorkflowDiagnostics(outcome);

  const workflowGateway = getRecruitmentWorkflowAdvisoryGateway(outcome);

  return {
    workflowGateway,
    observation: workflowGateway.observation,
    health: workflowGateway.health,
    rolloutReadiness: workflowGateway.rolloutReadiness,
    lifecycle: overrides.lifecycle ?? workflowGateway.recommendation.lifecycle,
    existingPageContext: overrides.existingPageContext ?? null,
    detectedUpdateContext: overrides.detectedUpdateContext ?? null
  };
}

function buildPersistenceContext(advisoryOverrides = {}, contextOverrides = {}) {
  const advisoryContext = buildReadyAdvisoryContext(advisoryOverrides);
  const draftProposal = createRecruitmentDraftProposal(advisoryContext);

  return {
    draftProposal,
    detectedUpdateContext: advisoryOverrides.detectedUpdateContext ?? null,
    workflowContext: contextOverrides.workflowContext ?? {
      titleHint: advisoryOverrides.workflowTitleHint ?? null
    },
    sourceContext: contextOverrides.sourceContext ?? {
      notice: notice(),
      sourceIdentifier: contextOverrides.sourceIdentifier ?? notice().url,
      titleHint: contextOverrides.titleHint ?? notice().title
    },
    ...contextOverrides
  };
}

function buildReviewPackageContext(advisoryOverrides = {}, contextOverrides = {}) {
  const persistenceContext = buildPersistenceContext(advisoryOverrides, contextOverrides);
  const persistenceRequest = createRecruitmentDraftPersistenceRequest(persistenceContext);
  const approvalState = evaluateRecruitmentDraftApproval({
    persistenceRequest,
    riskContext: contextOverrides.riskContext ?? null
  });

  return {
    draftProposal: persistenceContext.draftProposal,
    persistenceRequest,
    approvalState,
    approvalDecision: approvalState,
    sourceContext: persistenceContext.sourceContext,
    detectedUpdateContext: persistenceContext.detectedUpdateContext,
    ...contextOverrides
  };
}

function buildWorkflowContext(advisoryOverrides = {}, contextOverrides = {}) {
  const reviewContext = buildReviewPackageContext(advisoryOverrides, contextOverrides);
  const reviewPackage = createRecruitmentDraftReviewPackage(reviewContext);

  return {
    recruitmentId:
      contextOverrides.recruitmentId ?? advisoryOverrides.recruitmentId ?? 42,
    eventType:
      contextOverrides.eventType ??
      advisoryOverrides.eventType ??
      "notification",
    draftProposal: reviewContext.draftProposal,
    reviewPackage,
    approvalState: reviewContext.approvalState,
    repositoryContractAvailability:
      contextOverrides.repositoryContractAvailability ??
      advisoryOverrides.repositoryContractAvailability ??
      false
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

const EXPECTED_ORCHESTRATION_KEYS = Object.freeze([
  "workflowState",
  "nextRecommendedAction",
  "blockedReasons",
  "advisoryTrace",
  "recruitmentId",
  "eventType",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 120 — recruitmentWorkflowOrchestrator", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_PHASE).toBe(120);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_ENTITY).toBe("recruitment_workflow_orchestrator");
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_DESCRIPTOR.phase).toBe(120);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.workflowOrchestratorOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.connectsToStorage).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED).toBe("DRAFT_CREATED");
      expect(RECRUITMENT_WORKFLOW_STATES.REVIEW_READY).toBe("REVIEW_READY");
      expect(RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL).toBe("WAITING_FOR_APPROVAL");
      expect(RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE).toBe("APPROVED_FOR_STORAGE");
      expect(RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY).toBe("STORAGE_BOUNDARY_READY");
      expect(RECRUITMENT_WORKFLOW_STATES.BLOCKED).toBe("BLOCKED");
    });
  });

  describe("empty input", () => {
    test("returns BLOCKED for null, undefined, or empty object", () => {
      const nullResult = orchestrateRecruitmentWorkflow(null);
      const undefinedResult = orchestrateRecruitmentWorkflow(undefined);
      const emptyResult = orchestrateRecruitmentWorkflow({});

      expect(nullResult.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.BLOCKED);
      expect(undefinedResult.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.BLOCKED);
      expect(emptyResult.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.BLOCKED);
      expect(emptyResult.blockedReasons).toContain(
        RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_RECRUITMENT_ID
      );
      expect(emptyResult.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.RESOLVE_BLOCKED_CONTEXT
      );
      expect(isRecruitmentWorkflowOrchestrationResult(nullResult)).toBe(true);
    });
  });

  describe("draft only", () => {
    test("returns REVIEW_READY when draft proposal exists without review package", () => {
      const persistenceContext = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const result = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification",
        draftProposal: persistenceContext.draftProposal
      });

      expect(Object.keys(result).sort()).toEqual([...EXPECTED_ORCHESTRATION_KEYS].sort());
      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.REVIEW_READY);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.CREATE_REVIEW_PACKAGE
      );
      expect(result.blockedReasons).toEqual([]);
      expect(result.recruitmentId).toBe(42);
      expect(result.eventType).toBe("notification");
      expect(result.advisory).toBe(true);
      expect(result.executed).toBe(false);
      expect(isRecruitmentWorkflowOrchestrationResult(result)).toBe(true);
    });
  });

  describe("draft + review package", () => {
    test("returns WAITING_FOR_APPROVAL when review package exists without approval", () => {
      const reviewContext = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const reviewPackage = createRecruitmentDraftReviewPackage(reviewContext);

      const result = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification",
        draftProposal: reviewContext.draftProposal,
        reviewPackage
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_APPROVAL_DECISION
      );
      expect(result.blockedReasons).toEqual([]);
    });
  });

  describe("approval pending", () => {
    test("returns WAITING_FOR_APPROVAL when approval status is NEEDS_REVIEW", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const pendingApproval = Object.freeze({
        ...context.approvalState,
        approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW,
        approvedOperation: null,
        requiresHumanAction: true,
        reviewerRequired: true
      });

      const result = orchestrateRecruitmentWorkflow({
        ...context,
        approvalState: pendingApproval
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_APPROVAL_DECISION
      );
      expect(pendingApproval.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      );
    });

    test("returns WAITING_FOR_APPROVAL for update draft needing review", () => {
      const context = buildWorkflowContext({
        eventType: "admit_card",
        lifecycle: "ADMIT_CARD",
        existingPageContext: {
          exists: true,
          pageId: "ssc-cgl-2026",
          recruitmentId: 42
        },
        detectedUpdateContext: {
          updateType: "admit_card",
          detectedAt: "2026-07-15T00:00:00.000Z"
        }
      });

      const result = orchestrateRecruitmentWorkflow(context);

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL);
      expect(context.approvalState.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      );
    });
  });

  describe("approval approved", () => {
    test("returns APPROVED_FOR_STORAGE when approved without repository contract", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const result = orchestrateRecruitmentWorkflow({
        ...context,
        repositoryContractAvailability: false
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_REPOSITORY_CONTRACT
      );
      expect(context.approvalState.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED
      );
      expect(context.approvalState.approvedOperation).toBe(
        RECRUITMENT_DRAFT_APPROVED_OPERATIONS.CREATE_DRAFT_REQUEST
      );
    });

    test("returns STORAGE_BOUNDARY_READY when approved and repository contract available", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const result = orchestrateRecruitmentWorkflow({
        ...context,
        repositoryContractAvailability: true
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.READY_FOR_PERSISTENCE_BOUNDARY
      );
      expect(result.blockedReasons).toEqual([]);
    });
  });

  describe("repository unavailable", () => {
    test("stays at APPROVED_FOR_STORAGE when repository contract is unavailable", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null,
        repositoryContractAvailability: false
      });

      const result = orchestrateRecruitmentWorkflow(context);

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_REPOSITORY_CONTRACT
      );
      expect(result.advisoryTrace.some((entry) => entry.step === "repository_contract")).toBe(
        true
      );
      expect(result.advisoryTrace.some((entry) => entry.outcome === "unavailable")).toBe(true);
    });
  });

  describe("blocked scenarios", () => {
    test("returns DRAFT_CREATED when recruitment identity exists without draft proposal", () => {
      const result = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(result.nextRecommendedAction).toBe(
        RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.CREATE_DRAFT_PROPOSAL
      );
      expect(result.blockedReasons).toEqual([]);
    });

    test("returns BLOCKED when approved path lacks review package", () => {
      const persistenceContext = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const persistenceRequest = createRecruitmentDraftPersistenceRequest(persistenceContext);
      const approvalState = evaluateRecruitmentDraftApproval({ persistenceRequest });

      const result = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification",
        draftProposal: persistenceContext.draftProposal,
        approvalState,
        repositoryContractAvailability: true
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.BLOCKED);
      expect(result.blockedReasons).toContain(
        RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_REVIEW_PACKAGE
      );
    });

    test("returns BLOCKED when approval is rejected", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const rejectedApproval = Object.freeze({
        ...context.approvalState,
        approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.REJECTED
      });

      const result = orchestrateRecruitmentWorkflow({
        ...context,
        approvalState: rejectedApproval
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.BLOCKED);
      expect(result.blockedReasons).toContain(
        RECRUITMENT_WORKFLOW_BLOCKED_REASONS.APPROVAL_REJECTED
      );
    });

    test("never throws for malformed context values", () => {
      expect(() => orchestrateRecruitmentWorkflow("bad")).not.toThrow();
      expect(() => orchestrateRecruitmentWorkflow([])).not.toThrow();
      expect(() => orchestrateRecruitmentWorkflow(42)).not.toThrow();
      expect(() => isRecruitmentWorkflowOrchestrationResult(Symbol("x"))).not.toThrow();
      expect(() => summarizeRecruitmentWorkflowOrchestration(undefined)).not.toThrow();
    });

    test("summarizeRecruitmentWorkflowOrchestration returns empty summary for invalid result", () => {
      expect(summarizeRecruitmentWorkflowOrchestration(null)).toBe(
        EMPTY_WORKFLOW_ORCHESTRATION_SUMMARY
      );
      expect(summarizeRecruitmentWorkflowOrchestration({ workflowState: "BLOCKED" })).toBe(
        EMPTY_WORKFLOW_ORCHESTRATION_SUMMARY
      );
    });
  });

  describe("advisory trace output", () => {
    test("includes deterministic trace entries for workflow resolution", () => {
      const context = buildWorkflowContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        },
        { repositoryContractAvailability: true }
      );

      const result = orchestrateRecruitmentWorkflow(context);

      expect(Array.isArray(result.advisoryTrace)).toBe(true);
      expect(result.advisoryTrace.length).toBeGreaterThan(0);
      expect(result.advisoryTrace[0]).toEqual(
        expect.objectContaining({
          step: "context_received",
          recruitmentId: 42,
          eventType: "notification",
          hasDraftProposal: true,
          hasReviewPackage: true,
          hasApprovalState: true,
          repositoryContractAvailable: true
        })
      );
      expect(result.advisoryTrace.some((entry) => entry.step === "storage_boundary")).toBe(true);
    });

    test("trace records blocked context validation for invalid input", () => {
      const result = orchestrateRecruitmentWorkflow(null);

      expect(result.advisoryTrace).toEqual([
        expect.objectContaining({
          step: "context_validation",
          outcome: "invalid_context"
        })
      ]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical orchestration for identical context", () => {
      const context = buildWorkflowContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        },
        { repositoryContractAvailability: true }
      );

      const first = orchestrateRecruitmentWorkflow(context);
      const second = orchestrateRecruitmentWorkflow(context);
      const summaryA = summarizeRecruitmentWorkflowOrchestration(first);
      const summaryB = summarizeRecruitmentWorkflowOrchestration(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });

    test("accepts approvalDecision alias for approvalState", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const { approvalState, ...withoutApprovalState } = context;

      const result = orchestrateRecruitmentWorkflow({
        ...withoutApprovalState,
        approvalDecision: approvalState,
        repositoryContractAvailability: true
      });

      expect(result.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY);
    });
  });

  describe("deep immutability", () => {
    test("deep freezes orchestration output", () => {
      const result = orchestrateRecruitmentWorkflow(
        buildWorkflowContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      assertAllFrozen(result);
      expect(() => {
        result.workflowState = RECRUITMENT_WORKFLOW_STATES.BLOCKED;
      }).toThrow();
      expect(() => {
        result.blockedReasons.push("CHANGED");
      }).toThrow();
      expect(() => {
        result.advisoryTrace.push({ step: "changed" });
      }).toThrow();
    });

    test("summarizeRecruitmentWorkflowOrchestration returns frozen summary", () => {
      const result = orchestrateRecruitmentWorkflow(
        buildWorkflowContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );
      const summary = summarizeRecruitmentWorkflowOrchestration(result);

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("input unchanged", () => {
    test("does not mutate workflow context or nested advisory artifacts", () => {
      const context = buildWorkflowContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        },
        { repositoryContractAvailability: true, updateId: 2010 }
      );
      const before = JSON.stringify(context);
      const draftBefore = JSON.stringify(context.draftProposal);
      const reviewBefore = JSON.stringify(context.reviewPackage);

      orchestrateRecruitmentWorkflow(context);
      isRecruitmentWorkflowOrchestrationResult(orchestrateRecruitmentWorkflow(context));
      summarizeRecruitmentWorkflowOrchestration(orchestrateRecruitmentWorkflow(context));

      expect(JSON.stringify(context)).toBe(before);
      expect(JSON.stringify(context.draftProposal)).toBe(draftBefore);
      expect(JSON.stringify(context.reviewPackage)).toBe(reviewBefore);
    });
  });

  describe("no coordinator invocation", () => {
    test("workflow orchestrator does not invoke coordinator", () => {
      const context = buildWorkflowContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      orchestrateRecruitmentWorkflow(context);
      summarizeRecruitmentWorkflowOrchestration(orchestrateRecruitmentWorkflow(context));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 2010
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 2010 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const context = buildWorkflowContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null,
          updateId: 2010
        },
        { repositoryContractAvailability: true }
      );

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      orchestrateRecruitmentWorkflow(context);

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure workflow orchestrator constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 120");
      expect(source).toContain("orchestrateRecruitmentWorkflow");
      expect(source).toContain("isRecruitmentWorkflowOrchestrationResult");
      expect(source).toContain("summarizeRecruitmentWorkflowOrchestration");
      expect(source).toContain("RECRUITMENT_WORKFLOW_STATES");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("workflowOrchestratorOnly");
      expect(source).toContain("connectsToStorage");
      expect(source).toContain("invokesCoordinator");
      expect(source).toContain("Never mutates input");
    });

    test("module does not import express, database drivers, filesystem APIs, or coordinator", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2/);
      expect(source).not.toMatch(/require\(["']https?["']\)/);
      expect(source).not.toMatch(/recruitmentWorkflowIntegrationCoordinator/);
      expect(source).not.toMatch(/coordinateRecruitmentWorkflowIntegration/);
    });

    test("module has no storage adapter invocation and performs no database access", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/createRecruitmentDraftStoragePayload/);
      expect(source).not.toMatch(/createRecruitmentDraftRepositoryContract/);
      expect(source).not.toMatch(/queriesDatabase:\s*true/);
      expect(source).not.toMatch(/\b(INSERT INTO|DELETE FROM|SELECT \*|mysql2)\b/i);
    });

    test("module only imports Phase 114, 116, and 117 type validators", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentDraftProposalEngine")',
        'require("./recruitmentDraftReviewPackageBuilder")',
        'require("./recruitmentDraftApprovalGate")'
      ]);
    });

    test("workflow orchestrator is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(gatewaySource).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(pipelineSource).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(workerSource).not.toMatch(/recruitmentWorkflowOrchestrator/);
      expect(registrySource).not.toMatch(/recruitmentWorkflowOrchestrator/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_WORKFLOW_ORCHESTRATOR_METADATA.connectsToStorage).toBe(false);
    });

    test("output never claims execution", () => {
      const results = [
        orchestrateRecruitmentWorkflow(null),
        orchestrateRecruitmentWorkflow(
          buildWorkflowContext({ lifecycle: "NOTIFICATION", existingPageContext: null })
        ),
        orchestrateRecruitmentWorkflow({
          recruitmentId: 42,
          eventType: "notification"
        })
      ];

      for (let i = 0; i < results.length; i += 1) {
        expect(results[i].executed).toBe(false);
        expect(results[i].advisory).toBe(true);
        expect(results[i].architectureOnly).toBe(true);
      }
    });
  });
});
