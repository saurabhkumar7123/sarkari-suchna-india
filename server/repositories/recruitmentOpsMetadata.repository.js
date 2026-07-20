"use strict";

/**
 * Package 4E — File-backed recruitment operational metadata.
 *
 * Stores assignee labels without SQL schema changes.
 * No Redis, no workers, no queue persistence.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_STORE_PATH = path.join(__dirname, "../data/recruitment-ops-metadata.json");

function resolveStorePath() {
  const fromEnv = String(process.env.RECRUITMENT_OPS_METADATA_PATH || "").trim();
  return fromEnv || DEFAULT_STORE_PATH;
}

function emptyStore() {
  return { version: 1, assignments: {} };
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
    if (!parsed.assignments || typeof parsed.assignments !== "object") {
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
    assignments:
      store.assignments && typeof store.assignments === "object" ? store.assignments : {}
  };
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return payload;
}

function assignmentKey(recruitmentId) {
  return String(recruitmentId);
}

function getAssignment(recruitmentId, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  const store = readStore(filePath);
  const row = store.assignments[assignmentKey(id)];
  if (!row || typeof row !== "object") return null;
  return {
    recruitmentId: id,
    assignee: row.assignee != null ? String(row.assignee) : null,
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy || null
  };
}

function setAssignment(recruitmentId, assignee, operator = null, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Invalid recruitment id");
    err.statusCode = 400;
    throw err;
  }
  const store = readStore(filePath);
  const trimmed = String(assignee || "").trim().slice(0, 128);
  if (!trimmed) {
    delete store.assignments[assignmentKey(id)];
  } else {
    store.assignments[assignmentKey(id)] = {
      assignee: trimmed,
      updatedAt: new Date().toISOString(),
      updatedBy: operator || null
    };
  }
  writeStore(store, filePath);
  return getAssignment(id, filePath);
}

function removeAssignment(recruitmentId, filePath = resolveStorePath()) {
  const id = parseInt(String(recruitmentId), 10);
  if (!Number.isInteger(id) || id <= 0) return false;
  const store = readStore(filePath);
  if (!store.assignments[assignmentKey(id)]) return false;
  delete store.assignments[assignmentKey(id)];
  writeStore(store, filePath);
  return true;
}

function listAssignments(filePath = resolveStorePath()) {
  const store = readStore(filePath);
  return Object.entries(store.assignments || {}).map(([key, row]) => ({
    recruitmentId: Number(key),
    assignee: row && row.assignee != null ? String(row.assignee) : null,
    updatedAt: row && row.updatedAt ? row.updatedAt : null,
    updatedBy: row && row.updatedBy ? row.updatedBy : null
  }));
}

module.exports = {
  resolveStorePath,
  getAssignment,
  setAssignment,
  removeAssignment,
  listAssignments,
  readStore,
  writeStore,
  emptyStore
};
