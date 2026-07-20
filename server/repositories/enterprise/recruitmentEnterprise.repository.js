"use strict";

const db = require("../../config/db");
const { tableExists } = require("../../lib/enterprise/base/schemaGuard");
const { readStore, writeStore, nextId } = require("../../lib/enterprise/base/fileStore");
const { parseJsonColumn, stringifyJson } = require("../../lib/enterprise/base/jsonColumn");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../../lib/enterprise/base/pagination");
const { matchesSearch, sortRows } = require("../../lib/enterprise/base/searchBuilder");
const recruitmentRepository = require("../recruitment.repository");
const versionHistoryService = require("../../lib/enterprise/versionHistory/VersionHistoryService");
const softDeleteService = require("../../lib/enterprise/softDelete/SoftDeleteService");
const { assertLockVersion } = require("../../lib/enterprise/base/optimisticLock");

const TABLE = "recruitment_extended";
const STORE = "recruitment-extended";

const JSON_FIELDS = [
  "timeline_json",
  "confidence_json",
  "validation_json",
  "missing_info_json",
  "review_notes_json",
  "history_recovery_json",
  "metadata_json"
];

function normalizeExtended(row) {
  if (!row) return null;
  const copy = { ...row };
  for (const field of JSON_FIELDS) {
    if (field in copy) copy[field] = parseJsonColumn(copy[field]);
  }
  return copy;
}

function buildDefaultExtended(recruitmentId) {
  return {
    recruitment_id: Number(recruitmentId),
    timeline_json: [],
    confidence_json: { score: null, level: "none", factors: [] },
    validation_json: { valid: true, errors: [], warnings: [] },
    missing_info_json: { items: [] },
    review_notes_json: [],
    history_recovery_json: { recoverable: false, entries: [] },
    metadata_json: {},
    current_stage: null,
    previous_stage: null,
    next_expected_stage: null,
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

async function getByRecruitmentId(recruitmentId, { includeDeleted = false } = {}) {
  const base = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!base) return null;

  let extended;
  if (await isReady()) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE recruitment_id = ? LIMIT 1`, [
      recruitmentId
    ]);
    extended = normalizeExtended(rows[0]);
  } else {
    extended = readStore(STORE, []).find(
      (row) => Number(row.recruitment_id) === Number(recruitmentId)
    );
    extended = normalizeExtended(extended);
  }

  if (!extended) extended = buildDefaultExtended(recruitmentId);
  if (!includeDeleted && extended.deleted_at) return null;

  return {
    ...base,
    enterprise: extended,
    version: extended.version,
    current_stage: extended.current_stage,
    previous_stage: extended.previous_stage,
    next_expected_stage: extended.next_expected_stage,
    timeline: extended.timeline_json,
    confidence: extended.confidence_json,
    validation: extended.validation_json,
    missing_information: extended.missing_info_json,
    review_notes: extended.review_notes_json,
    history_recovery: extended.history_recovery_json,
    metadata: extended.metadata_json,
    deleted_at: extended.deleted_at,
    lock_version: extended.lock_version
  };
}

async function upsertExtended(recruitmentId, patch = {}, meta = {}) {
  const existing = (await getByRecruitmentId(recruitmentId, { includeDeleted: true })) || {
    enterprise: buildDefaultExtended(recruitmentId)
  };
  const current = existing.enterprise || buildDefaultExtended(recruitmentId);
  const nextVersion = assertLockVersion(current.lock_version, patch.lock_version);
  const updated = {
    ...current,
    timeline_json: patch.timeline ?? current.timeline_json,
    confidence_json: patch.confidence ?? current.confidence_json,
    validation_json: patch.validation ?? current.validation_json,
    missing_info_json: patch.missing_information ?? current.missing_info_json,
    review_notes_json: patch.review_notes ?? current.review_notes_json,
    history_recovery_json: patch.history_recovery ?? current.history_recovery_json,
    metadata_json: patch.metadata ?? current.metadata_json,
    current_stage: patch.current_stage ?? current.current_stage,
    previous_stage: patch.previous_stage ?? current.previous_stage,
    next_expected_stage: patch.next_expected_stage ?? current.next_expected_stage,
    version: (Number(current.version) || 1) + 1,
    lock_version: nextVersion
  };

  if (await isReady()) {
    await db.query(
      `INSERT INTO ${TABLE}
       (recruitment_id, timeline_json, confidence_json, validation_json, missing_info_json,
        review_notes_json, history_recovery_json, metadata_json, current_stage, previous_stage,
        next_expected_stage, version, lock_version, deleted_at, delete_reason, deleted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         timeline_json = VALUES(timeline_json),
         confidence_json = VALUES(confidence_json),
         validation_json = VALUES(validation_json),
         missing_info_json = VALUES(missing_info_json),
         review_notes_json = VALUES(review_notes_json),
         history_recovery_json = VALUES(history_recovery_json),
         metadata_json = VALUES(metadata_json),
         current_stage = VALUES(current_stage),
         previous_stage = VALUES(previous_stage),
         next_expected_stage = VALUES(next_expected_stage),
         version = VALUES(version),
         lock_version = VALUES(lock_version),
         deleted_at = VALUES(deleted_at),
         delete_reason = VALUES(delete_reason),
         deleted_by = VALUES(deleted_by)`,
      [
        recruitmentId,
        stringifyJson(updated.timeline_json),
        stringifyJson(updated.confidence_json),
        stringifyJson(updated.validation_json),
        stringifyJson(updated.missing_info_json),
        stringifyJson(updated.review_notes_json),
        stringifyJson(updated.history_recovery_json),
        stringifyJson(updated.metadata_json),
        updated.current_stage,
        updated.previous_stage,
        updated.next_expected_stage,
        updated.version,
        updated.lock_version,
        updated.deleted_at,
        updated.delete_reason,
        updated.deleted_by
      ]
    );
  } else {
    const rows = readStore(STORE, []);
    const index = rows.findIndex((row) => Number(row.recruitment_id) === Number(recruitmentId));
    if (index >= 0) rows[index] = updated;
    else rows.push(updated);
    writeStore(STORE, rows);
  }

  await versionHistoryService.createVersion({
    entityType: "recruitment",
    entityId: recruitmentId,
    version: updated.version,
    author: meta.author || "system",
    changeSummary: meta.changeSummary || "Recruitment enterprise data updated",
    snapshot: updated
  });

  return getByRecruitmentId(recruitmentId);
}

async function listEnterprise(opts = {}) {
  const base = await recruitmentRepository.listRecruitments(opts);
  const enriched = [];
  for (const row of base.data) {
    const item = await getByRecruitmentId(row.id);
    if (item) enriched.push(item);
  }
  return { ...base, data: enriched };
}

async function search(opts = {}) {
  const result = await listEnterprise({ ...opts, limit: 100 });
  const filtered = result.data.filter((row) =>
    matchesSearch(
      {
        title: row.title,
        slug: row.slug,
        department: row.department,
        current_stage: row.current_stage
      },
      opts.search,
      ["title", "slug", "department", "current_stage"]
    )
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

async function softDelete(recruitmentId, { reason, deletedBy } = {}) {
  const current = await getByRecruitmentId(recruitmentId, { includeDeleted: true });
  if (!current) return null;
  const patch = {
    ...current.enterprise,
    deleted_at: new Date().toISOString(),
    delete_reason: reason || null,
    deleted_by: deletedBy || "system"
  };
  await upsertExtended(recruitmentId, {
    ...patch,
    lock_version: current.lock_version
  });
  await softDeleteService.recordSoftDelete({
    entityType: "recruitment",
    entityId: recruitmentId,
    reason,
    deletedBy
  });
  return getByRecruitmentId(recruitmentId, { includeDeleted: true });
}

async function restore(recruitmentId, { restoredBy } = {}) {
  const current = await getByRecruitmentId(recruitmentId, { includeDeleted: true });
  if (!current) return null;
  await upsertExtended(recruitmentId, {
    ...current.enterprise,
    deleted_at: null,
    delete_reason: null,
    deleted_by: null,
    lock_version: current.lock_version
  });
  await softDeleteService.recordRestore({
    entityType: "recruitment",
    entityId: recruitmentId,
    restoredBy
  });
  return getByRecruitmentId(recruitmentId);
}

module.exports = {
  isReady,
  getByRecruitmentId,
  upsertExtended,
  listEnterprise,
  search,
  softDelete,
  restore
};
