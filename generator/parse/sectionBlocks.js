"use strict";

const TABLE_START_RE = /^---table---$/i;
const TABLE_END_RE = /^---endtable---$/i;

function isMixedSectionBlocksEnabled() {
  return String(process.env.MIXED_SECTION_BLOCKS || "").trim() === "1";
}

/**
 * True when section body contains an explicit ---table--- marker line.
 * @param {string} content
 */
function hasExplicitTableMarkers(content) {
  const lines = String(content || "").split(/\r?\n/);
  return lines.some((line) => TABLE_START_RE.test(String(line || "").trim()));
}

/**
 * Whether this section should use mixed block rendering.
 * @param {{ forceTable?: boolean, content?: string }} section
 */
function shouldUseMixedSectionBlocks(section) {
  if (!isMixedSectionBlocksEnabled()) return false;
  if (section && section.forceTable) return false;
  return hasExplicitTableMarkers(section?.content);
}

/**
 * Parse explicit ---table--- / ---endtable--- blocks (deterministic, no heuristics).
 * @param {string} content — section body
 * @returns {{
 *   blocks: Array<{ type: 'text'|'table', content: string, lines: string[], index: number }>,
 *   issues: Array<{ code: string, message: string, line?: number, severity?: string }>,
 *   isMixed: boolean
 * }}
 */
function parseSectionBlocks(content) {
  const src = String(content ?? "");
  const rawLines = src.split(/\r?\n/);
  const blocks = [];
  const issues = [];

  let inTable = false;
  let tableStartLine = 0;
  let textBuf = [];
  let tableBuf = [];
  let blockIndex = 0;

  const flushText = () => {
    const segment = textBuf.join("\n").trim();
    if (!segment) {
      textBuf = [];
      return;
    }
    const lines = segment.split("\n").filter((l) => String(l).trim().length > 0);
    blocks.push({
      type: "text",
      content: segment,
      lines,
      index: blockIndex++
    });
    textBuf = [];
  };

  const flushTable = () => {
    const segment = tableBuf.join("\n").trim();
    const lines = tableBuf.filter((l) => String(l).trim().length > 0);
    blocks.push({
      type: "table",
      content: segment,
      lines,
      index: blockIndex++
    });
    tableBuf = [];
  };

  for (let i = 0; i < rawLines.length; i += 1) {
    const lineNo = i + 1;
    const trimmed = String(rawLines[i] || "").trim();

    if (TABLE_START_RE.test(trimmed)) {
      if (inTable) {
        issues.push({
          code: "NESTED_TABLE_BLOCK",
          line: lineNo,
          severity: "error",
          message: `Nested ---table--- at line ${lineNo} (close previous block with ---endtable---).`
        });
        tableBuf.push(rawLines[i]);
      } else {
        flushText();
        inTable = true;
        tableStartLine = lineNo;
      }
      continue;
    }

    if (TABLE_END_RE.test(trimmed)) {
      if (!inTable) {
        issues.push({
          code: "ORPHAN_END_TABLE",
          line: lineNo,
          severity: "warn",
          message: `---endtable--- at line ${lineNo} without a matching ---table---.`
        });
        continue;
      }

      if (!tableBuf.some((l) => String(l).trim().length > 0)) {
        issues.push({
          code: "EMPTY_TABLE_BLOCK",
          line: tableStartLine,
          severity: "warn",
          message: `Empty table block opened at line ${tableStartLine}.`
        });
      }

      flushTable();
      inTable = false;
      tableStartLine = 0;
      continue;
    }

    if (inTable) {
      tableBuf.push(rawLines[i]);
    } else {
      textBuf.push(rawLines[i]);
    }
  }

  if (inTable) {
    issues.push({
      code: "UNCLOSED_TABLE_BLOCK",
      line: tableStartLine,
      severity: "error",
      message: `Unclosed ---table--- opened at line ${tableStartLine} (missing ---endtable---).`
    });
    if (!tableBuf.some((l) => String(l).trim().length > 0)) {
      issues.push({
        code: "EMPTY_TABLE_BLOCK",
        line: tableStartLine,
        severity: "warn",
        message: `Empty table block opened at line ${tableStartLine}.`
      });
    }
    flushTable();
  } else {
    flushText();
  }

  const isMixed = blocks.some((b) => b.type === "table") && blocks.some((b) => b.type === "text");

  return { blocks, issues, isMixed };
}

module.exports = {
  isMixedSectionBlocksEnabled,
  hasExplicitTableMarkers,
  shouldUseMixedSectionBlocks,
  parseSectionBlocks,
  TABLE_START_RE,
  TABLE_END_RE
};
