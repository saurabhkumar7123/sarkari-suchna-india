"use strict";

/**
 * Phase 114 — Recruitment Draft Proposal Engine tests.
 * Ready notification draft proposal, existing recruitment update, completed workflow,
 * unknown lifecycle, rollout not ready, missing input, malformed context, determinism,
 * immutability, no side effects, and architecture boundaries.
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
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_PHASE,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY,
  RECRUITMENT_DRAFT_PROPOSAL_ACTIONS,
  RECRUITMENT_DRAFT_PROPOSAL_TYPES,
  RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES,
  RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE,
  RECRUITMENT_DRAFT_PROPOSAL_REASONS,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_DESCRIPTOR,
  RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA,
  EMPTY_DRAFT_PROPOSAL_SUMMARY,
  createRecruitmentDraftProposal,
  isRecruitmentDraftProposal,
  summarizeRecruitmentDraftProposal
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
const MODULE_PATH = "server/lib/recruitment/recruitmentDraftProposalEngine.js";
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
    updateId: 114,
    featureFlags: { workflowIntegrationEnabled: true },
    traceId: "phase-114-trace",
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
    updateId: overrides.updateId ?? 1401
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

const EXPECTED_PROPOSAL_KEYS = Object.freeze([
  "action",
  "proposalType",
  "lifecycleEvent",
  "confidence",
  "reason",
  "requiresHumanReview",
  "targetMode",
  "source",
  "advisory",
  "architectureOnly",
  "executed"
]);

describe("Phase 114 — recruitmentDraftProposalEngine", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_PHASE).toBe(114);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY).toBe("recruitment_draft_proposal_engine");
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_DESCRIPTOR.phase).toBe(114);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.draftProposalOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.invokesCoordinator).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.pipelineWiring).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT).toBe("CREATE_DRAFT");
      expect(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT).toBe("UPDATE_DRAFT");
      expect(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED).toBe("HUMAN_REVIEW_REQUIRED");
      expect(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION).toBe("NO_ACTION");
    });
  });

  describe("ready notification creates draft proposal", () => {
    test("proposes CREATE_DRAFT for ready rollout and notification without existing page", () => {
      const context = buildReadyAdvisoryContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      expect(context.rolloutReadiness.status).toBe(ROLLOUT_READINESS_STATUS.READY);

      const proposal = createRecruitmentDraftProposal(context);

      expect(Object.keys(proposal).sort()).toEqual([...EXPECTED_PROPOSAL_KEYS].sort());
      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.CREATE_DRAFT);
      expect(proposal.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.NEW_RECRUITMENT_DRAFT);
      expect(proposal.lifecycleEvent).toBe("NOTIFICATION");
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.NOTIFICATION_WITHOUT_PAGE);
      expect(proposal.requiresHumanReview).toBe(false);
      expect(proposal.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_CREATE);
      expect(proposal.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
      expect(proposal.source).toBe(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_ENTITY);
      expect(proposal.advisory).toBe(true);
      expect(proposal.architectureOnly).toBe(true);
      expect(proposal.executed).toBe(false);
      expect(isRecruitmentDraftProposal(proposal)).toBe(true);
    });
  });

  describe("existing recruitment update proposal", () => {
    test("proposes UPDATE_DRAFT when lifecycle event and existing page context are present", () => {
      const context = buildReadyAdvisoryContext({
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

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT);
      expect(proposal.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.RECRUITMENT_LIFECYCLE_UPDATE
      );
      expect(proposal.lifecycleEvent).toBe("ADMIT_CARD");
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.EXISTING_RECRUITMENT_UPDATE);
      expect(proposal.requiresHumanReview).toBe(false);
      expect(proposal.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.DRAFT_UPDATE);
      expect(proposal.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.HIGH);
    });

    test("proposes UPDATE_DRAFT for notification when an existing page is already present", () => {
      const context = buildReadyAdvisoryContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: { slug: "ssc-cgl-2026-notification" }
      });

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.UPDATE_DRAFT);
      expect(proposal.proposalType).toBe(
        RECRUITMENT_DRAFT_PROPOSAL_TYPES.RECRUITMENT_LIFECYCLE_UPDATE
      );
    });
  });

  describe("completed workflow no action", () => {
    test("proposes NO_ACTION when workflow is completed and rollout is ready", () => {
      const context = {
        rolloutReadiness: {
          status: ROLLOUT_READINESS_STATUS.READY,
          lifecycle: "COMPLETED"
        },
        health: {
          lifecycle: "COMPLETED",
          workflowCompleted: true,
          advisory: true,
          architectureOnly: true,
          executed: false
        },
        lifecycle: "COMPLETED"
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION);
      expect(proposal.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.NONE);
      expect(proposal.lifecycleEvent).toBe("COMPLETED");
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.WORKFLOW_COMPLETED);
      expect(proposal.requiresHumanReview).toBe(false);
      expect(proposal.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.NONE);
      expect(proposal.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.NONE);
    });

    test("proposes NO_ACTION when gateway recommendation reports workflowCompleted", () => {
      const context = {
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.READY },
        workflowGateway: {
          recommendation: {
            lifecycle: "JOINING",
            workflowCompleted: true
          }
        },
        health: { lifecycle: "JOINING", workflowCompleted: true }
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION);
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.WORKFLOW_COMPLETED);
    });
  });

  describe("unknown lifecycle manual review", () => {
    test("proposes HUMAN_REVIEW_REQUIRED when lifecycle cannot be resolved", () => {
      const context = {
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.READY },
        health: { lifecycle: "UNKNOWN" },
        lifecycle: "UNKNOWN"
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW);
      expect(proposal.lifecycleEvent).toBe("UNKNOWN");
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.LIFECYCLE_UNKNOWN);
      expect(proposal.requiresHumanReview).toBe(true);
      expect(proposal.targetMode).toBe(RECRUITMENT_DRAFT_PROPOSAL_TARGET_MODES.MANUAL);
      expect(proposal.confidence).toBe(RECRUITMENT_DRAFT_PROPOSAL_CONFIDENCE.LOW);
    });
  });

  describe("rollout not ready manual review", () => {
    test("proposes HUMAN_REVIEW_REQUIRED when rollout readiness is NOT_READY", () => {
      const context = {
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.NOT_READY },
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW);
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY);
      expect(proposal.requiresHumanReview).toBe(true);
    });

    test("proposes HUMAN_REVIEW_REQUIRED when rollout readiness is UNKNOWN", () => {
      const context = {
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.UNKNOWN },
        lifecycle: "NOTIFICATION"
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY);
      expect(proposal.requiresHumanReview).toBe(true);
    });

    test("rollout not ready takes precedence over completed workflow", () => {
      const context = {
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.NOT_READY },
        lifecycle: "COMPLETED",
        health: { workflowCompleted: true, lifecycle: "COMPLETED" }
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.ROLLOUT_NOT_READY);
    });
  });

  describe("missing input safety", () => {
    test("never throws for null or undefined context", () => {
      expect(() => createRecruitmentDraftProposal(null)).not.toThrow();
      expect(() => createRecruitmentDraftProposal(undefined)).not.toThrow();
      expect(() => isRecruitmentDraftProposal(null)).not.toThrow();
      expect(() => summarizeRecruitmentDraftProposal(undefined)).not.toThrow();
    });

    test("returns safe manual review defaults for missing context", () => {
      const proposal = createRecruitmentDraftProposal(null);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.proposalType).toBe(RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW);
      expect(proposal.lifecycleEvent).toBe("UNKNOWN");
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT);
      expect(proposal.requiresHumanReview).toBe(true);
      expect(proposal.advisory).toBe(true);
      expect(proposal.architectureOnly).toBe(true);
      expect(proposal.executed).toBe(false);
      expect(isRecruitmentDraftProposal(proposal)).toBe(true);
    });

    test("summarizeRecruitmentDraftProposal returns empty summary for invalid proposal", () => {
      expect(summarizeRecruitmentDraftProposal(null)).toBe(EMPTY_DRAFT_PROPOSAL_SUMMARY);
      expect(summarizeRecruitmentDraftProposal({ action: "CREATE_DRAFT" })).toBe(
        EMPTY_DRAFT_PROPOSAL_SUMMARY
      );
    });
  });

  describe("malformed context", () => {
    test("never throws for malformed context values", () => {
      expect(() => createRecruitmentDraftProposal("bad")).not.toThrow();
      expect(() => createRecruitmentDraftProposal([])).not.toThrow();
      expect(() => createRecruitmentDraftProposal(42)).not.toThrow();
      expect(() => isRecruitmentDraftProposal(Symbol("x"))).not.toThrow();
    });

    test("returns manual review for non-object context", () => {
      const proposal = createRecruitmentDraftProposal("bad");

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.INVALID_INPUT);
    });

    test("returns insufficient context when rollout is ready but page is missing for non-notification events", () => {
      const context = {
        rolloutReadiness: { status: ROLLOUT_READINESS_STATUS.READY },
        lifecycle: "ADMIT_CARD",
        existingPageContext: null
      };

      const proposal = createRecruitmentDraftProposal(context);

      expect(proposal.action).toBe(RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.HUMAN_REVIEW_REQUIRED);
      expect(proposal.reason).toBe(RECRUITMENT_DRAFT_PROPOSAL_REASONS.INSUFFICIENT_CONTEXT);
      expect(proposal.lifecycleEvent).toBe("ADMIT_CARD");
    });
  });

  describe("deterministic output", () => {
    test("repeated calls return deeply equal results", () => {
      const context = buildReadyAdvisoryContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const first = createRecruitmentDraftProposal(context);
      const second = createRecruitmentDraftProposal(context);
      const summaryA = summarizeRecruitmentDraftProposal(first);
      const summaryB = summarizeRecruitmentDraftProposal(second);

      expect(second).toEqual(first);
      expect(summaryB).toEqual(summaryA);
    });
  });

  describe("deep immutability", () => {
    test("returns deeply frozen proposal results", () => {
      const context = buildReadyAdvisoryContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });

      const proposal = createRecruitmentDraftProposal(context);
      const summary = summarizeRecruitmentDraftProposal(proposal);

      assertAllFrozen(proposal);
      assertAllFrozen(summary);
      expect(() => {
        proposal.action = RECRUITMENT_DRAFT_PROPOSAL_ACTIONS.NO_ACTION;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate advisory context input", () => {
      const context = buildReadyAdvisoryContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      const before = JSON.stringify(context);

      createRecruitmentDraftProposal(context);
      isRecruitmentDraftProposal(createRecruitmentDraftProposal(context));
      summarizeRecruitmentDraftProposal(createRecruitmentDraftProposal(context));

      expect(JSON.stringify(context)).toBe(before);
      expect(context).not.toHaveProperty("draftProposal");
    });
  });

  describe("no coordinator invocation", () => {
    test("draft proposal engine does not invoke coordinator", () => {
      const context = buildReadyAdvisoryContext({
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      });
      coordinateRecruitmentWorkflowIntegration.mockClear();

      createRecruitmentDraftProposal(context);
      summarizeRecruitmentDraftProposal(createRecruitmentDraftProposal(context));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("no attachment side effects", () => {
    test("does not alter pipeline integration, registry, or diagnostics state", () => {
      const outcome = {
        skipped: false,
        result: mockProcessorResult("notification"),
        updateId: 1410
      };
      attachIntegratedContract(outcome, enabledInput({ updateId: 1410 }));
      attachRecruitmentWorkflowDiagnostics(outcome);

      const workflowGateway = getRecruitmentWorkflowAdvisoryGateway(outcome);
      const context = {
        workflowGateway,
        observation: workflowGateway.observation,
        health: workflowGateway.health,
        rolloutReadiness: workflowGateway.rolloutReadiness,
        lifecycle: "NOTIFICATION",
        existingPageContext: null
      };

      const pipelineBefore = peekRecruitmentWorkflowIntegration(outcome);
      const registryBefore = peekWorkflowObservation(outcome);
      const diagnosticsBefore = peekRecruitmentWorkflowDiagnostics(outcome);
      const hookBefore = peekRecruitmentWorkflowObservationContractIntegration(outcome);

      createRecruitmentDraftProposal(context);

      expect(peekRecruitmentWorkflowIntegration(outcome)).toBe(pipelineBefore);
      expect(peekWorkflowObservation(outcome)).toBe(registryBefore);
      expect(peekRecruitmentWorkflowDiagnostics(outcome)).toBe(diagnosticsBefore);
      expect(peekRecruitmentWorkflowObservationContractIntegration(outcome)).toBe(hookBefore);
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure draft proposal constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 114");
      expect(source).toContain("createRecruitmentDraftProposal");
      expect(source).toContain("isRecruitmentDraftProposal");
      expect(source).toContain("summarizeRecruitmentDraftProposal");
      expect(source).toContain("RECRUITMENT_DRAFT_PROPOSAL_ACTIONS");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("draftProposalOnly");
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

    test("module has no recruitment module imports and performs no database access", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual([]);
      expect(source).not.toMatch(/repository/i);
      expect(source).not.toMatch(/queriesDatabase:\s*true/);
      expect(source).not.toMatch(/\b(INSERT INTO|DELETE FROM|SELECT \*|mysql2)\b/i);
    });

    test("draft proposal engine is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/recruitmentDraftProposalEngine/);
      expect(gatewaySource).not.toMatch(/recruitmentDraftProposalEngine/);
      expect(pipelineSource).not.toMatch(/recruitmentDraftProposalEngine/);
      expect(workerSource).not.toMatch(/recruitmentDraftProposalEngine/);
      expect(registrySource).not.toMatch(/recruitmentDraftProposalEngine/);
    });

    test("metadata declares no persistence, draft creation, or production mutation", () => {
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.createsDrafts).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.publishesPages).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_DRAFT_PROPOSAL_ENGINE_METADATA.pipelineWiring).toBe(false);
    });
  });
});
