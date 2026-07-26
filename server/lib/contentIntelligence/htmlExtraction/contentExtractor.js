"use strict";

const { BLOCK_TYPES } = require("./htmlExtractionTypes");
const { normalizeWhitespace, isHidden, attributesOf } = require("./normalization");

function directListItemText($, item) {
  const clone = $(item).clone();
  clone.find("ol, ul").remove();
  return normalizeWhitespace(clone.text());
}

function extractList($, element) {
  const node = $(element);
  const items = [];
  node.children("li").each((_index, item) => {
    const nested = [];
    $(item)
      .children("ol, ul")
      .each((_nestedIndex, list) => nested.push(extractList($, list)));
    items.push({
      text: directListItemText($, item),
      value: normalizeWhitespace($(item).attr("value")) || null,
      lists: nested
    });
  });
  return {
    ordered: String(element.tagName || element.name).toLowerCase() === "ol",
    start: normalizeWhitespace(node.attr("start")) || null,
    items
  };
}

function extractTable($, element) {
  const node = $(element);
  const rows = [];
  node.find("tr").each((_rowIndex, row) => {
    if ($(row).closest("table")[0] !== element) return;
    const cells = [];
    $(row)
      .children("th, td")
      .each((_cellIndex, cell) => {
        const cellNode = $(cell);
        cells.push({
          type: String(cell.tagName || cell.name).toLowerCase() === "th" ? "header" : "cell",
          text: normalizeWhitespace(cellNode.text()),
          rowSpan: Number.parseInt(cellNode.attr("rowspan"), 10) || 1,
          columnSpan: Number.parseInt(cellNode.attr("colspan"), 10) || 1,
          scope: normalizeWhitespace(cellNode.attr("scope")) || null
        });
      });
    rows.push({
      section:
        $(row).parent("thead").length > 0
          ? "head"
          : $(row).parent("tfoot").length > 0
            ? "foot"
            : "body",
      cells
    });
  });
  return {
    caption: normalizeWhitespace(node.children("caption").first().text()) || null,
    rows
  };
}

function extractDefinitionList($, element) {
  const entries = [];
  let current = null;
  $(element)
    .children("dt, dd")
    .each((_index, child) => {
      const tag = String(child.tagName || child.name).toLowerCase();
      const text = normalizeWhitespace($(child).text());
      if (tag === "dt") {
        current = { term: text, definitions: [] };
        entries.push(current);
      } else {
        if (!current) {
          current = { term: "", definitions: [] };
          entries.push(current);
        }
        current.definitions.push(text);
      }
    });
  return { entries };
}

function createElementOrder($) {
  const order = new WeakMap();
  let index = 0;
  $("*").each((_unused, element) => {
    order.set(element, index);
    index += 1;
  });
  return (element) => order.get(element) ?? Number.MAX_SAFE_INTEGER;
}

function extractContentBlocks($, orderOf) {
  const candidates = [];
  let hiddenNodeCount = 0;

  $("h1, h2, h3, h4, h5, h6, p, ol, ul, table, dl").each((_index, element) => {
    if (isHidden($, element)) {
      hiddenNodeCount += 1;
      return;
    }
    const node = $(element);
    const tag = String(element.tagName || element.name).toLowerCase();

    if ((tag === "ol" || tag === "ul") && node.parents("ol, ul").length) return;
    if (tag === "table" && node.parents("table").length) return;
    if (node.closest("nav, [role=navigation]").length) return;

    let block;
    if (/^h[1-6]$/u.test(tag)) {
      block = {
        type: BLOCK_TYPES.HEADING,
        text: normalizeWhitespace(node.text()),
        level: Number(tag.slice(1)),
        attributes: attributesOf($, element, ["id", "class"])
      };
    } else if (tag === "p") {
      block = {
        type: BLOCK_TYPES.PARAGRAPH,
        text: normalizeWhitespace(node.text()),
        attributes: attributesOf($, element, ["id", "class"])
      };
    } else if (tag === "ol" || tag === "ul") {
      block = { type: BLOCK_TYPES.LIST, ...extractList($, element) };
    } else if (tag === "table") {
      block = { type: BLOCK_TYPES.TABLE, ...extractTable($, element) };
    } else {
      block = { type: BLOCK_TYPES.DEFINITION_LIST, ...extractDefinitionList($, element) };
    }

    const hasContent =
      block.type === BLOCK_TYPES.PARAGRAPH || block.type === BLOCK_TYPES.HEADING
        ? Boolean(block.text)
        : true;
    if (hasContent) candidates.push({ order: orderOf(element), block });
  });

  candidates.sort((a, b) => a.order - b.order);
  const blocks = [];
  const seen = new Set();
  let duplicateNodeCount = 0;
  for (const candidate of candidates) {
    const key = JSON.stringify(candidate.block);
    if (seen.has(key)) {
      duplicateNodeCount += 1;
      continue;
    }
    seen.add(key);
    blocks.push({
      id: `block-${blocks.length + 1}`,
      order: candidate.order,
      ...candidate.block
    });
  }

  return { blocks, hiddenNodeCount, duplicateNodeCount };
}

module.exports = {
  createElementOrder,
  extractList,
  extractTable,
  extractDefinitionList,
  extractContentBlocks
};
