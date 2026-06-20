const logger = require("../../utils/logger");
const {
  ensureTables,
  fetchSites,
  cleanupOldUpdates
} = require("./updates.repository");
const { siteCheckQueue } = require("../queue/siteQueue");
const {
  canSendTelegram,
  sendTelegramMessage,
  buildHeartbeatMessage,
  buildDailySummaryMessage
} = require("./telegramNotifier");

const MIN_INTERVAL = 5;
const MAX_INTERVAL = 10;
const DEFAULT_INTERVAL = 10;

function getIntervalMinutes() {
  const raw = parseInt(process.env.UPDATE_CHECK_INTERVAL_MINUTES || String(DEFAULT_INTERVAL), 10);
  if (!Number.isFinite(raw)) return DEFAULT_INTERVAL;
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, raw));
}

let isRunning = false;
let timer = null;
let isSchedulerActive = false;
let lastHeartbeatDate = "";
let lastSummaryDate = "";
let cycleCounter = 0;

const CLEANUP_DAYS = parseInt(process.env.UPDATE_RETENTION_DAYS || "30", 10);
const HIGH_PRIORITY_VALUE = parseInt(process.env.UPDATE_HIGH_PRIORITY_VALUE || "2", 10);

function getSiteCheckJobId(siteId) {
  return `site-check-${Number(siteId)}`;
}

async function enqueueSiteCheckJob(site, queuePriority) {
  const siteId = Number(site && site.id);
  const jobId = getSiteCheckJobId(siteId);
  const existingJob = await siteCheckQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState().catch(() => "unknown");
    if (["waiting", "active", "delayed", "prioritized"].includes(state)) {
      logger.info("updates: duplicate site job skipped", {
        siteId,
        siteName: site && site.name ? site.name : "unknown",
        jobId,
        state
      });
      return { skipped: true, jobId, state };
    }

    if (["completed", "failed"].includes(state)) {
      logger.info("updates: removing terminal site job before re-enqueue", {
        siteId,
        siteName: site?.name,
        jobId,
        state
      });

      await existingJob.remove();
    }
  }

  await siteCheckQueue.add(
    "check-site",
    {
      siteId: site.id,
      name: site.name,
      url: site.url,
      selector: site.selector,
      priority: Number(site.priority || 1)
    },
    {
      jobId,
      removeOnComplete: 200,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      priority: queuePriority
    }
  );

  const addedJob = await siteCheckQueue.getJob(jobId);
  const addedState = addedJob
    ? await addedJob.getState().catch(() => "unknown")
    : "missing";

  logger.info("updates: site job queued", {
    siteId,
    siteName: site?.name,
    jobId,
    state: addedState
  });

  return { skipped: false, jobId, state: "enqueued" };
}

async function maybeSendHeartbeat() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastHeartbeatDate === today) return;
  if (!canSendTelegram()) return;

  await sendTelegramMessage(buildHeartbeatMessage());
  lastHeartbeatDate = today;
  logger.info("updates: heartbeat sent", { date: today });
}

async function maybeSendDailySummary(stats) {
  const today = new Date().toISOString().slice(0, 10);
  if (lastSummaryDate === today) return;
  if (!canSendTelegram()) return;
  const msg = buildDailySummaryMessage(stats);
  await sendTelegramMessage(msg);
  lastSummaryDate = today;
  logger.info("updates: daily summary sent", { date: today, ...stats });
}

function shouldCheckSiteThisCycle(site) {
  if (!site.active) return false;
  if (site.nextRetryAt) {
    const retryAt = new Date(site.nextRetryAt);
    if (!Number.isNaN(retryAt.getTime()) && retryAt.getTime() > Date.now()) return false;
  }
  const p = Number(site.priority || 1);
  // High priority checked every cycle; normal priority every second cycle.
  if (p >= HIGH_PRIORITY_VALUE) return true;
  return cycleCounter % 2 === 0;
}

async function runOnce() {
  if (isRunning) {
    logger.warn("updates: previous cycle still running, skipping overlap");
    return;
  }

  isRunning = true;
  try {
    cycleCounter += 1;
    logger.info("updates: cycle started");
    await maybeSendHeartbeat();
    const cleanupDeleted = await cleanupOldUpdates(CLEANUP_DAYS);
    if (cleanupDeleted > 0) {
      logger.info("updates: old rows cleaned", { deleted: cleanupDeleted, retentionDays: CLEANUP_DAYS });
    }

    const sites = await fetchSites();
    logger.info("updates: loaded sites", { count: sites.length });
    const stats = { checked: 0, enqueued: 0, errors: 0 };

    for (const site of sites) {
      if (!shouldCheckSiteThisCycle(site)) continue;
      try {
        stats.checked += 1;
        const sitePriority = Number(site.priority || 1);
        const queuePriority = sitePriority >= HIGH_PRIORITY_VALUE ? 1 : 5;
        const enqueueResult = await enqueueSiteCheckJob(site, queuePriority);
        if (enqueueResult.skipped) continue;
        logger.info("updates: site enqueued", {
          siteId: site.id,
          siteName: site.name,
          queuePriority,
          jobId: enqueueResult.jobId
        });
        stats.enqueued += 1;
      } catch (siteErr) {
        stats.errors += 1;
        logger.error("updates: site enqueue failed", {
          siteId: site.id,
          siteName: site.name,
          message: siteErr && siteErr.message ? siteErr.message : String(siteErr)
        });
      }
    }
    await maybeSendDailySummary(stats);
  } catch (err) {
    logger.error("updates: cycle failed", {
      message: err && err.message ? err.message : String(err)
    });
  } finally {
    logger.info("updates: cycle finished");
    isRunning = false;
  }
}

async function startUpdateScheduler(options = {}) {
  const verifyOwnership =
    options && typeof options.verifyOwnership === "function" ? options.verifyOwnership : null;
  const onLockLost =
    options && typeof options.onLockLost === "function" ? options.onLockLost : null;
  const onStop = options && typeof options.onStop === "function" ? options.onStop : null;

  function stopScheduler(reason) {
    if (!isSchedulerActive && !timer) return;
    isSchedulerActive = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    logger.warn("updates: scheduler stopped", { reason: reason || "manual" });
    if (onStop) {
      try {
        onStop(reason || "manual");
      } catch {}
    }
  }

  async function ensureOwnershipOrStop(source) {
    if (!verifyOwnership) return true;
    try {
      const owned = await verifyOwnership();
      if (owned) return true;
      logger.warn("updates: scheduler lock lost; stopping scheduler", { source });
      stopScheduler("lock_lost");
      if (onLockLost) {
        try {
          await onLockLost();
        } catch {}
      }
      return false;
    } catch (err) {
      logger.warn("updates: ownership verification failed; stopping scheduler", {
        source,
        message: err && err.message ? err.message : String(err)
      });
      stopScheduler("ownership_check_failed");
      return false;
    }
  }

  await ensureTables();
  const intervalMinutes = getIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  isSchedulerActive = true;
  logger.info("updates: scheduler starting", {
    intervalMinutes,
    telegramConfigured: canSendTelegram()
  });

  const canRunInitialCycle = await ensureOwnershipOrStop("startup");
  if (canRunInitialCycle) {
    await runOnce();
  }

  timer = setInterval(async () => {
    if (!isSchedulerActive) return;
    const canRunCycle = await ensureOwnershipOrStop("interval");
    if (!canRunCycle) return;
    await runOnce().catch((err) => {
      logger.error("updates: unhandled runOnce error", {
        message: err && err.message ? err.message : String(err)
      });
    });
  }, intervalMs);

  return {
    stop: (reason) => stopScheduler(reason || "manual"),
    isActive: () => isSchedulerActive
  };
}

async function triggerManualUpdateCheck() {
  logger.info("updates: manual run requested");
  await runOnce();
  return { success: true };
}

module.exports = {
  startUpdateScheduler,
  triggerManualUpdateCheck
};
