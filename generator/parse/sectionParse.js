"use strict";

const {
  isGridParserV2Enabled,
  evaluateAutoTableEligibility,
  splitPhysicalRows
} = require("../lib/csvGridParser");

function isSafeCsvTable(lines, content) {
  const body = content != null ? String(content) : (Array.isArray(lines) ? lines.join("\n") : "");
  const physical = Array.isArray(lines) ? lines : splitPhysicalRows(body);
  const { eligible } = evaluateAutoTableEligibility(body, physical);
  return eligible;
}

function isNumberedRowsTable(lines) {
  if (isGridParserV2Enabled()) {
    return false;
  }
  if (!Array.isArray(lines) || lines.length < 2) return false;
  const trimmed = lines.map((x) => String(x || "").trim()).filter(Boolean);
  if (trimmed.length < 2) return false;
  if (trimmed.some((line) => line.length > 180)) return false;
  return trimmed.every((line) => /^\d+\s*[.)]?\s*(,|\s|$)/.test(line));
}

function parseSectionsFromText(text) {
  const src = String(text || "");
  const sectionRegex = /\[\s*section\s*:\s*(.*?)\]([\s\S]*?)(?=\n\[\s*section\s*:|$)/gi;
  const sections = [];
  let match;
  while ((match = sectionRegex.exec(src)) !== null) {
    const rawHeaderTitle = String(match[1] || "").trim();
    const forceTable = /\|\s*table\s*$/i.test(rawHeaderTitle);
    const cleanHeaderTitle = rawHeaderTitle.replace(/\|\s*table\s*$/i, "").trim();
    const content = String(match[2] || "").trim();
    sections.push({
      rawHeaderTitle,
      cleanHeaderTitle,
      forceTable,
      content,
      lines: content.split("\n").filter(Boolean)
    });
  }
  return sections;
}

function resolveSectionRenderMode(lines, forceTable, content) {
  const body = content != null ? String(content) : (Array.isArray(lines) ? lines.join("\n") : "");
  if (forceTable) return "table_forced";
  if (isSafeCsvTable(lines, body)) return "table_auto_safe";
  if (isNumberedRowsTable(lines)) return "table_auto_numbered";
  return "lines";
}

module.exports = {
  isSafeCsvTable,
  isNumberedRowsTable,
  parseSectionsFromText,
  resolveSectionRenderMode
};
