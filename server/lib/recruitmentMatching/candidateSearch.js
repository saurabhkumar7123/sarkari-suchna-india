"use strict";

/**
 * Phase AI-3 — Candidate search.
 *
 * Finds the recruitments an event could plausibly belong to. Search is
 * deliberately generous — recall matters more than precision here, because the
 * similarity engine ranks afterwards. Every candidate records *why* it was
 * pulled in, so a recommendation can explain where its options came from.
 */

const { round2 } = require("../noticeIntelligence/textUtils");
const { buildRecruitmentIndex } = require("./recruitmentRecord");
const { containment } = require("./matchingUtils");
const { IDENTIFIER_STRATEGIES, SEARCH_STRATEGIES } = require("./types");

/** Shared title tokens required before prose alone pulls in a candidate. */
const MIN_SHARED_TITLE_TOKENS = 2;
/** One distinctive token is enough — "gramin dak sevak" is not generic. */
const MIN_SHARED_DISTINCTIVE_TOKENS = 1;
const MIN_SHARED_KEYWORDS = 2;
const DEFAULT_MAX_CANDIDATES = 25;
/** Years either side of the event year that still count as the same cycle. */
const YEAR_WINDOW = 1;

/**
 * Cheap ordering score used only to decide which candidates survive the cap.
 * The real scoring happens in the similarity engine.
 *
 * @param {Array<string>} strategies
 * @returns {number}
 */
function prefilterScore(strategies) {
  let score = 0;
  for (const strategy of strategies) {
    if (IDENTIFIER_STRATEGIES.includes(strategy)) score += 10;
    else if (strategy === SEARCH_STRATEGIES.EXPLICIT_HINT) score += 12;
    else if (strategy === SEARCH_STRATEGIES.BOARD_AND_YEAR) score += 4;
    else if (strategy === SEARCH_STRATEGIES.TITLE_TOKENS) score += 3;
    else if (strategy === SEARCH_STRATEGIES.KEYWORDS) score += 2;
    else score += 1;
  }
  return score;
}

/**
 * @param {Map<string, object>} accumulator
 * @param {object} record
 * @param {string} strategy
 * @param {object} [detail]
 */
function addCandidate(accumulator, record, strategy, detail) {
  if (!record) return;
  const existing = accumulator.get(record.recruitmentId);
  if (existing) {
    if (!existing.strategies.includes(strategy)) {
      existing.strategies.push(strategy);
      existing.strategyDetails.push({ strategy, ...(detail || {}) });
    }
    return;
  }
  accumulator.set(record.recruitmentId, {
    record,
    strategies: [strategy],
    strategyDetails: [{ strategy, ...(detail || {}) }]
  });
}

/**
 * @param {Map<string, Array<object>>} map
 * @param {string} key
 * @returns {Array<object>}
 */
function lookup(map, key) {
  if (!key) return [];
  return map.get(key) || [];
}

/**
 * @param {number|null} eventYear
 * @param {number|null} recordYear
 * @returns {boolean}
 */
function withinYearWindow(eventYear, recordYear) {
  if (!eventYear || !recordYear) return true;
  return Math.abs(eventYear - recordYear) <= YEAR_WINDOW;
}

/**
 * Search the recruitment index for candidates matching an event identity.
 *
 * @param {object} identity output of `buildEventIdentity`
 * @param {object|Array<object>} indexOrRecords recruitment index or raw records
 * @param {{ maxCandidates?: number, existingRecruitmentId?: string }} [options]
 * @returns {{
 *   candidates: Array<{ record: object, strategies: string[], strategyDetails: Array<object>, prefilterScore: number }>,
 *   strategiesUsed: string[],
 *   identifierBlocked: boolean,
 *   totalFound: number,
 *   truncated: boolean,
 *   repositorySize: number,
 *   isEmptyRepository: boolean
 * }}
 */
function searchCandidates(identity = {}, indexOrRecords = [], options = {}) {
  const index =
    indexOrRecords && indexOrRecords.isIndex
      ? indexOrRecords
      : buildRecruitmentIndex(indexOrRecords);
  const maxCandidates = Number(options.maxCandidates) > 0
    ? Number(options.maxCandidates)
    : DEFAULT_MAX_CANDIDATES;
  const found = new Map();

  // 1. Caller-supplied linkage always enters the candidate set.
  if (options.existingRecruitmentId && index.byId.has(options.existingRecruitmentId)) {
    addCandidate(
      found,
      index.byId.get(options.existingRecruitmentId),
      SEARCH_STRATEGIES.EXPLICIT_HINT,
      { recruitmentId: options.existingRecruitmentId }
    );
  }

  // 2. Official identifiers — the strongest and cheapest block.
  for (const record of lookup(index.byIdentifier, identity.advertisementKey)) {
    addCandidate(found, record, SEARCH_STRATEGIES.ADVERTISEMENT_NUMBER, {
      value: identity.advertisementNumber
    });
  }
  for (const record of lookup(index.byIdentifier, identity.referenceKey)) {
    addCandidate(found, record, SEARCH_STRATEGIES.REFERENCE_NUMBER, {
      value: identity.referenceNumber
    });
  }

  // 3. Same recruiting body, same or adjacent cycle year.
  for (const record of lookup(index.byBoard, identity.boardKey)) {
    if (withinYearWindow(identity.year, record.year)) {
      addCandidate(found, record, SEARCH_STRATEGIES.BOARD_AND_YEAR, {
        board: identity.board,
        year: identity.year
      });
    } else {
      addCandidate(found, record, SEARCH_STRATEGIES.BOARD, { board: identity.board });
    }
  }
  if (identity.departmentKey && identity.departmentKey !== identity.boardKey) {
    for (const record of lookup(index.byBoard, identity.departmentKey)) {
      addCandidate(found, record, SEARCH_STRATEGIES.BOARD, { board: identity.department });
    }
  }

  // 4. Shared recruitment vocabulary — catches renamed or unnumbered notices.
  const tokenHits = new Map();
  for (const token of identity.titleTokens || []) {
    for (const record of lookup(index.byToken, token)) {
      const entry = tokenHits.get(record.recruitmentId) || { record, tokens: [] };
      entry.tokens.push(token);
      tokenHits.set(record.recruitmentId, entry);
    }
  }
  const distinctiveSet = new Set(identity.distinctiveTitleTokens || []);
  for (const entry of tokenHits.values()) {
    const distinctiveShared = entry.tokens.filter((token) => distinctiveSet.has(token));
    const qualifies =
      entry.tokens.length >= MIN_SHARED_TITLE_TOKENS ||
      distinctiveShared.length >= MIN_SHARED_DISTINCTIVE_TOKENS;
    if (!qualifies) continue;
    addCandidate(found, entry.record, SEARCH_STRATEGIES.TITLE_TOKENS, {
      sharedTokens: entry.tokens,
      sharedDistinctiveTokens: distinctiveShared,
      coverage: round2(containment(identity.titleTokens || [], entry.record.titleTokens || []))
    });
  }

  // 5. Shared keywords — a fallback for notices whose title is thin.
  const keywordHits = new Map();
  for (const keyword of identity.keywordKeys || []) {
    for (const record of lookup(index.byKeyword, keyword)) {
      const entry = keywordHits.get(record.recruitmentId) || { record, keywords: [] };
      entry.keywords.push(keyword);
      keywordHits.set(record.recruitmentId, entry);
    }
  }
  for (const entry of keywordHits.values()) {
    if (entry.keywords.length < MIN_SHARED_KEYWORDS) continue;
    addCandidate(found, entry.record, SEARCH_STRATEGIES.KEYWORDS, {
      sharedKeywords: entry.keywords
    });
  }

  // 6. Last resort: same category and year, only when nothing else matched.
  if (found.size === 0 && identity.year) {
    for (const record of lookup(index.byCategory, identity.category)) {
      if (record.year !== identity.year) continue;
      addCandidate(found, record, SEARCH_STRATEGIES.CATEGORY_AND_YEAR, {
        category: identity.category,
        year: identity.year
      });
    }
  }

  const all = Array.from(found.values())
    .map((entry) => ({ ...entry, prefilterScore: prefilterScore(entry.strategies) }))
    .sort(
      (a, b) =>
        b.prefilterScore - a.prefilterScore ||
        a.record.recruitmentId.localeCompare(b.record.recruitmentId)
    );

  const candidates = all.slice(0, maxCandidates);
  const strategiesUsed = Array.from(
    new Set(candidates.flatMap((candidate) => candidate.strategies))
  ).sort();

  return {
    candidates,
    strategiesUsed,
    identifierBlocked: strategiesUsed.some((strategy) => IDENTIFIER_STRATEGIES.includes(strategy)),
    totalFound: all.length,
    truncated: all.length > candidates.length,
    repositorySize: index.size,
    isEmptyRepository: index.size === 0
  };
}

module.exports = {
  MIN_SHARED_TITLE_TOKENS,
  MIN_SHARED_DISTINCTIVE_TOKENS,
  MIN_SHARED_KEYWORDS,
  DEFAULT_MAX_CANDIDATES,
  YEAR_WINDOW,
  prefilterScore,
  withinYearWindow,
  searchCandidates
};
