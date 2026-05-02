const express = require("express");
const router = express.Router();

const pageController = require("../../controllers/public/page.controller");
const validate = require("../../middleware/validate.middleware");
const requireDb = require("../../middleware/dbReady.middleware");
const {
  pagesListQuerySchema,
  slugParamSchema
} = require("../../validations/public.validation");
const verifyToken = require("../../middleware/auth.middleware");

router.get(
  "/pages",
  requireDb,
  validate(pagesListQuerySchema, "query"),
  pageController.listPages
);

router.get(
  "/page/:slug",
  requireDb,
  validate(slugParamSchema, "params"),
  pageController.getPageBySlug
);

router.get("/top-views", requireDb, pageController.getTopViews);

router.get("/activity-log", verifyToken, pageController.getActivityLog);

module.exports = router;
