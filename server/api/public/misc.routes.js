const express = require("express");
const multer = require("multer");
const router = express.Router();

/** FormData (multipart) for POST /ai-parse — fields only, no files */
const aiParseForm = multer({
  limits: { fieldSize: 6 * 1024 * 1024 }
}).none();

const {
  getSmallBoxes,
  getBreakingNews,
  getTagPage,
  previewPage,
  aiParse,
  getSections,
  getRelatedPages,
  postRelatedClick
} = require("../../controllers/public/misc.controller");
const { getNotifications } = require("../../controllers/public/notification.controller");

const validate = require("../../middleware/validate.middleware");
const requireDb = require("../../middleware/dbReady.middleware");
const {
  tagParamSchema,
  relatedSlugParamSchema,
  relatedClickBodySchema,
  previewBodySchema,
  aiParseBodySchema
} = require("../../validations/public.validation");

router.get("/small-boxes", requireDb, getSmallBoxes);
router.get("/breaking-news", requireDb, getBreakingNews);
router.get("/public/notifications", getNotifications);
router.get("/tag/:tag", requireDb, validate(tagParamSchema, "params"), getTagPage);

router.post("/preview-page", validate(previewBodySchema, "body"), previewPage);

function maybeAiParseMultipart(req, res, next) {
  const ct = req.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    return aiParseForm(req, res, next);
  }
  return next();
}

router.post("/ai-parse", maybeAiParseMultipart, validate(aiParseBodySchema, "body"), aiParse);

router.get("/sections", requireDb, getSections);
router.get(
  "/related/:slug",
  requireDb,
  validate(relatedSlugParamSchema, "params"),
  getRelatedPages
);

router.post(
  "/related-click",
  validate(relatedClickBodySchema, "body"),
  postRelatedClick
);

module.exports = router;
