"use strict";

/**
 * Phase 29 — read-only decision assistant for admin review UI.
 * Derives recommendations ONLY from existing matcher output.
 * No AI, ML, probabilistic models, network, DB, or automatic decisions.
 */

const RECOMMENDED_DECISIONS = Object.freeze({
  LIKELY_MATCH: "Likely Match",
  POSSIBLE_MATCH: "Possible Match",
  NEEDS_MANUAL_REVIEW: "Needs Manual Review",
  LIKELY_DIFFERENT: "Likely Different Recruitment"
});

/**
 * @typedef {Object} ReviewMatchResultLike
 * @property {boolean|string} [match]
 * @property {string} [confidence]
 * @property {string[]} [matchedSignals]
 * @property {string[]} [conflictingSignals]
 */

/**
 * @typedef {Object} DecisionRecommendation
 * @property {string} decision
 * @property {string} rationale
 * @property {boolean} readOnly
 * @property {boolean} automaticDecisionApplied
 */

function asSignalArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/**
 * Deterministic recommendation from matcher output only.
 * Never mutates stored review data or applies a decision.
 *
 * @param {ReviewMatchResultLike|null|undefined} matchResult
 * @returns {DecisionRecommendation}
 */
function recommendDecisionFromMatchResult(matchResult) {
  const base = {
    readOnly: true,
    automaticDecisionApplied: false
  };

  if (!matchResult || typeof matchResult !== "object" || Array.isArray(matchResult)) {
    return {
      ...base,
      decision: RECOMMENDED_DECISIONS.NEEDS_MANUAL_REVIEW,
      rationale: "No matcher output available."
    };
  }

  const match = matchResult.match;
  const confidence = String(matchResult.confidence || "").toLowerCase();
  const conflictingSignals = asSignalArray(matchResult.conflictingSignals);
  const matchedSignals = asSignalArray(matchResult.matchedSignals);

  if (match === false || conflictingSignals.length > 0) {
    return {
      ...base,
      decision: RECOMMENDED_DECISIONS.LIKELY_DIFFERENT,
      rationale:
        conflictingSignals.length > 0
          ? `Conflicting signals: ${conflictingSignals.join(", ")}.`
          : "Matcher reported no match."
    };
  }

  if (match === true && confidence === "high") {
    return {
      ...base,
      decision: RECOMMENDED_DECISIONS.LIKELY_MATCH,
      rationale:
        matchedSignals.length > 0
          ? `High-confidence match on: ${matchedSignals.join(", ")}.`
          : "Matcher reported a high-confidence match."
    };
  }

  if (match === true && confidence === "medium") {
    return {
      ...base,
      decision: RECOMMENDED_DECISIONS.POSSIBLE_MATCH,
      rationale:
        matchedSignals.length > 0
          ? `Medium-confidence match on: ${matchedSignals.join(", ")}.`
          : "Matcher reported a medium-confidence match."
    };
  }

  return {
    ...base,
    decision: RECOMMENDED_DECISIONS.NEEDS_MANUAL_REVIEW,
    rationale:
      match === "unknown" || confidence === "none" || confidence === "low" || confidence === ""
        ? "Matcher confidence is insufficient for a suggested match."
        : "Matcher output requires manual review."
  };
}

module.exports = {
  RECOMMENDED_DECISIONS,
  recommendDecisionFromMatchResult
};
