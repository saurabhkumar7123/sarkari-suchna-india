"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const {
  listGeneratorDrafts,
  getGeneratorDraft,
  saveGeneratorDraft,
  markGeneratorDraftPublished,
  deleteGeneratorDraft
} = require("../../controllers/admin/generatorDraft.controller");

const router = express.Router();

router.get("/generator-drafts", adminSensitiveLimiter, asyncHandler(listGeneratorDrafts));
router.get("/generator-drafts/:id", adminSensitiveLimiter, asyncHandler(getGeneratorDraft));
router.post("/generator-drafts", adminSensitiveLimiter, asyncHandler(saveGeneratorDraft));
router.post(
  "/generator-drafts/:id/mark-published",
  adminSensitiveLimiter,
  asyncHandler(markGeneratorDraftPublished)
);
router.delete("/generator-drafts/:id", adminSensitiveLimiter, asyncHandler(deleteGeneratorDraft));

module.exports = router;
