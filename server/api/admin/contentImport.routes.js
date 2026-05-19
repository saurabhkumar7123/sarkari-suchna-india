const express = require("express");
const router = express.Router();

const {
  uploadContentImportCsv,
  listContentImports,
  getContentImportById,
  deleteContentImport
} = require("../../controllers/admin/contentImport.controller");
const uploadCsv = require("../../config/multerCsv");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");

router.get("/content-imports", adminSensitiveLimiter, asyncHandler(listContentImports));
router.get("/content-imports/:id", adminSensitiveLimiter, asyncHandler(getContentImportById));
router.delete("/content-imports/:id", adminSensitiveLimiter, asyncHandler(deleteContentImport));
router.post(
  "/content-imports/upload",
  adminSensitiveLimiter,
  uploadCsv.single("csvfile"),
  asyncHandler(uploadContentImportCsv)
);

module.exports = router;
