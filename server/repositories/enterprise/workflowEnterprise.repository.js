"use strict";

const db = require("../../config/db");
const { tableExists } = require("../../lib/enterprise/base/schemaGuard");
const { readStore, writeStore, nextId } = require("../../lib/enterprise/base/fileStore");
const { parseJsonColumn, stringifyJson } = require("../../lib/enterprise/base/jsonColumn");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../../lib/enterprise/base/pagination");
const { matchesSearch, sortRows } = require("../../lib/enterprise/base/searchBuilder");
const versionHistoryService = require("../../lib/enterprise/versionHistory/VersionHistoryService");
const softDeleteService = require("../../lib/enterprise/softDelete/SoftDeleteService");
const { assertLockVersion } = require("../../lib/enterprise/base/optimisticLock");

const TABLE = "automation_workflows";
const STORE = "automation-workflows";

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    state_json: parseJsonColumn(row.state_json, {}),
    history_json: parseJsonColumn(row.history_json, [])
  };
}

async function isReady() {
  return tableExists(TABLE);
}

async function getByKey(workflowKey) {
  if (await isReady()) {
    const [rows] = await db.query(
      `SELECT * FROM ${TABLE} WHERE workflow_key = ? AND deleted_at IS NULL LIMIT 1`,
      [String(workflowKey)]
    );
    return normalizeRow(rows[0]);
  }
  return normalizeRow(
    readStore(STORE, []).find(
      (row) => row.workflow_key === workflowKey && !row.deleted_at
    )
  );
}

async function getById(id) {
  if (await isReady()) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [Number(id)]);
    return normalizeRow(rows[0]);
  }
  return normalizeRow(readStore(STORE, []).find((row) => Number(row.id) === Number(id)));
}

async function createWorkflow(payload = {}) {
  const row = {
    workflow_key: String(payload.workflow_key || payload.workflowKey || "").trim(),
    workflow_version: Number(payload.workflow_version || 1),
    current_state: String(payload.current_state || "idle"),
    retry_count: Number(payload.retry_count || 0),
    failure_reason: payload.failure_reason || null,
    rollback_point: payload.rollback_point || null,
    state_json: payload.state_json || {},
    history_json: Array.isArray(payload.history_json) ? payload.history_json : [],
    started_at: payload.started_at || null,
    completed_at: payload.completed_at || null,
    lock_version: 0,
    deleted_at: null
  };
  if (!row.workflow_key) {
    const err = new Error("workflow_key is required");
    err.statusCode = 400;
    throw err;
  }

  if (await isReady()) {
    const [result] = await db.query(
      `INSERT INTO ${TABLE}
       (workflow_key, workflow_version, current_state, retry_count, failure_reason, rollback_point,
        state_json, history_json, started_at, completed_at, lock_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.workflow_key,
        row.workflow_version,
        row.current_state,
        row.retry_count,
        row.failure_reason,
        row.rollback_point,
        stringifyJson(row.state_json),
        stringifyJson(row.history_json),
        row.started_at,
        row.completed_at,
        row.lock_version
      ]
    );
    return getById(result.insertId);
  }

  const rows = readStore(STORE, []);
  const saved = { id: nextId(rows), ...row, created_at: new Date().toISOString() };
  rows.push(saved);
  writeStore(STORE, rows);
  return normalizeRow(saved);
}

async function updateWorkflow(workflowKey, patch = {}, meta = {}) {
  const current = await getByKey(workflowKey);
  if (!current) return null;
  const nextLock = assertLockVersion(current.lock_version, patch.lock_version);
  const history = [...(current.history_json || [])];
  if (patch.history_entry) history.push(patch.history_entry);
  const updated = {
    ...current,
    workflow_version: patch.workflow_version ?? current.workflow_version,
    current_state: patch.current_state ?? current.current_state,
    retry_count: patch.retry_count ?? current.retry_count,
    failure_reason: patch.failure_reason ?? current.failure_reason,
    rollback_point: patch.rollback_point ?? current.rollback_point,
    state_json: patch.state_json ?? current.state_json,
    history_json: history,
    started_at: patch.started_at ?? current.started_at,
    completed_at: patch.completed_at ?? current.completed_at,
    lock_version: nextLock
  };

  if (await isReady()) {
    await db.query(
      `UPDATE ${TABLE}
       SET workflow_version = ?, current_state = ?, retry_count = ?, failure_reason = ?,
           rollback_point = ?, state_json = ?, history_json = ?, started_at = ?, completed_at = ?,
           lock_version = ?
       WHERE workflow_key = ? AND deleted_at IS NULL`,
      [
        updated.workflow_version,
        updated.current_state,
        updated.retry_count,
        updated.failure_reason,
        updated.rollback_point,
        stringifyJson(updated.state_json),
        stringifyJson(updated.history_json),
        updated.started_at,
        updated.completed_at,
        updated.lock_version,
        workflowKey
      ]
    );
  } else {
    const rows = readStore(STORE, []);
    const index = rows.findIndex((row) => row.workflow_key === workflowKey);
    if (index >= 0) rows[index] = { ...rows[index], ...updated };
    writeStore(STORE, rows);
  }

  await versionHistoryService.createVersion({
    entityType: "workflow",
    entityId: current.id,
    version: updated.workflow_version,
    author: meta.author || "system",
    changeSummary: meta.changeSummary || `Workflow state -> ${updated.current_state}`,
    snapshot: updated
  });

  return getByKey(workflowKey);
}

async function listWorkflows(opts = {}) {
  if (await isReady()) {
    const page = parsePage(opts.page);
    const limit = parseLimit(opts.limit);
    const offset = buildOffset(page, limit);
    const params = [];
    let where = "WHERE deleted_at IS NULL";
    if (opts.current_state) {
      where += " AND current_state = ?";
      params.push(opts.current_state);
    }
    const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM ${TABLE} ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM ${TABLE} ${where}
       ORDER BY updated_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return buildPaginationResult({
      page,
      limit,
      total: Number(countRow?.total) || 0,
      data: rows.map(normalizeRow)
    });
  }

  const rows = readStore(STORE, []).filter((row) => !row.deleted_at);
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit);
  const offset = buildOffset(page, limit);
  return buildPaginationResult({
    page,
    limit,
    total: rows.length,
    data: sortRows(rows.map(normalizeRow), opts.sortBy || "updated_at", opts.sortOrder).slice(
      offset,
      offset + limit
    )
  });
}

async function search(opts = {}) {
  const result = await listWorkflows({ ...opts, limit: 100 });
  const filtered = result.data.filter((row) =>
    matchesSearch(row, opts.search, ["workflow_key", "current_state", "failure_reason"])
  );
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit);
  const offset = buildOffset(page, limit);
  return buildPaginationResult({
    page,
    limit,
    total: filtered.length,
    data: filtered.slice(offset, offset + limit)
  });
}

async function softDelete(workflowKey, { reason, deletedBy } = {}) {
  const current = await getByKey(workflowKey);
  if (!current) return null;
  if (await isReady()) {
    await db.query(`UPDATE ${TABLE} SET deleted_at = NOW() WHERE workflow_key = ?`, [workflowKey]);
  } else {
    const rows = readStore(STORE, []);
    const index = rows.findIndex((row) => row.workflow_key === workflowKey);
    if (index >= 0) rows[index].deleted_at = new Date().toISOString();
    writeStore(STORE, rows);
  }
  await softDeleteService.recordSoftDelete({
    entityType: "workflow",
    entityId: current.id,
    reason,
    deletedBy
  });
  return getByKey(workflowKey);
}

module.exports = {
  isReady,
  getByKey,
  getById,
  createWorkflow,
  updateWorkflow,
  listWorkflows,
  search,
  softDelete
};
