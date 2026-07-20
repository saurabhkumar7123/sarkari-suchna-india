"use strict";

const db = require("../../config/db");
const { tableExists } = require("../../lib/enterprise/base/schemaGuard");
const { readStore, writeStore } = require("../../lib/enterprise/base/fileStore");
const { parseJsonColumn, stringifyJson } = require("../../lib/enterprise/base/jsonColumn");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../../lib/enterprise/base/pagination");
const { matchesSearch, sortRows } = require("../../lib/enterprise/base/searchBuilder");
const generatorDraftRepository = require("../generatorDraft.repository");
const versionHistoryService = require("../../lib/enterprise/versionHistory/VersionHistoryService");
const softDeleteService = require("../../lib/enterprise/softDelete/SoftDeleteService");
const { assertLockVersion } = require("../../lib/enterprise/base/optimisticLock");

const TABLE = "draft_extended";
const STORE = "draft-extended";

const JSON_FIELDS = [
  "generator_payload_json",
  "structured_output_json",
  "difference_report_json",
  "ai_recommendation_json",
  "confidence_json",
  "warnings_json",
  "validation_json",
  "review_notes_json",
  "history_json"
];

function normalizeExtended(row) {
  if (!row) return null;
  const copy = { ...row };
  for (const field of JSON_FIELDS) {
    if (field in copy) copy[field] = parseJsonColumn(copy[field]);
  }
  return copy;
}

function buildDefaultExtended(draftId) {
  return {
    draft_id: Number(draftId),
    generator_payload_json: {},
    structured_output_json: {},
    difference_report_json: { changes: [] },
    ai_recommendation_json: { recommendation: null, rationale: "" },
    confidence_json: { score: null, level: "none" },
    warnings_json: [],
    validation_json: { valid: true, errors: [] },
    review_notes_json: [],
    history_json: [],
    version: 1,
    lock_version: 0,
    deleted_at: null,
    delete_reason: null,
    deleted_by: null
  };
}

async function isReady() {
  return tableExists(TABLE);
}

async function getByDraftId(draftId, { includeDeleted = false } = {}) {
  const base = await generatorDraftRepository.findById(draftId);
  if (!base) return null;

  let extended;
  if (await isReady()) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE draft_id = ? LIMIT 1`, [draftId]);
    extended = normalizeExtended(rows[0]);
  } else {
    extended = normalizeExtended(
      readStore(STORE, []).find((row) => Number(row.draft_id) === Number(draftId))
    );
  }

  if (!extended) extended = buildDefaultExtended(draftId);
  if (!includeDeleted && extended.deleted_at) return null;

  return {
    ...base,
    enterprise: extended,
    version: extended.version,
    generator_payload: extended.generator_payload_json,
    structured_output: extended.structured_output_json,
    difference_report: extended.difference_report_json,
    ai_recommendation: extended.ai_recommendation_json,
    confidence: extended.confidence_json,
    warnings: extended.warnings_json,
    validation: extended.validation_json,
    review_notes: extended.review_notes_json,
    history: extended.history_json,
    deleted_at: extended.deleted_at,
    lock_version: extended.lock_version
  };
}

async function upsertExtended(draftId, patch = {}, meta = {}) {
  const existing = (await getByDraftId(draftId, { includeDeleted: true })) || {
    enterprise: buildDefaultExtended(draftId)
  };
  const current = existing.enterprise || buildDefaultExtended(draftId);
  const nextVersion = assertLockVersion(current.lock_version, patch.lock_version);
  const updated = {
    ...current,
    generator_payload_json: patch.generator_payload ?? current.generator_payload_json,
    structured_output_json: patch.structured_output ?? current.structured_output_json,
    difference_report_json: patch.difference_report ?? current.difference_report_json,
    ai_recommendation_json: patch.ai_recommendation ?? current.ai_recommendation_json,
    confidence_json: patch.confidence ?? current.confidence_json,
    warnings_json: patch.warnings ?? current.warnings_json,
    validation_json: patch.validation ?? current.validation_json,
    review_notes_json: patch.review_notes ?? current.review_notes_json,
    history_json: patch.history ?? current.history_json,
    version: (Number(current.version) || 1) + 1,
    lock_version: nextVersion
  };

  if (await isReady()) {
    await db.query(
      `INSERT INTO ${TABLE}
       (draft_id, generator_payload_json, structured_output_json, difference_report_json,
        ai_recommendation_json, confidence_json, warnings_json, validation_json,
        review_notes_json, history_json, version, lock_version, deleted_at, delete_reason, deleted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         generator_payload_json = VALUES(generator_payload_json),
         structured_output_json = VALUES(structured_output_json),
         difference_report_json = VALUES(difference_report_json),
         ai_recommendation_json = VALUES(ai_recommendation_json),
         confidence_json = VALUES(confidence_json),
         warnings_json = VALUES(warnings_json),
         validation_json = VALUES(validation_json),
         review_notes_json = VALUES(review_notes_json),
         history_json = VALUES(history_json),
         version = VALUES(version),
         lock_version = VALUES(lock_version),
         deleted_at = VALUES(deleted_at),
         delete_reason = VALUES(delete_reason),
         deleted_by = VALUES(deleted_by)`,
      [
        draftId,
        stringifyJson(updated.generator_payload_json),
        stringifyJson(updated.structured_output_json),
        stringifyJson(updated.difference_report_json),
        stringifyJson(updated.ai_recommendation_json),
        stringifyJson(updated.confidence_json),
        stringifyJson(updated.warnings_json),
        stringifyJson(updated.validation_json),
        stringifyJson(updated.review_notes_json),
        stringifyJson(updated.history_json),
        updated.version,
        updated.lock_version,
        updated.deleted_at,
        updated.delete_reason,
        updated.deleted_by
      ]
    );
  } else {
    const rows = readStore(STORE, []);
    const index = rows.findIndex((row) => Number(row.draft_id) === Number(draftId));
    if (index >= 0) rows[index] = updated;
    else rows.push(updated);
    writeStore(STORE, rows);
  }

  await versionHistoryService.createVersion({
    entityType: "draft",
    entityId: draftId,
    version: updated.version,
    author: meta.author || "system",
    changeSummary: meta.changeSummary || "Draft enterprise data updated",
    snapshot: updated
  });

  return getByDraftId(draftId);
}

async function listEnterprise(opts = {}) {
  const hasTable = await generatorDraftRepository.tableExists();
  if (!hasTable) return buildPaginationResult({ page: 1, limit: 20, total: 0, data: [] });
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit);
  const offset = buildOffset(page, limit);
  const params = [];
  let where = "WHERE 1=1";
  if (opts.status) {
    where += " AND status = ?";
    params.push(opts.status);
  }
  const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM generator_drafts ${where}`, params);
  const [rows] = await db.query(
    `SELECT id FROM generator_drafts ${where}
     ORDER BY updated_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const enriched = [];
  for (const row of rows) {
    const item = await getByDraftId(row.id);
    if (item) enriched.push(item);
  }
  return buildPaginationResult({
    page,
    limit,
    total: Number(countRow?.total) || 0,
    data: enriched
  });
}

async function search(opts = {}) {
  const result = await listEnterprise({ ...opts, limit: 100 });
  const filtered = result.data.filter((row) =>
    matchesSearch({ title: row.title, status: row.status }, opts.search, ["title", "status"])
  );
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit);
  const offset = buildOffset(page, limit);
  return buildPaginationResult({
    page,
    limit,
    total: filtered.length,
    data: sortRows(filtered, opts.sortBy || "updated_at", opts.sortOrder).slice(
      offset,
      offset + limit
    )
  });
}

async function softDelete(draftId, { reason, deletedBy } = {}) {
  const current = await getByDraftId(draftId, { includeDeleted: true });
  if (!current) return null;
  await upsertExtended(draftId, {
    ...current.enterprise,
    deleted_at: new Date().toISOString(),
    delete_reason: reason || null,
    deleted_by: deletedBy || "system",
    lock_version: current.lock_version
  });
  await softDeleteService.recordSoftDelete({
    entityType: "draft",
    entityId: draftId,
    reason,
    deletedBy
  });
  return getByDraftId(draftId, { includeDeleted: true });
}

async function restore(draftId, { restoredBy } = {}) {
  const current = await getByDraftId(draftId, { includeDeleted: true });
  if (!current) return null;
  await upsertExtended(draftId, {
    ...current.enterprise,
    deleted_at: null,
    delete_reason: null,
    deleted_by: null,
    lock_version: current.lock_version
  });
  await softDeleteService.recordRestore({
    entityType: "draft",
    entityId: draftId,
    restoredBy
  });
  return getByDraftId(draftId);
}

module.exports = {
  isReady,
  getByDraftId,
  upsertExtended,
  listEnterprise,
  search,
  softDelete,
  restore
};
