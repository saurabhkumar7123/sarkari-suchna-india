"use strict";

const { BLOCK_TYPES } = require("./pdfExtractionTypes");
const { normalizeWhitespace, joinBrokenParagraph } = require("./normalization");

const LIST_ITEM_RE =
  /^(?:[\u2022\u2023\u25E6\u2043•·◦▪▸►\*]|[-–—]|\(?\d+[.)]|\(?[a-zA-Z][.)]|[ivxlcdm]+[.)])\s+/iu;
const SECTION_TITLE_RE =
  /^(?:important\s+dates|eligibility|vacancies?|how\s+to\s+apply|general\s+instructions|notification|result|admit\s+card|answer\s+key|corrigendum|notice|syllabus|exam\s+pattern|selection\s+process|application\s+fee)\b/iu;

function isLikelySectionTitle(line, medianFontHeight) {
  const text = line.text;
  if (!text || text.length > 120) return false;
  if (/[.!?:;,]$/u.test(text) && text.length > 40) return false;
  if (SECTION_TITLE_RE.test(text)) return true;
  if (line.fontHeight >= medianFontHeight * 1.25 && text.length <= 80) return true;
  if (text === text.toUpperCase() && /[A-Z]/u.test(text) && text.length <= 80) return true;
  if (/^\d+(\.\d+)*\.?\s+\S+/u.test(text) && text.length <= 100) return true;
  return false;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function columnSignature(line) {
  const gaps = [];
  for (let i = 1; i < line.parts.length; i += 1) {
    const prev = line.parts[i - 1];
    const curr = line.parts[i];
    const gap = curr.x - (prev.x + prev.width);
    if (gap > Math.max(10, line.fontHeight * 1.5)) gaps.push(Math.round(curr.x / 8) * 8);
  }
  return gaps;
}

function looksLikeTableRow(line) {
  const cols = columnSignature(line);
  if (cols.length >= 1 && line.parts.length >= 2) return true;
  const source = line.rawText || line.text;
  const cells = source
    .split(/\s{2,}|\t+/u)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  return cells.length >= 2;
}

function splitTableCells(line) {
  if (line.parts.length >= 2 && columnSignature(line).length >= 1) {
    const cells = [];
    let current = line.parts[0].str;
    for (let i = 1; i < line.parts.length; i += 1) {
      const prev = line.parts[i - 1];
      const curr = line.parts[i];
      const gap = curr.x - (prev.x + prev.width);
      if (gap > Math.max(10, line.fontHeight * 1.5)) {
        cells.push(normalizeWhitespace(current));
        current = curr.str;
      } else {
        const needsSpace = !/\s$/u.test(current) && !/^\s/u.test(curr.str);
        current += (needsSpace ? " " : "") + curr.str;
      }
    }
    cells.push(normalizeWhitespace(current));
    return cells.filter(Boolean);
  }
  return String(line.rawText || line.text)
    .split(/\s{2,}|\t+/u)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function extractListFromLines(lines) {
  const items = [];
  for (const line of lines) {
    const text = line.text.replace(LIST_ITEM_RE, "").trim();
    items.push({ text, value: null, lists: [] });
  }
  const ordered = /^\(?\d+[.)]/u.test(lines[0].text) || /^\(?[ivxlcdm]+[.)]/iu.test(lines[0].text);
  return { ordered, start: ordered ? "1" : null, items };
}

function extractContentFromPages(pages) {
  const blocks = [];
  let duplicateNodeCount = 0;
  let suppressedHeaderFooterCount = 0;
  const seen = new Set();
  let globalOrder = 0;

  for (const page of pages) {
    const contentLines = page.lines.filter((line) => {
      if (page.headerTexts.has(line.text) || page.footerTexts.has(line.text)) {
        suppressedHeaderFooterCount += 1;
        return false;
      }
      return Boolean(line.text);
    });

    const fontMedian = median(contentLines.map((line) => line.fontHeight).filter(Boolean));
    let index = 0;
    while (index < contentLines.length) {
      const line = contentLines[index];

      if (page.headerTexts.has(line.text) === false && line.topRatio <= 0.08 && pages.length === 1) {
        // single-page headers still captured as header blocks when near top and short
      }

      if (LIST_ITEM_RE.test(line.text)) {
        const listLines = [line];
        index += 1;
        while (index < contentLines.length && LIST_ITEM_RE.test(contentLines[index].text)) {
          listLines.push(contentLines[index]);
          index += 1;
        }
        pushBlock(blocks, seen, {
          type: BLOCK_TYPES.LIST,
          pageNumber: page.pageNumber,
          order: globalOrder++,
          ...extractListFromLines(listLines)
        }, () => {
          duplicateNodeCount += 1;
        });
        continue;
      }

      if (looksLikeTableRow(line)) {
        const tableLines = [line];
        index += 1;
        while (index < contentLines.length && looksLikeTableRow(contentLines[index])) {
          tableLines.push(contentLines[index]);
          index += 1;
        }
        if (tableLines.length >= 2) {
          const rows = tableLines.map((tableLine, rowIndex) => ({
            section: rowIndex === 0 ? "head" : "body",
            cells: splitTableCells(tableLine).map((text) => ({
              type: rowIndex === 0 ? "header" : "cell",
              text,
              rowSpan: 1,
              columnSpan: 1,
              scope: rowIndex === 0 ? "col" : null
            }))
          }));
          pushBlock(blocks, seen, {
            type: BLOCK_TYPES.TABLE,
            pageNumber: page.pageNumber,
            order: globalOrder++,
            caption: null,
            rows
          }, () => {
            duplicateNodeCount += 1;
          });
          continue;
        }
        // fall through as paragraph/title if only one ambiguous row
        index -= 1;
      }

      if (isLikelySectionTitle(line, fontMedian || line.fontHeight || 12)) {
        pushBlock(blocks, seen, {
          type: BLOCK_TYPES.HEADING,
          text: line.text,
          level: estimateHeadingLevel(line, fontMedian),
          pageNumber: page.pageNumber,
          order: globalOrder++,
          attributes: { role: "section_title" }
        }, () => {
          duplicateNodeCount += 1;
        });
        index += 1;
        continue;
      }

      const paragraphLines = [line];
      index += 1;
      while (index < contentLines.length) {
        const next = contentLines[index];
        if (LIST_ITEM_RE.test(next.text)) break;
        if (isLikelySectionTitle(next, fontMedian || next.fontHeight || 12)) break;
        if (looksLikeTableRow(next) && index + 1 < contentLines.length && looksLikeTableRow(contentLines[index + 1])) {
          break;
        }
        const gap = paragraphLines[paragraphLines.length - 1].y - next.y;
        if (gap > Math.max(18, (fontMedian || 12) * 1.8)) break;
        paragraphLines.push(next);
        index += 1;
      }

      pushBlock(blocks, seen, {
        type: BLOCK_TYPES.PARAGRAPH,
        text: joinBrokenParagraph(paragraphLines.map((entry) => entry.text)),
        pageNumber: page.pageNumber,
        order: globalOrder++,
        attributes: {}
      }, () => {
        duplicateNodeCount += 1;
      });
    }

    for (const text of page.headerTexts) {
      pushBlock(blocks, seen, {
        type: BLOCK_TYPES.HEADER,
        text,
        pageNumber: page.pageNumber,
        order: globalOrder++,
        attributes: { repeated: true }
      }, () => {
        duplicateNodeCount += 1;
      });
    }
    for (const text of page.footerTexts) {
      pushBlock(blocks, seen, {
        type: BLOCK_TYPES.FOOTER,
        text,
        pageNumber: page.pageNumber,
        order: globalOrder++,
        attributes: { repeated: true }
      }, () => {
        duplicateNodeCount += 1;
      });
    }
  }

  return {
    blocks: blocks.map((block, index) => ({ id: `block-${index + 1}`, ...block })),
    duplicateNodeCount,
    suppressedHeaderFooterCount
  };
}

function estimateHeadingLevel(line, medianFontHeight) {
  const ratio = medianFontHeight > 0 ? line.fontHeight / medianFontHeight : 1;
  if (ratio >= 1.8) return 1;
  if (ratio >= 1.45) return 2;
  if (ratio >= 1.2) return 3;
  if (line.text === line.text.toUpperCase()) return 2;
  return 3;
}

function pushBlock(blocks, seen, block, onDuplicate) {
  if (!block || (block.text !== undefined && !block.text && block.type !== BLOCK_TYPES.LIST && block.type !== BLOCK_TYPES.TABLE)) {
    return;
  }
  const key = JSON.stringify({
    type: block.type,
    text: block.text || null,
    items: block.items || null,
    rows: block.rows || null,
    pageNumber: block.pageNumber
  });
  if (seen.has(key)) {
    onDuplicate();
    return;
  }
  seen.add(key);
  blocks.push(block);
}

module.exports = {
  extractContentFromPages,
  isLikelySectionTitle,
  LIST_ITEM_RE
};
