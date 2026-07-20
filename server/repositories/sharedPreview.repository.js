"use strict";

/**
 * Package 4D — File-backed shared preview store.
 *
 * Persists preview snapshots outside process memory so every process
 * (web cluster, worker) reads the same authoritative preview state.
 * No Redis, no distributed cache, no SQL schema changes.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/shared-previews.json");

function resolveStorePath() {
  const fromEnv = String(process.env.SHARED_PREVIEW_STORE_PATH || "").trim();
  return fromEnv || DEFAULT_STORE_PATH;
}

function emptyStore() {
  return { version: 1, previews: {} };
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
    if (!parsed.previews || typeof parsed.previews !== "object") {
      return emptyStore();
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
    previews: store.previews && typeof store.previews === "object" ? store.previews : {}
  };
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return payload;
}

function previewKey(recruitmentId) {
  return String(recruitmentId);
}

function getPreviewRecord(recruitmentId, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  const store = readStore(filePath);
  const row = store.previews[previewKey(id)];
  return row && typeof row === "object" ? { ...row, recruitmentId: id } : null;
}

/**
 * @param {number|string} recruitmentId
 * @param {{ snapshot: Object, lastRefresh: string, refreshReason?: string|null, refreshedBy?: string|null }} record
 */
function savePreviewRecord(recruitmentId, record, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Invalid recruitment id");
    err.statusCode = 400;
    throw err;
  }
  if (!record || typeof record !== "object" || !record.snapshot) {
    const err = new Error("A snapshot is required to store a shared preview");
    err.statusCode = 400;
    throw err;
  }

  const store = readStore(filePath);
  const existing = store.previews[previewKey(id)] || {};
  const next = {
    recruitmentId: id,
    snapshot: record.snapshot,
    lastRefresh: record.lastRefresh || new Date().toISOString(),
    refreshReason: record.refreshReason != null ? String(record.refreshReason) : null,
    refreshedBy: record.refreshedBy != null ? String(record.refreshedBy) : null,
    refreshCount: (Number(existing.refreshCount) || 0) + 1
  };
  store.previews[previewKey(id)] = next;
  writeStore(store, filePath);
  return next;
}

function deletePreviewRecord(recruitmentId, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) return false;
  const store = readStore(filePath);
  const key = previewKey(id);
  if (!store.previews[key]) return false;
  delete store.previews[key];
  writeStore(store, filePath);
  return true;
}

function resetStoreForTests(filePath = resolveStorePath()) {
  writeStore(emptyStore(), filePath);
}

module.exports = {
  resolveStorePath,
  getPreviewRecord,
  savePreviewRecord,
  deletePreviewRecord,
  resetStoreForTests,
  DEFAULT_STORE_PATH
};
