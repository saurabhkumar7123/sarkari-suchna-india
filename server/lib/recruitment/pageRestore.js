"use strict";

/**
 * Admin-only restore of a public page from entity_versions snapshot.
 * Snapshots are never deleted. Current page is snapshotted before restore.
 */

const pageRepository = require("../../repositories/page.repository");
const versionHistory = require("../enterprise/versionHistory/VersionHistoryService");
const { snapshotPublishedPage } = require("./pageSnapshot");
const { invalidatePageCaches } = require("../../services/cache.services");
const logger = require("../../utils/logger");
const db = require("../../config/db");
const pipeline = require("../../../generator/pipeline/generatePage");

async function restorePageFromVersion({
  pageId,
  version,
  author = "admin",
  confirm = false
} = {}) {
  if (!confirm) {
    const err = new Error("Explicit confirmation required to restore a page version");
    err.statusCode = 400;
    throw err;
  }

  const id = parseInt(String(pageId), 10);
  const ver = parseInt(String(version), 10);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(ver) || ver <= 0) {
    const err = new Error("pageId and version must be positive integers");
    err.statusCode = 400;
    throw err;
  }

  const snap = await versionHistory.getVersion({
    entityType: "page",
    entityId: id,
    version: ver
  });
  if (!snap || !snap.snapshot_json) {
    const err = new Error("Page version snapshot not found");
    err.statusCode = 404;
    throw err;
  }

  const snapshot = snap.snapshot_json;
  const slug = String(snapshot.slug || "").trim().replace(/^\/+|\.html$/gi, "");
  if (!slug) {
    const err = new Error("Snapshot is missing slug");
    err.statusCode = 400;
    throw err;
  }

  let liveRow = await pageRepository.findPublicRowBySlug(slug);
  if (!liveRow || Number(liveRow.id) !== id) {
    const byId = await pageRepository.findJobById(id);
    if (!byId) {
      const err = new Error("Target page not found");
      err.statusCode = 404;
      throw err;
    }
    liveRow = byId;
  }
  await snapshotPublishedPage(liveRow, {
    author,
    reason: `pre_restore_from_v${ver}`
  });

  const content = snapshot.content != null ? String(snapshot.content) : "";
  const rawText = snapshot.raw_text != null ? String(snapshot.raw_text) : content;
  const title = snapshot.title != null ? String(snapshot.title) : liveRow.title || slug;

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    await pageRepository.updatePageBySlug(
      {
        title,
        slug,
        finalHTML: content,
        text: rawText,
        normalizedStatus: snapshot.status || liveRow.status || "latest job",
        category: snapshot.category || liveRow.category || null,
        qualification: liveRow.qualification || null,
        state: liveRow.state || null,
        department: snapshot.department || liveRow.department || null,
        postName: snapshot.post_name || liveRow.post_name || null,
        totalPosts: liveRow.total_posts || null,
        advertisementNo: snapshot.advertisement_no || liveRow.advertisement_no || null,
        lastDate: snapshot.last_date || liveRow.last_date || null,
        position: liveRow.position || null,
        breaking: liveRow.breaking,
        breakingOrder: liveRow.breaking_order || 0,
        eventTime: liveRow.event_time || null,
        badges: liveRow.badges || []
      },
      conn
    );

    try {
      await pipeline.writeJobHtmlFile(slug, content);
    } catch (fileErr) {
      await conn.rollback();
      throw fileErr;
    }

    await conn.commit();
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    logger.error("page-restore: failed", {
      pageId: id,
      version: ver,
      message: err && err.message ? err.message : String(err)
    });
    throw err;
  } finally {
    if (conn) conn.release();
  }

  await invalidatePageCaches([slug]);

  return {
    restored: true,
    pageId: id,
    slug,
    fromVersion: ver,
    title
  };
}

module.exports = {
  restorePageFromVersion
};
