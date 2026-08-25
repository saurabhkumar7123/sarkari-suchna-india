"use strict";

/**
 * AMP-4B — siteWorker Telegram hard-gate fix.
 * Telegram alert failure/skip must not discard detected updates or skip productionRuntime.
 */

const mockInsertDetectedUpdate = jest.fn().mockResolvedValue(901);
const mockMarkAlertSent = jest.fn().mockResolvedValue(undefined);
const mockSaveSiteBaseline = jest.fn().mockResolvedValue(undefined);
const mockHasRecentDuplicate = jest.fn().mockResolvedValue(false);
const mockSendTelegramMessage = jest.fn();
const mockCheckSite = jest.fn();
const mockIsRecruitmentPipelineEnabled = jest.fn();
const mockRunProductionDetectionPipeline = jest.fn();
const mockIsProductionRuntimeEnabled = jest.fn();
const mockCanRunAutomationWorkers = jest.fn();
const mockGetAutomationFlags = jest.fn();
const mockLookupRecruitmentCandidatesForRuntime = jest.fn();

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
  buildUpdateMessage: jest.fn((item) => `msg:${item.title}`),
  buildBatchUpdateMessage: jest.fn((items) => `batch:${items.length}`),
  buildSelectorIssueMessage: jest.fn(),
  buildPreDisableWarningMessage: jest.fn()
}));

jest.mock("../server/config/recruitmentPipeline", () => ({
  isRecruitmentPipelineEnabled: mockIsRecruitmentPipelineEnabled
}));

jest.mock("../server/config/automationFlags", () => ({
  getAutomationFlags: mockGetAutomationFlags,
  canRunAutomationWorkers: mockCanRunAutomationWorkers
}));

jest.mock("../server/lib/recruitment/productionRuntime", () => ({
  runProductionDetectionPipeline: mockRunProductionDetectionPipeline,
  isProductionRuntimeEnabled: mockIsProductionRuntimeEnabled
}));

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

describe("siteWorker AMP-4B Telegram hard-gate", () => {
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

  const job = { id: "job-amp4b-1", data: { siteId: 7 } };

  beforeEach(() => {
    jest.clearAllMocks();
    getSiteById.mockResolvedValue(siteRow);
    mockCanRunAutomationWorkers.mockReturnValue(true);
    mockGetAutomationFlags.mockReturnValue({
      RECRUITMENT_PIPELINE_ENABLED: true,
      AUTO_PUBLISH_ENABLED: false
    });
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockIsProductionRuntimeEnabled.mockReturnValue(true);
    mockRunProductionDetectionPipeline.mockResolvedValue({
      skipped: false,
      success: true,
      recruitmentId: 42,
      publishingBlocked: true
    });
    mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
      candidates: [],
      lookupSummary: { status: "skipped", strategy: "insufficient_criteria", candidateCount: 0 }
    });
    mockCheckSite.mockResolvedValue({
      changed: true,
      shouldNotify: true,
      items: [
        {
          title: "SSC CGL 2026 Recruitment",
          link: "https://ssc.nic.in/Portal/Apply"
        }
      ],
      baselineFingerprint: "fp-amp4b"
    });
    mockInsertDetectedUpdate.mockResolvedValue(901);
  });

  test("telegram success still persists update and runs productionRuntime", async () => {
    mockSendTelegramMessage.mockResolvedValue({ sent: true });

    const result = await processSiteJob(job);

    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledTimes(1);
    expect(mockSaveSiteBaseline).toHaveBeenCalledWith(7, "fp-amp4b");
    expect(mockMarkAlertSent).toHaveBeenCalledWith(7);
    expect(result).toEqual(
      expect.objectContaining({
        changed: true,
        savedCount: 1,
        telegramSent: true,
        telegramFailed: false,
        pipelineContinued: true
      })
    );
  });

  test("telegram skip does not lose detected update or skip productionRuntime", async () => {
    mockSendTelegramMessage.mockResolvedValue({ sent: false, skipped: true, reason: "flag_disabled" });

    const result = await processSiteJob(job);

    expect(mockInsertDetectedUpdate).toHaveBeenCalledWith({
      siteId: 7,
      title: "SSC CGL 2026 Recruitment",
      link: "https://ssc.nic.in/Portal/Apply"
    });
    expect(mockLookupRecruitmentCandidatesForRuntime).toHaveBeenCalledTimes(1);
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        updateId: 901,
        notice: {
          title: "SSC CGL 2026 Recruitment",
          content: "SSC CGL 2026 Recruitment",
          url: "https://ssc.nic.in/Portal/Apply"
        },
        monitoredSite: {
          id: 7,
          name: "SSC",
          url: "https://ssc.nic.in"
        }
      })
    );
    expect(mockSaveSiteBaseline).toHaveBeenCalledWith(7, "fp-amp4b");
    expect(mockMarkAlertSent).not.toHaveBeenCalled();
    expect(result.telegramFailed).toBe(true);
    expect(result.pipelineContinued).toBe(true);
    expect(result.savedCount).toBe(1);
  });

  test("telegram throw does not discard update or productionRuntime", async () => {
    mockSendTelegramMessage.mockRejectedValue(new Error("network down"));

    const result = await processSiteJob(job);

    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockRunProductionDetectionPipeline).toHaveBeenCalledTimes(1);
    expect(mockMarkAlertSent).not.toHaveBeenCalled();
    expect(result.telegramFailed).toBe(true);
    expect(result.pipelineContinued).toBe(true);
  });

  test("worker remains dormant when automation worker flags are off", async () => {
    mockCanRunAutomationWorkers.mockReturnValue(false);

    const result = await processSiteJob(job);

    expect(result).toEqual({ skipped: true, reason: "flag_disabled" });
    expect(mockInsertDetectedUpdate).not.toHaveBeenCalled();
    expect(mockRunProductionDetectionPipeline).not.toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });
});
