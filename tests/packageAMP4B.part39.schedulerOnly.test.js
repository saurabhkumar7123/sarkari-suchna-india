"use strict";

/**
 * Part 39 — controlled scheduler-only activation proof.
 * LIVE_CRAWLER, AUTO_DRAFT, AUTO_PUBLISH, Telegram, and notification gateway stay off.
 */

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const mockEnsureTables = jest.fn().mockResolvedValue(undefined);
const mockFetchSites = jest.fn().mockResolvedValue([{ id: 1, name: "x", url: "https://example.test", active: 1 }]);
const mockCleanupOldUpdates = jest.fn().mockResolvedValue(0);
const mockQueueAdd = jest.fn();
const mockGetJob = jest.fn().mockResolvedValue(null);
const mockSendTelegramMessage = jest.fn();
const mockCanSendTelegram = jest.fn(() => true);

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
  canSendTelegram: mockCanSendTelegram,
  sendTelegramMessage: mockSendTelegramMessage,
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
  for (const key of FLAG_KEYS) {
    delete process.env[key];
  }
}

function armSchedulerOnlyFlags() {
  clearFlagEnv();
  process.env.PRODUCTION_MONITORING_ENABLED = "true";
  process.env.SCHEDULER_ACTIVATION_ENABLED = "true";
  process.env.LIVE_CRAWLER_ENABLED = "false";
  process.env.AUTO_DRAFT_ENABLED = "false";
  process.env.AUTO_PUBLISH_ENABLED = "false";
  process.env.TELEGRAM_DELIVERY_ENABLED = "false";
  process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
  process.env.RECRUITMENT_PIPELINE_ENABLED = "false";
  process.env.WORKER_ACTIVATION_ENABLED = "false";
}

let activeHandle = null;

function loadModules() {
  jest.resetModules();
  const flags = require("../server/config/automationFlags");
  const scheduler = require("../server/services/updates/updateScheduler");
  return { flags, scheduler };
}

afterEach(() => {
  if (activeHandle && typeof activeHandle.stop === "function") {
    activeHandle.stop("test_cleanup");
  }
  activeHandle = null;
  clearFlagEnv();
  jest.clearAllMocks();
});

describe("Part 39 controlled scheduler-only proof", () => {
  test("A. scheduler does not execute when disabled", async () => {
    clearFlagEnv();
    const intervalSpy = jest.spyOn(global, "setInterval");
    const { flags, scheduler } = loadModules();

    expect(flags.canStartSchedulerProcess()).toBe(false);
    expect(flags.canStartMonitoringScheduler()).toBe(false);

    const handle = await scheduler.startUpdateScheduler();
    activeHandle = handle;
    expect(handle.isActive()).toBe(false);
    expect(scheduler.isUpdateSchedulerActive()).toBe(false);
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(mockEnsureTables).not.toHaveBeenCalled();
    expect(mockFetchSites).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();

    intervalSpy.mockRestore();
  });

  test("B-F. scheduler-only cycle starts while downstream gates stay blocked", async () => {
    armSchedulerOnlyFlags();
    const { flags, scheduler } = loadModules();
    const current = flags.getAutomationFlags();

    expect(flags.canStartSchedulerProcess()).toBe(true);
    expect(flags.canStartMonitoringScheduler()).toBe(false);
    expect(flags.canEnqueueLiveCrawlerJobs()).toBe(false);
    expect(flags.canRunAutomationWorkers()).toBe(false);
    expect(flags.canAutoDraft()).toBe(false);
    expect(flags.canDeliverTelegram()).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(current.RECRUITMENT_PIPELINE_ENABLED).toBe(false);
    expect(current.AUTO_DRAFT_ENABLED).toBe(false);
    expect(current.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(current.LIVE_CRAWLER_ENABLED).toBe(false);
    expect(current.TELEGRAM_DELIVERY_ENABLED).toBe(false);
    expect(current.NOTIFICATION_GATEWAY_ENABLED).toBe(false);

    const handle = await scheduler.startUpdateScheduler();
    activeHandle = handle;
    expect(handle.isActive()).toBe(true);
    expect(scheduler.isUpdateSchedulerActive()).toBe(true);

    expect(mockEnsureTables).not.toHaveBeenCalled();
    expect(mockFetchSites).not.toHaveBeenCalled();
    expect(mockCleanupOldUpdates).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(mockGetJob).not.toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();

    const manual = await scheduler.triggerManualUpdateCheck();
    expect(manual.skipped).toBe(true);
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();

    handle.stop("test_done");
    expect(scheduler.isUpdateSchedulerActive()).toBe(false);
  });

  test("G-H. stop is clean and duplicate start does not create a second interval", async () => {
    armSchedulerOnlyFlags();
    const { scheduler } = loadModules();
    const intervalSpy = jest.spyOn(global, "setInterval");

    const first = await scheduler.startUpdateScheduler();
    activeHandle = first;
    expect(intervalSpy).toHaveBeenCalledTimes(1);
    expect(scheduler.isUpdateSchedulerActive()).toBe(true);

    const duplicate = await scheduler.startUpdateScheduler();
    expect(intervalSpy).toHaveBeenCalledTimes(1);
    expect(duplicate.isActive()).toBe(true);

    first.stop("repeatability");
    expect(scheduler.isUpdateSchedulerActive()).toBe(false);
    expect(first.isActive()).toBe(false);

    const restarted = await scheduler.startUpdateScheduler();
    activeHandle = restarted;
    expect(intervalSpy).toHaveBeenCalledTimes(2);
    expect(scheduler.isUpdateSchedulerActive()).toBe(true);

    restarted.stop("final");
    expect(scheduler.isUpdateSchedulerActive()).toBe(false);
    intervalSpy.mockRestore();
  });

  test("D. AUTO_PUBLISH remains false with no publish path in the scheduler cycle", () => {
    armSchedulerOnlyFlags();
    const { flags } = loadModules();
    const fs = require("fs");
    const path = require("path");
    const schedulerSrc = fs.readFileSync(
      path.join(__dirname, "../server/services/updates/updateScheduler.js"),
      "utf8"
    );

    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(schedulerSrc).not.toMatch(/AUTO_PUBLISH_ENABLED\s*=\s*["']true["']/);
    expect(schedulerSrc).not.toMatch(/require\(["'].*publish/i);
  });
});
