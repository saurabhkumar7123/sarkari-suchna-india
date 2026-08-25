"use strict";

/**
 * Phase 30 successor — worker no longer writes the in-memory runtime preview
 * buffer. Production path uses runProductionDetectionPipeline instead.
 * This file guards that contract so the obsolete preview side-channel is not
 * silently reintroduced.
 */

const mockInsertDetectedUpdate = jest.fn().mockResolvedValue(undefined);
const mockMarkAlertSent = jest.fn().mockResolvedValue(undefined);
const mockSaveSiteBaseline = jest.fn().mockResolvedValue(undefined);
const mockHasRecentDuplicate = jest.fn().mockResolvedValue(false);
const mockSendTelegramMessage = jest.fn().mockResolvedValue({ sent: false });
const mockCheckSite = jest.fn();
const mockIsRecruitmentPipelineEnabled = jest.fn();
const mockRunProductionDetectionPipeline = jest.fn();
const mockIsProductionRuntimeEnabled = jest.fn();

jest.mock("../server/services/updates/updates.repository", () => ({
  getSiteById: jest.fn(),
  insertDetectedUpdate: mockInsertDetectedUpdate,
  saveSiteBaseline: mockSaveSiteBaseline,
  markSiteChecked: jest.fn().mockResolvedValue(undefined),
  hasRecentDuplicate: mockHasRecentDuplicate,
  findDuplicateUpdate: jest.fn().mockResolvedValue(null),
  markAlertSent: mockMarkAlertSent,
  isInCooldown: jest.fn().mockResolvedValue(false),
  incrementSiteFailure: jest.fn(),
  resetSiteFailure: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../server/services/updates/siteChecker", () => ({
  checkSite: mockCheckSite
}));

jest.mock("../server/services/updates/telegramNotifier", () => ({
  sendTelegramMessage: mockSendTelegramMessage,
  buildUpdateMessage: jest.fn((item) => item),
  buildBatchUpdateMessage: jest.fn((items) => items),
  buildSelectorIssueMessage: jest.fn(),
  buildPreDisableWarningMessage: jest.fn()
}));

jest.mock("../server/config/recruitmentPipeline", () => ({
  isRecruitmentPipelineEnabled: mockIsRecruitmentPipelineEnabled
}));

jest.mock("../server/lib/recruitment/productionRuntime", () => ({
  runProductionDetectionPipeline: mockRunProductionDetectionPipeline,
  isProductionRuntimeEnabled: mockIsProductionRuntimeEnabled
}));

jest.mock("../server/services/recruitmentCandidateLookup.service", () => ({
  lookupRecruitmentCandidatesForRuntime: jest.fn().mockResolvedValue({
    candidates: [],
    lookupSummary: { status: "skipped", strategy: "insufficient_criteria", candidateCount: 0 }
  })
}));

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  }))
}));

jest.mock("../server/services/queue/siteQueue", () => ({
  queueConnection: {}
}));

jest.mock("../server/services/pdfGeneratorExtract.service", () => ({
  extractGeneratorPdfText: jest.fn()
}));

jest.mock("../server/services/file.service", () => ({
  readFile: jest.fn(),
  unlink: jest.fn()
}));

const { getSiteById } = require("../server/services/updates/updates.repository");
const {
  resetRuntimePreviewBuffer,
  getRuntimePreviewSize
} = require("../server/lib/recruitment/runtimePreviewBuffer");
const { processSiteJob } = require("../server/services/workers/siteWorker");

describe("siteWorker → runtime preview buffer integration", () => {
  const siteRow = {
    id: 7,
    name: "SSC",
    url: "https://ssc.nic.in",
    selector: ".updates",
    lastContent: "baseline",
    lastAlertAt: null,
    failCount: 0,
    broken: 0,
    priority: 1,
    active: 1
  };

  const job = { id: "job-preview-1", data: { siteId: 7 } };

  beforeEach(() => {
    jest.clearAllMocks();
    resetRuntimePreviewBuffer();
    process.env.PRODUCTION_MONITORING_ENABLED = "true";
    process.env.WORKER_ACTIVATION_ENABLED = "true";
    process.env.LIVE_CRAWLER_ENABLED = "true";
    process.env.RECRUITMENT_PIPELINE_ENABLED = "true";
    process.env.TELEGRAM_DELIVERY_ENABLED = "false";
    process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
    process.env.AUTO_PUBLISH_ENABLED = "false";
    getSiteById.mockResolvedValue(siteRow);
    mockCheckSite.mockResolvedValue({
      changed: true,
      shouldNotify: true,
      items: [
        {
          title: "SSC CGL 2026 Admit Card",
          link: "https://ssc.nic.in/admit-card.pdf"
        }
      ],
      baselineFingerprint: "fp-1"
    });
    mockIsRecruitmentPipelineEnabled.mockReturnValue(false);
    mockIsProductionRuntimeEnabled.mockReturnValue(false);
    mockRunProductionDetectionPipeline.mockResolvedValue({
      skipped: false,
      success: true,
      publishingBlocked: true
    });
  });

  test("feature flag off does not write preview entries", async () => {
    await processSiteJob(job);
    expect(getRuntimePreviewSize()).toBe(0);
    expect(mockRunProductionDetectionPipeline).not.toHaveBeenCalled();
  });

  test("production runtime path does not write obsolete preview buffer", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockIsProductionRuntimeEnabled.mockReturnValue(true);
    mockInsertDetectedUpdate.mockResolvedValue(777);

    const result = await processSiteJob(job);

    expect(result).toMatchObject({ changed: true, savedCount: 1, productionOutcomeCount: 1 });
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledTimes(1);
    expect(getRuntimePreviewSize()).toBe(0);
  });
});
