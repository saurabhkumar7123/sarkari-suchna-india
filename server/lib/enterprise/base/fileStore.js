"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_DATA_DIR = path.join(__dirname, "../../../data/enterprise");

function resolveStorePath(storeName) {
  const fromEnv = String(process.env.ENTERPRISE_DATA_DIR || "").trim();
  const base = fromEnv || DEFAULT_DATA_DIR;
  return path.join(base, `${storeName}.json`);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore(storeName, fallback = []) {
  const filePath = resolveStorePath(storeName);
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(storeName, data) {
  const filePath = resolveStorePath(storeName);
  ensureDir(filePath);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return data;
}

function nextId(rows) {
  const max = (Array.isArray(rows) ? rows : []).reduce(
    (acc, row) => Math.max(acc, Number(row.id) || 0),
    0
  );
  return max + 1;
}

module.exports = {
  resolveStorePath,
  readStore,
  writeStore,
  nextId
};
