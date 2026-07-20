"use strict";

const { readStore, writeStore, nextId } = require("../base/fileStore");
const { tableExists } = require("../base/schemaGuard");
const db = require("../../../config/db");
const auditEnterpriseRepository = require("../../../repositories/enterprise/auditEnterprise.repository");

const STORE_NAME = "soft-delete-log";

async function recordSoftDelete({
  entityType,
  entityId,
  reason = null,
  deletedBy = "system",
  connection = null
}) {
  const entry = {
    entity_type: String(entityType),
    entity_id: Number(entityId),
    reason: reason ? String(reason).slice(0, 2000) : null,
    deleted_by: String(deletedBy || "system").slice(0, 128),
    deleted_at: new Date().toISOString(),
    restored_at: null,
    permanent_deleted_at: null
  };

  if (await tableExists("soft_delete_log")) {
    const executor = connection || db;
    await executor.query(
      `INSERT INTO soft_delete_log (entity_type, entity_id, reason, deleted_by, deleted_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [entry.entity_type, entry.entity_id, entry.reason, entry.deleted_by]
    );
  } else {
    const rows = readStore(STORE_NAME, []);
    rows.push({ id: nextId(rows), ...entry });
    writeStore(STORE_NAME, rows);
  }

  await auditEnterpriseRepository.recordEvent({
    category: "recovery",
    eventType: "soft_delete",
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    action: "soft_delete",
    actor: entry.deleted_by,
    detail: { reason: entry.reason }
  }).catch(() => {});

  return entry;
}

async function recordRestore({ entityType, entityId, restoredBy = "system" }) {
  if (await tableExists("soft_delete_log")) {
    await db.query(
      `UPDATE soft_delete_log
       SET restored_at = NOW()
       WHERE entity_type = ? AND entity_id = ? AND restored_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [String(entityType), Number(entityId)]
    );
  } else {
    const rows = readStore(STORE_NAME, []);
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (
        rows[i].entity_type === entityType &&
        Number(rows[i].entity_id) === Number(entityId) &&
        !rows[i].restored_at
      ) {
        rows[i].restored_at = new Date().toISOString();
        break;
      }
    }
    writeStore(STORE_NAME, rows);
  }

  await auditEnterpriseRepository.recordEvent({
    category: "recovery",
    eventType: "restore",
    entityType,
    entityId,
    action: "restore",
    actor: restoredBy
  }).catch(() => {});
}

async function recordPermanentDelete({ entityType, entityId, deletedBy = "system" }) {
  if (await tableExists("soft_delete_log")) {
    await db.query(
      `UPDATE soft_delete_log
       SET permanent_deleted_at = NOW()
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY id DESC LIMIT 1`,
      [String(entityType), Number(entityId)]
    );
  }

  await auditEnterpriseRepository.recordEvent({
    category: "recovery",
    eventType: "permanent_delete",
    entityType,
    entityId,
    action: "permanent_delete",
    actor: deletedBy
  }).catch(() => {});
}

async function listSoftDeleteLog({ entityType, page = 1, limit = 20 } = {}) {
  if (await tableExists("soft_delete_log")) {
    const params = [];
    let where = "WHERE 1=1";
    if (entityType) {
      where += " AND entity_type = ?";
      params.push(String(entityType));
    }
    const safePage = Math.max(1, parseInt(String(page), 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (safePage - 1) * safeLimit;
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM soft_delete_log ${where}`,
      params
    );
    const [rows] = await db.query(
      `SELECT * FROM soft_delete_log ${where}
       ORDER BY deleted_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );
    return {
      data: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: Number(countRow?.total) || 0
      }
    };
  }

  const rows = readStore(STORE_NAME, []).filter(
    (row) => !entityType || row.entity_type === entityType
  );
  const safePage = Math.max(1, parseInt(String(page), 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
  const offset = (safePage - 1) * safeLimit;
  return {
    data: rows.slice(offset, offset + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total: rows.length }
  };
}

module.exports = {
  recordSoftDelete,
  recordRestore,
  recordPermanentDelete,
  listSoftDeleteLog
};
