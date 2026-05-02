/**
 * Multer instance used ONLY by POST /api/admin/pdf/extract (Generator PDF extraction).
 * Files are written to a dedicated temp directory — not the dashboard PDF storage tree.
 *
 * Dashboard upload continues to use server/config/multer.js — do not merge behavior here.
 */
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { MAX_EXTRACT_BYTES, MAX_EXTRACT_MB } = require("./pdfExtractLimits");

const storageRoot = path.join(process.cwd(), "storage");
const extractTempDir = path.join(storageRoot, "temp", "pdf-extract");

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    if (!fs.existsSync(extractTempDir)) {
      fs.mkdirSync(extractTempDir, { recursive: true });
    }
    cb(null, extractTempDir);
  },
  filename(_req, file, cb) {
    const safe =
      typeof file.originalname === "string"
        ? file.originalname.replace(/[^a-z0-9._-]/gi, "_")
        : "upload.pdf";
    const token = crypto.randomBytes(12).toString("hex");
    cb(null, `extract-${Date.now()}-${token}-${safe}`);
  }
});

function isPdfLike(file) {
  const mt = (file.mimetype || "").toLowerCase();
  if (mt === "application/pdf" || mt === "application/x-pdf") return true;
  const name = String(file.originalname || "").toLowerCase();
  if (mt === "application/octet-stream" && name.endsWith(".pdf")) return true;
  return false;
}

const uploadPdfExtract = multer({
  storage,
  limits: { fileSize: MAX_EXTRACT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isPdfLike(file)) {
      cb(null, true);
    } else {
      cb(new Error("Sirf PDF file allowed hai (mimetype ya .pdf extension)."), false);
    }
  }
});

uploadPdfExtract.MAX_EXTRACT_MB = MAX_EXTRACT_MB;
uploadPdfExtract.MAX_EXTRACT_BYTES = MAX_EXTRACT_BYTES;

module.exports = uploadPdfExtract;
