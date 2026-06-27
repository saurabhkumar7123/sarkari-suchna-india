"use strict";

const generatorDraftRepository = require("../repositories/generatorDraft.repository");
const { MAX_GENERATOR_DRAFTS } = require("../config/generatorDrafts");

function assertTable() {
  return generatorDraftRepository.tableExists().then((ok) => {
    if (!ok) {
      const err = new Error(
        "generator_drafts table is missing. Run db/migrations/2026-06-27-generator-drafts.sql"
      );
      err.statusCode = 503;
      throw err;
    }
  });
}

function normalizeTitle(payload = {}) {
  const title = String(payload.title || "").trim();
  return title || "Untitled draft";
}

function normalizeSlugHint(payload = {}) {
  const url = String(payload.pageUrl || payload.slug || "").trim();
  if (!url) return null;
  return url.replace(/^\//, "").replace(/\.html$/i, "") || null;
}

function hasMeaningfulContent(payload = {}) {
  const title = String(payload.title || "").trim();
  const data = String(payload.data || payload.content || payload.text || "").trim();
  return title.length >= 3 || data.length >= 20;
}

async function saveDraft({ id, payload }) {
  await assertTable();
  if (!payload || typeof payload !== "object") {
    const err = new Error("Invalid draft payload");
    err.statusCode = 400;
    throw err;
  }
  if (!hasMeaningfulContent(payload)) {
    const err = new Error("Add a title (3+ chars) or content (20+ chars) before saving draft.");
    err.statusCode = 400;
    throw err;
  }

  const title = normalizeTitle(payload);
  const slugHint = normalizeSlugHint(payload);
  const draftId = id != null ? parseInt(String(id), 10) : 0;

  if (Number.isInteger(draftId) && draftId > 0) {
    const existing = await generatorDraftRepository.findById(draftId);
    if (!existing) {
      const err = new Error("Draft not found");
      err.statusCode = 404;
      throw err;
    }
    if (existing.status !== "draft") {
      const err = new Error("Only unpublished drafts can be updated");
      err.statusCode = 400;
      throw err;
    }
    const updated = await generatorDraftRepository.updateDraft(draftId, {
      title,
      slugHint,
      payload
    });
    if (!updated) {
      const err = new Error("Draft could not be updated");
      err.statusCode = 409;
      throw err;
    }
    return generatorDraftRepository.findById(draftId);
  }

  const count = await generatorDraftRepository.countByStatus("draft");
  if (count >= MAX_GENERATOR_DRAFTS) {
    const err = new Error(`Draft limit reached (${MAX_GENERATOR_DRAFTS}). Publish or delete an old draft first.`);
    err.statusCode = 409;
    throw err;
  }

  const insertId = await generatorDraftRepository.insertDraft({ title, slugHint, payload });
  return generatorDraftRepository.findById(insertId);
}

async function listDrafts(query = {}) {
  await assertTable();
  const draftRows = await generatorDraftRepository.listDrafts({
    status: "draft",
    limit: query.limit
  });
  const publishedRows = await generatorDraftRepository.listDrafts({
    status: "published",
    limit: query.limit
  });
  const draftCount = await generatorDraftRepository.countByStatus("draft");
  return {
    drafts: draftRows,
    published: publishedRows,
    draftCount,
    maxDrafts: MAX_GENERATOR_DRAFTS
  };
}

async function getDraftById(id) {
  await assertTable();
  const row = await generatorDraftRepository.findById(id);
  if (!row) {
    const err = new Error("Draft not found");
    err.statusCode = 404;
    throw err;
  }
  return row;
}

async function markDraftPublished(id, { publishedSlug, publishedPageId }) {
  await assertTable();
  const ok = await generatorDraftRepository.markPublished(id, { publishedSlug, publishedPageId });
  if (!ok) {
    const err = new Error("Draft not found or already published");
    err.statusCode = 404;
    throw err;
  }
  return generatorDraftRepository.findById(id);
}

async function deleteDraftById(id) {
  await assertTable();
  const ok = await generatorDraftRepository.deleteDraft(id);
  if (!ok) {
    const err = new Error("Draft not found or already published");
    err.statusCode = 404;
    throw err;
  }
  return { deleted: id };
}

module.exports = {
  saveDraft,
  listDrafts,
  getDraftById,
  markDraftPublished,
  deleteDraftById,
  MAX_GENERATOR_DRAFTS
};
