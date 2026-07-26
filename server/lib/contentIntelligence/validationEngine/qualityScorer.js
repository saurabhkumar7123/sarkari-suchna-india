"use strict";

/**
 * CIP Stage 1E — deterministic quality scoring + readiness reports.
 * Documented scoring rules only. No AI. No randomness.
 */

const {
  SEVERITIES,
  VALIDATION_CATEGORIES,
  PUBLISH_READINESS_STATES,
  GENERATOR_COMPATIBILITY_STATES
} = require("./validationTypes");
const {
  SCORE_DEDUCTIONS,
  CATEGORY_SCORE_WEIGHTS,
  PUBLISH_THRESHOLDS
} = require("./validationRules");

function clampScore(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function scoreFromFindings(findings) {
  let score = 100;
  for (const finding of findings) {
    if (finding.severity === SEVERITIES.ERROR) score -= SCORE_DEDUCTIONS.error;
    else if (finding.severity === SEVERITIES.WARNING) score -= SCORE_DEDUCTIONS.warning;
    else if (finding.severity === SEVERITIES.INFO) score -= SCORE_DEDUCTIONS.info;
  }
  return clampScore(score);
}

function filterByCategories(findings, categories) {
  const set = new Set(categories);
  return findings.filter((f) => set.has(f.category));
}

/**
 * @param {Array<object>} findings
 * @returns {{ scores: object, generatorCompatibility: object, publishReadiness: object }}
 */
function computeQualityReports(findings) {
  const all = findings || [];

  const metadataFindings = filterByCategories(all, [
    VALIDATION_CATEGORIES.METADATA,
    VALIDATION_CATEGORIES.COMPLETENESS,
    VALIDATION_CATEGORIES.CONSISTENCY
  ]).filter(
    (f) =>
      f.category === VALIDATION_CATEGORIES.METADATA ||
      (f.category === VALIDATION_CATEGORIES.COMPLETENESS && String(f.code || "").startsWith("META_")) ||
      (f.category === VALIDATION_CATEGORIES.CONSISTENCY && String(f.code || "").startsWith("META_"))
  );

  // Broader metadata bucket: any META_* code
  const metadataAll = all.filter((f) => String(f.code || "").startsWith("META_"));
  const sectionAll = all.filter(
    (f) =>
      String(f.code || "").startsWith("SEC_") ||
      f.category === VALIDATION_CATEGORIES.SECTION ||
      f.category === VALIDATION_CATEGORIES.ORDERING
  );
  const blockAll = all.filter(
    (f) => String(f.code || "").startsWith("BLK_") || f.category === VALIDATION_CATEGORIES.BLOCK
  );
  const generatorAll = all.filter(
    (f) =>
      f.category === VALIDATION_CATEGORIES.GENERATOR ||
      String(f.code || "").includes("GENERATOR") ||
      f.code === "BLK_RICH_TEXT" ||
      f.code === "BLK_MIXED_CONTENT" ||
      f.code === "BLK_BROKEN_LINK" ||
      f.code === "BLK_INVALID_FAQ" ||
      f.code === "BLK_INVALID_TABLE" ||
      f.code === "SEC_GENERATOR_TITLE" ||
      f.code === "SEC_GENERATOR_TITLE_MISSING"
  );
  const completenessAll = all.filter(
    (f) =>
      f.category === VALIDATION_CATEGORIES.COMPLETENESS ||
      f.code === "SEC_REQUIRED_MISSING" ||
      f.code === "META_REQUIRED_MISSING" ||
      f.code === "DOC_NO_SECTIONS" ||
      f.code === "SEC_EMPTY"
  );

  // Prefer code-prefix filters; fall back if empty sets would under-count
  const metadataScore = scoreFromFindings(metadataAll.length ? metadataAll : metadataFindings);
  const sectionScore = scoreFromFindings(sectionAll);
  const blockScore = scoreFromFindings(blockAll);
  const generatorScore = scoreFromFindings(generatorAll);
  const completenessScore = scoreFromFindings(completenessAll);

  const overall = clampScore(
    metadataScore * CATEGORY_SCORE_WEIGHTS.metadata +
      sectionScore * CATEGORY_SCORE_WEIGHTS.section +
      blockScore * CATEGORY_SCORE_WEIGHTS.block +
      generatorScore * CATEGORY_SCORE_WEIGHTS.generatorCompatibility +
      completenessScore * CATEGORY_SCORE_WEIGHTS.completeness
  );

  const errorCount = all.filter((f) => f.severity === SEVERITIES.ERROR).length;
  const warningCount = all.filter((f) => f.severity === SEVERITIES.WARNING).length;

  let generatorState = GENERATOR_COMPATIBILITY_STATES.COMPATIBLE;
  if (generatorScore < 50 || errorCount > 0 && generatorAll.some((f) => f.severity === SEVERITIES.ERROR)) {
    generatorState = GENERATOR_COMPATIBILITY_STATES.INCOMPATIBLE;
  } else if (generatorScore < PUBLISH_THRESHOLDS.readyMinGenerator || warningCount > 0) {
    // Only downgrade to partial when generator-related issues exist
    if (generatorAll.some((f) => f.severity === SEVERITIES.ERROR || f.severity === SEVERITIES.WARNING)) {
      generatorState = GENERATOR_COMPATIBILITY_STATES.PARTIAL;
    } else if (generatorScore < 90) {
      generatorState = GENERATOR_COMPATIBILITY_STATES.PARTIAL;
    }
  }

  let publishState = PUBLISH_READINESS_STATES.BLOCKED;
  if (
    errorCount <= PUBLISH_THRESHOLDS.maxErrorsForReady &&
    overall >= PUBLISH_THRESHOLDS.readyMinOverall &&
    generatorScore >= PUBLISH_THRESHOLDS.readyMinGenerator &&
    generatorState !== GENERATOR_COMPATIBILITY_STATES.INCOMPATIBLE
  ) {
    publishState = PUBLISH_READINESS_STATES.READY;
  } else if (
    errorCount <= PUBLISH_THRESHOLDS.maxErrorsForNeedsReview &&
    overall >= PUBLISH_THRESHOLDS.needsReviewMinOverall
  ) {
    publishState = PUBLISH_READINESS_STATES.NEEDS_REVIEW;
  }

  const publishScore = clampScore(
    overall * 0.6 +
      generatorScore * 0.25 +
      (errorCount === 0 ? 15 : Math.max(0, 15 - errorCount * 5))
  );

  const scores = {
    overall,
    metadata: metadataScore,
    section: sectionScore,
    block: blockScore,
    generatorCompatibility: generatorScore,
    publishReadiness: publishScore
  };

  const generatorCompatibility = {
    state: generatorState,
    score: generatorScore,
    issueCount: generatorAll.length,
    blockingIssueCount: generatorAll.filter((f) => f.severity === SEVERITIES.ERROR).length,
    compatible: generatorState === GENERATOR_COMPATIBILITY_STATES.COMPATIBLE
  };

  const publishReadiness = {
    state: publishState,
    score: publishScore,
    ready: publishState === PUBLISH_READINESS_STATES.READY,
    errorCount,
    warningCount,
    thresholds: {
      readyMinOverall: PUBLISH_THRESHOLDS.readyMinOverall,
      readyMinGenerator: PUBLISH_THRESHOLDS.readyMinGenerator,
      needsReviewMinOverall: PUBLISH_THRESHOLDS.needsReviewMinOverall
    }
  };

  return { scores, generatorCompatibility, publishReadiness };
}

/**
 * Suggest review areas from findings (deterministic, unique, ordered).
 * @param {Array<object>} findings
 * @returns {string[]}
 */
function suggestReviewAreas(findings) {
  const areas = [];
  const seen = Object.create(null);

  const push = (area) => {
    if (!seen[area]) {
      seen[area] = true;
      areas.push(area);
    }
  };

  for (const finding of findings || []) {
    if (finding.severity === SEVERITIES.INFO) continue;
    switch (finding.category) {
      case VALIDATION_CATEGORIES.DOCUMENT:
        push("Document classification");
        break;
      case VALIDATION_CATEGORIES.METADATA:
        push("Metadata completeness");
        break;
      case VALIDATION_CATEGORIES.SECTION:
        push("Section structure");
        break;
      case VALIDATION_CATEGORIES.BLOCK:
        push("Block content quality");
        break;
      case VALIDATION_CATEGORIES.ORDERING:
        push("Section / block ordering");
        break;
      case VALIDATION_CATEGORIES.GENERATOR:
        push("Generator compatibility");
        break;
      case VALIDATION_CATEGORIES.COMPLETENESS:
        push("Content completeness");
        break;
      case VALIDATION_CATEGORIES.CONSISTENCY:
        push("Cross-field consistency");
        break;
      default:
        push("General review");
    }
  }

  return areas;
}

module.exports = {
  computeQualityReports,
  suggestReviewAreas,
  scoreFromFindings,
  clampScore
};
