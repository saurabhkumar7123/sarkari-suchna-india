"use strict";

const express = require("express");
const router = express.Router();
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const {
  recruitmentTestingAnalyzeSchema,
  recruitmentTestingLookupSchema,
  recruitmentTestingSaveReviewSchema
} = require("../../validations/admin.validation");
const {
  analyzeRecruitmentNoticeHandler,
  lookupRecruitmentCandidatesHandler,
  saveRecruitmentReviewHandler
} = require("../../controllers/admin/recruitmentTesting.controller");
const { adminSensitiveLimiter } = require("../../config/rateLimits");

router.post(
  "/recruitment-testing/analyze",
  validateJoi(recruitmentTestingAnalyzeSchema, "body"),
  asyncHandler(analyzeRecruitmentNoticeHandler)
);

router.post(
  "/recruitment-testing/lookup-candidates",
  validateJoi(recruitmentTestingLookupSchema, "body"),
  asyncHandler(lookupRecruitmentCandidatesHandler)
);

router.post(
  "/recruitment-testing/save-review",
  adminSensitiveLimiter,
  validateJoi(recruitmentTestingSaveReviewSchema, "body"),
  asyncHandler(saveRecruitmentReviewHandler)
);

module.exports = router;
