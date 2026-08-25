"use strict";

/**
 * Snapshot the current public page before generatePage overwrites it.
 * Reuses entity_versions when the table exists; otherwise the file-store fallback
 * in VersionHistoryService.
 */

const versionHistory = require("../enterprise/versionHistory/VersionHistoryService");

function buildPageSnapshot(row = {}) {
  return {
    id: row.id ?? null,
    title: row.title ?? null,
    slug: row.slug ?? null,
    status: row.status ?? null,
    category: row.category ?? null,
    department: row.department ?? null,
    post_name: row.post_name ?? null,
    advertisement_no: row.advertisement_no ?? null,
    last_date: row.last_date ?? null,
    content: row.content ?? null,
    raw_text: row.raw_text ?? null,
    recruitment_id: row.recruitment_id ?? null,
    recruitment_event_id: row.recruitment_event_id ?? null,
    updated_at: row.updated_at ?? null,
    content_updated_at: row.content_updated_at ?? null
  };
}

async function nextPageVersion(pageId) {
  const listed = await versionHistory.listVersions({
    entityType: "page",
    entityId: pageId,
    page: 1,
    limit: 1
  });
  const latest = listed && Array.isArray(listed.data) && listed.data[0] ? listed.data[0] : null;
  const current = latest && latest.version != null ? Number(latest.version) : 0;
  return Number.isFinite(current) ? current + 1 : 1;
}

async function snapshotPublishedPage(row, { author = "generator", reason = "overwrite", connection = null } = {}) {
  if (!row || row.id == null) {
    return { skipped: true, reason: "no_page_row" };
  }
  const pageId = Number(row.id);
  if (!Number.isFinite(pageId) || pageId <= 0) {
    return { skipped: true, reason: "invalid_page_id" };
  }

  const version = await nextPageVersion(pageId);
  const saved = await versionHistory.createVersion({
    entityType: "page",
    entityId: pageId,
    version,
    author,
    changeSummary: reason || "overwrite",
    snapshot: buildPageSnapshot(row),
    connection
  });

  return { skipped: false, version, saved };
}

module.exports = {
  buildPageSnapshot,
  nextPageVersion,
  snapshotPublishedPage
};
