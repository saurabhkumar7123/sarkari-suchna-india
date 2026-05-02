const AppError = require("../errors/AppError");
const logger = require("../utils/logger");

/**
 * Central Express error handler (JSON APIs + HTML routes).
 */
function errorHandler(err, req, res, _next) {
  if (err && err.code === "EBADCSRFTOKEN") {
    logger.warn("auth-csrf: token validation failed", {
      requestId: req.id || "",
      path: req.originalUrl,
      method: req.method
    });
    return res.status(403).json({ success: false, message: "Invalid or missing CSRF token", requestId: req.id || "" });
  }

  const status = err.statusCode || err.status || 500;
  const isApp = err instanceof AppError;

  if (status >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method, requestId: req.id || "" });
  } else {
    logger.warn(err.message, { path: req.originalUrl, method: req.method, requestId: req.id || "" });
  }

  if (req.originalUrl && req.originalUrl.split("?")[0].startsWith("/api")) {
    return res.status(status).json({
      success: false,
      requestId: req.id || "",
      message:
        process.env.NODE_ENV === "production" && !isApp && status >= 500
          ? "Internal Server Error"
          : err.message || "Server Error"
    });
  }

  return res.status(status).send(err.message || "Internal Server Error");
}

module.exports = errorHandler;
