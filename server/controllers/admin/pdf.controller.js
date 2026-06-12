const path = require("path");
const fs = require("fs");

const logger = require("../../utils/logger");
const { heavyTaskQueue } = require("../../services/queue/siteQueue");
const fileService = require("../../services/file.service");
const { resolveUrl } = require("../../utils/escapeHtml");
const { extractGeneratorPdfText } = require("../../services/pdfGeneratorExtract.service");

/**
 * Permanent PDF storage (dashboard uploads, list, delete).
 * Must not be used by Generator extraction — extract uses temp paths only.
 */
const pdfUploadDir = path.join(process.cwd(), "storage", "uploads", "pdf");
const { isPdfMime, isAllowedImageMime } = require("../../config/multer");

const MSG_INVALID_TYPE = "Only PDF, JPG, JPEG and PNG files are allowed";
const MSG_INVALID_SIGNATURE = "Uploaded file appears corrupted or invalid";

function uploadError(res, status, message) {
  return res.status(status).json({ success: false, message, error: message });
}

function hasAllowedUploadExtension(fileName, isImage) {
  const name = String(fileName || "").toLowerCase();
  return isImage ? /\.(png|jpe?g)$/i.test(name) : /\.pdf$/i.test(name);
}

function hasAllowedFileSignature(buffer, isImage) {
  if (!buffer || buffer.length < 4) return false;
  if (!isImage) {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  return isPng || isJpeg;
}

/**
 * Dashboard: POST /api/admin/pdf — persist file via multer, return public URL.
 * No text extraction, parsing, or generator extraction imports.
 */
const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return uploadError(res, 400, "No file uploaded");
    }

    const isImage = isAllowedImageMime(req.file.mimetype);
    const isPDF = isPdfMime(req.file.mimetype);

    if (!isImage && !isPDF) {
      return uploadError(res, 400, MSG_INVALID_TYPE);
    }

    if (!hasAllowedUploadExtension(req.file.originalname, isImage)) {
      fileService.unlink(req.file.path).catch(() => {});
      return uploadError(res, 400, MSG_INVALID_TYPE);
    }

    const fileBytes = await fileService.readFile(req.file.path);
    const fileHeader = fileBytes.subarray(0, 16);
    if (!hasAllowedFileSignature(fileHeader, isImage)) {
      fileService.unlink(req.file.path).catch(() => {});
      return uploadError(res, 400, MSG_INVALID_SIGNATURE);
    }

    const folder = isImage ? "image" : "pdf";
    const fileName = req.file.filename;
    const filePath = `/${folder}/${fileName}`;
    const absoluteUrl = resolveUrl(filePath);

    logger.info("pdf upload (dashboard)", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      urlFolder: folder
    });

    res.json({
      success: true,
      status: "success",
      fileName,
      path: filePath,
      absoluteUrl,
      // Keep legacy response field for compatibility with existing UI code.
      url: filePath,
      data: { fileName, path: filePath, absoluteUrl }
    });
  } catch (err) {
    logger.error("pdf upload (dashboard) failed", { message: err.message });
    res.status(500).json({ success: false, error: "Upload failed" });
  }
};

/** Generator extract only — align with multerPdfExtract fileFilter (PDF + .pdf extension). */
function isGeneratorExtractPdfMime(file) {
  const m = String(file.mimetype || "").toLowerCase();
  if (m === "application/pdf" || m === "application/x-pdf") return true;
  if (m === "application/octet-stream" && /\.pdf$/i.test(String(file.originalname || ""))) return true;
  return false;
}

/**
 * Generator: POST /api/admin/pdf/extract — temp file only; text extraction only.
 * Does not write to dashboard PDF storage. Unlinks temp file after processing.
 */
const extractPDF = async (req, res) => {
  const tempPath = req.file && req.file.path ? String(req.file.path) : "";
  try {
    console.log("[generator extract] req.file:", req.file || null);
    if (!req.file) {
      return res.status(400).json({ error: "PDF file is required", text: "" });
    }

    if (!isGeneratorExtractPdfMime(req.file)) {
      return res.status(400).json({ error: "Sirf PDF allowed hai.", text: "" });
    }

    console.log("[generator extract] req.file.path:", tempPath);
    const fileExists = !!tempPath && fs.existsSync(tempPath);
    console.log("[generator extract] temp exists:", fileExists);
    if (!fileExists) {
      return res.status(500).json({ error: "Uploaded temp file not found for extraction", text: "" });
    }

    logger.info("pdf extract (generator)", {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      tempPath
    });

    const pdfBuffer = await fileService.readFile(tempPath);
    console.log("[generator extract] buffer bytes:", pdfBuffer ? pdfBuffer.length : 0);
    const extracted = await extractGeneratorPdfText(pdfBuffer);
    const extractedText = String(extracted.text || "");
    console.log("[generator extract] extracted text length:", extractedText.length);
    return res.status(200).json({
      status: "success",
      text: extractedText,
      extractionNote: extracted.extractionNote || undefined
    });
  } catch (err) {
    const code = err.code;
    logger.error("pdf extract (generator) failed", {
      message: err.message,
      code: code || "UNKNOWN"
    });

    return res.status(500).json({
      error: `PDF extraction failed: ${err.message || code || "unknown error"}`,
      text: ""
    });
  } finally {
    if (tempPath) {
      await fileService.unlink(tempPath).catch(() => {});
    }
  }
};

const getExtractJobStatus = async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "invalid job id", text: "" });

  const job = await heavyTaskQueue.getJob(jobId);
  if (!job) return res.status(404).json({ error: "job not found", text: "" });

  const state = await job.getState();
  if (state === "completed") {
    const result = job.returnvalue || {};
    return res.json({
      status: "completed",
      text: String(result.text || ""),
      extractionNote: result.extractionNote || undefined
    });
  }

  if (state === "failed") {
    return res.status(400).json({
      status: "failed",
      error: job.failedReason || "Extraction failed",
      text: ""
    });
  }

  return res.status(202).json({
    status: state,
    text: ""
  });
};

const getPDFList = async (req, res) => {
  try {
    const exists = await fileService.stat(pdfUploadDir).catch(() => null);
    if (!exists) return res.json([]);

    const files = await fileService.readdir(pdfUploadDir);

    const result = files.map((f) => ({
      name: f,
      url: "/pdf/" + f
    }));

    res.json(result);
  } catch (err) {
    console.error("LIST ERROR:", err);
    res.json([]);
  }
};

const deletePDF = async (req, res) => {
  try {
    const file = req.params.id;
    const filePath = path.join(pdfUploadDir, file);

    await fileService.unlink(filePath);

    res.json({ status: "deleted" });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
};

module.exports = {
  uploadPDF,
  extractPDF,
  getExtractJobStatus,
  getPDFList,
  deletePDF
};
