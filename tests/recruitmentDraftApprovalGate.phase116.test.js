"use strict";

/**
 * Phase 116 — Recruitment Draft Approval Gate tests.
 * CREATE approved, UPDATE needs review, manual review, no persistence,
 * high risk, invalid input, malformed context, determinism, immutability,
 * input unchanged, and architecture boundaries.
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
  RECRUITMENT_DRAFT_APPROVAL_GATE_PHASE,
  RECRUITMENT_DRAFT_APPROVAL_GATE_ENTITY,
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  RECRUITMENT_DRAFT_APPROVED_OPERATIONS,
  RECRUITMENT_DRAFT_APPROVAL_REASONS,
  RECRUITMENT_DRAFT_APPROVAL_GATE_DESCRIPTOR,
  RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA,
  EMPTY_APPROVAL_SUMMARY,
  evaluateRecruitmentDraftApproval,
  isRecruitmentDraftApproval,
  summarizeRecruitmentDraftApproval
} = require("../server/lib/recruitment/recruitmentDraftApprovalGate");

const {
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS,
  createRecruitmentDraftPersistenceRequest
} = require("../server/lib/recruitment/recruitmentDraftPersistenceBoundary");

const {
  RECRUITMENT_DRAFT_PROPOSAL_ACTIONS,
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE,
  RECRUITMENT_DRAFT_PROPOSAL_REASONS,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY,
  createRecruitmentDraftProposal
} = require("../server/lib/recruitment/recruitmentDraftProposalEngine");

const {
  getRecruitmentWorkflowAdvisoryGateway
} = require("../server/lib/recruitment/recruitmentWorkflowAdvisoryGateway");

const {
  ROLLOUT_READINESS_STATUS
} = require("../server/lib/recruitment/recruitmentWorkflowObservationRolloutReadiness");

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
const MODULE_PATH = "server/lib/recruitment/recruitmentDraftApprovalGate.js";
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
    updateId: 116,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-116-trace",
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
    updateId: overrides.updateId ?? 1601
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

function buildApprovalContext(advisoryOverrides = {}, approvalOverrides = {}) {
  const persistenceContext = buildPersistenceContext(advisoryOverrides, approvalOverrides);
  const persistenceRequest = createRecruitmentDraftPersistenceRequest(persistenceContext);

  return {
    persistenceRequest,
    reviewerContext: approvalOverrides.reviewerContext ?? null,
    riskContext: approvalOverrides.riskContext ?? null,
    ...approvalOverrides
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

const EXPECTED_APPROVAL_KEYS = Object.freeze([
  "approvalStatus",
  "approvedOperation",
  "persistenceOperation",
  "lifecycleEvent",
  "confidence",
  "reason",
  "requiresHumanAction",
  "reviewerRequired",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 116 — recruitmentDraftApprovalGate", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_PHASE).toBe(116);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_ENTITY).toBe("recruitment_draft_approval_gate");
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_DESCRIPTOR.phase).toBe(116);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.approvalGateOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.storesReviewerDecisions).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED).toBe("APPROVED");
      expect(RECRUITMENT_DRAFT_APPROVAL_STATUSES.REJECTED).toBe("REJECTED");
      expect(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW).toBe("NEEDS_REVIEW");
    });
  });

  describe("create draft approved", () => {
    test("approves CREATE_DRAFT_REQUEST persistence request", () => {
      const context = buildApprovalContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const approval = evaluateRecruitmentDraftApproval(context);

      expect(Object.keys(approval).sort()).toEqual([...EXPECTED_APPROVAL_KEYS].sort());
      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(approval.approvedOperation).toBe(
        RECRUITMENT_DRAFT_APPROVED_OPERATIONS.CREATE_DRAFT_REQUEST
      );
      expect(approval.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST
      );
      expect(approval.lifecycleEvent).toBe("NOTIFICATION");
      expect(approval.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE);
      expect(approval.requiresHumanAction).toBe(false);
      expect(approval.reviewerRequired).toBe(false);
      expect(approval.advisory).toBe(true);
      expect(approval.architectureOnly).toBe(true);
      expect(approval.executed).toBe(false);
      expect(isRecruitmentDraftApproval(approval)).toBe(true);
    });
  });

  describe("update draft needs review", () => {
    test("requires review for UPDATE_DRAFT_REQUEST persistence request", () => {
      const context = buildApprovalContext({
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

      const approval = evaluateRecruitmentDraftApproval(context);

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(approval.approvedOperation).toBeNull();
      expect(approval.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST
      );
      expect(approval.lifecycleEvent).toBe("ADMIT_CARD");
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.EXISTING_RECRUITMENT_UPDATE);
      expect(approval.requiresHumanAction).toBe(true);
      expect(approval.reviewerRequired).toBe(true);
      expect(approval.executed).toBe(false);
    });
  });

  describe("manual review request", () => {
    test("requires review for MANUAL_REVIEW_REQUEST persistence request", () => {
      const draftProposal = createRecruitmentDraftProposal({
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.NOT_READY },
        lifecycle: "NOTIFICATION"
      });
      const persistenceRequest = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: { notice: notice() }
      });

      const approval = evaluateRecruitmentDraftApproval({
        persistenceRequest,
        reviewerContext: null,
        riskContext: null
      });

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(approval.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(approval.approvedOperation).toBeNull();
      expect(approval.requiresHumanAction).toBe(true);
      expect(approval.reviewerRequired).toBe(true);
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY);
    });
  });

  describe("no persistence request", () => {
    test("approves NO_PERSISTENCE_REQUEST with NO_ACTION approved operation", () => {
      const draftProposal = createRecruitmentDraftProposal({
        rolloutReadiness: {
          status: ROLLOUT_READINESS_STATUS.READY,
          lifecycle: "COMPLETED"
        },
        health: {
          lifecycle: "COMPLETED",
          workflowCompleted: true
        },
        lifecycle: "COMPLETED"
      });
      const persistenceRequest = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: { notice: notice() }
      });

      const approval = evaluateRecruitmentDraftApproval({ persistenceRequest });

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(approval.approvedOperation).toBe(RECRUITMENT_DRAFT_APPROVED_OPERATIONS.NO_ACTION);
      expect(approval.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST
      );
      expect(approval.lifecycleEvent).toBe("COMPLETED");
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.WORKFLOW_COMPLETED);
      expect(approval.requiresHumanAction).toBe(false);
      expect(approval.reviewerRequired).toBe(false);
    });
  });

  describe("high risk request", () => {
    test("elevates CREATE_DRAFT_REQUEST to NEEDS_REVIEW when highRisk is true", () => {
      const context = buildApprovalContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        },
        {
          riskContext: { highRisk: true }
        }
      );

      const approval = evaluateRecruitmentDraftApproval(context);

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(approval.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST
      );
      expect(approval.approvedOperation).toBeNull();
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_APPROVAL_REASONS.HIGH_RISK_PERSISTENCE_REQUEST);
      expect(approval.requiresHumanAction).toBe(true);
      expect(approval.reviewerRequired).toBe(true);
    });
  });

  describe("invalid input", () => {
    test("never throws for null or undefined context", () => {
      expect(() => evaluateRecruitmentDraftApproval(null)).not.toThrow();
      expect(() => evaluateRecruitmentDraftApproval(undefined)).not.toThrow();
      expect(() => isRecruitmentDraftApproval(null)).not.toThrow();
      expect(() => summarizeRecruitmentDraftApproval(undefined)).not.toThrow();
    });

    test("returns NEEDS_REVIEW with INVALID_PERSISTENCE_REQUEST when persistence request is missing", () => {
      const approval = evaluateRecruitmentDraftApproval({
        reviewerContext: { role: "admin" },
        riskContext: { highRisk: false }
      });

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_APPROVAL_REASONS.INVALID_PERSISTENCE_REQUEST);
      expect(approval.requiresHumanAction).toBe(true);
      expect(approval.reviewerRequired).toBe(true);
      expect(approval.executed).toBe(false);
      expect(isRecruitmentDraftApproval(approval)).toBe(true);
    });

    test("summarizeRecruitmentDraftApproval returns empty summary for invalid approval", () => {
      expect(summarizeRecruitmentDraftApproval(null)).toBe(EMPTY_APPROVAL_SUMMARY);
      expect(summarizeRecruitmentDraftApproval({ approvalStatus: "APPROVED" })).toBe(
        EMPTY_APPROVAL_SUMMARY
      );
    });
  });

  describe("malformed context", () => {
    test("never throws for malformed context values", () => {
      expect(() => evaluateRecruitmentDraftApproval("bad")).not.toThrow();
      expect(() => evaluateRecruitmentDraftApproval([])).not.toThrow();
      expect(() => evaluateRecruitmentDraftApproval(42)).not.toThrow();
      expect(() => isRecruitmentDraftApproval(Symbol("x"))).not.toThrow();
    });

    test("returns invalid persistence approval for non-object context", () => {
      const approval = evaluateRecruitmentDraftApproval("bad");

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_APPROVAL_REASONS.INVALID_PERSISTENCE_REQUEST);
      expect(approval.executed).toBe(false);
    });

    test("returns invalid persistence approval for malformed persistence request", () => {
      const approval = evaluateRecruitmentDraftApproval({
        persistenceRequest: { operation: "CREATE_DRAFT_REQUEST" }
      });

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(approval.reason).toBe(RECRUITMENT_DRAFT_APPROVAL_REASONS.INVALID_PERSISTENCE_REQUEST);
    });
  });

  describe("deterministic output", () => {
    test("returns identical approval for identical context", () => {
      const context = buildApprovalContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const first = evaluateRecruitmentDraftApproval(context);
      const second = evaluateRecruitmentDraftApproval(context);
      const summaryA = summarizeRecruitmentDraftApproval(first);
      const summaryB = summarizeRecruitmentDraftApproval(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });

    test("accepts persistence request passed directly as context", () => {
      const draftProposal = Object.freeze({
        action: RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT,
        proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT,
        lifecycleEvent: "NOTIFICATION",
        confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH,
        reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE,
        requiresHumanReview: false,
        targetMode: RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_CREATE,
        source: RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY,
        advisory: true,
        architectureOnly: true,
        executed: false
      });
      const persistenceRequest = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: {
          sourceIdentifier: "https://custom.example/notice",
          titleHint: "Custom Notice"
        }
      });

      const approval = evaluateRecruitmentDraftApproval(persistenceRequest);

      expect(approval.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(approval.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST
      );
    });
  });

  describe("deep immutability", () => {
    test("deep freezes approval output", () => {
      const approval = evaluateRecruitmentDraftApproval(
        buildApprovalContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      assertAllFrozen(approval);
      expect(() => {
        approval.approvalStatus = RECRUITMENT_DRAFT_APPROVAL_STATUSES.REJECTED;
      }).toThrow();
    });

    test("summarizeRecruitmentDraftApproval returns frozen summary", () => {
      const approval = evaluateRecruitmentDraftApproval(
        buildApprovalContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );
      const summary = summarizeRecruitmentDraftApproval(approval);

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("input unchanged", () => {
    test("does not mutate approval context or persistence request", () => {
      const context = buildApprovalContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const before = JSON.stringify(context);
      const requestBefore = JSON.stringify(context.persistenceRequest);

      evaluateRecruitmentDraftApproval(context);
      isRecruitmentDraftApproval(evaluateRecruitmentDraftApproval(context));
      summarizeRecruitmentDraftApproval(evaluateRecruitmentDraftApproval(context));

      expect(JSON.stringify(context)).toBe(before);
      expect(JSON.stringify(context.persistenceRequest)).toBe(requestBefore);
    });
  });

  describe("no coordinator invocation", () => {
    test("approval gate does not invoke coordinator", () => {
      const context = buildApprovalContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      evaluateRecruitmentDraftApproval(context);
      summarizeRecruitmentDraftApproval(evaluateRecruitmentDraftApproval(context));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 1610
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1610 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const workflowGateway = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const advisoryContext = {
        workflowGateway,
        observation: workflowGateway.observation,
        health: workflowGateway.health,
        rolloutReadiness: workflowGateway.rolloutReadiness,
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      };
      const draftProposal = createRecruitmentDraftProposal(advisoryContext);
      const persistenceRequest = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: { notice: notice() }
      });

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      evaluateRecruitmentDraftApproval({ persistenceRequest });

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure approval gate constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 116");
      expect(source).toContain("evaluateRecruitmentDraftApproval");
      expect(source).toContain("isRecruitmentDraftApproval");
      expect(source).toContain("summarizeRecruitmentDraftApproval");
      expect(source).toContain("RECRUITMENT_DRAFT_APPROVAL_STATUSES");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("approvalGateOnly");
      expect(source).toContain("storesReviewerDecisions");
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

    test("module has no repository imports and performs no database access", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/repository/i);
      expect(source).not.toMatch(/queriesDatabase:\s*true/);
      expect(source).not.toMatch(/\b(INSERT INTO|DELETE FROM|SELECT \*|mysql2)\b/i);
    });

    test("module only imports Phase 115 persistence boundary", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentDraftPersistenceBoundary")'
      ]);
    });

    test("approval gate is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentDraftApprovalGate/);
      expect(gatewaySource).not.toMatch(/recruitmentDraftApprovalGate/);
      expect(pipelineSource).not.toMatch(/recruitmentDraftApprovalGate/);
      expect(workerSource).not.toMatch(/recruitmentDraftApprovalGate/);
      expect(registrySource).not.toMatch(/recruitmentDraftApprovalGate/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_APPROVAL_GATE_METADATA.storesReviewerDecisions).toBe(false);
    });

    test("output never claims execution", () => {
      const approvals = [
        evaluateRecruitmentDraftApproval(buildApprovalContext({ lifecycle: "NOTIFICATION" })),
        evaluateRecruitmentDraftApproval(buildApprovalContext({
          eventType: "admit_card",
          lifecycle: "ADMIT_CARD",
          existingPageContext: { exists: true, pageId: "ssc-cgl-2026" }
        })),
        evaluateRecruitmentDraftApproval(null)
      ];

      for (let i = 0; i < approvals.length; i += 1) {
        expect(approvals[i].executed).toBe(false);
        expect(approvals[i].advisory).toBe(true);
        expect(approvals[i].architectureOnly).toBe(true);
      }
    });
  });
});
