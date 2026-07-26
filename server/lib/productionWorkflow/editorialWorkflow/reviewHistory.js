"use strict";

/**
 * PWP Phase 4 — In-memory review history only.
 * No database schema changes.
 */

const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");

/** @type {Map<string, object[]>} */
const historyStore = new Map();

/** @type {Map<string, object>} */
const packageStore = new Map();

function createHistoryEntry({
  timestamp = null,
  previousState,
  newState,
  action,
  reason = null,
  reviewerId = null
}) {
  return Object.freeze({
    timestamp: timestamp || "deterministic",
    previousState: previousState || null,
    newState,
    action,
    reason: reason == null ? null : String(reason),
    reviewerId: reviewerId == null || reviewerId === "" ? null : String(reviewerId)
  });
}

function getReviewHistory(reviewId) {
  if (!reviewId) return Object.freeze([]);
  const entries = historyStore.get(reviewId) || [];
  return Object.freeze(entries.slice());
}

function appendReviewHistory(reviewId, entry) {
  if (!reviewId || !entry) return getReviewHistory(reviewId);
  const current = historyStore.get(reviewId) || [];
  const next = current.concat([createHistoryEntry(entry)]);
  historyStore.set(reviewId, next);
  return Object.freeze(next.slice());
}

function seedReviewHistory(reviewId, entries = []) {
  if (!reviewId) return Object.freeze([]);
  const frozen = entries.map((e) => createHistoryEntry(e));
  historyStore.set(reviewId, frozen);
  return Object.freeze(frozen.slice());
}

function storeEditorialPackage(editorialPackage) {
  if (!editorialPackage || !editorialPackage.reviewId) return;
  packageStore.set(editorialPackage.reviewId, editorialPackage);
}

function getStoredEditorialPackage(reviewId) {
  if (!reviewId) return null;
  return packageStore.get(reviewId) || null;
}

/**
 * Clear in-memory stores (tests only).
 */
function clearReviewMemory() {
  historyStore.clear();
  packageStore.clear();
}

function snapshotHistoryForPackage(reviewId, reviewHistory) {
  if (Array.isArray(reviewHistory) && reviewHistory.length > 0) {
    return Object.freeze(reviewHistory.map((e) => createHistoryEntry(e)));
  }
  return getReviewHistory(reviewId);
}

module.exports = {
  createHistoryEntry,
  getReviewHistory,
  appendReviewHistory,
  seedReviewHistory,
  storeEditorialPackage,
  getStoredEditorialPackage,
  clearReviewMemory,
  snapshotHistoryForPackage,
  deepFreeze
};
