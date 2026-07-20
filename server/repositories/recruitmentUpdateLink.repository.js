"use strict";

const db = require("../config/db");

const LINKAGE_COLUMNS =
  "id, site_id, title, link, recruitment_id, recruitment_event_id, created_at";

async function linkageColumnsExist() {
  try {
    const [rows] = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'updates'
         AND column_name IN ('recruitment_id', 'recruitment_event_id')`
    );
    const names = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
    return names.has("recruitment_id") && names.has("recruitment_event_id");
  } catch {
    return false;
  }
}

async function findUpdateLinkageById(updateId) {
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS} FROM updates WHERE id = ? LIMIT 1`,
    [updateId]
  );
  return rows[0] || null;
}

/**
 * @param {number} updateId
 * @param {{ recruitment_id: number | null, recruitment_event_id: number | null }} linkage
 */
async function setUpdateLinkage(updateId, linkage) {
  const [result] = await db.query(
    `UPDATE updates
     SET recruitment_id = ?, recruitment_event_id = ?
     WHERE id = ?`,
    [linkage.recruitment_id ?? null, linkage.recruitment_event_id ?? null, updateId]
  );
  if (result.affectedRows === 0) {
    return null;
  }
  return findUpdateLinkageById(updateId);
}

async function clearUpdateLinkage(updateId) {
  return setUpdateLinkage(updateId, { recruitment_id: null, recruitment_event_id: null });
}

/**
 * @param {{ recruitment_id: number, page?: number, limit?: number }} opts
 */
async function listUpdateLinkagesByRecruitmentId(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [opts.recruitment_id];
  const where = "WHERE recruitment_id = ?";

  const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM updates ${where}`, params);
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS}
     FROM updates ${where}
     ORDER BY created_at DESC, id DESC
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
async function listUpdateLinkagesByRecruitmentEventId(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [opts.recruitment_event_id];
  const where = "WHERE recruitment_event_id = ?";

  const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM updates ${where}`, params);
  const [rows] = await db.query(
    `SELECT ${LINKAGE_COLUMNS}
     FROM updates ${where}
     ORDER BY created_at DESC, id DESC
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

module.exports = {
  linkageColumnsExist,
  findUpdateLinkageById,
  setUpdateLinkage,
  clearUpdateLinkage,
  listUpdateLinkagesByRecruitmentId,
  listUpdateLinkagesByRecruitmentEventId
};
