const express = require("express");
const router = express.Router();

const { uploadCSV } = require("../../controllers/admin/upload.controller");
const uploadCsv = require("../../config/multerCsv");
const asyncHandler = require("../../utils/asyncHandler");
const { adminSensitiveLimiter } = require("../../config/rateLimits");

// =============================
// 📤 CSV UPLOAD
// =============================
router.post("/upload-csv", adminSensitiveLimiter, uploadCsv.single("csvfile"), asyncHandler(uploadCSV));

module.exports = router;