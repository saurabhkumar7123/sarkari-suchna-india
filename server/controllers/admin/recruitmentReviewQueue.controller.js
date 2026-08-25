"use strict";

/**
 * Phase 28 — Admin recruitment review queue handlers.
 * Phase 29 — Attach read-only comparison / decision assistant on detail responses.
 */

const recruitmentReviewService = require("../../services/recruitmentReview.service");
const { REVIEW_DECISIONS } = require("../../lib/recruitment/reviewQueue");
const { buildReviewAssistView } = require("../../lib/recruitment/reviewComparison");
const {
  resolveNeedsMatchingCandidates
} = require("../../lib/recruitment/normalizeNeedsMatchingCandidates");

function sendServiceError(res, err) {
  const statusCode = err && err.statusCode ? err.statusCode : 500;
  return res.status(statusCode).json({
    success: false,
    message: err && err.message ? err.message : "Request failed"
  });
}

/** Phase 29 — attach read-only comparison / recommendation (no persistence). */
function withAssistView(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    assist: buildReviewAssistView(row),
    needs_matching_candidates: resolveNeedsMatchingCandidates(row)
  };
}

const listRecruitmentReviewQueueHandler = async (req, res) => {
  try {
    const result = await recruitmentReviewService.listReviewItems({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      event_type: req.query.event_type,
      recruitment_id: req.query.recruitment_id,
      search: req.query.search
    });
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const getRecruitmentReviewQueueHandler = async (req, res) => {
  try {
    const row = await recruitmentReviewService.getReviewItemById(req.params.id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Review item not found"
      });
    }
    res.json({ success: true, data: withAssistView(row) });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const approveRecruitmentReviewHandler = async (req, res) => {
  try {
    const updated = await recruitmentReviewService.updateReviewDecision(req.params.id, {
      decision: REVIEW_DECISIONS.APPROVE,
      notes: req.body && req.body.notes !== undefined ? req.body.notes : undefined
    });
    res.json({ success: true, data: withAssistView(updated) });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const rejectRecruitmentReviewHandler = async (req, res) => {
  try {
    const updated = await recruitmentReviewService.updateReviewDecision(req.params.id, {
      decision: REVIEW_DECISIONS.REJECT,
      notes: req.body && req.body.notes !== undefined ? req.body.notes : undefined
    });
    res.json({ success: true, data: withAssistView(updated) });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const markUnderReviewRecruitmentReviewHandler = async (req, res) => {
  try {
    const updated = await recruitmentReviewService.updateReviewDecision(req.params.id, {
      decision: REVIEW_DECISIONS.SKIP,
      notes: req.body && req.body.notes !== undefined ? req.body.notes : undefined
    });
    res.json({ success: true, data: withAssistView(updated) });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const freezeRecruitmentReviewHandler = async (req, res) => {
  try {
    const updated = await recruitmentReviewService.freezeReviewItem(req.params.id);
    res.json({ success: true, data: withAssistView(updated) });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const updateRecruitmentReviewNotesHandler = async (req, res) => {
  try {
    const updated = await recruitmentReviewService.updateReviewNotes(req.params.id, {
      notes: req.body && req.body.notes !== undefined ? req.body.notes : undefined
    });
    res.json({ success: true, data: withAssistView(updated) });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

const resolveNeedsMatchingHandler = async (req, res) => {
  try {
    const recruitmentLifecycleService = require("../../services/recruitmentLifecycle.service");
    const result = await recruitmentLifecycleService.resolveNeedsMatching({
      reviewId: req.params.id,
      action: req.body && req.body.action,
      recruitmentId: req.body && req.body.recruitment_id,
      eventType: req.body && req.body.event_type,
      notes: req.body && req.body.notes
    });
    const row = await recruitmentReviewService.getReviewItemById(req.params.id);
    res.json({ success: true, data: withAssistView(row), resolution: result });
  } catch (err) {
    return sendServiceError(res, err);
  }
};

module.exports = {
  listRecruitmentReviewQueueHandler,
  getRecruitmentReviewQueueHandler,
  approveRecruitmentReviewHandler,
  rejectRecruitmentReviewHandler,
  markUnderReviewRecruitmentReviewHandler,
  freezeRecruitmentReviewHandler,
  updateRecruitmentReviewNotesHandler,
  resolveNeedsMatchingHandler
};
