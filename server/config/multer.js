const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { MAX_UPLOAD_BYTES } = require("./uploadLimits");

const storageRoot = path.join(process.cwd(), "storage");

const allowedTypes = new Set([
  "application/pdf",
  "application/x-pdf",
  "image/jpeg",
  "image/jpg",
  "image/png"
]);
const allowedExt = [".pdf", ".jpg", ".jpeg", ".png"];

function isPdfMime(mimetype) {
  const m = String(mimetype || "").toLowerCase();
  return m === "application/pdf" || m === "application/x-pdf";
}

function isAllowedImageMime(mimetype) {
  const m = String(mimetype || "").toLowerCase();
  return m === "image/jpeg" || m === "image/jpg" || m === "image/png";
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;
    if (isPdfMime(file.mimetype)) {
      uploadPath = path.join(storageRoot, "uploads", "pdf");
    } else if (isAllowedImageMime(file.mimetype)) {
      uploadPath = path.join(storageRoot, "uploads", "images");
    } else {
      uploadPath = path.join(storageRoot, "temp");
    }

    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) return cb(err);
      cb(null, uploadPath);
    });
  },

  filename: function (req, file, cb) {
    const now = new Date();

    const indian = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    const day = String(indian.getDate()).padStart(2, "0");
    const month = String(indian.getMonth() + 1).padStart(2, "0");
    const year = indian.getFullYear();

    const hours = String(indian.getHours()).padStart(2, "0");
    const minutes = String(indian.getMinutes()).padStart(2, "0");
    const seconds = String(indian.getSeconds()).padStart(2, "0");

    const formattedDate = day + month + year + hours + minutes + seconds;

    const safeName = file.originalname.replace(/[^a-z0-9.]/gi, "_");

    cb(null, formattedDate + "-" + safeName);
  }
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: MAX_UPLOAD_BYTES
  },

  fileFilter: (req, file, cb) => {
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();
    if (allowedTypes.has(mime) && allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, JPEG and PNG files are allowed"), false);
    }
  }
});

module.exports = upload;
module.exports.allowedTypes = allowedTypes;
module.exports.allowedExt = allowedExt;
module.exports.isPdfMime = isPdfMime;
module.exports.isAllowedImageMime = isAllowedImageMime;
