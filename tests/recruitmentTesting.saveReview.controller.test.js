"use strict";

jest.mock("../server/services/recruitmentReview.service", () => ({
  saveReviewItem: jest.fn()
}));

jest.mock("../server/services/recruitmentTesting.service", () => ({
  analyzeRecruitmentNoticeInput: jest.fn()
}));

jest.mock("../server/services/recruitmentCandidateLookup.service", () => ({
  lookupRecruitmentCandidates: jest.fn()
}));

const recruitmentReviewService = require("../server/services/recruitmentReview.service");
const {
  saveRecruitmentReviewHandler
} = require("../server/controllers/admin/recruitmentTesting.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("saveRecruitmentReviewHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns saved successfully for valid payload", async () => {
    recruitmentReviewService.saveReviewItem.mockResolvedValue({
      id: 99,
      title: "SSC CGL 2026 Admit Card",
      status: "pending"
    });

    const res = mockRes();
    await saveRecruitmentReviewHandler(
      {
        body: {
          reviewItem: {
            title: "SSC CGL 2026 Admit Card",
            eventType: "admit_card",
            confidence: "high",
            createdAt: "2026-07-14T12:00:00.000Z",
            matchResult: {
              match: true,
              confidence: "high",
              matchedSignals: [],
              conflictingSignals: []
            }
          }
        }
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Saved successfully",
      data: expect.objectContaining({ id: 99 })
    });
  });

  test("returns validation failed for invalid review item", async () => {
    const err = new Error("title is required");
    err.statusCode = 400;
    err.errors = ["title is required"];
    recruitmentReviewService.saveReviewItem.mockRejectedValue(err);

    const res = mockRes();
    await saveRecruitmentReviewHandler({ body: { reviewItem: { title: "" } } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Validation failed: title is required"
    });
  });
});
