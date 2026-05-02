const express = require("express");
const router = express.Router();

const dbHealth = require("../lib/dbHealth");
const redis = require("../config/redis");

/**
 * Liveness — process is up (load balancers / K8s).
 */
router.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness — critical dependencies reachable.
 */
router.get("/ready", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const dbOk = await dbHealth.isUp(true);
  const redisOk = process.env.NODE_ENV === "test" ? true : redis.isOpen;
  if (!dbOk || !redisOk) {
    return res.status(503).json({
      status: "not_ready",
      database: dbOk,
      redis: redisOk
    });
  }
  res.json({
    status: "ready",
    database: true,
    redis: redisOk
  });
});

module.exports = router;
