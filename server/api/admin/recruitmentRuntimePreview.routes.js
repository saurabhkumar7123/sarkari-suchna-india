"use strict";

const express = require("express");
const router = express.Router();
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const {
  recruitmentRuntimePreviewListQuerySchema
} = require("../../validations/admin.validation");
const {
  listRecruitmentRuntimePreviewHandler,
  getRecruitmentRuntimePreviewHandler,
  clearRecruitmentRuntimePreviewHandler
} = require("../../controllers/admin/recruitmentRuntimePreview.controller");

router.get(
  "/recruitment-runtime-preview",
  validateJoi(recruitmentRuntimePreviewListQuerySchema, "query"),
  asyncHandler(listRecruitmentRuntimePreviewHandler)
);

router.post(
  "/recruitment-runtime-preview/clear",
  adminSensitiveLimiter,
  asyncHandler(clearRecruitmentRuntimePreviewHandler)
);

router.get(
  "/recruitment-runtime-preview/:id",
  asyncHandler(getRecruitmentRuntimePreviewHandler)
);

module.exports = router;
