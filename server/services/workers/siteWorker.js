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
  findDuplicateUpdate,
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
const { isRecruitmentPipelineEnabled } = require("../../config/recruitmentPipeline");
const { getAutomationFlags } = require("../../config/automationFlags");
const {
  runProductionDetectionPipeline,
  isProductionRuntimeEnabled
} = require("../../lib/recruitment/productionRuntime");
const { canRunAutomationWorkers } = require("../../config/automationFlags");
const { isApprovedOfficialMonitoringUrl } = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");
const {
  lookupRecruitmentCandidatesForRuntime
} = require("../recruitmentCandidateLookup.service");

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

async function runAmp4bForNotice({
  site,
  siteId,
  notice,
  updateId,
  revisionCheck = false,
  existingDocumentHash = null
}) {
  let candidateRecruitments = [];
  let lookupSummary = {
    status: "skipped",
    strategy: "insufficient_criteria",
    candidateCount: 0
  };
  try {
    const lookup = await lookupRecruitmentCandidatesForRuntime({ notice });
    candidateRecruitments = Array.isArray(lookup.candidates) ? lookup.candidates : [];
    lookupSummary = lookup.lookupSummary || lookupSummary;
    if (lookupSummary.status === "failed") {
      logger.warn("updates-worker: recruitment candidate lookup failed", {
        siteId,
        strategy: lookupSummary.strategy,
        message: lookupSummary.message
      });
    }
  } catch (lookupErr) {
    candidateRecruitments = [];
    lookupSummary = {
      status: "failed",
      strategy: "lookup_error",
      candidateCount: 0,
      message: lookupErr && lookupErr.message ? lookupErr.message : String(lookupErr)
    };
    logger.warn("updates-worker: recruitment candidate lookup failed", {
      siteId,
      message: lookupSummary.message
    });
  }

  if (!isProductionRuntimeEnabled()) {
    logger.info("updates-worker: recruitment pipeline skipped — production runtime flags off", {
      siteId,
      updateId,
      flags: getAutomationFlags()
    });
    return null;
  }

  try {
    const productionOutcome = await runProductionDetectionPipeline({
      notice,
      updateId,
      candidateRecruitments,
      lookupSummary,
      monitoredSite: {
        id: siteId,
        name: site && site.name ? site.name : null,
        url: site && site.url ? site.url : null
      },
      revisionCheck,
      existingDocumentHash,
      existingSiteId: siteId
    });
    logger.info("updates-worker: production runtime completed", {
      siteId,
      updateId,
      revisionCheck,
      success: productionOutcome.success === true,
      skipped: productionOutcome.skipped === true,
      duplicate: productionOutcome.duplicate === true,
      recruitmentId: productionOutcome.recruitmentId || null
    });
    return productionOutcome;
  } catch (runtimeErr) {
    logger.error("updates-worker: production runtime failed", {
      siteId,
      updateId,
      message: runtimeErr && runtimeErr.message ? runtimeErr.message : String(runtimeErr)
    });
    return {
      skipped: false,
      failed: true,
      error: runtimeErr && runtimeErr.message ? runtimeErr.message : String(runtimeErr)
    };
  }
}

async function processSiteJob(job) {
  if (!canRunAutomationWorkers()) {
    logger.warn("updates-worker: job skipped by automation flags", {
      jobId: job && job.id ? job.id : null
    });
    return { skipped: true, reason: "flag_disabled" };
  }
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

  if (!isApprovedOfficialMonitoringUrl(row.url)) {
    logger.warn("updates-worker: job skipped; not an approved official source", {
      jobId: job && job.id ? job.id : null,
      siteId,
      siteName: row.name,
      url: row.url
    });
    return { skipped: true, reason: "unapproved_source" };
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
    logger.warn("updates-worker: check result", {
      siteId,
      siteName: site.name,
      changed: Boolean(result && result.changed),
      reason: result && result.reason ? result.reason : null,
      invalid: Boolean(result && result.invalid),
      establishBaseline: Boolean(result && result.establishBaseline)
    });

    if (result && result.invalid) {
      await markSiteChecked(siteId).catch(() => null);
      const failure = await incrementSiteFailure(siteId);
      if (failure.shouldWarn && !(await isInCooldown(siteId, COOLDOWN_MINUTES))) {
        const tg = await sendTelegramMessage(
          buildPreDisableWarningMessage({
            siteName: site.name,
            failCount: failure.next,
            threshold: FAIL_DISABLE_THRESHOLD
          })
        );
        if (tg && tg.sent === true) {
          await markAlertSent(siteId);
        }
      }
      if (!(await isInCooldown(siteId, COOLDOWN_MINUTES))) {
        const tg = await sendTelegramMessage(
          buildSelectorIssueMessage({
            siteName: site.name,
            siteUrl: site.url,
            selector: site.selector,
            reason: result.reason
          })
        );
        if (tg && tg.sent === true) {
          await markAlertSent(siteId);
        }
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
    const revisionCandidates = [];
    let savedCount = 0;
    const recruitmentPipelineEnabled = isRecruitmentPipelineEnabled();
    const runtimeOn = isProductionRuntimeEnabled();

    for (const item of newItems) {
      const title = item.title || "New update";
      const link = item.link || "";
      let existing = null;
      if (typeof findDuplicateUpdate === "function") {
        existing = await findDuplicateUpdate({
          siteId,
          title,
          link
        });
      } else if (await hasRecentDuplicate({ siteId, title, link })) {
        existing = { skipRevision: true };
      }

      if (existing) {
        if (!existing.skipRevision && existing.id && recruitmentPipelineEnabled && runtimeOn) {
          revisionCandidates.push({
            title,
            link,
            existing
          });
        } else {
          logger.info("updates-worker: duplicate suppressed", { siteId, title });
        }
        continue;
      }

      pendingBatch.push({
        siteName: site.name,
        title,
        link,
        important: isImportantUpdate(title)
      });
      savedCount += 1;
    }

    if (!savedCount && revisionCandidates.length === 0) {
      logger.info("updates-worker: no savable items", { siteId });
      return { changed: false, duplicatesOnly: true };
    }

    // Best-effort update alert. Telegram failure/skip must NOT discard detected
    // updates or skip AMP-4B productionRuntime (AMP-4B staging activation).
    let telegramResult = { sent: false, skipped: true, reason: "no_new_listing" };
    if (savedCount > 0) {
      try {
        if (pendingBatch.length === 1) {
          telegramResult = await sendTelegramMessage(buildUpdateMessage(pendingBatch[0]));
        } else {
          telegramResult = await sendTelegramMessage(buildBatchUpdateMessage(pendingBatch));
        }
      } catch (telegramErr) {
        telegramResult = {
          sent: false,
          error: telegramErr,
          reason: telegramErr && telegramErr.message ? telegramErr.message : String(telegramErr)
        };
        logger.warn("updates-worker: telegram alert threw; continuing pipeline", {
          siteId,
          message: telegramResult.reason
        });
      }
    }

    const telegramSent = Boolean(telegramResult && telegramResult.sent === true);
    if (savedCount > 0 && !telegramSent) {
      logger.warn("updates-worker: telegram alert failed/skipped; persisting update and continuing runtime", {
        siteId,
        skipped: Boolean(telegramResult && telegramResult.skipped),
        reason: telegramResult && telegramResult.reason ? telegramResult.reason : null
      });
    }

    const productionOutcomes = [];

    for (const item of pendingBatch) {
      const updateId = await insertDetectedUpdate({
        siteId,
        title: item.title || "New update",
        link: item.link || ""
      });

      if (recruitmentPipelineEnabled) {
        const notice = {
          title: item.title || "New update",
          content: item.title || "New update",
          url: item.link || ""
        };
        const productionOutcome = await runAmp4bForNotice({
          site,
          siteId,
          notice,
          updateId
        });
        if (productionOutcome) productionOutcomes.push(productionOutcome);
      }
    }

    if (recruitmentPipelineEnabled && runtimeOn) {
      for (const item of revisionCandidates) {
        const notice = {
          title: item.title || "New update",
          content: item.title || "New update",
          url: item.link || ""
        };
        const productionOutcome = await runAmp4bForNotice({
          site,
          siteId,
          notice,
          updateId: item.existing.id,
          revisionCheck: true,
          existingDocumentHash: item.existing.documentHash || item.existing.document_hash || null
        });
        if (productionOutcome) productionOutcomes.push(productionOutcome);
      }
    }

    // Advance baseline after persistence so detections are not lost or infinitely re-queued.
    // Alert cooldown marker is only set when the update alert actually delivered.
    if (result.baselineFingerprint) {
      await saveSiteBaseline(siteId, result.baselineFingerprint);
    }
    if (telegramSent) {
      await markAlertSent(siteId);
    }

    logger.info("updates-worker: update processed", {
      jobId: job.id,
      siteId,
      savedCount,
      telegramSent,
      pipelineContinued: true
    });
    return {
      changed: true,
      savedCount,
      telegramSent,
      telegramFailed: !telegramSent,
      pipelineContinued: true,
      productionOutcomeCount: productionOutcomes.length
    };
  } catch (err) {
    await markSiteChecked(siteId).catch(() => null);
    const failure = await incrementSiteFailure(siteId).catch(() => null);
    if (failure && failure.shouldWarn && !(await isInCooldown(siteId, COOLDOWN_MINUTES))) {
      const tg = await sendTelegramMessage(
        buildPreDisableWarningMessage({
          siteName: site.name,
          failCount: failure.next,
          threshold: FAIL_DISABLE_THRESHOLD
        })
      ).catch(() => null);
      if (tg && tg.sent === true) {
        await markAlertSent(siteId).catch(() => null);
      }
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
