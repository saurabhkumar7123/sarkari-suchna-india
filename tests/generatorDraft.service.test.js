"use strict";

jest.mock("../server/repositories/generatorDraft.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  countByStatus: jest.fn(),
  insertDraft: jest.fn(),
  updateDraft: jest.fn(),
  findById: jest.fn(),
  listDrafts: jest.fn(),
  markPublished: jest.fn(),
  deleteDraft: jest.fn()
}));

const generatorDraftRepository = require("../server/repositories/generatorDraft.repository");
const generatorDraftService = require("../server/services/generatorDraft.service");

describe("generatorDraft.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      payload: { title: "SSC CGL draft", data: "x".repeat(30) }
    });

    const row = await generatorDraftService.saveDraft({
      payload: { title: "SSC CGL draft", pageUrl: "/ssc-cgl-2026.html", data: "x".repeat(30) }
    });

    expect(generatorDraftRepository.insertDraft).toHaveBeenCalled();
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
    generatorDraftRepository.findById.mockResolvedValue({
      id: 3,
      status: "draft",
      title: "Old",
      payload: {}
    });
    generatorDraftRepository.updateDraft.mockResolvedValue(true);
    generatorDraftRepository.findById.mockResolvedValueOnce({
      id: 3,
      status: "draft",
      title: "Old",
      payload: {}
    });
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

    expect(generatorDraftRepository.updateDraft).toHaveBeenCalledWith(3, expect.any(Object));
    expect(row.title).toBe("Updated");
  });
});
