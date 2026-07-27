"use strict";

/**
 * Phase AI-4 — Draft completeness analysis.
 * Unknown sections are preserved and never treated as gaps.
 */

const { SECTION_TYPE_TO_TITLE, COMPLETENESS_SECTIONS } = require("./types");
const { hasNonEmptySection, getSection } = require("./draftModel");
const { round2 } = require("./draftUtils");

/**
 * @param {object} draft
 * @returns {{
 *   percentage: number,
 *   present: Array<object>,
 *   missing: Array<object>,
 *   empty: Array<object>,
 *   unknownPreserved: Array<object>,
 *   expectedCount: number,
 *   presentCount: number,
 *   explanation: string
 * }}
 */
function analyzeCompleteness(draft) {
  const expected = draft.expectedSections || COMPLETENESS_SECTIONS;
  const present = [];
  const missing = [];
  const empty = [];

  for (const sectionType of expected) {
    const sec = getSection(draft, sectionType);
    const title = SECTION_TYPE_TO_TITLE[sectionType] || sectionType;
    if (!sec) {
      missing.push({ sectionType, title, reason: "section_absent" });
      continue;
    }
    if (sec.isEmpty) {
      empty.push({ sectionType, title, reason: "section_empty" });
      continue;
    }
    present.push({
      sectionType,
      title,
      wordCount: sec.wordCount,
      order: sec.order
    });
  }

  const presentCount = present.length;
  const expectedCount = expected.length;
  const percentage = expectedCount ? round2((presentCount / expectedCount) * 100) : 0;

  const unknownPreserved = (draft.unknownSections || []).map((sec) => ({
    title: sec.title || sec.generatorTitle,
    order: sec.order,
    wordCount: sec.wordCount,
    preserved: true
  }));

  return {
    percentage,
    present,
    missing,
    empty,
    unknownPreserved,
    expectedCount,
    presentCount,
    emptyCount: empty.length,
    missingCount: missing.length,
    explanation: `Draft covers ${presentCount} of ${expectedCount} expected sections for profile "${draft.profile}" (${percentage}%). ${unknownPreserved.length} unknown section(s) preserved.`
  };
}

/**
 * Lightweight check used by scoring when only a boolean is needed.
 * @param {object} draft
 * @param {string} sectionType
 * @returns {boolean}
 */
function sectionPresent(draft, sectionType) {
  return hasNonEmptySection(draft, sectionType);
}

module.exports = {
  analyzeCompleteness,
  sectionPresent
};
