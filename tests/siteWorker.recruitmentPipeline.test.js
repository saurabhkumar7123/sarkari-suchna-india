"use strict";

const mockInsertDetectedUpdate = jest.fn().mockResolvedValue(undefined);
const mockMarkAlertSent = jest.fn().mockResolvedValue(undefined);
const mockSaveSiteBaseline = jest.fn().mockResolvedValue(undefined);
const mockHasRecentDuplicate = jest.fn().mockResolvedValue(false);
const mockSendTelegramMessage = jest.fn().mockResolvedValue({ sent: true });
const mockCheckSite = jest.fn();
const mockIsRecruitmentPipelineEnabled = jest.fn();
const mockRunRecruitmentPipeline = jest.fn();

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

jest.mock("../server/lib/recruitment/runRecruitmentPipeline", () => ({
  runRecruitmentPipeline: mockRunRecruitmentPipeline
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
    mockRunRecruitmentPipeline.mockReturnValue({
      skipped: true,
      reason: "flag_off",
      updateId: null
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

    expect(result).toEqual({ changed: true, savedCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockRunRecruitmentPipeline).not.toHaveBeenCalled();
    expect(mockLookupRecruitmentCandidatesForRuntime).not.toHaveBeenCalled();
    expect(mockRecordRuntimePreviewFromPipeline).not.toHaveBeenCalled();
    expect(mockIsRecruitmentPipelineEnabled).toHaveBeenCalledTimes(1);
  });

  test("invokes pipeline only when feature flag is enabled", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    const candidates = [{ id: 11, organization: "ssc", post_name: "CGL" }];
    mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
      candidates,
      lookupSummary: {
        status: "ok",
        strategy: "organization_exam_year",
        candidateCount: 1
      }
    });
    mockRunRecruitmentPipeline.mockReturnValue({
      skipped: false,
      result: { status: "success", eventType: "admit_card" },
      updateId: 901
    });

    const result = await processSiteJob(job);

    expect(result).toEqual({ changed: true, savedCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockLookupRecruitmentCandidatesForRuntime).toHaveBeenCalledTimes(1);
    expect(mockLookupRecruitmentCandidatesForRuntime).toHaveBeenCalledWith({
      notice: {
        title: "SSC CGL 2026 Admit Card",
        content: "SSC CGL 2026 Admit Card",
        url: "https://ssc.nic.in/admit-card.pdf"
      }
    });
    expect(mockRunRecruitmentPipeline).toHaveBeenCalledTimes(1);
    expect(mockRunRecruitmentPipeline).toHaveBeenCalledWith({
      notice: {
        title: "SSC CGL 2026 Admit Card",
        content: "SSC CGL 2026 Admit Card",
        url: "https://ssc.nic.in/admit-card.pdf"
      },
      candidateRecruitments: candidates,
      isEnabled: true,
      updateId: 901
    });
    expect(mockRecordRuntimePreviewFromPipeline).toHaveBeenCalledTimes(1);
    expect(mockRecordRuntimePreviewFromPipeline).toHaveBeenCalledWith({
      pipelineOutcome: {
        skipped: false,
        result: { status: "success", eventType: "admit_card" },
        updateId: 901
      },
      monitoredSite: {
        id: 7,
        name: "SSC",
        url: "https://ssc.nic.in"
      },
      notice: {
        title: "SSC CGL 2026 Admit Card",
        content: "SSC CGL 2026 Admit Card",
        url: "https://ssc.nic.in/admit-card.pdf"
      },
      updateId: 901,
      lookupSummary: {
        status: "ok",
        strategy: "organization_exam_year",
        candidateCount: 1
      },
      eligibility: expect.objectContaining({
        eligible: expect.any(Boolean),
        status: expect.any(String),
        reasons: expect.any(Array)
      }),
      lifecycleArchitecture: expect.objectContaining({
        observationOnly: true,
        architectureOnly: true,
        enabled: true,
        wiringPhase: 41,
        sideEffects: false,
        persistenceEnabled: false,
        automationEnabled: false,
        auditEventCount: 4
      })
    });
  });

  test("preserves existing update processing when pipeline fails", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockRunRecruitmentPipeline.mockReturnValue({
      skipped: false,
      failed: true,
      error: new Error("pipeline failed"),
      updateId: 901
    });

    const result = await processSiteJob(job);

    expect(result).toEqual({ changed: true, savedCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledWith({
      siteId: 7,
      title: "SSC CGL 2026 Admit Card",
      link: "https://ssc.nic.in/admit-card.pdf"
    });
    expect(mockMarkAlertSent).toHaveBeenCalledWith(7);
    expect(mockSaveSiteBaseline).toHaveBeenCalledWith(7, "fp-1");
    expect(mockRecordRuntimePreviewFromPipeline).toHaveBeenCalledWith({
      pipelineOutcome: {
        skipped: false,
        failed: true,
        error: expect.any(Error),
        updateId: 901
      },
      monitoredSite: {
        id: 7,
        name: "SSC",
        url: "https://ssc.nic.in"
      },
      notice: {
        title: "SSC CGL 2026 Admit Card",
        content: "SSC CGL 2026 Admit Card",
        url: "https://ssc.nic.in/admit-card.pdf"
      },
      updateId: 901,
      lookupSummary: {
        status: "skipped",
        strategy: "insufficient_criteria",
        candidateCount: 0
      },
      eligibility: expect.objectContaining({
        eligible: false,
        status: "ineligible",
        reasons: expect.arrayContaining(["CRITICAL_PROCESSOR_FAILURE"])
      }),
      lifecycleArchitecture: expect.objectContaining({
        observationOnly: true,
        architectureOnly: true,
        enabled: true,
        wiringPhase: 41,
        sideEffects: false,
        policyDecision: expect.objectContaining({
          action: "skip"
        })
      })
    });
  });

  test("lookup failure is isolated and continues with empty candidates", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockLookupRecruitmentCandidatesForRuntime.mockResolvedValue({
      candidates: [],
      lookupSummary: {
        status: "failed",
        strategy: "lookup_error",
        candidateCount: 0,
        message: "db down"
      }
    });
    mockRunRecruitmentPipeline.mockReturnValue({
      skipped: false,
      result: { status: "no_match", eventType: "admit_card" },
      updateId: 901
    });

    const result = await processSiteJob(job);

    expect(result).toEqual({ changed: true, savedCount: 1 });
    expect(mockRunRecruitmentPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateRecruitments: [],
        isEnabled: true
      })
    );
    expect(mockMarkAlertSent).toHaveBeenCalledWith(7);
  });

  test("preview recording failure does not break worker flow", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockRunRecruitmentPipeline.mockReturnValue({
      skipped: false,
      result: { status: "no_match", eventType: "admit_card" }
    });
    mockRecordRuntimePreviewFromPipeline.mockImplementation(() => {
      throw new Error("preview buffer exploded");
    });

    const result = await processSiteJob(job);

    expect(result).toEqual({ changed: true, savedCount: 1 });
    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(mockMarkAlertSent).toHaveBeenCalledWith(7);
    expect(mockSaveSiteBaseline).toHaveBeenCalledWith(7, "fp-1");
  });

  test("does not add database writes beyond existing update insert", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);

    await processSiteJob(job);

    expect(mockInsertDetectedUpdate).toHaveBeenCalledTimes(1);
    expect(getSiteById).toHaveBeenCalledTimes(1);
  });

  test("regression: disabled flag keeps identical worker outcome", async () => {
    const first = await processSiteJob(job);
    const second = await processSiteJob(job);

    expect(first).toEqual(second);
    expect(mockRunRecruitmentPipeline).not.toHaveBeenCalled();
    expect(mockRecordRuntimePreviewFromPipeline).not.toHaveBeenCalled();
  });
});
