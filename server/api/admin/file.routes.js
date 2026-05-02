const express = require("express");
const router = express.Router();

const upload = require("../../config/multer");
const uploadPdfExtract = require("../../config/multerPdfExtract");
const pdfExtractMulter = require("../../middleware/pdfExtractMulter.middleware");

const pdfController = require("../../controllers/admin/pdf.controller");
const fileController = require("../../controllers/admin/file.controller");

const asyncHandler = require("../../utils/asyncHandler");

// Dashboard: persist PDF/image — storage/uploads/… (see config/multer.js)
router.post("/pdf", upload.single("pdf"), asyncHandler(pdfController.uploadPDF));

// Generator: temp file only — JSON errors (incl. 413) for multer; see pdfExtractMulter.middleware.js
router.post(
  "/pdf/extract",
  pdfExtractMulter(uploadPdfExtract),
  asyncHandler(pdfController.extractPDF)
);
router.get("/pdf/extract/:jobId", asyncHandler(pdfController.getExtractJobStatus));

// 📂 list files (clear path + legacy root)
router.get("/files", asyncHandler(fileController.getFiles));
router.get(
  "/",
  (req, res, next) => {
    res.set("Deprecation", "true");
    res.set("Link", '</api/admin/files>; rel="successor-version"');
    next();
  },
  asyncHandler(fileController.getFiles)
);

// ❌ delete file (?file=…)
router.delete("/files", asyncHandler(fileController.deleteFile));
router.delete(
  "/",
  (req, res, next) => {
    res.set("Deprecation", "true");
    res.set("Link", '</api/admin/files>; rel="successor-version"');
    next();
  },
  asyncHandler(fileController.deleteFile)
);

module.exports = router;