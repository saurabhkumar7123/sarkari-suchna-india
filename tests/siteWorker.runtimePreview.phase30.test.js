"use strict";

/**
 * Phase 30 — end-to-end worker → in-memory preview buffer (real buffer module).
 */

const mockInsertDetectedUpdate = jest.fn().mockResolvedValue(undefined);
const mockMarkAlertSent = jest.fn().mockResolvedValue(undefined);
const mockSaveSiteBaseline = jest.fn().mockResolvedValue(undefined);
const mockHasRecentDuplicate = jest.fn().mockResolvedValue(false);
const mockSendTelegramMessage = jest.fn().mockResolvedValue({ sent: true });
const mockCheckSite = jest.fn();
const mockIsRecruitmentPipelineEnabled = jest.fn();

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

jest.mock("../server/repositories/recruitment.repository", () => ({
  tableExists: jest.fn().mockResolvedValue(true),
  findCandidatesForLookup: jest.fn().mockResolvedValue([]),
  findCandidatesByAdvertisementNoLoose: jest.fn().mockResolvedValue([])
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
  getRuntimePreviewSize,
  listRuntimePreviews
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
  });

  test("feature flag off does not write preview entries", async () => {
    await processSiteJob(job);
    expect(getRuntimePreviewSize()).toBe(0);
  });

  test("feature flag on stores processor output in preview buffer", async () => {
    mockIsRecruitmentPipelineEnabled.mockReturnValue(true);
    mockInsertDetectedUpdate.mockResolvedValue(777);

    const result = await processSiteJob(job);

    expect(result).toEqual({ changed: true, savedCount: 1 });
    expect(getRuntimePreviewSize()).toBe(1);

    const listed = listRuntimePreviews({});
    expect(listed.data[0].noticeTitle).toBe("SSC CGL 2026 Admit Card");
    expect(listed.data[0].updateId).toBe(777);
    expect(listed.data[0].monitoredSite).toEqual({
      id: 7,
      name: "SSC",
      url: "https://ssc.nic.in"
    });
    expect(listed.data[0].eventType).toEqual(expect.any(String));
    expect(listed.data[0].processorResult).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        warnings: expect.any(Array)
      })
    );
    expect(listed.data[0].lookupSummary).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        strategy: expect.any(String),
        candidateCount: expect.any(Number)
      })
    );
    expect(listed.data[0].eligibility).toEqual(
      expect.objectContaining({
        eligible: expect.any(Boolean),
        status: expect.any(String),
        reasons: expect.any(Array)
      })
    );
    expect(listed.data[0].lifecycleArchitecture).toEqual(
      expect.objectContaining({
        observationOnly: true,
        architectureOnly: true,
        enabled: true,
        wiringPhase: 41,
        sideEffects: false,
        persistenceEnabled: false,
        automationEnabled: false,
        policyDecision: expect.objectContaining({
          action: expect.any(String)
        }),
        executionPlan: expect.objectContaining({
          executable: false
        }),
        transactionPlan: expect.objectContaining({
          executable: false,
          transactionBegun: false
        }),
        auditEvents: expect.any(Array)
      })
    );
    expect(listed.data[0].lifecycleArchitecture.auditEvents.length).toBe(4);
  });
});
