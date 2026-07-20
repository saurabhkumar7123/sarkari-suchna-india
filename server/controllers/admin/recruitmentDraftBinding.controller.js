"use strict";

const recruitmentDraftBindingService = require("../../services/recruitmentDraftBinding.service");
const sharedPreviewService = require("../../services/sharedPreview.service");
const { recordActivity } = require("../../services/adminActivity.service");

function operatorName(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

async function getRecruitmentDraftBinding(req, res) {
  try {
    const data = await recruitmentDraftBindingService.getBinding(req.params.recruitmentId);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("DRAFT BINDING GET ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to load draft binding"
    });
  }
}

async function attachRecruitmentDraft(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = await recruitmentDraftBindingService.attachDraft(req.params.recruitmentId, {
      draftId: body.draft_id,
      recruitmentEventId: body.recruitment_event_id,
      operator: operatorName(req)
    });

    await recordActivity({
      admin: operatorName(req),
      action: "recruitment_draft_attach",
      target: String(req.params.recruitmentId),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    // Package 4D — refresh the shared preview after a draft change.
    await sharedPreviewService.refreshAfterChange(
      req.params.recruitmentId,
      "draft_change",
      operatorName(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("DRAFT BINDING ATTACH ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to attach draft"
    });
  }
}

async function detachRecruitmentDraft(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = await recruitmentDraftBindingService.detachDraft(req.params.recruitmentId, {
      draftId: body.draft_id != null ? body.draft_id : req.query.draft_id,
      operator: operatorName(req)
    });

    await recordActivity({
      admin: operatorName(req),
      action: "recruitment_draft_detach",
      target: String(req.params.recruitmentId),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    // Package 4D — refresh the shared preview after a draft change.
    await sharedPreviewService.refreshAfterChange(
      req.params.recruitmentId,
      "draft_change",
      operatorName(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("DRAFT BINDING DETACH ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to detach draft"
    });
  }
}

async function replaceRecruitmentDraft(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = await recruitmentDraftBindingService.replaceDraft(req.params.recruitmentId, {
      draftId: body.draft_id,
      previousDraftId: body.previous_draft_id,
      recruitmentEventId: body.recruitment_event_id,
      operator: operatorName(req)
    });

    await recordActivity({
      admin: operatorName(req),
      action: "recruitment_draft_replace",
      target: String(req.params.recruitmentId),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    // Package 4D — refresh the shared preview after a draft change.
    await sharedPreviewService.refreshAfterChange(
      req.params.recruitmentId,
      "draft_change",
      operatorName(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("DRAFT BINDING REPLACE ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to replace draft"
    });
  }
}

async function listAvailableDraftsForBinding(req, res) {
  try {
    const data = await recruitmentDraftBindingService.listAvailableDrafts(req.query || {});
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("DRAFT BINDING LIST ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to list available drafts"
    });
  }
}

module.exports = {
  getRecruitmentDraftBinding,
  attachRecruitmentDraft,
  detachRecruitmentDraft,
  replaceRecruitmentDraft,
  listAvailableDraftsForBinding
};
