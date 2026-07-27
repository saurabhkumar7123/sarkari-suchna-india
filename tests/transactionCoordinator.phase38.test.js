"use strict";

/**
 * Phase 38 — Transaction Coordinator tests.
 * Architecture only: advisory unit-of-work plans — no real transactions.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_ACTIONS,
  PERSISTENCE_REASONS,
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
  TRANSACTION_PLAN_REASONS,
  TRANSACTION_STAGE_KINDS,
  TRANSACTION_SCOPES,
  buildTransactionPlan,
  isTransactionPlanArchitectureOnly
} = require("../server/lib/recruitment/transactionCoordinator");

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

function executionPlanFor(action, overrides = {}) {
  return buildPersistenceExecutionPlan(decision(action, overrides));
}

function assertTxnPlanShell(plan, { required, scope }) {
  expect(plan.executable).toBe(false);
  expect(plan.architectureOnly).toBe(true);
  expect(plan.transactionRequired).toBe(required);
  expect(plan.scope).toBe(scope);
  expect(Array.isArray(plan.stages)).toBe(true);
  expect(Array.isArray(plan.orderedStepIds)).toBe(true);
  expect(Array.isArray(plan.stepsInTransaction)).toBe(true);
  expect(plan.unitOfWork).toEqual(
    expect.objectContaining({
      begin: required ? expect.any(Object) : null,
      commit: required ? expect.any(Object) : null,
      rollback: required ? expect.any(Object) : null
    })
  );
  expect(plan.metadata).toEqual(
    expect.objectContaining({
      sideEffects: false,
      planOnly: true,
      architectureOnly: true,
      advisory: true,
      repositoriesInvoked: false,
      persistenceEnabled: false,
      transactionBegun: false,
      transactionCommitted: false,
      transactionRolledBack: false
    })
  );
  expect(isTransactionPlanArchitectureOnly(plan)).toBe(true);
}

function assertStageOrder(plan) {
  plan.stages.forEach((stage, index) => {
    expect(stage.order).toBe(index + 1);
    expect(stage.planned).toBe(true);
    expect(stage.executed).toBe(false);
    expect(stage.id).toEqual(expect.any(String));
    expect(stage.kind).toEqual(expect.any(String));
  });
}

function stageKinds(plan) {
  return plan.stages.map((s) => s.kind);
}

function stageStepIds(plan) {
  return plan.stages
    .filter((s) => s.stepId != null)
    .map((s) => s.stepId);
}

describe("Phase 38 — transactionCoordinator", () => {
  describe("constants", () => {
    test("exposes frozen plan reasons, stage kinds, and transaction scopes", () => {
      expect(TRANSACTION_PLAN_REASONS).toEqual({
        INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
        TRANSACTION_REQUIRED: "TRANSACTION_REQUIRED",
        NO_TRANSACTION: "NO_TRANSACTION",
        TRANSACTION_PLAN_GENERATED: "TRANSACTION_PLAN_GENERATED"
      });
      expect(TRANSACTION_STAGE_KINDS).toEqual({
        BEGIN: "begin",
        COMMIT: "commit",
        ROLLBACK: "rollback",
        STEP: "step",
        NOOP: "noop"
      });
      expect(TRANSACTION_SCOPES).toEqual(PIPELINE_SCOPES);
      expect(TRANSACTION_SCOPES).toEqual({
        NONE: "none",
        RECRUITMENT_AND_EVENT: "recruitment_and_event",
        REVIEW_ONLY: "review_only"
      });
      expect(Object.isFrozen(TRANSACTION_PLAN_REASONS)).toBe(true);
      expect(Object.isFrozen(TRANSACTION_STAGE_KINDS)).toBe(true);
      expect(Object.isFrozen(TRANSACTION_SCOPES)).toBe(true);
    });
  });

  describe("transaction scope detection", () => {
    test("persist plan requires recruitment_and_event scope", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PERSIST);
      const plan = buildTransactionPlan(exec);

      assertTxnPlanShell(plan, {
        required: true,
        scope: TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT
      });
      expect(plan.isolationHint).toBe("READ_COMMITTED");
      expect(plan.stepsInTransaction).toEqual([
        "resolve_recruitment_identity",
        "persist_recruitment",
        "persist_recruitment_event"
      ]);
      expect(plan.metadata.wouldBeginIfExecuted).toBe(true);
      expect(plan.metadata.boundaryReason).toBe(
        TRANSACTION_PLAN_REASONS.TRANSACTION_REQUIRED
      );
    });

    test("review plan requires review_only scope", () => {
      const plan = buildTransactionPlan(
        executionPlanFor(PERSISTENCE_ACTIONS.REVIEW)
      );

      assertTxnPlanShell(plan, {
        required: true,
        scope: TRANSACTION_SCOPES.REVIEW_ONLY
      });
      expect(plan.stepsInTransaction).toEqual(["enqueue_review_item"]);
    });

    test("preview_only and skip plans detect no transaction scope", () => {
      for (const action of [
        PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        PERSISTENCE_ACTIONS.SKIP
      ]) {
        const plan = buildTransactionPlan(executionPlanFor(action));
        assertTxnPlanShell(plan, {
          required: false,
          scope: TRANSACTION_SCOPES.NONE
        });
        expect(plan.isolationHint).toBeNull();
        expect(plan.stepsInTransaction).toEqual([]);
        expect(plan.rollbackStage).toBeNull();
        expect(plan.metadata.planReason).toBe(
          TRANSACTION_PLAN_REASONS.NO_TRANSACTION
        );
      }
    });

    test("derives required from transactional steps when requirements omitted", () => {
      const plan = buildTransactionPlan({
        action: "persist",
        executable: false,
        architectureOnly: true,
        steps: [
          {
            order: 1,
            id: "write_a",
            kind: "repository_call",
            description: "A",
            repository: REPOSITORY_DOMAINS.RECRUITMENT,
            method: "createRecruitment",
            required: true,
            transactional: true
          }
        ],
        repositoryDependencies: [REPOSITORY_DOMAINS.RECRUITMENT],
        metadata: { sideEffects: false }
      });

      expect(plan.transactionRequired).toBe(true);
      expect(plan.stepsInTransaction).toEqual(["write_a"]);
      expect(stageKinds(plan)).toEqual([
        TRANSACTION_STAGE_KINDS.BEGIN,
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.COMMIT
      ]);
    });
  });

  describe("persist plans", () => {
    test("wraps transactional persist steps with planned begin and commit", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PERSIST);
      const plan = buildTransactionPlan(exec);

      assertTxnPlanShell(plan, {
        required: true,
        scope: TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT
      });
      assertStageOrder(plan);
      expect(plan.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(plan.orderedStepIds).toEqual(exec.steps.map((s) => s.id));
      expect(stageStepIds(plan)).toEqual(exec.steps.map((s) => s.id));
      expect(stageKinds(plan)).toEqual([
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.BEGIN,
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.COMMIT,
        TRANSACTION_STAGE_KINDS.STEP
      ]);
      expect(plan.unitOfWork.begin.kind).toBe(TRANSACTION_STAGE_KINDS.BEGIN);
      expect(plan.unitOfWork.commit.kind).toBe(TRANSACTION_STAGE_KINDS.COMMIT);
      expect(plan.unitOfWork.rollback.kind).toBe(
        TRANSACTION_STAGE_KINDS.ROLLBACK
      );
      expect(plan.rollbackStage.path).toBe("failure");
      expect(plan.rollbackStage.executed).toBe(false);
      expect(plan.metadata.planReason).toBe(
        TRANSACTION_PLAN_REASONS.TRANSACTION_PLAN_GENERATED
      );
    });

    test("begin precedes first transactional step; commit follows last", () => {
      const plan = buildTransactionPlan(
        executionPlanFor(PERSISTENCE_ACTIONS.PERSIST)
      );
      const beginIdx = plan.stages.findIndex(
        (s) => s.kind === TRANSACTION_STAGE_KINDS.BEGIN
      );
      const commitIdx = plan.stages.findIndex(
        (s) => s.kind === TRANSACTION_STAGE_KINDS.COMMIT
      );
      const firstTxnStepIdx = plan.stages.findIndex(
        (s) => s.stepId === "resolve_recruitment_identity"
      );
      const lastTxnStepIdx = plan.stages.findIndex(
        (s) => s.stepId === "persist_recruitment_event"
      );

      expect(beginIdx).toBeLessThan(firstTxnStepIdx);
      expect(lastTxnStepIdx).toBeLessThan(commitIdx);
      expect(plan.stages[0].stepId).toBe("validate_persist_guards");
      expect(plan.stages[plan.stages.length - 1].stepId).toBe(
        "finalize_persist"
      );
    });
  });

  describe("review plans", () => {
    test("plans review_only unit of work around enqueue step", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.REVIEW);
      const plan = buildTransactionPlan(exec);

      assertTxnPlanShell(plan, {
        required: true,
        scope: TRANSACTION_SCOPES.REVIEW_ONLY
      });
      assertStageOrder(plan);
      expect(plan.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(plan.orderedStepIds).toEqual([
        "validate_review_guards",
        "enqueue_review_item",
        "finalize_review"
      ]);
      expect(stageKinds(plan)).toEqual([
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.BEGIN,
        TRANSACTION_STAGE_KINDS.STEP,
        TRANSACTION_STAGE_KINDS.COMMIT,
        TRANSACTION_STAGE_KINDS.STEP
      ]);
      expect(plan.unitOfWork.rollback).not.toBeNull();
      expect(plan.metadata.wouldRollbackIfFailed).toBe(true);
    });
  });

  describe("preview plans", () => {
    test("preview_only yields noop stages without begin/commit/rollback", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PREVIEW_ONLY, {
        reason: PERSISTENCE_REASONS.AUTOMATION_DISABLED,
        reasons: [PERSISTENCE_REASONS.AUTOMATION_DISABLED]
      });
      const plan = buildTransactionPlan(exec);

      assertTxnPlanShell(plan, {
        required: false,
        scope: TRANSACTION_SCOPES.NONE
      });
      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0]).toEqual(
        expect.objectContaining({
          kind: TRANSACTION_STAGE_KINDS.NOOP,
          stepId: "noop_preview",
          transactional: false,
          planned: true,
          executed: false
        })
      );
      expect(plan.unitOfWork).toEqual({
        begin: null,
        commit: null,
        rollback: null
      });
      expect(plan.metadata.wouldBeginIfExecuted).toBe(false);
    });

    test("end-to-end policy → pipeline → coordinator for preview path", () => {
      const policyDecision = evaluateRuntimePersistencePolicy(
        eligiblePolicyContext()
      );
      expect(policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      const exec = buildPersistenceExecutionPlan(policyDecision);
      const plan = buildTransactionPlan(exec);

      assertTxnPlanShell(plan, {
        required: false,
        scope: TRANSACTION_SCOPES.NONE
      });
      expect(plan.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(plan.executable).toBe(false);
    });
  });

  describe("skip plans", () => {
    test("skip yields no-transaction plan with noop stage", () => {
      const plan = buildTransactionPlan(
        executionPlanFor(PERSISTENCE_ACTIONS.SKIP, {
          reason: PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE,
          reasons: [PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE]
        })
      );

      assertTxnPlanShell(plan, {
        required: false,
        scope: TRANSACTION_SCOPES.NONE
      });
      expect(plan.stages[0].stepId).toBe("noop_skip");
      expect(plan.stages[0].kind).toBe(TRANSACTION_STAGE_KINDS.NOOP);
      expect(plan.rollbackStage).toBeNull();
    });
  });

  describe("invalid plans", () => {
    test("null / non-object execution plans fail safe", () => {
      for (const input of [null, undefined, [], "x", 1, true]) {
        const plan = buildTransactionPlan(input);
        assertTxnPlanShell(plan, {
          required: false,
          scope: TRANSACTION_SCOPES.NONE
        });
        expect(plan.action).toBeNull();
        expect(plan.metadata.planReason).toBe(
          TRANSACTION_PLAN_REASONS.INVALID_EXECUTION_PLAN
        );
        expect(plan.stages[0].id).toBe("noop_invalid_plan");
        expect(isTransactionPlanArchitectureOnly(plan)).toBe(true);
      }
    });

    test("missing steps array fails safe", () => {
      const plan = buildTransactionPlan({
        action: "persist",
        executable: false,
        architectureOnly: true,
        transactionRequirements: {
          required: true,
          scope: TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT,
          isolationHint: "READ_COMMITTED",
          stepsInTransaction: ["x"]
        },
        metadata: {}
      });
      expect(plan.metadata.planReason).toBe(
        TRANSACTION_PLAN_REASONS.INVALID_EXECUTION_PLAN
      );
      expect(plan.transactionRequired).toBe(false);
    });

    test("non-object transactionRequirements fails safe when steps missing", () => {
      const plan = buildTransactionPlan({
        action: "persist",
        steps: "not-an-array",
        transactionRequirements: "bad"
      });
      expect(plan.metadata.planReason).toBe(
        TRANSACTION_PLAN_REASONS.INVALID_EXECUTION_PLAN
      );
    });

    test("unknown pipeline action skip plan stays non-transactional", () => {
      const exec = buildPersistenceExecutionPlan(
        decision("wipe_database", {
          reason: "BOGUS",
          reasons: ["BOGUS"]
        })
      );
      const plan = buildTransactionPlan(exec);
      expect(plan.transactionRequired).toBe(false);
      expect(plan.scope).toBe(TRANSACTION_SCOPES.NONE);
      expect(plan.action).toBe(PERSISTENCE_ACTIONS.SKIP);
    });
  });

  describe("execution ordering preservation", () => {
    test("orderedStepIds match execution plan step order for all actions", () => {
      for (const action of Object.values(PERSISTENCE_ACTIONS)) {
        const exec = executionPlanFor(action);
        const plan = buildTransactionPlan(exec);
        expect(plan.orderedStepIds).toEqual(exec.steps.map((s) => s.id));
        expect(stageStepIds(plan)).toEqual(exec.steps.map((s) => s.id));
      }
    });

    test("transactional step ids remain relative-ordered inside the boundary", () => {
      const plan = buildTransactionPlan(
        executionPlanFor(PERSISTENCE_ACTIONS.PERSIST)
      );
      const txnStageIds = plan.stages
        .filter(
          (s) =>
            s.kind === TRANSACTION_STAGE_KINDS.STEP && s.transactional === true
        )
        .map((s) => s.stepId);
      expect(txnStageIds).toEqual([
        "resolve_recruitment_identity",
        "persist_recruitment",
        "persist_recruitment_event"
      ]);
    });
  });

  describe("deterministic behavior", () => {
    test("identical execution plans yield identical transaction plans", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PERSIST);
      expect(buildTransactionPlan(exec)).toEqual(buildTransactionPlan(exec));
    });

    test("identical review / preview / skip plans are stable", () => {
      for (const action of [
        PERSISTENCE_ACTIONS.REVIEW,
        PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        PERSISTENCE_ACTIONS.SKIP
      ]) {
        const exec = executionPlanFor(action);
        expect(buildTransactionPlan(exec)).toEqual(buildTransactionPlan(exec));
      }
    });

    test("end-to-end policy → pipeline → coordinator is deterministic", () => {
      const ctx = eligiblePolicyContext();
      const d1 = evaluateRuntimePersistencePolicy(ctx);
      const d2 = evaluateRuntimePersistencePolicy(ctx);
      const p1 = buildTransactionPlan(buildPersistenceExecutionPlan(d1));
      const p2 = buildTransactionPlan(buildPersistenceExecutionPlan(d2));
      expect(p1).toEqual(p2);
    });
  });

  describe("non-mutation", () => {
    test("does not mutate execution plan or options", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PERSIST);
      const options = { future: true, marker: "opts" };
      const beforePlan = JSON.stringify(exec);
      const beforeOptions = JSON.stringify(options);
      buildTransactionPlan(exec, options);
      expect(JSON.stringify(exec)).toBe(beforePlan);
      expect(JSON.stringify(options)).toBe(beforeOptions);
    });

    test("execution plan metadata is copied without sharing references", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      const plan = buildTransactionPlan(exec);
      expect(plan.metadata.executionPlanMetadata).toEqual(exec.metadata);
      expect(plan.metadata.executionPlanMetadata).not.toBe(exec.metadata);
      plan.metadata.executionPlanMetadata.planReason = "MUTATED";
      expect(exec.metadata.planReason).not.toBe("MUTATED");
    });

    test("mutating returned stages does not affect a fresh plan", () => {
      const exec = executionPlanFor(PERSISTENCE_ACTIONS.PERSIST);
      const first = buildTransactionPlan(exec);
      const originalLength = first.stages.length;
      first.stages.push({
        order: 99,
        id: "injected",
        kind: "noop",
        description: "should not leak",
        planned: true,
        executed: false,
        stepId: null,
        transactional: false,
        path: "success"
      });
      first.metadata.planReason = "MUTATED";
      const second = buildTransactionPlan(exec);
      expect(second.stages).toHaveLength(originalLength);
      expect(second.orderedStepIds).toEqual(exec.steps.map((s) => s.id));
      expect(second.metadata.planReason).not.toBe("MUTATED");
    });
  });

  describe("architecture boundaries (source)", () => {
    test("coordinator module has no DB / Express / queue / filesystem side effects", () => {
      const source = read("server/lib/recruitment/transactionCoordinator.js");
      expect(source).toMatch(/Phase 38/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never begins, commits, or rolls back/);
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
    });

    test("coordinator only imports transaction scopes from the pipeline", () => {
      const source = read("server/lib/recruitment/transactionCoordinator.js");
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./persistenceExecutionPipeline"]);
    });

    test("siteWorker is unchanged — coordinator not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/transactionCoordinator/);
      expect(worker).not.toMatch(/buildTransactionPlan/);
      expect(worker).not.toMatch(/persistenceExecutionPipeline/);
      expect(worker).not.toMatch(/buildPersistenceExecutionPlan/);
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("prior persistence modules do not import the coordinator", () => {
      const files = [
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/services/recruitmentReview.service.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/transactionCoordinator/);
        expect(source).not.toMatch(/buildTransactionPlan/);
      }
    });

    test("prior persistence modules are unchanged by this phase", () => {
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      const service = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      const contracts = read(
        "server/lib/recruitment/persistenceRepositoryContracts.js"
      );
      const adapters = read(
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js"
      );
      const pipeline = read(
        "server/lib/recruitment/persistenceExecutionPipeline.js"
      );
      expect(policy).toMatch(/Phase 33/);
      expect(policy).not.toMatch(/Phase 38/);
      expect(service).toMatch(/Phase 34/);
      expect(service).not.toMatch(/Phase 38/);
      expect(contracts).toMatch(/Phase 35/);
      expect(contracts).not.toMatch(/Phase 38/);
      expect(adapters).toMatch(/Phase 36/);
      expect(adapters).not.toMatch(/Phase 38/);
      expect(pipeline).toMatch(/Phase 37/);
      expect(pipeline).not.toMatch(/Phase 38/);
    });

    test("plans never enable persistence, begin transactions, or mark executable", () => {
      const source = read("server/lib/recruitment/transactionCoordinator.js");
      expect(source).toMatch(/executable: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/transactionBegun: false/);
      expect(source).toMatch(/transactionCommitted: false/);
      expect(source).toMatch(/transactionRolledBack: false/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      for (const action of Object.values(PERSISTENCE_ACTIONS)) {
        const plan = buildTransactionPlan(executionPlanFor(action));
        expect(plan.executable).toBe(false);
        expect(plan.metadata.persistenceEnabled).toBe(false);
        expect(plan.metadata.transactionBegun).toBe(false);
        expect(plan.metadata.transactionCommitted).toBe(false);
        expect(plan.metadata.transactionRolledBack).toBe(false);
        expect(plan.stages.every((s) => s.executed === false)).toBe(true);
      }
    });
  });
});
