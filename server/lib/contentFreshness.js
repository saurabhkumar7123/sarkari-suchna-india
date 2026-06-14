"use strict";

/**
 * Fields that represent substantive page content for homepage freshness ordering.
 * Excludes placement metadata (breaking, badges, small_box_slot, position, event_time).
 */
const CONTENT_FRESHNESS_FIELD_KEYS = [
  "title",
  "content",
  "raw_text",
  "category",
  "status",
  "qualification",
  "state",
  "department",
  "post_name",
  "total_posts",
  "last_date"
];

function stripInvisible(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeComparableString(value) {
  if (value == null) return "";
  return stripInvisible(String(value)).replace(/\s+/g, " ").trim();
}

function normalizeStructured(value) {
  const s = normalizeComparableString(value).toLowerCase();
  return s || null;
}

function normalizeOptionalVarchar(value) {
  if (value === undefined || value === null) return null;
  const s = normalizeComparableString(value);
  if (!s) return "";
  return s;
}

function normalizeLastDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    value = value.toString("utf8").trim();
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  return s || null;
}

function valuesEquivalent(a, b) {
  if (a === b) return true;
  if ((a === null || a === "") && (b === null || b === "")) return true;
  return false;
}

/**
 * @param {Record<string, unknown>} row Existing DB row (snake_case columns).
 * @returns {Record<string, string | null>}
 */
function buildExistingContentSnapshot(row) {
  if (!row || typeof row !== "object") return null;
  return {
    title: normalizeComparableString(row.title),
    content: row.content ?? "",
    raw_text: row.raw_text ?? "",
    category: normalizeComparableString(row.category),
    status: normalizeComparableString(row.status),
    qualification: normalizeStructured(row.qualification),
    state: normalizeStructured(row.state),
    department: normalizeStructured(row.department),
    post_name: normalizeOptionalVarchar(row.post_name),
    total_posts: normalizeOptionalVarchar(row.total_posts),
    last_date: normalizeLastDate(row.last_date)
  };
}

/**
 * @param {Record<string, unknown>} params updatePageBySlug incoming values.
 * @returns {Record<string, string | null>}
 */
function buildIncomingContentSnapshot(params) {
  return {
    title: normalizeComparableString(params.title),
    content: params.finalHTML ?? params.content ?? "",
    raw_text: params.text ?? params.raw_text ?? "",
    category: normalizeComparableString(params.category),
    status: normalizeComparableString(params.normalizedStatus ?? params.status),
    qualification: normalizeStructured(params.qualification),
    state: normalizeStructured(params.state),
    department: normalizeStructured(params.department),
    post_name: normalizeOptionalVarchar(params.postName ?? params.post_name),
    total_posts: normalizeOptionalVarchar(params.totalPosts ?? params.total_posts),
    last_date: normalizeLastDate(params.lastDate ?? params.last_date)
  };
}

/**
 * Returns true when any content-freshness field differs from the stored row.
 * @param {Record<string, unknown> | null | undefined} existingRow
 * @param {Record<string, unknown>} incomingParams
 */
function pageContentFieldsChanged(existingRow, incomingParams) {
  const existing = buildExistingContentSnapshot(existingRow);
  const incoming = buildIncomingContentSnapshot(incomingParams);
  if (!existing) return true;
  for (const key of CONTENT_FRESHNESS_FIELD_KEYS) {
    if (!valuesEquivalent(existing[key], incoming[key])) {
      return true;
    }
  }
  return false;
}

module.exports = {
  CONTENT_FRESHNESS_FIELD_KEYS,
  pageContentFieldsChanged,
  buildExistingContentSnapshot,
  buildIncomingContentSnapshot
};
