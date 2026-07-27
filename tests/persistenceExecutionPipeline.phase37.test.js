"use strict";

/**
 * Phase 37 — Persistence Execution Pipeline tests.
 * Architecture only: ordered plans from advisory decisions — no execution.
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
  PIPELINE_PLAN_REASONS,
  STEP_KINDS,
  TRANSACTION_SCOPES,
  buildPersistenceExecutionPlan,
  isPlanArchitectureOnly
} = require("../server/lib/recruitment/persistenceExecutionPipeline");

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

function assertPlanShell(plan, action) {
  expect(plan.action).toBe(action);
  expect(plan.executable).toBe(false);
  expect(plan.architectureOnly).toBe(true);
  expect(Array.isArray(plan.steps)).toBe(true);
  expect(Array.isArray(plan.repositoryDependencies)).toBe(true);
  expect(plan.transactionRequirements).toEqual(
    expect.objectContaining({
      required: expect.any(Boolean),
      scope: expect.any(String),
      stepsInTransaction: expect.any(Array)
    })
  );
  expect(
    plan.transactionRequirements.isolationHint === null ||
      typeof plan.transactionRequirements.isolationHint === "string"
  ).toBe(true);
  expect(plan.metadata).toEqual(
    expect.objectContaining({
      sideEffects: false,
      planOnly: true,
      architectureOnly: true,
      repositoriesInvoked: false,
      persistenceEnabled: false
    })
  );
  expect(isPlanArchitectureOnly(plan)).toBe(true);
}

function assertStepOrder(plan) {
  plan.steps.forEach((step, index) => {
    expect(step.order).toBe(index + 1);
    expect(step.id).toEqual(expect.any(String));
    expect(step.kind).toEqual(expect.any(String));
    expect(step.description).toEqual(expect.any(String));
    expect(typeof step.required).toBe("boolean");
    expect(typeof step.transactional).toBe("boolean");
  });
  const orders = plan.steps.map((s) => s.order);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
}

describe("Phase 37 — persistenceExecutionPipeline", () => {
  describe("constants", () => {
    test("exposes frozen plan reasons, step kinds, and transaction scopes", () => {
      expect(PIPELINE_PLAN_REASONS).toEqual({
        INVALID_DECISION: "INVALID_DECISION",
        UNKNOWN_ACTION: "UNKNOWN_ACTION",
        PLAN_GENERATED: "PLAN_GENERATED",
        NOOP_PREVIEW: "NOOP_PREVIEW",
        NOOP_SKIP: "NOOP_SKIP"
      });
      expect(STEP_KINDS).toEqual({
        VALIDATE_GUARD: "validate_guard",
        REPOSITORY_CALL: "repository_call",
        ENQUEUE_REVIEW: "enqueue_review",
        NOOP: "noop",
        FINALIZE: "finalize"
      });
      expect(TRANSACTION_SCOPES).toEqual({
        NONE: "none",
        RECRUITMENT_AND_EVENT: "recruitment_and_event",
        REVIEW_ONLY: "review_only"
      });
      expect(Object.isFrozen(PIPELINE_PLAN_REASONS)).toBe(true);
      expect(Object.isFrozen(STEP_KINDS)).toBe(true);
      expect(Object.isFrozen(TRANSACTION_SCOPES)).toBe(true);
    });
  });

  describe("execution plan generation", () => {
    test("persist decision yields ordered multi-step write plan", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.PERSIST)
      );

      assertPlanShell(plan, PERSISTENCE_ACTIONS.PERSIST);
      assertStepOrder(plan);
      expect(plan.steps).toHaveLength(5);
      expect(plan.steps.map((s) => s.id)).toEqual([
        "validate_persist_guards",
        "resolve_recruitment_identity",
        "persist_recruitment",
        "persist_recruitment_event",
        "finalize_persist"
      ]);
      expect(plan.steps.map((s) => s.kind)).toEqual([
        STEP_KINDS.VALIDATE_GUARD,
        STEP_KINDS.REPOSITORY_CALL,
        STEP_KINDS.REPOSITORY_CALL,
        STEP_KINDS.REPOSITORY_CALL,
        STEP_KINDS.FINALIZE
      ]);
      expect(plan.repositoryDependencies).toEqual([
        REPOSITORY_DOMAINS.RECRUITMENT,
        REPOSITORY_DOMAINS.RECRUITMENT_EVENT
      ]);
      expect(plan.transactionRequirements).toEqual({
        required: true,
        scope: TRANSACTION_SCOPES.RECRUITMENT_AND_EVENT,
        isolationHint: "READ_COMMITTED",
        stepsInTransaction: [
          "resolve_recruitment_identity",
          "persist_recruitment",
          "persist_recruitment_event"
        ]
      });
      expect(plan.metadata.planReason).toBe(
        PIPELINE_PLAN_REASONS.PLAN_GENERATED
      );
      expect(plan.metadata.wouldWriteIfExecuted).toBe(true);
      expect(plan.metadata.mutating).toBe(true);
    });

    test("review decision yields enqueue plan with review repository", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.REVIEW)
      );

      assertPlanShell(plan, PERSISTENCE_ACTIONS.REVIEW);
      assertStepOrder(plan);
      expect(plan.steps).toHaveLength(3);
      expect(plan.steps.map((s) => s.id)).toEqual([
        "validate_review_guards",
        "enqueue_review_item",
        "finalize_review"
      ]);
      expect(plan.steps[1]).toEqual(
        expect.objectContaining({
          kind: STEP_KINDS.ENQUEUE_REVIEW,
          repository: REPOSITORY_DOMAINS.REVIEW,
          method: "createReviewItem",
          transactional: true
        })
      );
      expect(plan.repositoryDependencies).toEqual([REPOSITORY_DOMAINS.REVIEW]);
      expect(plan.transactionRequirements).toEqual({
        required: true,
        scope: TRANSACTION_SCOPES.REVIEW_ONLY,
        isolationHint: "READ_COMMITTED",
        stepsInTransaction: ["enqueue_review_item"]
      });
      expect(plan.metadata.wouldEnqueueIfExecuted).toBe(true);
    });

    test("preview_only decision yields noop plan with no repositories", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.PREVIEW_ONLY, {
          reason: PERSISTENCE_REASONS.AUTOMATION_DISABLED,
          reasons: [PERSISTENCE_REASONS.AUTOMATION_DISABLED]
        })
      );

      assertPlanShell(plan, PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0]).toEqual(
        expect.objectContaining({
          id: "noop_preview",
          kind: STEP_KINDS.NOOP,
          repository: null,
          method: null
        })
      );
      expect(plan.repositoryDependencies).toEqual([]);
      expect(plan.transactionRequirements.required).toBe(false);
      expect(plan.transactionRequirements.scope).toBe(TRANSACTION_SCOPES.NONE);
      expect(plan.metadata.planReason).toBe(PIPELINE_PLAN_REASONS.NOOP_PREVIEW);
      expect(plan.metadata.noop).toBe(true);
    });

    test("skip decision yields noop skip plan", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.SKIP, {
          reason: PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE,
          reasons: [PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE]
        })
      );

      assertPlanShell(plan, PERSISTENCE_ACTIONS.SKIP);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].id).toBe("noop_skip");
      expect(plan.repositoryDependencies).toEqual([]);
      expect(plan.transactionRequirements.required).toBe(false);
      expect(plan.metadata.planReason).toBe(PIPELINE_PLAN_REASONS.NOOP_SKIP);
    });

    test("end-to-end policy → pipeline plan for automation-disabled eligible path", () => {
      const policyDecision = evaluateRuntimePersistencePolicy(
        eligiblePolicyContext()
      );
      expect(policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);

      const plan = buildPersistenceExecutionPlan(policyDecision);
      assertPlanShell(plan, PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(plan.metadata.policyIntendedAction).toBe(
        PERSISTENCE_ACTIONS.PERSIST
      );
      expect(plan.metadata.policyReasons).toEqual(policyDecision.reasons);
      expect(plan.executable).toBe(false);
    });

    test("policy persist-shaped review decision plans review enqueue", () => {
      const policyDecision = evaluateRuntimePersistencePolicy(
        eligiblePolicyContext({
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            confidence: "medium",
            eventType: "admit_card"
          },
          matcherConfidence: "medium",
          reviewRequired: true
        })
      );
      expect(policyDecision.action).toBe(PERSISTENCE_ACTIONS.REVIEW);

      const plan = buildPersistenceExecutionPlan(policyDecision);
      assertPlanShell(plan, PERSISTENCE_ACTIONS.REVIEW);
      expect(plan.repositoryDependencies).toEqual([REPOSITORY_DOMAINS.REVIEW]);
    });
  });

  describe("step ordering", () => {
    test("persist steps are contiguous and dependency-aware", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.PERSIST)
      );
      assertStepOrder(plan);

      const byId = Object.fromEntries(plan.steps.map((s) => [s.id, s]));
      expect(byId.validate_persist_guards.order).toBeLessThan(
        byId.resolve_recruitment_identity.order
      );
      expect(byId.resolve_recruitment_identity.order).toBeLessThan(
        byId.persist_recruitment.order
      );
      expect(byId.persist_recruitment.order).toBeLessThan(
        byId.persist_recruitment_event.order
      );
      expect(byId.persist_recruitment_event.order).toBeLessThan(
        byId.finalize_persist.order
      );
    });

    test("review steps place enqueue between guard and finalize", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.REVIEW)
      );
      assertStepOrder(plan);
      expect(plan.steps[0].kind).toBe(STEP_KINDS.VALIDATE_GUARD);
      expect(plan.steps[1].kind).toBe(STEP_KINDS.ENQUEUE_REVIEW);
      expect(plan.steps[2].kind).toBe(STEP_KINDS.FINALIZE);
    });

    test("repositoryDependencies are sorted uniquely", () => {
      const plan = buildPersistenceExecutionPlan(
        decision(PERSISTENCE_ACTIONS.PERSIST)
      );
      expect(plan.repositoryDependencies).toEqual(
        [...plan.repositoryDependencies].sort()
      );
      expect(new Set(plan.repositoryDependencies).size).toBe(
        plan.repositoryDependencies.length
      );
    });

    test("transactional step ids reference real plan steps", () => {
      for (const action of [
        PERSISTENCE_ACTIONS.PERSIST,
        PERSISTENCE_ACTIONS.REVIEW
      ]) {
        const plan = buildPersistenceExecutionPlan(decision(action));
        const ids = new Set(plan.steps.map((s) => s.id));
        for (const stepId of plan.transactionRequirements.stepsInTransaction) {
          expect(ids.has(stepId)).toBe(true);
          expect(
            plan.steps.find((s) => s.id === stepId).transactional
          ).toBe(true);
        }
      }
    });
  });

  describe("supported actions", () => {
    test.each([
      [PERSISTENCE_ACTIONS.PERSIST, 5, true],
      [PERSISTENCE_ACTIONS.REVIEW, 3, true],
      [PERSISTENCE_ACTIONS.PREVIEW_ONLY, 1, false],
      [PERSISTENCE_ACTIONS.SKIP, 1, false]
    ])(
      "%s plans %i step(s) with transaction.required=%s",
      (action, stepCount, txnRequired) => {
        const plan = buildPersistenceExecutionPlan(decision(action));
        expect(plan.action).toBe(action);
        expect(plan.steps).toHaveLength(stepCount);
        expect(plan.transactionRequirements.required).toBe(txnRequired);
        expect(plan.executable).toBe(false);
      }
    );

    test("action is normalized case-insensitively", () => {
      const plan = buildPersistenceExecutionPlan({
        action: "PERSIST",
        reason: "X",
        reasons: ["X"],
        metadata: { intendedAction: "persist" }
      });
      expect(plan.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(plan.steps).toHaveLength(5);
      expect(plan.metadata.intendedAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
    });
  });

  describe("unknown actions", () => {
    test("unknown action fails safe to skip plan", () => {
      const plan = buildPersistenceExecutionPlan(
        decision("wipe_database", {
          reason: "BOGUS",
          reasons: ["BOGUS"]
        })
      );

      assertPlanShell(plan, PERSISTENCE_ACTIONS.SKIP);
      expect(plan.metadata.planReason).toBe(
        PIPELINE_PLAN_REASONS.UNKNOWN_ACTION
      );
      expect(plan.metadata.intendedAction).toBe("wipe_database");
      expect(plan.steps[0].id).toBe("noop_skip");
      expect(plan.repositoryDependencies).toEqual([]);
    });

    test("empty / blank action fails safe", () => {
      for (const action of ["", "   ", null, undefined]) {
        const plan = buildPersistenceExecutionPlan({
          action,
          reason: "X",
          reasons: ["X"],
          metadata: {}
        });
        expect(plan.action).toBe(PERSISTENCE_ACTIONS.SKIP);
        expect(plan.executable).toBe(false);
        expect(plan.metadata.planReason).toBe(
          PIPELINE_PLAN_REASONS.UNKNOWN_ACTION
        );
      }
    });

    test("null / non-object decision → INVALID_DECISION skip plan", () => {
      for (const input of [null, undefined, [], "x", 1, true]) {
        const plan = buildPersistenceExecutionPlan(input);
        expect(plan.action).toBe(PERSISTENCE_ACTIONS.SKIP);
        expect(plan.executable).toBe(false);
        expect(plan.metadata.planReason).toBe(
          PIPELINE_PLAN_REASONS.INVALID_DECISION
        );
        expect(plan.metadata.sideEffects).toBe(false);
        expect(isPlanArchitectureOnly(plan)).toBe(true);
      }
    });
  });

  describe("deterministic behavior", () => {
    test("identical input yields identical plans", () => {
      const input = decision(PERSISTENCE_ACTIONS.PERSIST, {
        metadata: { automationEnabled: true, marker: "same" }
      });
      const a = buildPersistenceExecutionPlan(input);
      const b = buildPersistenceExecutionPlan(input);
      expect(a).toEqual(b);
    });

    test("identical input yields identical review and noop plans", () => {
      for (const action of [
        PERSISTENCE_ACTIONS.REVIEW,
        PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        PERSISTENCE_ACTIONS.SKIP
      ]) {
        const input = decision(action);
        expect(buildPersistenceExecutionPlan(input)).toEqual(
          buildPersistenceExecutionPlan(input)
        );
      }
    });

    test("end-to-end policy → pipeline is deterministic", () => {
      const ctx = eligiblePolicyContext();
      const d1 = evaluateRuntimePersistencePolicy(ctx);
      const d2 = evaluateRuntimePersistencePolicy(ctx);
      expect(d1).toEqual(d2);
      expect(buildPersistenceExecutionPlan(d1)).toEqual(
        buildPersistenceExecutionPlan(d2)
      );
    });
  });

  describe("non-mutation", () => {
    test("does not mutate decision or options", () => {
      const input = decision(PERSISTENCE_ACTIONS.PERSIST, {
        reasons: ["B", "A"],
        metadata: { automationEnabled: false, nested: { keep: 1 } }
      });
      const options = { future: true, marker: "opts" };
      const beforeDecision = JSON.stringify(input);
      const beforeOptions = JSON.stringify(options);
      buildPersistenceExecutionPlan(input, options);
      expect(JSON.stringify(input)).toBe(beforeDecision);
      expect(JSON.stringify(options)).toBe(beforeOptions);
    });

    test("policy metadata is copied without sharing references", () => {
      const input = decision(PERSISTENCE_ACTIONS.PREVIEW_ONLY, {
        metadata: { automationEnabled: false, custom: { nested: 1 } }
      });
      const plan = buildPersistenceExecutionPlan(input);
      expect(plan.metadata.policyMetadata).toEqual(input.metadata);
      expect(plan.metadata.policyMetadata).not.toBe(input.metadata);
      plan.metadata.policyMetadata.custom = { nested: 99 };
      expect(input.metadata.custom).toEqual({ nested: 1 });
    });

    test("mutating returned steps array does not affect a fresh plan", () => {
      const input = decision(PERSISTENCE_ACTIONS.PERSIST);
      const first = buildPersistenceExecutionPlan(input);
      first.steps.push({
        order: 99,
        id: "injected",
        kind: "noop",
        description: "should not leak",
        repository: null,
        method: null,
        required: false,
        transactional: false
      });
      first.repositoryDependencies.push("injected_domain");
      const second = buildPersistenceExecutionPlan(input);
      expect(second.steps).toHaveLength(5);
      expect(second.repositoryDependencies).toEqual([
        REPOSITORY_DOMAINS.RECRUITMENT,
        REPOSITORY_DOMAINS.RECRUITMENT_EVENT
      ]);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("pipeline module has no DB / Express / queue / filesystem side effects", () => {
      const source = read(
        "server/lib/recruitment/persistenceExecutionPipeline.js"
      );
      expect(source).toMatch(/Phase 37/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never executes repository methods/);
      expect(source).not.toMatch(/mysql|createPool|INSERT INTO/i);
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
    });

    test("pipeline only imports policy actions and repository domain constants", () => {
      const source = read(
        "server/lib/recruitment/persistenceExecutionPipeline.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./runtimePersistencePolicy",
        "./persistenceRepositoryContracts"
      ]);
    });

    test("siteWorker is unchanged — pipeline not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/persistenceExecutionPipeline/);
      expect(worker).not.toMatch(/buildPersistenceExecutionPlan/);
      expect(worker).not.toMatch(/PIPELINE_PLAN_REASONS/);
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("preview buffer, review service, runtime service, and adapters do not import pipeline", () => {
      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const reviewService = read(
        "server/services/recruitmentReview.service.js"
      );
      const service = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      const adapters = read(
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js"
      );
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      expect(preview).not.toMatch(/persistenceExecutionPipeline/);
      expect(reviewService).not.toMatch(/persistenceExecutionPipeline/);
      expect(service).not.toMatch(/persistenceExecutionPipeline/);
      expect(adapters).not.toMatch(/persistenceExecutionPipeline/);
      expect(policy).not.toMatch(/persistenceExecutionPipeline/);
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
      expect(policy).toMatch(/Phase 33/);
      expect(policy).not.toMatch(/Phase 37/);
      expect(service).toMatch(/Phase 34/);
      expect(service).not.toMatch(/Phase 37/);
      expect(contracts).toMatch(/Phase 35/);
      expect(contracts).not.toMatch(/Phase 37/);
      expect(adapters).toMatch(/Phase 36/);
      expect(adapters).not.toMatch(/Phase 37/);
    });

    test("plans never enable persistence or mark themselves executable", () => {
      const source = read(
        "server/lib/recruitment/persistenceExecutionPipeline.js"
      );
      expect(source).toMatch(/executable: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/repositoriesInvoked: false/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      for (const action of Object.values(PERSISTENCE_ACTIONS)) {
        const plan = buildPersistenceExecutionPlan(decision(action));
        expect(plan.executable).toBe(false);
        expect(plan.metadata.persistenceEnabled).toBe(false);
        expect(plan.metadata.repositoriesInvoked).toBe(false);
      }
    });
  });
});
