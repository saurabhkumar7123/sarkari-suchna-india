const express = require("express");
const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");

const upload = require("../server/config/multer");
const { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } = require("../server/config/uploadLimits");
const dashboardUploadMulter = require("../server/middleware/dashboardUploadMulter.middleware");
const {
  MSG_FILE_TOO_LARGE,
  MSG_INVALID_TYPE
} = require("../server/middleware/dashboardUploadMulter.middleware");

function buildTestApp() {
  const app = express();
  app.post("/upload", dashboardUploadMulter(upload), (req, res) => {
    res.json({ success: true, size: req.file && req.file.size });
  });
  return app;
}

function tinyPdfBuffer() {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 0\ntrailer\n<<>>\n%%EOF\n");
}

function tinyPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ]);
}

describe("dashboard upload limits", () => {
  test("MAX_UPLOAD_MB is 10", () => {
    expect(MAX_UPLOAD_MB).toBe(10);
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("dashboard upload multer middleware", () => {
  const app = buildTestApp();

  test("accepts application/x-pdf with .pdf extension", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("pdf", tinyPdfBuffer(), {
        filename: "notice.pdf",
        contentType: "application/x-pdf"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("rejects image/webp with .webp extension", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("pdf", tinyPngBuffer(), {
        filename: "photo.webp",
        contentType: "image/webp"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(MSG_INVALID_TYPE);
  });

  test("rejects file larger than 10 MB with 413", async () => {
    const tmp = path.join(os.tmpdir(), `upload-test-${Date.now()}.pdf`);
    const buf = Buffer.alloc(MAX_UPLOAD_BYTES + 1024, 0x41);
    buf.write("%PDF", 0);
    fs.writeFileSync(tmp, buf);

    try {
      const res = await request(app).post("/upload").attach("pdf", tmp, "large.pdf");
      expect(res.status).toBe(413);
      expect(res.body.message).toBe(MSG_FILE_TOO_LARGE);
      expect(res.body.code).toBe("LIMIT_FILE_SIZE");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  test("accepts file just under 10 MB limit", async () => {
    const tmp = path.join(os.tmpdir(), `upload-ok-${Date.now()}.pdf`);
    const buf = Buffer.alloc(MAX_UPLOAD_BYTES - 512, 0x41);
    buf.write("%PDF", 0);
    fs.writeFileSync(tmp, buf);

    try {
      const res = await request(app).post("/upload").attach("pdf", tmp, "ok.pdf");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
