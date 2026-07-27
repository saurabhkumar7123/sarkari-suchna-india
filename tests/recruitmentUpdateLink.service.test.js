"use strict";

jest.mock("../server/repositories/recruitmentUpdateLink.repository", () => ({
  linkageColumnsExist: jest.fn().mockResolvedValue(true),
  findUpdateLinkageById: jest.fn(),
  setUpdateLinkage: jest.fn(),
  clearUpdateLinkage: jest.fn(),
  listUpdateLinkagesByRecruitmentId: jest.fn(),
  listUpdateLinkagesByRecruitmentEventId: jest.fn()
}));

jest.mock("../server/repositories/recruitment.repository", () => ({
  getRecruitmentById: jest.fn()
}));

jest.mock("../server/repositories/recruitmentEvent.repository", () => ({
  getRecruitmentEventById: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const recruitmentEventRepository = require("../server/repositories/recruitmentEvent.repository");
const recruitmentUpdateLinkRepository = require("../server/repositories/recruitmentUpdateLink.repository");
const recruitmentUpdateLinkService = require("../server/services/recruitmentUpdateLink.service");

const sampleUpdate = {
  id: 7,
  site_id: 3,
  title: "SSC CGL notification",
  link: "https://ssc.gov.in/notice",
  recruitment_id: null,
  recruitment_event_id: null,
  created_at: "2026-07-13T00:00:00.000Z"
};

const linkedUpdate = {
  ...sampleUpdate,
  recruitment_id: 10,
  recruitment_event_id: 5
};

describe("recruitmentUpdateLink.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.getRecruitmentById.mockResolvedValue({ id: 10, slug: "ssc-cgl-2026" });
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue({
      id: 5,
      recruitment_id: 10,
      event_type: "notification"
    });
    recruitmentUpdateLinkRepository.findUpdateLinkageById.mockResolvedValue(sampleUpdate);
  });

  test("linkUpdate links an update to recruitment and event", async () => {
    recruitmentUpdateLinkRepository.setUpdateLinkage.mockResolvedValue(linkedUpdate);

    const row = await recruitmentUpdateLinkService.linkUpdate({
      update_id: 7,
      recruitment_id: 10,
      recruitment_event_id: 5
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentEventRepository.getRecruitmentEventById).toHaveBeenCalledWith(5);
    expect(recruitmentUpdateLinkRepository.setUpdateLinkage).toHaveBeenCalledWith(7, {
      recruitment_id: 10,
      recruitment_event_id: 5
    });
    expect(row).toEqual(linkedUpdate);
  });

  test("linkUpdate links an update to recruitment only", async () => {
    recruitmentUpdateLinkRepository.setUpdateLinkage.mockResolvedValue({
      ...linkedUpdate,
      recruitment_event_id: null
    });

    await recruitmentUpdateLinkService.linkUpdate({
      update_id: 7,
      recruitment_id: 10
    });

    expect(recruitmentEventRepository.getRecruitmentEventById).not.toHaveBeenCalled();
    expect(recruitmentUpdateLinkRepository.setUpdateLinkage).toHaveBeenCalledWith(7, {
      recruitment_id: 10,
      recruitment_event_id: null
    });
  });

  test("linkUpdate rejects missing update_id", async () => {
    await expect(
      recruitmentUpdateLinkService.linkUpdate({ recruitment_id: 10 })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid update_id" });
  });

  test("linkUpdate rejects missing update", async () => {
    recruitmentUpdateLinkRepository.findUpdateLinkageById.mockResolvedValue(null);

    await expect(
      recruitmentUpdateLinkService.linkUpdate({ update_id: 99, recruitment_id: 10 })
    ).rejects.toMatchObject({ statusCode: 404, message: "Update not found" });
  });

  test("linkUpdate rejects missing recruitment", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);

    await expect(
      recruitmentUpdateLinkService.linkUpdate({ update_id: 7, recruitment_id: 99 })
    ).rejects.toMatchObject({ statusCode: 404, message: "Recruitment not found" });
  });

  test("linkUpdate rejects missing recruitment event", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue(null);

    await expect(
      recruitmentUpdateLinkService.linkUpdate({
        update_id: 7,
        recruitment_id: 10,
        recruitment_event_id: 99
      })
    ).rejects.toMatchObject({ statusCode: 404, message: "Recruitment event not found" });
  });

  test("linkUpdate rejects event not belonging to recruitment", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue({
      id: 5,
      recruitment_id: 11,
      event_type: "notification"
    });

    await expect(
      recruitmentUpdateLinkService.linkUpdate({
        update_id: 7,
        recruitment_id: 10,
        recruitment_event_id: 5
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "recruitment_event_id does not belong to recruitment_id"
    });
  });

  test("unlinkUpdate clears linkage", async () => {
    recruitmentUpdateLinkRepository.clearUpdateLinkage.mockResolvedValue(sampleUpdate);

    const row = await recruitmentUpdateLinkService.unlinkUpdate({ update_id: 7 });

    expect(recruitmentUpdateLinkRepository.clearUpdateLinkage).toHaveBeenCalledWith(7);
    expect(row).toEqual(sampleUpdate);
  });

  test("getUpdateLinkage returns current linkage", async () => {
    recruitmentUpdateLinkRepository.findUpdateLinkageById.mockResolvedValue(linkedUpdate);

    const row = await recruitmentUpdateLinkService.getUpdateLinkage({ update_id: 7 });

    expect(row).toEqual(linkedUpdate);
  });

  test("listLinkedUpdates by recruitment_id delegates to repository", async () => {
    const payload = { data: [linkedUpdate], pagination: { page: 1, limit: 20, total: 1 } };
    recruitmentUpdateLinkRepository.listUpdateLinkagesByRecruitmentId.mockResolvedValue(payload);

    const result = await recruitmentUpdateLinkService.listLinkedUpdates({
      recruitment_id: 10,
      page: 1,
      limit: 20
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentUpdateLinkRepository.listUpdateLinkagesByRecruitmentId).toHaveBeenCalledWith({
      recruitment_id: 10,
      page: 1,
      limit: 20
    });
    expect(result).toEqual(payload);
  });

  test("listLinkedUpdates by recruitment_event_id delegates to repository", async () => {
    const payload = { data: [linkedUpdate], pagination: { page: 1, limit: 20, total: 1 } };
    recruitmentUpdateLinkRepository.listUpdateLinkagesByRecruitmentEventId.mockResolvedValue(payload);

    const result = await recruitmentUpdateLinkService.listLinkedUpdates({
      recruitment_event_id: 5,
      page: 1,
      limit: 20
    });

    expect(recruitmentEventRepository.getRecruitmentEventById).toHaveBeenCalledWith(5);
    expect(recruitmentUpdateLinkRepository.listUpdateLinkagesByRecruitmentEventId).toHaveBeenCalledWith({
      recruitment_event_id: 5,
      page: 1,
      limit: 20
    });
    expect(result).toEqual(payload);
  });

  test("listLinkedUpdates rejects when both filters are provided", async () => {
    await expect(
      recruitmentUpdateLinkService.listLinkedUpdates({
        recruitment_id: 10,
        recruitment_event_id: 5
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Provide exactly one of recruitment_id or recruitment_event_id"
    });
  });
});
