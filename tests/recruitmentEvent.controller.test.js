"use strict";

jest.mock("../server/services/recruitmentEvent.service", () => ({
  EVENT_TYPES: [
    "notification",
    "short_notification",
    "correction",
    "exam_date",
    "city_intimation",
    "admit_card",
    "answer_key",
    "objection",
    "result",
    "final_result",
    "dv",
    "medical",
    "joining"
  ],
  EVENT_STATUSES: ["pending", "active", "superseded", "cancelled"],
  createRecruitmentEvent: jest.fn(),
  updateRecruitmentEvent: jest.fn(),
  deleteRecruitmentEvent: jest.fn(),
  getRecruitmentEvent: jest.fn(),
  listRecruitmentEvents: jest.fn()
}));

jest.mock("../server/services/adminActivity.service", () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const recruitmentEventService = require("../server/services/recruitmentEvent.service");
const { recordActivity } = require("../server/services/adminActivity.service");
const {
  listRecruitmentEventsHandler,
  getRecruitmentEventHandler,
  createRecruitmentEventHandler,
  updateRecruitmentEventHandler,
  deleteRecruitmentEventHandler
} = require("../server/controllers/admin/recruitmentEvent.controller");

const sampleEvent = {
  id: 5,
  recruitment_id: 10,
  event_type: "notification",
  sequence_order: 1,
  status: "pending",
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z"
};

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { username: "test-admin" },
    ip: "127.0.0.1",
    headers: { "user-agent": "jest" },
    id: "req-1",
    ...overrides
  };
}

describe("recruitmentEvent.controller admin CRUD", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("listRecruitmentEventsHandler returns paginated data", async () => {
    recruitmentEventService.listRecruitmentEvents.mockResolvedValue({
      data: [sampleEvent],
      pagination: { page: 1, limit: 20, total: 1 }
    });
    const req = mockReq({
      params: { recruitmentId: "10" },
      query: { page: "1", limit: "20", status: "pending" }
    });
    const res = mockRes();

    await listRecruitmentEventsHandler(req, res);

    expect(recruitmentEventService.listRecruitmentEvents).toHaveBeenCalledWith({
      recruitment_id: "10",
      page: "1",
      limit: "20",
      status: "pending"
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [sampleEvent],
      pagination: { page: 1, limit: 20, total: 1 }
    });
  });

  test("getRecruitmentEventHandler returns an event row", async () => {
    recruitmentEventService.getRecruitmentEvent.mockResolvedValue(sampleEvent);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await getRecruitmentEventHandler(req, res);

    expect(recruitmentEventService.getRecruitmentEvent).toHaveBeenCalledWith("5");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: sampleEvent });
  });

  test("createRecruitmentEventHandler creates event and records activity", async () => {
    recruitmentEventService.createRecruitmentEvent.mockResolvedValue(sampleEvent);
    const req = mockReq({
      params: { recruitmentId: "10" },
      body: { event_type: "notification", sequence_order: 1, status: "pending" }
    });
    const res = mockRes();

    await createRecruitmentEventHandler(req, res);

    expect(recruitmentEventService.createRecruitmentEvent).toHaveBeenCalledWith({
      event_type: "notification",
      sequence_order: 1,
      status: "pending",
      recruitment_id: "10"
    });
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: "test-admin",
        action: "recruitment_event_create",
        target: "5",
        status: "success"
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: sampleEvent });
  });

  test("updateRecruitmentEventHandler updates event and records activity", async () => {
    const updated = { ...sampleEvent, status: "active" };
    recruitmentEventService.updateRecruitmentEvent.mockResolvedValue(updated);
    const req = mockReq({
      params: { id: "5" },
      body: { status: "active" }
    });
    const res = mockRes();

    await updateRecruitmentEventHandler(req, res);

    expect(recruitmentEventService.updateRecruitmentEvent).toHaveBeenCalledWith("5", {
      status: "active"
    });
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: "test-admin",
        action: "recruitment_event_update",
        target: "5",
        status: "success"
      })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
  });

  test("deleteRecruitmentEventHandler deletes event and records activity", async () => {
    recruitmentEventService.deleteRecruitmentEvent.mockResolvedValue(sampleEvent);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await deleteRecruitmentEventHandler(req, res);

    expect(recruitmentEventService.deleteRecruitmentEvent).toHaveBeenCalledWith("5");
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recruitment_event_delete", target: "5" })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: sampleEvent });
  });

  test("createRecruitmentEventHandler propagates service errors", async () => {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    recruitmentEventService.createRecruitmentEvent.mockRejectedValue(err);
    const req = mockReq({
      params: { recruitmentId: "99" },
      body: { event_type: "notification" }
    });
    const res = mockRes();

    await expect(createRecruitmentEventHandler(req, res)).rejects.toThrow("Recruitment not found");
    expect(recordActivity).not.toHaveBeenCalled();
  });
});
