"use strict";

/**
 * CIP Stage 2B — reusable Draft Policy.
 * Deterministic drafting rules for any future LLM provider.
 */

const { DRAFT_POLICY_ID } = require("./generationTypes");

const DRAFT_POLICY_RULES = Object.freeze([
  Object.freeze({
    id: "preserve_factual_content",
    rule: "Preserve factual content",
    description: "Keep all facts from the structured payload unchanged."
  }),
  Object.freeze({
    id: "do_not_invent_information",
    rule: "Do not invent information",
    description: "Never add facts, posts, vacancies, fees, or claims not present in the payload."
  }),
  Object.freeze({
    id: "do_not_remove_sections",
    rule: "Do not remove sections",
    description: "Every input section must appear in the output in the same relative coverage."
  }),
  Object.freeze({
    id: "preserve_dates",
    rule: "Preserve dates",
    description: "Keep all dates and date labels exactly as provided."
  }),
  Object.freeze({
    id: "preserve_links",
    rule: "Preserve links",
    description: "Keep link labels and URLs exactly as provided."
  }),
  Object.freeze({
    id: "preserve_tables",
    rule: "Preserve tables",
    description: "Keep table structure, headers, and cell values intact."
  }),
  Object.freeze({
    id: "preserve_numbers",
    rule: "Preserve numbers",
    description: "Keep numeric values (fees, vacancies, counts) unchanged."
  }),
  Object.freeze({
    id: "keep_original_language",
    rule: "Keep original language unless explicitly requested",
    description: "Do not translate or rewrite language unless the request package asks for it."
  }),
  Object.freeze({
    id: "respect_generator_formatting",
    rule: "Respect Generator-compatible formatting",
    description: "Use canonical section titles and block types expected by the Generator."
  }),
  Object.freeze({
    id: "do_not_summarize",
    rule: "Do not summarize",
    description: "Do not condense, paraphrase-away, or drop content for brevity."
  }),
  Object.freeze({
    id: "do_not_change_meaning",
    rule: "Do not change meaning",
    description: "Preserve the original meaning of every statement and section."
  })
]);

/**
 * Build the frozen Draft Policy object embedded in every AI Request Package.
 */
function buildDraftPolicy() {
  return {
    id: DRAFT_POLICY_ID,
    version: "1.0.0",
    rules: DRAFT_POLICY_RULES.map((r) => ({
      id: r.id,
      rule: r.rule,
      description: r.description
    })),
    ruleTexts: DRAFT_POLICY_RULES.map((r) => r.rule)
  };
}

module.exports = {
  DRAFT_POLICY_RULES,
  buildDraftPolicy
};
