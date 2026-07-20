"use strict";

/**
 * Package 4C — File-backed editorial review store.
 *
 * Persists human review workflow state and notes without SQL schema changes.
 * Review-queue DB persistence (Program 5) remains out of scope.
 */

const fs = require("fs");
const path = require("path");
const {
  WORKFLOW_STATES,
  normalizeState
} = require("../lib/recruitment/editorialWorkflow");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/editorial-reviews.json");

function resolveStorePath() {
  const fromEnv = String(process.env.EDITORIAL_REVIEW_STORE_PATH || "").trim();
  return fromEnv || DEFAULT_STORE_PATH;
}

function emptyStore() {
  return { version: 1, reviews: {} };
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore(filePath = resolveStorePath()) {
  try {
    if (!fs.existsSync(filePath)) {
      return emptyStore();
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyStore();
    }
    if (!parsed.reviews || typeof parsed.reviews !== "object") {
      return { version: 1, reviews: {} };
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store, filePath = resolveStorePath()) {
  ensureDir(filePath);
  const payload = {
    version: 1,
    reviews: store.reviews && typeof store.reviews === "object" ? store.reviews : {}
  };
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return payload;
}

function reviewKey(recruitmentId) {
  return String(recruitmentId);
}

function createDefaultReview(recruitmentId, extras = {}) {
  const now = new Date().toISOString();
  return {
    recruitmentId: Number(recruitmentId),
    draftId: extras.draftId != null ? Number(extras.draftId) : null,
    workflowState: extras.workflowState || WORKFLOW_STATES.DRAFT_CREATED,
    notes: Array.isArray(extras.notes) ? extras.notes : [],
    decisionHistory: Array.isArray(extras.decisionHistory) ? extras.decisionHistory : [],
    createdAt: extras.createdAt || now,
    updatedAt: extras.updatedAt || now,
    updatedBy: extras.updatedBy || null
  };
}

function getReviewByRecruitmentId(recruitmentId, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  const store = readStore(filePath);
  const row = store.reviews[reviewKey(id)];
  if (!row) return null;
  return {
    ...createDefaultReview(id),
    ...row,
    recruitmentId: id,
    workflowState: normalizeState(row.workflowState) || WORKFLOW_STATES.DRAFT_CREATED
  };
}

function upsertReview(recruitmentId, patch = {}, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Invalid recruitment id");
    err.statusCode = 400;
    throw err;
  }

  const store = readStore(filePath);
  const existing = store.reviews[reviewKey(id)] || createDefaultReview(id);
  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    recruitmentId: id,
    updatedAt: now
  };
  if (patch.workflowState != null) {
    const state = normalizeState(patch.workflowState);
    if (!state) {
      const err = new Error("Invalid workflow state");
      err.statusCode = 400;
      throw err;
    }
    next.workflowState = state;
  }
  if (patch.draftId === null) {
    next.draftId = null;
  } else if (patch.draftId != null) {
    next.draftId = Number(patch.draftId);
  }
  if (Array.isArray(patch.notes)) {
    next.notes = patch.notes;
  }
  if (Array.isArray(patch.decisionHistory)) {
    next.decisionHistory = patch.decisionHistory;
  }

  store.reviews[reviewKey(id)] = next;
  writeStore(store, filePath);
  return next;
}

function listReviews({ workflowState, limit = 50 } = {}, filePath = resolveStorePath()) {
  const store = readStore(filePath);
  let rows = Object.values(store.reviews || {});
  const stateFilter = normalizeState(workflowState);
  if (stateFilter) {
    rows = rows.filter((row) => normalizeState(row.workflowState) === stateFilter);
  }
  rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const capped = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  return rows.slice(0, capped);
}

function deleteReview(recruitmentId, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) return false;
  const store = readStore(filePath);
  const key = reviewKey(id);
  if (!store.reviews[key]) return false;
  delete store.reviews[key];
  writeStore(store, filePath);
  return true;
}

function resetStoreForTests(filePath = resolveStorePath()) {
  writeStore(emptyStore(), filePath);
}

module.exports = {
  resolveStorePath,
  getReviewByRecruitmentId,
  upsertReview,
  listReviews,
  deleteReview,
  createDefaultReview,
  resetStoreForTests,
  DEFAULT_STORE_PATH
};
