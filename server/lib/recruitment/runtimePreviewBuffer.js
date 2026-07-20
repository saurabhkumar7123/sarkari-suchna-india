"use strict";

/**
 * Phase 30 — in-memory bounded recruitment runtime preview buffer.
 * Preview only: no DB writes, no review-queue persistence.
 * Cleared automatically when the process restarts.
 */

const { normalizeRecruitmentNoticeText } = require("./eventTypeClassifier");

const MAX_PREVIEW_ENTRIES = 100;

/** @type {Object[]} Newest entries are at the end (FIFO eviction from the front). */
const entries = [];
let nextId = 1;

/**
 * @param {*} value
 * @returns {number|null}
 */
function normalizeUpdateId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reset buffer state (tests only).
 */
function resetRuntimePreviewBuffer() {
  entries.length = 0;
  nextId = 1;
}

/**
 * @returns {number}
 */
function getRuntimePreviewCapacity() {
  return MAX_PREVIEW_ENTRIES;
}

/**
 * @returns {number}
 */
function getRuntimePreviewSize() {
  return entries.length;
}

/**
 * Build and store a preview entry from a successful processor result.
 * Synchronous and side-effect free beyond this module's array.
 *
 * @param {Object} input
 * @param {Object} [input.monitoredSite]
 * @param {Object} [input.notice]
 * @param {Object} input.processorResult
 * @param {string} [input.timestamp]
 * @param {number|string|null} [input.updateId]
 * @param {Object|null} [input.lookupSummary]
 * @param {Object|null} [input.eligibility] Phase 32 — read-only eligibility (never persisted)
 * @param {Object|null} [input.lifecycleArchitecture] Phase 41 — advisory architecture metadata
 * @returns {Object} stored entry
 */
function pushRuntimePreview({
  monitoredSite = null,
  notice = null,
  processorResult,
  timestamp,
  updateId = null,
  lookupSummary = null,
  eligibility = null,
  lifecycleArchitecture = null
} = {}) {
  if (!processorResult || typeof processorResult !== "object" || Array.isArray(processorResult)) {
    throw new Error("processorResult is required");
  }

  const safeNotice =
    notice && typeof notice === "object" && !Array.isArray(notice) ? notice : {};
  const noticeTitle = String(safeNotice.title || "").trim() || "New update";
  let normalizedNotice = "";
  try {
    normalizedNotice = normalizeRecruitmentNoticeText(safeNotice);
  } catch {
    normalizedNotice = "";
  }

  const site =
    monitoredSite && typeof monitoredSite === "object" && !Array.isArray(monitoredSite)
      ? {
          id: monitoredSite.id != null ? monitoredSite.id : null,
          name: monitoredSite.name != null ? String(monitoredSite.name) : null,
          url: monitoredSite.url != null ? String(monitoredSite.url) : null
        }
      : null;

  const warnings = Array.isArray(processorResult.warnings)
    ? processorResult.warnings.slice()
    : [];

  const safeLookup =
    lookupSummary && typeof lookupSummary === "object" && !Array.isArray(lookupSummary)
      ? {
          status: lookupSummary.status != null ? String(lookupSummary.status) : null,
          strategy: lookupSummary.strategy != null ? String(lookupSummary.strategy) : null,
          candidateCount:
            lookupSummary.candidateCount != null
              ? Number(lookupSummary.candidateCount) || 0
              : 0,
          limitedTo:
            lookupSummary.limitedTo != null ? Number(lookupSummary.limitedTo) || null : null,
          criteria: lookupSummary.criteria != null ? lookupSummary.criteria : null,
          message: lookupSummary.message != null ? String(lookupSummary.message) : null
        }
      : null;

  const safeEligibility =
    eligibility && typeof eligibility === "object" && !Array.isArray(eligibility)
      ? {
          eligible: Boolean(eligibility.eligible),
          status: eligibility.status != null ? String(eligibility.status) : null,
          reasons: Array.isArray(eligibility.reasons)
            ? eligibility.reasons.map((r) => String(r))
            : [],
          confidence: eligibility.confidence != null ? String(eligibility.confidence) : null,
          eventType: eligibility.eventType != null ? String(eligibility.eventType) : null,
          candidateCount:
            eligibility.candidateCount != null
              ? Number(eligibility.candidateCount) || 0
              : 0,
          matchResult: eligibility.matchResult != null ? eligibility.matchResult : null,
          lookupSummary:
            eligibility.lookupSummary != null ? eligibility.lookupSummary : null
        }
      : null;

  // Phase 41 — additive advisory metadata only (never interpreted as a write intent).
  const safeLifecycleArchitecture =
    lifecycleArchitecture &&
    typeof lifecycleArchitecture === "object" &&
    !Array.isArray(lifecycleArchitecture)
      ? lifecycleArchitecture
      : null;

  const entry = {
    id: String(nextId++),
    timestamp:
      typeof timestamp === "string" && timestamp.trim()
        ? timestamp.trim()
        : new Date().toISOString(),
    monitoredSite: site,
    noticeTitle,
    notice: {
      title: safeNotice.title != null ? String(safeNotice.title) : "",
      content: safeNotice.content != null ? String(safeNotice.content) : "",
      url: safeNotice.url != null ? String(safeNotice.url) : ""
    },
    normalizedNotice,
    eventType:
      processorResult.eventType != null ? String(processorResult.eventType) : "unknown",
    processorResult,
    warnings,
    selectedRecruitment:
      processorResult.selectedRecruitment != null
        ? processorResult.selectedRecruitment
        : null,
    updateId: normalizeUpdateId(updateId),
    lookupSummary: safeLookup,
    eligibility: safeEligibility,
    lifecycleArchitecture: safeLifecycleArchitecture
  };

  entries.push(entry);
  while (entries.length > MAX_PREVIEW_ENTRIES) {
    entries.shift();
  }

  return entry;
}

/**
 * Persist preview from a pipeline outcome without throwing to the worker.
 * Only stores successful (non-skipped, non-failed) processor results.
 *
 * @param {Object} input
 * @param {{ skipped?: boolean, failed?: boolean, result?: Object, updateId?: number|null }} input.pipelineOutcome
 * @param {Object} [input.monitoredSite]
 * @param {Object} [input.notice]
 * @param {number|string|null} [input.updateId]
 * @param {Object|null} [input.lookupSummary]
 * @param {Object|null} [input.eligibility] Phase 32 — evaluation only
 * @param {Object|null} [input.lifecycleArchitecture] Phase 41 — advisory only
 * @returns {Object|null} stored entry or null when nothing was stored
 */
function recordRuntimePreviewFromPipeline({
  pipelineOutcome,
  monitoredSite,
  notice,
  updateId = null,
  lookupSummary = null,
  eligibility = null,
  lifecycleArchitecture = null
} = {}) {
  if (!pipelineOutcome || pipelineOutcome.skipped || pipelineOutcome.failed) {
    return null;
  }
  if (!pipelineOutcome.result) {
    return null;
  }

  try {
    return pushRuntimePreview({
      monitoredSite,
      notice,
      processorResult: pipelineOutcome.result,
      updateId:
        updateId != null && updateId !== ""
          ? updateId
          : pipelineOutcome.updateId != null
            ? pipelineOutcome.updateId
            : null,
      lookupSummary,
      eligibility,
      lifecycleArchitecture
    });
  } catch {
    return null;
  }
}

function matchesSiteFilter(entry, { site, site_id: siteId } = {}) {
  if (siteId != null && String(siteId).trim() !== "") {
    const want = Number(siteId);
    const got = entry.monitoredSite && entry.monitoredSite.id;
    if (!Number.isFinite(want) || Number(got) !== want) {
      return false;
    }
  }

  if (site != null && String(site).trim() !== "") {
    const needle = String(site).trim().toLowerCase();
    const name = entry.monitoredSite && entry.monitoredSite.name
      ? String(entry.monitoredSite.name).toLowerCase()
      : "";
    const url = entry.monitoredSite && entry.monitoredSite.url
      ? String(entry.monitoredSite.url).toLowerCase()
      : "";
    if (!name.includes(needle) && !url.includes(needle) && name !== needle) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Object} [query]
 * @param {string} [query.event_type]
 * @param {string} [query.site]
 * @param {string|number} [query.site_id]
 * @param {string|number} [query.page]
 * @param {string|number} [query.limit]
 * @returns {{ data: Object[], pagination: Object }}
 */
function listRuntimePreviews(query = {}) {
  const eventType =
    query.event_type != null && String(query.event_type).trim() !== ""
      ? String(query.event_type).trim().toLowerCase()
      : "";

  let page = Number.parseInt(String(query.page != null ? query.page : 1), 10);
  let limit = Number.parseInt(String(query.limit != null ? query.limit : 20), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  const newestFirst = entries.slice().reverse();
  const filtered = newestFirst.filter((entry) => {
    if (eventType && String(entry.eventType || "").toLowerCase() !== eventType) {
      return false;
    }
    return matchesSiteFilter(entry, query);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const offset = (page - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      bufferSize: entries.length,
      bufferCapacity: MAX_PREVIEW_ENTRIES
    }
  };
}

/**
 * @param {string|number} id
 * @returns {Object|null}
 */
function getRuntimePreviewById(id) {
  const key = String(id);
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].id === key) return entries[i];
  }
  return null;
}

/**
 * Clear the in-memory buffer only.
 * @returns {{ cleared: true, removed: number }}
 */
function clearRuntimePreviewBuffer() {
  const removed = entries.length;
  entries.length = 0;
  return { cleared: true, removed };
}

module.exports = {
  MAX_PREVIEW_ENTRIES,
  pushRuntimePreview,
  recordRuntimePreviewFromPipeline,
  listRuntimePreviews,
  getRuntimePreviewById,
  clearRuntimePreviewBuffer,
  getRuntimePreviewCapacity,
  getRuntimePreviewSize,
  resetRuntimePreviewBuffer
};
