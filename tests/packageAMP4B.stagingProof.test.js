"use strict";

/**
 * AMP-4B Controlled Staging Activation & E2E Proof (deterministic).
 *
 * Proves the existing productionRuntime path with in-process staging flags and
 * mocked Telegram. Does NOT mutate production .env defaults.
 * AUTO_PUBLISH_ENABLED must remain false throughout.
 */

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const fs = require("fs");
const path = require("path");
const db = require("../server/config/db");

const ENTERPRISE_DATA_DIR = path.join(__dirname, "../server/data/enterprise-test-amp4b-staging");

const STAGING_FLAG_KEYS = [
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
  for (const key of STAGING_FLAG_KEYS) {
    delete process.env[key];
  }
}

function armStagingFlags({ autoDraft = true, telegram = true } = {}) {
  process.env.RECRUITMENT_PIPELINE_ENABLED = "true";
  process.env.AUTO_DRAFT_ENABLED = autoDraft ? "true" : "false";
  process.env.AUTO_PUBLISH_ENABLED = "false";
  process.env.TELEGRAM_DELIVERY_ENABLED = telegram ? "true" : "false";
  process.env.LIVE_CRAWLER_ENABLED = "true";
  process.env.NOTIFICATION_GATEWAY_ENABLED = telegram ? "true" : "false";
  process.env.PRODUCTION_MONITORING_ENABLED = "true";
  process.env.SCHEDULER_ACTIVATION_ENABLED = "true";
  process.env.WORKER_ACTIVATION_ENABLED = "true";
  process.env.CRON_ACTIVATION_ENABLED = "false";
}

beforeAll(() => {
  process.env.ENTERPRISE_DATA_DIR = ENTERPRISE_DATA_DIR;
  if (!fs.existsSync(ENTERPRISE_DATA_DIR)) {
    fs.mkdirSync(ENTERPRISE_DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  clearFlagEnv();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  try {
    require("../server/lib/enterprise/base/schemaGuard").invalidateSchemaCache();
  } catch {
    // ignore
  }
  if (fs.existsSync(ENTERPRISE_DATA_DIR)) {
    for (const file of fs.readdirSync(ENTERPRISE_DATA_DIR)) {
      fs.unlinkSync(path.join(ENTERPRISE_DATA_DIR, file));
    }
  }
});

describe("AMP-4B staging proof — readiness & safety", () => {
  test("defaults remain NO-GO and AUTO_PUBLISH blocked", async () => {
    clearFlagEnv();
    db.query.mockResolvedValue([[]]);
    const flags = require("../server/config/automationFlags");
    const { evaluateActivationReadiness } = require("../server/lib/recruitment/productionRuntime/activationReadiness");
    const { PUBLISHING_POLICY, evaluateManualPublishGate } = require("../server/lib/productionWorkflow/publishingPolicy");

    const current = flags.getAutomationFlags();
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);

    const readiness = await evaluateActivationReadiness();
    expect(readiness.decision).toBe("NO-GO");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.length).toBeGreaterThan(0);

    const gate = evaluateManualPublishGate({ confirmManualPublish: true, readyForReview: true });
    expect(gate.published).toBe(false);
    expect(gate.allowed).toBe(true);
  });

  test("staging-armed flags reach GO while AUTO_PUBLISH stays false", async () => {
    armStagingFlags();
    db.query.mockResolvedValue([[]]);
    jest.resetModules();

    const flags = require("../server/config/automationFlags");
    const { evaluateActivationReadiness } = require("../server/lib/recruitment/productionRuntime/activationReadiness");

    const current = flags.getAutomationFlags();
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(true);
    expect(current.AUTO_DRAFT_ENABLED).toBe(true);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(true);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(flags.canRunAutomationWorkers()).toBe(true);
    expect(flags.canStartMonitoringScheduler()).toBe(true);

    const readiness = await evaluateActivationReadiness();
    expect(readiness.decision).toBe("GO");
    expect(readiness.ready).toBe(true);
    expect(readiness.flags.AUTO_PUBLISH_ENABLED).toBe(false);
  });
});

function mockEnterprisePersistenceService() {
  const noopUpsert = jest.fn().mockResolvedValue({ ok: true });
  const createWorkflow = jest.fn().mockResolvedValue({ workflow_key: "wk-1", current_state: "detected" });
  const updateWorkflow = jest.fn().mockResolvedValue({ workflow_key: "wk-1", current_state: "detected" });
  jest.doMock("../server/services/enterprise/enterprisePersistence.service", () => ({
    defaultService: {
      recruitment: { upsertExtended: noopUpsert },
      draft: { upsertExtended: noopUpsert },
      workflow: {
        getByKey: jest.fn().mockResolvedValue(null),
        createWorkflow,
        updateWorkflow
      },
      reviewQueue: { upsertExtended: noopUpsert },
      audit: { recordEvent: jest.fn().mockResolvedValue({ ok: true }) },
      metrics: { upsertMetric: jest.fn().mockResolvedValue({ ok: true }) }
    },
    createEnterprisePersistenceService: jest.fn(),
    getPlatformSnapshot: jest.fn()
  }));
}

describe("AMP-4B staging proof — productionRuntime AUTO_DRAFT + review", () => {
  test("AUTO_DRAFT off skips draft persist but still blocks auto-publish", async () => {
    armStagingFlags({ autoDraft: false, telegram: false });
    db.query.mockResolvedValue([[]]);
    jest.resetModules();
    mockEnterprisePersistenceService();

    jest.doMock("../server/services/generatorDraft.service", () => ({
      saveDraft: jest.fn()
    }));
    jest.doMock("../server/services/recruitmentReview.service", () => ({
      saveReviewItem: jest.fn().mockResolvedValue({ id: 55, status: "pending" })
    }));
    jest.doMock("../server/services/recruitment.service", () => ({
      createRecruitment: jest.fn().mockResolvedValue({
        id: 101,
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026"
      })
    }));

    const { runProductionDetectionPipeline } = require("../server/lib/recruitment/productionRuntime");
    const draftService = require("../server/services/generatorDraft.service");
    const reviewService = require("../server/services/recruitmentReview.service");
    const flags = require("../server/config/automationFlags");

    const outcome = await runProductionDetectionPipeline({
      notice: {
        title: "SSC CGL 2026 Recruitment",
        content: "SSC CGL 2026 Recruitment",
        url: "https://ssc.nic.in/Portal/Apply"
      },
      updateId: 9001,
      candidateRecruitments: []
    });

    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(outcome.skipped).toBe(false);
    expect(outcome.failed).not.toBe(true);
    expect(outcome.success).toBe(true);
    expect(outcome.publishingBlocked).toBe(true);
    expect(draftService.saveDraft).not.toHaveBeenCalled();
    expect(outcome.draft && outcome.draft.skipped).toBe(true);
    expect(outcome.draft && outcome.draft.reason).toBe("auto_draft_disabled");
    // Review is created only after a successful draft (M2 handoff contract).
    expect(reviewService.saveReviewItem).not.toHaveBeenCalled();
    expect(outcome.review).toBeNull();
    expect(outcome.telegram && outcome.telegram.delivered).not.toBe(true);
  });

  test("AUTO_DRAFT on persists draft when accepted convert yields publisher data", async () => {
    armStagingFlags({ autoDraft: true, telegram: false });
    db.query.mockResolvedValue([[]]);
    jest.resetModules();
    mockEnterprisePersistenceService();

    const mockSaveDraft = jest.fn().mockResolvedValue({
      id: 77,
      title: "SSC CGL 2026",
      payload: { title: "SSC CGL 2026" }
    });
    jest.doMock("../server/services/generatorDraft.service", () => ({
      saveDraft: mockSaveDraft,
      findUnpublishedDraftByUpdateId: jest.fn().mockResolvedValue(null)
    }));
    jest.doMock("../server/services/recruitmentReview.service", () => ({
      saveReviewItem: jest.fn().mockResolvedValue({ id: 56, status: "pending" }),
      getReviewItemByUpdateId: jest.fn().mockResolvedValue(null),
      listReviewItems: jest.fn().mockResolvedValue([])
    }));
    jest.doMock("../server/services/recruitment.service", () => ({
      createRecruitment: jest.fn().mockResolvedValue({
        id: 102,
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026-draft"
      })
    }));

    const publisher =
      "[Section: Short Information]\nNew SSC CGL vacancy detected from official source.";
    jest.doMock("../server/lib/recruitment/automationWorkflow", () => {
      const actual = jest.requireActual("../server/lib/recruitment/automationWorkflow");
      return {
        ...actual,
        runProductionAutomationWorkflow: jest.fn(async (input) => {
          const base = await actual.runProductionAutomationWorkflow(input);
          return {
            ...base,
            generatorPayload: {
              title: "SSC CGL 2026 Recruitment",
              pageUrl: "https://ssc.gov.in/api/attachment/uploads/notice.pdf",
              slug: "ssc-cgl-2026-recruitment",
              data: publisher
            }
          };
        })
      };
    });
    jest.doMock("../server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction", () => ({
      downloadOfficialPdfForGeneratorExtraction: jest.fn().mockResolvedValue({
        text: "SSC CGL 2026 official PDF body",
        sourceUrl: "https://ssc.gov.in/api/attachment/uploads/notice.pdf"
      })
    }));
    jest.doMock("../server/lib/recruitment/productionRuntime/applyGeneratorAiConvert", () => ({
      convertAmpExtractedTextToPublisher: jest.fn().mockResolvedValue({
        accepted: true,
        reason: "accepted",
        result: publisher
      }),
      withConvertedPublisherData: (payload, publisherText) => ({ ...payload, data: publisherText })
    }));

    const { runProductionDetectionPipeline } = require("../server/lib/recruitment/productionRuntime");
    const flags = require("../server/config/automationFlags");

    const outcome = await runProductionDetectionPipeline({
      notice: {
        title: "SSC CGL 2026 Recruitment",
        content: "SSC CGL 2026 Recruitment",
        url: "https://ssc.gov.in/api/attachment/uploads/notice.pdf",
        pdfUrl: "https://ssc.gov.in/api/attachment/uploads/notice.pdf"
      },
      updateId: 9002,
      candidateRecruitments: [],
      monitoredSite: { id: 1, name: "SSC", url: "https://ssc.gov.in/" }
    });

    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(outcome.success).toBe(true);
    expect(outcome.publishingBlocked).toBe(true);
    expect(outcome.draft && outcome.draft.skipped).toBe(false);
    expect(outcome.draft && outcome.draft.draftId).toBe(77);
    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    expect(outcome.review && outcome.review.id).toBe(56);
  });
});

describe("AMP-4B staging proof — Telegram gateway (mocked transport)", () => {
  test("notification gateway delivers when flags+creds present (mocked axios)", async () => {
    armStagingFlags({ telegram: true });
    process.env.TELEGRAM_BOT_TOKEN = "000000:TEST_TOKEN_NOT_REAL";
    process.env.TELEGRAM_CHAT_ID = "123456";
    jest.resetModules();

    jest.doMock("axios", () => ({
      post: jest.fn().mockResolvedValue({ data: { ok: true } })
    }));

    const gateway = require("../server/lib/enterprise/notificationGateway");
    const result = await gateway.sendNotification({
      channel: gateway.CHANNELS.TELEGRAM,
      payload: { message: "AMP-4B staging proof — review required (manual publish only)" }
    });

    expect(result.delivered).toBe(true);
    expect(result.status).toBe("delivered");
  });

  test("notification gateway stays disabled without delivery flags", async () => {
    clearFlagEnv();
    jest.resetModules();
    const gateway = require("../server/lib/enterprise/notificationGateway");
    const result = await gateway.sendNotification({
      channel: "telegram",
      payload: { message: "should not send" }
    });
    expect(result.delivered).toBe(false);
    expect(result.status).toBe("disabled");
  });
});
