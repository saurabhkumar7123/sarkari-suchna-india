"use strict";

const db = require("../config/db");
const logger = require("../utils/logger");
const IS_NON_PROD = process.env.NODE_ENV !== "production";

function stripInvisible(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/**
 * Optional VARCHAR bind: coerces primitives (e.g. JSON numbers) to string.
 * mysql2 must not receive `undefined`.
 * null/undefined → SQL NULL; present but trim-empty → SQL '' (matches controller empty-string semantics).
 * @param {unknown} value
 * @param {number} maxLen
 * @returns {string | null}
 */
function toOptionalDbVarchar(value, maxLen) {
  if (value === undefined || value === null) return null;
  const s = stripInvisible(String(value)).trim();
  if (!s) return "";
  return s.slice(0, maxLen);
}

/** Avoid huge log lines for longtext fields */
function summarizeBindValue(value, maxLen = 120) {
  if (value == null) return value;
  const s = String(value);
  if (s.length <= maxLen) return s;
  return { length: s.length, preview: `${s.slice(0, maxLen)}…` };
}

/** @param {unknown} value */
function normalizeStructuredColumn(value) {
  if (value == null) return null;
  const s = stripInvisible(String(value))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s || null;
}

/**
 * mysql2 must never receive `undefined` for bound params. Only non-empty strings become SQL values.
 * @param {unknown} normalized from {@link normalizeStructuredColumn} (string | null)
 */
function bindStructuredForMysql(normalized) {
  if (typeof normalized === "string" && normalized.length > 0) {
    return normalized;
  }
  return null;
}

function normalizeFilterValue(value) {
  return stripInvisible(String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Manual badge codes coming in from the validated admin payload are stored as
 * a JSON array string. Anything non-array or empty becomes NULL so existing
 * rows stay byte-identical to pre-migration state.
 */
function badgesToDbValue(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function buildNormalizedColumnSql(columnName) {
  return `LOWER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, '\r', ' '), '\n', ' '), '\t', ' '), '  ', ' '), '  ', ' ')))`;
}

/**
 * Same connection as INSERT/UPDATE — confirms DATABASE() + expected columns exist.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string} operation
 */
/** @param {import("mysql2/promise").PoolConnection} conn */
async function logDatabaseName(conn, tag) {
  try {
    const [[row]] = await conn.query("SELECT DATABASE() AS db");
    logger.info(`DATABASE() [${tag}]`, { db: row && row.db });
  } catch (e) {
    logger.warn(`DATABASE() failed [${tag}]`, { message: e && e.message ? e.message : String(e) });
  }
}

async function logStructuredFieldsDbContext(conn, operation) {
  try {
    const [[dbRow]] = await conn.query("SELECT DATABASE() AS currentDb");
    const currentDb = dbRow && dbRow.currentDb;

    const [colRows] = await conn.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'pages'
         AND COLUMN_NAME IN ('qualification','state','department')
       ORDER BY COLUMN_NAME`
    );

    logger.info(`pages structured DB context (${operation})`, {
      currentDb,
      table: "pages",
      expectedColumns: ["qualification", "state", "department"],
      foundColumns: colRows
    });

    if (!colRows || colRows.length < 3) {
      logger.error("pages table: structured columns missing or wrong schema on current connection", {
        currentDb,
        foundCount: colRows ? colRows.length : 0,
        foundColumns: colRows
      });
    }
  } catch (e) {
    logger.warn("structured fields DB context check failed", { message: e && e.message ? e.message : String(e) });
  }
}

/**
 * Maps public section slug → DB status values (lowercased in SQL).
 * @type {Record<string, string[]>}
 */
const SECTION_STATUS_GROUPS = {
  "new-form": ["new form", "new", "form"],
  admission: ["admission"],
  result: ["result"],
  "admit-card": ["admit card", "admit"],
  "answer-key": ["answer key", "answer"],
  syllabus: ["syllabus"],
  document: ["document"]
};

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} executor
 */
function buildPublicListWhere(section, status) {
  let baseQuery = `FROM pages WHERE deleted=0`;
  const params = [];

  if (section) {
    const key = String(section).toLowerCase().trim();
    const group = SECTION_STATUS_GROUPS[key];
    if (group && group.length) {
      const ph = group.map(() => "?").join(",");
      baseQuery += ` AND LOWER(TRIM(status)) IN (${ph})`;
      params.push(...group.map((s) => s.toLowerCase()));
    }
  } else if (status) {
    baseQuery += ` AND LOWER(TRIM(status))=?`;
    params.push(String(status).toLowerCase());
  }

  return { baseQuery, params };
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function countPublicList(section, status, executor = db) {
  const { baseQuery, params } = buildPublicListWhere(section, status);
  const [countRows] = await executor.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
  return countRows[0].total;
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 * @param {boolean} [includeRawText] When false (default), omits `raw_text` for smaller rows + less DB I/O.
 */
async function selectPublicListPage(section, status, limit, offset, executor = db, includeRawText = false) {
  const { baseQuery, params } = buildPublicListWhere(section, status);
  const rawSql = includeRawText ? ", raw_text" : "";
  const [rows] = await executor.query(
    `SELECT id, title, slug, status, badges, category, created_at${rawSql}, last_date, breaking, position, event_time ${baseQuery} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

function buildPublicListWhereDepartment(department) {
  const normalizedDepartmentColumn = buildNormalizedColumnSql("department");
  const dept = normalizeFilterValue(department);
  return {
    baseQuery: `FROM pages WHERE deleted=0 AND department IS NOT NULL AND TRIM(department) <> '' AND ${normalizedDepartmentColumn} = ?`,
    params: [dept]
  };
}

/**
 * Board hub listings — filter by pages.department (not category / page_tags).
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function countPublicListByDepartment(department, executor = db) {
  const { baseQuery, params } = buildPublicListWhereDepartment(department);
  const [countRows] = await executor.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
  return countRows[0].total;
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 * @param {boolean} [includeRawText]
 */
async function selectPublicListByDepartment(department, limit, offset, executor = db, includeRawText = false) {
  const { baseQuery, params } = buildPublicListWhereDepartment(department);
  const rawSql = includeRawText ? ", raw_text" : "";
  const [rows] = await executor.query(
    `SELECT id, title, slug, status, badges, category, created_at${rawSql}, last_date, breaking, position, event_time ${baseQuery} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function findRowBySlug(slug, executor = db) {
  const [rows] = await executor.query("SELECT * FROM pages WHERE slug=?", [slug]);
  return rows[0] || null;
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function findPublicRowBySlug(slug, executor = db) {
  const [rows] = await executor.query("SELECT * FROM pages WHERE slug=? AND deleted=0 LIMIT 1", [slug]);
  return rows[0] || null;
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function selectTopViews(limit, executor = db) {
  const [rows] = await executor.query(
    `SELECT id, title, slug, status, category, views, created_at 
     FROM pages WHERE deleted=0 ORDER BY views DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

/**
 * Active-page counts per normalized department slug (board hub taxonomy).
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function selectDepartmentCounts(executor = db) {
  const normalizedDepartmentColumn = buildNormalizedColumnSql("department");
  const [rows] = await executor.query(
    `SELECT ${normalizedDepartmentColumn} AS slug, COUNT(*) AS page_count
     FROM pages
     WHERE deleted = 0
       AND department IS NOT NULL
       AND TRIM(department) <> ''
     GROUP BY ${normalizedDepartmentColumn}`
  );
  return rows;
}

/**
 * Active-page counts per normalized qualification slug.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function selectQualificationCounts(executor = db) {
  const normalizedQualificationColumn = buildNormalizedColumnSql("qualification");
  const [rows] = await executor.query(
    `SELECT ${normalizedQualificationColumn} AS slug, COUNT(*) AS page_count
     FROM pages
     WHERE deleted = 0
       AND qualification IS NOT NULL
       AND TRIM(qualification) <> ''
     GROUP BY ${normalizedQualificationColumn}`
  );
  return rows;
}

/**
 * Active-page counts per normalized state slug.
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 */
async function selectStateCounts(executor = db) {
  const normalizedStateColumn = buildNormalizedColumnSql("state");
  const [rows] = await executor.query(
    `SELECT ${normalizedStateColumn} AS slug, COUNT(*) AS page_count
     FROM pages
     WHERE deleted = 0
       AND state IS NOT NULL
       AND TRIM(state) <> ''
     GROUP BY ${normalizedStateColumn}`
  );
  return rows;
}

/**
 * Increment view counter for a public job page (non-deleted).
 * @param {string} slug
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 * @returns {Promise<number>} affected rows
 */
async function incrementViewsBySlug(slug, executor = db) {
  const [result] = await executor.query(
    `UPDATE pages SET views = IFNULL(views, 0) + 1 WHERE slug = ? AND deleted = 0 LIMIT 1`,
    [slug]
  );
  return Number(result && result.affectedRows ? result.affectedRows : 0);
}

async function searchByLike(likeQuery, executor = db) {
  const [rows] = await executor.query(
    `SELECT title, slug, status 
     FROM pages 
     WHERE deleted=0 
     AND (title LIKE ? OR slug LIKE ? OR category LIKE ?)
     ORDER BY created_at DESC
     LIMIT 20`,
    [likeQuery, likeQuery, likeQuery]
  );
  return rows;
}

let fullTextEnsured = false;

async function ensurePagesSearchFullTextIndex(executor = db) {
  // Runtime schema changes are disabled for production safety.
  if (fullTextEnsured) return;
  fullTextEnsured = true;
  logger.warn("fulltext runtime index ensure disabled; use migration-managed indexes");
}

async function searchByFullText(query, executor = db) {
  const q = String(query || "").trim();
  if (!q) return [];
  await ensurePagesSearchFullTextIndex(executor);
  try {
    const [rows] = await executor.query(
      `SELECT title, slug, status
       FROM pages
       WHERE deleted = 0
         AND MATCH(title, content) AGAINST (? IN NATURAL LANGUAGE MODE)
       ORDER BY created_at DESC
       LIMIT 20`,
      [q]
    );
    return rows;
  } catch (err) {
    const message = err && err.message ? String(err.message) : "";
    logger.warn("searchByFullText fallback to LIKE", { message });
    const likeQuery = `%${q}%`;
    return searchByLike(likeQuery, executor);
  }
}

async function suggestByTitlePrefix(prefix, executor = db) {
  const [rows] = await executor.query(
    `SELECT title, slug, status 
     FROM pages 
     WHERE deleted=0 
     AND title LIKE ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [`${prefix}%`]
  );
  return rows;
}

async function selectAllForFinder(executor = db) {
  const [results] = await executor.query("SELECT title, slug, raw_text, status, last_date FROM pages WHERE deleted=0");
  return results;
}

async function selectFinderPage(limit, offset, executor = db) {
  const safeLimit = Math.min(5000, Math.max(1, Number(limit) || 1000));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const [results] = await executor.query(
    `SELECT title, slug, raw_text, status, last_date
     FROM pages
     WHERE deleted=0
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );
  return results;
}

async function selectSmallBoxes(executor = db) {
  const [rows] = await executor.query(
    "SELECT title, slug FROM pages WHERE position='small' AND deleted=0 LIMIT 4"
  );
  return rows;
}

async function selectBreakingNews(executor = db) {
  const [rows] = await executor.query(
    `SELECT title, slug, status, badges, event_time AS eventTime, created_at AS date
     FROM pages
     WHERE breaking=1 AND deleted=0
     ORDER BY breaking_order DESC
     LIMIT 10`
  );
  return rows;
}

async function selectByCategory(tag, executor = db) {
  const [rows] = await executor.query(
    "SELECT title, slug FROM pages WHERE deleted=0 AND category=?",
    [tag]
  );
  return rows;
}

async function selectAllSlugsPublic(executor = db) {
  const [rows] = await executor.query("SELECT slug FROM pages WHERE deleted=0");
  return rows;
}

/**
 * @typedef {{
 *   id?: number,
 *   title: string,
 *   slug: string,
 *   status?: string | null,
 *   category?: string | null,
 *   views?: number | null,
 *   created_at?: Date | string | null,
 *   department?: string | null,
 *   qualification?: string | null,
 *   state?: string | null,
 *   post_name?: string | null
 * }} RelatedPageRow
 */

const RELATED_CANDIDATE_COLUMNS =
  "id, title, slug, status, category, views, created_at, department, qualification, state, post_name";

/**
 * @param {string} slug
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 * @returns {Promise<RelatedPageRow | null>}
 */
async function findRelatedAnchorBySlug(slug, executor = db) {
  const [rows] = await executor.query(
    `SELECT ${RELATED_CANDIDATE_COLUMNS} FROM pages WHERE slug=? AND deleted=0 LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

/**
 * Recent public pages for related scoring (single query, no N+1).
 * @param {string} excludeSlug
 * @param {number} poolLimit
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").PoolConnection} [executor]
 * @returns {Promise<RelatedPageRow[]>}
 */
async function selectRelatedCandidates(excludeSlug, poolLimit = 150, executor = db) {
  const lim = Math.min(300, Math.max(20, parseInt(poolLimit, 10) || 150));
  const [rows] = await executor.query(
    `SELECT ${RELATED_CANDIDATE_COLUMNS}
     FROM pages
     WHERE deleted=0 AND slug != ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [excludeSlug, lim]
  );
  return rows;
}

/** @deprecated Legacy random related list — use selectRelatedSmart via misc.service */
async function selectRelated(slug, limit, executor = db) {
  const [rows] = await executor.query(
    "SELECT title, slug FROM pages WHERE slug != ? AND deleted=0 LIMIT ?",
    [slug, limit]
  );
  return rows;
}

async function selectDistinctStatuses(executor = db) {
  const [rows] = await executor.query(
    `SELECT DISTINCT LOWER(TRIM(status)) AS status
     FROM pages
     WHERE deleted = 0 AND status IS NOT NULL AND TRIM(status) <> ''`
  );
  return rows;
}

function buildJobsWhere({ qualification, state, department, jobType, status }) {
  let where = `FROM pages WHERE deleted = 0`;
  const params = [];
  const normalizedStatusColumn = buildNormalizedColumnSql("status");
  const normalizedQualificationColumn = buildNormalizedColumnSql("qualification");
  const normalizedStateColumn = buildNormalizedColumnSql("state");
  const normalizedDepartmentColumn = buildNormalizedColumnSql("department");

  if (status) {
    where += ` AND status IS NOT NULL AND TRIM(status) <> '' AND ${normalizedStatusColumn} = ?`;
    params.push(normalizeFilterValue(status));
  }
  // Qualification filter: single-value equality today. Future multi-qual: see structuredFields.qualificationSetMatchesFilter.
  if (qualification) {
    where += ` AND qualification IS NOT NULL AND TRIM(qualification) <> '' AND ${normalizedQualificationColumn} = ?`;
    params.push(normalizeFilterValue(qualification));
  }
  // State filter: single-value equality today. Future multi-state: see structuredFields.stateCoverageMatchesFilter.
  if (state) {
    const normalizedState = normalizeFilterValue(state);
    if (normalizedState === "all india") {
      where += ` AND state IS NOT NULL AND TRIM(state) <> '' AND ${normalizedStateColumn} = ?`;
      params.push("all india");
    } else {
      where += ` AND state IS NOT NULL AND TRIM(state) <> '' AND ${normalizedStateColumn} IN (?, ?)`;
      params.push(normalizedState, "all india");
    }
  }
  if (department) {
    where += ` AND department IS NOT NULL AND TRIM(department) <> '' AND ${normalizedDepartmentColumn} = ?`;
    params.push(normalizeFilterValue(department));
  }
  return { where, params };
}

async function countJobsFiltered(filters, executor = db) {
  const { where, params } = buildJobsWhere(filters);
  const [rows] = await executor.query(`SELECT COUNT(*) AS total ${where}`, params);
  return Number(rows[0]?.total || 0);
}

async function selectJobsFiltered({ qualification, state, department, jobType, status, source, limit, offset }, executor = db) {
  const { where, params } = buildJobsWhere({ qualification, state, department, jobType, status });
  const normalizedStatusColumn = buildNormalizedColumnSql("status");
  const useFinderPrioritySort = String(source || "").trim().toLowerCase() === "finder";
  const orderBySql = useFinderPrioritySort
    ? `
    ORDER BY
      CASE
        WHEN ${normalizedStatusColumn} = 'new form' THEN 0
        WHEN ${normalizedStatusColumn} IN ('admit card', 'admit') THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN ${normalizedStatusColumn} = 'new form' AND last_date IS NULL THEN 1
        ELSE 0
      END ASC,
      CASE
        WHEN ${normalizedStatusColumn} = 'new form' THEN last_date
        ELSE NULL
      END ASC,
      created_at DESC
  `
    : "ORDER BY created_at DESC";
  const query = `
    SELECT id, title, slug, status, category, created_at, raw_text, last_date, qualification, state, department
    ${where}
    ${orderBySql}
    LIMIT ? OFFSET ?
  `;
  if (IS_NON_PROD) {
    logger.info("Jobs SQL query", {
      selectedValues: {
        qualification: normalizeFilterValue(qualification),
        state: normalizeFilterValue(state),
        department: normalizeFilterValue(department)
      },
      fieldNamesChecked: ["qualification", "state", "department"],
      source: useFinderPrioritySort ? "finder" : "default",
      query: query.replace(/\s+/g, " ").trim(),
      params: [...params, limit, offset]
    });
  }
  const [rows] = await executor.query(query, [...params, limit, offset]);
  if (IS_NON_PROD) {
    rows.slice(0, 3).forEach((row) => {
      logger.info("Jobs query sample row", {
        id: row.id,
        status: row.status,
        lastDate: row.last_date
      });
    });
  }
  return rows;
}

async function findJobById(id, executor = db) {
  const numericId = String(id).startsWith("job_") ? String(id).slice(4) : String(id);
  const safeId = parseInt(numericId, 10);
  if (!Number.isInteger(safeId) || safeId < 1) return null;

  const [rows] = await executor.query(
    `SELECT id, title, slug, status, category, created_at, raw_text, last_date, qualification, state, department
     FROM pages
     WHERE deleted = 0 AND id = ?
     LIMIT 1`,
    [safeId]
  );
  return rows[0] || null;
}

// --- Admin ---

async function countAdminPages(where, params, executor = db) {
  const [countRows] = await executor.query(`SELECT COUNT(*) as total FROM pages ${where}`, params);
  return countRows[0].total;
}

async function selectAdminPageList(where, params, orderDir, limit, offset, executor = db) {
  const [rows] = await executor.query(
    `SELECT id, title, slug, category, status, created_at, views 
     FROM pages 
     ${where}
     ORDER BY created_at ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function selectDistinctCategories(executor = db) {
  const [rows] = await executor.query(
    `SELECT DISTINCT category FROM pages 
     WHERE deleted=0 AND category IS NOT NULL AND TRIM(category) <> '' 
     ORDER BY category ASC`
  );
  return rows.map((r) => r.category);
}

async function selectDistinctStatusesAll(executor = db) {
  const [rows] = await executor.query(
    `SELECT DISTINCT status FROM pages WHERE deleted=0 AND status IS NOT NULL ORDER BY status ASC`
  );
  return rows.map((r) => r.status);
}

async function selectTrashPages(executor = db) {
  const [rows] = await executor.query(
    `SELECT title, slug, category, created_at 
     FROM pages 
     WHERE deleted=1 
     ORDER BY created_at DESC`
  );
  return rows;
}

async function countTrashPages(executor = db) {
  const [[row]] = await executor.query(`SELECT COUNT(*) AS n FROM pages WHERE deleted=1`);
  return Number(row && row.n) || 0;
}

async function selectTrashPagesPaginated(limit, offset, executor = db) {
  const [rows] = await executor.query(
    `SELECT title, slug, category, created_at 
     FROM pages 
     WHERE deleted=1 
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

async function softDeleteBySlug(slug, executor = db) {
  const [result] = await executor.query("UPDATE pages SET deleted=1 WHERE slug=?", [slug]);
  return result;
}

async function restoreBySlug(slug, executor = db) {
  const [result] = await executor.query("UPDATE pages SET deleted=0 WHERE slug=?", [slug]);
  return result;
}

async function hardDeleteBySlug(slug, executor = db) {
  const [result] = await executor.query("DELETE FROM pages WHERE slug=?", [slug]);
  return result;
}

async function selectDashboardAggregate(executor = db) {
  const [[agg]] = await executor.query(
    `SELECT 
      SUM(deleted = 0) AS totalPages,
      SUM(deleted = 0 AND position = 'small') AS smallPages,
      SUM(deleted = 1) AS trashPages,
      IFNULL(SUM(CASE WHEN deleted = 0 THEN views ELSE 0 END), 0) AS totalViews
     FROM pages`
  );
  const [[catRow]] = await executor.query(
    `SELECT COUNT(DISTINCT NULLIF(TRIM(category), '')) AS totalCategories
     FROM pages WHERE deleted = 0`
  );
  const [[todayRow]] = await executor.query(
    `SELECT IFNULL(SUM(views), 0) AS todayViews
     FROM pages
     WHERE deleted = 0 AND DATE(created_at) = CURDATE()`
  );
  return { agg, catRow, todayRow };
}

async function findAdminPageBySlug(slug, executor = db) {
  const [rows] = await executor.query("SELECT * FROM pages WHERE slug = ? AND deleted = 0 LIMIT 1", [slug]);
  return rows[0] || null;
}

// --- Generator (transaction connection) ---

async function findActiveIdBySlug(slug, conn) {
  const [rows] = await conn.query("SELECT id FROM pages WHERE slug=? AND deleted=0 LIMIT 1", [slug]);
  return rows[0] || null;
}

async function getUniqueSlug(baseSlug, conn) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await findActiveIdBySlug(slug, conn);
    if (!existing) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

async function insertPage(
  {
    title,
    slug,
    finalHTML,
    text,
    normalizedStatus,
    category,
    qualification,
    state,
    department,
    postName,
    totalPosts,
    lastDate,
    position,
    breaking,
    breakingOrder,
    eventTime,
    badges
  },
  conn
) {
  const badgesSql = badgesToDbValue(badges);
  const qVal = normalizeStructuredColumn(qualification);
  const sVal = normalizeStructuredColumn(state);
  const dVal = normalizeStructuredColumn(department);
  const qSql = bindStructuredForMysql(qVal);
  const sSql = bindStructuredForMysql(sVal);
  const dSql = bindStructuredForMysql(dVal);

  logger.info("insertPage structured from controller (typeof must not be undefined after normalize)", {
    received: {
      qualification: { value: qualification, typeof: typeof qualification },
      state: { value: state, typeof: typeof state },
      department: { value: department, typeof: typeof department }
    },
    normalized: {
      qualification: { value: qVal, typeof: typeof qVal },
      state: { value: sVal, typeof: typeof sVal },
      department: { value: dVal, typeof: typeof dVal }
    },
    boundForMysql: {
      qualification: { value: qSql, typeof: typeof qSql },
      state: { value: sSql, typeof: typeof sSql },
      department: { value: dSql, typeof: typeof dSql }
    }
  });

  /**
   * Column order MUST match VALUES (?) order exactly — 16 placeholders + NOW() for created_at.
   * title, slug, status, category, then structured fields, then content, …
   */
  if (IS_NON_PROD) {
    console.log("REPO INPUT:", { postName, totalPosts });
  }

  const postNameSql = toOptionalDbVarchar(postName, 512);
  const totalPostsSql = toOptionalDbVarchar(totalPosts, 64);

  const insertParams = [
    title,
    slug,
    normalizedStatus,
    badgesSql,
    category,
    qSql,
    sSql,
    dSql,
    postNameSql,
    totalPostsSql,
    lastDate ?? null,
    finalHTML,
    text,
    position ?? null,
    breaking ? 1 : 0,
    breakingOrder ?? 0,
    eventTime ?? null
  ].map((v) => (v === undefined ? null : v));

  if (IS_NON_PROD) {
    console.log("SQL PARAMS:", insertParams.map((v, i) => (i === 10 || i === 11 ? summarizeBindValue(v) : v)));
    console.log("SQL PARAMS post_name/total_posts [7],[8]:", insertParams[7], insertParams[8]);
  }

  logger.info("structured fields pipeline [4 repo args → 5 SQL params]", {
    slug,
    stage4_receivedFromController: { qualification, state, department },
    stage5_boundToQuery: { qualification: qSql, state: sSql, department: dSql },
    paramCount: insertParams.length
  });

  await logStructuredFieldsDbContext(conn, "before INSERT pages");
  await logDatabaseName(conn, "same conn, immediately before INSERT pages");

  const insertColumnOrder =
    "title, slug, status, badges, category, qualification, state, department, post_name, total_posts, last_date, content, raw_text, position, breaking, breaking_order, event_time, created_at=NOW()";
  logger.info("insertPage full bind array pre-EXECUTE (order matches columns)", {
    insertColumnOrder,
    insertParamsFull: insertParams.map((v, i) =>
      i === 10 || i === 11 ? summarizeBindValue(v) : v
    ),
    valuesOrdered: [
      ["title", title],
      ["slug", slug],
      ["status", normalizedStatus],
      ["badges", badgesSql],
      ["category", category],
      ["qualification", qSql],
      ["state", sSql],
      ["department", dSql],
      ["post_name", postNameSql],
      ["total_posts", totalPostsSql],
      ["last_date", lastDate ?? null],
      ["content", summarizeBindValue(finalHTML)],
      ["raw_text", summarizeBindValue(text)],
      ["position", position ?? null],
      ["breaking", breaking ? 1 : 0],
      ["breaking_order", breakingOrder ?? 0],
      ["event_time", eventTime ?? null]
    ],
    placeholderCount: 17
  });

  if (IS_NON_PROD) {
    console.log("Saving last_date (insert):", lastDate ?? null);
  }
  logger.info("insertPage saving last_date", { slug, last_date: lastDate ?? null });

  const [insResult] = await conn.query(
    `INSERT INTO \`pages\` 
     (title, slug, status, \`badges\`, category, \`qualification\`, \`state\`, \`department\`, post_name, total_posts, last_date, content, raw_text, position, breaking, breaking_order, event_time, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    insertParams
  );

  const newId = insResult && insResult.insertId != null ? insResult.insertId : null;
  logger.info("insertPage insert result", {
    insertId: newId,
    affectedRows: insResult && insResult.affectedRows
  });

  if (newId != null && newId !== 0) {
    await logDatabaseName(conn, "same conn, immediately before SELECT verify after INSERT");
    const [[verifyRow]] = await conn.query(
      "SELECT `id`, `status`, `position`, `post_name`, `total_posts`, `qualification`, `state`, `department` FROM `pages` WHERE `id` = ? LIMIT 1",
      [newId]
    );
    if (IS_NON_PROD) {
      console.warn("STATUS FLOW [db insert verify]:", {
        id: newId,
        status: verifyRow ? verifyRow.status : null
      });
    }
    logger.warn("STATUS FLOW [db insert verify]", {
      id: newId,
      status: verifyRow ? verifyRow.status : null
    });
    if (IS_NON_PROD) {
      console.warn("POSITION FLOW [db insert verify]:", {
        id: newId,
        position: verifyRow ? verifyRow.position : null
      });
    }
    logger.warn("POSITION FLOW [db insert verify]", {
      id: newId,
      position: verifyRow ? verifyRow.position : null
    });
    if (IS_NON_PROD) {
      console.log("DB VERIFY after INSERT (post_name, total_posts):", {
        id: newId,
        post_name: verifyRow ? verifyRow.post_name : null,
        total_posts: verifyRow ? verifyRow.total_posts : null
      });
    }
    const expected = { qualification: qSql, state: sSql, department: dSql };
    const got = {
      qualification: verifyRow ? verifyRow.qualification : null,
      state: verifyRow ? verifyRow.state : null,
      department: verifyRow ? verifyRow.department : null
    };
    const mismatch =
      String(expected.qualification ?? "") !== String(got.qualification ?? "") ||
      String(expected.state ?? "") !== String(got.state ?? "") ||
      String(expected.department ?? "") !== String(got.department ?? "");

    logger.info("structured fields pipeline [6 stored row after INSERT]", {
      id: newId,
      stage6_db: got,
      matchesBoundParams: !mismatch,
      expectedBound: expected
    });

    if (mismatch) {
      logger.error("structured fields mismatch: bound params vs row read after INSERT (check triggers / generated columns)", {
        id: newId,
        expectedBound: expected,
        stage6_db: got
      });
    }
  } else {
    logger.error("insertPage missing insertId — cannot verify row; check trigger/DB engine", {
      insResult
    });
  }

  return newId;
}

async function updatePageBySlug(
  {
    title,
    slug,
    finalHTML,
    text,
    normalizedStatus,
    category,
    qualification,
    state,
    department,
    postName,
    totalPosts,
    lastDate,
    position,
    breaking,
    breakingOrder,
    eventTime,
    badges
  },
  conn
) {
  const badgesSql = badgesToDbValue(badges);
  const qVal = normalizeStructuredColumn(qualification);
  const sVal = normalizeStructuredColumn(state);
  const dVal = normalizeStructuredColumn(department);
  const qSql = bindStructuredForMysql(qVal);
  const sSql = bindStructuredForMysql(sVal);
  const dSql = bindStructuredForMysql(dVal);

  logger.info("updatePageBySlug structured from controller (typeof)", {
    slug,
    received: {
      qualification: { value: qualification, typeof: typeof qualification },
      state: { value: state, typeof: typeof state },
      department: { value: department, typeof: typeof department }
    },
    normalized: {
      qualification: { value: qVal, typeof: typeof qVal },
      state: { value: sVal, typeof: typeof sVal },
      department: { value: dVal, typeof: typeof dVal }
    },
    boundForMysql: {
      qualification: { value: qSql, typeof: typeof qSql },
      state: { value: sSql, typeof: typeof sSql },
      department: { value: dSql, typeof: typeof dSql }
    }
  });

  /**
   * SET clause order MUST match updateParams order exactly.
   */
  if (IS_NON_PROD) {
    console.log("REPO INPUT:", { postName, totalPosts });
  }

  const postNameSql = toOptionalDbVarchar(postName, 512);
  const totalPostsSql = toOptionalDbVarchar(totalPosts, 64);

  const updateParams = [
    title,
    normalizedStatus,
    badgesSql,
    category,
    qSql,
    sSql,
    dSql,
    postNameSql,
    totalPostsSql,
    lastDate ?? null,
    finalHTML,
    text,
    position ?? null,
    breaking ? 1 : 0,
    breakingOrder ?? 0,
    eventTime ?? null,
    slug
  ].map((v) => (v === undefined ? null : v));

  if (IS_NON_PROD) {
    console.log("SQL PARAMS:", updateParams.map((v, i) => (i === 8 || i === 9 ? summarizeBindValue(v) : v)));
    console.log("SQL PARAMS post_name/total_posts [6],[7]:", updateParams[6], updateParams[7]);
  }

  logger.info("structured fields pipeline [4 repo args → 5 SQL params] UPDATE", {
    slug,
    stage4_receivedFromController: { qualification, state, department },
    stage5_boundToQuery: { qualification: qSql, state: sSql, department: dSql },
    paramCount: updateParams.length
  });

  await logStructuredFieldsDbContext(conn, "before UPDATE pages");
  await logDatabaseName(conn, "same conn, immediately before UPDATE pages");

  const updateSetOrder =
    "title, status, badges, category, qualification, state, department, post_name, total_posts, last_date, content, raw_text, position, breaking, breaking_order, event_time, WHERE slug";
  logger.info("updatePageBySlug full bind array pre-EXECUTE (order matches SET)", {
    updateSetOrder,
    updateParamsFull: updateParams.map((v, i) =>
      i === 8 || i === 9 ? summarizeBindValue(v) : v
    ),
    valuesOrdered: [
      ["title", title],
      ["status", normalizedStatus],
      ["badges", badgesSql],
      ["category", category],
      ["qualification", qSql],
      ["state", sSql],
      ["department", dSql],
      ["post_name", postNameSql],
      ["total_posts", totalPostsSql],
      ["last_date", lastDate ?? null],
      ["content", summarizeBindValue(finalHTML)],
      ["raw_text", summarizeBindValue(text)],
      ["position", position ?? null],
      ["breaking", breaking ? 1 : 0],
      ["breaking_order", breakingOrder ?? 0],
      ["event_time", eventTime ?? null],
      ["WHERE slug", slug]
    ],
    placeholderCount: updateParams.length
  });

  if (IS_NON_PROD) {
    console.log("Saving last_date (update):", lastDate ?? null);
  }
  logger.info("updatePageBySlug saving last_date", { slug, last_date: lastDate ?? null });

  const [result] = await conn.query(
    `UPDATE \`pages\`
     SET title = ?, status = ?, \`badges\` = ?, category = ?, \`qualification\` = ?, \`state\` = ?, \`department\` = ?, post_name = ?, total_posts = ?, last_date = ?, content = ?, raw_text = ?, position = ?, 
         breaking = ?, breaking_order = ?, event_time = ?
     WHERE slug = ? AND deleted = 0`,
    updateParams
  );

  if (result && result.affectedRows) {
    await logDatabaseName(conn, "same conn, immediately before SELECT verify after UPDATE");
    const [[verifyRow]] = await conn.query(
      "SELECT `id`, `slug`, `status`, `position`, `post_name`, `total_posts`, `qualification`, `state`, `department` FROM `pages` WHERE `slug` = ? AND deleted = 0 LIMIT 1",
      [slug]
    );
    if (IS_NON_PROD) {
      console.warn("STATUS FLOW [db update verify]:", {
        slug,
        status: verifyRow ? verifyRow.status : null
      });
    }
    logger.warn("STATUS FLOW [db update verify]", {
      slug,
      status: verifyRow ? verifyRow.status : null
    });
    if (IS_NON_PROD) {
      console.warn("POSITION FLOW [db update verify]:", {
        slug,
        position: verifyRow ? verifyRow.position : null
      });
    }
    logger.warn("POSITION FLOW [db update verify]", {
      slug,
      position: verifyRow ? verifyRow.position : null
    });
    if (IS_NON_PROD) {
      console.log("DB VERIFY after UPDATE (post_name, total_posts):", {
        slug,
        post_name: verifyRow ? verifyRow.post_name : null,
        total_posts: verifyRow ? verifyRow.total_posts : null
      });
    }
    const expected = { qualification: qSql, state: sSql, department: dSql };
    const got = {
      qualification: verifyRow ? verifyRow.qualification : null,
      state: verifyRow ? verifyRow.state : null,
      department: verifyRow ? verifyRow.department : null
    };
    const mismatch =
      String(expected.qualification ?? "") !== String(got.qualification ?? "") ||
      String(expected.state ?? "") !== String(got.state ?? "") ||
      String(expected.department ?? "") !== String(got.department ?? "");

    logger.info("structured fields pipeline [6 stored row after UPDATE]", {
      slug,
      id: verifyRow?.id,
      stage6_db: got,
      matchesBoundParams: !mismatch,
      expectedBound: expected
    });

    if (mismatch) {
      logger.error("structured fields mismatch: bound params vs row read after UPDATE (check triggers / generated columns)", {
        slug,
        expectedBound: expected,
        stage6_db: got
      });
    }
  }

  return result;
}

async function selectIdBySlug(slug, conn) {
  const [[idRow]] = await conn.query("SELECT id FROM pages WHERE slug=? AND deleted=0 LIMIT 1", [slug]);
  return idRow && idRow.id;
}

module.exports = {
  SECTION_STATUS_GROUPS,
  countPublicList,
  selectPublicListPage,
  countPublicListByDepartment,
  selectPublicListByDepartment,
  findRowBySlug,
  findPublicRowBySlug,
  selectTopViews,
  selectDepartmentCounts,
  selectQualificationCounts,
  selectStateCounts,
  incrementViewsBySlug,
  searchByFullText,
  searchByLike,
  suggestByTitlePrefix,
  selectAllForFinder,
  selectFinderPage,
  selectSmallBoxes,
  selectBreakingNews,
  selectByCategory,
  selectAllSlugsPublic,
  findRelatedAnchorBySlug,
  selectRelatedCandidates,
  selectRelated,
  selectDistinctStatuses,
  countJobsFiltered,
  selectJobsFiltered,
  findJobById,
  countAdminPages,
  selectAdminPageList,
  selectDistinctCategories,
  selectDistinctStatusesAll,
  selectTrashPages,
  countTrashPages,
  selectTrashPagesPaginated,
  softDeleteBySlug,
  restoreBySlug,
  hardDeleteBySlug,
  selectDashboardAggregate,
  findAdminPageBySlug,
  findActiveIdBySlug,
  getUniqueSlug,
  insertPage,
  updatePageBySlug,
  selectIdBySlug
};
