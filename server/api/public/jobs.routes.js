const express = require("express");
const router = express.Router();

const pageController = require("../../controllers/public/page.controller");
const validate = require("../../middleware/validate.middleware");
const requireDb = require("../../middleware/dbReady.middleware");
const { jobsQuerySchema, jobIdParamSchema } = require("../../validations/public.validation");

router.get(
  "/jobs",
  requireDb,
  validate(jobsQuerySchema, "query"),
  pageController.listJobs
);

router.get(
  "/jobs/:id",
  requireDb,
  validate(jobIdParamSchema, "params"),
  pageController.getJobById
);

module.exports = router;
