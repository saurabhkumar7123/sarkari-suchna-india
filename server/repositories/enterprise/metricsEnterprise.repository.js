"use strict";

const db = require("../../config/db");
const { tableExists } = require("../../lib/enterprise/base/schemaGuard");
const { readStore, writeStore, nextId } = require("../../lib/enterprise/base/fileStore");
const { parseJsonColumn, stringifyJson } = require("../../lib/enterprise/base/jsonColumn");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("../../lib/enterprise/base/pagination");

const TABLE = "automation_metrics";
const STORE = "automation-metrics";

const METRIC_TYPES = Object.freeze({
  DAILY: "daily",
  DEPARTMENT: "department",
  CONFIDENCE: "confidence",
  RECOVERY: "recovery",
  REVIEW: "review",
  WORKFLOW: "workflow",
  QUEUE: "queue",
  PERFORMANCE: "performance",
  HISTORICAL: "historical"
});

async function isReady() {
  return tableExists(TABLE);
}

async function upsertMetric({
  metricDate,
  metricType,
  dimension = null,
  dimensionValue = null,
  value = {}
}) {
  const row = {
    metric_date: String(metricDate || new Date().toISOString().slice(0, 10)),
    metric_type: String(metricType),
    dimension: dimension ? String(dimension).slice(0, 128) : null,
    dimension_value: dimensionValue ? String(dimensionValue).slice(0, 256) : null,
    value_json: value
  };

  if (await isReady()) {
    await db.query(
      `INSERT INTO ${TABLE} (metric_date, metric_type, dimension, dimension_value, value_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = NOW()`,
      [
        row.metric_date,
        row.metric_type,
        row.dimension,
        row.dimension_value,
        stringifyJson(row.value_json)
      ]
    );
    return row;
  }

  const rows = readStore(STORE, []);
  const key = `${row.metric_date}|${row.metric_type}|${row.dimension}|${row.dimension_value}`;
  const index = rows.findIndex(
    (item) =>
      `${item.metric_date}|${item.metric_type}|${item.dimension}|${item.dimension_value}` === key
  );
  const saved = { id: index >= 0 ? rows[index].id : nextId(rows), ...row };
  if (index >= 0) rows[index] = saved;
  else rows.push(saved);
  writeStore(STORE, rows);
  return saved;
}

async function listMetrics(opts = {}) {
  if (await isReady()) {
    const page = parsePage(opts.page);
    const limit = parseLimit(opts.limit, 20, 200);
    const offset = buildOffset(page, limit);
    const params = [];
    let where = "WHERE 1=1";
    if (opts.metricType) {
      where += " AND metric_type = ?";
      params.push(String(opts.metricType));
    }
    if (opts.metricDate) {
      where += " AND metric_date = ?";
      params.push(String(opts.metricDate));
    }
    if (opts.from) {
      where += " AND metric_date >= ?";
      params.push(String(opts.from));
    }
    if (opts.to) {
      where += " AND metric_date <= ?";
      params.push(String(opts.to));
    }
    const [[countRow]] = await db.query(`SELECT COUNT(*) AS total FROM ${TABLE} ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM ${TABLE} ${where}
       ORDER BY metric_date DESC, metric_type ASC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return buildPaginationResult({
      page,
      limit,
      total: Number(countRow?.total) || 0,
      data: rows.map((row) => ({ ...row, value_json: parseJsonColumn(row.value_json) }))
    });
  }

  let rows = readStore(STORE, []);
  if (opts.metricType) rows = rows.filter((row) => row.metric_type === opts.metricType);
  if (opts.metricDate) rows = rows.filter((row) => row.metric_date === opts.metricDate);
  const page = parsePage(opts.page);
  const limit = parseLimit(opts.limit, 20, 200);
  const offset = buildOffset(page, limit);
  return buildPaginationResult({
    page,
    limit,
    total: rows.length,
    data: rows.slice(offset, offset + limit)
  });
}

async function getDailySnapshot(date = null) {
  const metricDate = date || new Date().toISOString().slice(0, 10);
  const result = await listMetrics({ metricType: METRIC_TYPES.DAILY, metricDate, limit: 100 });
  return {
    metricDate,
    metrics: result.data
  };
}

async function recordBatch(metrics = []) {
  const saved = [];
  for (const metric of metrics) {
    saved.push(await upsertMetric(metric));
  }
  return saved;
}

module.exports = {
  METRIC_TYPES,
  isReady,
  upsertMetric,
  listMetrics,
  getDailySnapshot,
  recordBatch
};
