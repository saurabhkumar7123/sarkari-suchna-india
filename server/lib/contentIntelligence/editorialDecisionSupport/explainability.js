"use strict";

/**
 * CIP Stage 2E — Explainability helpers for recommendations.
 */

const { explanation, SEVERITY_RANK } = require("./decisionTypes");

function buildRecommendation(id, text, reason, supportingFinding, severity, affectedSection) {
  return {
    id,
    text,
    explanation: explanation(reason, supportingFinding, severity, affectedSection)
  };
}

function collectKeyFindings(analysis, limit = 8) {
  const findings = ((analysis && analysis.allFindings) || []).slice();
  findings.sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity] || 0;
    const sb = SEVERITY_RANK[b.severity] || 0;
    if (sb !== sa) return sb - sa;
    return String(a.code || "").localeCompare(String(b.code || ""));
  });

  return findings.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    code: item.code,
    severity: item.severity,
    category: item.category || null,
    message: item.message,
    affectedSection: item.sectionType || item.path || null,
    explanation: explanation(
      "Surfaced as a prioritized editorial finding.",
      item.code,
      item.severity || "info",
      item.sectionType || item.path || null
    )
  }));
}

function collectSuggestedReviewAreas(analysis, changeSummary, checklist) {
  const areas = [];
  const push = (id, text, reason, supportingFinding, severity, affectedSection) => {
    if (areas.some((a) => a.id === id)) return;
    areas.push(buildRecommendation(id, text, reason, supportingFinding, severity, affectedSection));
  };

  if (analysis && analysis.metadataCompleteness && !analysis.metadataCompleteness.complete) {
    push(
      "area_metadata",
      "Review incomplete metadata fields",
      "Required metadata fields are missing.",
      (analysis.metadataCompleteness.missingFields || []).join(","),
      "warning",
      null
    );
  }

  if (analysis && analysis.sectionCompleteness && !analysis.sectionCompleteness.complete) {
    push(
      "area_sections",
      "Review missing required sections",
      "Required sections for this document type are missing.",
      (analysis.sectionCompleteness.missingRequiredSections || []).join(","),
      "error",
      null
    );
  }

  if (changeSummary && changeSummary.policyViolations.length) {
    push(
      "area_policy",
      "Review policy violations against source",
      "Policy findings were detected during upstream governance.",
      "policyViolations",
      "error",
      null
    );
  }

  if (
    analysis &&
    analysis.generatorCompatibility &&
    analysis.generatorCompatibility.status !== "compatible"
  ) {
    push(
      "area_generator",
      "Review Generator compatibility issues",
      "Generator compatibility is partial or incompatible.",
      analysis.generatorCompatibility.status,
      "error",
      null
    );
  }

  if (analysis && analysis.unknownSectionCount > 0) {
    push(
      "area_unknown_sections",
      "Review unknown sections",
      "Unknown sections were preserved for Generator.",
      `count=${analysis.unknownSectionCount}`,
      "warning",
      null
    );
  }

  if (analysis && analysis.unknownBlockCount > 0) {
    push(
      "area_unknown_blocks",
      "Review unknown blocks",
      "Unknown blocks were preserved for Generator.",
      `count=${analysis.unknownBlockCount}`,
      "warning",
      null
    );
  }

  if (analysis && analysis.qualityScores && analysis.qualityScores.overall < 75) {
    push(
      "area_quality",
      "Review low quality score drivers",
      "Overall quality score is below the ready threshold.",
      `qualityScore=${analysis.qualityScores.overall}`,
      "warning",
      null
    );
  }

  (checklist || [])
    .filter((c) => c.id !== "manual_approval_required")
    .slice(0, 6)
    .forEach((c) => {
      push(
        `area_from_${c.id}`,
        c.label,
        c.explanation.reason,
        c.explanation.supportingFinding,
        c.explanation.severity,
        c.affectedSection
      );
    });

  return areas;
}

function buildDecisionExplanation(priorityResult, analysis, publishReadiness) {
  const parts = [];
  parts.push(`Review priority set to ${priorityResult.priority}.`);
  parts.push(
    `Editorial risk is ${(analysis && analysis.editorialRisk && analysis.editorialRisk.overall) || "LOW"}.`
  );
  parts.push(
    `Publish readiness advisory status is ${publishReadiness.status} (human approval mandatory).`
  );
  if (priorityResult.explanations && priorityResult.explanations.length) {
    parts.push(`Primary reason: ${priorityResult.explanations[0].reason}`);
  }
  parts.push("Engine does not publish, modify, or auto-approve content.");
  return {
    text: parts.join(" "),
    factors: (priorityResult.explanations || []).slice(0, 10)
  };
}

module.exports = {
  buildRecommendation,
  collectKeyFindings,
  collectSuggestedReviewAreas,
  buildDecisionExplanation
};
