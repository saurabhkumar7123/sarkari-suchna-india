"use strict";

/**
 * Centralized comma-grid parsing for tables.
 * TABLE_PARSER_V2=0 → naive comma split (legacy production behavior).
 * TABLE_PARSER_V2=1 → quoted CSV, multiline cells, shared detection + render.
 */

const DEFAULT_DELIMITER = ",";

function isGridParserV2Enabled() {
  return String(process.env.TABLE_PARSER_V2 || "").trim() === "1";
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function splitNaiveCsvLine(line, delimiter = DEFAULT_DELIMITER) {
  return String(line || "")
    .split(delimiter)
    .map((c) => c.trim());
}

/**
 * Normalize cell: trim only; do not strip intentional content.
 * @param {string} cell
 */
function normalizeCell(cell) {
  return String(cell ?? "").trim();
}

/**
 * RFC 4180-style single-line parse (supports "" escapes).
 * @param {string} line
 * @param {string} delimiter
 * @returns {{ cells: string[], issues: object[] }}
 */
function parseCsvLine(line, delimiter = DEFAULT_DELIMITER) {
  const issues = [];
  const cells = [];
  const s = String(line ?? "");
  let i = 0;
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    cells.push(normalizeCell(field));
    field = "";
  };

  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  pushField();

  if (inQuotes) {
    issues.push({
      code: "UNCLOSED_QUOTE",
      message: "Unclosed quote in row — check opening/closing double quotes."
    });
  }

  return { cells, issues };
}

/**
 * Split section/table body into logical rows (newlines inside quoted fields preserved).
 * @param {string} text
 * @returns {string[]}
 */
function splitLogicalRows(text) {
  const s = String(text || "").replace(/\r\n/g, "\n");
  const rows = [];
  let row = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          row += '""';
          i += 1;
          continue;
        }
        inQuotes = false;
        row += ch;
        continue;
      }
      row += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      row += ch;
      continue;
    }

    if (ch === "\n") {
      rows.push(row);
      row = "";
      continue;
    }

    row += ch;
  }

  if (row.length || rows.length === 0) {
    rows.push(row);
  }

  return rows.map((r) => r.trim()).filter((r) => r.length > 0);
}

/**
 * Physical lines (legacy): non-empty trimmed lines.
 * @param {string} text
 */
function splitPhysicalRows(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Table-oriented row source for a section body.
 * @param {string} content
 */
function getTableRowStrings(content) {
  if (isGridParserV2Enabled()) {
    return splitLogicalRows(content);
  }
  return splitPhysicalRows(content);
}

/**
 * @param {string[]} rowStrings
 * @param {{ delimiter?: string }} [options]
 */
function parseV2Grid(rowStrings, options = {}) {
  const delimiter = options.delimiter || DEFAULT_DELIMITER;
  const issues = [];
  const rows = [];

  const strings = (Array.isArray(rowStrings) ? rowStrings : [])
    .map((x) => String(x ?? ""))
    .filter((r) => r.trim().length > 0);

  if (!strings.length) {
    issues.push({ code: "EMPTY_GRID", message: "No table rows (empty section body)." });
    return { rows: [], columnCount: 0, issues, parser: "v2" };
  }

  for (let idx = 0; idx < strings.length; idx += 1) {
    const lineIndex = idx + 1;
    const raw = strings[idx];
    const parsed = parseCsvLine(raw, delimiter);
    for (const pi of parsed.issues) {
      issues.push({ ...pi, row: lineIndex });
    }
    if (raw.includes("\n") && !parsed.issues.some((x) => x.code === "UNCLOSED_QUOTE")) {
      issues.push({
        code: "MULTILINE_CELL",
        row: lineIndex,
        severity: "info",
        message: `Row ${lineIndex}: multiline quoted cell detected.`
      });
    }
    rows.push({ lineIndex, cells: parsed.cells, raw });
  }

  let columnCount = rows[0] ? rows[0].cells.length : 0;

  if (columnCount < 2) {
    issues.push({
      code: "FEW_COLUMNS",
      message: `Header/first row has ${columnCount} column(s); tables need at least 2.`
    });
  }

  const headerEmpty = rows[0] && rows[0].cells.every((c) => !c);
  if (headerEmpty) {
    issues.push({
      code: "EMPTY_HEADER",
      message: "First row appears empty — add column headers."
    });
  }

  for (const row of rows) {
    if (row.cells.length !== columnCount) {
      issues.push({
        code: "COL_MISMATCH",
        row: row.lineIndex,
        expected: columnCount,
        actual: row.cells.length,
        message: `Row ${row.lineIndex}: expected ${columnCount} columns, got ${row.cells.length}.`
      });
    }
    if (row.cells.some((c) => c.length > 180)) {
      issues.push({
        code: "CELL_TOO_LONG",
        row: row.lineIndex,
        message: `Row ${row.lineIndex}: a cell exceeds 180 characters (auto table detection will skip).`
      });
    }
  }

  const naiveFirst = splitNaiveCsvLine(strings[0], delimiter).length;
  if (naiveFirst !== columnCount && columnCount >= 2) {
    issues.push({
      code: "SUSPICIOUS_COMMA_SPLIT",
      row: 1,
      severity: "info",
      message: `Row 1: naive split saw ${naiveFirst} columns but quoted parser saw ${columnCount} (use quotes for amounts like 1,30,093).`
    });
  }

  const dataRows = rows.slice(1);
  const hasNumericData = dataRows.some((row) => row.cells.some((cell) => /\d/.test(cell)));
  if (rows.length >= 2 && !hasNumericData) {
    issues.push({
      code: "NO_NUMERIC_DATA",
      message: "No digits in data rows — auto table detection may not apply (use [Section: Name | table])."
    });
  }

  if (rows.length >= 2 && columnCount >= 2) {
    const totalCells = rows.length * columnCount;
    const totalLen = rows.reduce((s, r) => s + r.cells.reduce((a, c) => a + c.length, 0), 0);
    const avgCellLen = totalLen / Math.max(1, totalCells);
    if (avgCellLen > 40) {
      issues.push({
        code: "AVG_CELL_LONG",
        message: `Average cell length ${avgCellLen.toFixed(0)} > 40 — auto table detection may not apply.`
      });
    }
  }

  return { rows, columnCount, issues, parser: "v2" };
}

/**
 * @param {string[]} lines
 */
function parseNaiveCommaGrid(lines) {
  const trimmed = (Array.isArray(lines) ? lines : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const issues = [];

  if (!trimmed.length) {
    issues.push({ code: "EMPTY_GRID", message: "No table rows (empty section body)." });
    return { rows: [], columnCount: 0, issues, parser: "naive" };
  }

  const rows = trimmed.map((line, idx) => ({
    lineIndex: idx + 1,
    cells: splitNaiveCsvLine(line),
    raw: line
  }));

  const columnCount = rows[0].cells.length;
  if (columnCount < 2) {
    issues.push({
      code: "FEW_COLUMNS",
      message: `Header/first row has ${columnCount} column(s); tables need at least 2.`
    });
  }

  for (const row of rows) {
    if (row.cells.length !== columnCount) {
      issues.push({
        code: "COL_MISMATCH",
        row: row.lineIndex,
        expected: columnCount,
        actual: row.cells.length,
        message: `Row ${row.lineIndex}: expected ${columnCount} columns, got ${row.cells.length} (extra/missing commas?).`
      });
    }
    if (row.cells.some((c) => c.length > 180)) {
      issues.push({
        code: "CELL_TOO_LONG",
        row: row.lineIndex,
        message: `Row ${row.lineIndex}: a cell exceeds 180 characters (auto table detection will skip).`
      });
    }
  }

  const dataRows = rows.slice(1);
  const hasNumericData = dataRows.some((row) => row.cells.some((cell) => /\d/.test(cell)));
  if (rows.length >= 2 && !hasNumericData) {
    issues.push({
      code: "NO_NUMERIC_DATA",
      message: "No digits in data rows — auto table detection may not apply (use [Section: Name | table])."
    });
  }

  if (rows.length >= 2 && columnCount >= 2) {
    const totalCells = rows.length * columnCount;
    const totalLen = rows.reduce((s, r) => s + r.cells.reduce((a, c) => a + c.length, 0), 0);
    const avgCellLen = totalLen / Math.max(1, totalCells);
    if (avgCellLen > 40) {
      issues.push({
        code: "AVG_CELL_LONG",
        message: `Average cell length ${avgCellLen.toFixed(0)} > 40 — auto table detection may not apply.`
      });
    }
  }

  return { rows, columnCount, issues, parser: "naive" };
}

/**
 * Parse grid from line array (uses V2 line parser when flag on).
 * @param {string[]} lines
 * @param {{ delimiter?: string, allowV2?: boolean }} [options]
 */
function parseGrid(lines, options = {}) {
  const useV2 = isGridParserV2Enabled() && options.allowV2 !== false;
  if (useV2) {
    return parseV2Grid(lines, options);
  }
  return parseNaiveCommaGrid(lines);
}

/**
 * Parse a full section table body (handles multiline when V2).
 * @param {string} content
 * @param {{ delimiter?: string }} [options]
 */
function parseGridFromContent(content, options = {}) {
  const rowStrings = getTableRowStrings(content);
  return parseGrid(rowStrings, options);
}

/**
 * @param {object} grid — from parseGrid / parseGridFromContent
 * @returns {string[][]}
 */
function gridToCellMatrix(grid) {
  if (!grid || !Array.isArray(grid.rows)) return [];
  return grid.rows.map((r) => (Array.isArray(r.cells) ? r.cells.map(normalizeCell) : []));
}

/**
 * Auto table eligibility (shared by detection + analysis).
 * @param {string} content — section body
 * @param {string[]} [physicalLines] — optional physical lines for naive path
 */
function evaluateAutoTableEligibility(content, physicalLines) {
  const grid = isGridParserV2Enabled()
    ? parseGridFromContent(content)
    : parseNaiveCommaGrid(physicalLines || splitPhysicalRows(content));

  const blocking = new Set(["COL_MISMATCH", "UNCLOSED_QUOTE", "FEW_COLUMNS", "EMPTY_GRID"]);
  const hasBlocker = grid.issues.some((i) => blocking.has(i.code));

  if (grid.rows.length < 2 || grid.columnCount < 2 || hasBlocker) {
    return { eligible: false, grid };
  }

  if (grid.issues.some((i) => i.code === "CELL_TOO_LONG" || i.code === "NO_NUMERIC_DATA" || i.code === "AVG_CELL_LONG")) {
    return { eligible: false, grid };
  }

  if (!isGridParserV2Enabled()) {
    const trimmed = (physicalLines || splitPhysicalRows(content)).map((x) => String(x).trim()).filter(Boolean);
    if (!trimmed.every((line) => line.includes(DEFAULT_DELIMITER))) {
      return { eligible: false, grid };
    }
  }

  return { eligible: true, grid };
}

/**
 * For tableBuilder: returns cell matrix using active parser.
 * @param {string} raw — section table body
 * @returns {{ rows: string[][], parser: string }}
 */
function parseTableContent(raw) {
  const grid = parseGridFromContent(raw, { allowV2: true });
  return {
    rows: gridToCellMatrix(grid),
    parser: grid.parser || (isGridParserV2Enabled() ? "v2" : "naive"),
    grid
  };
}

module.exports = {
  isGridParserV2Enabled,
  splitNaiveCsvLine,
  parseCsvLine,
  splitLogicalRows,
  splitPhysicalRows,
  getTableRowStrings,
  normalizeCell,
  parseNaiveCommaGrid,
  parseV2Grid,
  parseGrid,
  parseGridFromContent,
  gridToCellMatrix,
  evaluateAutoTableEligibility,
  parseTableContent
};
