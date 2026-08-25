"use strict";

const generatorDraftRepository = require("../repositories/generatorDraft.repository");
const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");
const { MAX_GENERATOR_DRAFTS } = require("../config/generatorDrafts");
const { isRecruitmentEditorialAttachmentEnabled } = require("../config/recruitmentLifecycle");

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

function parseOptionalPositiveId(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

async function assertLinkageColumnsReady() {
  const ok = await generatorDraftRepository.linkageColumnsExist();
  if (!ok) {
    const err = new Error(
      "generator_drafts recruitment linkage columns are missing. Run db/migrations/2026-07-13-add-generator-drafts-recruitment-linkage.sql"
    );
    err.statusCode = 503;
    throw err;
  }
}

async function assertRecruitmentExists(recruitmentId) {
  const recruitment = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!recruitment) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return recruitment;
}

async function assertRecruitmentEventExists(recruitmentEventId, recruitmentId) {
  const event = await recruitmentEventRepository.getRecruitmentEventById(recruitmentEventId);
  if (!event) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  if (Number(event.recruitment_id) !== Number(recruitmentId)) {
    const err = new Error("recruitment_event_id does not belong to recruitment_id");
    err.statusCode = 400;
    throw err;
  }
  return event;
}

async function resolveRecruitmentContext({ recruitmentId, recruitmentEventId, existing = null }) {
  if (!isRecruitmentEditorialAttachmentEnabled()) {
    return { withRecruitmentLinkage: false };
  }

  const hasRecruitmentInput = recruitmentId !== undefined;
  const hasEventInput = recruitmentEventId !== undefined;
  if (!hasRecruitmentInput && !hasEventInput) {
    return { withRecruitmentLinkage: false };
  }

  await assertLinkageColumnsReady();

  let resolvedRecruitmentId = hasRecruitmentInput
    ? parseOptionalPositiveId(recruitmentId, "recruitment_id")
    : existing?.recruitment_id != null
      ? Number(existing.recruitment_id)
      : null;
  let resolvedEventId = hasEventInput
    ? parseOptionalPositiveId(recruitmentEventId, "recruitment_event_id")
    : existing?.recruitment_event_id != null
      ? Number(existing.recruitment_event_id)
      : null;

  if (hasRecruitmentInput && resolvedRecruitmentId == null) {
    resolvedEventId = null;
  }

  if (resolvedEventId != null && resolvedRecruitmentId == null) {
    const err = new Error("recruitment_id is required when recruitment_event_id is set");
    err.statusCode = 400;
    throw err;
  }

  if (resolvedRecruitmentId != null) {
    await assertRecruitmentExists(resolvedRecruitmentId);
  }

  if (resolvedEventId != null) {
    await assertRecruitmentEventExists(resolvedEventId, resolvedRecruitmentId);
  }

  return {
    withRecruitmentLinkage: true,
    recruitmentId: resolvedRecruitmentId,
    recruitmentEventId: resolvedEventId
  };
}

async function saveDraft({ id, payload, recruitmentId, recruitmentEventId }) {
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

    const linkage = await resolveRecruitmentContext({
      recruitmentId,
      recruitmentEventId,
      existing
    });

    const updated = await generatorDraftRepository.updateDraft(draftId, {
      title,
      slugHint,
      payload,
      recruitmentId: linkage.recruitmentId,
      recruitmentEventId: linkage.recruitmentEventId,
      withRecruitmentLinkage: linkage.withRecruitmentLinkage
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

  const linkage = await resolveRecruitmentContext({
    recruitmentId,
    recruitmentEventId,
    existing: null
  });

  const insertId = await generatorDraftRepository.insertDraft({
    title,
    slugHint,
    payload,
    recruitmentId: linkage.recruitmentId,
    recruitmentEventId: linkage.recruitmentEventId,
    withRecruitmentLinkage: linkage.withRecruitmentLinkage
  });
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

async function findUnpublishedDraftByUpdateId(updateId) {
  await assertTable();
  return generatorDraftRepository.findUnpublishedDraftByUpdateId(updateId);
}

async function listDraftsByRecruitmentId(recruitmentId, query = {}) {
  await assertTable();
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Invalid recruitment id");
    err.statusCode = 400;
    throw err;
  }
  return generatorDraftRepository.listDraftsByRecruitmentId({
    recruitment_id: id,
    limit: query.limit
  });
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

/**
 * Lifecycle ATTACH / Needs Matching rebind.
 * Writes recruitment linkage even when editorial-attachment feature flag is off.
 */
async function bindDraftRecruitmentLinkage(id, { recruitmentId, recruitmentEventId } = {}) {
  await assertTable();
  await assertLinkageColumnsReady();
  const draftId = parseInt(String(id), 10);
  if (!Number.isInteger(draftId) || draftId <= 0) {
    const err = new Error("Invalid draft id");
    err.statusCode = 400;
    throw err;
  }
  const rid = parseOptionalPositiveId(recruitmentId, "recruitment_id");
  const eid =
    recruitmentEventId === undefined
      ? null
      : parseOptionalPositiveId(recruitmentEventId, "recruitment_event_id");
  if (rid == null) {
    const err = new Error("recruitment_id is required");
    err.statusCode = 400;
    throw err;
  }
  await assertRecruitmentExists(rid);
  if (eid != null) {
    await assertRecruitmentEventExists(eid, rid);
  }
  const existing = await generatorDraftRepository.findById(draftId);
  if (!existing) {
    const err = new Error("Draft not found");
    err.statusCode = 404;
    throw err;
  }
  if (String(existing.status) !== "draft") {
    const err = new Error("Only unpublished drafts can be rebound");
    err.statusCode = 400;
    throw err;
  }
  const ok = await generatorDraftRepository.updateDraftLinkage(draftId, {
    recruitmentId: rid,
    recruitmentEventId: eid
  });
  if (!ok) {
    const err = new Error("Draft linkage could not be updated");
    err.statusCode = 409;
    throw err;
  }
  return generatorDraftRepository.findById(draftId);
}

module.exports = {
  saveDraft,
  listDrafts,
  findUnpublishedDraftByUpdateId,
  listDraftsByRecruitmentId,
  getDraftById,
  markDraftPublished,
  deleteDraftById,
  bindDraftRecruitmentLinkage,
  MAX_GENERATOR_DRAFTS
};
