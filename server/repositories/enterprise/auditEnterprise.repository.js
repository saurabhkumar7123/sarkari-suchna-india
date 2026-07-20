"use strict";

const db = require("../../config/db");
const { tableExists } = require("../../lib/enterprise/base/schemaGuard");
const { readStore, writeStore, nextId } = require("../../lib/enterprise/base/fileStore");
const { parseJsonColumn, stringifyJson } = require("../../lib/enterprise/base/jsonColumn");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../../lib/enterprise/base/pagination");
const { matchesSearch } = require("../../lib/enterprise/base/searchBuilder");
const { listActivity } = require("../../services/adminActivity.service");

const TABLE = "automation_audit_log";
const STORE = "automation-audit-log";
const MAX_FILE_ITEMS = 10000;

const CATEGORIES = [
  "automation",
  "review",
  "workflow",
  "recovery",
  "validation",
  "settings",
  "authentication",
  "feature_flags",
  "errors",
  "general"
];

async function isReady() {
  return tableExists(TABLE);
}

async function recordEvent({
  category = "general",
  eventType = "event",
  entityType = null,
  entityId = null,
  action,
  actor = "system",
  status = "success",
  detail = null,
  ip = null,
  userAgent = null,
  requestId = null
}) {
  const row = {
    event_type: String(eventType).slice(0, 64),
    category: CATEGORIES.includes(category) ? category : "general",
    actor: String(actor || "system").slice(0, 128),
    entity_type: entityType ? String(entityType).slice(0, 64) : null,
    entity_id: entityId != null ? Number(entityId) : null,
    action: String(action || eventType).slice(0, 128),
    status: String(status || "success").slice(0, 32),
    detail_json: detail,
    ip: ip ? String(ip).slice(0, 64) : null,
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    request_id: requestId ? String(requestId).slice(0, 128) : null,
    created_at: new Date().toISOString()
  };

  if (await isReady()) {
    await db.query(
      `INSERT INTO ${TABLE}
       (event_type, category, actor, entity_type, entity_id, action, status, detail_json, ip, user_agent, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        row.event_type,
        row.category,
        row.actor,
        row.entity_type,
        row.entity_id,
        row.action,
        row.status,
        stringifyJson(row.detail_json),
        row.ip,
        row.user_agent,
        row.request_id
      ]
    );
    return row;
  }

  const rows = readStore(STORE, []);
  const saved = { id: nextId(rows), ...row };
  rows.push(saved);
  const trimmed = rows.length > MAX_FILE_ITEMS ? rows.slice(rows.length - MAX_FILE_ITEMS) : rows;
  writeStore(STORE, trimmed);
  return saved;
}

async function listEvents(opts = {}) {
  if (await isReady()) {
    const page = parsePage(opts.page);
    const limit = parseLimit(opts.limit, 20, 200);
    const offset = buildOffset(page, limit);
    const params = [];
    let where = "WHERE 1=1";
    if (opts.category) {
      where += " AND category = ?";
      params.push(String(opts.category));
    }
    if (opts.eventType) {
      where += " AND event_type = ?";
      params.push(String(opts.eventType));
    }
    if (opts.entityType) {
      where += " AND entity_type = ?";
      params.push(String(opts.entityType));
    }
    if (opts.actor) {
      where += " AND actor = ?";
      params.push(String(opts.actor));
    }
    if (opts.from) {
      where += " AND created_at >= ?";
      params.push(opts.from);
    }
    if (opts.to) {
      where += " AND created_at <= ?";
      params.push(opts.to);
    }
    if (opts.search) {
      where += " AND (action LIKE ? OR event_type LIKE ? OR actor LIKE ?)";
      const term = `%${String(opts.search).trim()}%`;
      params.push(term, term, term);
    }
    const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM ${TABLE} ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM ${TABLE} ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return buildPaginationResult({
      page,
      limit,
      total: Number(countRow?.total) || 0,
      data: rows.map((row) => ({ ...row, detail_json: parseJsonColumn(row.detail_json) }))
    });
  }

  let rows = readStore(STORE, []);
  if (opts.category) rows = rows.filter((row) => row.category === opts.category);
  if (opts.eventType) rows = rows.filter((row) => row.event_type === opts.eventType);
  if (opts.entityType) rows = rows.filter((row) => row.entity_type === opts.entityType);
  if (opts.actor) rows = rows.filter((row) => row.actor === opts.actor);
  if (opts.search) {
    rows = rows.filter((row) =>
      matchesSearch(row, opts.search, ["action", "event_type", "actor", "category"])
    );
  }
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit, 20, 200);
  const offset = buildOffset(page, limit);
  return buildPaginationResult({
    page,
    limit,
    total: rows.length,
    data: rows
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(offset, offset + limit)
  });
}

async function exportEvents(opts = {}) {
  const result = await listEvents({ ...opts, page: 1, limit: 5000 });
  return {
    exportedAt: new Date().toISOString(),
    count: result.data.length,
    filters: {
      category: opts.category || null,
      eventType: opts.eventType || null,
      from: opts.from || null,
      to: opts.to || null
    },
    entries: result.data
  };
}

async function getTimeline({ entityType, entityId, limit = 50 } = {}) {
  return listEvents({
    entityType,
    page: 1,
    limit
  });
}

async function mergeLegacyAdminActivity(opts = {}) {
  const legacy = await listActivity(opts);
  const enterprise = await listEvents({ ...opts, page: 1, limit: 200 });
  const merged = [
    ...legacy.data.map((row) => ({
      source: "admin_activity",
      category: "authentication",
      event_type: row.action,
      actor: row.admin,
      action: row.action,
      status: row.status,
      created_at: row.timestamp,
      detail_json: {
        target: row.target,
        ip: row.ip,
        userAgent: row.userAgent,
        requestId: row.requestId
      }
    })),
    ...enterprise.data.map((row) => ({ source: "enterprise_audit", ...row }))
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const page = parsePage(opts.page);
  const safeLimit = parseLimit(opts.limit, 20, 200);
  const offset = buildOffset(page, safeLimit);
  return buildPaginationResult({
    page,
    limit: safeLimit,
    total: merged.length,
    data: merged.slice(offset, offset + safeLimit)
  });
}

module.exports = {
  CATEGORIES,
  isReady,
  recordEvent,
  listEvents,
  exportEvents,
  getTimeline,
  mergeLegacyAdminActivity
};
