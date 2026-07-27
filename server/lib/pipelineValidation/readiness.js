"use strict";

/**
 * Phase AI-5 — Operational readiness evaluation.
 */

const { deepFreeze, round2 } = require("../noticeIntelligence/textUtils");
const {
  HEALTH_LEVELS,
  READINESS_VERDICTS,
  STAGE_RESULT
} = require("./types");

/**
 * Evaluate readiness from scenario + failure suite results and compatibility.
 * @param {{
 *   scenarioSuite?: object,
 *   failureSuite?: object,
 *   compatibility?: object,
 *   performance?: object
 * }} input
 * @returns {object}
 */
function evaluateOperationalReadiness(input = {}) {
  const scenarioSummary =
    (input.scenarioSuite && input.scenarioSuite.summary) || null;
  const failureSignals =
    (input.failureSuite && input.failureSuite.failureSignals) || [];
  const compatibility = input.compatibility || null;

  const dimensions = {
    reliability: scoreReliability(scenarioSummary),
    stability: scoreStability(scenarioSummary, failureSignals),
    backwardCompatibility: scoreCompatibility(compatibility),
    failureIsolation: scoreFailureIsolation(failureSignals),
    manualReviewReadiness: scoreManualReview(scenarioSummary, failureSignals),
    recoveryBehavior: scoreRecovery(failureSignals)
  };

  const scores = Object.values(dimensions).map((d) => d.score);
  const overall = round2(scores.reduce((a, b) => a + b, 0) / scores.length);

  let health = HEALTH_LEVELS.UNKNOWN;
  if (overall >= 0.85) health = HEALTH_LEVELS.HEALTHY;
  else if (overall >= 0.65) health = HEALTH_LEVELS.DEGRADED;
  else health = HEALTH_LEVELS.CRITICAL;

  let verdict = READINESS_VERDICTS.ADVISORY_ONLY;
  const compatOk = !compatibility || compatibility.allPassed;
  if (!compatOk || health === HEALTH_LEVELS.CRITICAL) {
    verdict = READINESS_VERDICTS.NOT_READY;
  } else if (health === HEALTH_LEVELS.HEALTHY) {
    verdict = READINESS_VERDICTS.READY;
  } else {
    verdict = READINESS_VERDICTS.READY_WITH_CAVEATS;
  }

  return deepFreeze({
    advisoryOnly: true,
    appliesChanges: false,
    health,
    verdict,
    overallScore: overall,
    dimensions,
    caveats: collectCaveats(dimensions, failureSignals, compatibility),
    productionBehaviorUnchanged: compatOk,
    autoPublishRemainsFalse: compatOk,
    schedulerInactive: compatOk,
    publishingDenied: true
  });
}

function scoreReliability(summary) {
  if (!summary) {
    return { score: 0.5, level: "unknown", note: "No scenario summary" };
  }
  const score = summary.successRate;
  return {
    score,
    level: band(score),
    note: `${summary.pass + summary.warn}/${summary.total} scenarios completed without hard fail`
  };
}

function scoreStability(summary, failureSignals) {
  if (!summary) {
    return { score: 0.5, level: "unknown", note: "No scenario summary" };
  }
  const errorRate = summary.total
    ? summary.error / summary.total
    : 0;
  const crashFreeFailures = failureSignals.filter((f) => {
    // A failure sim that threw stage errors is instability
    return true;
  });
  const score = round2(Math.max(0, 1 - errorRate * 2));
  return {
    score,
    level: band(score),
    note: `Scenario error rate ${(errorRate * 100).toFixed(1)}%; ${crashFreeFailures.length} failure sims exercised`
  };
}

function scoreCompatibility(compatibility) {
  if (!compatibility) {
    return { score: 0.5, level: "unknown", note: "Compatibility not checked" };
  }
  const score = compatibility.allPassed ? 1 : 0;
  return {
    score,
    level: band(score),
    note: compatibility.allPassed
      ? "All backward-compatibility checks passed"
      : `Failed: ${(compatibility.failed || []).join(", ")}`
  };
}

function scoreFailureIsolation(failureSignals) {
  if (!failureSignals.length) {
    return { score: 0.5, level: "unknown", note: "No failure simulations" };
  }
  // Isolation is good when warnings/fails stay localized (not all stages error)
  let isolated = 0;
  for (const signal of failureSignals) {
    const warnStages = signal.warnStages || [];
    if (warnStages.length > 0 && warnStages.length < 9) isolated += 1;
    else if (signal.warningCodes && signal.warningCodes.length) isolated += 1;
  }
  const score = round2(isolated / failureSignals.length);
  return {
    score,
    level: band(score),
    note: `${isolated}/${failureSignals.length} failure cases produced localized stage warnings`
  };
}

function scoreManualReview(summary, failureSignals) {
  const reviewSignals = failureSignals.filter((f) =>
    (f.warningCodes || []).some((c) =>
      /MANUAL_REVIEW|AMBIGUOUS|LOW_|UNKNOWN_|DUPLICATE|MISSING_|CONFLICT/i.test(c)
    )
  );
  const base = summary ? Math.min(1, summary.successRate + 0.1) : 0.7;
  const reviewReady =
    failureSignals.length === 0
      ? base
      : round2(
          0.55 * base +
            0.45 * (reviewSignals.length / Math.max(1, failureSignals.length))
        );
  return {
    score: Math.min(1, reviewReady),
    level: band(reviewReady),
    note: `${reviewSignals.length} failure cases surface review-relevant warning codes`
  };
}

function scoreRecovery(failureSignals) {
  if (!failureSignals.length) {
    return { score: 0.7, level: "medium", note: "No failure suite; assumed recoverable" };
  }
  // Recovery = pipeline continues (pipelineOk or partial) rather than hard erroring everywhere
  const recoverable = failureSignals.filter(
    (f) => f.pipelineOk || (f.warnStages && f.warnStages.length > 0)
  ).length;
  const score = round2(recoverable / failureSignals.length);
  return {
    score,
    level: band(score),
    note: `${recoverable}/${failureSignals.length} failure cases continued with diagnostics instead of silent abort`
  };
}

function band(score) {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  if (score >= 0.4) return "low";
  return "critical";
}

function collectCaveats(dimensions, failureSignals, compatibility) {
  const caveats = [];
  for (const [name, dim] of Object.entries(dimensions)) {
    if (dim.score < 0.75) {
      caveats.push(`${name}: ${dim.note}`);
    }
  }
  if (compatibility && !compatibility.allPassed) {
    caveats.push(`compatibility failures: ${(compatibility.failed || []).join(", ")}`);
  }
  const lowConf = failureSignals.filter((f) =>
    (f.warningCodes || []).includes("LOW_CLASSIFICATION_CONFIDENCE")
  );
  if (lowConf.length) {
    caveats.push("Low-confidence classifications require mandatory human review");
  }
  return caveats;
}

/**
 * Stage-level health rollup across many runs.
 * @param {object[]} runs
 * @returns {object}
 */
function buildPipelineHealth(runs = []) {
  const byStage = Object.create(null);
  for (const run of runs) {
    for (const stage of run.stages || []) {
      if (!byStage[stage.stageId]) {
        byStage[stage.stageId] = {
          stageId: stage.stageId,
          stageLabel: stage.stageLabel,
          pass: 0,
          warn: 0,
          fail: 0,
          error: 0,
          total: 0,
          totalDurationMs: 0
        };
      }
      const bucket = byStage[stage.stageId];
      bucket.total += 1;
      bucket.totalDurationMs += stage.durationMs || 0;
      if (stage.executionResult === STAGE_RESULT.PASS) bucket.pass += 1;
      else if (stage.executionResult === STAGE_RESULT.WARN) bucket.warn += 1;
      else if (stage.executionResult === STAGE_RESULT.FAIL) bucket.fail += 1;
      else if (stage.executionResult === STAGE_RESULT.ERROR) bucket.error += 1;
    }
  }

  const stages = Object.values(byStage).map((b) => ({
    ...b,
    successRate: b.total ? round2((b.pass + b.warn) / b.total) : 0,
    avgDurationMs: b.total ? round2(b.totalDurationMs / b.total) : 0
  }));

  return deepFreeze({ stages });
}

module.exports = {
  evaluateOperationalReadiness,
  buildPipelineHealth
};
