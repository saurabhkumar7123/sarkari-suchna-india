"use strict";

/**
 * CIP Stage 3E — deterministic quality scoring + readiness assessment.
 */

const {
  SEVERITIES,
  QUALITY_LEVELS,
  READINESS_STATES,
  SCORE_KEYS
} = require("./extractionQualityTypes");
const {
  SCORE_DEDUCTIONS,
  SCORE_WEIGHTS,
  LEVEL_THRESHOLDS,
  READINESS_THRESHOLDS,
  SCORE_CATEGORY_MAP
} = require("./extractionQualityRules");
const { clampScore, uniqueOrdered } = require("./extractionQualityUtils");

function scoreFromFindings(findings) {
  let score = 100;
  for (const finding of findings || []) {
    if (finding.severity === SEVERITIES.ERROR) score -= SCORE_DEDUCTIONS.error;
    else if (finding.severity === SEVERITIES.WARNING) score -= SCORE_DEDUCTIONS.warning;
    else if (finding.severity === SEVERITIES.INFO) score -= SCORE_DEDUCTIONS.info;
  }
  return clampScore(score);
}

function filterByCategories(findings, categories) {
  const set = new Set(categories);
  return (findings || []).filter((finding) => set.has(finding.category));
}

function levelForScore(score, hasBlocking) {
  if (hasBlocking && score < LEVEL_THRESHOLDS.FAIR) return QUALITY_LEVELS.BLOCKED;
  if (score >= LEVEL_THRESHOLDS.EXCELLENT) return QUALITY_LEVELS.EXCELLENT;
  if (score >= LEVEL_THRESHOLDS.GOOD) return QUALITY_LEVELS.GOOD;
  if (score >= LEVEL_THRESHOLDS.FAIR) return QUALITY_LEVELS.FAIR;
  if (score >= LEVEL_THRESHOLDS.POOR) return QUALITY_LEVELS.POOR;
  return hasBlocking ? QUALITY_LEVELS.BLOCKED : QUALITY_LEVELS.POOR;
}

function scored(score, hasBlocking) {
  return {
    score: clampScore(score),
    level: levelForScore(score, hasBlocking)
  };
}

/**
 * @param {object[]} findings
 * @param {{ hasCorrelation?: boolean }} [options]
 */
function computeQualityScores(findings, options = {}) {
  const all = findings || [];
  const hasBlocking = all.some((finding) => finding.severity === SEVERITIES.ERROR);

  const metadataFindings = filterByCategories(all, SCORE_CATEGORY_MAP.metadataQuality);
  const structureFindings = filterByCategories(all, SCORE_CATEGORY_MAP.structureQuality);
  const extractionFindings = filterByCategories(all, [
    ...SCORE_CATEGORY_MAP.extractionQuality,
    ...SCORE_CATEGORY_MAP.generatorCompatibility
  ]);
  const correlationFindings = filterByCategories(all, SCORE_CATEGORY_MAP.correlationQuality);

  const metadataQuality = scoreFromFindings(metadataFindings);
  const structureQuality = scoreFromFindings(structureFindings);
  const extractionQuality = scoreFromFindings(extractionFindings);

  // When no correlation input is present, treat correlation quality as neutral 100
  // so single-document assessments are not unfairly penalized.
  const correlationQuality = options.hasCorrelation
    ? scoreFromFindings(correlationFindings)
    : correlationFindings.length
      ? scoreFromFindings(correlationFindings)
      : 100;

  const readinessSignal = hasBlocking
    ? Math.min(metadataQuality, structureQuality, extractionQuality, 40)
    : clampScore((metadataQuality + structureQuality + extractionQuality) / 3);

  const overallQuality = clampScore(
    metadataQuality * SCORE_WEIGHTS.metadataQuality +
      structureQuality * SCORE_WEIGHTS.structureQuality +
      extractionQuality * SCORE_WEIGHTS.extractionQuality +
      correlationQuality * SCORE_WEIGHTS.correlationQuality +
      readinessSignal * SCORE_WEIGHTS.readinessSignal
  );

  const overallReadinessScore = clampScore(
    overallQuality * 0.7 +
      (hasBlocking ? 0 : 20) +
      (all.filter((f) => f.severity === SEVERITIES.WARNING).length === 0 ? 10 : 0)
  );

  const scores = {
    metadataQuality: scored(metadataQuality, hasBlocking && metadataFindings.some((f) => f.severity === SEVERITIES.ERROR)),
    structureQuality: scored(structureQuality, hasBlocking && structureFindings.some((f) => f.severity === SEVERITIES.ERROR)),
    extractionQuality: scored(extractionQuality, hasBlocking && extractionFindings.some((f) => f.severity === SEVERITIES.ERROR)),
    correlationQuality: scored(
      correlationQuality,
      options.hasCorrelation && correlationFindings.some((f) => f.severity === SEVERITIES.ERROR)
    ),
    overallQuality: scored(overallQuality, hasBlocking),
    overallReadiness: scored(overallReadinessScore, hasBlocking)
  };

  // Ensure stable key order for determinism/fingerprint.
  const ordered = {};
  for (const key of SCORE_KEYS) ordered[key] = scores[key];
  return ordered;
}

/**
 * Advisory readiness only — never publishes or authorizes.
 * @param {object[]} findings
 * @param {object} scores
 */
function assessReadiness(findings, scores) {
  const all = findings || [];
  const blockingIssues = all.filter((finding) => finding.severity === SEVERITIES.ERROR);
  const warnings = all.filter((finding) => finding.severity === SEVERITIES.WARNING);
  const overall = scores.overallQuality ? scores.overallQuality.score : 0;
  const reasons = [];

  let state = READINESS_STATES.BLOCKED;

  if (blockingIssues.length > READINESS_THRESHOLDS.maxBlockingForReadyWithWarnings) {
    state = READINESS_STATES.BLOCKED;
    reasons.push(`${blockingIssues.length} blocking validation issue(s).`);
  } else if (
    overall >= READINESS_THRESHOLDS.readyMinOverall &&
    blockingIssues.length <= READINESS_THRESHOLDS.maxBlockingForReady
  ) {
    if (warnings.length === 0) {
      state = READINESS_STATES.READY;
      reasons.push("Overall quality meets ready threshold with no warnings.");
    } else {
      state = READINESS_STATES.READY_WITH_WARNINGS;
      reasons.push("Overall quality meets ready threshold but warnings remain.");
    }
  } else if (overall >= READINESS_THRESHOLDS.readyWithWarningsMinOverall) {
    state = warnings.length || overall < READINESS_THRESHOLDS.readyMinOverall
      ? READINESS_STATES.READY_WITH_WARNINGS
      : READINESS_STATES.READY;
    if (state === READINESS_STATES.READY_WITH_WARNINGS) {
      reasons.push("Overall quality is acceptable with advisory warnings.");
    }
  } else if (overall >= READINESS_THRESHOLDS.needsReviewMinOverall) {
    state = READINESS_STATES.NEEDS_REVIEW;
    reasons.push("Overall quality requires human review before downstream use.");
  } else {
    state = READINESS_STATES.BLOCKED;
    reasons.push("Overall quality is below the minimum review threshold.");
  }

  // High unknown-section pressure can force review even without hard errors.
  const unknownRatioFinding = all.find((finding) => finding.rule === "SEC_UNKNOWN_RATIO_HIGH");
  if (
    unknownRatioFinding &&
    unknownRatioFinding.severity === SEVERITIES.ERROR &&
    state !== READINESS_STATES.BLOCKED
  ) {
    state = READINESS_STATES.BLOCKED;
    reasons.push("Unknown section ratio exceeds blocking threshold.");
  } else if (
    unknownRatioFinding &&
    state === READINESS_STATES.READY
  ) {
    state = READINESS_STATES.READY_WITH_WARNINGS;
    reasons.push("Unknown section ratio requires caution.");
  }

  return {
    state,
    advisory: true,
    ready: state === READINESS_STATES.READY || state === READINESS_STATES.READY_WITH_WARNINGS,
    blockingIssueCount: blockingIssues.length,
    warningCount: warnings.length,
    overallQualityScore: overall,
    reasons: uniqueOrdered(reasons),
    thresholds: {
      readyMinOverall: READINESS_THRESHOLDS.readyMinOverall,
      readyWithWarningsMinOverall: READINESS_THRESHOLDS.readyWithWarningsMinOverall,
      needsReviewMinOverall: READINESS_THRESHOLDS.needsReviewMinOverall
    }
  };
}

function suggestManualChecks(findings, readiness) {
  const checks = [];
  const push = (text) => {
    if (!checks.includes(text)) checks.push(text);
  };

  for (const finding of findings || []) {
    switch (finding.category) {
      case "metadata":
        push("Verify title, source URL, and organization metadata against the official document.");
        break;
      case "structure":
      case "section":
        push("Confirm section headings and empty sections against the source layout.");
        break;
      case "hierarchy":
        push("Review heading hierarchy for skipped or broken levels.");
        break;
      case "reading_order":
        push("Spot-check reading order of extracted blocks against the source.");
        break;
      case "table":
        push("Validate table row/column integrity against the source table.");
        break;
      case "link":
        push("Manually verify important official links (engine performs structure-only checks).");
        break;
      case "resource":
        push("Confirm PDF/download inventory completeness.");
        break;
      case "correlation":
      case "relationship":
      case "timeline":
        push("Review multi-document correlation identity, timeline, and relationships.");
        break;
      case "generator":
        push("Check whether known recruitment sections map cleanly for downstream drafting.");
        break;
      case "consistency":
        push("Reconcile cross-field and cross-document consistency issues.");
        break;
      default:
        push("Perform a general extraction quality review.");
    }
  }

  if (readiness && readiness.state === READINESS_STATES.BLOCKED) {
    push("Resolve blocking issues before sending this extraction downstream.");
  } else if (readiness && readiness.state === READINESS_STATES.NEEDS_REVIEW) {
    push("Route to editorial review before Generator / publishing workflows.");
  }

  return checks;
}

function selectKeyFindings(findings, limit = 8) {
  const rank = { error: 0, warning: 1, info: 2 };
  return (findings || [])
    .slice()
    .sort((a, b) => {
      const ra = rank[a.severity] != null ? rank[a.severity] : 9;
      const rb = rank[b.severity] != null ? rank[b.severity] : 9;
      if (ra !== rb) return ra - rb;
      return String(a.rule).localeCompare(String(b.rule));
    })
    .slice(0, limit);
}

function buildSummary({ inputKind, documents, scores, readiness, findings }) {
  const docCount = documents.length;
  const overall = scores.overallQuality.score;
  const level = scores.overallQuality.level;
  const errorCount = findings.filter((f) => f.severity === SEVERITIES.ERROR).length;
  const warningCount = findings.filter((f) => f.severity === SEVERITIES.WARNING).length;
  return [
    `Assessed ${docCount} document(s) as ${inputKind}.`,
    `Overall quality ${overall}/100 (${level}).`,
    `Readiness ${readiness.state} (advisory).`,
    `${errorCount} blocking issue(s), ${warningCount} warning(s).`
  ].join(" ");
}

module.exports = {
  computeQualityScores,
  assessReadiness,
  suggestManualChecks,
  selectKeyFindings,
  buildSummary,
  scoreFromFindings,
  levelForScore
};
