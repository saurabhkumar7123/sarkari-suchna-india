"use strict";

/**
 * Phase 33 — Safe Runtime Persistence Policy tests.
 * Architecture only: no DB writes, no worker wiring, no side effects.
 */

const fs = require("fs");
const path = require("path");

const {
  PERSISTENCE_ACTIONS,
  PERSISTENCE_REASONS,
  RUNTIME_MODES,
  SUPPORTED_LIFECYCLE_STATES,
  evaluateRuntimePersistencePolicy
} = require("../server/lib/recruitment/runtimePersistencePolicy");
const {
  ELIGIBILITY_STATUS,
  evaluateRecruitmentEligibility
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  processRecruitmentDetection
} = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for Tier 1 Advertisement Number CGL-01/2026",
    url: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
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
    lifecycle_state: "open",
    ...overrides
  };
}

function eligibleContext(overrides = {}) {
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

describe("Phase 33 — runtimePersistencePolicy", () => {
  describe("constants", () => {
    test("exposes frozen action / reason / mode maps", () => {
      expect(PERSISTENCE_ACTIONS).toEqual({
        PERSIST: "persist",
        REVIEW: "review",
        PREVIEW_ONLY: "preview_only",
        SKIP: "skip"
      });
      expect(RUNTIME_MODES).toEqual({
        LIVE: "live",
        PREVIEW: "preview",
        DRY_RUN: "dry_run"
      });
      expect(SUPPORTED_LIFECYCLE_STATES).toEqual([
        "announced",
        "open",
        "exam_scheduled",
        "post_exam",
        "results",
        "closed"
      ]);
      expect(Object.isFrozen(PERSISTENCE_ACTIONS)).toBe(true);
      expect(Object.isFrozen(PERSISTENCE_REASONS)).toBe(true);
      expect(Object.isFrozen(RUNTIME_MODES)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_LIFECYCLE_STATES)).toBe(true);
      expect(PERSISTENCE_REASONS.AUTOMATION_DISABLED).toBe("AUTOMATION_DISABLED");
      expect(PERSISTENCE_REASONS.PREVIEW_MODE).toBe("PREVIEW_MODE");
    });
  });

  describe("skip decisions", () => {
    test("null / non-object context → skip INVALID_CONTEXT", () => {
      for (const input of [null, undefined, [], "x", 1]) {
        const result = evaluateRuntimePersistencePolicy(input);
        expect(result.action).toBe(PERSISTENCE_ACTIONS.SKIP);
        expect(result.reasons).toContain(PERSISTENCE_REASONS.INVALID_CONTEXT);
        expect(result.reason).toBe(PERSISTENCE_REASONS.INVALID_CONTEXT);
      }
    });

    test("pipeline disabled → skip", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          featureFlags: {
            pipelineEnabled: false,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.reasons).toEqual([PERSISTENCE_REASONS.PIPELINE_DISABLED]);
      expect(result.metadata.pipelineEnabled).toBe(false);
    });

    test("ineligible eligibility → skip", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.INELIGIBLE,
            confidence: "high",
            eventType: "admit_card"
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE);
    });

    test("existing recruitment match → skip", () => {
      const byObject = evaluateRuntimePersistencePolicy(
        eligibleContext({
          existingRecruitmentMatch: { recruitmentId: 42, updateId: 9 }
        })
      );
      const byId = evaluateRuntimePersistencePolicy(
        eligibleContext({ existingRecruitmentMatch: 42 })
      );
      const byString = evaluateRuntimePersistencePolicy(
        eligibleContext({ existingRecruitmentMatch: "rec-42" })
      );

      expect(byObject.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(byObject.reasons).toContain(PERSISTENCE_REASONS.EXISTING_RECRUITMENT_MATCH);
      expect(byId.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(byString.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(byObject.metadata.hasExistingRecruitmentMatch).toBe(true);
    });

    test("unsupported lifecycle state → skip", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({ lifecycleState: "archived" })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.UNSUPPORTED_LIFECYCLE_STATE);
    });

    test("custom supportedLifecycleStates override works", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          lifecycleState: "open",
          supportedLifecycleStates: ["announced"]
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.UNSUPPORTED_LIFECYCLE_STATE);
    });
  });

  describe("preview_only decisions (safe default)", () => {
    test("eligible + high confidence but automation off → preview_only", () => {
      const result = evaluateRuntimePersistencePolicy(eligibleContext());

      expect(result.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.AUTOMATION_DISABLED);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.ELIGIBLE_HIGH_CONFIDENCE);
      expect(result.metadata.intendedAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.metadata.wouldPersistIfAutomationEnabled).toBe(true);
      expect(result.metadata.automationEnabled).toBe(false);
    });

    test("omitted automaticPersistenceEnabled defaults to false", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          featureFlags: { pipelineEnabled: true }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.AUTOMATION_DISABLED);
      expect(result.metadata.automationEnabled).toBe(false);
    });

    test("previewMode coerces persist intent to preview_only", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          previewMode: true,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.PREVIEW_MODE);
      expect(result.metadata.intendedAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
    });

    test("runtimeMode preview / dry_run coerce to preview_only", () => {
      const preview = evaluateRuntimePersistencePolicy(
        eligibleContext({
          runtimeMode: RUNTIME_MODES.PREVIEW,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      const dryRun = evaluateRuntimePersistencePolicy(
        eligibleContext({
          runtimeMode: RUNTIME_MODES.DRY_RUN,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );

      expect(preview.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(preview.reasons).toContain(PERSISTENCE_REASONS.PREVIEW_MODE);
      expect(dryRun.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(dryRun.reasons).toContain(PERSISTENCE_REASONS.DRY_RUN_MODE);
    });

    test("previewMode coerces review intent to preview_only", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          previewMode: true,
          reviewRequired: true,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.metadata.intendedAction).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.metadata.wouldReviewIfEnqueueEnabled).toBe(true);
    });
  });

  describe("persist decisions (flag-gated only)", () => {
    test("eligible + high confidence + automation on + live → persist", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: false
          }
        })
      );

      expect(result.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          PERSISTENCE_REASONS.ELIGIBLE_HIGH_CONFIDENCE,
          PERSISTENCE_REASONS.KNOWN_LIFECYCLE_EVENT,
          PERSISTENCE_REASONS.MATCH_TRUE,
          PERSISTENCE_REASONS.SUPPORTED_LIFECYCLE_STATE
        ])
      );
      expect(result.metadata.intendedAction).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.metadata.wouldPersistIfAutomationEnabled).toBe(true);
    });

    test("persist allowed when lifecycleState omitted", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          lifecycleState: null,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.reasons).not.toContain(PERSISTENCE_REASONS.SUPPORTED_LIFECYCLE_STATE);
    });

    test("all supported lifecycle states can persist when gates pass", () => {
      for (const state of SUPPORTED_LIFECYCLE_STATES) {
        const result = evaluateRuntimePersistencePolicy(
          eligibleContext({
            lifecycleState: state,
            featureFlags: {
              pipelineEnabled: true,
              automaticPersistenceEnabled: true
            }
          })
        );
        expect(result.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      }
    });
  });

  describe("review decisions", () => {
    test("reviewRequired → review", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          reviewRequired: true,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.REVIEW_REQUIRED);
      expect(result.metadata.wouldPersistIfAutomationEnabled).toBe(false);
      expect(result.metadata.wouldReviewIfEnqueueEnabled).toBe(true);
    });

    test("eligibility manual_review → review", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            confidence: "medium",
            eventType: "admit_card"
          },
          matcherConfidence: "medium",
          matchResult: {
            match: true,
            confidence: "medium",
            matchedSignals: ["ORGANIZATION"],
            conflictingSignals: []
          },
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          PERSISTENCE_REASONS.ELIGIBILITY_MANUAL_REVIEW,
          PERSISTENCE_REASONS.MEDIUM_CONFIDENCE
        ])
      );
    });

    test("unknown event type → review", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          eventType: "unknown",
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            confidence: "high",
            eventType: "unknown"
          },
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.UNKNOWN_EVENT);
    });

    test("low / none confidence → review", () => {
      const low = evaluateRuntimePersistencePolicy(
        eligibleContext({
          matcherConfidence: "low",
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            confidence: "low",
            eventType: "admit_card"
          },
          matchResult: {
            match: "unknown",
            confidence: "low",
            matchedSignals: [],
            conflictingSignals: []
          },
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(low.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(low.reasons).toContain(PERSISTENCE_REASONS.LOW_OR_NONE_CONFIDENCE);
    });

    test("missing eligibility → review (advisory)", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          eligibility: null,
          matcherConfidence: "high",
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: false
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.ELIGIBILITY_MISSING);
      expect(result.metadata.reviewQueueEnqueueEnabled).toBe(false);
    });

    test("review remains advisory when enqueue flag is off (no side effects)", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          reviewRequired: true,
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: false,
            reviewQueueEnqueueEnabled: false
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.metadata.wouldReviewIfEnqueueEnabled).toBe(true);
    });
  });

  describe("integration with eligibility engine", () => {
    test("uses real eligible processor output for persist intent under automation", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [candidate()]
      });
      const eligibility = evaluateRecruitmentEligibility({
        ...processorResult,
        lookupSummary: {
          status: "ok",
          strategy: "advertisement_number_exact",
          candidateCount: 1
        }
      });
      expect(eligibility.status).toBe(ELIGIBILITY_STATUS.ELIGIBLE);

      const decision = evaluateRuntimePersistencePolicy({
        featureFlags: {
          pipelineEnabled: true,
          automaticPersistenceEnabled: true
        },
        runtimeMode: RUNTIME_MODES.LIVE,
        eligibility,
        matchResult: processorResult.reviewItem.matchResult,
        eventType: processorResult.eventType,
        lifecycleState: "open"
      });

      expect(decision.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(decision.metadata.eligibilityStatus).toBe("eligible");
      expect(decision.metadata.confidence).toBe("high");
    });

    test("uses real ineligible output → skip", () => {
      const eligibility = evaluateRecruitmentEligibility({
        status: "no_match",
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: {
          matchResult: {
            match: false,
            confidence: "high",
            matchedSignals: [],
            conflictingSignals: ["YEAR"]
          }
        },
        lookupSummary: { status: "ok", candidateCount: 1 }
      });

      const decision = evaluateRuntimePersistencePolicy({
        featureFlags: {
          pipelineEnabled: true,
          automaticPersistenceEnabled: true
        },
        eligibility,
        eventType: "admit_card",
        matcherConfidence: "high"
      });

      expect(decision.action).toBe(PERSISTENCE_ACTIONS.SKIP);
      expect(decision.reasons).toContain(PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE);
    });
  });

  describe("deterministic / pure behavior", () => {
    test("identical input yields identical output", () => {
      const input = eligibleContext();
      const a = evaluateRuntimePersistencePolicy(input);
      const b = evaluateRuntimePersistencePolicy(input);
      expect(a).toEqual(b);
      expect(a.reasons).toEqual([...a.reasons].sort((x, y) => x.localeCompare(y)));
    });

    test("does not mutate input", () => {
      const input = eligibleContext({
        featureFlags: {
          pipelineEnabled: true,
          automaticPersistenceEnabled: true
        }
      });
      const before = JSON.stringify(input);
      evaluateRuntimePersistencePolicy(input);
      expect(JSON.stringify(input)).toBe(before);
    });

    test("reason is first of sorted reasons", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.reason).toBe(result.reasons[0]);
      expect(result.reasons).toEqual(
        [...result.reasons].sort((a, b) => a.localeCompare(b))
      );
    });

    test("confidence falls back: matcherConfidence → matchResult → eligibility", () => {
      const fromMatcher = evaluateRuntimePersistencePolicy(
        eligibleContext({
          matcherConfidence: "medium",
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            confidence: "high",
            eventType: "admit_card"
          },
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(fromMatcher.metadata.confidence).toBe("medium");

      const fromMatchResult = evaluateRuntimePersistencePolicy(
        eligibleContext({
          matcherConfidence: undefined,
          matchResult: {
            match: true,
            confidence: "medium",
            matchedSignals: [],
            conflictingSignals: []
          },
          eligibility: {
            eligible: false,
            status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
            confidence: "high",
            eventType: "admit_card"
          },
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(fromMatchResult.metadata.confidence).toBe("medium");
    });
  });

  describe("edge and failure scenarios", () => {
    test("empty object context → review / eligibility missing path", () => {
      const result = evaluateRuntimePersistencePolicy({});
      expect(result.action).toBe(PERSISTENCE_ACTIONS.REVIEW);
      expect(result.reasons).toContain(PERSISTENCE_REASONS.ELIGIBILITY_MISSING);
      expect(result.metadata.automationEnabled).toBe(false);
    });

    test("whitespace-only existing match string is ignored", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          existingRecruitmentMatch: "   ",
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.metadata.hasExistingRecruitmentMatch).toBe(false);
    });

    test("empty object existing match is ignored", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          existingRecruitmentMatch: {},
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
    });

    test("invalid featureFlags shape is treated as empty flags", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({ featureFlags: null })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.metadata.automationEnabled).toBe(false);
      expect(result.metadata.pipelineEnabled).toBe(true);
    });

    test("runtimeMode is normalized case-insensitively", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          runtimeMode: "DRY_RUN",
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PREVIEW_ONLY);
      expect(result.metadata.runtimeMode).toBe("dry_run");
    });

    test("eligibility.eligible true without status is treated as eligible", () => {
      const result = evaluateRuntimePersistencePolicy(
        eligibleContext({
          eligibility: {
            eligible: true,
            confidence: "high",
            eventType: "admit_card"
          },
          featureFlags: {
            pipelineEnabled: true,
            automaticPersistenceEnabled: true
          }
        })
      );
      expect(result.action).toBe(PERSISTENCE_ACTIONS.PERSIST);
      expect(result.metadata.eligibilityStatus).toBe("eligible");
    });
  });

  describe("architecture boundaries (source)", () => {
    test("policy module has no DB / Express / queue / filesystem side effects", () => {
      const source = read("server/lib/recruitment/runtimePersistencePolicy.js");
      expect(source).toMatch(/Never persists/);
      expect(source).toMatch(/Phase 33/);
      expect(source).not.toMatch(/mysql|createPool|INSERT INTO/i);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/recordRuntimePreview/);
    });

    test("siteWorker is unchanged — policy not wired (no behavior change)", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimePersistencePolicy/);
      expect(worker).not.toMatch(/evaluateRuntimePersistencePolicy/);
      expect(worker).not.toMatch(/PERSISTENCE_ACTIONS/);
      expect(worker).toMatch(/Never persists review items/);
      expect(worker).not.toMatch(/saveReviewItem/);
      expect(worker).not.toMatch(/recruitmentReview\.service/);
    });

    test("policy is not imported by preview buffer or review service", () => {
      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const reviewService = read("server/services/recruitmentReview.service.js");
      expect(preview).not.toMatch(/runtimePersistencePolicy/);
      expect(reviewService).not.toMatch(/runtimePersistencePolicy/);
    });
  });
});
