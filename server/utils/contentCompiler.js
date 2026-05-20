"use strict";

const { normalizeSectionFormatting } = require("./normalizeSectionFormatting");

/**
 * Import-time only: structured CSV rows → canonical [Section: …] text for #data / publish.
 * Does not change sectionBuilder.js or rendering.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimCell(value) {
  if (value == null) return "";
  return String(value).replace(/\r\n/g, "\n").trim();
}

/**
 * @typedef {{ name: string, lines: string[] }} SectionBlock
 */

/**
 * @typedef {{
 *   currentGroup: string|null,
 *   currentSection: string|null,
 *   sections: SectionBlock[],
 *   groupStartRowIndex: number|null
 * }} StructuredGroupState
 */

/**
 * @returns {StructuredGroupState}
 */
function createStructuredGroupState() {
  return {
    currentGroup: null,
    currentSection: null,
    sections: [],
    groupStartRowIndex: null
  };
}

/**
 * @param {StructuredGroupState} state
 * @param {string} sectionName
 * @param {string} line
 */
function appendLineToStructuredGroup(state, sectionName, line) {
  const name = trimCell(sectionName);
  const ln = trimCell(line);
  if (!name || !ln) return;

  let block = state.sections.find((s) => s.name === name);
  if (!block) {
    block = { name, lines: [] };
    state.sections.push(block);
  }
  block.lines.push(ln);
}

/**
 * Ordered section blocks → canonical parser input (then normalized).
 * @param {SectionBlock[]} sections
 * @returns {string}
 */
function compileStructuredSections(sections) {
  if (!sections || !sections.length) return "";

  const parts = [];
  for (const block of sections) {
    const name = trimCell(block.name);
    if (!name) continue;
    parts.push(`[Section: ${name}]`);
    for (const line of block.lines) {
      const ln = trimCell(line);
      if (ln) parts.push(ln);
    }
  }

  if (!parts.length) return "";
  return normalizeSectionFormatting(parts.join("\n"));
}

/**
 * @param {StructuredGroupState} state
 * @returns {string}
 */
function compileStructuredGroupState(state) {
  return compileStructuredSections(state.sections);
}

/**
 * Whether CSV headers support structured import (section + line columns).
 * @param {string[]} headerKeys — lowercase keys from normalizeCsvRowKeys
 */
function csvHeadersSupportStructured(headerKeys) {
  return headerKeys.includes("section") && headerKeys.includes("line");
}

/**
 * @param {Record<string, unknown>} normalized — lowercase keys
 * @returns {string}
 */
function readImportGroup(normalized) {
  return trimCell(normalized.import_group ?? normalized.group);
}

/**
 * @param {Record<string, unknown>} normalized
 * @returns {string}
 */
function readSection(normalized) {
  return trimCell(normalized.section);
}

/**
 * @param {Record<string, unknown>} normalized
 * @returns {string}
 */
function readLine(normalized) {
  return trimCell(normalized.line);
}

module.exports = {
  trimCell,
  createStructuredGroupState,
  appendLineToStructuredGroup,
  compileStructuredSections,
  compileStructuredGroupState,
  csvHeadersSupportStructured,
  readImportGroup,
  readSection,
  readLine
};
