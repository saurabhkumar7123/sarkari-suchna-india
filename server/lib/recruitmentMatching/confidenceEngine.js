"use strict";

/**
 * Phase AI-3 — Confidence engine.
 *
 * Produces three separate confidence scores — how sure the engine is that it
 * looked at the right candidates, how good the winning match is, and how sure
 * it is of the recommendation itself. Each score carries the reasons that moved
 * it, in the same shape Phase AI-2 uses.
 */

const { clamp, round2 } = require("../noticeIntelligence/textUtils");
const {
  CONFIDENCE_LEVELS,
  CONFIDENCE_THRESHOLDS,
  FACTOR_STATUS,
  MATCH_QUALITY,
  REASON_CODES,
  SIMILARITY_FACTORS
} = require("./types");

/** Candidates beyond this count make the selection noticeably less certain. */
const CROWDED_CANDIDATE_COUNT = 6;
/** Score gap that counts as a clear winner. */
const CLEAR_SEPARATION = 0.15;

/**
 * Weights that combine the three scores into one overall number.
 *
 * `evidenceAlignment` rather than raw match quality, because a weak match is
 * strong evidence *for* a CREATE_NEW recommendation and weak evidence for an
 * UPDATE_EXISTING one. Which way round it counts is decided by the rule that
 * fired (see `EVIDENCE_DEPENDENCY` in the recommendation engine).
 */
const OVERALL_WEIGHTS = Object.freeze({
  candidateSelection: 0.25,
  evidenceAlignment: 0.25,
  recommendation: 0.5
});

/** Evidence alignment used when a rule depends on neither presence nor absence. */
const NEUTRAL_ALIGNMENT = 0.5;

/**
 * @param {number} score
 * @returns {string}
 */
function scoreToLevel(score) {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return CONFIDENCE_LEVELS.HIGH;
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return CONFIDENCE_LEVELS.MEDIUM;
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.VERY_LOW;
}

/**
 * @param {string} dimension
 * @param {number} [start]
 * @returns {object}
 */
function createScorer(dimension, start = 0) {
  const reasons = [];
  let score = start;
  return {
    add(delta, code, detail) {
      score += delta;
      reasons.push({ code, impact: round2(delta), detail });
      return this;
    },
    build() {
      const finalScore = round2(clamp(score, 0, 1));
      return {
        dimension,
        score: finalScore,
        level: scoreToLevel(finalScore),
        reasons
      };
    }
  };
}

/**
 * How confident the engine is that the right recruitment candidates were found
 * and that the winner is distinguishable from the rest.
 *
 * @param {object} search output of `searchCandidates`
 * @param {object} ranking output of `rankCandidates`
 * @returns {object}
 */
function scoreCandidateSelection(search = {}, ranking = {}) {
  const scorer = createScorer("candidateSelection");
  const count = (ranking.ranked || []).length;

  if (search.isEmptyRepository) {
    scorer.add(
      0,
      REASON_CODES.EMPTY_REPOSITORY,
      "No existing recruitment metadata was supplied, so nothing could be matched."
    );
    return scorer.build();
  }
  if (!count) {
    scorer.add(
      0.1,
      REASON_CODES.NO_CANDIDATES,
      `Searched ${search.repositorySize} recruitments and found no candidate worth scoring.`
    );
    return scorer.build();
  }

  if (search.identifierBlocked) {
    scorer.add(
      0.5,
      REASON_CODES.IDENTIFIER_BLOCKED,
      "Candidates were found by official identifier, the strongest available key."
    );
  }
  const strategies = search.strategiesUsed || [];
  if (strategies.includes("board_and_year")) {
    scorer.add(
      0.25,
      REASON_CODES.BOARD_AND_YEAR_BLOCKED,
      "Candidates were found by recruiting body and cycle year."
    );
  }
  if (strategies.includes("title_tokens")) {
    scorer.add(
      0.2,
      REASON_CODES.TITLE_TOKEN_BLOCKED,
      "Candidates were found by shared recruitment vocabulary."
    );
  }
  if (strategies.includes("keywords")) {
    scorer.add(0.1, REASON_CODES.KEYWORD_BLOCKED, "Candidates were found by shared keywords.");
  }

  if (count === 1) {
    scorer.add(0.12, REASON_CODES.SINGLE_CANDIDATE, "Exactly one candidate was found.");
  } else if (count >= CROWDED_CANDIDATE_COUNT) {
    scorer.add(
      -0.15,
      REASON_CODES.MANY_CANDIDATES,
      `${count} candidates were in scope, so selection is less certain.`
    );
  }

  if (ranking.separation !== null && ranking.separation !== undefined) {
    if (ranking.isAmbiguous) {
      scorer.add(
        -0.25,
        REASON_CODES.TIGHT_SEPARATION,
        `Top two candidates are separated by only ${ranking.separation}.`
      );
    } else if (ranking.separation >= CLEAR_SEPARATION) {
      scorer.add(
        0.12,
        REASON_CODES.CLEAR_SEPARATION,
        `The winning candidate leads the runner-up by ${ranking.separation}.`
      );
    }
  }

  return scorer.build();
}

/**
 * How good the winning match is, judged on the evidence behind it rather than
 * on the similarity number alone.
 *
 * @param {object|null} best ranked candidate
 * @param {object|null} plausibility lifecycle plausibility for the best match
 * @returns {object}
 */
function scoreMatchQuality(best = null, plausibility = null) {
  const scorer = createScorer("matchQuality");
  if (!best) {
    scorer.add(0, REASON_CODES.NO_CANDIDATES, "There is no match to assess.");
    return scorer.build();
  }

  const similarity = best.similarity || {};
  scorer.add(
    round2(similarity.score * 0.7),
    REASON_CODES.MATCH_SIMILARITY,
    `Weighted similarity is ${similarity.score} (${similarity.level}).`
  );

  const factors = similarity.factors || [];
  const factorOf = (name) => factors.find((factor) => factor.factor === name) || {};
  const advertisement = factorOf(SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER);
  const reference = factorOf(SIMILARITY_FACTORS.REFERENCE_NUMBER);
  const title = factorOf(SIMILARITY_FACTORS.TITLE);

  if (advertisement.status === FACTOR_STATUS.MATCH) {
    scorer.add(
      0.15,
      REASON_CODES.EXACT_ADVERTISEMENT_NUMBER,
      `Advertisement number "${advertisement.detail && advertisement.detail.eventValue}" matches exactly.`
    );
  }
  if (reference.status === FACTOR_STATUS.MATCH) {
    scorer.add(
      0.1,
      REASON_CODES.EXACT_REFERENCE_NUMBER,
      `Reference number "${reference.detail && reference.detail.eventValue}" matches exactly.`
    );
  }
  if (title.status === FACTOR_STATUS.MATCH) {
    scorer.add(0.08, REASON_CODES.TITLE_STRONG, `Title similarity is ${title.score}.`);
  } else if (title.comparable && title.score < 0.3) {
    scorer.add(-0.08, REASON_CODES.TITLE_WEAK, `Title similarity is only ${title.score}.`);
  }

  if (!similarity.identifierComparable) {
    scorer.add(
      -0.12,
      REASON_CODES.NO_IDENTIFIER,
      "The match rests on prose and metadata because no identifier was comparable."
    );
  }
  const conflicts = similarity.conflicts || {};
  if (conflicts.identifier) {
    scorer.add(
      -0.15,
      REASON_CODES.IDENTIFIER_CONFLICT,
      "The two sides carry different official identifiers."
    );
  }
  if (conflicts.year) {
    scorer.add(-0.1, REASON_CODES.YEAR_MISMATCH, "Recruitment years do not agree.");
  }
  if (conflicts.department) {
    scorer.add(
      -0.15,
      REASON_CODES.DEPARTMENT_CONFLICT,
      "The recruiting body or department does not agree."
    );
  }

  if (plausibility) {
    if (plausibility.plausible && plausibility.level === "plausible") {
      scorer.add(0.05, REASON_CODES.LIFECYCLE_PLAUSIBLE, plausibility.reason);
    } else if (!plausibility.plausible) {
      scorer.add(-0.12, REASON_CODES.LIFECYCLE_IMPLAUSIBLE, plausibility.reason);
    }
  }

  return scorer.build();
}

/**
 * How confident the engine is in the recommendation it produced.
 *
 * @param {{
 *   rule: object,
 *   candidateSelection: object,
 *   matchQuality: object,
 *   identity: object,
 *   validationFlags: string[]
 * }} input
 * @returns {object}
 */
function scoreRecommendation(input = {}) {
  const rule = input.rule || {};
  const candidateSelection = input.candidateSelection || { score: 0 };
  const matchQuality = input.matchQuality || { score: 0 };
  const identity = input.identity || {};
  const flags = input.validationFlags || [];

  const scorer = createScorer("recommendation");
  const base = Number(rule.baseConfidence) || 0.5;
  scorer.add(
    round2(base * 0.5),
    REASON_CODES.RULE_BASE_CONFIDENCE,
    `Rule ${rule.id} carries a base confidence of ${base}.`
  );

  const alignment = evidenceAlignment(rule.dependsOn, matchQuality.score);
  scorer.add(
    round2(alignment * 0.3),
    REASON_CODES.MATCH_QUALITY_SUPPORT,
    rule.dependsOn === "absence_of_match"
      ? `The recommendation rests on the absence of a match, and match quality is only ${matchQuality.score}, which supports it.`
      : rule.dependsOn === "match"
        ? `The recommendation rests on the match, whose quality confidence is ${matchQuality.score}.`
        : `The recommendation does not depend on match strength, so evidence alignment is neutral.`
  );
  scorer.add(
    round2(candidateSelection.score * 0.2),
    REASON_CODES.CANDIDATE_SELECTION_SUPPORT,
    `Candidate selection confidence is ${candidateSelection.score}.`
  );

  const eventConfidence = Number(identity.eventConfidence) || 0;
  if (eventConfidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    scorer.add(
      0.05,
      REASON_CODES.EVENT_CONFIDENCE_HIGH,
      `The upstream normalized event is itself confident (${eventConfidence}).`
    );
  } else if (eventConfidence && eventConfidence < CONFIDENCE_THRESHOLDS.LOW) {
    scorer.add(
      -0.12,
      REASON_CODES.EVENT_CONFIDENCE_LOW,
      `The upstream normalized event has low confidence (${eventConfidence}).`
    );
  }

  if (flags.length) {
    scorer.add(
      round2(-0.04 * Math.min(flags.length, 3)),
      REASON_CODES.VALIDATION_FLAGS,
      `${flags.length} validation flag(s) raised: ${flags.slice(0, 3).join(", ")}.`
    );
  }

  return scorer.build();
}

/**
 * How well the match evidence supports the recommendation that was made.
 *
 * @param {string} dependsOn rule evidence dependency
 * @param {number} matchQualityScore
 * @returns {number} 0–1
 */
function evidenceAlignment(dependsOn, matchQualityScore) {
  const score = clamp(Number(matchQualityScore) || 0);
  if (dependsOn === "match") return score;
  if (dependsOn === "absence_of_match") return round2(1 - score);
  return NEUTRAL_ALIGNMENT;
}

/**
 * Assemble the full confidence report.
 *
 * @param {{
 *   candidateSelection: object,
 *   matchQuality: object,
 *   recommendation: object,
 *   dependsOn?: string
 * }} parts
 * @returns {object} confidence report
 */
function buildConfidenceReport(parts = {}) {
  const candidateSelection = parts.candidateSelection;
  const matchQuality = parts.matchQuality;
  const recommendation = parts.recommendation;
  const alignment = evidenceAlignment(parts.dependsOn, matchQuality.score);

  const overallScore = round2(
    clamp(
      candidateSelection.score * OVERALL_WEIGHTS.candidateSelection +
        alignment * OVERALL_WEIGHTS.evidenceAlignment +
        recommendation.score * OVERALL_WEIGHTS.recommendation
    )
  );

  return {
    candidateSelection,
    matchQuality,
    recommendation,
    evidenceAlignment: alignment,
    evidenceDependency: parts.dependsOn || "neutral",
    overallScore,
    overallLevel: scoreToLevel(overallScore),
    weights: OVERALL_WEIGHTS
  };
}

/**
 * Map a similarity level onto the shared confidence vocabulary, so a reviewer
 * reading "STRONG" and "HIGH" knows they mean the same tier.
 * @param {string} matchLevel
 * @returns {string}
 */
function matchLevelToConfidenceLevel(matchLevel) {
  if (matchLevel === MATCH_QUALITY.STRONG) return CONFIDENCE_LEVELS.HIGH;
  if (matchLevel === MATCH_QUALITY.PROBABLE) return CONFIDENCE_LEVELS.MEDIUM;
  if (matchLevel === MATCH_QUALITY.WEAK) return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.VERY_LOW;
}

module.exports = {
  CROWDED_CANDIDATE_COUNT,
  CLEAR_SEPARATION,
  OVERALL_WEIGHTS,
  NEUTRAL_ALIGNMENT,
  evidenceAlignment,
  scoreToLevel,
  createScorer,
  scoreCandidateSelection,
  scoreMatchQuality,
  scoreRecommendation,
  buildConfidenceReport,
  matchLevelToConfidenceLevel
};
