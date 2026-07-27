"use strict";

jest.mock("../server/repositories/recruitmentPageLink.repository", () => ({
  linkageColumnsExist: jest.fn().mockResolvedValue(true),
  findPageLinkageById: jest.fn(),
  findPageLinkageBySlug: jest.fn(),
  setPageLinkage: jest.fn(),
  clearPageLinkage: jest.fn(),
  listPageLinkagesByRecruitmentId: jest.fn(),
  listPageLinkagesByRecruitmentEventId: jest.fn()
}));

jest.mock("../server/repositories/recruitment.repository", () => ({
  getRecruitmentById: jest.fn()
}));

jest.mock("../server/repositories/recruitmentEvent.repository", () => ({
  getRecruitmentEventById: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const recruitmentEventRepository = require("../server/repositories/recruitmentEvent.repository");
const recruitmentPageLinkRepository = require("../server/repositories/recruitmentPageLink.repository");
const recruitmentPageLinkService = require("../server/services/recruitmentPageLink.service");

const samplePage = {
  id: 42,
  slug: "ssc-cgl-2026",
  recruitment_id: null,
  recruitment_event_id: null
};

const linkedPage = {
  id: 42,
  slug: "ssc-cgl-2026",
  recruitment_id: 10,
  recruitment_event_id: 5
};

describe("recruitmentPageLink.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.getRecruitmentById.mockResolvedValue({ id: 10, slug: "ssc-cgl-2026" });
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue({
      id: 5,
      recruitment_id: 10,
      event_type: "notification"
    });
    recruitmentPageLinkRepository.findPageLinkageBySlug.mockResolvedValue(samplePage);
    recruitmentPageLinkRepository.findPageLinkageById.mockResolvedValue(samplePage);
  });

  test("linkPage links a page to recruitment and event", async () => {
    recruitmentPageLinkRepository.setPageLinkage.mockResolvedValue(linkedPage);

    const row = await recruitmentPageLinkService.linkPage({
      slug: "ssc-cgl-2026",
      recruitment_id: 10,
      recruitment_event_id: 5
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentEventRepository.getRecruitmentEventById).toHaveBeenCalledWith(5);
    expect(recruitmentPageLinkRepository.setPageLinkage).toHaveBeenCalledWith(42, {
      recruitment_id: 10,
      recruitment_event_id: 5
    });
    expect(row).toEqual(linkedPage);
  });

  test("linkPage links a page to recruitment only", async () => {
    recruitmentPageLinkRepository.setPageLinkage.mockResolvedValue({
      ...linkedPage,
      recruitment_event_id: null
    });

    await recruitmentPageLinkService.linkPage({
      page_id: 42,
      recruitment_id: 10
    });

    expect(recruitmentEventRepository.getRecruitmentEventById).not.toHaveBeenCalled();
    expect(recruitmentPageLinkRepository.setPageLinkage).toHaveBeenCalledWith(42, {
      recruitment_id: 10,
      recruitment_event_id: null
    });
  });

  test("linkPage rejects missing page reference", async () => {
    await expect(
      recruitmentPageLinkService.linkPage({ recruitment_id: 10 })
    ).rejects.toMatchObject({ statusCode: 400, message: "page_id or slug is required" });
  });

  test("linkPage rejects missing page", async () => {
    recruitmentPageLinkRepository.findPageLinkageBySlug.mockResolvedValue(null);

    await expect(
      recruitmentPageLinkService.linkPage({ slug: "missing-page", recruitment_id: 10 })
    ).rejects.toMatchObject({ statusCode: 404, message: "Page not found" });
  });

  test("linkPage rejects missing recruitment", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);

    await expect(
      recruitmentPageLinkService.linkPage({ slug: "ssc-cgl-2026", recruitment_id: 99 })
    ).rejects.toMatchObject({ statusCode: 404, message: "Recruitment not found" });
  });

  test("linkPage rejects missing recruitment event", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue(null);

    await expect(
      recruitmentPageLinkService.linkPage({
        slug: "ssc-cgl-2026",
        recruitment_id: 10,
        recruitment_event_id: 99
      })
    ).rejects.toMatchObject({ statusCode: 404, message: "Recruitment event not found" });
  });

  test("linkPage rejects event not belonging to recruitment", async () => {
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue({
      id: 5,
      recruitment_id: 11,
      event_type: "notification"
    });

    await expect(
      recruitmentPageLinkService.linkPage({
        slug: "ssc-cgl-2026",
        recruitment_id: 10,
        recruitment_event_id: 5
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "recruitment_event_id does not belong to recruitment_id"
    });
  });

  test("unlinkPage clears linkage", async () => {
    recruitmentPageLinkRepository.clearPageLinkage.mockResolvedValue(samplePage);

    const row = await recruitmentPageLinkService.unlinkPage({ slug: "ssc-cgl-2026" });

    expect(recruitmentPageLinkRepository.clearPageLinkage).toHaveBeenCalledWith(42);
    expect(row).toEqual(samplePage);
  });

  test("getPageLinkage returns current linkage", async () => {
    recruitmentPageLinkRepository.findPageLinkageById.mockResolvedValue(linkedPage);

    const row = await recruitmentPageLinkService.getPageLinkage({ page_id: 42 });

    expect(row).toEqual(linkedPage);
  });

  test("listLinkedPages by recruitment_id delegates to repository", async () => {
    const payload = { data: [linkedPage], pagination: { page: 1, limit: 20, total: 1 } };
    recruitmentPageLinkRepository.listPageLinkagesByRecruitmentId.mockResolvedValue(payload);

    const result = await recruitmentPageLinkService.listLinkedPages({
      recruitment_id: 10,
      page: 1,
      limit: 20
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentPageLinkRepository.listPageLinkagesByRecruitmentId).toHaveBeenCalledWith({
      recruitment_id: 10,
      page: 1,
      limit: 20
    });
    expect(result).toEqual(payload);
  });

  test("listLinkedPages by recruitment_event_id delegates to repository", async () => {
    const payload = { data: [linkedPage], pagination: { page: 1, limit: 20, total: 1 } };
    recruitmentPageLinkRepository.listPageLinkagesByRecruitmentEventId.mockResolvedValue(payload);

    const result = await recruitmentPageLinkService.listLinkedPages({
      recruitment_event_id: 5,
      page: 1,
      limit: 20
    });

    expect(recruitmentEventRepository.getRecruitmentEventById).toHaveBeenCalledWith(5);
    expect(recruitmentPageLinkRepository.listPageLinkagesByRecruitmentEventId).toHaveBeenCalledWith({
      recruitment_event_id: 5,
      page: 1,
      limit: 20
    });
    expect(result).toEqual(payload);
  });

  test("listLinkedPages rejects when both filters are provided", async () => {
    await expect(
      recruitmentPageLinkService.listLinkedPages({
        recruitment_id: 10,
        recruitment_event_id: 5
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Provide exactly one of recruitment_id or recruitment_event_id"
    });
  });
});
