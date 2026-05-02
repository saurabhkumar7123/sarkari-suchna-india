/**
 * Generator-only: wraps multer for /api/admin/pdf/extract so multer errors return
 * JSON { error, text, ... } instead of HTML / generic API shape.
 * Dashboard /api/admin/pdf is NOT wired through this.
 */
const multer = require("multer");
const logger = require("../utils/logger");
const { MAX_EXTRACT_MB, MAX_EXTRACT_BYTES } = require("../config/pdfExtractLimits");

function isMulterLimitSize(err) {
  return (
    (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") ||
    (err && err.code === "LIMIT_FILE_SIZE")
  );
}

function pdfExtractMulter(uploadPdfExtract) {
  return function pdfExtractMulterMiddleware(req, res, next) {
    const run = uploadPdfExtract.single("pdf");
    run(req, res, (err) => {
      if (!err) return next();

      const contentLength = req.headers["content-length"];
      const logPayload = {
        multerCode: err.code,
        multerMessage: err.message,
        multerField: err.field,
        contentLengthHeader: contentLength,
        isMulterError: err instanceof multer.MulterError,
        path: req.originalUrl
      };

      if (isMulterLimitSize(err)) {
        logger.warn("pdf extract multer: LIMIT_FILE_SIZE", logPayload);
        return res.status(413).json({
          error: `PDF ${MAX_EXTRACT_MB}MB se bada hai — chhota file choose karein (server limit ${MAX_EXTRACT_MB}MB).`,
          text: "",
          code: "LIMIT_FILE_SIZE",
          limitMb: MAX_EXTRACT_MB,
          limitBytes: MAX_EXTRACT_BYTES
        });
      }

      logger.warn("pdf extract multer: other error", logPayload);

      if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          error: "Form field galat hai — file ka naam `pdf` hona chahiye.",
          text: "",
          code: err.code
        });
      }

      return res.status(400).json({
        error: err.message || "PDF upload failed",
        text: "",
        code: err.code || "MULTER_ERROR"
      });
    });
  };
}

module.exports = pdfExtractMulter;
