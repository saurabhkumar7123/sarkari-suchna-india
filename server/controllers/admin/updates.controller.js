const asyncHandler = require("../../utils/asyncHandler");
const {
  fetchSites,
  createSite,
  getSiteById,
  updateSite,
  deleteSite,
  fetchRecentUpdates,
  restoreSite,
  disableSite
} = require("../../services/updates/updates.repository");
const { triggerManualUpdateCheck } = require("../../services/updates/updateScheduler");
const { sendTelegramMessage, canSendTelegram } = require("../../services/updates/telegramNotifier");
const { siteCheckQueue } = require("../../services/queue/siteQueue");
const redis = require("../../config/redis");
const logger = require("../../utils/logger");
const {
  isCurrentNodeSchedulerLeader,
  getCurrentSchedulerLockOwner
} = require("../../services/updates/schedulerLeadership");
const { recordActivity } = require("../../services/adminActivity.service");
const { isRecruitmentReadAwarenessEnabled } = require("../../config/recruitmentLifecycle");

const QUEUE_WAITING_ALERT_THRESHOLD = parseInt(process.env.QUEUE_WAITING_ALERT_THRESHOLD || "50", 10);
const QUEUE_ALERT_COOLDOWN_MINUTES = parseInt(process.env.QUEUE_ALERT_COOLDOWN_MINUTES || "15", 10);
const QUEUE_ALERT_LOCK_KEY =
  process.env.QUEUE_ALERT_LOCK_KEY || "lock:queue-backlog-telegram-alert";

function normalizePriority(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(3, Math.trunc(n)));
}

function validateSiteInput(body) {
  const name = String((body && body.name) || "").trim();
  const url = String((body && body.url) || "").trim();
  const selector = String((body && body.selector) || "").trim();
  const priority = normalizePriority(body && body.priority);

  if (!name) return { ok: false, message: "name is required" };
  if (!url) return { ok: false, message: "url is required" };
  if (!selector) return { ok: false, message: "selector is required" };
  return { ok: true, value: { name, url, selector, priority } };
}

const listSites = asyncHandler(async (req, res) => {
  const sites = await fetchSites();
  res.json({ success: true, data: sites });
});

const createSiteHandler = asyncHandler(async (req, res) => {
  const parsed = validateSiteInput(req.body || {});
  if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.message });
  const id = await createSite(parsed.value);
  const row = await getSiteById(id);
  res.status(201).json({ success: true, data: row });
});

const updateSiteHandler = asyncHandler(async (req, res) => {
  const siteId = Number(req.params.id);
  if (!Number.isFinite(siteId) || siteId <= 0) {
    return res.status(400).json({ success: false, message: "invalid site id" });
  }
  const exists = await getSiteById(siteId);
  if (!exists) return res.status(404).json({ success: false, message: "site not found" });
  const parsed = validateSiteInput(req.body || {});
  if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.message });
  await updateSite(siteId, parsed.value);
  const row = await getSiteById(siteId);
  res.json({ success: true, data: row });
});

const deleteSiteHandler = asyncHandler(async (req, res) => {
  const siteId = Number(req.params.id);
  if (!Number.isFinite(siteId) || siteId <= 0) {
    return res.status(400).json({ success: false, message: "invalid site id" });
  }
  const exists = await getSiteById(siteId);
  if (!exists) return res.status(404).json({ success: false, message: "site not found" });
  await deleteSite(siteId);
  res.json({ success: true });
});

const listRecentUpdates = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 50);
  const rows = await fetchRecentUpdates(limit, {
    includeRecruitmentLinkage: isRecruitmentReadAwarenessEnabled()
  });
  res.json({ success: true, data: rows });
});

const restoreSiteHandler = asyncHandler(async (req, res) => {
  const siteId = Number(req.params.id);
  if (!Number.isFinite(siteId) || siteId <= 0) {
    return res.status(400).json({ success: false, message: "invalid site id" });
  }
  const exists = await getSiteById(siteId);
  if (!exists) return res.status(404).json({ success: false, message: "site not found" });
  await restoreSite(siteId);
  logger.info("updates: restore API action", { siteId, by: req.user && req.user.username ? req.user.username : "admin" });
  const row = await getSiteById(siteId);
  if (canSendTelegram()) {
    try {
      await sendTelegramMessage(
        `✅ Site Restored\nSite: ${row && row.name ? row.name : "Site"}\nURL: ${row && row.url ? row.url : "N/A"}\nBy: ${req.user && req.user.username ? req.user.username : "admin"}`
      );
    } catch (err) {
      logger.warn("updates: restore telegram notify failed", {
        siteId,
        message: err && err.message ? err.message : String(err)
      });
    }
  }
  await recordActivity({
    admin: req.user && req.user.username ? req.user.username : "admin",
    action: "site_restore",
    target: String(siteId),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true, data: row });
});

const disableSiteHandler = asyncHandler(async (req, res) => {
  const siteId = Number(req.params.id);
  if (!Number.isFinite(siteId) || siteId <= 0) {
    return res.status(400).json({ success: false, message: "invalid site id" });
  }
  const exists = await getSiteById(siteId);
  if (!exists) return res.status(404).json({ success: false, message: "site not found" });
  await disableSite(siteId);
  logger.info("updates: disable API action", { siteId, by: req.user && req.user.username ? req.user.username : "admin" });
  const row = await getSiteById(siteId);
  await recordActivity({
    admin: req.user && req.user.username ? req.user.username : "admin",
    action: "site_disable",
    target: String(siteId),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true, data: row });
});

const runCheckHandler = asyncHandler(async (req, res) => {
  const requestedBy = req.user && req.user.username ? req.user.username : "admin";
  const isLeader = await isCurrentNodeSchedulerLeader();
  if (!isLeader) {
    const currentOwner = await getCurrentSchedulerLockOwner();
    logger.warn("updates: manual trigger rejected (not scheduler leader)", {
      by: requestedBy,
      currentOwner: currentOwner || null
    });
    return res.status(409).json({
      success: false,
      message: "Not scheduler leader"
    });
  }
  logger.warn("updates: manual trigger allowed (scheduler leader)", { by: requestedBy });
  logger.info("updates: run-check API action", { by: requestedBy });
  await triggerManualUpdateCheck();
  await recordActivity({
    admin: requestedBy,
    action: "run_check",
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true, message: "manual check triggered" });
});

const queueStatusHandler = asyncHandler(async (req, res) => {
  const counts = await siteCheckQueue.getJobCounts("waiting", "active", "completed", "failed");
  const waiting = Number(counts && counts.waiting ? counts.waiting : 0);
  const active = Number(counts && counts.active ? counts.active : 0);
  const completed = Number(counts && counts.completed ? counts.completed : 0);
  const failed = Number(counts && counts.failed ? counts.failed : 0);

  const cooldownSec = Math.max(1, QUEUE_ALERT_COOLDOWN_MINUTES) * 60;
  if (
    waiting > Math.max(1, QUEUE_WAITING_ALERT_THRESHOLD) &&
    canSendTelegram()
  ) {
    try {
      let shouldSend = true;
      if (redis && redis.isOpen) {
        const lockResult = await redis.set(QUEUE_ALERT_LOCK_KEY, String(Date.now()), {
          NX: true,
          EX: cooldownSec
        });
        shouldSend = lockResult === "OK";
      }

      if (shouldSend) {
        try {
          await sendTelegramMessage(
            `⚠️ Queue Backlog Alert\nQueue: site-check-queue\nWaiting: ${waiting}\nActive: ${active}\nFailed: ${failed}\nThreshold: ${QUEUE_WAITING_ALERT_THRESHOLD}`
          );
        } catch (err) {
          logger.warn("updates: queue backlog telegram alert failed", {
            message: err && err.message ? err.message : String(err)
          });
        }
      }
    } catch (err) {
      logger.warn("updates: queue backlog alert lock check failed", {
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  res.json({
    success: true,
    data: {
      waiting,
      active,
      completed,
      failed
    }
  });
});

const queueFailedHandler = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
  const sort = String(req.query.sort || "latest").toLowerCase();
  const jobs = await siteCheckQueue.getJobs(["failed"], 0, limit - 1, false);
  const rowsRaw = jobs.map((job) => ({
    id: String(job.id),
    type: String(job.name || "check-site"),
    status: "failed",
    siteName: job && job.data && (job.data.name || job.data.siteName) ? String(job.data.name || job.data.siteName) : "Unknown site",
    error: String(job.failedReason || "unknown error"),
    timestamp: job.failedOn || job.finishedOn || job.timestamp || null,
    attemptsMade: Number(job.attemptsMade || 0),
    maxAttempts: Number((job.opts && job.opts.attempts) || 0)
  }));
  const frequencyBySite = rowsRaw.reduce((acc, row) => {
    const key = row.siteName || "Unknown site";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const rows = rowsRaw.map((row) => ({
    ...row,
    failCount: Number(frequencyBySite[row.siteName] || 1)
  }));
  if (sort === "frequent") {
    rows.sort((a, b) => {
      if (b.failCount !== a.failCount) return b.failCount - a.failCount;
      return Number(b.timestamp || 0) - Number(a.timestamp || 0);
    });
  } else {
    rows.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  }
  res.json({ success: true, data: rows });
});

const queueRetryHandler = asyncHandler(async (req, res) => {
  const jobs = await siteCheckQueue.getJobs(["failed"], 0, 999, false);
  let retried = 0;
  for (const job of jobs) {
    try {
      await job.retry();
      retried += 1;
    } catch (err) {
      logger.warn("updates: queue retry failed for job", {
        jobId: job && job.id ? String(job.id) : null,
        message: err && err.message ? err.message : String(err)
      });
    }
  }
  await recordActivity({
    admin: req.user && req.user.username ? req.user.username : "admin",
    action: "queue_retry_all",
    target: String(retried),
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true, data: { retried } });
});

const queueRetryOneHandler = asyncHandler(async (req, res) => {
  const jobId = String(req.params.id || "").trim();
  if (!jobId) {
    return res.status(400).json({ success: false, message: "invalid job id" });
  }
  const job = await siteCheckQueue.getJob(jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: "job not found" });
  }
  try {
    await job.retry();
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "queue_retry_one",
      target: jobId,
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});
    return res.json({ success: true, data: { retried: 1, jobId } });
  } catch (err) {
    logger.warn("updates: queue retry failed for single job", {
      jobId,
      message: err && err.message ? err.message : String(err)
    });
    return res.status(409).json({ success: false, message: "retry failed", data: { jobId } });
  }
});

const queueClearHandler = asyncHandler(async (req, res) => {
  await siteCheckQueue.drain(true);
  const cleanedFailed = await siteCheckQueue.clean(0, 10000, "failed");
  const cleanedWaiting = await siteCheckQueue.clean(0, 10000, "wait");
  await recordActivity({
    admin: req.user && req.user.username ? req.user.username : "admin",
    action: "queue_clear",
    target: `${Array.isArray(cleanedWaiting) ? cleanedWaiting.length : 0}/${Array.isArray(cleanedFailed) ? cleanedFailed.length : 0}`,
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({
    success: true,
    data: {
      clearedWaiting: Array.isArray(cleanedWaiting) ? cleanedWaiting.length : 0,
      clearedFailed: Array.isArray(cleanedFailed) ? cleanedFailed.length : 0
    }
  });
});

module.exports = {
  listSites,
  createSiteHandler,
  updateSiteHandler,
  deleteSiteHandler,
  listRecentUpdates,
  restoreSiteHandler,
  disableSiteHandler,
  runCheckHandler,
  queueStatusHandler,
  queueFailedHandler,
  queueRetryHandler,
  queueRetryOneHandler,
  queueClearHandler
};
