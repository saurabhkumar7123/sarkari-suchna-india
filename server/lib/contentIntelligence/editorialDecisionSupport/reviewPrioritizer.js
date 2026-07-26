"use strict";

/**
 * CIP Stage 2E — Deterministic review priority rules.
 */

const {
  REVIEW_PRIORITIES,
  PRIORITY_RANK,
  EDITORIAL_RISK_LEVELS,
  RISK_RANK,
  PUBLISH_READINESS_STATES,
  explanation
} = require("./decisionTypes");

const URGENT_CODES = new Set([
  "policy.dates_changed",
  "policy.numbers_changed",
  "policy.urls_changed",
  "policy.organization_changed",
  "schema.invalid_root",
  "schema.version_incompatible"
]);

const HIGH_CODES = new Set([
  "policy.section_removed",
  "policy.content_deleted",
  "policy.content_changed",
  "policy.metadata_removed",
  "generator.required_section_missing",
  "generator.required_metadata_missing",
  "generator.invalid_grammar",
  "generator.section_markers_missing",
  "editorial.required_section_missing"
]);

function maxPriority(a, b) {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

function determineReviewPriority(analysis, changeSummary) {
  let priority = REVIEW_PRIORITIES.LOW;
  const explanations = [];
  const findings = (analysis && analysis.allFindings) || [];
  const risk = (analysis && analysis.editorialRisk && analysis.editorialRisk.overall) || "LOW";
  const readiness =
    (analysis && analysis.publishReadiness && analysis.publishReadiness.status) ||
    PUBLISH_READINESS_STATES.READY;
  const quality =
    analysis && analysis.qualityScores && analysis.qualityScores.overall != null
      ? analysis.qualityScores.overall
      : 100;
  const compatStatus =
    (analysis && analysis.generatorCompatibility && analysis.generatorCompatibility.status) ||
    "compatible";

  findings.forEach((item) => {
    if (URGENT_CODES.has(item.code) || risk === EDITORIAL_RISK_LEVELS.CRITICAL) {
      priority = maxPriority(priority, REVIEW_PRIORITIES.URGENT);
      explanations.push(
        explanation(
          "Critical policy or schema finding requires urgent human review.",
          item.code,
          item.severity || "error",
          item.sectionType || item.path || null
        )
      );
    } else if (HIGH_CODES.has(item.code) || item.severity === "error") {
      priority = maxPriority(priority, REVIEW_PRIORITIES.HIGH);
      explanations.push(
        explanation(
          "High-severity finding elevates review priority.",
          item.code,
          item.severity || "error",
          item.sectionType || item.path || null
        )
      );
    } else if (item.severity === "warning") {
      priority = maxPriority(priority, REVIEW_PRIORITIES.NORMAL);
      explanations.push(
        explanation(
          "Warning finding requires standard editorial attention.",
          item.code,
          "warning",
          item.sectionType || item.path || null
        )
      );
    }
  });

  if (risk === EDITORIAL_RISK_LEVELS.CRITICAL) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.URGENT);
    explanations.push(
      explanation(
        "Overall editorial risk is CRITICAL.",
        `editorialRisk=${risk}`,
        "error",
        null
      )
    );
  } else if (RISK_RANK[risk] >= RISK_RANK[EDITORIAL_RISK_LEVELS.HIGH]) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.HIGH);
    explanations.push(
      explanation("Overall editorial risk is HIGH.", `editorialRisk=${risk}`, "error", null)
    );
  } else if (risk === EDITORIAL_RISK_LEVELS.MEDIUM) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.NORMAL);
    explanations.push(
      explanation(
        "Overall editorial risk is MEDIUM.",
        `editorialRisk=${risk}`,
        "warning",
        null
      )
    );
  }

  if (compatStatus === "incompatible") {
    priority = maxPriority(priority, REVIEW_PRIORITIES.HIGH);
    explanations.push(
      explanation(
        "Generator compatibility is incompatible.",
        `generatorCompatibility=${compatStatus}`,
        "error",
        null
      )
    );
  } else if (compatStatus === "partial") {
    priority = maxPriority(priority, REVIEW_PRIORITIES.NORMAL);
    explanations.push(
      explanation(
        "Generator compatibility is partial.",
        `generatorCompatibility=${compatStatus}`,
        "warning",
        null
      )
    );
  }

  if (readiness === PUBLISH_READINESS_STATES.BLOCKED) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.URGENT);
    explanations.push(
      explanation(
        "Publish readiness is blocked; human review is urgent.",
        `publishReadiness=${readiness}`,
        "error",
        null
      )
    );
  } else if (readiness === PUBLISH_READINESS_STATES.NEEDS_REVIEW) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.NORMAL);
    explanations.push(
      explanation(
        "Publish readiness requires review.",
        `publishReadiness=${readiness}`,
        "warning",
        null
      )
    );
  }

  if (quality < 45) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.URGENT);
    explanations.push(
      explanation("Quality score is critically low.", `qualityScore=${quality}`, "error", null)
    );
  } else if (quality < 75) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.HIGH);
    explanations.push(
      explanation("Quality score is below ready threshold.", `qualityScore=${quality}`, "warning", null)
    );
  }

  if (
    changeSummary &&
    (changeSummary.policyViolations.length ||
      changeSummary.importantMetadataChanges.length ||
      changeSummary.sectionRemovals.length)
  ) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.HIGH);
    explanations.push(
      explanation(
        "Change summary includes policy, metadata, or section removal issues.",
        "changeSummary.material",
        "error",
        null
      )
    );
  } else if (
    changeSummary &&
    (changeSummary.unknownSections.length || changeSummary.unknownBlocks.length)
  ) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.NORMAL);
    explanations.push(
      explanation(
        "Unknown sections or blocks require editor verification.",
        "changeSummary.unknown",
        "warning",
        null
      )
    );
  }

  if (
    analysis &&
    analysis.metadataCompleteness &&
    !analysis.metadataCompleteness.complete
  ) {
    priority = maxPriority(priority, REVIEW_PRIORITIES.HIGH);
    explanations.push(
      explanation(
        "Required metadata is incomplete.",
        `missing=${(analysis.metadataCompleteness.missingFields || []).join(",")}`,
        "warning",
        null
      )
    );
  }

  // Deduplicate explanations by supportingFinding+reason
  const seen = new Set();
  const uniqueExplanations = [];
  explanations.forEach((item) => {
    const key = `${item.reason}|${item.supportingFinding}|${item.affectedSection}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueExplanations.push(item);
  });

  return {
    priority,
    explanations: uniqueExplanations,
    rulesApplied: [
      "URGENT_CODES",
      "HIGH_CODES",
      "editorialRisk",
      "generatorCompatibility",
      "publishReadiness",
      "qualityScore",
      "changeSummary",
      "metadataCompleteness"
    ]
  };
}

module.exports = { determineReviewPriority, URGENT_CODES, HIGH_CODES };
