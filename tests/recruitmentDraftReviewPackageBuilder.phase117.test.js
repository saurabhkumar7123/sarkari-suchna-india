"use strict";

/**
 * Phase 117 — Recruitment Draft Review Package Builder tests.
 * CREATE/UPDATE/MANUAL_REVIEW/NO_ACTION packages, missing inputs, malformed context,
 * determinism, immutability, input unchanged, and architecture boundaries.
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
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_PHASE,
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_ENTITY,
  RECRUITMENT_DRAFT_REVIEW_STATUSES,
  RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS,
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_DESCRIPTOR,
  RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA,
  EMPTY_REVIEW_PACKAGE_SUMMARY,
  createRecruitmentDraftReviewPackage,
  isRecruitmentDraftReviewPackage,
  summarizeRecruitmentDraftReviewPackage
} = require("../server/lib/recruitment/recruitmentDraftReviewPackageBuilder");

const {
  evaluateRecruitmentDraftApproval
} = require("../server/lib/recruitment/recruitmentDraftApprovalGate");

const {
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS,
  createRecruitmentDraftPersistenceRequest
} = require("../server/lib/recruitment/recruitmentDraftPersistenceBoundary");

const {
  RECRUITMENT_DRAFT_PROPOSAL_ACTIONS,
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE,
  RECRUITMENT_DRAFT_PROPOSAL_REASONS,
  createRecruitmentDraftProposal
} = require("../server/lib/recruitment/recruitmentDraftProposalEngine");

const {
  RECRUITMENT_DRAFT_APPROVAL_STATUSES
} = require("../server/lib/recruitment/recruitmentDraftApprovalGate");

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
const MODULE_PATH = "server/lib/recruitment/recruitmentDraftReviewPackageBuilder.js";
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
    updateId: 117,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-117-trace",
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
    updateId: overrides.updateId ?? 1701
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
  const approvalDecision = evaluateRecruitmentDraftApproval({
    persistenceRequest,
    riskContext: contextOverrides.riskContext ?? null
  });

  return {
    draftProposal: persistenceContext.draftProposal,
    persistenceRequest,
    approvalDecision,
    sourceContext: persistenceContext.sourceContext,
    detectedUpdateContext: persistenceContext.detectedUpdateContext,
    ...contextOverrides
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

const EXPECTED_PACKAGE_KEYS = Object.freeze([
  "reviewStatus",
  "action",
  "lifecycleEvent",
  "proposalType",
  "persistenceOperation",
  "approvalStatus",
  "confidence",
  "titleHint",
  "sourceIdentifier",
  "reviewItems",
  "requiresHumanReview",
  "reviewerDecisionRequired",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 117 — recruitmentDraftReviewPackageBuilder", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_PHASE).toBe(117);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_ENTITY).toBe(
        "recruitment_draft_review_package_builder"
      );
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_DESCRIPTOR.phase).toBe(117);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.reviewPackageOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW).toBe("READY_FOR_REVIEW");
      expect(RECRUITMENT_DRAFT_REVIEW_STATUSES.CHANGE_REVIEW_REQUIRED).toBe("CHANGE_REVIEW_REQUIRED");
      expect(RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED).toBe("MANUAL_REVIEW_REQUIRED");
      expect(RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION).toBe("NO_ACTION");
    });
  });

  describe("valid create draft package", () => {
    test("builds READY_FOR_REVIEW package with creation details", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const reviewPackage = createRecruitmentDraftReviewPackage(context);

      expect(Object.keys(reviewPackage).sort()).toEqual([...EXPECTED_PACKAGE_KEYS].sort());
      expect(reviewPackage.reviewStatus).toBe(RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW);
      expect(reviewPackage.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT);
      expect(reviewPackage.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT);
      expect(reviewPackage.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST
      );
      expect(reviewPackage.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(reviewPackage.lifecycleEvent).toBe("NOTIFICATION");
      expect(reviewPackage.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
      expect(reviewPackage.titleHint).toBe(notice().title);
      expect(reviewPackage.sourceIdentifier).toBe(notice().url);
      expect(reviewPackage.reviewItems).toHaveLength(1);
      expect(reviewPackage.reviewItems[0].changeKind).toBe(
        RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS.PROPOSED_CREATE
      );
      expect(reviewPackage.reviewItems[0].lifecycleEvent).toBe("NOTIFICATION");
      expect(reviewPackage.reviewItems[0].titleHint).toBe(notice().title);
      expect(reviewPackage.reviewItems[0].sourceIdentifier).toBe(notice().url);
      expect(reviewPackage.reviewItems[0].advisoryDescription).toBe(
        "Proposed recruitment draft creation"
      );
      expect(reviewPackage.requiresHumanReview).toBe(true);
      expect(reviewPackage.reviewerDecisionRequired).toBe(false);
      expect(reviewPackage.advisory).toBe(true);
      expect(reviewPackage.architectureOnly).toBe(true);
      expect(reviewPackage.executed).toBe(false);
      expect(isRecruitmentDraftReviewPackage(reviewPackage)).toBe(true);
    });
  });

  describe("update draft package", () => {
    test("builds CHANGE_REVIEW_REQUIRED package with update details", () => {
      const context = buildReviewPackageContext({
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

      const reviewPackage = createRecruitmentDraftReviewPackage(context);

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.CHANGE_REVIEW_REQUIRED
      );
      expect(reviewPackage.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT);
      expect(reviewPackage.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.RECRUITMENT_LIFECYCLE_UPDATE
      );
      expect(reviewPackage.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST
      );
      expect(reviewPackage.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(reviewPackage.lifecycleEvent).toBe("ADMIT_CARD");
      expect(reviewPackage.reviewItems).toHaveLength(1);
      expect(reviewPackage.reviewItems[0].changeKind).toBe(
        RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS.PROPOSED_UPDATE
      );
      expect(reviewPackage.reviewItems[0].updateType).toBe("admit_card");
      expect(reviewPackage.reviewItems[0].advisoryDescription).toBe(
        "Proposed recruitment draft lifecycle update"
      );
      expect(reviewPackage.requiresHumanReview).toBe(true);
      expect(reviewPackage.reviewerDecisionRequired).toBe(true);
      expect(reviewPackage.executed).toBe(false);
    });
  });

  describe("manual review package", () => {
    test("builds MANUAL_REVIEW_REQUIRED package for rollout not ready", () => {
      const draftProposal = createRecruitmentDraftProposal({
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.NOT_READY },
        lifecycle: "NOTIFICATION"
      });
      const persistenceRequest = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: { notice: notice() }
      });
      const approvalDecision = evaluateRecruitmentDraftApproval({ persistenceRequest });

      const reviewPackage = createRecruitmentDraftReviewPackage({
        draftProposal,
        persistenceRequest,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(reviewPackage.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(reviewPackage.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(reviewPackage.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(reviewPackage.reviewItems).toHaveLength(1);
      expect(reviewPackage.reviewItems[0].changeKind).toBe(
        RECRUITMENT_DRAFT_REVIEW_ITEM_KINDS.MANUAL_REVIEW
      );
      expect(reviewPackage.reviewItems[0].reason).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY
      );
      expect(reviewPackage.requiresHumanReview).toBe(true);
      expect(reviewPackage.reviewerDecisionRequired).toBe(true);
    });
  });

  describe("no action package", () => {
    test("builds NO_ACTION package with empty review items", () => {
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
      const approvalDecision = evaluateRecruitmentDraftApproval({ persistenceRequest });

      const reviewPackage = createRecruitmentDraftReviewPackage({
        draftProposal,
        persistenceRequest,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      expect(reviewPackage.reviewStatus).toBe(RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION);
      expect(reviewPackage.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST
      );
      expect(reviewPackage.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION);
      expect(reviewPackage.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(reviewPackage.lifecycleEvent).toBe("COMPLETED");
      expect(reviewPackage.reviewItems).toEqual([]);
      expect(reviewPackage.requiresHumanReview).toBe(false);
      expect(reviewPackage.reviewerDecisionRequired).toBe(false);
    });
  });

  describe("missing proposal", () => {
    test("returns safe empty package when draft proposal is missing", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      delete context.draftProposal;

      const reviewPackage = createRecruitmentDraftReviewPackage(context);

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(reviewPackage.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(reviewPackage.reviewItems).toEqual([]);
      expect(reviewPackage.requiresHumanReview).toBe(true);
      expect(reviewPackage.reviewerDecisionRequired).toBe(true);
      expect(reviewPackage.executed).toBe(false);
      expect(isRecruitmentDraftReviewPackage(reviewPackage)).toBe(true);
    });
  });

  describe("missing persistence request", () => {
    test("returns safe empty package when persistence request is missing", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      delete context.persistenceRequest;

      const reviewPackage = createRecruitmentDraftReviewPackage(context);

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(reviewPackage.persistenceOperation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(reviewPackage.reviewItems).toEqual([]);
      expect(reviewPackage.executed).toBe(false);
    });
  });

  describe("missing approval decision", () => {
    test("returns safe empty package when approval decision is missing", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      delete context.approvalDecision;

      const reviewPackage = createRecruitmentDraftReviewPackage(context);

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(reviewPackage.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(reviewPackage.reviewItems).toEqual([]);
      expect(reviewPackage.executed).toBe(false);
    });
  });

  describe("malformed input", () => {
    test("never throws for null, undefined, or non-object context", () => {
      expect(() => createRecruitmentDraftReviewPackage(null)).not.toThrow();
      expect(() => createRecruitmentDraftReviewPackage(undefined)).not.toThrow();
      expect(() => createRecruitmentDraftReviewPackage("bad")).not.toThrow();
      expect(() => createRecruitmentDraftReviewPackage([])).not.toThrow();
      expect(() => createRecruitmentDraftReviewPackage(42)).not.toThrow();
      expect(() => isRecruitmentDraftReviewPackage(Symbol("x"))).not.toThrow();
      expect(() => summarizeRecruitmentDraftReviewPackage(undefined)).not.toThrow();
    });

    test("returns safe empty package for malformed context", () => {
      const reviewPackage = createRecruitmentDraftReviewPackage("bad");

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(reviewPackage.executed).toBe(false);
      expect(reviewPackage.advisory).toBe(true);
      expect(isRecruitmentDraftReviewPackage(reviewPackage)).toBe(true);
    });

    test("returns safe empty package for malformed phase outputs", () => {
      const reviewPackage = createRecruitmentDraftReviewPackage({
        draftProposal: { action: "CREATE_DRAFT" },
        persistenceRequest: { operation: "CREATE_DRAFT_REQUEST" },
        approvalDecision: { approvalStatus: "APPROVED" }
      });

      expect(reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(reviewPackage.reviewItems).toEqual([]);
    });

    test("summarizeRecruitmentDraftReviewPackage returns empty summary for invalid package", () => {
      expect(summarizeRecruitmentDraftReviewPackage(null)).toBe(EMPTY_REVIEW_PACKAGE_SUMMARY);
      expect(summarizeRecruitmentDraftReviewPackage({ reviewStatus: "READY_FOR_REVIEW" })).toBe(
        EMPTY_REVIEW_PACKAGE_SUMMARY
      );
    });
  });

  describe("deterministic output", () => {
    test("returns identical review package for identical context", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const first = createRecruitmentDraftReviewPackage(context);
      const second = createRecruitmentDraftReviewPackage(context);
      const summaryA = summarizeRecruitmentDraftReviewPackage(first);
      const summaryB = summarizeRecruitmentDraftReviewPackage(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("immutability", () => {
    test("deep freezes review package output", () => {
      const reviewPackage = createRecruitmentDraftReviewPackage(
        buildReviewPackageContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      assertAllFrozen(reviewPackage);
      expect(() => {
        reviewPackage.reviewStatus = RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION;
      }).toThrow();
    });

    test("summarizeRecruitmentDraftReviewPackage returns frozen summary", () => {
      const reviewPackage = createRecruitmentDraftReviewPackage(
        buildReviewPackageContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );
      const summary = summarizeRecruitmentDraftReviewPackage(reviewPackage);

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("input unchanged", () => {
    test("does not mutate review package context or phase outputs", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const before = JSON.stringify(context);
      const proposalBefore = JSON.stringify(context.draftProposal);
      const requestBefore = JSON.stringify(context.persistenceRequest);
      const approvalBefore = JSON.stringify(context.approvalDecision);

      createRecruitmentDraftReviewPackage(context);
      isRecruitmentDraftReviewPackage(createRecruitmentDraftReviewPackage(context));
      summarizeRecruitmentDraftReviewPackage(createRecruitmentDraftReviewPackage(context));

      expect(JSON.stringify(context)).toBe(before);
      expect(JSON.stringify(context.draftProposal)).toBe(proposalBefore);
      expect(JSON.stringify(context.persistenceRequest)).toBe(requestBefore);
      expect(JSON.stringify(context.approvalDecision)).toBe(approvalBefore);
    });
  });

  describe("no coordinator invocation", () => {
    test("review package builder does not invoke coordinator", () => {
      const context = buildReviewPackageContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      createRecruitmentDraftReviewPackage(context);
      summarizeRecruitmentDraftReviewPackage(createRecruitmentDraftReviewPackage(context));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 1710
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1710 }));
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
      const approvalDecision = evaluateRecruitmentDraftApproval({ persistenceRequest });

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      createRecruitmentDraftReviewPackage({
        draftProposal,
        persistenceRequest,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure review package builder constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 117");
      expect(source).toContain("createRecruitmentDraftReviewPackage");
      expect(source).toContain("isRecruitmentDraftReviewPackage");
      expect(source).toContain("summarizeRecruitmentDraftReviewPackage");
      expect(source).toContain("RECRUITMENT_DRAFT_REVIEW_STATUSES");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("reviewPackageOnly");
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

    test("module only imports Phase 114, 115, and 116 modules", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentDraftProposalEngine")',
        'require("./recruitmentDraftPersistenceBoundary")',
        'require("./recruitmentDraftApprovalGate")'
      ]);
    });

    test("review package builder is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
      expect(gatewaySource).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
      expect(pipelineSource).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
      expect(workerSource).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
      expect(registrySource).not.toMatch(/recruitmentDraftReviewPackageBuilder/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_DRAFT_REVIEW_PACKAGE_BUILDER_METADATA.pipelineWiring).toBe(false);
    });

    test("advisory flags are always true and executed is always false", () => {
      const packages = [
        createRecruitmentDraftReviewPackage(
          buildReviewPackageContext({ lifecycle: "NOTIFICATION", existingPageContext: null })
        ),
        createRecruitmentDraftReviewPackage(
          buildReviewPackageContext({
            eventType: "admit_card",
            lifecycle: "ADMIT_CARD",
            existingPageContext: { exists: true, pageId: "ssc-cgl-2026" }
          })
        ),
        createRecruitmentDraftReviewPackage(null)
      ];

      for (let i = 0; i < packages.length; i += 1) {
        expect(packages[i].advisory).toBe(true);
        expect(packages[i].architectureOnly).toBe(true);
        expect(packages[i].executed).toBe(false);
      }
    });

    test("review items describe proposed changes only without generated content", () => {
      const reviewPackage = createRecruitmentDraftReviewPackage(
        buildReviewPackageContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      const serialized = JSON.stringify(reviewPackage.reviewItems);
      expect(serialized).not.toMatch(/"content"\s*:/);
      expect(serialized).not.toMatch(/"body"\s*:/);
      expect(serialized).not.toMatch(/"html"\s*:/);
      expect(serialized).not.toMatch(/"draftId"\s*:/);
      expect(serialized).not.toMatch(/"pageId"\s*:/);
      expect(reviewPackage.reviewItems[0]).not.toHaveProperty("content");
      expect(reviewPackage.reviewItems[0]).not.toHaveProperty("body");
    });

    test("high risk create elevates reviewer decision requirement in package", () => {
      const context = buildReviewPackageContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        },
        {
          riskContext: { highRisk: true }
        }
      );

      const reviewPackage = createRecruitmentDraftReviewPackage(context);

      expect(reviewPackage.reviewStatus).toBe(RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW);
      expect(reviewPackage.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW);
      expect(reviewPackage.reviewerDecisionRequired).toBe(true);
      expect(reviewPackage.requiresHumanReview).toBe(true);
      expect(reviewPackage.reviewItems[0].reason).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE
      );
    });
  });
});
