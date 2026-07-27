"use strict";

const {
  resolvePublishRecruitmentContext,
  runPostPublishRecruitmentLink
} = require("../server/lib/postPublishRecruitmentLink");

describe("postPublishRecruitmentLink", () => {
  describe("resolvePublishRecruitmentContext", () => {
    test("prefers explicit recruitment fields on publish body", async () => {
      const getDraftById = jest.fn();
      const context = await resolvePublishRecruitmentContext(
        {
          recruitment_id: 10,
          recruitment_event_id: 3,
          generatorDraftId: 99
        },
        getDraftById
      );

      expect(context).toEqual({ recruitment_id: 10, recruitment_event_id: 3 });
      expect(getDraftById).not.toHaveBeenCalled();
    });

    test("loads recruitment context from generator draft when body has no recruitment_id", async () => {
      const getDraftById = jest.fn().mockResolvedValue({
        id: 99,
        recruitment_id: 7,
        recruitment_event_id: 2
      });
      const context = await resolvePublishRecruitmentContext(
        { generatorDraftId: 99 },
        getDraftById
      );

      expect(getDraftById).toHaveBeenCalledWith(99);
      expect(context).toEqual({ recruitment_id: 7, recruitment_event_id: 2 });
    });

    test("returns null when no recruitment context is available", async () => {
      const getDraftById = jest.fn().mockResolvedValue({ id: 1, recruitment_id: null });
      const context = await resolvePublishRecruitmentContext({ generatorDraftId: 1 }, getDraftById);

      expect(context).toBeNull();
    });
  });

  describe("runPostPublishRecruitmentLink", () => {
    const linkPage = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("flag OFF does not call linkPage", async () => {
      const result = await runPostPublishRecruitmentLink({
        savedPageId: 42,
        body: { recruitment_id: 10 },
        linkPage,
        isEnabled: false
      });

      expect(result).toEqual({ skipped: true, reason: "flag_off" });
      expect(linkPage).not.toHaveBeenCalled();
    });

    test("flag ON with recruitment context links page", async () => {
      linkPage.mockResolvedValue({ id: 42, recruitment_id: 10 });
      const getDraftById = jest.fn();

      const result = await runPostPublishRecruitmentLink({
        savedPageId: 42,
        body: { recruitment_id: 10, recruitment_event_id: 5 },
        getDraftById,
        linkPage,
        isEnabled: true
      });

      expect(linkPage).toHaveBeenCalledWith({
        page_id: 42,
        recruitment_id: 10,
        recruitment_event_id: 5
      });
      expect(result).toEqual({ linked: true, recruitment_id: 10 });
    });

    test("flag ON without context skips linkage and publish path continues", async () => {
      const result = await runPostPublishRecruitmentLink({
        savedPageId: 42,
        body: {},
        getDraftById: jest.fn(),
        linkPage,
        isEnabled: true
      });

      expect(result).toEqual({ skipped: true, reason: "no_context" });
      expect(linkPage).not.toHaveBeenCalled();
    });

    test("linkage failure is captured without throwing", async () => {
      const linkageError = new Error("Recruitment not found");
      linkageError.statusCode = 404;
      linkPage.mockRejectedValue(linkageError);

      const result = await runPostPublishRecruitmentLink({
        savedPageId: 42,
        body: { recruitment_id: 999 },
        linkPage,
        isEnabled: true
      });

      expect(result.linked).toBe(false);
      expect(result.error).toBe(linkageError);
    });
  });
});
