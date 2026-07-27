"use strict";

jest.mock("../server/repositories/generatorDraft.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  linkageColumnsExist: jest.fn().mockResolvedValue(true),
  countByStatus: jest.fn(),
  insertDraft: jest.fn(),
  updateDraft: jest.fn(),
  findById: jest.fn(),
  listDrafts: jest.fn(),
  listDraftsByRecruitmentId: jest.fn(),
  markPublished: jest.fn(),
  deleteDraft: jest.fn()
}));

jest.mock("../server/repositories/recruitment.repository", () => ({
  getRecruitmentById: jest.fn()
}));

jest.mock("../server/repositories/recruitmentEvent.repository", () => ({
  getRecruitmentEventById: jest.fn()
}));

jest.mock("../server/config/recruitmentLifecycle", () => ({
  isRecruitmentEditorialAttachmentEnabled: jest.fn()
}));

const generatorDraftRepository = require("../server/repositories/generatorDraft.repository");
const recruitmentRepository = require("../server/repositories/recruitment.repository");
const recruitmentEventRepository = require("../server/repositories/recruitmentEvent.repository");
const { isRecruitmentEditorialAttachmentEnabled } = require("../server/config/recruitmentLifecycle");
const generatorDraftService = require("../server/services/generatorDraft.service");

const meaningfulPayload = { title: "SSC CGL draft", data: "x".repeat(30) };

describe("generatorDraft.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isRecruitmentEditorialAttachmentEnabled.mockReturnValue(false);
    recruitmentRepository.getRecruitmentById.mockResolvedValue({ id: 10, slug: "ssc-cgl-2026" });
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue({
      id: 5,
      recruitment_id: 10,
      event_type: "notification"
    });
  });

  test("saveDraft rejects empty payload", async () => {
    await expect(generatorDraftService.saveDraft({ payload: { title: "a", data: "short" } })).rejects.toMatchObject({
      statusCode: 400
    });
  });

  test("saveDraft creates new draft when under limit", async () => {
    generatorDraftRepository.countByStatus.mockResolvedValue(2);
    generatorDraftRepository.insertDraft.mockResolvedValue(9);
    generatorDraftRepository.findById.mockResolvedValue({
      id: 9,
      title: "SSC CGL draft",
      slug_hint: "ssc-cgl-2026",
      status: "draft",
      payload: meaningfulPayload
    });

    const row = await generatorDraftService.saveDraft({
      payload: { title: "SSC CGL draft", pageUrl: "/ssc-cgl-2026.html", data: "x".repeat(30) }
    });

    expect(generatorDraftRepository.insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        withRecruitmentLinkage: false
      })
    );
    expect(row.id).toBe(9);
  });

  test("saveDraft blocks when draft limit reached", async () => {
    generatorDraftRepository.countByStatus.mockResolvedValue(20);
    await expect(
      generatorDraftService.saveDraft({
        payload: { title: "New page", data: "x".repeat(30) }
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("saveDraft updates existing draft", async () => {
    generatorDraftRepository.findById.mockResolvedValueOnce({
      id: 3,
      status: "draft",
      title: "Old",
      payload: {}
    });
    generatorDraftRepository.updateDraft.mockResolvedValue(true);
    generatorDraftRepository.findById.mockResolvedValueOnce({
      id: 3,
      status: "draft",
      title: "Updated",
      payload: { title: "Updated", data: "y".repeat(25) }
    });

    const row = await generatorDraftService.saveDraft({
      id: 3,
      payload: { title: "Updated", data: "y".repeat(25) }
    });

    expect(generatorDraftRepository.updateDraft).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ withRecruitmentLinkage: false })
    );
    expect(row.title).toBe("Updated");
  });

  test("saveDraft ignores recruitment context when editorial flag is off", async () => {
    generatorDraftRepository.countByStatus.mockResolvedValue(1);
    generatorDraftRepository.insertDraft.mockResolvedValue(11);
    generatorDraftRepository.findById.mockResolvedValue({
      id: 11,
      title: "SSC CGL draft",
      status: "draft",
      payload: meaningfulPayload
    });

    await generatorDraftService.saveDraft({
      payload: meaningfulPayload,
      recruitmentId: 10,
      recruitmentEventId: 5
    });

    expect(recruitmentRepository.getRecruitmentById).not.toHaveBeenCalled();
    expect(generatorDraftRepository.insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({ withRecruitmentLinkage: false })
    );
  });

  test("saveDraft stores recruitment context when editorial flag is on", async () => {
    isRecruitmentEditorialAttachmentEnabled.mockReturnValue(true);
    generatorDraftRepository.countByStatus.mockResolvedValue(1);
    generatorDraftRepository.insertDraft.mockResolvedValue(12);
    generatorDraftRepository.findById.mockResolvedValue({
      id: 12,
      title: "SSC CGL draft",
      status: "draft",
      recruitment_id: 10,
      recruitment_event_id: 5,
      payload: meaningfulPayload
    });

    await generatorDraftService.saveDraft({
      payload: meaningfulPayload,
      recruitmentId: 10,
      recruitmentEventId: 5
    });

    expect(recruitmentRepository.getRecruitmentById).toHaveBeenCalledWith(10);
    expect(recruitmentEventRepository.getRecruitmentEventById).toHaveBeenCalledWith(5);
    expect(generatorDraftRepository.insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        withRecruitmentLinkage: true,
        recruitmentId: 10,
        recruitmentEventId: 5
      })
    );
  });

  test("saveDraft stores recruitment_id only when event omitted", async () => {
    isRecruitmentEditorialAttachmentEnabled.mockReturnValue(true);
    generatorDraftRepository.countByStatus.mockResolvedValue(1);
    generatorDraftRepository.insertDraft.mockResolvedValue(13);
    generatorDraftRepository.findById.mockResolvedValue({
      id: 13,
      title: "SSC CGL draft",
      status: "draft",
      recruitment_id: 10,
      recruitment_event_id: null,
      payload: meaningfulPayload
    });

    await generatorDraftService.saveDraft({
      payload: meaningfulPayload,
      recruitmentId: 10
    });

    expect(recruitmentEventRepository.getRecruitmentEventById).not.toHaveBeenCalled();
    expect(generatorDraftRepository.insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        recruitmentId: 10,
        recruitmentEventId: null
      })
    );
  });

  test("saveDraft rejects invalid recruitment", async () => {
    isRecruitmentEditorialAttachmentEnabled.mockReturnValue(true);
    generatorDraftRepository.countByStatus.mockResolvedValue(1);
    recruitmentRepository.getRecruitmentById.mockResolvedValue(null);

    await expect(
      generatorDraftService.saveDraft({
        payload: meaningfulPayload,
        recruitmentId: 99
      })
    ).rejects.toMatchObject({ statusCode: 404, message: "Recruitment not found" });
  });

  test("saveDraft rejects event not belonging to recruitment", async () => {
    isRecruitmentEditorialAttachmentEnabled.mockReturnValue(true);
    generatorDraftRepository.countByStatus.mockResolvedValue(1);
    recruitmentEventRepository.getRecruitmentEventById.mockResolvedValue({
      id: 5,
      recruitment_id: 11,
      event_type: "notification"
    });

    await expect(
      generatorDraftService.saveDraft({
        payload: meaningfulPayload,
        recruitmentId: 10,
        recruitmentEventId: 5
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "recruitment_event_id does not belong to recruitment_id"
    });
  });

  test("markDraftPublished leaves publish path unchanged", async () => {
    generatorDraftRepository.markPublished.mockResolvedValue(true);
    generatorDraftRepository.findById.mockResolvedValue({
      id: 3,
      status: "published",
      published_slug: "ssc-cgl-2026",
      published_page_id: 42
    });

    const row = await generatorDraftService.markDraftPublished(3, {
      publishedSlug: "ssc-cgl-2026",
      publishedPageId: 42
    });

    expect(generatorDraftRepository.markPublished).toHaveBeenCalledWith(3, {
      publishedSlug: "ssc-cgl-2026",
      publishedPageId: 42
    });
    expect(row.status).toBe("published");
  });

  test("listDraftsByRecruitmentId delegates to repository with recruitment filter", async () => {
    generatorDraftRepository.listDraftsByRecruitmentId.mockResolvedValue([
      { id: 7, title: "Linked", recruitment_id: 10, status: "draft" }
    ]);

    const rows = await generatorDraftService.listDraftsByRecruitmentId(10, { limit: 5 });

    expect(generatorDraftRepository.listDraftsByRecruitmentId).toHaveBeenCalledWith({
      recruitment_id: 10,
      limit: 5
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].recruitment_id).toBe(10);
  });
});
