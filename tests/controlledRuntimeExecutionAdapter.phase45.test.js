"use strict";

/**
 * Phase 45 — Controlled Runtime Execution Adapter tests.
 * Architecture only: advisory outcomes — no real execution.
 */

const fs = require("fs");
const path = require("path");

const {
  EXECUTION_MODES: CONTEXT_MODES,
  createExecutionContext
} = require("../server/lib/recruitment/executionContext");

const {
  PERSISTENCE_ACTIONS,
  RUNTIME_MODES,
  evaluateRuntimePersistencePolicy
} = require("../server/lib/recruitment/runtimePersistencePolicy");

const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");

const {
  buildPersistenceExecutionPlan
} = require("../server/lib/recruitment/persistenceExecutionPipeline");

const {
  buildTransactionPlan
} = require("../server/lib/recruitment/transactionCoordinator");

const {
  EXECUTION_MODES: ENABLEMENT_MODES,
  ENABLEMENT_CAPABILITIES,
  ENABLEMENT_REASONS,
  createDefaultEnablementConfig,
  evaluatePersistenceEnablement
} = require("../server/lib/recruitment/persistenceEnablement");

const {
  EXECUTION_ADAPTER_PHASE,
  CONTROLLED_EXECUTION_OUTCOMES,
  SUPPORTED_CONTROLLED_EXECUTION_OUTCOMES,
  CONTROLLED_EXECUTION_REASONS,
  adaptControlledRuntimeExecution,
  isControlledExecutionArchitectureOnly,
  validateAdapterInput,
  resolveControllingMode
} = require("../server/lib/recruitment/controlledRuntimeExecutionAdapter");

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

function contextFor(mode, overrides = {}) {
  return createExecutionContext({
    contextId: "ctx_phase45",
    correlationId: "corr_phase45",
    pipelineRunId: "run_phase45",
    executionMode: mode,
    sourceModule: "controlledRuntimeExecutionAdapter",
    recruitment: {
      recruitmentId: "rec-45",
      lifecycleEventType: "admit_card",
      lifecycleState: "open",
      eventRef: "evt-45"
    },
    metadata: { stage: "adapter" },
    ...overrides
  });
}

function enablementFor(mode, flagOverrides = {}, capability) {
  return evaluatePersistenceEnablement({
    executionMode: mode,
    capability: capability || ENABLEMENT_CAPABILITIES.BOTH,
    featureFlags: {
      pipelineEnabled: true,
      automaticPersistenceEnabled: false,
      reviewQueueEnqueueEnabled: false,
      ...flagOverrides
    }
  });
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

function plansFor(action, decisionOverrides = {}) {
  const persistenceDecision = decision(action, decisionOverrides);
  const executionPlan = buildPersistenceExecutionPlan(persistenceDecision);
  const transactionPlan = buildTransactionPlan(executionPlan);
  return { persistenceDecision, executionPlan, transactionPlan };
}

function adapterInput(overrides = {}) {
  const mode = overrides.mode || CONTEXT_MODES.PREVIEW;
  const action =
    overrides.action ||
    (mode === CONTEXT_MODES.PREVIEW
      ? PERSISTENCE_ACTIONS.PREVIEW_ONLY
      : PERSISTENCE_ACTIONS.PERSIST);
  const { persistenceDecision, executionPlan, transactionPlan } = plansFor(
    action,
    overrides.decisionOverrides
  );

  const enablement =
    overrides.enablementDecision ||
    enablementFor(
      overrides.enablementMode || mode,
      overrides.enablementFlags || {},
      overrides.capability
    );

  return {
    executionContext: overrides.executionContext || contextFor(mode),
    persistenceDecision:
      overrides.persistenceDecision || persistenceDecision,
    enablementDecision: enablement,
    executionPlan: overrides.executionPlan || executionPlan,
    transactionPlan: overrides.transactionPlan || transactionPlan
  };
}

function assertOutcomeShell(result, outcome) {
  expect(result.outcome).toBe(outcome);
  expect(result.executed).toBe(false);
  expect(result.architectureOnly).toBe(true);
  expect(result.advisory).toBe(true);
  expect(Array.isArray(result.reasons)).toBe(true);
  expect(result.reason).toBe(result.reasons[0]);
  expect(result.metadata).toEqual(
    expect.objectContaining({
      phase: EXECUTION_ADAPTER_PHASE,
      sideEffects: false,
      architectureOnly: true,
      advisory: true,
      executed: false,
      persistenceEnabled: false,
      automationEnabled: false,
      queueEnqueueEnabled: false,
      repositoriesInvoked: false,
      transactionBegun: false,
      transactionCommitted: false,
      transactionRolledBack: false,
      executorInvoked: false,
      executorAvailable: false,
      executorWired: false,
      realExecution: false,
      controlledOutcome: outcome
    })
  );
  expect(isControlledExecutionArchitectureOnly(result)).toBe(true);
}

describe("Phase 45 — controlledRuntimeExecutionAdapter", () => {
  describe("constants", () => {
    test("exposes frozen outcomes, reasons, and phase", () => {
      expect(EXECUTION_ADAPTER_PHASE).toBe(45);
      expect(CONTROLLED_EXECUTION_OUTCOMES).toEqual({
        PREVIEW_ONLY: "preview_only",
        DRY_RUN: "dry_run",
        BLOCKED: "blocked",
        EXECUTOR_NOT_AVAILABLE: "executor_not_available"
      });
      expect([...SUPPORTED_CONTROLLED_EXECUTION_OUTCOMES].sort()).toEqual([
        "blocked",
        "dry_run",
        "executor_not_available",
        "preview_only"
      ]);
      expect(CONTROLLED_EXECUTION_REASONS).toEqual({
        VALID: "VALID",
        INVALID_INPUT: "INVALID_INPUT",
        INVALID_EXECUTION_CONTEXT: "INVALID_EXECUTION_CONTEXT",
        INVALID_PERSISTENCE_DECISION: "INVALID_PERSISTENCE_DECISION",
        INVALID_ENABLEMENT_DECISION: "INVALID_ENABLEMENT_DECISION",
        INVALID_EXECUTION_PLAN: "INVALID_EXECUTION_PLAN",
        INVALID_TRANSACTION_PLAN: "INVALID_TRANSACTION_PLAN",
        PREVIEW_MODE: "PREVIEW_MODE",
        DRY_RUN_MODE: "DRY_RUN_MODE",
        ENABLEMENT_BLOCKED: "ENABLEMENT_BLOCKED",
        LIVE_MODE_SAFETY_BLOCK: "LIVE_MODE_SAFETY_BLOCK",
        EXECUTOR_NOT_AVAILABLE: "EXECUTOR_NOT_AVAILABLE",
        EXECUTOR_NOT_WIRED: "EXECUTOR_NOT_WIRED",
        ARCHITECTURE_ONLY_GUARD: "ARCHITECTURE_ONLY_GUARD"
      });
      expect(Object.isFrozen(CONTROLLED_EXECUTION_OUTCOMES)).toBe(true);
      expect(Object.isFrozen(CONTROLLED_EXECUTION_REASONS)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_CONTROLLED_EXECUTION_OUTCOMES)).toBe(
        true
      );
    });
  });

  describe("preview path", () => {
    test("preview mode yields preview_only without execution", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.PREVIEW,
        action: PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        enablementFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        }
      });
      const result = adaptControlledRuntimeExecution(input);
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.PREVIEW_ONLY);
      expect(result.executionMode).toBe(CONTEXT_MODES.PREVIEW);
      expect(result.persistenceAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.blocked).toBe(false);
      expect(result.reasons).toEqual([
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD,
        CONTROLLED_EXECUTION_REASONS.PREVIEW_MODE
      ]);
      expect(result.metadata.wouldExecuteIfExecutorAvailable).toBe(false);
      expect(result.metadata.executorAvailable).toBe(false);
    });

    test("preview path uses policy→plan chain and remains advisory", () => {
      const persistenceDecision = evaluateRuntimePersistencePolicy(
        eligiblePolicyContext({
          runtimeMode: RUNTIME_MODES.PREVIEW,
          previewMode: true
        })
      );
      const executionPlan = buildPersistenceExecutionPlan(persistenceDecision);
      const transactionPlan = buildTransactionPlan(executionPlan);
      const result = adaptControlledRuntimeExecution({
        executionContext: contextFor(CONTEXT_MODES.PREVIEW),
        persistenceDecision,
        enablementDecision: enablementFor(ENABLEMENT_MODES.PREVIEW),
        executionPlan,
        transactionPlan
      });
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.PREVIEW_ONLY);
      expect(result.metadata.contextId).toBe("ctx_phase45");
      expect(result.metadata.correlationId).toBe("corr_phase45");
    });
  });

  describe("dry_run path", () => {
    test("dry_run mode yields dry_run without execution", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.DRY_RUN,
        action: PERSISTENCE_ACTIONS.PREVIEW_ONLY,
        enablementFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        }
      });
      const result = adaptControlledRuntimeExecution(input);
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.DRY_RUN);
      expect(result.executionMode).toBe(CONTEXT_MODES.DRY_RUN);
      expect(result.blocked).toBe(false);
      expect(result.reasons).toEqual([
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD,
        CONTROLLED_EXECUTION_REASONS.DRY_RUN_MODE
      ]);
      expect(result.metadata.realExecution).toBe(false);
      expect(result.metadata.wouldExecuteIfExecutorAvailable).toBe(false);
    });
  });

  describe("disabled live path", () => {
    test("live with default disabled enablement is blocked", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        action: PERSISTENCE_ACTIONS.PERSIST,
        enablementDecision: evaluatePersistenceEnablement(
          createDefaultEnablementConfig()
        )
      });
      const result = adaptControlledRuntimeExecution(input);
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
      expect(result.blocked).toBe(true);
      expect(result.executionMode).toBe(CONTEXT_MODES.LIVE);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          CONTROLLED_EXECUTION_REASONS.ENABLEMENT_BLOCKED,
          CONTROLLED_EXECUTION_REASONS.LIVE_MODE_SAFETY_BLOCK,
          CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD
        ])
      );
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          ENABLEMENT_REASONS.AUTOMATION_DISABLED,
          ENABLEMENT_REASONS.REVIEW_ENQUEUE_DISABLED
        ])
      );
      expect(result.metadata.enablementAllowed).toBe(false);
      expect(result.metadata.enablementBlocked).toBe(true);
      expect(result.metadata.wouldExecuteIfExecutorAvailable).toBe(false);
    });

    test("live with pipeline disabled is blocked", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        enablementFlags: {
          pipelineEnabled: false,
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        }
      });
      const result = adaptControlledRuntimeExecution(input);
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
      expect(result.reasons).toContain(ENABLEMENT_REASONS.PIPELINE_DISABLED);
    });
  });

  describe("enabled but executor missing path", () => {
    test("live + enablement allowed returns executor_not_available", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        action: PERSISTENCE_ACTIONS.PERSIST,
        enablementFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        }
      });
      const result = adaptControlledRuntimeExecution(input);
      assertOutcomeShell(
        result,
        CONTROLLED_EXECUTION_OUTCOMES.EXECUTOR_NOT_AVAILABLE
      );
      expect(result.blocked).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.reasons).toEqual([
        CONTROLLED_EXECUTION_REASONS.ARCHITECTURE_ONLY_GUARD,
        CONTROLLED_EXECUTION_REASONS.EXECUTOR_NOT_AVAILABLE,
        CONTROLLED_EXECUTION_REASONS.EXECUTOR_NOT_WIRED
      ]);
      expect(result.metadata.enablementAllowed).toBe(true);
      expect(result.metadata.wouldExecuteIfExecutorAvailable).toBe(true);
      expect(result.metadata.executorAvailable).toBe(false);
      expect(result.metadata.executorWired).toBe(false);
      expect(result.metadata.executorInvoked).toBe(false);
      expect(result.metadata.realExecution).toBe(false);
      expect(result.metadata.persistenceEnabled).toBe(false);
    });

    test("persistence-only capability allow still has no executor", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        action: PERSISTENCE_ACTIONS.PERSIST,
        capability: ENABLEMENT_CAPABILITIES.PERSISTENCE,
        enablementFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: false
        }
      });
      const result = adaptControlledRuntimeExecution(input);
      assertOutcomeShell(
        result,
        CONTROLLED_EXECUTION_OUTCOMES.EXECUTOR_NOT_AVAILABLE
      );
      expect(result.metadata.enablementAllowed).toBe(true);
    });
  });

  describe("invalid input", () => {
    test("null and non-object inputs are blocked", () => {
      for (const bad of [null, undefined, [], "x", 42, true]) {
        const result = adaptControlledRuntimeExecution(bad);
        assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
        expect(result.reasons).toContain(
          CONTROLLED_EXECUTION_REASONS.INVALID_INPUT
        );
        expect(result.metadata.validationErrors.length).toBeGreaterThan(0);
      }
    });

    test("missing or invalid execution context is blocked", () => {
      const base = adapterInput({ mode: CONTEXT_MODES.PREVIEW });
      const result = adaptControlledRuntimeExecution({
        ...base,
        executionContext: { executionMode: "preview" }
      });
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
      expect(result.reasons).toContain(
        CONTROLLED_EXECUTION_REASONS.INVALID_EXECUTION_CONTEXT
      );
    });

    test("invalid persistence decision is blocked", () => {
      const base = adapterInput({ mode: CONTEXT_MODES.PREVIEW });
      const result = adaptControlledRuntimeExecution({
        ...base,
        persistenceDecision: { action: "explode" }
      });
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
      expect(result.reasons).toContain(
        CONTROLLED_EXECUTION_REASONS.INVALID_PERSISTENCE_DECISION
      );
    });

    test("invalid enablement decision is blocked", () => {
      const base = adapterInput({ mode: CONTEXT_MODES.PREVIEW });
      const result = adaptControlledRuntimeExecution({
        ...base,
        enablementDecision: {
          allowed: true,
          blocked: false,
          architectureOnly: false,
          executed: false,
          advisory: true,
          metadata: {}
        }
      });
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
      expect(result.reasons).toContain(
        CONTROLLED_EXECUTION_REASONS.INVALID_ENABLEMENT_DECISION
      );
    });

    test("non architecture-only plans are blocked", () => {
      const base = adapterInput({ mode: CONTEXT_MODES.LIVE });
      const result = adaptControlledRuntimeExecution({
        ...base,
        executionPlan: {
          ...base.executionPlan,
          executable: true,
          architectureOnly: false
        }
      });
      assertOutcomeShell(result, CONTROLLED_EXECUTION_OUTCOMES.BLOCKED);
      expect(result.reasons).toContain(
        CONTROLLED_EXECUTION_REASONS.INVALID_EXECUTION_PLAN
      );
    });

    test("validateAdapterInput passes a well-formed bundle", () => {
      const input = adapterInput({ mode: CONTEXT_MODES.PREVIEW });
      const validation = validateAdapterInput(input);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.reasons).toEqual([CONTROLLED_EXECUTION_REASONS.VALID]);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs yield identical outcomes", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        enablementFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        }
      });
      expect(adaptControlledRuntimeExecution(input)).toEqual(
        adaptControlledRuntimeExecution(input)
      );
      expect(validateAdapterInput(input)).toEqual(validateAdapterInput(input));
    });

    test("reasons are sorted uniquely", () => {
      const result = adaptControlledRuntimeExecution(
        adapterInput({
          mode: CONTEXT_MODES.LIVE,
          enablementDecision: evaluatePersistenceEnablement(
            createDefaultEnablementConfig()
          )
        })
      );
      const sorted = [...result.reasons].sort((a, b) => a.localeCompare(b));
      expect(result.reasons).toEqual(sorted);
      expect(new Set(result.reasons).size).toBe(result.reasons.length);
      expect(result.reason).toBe(result.reasons[0]);
    });

    test("resolveControllingMode prefers context over enablement", () => {
      expect(
        resolveControllingMode(
          { executionMode: CONTEXT_MODES.PREVIEW },
          { executionMode: ENABLEMENT_MODES.LIVE }
        )
      ).toBe(CONTEXT_MODES.PREVIEW);
      expect(
        resolveControllingMode(null, {
          executionMode: ENABLEMENT_MODES.DRY_RUN
        })
      ).toBe(ENABLEMENT_MODES.DRY_RUN);
    });
  });

  describe("non-mutation", () => {
    test("adapter does not mutate input objects", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        enablementFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        }
      });
      const before = JSON.stringify(input);
      adaptControlledRuntimeExecution(input);
      validateAdapterInput(input);
      expect(JSON.stringify(input)).toBe(before);
    });

    test("mutating a prior outcome does not affect a fresh adaptation", () => {
      const input = adapterInput({ mode: CONTEXT_MODES.PREVIEW });
      const first = adaptControlledRuntimeExecution(input);
      first.executed = true;
      first.outcome = "live";
      first.metadata.persistenceEnabled = true;
      first.metadata.executorInvoked = true;
      first.reasons.push("LEAK");
      const second = adaptControlledRuntimeExecution(input);
      expect(second.executed).toBe(false);
      expect(second.outcome).toBe(CONTROLLED_EXECUTION_OUTCOMES.PREVIEW_ONLY);
      expect(second.metadata.persistenceEnabled).toBe(false);
      expect(second.metadata.executorInvoked).toBe(false);
      expect(second.reasons).not.toContain("LEAK");
    });

    test("returned featureState is a clone", () => {
      const input = adapterInput({
        mode: CONTEXT_MODES.LIVE,
        enablementDecision: evaluatePersistenceEnablement(
          createDefaultEnablementConfig()
        )
      });
      const result = adaptControlledRuntimeExecution(input);
      expect(result.metadata.featureState).toEqual(
        input.enablementDecision.featureState
      );
      result.metadata.featureState.automaticPersistenceEnabled = true;
      expect(
        input.enablementDecision.featureState.automaticPersistenceEnabled
      ).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("adapter module never performs real execution side effects", () => {
      const source = read(
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js"
      );
      expect(source).toMatch(/Phase 45/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never performs real execution/);
      expect(source).toMatch(/Never writes database data/);
      expect(source).toMatch(/Never calls repositories/);
      expect(source).toMatch(/Never starts transactions/);
      expect(source).toMatch(/Never enqueues queues/);
      expect(source).toMatch(/Never modifies workers/);
      expect(source).toMatch(/Never enables live automation/);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/createMysql/);
      expect(source).not.toMatch(/executeRuntimePersistence/);
      expect(source).not.toMatch(/simulateDryRunPersistence/);
      expect(source).not.toMatch(/previewRuntimeWiring/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/BEGIN|COMMIT|ROLLBACK/);
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/executorAvailable: false/);
      expect(source).toMatch(/realExecution: false/);
    });

    test("siteWorker is unchanged — adapter not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/controlledRuntimeExecutionAdapter/);
      expect(worker).not.toMatch(/adaptControlledRuntimeExecution/);
    });

    test("prior modules do not import the execution adapter", () => {
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
        "server/lib/recruitment/dryRunPersistenceSimulator.js",
        "server/lib/recruitment/reviewWorkflow.js",
        "server/lib/recruitment/persistenceEnablement.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/lib/recruitment/reviewQueue.js",
        "server/config/recruitmentPipeline.js",
        "server/config/recruitmentLifecycle.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/controlledRuntimeExecutionAdapter/);
        expect(source).not.toMatch(/adaptControlledRuntimeExecution/);
      }
    });

    test("prior phase modules are unchanged by this phase", () => {
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
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/persistenceEnablement.js": /Phase 44/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 45/);
      }
    });

    test("all outcome paths remain architecture-only and non-executing", () => {
      const samples = [
        adaptControlledRuntimeExecution(
          adapterInput({ mode: CONTEXT_MODES.PREVIEW })
        ),
        adaptControlledRuntimeExecution(
          adapterInput({ mode: CONTEXT_MODES.DRY_RUN })
        ),
        adaptControlledRuntimeExecution(
          adapterInput({
            mode: CONTEXT_MODES.LIVE,
            enablementDecision: evaluatePersistenceEnablement(
              createDefaultEnablementConfig()
            )
          })
        ),
        adaptControlledRuntimeExecution(
          adapterInput({
            mode: CONTEXT_MODES.LIVE,
            enablementFlags: {
              automaticPersistenceEnabled: true,
              reviewQueueEnqueueEnabled: true
            }
          })
        ),
        adaptControlledRuntimeExecution(null)
      ];

      for (const result of samples) {
        expect(result.executed).toBe(false);
        expect(result.architectureOnly).toBe(true);
        expect(result.advisory).toBe(true);
        expect(result.metadata.persistenceEnabled).toBe(false);
        expect(result.metadata.automationEnabled).toBe(false);
        expect(result.metadata.queueEnqueueEnabled).toBe(false);
        expect(result.metadata.sideEffects).toBe(false);
        expect(result.metadata.executorInvoked).toBe(false);
        expect(result.metadata.realExecution).toBe(false);
        expect(isControlledExecutionArchitectureOnly(result)).toBe(true);
      }
    });
  });
});
