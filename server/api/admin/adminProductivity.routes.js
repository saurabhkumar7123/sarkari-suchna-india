"use strict";

/**
 * Package 4E — Admin productivity & bulk recruitment routes.
 */

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const { recruitmentBulkSchema } = require("../../validations/admin.validation");
const {
  bulkRecruitmentsHandler,
  productivitySummaryHandler
} = require("../../controllers/admin/adminProductivity.controller");

const router = express.Router();

router.get("/admin-productivity", asyncHandler(productivitySummaryHandler));

router.post(
  "/recruitments/bulk",
  adminSensitiveLimiter,
  validateJoi(recruitmentBulkSchema, "body"),
  asyncHandler(bulkRecruitmentsHandler)
);

module.exports = router;
