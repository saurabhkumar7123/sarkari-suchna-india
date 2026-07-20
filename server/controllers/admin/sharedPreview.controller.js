"use strict";

const sharedPreviewService = require("../../services/sharedPreview.service");
const { recordActivity } = require("../../services/adminActivity.service");

function operatorName(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

async function getSharedPreviewHandler(req, res) {
  try {
    const data = await sharedPreviewService.getSharedPreview(req.params.recruitmentId);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("SHARED PREVIEW GET ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to load shared preview"
    });
  }
}

async function refreshSharedPreviewHandler(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = await sharedPreviewService.refreshSharedPreview(req.params.recruitmentId, {
      reason: body.reason || "manual",
      operator: operatorName(req)
    });

    await recordActivity({
      admin: operatorName(req),
      action: "shared_preview_refresh",
      target: String(req.params.recruitmentId),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("SHARED PREVIEW REFRESH ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to refresh shared preview"
    });
  }
}

async function getSharedPreviewDiagnosticsHandler(req, res) {
  try {
    const data = await sharedPreviewService.getPreviewDiagnostics(req.params.recruitmentId);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("SHARED PREVIEW DIAGNOSTICS ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to load shared preview diagnostics"
    });
  }
}

module.exports = {
  getSharedPreviewHandler,
  refreshSharedPreviewHandler,
  getSharedPreviewDiagnosticsHandler
};
