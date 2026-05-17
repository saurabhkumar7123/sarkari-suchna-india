"use strict";

const csv = require("csv-parser");
const path = require("path");
const fileService = require("./file.service");
const contentImportRepository = require("../repositories/contentImport.repository");
const {
  isContentImportEnabled,
  MAX_CSV_ROWS,
  MAX_CONTENT_CHARS
} = require("../config/contentImport");

function normalizeCsvRowKeys(row) {
  const out = {};
  if (!row || typeof row !== "object") return out;
  for (const [key, value] of Object.entries(row)) {
    const k = String(key)
      .replace(/^\ufeff/, "")
      .trim()
      .toLowerCase();
    out[k] = value;
  }
  return out;
}

function extractContentFromRow(row) {
  const normalized = normalizeCsvRowKeys(row);
  const raw = normalized.content;
  if (raw == null) return "";
  return String(raw).replace(/\r\n/g, "\n").trim();
}

function validateCsvFileMeta(file) {
  if (!file) {
    const err = new Error("No file uploaded");
    err.statusCode = 400;
    throw err;
  }
  const csvMime = String(file.mimetype || "").toLowerCase();
  const csvExt = path.extname(String(file.originalname || "")).toLowerCase();
  const mimeOk =
    csvMime === "text/csv" ||
    csvMime === "application/csv" ||
    csvMime === "application/vnd.ms-excel";
  if (!mimeOk || csvExt !== ".csv") {
    const err = new Error("Only CSV allowed");
    err.statusCode = 400;
    throw err;
  }
}

async function parseCsvFileToRows(filePath) {
  const results = [];
  let rowOverflow = false;
  await new Promise((resolve, reject) => {
    const stream = fileService.createReadStream(filePath);
    const parser = csv();
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    stream.on("error", fail);
    parser.on("error", fail);

    stream
      .pipe(parser)
      .on("data", (data) => {
        if (results.length >= MAX_CSV_ROWS) {
          rowOverflow = true;
          return;
        }
        results.push(data);
      })
      .on("end", () => {
        if (!settled) {
          settled = true;
          if (rowOverflow) {
            const err = new Error(`CSV exceeds maximum row limit (${MAX_CSV_ROWS})`);
            err.statusCode = 400;
            reject(err);
            return;
          }
          resolve();
        }
      });
  });
  return results;
}

function rowsToImportRecords(rawRows, sourceFile) {
  const records = [];
  let skipped = 0;
  let rowIndex = 0;

  for (const raw of rawRows) {
    rowIndex += 1;
    const content = extractContentFromRow(raw);
    if (!content) {
      skipped += 1;
      continue;
    }
    if (content.length > MAX_CONTENT_CHARS) {
      const err = new Error(
        `Row ${rowIndex} exceeds maximum content length (${MAX_CONTENT_CHARS} characters)`
      );
      err.statusCode = 400;
      throw err;
    }
    records.push({
      content,
      sourceFile: sourceFile || null,
      rowIndex
    });
  }

  if (!records.length) {
    const err = new Error('CSV must contain a "content" column with at least one non-empty row');
    err.statusCode = 400;
    throw err;
  }

  const firstKeys = rawRows.length ? Object.keys(normalizeCsvRowKeys(rawRows[0])) : [];
  if (!firstKeys.includes("content")) {
    const err = new Error('CSV header must include a "content" column');
    err.statusCode = 400;
    throw err;
  }

  return { records, skipped };
}

async function assertImportTableReady() {
  if (!isContentImportEnabled()) {
    const err = new Error("Content import is disabled");
    err.statusCode = 503;
    throw err;
  }
  const exists = await contentImportRepository.tableExists();
  if (!exists) {
    const err = new Error(
      "content_imports table is missing. Run db/migrations/2026-05-16-content-imports.sql"
    );
    err.statusCode = 503;
    throw err;
  }
}

/**
 * @param {{ path: string, originalname?: string }} file
 */
async function importCsvFile(file) {
  await assertImportTableReady();
  validateCsvFileMeta(file);

  const sourceFile = String(file.originalname || "upload.csv").slice(0, 255);
  const rawRows = await parseCsvFileToRows(file.path);
  const { records, skipped } = rowsToImportRecords(rawRows, sourceFile);
  const ids = await contentImportRepository.insertMany(records);

  return {
    imported: ids.length,
    skipped,
    ids
  };
}

async function listImports(query = {}) {
  await assertImportTableReady();
  return contentImportRepository.listImports(query);
}

async function getImportById(id, { markOpened = false } = {}) {
  await assertImportTableReady();
  const row = await contentImportRepository.findById(id);
  if (!row) return null;
  if (markOpened) {
    await contentImportRepository.markOpened(id);
    row.status = row.status === "pending" ? "opened" : row.status;
    if (!row.opened_at) row.opened_at = new Date();
  }
  return row;
}

module.exports = {
  importCsvFile,
  listImports,
  getImportById,
  normalizeCsvRowKeys,
  extractContentFromRow
};
