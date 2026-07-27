"use strict";

const {
  MATCH_CONFIDENCE_LEVELS,
  UNKNOWN_MATCH,
  RECRUITMENT_MATCH_SIGNALS,
  normalizeRecruitmentIdentity,
  extractRecruitmentAttributes,
  isSameRecruitment
} = require("../server/lib/recruitment/recruitmentMatcher");

function notice(overrides = {}) {
  return {
    title: "",
    content: "",
    ...overrides
  };
}

describe("recruitmentMatcher", () => {
  describe("constants", () => {
    test("MATCH_CONFIDENCE_LEVELS contains expected values", () => {
      expect([...MATCH_CONFIDENCE_LEVELS]).toEqual(["high", "medium", "low", "none"]);
    });

    test("UNKNOWN_MATCH is unknown", () => {
      expect(UNKNOWN_MATCH).toBe("unknown");
    });

    test("RECRUITMENT_MATCH_SIGNALS exposes stable signal keys", () => {
      expect(RECRUITMENT_MATCH_SIGNALS).toEqual({
        ADVERTISEMENT_NUMBER: "ADVERTISEMENT_NUMBER",
        ORGANIZATION: "ORGANIZATION",
        POST: "POST",
        EXAM: "EXAM",
        YEAR: "YEAR"
      });
    });
  });

  describe("normalizeRecruitmentIdentity", () => {
    test("normalizes structured recruitment fields", () => {
      const identity = normalizeRecruitmentIdentity({
        department: "ssc",
        post_name: "Combined Graduate Level",
        advertisement_no: "CGL-01/2026",
        cycle_year: 2026,
        exam_name: "CGL"
      });

      expect(identity.organization).toBe("ssc");
      expect(identity.postName).toBe("cgl");
      expect(identity.advertisementNo).toBe("cgl-01/2026");
      expect(identity.recruitmentYear).toBe(2026);
      expect(identity.examName).toBe("cgl");
      expect(identity.department).toBe("ssc");
      expect(identity.keywords.length).toBeGreaterThan(0);
    });

    test("extracts identity from title and url text", () => {
      const identity = normalizeRecruitmentIdentity({
        title: "Staff Selection Commission CGL 2026 Admit Card",
        url: "https://ssc.nic.in/advt-no-cgl-01-2026.pdf"
      });

      expect(identity.organization).toBe("ssc");
      expect(identity.examName).toBe("cgl");
      expect(identity.recruitmentYear).toBe(2026);
      expect(identity.normalizedText).toContain("staff selection commission");
    });
  });

  describe("extractRecruitmentAttributes", () => {
    test("tracks field and extracted sources", () => {
      const attributes = extractRecruitmentAttributes({
        department: "ssc",
        title: "SSC CHSL 2026 Result"
      });

      expect(attributes.sources.organization).toBe("field");
      expect(attributes.sources.examName).toBe("extracted");
      expect(attributes.sources.recruitmentYear).toBe("extracted");
    });
  });

  describe("isSameRecruitment — advertisement number", () => {
    test("matches when advertisement numbers are equal", () => {
      const a = notice({
        department: "ssc",
        advertisement_no: "Advt. No. 01/2026",
        title: "SSC CGL Notification"
      });
      const b = notice({
        department: "ssc",
        title: "Advertisement Number 01/2026 - Admit Card"
      });

      const result = isSameRecruitment(a, b);
      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.matchedSignals).toContain(RECRUITMENT_MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
    });

    test("does not match when advertisement numbers conflict", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", advertisement_no: "01/2026", exam_name: "CGL" }),
        notice({ department: "ssc", advertisement_no: "02/2026", exam_name: "CGL" })
      );

      expect(result.match).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.conflictingSignals).toContain(RECRUITMENT_MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
    });
  });

  describe("isSameRecruitment — same recruitment", () => {
    test("matches lifecycle notices for the same SSC CGL 2026 cycle", () => {
      const notification = notice({
        department: "ssc",
        post_name: "Combined Graduate Level",
        cycle_year: 2026,
        exam_name: "CGL",
        title: "SSC CGL 2026 Recruitment Notification"
      });
      const admitCard = notice({
        department: "ssc",
        post_name: "Combined Graduate Level",
        cycle_year: 2026,
        exam_name: "CGL",
        title: "SSC CGL 2026 Admit Card"
      });

      const result = isSameRecruitment(notification, admitCard);
      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.matchedSignals).toEqual(
        expect.arrayContaining([
          RECRUITMENT_MATCH_SIGNALS.ORGANIZATION,
          RECRUITMENT_MATCH_SIGNALS.EXAM,
          RECRUITMENT_MATCH_SIGNALS.YEAR
        ])
      );
    });
  });

  describe("isSameRecruitment — different recruitment", () => {
    test("does not match different exams under the same organization", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", exam_name: "CGL", cycle_year: 2026 }),
        notice({ department: "ssc", exam_name: "CHSL", cycle_year: 2026 })
      );

      expect(result.match).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.conflictingSignals).toContain(RECRUITMENT_MATCH_SIGNALS.EXAM);
    });

    test("does not match different posts under the same organization", () => {
      const result = isSameRecruitment(
        notice({
          department: "ssc",
          post_name: "Combined Graduate Level",
          cycle_year: 2026
        }),
        notice({
          department: "ssc",
          post_name: "Junior Engineer",
          cycle_year: 2026
        })
      );

      expect(result.match).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.conflictingSignals).toEqual(
        expect.arrayContaining([RECRUITMENT_MATCH_SIGNALS.EXAM])
      );
    });

    test("does not match same post across different years", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", exam_name: "CGL", cycle_year: 2025 }),
        notice({ department: "ssc", exam_name: "CGL", cycle_year: 2026 })
      );

      expect(result.match).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.conflictingSignals).toContain(RECRUITMENT_MATCH_SIGNALS.YEAR);
    });
  });

  describe("isSameRecruitment — normalization", () => {
    test("normalizes abbreviation differences in advertisement numbers", () => {
      const result = isSameRecruitment(
        notice({ title: "Advt No CGL-01/2026", department: "ssc" }),
        notice({ advertisement_no: "CGL 01/2026", department: "ssc" })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("normalizes organization aliases", () => {
      const result = isSameRecruitment(
        notice({ title: "Staff Selection Commission CGL 2026", exam_name: "CGL" }),
        notice({ department: "SSC", exam_name: "CGL", cycle_year: 2026 })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("normalizes exam aliases", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", post_name: "Combined Graduate Level", cycle_year: 2026 }),
        notice({ department: "ssc", exam_name: "CGL", cycle_year: 2026 })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("normalizes punctuation and spacing differences", () => {
      const result = isSameRecruitment(
        notice({ title: "SSC-CGL!!! (2026) Notification" }),
        notice({ title: "ssc   cgl   2026   notification" })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("is case-insensitive", () => {
      const lower = isSameRecruitment(
        notice({ department: "ssc", exam_name: "cgl", cycle_year: 2026 }),
        notice({ department: "SSC", exam_name: "CGL", cycle_year: 2026 })
      );
      expect(lower.match).toBe(true);
      expect(lower.confidence).toBe("high");
    });
  });

  describe("isSameRecruitment — medium confidence", () => {
    test("matches organization and exam without year at medium confidence", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", exam_name: "CGL", title: "SSC CGL Admit Card" }),
        notice({ department: "ssc", exam_name: "CGL", title: "SSC CGL Answer Key" })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("medium");
      expect(result.matchedSignals).toEqual(
        expect.arrayContaining([
          RECRUITMENT_MATCH_SIGNALS.ORGANIZATION,
          RECRUITMENT_MATCH_SIGNALS.EXAM
        ])
      );
    });

    test("matches organization and post without year at medium confidence", () => {
      const result = isSameRecruitment(
        notice({ department: "rrb", post_name: "Junior Engineer" }),
        notice({ department: "Railway Recruitment Board", post_name: "JE" })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("medium");
      expect(result.matchedSignals).toEqual(
        expect.arrayContaining([
          RECRUITMENT_MATCH_SIGNALS.ORGANIZATION,
          RECRUITMENT_MATCH_SIGNALS.POST
        ])
      );
    });
  });

  describe("isSameRecruitment — unknown cases", () => {
    test("returns unknown when only organization matches", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", title: "General Update" }),
        notice({ department: "ssc", title: "Office Circular" })
      );

      expect(result.match).toBe(UNKNOWN_MATCH);
      expect(result.confidence).toBe("none");
      expect(result.matchedSignals).toContain(RECRUITMENT_MATCH_SIGNALS.ORGANIZATION);
    });

    test("returns unknown for unrelated notices without guessing", () => {
      const result = isSameRecruitment(
        notice({ title: "Office Holiday List 2026" }),
        notice({ title: "Banking Awareness PDF" })
      );

      expect(result.match).toBe(UNKNOWN_MATCH);
      expect(result.confidence).toBe("none");
      expect(result.matchedSignals).toEqual([]);
      expect(result.conflictingSignals).toEqual([]);
    });

    test("returns unknown when fields are missing", () => {
      const result = isSameRecruitment(notice({}), notice({ title: "Update" }));
      expect(result.match).toBe(UNKNOWN_MATCH);
      expect(result.confidence).toBe("none");
    });
  });

  describe("isSameRecruitment — deterministic behavior", () => {
    test("returns identical output for identical input", () => {
      const a = notice({
        department: "uppsc",
        exam_name: "GD",
        cycle_year: 2026,
        title: "Uttar Pradesh Public Service Commission GD 2026"
      });
      const b = notice({
        board: "UPPSC",
        post_name: "General Duty",
        recruitment_year: 2026,
        title: "UPPSC General Duty Result"
      });

      const first = isSameRecruitment(a, b);
      const second = isSameRecruitment(a, b);
      expect(first).toEqual(second);
    });

    test("confidence values are always from the allowed set", () => {
      const samples = [
        [notice({ department: "ssc" }), notice({ department: "ssc", exam_name: "CGL" })],
        [
          notice({ department: "ssc", exam_name: "CGL", cycle_year: 2026 }),
          notice({ department: "ssc", exam_name: "CHSL", cycle_year: 2026 })
        ],
        [notice({ advertisement_no: "01/2026" }), notice({ advertisement_no: "01/2026" })]
      ];

      for (const [left, right] of samples) {
        const result = isSameRecruitment(left, right);
        expect(MATCH_CONFIDENCE_LEVELS).toContain(result.confidence);
      }
    });
  });

  describe("regression cases", () => {
    test("advertisement number conflict overrides organization and exam agreement", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", exam_name: "CGL", advertisement_no: "01/2026" }),
        notice({ department: "ssc", exam_name: "CGL", advertisement_no: "02/2026" })
      );

      expect(result.match).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.conflictingSignals).toContain(RECRUITMENT_MATCH_SIGNALS.ADVERTISEMENT_NUMBER);
    });

    test("organization alone never produces a positive match", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", title: "SSC notice" }),
        notice({ organization: "Staff Selection Commission", title: "SSC update" })
      );

      expect(result.match).toBe(UNKNOWN_MATCH);
      expect(result.confidence).toBe("none");
    });

    test("RRB NTPC and RRB JE remain different recruitments", () => {
      const result = isSameRecruitment(
        notice({ department: "rrb", exam_name: "NTPC", cycle_year: 2026 }),
        notice({ department: "rrb", exam_name: "JE", cycle_year: 2026 })
      );

      expect(result.match).toBe(false);
      expect(result.conflictingSignals).toContain(RECRUITMENT_MATCH_SIGNALS.EXAM);
    });

    test("url path hints contribute to extracted identity", () => {
      const result = isSameRecruitment(
        notice({
          title: "Download",
          url: "https://ssc.nic.in/cgl-2026-admit-card.pdf"
        }),
        notice({
          department: "ssc",
          exam_name: "CGL",
          cycle_year: 2026,
          title: "SSC CGL 2026"
        })
      );

      expect(result.match).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("does not expose similarity scores in match result", () => {
      const result = isSameRecruitment(
        notice({ department: "ssc", exam_name: "CGL", cycle_year: 2026 }),
        notice({ department: "ssc", exam_name: "CGL", cycle_year: 2026 })
      );

      expect(result).not.toHaveProperty("score");
      expect(result).not.toHaveProperty("similarity");
      expect(result).toEqual({
        match: true,
        confidence: "high",
        matchedSignals: expect.any(Array),
        conflictingSignals: expect.any(Array)
      });
    });
  });
});
