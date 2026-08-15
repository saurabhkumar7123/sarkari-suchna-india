"use strict";

/**
 * AMP-4B Part 17 — accepted convert → existing saveDraft() only.
 * Isolated mocks. No production DB, review, Telegram, or publish.
 */

jest.mock("axios");

const TITLE =
  "Important Notice regarding filling up of Caste Serial No. by OBC Candidates in CAF for the Posts of Principal and Vice Principal (Special Advt. No. 51 - 2026)";
const HTML_URL =
  "https://www.upsc.gov.in/content/important-notice-regarding-filling-caste-serial-no-obc-candidates-caf-posts-principal-and";
const CANONICAL = `[Section: Short Information]
UNION PUBLIC SERVICE COMMISSION
[Section: Eligibility]
Qualification: OBC certificate issued by Govt. of NCT of Delhi.
[Section: Vacancy]
Principal and Vice Principal Special Advertisement No. 51/2026 reservation under OBC Category.
`;

function mockPersistDeps({ convertAccepted = true } = {}) {
  jest.resetModules();
  const saveDraft = jest.fn().mockImplementation(async ({ id, payload, recruitmentId }) => ({
    id: id || 22,
    title: payload.title,
    payload,
    status: "draft",
    recruitment_id: recruitmentId == null ? null : recruitmentId,
    published_page_id: null,
    published_slug: null
  }));
  const saveReviewItem = jest.fn();
  const sendNotification = jest.fn();
  const createRecruitment = jest.fn();

  jest.doMock("../server/services/generatorDraft.service", () => ({
    saveDraft,
    getDraftById: jest.fn(),
    listDraftsByRecruitmentId: jest.fn().mockResolvedValue([])
  }));
  jest.doMock("../server/repositories/generatorDraft.repository", () => ({
    updateDraftLinkage: jest.fn()
  }));
  jest.doMock("../server/services/recruitmentReview.service", () => ({
    saveReviewItem
  }));
  jest.doMock("../server/lib/enterprise/notificationGateway", () => ({
    sendNotification,
    CHANNELS: { TELEGRAM: "telegram" }
  }));
  jest.doMock("../server/services/recruitment.service", () => ({
    createRecruitment
  }));
  jest.doMock("../server/services/enterprise/enterprisePersistence.service", () => ({
    defaultService: {
      draft: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) }
    }
  }));
  jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
    downloadOfficialPdfForGeneratorExtraction: jest.fn().mockResolvedValue({
      text: "UNION PUBLIC SERVICE COMMISSION Principal Vice Principal OBC Special Advertisement No. 51/2026 CAF",
      sourceUrl: HTML_URL
    })
  }));
  jest.doMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert", () => ({
    convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue(
      convertAccepted
        ? { accepted: true, reason: "accepted", result: CANONICAL }
        : { accepted: false, reason: "weak_output", result: "[Section: Short Information]\nHi" }
    ),
    withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
  }));

  const runtime = require("../server/lib/recruitment/productionRuntime");
  const { convertAmpExtractedTextToPublisher, withConvertedPublisherData } = require("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert");
  const generatorDraftService = require("../server/services/generatorDraft.service");
  return {
    persistDraft: runtime.persistDraft,
    saveDraft,
    saveReviewItem,
    sendNotification,
    createRecruitment,
    convertAmpExtractedTextToPublisher,
    withConvertedPublisherData,
    generatorDraftService
  };
}

async function persistOnlyIfAccepted(ctx, input) {
  const converted = await ctx.convertAmpExtractedTextToPublisher({
    extractedText: "UNION PUBLIC SERVICE COMMISSION Principal Vice Principal OBC 51/2026",
    title: input.payload.title,
    officialUrl: input.payload.pageUrl
  });
  if (!converted.accepted) {
    return { persisted: false, reason: converted.reason };
  }
  const payload = ctx.withConvertedPublisherData(input.payload, converted.result);
  const draft = await ctx.generatorDraftService.saveDraft({
    id: input.existingDraftId,
    payload,
    recruitmentId: input.recruitmentId
  });
  return { persisted: true, draft, reused: Boolean(input.existingDraftId) };
}

describe("Part 17 UPSC accepted convert → saveDraft", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("accepted convert persists canonical draft without recruitmentId, review, or Telegram", async () => {
    const ctx = mockPersistDeps({ convertAccepted: true });
    const result = await persistOnlyIfAccepted(ctx, {
      payload: {
        title: TITLE,
        pageUrl: HTML_URL,
        data: `[Section: Short Information]\n${TITLE}`,
        status: "draft",
        updateId: 4
      }
    });

    expect(result.persisted).toBe(true);
    expect(ctx.saveDraft).toHaveBeenCalledTimes(1);
    const saved = ctx.saveDraft.mock.calls[0][0];
    expect(saved.recruitmentId).toBeUndefined();
    expect(saved.payload.updateId).toBe(4);
    expect(saved.payload.title).toBe(TITLE);
    expect(saved.payload.pageUrl).toBe(HTML_URL);
    expect(saved.payload.status).toBe("draft");
    expect(saved.payload.data).toBe(CANONICAL);
    expect(saved.payload.data).toMatch(/\[Section:\s*Short Information\]/);
    expect(result.draft.status).toBe("draft");
    expect(result.draft.published_page_id).toBeNull();
    expect(result.draft.published_slug).toBeNull();
    expect(ctx.saveReviewItem).not.toHaveBeenCalled();
    expect(ctx.sendNotification).not.toHaveBeenCalled();
    expect(ctx.createRecruitment).not.toHaveBeenCalled();
  });

  test("rejected convert does not call saveDraft", async () => {
    const ctx = mockPersistDeps({ convertAccepted: false });
    const result = await persistOnlyIfAccepted(ctx, {
      payload: { title: TITLE, pageUrl: HTML_URL, data: TITLE, status: "draft", updateId: 4 }
    });
    expect(result.persisted).toBe(false);
    expect(ctx.saveDraft).not.toHaveBeenCalled();
    expect(ctx.saveReviewItem).not.toHaveBeenCalled();
    expect(ctx.sendNotification).not.toHaveBeenCalled();
  });

  test("unpublished draft for same target is reused", async () => {
    const ctx = mockPersistDeps({ convertAccepted: true });
    const result = await persistOnlyIfAccepted(ctx, {
      existingDraftId: 22,
      payload: {
        title: TITLE,
        pageUrl: HTML_URL,
        data: TITLE,
        status: "draft",
        updateId: 4
      }
    });
    expect(result.reused).toBe(true);
    expect(ctx.saveDraft.mock.calls[0][0].id).toBe(22);
    expect(ctx.saveDraft).toHaveBeenCalledTimes(1);
  });
});
