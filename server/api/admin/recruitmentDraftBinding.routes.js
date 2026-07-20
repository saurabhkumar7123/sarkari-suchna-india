"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const validateJoi = require("../../middleware/validateJoi.middleware");
const {
  recruitmentDraftAttachSchema,
  recruitmentDraftDetachSchema,
  recruitmentDraftReplaceSchema
} = require("../../validations/admin.validation");
const {
  getRecruitmentDraftBinding,
  attachRecruitmentDraft,
  detachRecruitmentDraft,
  replaceRecruitmentDraft,
  listAvailableDraftsForBinding
} = require("../../controllers/admin/recruitmentDraftBinding.controller");

const router = express.Router();

router.get(
  "/draft-bindings/available-drafts",
  adminSensitiveLimiter,
  asyncHandler(listAvailableDraftsForBinding)
);
router.get(
  "/recruitments/:recruitmentId/draft-binding",
  adminSensitiveLimiter,
  asyncHandler(getRecruitmentDraftBinding)
);
router.post(
  "/recruitments/:recruitmentId/draft-binding/attach",
  adminSensitiveLimiter,
  validateJoi(recruitmentDraftAttachSchema, "body"),
  asyncHandler(attachRecruitmentDraft)
);
router.post(
  "/recruitments/:recruitmentId/draft-binding/detach",
  adminSensitiveLimiter,
  validateJoi(recruitmentDraftDetachSchema, "body"),
  asyncHandler(detachRecruitmentDraft)
);
router.post(
  "/recruitments/:recruitmentId/draft-binding/replace",
  adminSensitiveLimiter,
  validateJoi(recruitmentDraftReplaceSchema, "body"),
  asyncHandler(replaceRecruitmentDraft)
);

module.exports = router;
