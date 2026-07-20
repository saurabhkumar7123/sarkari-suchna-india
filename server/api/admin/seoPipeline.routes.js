"use strict";

/**
 * Package 4F — SEO & content pipeline routes (advisory operator surfaces).
 */

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const controller = require("../../controllers/admin/seoPipeline.controller");

const router = express.Router();

router.get("/seo-diagnostics", asyncHandler(controller.diagnosticsPanelHandler));
router.get("/seo-diagnostics/sitemap", asyncHandler(controller.sitemapValidationHandler));
router.get(
  "/seo-diagnostics/feature-completion-report",
  asyncHandler(controller.featureCompletionReportHandler)
);
router.get("/seo-diagnostics/page/:slug", asyncHandler(controller.pageDiagnosticsHandler));
router.get(
  "/seo-pipeline/pages/:slug/validation",
  asyncHandler(controller.contentValidationHandler)
);
router.get(
  "/seo-pipeline/pages/:slug/editorial-checklist",
  asyncHandler(controller.editorialChecklistHandler)
);
router.get(
  "/seo-pipeline/pages/:slug/link-suggestions",
  asyncHandler(controller.linkSuggestionsHandler)
);
router.get("/seo-pipeline/pages/:slug/freshness", asyncHandler(controller.freshnessHandler));
router.post(
  "/seo-pipeline/pages/:slug/review",
  adminSensitiveLimiter,
  asyncHandler(controller.recordReviewHandler)
);

module.exports = router;
