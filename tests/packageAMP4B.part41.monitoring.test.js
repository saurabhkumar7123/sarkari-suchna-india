"use strict";

/**
 * Part 41 — official-source monitoring + change detection gates.
 * AUTO_DRAFT, Telegram, notification gateway, and AUTO_PUBLISH stay off.
 */

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const mockEnsureTables = jest.fn().mockResolvedValue(undefined);
const mockFetchSites = jest.fn();
const mockCleanupOldUpdates = jest.fn().mockResolvedValue(0);
const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
const mockGetJob = jest.fn().mockResolvedValue(null);

jest.mock("../server/services/updates/updates.repository", () => ({
  ensureTables: mockEnsureTables,
  fetchSites: mockFetchSites,
  cleanupOldUpdates: mockCleanupOldUpdates
}));

jest.mock("../server/services/queue/siteQueue", () => ({
  siteCheckQueue: {
    getJob: mockGetJob,
    add: mockQueueAdd
  }
}));

jest.mock("../server/services/updates/telegramNotifier", () => ({
  canSendTelegram: jest.fn(() => false),
  sendTelegramMessage: jest.fn(),
  buildHeartbeatMessage: jest.fn(() => "heartbeat"),
  buildDailySummaryMessage: jest.fn(() => "summary")
}));

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

function armMonitoringFlags() {
  clearFlagEnv();
  process.env.PRODUCTION_MONITORING_ENABLED = "true";
  process.env.SCHEDULER_ACTIVATION_ENABLED = "true";
  process.env.LIVE_CRAWLER_ENABLED = "true";
  process.env.WORKER_ACTIVATION_ENABLED = "true";
  process.env.RECRUITMENT_PIPELINE_ENABLED = "false";
  process.env.AUTO_DRAFT_ENABLED = "false";
  process.env.AUTO_PUBLISH_ENABLED = "false";
  process.env.TELEGRAM_DELIVERY_ENABLED = "false";
  process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
}

let activeHandle = null;

afterEach(() => {
  if (activeHandle && typeof activeHandle.stop === "function") {
    activeHandle.stop("test_cleanup");
  }
  activeHandle = null;
  clearFlagEnv();
  jest.clearAllMocks();
});

describe("Part 41 official-source monitoring gates", () => {
  test("approved official sources are eligible; mirrors and unknown hosts are rejected", () => {
    const {
      isApprovedOfficialMonitoringUrl,
      isKnownMirrorHost,
      isOfficialHostSuffix
    } = require("../server/lib/contentIntelligence/sourceIntelligence/officialDomains");

    expect(isOfficialHostSuffix("ssc.gov.in")).toBe(true);
    expect(isOfficialHostSuffix("upsc.gov.in")).toBe(true);
    expect(isApprovedOfficialMonitoringUrl("https://ssc.gov.in/")).toBe(true);
    expect(isApprovedOfficialMonitoringUrl("https://www.upsc.gov.in/whats-new")).toBe(true);
    expect(isApprovedOfficialMonitoringUrl("https://ssc.nic.in/Portal/LatestNews")).toBe(true);

    expect(isKnownMirrorHost("sarkariresult.com")).toBe(true);
    expect(isApprovedOfficialMonitoringUrl("https://www.sarkariresult.com/ssc/cgl-result/")).toBe(false);
    expect(isApprovedOfficialMonitoringUrl("https://freejobalert.com/")).toBe(false);
    expect(isApprovedOfficialMonitoringUrl("https://example.com/jobs")).toBe(false);
  });

  test("monitoring flags arm crawler/worker while draft, Telegram, and publish stay blocked", () => {
    armMonitoringFlags();
    jest.resetModules();
    const flags = require("../server/config/automationFlags");
    const current = flags.getAutomationFlags();

    expect(flags.canStartSchedulerProcess()).toBe(true);
    expect(flags.canStartMonitoringScheduler()).toBe(true);
    expect(flags.canEnqueueLiveCrawlerJobs()).toBe(true);
    expect(flags.canRunAutomationWorkers()).toBe(true);
    expect(flags.canRunProductionPipeline()).toBe(false);
    expect(flags.canAutoDraft()).toBe(false);
    expect(flags.canDeliverTelegram()).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
    expect(current.AUTO_DRAFT_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.NOTIFICATION_GATEWAY_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
  });

  test("scheduler enqueues official sources and skips private mirrors", async () => {
    armMonitoringFlags();
    mockFetchSites.mockResolvedValue([
      {
        id: 1,
        name: "SSC",
        url: "https://ssc.gov.in/",
        selector: "a",
        active: 1,
        priority: 2
      },
      {
        id: 99,
        name: "Mirror",
        url: "https://www.sarkariresult.com/ssc/",
        selector: "a",
        active: 1,
        priority: 2
      }
    ]);
    jest.resetModules();
    const { sendTelegramMessage } = require("../server/services/updates/telegramNotifier");
    const scheduler = require("../server/services/updates/updateScheduler");
    const handle = await scheduler.startUpdateScheduler();
    activeHandle = handle;

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        siteId: 1,
        name: "SSC",
        url: "https://ssc.gov.in/"
      })
    );
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    handle.stop("test_done");
  });

  test("change detection reports no_change when the top item matches the baseline", async () => {
    const { checkSite, buildSignature } = require("../server/services/updates/siteChecker");
    const { clearRobotsPolicyCache } = require("../server/services/updates/robotsAccessPolicy");
    clearRobotsPolicyCache();
    const title = "UPSC Latest Official Notice Title";
    const link = "https://upsc.gov.in/notice/example.pdf";
    const fingerprint = buildSignature(`${title} ${link}`);
    const axios = require("axios");
    const pageHtml = `<html><body><a href="/notice/example.pdf">${title}</a></body></html>`;
    jest.spyOn(axios, "get").mockImplementation(async (url) => {
      if (String(url).includes("robots.txt")) {
        return { status: 200, data: "User-agent: *\nAllow: /\n" };
      }
      return { status: 200, data: pageHtml };
    });

    const result = await checkSite({
      id: 2,
      name: "UPSC",
      url: "https://upsc.gov.in/",
      selector: "a",
      lastContent: fingerprint
    });
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("no_change");
    axios.get.mockRestore();
    clearRobotsPolicyCache();
  });
});
