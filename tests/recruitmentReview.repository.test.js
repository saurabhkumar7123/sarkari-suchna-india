"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn()
}));

const db = require("../server/config/db");
const recruitmentReviewRepository = require("../server/repositories/recruitmentReview.repository");

describe("recruitmentReview.repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("create inserts review row and returns findById result", async () => {
    db.query
      .mockResolvedValueOnce([{ insertId: 11 }])
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            recruitment_id: 3,
            event_type: "admit_card",
            match_result_json: JSON.stringify({
              match: true,
              confidence: "high",
              matchedSignals: [],
              conflictingSignals: []
            }),
            confidence: "high",
            confidence_level: 3,
            source_url: "https://example.com",
            title: "SSC CGL Admit Card",
            raw_notice_json: JSON.stringify({ title: "SSC CGL Admit Card" }),
            normalized_notice_json: JSON.stringify({ text: "ssc cgl admit card" }),
            processor_output_json: JSON.stringify({ status: "success" }),
            payload_json: null,
            review_status: "pending",
            decision: "none",
            notes: null,
            update_id: null,
            recruitment_event_id: null,
            created_at: "2026-07-14T00:00:00.000Z",
            updated_at: "2026-07-14T00:00:00.000Z"
          }
        ]
      ]);

    const row = await recruitmentReviewRepository.create({
      recruitment_id: 3,
      event_type: "admit_card",
      match_result: {
        match: true,
        confidence: "high",
        matchedSignals: [],
        conflictingSignals: []
      },
      confidence: "high",
      source_url: "https://example.com",
      title: "SSC CGL Admit Card",
      raw_notice: { title: "SSC CGL Admit Card" },
      normalized_notice: "ssc cgl admit card",
      processor_output: { status: "success" },
      status: "pending",
      decision: "none"
    });

    expect(db.query.mock.calls[0][0]).toMatch(/INSERT INTO recruitment_review_queue/);
    expect(row).toEqual(
      expect.objectContaining({
        id: 11,
        event_type: "admit_card",
        status: "pending",
        decision: "none",
        confidence: "high"
      })
    );
  });

  test("findPending queries pending rows ordered deterministically", async () => {
    db.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          review_status: "pending",
          decision: "none",
          title: "A",
          event_type: "result",
          match_result_json: null,
          confidence: null,
          confidence_level: null,
          source_url: null,
          raw_notice_json: null,
          normalized_notice_json: null,
          processor_output_json: null,
          payload_json: null,
          recruitment_id: null,
          recruitment_event_id: null,
          update_id: null,
          notes: null,
          created_at: "2026-07-14T00:00:00.000Z",
          updated_at: "2026-07-14T00:00:00.000Z"
        }
      ]
    ]);

    const rows = await recruitmentReviewRepository.findPending({ limit: 10 });
    expect(db.query.mock.calls[0][0]).toMatch(/review_status = 'pending'/);
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY created_at ASC, id ASC/);
    expect(rows[0].status).toBe("pending");
  });

  test("updateDecision updates decision and status", async () => {
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [
          {
            id: 5,
            review_status: "approved",
            decision: "approve",
            title: "Saved",
            event_type: "admit_card",
            match_result_json: null,
            confidence: "high",
            confidence_level: 3,
            source_url: null,
            raw_notice_json: null,
            normalized_notice_json: null,
            processor_output_json: null,
            payload_json: null,
            recruitment_id: null,
            recruitment_event_id: null,
            update_id: null,
            notes: "ok",
            created_at: "2026-07-14T00:00:00.000Z",
            updated_at: "2026-07-14T00:00:00.000Z"
          }
        ]
      ]);

    const row = await recruitmentReviewRepository.updateDecision(5, {
      decision: "approve",
      status: "approved",
      notes: "ok"
    });

    expect(db.query.mock.calls[0][0]).toMatch(/UPDATE recruitment_review_queue/);
    expect(row.status).toBe("approved");
    expect(row.decision).toBe("approve");
  });

  test("list applies status event_type and search filters with pagination", async () => {
    db.query
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 2,
            review_status: "pending",
            decision: "none",
            title: "SSC Admit Card",
            event_type: "admit_card",
            match_result_json: null,
            confidence: "high",
            confidence_level: 3,
            source_url: "https://example.com/a",
            raw_notice_json: null,
            normalized_notice_json: null,
            processor_output_json: null,
            payload_json: null,
            recruitment_id: 10,
            recruitment_event_id: null,
            update_id: null,
            notes: null,
            created_at: "2026-07-14T00:00:00.000Z",
            updated_at: "2026-07-14T00:00:00.000Z"
          }
        ]
      ]);

    const result = await recruitmentReviewRepository.list({
      page: 1,
      limit: 10,
      status: "pending",
      event_type: "admit_card",
      recruitment_id: 10,
      search: "SSC"
    });

    expect(db.query.mock.calls[0][0]).toMatch(/COUNT\(\*\)/);
    expect(db.query.mock.calls[0][0]).toMatch(/review_status = \?/);
    expect(db.query.mock.calls[0][0]).toMatch(/event_type = \?/);
    expect(db.query.mock.calls[0][0]).toMatch(/recruitment_id = \?/);
    expect(db.query.mock.calls[0][0]).toMatch(/title LIKE \?/);
    expect(db.query.mock.calls[1][0]).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2 });
    expect(result.data[0].status).toBe("pending");
  });

  test("tableExists returns false when query fails", async () => {
    db.query.mockRejectedValueOnce(new Error("no db"));
    await expect(recruitmentReviewRepository.tableExists()).resolves.toBe(false);
  });
});
