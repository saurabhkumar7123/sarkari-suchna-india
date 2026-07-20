"use strict";

const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
const {
  pageLinkageLinkSchema,
  pageLinkagePageRefSchema,
  pageLinkageListQuerySchema
} = require("../../validations/admin.validation");
const {
  linkPageHandler,
  unlinkPageHandler,
  getPageLinkageHandler,
  listLinkedPagesHandler
} = require("../../controllers/admin/recruitmentPageLink.controller");

const router = express.Router();

router.get(
  "/page-linkages",
  validateJoi(pageLinkageListQuerySchema, "query"),
  asyncHandler(listLinkedPagesHandler)
);
router.get(
  "/page-linkages/page",
  validateJoi(pageLinkagePageRefSchema, "query"),
  asyncHandler(getPageLinkageHandler)
);
router.post(
  "/page-linkages",
  adminSensitiveLimiter,
  validateJoi(pageLinkageLinkSchema, "body"),
  asyncHandler(linkPageHandler)
);
router.delete(
  "/page-linkages",
  adminSensitiveLimiter,
  validateJoi(pageLinkagePageRefSchema, "query"),
  asyncHandler(unlinkPageHandler)
);

module.exports = router;
