"use strict";

const db = require("../../config/db");
const { tableExists } = require("../../lib/enterprise/base/schemaGuard");
const { readStore, writeStore } = require("../../lib/enterprise/base/fileStore");
const { parseJsonColumn, stringifyJson } = require("../../lib/enterprise/base/jsonColumn");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../../lib/enterprise/base/pagination");
const { matchesSearch, sortRows } = require("../../lib/enterprise/base/searchBuilder");
const recruitmentReviewRepository = require("../recruitmentReview.repository");
const versionHistoryService = require("../../lib/enterprise/versionHistory/VersionHistoryService");

const TABLE = "review_queue_extended";
const STORE = "review-queue-extended";

function normalizeExtended(row) {
  if (!row) return null;
  return {
    ...row,
    queue_json: parseJsonColumn(row.queue_json, {}),
    assignment_json: parseJsonColumn(row.assignment_json, {}),
    confidence_json: parseJsonColumn(row.confidence_json, {}),
    risk_json: parseJsonColumn(row.risk_json, {}),
    warnings_json: parseJsonColumn(row.warnings_json, []),
    recommendation_json: parseJsonColumn(row.recommendation_json, {}),
    history_json: parseJsonColumn(row.history_json, [])
  };
}

function buildDefaultExtended(reviewId) {
  return {
    review_id: Number(reviewId),
    queue_json: { position: null, lane: "default" },
    priority: "normal",
    reviewer: null,
    assignment_json: { assigned_at: null, duration_minutes: null },
    confidence_json: { level: "none", score: null },
    risk_json: { level: "low", score: 0 },
    warnings_json: [],
    recommendation_json: { action: null, rationale: "" },
    history_json: [],
    version: 1
  };
}

async function isReady() {
  return tableExists(TABLE);
}

async function getByReviewId(reviewId) {
  const base = await recruitmentReviewRepository.findById(reviewId);
  if (!base) return null;

  let extended;
  if (await isReady()) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE review_id = ? LIMIT 1`, [reviewId]);
    extended = normalizeExtended(rows[0]);
  } else {
    extended = normalizeExtended(
      readStore(STORE, []).find((row) => Number(row.review_id) === Number(reviewId))
    );
  }
  if (!extended) extended = buildDefaultExtended(reviewId);

  return {
    ...base,
    enterprise: extended,
    priority: extended.priority,
    reviewer: extended.reviewer,
    assignment: extended.assignment_json,
    confidence_detail: extended.confidence_json,
    risk: extended.risk_json,
    warnings: extended.warnings_json,
    recommendation: extended.recommendation_json,
    history: extended.history_json,
    version: extended.version
  };
}

async function upsertExtended(reviewId, patch = {}, meta = {}) {
  const existing = (await getByReviewId(reviewId)) || { enterprise: buildDefaultExtended(reviewId) };
  const current = existing.enterprise || buildDefaultExtended(reviewId);
  const history = [...(current.history_json || [])];
  if (patch.history_entry) history.push(patch.history_entry);
  const updated = {
    ...current,
    queue_json: patch.queue ?? current.queue_json,
    priority: patch.priority ?? current.priority,
    reviewer: patch.reviewer ?? current.reviewer,
    assignment_json: patch.assignment ?? current.assignment_json,
    confidence_json: patch.confidence_detail ?? current.confidence_json,
    risk_json: patch.risk ?? current.risk_json,
    warnings_json: patch.warnings ?? current.warnings_json,
    recommendation_json: patch.recommendation ?? current.recommendation_json,
    history_json: history,
    version: (Number(current.version) || 1) + 1
  };

  if (await isReady()) {
    await db.query(
      `INSERT INTO ${TABLE}
       (review_id, queue_json, priority, reviewer, assignment_json, confidence_json, risk_json,
        warnings_json, recommendation_json, history_json, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         queue_json = VALUES(queue_json),
         priority = VALUES(priority),
         reviewer = VALUES(reviewer),
         assignment_json = VALUES(assignment_json),
         confidence_json = VALUES(confidence_json),
         risk_json = VALUES(risk_json),
         warnings_json = VALUES(warnings_json),
         recommendation_json = VALUES(recommendation_json),
         history_json = VALUES(history_json),
         version = VALUES(version)`,
      [
        reviewId,
        stringifyJson(updated.queue_json),
        updated.priority,
        updated.reviewer,
        stringifyJson(updated.assignment_json),
        stringifyJson(updated.confidence_json),
        stringifyJson(updated.risk_json),
        stringifyJson(updated.warnings_json),
        stringifyJson(updated.recommendation_json),
        stringifyJson(updated.history_json),
        updated.version
      ]
    );
  } else {
    const rows = readStore(STORE, []);
    const index = rows.findIndex((row) => Number(row.review_id) === Number(reviewId));
    if (index >= 0) rows[index] = updated;
    else rows.push(updated);
    writeStore(STORE, rows);
  }

  await versionHistoryService.createVersion({
    entityType: "review",
    entityId: reviewId,
    version: updated.version,
    author: meta.author || "system",
    changeSummary: meta.changeSummary || "Review queue enterprise data updated",
    snapshot: updated
  });

  return getByReviewId(reviewId);
}

async function listEnterprise(opts = {}) {
  const pending = await recruitmentReviewRepository.findPending({
    limit: parseLimit(opts.limit, 50, 100)
  });
  const enriched = [];
  for (const row of pending) {
    enriched.push(await getByReviewId(row.id));
  }
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit);
  const offset = buildOffset(page, limit);
  return buildPaginationResult({
    page,
    limit,
    total: enriched.length,
    data: enriched.slice(offset, offset + limit)
  });
}

async function search(opts = {}) {
  const result = await listEnterprise({ ...opts, limit: 100 });
  const filtered = result.data.filter((row) =>
    matchesSearch(row, opts.search, ["title", "status", "reviewer", "priority"])
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

module.exports = {
  isReady,
  getByReviewId,
  upsertExtended,
  listEnterprise,
  search
};
