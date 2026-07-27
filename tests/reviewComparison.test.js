"use strict";

const {
  FIELD_VISUAL_STATUS,
  buildReviewComparison,
  buildReviewHistory,
  buildReviewAssistView,
  resolveFieldVisualStatus
} = require("../server/lib/recruitment/reviewComparison");
const { RECOMMENDED_DECISIONS } = require("../server/lib/recruitment/reviewDecisionAssistant");

function sampleReviewItem(overrides = {}) {
  return {
    id: 10,
    recruitment_id: 42,
    event_type: "admit_card",
    confidence: "high",
    status: "pending",
    decision: "none",
    notes: "check advt",
    created_at: "2026-07-14T10:00:00.000Z",
    match_result: {
      match: true,
      confidence: "high",
      matchedSignals: ["ORGANIZATION", "EXAM", "YEAR"],
      conflictingSignals: []
    },
    raw_notice: {
      title: "SSC CGL Admit Card 2026",
      content: "Staff Selection Commission Combined Graduate Level 2026",
      organization: "ssc",
      exam_name: "cgl",
      recruitment_year: 2026
    },
    processor_output: {
      selectedRecruitment: {
        id: 42,
        organization: "ssc",
        department: "ssc",
        exam_name: "cgl",
        post_name: null,
        advertisement_no: "01/2026",
        recruitment_year: 2026,
        cycle_year: 2026
      }
    },
    ...overrides
  };
}

describe("reviewComparison — visual status", () => {
  test("marks matched / missing / conflicting correctly", () => {
    expect(
      resolveFieldVisualStatus("ORGANIZATION", ["ORGANIZATION"], [], "ssc", "ssc")
    ).toBe(FIELD_VISUAL_STATUS.MATCHED);

    expect(
      resolveFieldVisualStatus("POST", [], [], null, "clerk")
    ).toBe(FIELD_VISUAL_STATUS.MISSING);

    expect(
      resolveFieldVisualStatus("YEAR", [], ["YEAR"], "2025", "2026")
    ).toBe(FIELD_VISUAL_STATUS.CONFLICTING);
  });
});

describe("reviewComparison — comparison rendering model", () => {
  test("builds side-by-side comparison rows for required fields", () => {
    const comparison = buildReviewComparison(sampleReviewItem());

    const labels = comparison.rows.map((row) => row.label);
    expect(labels).toEqual([
      "Organization",
      "Exam Name",
      "Post Name",
      "Advertisement Number",
      "Recruitment Year",
      "Event Type",
      "Confidence",
      "Matched Signals",
      "Conflicting Signals"
    ]);

    const organization = comparison.rows.find((row) => row.key === "organization");
    expect(organization.noticeValue).toBe("ssc");
    expect(organization.candidateValue).toBe("ssc");
    expect(organization.visualStatus).toBe(FIELD_VISUAL_STATUS.MATCHED);

    const year = comparison.rows.find((row) => row.key === "recruitmentYear");
    expect(year.noticeValue).toBe("2026");
    expect(year.candidateValue).toBe("2026");
    expect(year.visualStatus).toBe(FIELD_VISUAL_STATUS.MATCHED);

    const advt = comparison.rows.find((row) => row.key === "advertisementNo");
    expect(advt.noticeValue).toBe("—");
    expect(advt.candidateValue).toBe("01/2026");
    expect(advt.visualStatus).toBe(FIELD_VISUAL_STATUS.MISSING);
  });

  test("highlights conflicting advertisement number in red status", () => {
    const comparison = buildReviewComparison(
      sampleReviewItem({
        match_result: {
          match: false,
          confidence: "high",
          matchedSignals: [],
          conflictingSignals: ["ADVERTISEMENT_NUMBER"]
        },
        raw_notice: {
          title: "SSC CGL",
          advertisement_no: "02/2026",
          organization: "ssc"
        },
        processor_output: {
          selectedRecruitment: {
            organization: "ssc",
            advertisement_no: "01/2026",
            recruitment_year: 2026
          }
        }
      })
    );

    const advt = comparison.rows.find((row) => row.key === "advertisementNo");
    expect(advt.visualStatus).toBe(FIELD_VISUAL_STATUS.CONFLICTING);
    expect(advt.noticeValue).toBe("02/2026");
    expect(advt.candidateValue).toBe("01/2026");
  });
});

describe("reviewComparison — history", () => {
  test("builds history snapshot including frozen state", () => {
    const history = buildReviewHistory(
      sampleReviewItem({
        status: "frozen",
        decision: "approve",
        notes: "locked"
      })
    );

    expect(history).toEqual({
      createdAt: "2026-07-14T10:00:00.000Z",
      status: "frozen",
      decision: "approve",
      notes: "locked",
      frozen: true
    });
  });

  test("marks non-frozen statuses correctly", () => {
    const history = buildReviewHistory(sampleReviewItem({ status: "under_review" }));
    expect(history.frozen).toBe(false);
    expect(history.status).toBe("under_review");
  });
});

describe("reviewComparison — assist view", () => {
  test("combines recommendation, comparison, and history without mutating decisions", () => {
    const item = sampleReviewItem();
    const assist = buildReviewAssistView(item);

    expect(assist.recommendation.decision).toBe(RECOMMENDED_DECISIONS.LIKELY_MATCH);
    expect(assist.recommendation.automaticDecisionApplied).toBe(false);
    expect(assist.comparison.rows.length).toBe(9);
    expect(assist.history.status).toBe("pending");
    expect(item.decision).toBe("none");
    expect(item.status).toBe("pending");
  });
});
