"use strict";

const { isUrlLike } = require("./parseLinkLineParts");
const { hasMarkdownInlineLinks } = require("./inlineMarkdownLinks");
const { shouldUseMixedSectionBlocks, parseSectionBlocks } = require("../parse/sectionBlocks");
const { blockHasLinkLines, isImportantLinksSection } = require("../builders/lineRenderer");

const HEADER_TONE = {
  DEFAULT: "card-header--facts",
  DATES: "card-header--dates",
  TABLE: "card-header--table",
  LINKS: "card-header--action"
};

function emptyCounts() {
  return { link: 0, date_row: 0, faq: 0, list: 0, paragraph: 0 };
}

/**
 * Classify a single content line for section header tone (not full render mode).
 * @param {string} line
 * @param {{ linksSection?: boolean }} [options]
 * @returns {"link"|"date_row"|"faq"|"list"|"paragraph"|"skip"}
 */
function classifyContentLine(line, options = {}) {
  const raw = String(line || "").trim();
  if (!raw) return "skip";
  if (/^---(?:end)?table---$/i.test(raw)) return "skip";

  if (raw.startsWith("Q:") || raw.startsWith("A:")) {
    return "faq";
  }

  const eqIdx = raw.indexOf("=");
  const hasEq = eqIdx > -1;
  const rightOfEq = hasEq ? raw.slice(eqIdx + 1).trim() : "";
  if ((hasEq && isUrlLike(rightOfEq)) || isUrlLike(raw)) {
    return "link";
  }

  if (hasMarkdownInlineLinks(raw)) {
    return "link";
  }

  if (/^[-*•]\s+/.test(raw) || /^\d+[.)]\s+/.test(raw)) {
    return "list";
  }

  const hasColon = raw.includes(":");
  if (hasColon && !raw.startsWith("Q:") && !raw.startsWith("A:")) {
    const parts = raw.split(":");
    const label = parts[0].trim();
    const value = parts.slice(1).join(":").trim();
    if (label && value) {
      return options.linksSection ? "link" : "date_row";
    }
  }

  return "paragraph";
}

function bumpCount(counts, type) {
  if (type === "skip") return;
  counts[type] = (counts[type] || 0) + 1;
}

function countLines(lines, options = {}) {
  const counts = emptyCounts();
  if (!Array.isArray(lines)) return counts;
  for (const line of lines) {
    bumpCount(counts, classifyContentLine(line, options));
  }
  return counts;
}

function mergeCounts(target, source) {
  for (const key of Object.keys(source)) {
    target[key] = (target[key] || 0) + (source[key] || 0);
  }
  return target;
}

function pickHeaderTone(counts) {
  if ((counts.link || 0) > 0) return HEADER_TONE.LINKS;
  return HEADER_TONE.DEFAULT;
}

function resolveMixedSectionHeaderTone(section) {
  const parsed = parseSectionBlocks(section.content);
  const linksSection =
    isImportantLinksSection(section.cleanHeaderTitle) ||
    blockHasLinkLines(section.lines);
  const counts = emptyCounts();

  for (const block of parsed.blocks) {
    if (block.type === "table") continue;
    mergeCounts(counts, countLines(block.lines, { linksSection }));
  }

  return pickHeaderTone(counts);
}

/**
 * Resolve card-header modifier from section body (not section title).
 * Links: white/red. All other sections (dates, table, list, FAQ, paragraph): navy (#1e3c72).
 * @param {{ forceTable?: boolean, content?: string, lines?: string[], cleanHeaderTitle?: string }} section
 * @returns {string}
 */
function resolveSectionHeaderTone(section) {
  const lines = Array.isArray(section?.lines) ? section.lines : [];

  if (shouldUseMixedSectionBlocks(section)) {
    return resolveMixedSectionHeaderTone(section);
  }

  const linksSection =
    isImportantLinksSection(section?.cleanHeaderTitle) || blockHasLinkLines(lines);
  const counts = countLines(lines, { linksSection });
  return pickHeaderTone(counts);
}

module.exports = {
  HEADER_TONE,
  classifyContentLine,
  resolveSectionHeaderTone
};
