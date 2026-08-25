"use strict";

/**
 * AMP-4B Part 6D — structured convert → existing draft/review/Telegram persistence proof.
 * Isolated in-memory stores. No production DB, Redis, Telegram, or publish.
 */

jest.mock("axios");

const flags = require("../server/config/automationFlags");
const {
  PUBLISHING_POLICY,
  evaluateManualPublishGate
} = require("../server/lib/productionWorkflow/publishingPolicy");

const PDF_URL = "https://ssc.nic.in/SSCFileServer/Portal/Download/notice.pdf";
const TITLE = "SSC Combined Hindi Translators 2026";
const STRONG_DOC = `[Section: Short Information]
Staff Selection Commission Combined Hindi Translators Examination tentative vacancies notice.

[Section: Important Dates]
Notice Date : 09.07.2026

[Section: Vacancy]
Tentative vacancies for Combined Hindi Translators posts as notified by SSC.

[Section: Important Links]
Notification PDF=${PDF_URL}
`;
const SPARSE = {
  title: TITLE,
  pageUrl: PDF_URL,
  data: `[Section: Short Information]\n${TITLE}\nOfficial PDF: ${PDF_URL}`,
  status: "draft"
};

function mockPersistenceRuntime({ convertAccepted = true, extractOk = true, convertThrows = false } = {}) {
  jest.resetModules();

  const drafts = [];
  const reviews = [];
  let nextDraftId = 1;
  let nextReviewId = 1;

  const saveDraft = jest.fn(async ({ id, payload, recruitmentId }) => {
    if (id) {
      const existing = drafts.find((d) => Number(d.id) === Number(id));
      existing.payload = payload;
      existing.title = payload.title;
      existing.recruitment_id = recruitmentId;
      return existing;
    }
    const row = {
      id: nextDraftId++,
      title: payload.title,
      payload,
      status: "draft",
      recruitment_id: recruitmentId,
      published_page_id: null,
      published_slug: null
    };
    drafts.push(row);
    return row;
  });

  const listDraftsByRecruitmentId = jest.fn(async (recruitmentId) =>
    drafts.filter((d) => Number(d.recruitment_id) === Number(recruitmentId))
  );

  const saveReviewItem = jest.fn(async (input) => {
    const row = {
      id: nextReviewId++,
      status: "pending",
      update_id: input.updateId ?? null,
      recruitment_id: input.reviewItem && input.reviewItem.recruitmentId,
      title: input.reviewItem && input.reviewItem.title,
      processor_output: input.processorOutput || null
    };
    reviews.push(row);
    return row;
  });

  const listReviewItems = jest.fn(async ({ recruitment_id } = {}) => ({
    data: reviews.filter((r) => Number(r.recruitment_id) === Number(recruitment_id)),
    pagination: { page: 1, limit: 50, total: reviews.length }
  }));

  const sendNotification = jest.fn(async ({ payload }) => ({
    delivered: true,
    status: "delivered",
    payload
  }));

  jest.doMock("../server/services/generatorDraft.service", () => ({
    saveDraft,
    listDraftsByRecruitmentId,
    getDraftById: jest.fn(async (id) => drafts.find((d) => d.id === id) || null),
    findUnpublishedDraftByUpdateId: jest.fn(async (updateId) =>
      drafts.find(
        (d) =>
          String(d.status) === "draft" &&
          Number(d.payload && (d.payload.updateId || d.payload.update_id)) === Number(updateId)
      ) || null
    )
  }));
  jest.doMock("../server/repositories/generatorDraft.repository", () => ({
    updateDraftLinkage: jest.fn().mockResolvedValue(true)
  }));
  jest.doMock("../server/services/recruitmentReview.service", () => ({
    saveReviewItem,
    listReviewItems,
    getReviewItemByUpdateId: jest.fn(async (updateId) =>
      reviews.find((r) => Number(r.update_id) === Number(updateId)) || null
    )
  }));
  jest.doMock("../server/lib/enterprise/notificationGateway", () => ({
    sendNotification,
    CHANNELS: { TELEGRAM: "telegram" }
  }));
  jest.doMock("../server/services/enterprise/enterprisePersistence.service", () => ({
    defaultService: {
      draft: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      reviewQueue: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) }
    }
  }));

  if (!extractOk) {
    jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
      downloadOfficialPdfForGeneratorExtraction: jest.fn().mockRejectedValue(
        Object.assign(new Error("not a pdf"), { code: "NOT_DIRECT_PDF" })
      )
    }));
  } else {
    jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
      downloadOfficialPdfForGeneratorExtraction: jest.fn().mockResolvedValue({
        text: "Staff Selection Commission Combined Hindi Translators Examination tentative vacancies 09.07.2026",
        sourceUrl: PDF_URL
      })
    }));
  }

  if (convertThrows) {
    jest.doMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert", () => ({
      convertAmpExtractedTextToPublisher: jest.fn().mockRejectedValue(new Error("openai timeout")),
      withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
    }));
  } else {
    jest.doMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert", () => ({
      convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue(
        convertAccepted
          ? { accepted: true, reason: "accepted", result: STRONG_DOC }
          : { accepted: false, reason: "weak_output", result: "[Section: Short Information]\nHi" }
      ),
      withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
    }));
  }

  const runtime = require("../server/lib/recruitment/productionRuntime");
  return {
    persistDraft: runtime.persistDraft,
    persistReviewQueue: runtime.persistReviewQueue,
    formatTelegramReviewMessage: runtime.formatTelegramReviewMessage,
    saveDraft,
    saveReviewItem,
    sendNotification,
    drafts,
    reviews
  };
}

describe("AMP-4B structured output persistence proof", () => {
  afterEach(() => {
    jest.dontMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
    jest.dontMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction");
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("1-5. strong conversion persists canonical publisher text with title, URL, recruitmentId", async () => {
    const { persistDraft, saveDraft } = mockPersistenceRuntime({ convertAccepted: true });
    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL }
    });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    const saved = saveDraft.mock.calls[0][0];
    expect(saved.payload.data).toBe(STRONG_DOC);
    expect(saved.payload.data).toMatch(/\[Section:\s*Short Information\]/);
    expect(saved.payload.data).not.toMatch(/\[Section:\s*ShortInfo\]/);
    expect(saved.payload.title).toBe(TITLE);
    expect(saved.payload.pageUrl).toBe(PDF_URL);
    expect(saved.recruitmentId).toBe(102);
    expect(result.draft.status).toBe("draft");
    expect(result.draft.published_page_id).toBeNull();
    expect(result.draft.published_slug).toBeNull();
    expect(result.aiConvert.ok).toBe(true);
  });

  test("6-8. review binding + Telegram string payload", async () => {
    const ctx = mockPersistenceRuntime({ convertAccepted: true });
    const draft = await ctx.persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL }
    });
    const review = await ctx.persistReviewQueue({
      pipelineOutcome: { skipped: false, failed: false, result: { eventType: "notification" } },
      workflowResult: {},
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL },
      updateId: 9002,
      draftId: draft.draftId
    });

    expect(ctx.saveReviewItem).toHaveBeenCalledTimes(1);
    expect(review.id).toBe(1);
    expect(review.status).toBe("pending");
    expect(review.update_id).toBe(9002);
    expect(review.recruitment_id).toBe(102);
    expect(review.processor_output).toEqual({ draftId: draft.draftId });
    expect(review.reused).toBe(false);

    const message = ctx.formatTelegramReviewMessage({
      workflowResult: { telegramReview: { text: "Automation Workflow Review\nRecruitment: SSC CHT" } },
      notice: { title: TITLE },
      recruitmentId: 102,
      draftId: draft.draftId,
      reviewId: review.id
    });
    expect(typeof message).toBe("string");
    expect(message).not.toMatch(/\[object Object\]/);
    expect(message).toContain("Draft id:");
    expect(message).toContain("Review item id:");
    expect(message).toContain("AUTO_PUBLISH remains disabled.");
  });

  test("9. duplicate processing reuses draft and review; no second Telegram", async () => {
    const ctx = mockPersistenceRuntime({ convertAccepted: true });
    const input = {
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      updateId: 9002,
      notice: { title: TITLE, url: PDF_URL }
    };

    const firstDraft = await ctx.persistDraft(input);
    const firstReview = await ctx.persistReviewQueue({
      pipelineOutcome: { skipped: false, failed: false, result: {} },
      workflowResult: {},
      recruitmentId: 102,
      notice: input.notice,
      updateId: 9002,
      draftId: firstDraft.draftId
    });

    const secondDraft = await ctx.persistDraft(input);
    const secondReview = await ctx.persistReviewQueue({
      pipelineOutcome: { skipped: false, failed: false, result: {} },
      workflowResult: {},
      recruitmentId: 102,
      notice: input.notice,
      updateId: 9002,
      draftId: secondDraft.draftId
    });

    expect(ctx.drafts).toHaveLength(1);
    expect(ctx.reviews).toHaveLength(1);
    expect(secondDraft.draftId).toBe(firstDraft.draftId);
    expect(secondDraft.reused).toBe(true);
    expect(secondReview.id).toBe(firstReview.id);
    expect(secondReview.reused).toBe(true);
    expect(ctx.saveReviewItem).toHaveBeenCalledTimes(1);
    expect(ctx.saveDraft.mock.calls[1][0].id).toBe(firstDraft.draftId);
  });

  test("9b. different updateId on same recruitment creates separate drafts", async () => {
    const ctx = mockPersistenceRuntime({ convertAccepted: true });
    const base = {
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL }
    };
    const first = await ctx.persistDraft({ ...base, updateId: 9002 });
    const second = await ctx.persistDraft({ ...base, updateId: 9003 });
    expect(ctx.drafts).toHaveLength(2);
    expect(second.draftId).not.toBe(first.draftId);
    expect(second.reused).toBe(false);
  });

  test("10. weak conversion keeps sparse draft", async () => {
    const { persistDraft, saveDraft } = mockPersistenceRuntime({ convertAccepted: false });
    await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL }
    });
    expect(saveDraft.mock.calls[0][0].payload).toEqual(SPARSE);
  });

  test("11. AI failure keeps sparse draft", async () => {
    const { persistDraft, saveDraft } = mockPersistenceRuntime({ convertThrows: true });
    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL }
    });
    expect(saveDraft.mock.calls[0][0].payload).toEqual(SPARSE);
    expect(result.aiConvert.ok).toBe(false);
  });

  test("12. extraction failure keeps sparse draft", async () => {
    const { persistDraft, saveDraft } = mockPersistenceRuntime({ extractOk: false });
    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: "https://ssc.nic.in/Portal/Apply" }
    });
    expect(saveDraft.mock.calls[0][0].payload).toEqual(SPARSE);
    expect(result.pdfExtraction.ok).toBe(false);
    expect(result.aiConvert.reason).toBe("not_attempted");
  });

  test("13-14. AUTO_PUBLISH blocked and no published page", async () => {
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
    const gate = evaluateManualPublishGate({ confirmManualPublish: false, readyForReview: true });
    expect(gate.published).toBe(false);

    const { persistDraft } = mockPersistenceRuntime({ convertAccepted: true });
    const result = await persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: { generatorPayload: { ...SPARSE } },
      recruitmentId: 102,
      notice: { title: TITLE, url: PDF_URL }
    });
    expect(result.draft.status).toBe("draft");
    expect(result.draft.published_page_id).toBeNull();
    expect(result.draft.published_slug).toBeNull();
  });
});
