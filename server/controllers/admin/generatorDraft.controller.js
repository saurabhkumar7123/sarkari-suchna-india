"use strict";

const generatorDraftService = require("../../services/generatorDraft.service");
const { recordActivity } = require("../../services/adminActivity.service");
const { isGeneratorDraftsEnabled } = require("../../config/generatorDrafts");

function draftsDisabled(res) {
  return res.status(503).json({
    success: false,
    message: "Generator drafts are disabled (GENERATOR_DRAFTS_ENABLED=0)"
  });
}

function formatDraftSummary(row) {
  const data = {
    id: row.id,
    title: row.title,
    slugHint: row.slug_hint,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedSlug: row.published_slug,
    publishedPageId: row.published_page_id,
    publishedAt: row.published_at,
    recruitmentId: row.recruitment_id != null ? Number(row.recruitment_id) : null,
    recruitmentEventId:
      row.recruitment_event_id != null ? Number(row.recruitment_event_id) : null
  };
  return data;
}

function formatDraftDetail(row, extras = {}) {
  const data = {
    id: row.id,
    title: row.title,
    slugHint: row.slug_hint,
    payload: row.payload || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedSlug: row.published_slug || null,
    publishedPageId: row.published_page_id != null ? Number(row.published_page_id) : null,
    recruitmentId: row.recruitment_id != null ? Number(row.recruitment_id) : null,
    recruitmentEventId:
      row.recruitment_event_id != null ? Number(row.recruitment_event_id) : null,
    recruitmentTitle: extras.recruitmentTitle || null,
    eventLabel: extras.eventLabel || null,
    linkedPublicPage: extras.linkedPublicPage || null
  };
  return data;
}

async function listGeneratorDrafts(req, res) {
  if (!isGeneratorDraftsEnabled()) return draftsDisabled(res);
  try {
    const payload = await generatorDraftService.listDrafts({ limit: req.query.limit });
    const data = {
      drafts: (payload.drafts || []).map(formatDraftSummary),
      published: (payload.published || []).map(formatDraftSummary),
      draftCount: payload.draftCount,
      maxDrafts: payload.maxDrafts
    };
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("GENERATOR DRAFT LIST ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to list drafts"
    });
  }
}

async function getGeneratorDraft(req, res) {
  if (!isGeneratorDraftsEnabled()) return draftsDisabled(res);
  try {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid draft id" });
    }
    const ctx = await generatorDraftService.getDraftWithPublishContext(id);
    const row = ctx.row;
    if (row.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "This draft is already published. Open the live page from the sidebar.",
        data: {
          id: row.id,
          status: row.status,
          title: row.title,
          publishedSlug: row.published_slug || null,
          publishedPageId:
            row.published_page_id != null ? Number(row.published_page_id) : null,
          recruitmentId: row.recruitment_id != null ? Number(row.recruitment_id) : null,
          linkedPublicPage: ctx.linkedPublicPage
        }
      });
    }
    return res.json({
      success: true,
      data: formatDraftDetail(row, {
        linkedPublicPage: ctx.linkedPublicPage,
        recruitmentTitle: ctx.recruitmentTitle,
        eventLabel: ctx.eventLabel
      })
    });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("GENERATOR DRAFT GET ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to load draft"
    });
  }
}

async function saveGeneratorDraft(req, res) {
  if (!isGeneratorDraftsEnabled()) return draftsDisabled(res);
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const id = body.id != null ? parseInt(String(body.id), 10) : 0;
    const row = await generatorDraftService.saveDraft({
      id: Number.isInteger(id) && id > 0 ? id : null,
      payload: body.payload,
      recruitmentId: body.recruitment_id,
      recruitmentEventId: body.recruitment_event_id
    });

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: id > 0 ? "generator_draft_update" : "generator_draft_save",
      target: String(row.id),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({
      success: true,
      data: formatDraftDetail(row)
    });
  } catch (err) {
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "generator_draft_save",
      target: "",
      status: "fail",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("GENERATOR DRAFT SAVE ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to save draft"
    });
  }
}

async function markGeneratorDraftPublished(req, res) {
  if (!isGeneratorDraftsEnabled()) return draftsDisabled(res);
  try {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid draft id" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const publishedSlug = String(body.publishedSlug || body.slug || "").trim().replace(/^\//, "").replace(/\.html$/i, "");
    const publishedPageId =
      body.publishedPageId != null && body.publishedPageId !== ""
        ? parseInt(String(body.publishedPageId), 10)
        : null;

    const row = await generatorDraftService.markDraftPublished(id, {
      publishedSlug: publishedSlug || null,
      publishedPageId: Number.isInteger(publishedPageId) ? publishedPageId : null
    });

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "generator_draft_publish",
      target: String(id),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({
      success: true,
      data: {
        id: row.id,
        title: row.title,
        status: row.status,
        publishedSlug: row.published_slug,
        publishedPageId: row.published_page_id,
        publishedAt: row.published_at
      }
    });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("GENERATOR DRAFT PUBLISH MARK ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to mark draft published"
    });
  }
}

async function deleteGeneratorDraft(req, res) {
  if (!isGeneratorDraftsEnabled()) return draftsDisabled(res);
  try {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid draft id" });
    }
    await generatorDraftService.deleteDraftById(id);

    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "generator_draft_delete",
      target: String(id),
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});

    return res.json({ success: true, deleted: id });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (status >= 500) console.error("GENERATOR DRAFT DELETE ERROR:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to delete draft"
    });
  }
}

module.exports = {
  listGeneratorDrafts,
  getGeneratorDraft,
  saveGeneratorDraft,
  markGeneratorDraftPublished,
  deleteGeneratorDraft
};
