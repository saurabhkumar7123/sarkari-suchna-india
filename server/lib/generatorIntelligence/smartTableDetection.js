"use strict";

/**
 * Smart table detection — vacancy / fee / age / dates / qualification / reservation.
 * Preserves row/column relationships as CSV grids.
 */

const {
  tryExtractTableRunAt,
  detectRowDelimiter,
  evaluatePublisherTable
} = require("../../utils/tableDetect");
const { TABLE_KINDS } = require("./types");

/**
 * @param {string} headerRow
 * @param {string} sampleBody
 * @returns {string}
 */
function classifyTableKind(headerRow, sampleBody) {
  const blob = `${String(headerRow || "")}\n${String(sampleBody || "")}`.toLowerCase();

  if (
    /\b(fee|fees|amount|₹|rs\.?|शुल्क|payment)\b/.test(blob) &&
    /\b(general|obc|ews|sc|st|ur|pwd|female|male|category)\b/.test(blob)
  ) {
    return TABLE_KINDS.FEE;
  }
  if (
    /\b(name of examination|limited departmental competitive examination|departmental\s+examinations?)\b/.test(
      blob
    ) &&
    !/\b(vacancy|vacancies|total\s*posts?)\b/.test(blob)
  ) {
    return TABLE_KINDS.UNKNOWN;
  }
  if (/\b(date\s*of\s*birth|d\.?o\.?b\.?|last\s+selected)\b/.test(blob)) {
    if (/\b(vacancy|allocated|post|category)\b/.test(blob)) return TABLE_KINDS.VACANCY;
    return TABLE_KINDS.UNKNOWN;
  }
  if (
    /\b(age\s*limit|min(?:imum)?\s*age|max(?:imum)?\s*age|years?\s*(?:of\s*)?age|आयु)\b/.test(blob) &&
    /\d/.test(blob)
  ) {
    return TABLE_KINDS.AGE;
  }
  if (
    /\b(schedule|opening|closing|last\s*date|exam\s*date|notification\s*date|start\s*date)\b/.test(blob) &&
    /\d{1,2}[./-]|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
      blob
    )
  ) {
    return TABLE_KINDS.IMPORTANT_DATES;
  }
  if (/\b(educational\s*qualification|qualification|degree|diploma|graduate|10th|12th|योग्यता)\b/.test(blob)) {
    return TABLE_KINDS.QUALIFICATION;
  }
  if (
    /\b(reservation|reserved|vertical|horizontal|pwd|ex[\s-]*servicemen|ews\s*quota)\b/.test(blob) &&
    !/\b(post\s*name|vacancy|vacancies)\b/.test(blob)
  ) {
    return TABLE_KINDS.RESERVATION;
  }
  if (
    /\b(post\s*name|vacancy|vacancies|total\s*posts?|category|ur\b|obc|sc\b|st\b|ews|gen|पद|रिक्ति)\b/.test(blob) &&
    /\d/.test(blob) &&
    !/\bname of examination\b/.test(blob)
  ) {
    return TABLE_KINDS.VACANCY;
  }
  return TABLE_KINDS.UNKNOWN;
}

/**
 * @param {string} kind
 * @returns {boolean}
 */
function isValidTableKind(kind) {
  return Object.values(TABLE_KINDS).includes(kind);
}

/**
 * Extract all delimited table runs from lines with kind classification.
 * @param {string[]} lines
 * @returns {Array<{
 *   kind: string,
 *   csvBody: string,
 *   rows: string[][],
 *   startIndex: number,
 *   endIndex: number,
 *   confidence: number,
 *   eligible: boolean
 * }>}
 */
function detectSmartTables(lines) {
  const src = Array.isArray(lines) ? lines : [];
  const tables = [];
  let i = 0;
  while (i < src.length) {
    const run = tryExtractTableRunAt(src, i);
    if (!run) {
      i += 1;
      continue;
    }
    const physical = run.csvBody.split("\n").filter(Boolean);
    const header = physical[0] || "";
    const kind = classifyTableKind(header, run.csvBody);
    const evaled = evaluatePublisherTable(run.csvBody);
    const rows = physical.map((row) =>
      row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    );
    const colCounts = new Set(rows.map((r) => r.length));
    const colConsistent = colCounts.size === 1;
    let confidence = 0.45;
    if (evaled.eligible) confidence += 0.25;
    if (colConsistent && rows.length >= 2) confidence += 0.15;
    if (kind !== TABLE_KINDS.UNKNOWN) confidence += 0.1;
    if (rows.length >= 3) confidence += 0.05;
    confidence = Math.min(0.98, confidence);

    tables.push({
      kind,
      csvBody: run.csvBody,
      rows,
      startIndex: i,
      endIndex: run.endIndex,
      confidence,
      eligible: Boolean(evaled.eligible)
    });
    i = run.endIndex;
  }
  return tables;
}

/**
 * Prefer vacancy-like tables for Vacancy | table section.
 * @param {ReturnType<typeof detectSmartTables>} tables
 */
function pickPrimaryVacancyTable(tables) {
  const vacancy = (tables || []).filter(
    (t) => t.kind === TABLE_KINDS.VACANCY || t.kind === TABLE_KINDS.RESERVATION
  );
  if (!vacancy.length) return null;
  return vacancy.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function looksLikeTableHeader(line) {
  const t = String(line || "").trim();
  if (!detectRowDelimiter(t)) return false;
  return /\b(post|category|vacancy|fee|age|date|qualification|ur|obc|sc|st|ews|total|पद|वर्ग)\b/i.test(
    t
  );
}

module.exports = {
  classifyTableKind,
  isValidTableKind,
  detectSmartTables,
  pickPrimaryVacancyTable,
  looksLikeTableHeader,
  TABLE_KINDS
};
