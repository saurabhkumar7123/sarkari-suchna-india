const express = require("express");
const router = express.Router();

const { generatePage } = require("../../controllers/admin/generator.controller");
const asyncHandler = require("../../utils/asyncHandler");
const { validatePage } = require("../../validations/page.validation");
const validateJoi = require("../../middleware/validateJoi.middleware");
const normalizeGeneratorBody = require("../../middleware/normalizeGeneratorBody.middleware");
const { adminPagePayloadSchema } = require("../../validations/admin.validation");

// 🚀 generate
router.post(
  "/pages",
  normalizeGeneratorBody,
  validateJoi(adminPagePayloadSchema, "body"),
  validatePage,
  asyncHandler(generatePage)
);

module.exports = router;