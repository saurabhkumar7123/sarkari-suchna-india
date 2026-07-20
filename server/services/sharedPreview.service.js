"use strict";

/**
 * Package 4D — Shared runtime preview service.
 *
 * Exposes a single authoritative preview of recruitment editorial state
 * aggregated from Recruitment Operations (4B) and Editorial Review (4C).
 *
 * Read-oriented: manual refresh only. No publishing, no workers,
 * no background polling, no automation.
 */

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");
const recruitmentPageLinkRepository = require("../repositories/recruitmentPageLink.repository");
const generatorDraftRepository = require("../repositories/generatorDraft.repository");
const editorialReviewRepository = require("../repositories/editorialReview.repository");
const sharedPreviewRepository = require("../repositories/sharedPreview.repository");
const {
  SHARED_PREVIEW_SCHEMA_VERSION,
  buildPreviewSnapshot
} = require("../lib/recruitment/sharedPreviewModel");
const { isGeneratorDraftsEnabled } = require("../config/generatorDrafts");

const REFRESH_REASONS = Object.freeze([
  "manual",
  "initial_build",
  "recruitment_update",
  "draft_change",
  "review_decision",
  "page_link_change"
]);

const MISSING_DEPENDENCIES = Object.freeze({
  GENERATOR_DRAFTS_DISABLED: "generator_drafts_disabled",
  GENERATOR_DRAFTS_TABLE: "generator_drafts_table",
  GENERATOR_DRAFTS_LINKAGE: "generator_drafts_recruitment_linkage",
  PAGES_LINKAGE: "pages_recruitment_linkage",
  RECRUITMENT_EVENTS_TABLE: "recruitment_events_table",
  EDITORIAL_REVIEW_STORE: "editorial_review_store"
});

function parsePositiveId(value, fieldName) {
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function normalizeRefreshReason(reason) {
  const text = String(reason || "").trim().toLowerCase();
  return REFRESH_REASONS.includes(text) ? text : "manual";
}

async function loadRecruitment(recruitmentId) {
  const tableReady = await recruitmentRepository.tableExists();
  if (!tableReady) {
    const err = new Error(
      "recruitments table is missing. Run db/migrations/2026-07-13-recruitments.sql"
    );
    err.statusCode = 503;
    throw err;
  }
  const recruitment = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!recruitment) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return recruitment;
}

async function loadDrafts(recruitmentId, missingDependencies) {
  if (!isGeneratorDraftsEnabled()) {
    missingDependencies.push(MISSING_DEPENDENCIES.GENERATOR_DRAFTS_DISABLED);
    return [];
  }
  if (!(await generatorDraftRepository.tableExists())) {
    missingDependencies.push(MISSING_DEPENDENCIES.GENERATOR_DRAFTS_TABLE);
    return [];
  }
  if (!(await generatorDraftRepository.linkageColumnsExist())) {
    missingDependencies.push(MISSING_DEPENDENCIES.GENERATOR_DRAFTS_LINKAGE);
    return [];
  }
  return generatorDraftRepository.listDraftsByRecruitmentId({
    recruitment_id: recruitmentId,
    limit: 50
  });
}

async function loadPages(recruitmentId, missingDependencies) {
  if (!(await recruitmentPageLinkRepository.linkageColumnsExist())) {
    missingDependencies.push(MISSING_DEPENDENCIES.PAGES_LINKAGE);
    return [];
  }
  const result = await recruitmentPageLinkRepository.listPageLinkagesByRecruitmentId({
    recruitment_id: recruitmentId,
    limit: 50
  });
  return Array.isArray(result.data) ? result.data : [];
}

async function loadEvents(recruitmentId, missingDependencies) {
  if (!(await recruitmentEventRepository.tableExists())) {
    missingDependencies.push(MISSING_DEPENDENCIES.RECRUITMENT_EVENTS_TABLE);
    return [];
  }
  const result = await recruitmentEventRepository.listRecruitmentEventsByRecruitmentId({
    recruitment_id: recruitmentId,
    limit: 50
  });
  return Array.isArray(result.data) ? result.data : [];
}

function loadReview(recruitmentId, missingDependencies) {
  try {
    return editorialReviewRepository.getReviewByRecruitmentId(recruitmentId);
  } catch {
    missingDependencies.push(MISSING_DEPENDENCIES.EDITORIAL_REVIEW_STORE);
    return null;
  }
}

async function resolvePrimaryDraft(drafts, review) {
  if (!Array.isArray(drafts) || !drafts.length) return null;
  const preferred =
    (review && review.draftId != null &&
      drafts.find((draft) => Number(draft.id) === Number(review.draftId))) ||
    drafts[0];
  if (!preferred) return null;
  const full = await generatorDraftRepository.findById(preferred.id).catch(() => null);
  return full || preferred;
}

/**
 * Build the shared preview snapshot from live state. Does not persist.
 */
async function buildSharedPreview(recruitmentId) {
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  const recruitment = await loadRecruitment(rid);

  const missingDependencies = [];
  const review = loadReview(rid, missingDependencies);
  const [drafts, pages, events] = await Promise.all([
    loadDrafts(rid, missingDependencies),
    loadPages(rid, missingDependencies),
    loadEvents(rid, missingDependencies)
  ]);
  const primaryDraft = await resolvePrimaryDraft(drafts, review);

  return buildPreviewSnapshot({
    recruitment,
    drafts,
    primaryDraft,
    review,
    pages,
    events,
    missingDependencies
  });
}

function toPreviewResponse(record, source) {
  return {
    snapshot: record.snapshot,
    lastRefresh: record.lastRefresh || null,
    refreshReason: record.refreshReason || null,
    refreshedBy: record.refreshedBy || null,
    refreshCount: Number(record.refreshCount) || 0,
    source
  };
}

/**
 * Manual refresh: rebuild the snapshot from live state and persist it
 * to the shared store so every process sees the same preview.
 */
async function refreshSharedPreview(recruitmentId, { reason = "manual", operator = null } = {}) {
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  const snapshot = await buildSharedPreview(rid);
  const record = sharedPreviewRepository.savePreviewRecord(rid, {
    snapshot,
    lastRefresh: new Date().toISOString(),
    refreshReason: normalizeRefreshReason(reason),
    refreshedBy: operator != null ? String(operator) : null
  });
  return toPreviewResponse(record, "refresh");
}

/**
 * Read the shared preview. Serves the stored snapshot when present so
 * Recruitment Operations and Editorial Review consume the same state;
 * builds and stores an initial snapshot when none exists yet.
 */
async function getSharedPreview(recruitmentId) {
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  await loadRecruitment(rid);
  const stored = sharedPreviewRepository.getPreviewRecord(rid);
  if (stored && stored.snapshot) {
    return toPreviewResponse(stored, "store");
  }
  return refreshSharedPreview(rid, { reason: "initial_build" });
}

/**
 * Best-effort refresh after an operator-driven change
 * (recruitment update, draft change, review decision, page link change).
 * Never throws — preview refresh must not break the primary operation.
 */
async function refreshAfterChange(recruitmentId, reason, operator = null) {
  try {
    return await refreshSharedPreview(recruitmentId, { reason, operator });
  } catch {
    return null;
  }
}

/**
 * Diagnostics: last refresh, snapshot version, validation status,
 * consistency status, missing dependencies. Advisory only.
 */
async function getPreviewDiagnostics(recruitmentId) {
  const rid = parsePositiveId(recruitmentId, "recruitment id");
  await loadRecruitment(rid);

  const stored = sharedPreviewRepository.getPreviewRecord(rid);
  const live = await buildSharedPreview(rid);

  let consistencyStatus = "no_snapshot";
  if (stored && stored.snapshot) {
    consistencyStatus =
      stored.snapshot.snapshotVersion === live.snapshotVersion ? "consistent" : "stale";
  }

  return {
    recruitmentId: rid,
    schemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
    lastRefresh: stored ? stored.lastRefresh || null : null,
    refreshReason: stored ? stored.refreshReason || null : null,
    refreshedBy: stored ? stored.refreshedBy || null : null,
    refreshCount: stored ? Number(stored.refreshCount) || 0 : 0,
    snapshotVersion: stored && stored.snapshot ? stored.snapshot.snapshotVersion : null,
    liveSnapshotVersion: live.snapshotVersion,
    validationStatus:
      stored && stored.snapshot && stored.snapshot.integrity
        ? stored.snapshot.integrity.status
        : live.integrity.status,
    consistencyStatus,
    missingDependencies: live.missingDependencies
  };
}

module.exports = {
  REFRESH_REASONS,
  MISSING_DEPENDENCIES,
  buildSharedPreview,
  getSharedPreview,
  refreshSharedPreview,
  refreshAfterChange,
  getPreviewDiagnostics
};
