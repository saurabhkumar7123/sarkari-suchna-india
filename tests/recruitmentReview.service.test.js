"use strict";

jest.mock("../server/repositories/recruitmentReview.repository", () => ({
  tableExists: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findPending: jest.fn(),
  list: jest.fn(),
  updateDecision: jest.fn()
}));

const recruitmentReviewRepository = require("../server/repositories/recruitmentReview.repository");
const recruitmentReviewService = require("../server/services/recruitmentReview.service");
const { REVIEW_STATUS, REVIEW_DECISIONS } = require("../server/lib/recruitment/reviewQueue");

function validReviewPayload(overrides = {}) {
  return {
    reviewItem: {
      recruitmentId: 1,
      eventType: "admit_card",
      matchResult: {
        match: true,
        confidence: "high",
        matchedSignals: ["ORGANIZATION", "EXAM", "YEAR"],
        conflictingSignals: []
      },
      confidence: "high",
      sourceUrl: "https://ssc.nic.in/admit.pdf",
      title: "SSC CGL 2026 Admit Card",
      createdAt: "2026-07-14T12:00:00.000Z",
      notes: null
    },
    raw_notice: { title: "SSC CGL 2026 Admit Card", content: "", url: "" },
    normalized_notice: "ssc cgl 2026 admit card",
    processor_output: { status: "success", eventType: "admit_card" },
    finalStatus: "success",
    warnings: [],
    ...overrides
  };
}

describe("recruitmentReview.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentReviewRepository.tableExists.mockResolvedValue(true);
  });

  test("saves a valid review item", async () => {
    recruitmentReviewRepository.create.mockResolvedValue({
      id: 42,
      status: REVIEW_STATUS.PENDING,
      decision: REVIEW_DECISIONS.NONE,
      title: "SSC CGL 2026 Admit Card"
    });

    const saved = await recruitmentReviewService.saveReviewItem(validReviewPayload());

    expect(recruitmentReviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "admit_card",
        title: "SSC CGL 2026 Admit Card",
        status: REVIEW_STATUS.PENDING,
        decision: REVIEW_DECISIONS.NONE
      })
    );
    expect(saved.id).toBe(42);
  });

  test("rejects invalid review item without writing", async () => {
    await expect(
      recruitmentReviewService.saveReviewItem({
        reviewItem: {
          title: "",
          eventType: "invalid",
          createdAt: "not-a-date"
        }
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(recruitmentReviewRepository.create).not.toHaveBeenCalled();
  });

  test("lists pending items via repository", async () => {
    recruitmentReviewRepository.findPending.mockResolvedValue([{ id: 1, status: "pending" }]);
    const rows = await recruitmentReviewService.listPendingReviewItems({ limit: 10 });
    expect(rows).toHaveLength(1);
    expect(recruitmentReviewRepository.findPending).toHaveBeenCalledWith({ limit: 10 });
  });

  test("updates decision and maps to status", async () => {
    recruitmentReviewRepository.findById.mockResolvedValue({
      id: 7,
      status: REVIEW_STATUS.PENDING,
      decision: REVIEW_DECISIONS.NONE,
      notes: null
    });
    recruitmentReviewRepository.updateDecision.mockResolvedValue({
      id: 7,
      status: REVIEW_STATUS.APPROVED,
      decision: REVIEW_DECISIONS.APPROVE
    });

    const updated = await recruitmentReviewService.updateReviewDecision(7, {
      decision: REVIEW_DECISIONS.APPROVE
    });

    expect(recruitmentReviewRepository.updateDecision).toHaveBeenCalledWith(7, {
      decision: REVIEW_DECISIONS.APPROVE,
      status: REVIEW_STATUS.APPROVED,
      notes: null
    });
    expect(updated.status).toBe(REVIEW_STATUS.APPROVED);
  });

  test("does not update frozen review items", async () => {
    recruitmentReviewRepository.findById.mockResolvedValue({
      id: 7,
      status: REVIEW_STATUS.FROZEN,
      decision: REVIEW_DECISIONS.APPROVE
    });

    await expect(
      recruitmentReviewService.updateReviewDecision(7, { decision: REVIEW_DECISIONS.REJECT })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(recruitmentReviewRepository.updateDecision).not.toHaveBeenCalled();
  });

  test("lists review items with filters", async () => {
    recruitmentReviewRepository.list.mockResolvedValue({
      data: [{ id: 1, status: "pending" }],
      pagination: { page: 1, limit: 20, total: 1 }
    });

    const result = await recruitmentReviewService.listReviewItems({
      page: 1,
      status: "pending",
      event_type: "admit_card"
    });

    expect(result.data).toHaveLength(1);
    expect(recruitmentReviewRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        status: "pending",
        event_type: "admit_card"
      })
    );
  });

  test("rejects invalid status filter", async () => {
    await expect(
      recruitmentReviewService.listReviewItems({ status: "nope" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(recruitmentReviewRepository.list).not.toHaveBeenCalled();
  });

  test("freezes a review item", async () => {
    recruitmentReviewRepository.findById.mockResolvedValue({
      id: 9,
      status: REVIEW_STATUS.PENDING,
      decision: REVIEW_DECISIONS.NONE,
      notes: "keep"
    });
    recruitmentReviewRepository.updateDecision.mockResolvedValue({
      id: 9,
      status: REVIEW_STATUS.FROZEN
    });

    const updated = await recruitmentReviewService.freezeReviewItem(9);
    expect(recruitmentReviewRepository.updateDecision).toHaveBeenCalledWith(9, {
      decision: REVIEW_DECISIONS.NONE,
      status: REVIEW_STATUS.FROZEN,
      notes: "keep"
    });
    expect(updated.status).toBe(REVIEW_STATUS.FROZEN);
  });

  test("updates notes on non-frozen item", async () => {
    recruitmentReviewRepository.findById.mockResolvedValue({
      id: 3,
      status: REVIEW_STATUS.UNDER_REVIEW,
      decision: REVIEW_DECISIONS.SKIP,
      notes: null
    });
    recruitmentReviewRepository.updateDecision.mockResolvedValue({
      id: 3,
      notes: "checked"
    });

    const updated = await recruitmentReviewService.updateReviewNotes(3, { notes: "checked" });
    expect(recruitmentReviewRepository.updateDecision).toHaveBeenCalledWith(3, {
      decision: REVIEW_DECISIONS.SKIP,
      status: REVIEW_STATUS.UNDER_REVIEW,
      notes: "checked"
    });
    expect(updated.notes).toBe("checked");
  });

  test("blocks notes update when frozen", async () => {
    recruitmentReviewRepository.findById.mockResolvedValue({
      id: 3,
      status: REVIEW_STATUS.FROZEN,
      decision: REVIEW_DECISIONS.APPROVE,
      notes: "locked"
    });

    await expect(
      recruitmentReviewService.updateReviewNotes(3, { notes: "new" })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(recruitmentReviewRepository.updateDecision).not.toHaveBeenCalled();
  });
});
