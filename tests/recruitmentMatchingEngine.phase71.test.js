"use strict";

/**
 * Phase 71 — Recruitment Matching Engine tests.
 * Exports, all matching categories, deterministic behavior, immutability,
 * validation, helper behavior, compatibility integration, pipeline output
 * preservation, failure isolation, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  MATCHING_ENGINE_PHASE,
  MATCHING_RESULT_ENTITY,
  MATCHING_RESULT_DESCRIPTOR,
  MATCHING_RESULT_METADATA,
  PROFILE_MATCH_ORDER,
  CORROBORATING_SIGNAL_KEYS,
  VALIDATION_STATUS,
  evaluateRecruitmentMatch,
  createMatchingResult,
  validateMatchingResult,
  summarizeMatchingResult
} = require("../server/lib/recruitment/recruitmentMatchingEngine");

const {
  MATCH_CATEGORIES,
  MATCHING_PROFILE_BY_ID
} = require("../server/lib/recruitment/recruitmentMatchingContracts");

const {
  IDENTITY_RESOLUTION_ENGINE_PHASE,
  IDENTITY_RESOLUTION_STATES,
  ANCHOR_EVENT_IDS,
  CONFIDENCE_LEVELS,
  createIdentityResolutionResult,
  validateIdentityResolution
} = require("../server/lib/recruitment/recruitmentIdentityResolutionEngine");

const {
  createRecruitmentContext,
  DEFAULT_RECRUITMENT_CONTEXT
} = require("../server/lib/recruitment/recruitmentContext");

const {
  attachRecruitmentCompatibility,
  peekRecruitmentCompatibility,
  peekRecruitmentIdentityResolution,
  peekRecruitmentMatchingResult,
  normalizeUpdateMetadata
} = require("../server/lib/recruitment/recruitmentCompatibilityLayer");

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

const ROOT = path.join(__dirname, "..");
const ENGINE_MODULE_PATH = "server/lib/recruitment/recruitmentMatchingEngine.js";
const COMPATIBILITY_MODULE_PATH = "server/lib/recruitment/recruitmentCompatibilityLayer.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function hasCircularReference(value, seen = new WeakSet(), stack = new WeakSet()) {
  if (value == null || typeof value !== "object") {
    return false;
  }
  if (stack.has(value)) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  stack.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (hasCircularReference(value[i], seen, stack)) {
        return true;
      }
    }
    stack.delete(value);
    return false;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    if (hasCircularReference(value[keys[i]], seen, stack)) {
      return true;
    }
  }
  stack.delete(value);
  return false;
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  nodes.push(value);
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

function sampleNotice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for SSC Combined Graduate Level Examination 2026",
    url: "https://ssc.nic.in/admit-card.pdf",
    ...overrides
  };
}

function contextWithSignals(observedSignals, extraMetadata = {}) {
  return createRecruitmentContext({
    metadata: {
      observedSignals,
      ...extraMetadata
    }
  });
}

function identityFromSignals(observedSignals, extraMetadata = {}) {
  return createIdentityResolutionResult(
    contextWithSignals(observedSignals, extraMetadata)
  );
}

function validIdentityResolution(overrides = {}) {
  const base = createIdentityResolutionResult(
    contextWithSignals({
      recruitment_title: "Synthetic recruitment",
      organization: "Staff Selection Commission",
      official_identifier: "update:1",
      source_url: "https://ssc.nic.in/notice"
    })
  );
  return {
    ...base,
    recommendsManualReview: false,
    resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
    manualReviewReasons: Object.freeze([]),
    ...overrides
  };
}

describe("Phase 71 — recruitmentMatchingEngine", () => {
  describe("exports", () => {
    test("exposes phase 71 matching engine constants and descriptor", () => {
      expect(MATCHING_ENGINE_PHASE).toBe(71);
      expect(MATCHING_RESULT_ENTITY).toBe("recruitment_matching_result");
      expect(MATCHING_RESULT_DESCRIPTOR.phase).toBe(71);
      expect(MATCHING_RESULT_METADATA.matchingExecution).toBe(false);
      expect(MATCHING_RESULT_METADATA.assignsRecruitmentIds).toBe(false);
      expect(MATCHING_RESULT_METADATA.queriesDatabase).toBe(false);
      expect(MATCHING_RESULT_METADATA.persistenceEnabled).toBe(false);
    });

    test("defines profile match order excluding review and no-match catch-alls", () => {
      expect(PROFILE_MATCH_ORDER.length).toBe(5);
      expect(PROFILE_MATCH_ORDER.map((profile) => profile.id)).toEqual([
        "official_identifier_exact",
        "advertisement_organization_strong",
        "title_organization_year_probable",
        "title_year_weak",
        "corroborating_only_weak"
      ]);
    });

    test("defines corroborating signal keys", () => {
      expect(CORROBORATING_SIGNAL_KEYS).toEqual([
        "post_name",
        "department",
        "source_url",
        "examination_name"
      ]);
    });

    test("exports public API functions", () => {
      expect(typeof evaluateRecruitmentMatch).toBe("function");
      expect(typeof createMatchingResult).toBe("function");
      expect(typeof validateMatchingResult).toBe("function");
      expect(typeof summarizeMatchingResult).toBe("function");
    });
  });

  describe("exact_match category", () => {
    test("classifies advertisement_number and official_identifier as exact_match", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        advertisement_number: "CGL-01/2026",
        official_identifier: "NOTIF-SSC-88421",
        organization: "Staff Selection Commission"
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.EXACT_MATCH);
      expect(evaluation.profileId).toBe("official_identifier_exact");
      expect(evaluation.recommendsManualReview).toBe(false);
    });

    test("createMatchingResult records exact_match with contributing signals", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        advertisement_number: "CGL-01/2026",
        official_identifier: "NOTIF-SSC-88421"
      });
      const result = createMatchingResult(identity);
      expect(result.matchCategory).toBe(MATCH_CATEGORIES.EXACT_MATCH);
      expect(result.contributingSignalKeys).toEqual(
        expect.arrayContaining(["advertisement_number", "official_identifier"])
      );
      expect(validateMatchingResult(result).valid).toBe(true);
    });

    test("exact_match evaluation includes advisory label", () => {
      const evaluation = evaluateRecruitmentMatch(
        identityFromSignals({
          recruitment_title: "UPSC 2025",
          advertisement_number: "22/2025",
          official_identifier: "UPSC-CIVIL-2025"
        })
      );
      expect(evaluation.advisoryLabel).toMatch(/Primary identity signals fully agree/i);
    });
  });

  describe("strong_match category", () => {
    test("classifies advertisement_number and organization as strong_match", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL Examination 2026",
        advertisement_number: "CGL-01/2026",
        organization: "Staff Selection Commission"
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.STRONG_MATCH);
      expect(evaluation.profileId).toBe("advertisement_organization_strong");
      expect(evaluation.reviewScenarioId).toBeNull();
    });

    test("strong_match does not require official_identifier", () => {
      const result = createMatchingResult(
        identityFromSignals({
          recruitment_title: "RRB NTPC 2026",
          advertisement_number: "CEN-03/2026",
          organization: "Railway Recruitment Board"
        })
      );
      expect(result.matchCategory).toBe(MATCH_CATEGORIES.STRONG_MATCH);
      expect(result.contributingSignalKeys).not.toContain("official_identifier");
    });

    test("prefers exact_match over strong_match when both profiles fit", () => {
      const evaluation = evaluateRecruitmentMatch(
        identityFromSignals({
          recruitment_title: "SSC CGL 2026",
          advertisement_number: "CGL-01/2026",
          organization: "Staff Selection Commission",
          official_identifier: "EXAM-CGL-2026"
        })
      );
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.EXACT_MATCH);
      expect(evaluation.matchedProfileOrder).toBe(
        MATCHING_PROFILE_BY_ID.official_identifier_exact.order
      );
    });
  });

  describe("probable_match category", () => {
    test("classifies title, organization, and year as probable_match", () => {
      const identity = validIdentityResolution({
        signalObservations: Object.freeze({
          recruitment_title: "UPSC Civil Services Examination 2025",
          organization: "Union Public Service Commission",
          recruitment_year: "2025"
        }),
        availableSignals: Object.freeze([
          "recruitment_title",
          "organization",
          "recruitment_year"
        ]),
        signalCount: 3,
        primarySignalCount: 1,
        recommendsManualReview: false,
        resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
        manualReviewReasons: Object.freeze([])
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.PROBABLE_MATCH);
      expect(evaluation.profileId).toBe("title_organization_year_probable");
    });

    test("probable_match includes all three required contributing signals", () => {
      const result = createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({
            recruitment_title: "SSC CHSL 2026",
            organization: "Staff Selection Commission",
            recruitment_year: "2026"
          }),
          availableSignals: Object.freeze([
            "recruitment_title",
            "organization",
            "recruitment_year"
          ]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
      expect(result.contributingSignalKeys).toEqual(
        expect.arrayContaining([
          "recruitment_title",
          "organization",
          "recruitment_year"
        ])
      );
    });

    test("does not classify probable_match without recruitment_year", () => {
      const evaluation = evaluateRecruitmentMatch(
        identityFromSignals({
          recruitment_title: "SSC CGL Examination 2026",
          organization: "Staff Selection Commission"
        })
      );
      expect(evaluation.matchCategory).not.toBe(MATCH_CATEGORIES.PROBABLE_MATCH);
    });
  });

  describe("weak_match category", () => {
    test("classifies title and year as weak_match", () => {
      const identity = validIdentityResolution({
        signalObservations: Object.freeze({
          recruitment_title: "Government Exam 2026",
          recruitment_year: "2026"
        }),
        availableSignals: Object.freeze(["recruitment_title", "recruitment_year"]),
        missingSignals: Object.freeze([]),
        signalCount: 2,
        primarySignalCount: 0,
        recommendsManualReview: false,
        resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
        manualReviewReasons: Object.freeze([])
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.WEAK_MATCH);
      expect(evaluation.profileId).toBe("title_year_weak");
    });

    test("classifies post_name only as corroborating weak_match", () => {
      const identity = validIdentityResolution({
        signalObservations: Object.freeze({
          recruitment_title: "Notice",
          post_name: "Junior Engineer (Civil)"
        }),
        availableSignals: Object.freeze(["recruitment_title", "post_name"]),
        signalCount: 2,
        recommendsManualReview: false,
        resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
        manualReviewReasons: Object.freeze([])
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.WEAK_MATCH);
      expect(evaluation.profileId).toBe("corroborating_only_weak");
    });

    test("weak_match evaluation does not recommend manual review", () => {
      const result = createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({
            recruitment_title: "Exam 2025",
            recruitment_year: "2025"
          }),
          availableSignals: Object.freeze(["recruitment_title", "recruitment_year"]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
      expect(result.recommendsManualReview).toBe(false);
      expect(result.matchCategory).toBe(MATCH_CATEGORIES.WEAK_MATCH);
    });
  });

  describe("no_match category", () => {
    test("classifies zero available signals as no_match when review not required", () => {
      const identity = validIdentityResolution({
        signalObservations: Object.freeze({}),
        availableSignals: Object.freeze([]),
        signalCount: 0,
        primarySignalCount: 0,
        recommendsManualReview: false,
        resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
        manualReviewReasons: Object.freeze([])
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.NO_MATCH);
      expect(evaluation.profileId).toBe("no_shared_identity_signals");
    });

    test("no_match has empty contributing signals", () => {
      const result = createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({}),
          availableSignals: Object.freeze([]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
      expect(result.matchCategory).toBe(MATCH_CATEGORIES.NO_MATCH);
      expect(result.contributingSignalKeys).toEqual([]);
    });
  });

  describe("manual_review category", () => {
    test("routes unresolved identity to manual_review", () => {
      const identity = createIdentityResolutionResult(null);
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(evaluation.profileId).toBe("manual_review_ambiguous");
      expect(evaluation.recommendsManualReview).toBe(true);
    });

    test("routes insufficient_information identity to manual_review", () => {
      const identity = identityFromSignals({ source_url: "https://example.gov.in" });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(evaluation.reviewScenarioId).toBe("insufficient_identity_signals");
    });

    test("routes identity_anchor_detected without readiness to manual_review", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL Examination 2026",
        organization: "Staff Selection Commission"
      });
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(evaluation.manualReviewReasons.length).toBeGreaterThan(0);
    });

    test("routes short notification anchor to manual_review", () => {
      const identity = identityFromSignals(
        { recruitment_title: "SSC short notice" },
        { noticeContent: "Short notification regarding examination schedule" }
      );
      const evaluation = evaluateRecruitmentMatch(identity);
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(identity.anchorEventId).toBe(ANCHOR_EVENT_IDS.SHORT_NOTIFICATION);
    });

    test("manual_review result includes review scenario id", () => {
      const result = createMatchingResult(createIdentityResolutionResult(null));
      expect(result.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(result.reviewScenarioId).toBe("insufficient_identity_signals");
    });
  });

  describe("deterministic behavior", () => {
    test("evaluateRecruitmentMatch returns identical output for identical input", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        advertisement_number: "CGL-01/2026",
        official_identifier: "NOTIF-1"
      });
      const first = evaluateRecruitmentMatch(identity);
      const second = evaluateRecruitmentMatch(identity);
      expect(first).toEqual(second);
    });

    test("createMatchingResult returns identical output for identical input", () => {
      const identity = validIdentityResolution({
        signalObservations: Object.freeze({
          recruitment_title: "UPSC 2025",
          organization: "Union Public Service Commission",
          recruitment_year: "2025"
        }),
        availableSignals: Object.freeze([
          "recruitment_title",
          "organization",
          "recruitment_year"
        ]),
        recommendsManualReview: false,
        resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
        manualReviewReasons: Object.freeze([])
      });
      expect(createMatchingResult(identity)).toEqual(createMatchingResult(identity));
    });

    test("category selection is stable across repeated evaluations", () => {
      const identity = identityFromSignals({
        recruitment_title: "RRB NTPC",
        advertisement_number: "CEN-01/2026",
        organization: "Railway Recruitment Board"
      });
      const categories = Array.from({ length: 5 }, () =>
        evaluateRecruitmentMatch(identity).matchCategory
      );
      expect(new Set(categories).size).toBe(1);
      expect(categories[0]).toBe(MATCH_CATEGORIES.STRONG_MATCH);
    });

    test("profile order is deterministic", () => {
      const orders = PROFILE_MATCH_ORDER.map((profile) => profile.order);
      expect(orders).toEqual([10, 20, 30, 40, 45]);
    });
  });

  describe("immutability", () => {
    test("createMatchingResult returns deeply frozen object", () => {
      const result = createMatchingResult(
        identityFromSignals({ recruitment_title: "Frozen test" })
      );
      assertAllFrozen(result);
    });

    test("evaluateRecruitmentMatch returns frozen evaluation", () => {
      const evaluation = evaluateRecruitmentMatch(
        identityFromSignals({ recruitment_title: "Frozen eval" })
      );
      expect(Object.isFrozen(evaluation)).toBe(true);
      expect(Object.isFrozen(evaluation.contributingSignalKeys)).toBe(true);
      expect(Object.isFrozen(evaluation.manualReviewReasons)).toBe(true);
    });

    test("mutating returned result does not affect subsequent calls", () => {
      const identity = identityFromSignals({
        recruitment_title: "Immutable",
        advertisement_number: "A-1/2026",
        organization: "SSC"
      });
      const result = createMatchingResult(identity);
      try {
        result.matchCategory = "hacked";
      } catch {
        // frozen in strict mode
      }
      const rerun = createMatchingResult(identity);
      expect(rerun.matchCategory).toBe(MATCH_CATEGORIES.STRONG_MATCH);
    });

    test("signal observations in result are frozen", () => {
      const result = createMatchingResult(
        identityFromSignals({ recruitment_title: "Signal freeze" })
      );
      expect(Object.isFrozen(result.signalObservations)).toBe(true);
      expect(Object.isFrozen(result.availableSignals)).toBe(true);
    });
  });

  describe("validation", () => {
    test("validateMatchingResult accepts a well-formed result", () => {
      const result = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Valid",
          advertisement_number: "1/2026",
          official_identifier: "ID-1"
        })
      );
      const validation = validateMatchingResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe(VALIDATION_STATUS.VALID);
      expect(validation.reasons).toEqual([]);
    });

    test("rejects invalid result shape", () => {
      const validation = validateMatchingResult(null);
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_RESULT_SHAPE");
    });

    test("rejects invalid phase", () => {
      const result = createMatchingResult(identityFromSignals({ recruitment_title: "X" }));
      const validation = validateMatchingResult({ ...result, phase: 99 });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_PHASE");
    });

    test("rejects invalid match category", () => {
      const result = createMatchingResult(identityFromSignals({ recruitment_title: "X" }));
      const validation = validateMatchingResult({ ...result, matchCategory: "bogus" });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("INVALID_MATCH_CATEGORY");
    });

    test("rejects matchingExecution true", () => {
      const result = createMatchingResult(identityFromSignals({ recruitment_title: "X" }));
      const validation = validateMatchingResult({ ...result, matchingExecution: true });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MATCHING_EXECUTION_MUST_BE_FALSE");
    });

    test("rejects assignsRecruitmentIds true", () => {
      const result = createMatchingResult(identityFromSignals({ recruitment_title: "X" }));
      const validation = validateMatchingResult({ ...result, assignsRecruitmentIds: true });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("EXECUTION_FLAGS_MUST_BE_FALSE");
    });

    test("rejects manual_review category without review flag", () => {
      const result = createMatchingResult(identityFromSignals({ recruitment_title: "X" }));
      const validation = validateMatchingResult({
        ...result,
        matchCategory: MATCH_CATEGORIES.MANUAL_REVIEW,
        recommendsManualReview: false,
        reviewScenarioId: "insufficient_identity_signals"
      });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("MANUAL_REVIEW_CATEGORY_REQUIRES_REVIEW_FLAG");
    });

    test("rejects review scenario on non-manual category", () => {
      const result = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC",
          advertisement_number: "1/2026",
          organization: "SSC"
        })
      );
      const validation = validateMatchingResult({
        ...result,
        reviewScenarioId: "insufficient_identity_signals"
      });
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain("REVIEW_SCENARIO_ONLY_FOR_MANUAL_REVIEW");
    });
  });

  describe("summarizeMatchingResult", () => {
    test("returns valid summary for well-formed result", () => {
      const result = createMatchingResult(
        identityFromSignals({
          recruitment_title: "Summary test",
          advertisement_number: "1/2026",
          official_identifier: "ID-1"
        })
      );
      const summary = summarizeMatchingResult(result);
      expect(summary.valid).toBe(true);
      expect(summary.matchCategory).toBe(MATCH_CATEGORIES.EXACT_MATCH);
      expect(summary.contributingSignalCount).toBeGreaterThan(0);
      expect(summary.matchingExecution).toBe(false);
    });

    test("returns invalid summary for malformed result", () => {
      const summary = summarizeMatchingResult({ bad: true });
      expect(summary.valid).toBe(false);
      expect(summary.recommendsManualReview).toBe(true);
      expect(summary.contributingSignalCount).toBe(0);
    });

    test("summarizeMatchingResult never throws", () => {
      expect(() => summarizeMatchingResult(Symbol("x"))).not.toThrow();
    });

    test("summary includes resolution state from source result", () => {
      const result = createMatchingResult(
        validIdentityResolution({
          signalObservations: Object.freeze({
            recruitment_title: "State check",
            organization: "SSC",
            recruitment_year: "2026"
          }),
          availableSignals: Object.freeze([
            "recruitment_title",
            "organization",
            "recruitment_year"
          ]),
          recommendsManualReview: false,
          resolutionState: IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING,
          manualReviewReasons: Object.freeze([])
        })
      );
      const summary = summarizeMatchingResult(result);
      expect(summary.resolutionState).toBe(result.resolutionState);
      expect(summary.signalCount).toBe(result.signalCount);
    });
  });

  describe("failure isolation", () => {
    test("evaluateRecruitmentMatch never throws on invalid input", () => {
      expect(() => evaluateRecruitmentMatch(Symbol("x"))).not.toThrow();
      expect(evaluateRecruitmentMatch(undefined).matchCategory).toBe(
        MATCH_CATEGORIES.MANUAL_REVIEW
      );
    });

    test("createMatchingResult never throws on invalid input", () => {
      expect(() => createMatchingResult(Symbol("x"))).not.toThrow();
      expect(createMatchingResult(undefined)).not.toBeNull();
    });

    test("invalid identity resolution falls back to default resolution", () => {
      const result = createMatchingResult({ invalid: true });
      expect(result.identityResolutionPhase).toBe(IDENTITY_RESOLUTION_ENGINE_PHASE);
      expect(result.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
    });

    test("does not assign recruitment IDs", () => {
      const result = createMatchingResult(
        identityFromSignals({
          recruitment_title: "SSC CGL",
          official_identifier: "update:99"
        })
      );
      expect(result.assignsRecruitmentIds).toBe(false);
      expect(result).not.toHaveProperty("recruitmentId");
      expect(result).not.toHaveProperty("selectedRecruitment");
    });

    test("does not expose persistence or database flags as enabled", () => {
      const result = createMatchingResult(identityFromSignals({ recruitment_title: "No IO" }));
      expect(result.queriesDatabase).toBe(false);
      expect(result.performsPersistence).toBe(false);
      expect(result.persistenceEnabled).toBe(false);
    });
  });

  describe("compatibility integration", () => {
    test("attachRecruitmentCompatibility stores matching result internally", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 11 };
      attachRecruitmentCompatibility(outcome, {
        notice: sampleNotice(),
        updateId: 11
      });
      const matching = peekRecruitmentMatchingResult(outcome);
      expect(matching).not.toBeNull();
      expect(matching.phase).toBe(71);
      expect(validateMatchingResult(matching).valid).toBe(true);
    });

    test("matching result is not a public field on pipeline outcome", () => {
      const outcome = { skipped: false, updateId: 12 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 12 });
      expect(Object.prototype.hasOwnProperty.call(outcome, "matchingResult")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(outcome, "recruitmentMatchingResult")).toBe(
        false
      );
    });

    test("peekRecruitmentMatchingResult returns null for unrelated objects", () => {
      expect(peekRecruitmentMatchingResult(null)).toBeNull();
      expect(peekRecruitmentMatchingResult({})).toBeNull();
    });

    test("matching result aligns with identity resolution for same outcome", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 20 };
      attachRecruitmentCompatibility(outcome, {
        notice: {
          title: "SSC CGL 2026",
          content: "Staff Selection Commission Advt. No. CGL-01/2026",
          url: "https://ssc.nic.in"
        },
        updateId: 20
      });
      const resolution = peekRecruitmentIdentityResolution(outcome);
      const matching = peekRecruitmentMatchingResult(outcome);
      expect(validateIdentityResolution(resolution).valid).toBe(true);
      expect(matching.resolutionState).toBe(resolution.resolutionState);
      expect(matching.signalCount).toBe(resolution.signalCount);
    });

    test("compatibility attach still succeeds when matching input is sparse", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: null };
      const attached = attachRecruitmentCompatibility(outcome, {});
      expect(attached).not.toBeNull();
      expect(peekRecruitmentCompatibility(outcome)).toBe(attached);
      const matching = peekRecruitmentMatchingResult(outcome);
      expect(matching).not.toBeNull();
      expect(matching.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
    });

    test("identity resolution and matching result coexist in separate WeakMaps", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 33 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 33 });
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(peekRecruitmentMatchingResult(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBe(
        peekRecruitmentMatchingResult(outcome)
      );
    });
  });

  describe("compatibility failure isolation", () => {
    test("attachRecruitmentCompatibility never throws when matching engine fails", () => {
      jest.resetModules();
      jest.doMock("../server/lib/recruitment/recruitmentMatchingEngine", () => ({
        createMatchingResult: () => {
          throw new Error("matching engine failure");
        },
        summarizeMatchingResult: () => ({ valid: false })
      }));

      const compat = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
      const outcome = { skipped: true, reason: "flag_off", updateId: 1 };

      expect(() =>
        compat.attachRecruitmentCompatibility(outcome, {
          notice: sampleNotice(),
          updateId: 1
        })
      ).not.toThrow();

      expect(compat.peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
      expect(compat.peekRecruitmentMatchingResult(outcome)).toBeNull();

      jest.dontMock("../server/lib/recruitment/recruitmentMatchingEngine");
      jest.resetModules();
    });

    test("matching failure does not remove compatibility or identity resolution context", () => {
      const outcome = { skipped: true, reason: "flag_off", updateId: 5 };
      attachRecruitmentCompatibility(outcome, { notice: sampleNotice(), updateId: 5 });
      expect(peekRecruitmentCompatibility(outcome)).not.toBeNull();
      expect(peekRecruitmentIdentityResolution(outcome)).not.toBeNull();
    });
  });

  describe("pipeline output preservation", () => {
    const notice = sampleNotice();

    test("skipped outcome shape is unchanged", () => {
      const result = runRecruitmentPipeline({ notice, isEnabled: false });
      expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: null });
    });

    test("success outcome shape is unchanged", () => {
      const processDetection = jest.fn().mockReturnValue({
        status: PROCESS_RESULT_STATUS.SUCCESS,
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: null
      });

      const result = runRecruitmentPipeline({
        notice,
        isEnabled: true,
        processDetection,
        updateId: 101
      });

      expect(result).toEqual({
        skipped: false,
        result: expect.objectContaining({ eventType: "admit_card" }),
        updateId: 101
      });
    });

    test("failure outcome shape is unchanged", () => {
      const processDetection = jest.fn(() => {
        throw new Error("detection failed");
      });

      const result = runRecruitmentPipeline({
        notice,
        isEnabled: true,
        processDetection,
        updateId: 44
      });

      expect(result).toEqual({
        skipped: false,
        failed: true,
        error: expect.any(Error),
        updateId: 44
      });
    });

    test("pipeline attaches matching result without changing public return fields", () => {
      const result = runRecruitmentPipeline({
        notice,
        isEnabled: false,
        updateId: 88
      });
      const matching = peekRecruitmentMatchingResult(result);
      expect(matching).not.toBeNull();
      expect(validateMatchingResult(matching).valid).toBe(true);
      expect(result).toEqual({
        skipped: true,
        reason: "flag_off",
        updateId: 88
      });
    });

    test("detection processor arguments remain unchanged", () => {
      const processDetection = jest.fn().mockReturnValue({
        status: PROCESS_RESULT_STATUS.NO_MATCH,
        warnings: [],
        eventType: "result",
        selectedRecruitment: null,
        reviewItem: null
      });

      runRecruitmentPipeline({
        notice,
        candidateRecruitments: [{ id: 1 }],
        isEnabled: true,
        processDetection,
        createdAt: "2026-07-14T00:00:00.000Z",
        updateId: 3
      });

      expect(processDetection).toHaveBeenCalledWith({
        notice,
        candidateRecruitments: [{ id: 1 }],
        createdAt: "2026-07-14T00:00:00.000Z"
      });
    });
  });

  describe("circular references", () => {
    test("matching result graph has no circular references", () => {
      const result = createMatchingResult(
        identityFromSignals({ recruitment_title: "No cycles" })
      );
      expect(hasCircularReference(result)).toBe(false);
      expect(hasCircularReference(MATCHING_RESULT_DESCRIPTOR)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("matching engine has no Express / DB / filesystem / env access", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).toMatch(/Phase 71/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/https?:\/\//);
    });

    test("matching engine imports only identity resolution and matching contracts", () => {
      const source = read(ENGINE_MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./recruitmentIdentityResolutionEngine",
        "./recruitmentMatchingContracts"
      ]);
    });

    test("matching engine does not query database or assign recruitment IDs", () => {
      const source = read(ENGINE_MODULE_PATH);
      expect(source).toMatch(/matchingExecution: false/);
      expect(source).toMatch(/assignsRecruitmentIds: false/);
      expect(source).toMatch(/queriesDatabase: false/);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/processRecruitmentDetection/);
      expect(source).not.toMatch(/evaluateRecruitmentEligibility/);
    });

    test("compatibility layer integrates matching engine additively", () => {
      const source = read(COMPATIBILITY_MODULE_PATH);
      expect(source).toMatch(/recruitmentMatchingEngine/);
      expect(source).toMatch(/createMatchingResult/);
      expect(source).toMatch(/matchingResultByPipelineOutcome/);
      expect(source).toMatch(/peekRecruitmentMatchingResult/);
    });

    test("runRecruitmentPipeline does not import matching engine directly", () => {
      const source = read(PIPELINE_MODULE_PATH);
      expect(source).toMatch(/recruitmentCompatibilityLayer/);
      expect(source).not.toMatch(/recruitmentMatchingEngine/);
    });

    test("siteWorker is unchanged — integration remains confined to compatibility layer", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentMatchingEngine/);
      expect(worker).not.toMatch(/peekRecruitmentMatchingResult/);
    });
  });

  describe("evaluation helper behavior", () => {
    test("falls back to default identity resolution when input is invalid", () => {
      const evaluation = evaluateRecruitmentMatch({ bogus: true });
      expect(evaluation.matchCategory).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      expect(evaluation.identityResolutionPhase).toBe(IDENTITY_RESOLUTION_ENGINE_PHASE);
    });

    test("embeds evaluation snapshot inside matching result", () => {
      const result = createMatchingResult(
        identityFromSignals({ recruitment_title: "Embedded eval" })
      );
      expect(result.evaluation.matchCategory).toBe(result.matchCategory);
      expect(result.evaluation.profileId).toBe(result.profileId);
    });

    test("records identity confidence in metadata when available", () => {
      const identity = identityFromSignals({
        recruitment_title: "SSC CGL 2026",
        organization: "Staff Selection Commission",
        official_identifier: "update:42",
        source_url: "https://ssc.nic.in"
      });
      const result = createMatchingResult(identity);
      expect(result.metadata.identityConfidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH);
    });

    test("normalized update metadata path produces deterministic matching", () => {
      const normalized = normalizeUpdateMetadata({
        notice: sampleNotice(),
        updateId: 77
      });
      const context = createRecruitmentContext({
        metadata: {
          observedSignals: {
            recruitment_title: normalized.notice.title,
            source_url: normalized.sourceUrl,
            official_identifier: `update:${normalized.updateId}`
          },
          noticeContent: normalized.notice.content
        }
      });
      const identity = createIdentityResolutionResult(context);
      const first = createMatchingResult(identity);
      const second = createMatchingResult(identity);
      expect(first.matchCategory).toBe(second.matchCategory);
      expect(first.profileId).toBe(second.profileId);
    });
  });
});
