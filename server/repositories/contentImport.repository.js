"use strict";

const db = require("../config/db");

const LIST_COLUMNS_BASE =
  "id, LEFT(content, 200) AS content_preview, source_file, row_index, status, created_at, opened_at";

async function tableExists() {
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'content_imports' LIMIT 1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrated schema (LI2-02 Wave 4) adds nullable bridge columns.
 * Detection keeps legacy inserts working when columns are absent.
 */
async function linkageColumnsExist() {
  try {
    const [rows] = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'content_imports'
         AND column_name IN ('recruitment_id', 'recruitment_event_id')`
    );
    const names = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
    return names.has("recruitment_id") && names.has("recruitment_event_id");
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   content: string,
 *   sourceFile?: string|null,
 *   rowIndex?: number|null,
 *   recruitmentId?: number|null,
 *   recruitmentEventId?: number|null,
 *   withRecruitmentLinkage?: boolean
 * }} row
 * @returns {Promise<number>} insert id
 */
async function insertOne(row) {
  if (row.withRecruitmentLinkage && (await linkageColumnsExist())) {
    const [result] = await db.query(
      `INSERT INTO content_imports
         (content, source_file, row_index, status, recruitment_id, recruitment_event_id)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [
        row.content,
        row.sourceFile || null,
        row.rowIndex != null ? row.rowIndex : null,
        row.recruitmentId ?? null,
        row.recruitmentEventId ?? null
      ]
    );
    return result.insertId;
  }

  const [result] = await db.query(
    `INSERT INTO content_imports (content, source_file, row_index, status)
     VALUES (?, ?, ?, 'pending')`,
    [row.content, row.sourceFile || null, row.rowIndex != null ? row.rowIndex : null]
  );
  return result.insertId;
}

/**
 * @param {Array<{
 *   content: string,
 *   sourceFile?: string|null,
 *   rowIndex?: number|null,
 *   recruitmentId?: number|null,
 *   recruitmentEventId?: number|null,
 *   withRecruitmentLinkage?: boolean
 * }>} rows
 * @returns {Promise<number[]>}
 */
async function insertMany(rows) {
  if (!rows.length) return [];
  const ids = [];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const hasLinkage = await linkageColumnsExist();
    for (const row of rows) {
      if (row.withRecruitmentLinkage && hasLinkage) {
        const [result] = await conn.query(
          `INSERT INTO content_imports
             (content, source_file, row_index, status, recruitment_id, recruitment_event_id)
           VALUES (?, ?, ?, 'pending', ?, ?)`,
          [
            row.content,
            row.sourceFile || null,
            row.rowIndex != null ? row.rowIndex : null,
            row.recruitmentId ?? null,
            row.recruitmentEventId ?? null
          ]
        );
        ids.push(result.insertId);
      } else {
        const [result] = await conn.query(
          `INSERT INTO content_imports (content, source_file, row_index, status)
           VALUES (?, ?, ?, 'pending')`,
          [row.content, row.sourceFile || null, row.rowIndex != null ? row.rowIndex : null]
        );
        ids.push(result.insertId);
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return ids;
}

/**
 * @param {{ page?: number, limit?: number, status?: string, recruitment_id?: number }} opts
 */
async function listImports(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(opts.limit || 50), 10) || 50));
  const offset = (page - 1) * limit;
  const params = [];
  let where = "WHERE 1=1";
  const status = opts.status ? String(opts.status).trim().toLowerCase() : "";
  if (status && ["pending", "opened", "published", "discarded"].includes(status)) {
    where += " AND status = ?";
    params.push(status);
  }

  const hasLinkage = await linkageColumnsExist();
  if (
    hasLinkage &&
    opts.recruitment_id !== undefined &&
    opts.recruitment_id !== null &&
    opts.recruitment_id !== ""
  ) {
    const recruitmentId = parseInt(String(opts.recruitment_id), 10);
    if (Number.isInteger(recruitmentId) && recruitmentId > 0) {
      where += " AND recruitment_id = ?";
      params.push(recruitmentId);
    }
  }

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM content_imports ${where}`,
    params
  );

  const listColumns = hasLinkage
    ? `${LIST_COLUMNS_BASE}, recruitment_id, recruitment_event_id`
    : LIST_COLUMNS_BASE;

  const [rows] = await db.query(
    `SELECT ${listColumns}
     FROM content_imports ${where}
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

async function findById(id) {
  const hasLinkage = await linkageColumnsExist();
  const linkageSelect = hasLinkage ? ", recruitment_id, recruitment_event_id" : "";
  const [rows] = await db.query(
    `SELECT id, content, source_file, row_index, status, created_at, opened_at${linkageSelect}
     FROM content_imports WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function markOpened(id) {
  await db.query(
    `UPDATE content_imports
     SET status = IF(status = 'pending', 'opened', status),
         opened_at = COALESCE(opened_at, NOW())
     WHERE id = ?`,
    [id]
  );
}

/**
 * Optionally attach recruitment bridge ids without breaking legacy rows.
 * @param {number} id
 * @param {{ recruitment_id: number|null, recruitment_event_id: number|null }} linkage
 */
async function setImportLinkage(id, linkage) {
  if (!(await linkageColumnsExist())) {
    return false;
  }
  const [result] = await db.query(
    `UPDATE content_imports
     SET recruitment_id = ?, recruitment_event_id = ?
     WHERE id = ?`,
    [linkage.recruitment_id ?? null, linkage.recruitment_event_id ?? null, id]
  );
  return result.affectedRows > 0;
}

/**
 * Remove a single import queue row (does not touch pages table).
 * @param {number} id
 * @returns {Promise<boolean>} true if a row was deleted
 */
async function deleteById(id) {
  const [result] = await db.query(`DELETE FROM content_imports WHERE id = ? LIMIT 1`, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  tableExists,
  linkageColumnsExist,
  insertOne,
  insertMany,
  listImports,
  findById,
  markOpened,
  setImportLinkage,
  deleteById
};
