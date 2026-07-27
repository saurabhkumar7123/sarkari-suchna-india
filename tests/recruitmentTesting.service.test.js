"use strict";

const { analyzeRecruitmentNoticeInput } = require("../server/services/recruitmentTesting.service");
const {
  PROCESS_RESULT_STATUS,
  PROCESS_WARNINGS
} = require("../server/lib/recruitment/detectionProcessor");

const sampleCandidates = [
  {
    organization: "SSC",
    exam_name: "CGL",
    recruitment_year: 2026,
    advertisement_no: "CGL-01/2026"
  },
  {
    organization: "SSC",
    exam_name: "CHSL",
    recruitment_year: 2026
  }
];

describe("recruitmentTesting.service", () => {
  test("analyzes a valid notice with a single candidate match", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "SSC CGL 2026 Admit Card",
      content: "Download admit card for Tier 1",
      url: "https://ssc.nic.in/admit-card-cgl-2026.pdf",
      candidateRecruitments: [sampleCandidates[0]],
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis.rawInput.notice.title).toBe("SSC CGL 2026 Admit Card");
    expect(analysis.rawInput.candidateRecruitments).toHaveLength(1);
    expect(analysis.candidateMatching.candidateCount).toBe(1);
    expect(analysis.candidateMatching.individualMatchResults).toHaveLength(1);
    expect(analysis.candidateMatching.selectedCandidate).toEqual(sampleCandidates[0]);
    expect(analysis.candidateMatching.matchedSignals.length).toBeGreaterThan(0);
    expect(analysis.finalStatus).toBe(PROCESS_RESULT_STATUS.SUCCESS);
  });

  test("supports multiple candidates and selects the strongest match", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "SSC CGL 2026 Admit Card",
      content: "Advertisement Number CGL-01/2026",
      candidateRecruitments: [
        { organization: "SSC", exam_name: "CGL", recruitment_year: 2026 },
        sampleCandidates[0]
      ],
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis.candidateMatching.candidateCount).toBe(2);
    expect(analysis.candidateMatching.individualMatchResults).toHaveLength(2);
    expect(analysis.candidateMatching.selectedCandidate).toEqual(
      expect.objectContaining({ advertisement_no: "CGL-01/2026" })
    );
  });

  test("reports ambiguous match warning for equal candidates", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: [
        { id: 1, organization: "SSC", exam_name: "CGL", recruitment_year: 2026 },
        { id: 2, organization: "SSC", exam_name: "CGL", recruitment_year: 2026 }
      ],
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis.finalStatus).toBe(PROCESS_RESULT_STATUS.AMBIGUOUS_MATCH);
    expect(analysis.candidateMatching.ambiguous).toBe(true);
    expect(analysis.candidateMatching.warnings.ambiguousMatch).toBe(true);
    expect(analysis.candidateMatching.selectedCandidate).toBeNull();
    expect(analysis.warnings).toContain(PROCESS_WARNINGS.MULTIPLE_EQUAL_MATCHES);
  });

  test("reports no match for conflicting candidates", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: [
        { organization: "SSC", exam_name: "CHSL", recruitment_year: 2026 },
        { organization: "SSC", exam_name: "JE", recruitment_year: 2026 }
      ],
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis.finalStatus).toBe(PROCESS_RESULT_STATUS.NO_MATCH);
    expect(analysis.candidateMatching.warnings.noMatch).toBe(true);
    expect(analysis.candidateMatching.selectedCandidate).toBeNull();
  });

  test("reports unknown match for unrelated notices", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "Office Holiday List 2026",
      candidateRecruitments: sampleCandidates,
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis.classification.eventType).toBe("unknown");
    expect(analysis.finalStatus).toBe(PROCESS_RESULT_STATUS.UNKNOWN_EVENT);
    expect(analysis.candidateMatching.warnings.unknownMatch).toBe(true);
    expect(analysis.warnings).toContain(PROCESS_WARNINGS.UNKNOWN_EVENT_TYPE);
  });

  test("handles empty candidate array", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "SSC CGL 2026 Admit Card",
      candidateRecruitments: [],
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis.candidateMatching.candidateCount).toBe(0);
    expect(analysis.candidateMatching.individualMatchResults).toEqual([]);
    expect(analysis.candidateMatching.warnings.noCandidates).toBe(true);
    expect(analysis.warnings).toContain(PROCESS_WARNINGS.NO_CANDIDATES);
  });

  test("handles invalid notice input via processor status", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "",
      content: "",
      url: "",
      candidateRecruitments: []
    });

    expect(analysis.finalStatus).toBe(PROCESS_RESULT_STATUS.INVALID_INPUT);
    expect(analysis.warnings).toContain(PROCESS_WARNINGS.INVALID_NOTICE);
    expect(analysis.reviewItem).toBeNull();
  });

  test("is deterministic for identical input", () => {
    const input = {
      title: "SSC CGL 2026 Answer Key",
      content: "Provisional answer key published",
      url: "https://ssc.nic.in/answer-key-cgl-2026.pdf",
      candidateRecruitments: [sampleCandidates[0]],
      createdAt: "2026-07-13T12:00:00.000Z"
    };

    expect(analyzeRecruitmentNoticeInput(input)).toEqual(analyzeRecruitmentNoticeInput(input));
  });

  test("does not perform database writes", () => {
    const analysis = analyzeRecruitmentNoticeInput({
      title: "SSC CGL 2026 Result",
      candidateRecruitments: [sampleCandidates[0]],
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(analysis).not.toHaveProperty("database");
    expect(analysis.reviewItem).toBeDefined();
    expect(analysis.reviewItem.frozen).toBe(false);
  });
});
