"use strict";

const {
  processRecruitmentDetection,
  processCandidateMatches,
  PROCESS_RESULT_STATUS,
  PROCESS_WARNINGS
} = require("../server/lib/recruitment/detectionProcessor");
const { REVIEW_STATUS, REVIEW_DECISIONS, validateReviewItem } = require("../server/lib/recruitment/reviewQueue");

function notice(overrides = {}) {
  return {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card for Tier 1",
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

describe("detectionProcessor", () => {
  describe("constants", () => {
    test("PROCESS_RESULT_STATUS exposes expected values", () => {
      expect(PROCESS_RESULT_STATUS).toEqual({
        SUCCESS: "success",
        UNKNOWN_EVENT: "unknown_event",
        NO_MATCH: "no_match",
        AMBIGUOUS_MATCH: "ambiguous_match",
        INVALID_INPUT: "invalid_input"
      });
    });

    test("PROCESS_WARNINGS exposes expected values", () => {
      expect(PROCESS_WARNINGS).toEqual({
        MULTIPLE_EQUAL_MATCHES: "MULTIPLE_EQUAL_MATCHES",
        UNKNOWN_EVENT_TYPE: "UNKNOWN_EVENT_TYPE",
        INVALID_NOTICE: "INVALID_NOTICE",
        NO_CANDIDATES: "NO_CANDIDATES"
      });
    });
  });

  describe("processRecruitmentDetection", () => {
    test("performs valid detection with a single candidate match", () => {
      const input = {
        notice: notice(),
        candidateRecruitments: [candidate()],
        createdAt: "2026-07-13T12:00:00.000Z"
      };

      const result = processRecruitmentDetection(input);

      expect(result.status).toBe(PROCESS_RESULT_STATUS.SUCCESS);
      expect(result.warnings).toEqual([]);
      expect(result.eventType).toBe("admit_card");
      expect(result.selectedRecruitment).toEqual(candidate());
      expect(result.reviewItem).toMatchObject({
        recruitmentId: 1,
        eventType: "admit_card",
        title: "SSC CGL 2026 Admit Card",
        sourceUrl: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
        status: REVIEW_STATUS.PENDING,
        decision: REVIEW_DECISIONS.NONE,
        createdAt: "2026-07-13T12:00:00.000Z"
      });
      expect(result.reviewItem.matchResult.match).toBe(true);
      expect(validateReviewItem(result.reviewItem).valid).toBe(true);
    });

    test("returns unknown event for unrelated notices", () => {
      const result = processRecruitmentDetection({
        notice: notice({ title: "Office Holiday List 2026", content: "", url: "" }),
        candidateRecruitments: [candidate()]
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.UNKNOWN_EVENT);
      expect(result.warnings).toEqual([PROCESS_WARNINGS.UNKNOWN_EVENT_TYPE]);
      expect(result.eventType).toBe("unknown");
      expect(result.selectedRecruitment).toBeNull();
      expect(result.reviewItem.eventType).toBe("unknown");
    });

    test("returns no match when candidates do not align", () => {
      const result = processRecruitmentDetection({
        notice: notice({
          title: "SSC CHSL 2026 Admit Card",
          content: "Combined Higher Secondary Level examination",
          url: "https://ssc.nic.in/chsl-2026-admit-card.pdf"
        }),
        candidateRecruitments: [candidate({ exam_name: "CGL", post_name: "Combined Graduate Level" })]
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.NO_MATCH);
      expect(result.warnings).toEqual([]);
      expect(result.selectedRecruitment).toBeNull();
      expect(result.reviewItem.recruitmentId).toBeNull();
      expect(result.reviewItem.matchResult).toBeNull();
    });

    test("warns when no candidates are supplied", () => {
      const result = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: []
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.NO_MATCH);
      expect(result.warnings).toEqual([PROCESS_WARNINGS.NO_CANDIDATES]);
      expect(result.selectedRecruitment).toBeNull();
    });

    test("returns ambiguous match for equal-strength candidates", () => {
      const shared = {
        department: "ssc",
        post_name: "Combined Graduate Level",
        exam_name: "CGL",
        cycle_year: 2026,
        advertisement_no: "CGL-01/2026"
      };

      const result = processRecruitmentDetection({
        notice: notice({ title: "SSC CGL 2026 Admit Card" }),
        candidateRecruitments: [candidate({ id: 1, ...shared }), candidate({ id: 2, ...shared })]
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.AMBIGUOUS_MATCH);
      expect(result.warnings).toEqual([PROCESS_WARNINGS.MULTIPLE_EQUAL_MATCHES]);
      expect(result.selectedRecruitment).toBeNull();
      expect(result.reviewItem.recruitmentId).toBeNull();
      expect(result.reviewItem.matchResult).toBeNull();
    });

    test("selects the strongest match among unequal candidates", () => {
      const result = processRecruitmentDetection({
        notice: notice({
          title: "SSC CGL 2026 Admit Card",
          content: "Advertisement Number CGL-01/2026"
        }),
        candidateRecruitments: [
          candidate({
            id: 10,
            department: "ssc",
            exam_name: "CGL",
            cycle_year: 2026,
            advertisement_no: null
          }),
          candidate({
            id: 11,
            department: "ssc",
            exam_name: "CGL",
            cycle_year: 2026,
            advertisement_no: "CGL-01/2026"
          })
        ]
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.SUCCESS);
      expect(result.selectedRecruitment).toEqual(
        expect.objectContaining({ id: 11, advertisement_no: "CGL-01/2026" })
      );
      expect(result.reviewItem.recruitmentId).toBe(11);
    });

    test("returns invalid input for malformed detection requests", () => {
      const result = processRecruitmentDetection({
        notice: { title: "", content: "", url: "" },
        candidateRecruitments: []
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.INVALID_INPUT);
      expect(result.warnings).toEqual([PROCESS_WARNINGS.INVALID_NOTICE]);
      expect(result.reviewItem).toBeNull();
    });

    test("returns deterministic output for identical input", () => {
      const input = {
        notice: notice(),
        candidateRecruitments: [candidate()],
        createdAt: "2026-07-13T12:00:00.000Z"
      };

      expect(processRecruitmentDetection(input)).toEqual(processRecruitmentDetection(input));
    });

    test("does not mutate supplied notice or candidate objects", () => {
      const input = {
        notice: notice(),
        candidateRecruitments: [candidate()]
      };
      const noticeSnapshot = JSON.stringify(input.notice);
      const candidateSnapshot = JSON.stringify(input.candidateRecruitments);

      processRecruitmentDetection(input);

      expect(JSON.stringify(input.notice)).toBe(noticeSnapshot);
      expect(JSON.stringify(input.candidateRecruitments)).toBe(candidateSnapshot);
    });
  });

  describe("processCandidateMatches", () => {
    test("returns match results for each candidate", () => {
      const result = processCandidateMatches({
        notice: notice(),
        candidateRecruitments: [
          candidate({ id: 1 }),
          candidate({ id: 2, exam_name: "CHSL", post_name: "Combined Higher Secondary Level" })
        ]
      });

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].candidate.id).toBe(1);
      expect(result.matches[0].matchResult.match).toBe(true);
      expect(result.matches[1].matchResult.match).toBe(false);
      expect(result.selectedRecruitment).toEqual(candidate({ id: 1 }));
    });

    test("returns invalid notice warning for malformed input", () => {
      const result = processCandidateMatches({ notice: null, candidateRecruitments: [] });

      expect(result.matches).toEqual([]);
      expect(result.warnings).toEqual([PROCESS_WARNINGS.INVALID_NOTICE]);
      expect(result.selectedRecruitment).toBeNull();
    });
  });

  describe("regression cases", () => {
    test("does not auto-select between equal candidates even with different ids", () => {
      const result = processRecruitmentDetection({
        notice: notice({ title: "SSC CGL 2026 Result" }),
        candidateRecruitments: [
          candidate({ id: 100, title: "SSC CGL 2026" }),
          candidate({ id: 200, title: "SSC CGL 2026" })
        ]
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.AMBIGUOUS_MATCH);
      expect(result.selectedRecruitment).toBeNull();
    });

    test("review item uses notice title and keeps classifier event type", () => {
      const result = processRecruitmentDetection({
        notice: notice({
          title: "SSC CGL 2026 Answer Key",
          content: "Provisional answer key published",
          url: "https://ssc.nic.in/answer-key-cgl-2026.pdf"
        }),
        candidateRecruitments: [candidate()],
        createdAt: "2026-07-13T12:00:00.000Z"
      });

      expect(result.eventType).toBe("answer_key");
      expect(result.reviewItem.title).toBe("SSC CGL 2026 Answer Key");
      expect(result.reviewItem.eventType).toBe("answer_key");
    });

    test("processor output does not include internal-only fields", () => {
      const result = processRecruitmentDetection({
        notice: notice(),
        candidateRecruitments: [candidate()]
      });

      expect(result).toEqual({
        status: expect.any(String),
        warnings: expect.any(Array),
        eventType: expect.any(String),
        selectedRecruitment: expect.any(Object),
        reviewItem: expect.any(Object)
      });
    });

    test("unknown event status takes precedence over candidate match", () => {
      const result = processRecruitmentDetection({
        notice: notice({ title: "Office Holiday List 2026", content: "", url: "" }),
        candidateRecruitments: [candidate()]
      });

      expect(result.status).toBe(PROCESS_RESULT_STATUS.UNKNOWN_EVENT);
      expect(result.selectedRecruitment).toBeNull();
    });
  });
});
