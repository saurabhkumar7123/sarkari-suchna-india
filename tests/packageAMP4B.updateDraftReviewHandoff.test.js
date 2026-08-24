"use strict";

/**
 * Automatic update → persistDraft → persistReviewQueue handoff.
 * Telegram and AUTO_PUBLISH stay off. No fabricated recruitment.
 */

jest.mock("axios");

const flags = require("../server/config/automationFlags");
const {
  PUBLISHING_POLICY,
  evaluateManualPublishGate
} = require("../server/lib/productionWorkflow/publishingPolicy");

const PDF_URL = "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Important_Notice_18082026.pdf";
const TITLE = "Important Notice";
const STRONG_DOC = `[Section: Short Information]
Staff Selection Commission Important Notice official PDF.
[Section: Important Dates]
Notice Date : 18.08.2026
[Section: Vacancy]
Official SSC notice details extracted from the source PDF.
[Section: Important Links]
Notification PDF=${PDF_URL}
`;

const FLAG_KEYS = [
  "RECRUITMENT_PIPELINE_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "AUTO_PUBLISH_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED",
  "PRODUCTION_MONITORING_ENABLED",
  "SCHEDULER_ACTIVATION_ENABLED",
  "WORKER_ACTIVATION_ENABLED",
  "CRON_ACTIVATION_ENABLED"
];

function clearFlagEnv() {
  for (const key of FLAG_KEYS) delete process.env[key];
}

function armDraftReviewFlags() {
  clearFlagEnv();
  process.env.RECRUITMENT_PIPELINE_ENABLED = "true";
  process.env.AUTO_DRAFT_ENABLED = "true";
  process.env.AUTO_PUBLISH_ENABLED = "false";
  process.env.TELEGRAM_DELIVERY_ENABLED = "false";
  process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
  process.env.PRODUCTION_MONITORING_ENABLED = "true";
  process.env.LIVE_CRAWLER_ENABLED = "false";
  process.env.SCHEDULER_ACTIVATION_ENABLED = "false";
  process.env.WORKER_ACTIVATION_ENABLED = "false";
}

function mockHandoffRuntime({ convertAccepted = true } = {}) {
  jest.resetModules();
  armDraftReviewFlags();

  const drafts = [];
  const reviews = [];
  let nextDraftId = 1;
  let nextReviewId = 1;

  const saveDraft = jest.fn(async ({ id, payload, recruitmentId }) => {
    if (id) {
      const existing = drafts.find((d) => Number(d.id) === Number(id));
      existing.payload = payload;
      existing.title = payload.title;
      existing.recruitment_id = recruitmentId == null ? null : recruitmentId;
      return existing;
    }
    const row = {
      id: nextDraftId++,
      title: payload.title,
      payload,
      status: "draft",
      recruitment_id: recruitmentId == null ? null : recruitmentId,
      published_page_id: null,
      published_slug: null
    };
    drafts.push(row);
    return row;
  });

  const findUnpublishedDraftByUpdateId = jest.fn(async (updateId) =>
    drafts.find(
      (d) =>
        String(d.status) === "draft" &&
        Number(d.payload && (d.payload.updateId || d.payload.update_id)) === Number(updateId)
    ) || null
  );

  const saveReviewItem = jest.fn(async (input) => {
    const row = {
      id: nextReviewId++,
      status: "pending",
      update_id: input.updateId ?? null,
      recruitment_id: (input.reviewItem && input.reviewItem.recruitmentId) || null,
      title: input.reviewItem && input.reviewItem.title,
      processor_output: input.processorOutput || null
    };
    reviews.push(row);
    return row;
  });

  const getReviewItemByUpdateId = jest.fn(async (updateId) =>
    reviews.find((r) => Number(r.update_id) === Number(updateId)) || null
  );

  const createRecruitment = jest.fn();

  jest.doMock("../server/services/generatorDraft.service", () => ({
    saveDraft,
    findUnpublishedDraftByUpdateId,
    listDraftsByRecruitmentId: jest.fn().mockResolvedValue([]),
    getDraftById: jest.fn(async (id) => drafts.find((d) => d.id === id) || null)
  }));
  jest.doMock("../server/repositories/generatorDraft.repository", () => ({
    updateDraftLinkage: jest.fn().mockResolvedValue(true)
  }));
  jest.doMock("../server/services/recruitmentReview.service", () => ({
    saveReviewItem,
    getReviewItemByUpdateId,
    listReviewItems: jest.fn(async () => ({ data: reviews, pagination: { page: 1, limit: 50, total: reviews.length } }))
  }));
  jest.doMock("../server/services/recruitment.service", () => ({
    createRecruitment
  }));
  jest.doMock("../server/lib/recruitment/runRecruitmentPipeline", () => ({
    runRecruitmentPipeline: jest.fn(() => ({
      skipped: false,
      failed: false,
      updateId: 464,
      result: { eventType: "notification", selectedRecruitment: null }
    }))
  }));
  jest.doMock("../server/lib/recruitment/automationWorkflow", () => ({
    runProductionAutomationWorkflow: jest.fn(async () => ({
      recruitmentObject: {},
      intelligenceResult: {},
      validation: {},
      historyRecovery: {},
      workflowState: "detected",
      generatorPayload: {
        title: TITLE,
        pageUrl: PDF_URL,
        data: `[Section: Short Information]\n${TITLE}`
      }
    }))
  }));
  jest.doMock("../server/lib/enterprise/notificationGateway", () => ({
    sendNotification: jest.fn(),
    CHANNELS: { TELEGRAM: "telegram" }
  }));
  jest.doMock("../server/services/enterprise/enterprisePersistence.service", () => ({
    defaultService: {
      recruitment: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      draft: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      workflow: {
        getByKey: jest.fn().mockResolvedValue(null),
        createWorkflow: jest.fn().mockResolvedValue({ workflow_key: "wk-update", current_state: "detected" }),
        updateWorkflow: jest.fn()
      },
      reviewQueue: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      audit: { recordEvent: jest.fn().mockResolvedValue({ ok: true }) },
      metrics: { upsertMetric: jest.fn().mockResolvedValue({ ok: true }) }
    }
  }));
  jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
    downloadOfficialPdfForGeneratorExtraction: jest.fn().mockResolvedValue({
      text: "Staff Selection Commission Important Notice official PDF 18.08.2026",
      sourceUrl: PDF_URL
    })
  }));
  jest.doMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert", () => ({
    convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue({
      accepted: convertAccepted,
      reason: convertAccepted ? "accepted" : "conversion_not_accepted",
      result: convertAccepted ? STRONG_DOC : ""
    }),
    withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
  }));

  const runtime = require("../server/lib/recruitment/productionRuntime");
  return {
    runtime,
    saveDraft,
    saveReviewItem,
    createRecruitment,
    drafts,
    reviews
  };
}

afterEach(() => {
  clearFlagEnv();
  jest.resetModules();
});

describe("update → draft + review handoff", () => {
  test("AUTO_PUBLISH remains blocked", () => {
    armDraftReviewFlags();
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
    const gate = evaluateManualPublishGate({ confirmManualPublish: false, readyForReview: true });
    expect(gate.published).toBe(false);
  });

  test("persistDraft seeds notice PDF URL and updateId without a recruitment", async () => {
    const ctx = mockHandoffRuntime();
    const result = await ctx.runtime.persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: {},
      recruitmentId: null,
      notice: { title: TITLE, url: PDF_URL },
      updateId: 464,
      monitoredSite: { id: 1, name: "SSC", url: "https://ssc.gov.in/" }
    });

    expect(result.skipped).toBe(false);
    expect(result.draftId).toBe(1);
    expect(result.aiConvert.ok).toBe(true);
    expect(ctx.saveDraft).toHaveBeenCalledTimes(1);
    const saved = ctx.saveDraft.mock.calls[0][0];
    expect(saved.recruitmentId == null).toBe(true);
    expect(saved.payload.updateId).toBe(464);
    expect(saved.payload.pageUrl).toBe(PDF_URL);
    expect(saved.payload.data).toBe(STRONG_DOC);
    expect(ctx.createRecruitment).not.toHaveBeenCalled();
  });

  test("same updateId reuses one draft and one review; Telegram stays off", async () => {
    const ctx = mockHandoffRuntime();
    const firstDraft = await ctx.runtime.persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: {},
      recruitmentId: null,
      notice: { title: TITLE, url: PDF_URL },
      updateId: 465
    });
    const firstReview = await ctx.runtime.persistReviewQueue({
      pipelineOutcome: { skipped: false, failed: false, result: { eventType: "notification" } },
      workflowResult: {},
      recruitmentId: null,
      notice: { title: TITLE, url: PDF_URL },
      updateId: 465,
      draftId: firstDraft.draftId
    });
    const secondDraft = await ctx.runtime.persistDraft({
      flags: { AUTO_DRAFT_ENABLED: true },
      workflowResult: {},
      recruitmentId: null,
      notice: { title: TITLE, url: PDF_URL },
      updateId: 465
    });
    const secondReview = await ctx.runtime.persistReviewQueue({
      pipelineOutcome: { skipped: false, failed: false, result: { eventType: "notification" } },
      workflowResult: {},
      recruitmentId: null,
      notice: { title: TITLE, url: PDF_URL },
      updateId: 465,
      draftId: secondDraft.draftId
    });

    expect(ctx.drafts).toHaveLength(1);
    expect(ctx.reviews).toHaveLength(1);
    expect(secondDraft.draftId).toBe(firstDraft.draftId);
    expect(secondDraft.reused).toBe(true);
    expect(secondReview.id).toBe(firstReview.id);
    expect(secondReview.reused).toBe(true);
    expect(ctx.saveReviewItem).toHaveBeenCalledTimes(1);
    const current = require("../server/config/automationFlags").getAutomationFlags();
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("runProductionDetectionPipeline does not invent a recruitment and still drafts+reviews", async () => {
    const ctx = mockHandoffRuntime();
    const outcome = await ctx.runtime.runProductionDetectionPipeline({
      notice: {
        title: TITLE,
        content: TITLE,
        url: PDF_URL
      },
      updateId: 464,
      candidateRecruitments: [],
      monitoredSite: { id: 1, name: "SSC", url: "https://ssc.gov.in/" }
    });

    expect(outcome.success).toBe(true);
    expect(outcome.failed).not.toBe(true);
    expect(outcome.recruitmentCreated).toBe(false);
    expect(outcome.recruitmentId == null).toBe(true);
    expect(ctx.createRecruitment).not.toHaveBeenCalled();
    expect(outcome.draft && outcome.draft.skipped).toBe(false);
    expect(outcome.draft && outcome.draft.draftId).toBe(1);
    expect(outcome.review && outcome.review.id).toBe(1);
    expect(outcome.review && Number(outcome.review.update_id)).toBe(464);
    expect(outcome.telegram && outcome.telegram.delivered).not.toBe(true);
    expect(outcome.publishingBlocked).toBe(true);
    expect(ctx.saveDraft.mock.calls[0][0].payload.updateId).toBe(464);
  });

  test("AI/convert failure does not create a draft, review, or Telegram", async () => {
    const ctx = mockHandoffRuntime({ convertAccepted: false });
    const outcome = await ctx.runtime.runProductionDetectionPipeline({
      notice: {
        title: TITLE,
        content: TITLE,
        url: PDF_URL
      },
      updateId: 464,
      candidateRecruitments: [],
      monitoredSite: { id: 1, name: "SSC", url: "https://ssc.gov.in/" }
    });

    expect(outcome.success).toBe(true);
    expect(outcome.draft && outcome.draft.skipped).toBe(true);
    expect(outcome.draft && outcome.draft.draftId == null).toBe(true);
    expect(outcome.review).toBe(null);
    expect(outcome.telegram && outcome.telegram.delivered).toBe(false);
    expect(outcome.telegram && outcome.telegram.reason).toBe("draft_not_created");
    expect(ctx.saveDraft).not.toHaveBeenCalled();
    expect(ctx.saveReviewItem).not.toHaveBeenCalled();
    expect(outcome.publishingBlocked).toBe(true);
  });
});

describe("targeted Telegram via existing productionRuntime gateway path", () => {
  afterEach(() => {
    clearFlagEnv();
    jest.resetModules();
  });

  test("deliverTelegramReview stays disabled when Telegram flags are off", async () => {
    jest.resetModules();
    clearFlagEnv();
    process.env.AUTO_PUBLISH_ENABLED = "false";
    process.env.TELEGRAM_DELIVERY_ENABLED = "false";
    process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
    const sendNotification = jest.fn();
    jest.doMock("../server/lib/enterprise/notificationGateway", () => ({
      sendNotification,
      CHANNELS: { TELEGRAM: "telegram" }
    }));
    const { deliverTelegramReview, formatTelegramReviewMessage } = require("../server/lib/recruitment/productionRuntime");
    const result = await deliverTelegramReview({
      flags: require("../server/config/automationFlags").getAutomationFlags(),
      workflowResult: {},
      notice: { title: TITLE, url: PDF_URL },
      recruitmentId: null,
      draftId: 14,
      reviewId: 4
    });
    expect(result.delivered).toBe(false);
    expect(result.status).toBe("disabled");
    expect(sendNotification).not.toHaveBeenCalled();
    const message = formatTelegramReviewMessage({
      workflowResult: {},
      notice: { title: TITLE },
      draftId: 14,
      reviewId: 4
    });
    expect(message).toMatch(/Draft id:\s*14/);
    expect(message).toMatch(/Review item id:\s*4/);
    expect(message).toMatch(/Important Notice/);
    expect(message).toMatch(/AUTO_PUBLISH remains disabled/);
  });

  test("deliverTelegramReview sends one targeted gateway message when flags are on", async () => {
    jest.resetModules();
    clearFlagEnv();
    process.env.AUTO_PUBLISH_ENABLED = "false";
    process.env.AUTO_DRAFT_ENABLED = "false";
    process.env.TELEGRAM_DELIVERY_ENABLED = "true";
    process.env.NOTIFICATION_GATEWAY_ENABLED = "true";
    const sendNotification = jest.fn(async ({ payload }) => ({
      delivered: true,
      status: "delivered",
      payload
    }));
    jest.doMock("../server/lib/enterprise/notificationGateway", () => ({
      sendNotification,
      CHANNELS: { TELEGRAM: "telegram" }
    }));
    const { deliverTelegramReview } = require("../server/lib/recruitment/productionRuntime");
    const flags = require("../server/config/automationFlags").getAutomationFlags();
    const first = await deliverTelegramReview({
      flags,
      workflowResult: {},
      notice: { title: TITLE, url: PDF_URL },
      recruitmentId: null,
      draftId: 14,
      reviewId: 4
    });
    expect(first.delivered).toBe(true);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const sent = sendNotification.mock.calls[0][0];
    expect(sent.channel).toBe("telegram");
    expect(sent.payload.message).toMatch(/Draft id:\s*14/);
    expect(sent.payload.message).toMatch(/Review item id:\s*4/);
    expect(sent.payload.message).toMatch(/Important Notice/);
    expect(sent.meta.source).toBe("productionRuntime");
    expect(flags.AUTO_PUBLISH_ENABLED).toBe(false);
  });
});
