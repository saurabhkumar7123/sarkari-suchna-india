"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const {
  recruitmentCreateSchema,
  recruitmentUpdateSchema,
  recruitmentListQuerySchema,
  recruitmentManualUpdateSchema
} = require("../../validations/admin.validation");
const {
  listRecruitmentsHandler,
  getRecruitmentHandler,
  getRecruitmentDetailHandler,
  createRecruitmentHandler,
  updateRecruitmentHandler,
  createManualRecruitmentUpdateHandler
} = require("../../controllers/admin/recruitment.controller");

const router = express.Router();

router.get(
  "/recruitments",
  validateJoi(recruitmentListQuerySchema, "query"),
  asyncHandler(listRecruitmentsHandler)
);
router.get("/recruitments/:id/detail", asyncHandler(getRecruitmentDetailHandler));
router.get("/recruitments/:id", asyncHandler(getRecruitmentHandler));
router.post(
  "/recruitments",
  adminSensitiveLimiter,
  validateJoi(recruitmentCreateSchema, "body"),
  asyncHandler(createRecruitmentHandler)
);
router.put(
  "/recruitments/:id",
  adminSensitiveLimiter,
  validateJoi(recruitmentUpdateSchema, "body"),
  asyncHandler(updateRecruitmentHandler)
);
router.post(
  "/recruitments/:id/manual-update",
  adminSensitiveLimiter,
  validateJoi(recruitmentManualUpdateSchema, "body"),
  asyncHandler(createManualRecruitmentUpdateHandler)
);

module.exports = router;
