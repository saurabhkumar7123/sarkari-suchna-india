"use strict";

jest.mock("../server/services/recruitmentEvent.service", () => ({
  listRecruitmentEvents: jest.fn(),
  createRecruitmentEvent: jest.fn(),
  updateRecruitmentEvent: jest.fn(),
  getRecruitmentEvent: jest.fn()
}));

const recruitmentEventService = require("../server/services/recruitmentEvent.service");
const { persistTypedEvent } = require("../server/services/recruitmentLifecycle.service");

describe("persistTypedEvent revision / supersession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reuses active same-type event by default", async () => {
    recruitmentEventService.listRecruitmentEvents.mockResolvedValue({
      data: [{ id: 5, event_type: "admit_card", status: "active" }]
    });
    const out = await persistTypedEvent({
      recruitmentId: 1,
      eventType: "admit_card"
    });
    expect(out.reused).toBe(true);
    expect(out.event.id).toBe(5);
    expect(recruitmentEventService.createRecruitmentEvent).not.toHaveBeenCalled();
  });

  test("revision supersedes prior active event and creates new", async () => {
    recruitmentEventService.listRecruitmentEvents.mockResolvedValue({
      data: [{ id: 5, event_type: "admit_card", status: "active" }]
    });
    recruitmentEventService.updateRecruitmentEvent.mockResolvedValue({
      id: 5,
      status: "superseded"
    });
    recruitmentEventService.createRecruitmentEvent.mockResolvedValue({
      id: 6,
      event_type: "admit_card",
      status: "active"
    });

    const out = await persistTypedEvent({
      recruitmentId: 1,
      eventType: "admit_card",
      revision: true
    });

    expect(recruitmentEventService.updateRecruitmentEvent).toHaveBeenCalledWith(5, {
      status: "superseded"
    });
    expect(out.revised).toBe(true);
    expect(out.supersededEventId).toBe(5);
    expect(out.event.id).toBe(6);
  });

  test("new stage creates event when none active", async () => {
    recruitmentEventService.listRecruitmentEvents.mockResolvedValue({ data: [] });
    recruitmentEventService.createRecruitmentEvent.mockResolvedValue({
      id: 9,
      event_type: "result",
      status: "active"
    });
    const out = await persistTypedEvent({
      recruitmentId: 1,
      eventType: "result"
    });
    expect(out.reused).toBe(false);
    expect(out.event.id).toBe(9);
  });
});
