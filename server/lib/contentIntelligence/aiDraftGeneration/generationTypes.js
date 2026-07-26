"use strict";

/**
 * CIP Stage 2B — Shared AI Draft Generation Engine taxonomy.
 * Provider-agnostic constants only. No AI / network / randomness.
 */

const ENGINE_ID = "CIP_AI_DRAFT_GENERATION_ENGINE";
const STAGE_ID = "CIP_2B";
const ENGINE_VERSION = "1.0.0";

const REQUEST_PACKAGE_FORMAT_ID = "cip_ai_request_package_v1";
const NORMALIZED_RESPONSE_FORMAT_ID = "cip_normalized_ai_response_v1";
const EXPECTED_OUTPUT_SCHEMA_ID = "cip_ai_draft_output_schema_v1";
const DRAFT_POLICY_ID = "cip_ai_draft_policy_v1";

/** Stable contract version for the CIP ↔ LLM boundary. */
const CONTRACT_VERSION = "1.0.0";

/**
 * System instruction lines shared by every request package.
 * Deterministic order. Provider-independent.
 */
const SYSTEM_INSTRUCTION_LINES = Object.freeze([
  "You are a content drafting assistant for Sarkari Suchna India (CIP).",
  "Produce a structured page draft that preserves the source document facts.",
  "Follow the Draft Policy and Expected Output Schema exactly.",
  "Never invent information, dates, links, vacancies, tables, or numbers.",
  "Never summarize, omit sections, or change meaning.",
  "Keep the original language unless the request explicitly asks otherwise.",
  "Return only data matching the Expected Output Schema. No provider-specific wrappers."
]);

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  REQUEST_PACKAGE_FORMAT_ID,
  NORMALIZED_RESPONSE_FORMAT_ID,
  EXPECTED_OUTPUT_SCHEMA_ID,
  DRAFT_POLICY_ID,
  CONTRACT_VERSION,
  SYSTEM_INSTRUCTION_LINES
};
