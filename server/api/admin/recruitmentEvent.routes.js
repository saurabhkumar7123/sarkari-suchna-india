"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const {
  recruitmentEventCreateSchema,
  recruitmentEventUpdateSchema,
  recruitmentEventListQuerySchema
} = require("../../validations/admin.validation");
const {
  listRecruitmentEventsHandler,
  getRecruitmentEventHandler,
  createRecruitmentEventHandler,
  updateRecruitmentEventHandler,
  deleteRecruitmentEventHandler
} = require("../../controllers/admin/recruitmentEvent.controller");

const router = express.Router();

router.get(
  "/recruitments/:recruitmentId/events",
  validateJoi(recruitmentEventListQuerySchema, "query"),
  asyncHandler(listRecruitmentEventsHandler)
);
router.post(
  "/recruitments/:recruitmentId/events",
  adminSensitiveLimiter,
  validateJoi(recruitmentEventCreateSchema, "body"),
  asyncHandler(createRecruitmentEventHandler)
);
router.get("/recruitment-events/:id", asyncHandler(getRecruitmentEventHandler));
router.put(
  "/recruitment-events/:id",
  adminSensitiveLimiter,
  validateJoi(recruitmentEventUpdateSchema, "body"),
  asyncHandler(updateRecruitmentEventHandler)
);
router.delete(
  "/recruitment-events/:id",
  adminSensitiveLimiter,
  asyncHandler(deleteRecruitmentEventHandler)
);

module.exports = router;
