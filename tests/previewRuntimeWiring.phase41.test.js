"use strict";

/**
 * Phase 41 — Preview-First Runtime Wiring tests.
 * Observation only: context → policy → service → plan → txn → audit → metadata.
 */

const fs = require("fs");
const path = require("path");

const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  PERSISTENCE_ACTIONS,
  RUNTIME_MODES
} = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  EXECUTION_MODES
} = require("../server/lib/recruitment/executionContext");
const {
  AUDIT_EVENT_TYPES
} = require("../server/lib/recruitment/auditTrail");
const {
  WIRING_PHASE,
  WIRING_REASONS,
  runPreviewRuntimeWiring,
  toPreviewAdvisoryMetadata,
  buildPreviewLifecycleArchitecture,
  buildPolicyContextFromRuntime
} = require("../server/lib/recruitment/previewRuntimeWiring");
const {
  resetRuntimePreviewBuffer,
  pushRuntimePreview,
  getRuntimePreviewById,
  recordRuntimePreviewFromPipeline
} = require("../server/lib/recruitment/runtimePreviewBuffer");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function eligibleInput(overrides = {}) {
  return {
    updateId: 9001,
    notice: {
      title: "SSC CGL 2026 Admit Card",
      content: "SSC CGL 2026 Admit Card",
      url: "https://ssc.nic.in/admit.pdf"
    },
    lookupSummary: {
      status: "ok",
      strategy: "advertisement_no",
      candidateCount: 1
    },
    eligibility: {
      eligible: true,
      status: ELIGIBILITY_STATUS.ELIGIBLE,
      reasons: ["CONFIDENCE_HIGH", "KNOWN_LIFECYCLE_EVENT"],
      confidence: "high",
      eventType: "admit_card",
      candidateCount: 1,
      matchResult: {
        match: true,
        confidence: "high",
        matchedSignals: ["ADVERTISEMENT_NUMBER"],
        conflictingSignals: []
      }
    },
    processorResult: {
      status: "success",
      eventType: "admit_card",
      warnings: [],
      selectedRecruitment: {
        id: "rec-42",
        lifecycle_state: "open"
      },
      matchResult: {
        match: true,
        confidence: "high",
        matchedSignals: ["ADVERTISEMENT_NUMBER"],
        conflictingSignals: []
      }
    },
    ...overrides
  };
}

function assertObservationOnly(result) {
  expect(result.observationOnly).toBe(true);
  expect(result.architectureOnly).toBe(true);
  expect(result.sideEffects).toBe(false);
  expect(result.metadata.sideEffects).toBe(false);
  expect(result.metadata.persistenceEnabled).toBe(false);
  expect(result.metadata.automationEnabled).toBe(false);
  expect(result.metadata.reviewQueueEnqueueEnabled).toBe(false);
}

describe("Phase 41 — previewRuntimeWiring", () => {
  describe("constants", () => {
    test("exposes wiring phase and reasons", () => {
      expect(WIRING_PHASE).toBe(41);
      expect(WIRING_REASONS).toEqual({
        ENABLED: "WIRING_ENABLED",
        DISABLED: "WIRING_DISABLED",
        INVALID_INPUT: "INVALID_INPUT"
      });
      expect(Object.isFrozen(WIRING_REASONS)).toBe(true);
    });
  });

  describe("preview runtime flow", () => {
    test("runs full observation chain and returns advisory artifacts", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());

      expect(result.enabled).toBe(true);
      assertObservationOnly(result);
      expect(result.reason).toBe(WIRING_REASONS.ENABLED);

      expect(result.context.executionMode).toBe(EXECUTION_MODES.PREVIEW);
      expect(result.context.sourceModule).toBe("previewRuntimeWiring");
      expect(result.context.architectureOnly).toBe(true);
      expect(result.context.recruitment.lifecycleEventType).toBe("admit_card");
      expect(result.context.recruitment.lifecycleState).toBe("open");
      expect(result.context.recruitment.recruitmentId).toBe("rec-42");
      expect(result.context.recruitment.eventRef).toBe("9001");

      expect(result.policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.policyDecision.metadata.previewMode).toBe(true);
      expect(result.policyDecision.metadata.automationEnabled).toBe(false);
      expect(result.policyDecision.metadata.intendedAction).toBe(
        PERSISTENCE_ACTIONS.PERSIST
      );

      expect(result.persistenceOutcome.advisory).toBe(true);
      expect(result.persistenceOutcome.actualAction).toBe(
        PERSISTENCE_ACTIONS.PREVIEW_ONLY
      );
      expect(result.persistenceOutcome.metadata.sideEffects).toBe(false);

      expect(result.executionPlan.executable).toBe(false);
      expect(result.executionPlan.architectureOnly).toBe(true);
      expect(result.executionPlan.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);

      expect(result.transactionPlan.executable).toBe(false);
      expect(result.transactionPlan.architectureOnly).toBe(true);
      expect(result.transactionPlan.metadata.transactionBegun).toBe(false);
      expect(result.transactionPlan.metadata.transactionCommitted).toBe(false);
      expect(result.transactionPlan.metadata.transactionRolledBack).toBe(false);

      expect(result.auditEvents).toHaveLength(4);
      expect(result.auditEvents.map((e) => e.eventType)).toEqual([
        AUDIT_EVENT_TYPES.POLICY_DECISION,
        AUDIT_EVENT_TYPES.EXECUTION_PLAN,
        AUDIT_EVENT_TYPES.TRANSACTION_PLAN,
        AUDIT_EVENT_TYPES.PERSISTENCE_OUTCOME
      ]);
      for (const event of result.auditEvents) {
        expect(event.architectureOnly).toBe(true);
        expect(event.persisted).toBe(false);
        expect(event.written).toBe(false);
        expect(event.correlation.correlationId).toBe(result.context.correlationId);
      }
      expect(result.metadata.contextArchitectureOnly).toBe(true);
      expect(result.metadata.planArchitectureOnly).toBe(true);
      expect(result.metadata.transactionArchitectureOnly).toBe(true);
      expect(result.metadata.auditsArchitectureOnly).toBe(true);
    });

    test("manual-review eligibility still ends as preview_only under preview wiring", () => {
      const result = runPreviewRuntimeWiring(
        eligibleInput({
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            reasons: ["UNKNOWN_MATCH"],
            confidence: "medium",
            eventType: "admit_card",
            candidateCount: 2,
            matchResult: {
              match: "unknown",
              confidence: "medium",
              matchedSignals: [],
              conflictingSignals: []
            }
          }
        })
      );

      expect(result.policyDecision.metadata.intendedAction).toBe(
        PERSISTENCE_ACTIONS.REVIEW
      );
      expect(result.policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.persistenceOutcome.actualAction).toBe(
        PERSISTENCE_ACTIONS.PREVIEW_ONLY
      );
      expect(result.executionPlan.executable).toBe(false);
    });
  });

  describe("context propagation", () => {
    test("audit events share correlation and parent-event linkage", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());
      const [policy, plan, txn, outcome] = result.auditEvents;

      expect(policy.correlation.correlationId).toBe(result.context.correlationId);
      expect(plan.correlation.correlationId).toBe(result.context.correlationId);
      expect(txn.correlation.correlationId).toBe(result.context.correlationId);
      expect(outcome.correlation.correlationId).toBe(result.context.correlationId);

      expect(plan.correlation.parentEventId).toBe(policy.eventId);
      expect(txn.correlation.parentEventId).toBe(plan.eventId);
      expect(outcome.correlation.parentEventId).toBe(txn.eventId);

      expect(policy.correlation.pipelineStage).toBe("policy");
      expect(plan.correlation.pipelineStage).toBe("pipeline");
      expect(txn.correlation.pipelineStage).toBe("transaction");
      expect(outcome.correlation.pipelineStage).toBe("outcome");
    });

    test("buildPolicyContextFromRuntime forces preview and disables automation", () => {
      const ctx = buildPolicyContextFromRuntime(
        eligibleInput({
          featureFlags: {
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true,
            pipelineEnabled: true
          }
        })
      );

      expect(ctx.previewMode).toBe(true);
      expect(ctx.runtimeMode).toBe(RUNTIME_MODES.PREVIEW);
      expect(ctx.featureFlags.automaticPersistenceEnabled).toBe(false);
      expect(ctx.featureFlags.reviewQueueEnqueueEnabled).toBe(false);
      expect(ctx.featureFlags.pipelineEnabled).toBe(true);
      expect(ctx.existingRecruitmentMatch).toBe(null);
    });
  });

  describe("policy → service → pipeline → transaction → audit chain", () => {
    test("intended persist is coerced and blocked without side effects", () => {
      const result = runPreviewRuntimeWiring(eligibleInput());

      expect(result.policyDecision.metadata.wouldPersistIfAutomationEnabled).toBe(
        true
      );
      expect(result.policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.persistenceOutcome.executed).toBe(true);
      expect(result.persistenceOutcome.executionBlocked).toBe(false);
      expect(result.executionPlan.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.transactionPlan.transactionRequired).toBe(false);
      expect(result.auditEvents[0].action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.auditEvents[3].context.executed).toBe(true);
    });

    test("ineligible path produces skip chain still without writes", () => {
      const result = runPreviewRuntimeWiring(
        eligibleInput({
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.INELIGIBLE,
            reasons: ["MATCH_FALSE"],
            confidence: "low",
            eventType: "admit_card",
            candidateCount: 1,
            matchResult: {
              match: false,
              confidence: "low",
              matchedSignals: [],
              conflictingSignals: ["POST_NAME"]
            }
          }
        })
      );

      expect(result.policyDecision.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.persistenceOutcome.actualAction).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.executionPlan.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.executionPlan.executable).toBe(false);
      expect(result.transactionPlan.transactionRequired).toBe(false);
      assertObservationOnly(result);
    });
  });

  describe("disabled path", () => {
    test("enabled:false returns disabled stub without artifacts", () => {
      const result = runPreviewRuntimeWiring(
        eligibleInput({ enabled: false })
      );

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe(WIRING_REASONS.DISABLED);
      expect(result.context).toBe(null);
      expect(result.policyDecision).toBe(null);
      expect(result.persistenceOutcome).toBe(null);
      expect(result.executionPlan).toBe(null);
      expect(result.transactionPlan).toBe(null);
      expect(result.auditEvents).toEqual([]);
      expect(result.metadata.callerDisabled).toBe(true);
      assertObservationOnly(result);
    });

    test("non-object input returns INVALID_INPUT stub", () => {
      const result = runPreviewRuntimeWiring(null);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe(WIRING_REASONS.INVALID_INPUT);
      expect(result.auditEvents).toEqual([]);
    });

    test("toPreviewAdvisoryMetadata projects disabled stubs", () => {
      const meta = toPreviewAdvisoryMetadata(
        runPreviewRuntimeWiring({ enabled: false })
      );
      expect(meta.enabled).toBe(false);
      expect(meta.wiringPhase).toBe(41);
      expect(meta.sideEffects).toBe(false);
      expect(meta.persistenceEnabled).toBe(false);
      expect(meta.automationEnabled).toBe(false);
      expect(meta.auditEventCount).toBe(0);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical wiring results", () => {
      const input = eligibleInput();
      expect(runPreviewRuntimeWiring(input)).toEqual(runPreviewRuntimeWiring(input));
    });

    test("advisory metadata projection is stable", () => {
      const input = eligibleInput();
      const a = toPreviewAdvisoryMetadata(runPreviewRuntimeWiring(input));
      const b = toPreviewAdvisoryMetadata(runPreviewRuntimeWiring(input));
      expect(a).toEqual(b);
      expect(a.enabled).toBe(true);
      expect(a.wiringPhase).toBe(41);
      expect(a.auditEvents).toHaveLength(4);
      expect(a.policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(a.executionPlan.executable).toBe(false);
      expect(a.transactionPlan.transactionBegun).toBe(false);
    });

    test("does not mutate caller input objects", () => {
      const input = eligibleInput();
      const before = JSON.stringify(input);
      runPreviewRuntimeWiring(input);
      expect(JSON.stringify(input)).toBe(before);
    });
  });

  describe("preview metadata attachment", () => {
    beforeEach(() => {
      resetRuntimePreviewBuffer();
    });

    test("pushRuntimePreview stores lifecycleArchitecture additively", () => {
      const meta = buildPreviewLifecycleArchitecture(eligibleInput());
      const entry = pushRuntimePreview({
        monitoredSite: { id: 1, name: "SSC", url: "https://ssc.nic.in" },
        notice: eligibleInput().notice,
        processorResult: eligibleInput().processorResult,
        updateId: 42,
        eligibility: eligibleInput().eligibility,
        lifecycleArchitecture: meta
      });

      expect(entry.lifecycleArchitecture).toEqual(meta);
      expect(entry.lifecycleArchitecture.observationOnly).toBe(true);
      expect(entry.lifecycleArchitecture.enabled).toBe(true);
      expect(getRuntimePreviewById(entry.id).lifecycleArchitecture).toEqual(meta);
    });

    test("omitted lifecycleArchitecture stores null without breaking entry shape", () => {
      const entry = pushRuntimePreview({
        notice: { title: "x", content: "x", url: "" },
        processorResult: {
          status: "success",
          eventType: "admit_card",
          warnings: []
        }
      });
      expect(entry.lifecycleArchitecture).toBe(null);
      expect(entry.eligibility).toBe(null);
      expect(entry.updateId).toBe(null);
    });

    test("recordRuntimePreviewFromPipeline forwards lifecycleArchitecture", () => {
      const meta = buildPreviewLifecycleArchitecture(eligibleInput());
      const stored = recordRuntimePreviewFromPipeline({
        pipelineOutcome: {
          skipped: false,
          failed: false,
          result: eligibleInput().processorResult
        },
        notice: eligibleInput().notice,
        updateId: 77,
        eligibility: eligibleInput().eligibility,
        lifecycleArchitecture: meta
      });
      expect(stored).not.toBe(null);
      expect(stored.lifecycleArchitecture.wiringPhase).toBe(41);
      expect(stored.lifecycleArchitecture.policyDecision.action).toBe(
        PERSISTENCE_ACTIONS.PREVIEW_ONLY
      );
    });
  });

  describe("existing behavior preservation", () => {
    test("worker still records previews only when pipeline flag block runs", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).toMatch(/isRecruitmentPipelineEnabled/);
      expect(worker).toMatch(/recordRuntimePreviewFromPipeline/);
      expect(worker).toMatch(/evaluateRecruitmentEligibility/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).toMatch(/buildPreviewLifecycleArchitecture/);
      expect(worker).not.toMatch(/saveReviewItem/);
      expect(worker).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(worker).not.toMatch(/beginTransaction|\.commit\(|\.rollback\(/);
    });

    test("worker does not import persistence architecture modules directly", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).toMatch(/previewRuntimeWiring/);
      expect(worker).not.toMatch(/executionContext/);
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/persistenceExecutionPipeline/);
      expect(worker).not.toMatch(/transactionCoordinator/);
      expect(worker).not.toMatch(/auditTrail/);
      expect(worker).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(worker).not.toMatch(/createMysql/);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("wiring module is observation-only and never enables automation", () => {
      const source = read("server/lib/recruitment/previewRuntimeWiring.js");
      expect(source).toMatch(/Phase 41/);
      expect(source).toMatch(/observation only/i);
      expect(source).toMatch(/Never writes to a database/);
      expect(source).toMatch(/automaticPersistenceEnabled: false/);
      expect(source).toMatch(/reviewQueueEnqueueEnabled: false/);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/createMysql/);
      expect(source).not.toMatch(/getConnection/);
      expect(source).not.toMatch(/\.beginTransaction\s*\(/);
      expect(source).not.toMatch(/\.commit\s*\(/);
      expect(source).not.toMatch(/\.rollback\s*\(/);
      expect(source).not.toMatch(/automaticPersistenceEnabled:\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled:\s*true/);
      expect(source).not.toMatch(/writeFile|appendFile|mkdir/i);
    });

    test("wiring requires only architecture modules (no adapters / repos)", () => {
      const source = read("server/lib/recruitment/previewRuntimeWiring.js");
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires.sort()).toEqual(
        [
          "./auditTrail",
          "./executionContext",
          "./persistenceExecutionPipeline",
          "./runtimeCapabilityObservation",
          "./runtimeCapabilityRegistryIntegration",
          "./runtimePersistencePolicy",
          "./runtimePersistenceService",
          "./transactionCoordinator"
        ].sort()
      );
    });

    test("preview buffer stays free of architecture orchestration requires", () => {
      const buffer = read("server/lib/recruitment/runtimePreviewBuffer.js");
      expect(buffer).toMatch(/lifecycleArchitecture/);
      expect(buffer).not.toMatch(/previewRuntimeWiring/);
      expect(buffer).not.toMatch(/evaluateRuntimePersistencePolicy/);
      expect(buffer).not.toMatch(/executeRuntimePersistence/);
      expect(buffer).not.toMatch(/buildPersistenceExecutionPlan/);
      expect(buffer).not.toMatch(/buildTransactionPlan/);
      expect(buffer).not.toMatch(/createAuditEvent/);
      expect(buffer).not.toMatch(/createExecutionContext/);
    });

    test("prior phase modules are not rewritten by this phase", () => {
      const files = [
        ["server/lib/recruitment/runtimePersistencePolicy.js", "Phase 33"],
        ["server/lib/recruitment/runtimePersistenceService.js", "Phase 34"],
        ["server/lib/recruitment/persistenceRepositoryContracts.js", "Phase 35"],
        [
          "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
          "Phase 36"
        ],
        ["server/lib/recruitment/persistenceExecutionPipeline.js", "Phase 37"],
        ["server/lib/recruitment/transactionCoordinator.js", "Phase 38"],
        ["server/lib/recruitment/auditTrail.js", "Phase 39"],
        ["server/lib/recruitment/executionContext.js", "Phase 40"]
      ];
      for (const [rel, marker] of files) {
        const source = read(rel);
        expect(source).toMatch(new RegExp(marker));
        expect(source).not.toMatch(/Phase 41/);
        expect(source).not.toMatch(/previewRuntimeWiring/);
      }
    });
  });
});
