"use strict";

jest.mock("../server/repositories/recruitmentEvent.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  createRecruitmentEvent: jest.fn(),
  getRecruitmentEventById: jest.fn(),
  listRecruitmentEventsByRecruitmentId: jest.fn(),
  updateRecruitmentEvent: jest.fn(),
  deleteRecruitmentEvent: jest.fn()
}));

jest.mock("../server/repositories/recruitment.repository", () => ({
  getRecruitmentById: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const recruitmentEventRepository = require("../server/repositories/recruitmentEvent.repository");
const recruitmentEventService = require("../server/services/recruitmentEvent.service");

const parentRecruitment = {
  id: 10,
  title: "SSC CGL 2026",
  slug: "ssc-cgl-2026",
  lifecycle_state: "announced"
};

const sampleEvent = {
  id: 5,
  recruitment_id: 10,
  event_type: "notification",
  sequence_order: 1,
  status: "pending",
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z"
};

describe("recruitmentEvent.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.getRecruitmentById.mockResolvedValue(parentRecruitment);
  });

  test("createRecruitmentEvent persists a validated event", async () => {
    recruitmentEventRepository.createRecruitmentEvent.mockResolvedValue(sampleEvent);

    const row = await recruitmentEventService.createRecruitmentEvent({
      recruitment_id: 10,
      event_type: "notification",
      sequence_order: 1,
      status: "pending"
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentEventRepository.createRecruitmentEvent).toHaveBeenCalledWith({
      recruitment_id: 10,
      event_type: "notification",
      sequence_order: 1,
      status: "pending"
    });
    expect(row).toEqual(sampleEvent);
  });

  test("createRecruitmentEvent rejects missing event_type", async () => {
    await expect(
      recruitmentEventService.createRecruitmentEvent({ recruitment_id: 10, event_type: " " })
    ).rejects.toMatchObject({ statusCode: 400, message: "event_type is required" });
  });

  test("createRecruitmentEvent rejects invalid event_type", async () => {
    await expect(
      recruitmentEventService.createRecruitmentEvent({
        recruitment_id: 10,
        event_type: "invalid_type"
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid event_type" });
  });

  test("createRecruitmentEvent rejects invalid status", async () => {
    await expect(
      recruitmentEventService.createRecruitmentEvent({
        recruitment_id: 10,
        event_type: "notification",
        status: "archived"
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid status" });
  });

  test("createRecruitmentEvent rejects invalid sequence_order", async () => {
    await expect(
      recruitmentEventService.createRecruitmentEvent({
        recruitment_id: 10,
        event_type: "notification",
        sequence_order: 70000
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "sequence_order must be an integer between 0 and 65535"
    });
  });

  test("createRecruitmentEvent rejects missing parent recruitment", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);

    await expect(
      recruitmentEventService.createRecruitmentEvent({
        recruitment_id: 99,
        event_type: "notification"
      })
    ).rejects.toMatchObject({ statusCode: 404, message: "Recruitment not found" });
  });

  test("updateRecruitmentEvent updates an existing event", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue(sampleEvent);
    recruitmentEventRepository.updateRecruitmentEvent.mockResolvedValue({
      ...sampleEvent,
      event_type: "admit_card",
      status: "active"
    });

    const row = await recruitmentEventService.updateRecruitmentEvent(5, {
      event_type: "admit_card",
      status: "active"
    });

    expect(recruitmentEventRepository.updateRecruitmentEvent).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        recruitment_id: 10,
        event_type: "admit_card",
        sequence_order: 1,
        status: "active"
      })
    );
    expect(row.event_type).toBe("admit_card");
  });

  test("updateRecruitmentEvent rejects invalid status", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue(sampleEvent);

    await expect(
      recruitmentEventService.updateRecruitmentEvent(5, { status: "draft" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid status" });
  });

  test("getRecruitmentEvent returns a row by id", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue(sampleEvent);

    const row = await recruitmentEventService.getRecruitmentEvent(5);

    expect(recruitmentEventRepository.getRecruitmentEventById).toHaveBeenCalledWith(5);
    expect(row).toEqual(sampleEvent);
  });

  test("getRecruitmentEvent returns 404 when missing", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue(null);

    await expect(recruitmentEventService.getRecruitmentEvent(99)).rejects.toMatchObject({
      statusCode: 404,
      message: "Recruitment event not found"
    });
  });

  test("deleteRecruitmentEvent deletes and returns the event", async () => {
    recruitmentEventRepository.deleteRecruitmentEvent.mockResolvedValue(sampleEvent);

    const row = await recruitmentEventService.deleteRecruitmentEvent(5);

    expect(recruitmentEventRepository.deleteRecruitmentEvent).toHaveBeenCalledWith(5);
    expect(row).toEqual(sampleEvent);
  });

  test("deleteRecruitmentEvent returns 404 when missing", async () => {
    recruitmentEventRepository.deleteRecruitmentEvent.mockResolvedValue(null);

    await expect(recruitmentEventService.deleteRecruitmentEvent(99)).rejects.toMatchObject({
      statusCode: 404,
      message: "Recruitment event not found"
    });
  });

  test("listRecruitmentEvents delegates to repository", async () => {
    const payload = {
      data: [sampleEvent],
      pagination: { page: 1, limit: 20, total: 1 }
    };
    recruitmentEventRepository.listRecruitmentEventsByRecruitmentId.mockResolvedValue(payload);

    const result = await recruitmentEventService.listRecruitmentEvents({
      recruitment_id: 10,
      status: "pending",
      page: 1,
      limit: 20
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentEventRepository.listRecruitmentEventsByRecruitmentId).toHaveBeenCalledWith({
      recruitment_id: 10,
      status: "pending",
      page: 1,
      limit: 20
    });
    expect(result).toEqual(payload);
  });
});
