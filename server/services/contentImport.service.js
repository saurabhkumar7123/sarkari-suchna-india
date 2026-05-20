"use strict";

const csv = require("csv-parser");
const path = require("path");
const fileService = require("./file.service");
const contentImportRepository = require("../repositories/contentImport.repository");
const {
  isContentImportEnabled,
  isStructuredCsvImportEnabled,
  MAX_CSV_ROWS,
  MAX_CONTENT_CHARS
} = require("../config/contentImport");
const {
  createStructuredGroupState,
  appendLineToStructuredGroup,
  compileStructuredGroupState,
  csvHeadersSupportStructured,
  readImportGroup,
  readSection,
  readLine,
  trimCell
} = require("../utils/contentCompiler");

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

/**
 * Legacy path: non-empty `content` cell → stored as-is (backward compatible).
 * @param {object} row — raw CSV row object
 */
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

/**
 * Push one compiled/imported draft if content is non-empty; enforce size limit.
 * @param {object[]} records
 * @param {{ content: string, sourceFile: string|null, rowIndex: number }} item
 * @param {number} rowIndexForError — 1-based row for error messages
 */
function pushImportRecord(records, item, rowIndexForError) {
  const content = trimCell(item.content);
  if (!content) return;
  if (content.length > MAX_CONTENT_CHARS) {
    const err = new Error(
      `Row ${rowIndexForError} exceeds maximum content length (${MAX_CONTENT_CHARS} characters)`
    );
    err.statusCode = 400;
    throw err;
  }
  records.push({
    content,
    sourceFile: item.sourceFile || null,
    rowIndex: item.rowIndex
  });
}

/**
 * Flush in-progress structured group into records (one import draft per import_group).
 * @param {import('../utils/contentCompiler').StructuredGroupState|null} groupState
 * @param {object[]} records
 * @param {string|null} sourceFile
 */
function flushStructuredGroup(groupState, records, sourceFile) {
  if (!groupState || !groupState.sections.length) return;
  const content = compileStructuredGroupState(groupState);
  if (!content) return;
  pushImportRecord(
    records,
    {
      content,
      sourceFile,
      rowIndex: groupState.groupStartRowIndex || 1
    },
    groupState.groupStartRowIndex || 1
  );
}

/**
 * Convert CSV rows → content_imports records.
 *
 * Backward compatibility:
 * - Non-empty `content` on a row → that row alone becomes one draft (legacy; unchanged).
 * - Otherwise `section` + `line` columns compile to canonical [Section: …] text (import-time only).
 * - Blank import_group / section continue the previous non-empty values in the same file order.
 * - Parser (sectionBuilder) and DB schema are not modified.
 *
 * @param {object[]} rawRows
 * @param {string|null} sourceFile
 */
function rowsToImportRecords(rawRows, sourceFile) {
  const records = [];
  let skipped = 0;
  let rowIndex = 0;

  const headerKeys = rawRows.length ? Object.keys(normalizeCsvRowKeys(rawRows[0])) : [];
  const hasContentCol = headerKeys.includes("content");
  const structuredEnabled = isStructuredCsvImportEnabled();
  const hasStructuredCols = structuredEnabled && csvHeadersSupportStructured(headerKeys);

  if (!hasContentCol && !hasStructuredCols) {
    const err = new Error(
      'CSV header must include a "content" column, or "section" and "line" columns for structured import'
    );
    err.statusCode = 400;
    throw err;
  }

  /** @type {import('../utils/contentCompiler').StructuredGroupState|null} */
  let groupState = null;

  for (const raw of rawRows) {
    rowIndex += 1;
    const normalized = normalizeCsvRowKeys(raw);

    // Legacy: non-empty content column → one draft per row (existing production behavior).
    const legacyContent = extractContentFromRow(raw);
    if (legacyContent) {
      flushStructuredGroup(groupState, records, sourceFile);
      groupState = null;
      pushImportRecord(
        records,
        { content: legacyContent, sourceFile, rowIndex },
        rowIndex
      );
      continue;
    }

    if (!hasStructuredCols) {
      skipped += 1;
      continue;
    }

    const line = readLine(normalized);
    if (!line) {
      skipped += 1;
      continue;
    }

    const groupRaw = readImportGroup(normalized);
    const sectionRaw = readSection(normalized);

    if (groupRaw && groupState && groupState.currentGroup && groupRaw !== groupState.currentGroup) {
      flushStructuredGroup(groupState, records, sourceFile);
      groupState = null;
    }

    if (!groupState) {
      groupState = createStructuredGroupState();
      groupState.groupStartRowIndex = rowIndex;
      groupState.currentGroup = groupRaw || "1";
    } else if (groupRaw) {
      groupState.currentGroup = groupRaw;
    }

    if (sectionRaw) {
      groupState.currentSection = sectionRaw;
    }

    if (!groupState.currentSection) {
      const err = new Error(
        `Row ${rowIndex}: "line" requires a section — set "section" on this row or a previous row in the same import_group`
      );
      err.statusCode = 400;
      throw err;
    }

    appendLineToStructuredGroup(groupState, groupState.currentSection, line);
  }

  flushStructuredGroup(groupState, records, sourceFile);

  if (!records.length) {
    const err = new Error(
      hasStructuredCols
        ? "CSV must have at least one non-empty content cell or structured section/line row"
        : 'CSV must contain a "content" column with at least one non-empty row'
    );
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

async function deleteImportById(id) {
  await assertImportTableReady();
  const row = await contentImportRepository.findById(id);
  if (!row) {
    const err = new Error("Import not found");
    err.statusCode = 404;
    throw err;
  }
  const deleted = await contentImportRepository.deleteById(id);
  if (!deleted) {
    const err = new Error("Import not found");
    err.statusCode = 404;
    throw err;
  }
  return { id };
}

module.exports = {
  importCsvFile,
  listImports,
  getImportById,
  deleteImportById,
  normalizeCsvRowKeys,
  extractContentFromRow,
  rowsToImportRecords
};
