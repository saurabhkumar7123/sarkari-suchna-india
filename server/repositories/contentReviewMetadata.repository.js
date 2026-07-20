"use strict";

/**
 * Package 4F — File-backed content review metadata (no SQL schema redesign).
 *
 * Stores last_review_date per page slug for freshness display.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/content-review-metadata.json");

function resolveStorePath() {
  const fromEnv = String(process.env.CONTENT_REVIEW_METADATA_PATH || "").trim();
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
    if (!fs.existsSync(filePath)) return emptyStore();
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyStore();
    if (!parsed.reviews || typeof parsed.reviews !== "object") return emptyStore();
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

function slugKey(slug) {
  return String(slug || "")
    .trim()
    .replace(/\.html$/i, "")
    .toLowerCase();
}

function getLastReviewDate(slug, filePath = resolveStorePath()) {
  const key = slugKey(slug);
  if (!key) return null;
  const row = readStore(filePath).reviews[key];
  if (!row || typeof row !== "object") return null;
  return row.lastReviewDate || null;
}

function getAllReviewDates(filePath = resolveStorePath()) {
  const store = readStore(filePath);
  const out = {};
  for (const [key, row] of Object.entries(store.reviews || {})) {
    if (row && row.lastReviewDate) out[key] = row.lastReviewDate;
  }
  return out;
}

/**
 * Record a manual review date. Does not auto-update on content saves.
 */
function setLastReviewDate(slug, lastReviewDate, updatedBy = "admin", filePath = resolveStorePath()) {
  const key = slugKey(slug);
  if (!key) {
    const err = new Error("slug is required");
    err.statusCode = 400;
    throw err;
  }
  const iso =
    lastReviewDate instanceof Date
      ? lastReviewDate.toISOString().slice(0, 10)
      : String(lastReviewDate || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const err = new Error("lastReviewDate must be YYYY-MM-DD");
    err.statusCode = 400;
    throw err;
  }
  const store = readStore(filePath);
  store.reviews[key] = {
    lastReviewDate: iso,
    updatedAt: new Date().toISOString(),
    updatedBy: String(updatedBy || "admin")
  };
  writeStore(store, filePath);
  return {
    slug: key,
    lastReviewDate: iso,
    updatedAt: store.reviews[key].updatedAt,
    updatedBy: store.reviews[key].updatedBy
  };
}

module.exports = {
  resolveStorePath,
  getLastReviewDate,
  getAllReviewDates,
  setLastReviewDate
};
