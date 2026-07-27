"use strict";

/**
 * Phase 32 — Recruitment Eligibility Engine tests.
 * Evaluation only: no persistence, no review-queue writes.
 */

const fs = require("fs");
const path = require("path");

const {
  ELIGIBILITY_STATUS,
  ELIGIBILITY_REASONS,
  evaluateRecruitmentEligibility
} = require("../server/lib/recruitment/recruitmentEligibility");
const {
  processRecruitmentDetection
} = require("../server/lib/recruitment/detectionProcessor");
const {
  pushRuntimePreview,
  resetRuntimePreviewBuffer,
  listRuntimePreviews,
  recordRuntimePreviewFromPipeline
} = require("../server/lib/recruitment/runtimePreviewBuffer");

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
    ...overrides
  };
}

function okLookup(overrides = {}) {
  return {
    status: "ok",
    strategy: "advertisement_number_exact",
    candidateCount: 1,
    limitedTo: 20,
    criteria: { advertisementNo: "CGL-01/2026" },
    message: null,
    ...overrides
  };
}

function enrich(processorResult, lookupSummary = okLookup()) {
  return {
    ...processorResult,
    lookupSummary
  };
}

describe("Phase 32 — recruitmentEligibility", () => {
  describe("constants", () => {
    test("ELIGIBILITY_STATUS exposes expected values", () => {
      expect(ELIGIBILITY_STATUS).toEqual({
        ELIGIBLE: "eligible",
        INELIGIBLE: "ineligible",
        MANUAL_REVIEW: "manual_review"
      });
    });

    test("ELIGIBILITY_REASONS exposes freeze map", () => {
      expect(ELIGIBILITY_REASONS.CONFIDENCE_HIGH).toBe("CONFIDENCE_HIGH");
      expect(ELIGIBILITY_REASONS.MATCH_FALSE).toBe("MATCH_FALSE");
      expect(ELIGIBILITY_REASONS.CRITICAL_PROCESSOR_FAILURE).toBe(
        "CRITICAL_PROCESSOR_FAILURE"
      );
      expect(Object.isFrozen(ELIGIBILITY_REASONS)).toBe(true);
      expect(Object.isFrozen(ELIGIBILITY_STATUS)).toBe(true);
    });
  });

  describe("eligible path", () => {
    test("returns eligible when all gates pass", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [candidate()]
      });
      expect(processorResult.status).toBe("success");

      const result = evaluateRecruitmentEligibility(enrich(processorResult));

      expect(result.eligible).toBe(true);
      expect(result.status).toBe(ELIGIBILITY_STATUS.ELIGIBLE);
      expect(result.confidence).toBe("high");
      expect(result.eventType).toBe("admit_card");
      expect(result.candidateCount).toBe(1);
      expect(result.matchResult.match).toBe(true);
      expect(result.lookupSummary.status).toBe("ok");
      expect(result.reasons).toEqual(
        [
          ELIGIBILITY_REASONS.CANDIDATES_PRESENT,
          ELIGIBILITY_REASONS.CONFIDENCE_HIGH,
          ELIGIBILITY_REASONS.KNOWN_LIFECYCLE_EVENT,
          ELIGIBILITY_REASONS.LOOKUP_SUCCEEDED,
          ELIGIBILITY_REASONS.MATCH_TRUE,
          ELIGIBILITY_REASONS.NO_CONFLICTING_SIGNALS,
          ELIGIBILITY_REASONS.PROCESSOR_SUCCESS,
          ELIGIBILITY_REASONS.SINGLE_SELECTED_RECRUITMENT
        ].sort((a, b) => a.localeCompare(b))
      );
    });
  });

  describe("manual review path", () => {
    test("medium confidence → manual_review", () => {
      const result = evaluateRecruitmentEligibility({
        status: "success",
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: candidate(),
        reviewItem: {
          matchResult: {
            match: true,
            confidence: "medium",
            matchedSignals: ["ORGANIZATION", "EXAM"],
            conflictingSignals: []
          }
        },
        lookupSummary: okLookup()
      });

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.MEDIUM_CONFIDENCE);
    });

    test("unknown event → manual_review", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice({ title: "Office Holiday List 2026", content: "", url: "" }),
        candidateRecruitments: [candidate()]
      });

      const result = evaluateRecruitmentEligibility(
        enrich(processorResult, okLookup({ candidateCount: 1 }))
      );

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.UNKNOWN_EVENT);
    });

    test("multiple equal matches → manual_review", () => {
      const shared = {
        department: "ssc",
        post_name: "Combined Graduate Level",
        exam_name: "CGL",
        cycle_year: 2026,
        advertisement_no: "CGL-01/2026"
      };
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [
          candidate({ id: 1, ...shared }),
          candidate({ id: 2, ...shared })
        ]
      });

      const result = evaluateRecruitmentEligibility(
        enrich(processorResult, okLookup({ candidateCount: 2 }))
      );

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.MULTIPLE_EQUAL_MATCHES);
    });

    test("lookup failure → manual_review", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: []
      });

      const result = evaluateRecruitmentEligibility(
        enrich(processorResult, {
          status: "failed",
          strategy: "lookup_error",
          candidateCount: 0,
          message: "connection lost"
        })
      );

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.LOOKUP_FAILED);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.NO_CANDIDATES);
    });

    test("lookup skipped → manual_review", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: []
      });

      const result = evaluateRecruitmentEligibility(
        enrich(processorResult, {
          status: "skipped",
          strategy: "insufficient_criteria",
          candidateCount: 0
        })
      );

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.LOOKUP_SKIPPED);
    });

    test("no candidates → manual_review", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: []
      });

      const result = evaluateRecruitmentEligibility(
        enrich(processorResult, okLookup({ candidateCount: 0 }))
      );

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.NO_CANDIDATES);
    });

    test("unknown match → manual_review", () => {
      const result = evaluateRecruitmentEligibility({
        status: "no_match",
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: {
          matchResult: {
            match: "unknown",
            confidence: "none",
            matchedSignals: [],
            conflictingSignals: []
          }
        },
        lookupSummary: okLookup({ candidateCount: 2 })
      });

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.MANUAL_REVIEW);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.UNKNOWN_MATCH);
    });
  });

  describe("ineligible path", () => {
    test("invalid processor input → ineligible", () => {
      const result = evaluateRecruitmentEligibility({
        status: "invalid_input",
        warnings: ["INVALID_NOTICE"],
        eventType: "unknown",
        selectedRecruitment: null,
        reviewItem: null,
        lookupSummary: okLookup()
      });

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.INELIGIBLE);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.INVALID_PROCESSOR_INPUT);
    });

    test("null / non-object processor output → ineligible", () => {
      expect(evaluateRecruitmentEligibility(null).status).toBe(
        ELIGIBILITY_STATUS.INELIGIBLE
      );
      expect(evaluateRecruitmentEligibility(undefined).reasons).toContain(
        ELIGIBILITY_REASONS.INVALID_PROCESSOR_INPUT
      );
      expect(evaluateRecruitmentEligibility([]).status).toBe(
        ELIGIBILITY_STATUS.INELIGIBLE
      );
    });

    test("match false → ineligible", () => {
      const result = evaluateRecruitmentEligibility({
        status: "no_match",
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: {
          matchResult: {
            match: false,
            confidence: "high",
            matchedSignals: [],
            conflictingSignals: []
          }
        },
        lookupSummary: okLookup()
      });

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.INELIGIBLE);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.MATCH_FALSE);
    });

    test("conflicting signals → ineligible", () => {
      const result = evaluateRecruitmentEligibility({
        status: "no_match",
        warnings: [],
        eventType: "admit_card",
        selectedRecruitment: null,
        reviewItem: {
          matchResult: {
            match: false,
            confidence: "high",
            matchedSignals: ["ORGANIZATION"],
            conflictingSignals: ["YEAR", "EXAM"]
          }
        },
        lookupSummary: okLookup()
      });

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.INELIGIBLE);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          ELIGIBILITY_REASONS.MATCH_FALSE,
          ELIGIBILITY_REASONS.CONFLICTING_SIGNALS
        ])
      );
    });

    test("critical processor failure → ineligible", () => {
      const result = evaluateRecruitmentEligibility({
        criticalFailure: true,
        lookupSummary: okLookup()
      });

      expect(result.eligible).toBe(false);
      expect(result.status).toBe(ELIGIBILITY_STATUS.INELIGIBLE);
      expect(result.reasons).toContain(ELIGIBILITY_REASONS.CRITICAL_PROCESSOR_FAILURE);
    });
  });

  describe("deterministic output", () => {
    test("identical input yields identical output", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [candidate()]
      });
      const input = enrich(processorResult);

      const a = evaluateRecruitmentEligibility(input);
      const b = evaluateRecruitmentEligibility(input);

      expect(a).toEqual(b);
      expect(a.reasons).toEqual([...a.reasons].sort((x, y) => x.localeCompare(y)));
    });

    test("does not mutate input", () => {
      const input = {
        status: "success",
        warnings: ["NO_CANDIDATES"],
        eventType: "admit_card",
        selectedRecruitment: candidate(),
        reviewItem: {
          matchResult: {
            match: true,
            confidence: "high",
            matchedSignals: ["ADVERTISEMENT_NUMBER"],
            conflictingSignals: []
          }
        },
        lookupSummary: okLookup()
      };
      const before = JSON.stringify(input);
      evaluateRecruitmentEligibility(input);
      expect(JSON.stringify(input)).toBe(before);
    });
  });

  describe("preview output", () => {
    beforeEach(() => {
      resetRuntimePreviewBuffer();
    });

    test("stores eligibility on preview entries", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [candidate()]
      });
      const eligibility = evaluateRecruitmentEligibility(enrich(processorResult));

      const entry = pushRuntimePreview({
        monitoredSite: { id: 7, name: "SSC", url: "https://ssc.nic.in" },
        notice: notice(),
        processorResult,
        lookupSummary: okLookup(),
        eligibility
      });

      expect(entry.eligibility).toEqual(
        expect.objectContaining({
          eligible: true,
          status: ELIGIBILITY_STATUS.ELIGIBLE
        })
      );
      expect(entry.eligibility.reasons.length).toBeGreaterThan(0);

      const listed = listRuntimePreviews({});
      expect(listed.data[0].eligibility.status).toBe(ELIGIBILITY_STATUS.ELIGIBLE);
    });

    test("recordRuntimePreviewFromPipeline forwards eligibility", () => {
      const processorResult = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [candidate()]
      });
      const eligibility = evaluateRecruitmentEligibility(enrich(processorResult));

      const stored = recordRuntimePreviewFromPipeline({
        pipelineOutcome: { skipped: false, result: processorResult, updateId: 9 },
        notice: notice(),
        updateId: 9,
        lookupSummary: okLookup(),
        eligibility
      });

      expect(stored).not.toBeNull();
      expect(stored.eligibility.eligible).toBe(true);
      expect(stored.eligibility.status).toBe("eligible");
    });
  });

  describe("worker integration (source)", () => {
    test("worker evaluates eligibility after pipeline and before preview", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).toMatch(/evaluateRecruitmentEligibility/);
      expect(worker).toMatch(/recruitmentEligibility/);
      expect(worker).toMatch(/eligibility/);

      const evalIdx = worker.indexOf("evaluateRecruitmentEligibility");
      const previewIdx = worker.indexOf("recordRuntimePreviewFromPipeline");
      expect(evalIdx).toBeGreaterThan(-1);
      expect(previewIdx).toBeGreaterThan(evalIdx);
    });

    test("worker never persists review items or enqueues from eligibility", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/saveReviewItem/);
      expect(worker).not.toMatch(/recruitmentReview\.service/);
      expect(worker).not.toMatch(/recruitment_review_queue/);

      const eligibility = read("server/lib/recruitment/recruitmentEligibility.js");
      expect(eligibility).not.toMatch(/mysql|createPool|INSERT INTO/i);
      expect(eligibility).not.toMatch(/saveReviewItem/);
      expect(eligibility).not.toMatch(/recruitmentReview/);
      expect(eligibility).toMatch(/Never persists/);
    });
  });

  describe("admin preview UI", () => {
    test("displays Eligibility Status, Reasons, and Eligible Yes/No", () => {
      const html = read("private/admin-recruitment-runtime-preview.html");
      const js = read("public/assets/js/admin-recruitment-runtime-preview.js");

      expect(html).toMatch(/rrpEligibility/);
      expect(html).toMatch(/Eligibility Reasons/);
      expect(js).toMatch(/Eligibility Status/);
      expect(js).toMatch(/Eligible/);
      expect(js).toMatch(/rrpEligibilityReasons/);
    });
  });
});
