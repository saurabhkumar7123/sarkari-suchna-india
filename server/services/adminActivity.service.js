const path = require("path");
const fileService = require("./file.service");

const ACTIVITY_PATH = path.join(process.cwd(), "data", "admin-activity.json");
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

async function readAll() {
  try {
    const raw = await fileService.readFile(ACTIVITY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items) {
  await fileService.writeFile(ACTIVITY_PATH, JSON.stringify(items, null, 2), "utf8");
}

async function recordActivity(meta = {}) {
  const row = normalizeMeta(meta);
  if (!row.action) return;
  const items = await readAll();
  items.push(row);
  const trimmed = items.length > MAX_ITEMS ? items.slice(items.length - MAX_ITEMS) : items;
  await writeAll(trimmed);
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
  listActivity
};
