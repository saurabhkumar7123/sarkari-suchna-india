"use strict";

jest.mock("../server/services/recruitmentTesting.service", () => ({
  analyzeRecruitmentNoticeInput: jest.fn()
}));

const { analyzeRecruitmentNoticeInput } = require("../server/services/recruitmentTesting.service");
const { analyzeRecruitmentNoticeHandler } = require("../server/controllers/admin/recruitmentTesting.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    body: {},
    ...overrides
  };
}

describe("recruitmentTesting.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns analysis data on success", async () => {
    const data = {
      rawInput: {
        notice: { title: "SSC CGL 2026 Admit Card", content: "", url: "" },
        candidateRecruitments: []
      },
      candidateMatching: { candidateCount: 0 },
      finalStatus: "success"
    };
    analyzeRecruitmentNoticeInput.mockReturnValue(data);

    const res = mockRes();
    await analyzeRecruitmentNoticeHandler(
      mockReq({
        body: { title: "SSC CGL 2026 Admit Card" }
      }),
      res
    );

    expect(analyzeRecruitmentNoticeInput).toHaveBeenCalledWith({
      title: "SSC CGL 2026 Admit Card"
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  test("returns safe error response without stack traces", async () => {
    analyzeRecruitmentNoticeInput.mockImplementation(() => {
      throw new Error("unexpected failure");
    });

    const res = mockRes();
    await analyzeRecruitmentNoticeHandler(
      mockReq({
        body: { title: "SSC CGL 2026 Admit Card" }
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Analysis could not be completed. Please check your input and try again."
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload).not.toHaveProperty("stack");
    expect(payload).not.toHaveProperty("error");
  });

  test("does not trigger side effects", async () => {
    analyzeRecruitmentNoticeInput.mockReturnValue({
      rawInput: {
        notice: { title: "Notice", content: "", url: "" },
        candidateRecruitments: []
      },
      candidateMatching: { candidateCount: 0 },
      reviewItem: null,
      finalStatus: "unknown_event"
    });

    const res = mockRes();
    await analyzeRecruitmentNoticeHandler(
      mockReq({
        body: { title: "Notice" }
      }),
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Object)
      })
    );
  });
});
