"use strict";

const { parseGridFromContent, isGridParserV2Enabled } = require("../lib/csvGridParser");
const {
  parseSectionsFromText,
  resolveSectionRenderMode,
  isSafeCsvTable,
  isNumberedRowsTable
} = require("../parse/sectionParse");
const {
  isMixedSectionBlocksEnabled,
  shouldUseMixedSectionBlocks,
  parseSectionBlocks,
  hasExplicitTableMarkers
} = require("../parse/sectionBlocks");

/**
 * @typedef {{ code: string, message: string, section?: string, row?: number, severity?: string }} AnalysisWarning
 */

function analyzeJobContent(text) {
  const src = String(text || "");
  const warnings = [];
  const legacySet = new Set();

  const add = (code, message, extra = {}) => {
    const w = { code, message, severity: extra.severity || "warn", ...extra };
    warnings.push(w);
    legacySet.add(message);
  };

  const sections = parseSectionsFromText(src);

  if (!sections.length) {
    add("NO_SECTIONS", "No sections detected. Content may not render properly.", { severity: "error" });
  }

  const globalLines = src.split(/\r?\n/);
  for (const rawLine of globalLines) {
    const t = String(rawLine || "").trim();
    if (!t) continue;
    if (/^\[\s*section\s*:.*\]$/i.test(t) && !/^\[Section:[^\]]+\]$/i.test(t)) {
      add("INVALID_SECTION", "Invalid section format. Use [Section: Name]");
    }
    if (/^\[Section\s+:/.test(t)) {
      add("INVALID_SECTION", "Invalid section format. Use [Section: Name]");
    }
    if (/^\[(?:Section|section)\s*:[^\]]*$/.test(t)) {
      add("INVALID_SECTION", "Invalid section format. Use [Section: Name]");
    }
    if (t.includes(":") && t.includes("=")) {
      add("COLON_AND_EQ", "Line contains both ':' and '=' — may be parsed incorrectly.");
    }
    if (/^https?:\/\/\S+/i.test(t)) {
      add("BARE_URL", "URL without label. Use Label=https://...");
    }
  }

  const sectionResults = sections.map((sec) => {
    const useMixed = shouldUseMixedSectionBlocks(sec);
    let blockParse = null;
    if (useMixed) {
      blockParse = parseSectionBlocks(sec.content);
      for (const issue of blockParse.issues) {
        add(issue.code, `[${sec.cleanHeaderTitle}]: ${issue.message}`, {
          section: sec.cleanHeaderTitle,
          row: issue.line,
          severity: issue.severity || "warn"
        });
      }
    } else if (
      hasExplicitTableMarkers(sec.content) &&
      !sec.forceTable &&
      String(process.env.MIXED_SECTION_BLOCKS || "").trim() === "0"
    ) {
      add(
        "MIXED_BLOCKS_FLAG_OFF",
        `[${sec.cleanHeaderTitle}]: ---table--- markers found but MIXED_SECTION_BLOCKS=0 — markers render as plain text.`,
        { section: sec.cleanHeaderTitle, severity: "info" }
      );
    }

    const renderMode = useMixed
      ? "mixed_blocks"
      : resolveSectionRenderMode(sec.lines, sec.forceTable, sec.content);
    const willRenderAsTable =
      !useMixed &&
      (renderMode === "table_forced" ||
        renderMode === "table_auto_safe" ||
        renderMode === "table_auto_numbered");

    const grid = useMixed
      ? { rows: [], columnCount: 0, issues: [], parser: isGridParserV2Enabled() ? "v2" : "naive" }
      : parseGridFromContent(sec.content);
    const tableMeta = {
      detected: willRenderAsTable,
      forced: sec.forceTable,
      renderMode,
      parser: grid.parser || (isGridParserV2Enabled() ? "v2" : "naive"),
      rowCount: grid.rows.length,
      columnCount: grid.columnCount,
      autoSafeCsv: isSafeCsvTable(sec.lines, sec.content),
      autoNumbered: !sec.forceTable && isNumberedRowsTable(sec.lines),
      rowIssues: grid.issues
    };

    if (useMixed && blockParse) {
      for (const block of blockParse.blocks) {
        if (block.type !== "table" || !block.content.trim()) continue;
        const blockGrid = parseGridFromContent(block.content);
        for (const issue of blockGrid.issues) {
          if (issue.code === "NO_NUMERIC_DATA") continue;
          const severity =
            issue.severity ||
            (issue.code === "UNCLOSED_QUOTE" || issue.code === "COL_MISMATCH" ? "warn" : "info");
          add(
            issue.code,
            `[${sec.cleanHeaderTitle}] table block ${block.index + 1}: ${issue.message}`,
            { section: sec.cleanHeaderTitle, row: issue.row, severity, blockIndex: block.index }
          );
        }
      }
    } else {
      for (const issue of grid.issues) {
        const severity =
          issue.severity ||
          (issue.code === "UNCLOSED_QUOTE" || issue.code === "COL_MISMATCH" ? "warn" : "info");
        if (sec.forceTable || issue.code !== "NO_NUMERIC_DATA") {
          if (issue.code === "MULTILINE_CELL" && !isGridParserV2Enabled()) continue;
          let code = issue.code;
          if (sec.forceTable && issue.code === "COL_MISMATCH") {
            code = "FORCED_TABLE_COL_MISMATCH";
          }
          add(code, `[${sec.cleanHeaderTitle}]: ${issue.message}`, {
            section: sec.cleanHeaderTitle,
            row: issue.row,
            severity
          });
        }
      }
    }

    if (sec.forceTable && !useMixed) {
      if (grid.rows.length < 2) {
        add("FORCED_TABLE_FEW_ROWS", `[${sec.cleanHeaderTitle}]: forced table has fewer than 2 rows.`, {
          section: sec.cleanHeaderTitle,
          severity: "error"
        });
      }
      if (grid.columnCount < 2) {
        add("FORCED_TABLE_FEW_COLS", `[${sec.cleanHeaderTitle}]: forced table needs at least 2 columns on the first row.`, {
          section: sec.cleanHeaderTitle,
          severity: "error"
        });
      }
    } else if (!useMixed && !willRenderAsTable && sec.lines.some((l) => l.includes(","))) {
      const commaLines = sec.lines.filter((l) => l.includes(","));
      if (commaLines.length >= 2 && grid.issues.some((i) => i.code === "COL_MISMATCH")) {
        add("TABLE_COL_MISMATCH", `[${sec.cleanHeaderTitle}]: Table rows have inconsistent columns.`, {
          section: sec.cleanHeaderTitle
        });
      } else if (
        commaLines.length >= 2 &&
        !isSafeCsvTable(sec.lines, sec.content) &&
        !isNumberedRowsTable(sec.lines)
      ) {
        add(
          "COMMA_NOT_TABLE",
          `[${sec.cleanHeaderTitle}]: Comma rows will render as lines/paragraphs, not a table. Use [Section: ${sec.cleanHeaderTitle} | table] for a stable table.`,
          { section: sec.cleanHeaderTitle, severity: "info" }
        );
      }
    }

    const blocksMeta =
      useMixed && blockParse
        ? blockParse.blocks.map((b) => {
            const meta = {
              index: b.index,
              type: b.type,
              lineCount: b.lines.length
            };
            if (b.type === "table") {
              const bg = parseGridFromContent(b.content);
              meta.rowCount = bg.rows.length;
              meta.columnCount = bg.columnCount;
              meta.rowIssues = bg.issues;
            }
            return meta;
          })
        : null;

    return {
      name: sec.cleanHeaderTitle,
      rawHeader: sec.rawHeaderTitle,
      forceTable: sec.forceTable,
      lineCount: sec.lines.length,
      renderMode,
      willRenderAsTable,
      isMixedSection: Boolean(useMixed),
      hasTableBlocks: Boolean(blockParse && blockParse.blocks.some((b) => b.type === "table")),
      blockCount: blockParse ? blockParse.blocks.length : 0,
      blocks: blocksMeta,
      table: tableMeta
    };
  });

  const tableSectionCount = sectionResults.filter((s) => s.willRenderAsTable).length;
  const forcedTableCount = sectionResults.filter((s) => s.forceTable).length;
  const mixedSectionCount = sectionResults.filter((s) => s.isMixedSection).length;

  return {
    sections: sectionResults,
    warnings,
    legacyWarnings: Array.from(legacySet),
    parserVersion: isGridParserV2Enabled() ? "v2" : "naive",
    mixedBlocksEnabled: isMixedSectionBlocksEnabled(),
    summary: {
      sectionCount: sectionResults.length,
      tableSectionCount,
      forcedTableCount,
      mixedSectionCount
    }
  };
}

module.exports = { analyzeJobContent };
