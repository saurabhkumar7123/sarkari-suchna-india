"use strict";

const db = require("../../../config/db");

const tableCache = new Map();
const columnCache = new Map();

async function tableExists(tableName) {
  const key = String(tableName);
  if (tableCache.has(key)) return tableCache.get(key);
  try {
    const [rows] = await db.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
      [key]
    );
    const exists = Array.isArray(rows) && rows.length > 0;
    tableCache.set(key, exists);
    return exists;
  } catch {
    tableCache.set(key, false);
    return false;
  }
}

async function getColumns(tableName) {
  const key = String(tableName);
  if (columnCache.has(key)) return columnCache.get(key);
  try {
    const [rows] = await db.query(
      `SELECT column_name AS columnName
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [key]
    );
    const columns = new Set(rows.map((r) => r.columnName || r.COLUMN_NAME));
    columnCache.set(key, columns);
    return columns;
  } catch {
    const empty = new Set();
    columnCache.set(key, empty);
    return empty;
  }
}

async function columnExists(tableName, columnName) {
  const columns = await getColumns(tableName);
  return columns.has(columnName);
}

function invalidateSchemaCache() {
  tableCache.clear();
  columnCache.clear();
}

module.exports = {
  tableExists,
  getColumns,
  columnExists,
  invalidateSchemaCache
};
