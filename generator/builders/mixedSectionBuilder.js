"use strict";

const { buildTable } = require("./tableBuilder");
const { renderLinesToHtml } = require("./lineRenderer");
const { parseSectionBlocks } = require("../parse/sectionBlocks");

/**
 * Render a section body that uses explicit ---table--- / ---endtable--- blocks.
 * @param {string} content
 * @param {string} [sectionName]
 * @returns {string}
 */
function buildMixedSectionHtml(content, sectionName = "") {
  const { blocks } = parseSectionBlocks(content);
  let html = "";

  for (const block of blocks) {
    if (block.type === "table") {
      const tableHtml = buildTable(block.content);
      if (tableHtml) html += tableHtml;
      continue;
    }
    if (block.lines && block.lines.length) {
      html += renderLinesToHtml(block.lines, { sectionName });
    }
  }

  return html;
}

module.exports = { buildMixedSectionHtml };
