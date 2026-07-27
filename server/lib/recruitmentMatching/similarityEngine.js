"use strict";

/**
 * Phase AI-3 — Similarity engine.
 *
 * Scores an event against one recruitment on weighted factors and returns a
 * normalized 0.00–1.00 similarity. Every factor reports its own status and
 * contribution, and every post-hoc adjustment is named, so a score can always
 * be read back as a sentence rather than trusted as a number.
 */

const { clamp, round2 } = require("../noticeIntelligence/textUtils");
const {
  compareIdentifiers,
  compareOrganizations,
  keywordSimilarity,
  titleSimilarity
} = require("./matchingUtils");
const {
  ADJUSTMENT_VALUES,
  AMBIGUITY_MARGIN,
  COVERAGE_FLOOR,
  FACTOR_STATUS,
  FACTOR_WEIGHTS,
  IDENTIFIER_CONFLICT_CEILING,
  MATCH_QUALITY,
  MATCH_THRESHOLDS,
  RECRUITMENT_CATEGORIES,
  SIMILARITY_ADJUSTMENTS,
  SIMILARITY_FACTORS
} = require("./types");

/** Score awarded to a factor that matched only partially. */
const PARTIAL_SCORE = 0.6;
/** Score awarded to an adjacent-year match (a cycle that spans new year). */
const ADJACENT_YEAR_SCORE = 0.35;
/** Title similarity at or above which the titles are considered the same. */
const TITLE_MATCH_FLOOR = 0.75;
const TITLE_PARTIAL_FLOOR = 0.4;

/**
 * @param {string} factor
 * @param {string} status
 * @param {number} score
 * @param {object} [detail]
 * @returns {object}
 */
function buildFactor(factor, status, score, detail = {}) {
  const weight = FACTOR_WEIGHTS[factor] || 0;
  const comparable = status !== FACTOR_STATUS.NOT_COMPARABLE;
  return {
    factor,
    weight,
    status,
    score: comparable ? round2(clamp(score)) : 0,
    contribution: comparable ? round2(weight * clamp(score)) : 0,
    comparable,
    detail
  };
}

/**
 * Compare an official identifier, also checking the record's alternate
 * identifier list so a corrigendum quoting the notification number still ties
 * back to the advertisement.
 *
 * @param {string} factor
 * @param {string|null} eventValue
 * @param {string|null} eventKey
 * @param {string|null} recordValue
 * @param {object} record
 * @param {{ otherIdentifierMatched?: boolean }} [options]
 * @returns {object}
 */
function scoreIdentifierFactor(factor, eventValue, eventKey, recordValue, record, options = {}) {
  const direct = compareIdentifiers(eventValue, recordValue);
  if (direct.status === FACTOR_STATUS.MATCH) {
    return buildFactor(factor, FACTOR_STATUS.MATCH, 1, {
      eventValue,
      recordValue,
      matchedOn: "direct"
    });
  }

  // The number may be recorded against the recruitment under another label.
  if (eventKey && (record.identifierKeys || []).includes(eventKey)) {
    return buildFactor(factor, FACTOR_STATUS.MATCH, 1, {
      eventValue,
      recordValue,
      matchedOn: "official_identifier_list"
    });
  }

  if (direct.status === FACTOR_STATUS.PARTIAL) {
    return buildFactor(factor, FACTOR_STATUS.PARTIAL, PARTIAL_SCORE, {
      eventValue,
      recordValue,
      matchedOn: "prefix"
    });
  }
  if (direct.status === FACTOR_STATUS.MISMATCH) {
    return buildFactor(factor, FACTOR_STATUS.MISMATCH, 0, {
      eventValue,
      recordValue,
      strictConflict: true
    });
  }

  // The fields do not line up, but the recruitment does have identifiers on
  // file and none of them is the one this notice quotes. That is disagreement,
  // not missing data — unless the other identifier field already matched, in
  // which case the notice simply quotes one number and not the other.
  if (eventKey && !options.otherIdentifierMatched && (record.identifierKeys || []).length) {
    return buildFactor(factor, FACTOR_STATUS.MISMATCH, 0, {
      eventValue,
      recordValue: recordValue || null,
      recordedIdentifiers: record.identifierKeys,
      reason: "not_among_recorded_identifiers",
      crossFieldMismatch: true
    });
  }

  return buildFactor(factor, FACTOR_STATUS.NOT_COMPARABLE, 0, {
    eventValue: eventValue || null,
    recordValue: recordValue || null,
    reason: eventValue ? "missing_on_recruitment" : "missing_on_event"
  });
}

/**
 * @param {object} organizationResult
 * @param {string} factor
 * @param {object} detail
 * @returns {object}
 */
function scoreOrganizationFactor(organizationResult, factor, detail) {
  if (organizationResult.status === FACTOR_STATUS.MATCH) {
    return buildFactor(factor, FACTOR_STATUS.MATCH, 1, detail);
  }
  if (organizationResult.status === FACTOR_STATUS.PARTIAL) {
    return buildFactor(factor, FACTOR_STATUS.PARTIAL, PARTIAL_SCORE, detail);
  }
  if (organizationResult.status === FACTOR_STATUS.MISMATCH) {
    return buildFactor(factor, FACTOR_STATUS.MISMATCH, 0, detail);
  }
  return buildFactor(factor, FACTOR_STATUS.NOT_COMPARABLE, 0, detail);
}

/**
 * @param {number|null} eventYear
 * @param {number|null} recordYear
 * @returns {object}
 */
function scoreYearFactor(eventYear, recordYear) {
  const detail = { eventYear: eventYear || null, recordYear: recordYear || null };
  if (!eventYear || !recordYear) {
    return buildFactor(SIMILARITY_FACTORS.YEAR, FACTOR_STATUS.NOT_COMPARABLE, 0, detail);
  }
  if (eventYear === recordYear) {
    return buildFactor(SIMILARITY_FACTORS.YEAR, FACTOR_STATUS.MATCH, 1, detail);
  }
  if (Math.abs(eventYear - recordYear) === 1) {
    // A cycle advertised late in one year runs into the next, so adjacent years
    // earn partial credit — but they still count as a mismatch for the rules.
    return buildFactor(SIMILARITY_FACTORS.YEAR, FACTOR_STATUS.PARTIAL, ADJACENT_YEAR_SCORE, {
      ...detail,
      reason: "adjacent_cycle_year"
    });
  }
  return buildFactor(SIMILARITY_FACTORS.YEAR, FACTOR_STATUS.MISMATCH, 0, detail);
}

/**
 * @param {string} eventCategory
 * @param {string} recordCategory
 * @returns {object}
 */
function scoreCategoryFactor(eventCategory, recordCategory) {
  const detail = { eventCategory, recordCategory };
  const unknown = [RECRUITMENT_CATEGORIES.UNKNOWN, undefined, null];
  if (unknown.includes(eventCategory) || unknown.includes(recordCategory)) {
    return buildFactor(SIMILARITY_FACTORS.CATEGORY, FACTOR_STATUS.NOT_COMPARABLE, 0, detail);
  }
  return eventCategory === recordCategory
    ? buildFactor(SIMILARITY_FACTORS.CATEGORY, FACTOR_STATUS.MATCH, 1, detail)
    : buildFactor(SIMILARITY_FACTORS.CATEGORY, FACTOR_STATUS.MISMATCH, 0, detail);
}

/**
 * @param {number} score
 * @returns {string}
 */
function toMatchQuality(score) {
  if (score >= MATCH_THRESHOLDS.STRONG) return MATCH_QUALITY.STRONG;
  if (score >= MATCH_THRESHOLDS.PROBABLE) return MATCH_QUALITY.PROBABLE;
  if (score >= MATCH_THRESHOLDS.WEAK) return MATCH_QUALITY.WEAK;
  return MATCH_QUALITY.NONE;
}

/**
 * Score one event/recruitment pair.
 *
 * @param {object} identity output of `buildEventIdentity`
 * @param {object} record normalized recruitment record
 * @returns {{
 *   score: number,
 *   level: string,
 *   rawScore: number,
 *   factors: Array<object>,
 *   adjustments: Array<object>,
 *   comparableWeight: number,
 *   coverage: number,
 *   matchedFactors: string[],
 *   mismatchedFactors: string[],
 *   conflicts: object,
 *   title: object,
 *   keywords: object
 * }}
 */
function scoreSimilarity(identity = {}, record = {}) {
  const advertisement = scoreIdentifierFactor(
    SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER,
    identity.advertisementNumber,
    identity.advertisementKey,
    record.advertisementNumber,
    record
  );
  const reference = scoreIdentifierFactor(
    SIMILARITY_FACTORS.REFERENCE_NUMBER,
    identity.referenceNumber,
    identity.referenceKey,
    record.referenceNumber,
    record,
    { otherIdentifierMatched: advertisement.status === FACTOR_STATUS.MATCH }
  );

  const boardResult = compareOrganizations(
    { code: identity.boardCode, name: identity.board },
    { code: record.boardCode, name: record.board }
  );
  const board = scoreOrganizationFactor(boardResult, SIMILARITY_FACTORS.BOARD, {
    eventBoard: identity.board,
    recordBoard: record.board,
    matchedOn: boardResult.matchedOn
  });

  const departmentResult = compareOrganizations(
    { name: identity.department },
    { name: record.department }
  );
  const department = scoreOrganizationFactor(departmentResult, SIMILARITY_FACTORS.DEPARTMENT, {
    eventDepartment: identity.department,
    recordDepartment: record.department,
    matchedOn: departmentResult.matchedOn
  });

  const titleResult = titleSimilarity(identity.title, record.title);
  const titleStatus = !titleResult.comparable
    ? FACTOR_STATUS.NOT_COMPARABLE
    : titleResult.score >= TITLE_MATCH_FLOOR
      ? FACTOR_STATUS.MATCH
      : titleResult.score >= TITLE_PARTIAL_FLOOR
        ? FACTOR_STATUS.PARTIAL
        : FACTOR_STATUS.MISMATCH;
  const title = buildFactor(SIMILARITY_FACTORS.TITLE, titleStatus, titleResult.score, {
    eventTitle: identity.title,
    recordTitle: record.title,
    sharedTokens: titleResult.sharedTokens,
    sharedDistinctiveTokens: titleResult.sharedDistinctiveTokens,
    jaccard: titleResult.jaccard,
    containment: titleResult.containment
  });

  const year = scoreYearFactor(identity.year, record.year);

  const keywordResult = keywordSimilarity(identity.keywords, record.keywords);
  const keywordStatus = !keywordResult.comparable
    ? FACTOR_STATUS.NOT_COMPARABLE
    : keywordResult.score >= 0.6
      ? FACTOR_STATUS.MATCH
      : keywordResult.score > 0
        ? FACTOR_STATUS.PARTIAL
        : FACTOR_STATUS.MISMATCH;
  const keywords = buildFactor(SIMILARITY_FACTORS.KEYWORDS, keywordStatus, keywordResult.score, {
    shared: keywordResult.shared
  });

  const category = scoreCategoryFactor(identity.category, record.category);

  const factors = [advertisement, reference, board, department, title, year, keywords, category];
  const comparable = factors.filter((factor) => factor.comparable);
  const comparableWeight = comparable.reduce((sum, factor) => sum + factor.weight, 0);
  const totalWeight = Object.values(FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const contribution = comparable.reduce((sum, factor) => sum + factor.contribution, 0);
  const rawScore = comparableWeight ? round2(contribution / comparableWeight) : 0;
  const coverage = round2(comparableWeight / totalWeight);

  // A strict conflict means two identifiers of the same kind disagree, which is
  // decisive. Quoting a number the recruitment has never recorded is weaker
  // evidence, so it lowers the score without capping it.
  const identifierFactors = [advertisement, reference];
  const identifierConflict = identifierFactors.some(
    (factor) => factor.status === FACTOR_STATUS.MISMATCH && factor.detail.strictConflict
  );
  const identifierUnrecorded = identifierFactors.some(
    (factor) => factor.status === FACTOR_STATUS.MISMATCH && factor.detail.crossFieldMismatch
  );
  const identifierMatched =
    advertisement.status === FACTOR_STATUS.MATCH || reference.status === FACTOR_STATUS.MATCH;
  const identifierComparable = advertisement.comparable || reference.comparable;
  const yearMismatch = year.comparable && year.status !== FACTOR_STATUS.MATCH;
  const departmentConflict =
    board.status === FACTOR_STATUS.MISMATCH || department.status === FACTOR_STATUS.MISMATCH;

  const adjustments = [];
  if (!identifierComparable) {
    adjustments.push({
      code: SIMILARITY_ADJUSTMENTS.NO_IDENTIFIER_COMPARABLE,
      impact: ADJUSTMENT_VALUES.NO_IDENTIFIER_COMPARABLE,
      detail: "Neither side carries a comparable advertisement or reference number."
    });
  } else if (
    !identifierMatched &&
    (advertisement.status === FACTOR_STATUS.PARTIAL || reference.status === FACTOR_STATUS.PARTIAL)
  ) {
    adjustments.push({
      code: SIMILARITY_ADJUSTMENTS.IDENTIFIER_PARTIAL,
      impact: ADJUSTMENT_VALUES.IDENTIFIER_PARTIAL,
      detail: "Identifiers agree only on a prefix."
    });
  }
  if (coverage < COVERAGE_FLOOR) {
    adjustments.push({
      code: SIMILARITY_ADJUSTMENTS.LOW_FACTOR_COVERAGE,
      impact: ADJUSTMENT_VALUES.LOW_FACTOR_COVERAGE,
      detail: `Only ${Math.round(coverage * 100)}% of the factor weight could be compared.`
    });
  }
  if (yearMismatch) {
    adjustments.push({
      code: SIMILARITY_ADJUSTMENTS.YEAR_MISMATCH,
      impact: ADJUSTMENT_VALUES.YEAR_MISMATCH,
      detail: `Event year ${identity.year} does not equal recruitment year ${record.year}.`
    });
  }

  let score = clamp(rawScore + adjustments.reduce((sum, item) => sum + item.impact, 0));
  if (identifierConflict && score > IDENTIFIER_CONFLICT_CEILING) {
    adjustments.push({
      code: SIMILARITY_ADJUSTMENTS.IDENTIFIER_CONFLICT_CAP,
      impact: round2(IDENTIFIER_CONFLICT_CEILING - score),
      detail: `Conflicting official identifiers cap similarity at ${IDENTIFIER_CONFLICT_CEILING}.`
    });
    score = IDENTIFIER_CONFLICT_CEILING;
  }
  score = round2(score);

  return {
    score,
    level: toMatchQuality(score),
    rawScore,
    factors,
    adjustments,
    comparableWeight: round2(comparableWeight),
    coverage,
    matchedFactors: factors
      .filter((factor) => factor.status === FACTOR_STATUS.MATCH)
      .map((factor) => factor.factor),
    mismatchedFactors: factors
      .filter((factor) => factor.status === FACTOR_STATUS.MISMATCH)
      .map((factor) => factor.factor),
    conflicts: {
      identifier: identifierConflict,
      identifierUnrecorded,
      department: departmentConflict,
      year: yearMismatch
    },
    identifierMatched,
    identifierComparable,
    title: titleResult,
    keywords: keywordResult
  };
}

/**
 * Score and rank every candidate, then describe how separated the top two are.
 *
 * @param {object} identity
 * @param {Array<{ record: object, strategies: string[], strategyDetails: Array<object> }>} candidates
 * @returns {{
 *   ranked: Array<object>,
 *   best: object|null,
 *   runnerUp: object|null,
 *   separation: number|null,
 *   isAmbiguous: boolean,
 *   strongMatches: Array<object>
 * }}
 */
function rankCandidates(identity = {}, candidates = []) {
  const ranked = (candidates || [])
    .map((candidate) => {
      const similarity = scoreSimilarity(identity, candidate.record);
      return {
        recruitmentId: candidate.record.recruitmentId,
        record: candidate.record,
        strategies: candidate.strategies || [],
        strategyDetails: candidate.strategyDetails || [],
        similarity,
        score: similarity.score,
        level: similarity.level
      };
    })
    .sort(
      (a, b) => b.score - a.score || a.recruitmentId.localeCompare(b.recruitmentId)
    );

  const best = ranked[0] || null;
  const runnerUp = ranked[1] || null;
  const separation = best && runnerUp ? round2(best.score - runnerUp.score) : null;
  const strongMatches = ranked.filter((entry) => entry.level === MATCH_QUALITY.STRONG);

  return {
    ranked,
    best,
    runnerUp,
    separation,
    isAmbiguous: Boolean(
      runnerUp && separation !== null && separation < AMBIGUITY_MARGIN && runnerUp.score >= MATCH_THRESHOLDS.WEAK
    ),
    strongMatches
  };
}

module.exports = {
  PARTIAL_SCORE,
  ADJACENT_YEAR_SCORE,
  TITLE_MATCH_FLOOR,
  TITLE_PARTIAL_FLOOR,
  buildFactor,
  scoreIdentifierFactor,
  scoreYearFactor,
  scoreCategoryFactor,
  toMatchQuality,
  scoreSimilarity,
  rankCandidates
};
