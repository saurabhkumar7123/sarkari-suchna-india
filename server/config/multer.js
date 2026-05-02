const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storageRoot = path.join(process.cwd(), "storage");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;
    if (file.mimetype === "application/pdf") {
      uploadPath = path.join(storageRoot, "uploads", "pdf");
    } else if (file.mimetype.startsWith("image/")) {
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

const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const allowedExt = [".pdf", ".jpg", ".jpeg", ".png"];

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    if (allowedTypes.includes(file.mimetype) && allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, JPEG, PNG allowed"), false);
    }
  }
});

module.exports = upload;
