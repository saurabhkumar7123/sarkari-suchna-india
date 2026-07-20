"use strict";

const db = require("../config/db");

const LIST_COLUMNS_BASE =
  "id, title, slug_hint, status, published_slug, published_page_id, created_at, updated_at, published_at";

async function tableExists() {
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'generator_drafts' LIMIT 1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function linkageColumnsExist() {
  try {
    const [rows] = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'generator_drafts'
         AND column_name IN ('recruitment_id', 'recruitment_event_id')`
    );
    const names = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
    return names.has("recruitment_id") && names.has("recruitment_event_id");
  } catch {
    return false;
  }
}

async function countByStatus(status = "draft") {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS n FROM generator_drafts WHERE status = ?`,
    [status]
  );
  return row && row.n != null ? Number(row.n) : 0;
}

async function insertDraft({
  title,
  slugHint,
  payload,
  recruitmentId = null,
  recruitmentEventId = null,
  withRecruitmentLinkage = false
}) {
  const payloadJson = JSON.stringify(payload || {});
  if (withRecruitmentLinkage && (await linkageColumnsExist())) {
    const [result] = await db.query(
      `INSERT INTO generator_drafts (title, slug_hint, payload, status, recruitment_id, recruitment_event_id)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
      [title || "", slugHint || null, payloadJson, recruitmentId ?? null, recruitmentEventId ?? null]
    );
    return result.insertId;
  }

  const [result] = await db.query(
    `INSERT INTO generator_drafts (title, slug_hint, payload, status)
     VALUES (?, ?, ?, 'draft')`,
    [title || "", slugHint || null, payloadJson]
  );
  return result.insertId;
}

async function updateDraft(
  id,
  {
    title,
    slugHint,
    payload,
    recruitmentId = null,
    recruitmentEventId = null,
    withRecruitmentLinkage = false
  }
) {
  const payloadJson = JSON.stringify(payload || {});
  if (withRecruitmentLinkage && (await linkageColumnsExist())) {
    const [result] = await db.query(
      `UPDATE generator_drafts
       SET title = ?, slug_hint = ?, payload = ?, recruitment_id = ?, recruitment_event_id = ?, updated_at = NOW()
       WHERE id = ? AND status = 'draft'`,
      [
        title || "",
        slugHint || null,
        payloadJson,
        recruitmentId ?? null,
        recruitmentEventId ?? null,
        id
      ]
    );
    return result.affectedRows > 0;
  }

  const [result] = await db.query(
    `UPDATE generator_drafts
     SET title = ?, slug_hint = ?, payload = ?, updated_at = NOW()
     WHERE id = ? AND status = 'draft'`,
    [title || "", slugHint || null, JSON.stringify(payload || {}), id]
  );
  return result.affectedRows > 0;
}

async function findById(id) {
  const hasLinkage = await linkageColumnsExist();
  const linkageSelect = hasLinkage ? ", recruitment_id, recruitment_event_id" : "";
  const [rows] = await db.query(
    `SELECT id, title, slug_hint, payload, status, published_slug, published_page_id,
            created_at, updated_at, published_at${linkageSelect}
     FROM generator_drafts WHERE id = ? LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.payload && typeof row.payload === "string") {
    try {
      row.payload = JSON.parse(row.payload);
    } catch {
      row.payload = {};
    }
  }
  return row;
}

async function listDrafts(opts = {}) {
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 30), 10) || 30));
  const params = [];
  let where = "WHERE 1=1";
  const status = opts.status ? String(opts.status).trim().toLowerCase() : "";
  if (status && ["draft", "published"].includes(status)) {
    where += " AND status = ?";
    params.push(status);
  }
  const hasLinkage = await linkageColumnsExist();
  const listColumns = hasLinkage
    ? `${LIST_COLUMNS_BASE}, recruitment_id, recruitment_event_id`
    : LIST_COLUMNS_BASE;
  const [rows] = await db.query(
    `SELECT ${listColumns}
     FROM generator_drafts ${where}
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

/**
 * @param {{ recruitment_id: number, limit?: number }} opts
 */
async function listDraftsByRecruitmentId(opts = {}) {
  const recruitmentId = parseInt(String(opts.recruitment_id), 10);
  if (!Number.isInteger(recruitmentId) || recruitmentId <= 0) {
    return [];
  }
  if (!(await linkageColumnsExist())) {
    return [];
  }

  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 30), 10) || 30));
  const [rows] = await db.query(
    `SELECT ${LIST_COLUMNS_BASE}, recruitment_id, recruitment_event_id
     FROM generator_drafts
     WHERE recruitment_id = ?
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT ?`,
    [recruitmentId, limit]
  );
  return rows;
}

async function markPublished(id, { publishedSlug, publishedPageId }) {
  const [result] = await db.query(
    `UPDATE generator_drafts
     SET status = 'published',
         published_slug = ?,
         published_page_id = ?,
         published_at = NOW(),
         updated_at = NOW()
     WHERE id = ? AND status = 'draft'`,
    [publishedSlug || null, publishedPageId != null ? publishedPageId : null, id]
  );
  return result.affectedRows > 0;
}

async function deleteDraft(id) {
  const [result] = await db.query(
    `DELETE FROM generator_drafts WHERE id = ? AND status = 'draft' LIMIT 1`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Package 4C — update recruitment linkage only (does not rewrite payload).
 */
async function updateDraftLinkage(id, { recruitmentId = null, recruitmentEventId = null } = {}) {
  if (!(await linkageColumnsExist())) {
    return false;
  }
  const [result] = await db.query(
    `UPDATE generator_drafts
     SET recruitment_id = ?, recruitment_event_id = ?, updated_at = NOW()
     WHERE id = ? AND status = 'draft'`,
    [recruitmentId ?? null, recruitmentEventId ?? null, id]
  );
  return result.affectedRows > 0;
}

/**
 * List unpublished drafts that are not bound to any recruitment.
 */
async function listUnboundDrafts(opts = {}) {
  if (!(await linkageColumnsExist())) {
    return [];
  }
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 30), 10) || 30));
  const [rows] = await db.query(
    `SELECT ${LIST_COLUMNS_BASE}, recruitment_id, recruitment_event_id
     FROM generator_drafts
     WHERE status = 'draft' AND recruitment_id IS NULL
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = {
  tableExists,
  linkageColumnsExist,
  countByStatus,
  insertDraft,
  updateDraft,
  findById,
  listDrafts,
  listDraftsByRecruitmentId,
  markPublished,
  deleteDraft,
  updateDraftLinkage,
  listUnboundDrafts
};
