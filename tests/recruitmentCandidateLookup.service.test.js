"use strict";

jest.mock("../server/repositories/recruitment.repository", () => ({
  tableExists: jest.fn(),
  findCandidatesForLookup: jest.fn(),
  findCandidatesByAdvertisementNoLoose: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const {
  MAX_CANDIDATES,
  extractLookupCriteria,
  mapRowToCandidate,
  sortCandidatesDeterministically,
  lookupRecruitmentCandidates
} = require("../server/services/recruitmentCandidateLookup.service");

function sampleRow(overrides = {}) {
  return {
    id: 1,
    title: "SSC CGL 2026",
    slug: "ssc-cgl-2026",
    department: "ssc",
    post_name: "Combined Graduate Level",
    advertisement_no: "CGL-01/2026",
    cycle_year: 2026,
    lifecycle_state: "announced",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    ...overrides
  };
}

describe("recruitmentCandidateLookup.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.tableExists.mockResolvedValue(true);
    recruitmentRepository.findCandidatesForLookup.mockResolvedValue([]);
    recruitmentRepository.findCandidatesByAdvertisementNoLoose.mockResolvedValue([]);
  });

  test("extracts lookup criteria from notice text", () => {
    const criteria = extractLookupCriteria({
      title: "SSC CGL 2026 Admit Card Advt No CGL-01/2026"
    });

    expect(criteria.organization).toBe("ssc");
    expect(criteria.examName).toBe("cgl");
    expect(criteria.recruitmentYear).toBe(2026);
    expect(criteria.advertisementNo).toBe("cgl-01/2026");
  });

  test("looks up by advertisement number first", async () => {
    recruitmentRepository.findCandidatesForLookup.mockResolvedValueOnce([
      sampleRow({ id: 5, advertisement_no: "CGL-01/2026" })
    ]);

    const result = await lookupRecruitmentCandidates({
      notice: { title: "SSC Admit Card Advt No CGL-01/2026" }
    });

    expect(result.searchSummary.strategy).toBe("advertisement_number_exact");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        id: 5,
        advertisement_no: "CGL-01/2026",
        department: "ssc"
      })
    );
    expect(recruitmentRepository.findCandidatesForLookup).toHaveBeenCalledWith(
      expect.objectContaining({ advertisementNo: "cgl-01/2026" })
    );
  });

  test("looks up by organization and exam", async () => {
    recruitmentRepository.findCandidatesForLookup.mockImplementation(async (filters) => {
      if (filters.advertisementNo) return [];
      if (filters.department === "ssc" && Array.isArray(filters.postTokens)) {
        return [sampleRow({ id: 9, advertisement_no: null })];
      }
      return [];
    });

    const result = await lookupRecruitmentCandidates({
      notice: { title: "SSC CGL 2026 Admit Card" }
    });

    expect(["organization_exam_year", "organization_exam"]).toContain(
      result.searchSummary.strategy
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe(9);
  });

  test("looks up by organization and year when exam is unavailable", async () => {
    recruitmentRepository.findCandidatesForLookup.mockImplementation(async (filters) => {
      if (filters.postTokens || filters.postName || filters.advertisementNo) return [];
      if (filters.department === "ssc" && filters.cycleYear === 2026) {
        return [sampleRow({ id: 3, post_name: "Some Post", advertisement_no: null })];
      }
      return [];
    });

    const result = await lookupRecruitmentCandidates({
      notice: { title: "SSC Recruitment 2026 Notification" }
    });

    expect(result.searchSummary.strategy).toBe("organization_year");
    expect(result.candidates).toHaveLength(1);
  });

  test("returns empty candidates when no matches exist", async () => {
    const result = await lookupRecruitmentCandidates({
      notice: { title: "SSC CGL 2026 Admit Card" }
    });

    expect(result.candidates).toEqual([]);
    expect(result.searchSummary.candidateCount).toBe(0);
    expect(result.searchSummary.strategy).toBe("no_matches");
  });

  test("returns empty for insufficient criteria", async () => {
    const result = await lookupRecruitmentCandidates({
      notice: { title: "Office Holiday List Notice" }
    });

    expect(result.candidates).toEqual([]);
    expect(result.searchSummary.strategy).toBe("insufficient_criteria");
  });

  test("limits results to MAX_CANDIDATES", async () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      sampleRow({ id: i + 1, advertisement_no: "01/2026" })
    );
    recruitmentRepository.findCandidatesForLookup.mockResolvedValue(rows);

    const result = await lookupRecruitmentCandidates({
      notice: { title: "Advertisement Number 01/2026" }
    });

    expect(result.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(result.searchSummary.limitedTo).toBe(MAX_CANDIDATES);
  });

  test("sorts candidates deterministically by id", () => {
    const sorted = sortCandidatesDeterministically([
      mapRowToCandidate(sampleRow({ id: 3 })),
      mapRowToCandidate(sampleRow({ id: 1 })),
      mapRowToCandidate(sampleRow({ id: 2 }))
    ]);

    expect(sorted.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  test("is read-only and does not call write APIs", async () => {
    await lookupRecruitmentCandidates({
      notice: { title: "SSC CGL 2026 Admit Card" }
    });

    expect(recruitmentRepository.tableExists).toHaveBeenCalled();
    expect(Object.keys(recruitmentRepository)).toEqual(
      expect.arrayContaining([
        "tableExists",
        "findCandidatesForLookup",
        "findCandidatesByAdvertisementNoLoose"
      ])
    );
    expect(recruitmentRepository.findCandidatesForLookup).toHaveBeenCalled();
  });

  test("returns empty when recruitments table is missing", async () => {
    recruitmentRepository.tableExists.mockResolvedValue(false);

    const result = await lookupRecruitmentCandidates({
      notice: { title: "SSC CGL 2026 Admit Card" }
    });

    expect(result.candidates).toEqual([]);
    expect(result.searchSummary.strategy).toBe("table_missing");
    expect(recruitmentRepository.findCandidatesForLookup).not.toHaveBeenCalled();
  });
});
