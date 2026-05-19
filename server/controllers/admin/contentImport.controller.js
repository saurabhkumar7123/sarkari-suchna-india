"use strict";

const fileService = require("../../services/file.service");
const contentImportService = require("../../services/contentImport.service");
const { recordActivity } = require("../../services/adminActivity.service");
const { isContentImportEnabled } = require("../../config/contentImport");

async function uploadContentImportCsv(req, res) {
  if (!isContentImportEnabled()) {
    return res.status(503).json({
      success: false,
      message: "Content import is disabled (CONTENT_IMPORT_ENABLED=0)"
    });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await contentImportService.importCsvFile(req.file);
    await fileService.unlink(req.file.path).catch(() => {});

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "content_import",
      target: req.file.originalname || "",
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      ids: result.ids
    });
  } catch (err) {
    if (req.file && req.file.path) {
      await fileService.unlink(req.file.path).catch(() => {});
    }
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "content_import",
      target: req.file && req.file.originalname ? req.file.originalname : "",
      status: "fail",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("CONTENT IMPORT ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "CSV import failed"
    });
  }
}

async function listContentImports(req, res) {
  try {
    const payload = await contentImportService.listImports({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status
    });
    return res.json({ success: true, ...payload });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("CONTENT IMPORT LIST ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to list imports"
    });
  }
}

async function getContentImportById(req, res) {
  try {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid import id" });
    }

    const markOpened =
      String(req.query.markOpened || "1").trim().toLowerCase() !== "0" &&
      String(req.query.markOpened || "").toLowerCase() !== "false";

    const row = await contentImportService.getImportById(id, { markOpened });
    if (!row) {
      return res.status(404).json({ success: false, message: "Import not found" });
    }

    return res.json({
      success: true,
      data: {
        id: row.id,
        content: row.content || "",
        sourceFile: row.source_file || "",
        rowIndex: row.row_index,
        status: row.status,
        createdAt: row.created_at,
        openedAt: row.opened_at
      }
    });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("CONTENT IMPORT GET ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to load import"
    });
  }
}

async function deleteContentImport(req, res) {
  if (!isContentImportEnabled()) {
    return res.status(503).json({
      success: false,
      message: "Content import is disabled (CONTENT_IMPORT_ENABLED=0)"
    });
  }

  try {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid import id" });
    }

    await contentImportService.deleteImportById(id);

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "content_import_delete",
      target: String(id),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, deleted: id });
  } catch (err) {
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "content_import_delete",
      target: String(req.params.id || ""),
      status: "fail",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("CONTENT IMPORT DELETE ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to delete import"
    });
  }
}

module.exports = {
  uploadContentImportCsv,
  listContentImports,
  getContentImportById,
  deleteContentImport
};
