"use strict";

/**
 * Monitoring readiness — UPSC stored selector is case-sensitive CSS.
 * Official UPSC hrefs currently use "Notice". Fallback is UPSC-host only.
 */

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const mockInsertDetectedUpdate = jest.fn();
const mockIncrementSiteFailure = jest.fn();
const mockSendTelegramMessage = jest.fn();
const mockCheckSite = jest.fn();
const mockCanRunAutomationWorkers = jest.fn();
const mockGetAutomationFlags = jest.fn();
const mockRunProductionDetectionPipeline = jest.fn();
const mockIsProductionRuntimeEnabled = jest.fn();
const mockIsRecruitmentPipelineEnabled = jest.fn();

jest.mock("../server/services/updates/updates.repository", () => ({
  getSiteById: jest.fn(),
  insertDetectedUpdate: mockInsertDetectedUpdate,
  saveSiteBaseline: jest.fn(),
  markSiteChecked: jest.fn().mockResolvedValue(undefined),
  hasRecentDuplicate: jest.fn().mockResolvedValue(false),
  markAlertSent: jest.fn(),
  isInCooldown: jest.fn().mockResolvedValue(false),
  incrementSiteFailure: mockIncrementSiteFailure,
  resetSiteFailure: jest.fn()
}));

jest.mock("../server/services/updates/siteChecker", () => {
  const actual = jest.requireActual("../server/services/updates/siteChecker");
  return {
    ...actual,
    checkSite: (...args) => mockCheckSite(...args)
  };
});

jest.mock("../server/services/updates/telegramNotifier", () => ({
  sendTelegramMessage: mockSendTelegramMessage,
  buildUpdateMessage: jest.fn(() => "update"),
  buildBatchUpdateMessage: jest.fn(() => "batch"),
  buildSelectorIssueMessage: jest.fn(() => "selector-issue"),
  buildPreDisableWarningMessage: jest.fn(() => "warn")
}));

jest.mock("../server/config/recruitmentPipeline", () => ({
  isRecruitmentPipelineEnabled: (...args) => mockIsRecruitmentPipelineEnabled(...args)
}));

jest.mock("../server/config/automationFlags", () => ({
  getAutomationFlags: (...args) => mockGetAutomationFlags(...args),
  canRunAutomationWorkers: (...args) => mockCanRunAutomationWorkers(...args)
}));

jest.mock("../server/lib/recruitment/productionRuntime", () => ({
  runProductionDetectionPipeline: (...args) => mockRunProductionDetectionPipeline(...args),
  isProductionRuntimeEnabled: (...args) => mockIsProductionRuntimeEnabled(...args)
}));

jest.mock("../server/services/recruitmentCandidateLookup.service", () => ({
  lookupRecruitmentCandidatesForRuntime: jest.fn()
}));

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() }))
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

const {
  extractLatestItems,
  checkSite,
  buildSignature,
  isUpscOfficialSite
} = jest.requireActual("../server/services/updates/siteChecker");
const {
  isApprovedOfficialMonitoringUrl,
  isKnownMirrorHost
} = require("../server/lib/contentIntelligence/sourceIntelligence/officialDomains");
const { getSiteById } = require("../server/services/updates/updates.repository");
const { processSiteJob } = require("../server/services/workers/siteWorker");

const UPSC_SITE = {
  id: 2,
  name: "UPSC",
  url: "https://www.upsc.gov.in/",
  selector: 'a[href*="notice"]'
};

const UPSC_HTML = `<html><body>
  <a href="/examinations/exam-calendar">Calendar</a>
  <a href="/whats-new/Engineering%20Services%20(Main)%20Examination,%202026/Notice">Notice: Engineering Services (Main) Examination, 2026</a>
  <a href="/sites/default/files/Notice-PrncplVPrncplOBC-CAF-Engl-050826.pdf">Important Notice PDF</a>
</body></html>`;

describe("UPSC stored selector case-insensitive fallback", () => {
  test("is restricted to official UPSC hosts", () => {
    expect(isUpscOfficialSite(UPSC_SITE)).toBe(true);
    expect(isUpscOfficialSite({ url: "https://ssc.gov.in/" })).toBe(false);
    expect(isUpscOfficialSite({ url: "https://www.sarkariresult.com/" })).toBe(false);
  });

  test("official homepage Notice hrefs extract instead of selector_miss", () => {
    const extracted = extractLatestItems(UPSC_HTML, UPSC_SITE);
    expect(extracted.invalid).toBeUndefined();
    expect(extracted.items.length).toBeGreaterThanOrEqual(1);
    expect(extracted.items[0].title).toMatch(/Engineering Services/i);
    expect(extracted.items[0].link).toBe(
      "https://www.upsc.gov.in/whats-new/Engineering%20Services%20(Main)%20Examination,%202026/Notice"
    );
    expect(extracted.items[0].fingerprint).toMatch(/^sig:[a-f0-9]{40}:/i);
    expect(extracted.items.some((item) => /\.pdf$/i.test(item.link))).toBe(true);
    expect(extracted.items.map((item) => item.link).every((link) => /upsc\.gov\.in/i.test(link))).toBe(
      true
    );
  });

  test("calendar-only page without notice href still selector_miss", () => {
    const extracted = extractLatestItems(
      `<html><body><a href="/examinations/exam-calendar">Calendar</a></body></html>`,
      UPSC_SITE
    );
    expect(extracted).toEqual({ invalid: true, reason: "selector_miss" });
  });

  test("SSC does not receive the UPSC case-insensitive fallback", () => {
    const extracted = extractLatestItems(
      `<html><body><a href="/notice/example.pdf">Delhi Police Result Notice</a></body></html>`,
      {
        id: 1,
        name: "SSC",
        url: "https://ssc.gov.in/",
        selector: 'a[href*="Notice"]'
      }
    );
    expect(extracted.invalid).toBe(true);
    expect(extracted.reason).toBe("selector_miss");
  });

  test("non href-contains UPSC selector is not broadened", () => {
    const extracted = extractLatestItems(UPSC_HTML, { ...UPSC_SITE, selector: ".missing-class" });
    expect(extracted).toEqual({ invalid: true, reason: "selector_miss" });
  });
});

describe("UPSC/SSC change detection", () => {
  test("same official Notice content twice is no_change", async () => {
    const extracted = extractLatestItems(UPSC_HTML, UPSC_SITE);
    const top = extracted.items[0];
    const axios = require("axios");
    jest.spyOn(axios, "get").mockResolvedValue({ data: UPSC_HTML });

    const first = await checkSite({ ...UPSC_SITE, lastContent: top.fingerprint });
    const second = await checkSite({ ...UPSC_SITE, lastContent: top.fingerprint });
    expect(first).toMatchObject({ changed: false, reason: "no_change", items: [] });
    expect(second).toEqual(first);
    axios.get.mockRestore();
  });

  test("changed official Notice content yields exactly one changed item set", async () => {
    const extracted = extractLatestItems(UPSC_HTML, UPSC_SITE);
    const axios = require("axios");
    jest.spyOn(axios, "get").mockResolvedValue({ data: UPSC_HTML });

    const result = await checkSite({
      ...UPSC_SITE,
      lastContent: buildSignature("previous official notice https://www.upsc.gov.in/old")
    });
    expect(result.changed).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.items).toHaveLength(extracted.items.length);
    axios.get.mockRestore();
  });
});

describe("official-source and failure containment", () => {
  test("private mirrors remain ineligible", () => {
    expect(isApprovedOfficialMonitoringUrl("https://ssc.gov.in/")).toBe(true);
    expect(isApprovedOfficialMonitoringUrl("https://www.upsc.gov.in/")).toBe(true);
    expect(isKnownMirrorHost("sarkariresult.com")).toBe(true);
    expect(isApprovedOfficialMonitoringUrl("https://www.sarkariresult.com/ssc/")).toBe(false);
    expect(isApprovedOfficialMonitoringUrl("https://freejobalert.com/")).toBe(false);
    expect(isApprovedOfficialMonitoringUrl("https://example.com/jobs")).toBe(false);
  });

  test("invalid source does not insert updates, draft, publish, or depend on Telegram delivery", async () => {
    mockCanRunAutomationWorkers.mockReturnValue(true);
    mockGetAutomationFlags.mockReturnValue({
      AUTO_DRAFT_ENABLED: false,
      AUTO_PUBLISH_ENABLED: false,
      TELEGRAM_DELIVERY_ENABLED: false,
      RECRUITMENT_PIPELINE_ENABLED: false
    });
    mockIsRecruitmentPipelineEnabled.mockReturnValue(false);
    mockIsProductionRuntimeEnabled.mockReturnValue(false);
    mockSendTelegramMessage.mockResolvedValue({ sent: false, skipped: true, reason: "flag_disabled" });
    mockIncrementSiteFailure.mockResolvedValue({ next: 1, shouldWarn: false });
    getSiteById.mockResolvedValue({
      id: 2,
      name: "UPSC",
      url: "https://www.upsc.gov.in/",
      selector: 'a[href*="notice"]',
      lastContent: "sig:abc",
      active: 1,
      failCount: 4,
      broken: 0
    });
    mockCheckSite.mockResolvedValue({ changed: false, invalid: true, reason: "selector_miss" });

    const result = await processSiteJob({ id: "job-upsc-invalid", data: { siteId: 2 } });

    expect(result).toEqual({ changed: false, invalid: true, reason: "selector_miss" });
    expect(mockInsertDetectedUpdate).not.toHaveBeenCalled();
    expect(mockRunProductionDetectionPipeline).not.toHaveBeenCalled();
    expect(mockIncrementSiteFailure).toHaveBeenCalledWith(2);
    expect(mockSendTelegramMessage.mock.calls.every((call) => typeof call[0] === "string")).toBe(true);
  });
});
