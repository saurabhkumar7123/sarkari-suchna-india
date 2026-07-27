"use strict";

/**
 * Phase 118 — Recruitment Draft Storage Adapter Boundary tests.
 * CREATE/UPDATE/HOLD/NO_ACTION payloads, missing review package, invalid approval,
 * malformed input, determinism, immutability, input unchanged, and architecture boundaries.
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
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_PHASE,
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_ENTITY,
  RECRUITMENT_DRAFT_STORAGE_PAYLOAD_VERSION,
  RECRUITMENT_DRAFT_STORAGE_ACTIONS,
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_DESCRIPTOR,
  RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA,
  EMPTY_STORAGE_PAYLOAD_SUMMARY,
  createRecruitmentDraftStoragePayload,
  isRecruitmentDraftStoragePayload,
  summarizeRecruitmentDraftStoragePayload
} = require("../server/lib/recruitment/recruitmentDraftStorageAdapter");

const {
  RECRUITMENT_DRAFT_REVIEW_STATUSES,
  createRecruitmentDraftReviewPackage
} = require("../server/lib/recruitment/recruitmentDraftReviewPackageBuilder");

const {
  evaluateRecruitmentDraftApproval,
  RECRUITMENT_DRAFT_APPROVAL_STATUSES,
  RECRUITMENT_DRAFT_APPROVED_OPERATIONS,
  RECRUITMENT_DRAFT_APPROVAL_REASONS
} = require("../server/lib/recruitment/recruitmentDraftApprovalGate");

const {
  RECRUITMENT_DRAFT_PERSISTENCE_ENTITY,
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
const MODULE_PATH = "server/lib/recruitment/recruitmentDraftStorageAdapter.js";
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
    updateId: 118,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-118-trace",
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
    updateId: overrides.updateId ?? 1801
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

function buildStorageAdapterContext(advisoryOverrides = {}, contextOverrides = {}) {
  const reviewContext = buildReviewPackageContext(advisoryOverrides, contextOverrides);
  const reviewPackage = createRecruitmentDraftReviewPackage(reviewContext);

  return {
    reviewPackage,
    approvalDecision: reviewContext.approvalDecision,
    sourceContext: reviewContext.sourceContext,
    detectedUpdateContext: reviewContext.detectedUpdateContext,
    ...contextOverrides
  };
}

function buildApprovedUpdateApprovalDecision(overrides = {}) {
  return Object.freeze({
    approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED,
    approvedOperation: null,
    persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST,
    lifecycleEvent: overrides.lifecycleEvent ?? "ADMIT_CARD",
    confidence: overrides.confidence ?? RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH,
    reason:
      overrides.reason ?? RECRUITMENT_DRAFT_APPROVAL_REASONS.EXISTING_RECRUITMENT_UPDATE,
    requiresHumanAction: false,
    reviewerRequired: false,
    advisory: true,
    architectureOnly: true,
    executed: false
  });
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

const EXPECTED_PAYLOAD_KEYS = Object.freeze([
  "storageAction",
  "entity",
  "lifecycleEvent",
  "proposalType",
  "titleHint",
  "sourceIdentifier",
  "draftMetadata",
  "payloadVersion",
  "persistenceEnabled",
  "executed",
  "advisory",
  "architectureOnly"
]);

describe("Phase 118 — recruitmentDraftStorageAdapter", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_PHASE).toBe(118);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_ENTITY).toBe("recruitment_draft_storage_adapter");
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_DESCRIPTOR.phase).toBe(118);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.storageAdapterOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_PAYLOAD_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD).toBe("CREATE_DRAFT_RECORD");
      expect(RECRUITMENT_DRAFT_STORAGE_ACTIONS.UPDATE_DRAFT_RECORD).toBe("UPDATE_DRAFT_RECORD");
      expect(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW).toBe("HOLD_FOR_REVIEW");
      expect(RECRUITMENT_DRAFT_STORAGE_ACTIONS.NO_STORAGE_ACTION).toBe("NO_STORAGE_ACTION");
    });
  });

  describe("valid create storage payload", () => {
    test("maps READY_FOR_REVIEW with approved CREATE_DRAFT_REQUEST to CREATE_DRAFT_RECORD", () => {
      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const payload = createRecruitmentDraftStoragePayload(context);

      expect(Object.keys(payload).sort()).toEqual([...EXPECTED_PAYLOAD_KEYS].sort());
      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD);
      expect(payload.entity).toBe(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY);
      expect(payload.lifecycleEvent).toBe("NOTIFICATION");
      expect(payload.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT);
      expect(payload.titleHint).toBe(notice().title);
      expect(payload.sourceIdentifier).toBe(notice().url);
      expect(payload.draftMetadata.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW
      );
      expect(payload.draftMetadata.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(payload.draftMetadata.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
      expect(payload.draftMetadata.requiresHumanReview).toBe(true);
      expect(payload.payloadVersion).toBe("1.0.0");
      expect(payload.persistenceEnabled).toBe(false);
      expect(payload.executed).toBe(false);
      expect(payload.advisory).toBe(true);
      expect(payload.architectureOnly).toBe(true);
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });
  });

  describe("valid update storage payload", () => {
    test("maps CHANGE_REVIEW_REQUIRED with approved UPDATE_DRAFT_REQUEST to UPDATE_DRAFT_RECORD", () => {
      const reviewContext = buildReviewPackageContext({
        eventType: "admit_card",
        lifecycle: "ADMIT_CARD",
        existingPageContext: {
          exists: true,
          pageId: "ssc-cgl-2026",
          recruitmentId: 42
        },
        detectedUpdateContext: {
          updateType: "admit_card",
          sourceUrl: "https://ssc.nic.in/cgl-2026-admit.pdf"
        }
      });
      const reviewPackage = createRecruitmentDraftReviewPackage(reviewContext);
      const approvalDecision = buildApprovedUpdateApprovalDecision({
        lifecycleEvent: "ADMIT_CARD"
      });

      const context = {
        reviewPackage,
        approvalDecision,
        sourceContext: reviewContext.sourceContext,
        detectedUpdateContext: reviewContext.detectedUpdateContext
      };

      const payload = createRecruitmentDraftStoragePayload(context);

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.UPDATE_DRAFT_RECORD);
      expect(payload.entity).toBe(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY);
      expect(payload.lifecycleEvent).toBe("ADMIT_CARD");
      expect(payload.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.RECRUITMENT_LIFECYCLE_UPDATE
      );
      expect(payload.draftMetadata.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.CHANGE_REVIEW_REQUIRED
      );
      expect(payload.draftMetadata.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(payload.sourceIdentifier).toBe(notice().url);
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });
  });

  describe("manual review hold", () => {
    test("maps MANUAL_REVIEW_REQUIRED to HOLD_FOR_REVIEW", () => {
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

      const payload = createRecruitmentDraftStoragePayload({
        reviewPackage,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW);
      expect(payload.entity).toBe(null);
      expect(payload.draftMetadata.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(payload.draftMetadata.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      );
      expect(payload.draftMetadata.requiresHumanReview).toBe(true);
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });
  });

  describe("no action", () => {
    test("maps NO_ACTION to NO_STORAGE_ACTION", () => {
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

      const payload = createRecruitmentDraftStoragePayload({
        reviewPackage,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.NO_STORAGE_ACTION);
      expect(payload.entity).toBe(null);
      expect(payload.lifecycleEvent).toBe("COMPLETED");
      expect(payload.draftMetadata.reviewStatus).toBe(RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION);
      expect(payload.draftMetadata.approvalStatus).toBe(RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED);
      expect(payload.draftMetadata.requiresHumanReview).toBe(false);
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });
  });

  describe("missing review package", () => {
    test("returns safe empty payload when review package is missing", () => {
      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      delete context.reviewPackage;

      const payload = createRecruitmentDraftStoragePayload(context);

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW);
      expect(payload.entity).toBe(null);
      expect(payload.lifecycleEvent).toBe("UNKNOWN");
      expect(payload.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW);
      expect(payload.titleHint).toBe(null);
      expect(payload.sourceIdentifier).toBe(null);
      expect(payload.draftMetadata.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.MANUAL_REVIEW_REQUIRED
      );
      expect(payload.draftMetadata.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      );
      expect(payload.executed).toBe(false);
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });
  });

  describe("invalid approval decision", () => {
    test("returns safe empty payload when approval decision is invalid", () => {
      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      context.approvalDecision = {
        approvalStatus: "MAYBE",
        persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST
      };

      const payload = createRecruitmentDraftStoragePayload(context);

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW);
      expect(payload.lifecycleEvent).toBe("UNKNOWN");
      expect(payload.draftMetadata.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      );
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });
  });

  describe("malformed input", () => {
    test("never throws for null, undefined, or non-object context", () => {
      expect(() => createRecruitmentDraftStoragePayload(null)).not.toThrow();
      expect(() => createRecruitmentDraftStoragePayload(undefined)).not.toThrow();
      expect(() => createRecruitmentDraftStoragePayload("bad")).not.toThrow();
      expect(() => createRecruitmentDraftStoragePayload([])).not.toThrow();
      expect(() => createRecruitmentDraftStoragePayload(42)).not.toThrow();
      expect(() => isRecruitmentDraftStoragePayload(Symbol("x"))).not.toThrow();
      expect(() => summarizeRecruitmentDraftStoragePayload(undefined)).not.toThrow();
    });

    test("returns safe empty payload for malformed context", () => {
      const payload = createRecruitmentDraftStoragePayload("bad");

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW);
      expect(payload.executed).toBe(false);
      expect(payload.advisory).toBe(true);
      expect(isRecruitmentDraftStoragePayload(payload)).toBe(true);
    });

    test("returns safe empty payload for malformed review package", () => {
      const payload = createRecruitmentDraftStoragePayload({
        reviewPackage: { reviewStatus: "READY_FOR_REVIEW" },
        approvalDecision: {
          approvalStatus: RECRUITMENT_DRAFT_APPROVAL_STATUSES.APPROVED,
          approvedOperation: RECRUITMENT_DRAFT_APPROVED_OPERATIONS.CREATE_DRAFT_REQUEST,
          persistenceOperation: RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST,
          lifecycleEvent: "NOTIFICATION",
          confidence: RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH,
          reason: RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE,
          requiresHumanAction: false,
          reviewerRequired: false,
          advisory: true,
          architectureOnly: true,
          executed: false
        }
      });

      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW);
      expect(payload.lifecycleEvent).toBe("UNKNOWN");
    });

    test("summarizeRecruitmentDraftStoragePayload returns empty summary for invalid payload", () => {
      expect(summarizeRecruitmentDraftStoragePayload(null)).toBe(EMPTY_STORAGE_PAYLOAD_SUMMARY);
      expect(summarizeRecruitmentDraftStoragePayload({ storageAction: "CREATE_DRAFT_RECORD" })).toBe(
        EMPTY_STORAGE_PAYLOAD_SUMMARY
      );
    });
  });

  describe("deterministic output", () => {
    test("returns identical storage payload for identical context", () => {
      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const first = createRecruitmentDraftStoragePayload(context);
      const second = createRecruitmentDraftStoragePayload(context);
      const summaryA = summarizeRecruitmentDraftStoragePayload(first);
      const summaryB = summarizeRecruitmentDraftStoragePayload(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("immutability", () => {
    test("deep freezes storage payload output", () => {
      const payload = createRecruitmentDraftStoragePayload(
        buildStorageAdapterContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      assertAllFrozen(payload);
      expect(() => {
        payload.storageAction = RECRUITMENT_DRAFT_STORAGE_ACTIONS.NO_STORAGE_ACTION;
      }).toThrow();
      expect(() => {
        payload.draftMetadata.reviewStatus = RECRUITMENT_DRAFT_REVIEW_STATUSES.NO_ACTION;
      }).toThrow();
    });

    test("summarizeRecruitmentDraftStoragePayload returns frozen summary", () => {
      const payload = createRecruitmentDraftStoragePayload(
        buildStorageAdapterContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );
      const summary = summarizeRecruitmentDraftStoragePayload(payload);

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("input unchanged", () => {
    test("does not mutate storage adapter context or phase outputs", () => {
      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const before = JSON.stringify(context);
      const reviewBefore = JSON.stringify(context.reviewPackage);
      const approvalBefore = JSON.stringify(context.approvalDecision);

      createRecruitmentDraftStoragePayload(context);
      isRecruitmentDraftStoragePayload(createRecruitmentDraftStoragePayload(context));
      summarizeRecruitmentDraftStoragePayload(createRecruitmentDraftStoragePayload(context));

      expect(JSON.stringify(context)).toBe(before);
      expect(JSON.stringify(context.reviewPackage)).toBe(reviewBefore);
      expect(JSON.stringify(context.approvalDecision)).toBe(approvalBefore);
    });
  });

  describe("no generated identifiers or timestamps", () => {
    test("storage payload does not invent ids or timestamps", () => {
      const payload = createRecruitmentDraftStoragePayload(
        buildStorageAdapterContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      const serialized = JSON.stringify(payload);
      expect(serialized).not.toMatch(/"draftId"\s*:/);
      expect(serialized).not.toMatch(/"id"\s*:/);
      expect(serialized).not.toMatch(/"createdAt"\s*:/);
      expect(serialized).not.toMatch(/"updatedAt"\s*:/);
      expect(serialized).not.toMatch(/"timestamp"\s*:/);
      expect(payload).not.toHaveProperty("draftId");
      expect(payload).not.toHaveProperty("createdAt");
      expect(payload).not.toHaveProperty("updatedAt");
    });
  });

  describe("no coordinator invocation", () => {
    test("storage adapter does not invoke coordinator", () => {
      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      createRecruitmentDraftStoragePayload(context);
      summarizeRecruitmentDraftStoragePayload(createRecruitmentDraftStoragePayload(context));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 1810
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1810 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const context = buildStorageAdapterContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null,
        updateId: 1810
      });

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      createRecruitmentDraftStoragePayload(context);

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure storage adapter constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 118");
      expect(source).toContain("createRecruitmentDraftStoragePayload");
      expect(source).toContain("isRecruitmentDraftStoragePayload");
      expect(source).toContain("summarizeRecruitmentDraftStoragePayload");
      expect(source).toContain("RECRUITMENT_DRAFT_STORAGE_ACTIONS");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("storageAdapterOnly");
      expect(source).toContain("createsDrafts");
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

    test("module only imports Phase 114, 115, 116, and 117 modules", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentDraftProposalEngine")',
        'require("./recruitmentDraftPersistenceBoundary")',
        'require("./recruitmentDraftApprovalGate")',
        'require("./recruitmentDraftReviewPackageBuilder")'
      ]);
    });

    test("storage adapter is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentDraftStorageAdapter/);
      expect(gatewaySource).not.toMatch(/recruitmentDraftStorageAdapter/);
      expect(pipelineSource).not.toMatch(/recruitmentDraftStorageAdapter/);
      expect(workerSource).not.toMatch(/recruitmentDraftStorageAdapter/);
      expect(registrySource).not.toMatch(/recruitmentDraftStorageAdapter/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_DRAFT_STORAGE_ADAPTER_METADATA.pipelineWiring).toBe(false);
    });

    test("advisory flags are always true and executed is always false", () => {
      const payloads = [
        createRecruitmentDraftStoragePayload(
          buildStorageAdapterContext({ lifecycle: "NOTIFICATION", existingPageContext: null })
        ),
        createRecruitmentDraftStoragePayload(
          buildStorageAdapterContext({
            eventType: "admit_card",
            lifecycle: "ADMIT_CARD",
            existingPageContext: { exists: true, pageId: "ssc-cgl-2026" }
          })
        ),
        createRecruitmentDraftStoragePayload(null)
      ];

      for (let i = 0; i < payloads.length; i += 1) {
        expect(payloads[i].advisory).toBe(true);
        expect(payloads[i].architectureOnly).toBe(true);
        expect(payloads[i].executed).toBe(false);
        expect(payloads[i].persistenceEnabled).toBe(false);
      }
    });

    test("unapproved create review package holds instead of creating storage record", () => {
      const context = buildStorageAdapterContext(
        {
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        },
        {
          riskContext: { highRisk: true }
        }
      );

      const payload = createRecruitmentDraftStoragePayload(context);

      expect(context.reviewPackage.reviewStatus).toBe(
        RECRUITMENT_DRAFT_REVIEW_STATUSES.READY_FOR_REVIEW
      );
      expect(context.approvalDecision.approvalStatus).toBe(
        RECRUITMENT_DRAFT_APPROVAL_STATUSES.NEEDS_REVIEW
      );
      expect(payload.storageAction).toBe(RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW);
      expect(payload.entity).toBe(null);
    });
  });
});
