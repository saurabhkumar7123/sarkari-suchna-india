"use strict";

/**
 * Phase 34 — Runtime Persistence Service tests.
 * Architecture only: interprets policy decisions with no side effects.
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
  EXECUTION_BLOCK_REASONS,
  executeRuntimePersistence
} = require("../server/lib/recruitment/runtimePersistenceService");
const {
  ELIGIBILITY_STATUS
} = require("../server/lib/recruitment/recruitmentEligibility");

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

function decisionFromPolicy(contextOverrides = {}) {
  return evaluateRuntimePersistencePolicy(
    eligiblePolicyContext(contextOverrides)
  );
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

describe("Phase 34 — runtimePersistenceService", () => {
  describe("constants", () => {
    test("exposes frozen execution block reasons", () => {
      expect(EXECUTION_BLOCK_REASONS).toEqual({
        INVALID_DECISION: "INVALID_DECISION",
        UNKNOWN_ACTION: "UNKNOWN_ACTION",
        AUTOMATION_DISABLED: "AUTOMATION_DISABLED",
        REVIEW_ENQUEUE_DISABLED: "REVIEW_ENQUEUE_DISABLED",
        EXECUTION_NOT_IMPLEMENTED: "EXECUTION_NOT_IMPLEMENTED"
      });
      expect(Object.isFrozen(EXECUTION_BLOCK_REASONS)).toBe(true);
    });
  });

  describe("persist action", () => {
    test("persist with automation off → blocked as preview_only", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.PERSIST, {
          metadata: { automationEnabled: false }
        })
      );

      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.executed).toBe(false);
      expect(result.executionBlocked).toBe(true);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.AUTOMATION_DISABLED
      );
      expect(result.metadata.sideEffects).toBe(false);
      expect(result.metadata.wouldPersistIfImplemented).toBe(true);
    });

    test("persist with automation on still blocked (architecture only)", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.PERSIST, {
          metadata: { automationEnabled: true }
        }),
        { automaticPersistenceEnabled: true }
      );

      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.executed).toBe(false);
      expect(result.executionBlocked).toBe(true);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.EXECUTION_NOT_IMPLEMENTED
      );
      expect(result.metadata.automaticPersistenceEnabled).toBe(true);
    });

    test("options.automaticPersistenceEnabled overrides policy metadata", () => {
      const withOverride = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.PERSIST, {
          metadata: { automationEnabled: true }
        }),
        { automaticPersistenceEnabled: false }
      );
      expect(withOverride.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.AUTOMATION_DISABLED
      );
      expect(withOverride.actualAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
    });

    test("policy decision for eligible+automation-off flows to blocked persist path via preview_only", () => {
      const policyDecision = decisionFromPolicy();
      expect(policyDecision.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(policyDecision.metadata.intendedAction).toBe(
        PERSISTENCE_ACTIONS.PERSIST
      );

      const result = executeRuntimePersistence(policyDecision);
      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.executed).toBe(true);
      expect(result.executionBlocked).toBe(false);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBeNull();
      expect(result.metadata.policyIntendedAction).toBe(
        PERSISTENCE_ACTIONS.PERSIST
      );
    });
  });

  describe("review action", () => {
    test("review with enqueue off → blocked advisory", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.REVIEW, {
          metadata: { reviewQueueEnqueueEnabled: false }
        })
      );

      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.executed).toBe(false);
      expect(result.executionBlocked).toBe(true);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.REVIEW_ENQUEUE_DISABLED
      );
      expect(result.metadata.wouldReviewIfImplemented).toBe(true);
    });

    test("review with enqueue on still blocked (architecture only)", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.REVIEW, {
          metadata: { reviewQueueEnqueueEnabled: true }
        }),
        { reviewQueueEnqueueEnabled: true }
      );

      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.executed).toBe(false);
      expect(result.executionBlocked).toBe(true);
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.EXECUTION_NOT_IMPLEMENTED
      );
    });

    test("options.reviewQueueEnqueueEnabled overrides policy metadata", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.REVIEW, {
          metadata: { reviewQueueEnqueueEnabled: true }
        }),
        { reviewQueueEnqueueEnabled: false }
      );
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.REVIEW_ENQUEUE_DISABLED
      );
    });

    test("policy review decision executes as blocked advisory", () => {
      const policyDecision = decisionFromPolicy({
        eligibility: {
          eligible: false,
          status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
          confidence: "medium",
          eventType: "admit_card"
        },
        matcherConfidence: "medium",
        featureFlags: {
          pipelineEnabled: true,
          automaticPersistenceEnabled: false,
          reviewQueueEnqueueEnabled: false
        }
      });
      expect(policyDecision.action).toBe(PERSISTENCE_ACTIONS.REVIEW);

      const result = executeRuntimePersistence(policyDecision);
      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.executed).toBe(false);
      expect(result.executionBlocked).toBe(true);
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.REVIEW_ENQUEUE_DISABLED
      );
      expect(result.metadata.policyReasons).toEqual(policyDecision.reasons);
    });
  });

  describe("preview_only action", () => {
    test("preview_only completes as advisory no-op", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.PREVIEW_ONLY, {
          reason: PERSISTENCE_REASONS.AUTOMATION_DISABLED,
          reasons: [
            PERSISTENCE_REASONS.AUTOMATION_DISABLED,
            PERSISTENCE_REASONS.ELIGIBLE_HIGH_CONFIDENCE
          ]
        })
      );

      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.executed).toBe(true);
      expect(result.executionBlocked).toBe(false);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBeNull();
      expect(result.metadata.noop).toBe(true);
      expect(result.metadata.sideEffects).toBe(false);
    });
  });

  describe("skip action", () => {
    test("skip completes as advisory no-op", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.SKIP, {
          reason: PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE,
          reasons: [PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE]
        })
      );

      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.executed).toBe(true);
      expect(result.executionBlocked).toBe(false);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBeNull();
      expect(result.metadata.noop).toBe(true);
    });

    test("policy skip decision executes as no-op", () => {
      const policyDecision = decisionFromPolicy({
        existingRecruitmentMatch: { recruitmentId: 42 }
      });
      expect(policyDecision.action).toBe(PERSISTENCE_ACTIONS.SKIP);

      const result = executeRuntimePersistence(policyDecision);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.executed).toBe(true);
      expect(result.executionBlocked).toBe(false);
      expect(result.blockReason).toBeNull();
    });
  });

  describe("unknown action", () => {
    test("unknown action fails safe to skip", () => {
      const result = executeRuntimePersistence(
        decision("wipe_database", {
          reason: "BOGUS",
          reasons: ["BOGUS"]
        })
      );

      expect(result.intendedAction).toBe("wipe_database");
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.executed).toBe(false);
      expect(result.executionBlocked).toBe(true);
      expect(result.advisory).toBe(true);
      expect(result.blockReason).toBe(EXECUTION_BLOCK_REASONS.UNKNOWN_ACTION);
    });

    test("empty / blank action fails safe", () => {
      for (const action of ["", "   ", null, undefined]) {
        const result = executeRuntimePersistence({
          action,
          reason: "X",
          reasons: ["X"],
          metadata: {}
        });
        expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.SKIP);
        expect(result.executed).toBe(false);
        expect(result.executionBlocked).toBe(true);
        expect(result.blockReason).toBe(EXECUTION_BLOCK_REASONS.UNKNOWN_ACTION);
      }
    });

    test("action is normalized case-insensitively for known actions", () => {
      const result = executeRuntimePersistence({
        action: "PREVIEW_ONLY",
        reason: "X",
        reasons: ["X"],
        metadata: {}
      });
      expect(result.intendedAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.executed).toBe(true);
      expect(result.executionBlocked).toBe(false);
    });
  });

  describe("invalid input", () => {
    test("null / non-object decision → INVALID_DECISION skip", () => {
      for (const input of [null, undefined, [], "x", 1, true]) {
        const result = executeRuntimePersistence(input);
        expect(result.intendedAction).toBeNull();
        expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.SKIP);
        expect(result.executed).toBe(false);
        expect(result.executionBlocked).toBe(true);
        expect(result.advisory).toBe(true);
        expect(result.blockReason).toBe(
          EXECUTION_BLOCK_REASONS.INVALID_DECISION
        );
        expect(result.metadata.sideEffects).toBe(false);
        expect(result.metadata.architectureOnly).toBe(true);
      }
    });

    test("invalid options shape is ignored (defaults apply)", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.PERSIST, {
          metadata: { automationEnabled: false }
        }),
        null
      );
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.AUTOMATION_DISABLED
      );
    });
  });

  describe("automation disabled", () => {
    test("default automation is off when metadata omits flag", () => {
      const result = executeRuntimePersistence({
        action: PERSISTENCE_ACTIONS.PERSIST,
        reason: "X",
        reasons: ["X"],
        metadata: {}
      });
      expect(result.metadata.automaticPersistenceEnabled).toBe(false);
      expect(result.blockReason).toBe(
        EXECUTION_BLOCK_REASONS.AUTOMATION_DISABLED
      );
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
    });

    test("policy automation-disabled decision never surfaces executed writes", () => {
      const policyDecision = decisionFromPolicy({
        featureFlags: {
          pipelineEnabled: true,
          automaticPersistenceEnabled: false
        }
      });
      const result = executeRuntimePersistence(policyDecision);
      expect(result.executed).toBe(true);
      expect(result.actualAction).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.metadata.sideEffects).toBe(false);
      expect(result.advisory).toBe(true);
    });
  });

  describe("execution metadata shape", () => {
    test("result always includes required execution metadata fields", () => {
      const result = executeRuntimePersistence(
        decision(PERSISTENCE_ACTIONS.SKIP)
      );
      expect(result).toEqual(
        expect.objectContaining({
          intendedAction: expect.any(String),
          actualAction: expect.any(String),
          executed: expect.any(Boolean),
          executionBlocked: expect.any(Boolean),
          advisory: true,
          blockReason: null,
          metadata: expect.any(Object)
        })
      );
      expect(result.metadata).toEqual(
        expect.objectContaining({
          policyAction: PERSISTENCE_ACTIONS.SKIP,
          policyReason: expect.any(String),
          policyReasons: expect.any(Array),
          automaticPersistenceEnabled: expect.any(Boolean),
          reviewQueueEnqueueEnabled: expect.any(Boolean),
          sideEffects: false,
          architectureOnly: true
        })
      );
    });

    test("copies policy metadata without sharing references", () => {
      const input = decision(PERSISTENCE_ACTIONS.PREVIEW_ONLY, {
        metadata: { automationEnabled: false, custom: { nested: 1 } }
      });
      const result = executeRuntimePersistence(input);
      expect(result.metadata.policyMetadata).toEqual(input.metadata);
      expect(result.metadata.policyMetadata).not.toBe(input.metadata);
      result.metadata.policyMetadata.custom = { nested: 99 };
      expect(input.metadata.custom).toEqual({ nested: 1 });
    });
  });

  describe("deterministic / pure behavior", () => {
    test("identical input yields identical output", () => {
      const input = decision(PERSISTENCE_ACTIONS.PERSIST, {
        metadata: { automationEnabled: true }
      });
      const options = { automaticPersistenceEnabled: true };
      const a = executeRuntimePersistence(input, options);
      const b = executeRuntimePersistence(input, options);
      expect(a).toEqual(b);
    });

    test("does not mutate decision or options", () => {
      const input = decision(PERSISTENCE_ACTIONS.REVIEW, {
        reasons: ["B", "A"],
        metadata: { reviewQueueEnqueueEnabled: false, marker: "keep" }
      });
      const options = { reviewQueueEnqueueEnabled: false, marker: "opts" };
      const beforeDecision = JSON.stringify(input);
      const beforeOptions = JSON.stringify(options);
      executeRuntimePersistence(input, options);
      expect(JSON.stringify(input)).toBe(beforeDecision);
      expect(JSON.stringify(options)).toBe(beforeOptions);
    });

    test("end-to-end policy → service is deterministic", () => {
      const ctx = eligiblePolicyContext();
      const d1 = evaluateRuntimePersistencePolicy(ctx);
      const d2 = evaluateRuntimePersistencePolicy(ctx);
      expect(d1).toEqual(d2);
      expect(executeRuntimePersistence(d1)).toEqual(
        executeRuntimePersistence(d2)
      );
    });
  });

  describe("architecture boundaries (source)", () => {
    test("service module has no DB / Express / queue / filesystem side effects", () => {
      const source = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      expect(source).toMatch(/Phase 34/);
      expect(source).toMatch(/Never writes/);
      expect(source).not.toMatch(/mysql|createPool|INSERT INTO/i);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/recordRuntimePreview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
    });

    test("siteWorker is unchanged — service not wired (no behavior change)", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/executeRuntimePersistence/);
      expect(worker).not.toMatch(/EXECUTION_BLOCK_REASONS/);
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).not.toMatch(/evaluateRuntimePersistencePolicy/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
    });

    test("service is not imported by preview buffer, review service, or policy", () => {
      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const reviewService = read(
        "server/services/recruitmentReview.service.js"
      );
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      expect(preview).not.toMatch(/runtimePersistenceService/);
      expect(reviewService).not.toMatch(/runtimePersistenceService/);
      expect(policy).not.toMatch(/runtimePersistenceService/);
      expect(policy).not.toMatch(/executeRuntimePersistence/);
    });

    test("service only imports the persistence policy module", () => {
      const source = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual(["./runtimePersistencePolicy"]);
    });
  });
});
