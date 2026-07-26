"use strict";

/**
 * CIP Stage 2A — Shared AI Draft Preparation Engine taxonomy.
 * Deterministic constants only. No AI / randomness.
 */

const OUTPUT_FORMAT_ID = "cip_structured_page_draft_v1";

const REQUIRED_OUTPUT_FORMAT = Object.freeze({
  id: OUTPUT_FORMAT_ID,
  description:
    "Preserve ordered sections and blocks from the validated CIP document. " +
    "Do not invent, rewrite, summarize, or drop content. " +
    "Use generatorTitle where available for section headings.",
  rules: Object.freeze([
    "Keep section order exactly as provided",
    "Keep block order exactly as provided within each section",
    "Preserve originalContent and normalizedContent without rewriting",
    "Never invent facts, dates, links, vacancies, or metadata",
    "Never summarize or omit sections or blocks",
    "Do not make publish or editorial decisions"
  ])
});

const GENERATOR_EXPECTATION_BASE = Object.freeze({
  useCanonicalSectionTitles: true,
  preserveBlockTypes: true,
  preserveLinkTargets: true,
  preserveTablesAndLists: true,
  noRawSourceText: true
});

module.exports = {
  OUTPUT_FORMAT_ID,
  REQUIRED_OUTPUT_FORMAT,
  GENERATOR_EXPECTATION_BASE
};
