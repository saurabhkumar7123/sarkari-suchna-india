"use strict";

const db = require("../config/db");

const SELECT_COLUMNS =
  "id, recruitment_id, event_type, sequence_order, status, created_at, updated_at";

async function tableExists() {
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'recruitment_events' LIMIT 1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   recruitment_id: number,
 *   event_type: string,
 *   sequence_order: number,
 *   status: string
 * }} row
 */
async function createRecruitmentEvent(row) {
  const [result] = await db.query(
    `INSERT INTO recruitment_events (recruitment_id, event_type, sequence_order, status)
     VALUES (?, ?, ?, ?)`,
    [row.recruitment_id, row.event_type, row.sequence_order, row.status]
  );
  return getRecruitmentEventById(result.insertId);
}

async function getRecruitmentEventById(id) {
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM recruitment_events WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * @param {{ recruitment_id: number, status?: string, page?: number, limit?: number }} opts
 */
async function listRecruitmentEventsByRecruitmentId(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [opts.recruitment_id];
  let where = "WHERE recruitment_id = ?";

  if (opts.status) {
    where += " AND status = ?";
    params.push(opts.status);
  }

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM recruitment_events ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS}
     FROM recruitment_events ${where}
     ORDER BY sequence_order ASC, id ASC
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
 * @param {number} id
 * @param {{
 *   recruitment_id: number,
 *   event_type: string,
 *   sequence_order: number,
 *   status: string
 * }} row
 */
async function updateRecruitmentEvent(id, row) {
  const [result] = await db.query(
    `UPDATE recruitment_events
     SET recruitment_id = ?, event_type = ?, sequence_order = ?, status = ?
     WHERE id = ?`,
    [row.recruitment_id, row.event_type, row.sequence_order, row.status, id]
  );
  if (result.affectedRows === 0) {
    return null;
  }
  return getRecruitmentEventById(id);
}

async function deleteRecruitmentEvent(id) {
  const existing = await getRecruitmentEventById(id);
  if (!existing) return null;
  const [result] = await db.query("DELETE FROM recruitment_events WHERE id = ?", [id]);
  return result.affectedRows > 0 ? existing : null;
}

async function deleteEventsByRecruitmentId(recruitmentId) {
  const ok = await tableExists();
  if (!ok) return 0;
  const [result] = await db.query(
    "DELETE FROM recruitment_events WHERE recruitment_id = ?",
    [recruitmentId]
  );
  return Number(result.affectedRows) || 0;
}

module.exports = {
  tableExists,
  createRecruitmentEvent,
  getRecruitmentEventById,
  listRecruitmentEventsByRecruitmentId,
  updateRecruitmentEvent,
  deleteRecruitmentEvent,
  deleteEventsByRecruitmentId
};
