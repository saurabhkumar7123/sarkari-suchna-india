require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });

const { Worker } = require("bullmq");
const logger = require("../../utils/logger");
const { queueConnection } = require("../queue/siteQueue");
const { checkSite } = require("../updates/siteChecker");
const { extractGeneratorPdfText } = require("../pdfGeneratorExtract.service");
const fileService = require("../file.service");
const {
  getSiteById,
  insertDetectedUpdate,
  saveSiteBaseline,
  markSiteChecked,
  hasRecentDuplicate,
  markAlertSent,
  isInCooldown,
  incrementSiteFailure,
  resetSiteFailure
} = require("../updates/updates.repository");
const {
  sendTelegramMessage,
  buildUpdateMessage,
  buildSelectorIssueMessage,
  buildBatchUpdateMessage,
  buildPreDisableWarningMessage
} = require("../updates/telegramNotifier");

const COOLDOWN_MINUTES = parseInt(process.env.UPDATE_ALERT_COOLDOWN_MINUTES || "10", 10);
const FAIL_DISABLE_THRESHOLD = 5;
const WORKER_CONCURRENCY = parseInt(process.env.UPDATE_WORKER_CONCURRENCY || "5", 10);
const HEAVY_TASK_CONCURRENCY = parseInt(process.env.HEAVY_TASK_WORKER_CONCURRENCY || "2", 10);

function isImportantUpdate(title) {
  const t = String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return /\bresult(?:s)?\b|\badmit(?:\s+card)?\b|\banswer\s+key\b|\brecruit(?:ment)?\b/i.test(t);
}

async function processSiteJob(job) {
  const jobData = job && job.data ? job.data : {};
  const siteId = Number(jobData.siteId);
  if (!Number.isFinite(siteId) || siteId <= 0) {
    throw new Error("invalid siteId in queue job");
  }

  const row = await getSiteById(siteId);
  if (!row) {
    throw new Error(`monitored site not found: ${siteId}`);
  }

  if (Number(row.active) !== 1) {
    logger.info("updates-worker: skip inactive site", { siteId, siteName: row.name });
    return { skipped: true, reason: "inactive" };
  }

  const site = {
    id: row.id,
    name: row.name,
    url: row.url,
    selector: row.selector,
    lastContent: row.lastContent,
    lastAlertAt: row.lastAlertAt,
    failCount: row.failCount,
    broken: row.broken,
    priority: row.priority,
    active: row.active
  };

  logger.info("updates-worker: job start", {
    jobId: job.id,
    siteId,
    siteName: site.name,
    hasBaseline: Boolean(String(site.lastContent || "").trim())
  });

  try {
    const result = await checkSite(site);

    if (result && result.invalid) {
      await markSiteChecked(siteId).catch(() => null);
      const failure = await incrementSiteFailure(siteId);
      if (failure.shouldWarn && !(await isInCooldown(siteId, COOLDOWN_MINUTES))) {
        await sendTelegramMessage(
          buildPreDisableWarningMessage({
            siteName: site.name,
            failCount: failure.next,
            threshold: FAIL_DISABLE_THRESHOLD
          })
        );
        await markAlertSent(siteId);
      }
      if (!(await isInCooldown(siteId, COOLDOWN_MINUTES))) {
        await sendTelegramMessage(
          buildSelectorIssueMessage({
            siteName: site.name,
            siteUrl: site.url,
            selector: site.selector,
            reason: result.reason
          })
        );
        await markAlertSent(siteId);
      }
      logger.info("updates-worker: check failed", { siteId, reason: result.reason });
      return { changed: false, invalid: true, reason: result.reason };
    }

    if (result && result.establishBaseline) {
      await saveSiteBaseline(siteId, result.baselineFingerprint || "");
      await resetSiteFailure(siteId);
      logger.info("updates-worker: baseline stored (no alert)", {
        siteId,
        siteName: site.name
      });
      return { baseline: true };
    }

    await markSiteChecked(siteId);
    await resetSiteFailure(siteId);

    if (!result || !result.changed) {
      logger.info("updates-worker: no changes", { siteId, reason: result && result.reason });
      return { changed: false, reason: result && result.reason };
    }

    if (!result.shouldNotify) {
      if (result.baselineFingerprint) {
        await saveSiteBaseline(siteId, result.baselineFingerprint);
      }
      logger.info("updates-worker: change ignored by filter", {
        siteId,
        reason: result.reason
      });
      return { changed: false, filtered: true };
    }

    if (await isInCooldown(siteId, COOLDOWN_MINUTES)) {
      logger.info("updates-worker: cooldown suppress", { siteId });
      return { changed: false, cooldown: true };
    }

    const newItems = Array.isArray(result.items) ? result.items : [];
    const pendingBatch = [];
    let savedCount = 0;
    for (const item of newItems) {
      const duplicate = await hasRecentDuplicate({
        siteId,
        title: item.title || "New update",
        link: item.link || ""
      });
      if (duplicate) {
        logger.info("updates-worker: duplicate suppressed", { siteId, title: item.title });
        continue;
      }

      await insertDetectedUpdate({
        siteId,
        title: item.title || "New update",
        link: item.link || ""
      });
      pendingBatch.push({
        siteName: site.name,
        title: item.title,
        link: item.link,
        important: isImportantUpdate(item.title)
      });
      savedCount += 1;
    }

    if (!savedCount) {
      logger.info("updates-worker: no savable items", { siteId });
      return { changed: false, duplicatesOnly: true };
    }

    if (result.baselineFingerprint) {
      await saveSiteBaseline(siteId, result.baselineFingerprint);
    }
    await markAlertSent(siteId);

    if (pendingBatch.length === 1) {
      await sendTelegramMessage(buildUpdateMessage(pendingBatch[0]));
    } else if (pendingBatch.length > 1) {
      await sendTelegramMessage(buildBatchUpdateMessage(pendingBatch));
    }

    logger.info("updates-worker: update alert sent", {
      jobId: job.id,
      siteId,
      savedCount
    });
    return { changed: true, savedCount };
  } catch (err) {
    await markSiteChecked(siteId).catch(() => null);
    const failure = await incrementSiteFailure(siteId).catch(() => null);
    if (failure && failure.shouldWarn && !(await isInCooldown(siteId, COOLDOWN_MINUTES))) {
      await sendTelegramMessage(
        buildPreDisableWarningMessage({
          siteName: site.name,
          failCount: failure.next,
          threshold: FAIL_DISABLE_THRESHOLD
        })
      ).catch(() => null);
      await markAlertSent(siteId).catch(() => null);
    }

    logger.error("updates-worker: job failed", {
      jobId: job.id,
      siteId,
      message: err && err.message ? err.message : String(err)
    });
    throw err;
  }
}

const siteWorker = new Worker("site-check-queue", processSiteJob, {
  connection: queueConnection,
  concurrency: Number.isFinite(WORKER_CONCURRENCY) && WORKER_CONCURRENCY > 0 ? WORKER_CONCURRENCY : 5
});

async function processHeavyTaskJob(job) {
  if (!job || job.name !== "pdf-extract") {
    throw new Error("unsupported heavy task job");
  }
  const data = job.data || {};
  const filePath = String(data.filePath || "");
  if (!filePath) throw new Error("missing file path");

  logger.info("heavy-worker: job start", {
    jobId: job.id,
    type: job.name,
    filePath
  });

  try {
    const dataBuffer = await fileService.readFile(filePath);
    const result = await extractGeneratorPdfText(dataBuffer);
    logger.info("heavy-worker: job success", {
      jobId: job.id,
      textLen: String(result && result.text ? result.text : "").length
    });
    return {
      text: String(result && result.text ? result.text : ""),
      extractionNote: result && result.extractionNote ? result.extractionNote : undefined
    };
  } finally {
    if (filePath) {
      await fileService.unlink(filePath).catch(() => {});
    }
  }
}

const heavyTaskWorker = new Worker("heavy-task-queue", processHeavyTaskJob, {
  connection: queueConnection,
  concurrency: Number.isFinite(HEAVY_TASK_CONCURRENCY) && HEAVY_TASK_CONCURRENCY > 0 ? HEAVY_TASK_CONCURRENCY : 2
});

siteWorker.on("completed", (job, result) => {
  logger.info("updates-worker: completed", {
    jobId: job && job.id,
    siteId: job && job.data ? job.data.siteId : null,
    outcome: result && typeof result === "object" ? result.reason || (result.baseline ? "baseline" : result.changed ? "changed" : "ok") : "ok"
  });
});

siteWorker.on("failed", (job, err) => {
  logger.error("updates-worker: failed", {
    jobId: job && job.id,
    siteId: job && job.data ? job.data.siteId : null,
    message: err && err.message ? err.message : String(err)
  });
});

heavyTaskWorker.on("completed", (job) => {
  logger.info("heavy-worker: completed", { jobId: job.id, type: job.name });
});

heavyTaskWorker.on("failed", (job, err) => {
  logger.error("heavy-worker: failed", {
    jobId: job && job.id,
    type: job && job.name ? job.name : null,
    message: err && err.message ? err.message : String(err)
  });
});

logger.info("updates-worker: ready", {
  queue: "site-check-queue",
  concurrency: Number.isFinite(WORKER_CONCURRENCY) && WORKER_CONCURRENCY > 0 ? WORKER_CONCURRENCY : 5,
  pid: process.pid
});
logger.info("heavy-worker: ready", {
  queue: "heavy-task-queue",
  concurrency:
    Number.isFinite(HEAVY_TASK_CONCURRENCY) && HEAVY_TASK_CONCURRENCY > 0 ? HEAVY_TASK_CONCURRENCY : 2
});

module.exports = {
  siteWorker,
  processSiteJob,
  heavyTaskWorker,
  processHeavyTaskJob
};
