"use strict";

/**
 * Phase AI-4 — Draft quality scores with explanations.
 * Scores are 0–100. Overall is a weighted blend of six dimensions.
 */

const {
  QUALITY_DIMENSIONS,
  SCORE_WEIGHTS,
  SEVERITY,
  CONFIDENCE_LEVELS,
  CONFIDENCE_THRESHOLDS
} = require("./types");
const { clamp, round2 } = require("./draftUtils");

/**
 * @param {number} value
 * @returns {number}
 */
function score100(value) {
  return Math.round(clamp(value, 0, 100));
}

/**
 * @param {number} score
 * @returns {string}
 */
function levelFromScore(score) {
  const s = score / 100;
  if (s >= CONFIDENCE_THRESHOLDS.HIGH) return CONFIDENCE_LEVELS.HIGH;
  if (s >= CONFIDENCE_THRESHOLDS.MEDIUM) return CONFIDENCE_LEVELS.MEDIUM;
  if (s >= CONFIDENCE_THRESHOLDS.LOW) return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.VERY_LOW;
}

/**
 * Deduct by severity counts.
 * @param {number} base
 * @param {object[]} items
 * @param {{ critical?: number, high?: number, medium?: number, low?: number }} weights
 * @returns {number}
 */
function deduct(base, items, weights = { critical: 18, high: 10, medium: 5, low: 2 }) {
  let score = base;
  for (const item of items || []) {
    if (item.severity === SEVERITY.CRITICAL) score -= weights.critical;
    else if (item.severity === SEVERITY.HIGH) score -= weights.high;
    else if (item.severity === SEVERITY.MEDIUM) score -= weights.medium;
    else if (item.severity === SEVERITY.LOW) score -= weights.low;
  }
  return score100(score);
}

/**
 * @param {object} parts
 * @returns {object}
 */
function computeQualityScores(parts = {}) {
  const completeness = parts.completeness || { percentage: 0 };
  const validation = parts.validationIssues || { issues: [], counts: {} };
  const missing = parts.missingInformation || { items: [], counts: {} };
  const language = parts.languageQuality || { issues: [] };
  const links = parts.linkValidation || { issues: [], coverage: { percentage: 100 }, broken: [], duplicates: [] };
  const ordering = parts.sectionOrdering || { needsReorder: false, displacements: [] };
  const draft = parts.draft || { sections: [] };

  const completenessScore = score100(completeness.percentage);
  const completenessExplanation = `Completeness is ${completenessScore}/100 because ${completeness.presentCount || 0}/${completeness.expectedCount || 0} expected sections for profile "${draft.profile}" are present and non-empty.`;

  const consistencyScore = deduct(100, validation.issues);
  const consistencyExplanation = `Consistency is ${consistencyScore}/100 from ${validation.issues?.length || 0} cross-section validation issue(s) (${validation.counts?.critical || 0} critical, ${validation.counts?.high || 0} high).`;

  const readabilityScore = deduct(100, language.issues, { critical: 20, high: 12, medium: 7, low: 3 });
  const readabilityExplanation = `Readability is ${readabilityScore}/100 based on ${language.issues?.length || 0} language issue(s) (mixed script, Unicode, OCR, repetition, formatting).`;

  let structureScore = 100;
  structureScore -= (ordering.displacements || []).length * 4;
  if (ordering.needsReorder) structureScore -= 6;
  const emptyKnown = (draft.sections || []).filter((s) => s.isKnown && s.isEmpty).length;
  structureScore -= emptyKnown * 8;
  const unknownHeavy = (draft.unknownSections || []).length;
  if (unknownHeavy > 3) structureScore -= (unknownHeavy - 3) * 3;
  // Prefer sections with tables/lists where vacancy is large
  structureScore = score100(structureScore);
  const structureExplanation = `Structure is ${structureScore}/100 considering section order (${ordering.needsReorder ? "reorder recommended" : "order ok"}), ${emptyKnown} empty known section(s), and ${unknownHeavy} unknown heading(s) preserved.`;

  let linkScore = links.coverage ? links.coverage.percentage : 100;
  linkScore -= (links.broken || []).length * 15;
  linkScore -= (links.duplicates || []).length * 8;
  linkScore = score100(linkScore);
  const linkExplanation = `Link quality is ${linkScore}/100 from expected-link coverage ${links.coverage?.percentage ?? 100}% minus ${links.broken?.length || 0} broken and ${links.duplicates?.length || 0} duplicate link(s).`;

  // Section coverage: expected present vs profile, including empty as partial
  const expectedCount = completeness.expectedCount || 1;
  const presentCount = completeness.presentCount || 0;
  const emptyCount = completeness.emptyCount || 0;
  const coverageRaw = ((presentCount + emptyCount * 0.35) / expectedCount) * 100;
  const sectionCoverageScore = score100(coverageRaw - (missing.counts?.critical || 0) * 4);
  const sectionCoverageExplanation = `Section coverage is ${sectionCoverageScore}/100: ${presentCount} filled, ${emptyCount} empty, ${completeness.missingCount || 0} absent of ${expectedCount} expected; critical missing items reduce the score.`;

  const dimensions = {
    [QUALITY_DIMENSIONS.COMPLETENESS]: {
      score: completenessScore,
      level: levelFromScore(completenessScore),
      weight: SCORE_WEIGHTS[QUALITY_DIMENSIONS.COMPLETENESS],
      explanation: completenessExplanation
    },
    [QUALITY_DIMENSIONS.CONSISTENCY]: {
      score: consistencyScore,
      level: levelFromScore(consistencyScore),
      weight: SCORE_WEIGHTS[QUALITY_DIMENSIONS.CONSISTENCY],
      explanation: consistencyExplanation
    },
    [QUALITY_DIMENSIONS.READABILITY]: {
      score: readabilityScore,
      level: levelFromScore(readabilityScore),
      weight: SCORE_WEIGHTS[QUALITY_DIMENSIONS.READABILITY],
      explanation: readabilityExplanation
    },
    [QUALITY_DIMENSIONS.STRUCTURE]: {
      score: structureScore,
      level: levelFromScore(structureScore),
      weight: SCORE_WEIGHTS[QUALITY_DIMENSIONS.STRUCTURE],
      explanation: structureExplanation
    },
    [QUALITY_DIMENSIONS.LINK_QUALITY]: {
      score: linkScore,
      level: levelFromScore(linkScore),
      weight: SCORE_WEIGHTS[QUALITY_DIMENSIONS.LINK_QUALITY],
      explanation: linkExplanation
    },
    [QUALITY_DIMENSIONS.SECTION_COVERAGE]: {
      score: sectionCoverageScore,
      level: levelFromScore(sectionCoverageScore),
      weight: SCORE_WEIGHTS[QUALITY_DIMENSIONS.SECTION_COVERAGE],
      explanation: sectionCoverageExplanation
    }
  };

  let overall = 0;
  for (const key of Object.keys(SCORE_WEIGHTS)) {
    overall += (dimensions[key]?.score || 0) * SCORE_WEIGHTS[key];
  }
  // Critical missing information should weigh heavily on overall readiness.
  const criticalMissing = missing.counts?.critical || 0;
  const highMissing = missing.counts?.high || 0;
  overall = score100(overall - criticalMissing * 6 - highMissing * 2);

  const overallExplanation = `Overall editorial quality is ${overall}/100 = completeness×${SCORE_WEIGHTS.completeness} + consistency×${SCORE_WEIGHTS.consistency} + readability×${SCORE_WEIGHTS.readability} + structure×${SCORE_WEIGHTS.structure} + linkQuality×${SCORE_WEIGHTS.linkQuality} + sectionCoverage×${SCORE_WEIGHTS.sectionCoverage}.`;

  return {
    completeness: dimensions.completeness,
    consistency: dimensions.consistency,
    readability: dimensions.readability,
    structure: dimensions.structure,
    linkQuality: dimensions.linkQuality,
    sectionCoverage: dimensions.sectionCoverage,
    overall: {
      score: overall,
      level: levelFromScore(overall),
      explanation: overallExplanation
    },
    weights: { ...SCORE_WEIGHTS }
  };
}

/**
 * Engine confidence in its own analysis (not the draft quality).
 * @param {object} parts
 * @returns {object}
 */
function computeAnalysisConfidence(parts = {}) {
  const draft = parts.draft || {};
  let score = 0.72;
  const reasons = [];

  if ((draft.sections || []).length >= 4) {
    score += 0.08;
    reasons.push("sufficient_section_count");
  } else {
    score -= 0.12;
    reasons.push("thin_section_count");
  }

  if (draft.source === "ai1_structured" || draft.source === "ai1_pipeline_result") {
    score += 0.06;
    reasons.push("structured_input");
  }

  if (draft.profile && draft.profile !== "unknown") {
    score += 0.05;
    reasons.push("profile_resolved");
  } else {
    score -= 0.08;
    reasons.push("unknown_profile");
  }

  if (draft.eventType) {
    score += 0.04;
    reasons.push("event_type_context");
  }

  if ((draft.fullText || "").length < 120) {
    score -= 0.15;
    reasons.push("very_short_draft");
  }

  score = round2(clamp(score, 0, 1));
  return {
    score,
    level: score >= CONFIDENCE_THRESHOLDS.HIGH
      ? CONFIDENCE_LEVELS.HIGH
      : score >= CONFIDENCE_THRESHOLDS.MEDIUM
        ? CONFIDENCE_LEVELS.MEDIUM
        : score >= CONFIDENCE_THRESHOLDS.LOW
          ? CONFIDENCE_LEVELS.LOW
          : CONFIDENCE_LEVELS.VERY_LOW,
    reasons
  };
}

module.exports = {
  computeQualityScores,
  computeAnalysisConfidence,
  levelFromScore,
  score100
};
