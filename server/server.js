require("dotenv").config();

/* Production: silence console noise; keep error + warn. */
if (process.env.NODE_ENV === "production") {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.trace = () => {};
}

const logger = require("./utils/logger");
const redisClient = require("./config/redis");
const { ensureRedis } = require("./config/redis");
const db = require("./config/db");
const { ensureSitemapExists } = require("./lib/sitemapGenerator");
const { startUpdateScheduler } = require("./services/updates/updateScheduler");
const {
  SCHEDULER_LOCK_KEY,
  schedulerLockOwner,
  isCurrentNodeSchedulerLeader,
  getCurrentSchedulerLockOwner
} = require("./services/updates/schedulerLeadership");
const { sendTelegramMessage } = require("./services/updates/telegramNotifier");
const SCHEDULER_LOCK_TTL_SECONDS = Math.max(60, parseInt(process.env.SCHEDULER_LOCK_TTL_SECONDS || "600", 10));
let schedulerLockRefreshTimer = null;
let schedulerController = null;
let isSchedulerActive = false;
let httpServer = null;
let shuttingDown = false;
const isProd = process.env.NODE_ENV === "production";

function assertCriticalAuthSecrets() {
  if (process.env.NODE_ENV === "test") return;
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  const adminUser = String(process.env.ADMIN_USER || "").trim();
  const adminPassHash = String(process.env.ADMIN_PASS_HASH || "").trim();
  if (!jwtSecret || jwtSecret.length < 64 || /change_me|default|example/i.test(jwtSecret)) {
    throw new Error("Missing or weak JWT_SECRET; refusing to start");
  }
  if (!adminUser || /^(admin|root)$/i.test(adminUser) === false && adminUser.length < 3) {
    throw new Error("Missing or invalid ADMIN_USER; refusing to start");
  }
  if (!adminPassHash || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminPassHash)) {
    throw new Error("Missing or invalid ADMIN_PASS_HASH; refusing to start");
  }
}

function assertRedisAvailableForCriticalServices() {
  if (redisClient && redisClient.isOpen) return;
  logger.error("critical Redis dependency unavailable", {
    env: process.env.NODE_ENV || "undefined"
  });
  const err = new Error("Redis unavailable for critical services");
  err.code = "REDIS_CRITICAL_UNAVAILABLE";
  throw err;
}

async function tryStartSchedulerWithLock() {
  if (!redisClient || !redisClient.isOpen) {
    logger.error("updates: scheduler blocked; Redis unavailable");
    if (isProd) {
      throw Object.assign(new Error("Redis unavailable; scheduler start blocked"), {
        code: "REDIS_CRITICAL_UNAVAILABLE"
      });
    }
    return null;
  }

  const acquired = await redisClient.set(SCHEDULER_LOCK_KEY, schedulerLockOwner, {
    NX: true,
    EX: SCHEDULER_LOCK_TTL_SECONDS
  });

  if (acquired !== "OK") {
    logger.warn("updates: scheduler blocked (lock not acquired)", {
      key: SCHEDULER_LOCK_KEY,
      owner: schedulerLockOwner
    });
    return null;
  }

  logger.warn("updates: scheduler started", {
    key: SCHEDULER_LOCK_KEY,
    owner: schedulerLockOwner
  });

  const stopSchedulerLifecycle = (reason) => {
    if (schedulerController && typeof schedulerController.stop === "function") {
      schedulerController.stop(reason || "manual");
    }
    schedulerController = null;
    isSchedulerActive = false;
  };

  // Keep extending lock to prevent expiry while this process is healthy.
  schedulerLockRefreshTimer = setInterval(async () => {
    try {
      const currentOwner = await getCurrentSchedulerLockOwner();
      if (currentOwner !== schedulerLockOwner) {
        logger.warn("updates: scheduler lock lost", {
          key: SCHEDULER_LOCK_KEY,
          previousOwner: schedulerLockOwner,
          currentOwner: currentOwner || null
        });
        stopSchedulerLifecycle("lock_lost");
        clearInterval(schedulerLockRefreshTimer);
        schedulerLockRefreshTimer = null;
        return;
      }
      await redisClient.set(SCHEDULER_LOCK_KEY, schedulerLockOwner, {
        XX: true,
        EX: SCHEDULER_LOCK_TTL_SECONDS
      });
    } catch (err) {
      logger.warn("updates: scheduler lock refresh failed", {
        message: err && err.message ? err.message : String(err)
      });
    }
  }, Math.max(15000, Math.floor((SCHEDULER_LOCK_TTL_SECONDS * 1000) / 3)));

  schedulerController = await startUpdateScheduler({
    verifyOwnership: isCurrentNodeSchedulerLeader,
    onLockLost: async () => {
      isSchedulerActive = false;
      if (schedulerLockRefreshTimer) {
        clearInterval(schedulerLockRefreshTimer);
        schedulerLockRefreshTimer = null;
      }
    },
    onStop: (reason) => {
      isSchedulerActive = false;
      logger.warn("updates: scheduler lifecycle stopped", { reason: reason || "manual" });
    }
  });
  isSchedulerActive = Boolean(schedulerController && schedulerController.isActive && schedulerController.isActive());
  return schedulerController;
}

async function releaseSchedulerLockIfOwned() {
  try {
    if (!redisClient || !redisClient.isOpen) return;
    const currentOwner = await redisClient.get(SCHEDULER_LOCK_KEY);
    if (currentOwner === schedulerLockOwner) {
      await redisClient.del(SCHEDULER_LOCK_KEY);
      logger.warn("updates: scheduler lock released", { key: SCHEDULER_LOCK_KEY });
    }
  } catch (err) {
    logger.warn("updates: scheduler lock release failed", {
      message: err && err.message ? err.message : String(err)
    });
  }
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT", { exitCode: 0 });
});
process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM", { exitCode: 0 });
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  gracefulShutdown("unhandledRejection", { exitCode: 1 });
});

process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { message: err.message, stack: err.stack });
  gracefulShutdown("uncaughtException", { exitCode: 1 });
});

async function gracefulShutdown(signal, { exitCode = 0 } = {}) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn("graceful shutdown started", { signal, exitCode });

  try {
    if (schedulerController && typeof schedulerController.stop === "function") {
      schedulerController.stop("shutdown");
    }
    schedulerController = null;
    isSchedulerActive = false;
    if (schedulerLockRefreshTimer) {
      clearInterval(schedulerLockRefreshTimer);
      schedulerLockRefreshTimer = null;
    }
  } catch {}

  await releaseSchedulerLockIfOwned().catch(() => {});

  try {
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
      logger.warn("HTTP server closed");
    }
  } catch (err) {
    logger.warn("HTTP server close failed", {
      message: err && err.message ? err.message : String(err)
    });
  }

  try {
    if (db && typeof db.end === "function") {
      await db.end();
      logger.warn("DB pool closed");
    }
  } catch (err) {
    logger.warn("DB pool close failed", {
      message: err && err.message ? err.message : String(err)
    });
  }

  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.warn("Redis client closed");
    }
  } catch (err) {
    logger.warn("Redis close failed", {
      message: err && err.message ? err.message : String(err)
    });
  }

  process.exit(exitCode);
}

(async () => {
  assertCriticalAuthSecrets();
  await ensureRedis();
  if (isProd) {
    assertRedisAvailableForCriticalServices();
  }

  await ensureSitemapExists(db).catch((e) => {
    logger.warn("ensureSitemapExists", { message: e.message });
  });

  const app = require("./app");

  try {
    await db.query("SELECT 1");
    logger.info("MySQL reachable at startup");
  } catch (err) {
    logger.warn("MySQL unavailable at startup — DB-dependent APIs will return 503 until recovery", {
      error: err.message
    });
  }

  const PORT = parseInt(process.env.PORT || "3000", 10);
  const bindHostRaw = String(process.env.BIND_HOST || "").trim();
  const host = !bindHostRaw || bindHostRaw === "localhost" || bindHostRaw === "127.0.0.1" ? "0.0.0.0" : bindHostRaw;
  if (host === "0.0.0.0") {
    logger.info("Network binding enabled for LAN access (0.0.0.0)");
  }

  const server = app.listen(PORT, host, () => {
    logger.info(`Server listening on http://${host}:${PORT}`, { env: process.env.NODE_ENV || "undefined" });
  });
  httpServer = server;

  server.on("error", (err) => {
    logger.error("HTTP server error", { message: err.message });
  });

  // Temporary connectivity probe for Telegram delivery path.
  await sendTelegramMessage("TEST MESSAGE FROM BOT").catch((err) => {
    console.warn("Telegram startup test failed", err && err.message ? err.message : String(err));
  });

  tryStartSchedulerWithLock().catch((err) => {
    if (err && err.code === "REDIS_CRITICAL_UNAVAILABLE") {
      logger.error("updates: scheduler startup aborted due to Redis dependency", {
        message: err.message
      });
      gracefulShutdown("redis_unavailable", { exitCode: 1 });
      return;
    }
    logger.error("updates: scheduler startup failed", {
      message: err && err.message ? err.message : String(err)
    });
  });
})().catch((e) => {
  logger.error("Fatal startup error", { stack: e.stack });
  process.exit(1);
});
