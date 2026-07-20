"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const validateJoi = require("../../middleware/validateJoi.middleware");
const {
  editorialReviewDecisionSchema,
  editorialReviewNoteSchema
} = require("../../validations/admin.validation");
const {
  listEditorialReviewInbox,
  getEditorialReviewWorkspace,
  applyEditorialReviewDecision,
  addEditorialReviewNote
} = require("../../controllers/admin/editorialReview.controller");

const router = express.Router();

router.get(
  "/editorial-reviews",
  adminSensitiveLimiter,
  asyncHandler(listEditorialReviewInbox)
);
router.get(
  "/editorial-reviews/:recruitmentId",
  adminSensitiveLimiter,
  asyncHandler(getEditorialReviewWorkspace)
);
router.post(
  "/editorial-reviews/:recruitmentId/decision",
  adminSensitiveLimiter,
  validateJoi(editorialReviewDecisionSchema, "body"),
  asyncHandler(applyEditorialReviewDecision)
);
router.post(
  "/editorial-reviews/:recruitmentId/notes",
  adminSensitiveLimiter,
  validateJoi(editorialReviewNoteSchema, "body"),
  asyncHandler(addEditorialReviewNote)
);

module.exports = router;
