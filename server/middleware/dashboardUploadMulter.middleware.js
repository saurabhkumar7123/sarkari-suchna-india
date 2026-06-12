/**
 * Dashboard upload: wraps multer for POST /api/admin/pdf with JSON error responses.
 */
const multer = require("multer");
const logger = require("../utils/logger");
const { MAX_UPLOAD_MB, MAX_UPLOAD_BYTES } = require("../config/uploadLimits");

const MSG_FILE_TOO_LARGE = `File exceeds maximum upload size (${MAX_UPLOAD_MB} MB)`;
const MSG_INVALID_TYPE = "Only PDF, JPG, JPEG and PNG files are allowed";

function isMulterLimitSize(err) {
  return (
    (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") ||
    (err && err.code === "LIMIT_FILE_SIZE")
  );
}

function jsonUploadError(res, status, message, extra = {}) {
  return res.status(status).json({
    success: false,
    message,
    error: message,
    ...extra
  });
}

function dashboardUploadMulter(upload) {
  return function dashboardUploadMulterMiddleware(req, res, next) {
    const run = upload.single("pdf");
    run(req, res, (err) => {
      if (!err) return next();

      const logPayload = {
        multerCode: err.code,
        multerMessage: err.message,
        multerField: err.field,
        contentLengthHeader: req.headers["content-length"],
        isMulterError: err instanceof multer.MulterError,
        path: req.originalUrl
      };

      if (isMulterLimitSize(err)) {
        logger.warn("dashboard upload multer: LIMIT_FILE_SIZE", logPayload);
        return jsonUploadError(res, 413, MSG_FILE_TOO_LARGE, {
          code: "LIMIT_FILE_SIZE",
          limitMb: MAX_UPLOAD_MB,
          limitBytes: MAX_UPLOAD_BYTES
        });
      }

      logger.warn("dashboard upload multer: other error", logPayload);

      if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
        return jsonUploadError(res, 400, MSG_INVALID_TYPE, { code: err.code });
      }

      const msg = String(err.message || "");
      if (msg.includes("Only PDF") || msg.includes("PNG")) {
        return jsonUploadError(res, 400, MSG_INVALID_TYPE, {
          code: err.code || "INVALID_FILE_TYPE"
        });
      }

      return jsonUploadError(res, 400, msg || "Upload failed", {
        code: err.code || "MULTER_ERROR"
      });
    });
  };
}

module.exports = dashboardUploadMulter;
module.exports.MSG_FILE_TOO_LARGE = MSG_FILE_TOO_LARGE;
module.exports.MSG_INVALID_TYPE = MSG_INVALID_TYPE;
