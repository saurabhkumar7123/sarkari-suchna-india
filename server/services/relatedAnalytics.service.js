"use strict";

const path = require("path");
const fileService = require("./file.service");

const ANALYTICS_PATH = path.join(process.cwd(), "data", "related-analytics.json");
const MAX_ITEMS = parseInt(process.env.RELATED_ANALYTICS_MAX || "8000", 10);
const BATCH_FLUSH_MS = parseInt(process.env.RELATED_ANALYTICS_FLUSH_MS || "5000", 10);

/** @type {object[]} */
let pending = [];
let flushTimer = null;

function normalizeClick(meta = {}) {
  return {
    from: String(meta.from || "").trim(),
    to: String(meta.to || "").trim(),
    timestamp: new Date().toISOString()
  };
}

async function readAll() {
  try {
    const raw = await fileService.readFile(ANALYTICS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items) {
  await fileService.writeFile(ANALYTICS_PATH, JSON.stringify(items, null, 2), "utf8");
}

async function flushPending() {
  if (!pending.length) return;
  const batch = pending.splice(0, pending.length);
  const items = await readAll();
  items.push(...batch);
  const trimmed =
    items.length > MAX_ITEMS ? items.slice(items.length - MAX_ITEMS) : items;
  await writeAll(trimmed);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPending().catch(() => {});
  }, BATCH_FLUSH_MS);
}

/**
 * Queue a related-link click (batched file write).
 * @param {{ from: string, to: string }} meta
 */
function recordRelatedClick(meta = {}) {
  const row = normalizeClick(meta);
  if (!row.from || !row.to || row.from === row.to) return;
  pending.push(row);
  if (pending.length >= 25) {
    flushPending().catch(() => {});
    return;
  }
  scheduleFlush();
}

module.exports = {
  recordRelatedClick,
  flushPending
};
