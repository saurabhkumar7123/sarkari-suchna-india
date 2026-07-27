"use strict";

/**
 * Phase 121 — Workflow Decision Trace Model tests.
 * Empty input, blocked workflow, waiting approval, storage ready,
 * reasoning chain, trace entries, metadata, determinism, immutability,
 * and architecture boundaries.
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
  RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE,
  RECRUITMENT_WORKFLOW_DECISION_TRACE_ENTITY,
  WORKFLOW_DECISION_REASONING_RESULTS,
  WORKFLOW_DECISION_EVALUATION_STEPS,
  RECRUITMENT_WORKFLOW_DECISION_TRACE_DESCRIPTOR,
  RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA,
  EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY,
  createWorkflowDecisionTrace,
  isWorkflowDecisionTrace,
  summarizeWorkflowDecisionTrace
} = require("../server/lib/recruitment/workflowDecisionTraceModel");

const {
  RECRUITMENT_WORKFLOW_STATES,
  RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS,
  RECRUITMENT_WORKFLOW_BLOCKED_REASONS,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const { coordinateRecruitmentWorkflowIntegration } = require(
  "../server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator"
);

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_TRACE_KEYS = Object.freeze([
  "decisionSummary",
  "reasoningChain",
  "traceEntries",
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

function buildWaitingApprovalEvaluation(overrides = {}) {
  return {
    workflowState: RECRUITMENT_WORKFLOW_STATES.WAITING_FOR_APPROVAL,
    nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_APPROVAL_DECISION,
    blockedReasons: [],
    evaluationSteps: [
      {
        step: "REVIEW_PACKAGE_CHECK",
        result: "PASS",
        explanation: "Review package available"
      },
      {
        step: "APPROVAL_CHECK",
        result: "PENDING",
        explanation: "Approval decision required"
      }
    ],
    sourceSignals: [
      {
        source: "approvalState",
        observation: "pending",
        impact: "workflow paused"
      }
    ],
    ...overrides
  };
}

describe("Phase 121 — workflowDecisionTraceModel", () => {
  beforeEach(() => {
    coordinateRecruitmentWorkflowIntegration.mockClear();
  });

  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_PHASE).toBe(121);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_ENTITY).toBe("workflow_decision_trace");
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_DESCRIPTOR.phase).toBe(121);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.decisionTraceOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.readOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.auditStorage).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.loggingIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.persistent).toBe(false);
      expect(WORKFLOW_DECISION_REASONING_RESULTS.PASS).toBe("PASS");
      expect(WORKFLOW_DECISION_EVALUATION_STEPS.APPROVAL_CHECK).toBe("APPROVAL_CHECK");
    });
  });

  describe("empty input", () => {
    test("returns safe empty trace for null, undefined, or non-object input", () => {
      const nullResult = createWorkflowDecisionTrace(null);
      const undefinedResult = createWorkflowDecisionTrace(undefined);
      const stringResult = createWorkflowDecisionTrace("invalid");

      expect(Object.keys(nullResult).sort()).toEqual([...EXPECTED_TRACE_KEYS].sort());
      expect(nullResult.decisionSummary).toBe(EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY.decisionSummary);
      expect(nullResult.reasoningChain).toEqual([]);
      expect(nullResult.traceEntries).toEqual([]);
      expect(undefinedResult).toEqual(nullResult);
      expect(stringResult).toEqual(nullResult);
      expect(isWorkflowDecisionTrace(nullResult)).toBe(true);
      expect(summarizeWorkflowDecisionTrace(nullResult).reasoningStepCount).toBe(0);
    });

    test("returns context-missing summary for empty object", () => {
      const result = createWorkflowDecisionTrace({});

      expect(result.decisionSummary).toBe(EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY.decisionSummary);
      expect(result.reasoningChain).toEqual([
        expect.objectContaining({
          step: WORKFLOW_DECISION_EVALUATION_STEPS.CONTEXT_VALIDATION,
          result: WORKFLOW_DECISION_REASONING_RESULTS.FAIL
        })
      ]);
      expect(result.traceEntries).toEqual([]);
    });
  });

  describe("blocked workflow explanation", () => {
    test("explains blocked workflow with blocked reasons in summary and reasoning chain", () => {
      const evaluation = {
        workflowState: RECRUITMENT_WORKFLOW_STATES.BLOCKED,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.RESOLVE_BLOCKED_CONTEXT,
        blockedReasons: [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.MISSING_RECRUITMENT_ID],
        evaluationSteps: [],
        sourceSignals: [
          {
            source: "recruitmentId",
            observation: "missing",
            impact: "workflow blocked"
          }
        ]
      };

      const result = createWorkflowDecisionTrace(evaluation);

      expect(result.decisionSummary).toContain("Workflow is blocked because");
      expect(result.decisionSummary).toContain("Recruitment identity is required");
      expect(result.reasoningChain).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.WORKFLOW_STATE_RESOLUTION,
            result: WORKFLOW_DECISION_REASONING_RESULTS.BLOCKED
          }),
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.BLOCKED_REASON_CHECK,
            result: WORKFLOW_DECISION_REASONING_RESULTS.BLOCKED,
            explanation: expect.stringContaining("Recruitment identity")
          }),
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.NEXT_ACTION_RECOMMENDATION,
            explanation: expect.stringContaining("Resolve blocked workflow context")
          })
        ])
      );
      expect(result.traceEntries).toEqual([
        {
          source: "recruitmentId",
          observation: "missing",
          impact: "workflow blocked"
        }
      ]);
    });

    test("explains approval rejection as blocked workflow", () => {
      const evaluation = {
        workflowState: RECRUITMENT_WORKFLOW_STATES.BLOCKED,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.RESOLVE_BLOCKED_CONTEXT,
        blockedReasons: [RECRUITMENT_WORKFLOW_BLOCKED_REASONS.APPROVAL_REJECTED],
        sourceSignals: [
          {
            source: "approvalState",
            observation: "rejected"
          }
        ]
      };

      const result = createWorkflowDecisionTrace(evaluation);

      expect(result.decisionSummary).toContain("Approval was rejected");
      expect(result.traceEntries[0]).toEqual(
        expect.objectContaining({
          source: "approvalState",
          observation: "rejected",
          impact: "workflow blocked"
        })
      );
    });
  });

  describe("waiting approval explanation", () => {
    test("matches advisory waiting-for-approval trace example", () => {
      const result = createWorkflowDecisionTrace(buildWaitingApprovalEvaluation());

      expect(result.decisionSummary).toContain(
        "Workflow is waiting for approval because review package exists but approval decision is pending"
      );
      expect(result.decisionSummary).toContain("Await approval decision");
      expect(result.reasoningChain).toEqual([
        {
          step: "REVIEW_PACKAGE_CHECK",
          result: "PASS",
          explanation: "Review package available"
        },
        {
          step: "APPROVAL_CHECK",
          result: "PENDING",
          explanation: "Approval decision required"
        },
        expect.objectContaining({
          step: WORKFLOW_DECISION_EVALUATION_STEPS.NEXT_ACTION_RECOMMENDATION,
          result: WORKFLOW_DECISION_REASONING_RESULTS.PASS
        })
      ]);
      expect(result.traceEntries).toEqual([
        {
          source: "approvalState",
          observation: "pending",
          impact: "workflow paused"
        }
      ]);
    });
  });

  describe("storage ready explanation", () => {
    test("explains storage boundary ready workflow", () => {
      const evaluation = {
        workflowState: RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.READY_FOR_PERSISTENCE_BOUNDARY,
        blockedReasons: [],
        evaluationSteps: [
          {
            step: "REVIEW_PACKAGE_CHECK",
            result: "PASS",
            explanation: "Review package available"
          },
          {
            step: "APPROVAL_CHECK",
            result: "PASS",
            explanation: "Approval granted for storage path"
          },
          {
            step: "REPOSITORY_CONTRACT_CHECK",
            result: "PASS",
            explanation: "Repository contract available"
          },
          {
            step: "STORAGE_BOUNDARY_CHECK",
            result: "PASS",
            explanation: "Persistence boundary ready for advisory handoff"
          }
        ],
        sourceSignals: [
          {
            source: "repositoryContractAvailability",
            observation: "available",
            impact: "persistence boundary ready"
          }
        ]
      };

      const result = createWorkflowDecisionTrace(evaluation);

      expect(result.decisionSummary).toContain("repository contract is available");
      expect(result.decisionSummary).toContain("Ready for persistence boundary");
      expect(result.reasoningChain.some((entry) => entry.step === "STORAGE_BOUNDARY_CHECK")).toBe(
        true
      );
      expect(result.traceEntries[0].impact).toBe("persistence boundary ready");
    });

    test("derives storage-ready reasoning when evaluation steps are omitted", () => {
      const evaluation = {
        workflowState: RECRUITMENT_WORKFLOW_STATES.STORAGE_BOUNDARY_READY,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.READY_FOR_PERSISTENCE_BOUNDARY,
        blockedReasons: [],
        sourceSignals: [
          { source: "draftProposal", observation: "present" },
          { source: "reviewPackage", observation: "present" },
          { source: "approvalState", observation: "approved" },
          { source: "repositoryContractAvailability", observation: "available" }
        ]
      };

      const result = createWorkflowDecisionTrace(evaluation);

      expect(result.reasoningChain).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.REPOSITORY_CONTRACT_CHECK,
            result: WORKFLOW_DECISION_REASONING_RESULTS.PASS
          }),
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.STORAGE_BOUNDARY_CHECK,
            result: WORKFLOW_DECISION_REASONING_RESULTS.PASS
          })
        ])
      );
    });
  });

  describe("reasoning chain generation", () => {
    test("normalizes orchestrator advisory trace outcomes into reasoning results", () => {
      const evaluation = {
        workflowState: RECRUITMENT_WORKFLOW_STATES.REVIEW_READY,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.CREATE_REVIEW_PACKAGE,
        blockedReasons: [],
        evaluationSteps: [
          { step: "context_received", outcome: "ready" },
          { step: "review_package", outcome: "missing" }
        ],
        sourceSignals: [{ source: "reviewPackage", observation: "missing" }]
      };

      const result = createWorkflowDecisionTrace(evaluation);

      expect(result.reasoningChain).toEqual([
        expect.objectContaining({
          step: "CONTEXT_RECEIVED",
          result: WORKFLOW_DECISION_REASONING_RESULTS.PASS
        }),
        expect.objectContaining({
          step: "REVIEW_PACKAGE",
          result: WORKFLOW_DECISION_REASONING_RESULTS.FAIL
        }),
        expect.objectContaining({
          step: WORKFLOW_DECISION_EVALUATION_STEPS.NEXT_ACTION_RECOMMENDATION
        })
      ]);
    });

    test("auto-generates review-ready reasoning chain from workflow state", () => {
      const result = createWorkflowDecisionTrace({
        workflowState: RECRUITMENT_WORKFLOW_STATES.REVIEW_READY,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.CREATE_REVIEW_PACKAGE,
        blockedReasons: [],
        sourceSignals: [{ source: "draftProposal", observation: "present" }]
      });

      expect(result.reasoningChain).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.DRAFT_PROPOSAL_CHECK,
            result: WORKFLOW_DECISION_REASONING_RESULTS.PASS
          }),
          expect.objectContaining({
            step: WORKFLOW_DECISION_EVALUATION_STEPS.REVIEW_PACKAGE_CHECK,
            result: WORKFLOW_DECISION_REASONING_RESULTS.PENDING
          })
        ])
      );
    });
  });

  describe("trace entry generation", () => {
    test("builds trace entries from source signal value aliases", () => {
      const result = createWorkflowDecisionTrace({
        workflowState: RECRUITMENT_WORKFLOW_STATES.APPROVED_FOR_STORAGE,
        nextRecommendedAction: RECRUITMENT_WORKFLOW_RECOMMENDED_ACTIONS.AWAIT_REPOSITORY_CONTRACT,
        blockedReasons: [],
        sourceSignals: [
          { source: "approvalState", value: "approved" },
          { source: "repositoryContractAvailability", status: "unavailable" }
        ]
      });

      expect(result.traceEntries).toEqual([
        {
          source: "approvalState",
          observation: "approved",
          impact: "approved for storage preparation"
        },
        {
          source: "repositoryContractAvailability",
          observation: "unavailable",
          impact: "awaiting repository contract"
        }
      ]);
    });

    test("derives impact when source signal omits explicit impact", () => {
      const result = createWorkflowDecisionTrace(buildWaitingApprovalEvaluation({
        sourceSignals: [{ source: "approvalState", observation: "pending" }]
      }));

      expect(result.traceEntries[0].impact).toBe("workflow paused");
    });
  });

  describe("metadata validation", () => {
    test("advisory metadata declares advisory-only non-persistent trace", () => {
      const result = createWorkflowDecisionTrace(buildWaitingApprovalEvaluation());

      expect(result.advisoryMetadata).toEqual({
        advisoryOnly: true,
        persistent: false,
        phase: 121,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        auditStorage: false,
        loggingIntegration: false,
        sideEffects: false,
        mutatesInput: false
      });
      expect(isWorkflowDecisionTrace(result)).toBe(true);
    });

    test("summarizeWorkflowDecisionTrace returns frozen summary for valid trace", () => {
      const trace = createWorkflowDecisionTrace(buildWaitingApprovalEvaluation());
      const summary = summarizeWorkflowDecisionTrace(trace);

      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.decisionSummary).toBe(trace.decisionSummary);
      expect(summary.reasoningStepCount).toBe(trace.reasoningChain.length);
      expect(summary.traceEntryCount).toBe(trace.traceEntries.length);
    });

    test("summarizeWorkflowDecisionTrace returns empty summary for invalid trace", () => {
      expect(summarizeWorkflowDecisionTrace({ invalid: true })).toBe(
        EMPTY_WORKFLOW_DECISION_TRACE_SUMMARY
      );
    });
  });

  describe("deterministic output", () => {
    test("returns identical trace for identical evaluation input", () => {
      const evaluation = buildWaitingApprovalEvaluation();

      const first = createWorkflowDecisionTrace(evaluation);
      const second = createWorkflowDecisionTrace(evaluation);
      const summaryA = summarizeWorkflowDecisionTrace(first);
      const summaryB = summarizeWorkflowDecisionTrace(second);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(summaryA)).toBe(JSON.stringify(summaryB));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes decision trace output", () => {
      const result = createWorkflowDecisionTrace(buildWaitingApprovalEvaluation());

      assertAllFrozen(result);
      expect(() => {
        result.decisionSummary = "changed";
      }).toThrow();
      expect(() => {
        result.reasoningChain.push({ step: "CHANGED" });
      }).toThrow();
      expect(() => {
        result.traceEntries.push({ source: "changed" });
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate evaluation input or nested arrays", () => {
      const evaluation = buildWaitingApprovalEvaluation({
        blockedReasons: [],
        evaluationSteps: [
          {
            step: "REVIEW_PACKAGE_CHECK",
            result: "PASS",
            explanation: "Review package available"
          }
        ],
        sourceSignals: [{ source: "approvalState", observation: "pending" }]
      });
      const before = JSON.stringify(evaluation);
      const stepsBefore = JSON.stringify(evaluation.evaluationSteps);
      const signalsBefore = JSON.stringify(evaluation.sourceSignals);

      createWorkflowDecisionTrace(evaluation);
      isWorkflowDecisionTrace(createWorkflowDecisionTrace(evaluation));
      summarizeWorkflowDecisionTrace(createWorkflowDecisionTrace(evaluation));

      expect(JSON.stringify(evaluation)).toBe(before);
      expect(JSON.stringify(evaluation.evaluationSteps)).toBe(stepsBefore);
      expect(JSON.stringify(evaluation.sourceSignals)).toBe(signalsBefore);
    });
  });

  describe("no persistence behavior", () => {
    test("does not invoke coordinator or perform storage side effects", () => {
      const evaluation = buildWaitingApprovalEvaluation();

      createWorkflowDecisionTrace(evaluation);
      summarizeWorkflowDecisionTrace(createWorkflowDecisionTrace(evaluation));

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });

    test("module source declares no audit storage or logging integration", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No audit storage");
      expect(source).toContain("auditStorage: false");
      expect(source).toContain("loggingIntegration: false");
      expect(source).not.toMatch(/\b(INSERT INTO|DELETE FROM|SELECT \*|mysql2)\b/i);
      expect(source).not.toMatch(/fs\.(write|append)/);
      expect(source).not.toMatch(/console\.(log|info|warn|error)/);
    });
  });

  describe("no coordinator invocation", () => {
    test("decision trace model does not invoke coordinator", () => {
      coordinateRecruitmentWorkflowIntegration.mockClear();

      createWorkflowDecisionTrace(buildWaitingApprovalEvaluation());

      expect(coordinateRecruitmentWorkflowIntegration).not.toHaveBeenCalled();
    });
  });

  describe("architecture boundary checks", () => {
    test("module source declares pure decision trace constraints", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 121");
      expect(source).toContain("createWorkflowDecisionTrace");
      expect(source).toContain("isWorkflowDecisionTrace");
      expect(source).toContain("summarizeWorkflowDecisionTrace");
      expect(source).toContain("WORKFLOW_DECISION_REASONING_RESULTS");
      expect(source).toContain("No Express");
      expect(source).toContain("No database");
      expect(source).toContain("decisionTraceOnly");
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

    test("module only imports Phase 120 workflow state constants", () => {
      const source = read(MODULE_PATH);
      const requireMatches = source.match(/require\(["'][^"']+["']\)/g) ?? [];

      expect(requireMatches).toEqual(['require("./recruitmentWorkflowOrchestrator")']);
    });

    test("decision trace model is not wired into coordinator, gateway, pipeline, worker, or registry", () => {
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);

      expect(coordinatorSource).not.toMatch(/workflowDecisionTraceModel/);
      expect(gatewaySource).not.toMatch(/workflowDecisionTraceModel/);
      expect(pipelineSource).not.toMatch(/workflowDecisionTraceModel/);
      expect(workerSource).not.toMatch(/workflowDecisionTraceModel/);
      expect(registrySource).not.toMatch(/workflowDecisionTraceModel/);
      expect(orchestratorSource).not.toMatch(/workflowDecisionTraceModel/);
      expect(orchestratorSource).not.toMatch(/createWorkflowDecisionTrace/);
    });

    test("metadata declares no persistence, audit storage, or production mutation", () => {
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.persistenceEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.auditStorage).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.loggingIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.sideEffects).toBe(false);
      expect(RECRUITMENT_WORKFLOW_DECISION_TRACE_METADATA.pipelineWiring).toBe(false);
    });

    test("orchestrator behavior remains unchanged and independent from decision trace model", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("decisionSummary");
      expect(orchestration).not.toHaveProperty("reasoningChain");
    });
  });
});
