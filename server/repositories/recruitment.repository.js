"use strict";

const db = require("../config/db");

const SELECT_COLUMNS =
  "id, title, slug, department, post_name, advertisement_no, cycle_year, lifecycle_state, created_at, updated_at";

async function tableExists() {
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'recruitments' LIMIT 1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   title: string,
 *   slug: string,
 *   department?: string | null,
 *   post_name?: string | null,
 *   advertisement_no?: string | null,
 *   cycle_year?: number | null,
 *   lifecycle_state: string
 * }} row
 */
async function createRecruitment(row) {
  const [result] = await db.query(
    `INSERT INTO recruitments (
       title, slug, department, post_name, advertisement_no, cycle_year, lifecycle_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.title,
      row.slug,
      row.department ?? null,
      row.post_name ?? null,
      row.advertisement_no ?? null,
      row.cycle_year ?? null,
      row.lifecycle_state
    ]
  );
  return getRecruitmentById(result.insertId);
}

async function getRecruitmentById(id) {
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM recruitments WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getRecruitmentBySlug(slug) {
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM recruitments WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

/**
 * @param {{ page?: number, limit?: number, lifecycle_state?: string, cycle_year?: number, search?: string }} opts
 */
async function listRecruitments(opts = {}) {
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [];
  let where = "WHERE 1=1";

  if (opts.lifecycle_state) {
    where += " AND lifecycle_state = ?";
    params.push(opts.lifecycle_state);
  }
  if (opts.cycle_year) {
    where += " AND cycle_year = ?";
    params.push(opts.cycle_year);
  }
  if (opts.search) {
    const term = `%${String(opts.search).trim()}%`;
    where += ` AND (
      title LIKE ? OR slug LIKE ? OR department LIKE ?
      OR post_name LIKE ? OR advertisement_no LIKE ?
    )`;
    params.push(term, term, term, term, term);
  }

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM recruitments ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS}
     FROM recruitments ${where}
     ORDER BY updated_at DESC, id DESC
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
 *   title: string,
 *   slug: string,
 *   department?: string | null,
 *   post_name?: string | null,
 *   advertisement_no?: string | null,
 *   cycle_year?: number | null,
 *   lifecycle_state: string
 * }} row
 */
async function updateRecruitment(id, row) {
  const [result] = await db.query(
    `UPDATE recruitments
     SET title = ?, slug = ?, department = ?, post_name = ?,
         advertisement_no = ?, cycle_year = ?, lifecycle_state = ?
     WHERE id = ?`,
    [
      row.title,
      row.slug,
      row.department ?? null,
      row.post_name ?? null,
      row.advertisement_no ?? null,
      row.cycle_year ?? null,
      row.lifecycle_state,
      id
    ]
  );
  if (result.affectedRows === 0) {
    return null;
  }
  return getRecruitmentById(id);
}

async function getRecruitmentsByIds(ids = []) {
  const unique = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => parseInt(String(id), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ];
  if (!unique.length) return [];
  const placeholders = unique.map(() => "?").join(", ");
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS}
     FROM recruitments
     WHERE id IN (${placeholders})
     ORDER BY id ASC`,
    unique
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Partial field update for bulk operations (Package 4E).
 * @param {number} id
 * @param {{ lifecycle_state?: string, department?: string | null }} patch
 */
async function patchRecruitment(id, patch = {}) {
  const fields = [];
  const params = [];
  if (Object.prototype.hasOwnProperty.call(patch, "lifecycle_state")) {
    fields.push("lifecycle_state = ?");
    params.push(patch.lifecycle_state);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "department")) {
    fields.push("department = ?");
    params.push(patch.department ?? null);
  }
  if (!fields.length) {
    return getRecruitmentById(id);
  }
  params.push(id);
  const [result] = await db.query(
    `UPDATE recruitments SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  if (result.affectedRows === 0) {
    return null;
  }
  return getRecruitmentById(id);
}

async function deleteRecruitmentById(id) {
  const existing = await getRecruitmentById(id);
  if (!existing) return null;
  const [result] = await db.query("DELETE FROM recruitments WHERE id = ?", [id]);
  return result.affectedRows > 0 ? existing : null;
}

async function countByLifecycleStates(states = []) {
  const list = (Array.isArray(states) ? states : []).filter(Boolean);
  if (!list.length) {
    const [[row]] = await db.query("SELECT COUNT(*) AS total FROM recruitments");
    return Number(row && row.total) || 0;
  }
  const placeholders = list.map(() => "?").join(", ");
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total FROM recruitments WHERE lifecycle_state IN (${placeholders})`,
    list
  );
  return Number(row && row.total) || 0;
}

async function countActiveRecruitments() {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total FROM recruitments WHERE lifecycle_state <> 'closed'`
  );
  return Number(row && row.total) || 0;
}

async function existsBySlug(slug, excludeId = null) {
  const params = [slug];
  let sql = "SELECT 1 AS ok FROM recruitments WHERE slug = ?";
  if (excludeId != null) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

async function existsByAdvertisementNo(advertisementNo, excludeId = null) {
  if (!advertisementNo) return false;
  const params = [advertisementNo];
  let sql = "SELECT 1 AS ok FROM recruitments WHERE advertisement_no = ?";
  if (excludeId != null) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Read-only candidate lookup for internal recruitment testing (Phase 26).
 * Never used by production monitoring/workers.
 *
 * @param {{
 *   advertisementNo?: string | null,
 *   department?: string | null,
 *   postName?: string | null,
 *   postTokens?: string[],
 *   cycleYear?: number | null,
 *   limit?: number
 * }} filters
 */
async function findCandidatesForLookup(filters = {}) {
  const limit = Math.min(20, Math.max(1, parseInt(String(filters.limit || 20), 10) || 20));
  const params = [];
  const clauses = [];

  if (filters.advertisementNo) {
    const advt = String(filters.advertisementNo).trim();
    if (advt) {
      clauses.push("LOWER(TRIM(advertisement_no)) = LOWER(?)");
      params.push(advt);
    }
  }

  if (filters.department) {
    clauses.push("LOWER(TRIM(department)) = LOWER(?)");
    params.push(String(filters.department).trim());
  }

  if (filters.cycleYear != null && Number.isInteger(filters.cycleYear)) {
    clauses.push("cycle_year = ?");
    params.push(filters.cycleYear);
  }

  if (filters.postName) {
    const post = String(filters.postName).trim();
    if (post) {
      clauses.push(
        "(LOWER(TRIM(post_name)) = LOWER(?) OR LOWER(TRIM(post_name)) LIKE LOWER(?))"
      );
      params.push(post, `%${post}%`);
    }
  } else if (Array.isArray(filters.postTokens) && filters.postTokens.length > 0) {
    const tokenClauses = [];
    for (const token of filters.postTokens) {
      const trimmed = String(token || "").trim();
      if (!trimmed) continue;
      tokenClauses.push("LOWER(TRIM(post_name)) LIKE LOWER(?)");
      params.push(`%${trimmed}%`);
    }
    if (tokenClauses.length > 0) {
      clauses.push(`(${tokenClauses.join(" OR ")})`);
    }
  }

  if (clauses.length === 0) {
    return [];
  }

  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS}
     FROM recruitments
     WHERE ${clauses.join(" AND ")}
     ORDER BY id ASC
     LIMIT ?`,
    [...params, limit]
  );

  return Array.isArray(rows) ? rows : [];
}

/**
 * Broader advertisement number search when exact match is empty.
 * Matches normalized variants like "01/2026" within stored advertisement_no.
 */
async function findCandidatesByAdvertisementNoLoose(advertisementNo, limit = 20) {
  const advt = String(advertisementNo || "").trim();
  if (!advt) return [];
  const safeLimit = Math.min(20, Math.max(1, parseInt(String(limit), 10) || 20));
  const [rows] = await db.query(
    `SELECT ${SELECT_COLUMNS}
     FROM recruitments
     WHERE advertisement_no IS NOT NULL
       AND advertisement_no <> ''
       AND (
         LOWER(TRIM(advertisement_no)) = LOWER(?)
         OR LOWER(advertisement_no) LIKE LOWER(?)
       )
     ORDER BY id ASC
     LIMIT ?`,
    [advt, `%${advt}%`, safeLimit]
  );
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  tableExists,
  createRecruitment,
  getRecruitmentById,
  getRecruitmentBySlug,
  getRecruitmentsByIds,
  listRecruitments,
  updateRecruitment,
  patchRecruitment,
  deleteRecruitmentById,
  countByLifecycleStates,
  countActiveRecruitments,
  existsBySlug,
  existsByAdvertisementNo,
  findCandidatesForLookup,
  findCandidatesByAdvertisementNoLoose
};
