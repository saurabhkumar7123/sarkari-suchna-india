"use strict";

const db = require("../config/db");

const LINKAGE_COLUMNS = "id, slug, recruitment_id, recruitment_event_id";

async function linkageColumnsExist() {
  try {
    const [rows] = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'pages'
         AND column_name IN ('recruitment_id', 'recruitment_event_id')`
    );
    const names = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
    return names.has("recruitment_id") && names.has("recruitment_event_id");
  } catch {
    return false;
  }
}

async function findPageLinkageById(pageId) {
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS} FROM pages WHERE id = ? AND deleted = 0 LIMIT 1`,
    [pageId]
  );
  return rows[0] || null;
}

async function findPageLinkageBySlug(slug) {
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS} FROM pages WHERE slug = ? AND deleted = 0 LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

/**
 * @param {number} pageId
 * @param {{ recruitment_id: number | null, recruitment_event_id: number | null }} linkage
 */
async function setPageLinkage(pageId, linkage) {
  const [result] = await db.query(
    `UPDATE pages
     SET recruitment_id = ?, recruitment_event_id = ?
     WHERE id = ? AND deleted = 0`,
    [linkage.recruitment_id ?? null, linkage.recruitment_event_id ?? null, pageId]
  );
  if (result.affectedRows === 0) {
    return null;
  }
  return findPageLinkageById(pageId);
}

async function clearPageLinkage(pageId) {
  return setPageLinkage(pageId, { recruitment_id: null, recruitment_event_id: null });
}

/**
 * @param {{ recruitment_id: number, page?: number, limit?: number }} opts
 */
async function listPageLinkagesByRecruitmentId(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [opts.recruitment_id];
  const where = "WHERE deleted = 0 AND recruitment_id = ?";

  const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM pages ${where}`, params);
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS}
     FROM pages ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countRow && countRow.total != null ? Number(countRow.total) : 0
    }
  };
}

/**
 * @param {{ recruitment_event_id: number, page?: number, limit?: number }} opts
 */
async function listPageLinkagesByRecruitmentEventId(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [opts.recruitment_event_id];
  const where = "WHERE deleted = 0 AND recruitment_event_id = ?";

  const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM pages ${where}`, params);
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS}
     FROM pages ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countRow && countRow.total != null ? Number(countRow.total) : 0
    }
  };
}

async function clearLinkagesByRecruitmentId(recruitmentId) {
  const ready = await linkageColumnsExist();
  if (!ready) return 0;
  const [result] = await db.query(
    `UPDATE pages
     SET recruitment_id = NULL, recruitment_event_id = NULL
     WHERE recruitment_id = ?`,
    [recruitmentId]
  );
  return Number(result.affectedRows) || 0;
}

/**
 * Pages linked to a recruitment_id that no longer exists (or orphaned event ids).
 */
async function countBrokenPageLinks() {
  const ready = await linkageColumnsExist();
  if (!ready) return 0;
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM pages p
       WHERE p.deleted = 0
         AND p.recruitment_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM recruitments r WHERE r.id = p.recruitment_id
         )`
    );
    return Number(row && row.total) || 0;
  } catch {
    return 0;
  }
}

module.exports = {
  linkageColumnsExist,
  findPageLinkageById,
  findPageLinkageBySlug,
  setPageLinkage,
  clearPageLinkage,
  clearLinkagesByRecruitmentId,
  listPageLinkagesByRecruitmentId,
  listPageLinkagesByRecruitmentEventId,
  countBrokenPageLinks
};
