"use strict";

const mockInsertDetectedUpdate = jest.fn().mockResolvedValue(undefined);
const mockMarkAlertSent = jest.fn().mockResolvedValue(undefined);
const mockSaveSiteBaseline = jest.fn().mockResolvedValue(undefined);
const mockHasRecentDuplicate = jest.fn().mockResolvedValue(false);
const mockSendTelegramMessage = jest.fn().mockResolvedValue({ sent: true });
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

const mockRecordRuntimePreviewFromPipeline = jest.fn();
jest.mock("../server/services/recruitmentRuntimePreview.service", () => ({
  recordRuntimePreviewFromPipeline: mockRecordRuntimePreviewFromPipeline
}));

const mockLookupRecruitmentCandidatesForRuntime = jest.fn();
jest.mock("../server/services/recruitmentCandidateLookup.service", () => ({
  lookupRecruitmentCandidatesForRuntime: mockLookupRecruitmentCandidatesForRuntime
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
const { processSiteJob } = require("../server/services/workers/siteWorker");

describe("siteWorker recruitment pipeline integration", () => {
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

  const job = {
    id: "job-1",
    data: { siteId: 7 }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTION_MONITORING_ENABLED = "true";
    process.env.WORKER_ACTIVATION_ENABLED = "true";
    process.env.LIVE_CRAWLER_ENABLED = "true";
    process.env.RECRUITMENT_PIPELINE_ENABLED = "true";
    process.env.TELEGRAM_DELIVERY_ENABLED = "false";
    process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
    process.env.AUTO_PUBLISH_ENABLED = "false";
    getSiteById.mockResolvedValue(siteRow);
    mockInsertDetectedUpdate.mockResolvedValue(901);
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
    mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
      candidates: [],
      lookupSummary: {
        status: "skipped",
        strategy: "insufficient_criteria",
        candidateCount: 0
      }
    });
  });

  test("does not invoke pipeline when feature flag is disabled", async () => {
    const result = await processSiteJob(job);

    expect(result).toMatchObject({ changed: true, savedCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockRunProductionDetectionPipeline).not.toHaveBeenCalled();
    expect(mockLookupRecruitmentCandidatesForRuntime).not.toHaveBeenCalled();
    expect(mockIsRecruitmentPipelineEnabled).toHaveBeenCalledTimes(1);
  });

  test("invokes production runtime when feature flag is enabled", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockIsProductionRuntimeEnabled.mockReturnValue(true);
    const candidates = [{ id: 11, organization: "ssc", post_name: "CGL" }];
    mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
      candidates,
      lookupSummary: {
        status: "ok",
        strategy: "organization_exam_year",
        candidateCount: 1
      }
    });

    const result = await processSiteJob(job);

    expect(result).toMatchObject({ changed: true, savedCount: 1, productionOutcomeCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockLookupRecruitmentCandidatesForRuntime).toHaveBeenCalledTimes(1);
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledTimes(1);
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        updateId: 901,
        candidateRecruitments: candidates,
        notice: {
          title: "SSC CGL 2026 Admit Card",
          content: "SSC CGL 2026 Admit Card",
          url: "https://ssc.nic.in/admit-card.pdf"
        }
      })
    );
  });

  test("preserves existing update processing when production runtime fails", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockIsProductionRuntimeEnabled.mockReturnValue(true);
    mockRunProductionDetectionPipeline.mockRejectedValue(new Error("pipeline failed"));

    const result = await processSiteJob(job);

    expect(result).toMatchObject({ changed: true, savedCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledWith({
      siteId: 7,
      title: "SSC CGL 2026 Admit Card",
      link: "https://ssc.nic.in/admit-card.pdf"
    });
    expect(mockSaveSiteBaseline).toHaveBeenCalledWith(7, "fp-1");
  });

  test("lookup failure is isolated and continues with empty candidates", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockIsProductionRuntimeEnabled.mockReturnValue(true);
    mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
      candidates: [],
      lookupSummary: {
        status: "failed",
        strategy: "lookup_error",
        candidateCount: 0,
        message: "db down"
      }
    });

    const result = await processSiteJob(job);

    expect(result).toMatchObject({ changed: true, savedCount: 1 });
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateRecruitments: []
      })
    );
  });

  test("does not add database writes beyond existing update insert", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockIsProductionRuntimeEnabled.mockReturnValue(true);

    await processSiteJob(job);

    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(getSiteById).toHaveBeenCalledTimes(1);
  });

  test("regression: disabled flag keeps identical worker outcome", async () => {
    const first = await processSiteJob(job);
    const second = await processSiteJob(job);

    expect(first).toEqual(second);
    expect(mockRunProductionDetectionPipeline).not.toHaveBeenCalled();
  });
});
