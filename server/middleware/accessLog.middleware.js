const { accessLogger } = require("../utils/logger");

const isProd = process.env.NODE_ENV === "production";
const slowMs = parseInt(process.env.ACCESS_LOG_SLOW_MS || "3000", 10);

/**
 * Access log: in production only 4xx/5xx/slow requests (minimal I/O).
 */
function accessLogMiddleware(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const line = `${req.ip} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`;
    if (isProd) {
      if (res.statusCode >= 400 || ms >= slowMs) {
        accessLogger.warn(line);
      }
      return;
    }
    accessLogger.info(line);
  });
  next();
}

module.exports = accessLogMiddleware;
