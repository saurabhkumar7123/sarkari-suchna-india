"use strict";

const express = require("express");
const router = express.Router();
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const {
  recruitmentReviewQueueListQuerySchema,
  recruitmentReviewQueueNotesSchema,
  recruitmentReviewQueueActionSchema,
  recruitmentReviewQueueResolveSchema,
  recruitmentReviewQueueEnsureFromUpdateSchema
} = require("../../validations/admin.validation");
const {
  listRecruitmentReviewQueueHandler,
  getRecruitmentReviewQueueHandler,
  getRecruitmentReviewByUpdateHandler,
  ensureRecruitmentReviewFromUpdateHandler,
  approveRecruitmentReviewHandler,
  rejectRecruitmentReviewHandler,
  markUnderReviewRecruitmentReviewHandler,
  freezeRecruitmentReviewHandler,
  unfreezeRecruitmentReviewHandler,
  updateRecruitmentReviewNotesHandler,
  resolveNeedsMatchingHandler
} = require("../../controllers/admin/recruitmentReviewQueue.controller");

router.get(
  "/recruitment-review-queue",
  validateJoi(recruitmentReviewQueueListQuerySchema, "query"),
  asyncHandler(listRecruitmentReviewQueueHandler)
);

router.get(
  "/recruitment-review-queue/by-update/:updateId",
  asyncHandler(getRecruitmentReviewByUpdateHandler)
);

router.post(
  "/recruitment-review-queue/ensure-from-update",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueEnsureFromUpdateSchema, "body"),
  asyncHandler(ensureRecruitmentReviewFromUpdateHandler)
);

router.get("/recruitment-review-queue/:id", asyncHandler(getRecruitmentReviewQueueHandler));

router.post(
  "/recruitment-review-queue/:id/approve",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueActionSchema, "body"),
  asyncHandler(approveRecruitmentReviewHandler)
);

router.post(
  "/recruitment-review-queue/:id/reject",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueActionSchema, "body"),
  asyncHandler(rejectRecruitmentReviewHandler)
);

router.post(
  "/recruitment-review-queue/:id/under-review",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueActionSchema, "body"),
  asyncHandler(markUnderReviewRecruitmentReviewHandler)
);

router.post(
  "/recruitment-review-queue/:id/freeze",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueActionSchema, "body"),
  asyncHandler(freezeRecruitmentReviewHandler)
);

router.post(
  "/recruitment-review-queue/:id/unfreeze",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueActionSchema, "body"),
  asyncHandler(unfreezeRecruitmentReviewHandler)
);

router.patch(
  "/recruitment-review-queue/:id/notes",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueNotesSchema, "body"),
  asyncHandler(updateRecruitmentReviewNotesHandler)
);

router.post(
  "/recruitment-review-queue/:id/resolve-matching",
  adminSensitiveLimiter,
  validateJoi(recruitmentReviewQueueResolveSchema, "body"),
  asyncHandler(resolveNeedsMatchingHandler)
);

module.exports = router;
