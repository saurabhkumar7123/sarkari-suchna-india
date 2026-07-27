"use strict";

/**
 * Phase 42 — Dry-Run Persistence Simulation tests.
 * Architecture only: advisory reports from plans — no execution.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_ACTIONS,
  RUNTIME_MODES,
  evaluateRuntimePersistencePolicy
} = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  REPOSITORY_DOMAINS
} = require("../server/lib/recruitment/persistenceRepositoryContracts");
const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  buildPersistenceExecutionPlan,
  TRANSACTION_SCOPES: PIPELINE_SCOPES
} = require("../server/lib/recruitment/persistenceExecutionPipeline");
const {
  buildTransactionPlan,
  TRANSACTION_SCOPES
} = require("../server/lib/recruitment/transactionCoordinator");
const {
  SIMULATION_PHASE,
  DRY_RUN_SIMULATION_REASONS,
  EXPECTED_OUTCOME_STATUSES,
  MUTATION_KINDS,
  REPOSITORY_OPERATION_KINDS,
  simulateDryRunPersistence,
  isDryRunSimulationArchitectureOnly
} = require("../server/lib/recruitment/dryRunPersistenceSimulator");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligiblePolicyContext(overrides = {}) {
  return {
    featureFlags: {
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false
    },
    runtimeMode: RUNTIME_MODES.LIVE,
    previewMode: false,
    eligibility: {
      eligible: true,
      status: ELIGIBILITY_STATUS.ELIGIBLE,
      reasons: ["CONFIDENCE_HIGH"],
      confidence: "high",
      eventType: "admit_card"
    },
    matcherConfidence: "high",
    matchResult: {
      match: true,
      confidence: "high",
      matchedSignals: ["ADVERTISEMENT_NUMBER"],
      conflictingSignals: []
    },
    eventType: "admit_card",
    lifecycleState: "open",
    reviewRequired: false,
    existingRecruitmentMatch: null,
    ...overrides
  };
}

function decision(action, overrides = {}) {
  return {
    action,
    reason: overrides.reason || "TEST_REASON",
    reasons: overrides.reasons || ["TEST_REASON"],
    metadata: {
      automationEnabled: false,
      reviewQueueEnqueueEnabled: false,
      pipelineEnabled: true,
      previewMode: false,
      runtimeMode: "live",
      intendedAction: action,
      wouldPersistIfAutomationEnabled: action === PERSISTENCE_ACTIONS.PERSIST,
      wouldReviewIfEnqueueEnabled: action === PERSISTENCE_ACTIONS.REVIEW,
      ...(overrides.metadata || {})
    },
    ...overrides
  };
}

function plansFor(action, overrides = {}) {
  const executionPlan = buildPersistenceExecutionPlan(
    decision(action, overrides)
  );
  const transactionPlan = buildTransactionPlan(executionPlan);
  return { executionPlan, transactionPlan };
}

function assertReportShell(report, action) {
  expect(report.action).toBe(action);
  expect(report.simulated).toBe(true);
  expect(report.executed).toBe(false);
  expect(report.architectureOnly).toBe(true);
  expect(report.advisory).toBe(true);
  expect(Array.isArray(report.repositoryOperations)).toBe(true);
  expect(Array.isArray(report.mutations)).toBe(true);
  expect(report.transactionBoundary).toEqual(
    expect.objectContaining({
      required: expect.any(Boolean),
      scope: expect.any(String),
      begun: false,
      committed: false,
      rolledBack: false,
      stepsInTransaction: expect.any(Array),
      stageIds: expect.any(Array)
    })
  );
  expect(report.expectedOutcome).toEqual(
    expect.objectContaining({
      status: expect.any(String),
      description: expect.any(String),
      successIfExecuted: expect.any(Boolean),
      mutating: expect.any(Boolean),
      sideEffectsIfExecuted: expect.any(Boolean),
      noop: expect.any(Boolean)
    })
  );
  expect(report.metadata).toEqual(
    expect.objectContaining({
      sideEffects: false,
      simulatedOnly: true,
      architectureOnly: true,
      advisory: true,
      repositoriesInvoked: false,
      persistenceEnabled: false,
      transactionBegun: false,
      transactionCommitted: false,
      transactionRolledBack: false,
      phase: SIMULATION_PHASE
    })
  );
  expect(isDryRunSimulationArchitectureOnly(report)).toBe(true);
}

describe("Phase 42 — dryRunPersistenceSimulator", () => {
  describe("constants", () => {
    test("exposes frozen simulation reasons, outcomes, and kinds", () => {
      expect(SIMULATION_PHASE).toBe(42);
      expect(DRY_RUN_SIMULATION_REASONS).toEqual({
        INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
        INVALID_TRANSACTION_PLAN: "INVALID_TRANSACTION_PLAN",
        ACTION_MISMATCH: "ACTION_MISMATCH",
        SIMULATION_GENERATED: "SIMULATION_GENERATED",
        NOOP_PREVIEW: "NOOP_PREVIEW",
        NOOP_SKIP: "NOOP_SKIP",
        UNKNOWN_ACTION: "UNKNOWN_ACTION"
      });
      expect(EXPECTED_OUTCOME_STATUSES).toEqual({
        WOULD_PERSIST: "would_persist",
        WOULD_ENQUEUE_REVIEW: "would_enqueue_review",
        WOULD_NOOP_PREVIEW: "would_noop_preview",
        WOULD_NOOP_SKIP: "would_noop_skip",
        INVALID_PLAN: "invalid_plan",
        UNKNOWN_ACTION: "unknown_action"
      });
      expect(MUTATION_KINDS).toEqual({
        CREATE: "create",
        UPDATE: "update",
        ENQUEUE: "enqueue",
        NONE: "none"
      });
      expect(REPOSITORY_OPERATION_KINDS).toEqual({
        LOOKUP: "lookup",
        WRITE: "write",
        ENQUEUE: "enqueue",
        OTHER: "other"
      });
      expect(Object.isFrozen(DRY_RUN_SIMULATION_REASONS)).toBe(true);
      expect(Object.isFrozen(EXPECTED_OUTCOME_STATUSES)).toBe(true);
      expect(Object.isFrozen(MUTATION_KINDS)).toBe(true);
      expect(Object.isFrozen(REPOSITORY_OPERATION_KINDS)).toBe(true);
    });
  });

  describe("dry-run generation", () => {
    test("produces an advisory report shell from execution and transaction plans", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PERSIST
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);
      assertReportShell(report, PERSISTENCE_ACTIONS.PERSIST);
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.SIMULATION_GENERATED
      );
      expect(report.metadata.transactionPlanProvided).toBe(true);
    });

    test("accepts execution plan alone and maps transaction requirements", () => {
      const { executionPlan } = plansFor(PERSISTENCE_ACTIONS.PERSIST);
      const report = simulateDryRunPersistence(executionPlan);
      assertReportShell(report, PERSISTENCE_ACTIONS.PERSIST);
      expect(report.metadata.transactionPlanProvided).toBe(false);
      expect(report.transactionBoundary.required).toBe(true);
      expect(report.transactionBoundary.scope).toBe(
        PIPELINE_SCOPES.RECRUITMENT_AND_EVENT
      );
      expect(report.transactionBoundary.wouldBegin).toBe(true);
      expect(report.transactionBoundary.unitOfWorkSummary).toBeNull();
    });
  });

  describe("persist simulation", () => {
    test("lists repository operations and mutating writes for persist", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PERSIST
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);

      expect(report.repositoryOperations.map((op) => op.method)).toEqual([
        "findCandidatesForLookup",
        "createRecruitment",
        "createRecruitmentEvent"
      ]);
      expect(report.repositoryOperations[0]).toEqual(
        expect.objectContaining({
          kind: REPOSITORY_OPERATION_KINDS.LOOKUP,
          repository: REPOSITORY_DOMAINS.RECRUITMENT,
          wouldInvoke: true,
          invoked: false,
          transactional: true
        })
      );
      expect(report.repositoryOperations[1].kind).toBe(
        REPOSITORY_OPERATION_KINDS.WRITE
      );
      expect(report.repositoryOperations[2].kind).toBe(
        REPOSITORY_OPERATION_KINDS.WRITE
      );

      expect(report.mutations.map((m) => m.method)).toEqual([
        "createRecruitment",
        "createRecruitmentEvent"
      ]);
      expect(report.mutations.every((m) => m.kind === MUTATION_KINDS.CREATE)).toBe(
        true
      );
      expect(report.mutations.every((m) => m.mutated === false)).toBe(true);

      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.WOULD_PERSIST
      );
      expect(report.expectedOutcome.mutating).toBe(true);
      expect(report.expectedOutcome.sideEffectsIfExecuted).toBe(true);
      expect(report.expectedOutcome.noop).toBe(false);
      expect(report.metadata.wouldWriteIfExecuted).toBe(true);
      expect(report.metadata.wouldEnqueueIfExecuted).toBe(false);
    });

    test("maps persist transaction boundary from the transaction plan", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PERSIST
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);

      expect(report.transactionBoundary).toEqual(
        expect.objectContaining({
          required: true,
          scope: TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT,
          isolationHint: "READ_COMMITTED",
          wouldBegin: true,
          wouldCommit: true,
          wouldRollbackOnFailure: true,
          begun: false,
          committed: false,
          rolledBack: false
        })
      );
      expect(report.transactionBoundary.stepsInTransaction).toEqual(
        transactionPlan.stepsInTransaction
      );
      expect(report.transactionBoundary.stageIds).toEqual(
        transactionPlan.stages.map((s) => s.id)
      );
      expect(report.transactionBoundary.unitOfWorkSummary).toEqual({
        begin: expect.objectContaining({
          id: "begin_transaction",
          kind: "begin",
          planned: true,
          executed: false
        }),
        commit: expect.objectContaining({
          id: "commit_transaction",
          kind: "commit",
          planned: true,
          executed: false
        }),
        rollback: expect.objectContaining({
          id: "rollback_transaction",
          kind: "rollback",
          planned: true,
          executed: false
        })
      });
    });
  });

  describe("review simulation", () => {
    test("lists enqueue mutation and review-scoped transaction", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.REVIEW
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);

      assertReportShell(report, PERSISTENCE_ACTIONS.REVIEW);
      expect(report.repositoryOperations).toEqual([
        expect.objectContaining({
          stepId: "enqueue_review_item",
          kind: REPOSITORY_OPERATION_KINDS.ENQUEUE,
          repository: REPOSITORY_DOMAINS.REVIEW,
          method: "createReviewItem",
          wouldInvoke: true,
          invoked: false
        })
      ]);
      expect(report.mutations).toEqual([
        expect.objectContaining({
          kind: MUTATION_KINDS.ENQUEUE,
          target: REPOSITORY_DOMAINS.REVIEW,
          method: "createReviewItem",
          wouldMutate: true,
          mutated: false
        })
      ]);
      expect(report.transactionBoundary.scope).toBe(
        TRANSACTION_SCOPES.REVIEW_ONLY
      );
      expect(report.transactionBoundary.required).toBe(true);
      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.WOULD_ENQUEUE_REVIEW
      );
      expect(report.metadata.wouldEnqueueIfExecuted).toBe(true);
      expect(report.metadata.wouldWriteIfExecuted).toBe(false);
    });
  });

  describe("preview and skip paths", () => {
    test("preview_only yields noop simulation with no repository ops", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PREVIEW_ONLY
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);

      assertReportShell(report, PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(report.repositoryOperations).toEqual([]);
      expect(report.mutations).toEqual([]);
      expect(report.transactionBoundary.required).toBe(false);
      expect(report.transactionBoundary.scope).toBe(TRANSACTION_SCOPES.NONE);
      expect(report.transactionBoundary.wouldBegin).toBe(false);
      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.WOULD_NOOP_PREVIEW
      );
      expect(report.expectedOutcome.noop).toBe(true);
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.NOOP_PREVIEW
      );
      expect(report.metadata.mutating).toBe(false);
    });

    test("skip yields noop simulation with no side effects planned", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.SKIP
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);

      assertReportShell(report, PERSISTENCE_ACTIONS.SKIP);
      expect(report.repositoryOperations).toEqual([]);
      expect(report.mutations).toEqual([]);
      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.WOULD_NOOP_SKIP
      );
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.NOOP_SKIP
      );
      expect(report.metadata.wouldWriteIfExecuted).toBe(false);
      expect(report.metadata.wouldEnqueueIfExecuted).toBe(false);
    });
  });

  describe("invalid plans", () => {
    test("rejects null / non-object execution plans", () => {
      for (const bad of [null, undefined, "persist", 42, [], true]) {
        const report = simulateDryRunPersistence(bad);
        expect(report.action).toBeNull();
        expect(report.executed).toBe(false);
        expect(report.repositoryOperations).toEqual([]);
        expect(report.mutations).toEqual([]);
        expect(report.expectedOutcome.status).toBe(
          EXPECTED_OUTCOME_STATUSES.INVALID_PLAN
        );
        expect(report.metadata.simulationReason).toBe(
          DRY_RUN_SIMULATION_REASONS.INVALID_EXECUTION_PLAN
        );
        expect(isDryRunSimulationArchitectureOnly(report)).toBe(true);
      }
    });

    test("rejects execution plans without a steps array", () => {
      const report = simulateDryRunPersistence({
        action: PERSISTENCE_ACTIONS.PERSIST,
        executable: false,
        architectureOnly: true
      });
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.INVALID_EXECUTION_PLAN
      );
    });

    test("rejects invalid transaction plans", () => {
      const { executionPlan } = plansFor(PERSISTENCE_ACTIONS.REVIEW);
      const report = simulateDryRunPersistence(executionPlan, {
        action: PERSISTENCE_ACTIONS.REVIEW,
        transactionRequired: "yes",
        stages: []
      });
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.INVALID_TRANSACTION_PLAN
      );
      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.INVALID_PLAN
      );
      expect(report.repositoryOperations).toEqual([]);
      expect(report.mutations).toEqual([]);
    });

    test("rejects action mismatch between execution and transaction plans", () => {
      const { executionPlan } = plansFor(PERSISTENCE_ACTIONS.PERSIST);
      const { transactionPlan } = plansFor(PERSISTENCE_ACTIONS.REVIEW);
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.ACTION_MISMATCH
      );
      expect(report.metadata.executionAction).toBe(
        PERSISTENCE_ACTIONS.PERSIST
      );
      expect(report.metadata.transactionAction).toBe(
        PERSISTENCE_ACTIONS.REVIEW
      );
      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.INVALID_PLAN
      );
    });

    test("unknown actions simulate conservatively without enabling execution", () => {
      const report = simulateDryRunPersistence({
        action: "explode",
        executable: false,
        architectureOnly: true,
        steps: [
          {
            order: 1,
            id: "noop_unknown",
            kind: "noop",
            description: "Unknown action noop",
            repository: null,
            method: null,
            required: true,
            transactional: false
          }
        ],
        repositoryDependencies: [],
        transactionRequirements: {
          required: false,
          scope: "none",
          isolationHint: null,
          stepsInTransaction: []
        },
        metadata: {
          sideEffects: false,
          planOnly: true,
          architectureOnly: true,
          repositoriesInvoked: false,
          persistenceEnabled: false
        }
      });
      expect(report.action).toBe("explode");
      expect(report.executed).toBe(false);
      expect(report.expectedOutcome.status).toBe(
        EXPECTED_OUTCOME_STATUSES.UNKNOWN_ACTION
      );
      expect(report.metadata.simulationReason).toBe(
        DRY_RUN_SIMULATION_REASONS.UNKNOWN_ACTION
      );
      expect(report.metadata.persistenceEnabled).toBe(false);
    });
  });

  describe("transaction mapping", () => {
    test("maps stage ids and unit-of-work summary consistently with coordinator", () => {
      for (const action of [
        PERSISTENCE_ACTIONS.PERSIST,
        PERSISTENCE_ACTIONS.REVIEW,
        PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        PERSISTENCE_ACTIONS.SKIP
      ]) {
        const { executionPlan, transactionPlan } = plansFor(action);
        const report = simulateDryRunPersistence(
          executionPlan,
          transactionPlan
        );
        expect(report.transactionBoundary.required).toBe(
          transactionPlan.transactionRequired
        );
        expect(report.transactionBoundary.scope).toBe(
          transactionPlan.transactionRequired
            ? transactionPlan.scope
            : TRANSACTION_SCOPES.NONE
        );
        expect(report.transactionBoundary.stepsInTransaction).toEqual(
          transactionPlan.stepsInTransaction
        );
        expect(report.transactionBoundary.stageIds).toEqual(
          transactionPlan.stages.map((s) => s.id)
        );
        expect(report.transactionBoundary.begun).toBe(false);
        expect(report.transactionBoundary.committed).toBe(false);
        expect(report.transactionBoundary.rolledBack).toBe(false);
      }
    });

    test("requirements-only boundary matches required / scope when plan omitted", () => {
      const { executionPlan } = plansFor(PERSISTENCE_ACTIONS.REVIEW);
      const report = simulateDryRunPersistence(executionPlan, null);
      expect(report.transactionBoundary.required).toBe(
        executionPlan.transactionRequirements.required
      );
      expect(report.transactionBoundary.scope).toBe(
        executionPlan.transactionRequirements.scope
      );
      expect(report.transactionBoundary.stepsInTransaction).toEqual(
        executionPlan.transactionRequirements.stepsInTransaction
      );
    });
  });

  describe("deterministic behavior", () => {
    test("identical plans yield identical simulation reports", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PERSIST
      );
      expect(
        simulateDryRunPersistence(executionPlan, transactionPlan)
      ).toEqual(simulateDryRunPersistence(executionPlan, transactionPlan));
    });

    test("identical review / preview / skip simulations are stable", () => {
      for (const action of [
        PERSISTENCE_ACTIONS.REVIEW,
        PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        PERSISTENCE_ACTIONS.SKIP
      ]) {
        const { executionPlan, transactionPlan } = plansFor(action);
        expect(
          simulateDryRunPersistence(executionPlan, transactionPlan)
        ).toEqual(simulateDryRunPersistence(executionPlan, transactionPlan));
      }
    });

    test("end-to-end policy → pipeline → coordinator → dry-run is deterministic", () => {
      const ctx = eligiblePolicyContext();
      const d1 = evaluateRuntimePersistencePolicy(ctx);
      const d2 = evaluateRuntimePersistencePolicy(ctx);
      const e1 = buildPersistenceExecutionPlan(d1);
      const e2 = buildPersistenceExecutionPlan(d2);
      const t1 = buildTransactionPlan(e1);
      const t2 = buildTransactionPlan(e2);
      expect(simulateDryRunPersistence(e1, t1)).toEqual(
        simulateDryRunPersistence(e2, t2)
      );
    });
  });

  describe("non-mutation", () => {
    test("does not mutate execution plan, transaction plan, or options", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PERSIST
      );
      const options = { future: true, marker: "opts" };
      const beforeExec = JSON.stringify(executionPlan);
      const beforeTxn = JSON.stringify(transactionPlan);
      const beforeOptions = JSON.stringify(options);
      simulateDryRunPersistence(executionPlan, transactionPlan, options);
      expect(JSON.stringify(executionPlan)).toBe(beforeExec);
      expect(JSON.stringify(transactionPlan)).toBe(beforeTxn);
      expect(JSON.stringify(options)).toBe(beforeOptions);
    });

    test("plan metadata is copied without sharing references", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PREVIEW_ONLY
      );
      const report = simulateDryRunPersistence(executionPlan, transactionPlan);
      expect(report.metadata.executionPlanMetadata).toEqual(
        executionPlan.metadata
      );
      expect(report.metadata.executionPlanMetadata).not.toBe(
        executionPlan.metadata
      );
      expect(report.metadata.transactionPlanMetadata).toEqual(
        transactionPlan.metadata
      );
      expect(report.metadata.transactionPlanMetadata).not.toBe(
        transactionPlan.metadata
      );
      report.metadata.executionPlanMetadata.planReason = "MUTATED";
      expect(executionPlan.metadata.planReason).not.toBe("MUTATED");
    });

    test("mutating returned arrays does not affect a fresh report", () => {
      const { executionPlan, transactionPlan } = plansFor(
        PERSISTENCE_ACTIONS.PERSIST
      );
      const first = simulateDryRunPersistence(executionPlan, transactionPlan);
      const originalOps = first.repositoryOperations.length;
      const originalMutations = first.mutations.length;
      first.repositoryOperations.push({
        order: 99,
        stepId: "injected",
        kind: "write",
        repository: "x",
        method: "y",
        description: "leak",
        required: true,
        transactional: false,
        wouldInvoke: true,
        invoked: true
      });
      first.mutations.push({
        order: 99,
        stepId: "injected",
        kind: "create",
        target: "x",
        method: "y",
        description: "leak",
        wouldMutate: true,
        mutated: true
      });
      first.metadata.simulationReason = "MUTATED";
      const second = simulateDryRunPersistence(executionPlan, transactionPlan);
      expect(second.repositoryOperations).toHaveLength(originalOps);
      expect(second.mutations).toHaveLength(originalMutations);
      expect(second.metadata.simulationReason).not.toBe("MUTATED");
      expect(second.repositoryOperations.every((op) => op.invoked === false)).toBe(
        true
      );
      expect(second.mutations.every((m) => m.mutated === false)).toBe(true);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("simulator module has no DB / Express / queue / filesystem side effects", () => {
      const source = read(
        "server/lib/recruitment/dryRunPersistenceSimulator.js"
      );
      expect(source).toMatch(/Phase 42/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never accesses MySQL/);
      expect(source).toMatch(/Never calls repositories/);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/recordRuntimePreview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/createMysql/);
      expect(source).not.toMatch(/executeRuntimePersistence/);
      expect(source).not.toMatch(/getConnection/);
      expect(source).not.toMatch(/\.beginTransaction\s*\(/);
      expect(source).not.toMatch(/\.commit\s*\(/);
      expect(source).not.toMatch(/\.rollback\s*\(/);
      expect(source).not.toMatch(/previewRuntimeWiring/);
      expect(source).not.toMatch(/siteWorker/);
    });

    test("simulator only imports policy actions and pipeline constants", () => {
      const source = read(
        "server/lib/recruitment/dryRunPersistenceSimulator.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./runtimePersistencePolicy",
        "./persistenceExecutionPipeline"
      ]);
    });

    test("siteWorker is unchanged — dry-run simulator not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/dryRunPersistenceSimulator/);
      expect(worker).not.toMatch(/simulateDryRunPersistence/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("prior persistence modules do not import the simulator", () => {
      const files = [
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/transactionCoordinator.js",
        "server/lib/recruitment/auditTrail.js",
        "server/lib/recruitment/executionContext.js",
        "server/lib/recruitment/previewRuntimeWiring.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/services/recruitmentReview.service.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/dryRunPersistenceSimulator/);
        expect(source).not.toMatch(/simulateDryRunPersistence/);
      }
    });

    test("prior persistence modules are unchanged by this phase", () => {
      const files = {
        "server/lib/recruitment/runtimePersistencePolicy.js": /Phase 33/,
        "server/lib/recruitment/runtimePersistenceService.js": /Phase 34/,
        "server/lib/recruitment/persistenceRepositoryContracts.js": /Phase 35/,
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js":
          /Phase 36/,
        "server/lib/recruitment/persistenceExecutionPipeline.js": /Phase 37/,
        "server/lib/recruitment/transactionCoordinator.js": /Phase 38/,
        "server/lib/recruitment/auditTrail.js": /Phase 39/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 42/);
      }
    });

    test("reports never enable persistence, begin transactions, or mark executed", () => {
      const source = read(
        "server/lib/recruitment/dryRunPersistenceSimulator.js"
      );
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/transactionBegun: false/);
      expect(source).toMatch(/transactionCommitted: false/);
      expect(source).toMatch(/transactionRolledBack: false/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      for (const action of Object.values(PERSISTENCE_ACTIONS)) {
        const { executionPlan, transactionPlan } = plansFor(action);
        const report = simulateDryRunPersistence(
          executionPlan,
          transactionPlan
        );
        expect(report.executed).toBe(false);
        expect(report.metadata.persistenceEnabled).toBe(false);
        expect(report.metadata.transactionBegun).toBe(false);
        expect(report.transactionBoundary.begun).toBe(false);
        expect(
          report.repositoryOperations.every((op) => op.invoked === false)
        ).toBe(true);
        expect(report.mutations.every((m) => m.mutated === false)).toBe(true);
        expect(isDryRunSimulationArchitectureOnly(report)).toBe(true);
      }
    });
  });
});
