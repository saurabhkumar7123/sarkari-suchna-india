"use strict";

const { readStore, writeStore, nextId } = require("../base/fileStore");
const { tableExists } = require("../base/schemaGuard");
const { stringifyJson, parseJsonColumn } = require("../base/jsonColumn");
const db = require("../../../config/db");

const STORE_NAME = "entity-versions";

async function createVersion({
  entityType,
  entityId,
  version,
  author = "system",
  changeSummary = "",
  snapshot = null,
  connection = null
}) {
  const row = {
    entity_type: String(entityType),
    entity_id: Number(entityId),
    version: Number(version) || 1,
    author: String(author || "system").slice(0, 128),
    change_summary: String(changeSummary || "").slice(0, 2000),
    snapshot_json: snapshot,
    created_at: new Date().toISOString()
  };

  if (await tableExists("entity_versions")) {
    const executor = connection || db;
    await executor.query(
      `INSERT INTO entity_versions
       (entity_type, entity_id, version, author, change_summary, snapshot_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        row.entity_type,
        row.entity_id,
        row.version,
        row.author,
        row.change_summary,
        stringifyJson(snapshot)
      ]
    );
    return row;
  }

  const rows = readStore(STORE_NAME, []);
  const saved = { id: nextId(rows), ...row };
  rows.push(saved);
  writeStore(STORE_NAME, rows);
  return saved;
}

async function listVersions({ entityType, entityId, page = 1, limit = 20 } = {}) {
  if (await tableExists("entity_versions")) {
    const safePage = Math.max(1, parseInt(String(page), 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (safePage - 1) * safeLimit;
    const params = [String(entityType), Number(entityId)];
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM entity_versions
       WHERE entity_type = ? AND entity_id = ?`,
      params
    );
    const [rows] = await db.query(
      `SELECT id, entity_type, entity_id, version, author, change_summary, snapshot_json, created_at
       FROM entity_versions
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY version DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );
    return {
      data: rows.map((row) => ({
        ...row,
        snapshot_json: parseJsonColumn(row.snapshot_json)
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: Number(countRow?.total) || 0
      }
    };
  }

  const rows = readStore(STORE_NAME, []).filter(
    (row) => row.entity_type === entityType && Number(row.entity_id) === Number(entityId)
  );
  const safePage = Math.max(1, parseInt(String(page), 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
  const offset = (safePage - 1) * safeLimit;
  return {
    data: rows
      .sort((a, b) => Number(b.version) - Number(a.version))
      .slice(offset, offset + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total: rows.length }
  };
}

async function getVersion({ entityType, entityId, version }) {
  if (await tableExists("entity_versions")) {
    const [rows] = await db.query(
      `SELECT id, entity_type, entity_id, version, author, change_summary, snapshot_json, created_at
       FROM entity_versions
       WHERE entity_type = ? AND entity_id = ? AND version = ?
       LIMIT 1`,
      [String(entityType), Number(entityId), Number(version)]
    );
    const row = rows[0];
    if (!row) return null;
    return { ...row, snapshot_json: parseJsonColumn(row.snapshot_json) };
  }

  const rows = readStore(STORE_NAME, []);
  return (
    rows.find(
      (row) =>
        row.entity_type === entityType &&
        Number(row.entity_id) === Number(entityId) &&
        Number(row.version) === Number(version)
    ) || null
  );
}

function compareVersions(left, right) {
  const a = left?.snapshot_json || left?.snapshot || {};
  const b = right?.snapshot_json || right?.snapshot || {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changes = [];
  for (const key of keys) {
    const av = JSON.stringify(a[key]);
    const bv = JSON.stringify(b[key]);
    if (av !== bv) {
      changes.push({ field: key, before: a[key], after: b[key] });
    }
  }
  return {
    leftVersion: left?.version ?? null,
    rightVersion: right?.version ?? null,
    changes
  };
}

module.exports = {
  createVersion,
  listVersions,
  getVersion,
  compareVersions
};
