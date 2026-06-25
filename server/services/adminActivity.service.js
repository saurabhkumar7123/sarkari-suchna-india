const path = require("path");
const fsp = require("fs/promises");
const fileService = require("./file.service");
const logger = require("../utils/logger");

const ACTIVITY_DIR = path.join(process.cwd(), "data");
// JSON is gitignored on deploy; path must exist before any read/write.
const ACTIVITY_PATH = path.join(ACTIVITY_DIR, "admin-activity.json");
const MAX_ITEMS = 5000;

function normalizeMeta(meta = {}) {
  return {
    admin: String(meta.admin || "admin"),
    action: String(meta.action || "").trim(),
    target: meta.target != null ? String(meta.target) : "",
    status: String(meta.status || "success"),
    ip: String(meta.ip || ""),
    userAgent: String(meta.userAgent || ""),
    requestId: String(meta.requestId || ""),
    timestamp: new Date().toISOString()
  };
}

/**
 * Ensures data/ and an empty admin-activity.json exist.
 * Without this, first recordActivity on a fresh server fails silently (callers use .catch).
 */
async function ensureActivityStore() {
  await fsp.mkdir(ACTIVITY_DIR, { recursive: true });
  try {
    await fsp.access(ACTIVITY_PATH);
  } catch {
    await fileService.writeFile(ACTIVITY_PATH, "[]\n", "utf8");
  }
}

async function readAll() {
  await ensureActivityStore();
  try {
    const raw = await fileService.readFile(ACTIVITY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn("admin-activity: read failed, using empty list", {
      path: ACTIVITY_PATH,
      message: err && err.message ? err.message : String(err)
    });
    return [];
  }
}

async function writeAll(items) {
  await ensureActivityStore();
  const payload = JSON.stringify(items, null, 2);
  // Write temp file then rename — avoids half-written JSON on crash.
  const tmp = `${ACTIVITY_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fileService.writeFile(tmp, payload, "utf8");
  await fsp.rename(tmp, ACTIVITY_PATH);
}

async function recordActivity(meta = {}) {
  const row = normalizeMeta(meta);
  if (!row.action) return;
  try {
    const items = await readAll();
    items.push(row);
    const trimmed = items.length > MAX_ITEMS ? items.slice(items.length - MAX_ITEMS) : items;
    await writeAll(trimmed);
  } catch (err) {
    logger.warn("admin-activity: record failed (non-blocking)", {
      action: row.action,
      path: ACTIVITY_PATH,
      message: err && err.message ? err.message : String(err)
    });
  }
}

async function countActivity({ action = "", status = "", from = "", to = "" } = {}) {
  const actionFilter = String(action || "").trim().toLowerCase();
  const statusFilter = String(status || "").trim().toLowerCase();
  const fromTs = from ? Date.parse(from) : NaN;
  const toTs = to ? Date.parse(to) : NaN;
  const all = await readAll();
  return all.filter((row) => {
    if (actionFilter && String(row.action || "").toLowerCase() !== actionFilter) return false;
    if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter) return false;
    const ts = Date.parse(row.timestamp);
    if (!Number.isNaN(fromTs) && ts < fromTs) return false;
    if (!Number.isNaN(toTs) && ts > toTs) return false;
    return true;
  }).length;
}

async function listActivity({ page = 1, limit = 20, action = "", from = "", to = "" } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const all = await readAll();
  const actionFilter = String(action || "").trim().toLowerCase();
  const fromTs = from ? Date.parse(from) : NaN;
  const toTs = to ? Date.parse(to) : NaN;
  let rows = all;
  if (actionFilter) {
    rows = rows.filter((r) => String(r.action || "").toLowerCase().includes(actionFilter));
  }
  if (!Number.isNaN(fromTs)) {
    rows = rows.filter((r) => Date.parse(r.timestamp) >= fromTs);
  }
  if (!Number.isNaN(toTs)) {
    rows = rows.filter((r) => Date.parse(r.timestamp) <= toTs);
  }
  rows = rows.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const total = rows.length;
  const start = (p - 1) * l;
  const data = rows.slice(start, start + l);
  return {
    data,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.max(1, Math.ceil(total / l))
    }
  };
}

module.exports = {
  recordActivity,
  listActivity,
  countActivity
};
