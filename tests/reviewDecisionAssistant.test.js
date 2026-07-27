"use strict";

const {
  RECOMMENDED_DECISIONS,
  recommendDecisionFromMatchResult
} = require("../server/lib/recruitment/reviewDecisionAssistant");

describe("reviewDecisionAssistant", () => {
  test("recommends Likely Match for high-confidence true match", () => {
    const result = recommendDecisionFromMatchResult({
      match: true,
      confidence: "high",
      matchedSignals: ["ORGANIZATION", "EXAM", "YEAR"],
      conflictingSignals: []
    });

    expect(result.decision).toBe(RECOMMENDED_DECISIONS.LIKELY_MATCH);
    expect(result.readOnly).toBe(true);
    expect(result.automaticDecisionApplied).toBe(false);
    expect(result.rationale).toMatch(/ORGANIZATION/);
  });

  test("recommends Possible Match for medium-confidence true match", () => {
    const result = recommendDecisionFromMatchResult({
      match: true,
      confidence: "medium",
      matchedSignals: ["ORGANIZATION", "POST"],
      conflictingSignals: []
    });

    expect(result.decision).toBe(RECOMMENDED_DECISIONS.POSSIBLE_MATCH);
    expect(result.automaticDecisionApplied).toBe(false);
  });

  test("recommends Likely Different when match is false", () => {
    const result = recommendDecisionFromMatchResult({
      match: false,
      confidence: "high",
      matchedSignals: [],
      conflictingSignals: ["YEAR"]
    });

    expect(result.decision).toBe(RECOMMENDED_DECISIONS.LIKELY_DIFFERENT);
    expect(result.rationale).toMatch(/YEAR/);
  });

  test("recommends Likely Different when conflicting signals exist", () => {
    const result = recommendDecisionFromMatchResult({
      match: true,
      confidence: "high",
      matchedSignals: ["ORGANIZATION"],
      conflictingSignals: ["ADVERTISEMENT_NUMBER"]
    });

    expect(result.decision).toBe(RECOMMENDED_DECISIONS.LIKELY_DIFFERENT);
  });

  test("recommends Needs Manual Review for unknown / none / low / missing", () => {
    expect(
      recommendDecisionFromMatchResult({
        match: "unknown",
        confidence: "none",
        matchedSignals: [],
        conflictingSignals: []
      }).decision
    ).toBe(RECOMMENDED_DECISIONS.NEEDS_MANUAL_REVIEW);

    expect(
      recommendDecisionFromMatchResult({
        match: true,
        confidence: "low",
        matchedSignals: ["ORGANIZATION"],
        conflictingSignals: []
      }).decision
    ).toBe(RECOMMENDED_DECISIONS.NEEDS_MANUAL_REVIEW);

    expect(recommendDecisionFromMatchResult(null).decision).toBe(
      RECOMMENDED_DECISIONS.NEEDS_MANUAL_REVIEW
    );
  });

  test("never claims an automatic decision was applied", () => {
    const samples = [
      { match: true, confidence: "high", matchedSignals: [], conflictingSignals: [] },
      { match: false, confidence: "high", matchedSignals: [], conflictingSignals: ["POST"] },
      { match: "unknown", confidence: "none", matchedSignals: [], conflictingSignals: [] }
    ];

    for (const sample of samples) {
      const result = recommendDecisionFromMatchResult(sample);
      expect(result.automaticDecisionApplied).toBe(false);
      expect(result.readOnly).toBe(true);
    }
  });
});
