"use strict";

/**
 * Package 4D — Shared preview routes.
 *
 * Read-oriented endpoints plus manual refresh. Reuses the existing
 * admin JWT + CSRF protected stack (mounted via protected.routes.js).
 */

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { sharedPreviewRefreshSchema } = require("../../validations/admin.validation");
const {
  getSharedPreviewHandler,
  refreshSharedPreviewHandler,
  getSharedPreviewDiagnosticsHandler
} = require("../../controllers/admin/sharedPreview.controller");

const router = express.Router();

router.get(
  "/shared-preview/:recruitmentId",
  adminSensitiveLimiter,
  asyncHandler(getSharedPreviewHandler)
);
router.get(
  "/shared-preview/:recruitmentId/diagnostics",
  adminSensitiveLimiter,
  asyncHandler(getSharedPreviewDiagnosticsHandler)
);
router.post(
  "/shared-preview/:recruitmentId/refresh",
  adminSensitiveLimiter,
  validateJoi(sharedPreviewRefreshSchema, "body"),
  asyncHandler(refreshSharedPreviewHandler)
);

module.exports = router;
