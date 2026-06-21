"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const dbHealth = require("../../lib/dbHealth");
const redis = require("../../config/redis");
const { siteCheckQueue } = require("../../services/queue/siteQueue");
const { canSendTelegram } = require("../../services/updates/telegramNotifier");

async function getUploadsDiskInfo() {
  const uploadsRoot = path.join(process.cwd(), "storage", "uploads");
  const exists = fs.existsSync(uploadsRoot);
  let pdfCount = 0;
  let imageCount = 0;
  if (exists) {
    try {
      const [pdfs, imgs] = await Promise.all([
        fs.promises.readdir(path.join(uploadsRoot, "pdf")).catch(() => []),
        fs.promises.readdir(path.join(uploadsRoot, "images")).catch(() => [])
      ]);
      pdfCount = Array.isArray(pdfs) ? pdfs.length : 0;
      imageCount = Array.isArray(imgs) ? imgs.length : 0;
    } catch {
      /* ignore */
    }
  }
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  return {
    uploadsDirExists: exists,
    pdfCount,
    imageCount,
    memoryFreeMb: Math.round(freeMem / (1024 * 1024)),
    memoryTotalMb: Math.round(totalMem / (1024 * 1024)),
    memoryUsedPct: totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0
  };
}

const getSystemHealth = async (req, res) => {
  try {
    const dbOk = await dbHealth.isUp(true);
    const redisOk = process.env.NODE_ENV === "test" ? true : Boolean(redis.isOpen);

    let queue = { waiting: 0, active: 0, failed: 0, completed: 0 };
    try {
      const counts = await siteCheckQueue.getJobCounts("waiting", "active", "completed", "failed");
      queue = {
        waiting: Number(counts.waiting) || 0,
        active: Number(counts.active) || 0,
        failed: Number(counts.failed) || 0,
        completed: Number(counts.completed) || 0
      };
    } catch {
      /* queue unavailable */
    }

    const disk = await getUploadsDiskInfo();
    const telegramConfigured = canSendTelegram();

    return res.json({
      success: true,
      data: {
        database: dbOk,
        redis: redisOk,
        queue,
        disk,
        telegram: {
          configured: telegramConfigured,
          ok: telegramConfigured
        },
        process: {
          uptimeSec: Math.floor(process.uptime()),
          pid: process.pid,
          env: process.env.NODE_ENV || "development",
          pm2App: String(process.env.name || process.env.PM2_APP_NAME || "").trim() || null
        },
        overall:
          dbOk && redisOk && queue.failed === 0
            ? "healthy"
            : !dbOk || !redisOk
              ? "critical"
              : "degraded",
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("system-health:", err);
    return res.status(500).json({ success: false });
  }
};

module.exports = { getSystemHealth };
