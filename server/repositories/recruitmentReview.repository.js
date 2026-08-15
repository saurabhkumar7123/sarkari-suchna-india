"use strict";

/**
 * Recruitment review queue repository.
 * Schema-adaptive for local jobportal:
 *   - Rich (Phase 27) columns when present
 *   - Lean baseline columns: id, update_id, recruitment_id, recruitment_event_id,
 *     review_status, confidence_level, payload_json, created_at, updated_at
 *
 * Does not author or run migrations. Extended fields are stored in payload_json
 * when rich columns are absent.
 */

const db = require("../config/db");

const RICH_COLUMNS = [
  "event_type",
  "match_result_json",
  "confidence",
  "source_url",
  "title",
  "raw_notice_json",
  "normalized_notice_json",
  "processor_output_json",
  "decision",
  "notes"
];

const LEAN_STATUS_MAP = Object.freeze({
  pending: "pending",
  under_review: "pending",
  approved: "resolved",
  rejected: "dismissed",
  frozen: "pending",
  resolved: "resolved",
  dismissed: "dismissed"
});

let schemaCache = null;

async function tableExists() {
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'recruitment_review_queue' LIMIT 1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function detectSchema() {
  if (schemaCache) return schemaCache;
  const [rows] = await db.query(
    `SELECT column_name AS columnName
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'recruitment_review_queue'`
  );
  const columns = new Set(rows.map((r) => r.columnName || r.COLUMN_NAME));
  const rich = RICH_COLUMNS.every((c) => columns.has(c));
  schemaCache = { columns, rich, mode: rich ? "rich" : "lean" };
  return schemaCache;
}

function invalidateSchemaCache() {
  schemaCache = null;
}

function parseJsonColumn(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function toJsonValue(value) {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function confidenceToLevel(confidence) {
  switch (String(confidence || "").toLowerCase()) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "none":
      return 0;
    default:
      return null;
  }
}

function toStorageStatus(logicalStatus, rich) {
  const status = String(logicalStatus || "pending").toLowerCase();
  if (rich) return status;
  return LEAN_STATUS_MAP[status] || "pending";
}

function mapRow(row, schema) {
  if (!row) return null;
  const payload = parseJsonColumn(row.payload_json) || {};
  const embedded = payload.reviewItem && typeof payload.reviewItem === "object"
    ? payload.reviewItem
    : payload;

  const logicalStatus =
    (schema && schema.rich
      ? row.review_status
      : payload.logical_status || embedded.status || row.review_status) ?? null;

  return {
    id: row.id,
    update_id: row.update_id ?? null,
    recruitment_id: row.recruitment_id ?? null,
    recruitment_event_id: row.recruitment_event_id ?? null,
    event_type:
      row.event_type ??
      embedded.eventType ??
      embedded.event_type ??
      payload.event_type ??
      null,
    match_result:
      parseJsonColumn(row.match_result_json) ??
      embedded.matchResult ??
      embedded.match_result ??
      null,
    confidence:
      row.confidence ??
      embedded.confidence ??
      payload.confidence ??
      null,
    confidence_level: row.confidence_level ?? null,
    source_url:
      row.source_url ??
      embedded.sourceUrl ??
      embedded.source_url ??
      payload.source_url ??
      null,
    title:
      row.title ??
      embedded.title ??
      payload.title ??
      null,
    raw_notice:
      parseJsonColumn(row.raw_notice_json) ??
      payload.raw_notice ??
      null,
    normalized_notice:
      parseJsonColumn(row.normalized_notice_json) ??
      payload.normalized_notice ??
      null,
    processor_output:
      parseJsonColumn(row.processor_output_json) ??
      payload.processor_output ??
      null,
    payload,
    status: logicalStatus,
    decision:
      row.decision ??
      embedded.decision ??
      payload.decision ??
      "none",
    notes: row.notes ?? embedded.notes ?? payload.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    _schemaMode: schema ? schema.mode : null
  };
}

function buildSelectColumns(schema) {
  const base = [
    "id",
    "update_id",
    "recruitment_id",
    "recruitment_event_id",
    "review_status",
    "confidence_level",
    "payload_json",
    "created_at",
    "updated_at"
  ];
  if (schema.rich) {
    return [
      ...base.slice(0, 4),
      "event_type",
      "match_result_json",
      "confidence",
      "source_url",
      "title",
      "raw_notice_json",
      "normalized_notice_json",
      "processor_output_json",
      "review_status",
      "decision",
      "notes",
      "confidence_level",
      "payload_json",
      "created_at",
      "updated_at"
    ].join(", ");
  }
  return base.join(", ");
}

/**
 * @param {{
 *   recruitment_id?: number | null,
 *   update_id?: number | null,
 *   recruitment_event_id?: number | null,
 *   event_type: string,
 *   match_result?: Object | null,
 *   confidence?: string | null,
 *   source_url?: string | null,
 *   title: string,
 *   raw_notice?: Object | null,
 *   normalized_notice?: Object | string | null,
 *   processor_output?: Object | null,
 *   status?: string,
 *   decision?: string,
 *   notes?: string | null,
 *   payload?: Object | null
 * }} row
 */
async function create(row) {
  const schema = await detectSchema();
  const logicalStatus = row.status || "pending";
  const decision = row.decision || "none";
  const confidence = row.confidence ?? null;
  const storageStatus = toStorageStatus(logicalStatus, schema.rich);

  const payloadObject = {
    ...(row.payload && typeof row.payload === "object" ? row.payload : {}),
    title: row.title ?? null,
    event_type: row.event_type ?? null,
    source_url: row.source_url ?? null,
    confidence,
    decision,
    notes: row.notes ?? null,
    logical_status: logicalStatus,
    match_result: row.match_result ?? null,
    raw_notice: row.raw_notice ?? null,
    normalized_notice:
      typeof row.normalized_notice === "string"
        ? { text: row.normalized_notice }
        : row.normalized_notice ?? null,
    processor_output: row.processor_output ?? null
  };

  if (schema.rich) {
    const [result] = await db.query(
      `INSERT INTO recruitment_review_queue (
         update_id,
         recruitment_id,
         recruitment_event_id,
         event_type,
         match_result_json,
         confidence,
         confidence_level,
         source_url,
         title,
         raw_notice_json,
         normalized_notice_json,
         processor_output_json,
         payload_json,
         review_status,
         decision,
         notes
       ) VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
      [
        row.update_id ?? null,
        row.recruitment_id ?? null,
        row.recruitment_event_id ?? null,
        row.event_type,
        toJsonValue(row.match_result),
        confidence,
        confidenceToLevel(confidence),
        row.source_url ?? null,
        row.title,
        toJsonValue(row.raw_notice),
        toJsonValue(payloadObject.normalized_notice),
        toJsonValue(row.processor_output),
        toJsonValue(payloadObject),
        storageStatus,
        decision,
        row.notes ?? null
      ]
    );
    return findById(result.insertId);
  }

  const [result] = await db.query(
    `INSERT INTO recruitment_review_queue (
       update_id,
       recruitment_id,
       recruitment_event_id,
       review_status,
       confidence_level,
       payload_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.update_id ?? null,
      row.recruitment_id ?? null,
      row.recruitment_event_id ?? null,
      storageStatus,
      confidenceToLevel(confidence),
      toJsonValue(payloadObject)
    ]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const schema = await detectSchema();
  const [rows] = await db.query(
    `SELECT ${buildSelectColumns(schema)} FROM recruitment_review_queue WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapRow(rows[0] || null, schema);
}

/**
 * @param {{ limit?: number, offset?: number }} opts
 */
async function findPending(opts = {}) {
  const schema = await detectSchema();
  const limit = Math.min(100, Math.max(1, parseInt(String(opts.limit || 50), 10) || 50));
  const offset = Math.max(0, parseInt(String(opts.offset || 0), 10) || 0);
  const [rows] = await db.query(
    `SELECT ${buildSelectColumns(schema)}
     FROM recruitment_review_queue
     WHERE review_status = 'pending'
     ORDER BY created_at ASC, id ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return Array.isArray(rows) ? rows.map((r) => mapRow(r, schema)) : [];
}

/**
 * Admin list with optional filters + pagination.
 */
async function list(opts = {}) {
  const schema = await detectSchema();
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(opts.limit || 20), 10) || 20));
  const offset = (page - 1) * limit;
  const params = [];
  let where = "WHERE 1=1";

  if (opts.status) {
    const logical = String(opts.status).toLowerCase();
    if (schema.rich) {
      where += " AND review_status = ?";
      params.push(logical);
    } else {
      const storage = toStorageStatus(logical, false);
      where += " AND review_status = ?";
      params.push(storage);
    }
  }

  if (opts.event_type) {
    if (schema.rich) {
      where += " AND event_type = ?";
      params.push(String(opts.event_type).toLowerCase());
    } else {
      where += " AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.event_type')) = ?";
      params.push(String(opts.event_type).toLowerCase());
    }
  }

  if (opts.recruitment_id !== undefined && opts.recruitment_id !== null && opts.recruitment_id !== "") {
    const recruitmentId = parseInt(String(opts.recruitment_id), 10);
    if (Number.isInteger(recruitmentId) && recruitmentId > 0) {
      where += " AND recruitment_id = ?";
      params.push(recruitmentId);
    }
  }

  const search = String(opts.search || "").trim();
  if (search) {
    const like = `%${search}%`;
    const searchId = parseInt(search, 10);
    if (schema.rich) {
      if (Number.isInteger(searchId) && searchId > 0 && String(searchId) === search) {
        where += " AND (id = ? OR title LIKE ? OR source_url LIKE ? OR CAST(recruitment_id AS CHAR) LIKE ?)";
        params.push(searchId, like, like, like);
      } else {
        where += " AND (title LIKE ? OR source_url LIKE ? OR CAST(recruitment_id AS CHAR) LIKE ?)";
        params.push(like, like, like);
      }
    } else if (Number.isInteger(searchId) && searchId > 0 && String(searchId) === search) {
      where += " AND (id = ? OR CAST(recruitment_id AS CHAR) LIKE ? OR CAST(payload_json AS CHAR) LIKE ?)";
      params.push(searchId, like, like);
    } else {
      where += " AND (CAST(recruitment_id AS CHAR) LIKE ? OR CAST(payload_json AS CHAR) LIKE ?)";
      params.push(like, like);
    }
  }

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM recruitment_review_queue ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT ${buildSelectColumns(schema)}
     FROM recruitment_review_queue
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: Array.isArray(rows) ? rows.map((r) => mapRow(r, schema)) : [],
    pagination: {
      page,
      limit,
      total: countRow && countRow.total != null ? Number(countRow.total) : 0
    }
  };
}

/**
 * @param {number} id
 * @param {{ decision: string, status?: string, notes?: string | null }} patch
 */
async function updateDecision(id, patch = {}) {
  const schema = await detectSchema();
  const existing = await findById(id);
  if (!existing) return null;

  const logicalStatus = patch.status !== undefined ? patch.status : existing.status;
  const decision = patch.decision !== undefined ? patch.decision : existing.decision;
  const notes = patch.notes !== undefined ? patch.notes : existing.notes;
  const storageStatus = toStorageStatus(logicalStatus, schema.rich);

  if (schema.rich) {
    const fields = [];
    const params = [];
    if (patch.decision !== undefined) {
      fields.push("decision = ?");
      params.push(patch.decision);
    }
    if (patch.status !== undefined) {
      fields.push("review_status = ?");
      params.push(storageStatus);
    }
    if (patch.notes !== undefined) {
      fields.push("notes = ?");
      params.push(patch.notes);
    }
    if (fields.length === 0) return existing;
    params.push(id);
    const [result] = await db.query(
      `UPDATE recruitment_review_queue SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) return null;
    return findById(id);
  }

  const nextPayload = {
    ...(existing.payload && typeof existing.payload === "object" ? existing.payload : {}),
    decision,
    notes,
    logical_status: logicalStatus,
    title: existing.title,
    event_type: existing.event_type,
    source_url: existing.source_url,
    confidence: existing.confidence
  };

  const [result] = await db.query(
    `UPDATE recruitment_review_queue
     SET review_status = ?, payload_json = ?
     WHERE id = ?`,
    [storageStatus, toJsonValue(nextPayload), id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

async function bindRecruitmentId(id, recruitmentId) {
  const rid = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(rid) || rid <= 0) {
    return null;
  }
  const [result] = await db.query(
    `UPDATE recruitment_review_queue SET recruitment_id = ? WHERE id = ?`,
    [rid, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

module.exports = {
  tableExists,
  detectSchema,
  invalidateSchemaCache,
  create,
  findById,
  findPending,
  list,
  updateDecision,
  bindRecruitmentId
};
