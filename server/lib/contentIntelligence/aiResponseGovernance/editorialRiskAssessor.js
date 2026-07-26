"use strict";

const { RISK_LEVELS, RISK_RANK, READINESS_STATUSES } = require("./governanceTypes");

const CRITICAL_CODES = new Set([
  "schema.invalid_root",
  "schema.version_incompatible",
  "policy.dates_changed",
  "policy.numbers_changed",
  "policy.urls_changed",
  "policy.organization_changed"
]);

const HIGH_CODES = new Set([
  "schema.document_required",
  "schema.sections_required",
  "policy.section_removed",
  "policy.content_deleted",
  "policy.content_changed",
  "policy.metadata_removed",
  "generator.required_section_missing",
  "generator.required_metadata_missing",
  "generator.invalid_grammar",
  "generator.unsupported_block",
  "generator.unsupported_section"
]);

function riskLevel(item) {
  if (CRITICAL_CODES.has(item.code)) return RISK_LEVELS.CRITICAL;
  if (HIGH_CODES.has(item.code) || item.severity === "error") return RISK_LEVELS.HIGH;
  if (item.severity === "warning") return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

function recommendationFor(item) {
  if (/dates_changed/.test(item.code))
    return "Compare every date with the source document before approval.";
  if (/numbers_changed/.test(item.code))
    return "Verify vacancy, fee, age, and count values against the source.";
  if (/urls_changed|invalid_grammar/.test(item.code))
    return "Open and verify affected links or formatted blocks.";
  if (/organization_changed/.test(item.code))
    return "Restore the organization name from the structured source payload.";
  if (/section_removed|required_section_missing/.test(item.code))
    return "Restore the missing source section without generating new content.";
  if (/metadata/.test(item.code))
    return "Restore required metadata from the Stage 2B structured payload.";
  if (/hallucination|unexpected/.test(item.code))
    return "Confirm additional content exists in the source; remove it if unsupported.";
  if (/schema/.test(item.code))
    return "Correct the response structure and re-run deterministic governance.";
  if (/generator/.test(item.code))
    return "Correct Generator mapping or grammar without rewriting source content.";
  return "Review this finding against the Stage 2B source package.";
}

function assessEditorialRisk(allFindings, generatorCompatibility) {
  const risks = allFindings.map((item) => ({
    code: item.code,
    level: riskLevel(item),
    category: item.category,
    message: item.message,
    path: item.path == null ? null : item.path
  }));
  const levels = risks.map((risk) => risk.level);
  const overallRisk = levels.length
    ? levels.reduce(
        (highest, level) => (RISK_RANK[level] > RISK_RANK[highest] ? level : highest),
        RISK_LEVELS.LOW
      )
    : RISK_LEVELS.LOW;
  const reviewRecommendations = [...new Set(allFindings.map(recommendationFor))];

  let readinessStatus = READINESS_STATUSES.READY;
  if (overallRisk === RISK_LEVELS.CRITICAL || generatorCompatibility.status === "incompatible") {
    readinessStatus = READINESS_STATUSES.BLOCKED;
  } else if (overallRisk === RISK_LEVELS.HIGH || overallRisk === RISK_LEVELS.MEDIUM) {
    readinessStatus = READINESS_STATUSES.NEEDS_REVIEW;
  }

  return { risks, overallRisk, reviewRecommendations, readinessStatus };
}

module.exports = { assessEditorialRisk, riskLevel };
