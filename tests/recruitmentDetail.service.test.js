"use strict";

jest.mock("../server/repositories/recruitment.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  createRecruitment: jest.fn(),
  getRecruitmentById: jest.fn(),
  getRecruitmentBySlug: jest.fn(),
  listRecruitments: jest.fn(),
  updateRecruitment: jest.fn(),
  existsBySlug: jest.fn(),
  existsByAdvertisementNo: jest.fn()
}));

jest.mock("../server/services/recruitmentEvent.service", () => ({
  listRecruitmentEvents: jest.fn()
}));

jest.mock("../server/services/recruitmentPageLink.service", () => ({
  listLinkedPages: jest.fn()
}));

jest.mock("../server/services/generatorDraft.service", () => ({
  listDraftsByRecruitmentId: jest.fn()
}));

jest.mock("../server/services/recruitmentUpdateLink.service", () => ({
  listLinkedUpdates: jest.fn()
}));

jest.mock("../server/services/recruitmentReview.service", () => ({
  listReviewItems: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const recruitmentEventService = require("../server/services/recruitmentEvent.service");
const recruitmentPageLinkService = require("../server/services/recruitmentPageLink.service");
const generatorDraftService = require("../server/services/generatorDraft.service");
const recruitmentUpdateLinkService = require("../server/services/recruitmentUpdateLink.service");
const recruitmentReviewService = require("../server/services/recruitmentReview.service");
const recruitmentService = require("../server/services/recruitment.service");

const sampleRecruitment = {
  id: 10,
  title: "SSC CGL 2026",
  slug: "ssc-cgl-2026",
  department: "ssc",
  post_name: "Combined Graduate Level",
  advertisement_no: "CGL-01/2026",
  cycle_year: 2026,
  lifecycle_state: "announced",
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z"
};

describe("recruitment.service getRecruitmentDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.getRecruitmentById.mockResolvedValue(sampleRecruitment);
    recruitmentEventService.listRecruitmentEvents.mockResolvedValue({ data: [], pagination: { total: 0 } });
    recruitmentPageLinkService.listLinkedPages.mockResolvedValue({ data: [], pagination: { total: 0 } });
    generatorDraftService.listDraftsByRecruitmentId.mockResolvedValue([]);
    recruitmentUpdateLinkService.listLinkedUpdates.mockResolvedValue({ data: [], pagination: { total: 0 } });
    recruitmentReviewService.listReviewItems.mockResolvedValue({ data: [], pagination: { total: 0 } });
  });

  test("returns recruitment not found when parent row is missing", async () => {
    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);

    await expect(recruitmentService.getRecruitmentDetail(99)).rejects.toMatchObject({
      statusCode: 404,
      message: "Recruitment not found"
    });
  });

  test("returns empty related arrays when recruitment has no linked data", async () => {
    const detail = await recruitmentService.getRecruitmentDetail(10);

    expect(detail).toEqual({
      recruitment: sampleRecruitment,
      events: [],
      pages: [],
      drafts: [],
      updates: [],
      reviews: []
    });
    expect(recruitmentEventService.listRecruitmentEvents).toHaveBeenCalledWith(
      expect.objectContaining({ recruitment_id: 10 })
    );
    expect(recruitmentPageLinkService.listLinkedPages).toHaveBeenCalledWith(
      expect.objectContaining({ recruitment_id: 10 })
    );
    expect(generatorDraftService.listDraftsByRecruitmentId).toHaveBeenCalledWith(10, expect.any(Object));
  });

  test("aggregates events, pages, and drafts for a recruitment", async () => {
    const event = { id: 1, recruitment_id: 10, event_type: "notification", status: "active" };
    const page = { id: 42, slug: "ssc-cgl-2026", recruitment_id: 10, recruitment_event_id: 1 };
    const draft = {
      id: 7,
      title: "SSC draft",
      recruitment_id: 10,
      recruitment_event_id: 1,
      status: "draft"
    };

    recruitmentEventService.listRecruitmentEvents.mockResolvedValue({
      data: [event],
      pagination: { page: 1, limit: 20, total: 1 }
    });
    recruitmentPageLinkService.listLinkedPages.mockResolvedValue({
      data: [page],
      pagination: { page: 1, limit: 20, total: 1 }
    });
    generatorDraftService.listDraftsByRecruitmentId.mockResolvedValue([draft]);
    recruitmentUpdateLinkService.listLinkedUpdates.mockResolvedValue({
      data: [{ id: 100, title: "Admit Card", recruitment_id: 10 }],
      pagination: { total: 1 }
    });
    recruitmentReviewService.listReviewItems.mockResolvedValue({
      data: [{ id: 5, status: "pending", update_id: 100, recruitment_id: 10 }],
      pagination: { total: 1 }
    });

    const detail = await recruitmentService.getRecruitmentDetail(10);

    expect(detail.recruitment).toEqual(sampleRecruitment);
    expect(detail.events).toEqual([event]);
    expect(detail.pages).toEqual([page]);
    expect(detail.drafts).toEqual([draft]);
    expect(detail.updates).toHaveLength(1);
    expect(detail.reviews).toHaveLength(1);
  });

  test("returns empty pages when page linkage is unavailable", async () => {
    const linkageErr = new Error("pages recruitment linkage columns are missing");
    linkageErr.statusCode = 503;
    recruitmentPageLinkService.listLinkedPages.mockRejectedValue(linkageErr);

    const detail = await recruitmentService.getRecruitmentDetail(10);

    expect(detail.pages).toEqual([]);
    expect(detail.events).toEqual([]);
    expect(detail.drafts).toEqual([]);
    expect(detail.updates).toEqual([]);
    expect(detail.reviews).toEqual([]);
  });
});
