"use strict";

/**
 * Phase AI-3 — Recommendation engine.
 *
 * An ordered, deterministic rule list. The first rule whose condition holds
 * decides the recommendation; every later rule that would also have fired is
 * reported as an alternative that was considered and rejected.
 *
 * Every rule must be able to explain itself in a sentence a reviewer can act
 * on, which is why `explain` is required alongside `when`.
 */

const { round2 } = require("../noticeIntelligence/textUtils");
const {
  CONFIDENCE_THRESHOLDS,
  MATCH_THRESHOLDS,
  RECOMMENDATIONS,
  RULE_IDS,
  UPDATE_RELATIONSHIPS
} = require("./types");

/**
 * What kind of evidence a rule relies on. Confidence is scored differently for
 * each: a rule that fires *because* nothing matched is well supported by a low
 * match quality, not undermined by it.
 */
const EVIDENCE_DEPENDENCY = Object.freeze({
  MATCH: "match",
  ABSENCE_OF_MATCH: "absence_of_match",
  NEUTRAL: "neutral"
});

/**
 * Indefinite article for a relationship label, so explanations read as English
 * rather than as template output.
 * @param {string} label
 * @returns {string}
 */
function withArticle(label) {
  const text = String(label || "").trim();
  if (!text) return "an update";
  return `${/^[AEIOU]/i.test(text) ? "an" : "a"} ${text}`;
}

/**
 * @param {object|null} best
 * @returns {string}
 */
function describeMatch(best) {
  if (!best) return "no candidate";
  return `recruitment ${best.recruitmentId}${best.record.title ? ` ("${best.record.title}")` : ""} at similarity ${best.score}`;
}

/**
 * @param {object|null} best
 * @returns {string}
 */
function describeCandidate(best) {
  if (!best) return "no candidate";
  return `recruitment ${best.recruitmentId}${best.record.title ? ` ("${best.record.title}")` : ""}`;
}

/**
 * @param {object|null} best
 * @returns {string}
 */
function describeEvidence(best) {
  if (!best) return "no supporting evidence";
  const matched = best.similarity.matchedFactors || [];
  if (!matched.length) return "no factor matched outright";
  return `matching ${matched.join(", ")}`;
}

/**
 * The ordered rule list. Order is the specification: earlier rules are more
 * specific and take precedence.
 */
const RULES = Object.freeze([
  {
    id: RULE_IDS.NON_RECRUITMENT_EVENT,
    recommendation: RECOMMENDATIONS.IGNORE,
    baseConfidence: 0.9,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) => ctx.relationship.relationship === UPDATE_RELATIONSHIPS.NONE,
    explain: (ctx) =>
      `Event type "${ctx.relationship.eventType}" is not part of a recruitment lifecycle, so it should neither create nor update a recruitment.`
  },
  {
    id: RULE_IDS.UNIDENTIFIABLE_EVENT,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.55,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) =>
      !ctx.identity.title && !ctx.identity.advertisementNumber && !ctx.identity.referenceNumber,
    explain: () =>
      "The event carries neither a usable title nor any official identifier, so there is nothing to match on."
  },
  {
    id: RULE_IDS.VERY_LOW_EVENT_CONFIDENCE,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.5,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) =>
      ctx.identity.eventConfidence > 0 &&
      ctx.identity.eventConfidence < CONFIDENCE_THRESHOLDS.LOW &&
      !ctx.identifierMatched,
    explain: (ctx) =>
      `The upstream classification is only ${ctx.identity.eventConfidence} confident and no official identifier corroborates it, so the event should be read by a person before it is filed.`
  },
  {
    id: RULE_IDS.DUPLICATE_OF_RECORDED_DOCUMENT,
    recommendation: RECOMMENDATIONS.POSSIBLE_DUPLICATE,
    baseConfidence: 0.85,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) =>
      Boolean(ctx.duplicate && ctx.duplicate.isDuplicate) &&
      ctx.bestScore >= MATCH_THRESHOLDS.PROBABLE,
    explain: (ctx) =>
      `This looks like a re-publication rather than new information: ${ctx.duplicate.reason} It matches ${describeMatch(ctx.best)}.`
  },
  {
    id: RULE_IDS.AMBIGUOUS_MULTIPLE_STRONG_MATCHES,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.8,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) => ctx.strongMatches.length > 1 && ctx.ranking.isAmbiguous,
    explain: (ctx) =>
      `${ctx.strongMatches.length} recruitments match strongly and are separated by only ${ctx.ranking.separation} (${ctx.strongMatches
        .map((match) => `${match.recruitmentId}@${match.score}`)
        .join(", ")}), so the engine cannot choose between them.`
  },
  {
    id: RULE_IDS.DEPARTMENT_CONFLICT_ON_MATCH,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.7,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) =>
      Boolean(ctx.best) &&
      ctx.bestScore >= MATCH_THRESHOLDS.PROBABLE &&
      ctx.best.similarity.conflicts.department,
    explain: (ctx) =>
      `The event scores ${ctx.bestScore} against ${describeCandidate(ctx.best)}, but the recruiting body disagrees ("${ctx.identity.board || ctx.identity.department}" versus "${ctx.best.record.board || ctx.best.record.department}"), which is too important a conflict to resolve automatically.`
  },
  {
    id: RULE_IDS.NEW_CYCLE_OF_KNOWN_RECRUITMENT,
    recommendation: RECOMMENDATIONS.CREATE_NEW,
    baseConfidence: 0.82,
    dependsOn: EVIDENCE_DEPENDENCY.ABSENCE_OF_MATCH,
    when: (ctx) =>
      Boolean(ctx.best) &&
      ctx.best.similarity.conflicts.year &&
      ctx.best.similarity.title.score >= 0.7 &&
      !ctx.identifierMatched,
    explain: (ctx) =>
      `The event title matches ${describeCandidate(ctx.best)} closely (title similarity ${ctx.best.similarity.title.score}), but the event is for ${ctx.identity.year} while that recruitment is for ${ctx.best.record.year}. A repeated recruitment name in a new year is a new recruitment cycle, not an update to the old one.`
  },
  {
    id: RULE_IDS.IMPLAUSIBLE_LIFECYCLE_ON_MATCH,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.65,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) =>
      ctx.bestScore >= MATCH_THRESHOLDS.STRONG &&
      Boolean(ctx.plausibility) &&
      ctx.plausibility.plausible === false,
    explain: (ctx) =>
      `The event matches ${describeMatch(ctx.best)}, but ${ctx.plausibility.reason.charAt(0).toLowerCase()}${ctx.plausibility.reason.slice(1)} The match is probably right and the recorded stage stale, but that is a judgement call.`
  },
  {
    id: RULE_IDS.STRONG_MATCH_UPDATE,
    recommendation: RECOMMENDATIONS.UPDATE_EXISTING,
    baseConfidence: 0.9,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) => ctx.bestScore >= MATCH_THRESHOLDS.STRONG && ctx.relationship.isUpdate,
    explain: (ctx) =>
      `The notice carries ${withArticle(ctx.relationship.label)} update and matches ${describeMatch(ctx.best)}, ${describeEvidence(ctx.best)}. It belongs to that existing recruitment.`
  },
  {
    id: RULE_IDS.STRONG_MATCH_ANNOUNCEMENT,
    recommendation: RECOMMENDATIONS.MERGE_CANDIDATE,
    baseConfidence: 0.75,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) => ctx.bestScore >= MATCH_THRESHOLDS.STRONG && ctx.relationship.isAnnouncement,
    explain: (ctx) =>
      `This is another announcement document for ${describeMatch(ctx.best)}, ${describeEvidence(ctx.best)}. The recruitment already exists, so the two describe one recruitment and should be merged rather than duplicated.`
  },
  {
    id: RULE_IDS.STRONG_MATCH_UNRESOLVED_RELATIONSHIP,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.6,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) => ctx.bestScore >= MATCH_THRESHOLDS.STRONG && !ctx.relationship.resolved,
    explain: (ctx) =>
      `The event clearly belongs to ${describeMatch(ctx.best)}, but its own purpose could not be classified (event type "${ctx.relationship.eventType}"), so the update to apply is unknown.`
  },
  {
    id: RULE_IDS.PROBABLE_MATCH_WITH_IDENTIFIER,
    recommendation: RECOMMENDATIONS.UPDATE_EXISTING,
    baseConfidence: 0.75,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) =>
      ctx.bestScore >= MATCH_THRESHOLDS.PROBABLE &&
      ctx.identifierMatched &&
      ctx.relationship.isUpdate,
    explain: (ctx) =>
      `Overall similarity is only ${ctx.bestScore}, but the official identifier matches ${describeCandidate(ctx.best)} exactly, and an identifier outranks prose. Treat this ${ctx.relationship.label} notice as an update to that recruitment.`
  },
  {
    id: RULE_IDS.IDENTIFIER_CONFLICT_ON_UPDATE,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.6,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) =>
      ctx.relationship.isUpdate &&
      Boolean(ctx.best) &&
      ctx.best.similarity.conflicts.identifier &&
      ctx.bestScore >= MATCH_THRESHOLDS.WEAK,
    explain: (ctx) =>
      `This ${ctx.relationship.label} notice resembles ${describeMatch(ctx.best)}, but the two carry different official identifiers, so it may belong to a sibling recruitment run by the same body.`
  },
  {
    id: RULE_IDS.PROBABLE_MATCH_WITHOUT_IDENTIFIER,
    recommendation: RECOMMENDATIONS.MERGE_CANDIDATE,
    baseConfidence: 0.65,
    dependsOn: EVIDENCE_DEPENDENCY.MATCH,
    when: (ctx) =>
      ctx.bestScore >= MATCH_THRESHOLDS.PROBABLE &&
      (ctx.relationship.isUpdate || ctx.relationship.isAnnouncement),
    explain: (ctx) =>
      `The event is probably part of ${describeMatch(ctx.best)} — ${describeEvidence(ctx.best)} — but no official identifier confirms it, so the link should be confirmed before the records are consolidated.`
  },
  {
    id: RULE_IDS.ORPHAN_UPDATE_EVENT,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.7,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) =>
      ctx.relationship.requiresExistingRecruitment && ctx.bestScore < MATCH_THRESHOLDS.PROBABLE,
    explain: (ctx) =>
      `${withArticle(ctx.relationship.label)} notice only exists for a recruitment that has already been announced, but the best candidate is ${describeMatch(ctx.best)}. Either the parent recruitment was never captured or this notice belongs to a recruitment outside the supplied metadata.`
  },
  {
    id: RULE_IDS.NO_MATCH_NEW_RECRUITMENT,
    recommendation: RECOMMENDATIONS.CREATE_NEW,
    baseConfidence: 0.88,
    dependsOn: EVIDENCE_DEPENDENCY.ABSENCE_OF_MATCH,
    when: (ctx) => ctx.relationship.isAnnouncement && ctx.bestScore < MATCH_THRESHOLDS.WEAK,
    explain: (ctx) =>
      ctx.best
        ? `The notice announces a recruitment and the closest existing record is only ${describeMatch(ctx.best)}, well below the ${MATCH_THRESHOLDS.WEAK} match floor. This is a new recruitment.`
        : `The notice announces a recruitment and nothing among the ${ctx.search.repositorySize} existing records resembles it. This is a new recruitment.`
  },
  {
    id: RULE_IDS.WEAK_MATCH_NEW_RECRUITMENT,
    recommendation: RECOMMENDATIONS.CREATE_NEW,
    baseConfidence: 0.68,
    dependsOn: EVIDENCE_DEPENDENCY.ABSENCE_OF_MATCH,
    when: (ctx) => ctx.relationship.isAnnouncement && ctx.bestScore < MATCH_THRESHOLDS.PROBABLE,
    explain: (ctx) =>
      `The notice announces a recruitment and the closest existing record, ${describeMatch(ctx.best)}, is only a weak match — ${describeEvidence(ctx.best)}, but the identifying details differ. This is most likely a new recruitment, though the resemblance is worth a glance.`
  },
  {
    id: RULE_IDS.UNRESOLVED_RELATIONSHIP,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.5,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: (ctx) => !ctx.relationship.resolved,
    explain: (ctx) =>
      `The event's purpose could not be classified (event type "${ctx.relationship.eventType}"), so neither a new recruitment nor an update can be proposed.`
  },
  {
    id: RULE_IDS.INSUFFICIENT_EVIDENCE,
    recommendation: RECOMMENDATIONS.HUMAN_REVIEW,
    baseConfidence: 0.45,
    dependsOn: EVIDENCE_DEPENDENCY.NEUTRAL,
    when: () => true,
    explain: (ctx) =>
      `No rule matched decisively. The best candidate is ${describeMatch(ctx.best)} for ${withArticle(ctx.relationship.label)} event, which is not enough to act on.`
  }
]);

/**
 * Build the evaluation context shared by every rule.
 *
 * @param {object} parts
 * @returns {object}
 */
function buildRuleContext(parts = {}) {
  const ranking = parts.ranking || {};
  const best = ranking.best || null;
  return {
    identity: parts.identity || {},
    relationship: parts.relationship || {},
    search: parts.search || {},
    ranking,
    best,
    runnerUp: ranking.runnerUp || null,
    strongMatches: ranking.strongMatches || [],
    bestScore: best ? round2(best.score) : 0,
    bestLevel: best ? best.level : null,
    identifierMatched: Boolean(best && best.similarity.identifierMatched),
    duplicate: parts.duplicate || null,
    plausibility: parts.plausibility || null
  };
}

/**
 * Evaluate the rule list.
 *
 * @param {object} parts
 * @returns {{
 *   recommendation: string,
 *   ruleId: string,
 *   explanation: string,
 *   baseConfidence: number,
 *   rule: object,
 *   alternativesConsidered: Array<object>,
 *   context: object
 * }}
 */
function evaluateRecommendation(parts = {}) {
  const context = buildRuleContext(parts);
  const matches = [];

  for (const rule of RULES) {
    let fired;
    try {
      fired = Boolean(rule.when(context));
    } catch {
      // A rule must never break the pipeline; an unevaluable rule simply does
      // not fire, and the fallback rule guarantees an outcome.
      fired = false;
    }
    if (fired) matches.push(rule);
  }

  const winner = matches[0];
  const alternatives = matches.slice(1, 4).map((rule) => ({
    ruleId: rule.id,
    recommendation: rule.recommendation,
    reason: rule.explain(context)
  }));

  return {
    recommendation: winner.recommendation,
    ruleId: winner.id,
    explanation: winner.explain(context),
    baseConfidence: winner.baseConfidence,
    dependsOn: winner.dependsOn,
    rule: {
      id: winner.id,
      baseConfidence: winner.baseConfidence,
      dependsOn: winner.dependsOn
    },
    alternativesConsidered: alternatives,
    context
  };
}

module.exports = {
  RULES,
  EVIDENCE_DEPENDENCY,
  withArticle,
  describeMatch,
  describeCandidate,
  describeEvidence,
  buildRuleContext,
  evaluateRecommendation
};
