"use strict";

const {
  splitPhysicalRows,
  splitNaiveCsvLine,
  parseV2Grid,
  parseNaiveCommaGrid,
  evaluateAutoTableEligibility
} = require("../../generator/lib/csvGridParser");

const BLOCKING_GRID = new Set(["COL_MISMATCH", "UNCLOSED_QUOTE", "FEW_COLUMNS", "EMPTY_GRID"]);

/**
 * @param {string} line
 * @returns {string}
 */
function stripRowNumberPrefix(line) {
  return String(line || "")
    .replace(/^\s*[\d]+[\s.)-]+/, "")
    .trim();
}

/**
 * @param {string} line
 * @returns {","|"|"|\t"|null}
 */
function detectRowDelimiter(line) {
  const t = stripRowNumberPrefix(line);
  if (!t) return null;
  if (t.includes("\t")) {
    const parts = t.split("\t").map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) return "\t";
  }
  if (/\|/.test(t)) {
    const parts = t.split("|").map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) return "|";
  }
  if (/,/.test(t)) {
    const parts = splitNaiveCsvLine(t);
    if (parts.length >= 2) return ",";
  }
  return null;
}

/**
 * @param {string} line
 * @param {string} delim
 * @returns {number}
 */
function countColumns(line, delim) {
  const t = stripRowNumberPrefix(line);
  if (delim === ",") return splitNaiveCsvLine(t).length;
  if (delim === "\t") return t.split("\t").map((x) => x.trim()).filter(Boolean).length;
  return t.split("|").map((x) => x.trim()).filter(Boolean).length;
}

/**
 * @param {string} line
 * @param {string} delim
 * @returns {string}
 */
function normalizeRowToCsv(line, delim) {
  const t = stripRowNumberPrefix(line);
  if (delim === ",") return t;
  if (delim === "\t") {
    return t
      .split("\t")
      .map((x) => x.trim())
      .join(", ");
  }
  return t
    .split("|")
    .map((x) => x.trim())
    .join(", ");
}

/**
 * @param {string[]} lines
 * @param {number} start
 * @returns {{ csvBody: string, endIndex: number } | null}
 */
function tryExtractTableRunAt(lines, start) {
  const first = lines[start];
  if (!first || !String(first).trim()) return null;

  const delim = detectRowDelimiter(first);
  if (!delim) return null;

  const expectedCols = countColumns(first, delim);
  if (expectedCols < 2) return null;

  const runLines = [first];
  let i = start + 1;

  while (i < lines.length) {
    const line = String(lines[i] || "").trim();
    if (!line) break;
    const d = detectRowDelimiter(line);
    if (!d || d !== delim) break;
    const cols = countColumns(line, d);
    if (cols !== expectedCols) break;
    runLines.push(line);
    i += 1;
  }

  if (runLines.length < 2) return null;

  const csvBody = runLines.map((ln) => normalizeRowToCsv(ln, delim)).join("\n");
  return { csvBody, endIndex: i };
}

/**
 * @param {string} body
 * @returns {{ eligible: boolean, grid: object, parser: string }}
 */
function evaluatePublisherTable(body) {
  const content = String(body || "").trim();
  if (!content) return { eligible: false, grid: null, parser: "none" };

  const physical = splitPhysicalRows(content);
  const auto = evaluateAutoTableEligibility(content, physical);
  if (auto.eligible) {
    return { eligible: true, grid: auto.grid, parser: auto.grid.parser || "auto" };
  }

  const v2 = parseV2Grid(physical);
  if (
    v2.rows.length >= 2 &&
    v2.columnCount >= 2 &&
    !v2.issues.some((i) => BLOCKING_GRID.has(i.code) || i.code === "COL_MISMATCH")
  ) {
    const dataRows = v2.rows.slice(1);
    const hasNumeric = dataRows.some((r) => r.cells.some((c) => /\d/.test(c)));
    const headerLooksTabular = /post|category|vacancy|vacancies|post\s*name|total|ur\b|obc|sc\b|st\b|ews|gen\b|sl\.?\s*no|s\.?\s*no/i.test(
      v2.rows[0].cells.join(" ")
    );
    if (hasNumeric || (headerLooksTabular && v2.rows.length >= 2)) {
      return { eligible: true, grid: v2, parser: "v2-relaxed" };
    }
  }

  const naive = parseNaiveCommaGrid(physical);
  if (
    naive.rows.length >= 2 &&
    naive.columnCount >= 2 &&
    !naive.issues.some((i) => i.code === "COL_MISMATCH" || BLOCKING_GRID.has(i.code))
  ) {
    const dataRows = naive.rows.slice(1);
    const hasNumeric = dataRows.some((r) => r.cells.some((c) => /\d/.test(c)));
    const headerText = naive.rows[0].cells.join(" ").toLowerCase();
    const headerLooksTabular = /post|category|vacancy|total|ur|obc|sc|st|ews|name|count|पद|वर्ग|रिक्ति/.test(
      headerText
    );
    if (hasNumeric || (headerLooksTabular && naive.rows.length >= 2)) {
      return { eligible: true, grid: naive, parser: "naive-relaxed" };
    }
  }

  return { eligible: false, grid: naive, parser: "none" };
}

/**
 * @param {string} vacancyBody
 * @returns {{ title: string, body: string, isTable: boolean }}
 */
function resolveVacancySectionHeader(vacancyBody) {
  const body = String(vacancyBody || "").trim();
  if (!body || body === "—") return { title: "Vacancy", body: "—", isTable: false };

  const { eligible } = evaluatePublisherTable(body);
  if (eligible) {
    return { title: "Vacancy | table", body, isTable: true };
  }
  return { title: "Vacancy", body, isTable: false };
}

/**
 * @param {string[]} vacancyLines — may include multi-line table blocks
 * @returns {string}
 */
function formatVacancyStructured(vacancy) {
  if (!vacancy || !vacancy.length) return "—";

  const parts = [];
  for (const raw of vacancy) {
    const block = String(raw || "").trim();
    if (!block) continue;

    if (block.includes("\n")) {
      const { eligible } = evaluatePublisherTable(block);
      if (eligible) {
        parts.push(block);
        continue;
      }
    }

    if (/\b(candidates?\s+are|therefore|accordingly|shall\s+be\s+eligible|general\s+information)\b/i.test(block)) {
      continue;
    }

    let t = block.replace(/^[-*•]\s*/, "").trim();
    if (t.length > 140) t = t.slice(0, 140).trim();

    const delim = detectRowDelimiter(t);
    if (delim) {
      parts.push(normalizeRowToCsv(t, delim));
      continue;
    }

    const nums = t.match(/\d[\d,\s]*/);
    const textOnly = nums ? t.replace(nums[0], "").replace(/\s+/g, " ").trim() : t;
    if (nums && textOnly.length > 2) {
      parts.push(`${textOnly}, ${nums[0].replace(/\s/g, "")}`);
    } else {
      parts.push(t);
    }
  }

  if (!parts.length) return "—";

  const joined = parts.join("\n");
  const runs = [];
  const physical = splitPhysicalRows(joined);
  let idx = 0;
  while (idx < physical.length) {
    const run = tryExtractTableRunAt(physical, idx);
    if (run) {
      runs.push(run.csvBody);
      idx = run.endIndex;
    } else {
      idx += 1;
    }
  }

  if (runs.length === 1 && runs[0].split("\n").length >= parts.length) {
    return runs[0];
  }

  return parts.join("\n");
}

module.exports = {
  stripRowNumberPrefix,
  detectRowDelimiter,
  countColumns,
  normalizeRowToCsv,
  tryExtractTableRunAt,
  evaluatePublisherTable,
  resolveVacancySectionHeader,
  formatVacancyStructured
};
