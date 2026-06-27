"use strict";

const db = require("../config/db");

const LIST_COLUMNS =
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

async function countByStatus(status = "draft") {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS n FROM generator_drafts WHERE status = ?`,
    [status]
  );
  return row && row.n != null ? Number(row.n) : 0;
}

async function insertDraft({ title, slugHint, payload }) {
  const [result] = await db.query(
    `INSERT INTO generator_drafts (title, slug_hint, payload, status)
     VALUES (?, ?, ?, 'draft')`,
    [title || "", slugHint || null, JSON.stringify(payload || {})]
  );
  return result.insertId;
}

async function updateDraft(id, { title, slugHint, payload }) {
  const [result] = await db.query(
    `UPDATE generator_drafts
     SET title = ?, slug_hint = ?, payload = ?, updated_at = NOW()
     WHERE id = ? AND status = 'draft'`,
    [title || "", slugHint || null, JSON.stringify(payload || {}), id]
  );
  return result.affectedRows > 0;
}

async function findById(id) {
  const [rows] = await db.query(
    `SELECT id, title, slug_hint, payload, status, published_slug, published_page_id,
            created_at, updated_at, published_at
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
  const [rows] = await db.query(
    `SELECT ${LIST_COLUMNS}
     FROM generator_drafts ${where}
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT ?`,
    [...params, limit]
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

module.exports = {
  tableExists,
  countByStatus,
  insertDraft,
  updateDraft,
  findById,
  listDrafts,
  markPublished,
  deleteDraft
};
