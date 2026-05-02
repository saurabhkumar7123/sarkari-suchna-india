const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storageRoot = path.join(process.cwd(), "storage");
const csvUploadPath = path.join(storageRoot, "temp");

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    fs.mkdir(csvUploadPath, { recursive: true }, (err) => {
      if (err) return cb(err);
      cb(null, csvUploadPath);
    });
  },
  filename: function (_req, file, cb) {
    const stamp = Date.now();
    const safeName = String(file.originalname || "upload.csv").replace(/[^a-z0-9.]/gi, "_");
    cb(null, `${stamp}-${safeName}`);
  }
});

const allowedMime = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel"
]);

function isCsvMime(mime) {
  return allowedMime.has(String(mime || "").toLowerCase());
}

module.exports = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    if (ext === ".csv" && isCsvMime(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only CSV files are allowed"), false);
  }
});
