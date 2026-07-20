"use strict";

const editorialReviewService = require("../../services/editorialReview.service");
const sharedPreviewService = require("../../services/sharedPreview.service");
const { recordActivity } = require("../../services/adminActivity.service");

function operatorName(req) {
  return req.user && req.user.username ? req.user.username : "admin";
}

async function listEditorialReviewInbox(req, res) {
  try {
    const data = await editorialReviewService.listInbox(req.query || {});
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("EDITORIAL REVIEW INBOX ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to list editorial review inbox"
    });
  }
}

async function getEditorialReviewWorkspace(req, res) {
  try {
    const data = await editorialReviewService.getReviewWorkspace(req.params.recruitmentId);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("EDITORIAL REVIEW WORKSPACE ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to load review workspace"
    });
  }
}

async function applyEditorialReviewDecision(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = await editorialReviewService.applyDecision(req.params.recruitmentId, {
      decision: body.decision,
      comment: body.comment || body.notes || null,
      operator: operatorName(req)
    });

    await recordActivity({
      admin: operatorName(req),
      action: `editorial_review_${String(body.decision || "decision")}`,
      target: String(req.params.recruitmentId),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    // Package 4D — refresh the shared preview after a review decision.
    await sharedPreviewService.refreshAfterChange(
      req.params.recruitmentId,
      "review_decision",
      operatorName(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("EDITORIAL REVIEW DECISION ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to apply review decision"
    });
  }
}

async function addEditorialReviewNote(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = await editorialReviewService.addNote(req.params.recruitmentId, {
      text: body.text || body.notes || body.comment,
      operator: operatorName(req)
    });

    await recordActivity({
      admin: operatorName(req),
      action: "editorial_review_note",
      target: String(req.params.recruitmentId),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    // Package 4D — operator notes are part of the shared preview snapshot.
    await sharedPreviewService.refreshAfterChange(
      req.params.recruitmentId,
      "review_decision",
      operatorName(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("EDITORIAL REVIEW NOTE ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to add review note"
    });
  }
}

module.exports = {
  listEditorialReviewInbox,
  getEditorialReviewWorkspace,
  applyEditorialReviewDecision,
  addEditorialReviewNote
};
