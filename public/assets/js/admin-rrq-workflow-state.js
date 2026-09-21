"use strict";

/**
 * Pure Review Queue workflow UI state helpers.
 * Used by the browser decision-tree and Node tests.
 * Does not call APIs or mutate the database.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.RrqWorkflowState = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STORAGE_PREFIX = "rrqMatchIntent:v1:";
  const RECRUITMENT_PREFIX = "rrqMatchRecruitment:v1:";
  const INTENT_PARAM = "match_intent";

  function normalizeIntent(value) {
    const key = String(value || "")
      .trim()
      .toLowerCase();
    if (key === "yes" || key === "no") return key;
    return null;
  }

  function statusOf(item) {
    return String((item && item.status) || "")
      .trim()
      .toLowerCase();
  }

  function isPublishedDraft(item) {
    const linked = item && item.linked_draft;
    return Boolean(linked && String(linked.status || "").toLowerCase() === "published");
  }

  function hasRecruitment(item) {
    const rid = item && item.recruitment_id;
    const n = Number(rid);
    return Number.isFinite(n) && n > 0;
  }

  /**
   * Deterministic UI phase from persisted review status + optional in-progress match intent.
   * matchIntent only applies while status === needs_matching.
   */
  function resolvePhase(item, matchIntent) {
    if (!item) return "empty";
    const status = statusOf(item);
    const published = isPublishedDraft(item);
    const intent = normalizeIntent(matchIntent);

    if (status === "frozen") return "frozen";
    if (status === "rejected") return "rejected";
    if (published) return "published";
    if (status === "approved") return "approved";

    if (status === "needs_matching") {
      if (intent === "yes") return "attach";
      if (intent === "no") return "alternate";
      return "relation";
    }

    // Matching already resolved — never return to YES/NO.
    if (status === "under_review" || status === "pending") {
      if (!hasRecruitment(item)) return "standalone_review";
      return "review";
    }

    if (hasRecruitment(item)) return "review";
    return "review";
  }

  function storageKeyForReview(reviewId) {
    const id = Number(reviewId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return STORAGE_PREFIX + String(id);
  }

  function recruitmentStorageKey(reviewId) {
    const id = Number(reviewId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return RECRUITMENT_PREFIX + String(id);
  }

  function readIntentFromSearch(search) {
    try {
      const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
      return normalizeIntent(params.get(INTENT_PARAM));
    } catch {
      return null;
    }
  }

  function writeIntentIntoSearch(search, intent) {
    const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    const normalized = normalizeIntent(intent);
    if (normalized) params.set(INTENT_PARAM, normalized);
    else params.delete(INTENT_PARAM);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  return {
    STORAGE_PREFIX,
    RECRUITMENT_PREFIX,
    INTENT_PARAM,
    normalizeIntent,
    statusOf,
    isPublishedDraft,
    hasRecruitment,
    resolvePhase,
    storageKeyForReview,
    recruitmentStorageKey,
    readIntentFromSearch,
    writeIntentIntoSearch
  };
});
