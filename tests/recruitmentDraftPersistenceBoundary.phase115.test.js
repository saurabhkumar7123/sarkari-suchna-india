"use strict";

/**
 * Phase 115 — Recruitment Draft Persistence Boundary tests.
 * CREATE/UPDATE/NO_ACTION/MANUAL_REVIEW conversions, missing proposal safety,
 * malformed input, payload correctness, no generated IDs, determinism,
 * immutability, input unchanged, and architecture boundaries.
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
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_PHASE,
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_ENTITY,
  RECRUITMENT_DRAFT_PERSISTENCE_ENTITY,
  RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS,
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_DESCRIPTOR,
  RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA,
  EMPTY_PERSISTENCE_REQUEST_SUMMARY,
  createRecruitmentDraftPersistenceRequest,
  isRecruitmentDraftPersistenceRequest,
  summarizeRecruitmentDraftPersistenceRequest
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
const MODULE_PATH = "server/lib/recruitment/recruitmentDraftPersistenceBoundary.js";
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
    updateId: 115,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-115-trace",
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
    updateId: overrides.updateId ?? 1501
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

function assertNoGeneratedIds(request) {
  const serialized = JSON.stringify(request);
  expect(serialized).not.toMatch(/"draftId"\s*:/);
  expect(serialized).not.toMatch(/"pageId"\s*:/);
  expect(serialized).not.toMatch(/"recruitmentId"\s*:/);
  expect(serialized).not.toMatch(/"generatedId"\s*:/);
  expect(request.payload).not.toHaveProperty("id");
  expect(request.payload).not.toHaveProperty("draftId");
  expect(request.payload).not.toHaveProperty("pageId");
  expect(request.payload).not.toHaveProperty("recruitmentId");
  expect(request).not.toHaveProperty("id");
  expect(request).not.toHaveProperty("draftId");
}

const EXPECTED_REQUEST_KEYS = Object.freeze([
  "operation",
  "entity",
  "proposalAction",
  "lifecycleEvent",
  "targetMode",
  "payload",
  "requiresApproval",
  "confidence",
  "reason",
  "persistenceEnabled",
  "executed",
  "advisory",
  "architectureOnly"
]);

const EXPECTED_PAYLOAD_KEYS = Object.freeze([
  "lifecycleEvent",
  "proposalType",
  "sourceIdentifier",
  "titleHint",
  "actionReason"
]);

describe("Phase 115 — recruitmentDraftPersistenceBoundary", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_PHASE).toBe(115);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_ENTITY).toBe(
        "recruitment_draft_persistence_boundary"
      );
      expect(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY).toBe("recruitment_draft");
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_DESCRIPTOR.phase).toBe(115);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.persistenceRequestOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST).toBe(
        "CREATE_DRAFT_REQUEST"
      );
      expect(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST).toBe(
        "UPDATE_DRAFT_REQUEST"
      );
      expect(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST).toBe(
        "NO_PERSISTENCE_REQUEST"
      );
      expect(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST).toBe(
        "MANUAL_REVIEW_REQUEST"
      );
    });
  });

  describe("CREATE_DRAFT proposal conversion", () => {
    test("converts CREATE_DRAFT proposal into CREATE_DRAFT_REQUEST", () => {
      const context = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      expect(context.draftProposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT);

      const request = createRecruitmentDraftPersistenceRequest(context);

      expect(Object.keys(request).sort()).toEqual([...EXPECTED_REQUEST_KEYS].sort());
      expect(request.operation).toBe(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST);
      expect(request.entity).toBe(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY);
      expect(request.proposalAction).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT);
      expect(request.lifecycleEvent).toBe("NOTIFICATION");
      expect(request.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_CREATE);
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE);
      expect(request.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
      expect(request.requiresApproval).toBe(true);
      expect(request.persistenceEnabled).toBe(false);
      expect(request.executed).toBe(false);
      expect(request.advisory).toBe(true);
      expect(request.architectureOnly).toBe(true);
      expect(isRecruitmentDraftPersistenceRequest(request)).toBe(true);
    });
  });

  describe("UPDATE_DRAFT proposal conversion", () => {
    test("converts UPDATE_DRAFT proposal into UPDATE_DRAFT_REQUEST", () => {
      const context = buildPersistenceContext({
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

      expect(context.draftProposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT);

      const request = createRecruitmentDraftPersistenceRequest(context);

      expect(request.operation).toBe(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.UPDATE_DRAFT_REQUEST);
      expect(request.entity).toBe(RECRUITMENT_DRAFT_PERSISTENCE_ENTITY);
      expect(request.proposalAction).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT);
      expect(request.lifecycleEvent).toBe("ADMIT_CARD");
      expect(request.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_UPDATE);
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.EXISTING_RECRUITMENT_UPDATE);
      expect(request.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
      expect(request.requiresApproval).toBe(true);
    });
  });

  describe("NO_ACTION conversion", () => {
    test("converts NO_ACTION proposal into NO_PERSISTENCE_REQUEST", () => {
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

      const request = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: { notice: notice() }
      });

      expect(request.operation).toBe(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST);
      expect(request.entity).toBeNull();
      expect(request.proposalAction).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION);
      expect(request.lifecycleEvent).toBe("COMPLETED");
      expect(request.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.NONE);
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.WORKFLOW_COMPLETED);
      expect(request.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE);
      expect(request.requiresApproval).toBe(false);
    });
  });

  describe("HUMAN_REVIEW conversion", () => {
    test("converts HUMAN_REVIEW_REQUIRED proposal into MANUAL_REVIEW_REQUEST", () => {
      const draftProposal = createRecruitmentDraftProposal({
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.NOT_READY },
        lifecycle: "NOTIFICATION"
      });

      const request = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: { notice: notice() }
      });

      expect(request.operation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(request.entity).toBeNull();
      expect(request.proposalAction).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED
      );
      expect(request.lifecycleEvent).toBe("NOTIFICATION");
      expect(request.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.MANUAL);
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY);
      expect(request.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.LOW);
      expect(request.requiresApproval).toBe(true);
    });
  });

  describe("missing proposal safety", () => {
    test("never throws for null or undefined context", () => {
      expect(() => createRecruitmentDraftPersistenceRequest(null)).not.toThrow();
      expect(() => createRecruitmentDraftPersistenceRequest(undefined)).not.toThrow();
      expect(() => isRecruitmentDraftPersistenceRequest(null)).not.toThrow();
      expect(() => summarizeRecruitmentDraftPersistenceRequest(undefined)).not.toThrow();
    });

    test("returns safe manual review request when draftProposal is missing", () => {
      const request = createRecruitmentDraftPersistenceRequest({
        sourceContext: { notice: notice() }
      });

      expect(request.operation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(request.proposalAction).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED
      );
      expect(request.lifecycleEvent).toBe("UNKNOWN");
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT);
      expect(request.requiresApproval).toBe(true);
      expect(request.persistenceEnabled).toBe(false);
      expect(request.executed).toBe(false);
      expect(request.advisory).toBe(true);
      expect(request.architectureOnly).toBe(true);
      expect(isRecruitmentDraftPersistenceRequest(request)).toBe(true);
    });

    test("summarizeRecruitmentDraftPersistenceRequest returns empty summary for invalid request", () => {
      expect(summarizeRecruitmentDraftPersistenceRequest(null)).toBe(
        EMPTY_PERSISTENCE_REQUEST_SUMMARY
      );
      expect(summarizeRecruitmentDraftPersistenceRequest({ operation: "CREATE_DRAFT_REQUEST" })).toBe(
        EMPTY_PERSISTENCE_REQUEST_SUMMARY
      );
    });
  });

  describe("malformed input", () => {
    test("never throws for malformed context values", () => {
      expect(() => createRecruitmentDraftPersistenceRequest("bad")).not.toThrow();
      expect(() => createRecruitmentDraftPersistenceRequest([])).not.toThrow();
      expect(() => createRecruitmentDraftPersistenceRequest(42)).not.toThrow();
      expect(() => isRecruitmentDraftPersistenceRequest(Symbol("x"))).not.toThrow();
    });

    test("returns manual review for non-object context", () => {
      const request = createRecruitmentDraftPersistenceRequest("bad");

      expect(request.operation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT);
    });

    test("returns manual review for malformed draftProposal", () => {
      const request = createRecruitmentDraftPersistenceRequest({
        draftProposal: {
          action: "CREATE_DRAFT",
          proposalType: "WRONG_TYPE"
        }
      });

      expect(request.operation).toBe(
        RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.MANUAL_REVIEW_REQUEST
      );
      expect(request.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT);
      expect(isRecruitmentDraftPersistenceRequest(request)).toBe(true);
    });
  });

  describe("payload correctness", () => {
    test("payload contains only safe descriptive fields from input", () => {
      const context = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const request = createRecruitmentDraftPersistenceRequest(context);

      expect(Object.keys(request.payload).sort()).toEqual([...EXPECTED_PAYLOAD_KEYS].sort());
      expect(request.payload.lifecycleEvent).toBe("NOTIFICATION");
      expect(request.payload.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT
      );
      expect(request.payload.sourceIdentifier).toBe(notice().url);
      expect(request.payload.titleHint).toBe(notice().title);
      expect(request.payload.actionReason).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE
      );
    });

    test("payload uses detectedUpdateContext title when sourceContext has no title", () => {
      const draftProposal = createRecruitmentDraftProposal(
        buildReadyAdvisoryContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      const request = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: {
          sourceIdentifier: "https://example.gov.in/notice.pdf"
        },
        detectedUpdateContext: {
          title: "Admit Card Released"
        }
      });

      expect(request.payload.sourceIdentifier).toBe("https://example.gov.in/notice.pdf");
      expect(request.payload.titleHint).toBe("Admit Card Released");
    });

    test("payload does not include SQL or database schema fields", () => {
      const request = createRecruitmentDraftPersistenceRequest(
        buildPersistenceContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      const serialized = JSON.stringify(request.payload);
      expect(serialized).not.toMatch(/INSERT INTO/i);
      expect(serialized).not.toMatch(/SELECT \*/i);
      expect(request.payload).not.toHaveProperty("tableName");
      expect(request.payload).not.toHaveProperty("columns");
      expect(request.payload).not.toHaveProperty("schema");
    });
  });

  describe("no generated IDs", () => {
    test("request and payload do not invent database or draft IDs", () => {
      const request = createRecruitmentDraftPersistenceRequest(
        buildPersistenceContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      assertNoGeneratedIds(request);
    });

    test("request does not generate timestamps unless provided in input", () => {
      const request = createRecruitmentDraftPersistenceRequest(
        buildPersistenceContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );

      expect(request.payload).not.toHaveProperty("createdAt");
      expect(request.payload).not.toHaveProperty("updatedAt");
      expect(request.payload).not.toHaveProperty("timestamp");
      expect(request).not.toHaveProperty("createdAt");
      expect(request).not.toHaveProperty("updatedAt");
    });
  });

  describe("deterministic output", () => {
    test("repeated calls return deeply equal results", () => {
      const context = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const first = createRecruitmentDraftPersistenceRequest(context);
      const second = createRecruitmentDraftPersistenceRequest(context);
      const summaryA = summarizeRecruitmentDraftPersistenceRequest(first);
      const summaryB = summarizeRecruitmentDraftPersistenceRequest(second);

      expect(second).toEqual(first);
      expect(summaryB).toEqual(summaryA);
    });
  });

  describe("deep immutability", () => {
    test("returns deeply frozen persistence request results", () => {
      const request = createRecruitmentDraftPersistenceRequest(
        buildPersistenceContext({
          lifecycle: "NOTIFICATION",
          existingPageContext: null
        })
      );
      const summary = summarizeRecruitmentDraftPersistenceRequest(request);

      assertAllFrozen(request);
      assertAllFrozen(summary);
      expect(() => {
        request.operation = RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.NO_PERSISTENCE_REQUEST;
      }).toThrow();
      expect(() => {
        request.payload.titleHint = "mutated";
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate persistence context input or embedded draft proposal", () => {
      const context = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const before = JSON.stringify(context);
      const proposalBefore = JSON.stringify(context.draftProposal);

      createRecruitmentDraftPersistenceRequest(context);
      isRecruitmentDraftPersistenceRequest(createRecruitmentDraftPersistenceRequest(context));
      summarizeRecruitmentDraftPersistenceRequest(
        createRecruitmentDraftPersistenceRequest(context)
      );

      expect(JSON.stringify(context)).toBe(before);
      expect(JSON.stringify(context.draftProposal)).toBe(proposalBefore);
      expect(context).not.toHaveProperty("persistenceRequest");
    });
  });

  describe("no coordinator invocation", () => {
    test("persistence boundary does not invoke coordinator", () => {
      const context = buildPersistenceContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      createRecruitmentDraftPersistenceRequest(context);
      summarizeRecruitmentDraftPersistenceRequest(
        createRecruitmentDraftPersistenceRequest(context)
      );

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 1510
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1510 }));
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
      const context = {
        draftProposal,
        sourceContext: { notice: notice() }
      };

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      createRecruitmentDraftPersistenceRequest(context);

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure persistence boundary constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 115");
      expect(source).toContain("createRecruitmentDraftPersistenceRequest");
      expect(source).toContain("isRecruitmentDraftPersistenceRequest");
      expect(source).toContain("summarizeRecruitmentDraftPersistenceRequest");
      expect(source).toContain("RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("persistenceRequestOnly");
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

    test("module only imports Phase 114 draft proposal engine", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([
        'require("./recruitmentDraftProposalEngine")'
      ]);
    });

    test("persistence boundary is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentDraftPersistenceBoundary/);
      expect(gatewaySource).not.toMatch(/recruitmentDraftPersistenceBoundary/);
      expect(pipelineSource).not.toMatch(/recruitmentDraftPersistenceBoundary/);
      expect(workerSource).not.toMatch(/recruitmentDraftPersistenceBoundary/);
      expect(registrySource).not.toMatch(/recruitmentDraftPersistenceBoundary/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_DRAFT_PERSISTENCE_BOUNDARY_METADATA.pipelineWiring).toBe(false);
    });

    test("consumes Phase 114 proposal output without re-deriving advisory decisions", () => {
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

      const request = createRecruitmentDraftPersistenceRequest({
        draftProposal,
        sourceContext: {
          sourceIdentifier: "https://custom.example/notice",
          titleHint: "Custom Notice"
        }
      });

      expect(request.operation).toBe(RECRUITMENT_DRAFT_PERSISTENCE_OPERATIONS.CREATE_DRAFT_REQUEST);
      expect(request.proposalAction).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT);
      expect(request.payload.sourceIdentifier).toBe("https://custom.example/notice");
      expect(request.payload.titleHint).toBe("Custom Notice");
    });
  });
});
