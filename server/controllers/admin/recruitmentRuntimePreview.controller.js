"use strict";

/**
 * Phase 30 — Admin recruitment runtime preview handlers.
 * Phase 31.B — controllers use the thin preview service (not the buffer directly).
 * In-memory preview only; no DB / review-queue writes.
 */

const recruitmentRuntimePreviewService = require("../../services/recruitmentRuntimePreview.service");

const listRecruitmentRuntimePreviewHandler = async (req, res) => {
  const result = recruitmentRuntimePreviewService.listRuntimePreviews(req.query || {});
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
};

const getRecruitmentRuntimePreviewHandler = async (req, res) => {
  const entry = recruitmentRuntimePreviewService.getRuntimePreviewById(req.params.id);
  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Preview entry not found"
    });
  }
  res.json({ success: true, data: entry });
};

const clearRecruitmentRuntimePreviewHandler = async (req, res) => {
  const result = recruitmentRuntimePreviewService.clearRuntimePreviewBuffer();
  res.json({
    success: true,
    message: "Preview buffer cleared",
    data: result
  });
};

module.exports = {
  listRecruitmentRuntimePreviewHandler,
  getRecruitmentRuntimePreviewHandler,
  clearRecruitmentRuntimePreviewHandler
};
