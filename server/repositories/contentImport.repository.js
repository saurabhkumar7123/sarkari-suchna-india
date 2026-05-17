"use strict";

const db = require("../config/db");

const LIST_COLUMNS =
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
 * @param {{ content: string, sourceFile?: string|null, rowIndex?: number|null }} row
 * @returns {Promise<number>} insert id
 */
async function insertOne(row) {
  const [result] = await db.query(
    `INSERT INTO content_imports (content, source_file, row_index, status)
     VALUES (?, ?, ?, 'pending')`,
    [row.content, row.sourceFile || null, row.rowIndex != null ? row.rowIndex : null]
  );
  return result.insertId;
}

/**
 * @param {Array<{ content: string, sourceFile?: string|null, rowIndex?: number|null }>} rows
 * @returns {Promise<number[]>}
 */
async function insertMany(rows) {
  if (!rows.length) return [];
  const ids = [];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const row of rows) {
      const [result] = await conn.query(
        `INSERT INTO content_imports (content, source_file, row_index, status)
         VALUES (?, ?, ?, 'pending')`,
        [row.content, row.sourceFile || null, row.rowIndex != null ? row.rowIndex : null]
      );
      ids.push(result.insertId);
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
 * @param {{ page?: number, limit?: number, status?: string }} opts
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
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM content_imports ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT ${LIST_COLUMNS}
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
  const [rows] = await db.query(
    `SELECT id, content, source_file, row_index, status, created_at, opened_at
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

module.exports = {
  tableExists,
  insertOne,
  insertMany,
  listImports,
  findById,
  markOpened
};
