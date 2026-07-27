"use strict";

jest.mock("../server/services/recruitmentCandidateLookup.service", () => ({
  lookupRecruitmentCandidates: jest.fn()
}));

jest.mock("../server/services/recruitmentTesting.service", () => ({
  analyzeRecruitmentNoticeInput: jest.fn()
}));

const {
  lookupRecruitmentCandidates
} = require("../server/services/recruitmentCandidateLookup.service");
const {
  lookupRecruitmentCandidatesHandler
} = require("../server/controllers/admin/recruitmentTesting.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("recruitmentTesting.controller lookup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns lookup candidates on success", async () => {
    lookupRecruitmentCandidates.mockResolvedValue({
      candidates: [{ id: 1, department: "ssc" }],
      searchSummary: { strategy: "organization_exam", candidateCount: 1 }
    });

    const res = mockRes();
    await lookupRecruitmentCandidatesHandler(
      {
        body: {
          notice: { title: "SSC CGL 2026 Admit Card" }
        }
      },
      res
    );

    expect(lookupRecruitmentCandidates).toHaveBeenCalledWith({
      notice: { title: "SSC CGL 2026 Admit Card" }
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        candidates: [{ id: 1, department: "ssc" }],
        searchSummary: { strategy: "organization_exam", candidateCount: 1 }
      }
    });
  });

  test("returns safe error message without stack traces", async () => {
    lookupRecruitmentCandidates.mockRejectedValue(new Error("db down"));

    const res = mockRes();
    await lookupRecruitmentCandidatesHandler(
      {
        body: { title: "SSC CGL 2026 Admit Card" }
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Candidate lookup could not be completed. Please check your input and try again."
    });
    expect(res.json.mock.calls[0][0]).not.toHaveProperty("stack");
  });
});
