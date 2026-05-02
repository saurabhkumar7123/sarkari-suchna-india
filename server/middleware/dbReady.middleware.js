const dbHealth = require("../lib/dbHealth");
const logger = require("../utils/logger");

/**
 * Returns 503 JSON when MySQL is unreachable (cached ping).
 */
async function requireDb(req, res, next) {
  try {
    const ok = await dbHealth.isUp();
    if (ok) return next();
    logger.warn("Database unavailable for request", { path: req.originalUrl });
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again in a moment."
    });
  } catch (e) {
    logger.error("DB health check failed", { error: e.message });
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable."
    });
  }
}

module.exports = requireDb;
