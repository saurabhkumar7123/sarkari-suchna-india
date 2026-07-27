"use strict";

jest.mock("../server/services/recruitmentReview.service", () => ({
  listReviewItems: jest.fn(),
  getReviewItemById: jest.fn(),
  updateReviewDecision: jest.fn(),
  freezeReviewItem: jest.fn(),
  updateReviewNotes: jest.fn()
}));

const recruitmentReviewService = require("../server/services/recruitmentReview.service");
const { REVIEW_DECISIONS, REVIEW_STATUS } = require("../server/lib/recruitment/reviewQueue");
const {
  listRecruitmentReviewQueueHandler,
  getRecruitmentReviewQueueHandler,
  approveRecruitmentReviewHandler,
  rejectRecruitmentReviewHandler,
  markUnderReviewRecruitmentReviewHandler,
  freezeRecruitmentReviewHandler,
  updateRecruitmentReviewNotesHandler
} = require("../server/controllers/admin/recruitmentReviewQueue.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("recruitmentReviewQueue.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("lists items with pagination", async () => {
    recruitmentReviewService.listReviewItems.mockResolvedValue({
      data: [{ id: 1, status: "pending", title: "A" }],
      pagination: { page: 1, limit: 20, total: 1 }
    });

    const res = mockRes();
    await listRecruitmentReviewQueueHandler(
      {
        query: {
          page: "1",
          limit: "20",
          status: "pending",
          event_type: "admit_card",
          search: "SSC"
        }
      },
      res
    );

    expect(recruitmentReviewService.listReviewItems).toHaveBeenCalledWith(
      expect.objectContaining({
        page: "1",
        status: "pending",
        event_type: "admit_card",
        search: "SSC"
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({ id: 1 })],
      pagination: { page: 1, limit: 20, total: 1 }
    });
  });

  test("returns detail with Phase 29 assist payload", async () => {
    recruitmentReviewService.getReviewItemById.mockResolvedValue({
      id: 4,
      title: "Detail",
      status: "pending",
      decision: "none",
      confidence: "high",
      event_type: "admit_card",
      created_at: "2026-07-14T10:00:00.000Z",
      match_result: {
        match: true,
        confidence: "high",
        matchedSignals: ["ORGANIZATION"],
        conflictingSignals: []
      },
      raw_notice: { title: "SSC notice", organization: "ssc" },
      processor_output: {
        selectedRecruitment: { organization: "ssc", id: 9 }
      }
    });

    const res = mockRes();
    await getRecruitmentReviewQueueHandler({ params: { id: "4" } }, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        id: 4,
        title: "Detail",
        decision: "none",
        assist: expect.objectContaining({
          recommendation: expect.objectContaining({
            decision: "Likely Match",
            automaticDecisionApplied: false,
            readOnly: true
          }),
          comparison: expect.objectContaining({
            rows: expect.any(Array)
          }),
          history: expect.objectContaining({
            status: "pending",
            frozen: false
          })
        })
      })
    });

    const payload = res.json.mock.calls[0][0].data;
    expect(payload.assist.comparison.rows.length).toBe(9);
    expect(payload.status).toBe("pending");
  });

  test("returns 404 when detail missing", async () => {
    recruitmentReviewService.getReviewItemById.mockResolvedValue(null);
    const res = mockRes();
    await getRecruitmentReviewQueueHandler({ params: { id: "99" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("approves via updateReviewDecision", async () => {
    recruitmentReviewService.updateReviewDecision.mockResolvedValue({
      id: 1,
      status: REVIEW_STATUS.APPROVED,
      decision: REVIEW_DECISIONS.APPROVE
    });

    const res = mockRes();
    await approveRecruitmentReviewHandler(
      { params: { id: "1" }, body: { notes: "ok" } },
      res
    );

    expect(recruitmentReviewService.updateReviewDecision).toHaveBeenCalledWith("1", {
      decision: REVIEW_DECISIONS.APPROVE,
      notes: "ok"
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ status: REVIEW_STATUS.APPROVED })
    });
  });

  test("rejects via updateReviewDecision", async () => {
    recruitmentReviewService.updateReviewDecision.mockResolvedValue({
      id: 1,
      status: REVIEW_STATUS.REJECTED,
      decision: REVIEW_DECISIONS.REJECT
    });

    const res = mockRes();
    await rejectRecruitmentReviewHandler({ params: { id: "1" }, body: {} }, res);

    expect(recruitmentReviewService.updateReviewDecision).toHaveBeenCalledWith("1", {
      decision: REVIEW_DECISIONS.REJECT,
      notes: undefined
    });
  });

  test("marks under review via skip decision", async () => {
    recruitmentReviewService.updateReviewDecision.mockResolvedValue({
      id: 1,
      status: REVIEW_STATUS.UNDER_REVIEW,
      decision: REVIEW_DECISIONS.SKIP
    });

    const res = mockRes();
    await markUnderReviewRecruitmentReviewHandler({ params: { id: "1" }, body: {} }, res);

    expect(recruitmentReviewService.updateReviewDecision).toHaveBeenCalledWith("1", {
      decision: REVIEW_DECISIONS.SKIP,
      notes: undefined
    });
  });

  test("freezes item", async () => {
    recruitmentReviewService.freezeReviewItem.mockResolvedValue({
      id: 1,
      status: REVIEW_STATUS.FROZEN
    });

    const res = mockRes();
    await freezeRecruitmentReviewHandler({ params: { id: "1" }, body: {} }, res);

    expect(recruitmentReviewService.freezeReviewItem).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ status: REVIEW_STATUS.FROZEN })
    });
  });

  test("updates notes", async () => {
    recruitmentReviewService.updateReviewNotes.mockResolvedValue({
      id: 1,
      notes: "reviewed"
    });

    const res = mockRes();
    await updateRecruitmentReviewNotesHandler(
      { params: { id: "1" }, body: { notes: "reviewed" } },
      res
    );

    expect(recruitmentReviewService.updateReviewNotes).toHaveBeenCalledWith("1", {
      notes: "reviewed"
    });
  });

  test("surfaces frozen conflict on approve", async () => {
    const err = new Error("Review item is frozen");
    err.statusCode = 409;
    recruitmentReviewService.updateReviewDecision.mockRejectedValue(err);

    const res = mockRes();
    await approveRecruitmentReviewHandler({ params: { id: "1" }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Review item is frozen"
    });
  });
});
