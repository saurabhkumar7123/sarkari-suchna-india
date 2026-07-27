"use strict";

/**
 * Phase 119 — Recruitment Draft Repository Contract tests.
 * CREATE/UPDATE/REVIEW_REQUIRED/NO_ACTION mappings, invalid/missing payload,
 * malformed input, determinism, immutability, and architecture boundaries.
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
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_PHASE,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_ENTITY,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_VERSION,
  RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_DESCRIPTOR,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA,
  DEFAULT_TARGET_PRIMARY_TABLE,
  DEFAULT_TARGET_RELATED_TABLES,
  EMPTY_REPOSITORY_CONTRACT_SUMMARY,
  createRecruitmentDraftRepositoryContract,
  isRecruitmentDraftRepositoryContract,
  summarizeRecruitmentDraftRepositoryContract
} = require("../server/lib/recruitment/recruitmentDraftRepositoryContract");

const {
  RECRUITMENT_DRAFT_STORAGE_ACTIONS,
  createRecruitmentDraftStoragePayload
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
const MODULE_PATH = "server/lib/recruitment/recruitmentDraftRepositoryContract.js";
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
    updateId: 119,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-119-trace",
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
    updateId: overrides.updateId ?? 1901
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

function buildRepositoryContractContext(advisoryOverrides = {}, contextOverrides = {}) {
  const storageAdapterContext = buildStorageAdapterContext(advisoryOverrides, contextOverrides);
  const storagePayload = createRecruitmentDraftStoragePayload(storageAdapterContext);

  return {
    storagePayload,
    sourceContext: storageAdapterContext.sourceContext,
    repositoryHints: contextOverrides.repositoryHints ?? null,
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

const EXPECTED_CONTRACT_KEYS = Object.freeze([
  "contractVersion",
  "operation",
  "entity",
  "draftMapping",
  "repositoryIntent",
  "targetHints",
  "persistenceEnabled",
  "executed",
  "advisory",
  "architectureOnly"
]);

describe("Phase 119 — recruitmentDraftRepositoryContract", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_PHASE).toBe(119);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_ENTITY).toBe(
        "recruitment_draft_repository_contract"
      );
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_DESCRIPTOR.phase).toBe(119);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.repositoryContractOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.CREATE).toBe("CREATE");
      expect(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.UPDATE).toBe("UPDATE");
      expect(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED).toBe("REVIEW_REQUIRED");
      expect(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.NO_ACTION).toBe("NO_ACTION");
      expect(DEFAULT_TARGET_PRIMARY_TABLE).toBe("generator_drafts");
      expect(DEFAULT_TARGET_RELATED_TABLES).toEqual(["content_imports", "pages"]);
    });
  });

  describe("CREATE_DRAFT_RECORD mapping", () => {
    test("maps CREATE_DRAFT_RECORD storage payload to CREATE repository contract", () => {
      const context = buildRepositoryContractContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const contract = createRecruitmentDraftRepositoryContract(context);

      expect(Object.keys(contract).sort()).toEqual([...EXPECTED_CONTRACT_KEYS].sort());
      expect(contract.contractVersion).toBe("1.0.0");
      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.CREATE);
      expect(contract.entity).toBe(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY);
      expect(contract.draftMapping.lifecycleEvent).toBe("NOTIFICATION");
      expect(contract.draftMapping.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT
      );
      expect(contract.draftMapping.titleHint).toBe(notice().title);
      expect(contract.draftMapping.sourceIdentifier).toBe(notice().url);
      expect(contract.repositoryIntent.createAllowed).toBe(true);
      expect(contract.repositoryIntent.updateAllowed).toBe(false);
      expect(contract.repositoryIntent.requiresHumanApproval).toBe(true);
      expect(contract.targetHints.primaryTable).toBe("generator_drafts");
      expect(contract.targetHints.relatedTables).toEqual(["content_imports", "pages"]);
      expect(contract.persistenceEnabled).toBe(false);
      expect(contract.executed).toBe(false);
      expect(contract.advisory).toBe(true);
      expect(contract.architectureOnly).toBe(true);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
    });
  });

  describe("UPDATE_DRAFT_RECORD mapping", () => {
    test("maps UPDATE_DRAFT_RECORD storage payload to UPDATE repository contract", () => {
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
      const storagePayload = createRecruitmentDraftStoragePayload({
        reviewPackage,
        approvalDecision,
        sourceContext: reviewContext.sourceContext,
        detectedUpdateContext: reviewContext.detectedUpdateContext
      });

      const contract = createRecruitmentDraftRepositoryContract({
        storagePayload,
        sourceContext: reviewContext.sourceContext
      });

      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.UPDATE);
      expect(contract.entity).toBe(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY);
      expect(contract.draftMapping.lifecycleEvent).toBe("ADMIT_CARD");
      expect(contract.draftMapping.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.RECRUITMENT_LIFECYCLE_UPDATE
      );
      expect(contract.repositoryIntent.createAllowed).toBe(false);
      expect(contract.repositoryIntent.updateAllowed).toBe(true);
      expect(contract.targetHints.primaryTable).toBe("generator_drafts");
      expect(contract.targetHints.relatedTables).toEqual(["content_imports", "pages"]);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
    });
  });

  describe("HOLD_FOR_REVIEW mapping", () => {
    test("maps HOLD_FOR_REVIEW storage payload to REVIEW_REQUIRED repository contract", () => {
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
      const storagePayload = createRecruitmentDraftStoragePayload({
        reviewPackage,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      const contract = createRecruitmentDraftRepositoryContract({ storagePayload });

      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED);
      expect(contract.entity).toBe(null);
      expect(contract.repositoryIntent.createAllowed).toBe(false);
      expect(contract.repositoryIntent.updateAllowed).toBe(false);
      expect(contract.repositoryIntent.requiresHumanApproval).toBe(true);
      expect(contract.targetHints.primaryTable).toBe(null);
      expect(contract.targetHints.relatedTables).toEqual([]);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
    });
  });

  describe("NO_STORAGE_ACTION mapping", () => {
    test("maps NO_STORAGE_ACTION storage payload to NO_ACTION repository contract", () => {
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
      const storagePayload = createRecruitmentDraftStoragePayload({
        reviewPackage,
        approvalDecision,
        sourceContext: { notice: notice() }
      });

      const contract = createRecruitmentDraftRepositoryContract({ storagePayload });

      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.NO_ACTION);
      expect(contract.entity).toBe(null);
      expect(contract.draftMapping.lifecycleEvent).toBe("COMPLETED");
      expect(contract.repositoryIntent.createAllowed).toBe(false);
      expect(contract.repositoryIntent.updateAllowed).toBe(false);
      expect(contract.repositoryIntent.requiresHumanApproval).toBe(false);
      expect(contract.targetHints.primaryTable).toBe(null);
      expect(contract.targetHints.relatedTables).toEqual([]);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
    });
  });

  describe("invalid payload", () => {
    test("returns frozen safe contract for invalid storage payload", () => {
      const contract = createRecruitmentDraftRepositoryContract({
        storagePayload: {
          storageAction: RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD,
          lifecycleEvent: "NOTIFICATION"
        }
      });

      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED);
      expect(contract.entity).toBe(null);
      expect(contract.draftMapping.lifecycleEvent).toBe("UNKNOWN");
      expect(contract.draftMapping.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW
      );
      expect(contract.repositoryIntent.requiresHumanApproval).toBe(true);
      expect(contract.targetHints.primaryTable).toBe(null);
      expect(contract.executed).toBe(false);
      expect(contract.advisory).toBe(true);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
      expect(Object.isFrozen(contract)).toBe(true);
    });
  });

  describe("missing payload", () => {
    test("returns safe contract when storage payload is missing", () => {
      const context = buildRepositoryContractContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      delete context.storagePayload;

      const contract = createRecruitmentDraftRepositoryContract(context);

      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED);
      expect(contract.entity).toBe(null);
      expect(contract.draftMapping.lifecycleEvent).toBe("UNKNOWN");
      expect(contract.draftMapping.titleHint).toBe(null);
      expect(contract.draftMapping.sourceIdentifier).toBe(null);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
    });
  });

  describe("malformed input", () => {
    test("never throws for null, undefined, or non-object context", () => {
      expect(() => createRecruitmentDraftRepositoryContract(null)).not.toThrow();
      expect(() => createRecruitmentDraftRepositoryContract(undefined)).not.toThrow();
      expect(() => createRecruitmentDraftRepositoryContract("bad")).not.toThrow();
      expect(() => createRecruitmentDraftRepositoryContract([])).not.toThrow();
      expect(() => createRecruitmentDraftRepositoryContract(42)).not.toThrow();
      expect(() => isRecruitmentDraftRepositoryContract(Symbol("x"))).not.toThrow();
      expect(() => summarizeRecruitmentDraftRepositoryContract(undefined)).not.toThrow();
    });

    test("returns safe contract for malformed context", () => {
      const contract = createRecruitmentDraftRepositoryContract("bad");

      expect(contract.operation).toBe(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED);
      expect(contract.executed).toBe(false);
      expect(contract.advisory).toBe(true);
      expect(isRecruitmentDraftRepositoryContract(contract)).toBe(true);
    });

    test("summarizeRecruitmentDraftRepositoryContract returns empty summary for invalid contract", () => {
      expect(summarizeRecruitmentDraftRepositoryContract(null)).toBe(
        EMPTY_REPOSITORY_CONTRACT_SUMMARY
      );
      expect(
        summarizeRecruitmentDraftRepositoryContract({ operation: "CREATE" })
      ).toBe(EMPTY_REPOSITORY_CONTRACT_SUMMARY);
    });
  });

  describe("deterministic output", () => {
    test("returns identical repository contract for identical context", () => {
      const context = buildRepositoryContractContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const first = createRecruitmentDraftRepositoryContract(context);
      const second = createRecruitmentDraftRepositoryContract(context);
      const summaryA = summarizeRecruitmentDraftRepositoryContract(first);
      const summaryB = summarizeRecruitmentDraftRepositoryContract(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes repository contract output", () => {
      const contract = createRecruitmentDraftRepositoryContract(
        buildRepositoryContractContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      assertAllFrozen(contract);
      expect(() => {
        contract.operation = RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.NO_ACTION;
      }).toThrow();
      expect(() => {
        contract.draftMapping.lifecycleEvent = "CHANGED";
      }).toThrow();
      expect(() => {
        contract.targetHints.relatedTables.push("other");
      }).toThrow();
    });

    test("summarizeRecruitmentDraftRepositoryContract returns frozen summary", () => {
      const contract = createRecruitmentDraftRepositoryContract(
        buildRepositoryContractContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );
      const summary = summarizeRecruitmentDraftRepositoryContract(contract);

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("input unchanged", () => {
    test("does not mutate repository contract context or storage payload", () => {
      const context = buildRepositoryContractContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const before = JSON.stringify(context);
      const payloadBefore = JSON.stringify(context.storagePayload);

      createRecruitmentDraftRepositoryContract(context);
      isRecruitmentDraftRepositoryContract(createRecruitmentDraftRepositoryContract(context));
      summarizeRecruitmentDraftRepositoryContract(
        createRecruitmentDraftRepositoryContract(context)
      );

      expect(JSON.stringify(context)).toBe(before);
      expect(JSON.stringify(context.storagePayload)).toBe(payloadBefore);
    });
  });

  describe("no generated identifiers or timestamps", () => {
    test("repository contract does not invent ids or timestamps", () => {
      const contract = createRecruitmentDraftRepositoryContract(
        buildRepositoryContractContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      const serialized = JSON.stringify(contract);
      expect(serialized).not.toMatch(/"draftId"\s*:/);
      expect(serialized).not.toMatch(/"id"\s*:/);
      expect(serialized).not.toMatch(/"createdAt"\s*:/);
      expect(serialized).not.toMatch(/"updatedAt"\s*:/);
      expect(serialized).not.toMatch(/"timestamp"\s*:/);
      expect(contract).not.toHaveProperty("draftId");
      expect(contract).not.toHaveProperty("createdAt");
      expect(contract).not.toHaveProperty("updatedAt");
    });
  });

  describe("no coordinator invocation", () => {
    test("repository contract does not invoke coordinator", () => {
      const context = buildRepositoryContractContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      createRecruitmentDraftRepositoryContract(context);
      summarizeRecruitmentDraftRepositoryContract(
        createRecruitmentDraftRepositoryContract(context)
      );

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 1910
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1910 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const context = buildRepositoryContractContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null,
        updateId: 1910
      });

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      createRecruitmentDraftRepositoryContract(context);

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure repository contract constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 119");
      expect(source).toContain("createRecruitmentDraftRepositoryContract");
      expect(source).toContain("isRecruitmentDraftRepositoryContract");
      expect(source).toContain("summarizeRecruitmentDraftRepositoryContract");
      expect(source).toContain("RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("repositoryContractOnly");
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

    test("module has no repository implementation imports and performs no database access", () => {
      const source = read(MODULE_PATH);

      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/persistenceRepositoryContracts/);
      expect(source).not.toMatch(/queriesDatabase:\s*true/);
      expect(source).not.toMatch(/\b(INSERT INTO|DELETE FROM|SELECT \*|mysql2)\b/i);
    });

    test("module only imports Phase 114, 115, and 118 modules", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentDraftProposalEngine")',
        'require("./recruitmentDraftPersistenceBoundary")',
        'require("./recruitmentDraftStorageAdapter")'
      ]);
    });

    test("repository contract is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentDraftRepositoryContract/);
      expect(gatewaySource).not.toMatch(/recruitmentDraftRepositoryContract/);
      expect(pipelineSource).not.toMatch(/recruitmentDraftRepositoryContract/);
      expect(workerSource).not.toMatch(/recruitmentDraftRepositoryContract/);
      expect(registrySource).not.toMatch(/recruitmentDraftRepositoryContract/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA.pipelineWiring).toBe(false);
    });

    test("advisory flags are always true and executed is always false", () => {
      const contracts = [
        createRecruitmentDraftRepositoryContract(
          buildRepositoryContractContext({ lifecycle: "NOTIFICATION", existingPageContext: null })
        ),
        createRecruitmentDraftRepositoryContract(
          buildRepositoryContractContext({
            eventType: "admit_card",
            lifecycle: "ADMIT_CARD",
            existingPageContext: { exists: true, pageId: "ssc-cgl-2026" }
          })
        ),
        createRecruitmentDraftRepositoryContract(null)
      ];

      for (let i = 0; i < contracts.length; i += 1) {
        expect(contracts[i].advisory).toBe(true);
        expect(contracts[i].architectureOnly).toBe(true);
        expect(contracts[i].executed).toBe(false);
        expect(contracts[i].persistenceEnabled).toBe(false);
      }
    });

    test("repository hints override future target table intent for create/update", () => {
      const contract = createRecruitmentDraftRepositoryContract(
        buildRepositoryContractContext(
          { lifecycle: "NOTIFICATION", existingPageContext: null },
          {
            repositoryHints: {
              primaryTable: "custom_drafts",
              relatedTables: ["custom_imports"]
            }
          }
        )
      );

      expect(contract.targetHints.primaryTable).toBe("custom_drafts");
      expect(contract.targetHints.relatedTables).toEqual(["custom_imports"]);
    });
  });
});
