"use strict";

/**
 * Phase 26 — Recruitment Candidate Lookup (read-only SELECT).
 * Used by Recruitment Testing dashboard and Phase 31.C runtime pipeline
 * (feature-flagged, preview only — never persists review items).
 */

const recruitmentRepository = require("../repositories/recruitment.repository");
const { extractRecruitmentAttributes } = require("../lib/recruitment/recruitmentMatcher");

const MAX_CANDIDATES = 20;

const LOOKUP_EXECUTION_STATUS = Object.freeze({
  OK: "ok",
  SKIPPED: "skipped",
  FAILED: "failed"
});

const EXAM_SEARCH_TERMS = Object.freeze({
  cgl: ["cgl", "combined graduate level"],
  chsl: ["chsl", "combined higher secondary level"],
  je: ["je", "junior engineer"],
  gd: ["gd", "general duty"],
  mts: ["mts", "multitasking staff"],
  ntpc: ["ntpc", "non technical popular categories"],
  alp: ["alp", "assistant loco pilot"],
  "group d": ["group d", "railway group d"]
});

/**
 * @param {Object} notice
 */
function extractLookupCriteria(notice = {}) {
  const attributes = extractRecruitmentAttributes({
    title: notice.title,
    content: notice.content,
    url: notice.url,
    organization: notice.organization,
    board: notice.board,
    department: notice.department,
    post_name: notice.post_name,
    advertisement_no: notice.advertisement_no,
    recruitment_year: notice.recruitment_year,
    cycle_year: notice.cycle_year,
    exam_name: notice.exam_name
  });

  return {
    advertisementNo: attributes.advertisementNo,
    organization: attributes.organization,
    department: attributes.department || attributes.organization,
    examName: attributes.examName,
    postName: attributes.postName,
    recruitmentYear: attributes.recruitmentYear,
    normalizedText: attributes.normalizedText,
    keywords: attributes.keywords
  };
}

function buildPostSearchTerms(examName, postName) {
  const terms = new Set();
  if (examName) {
    const aliases = EXAM_SEARCH_TERMS[examName] || [examName];
    for (const term of aliases) terms.add(term);
  }
  if (postName && postName !== examName) {
    terms.add(postName);
    const aliases = EXAM_SEARCH_TERMS[postName];
    if (aliases) {
      for (const term of aliases) terms.add(term);
    }
  }
  return [...terms];
}

function mapRowToCandidate(row) {
  return {
    id: row.id,
    organization: row.department || null,
    department: row.department || null,
    post_name: row.post_name || null,
    exam_name: null,
    advertisement_no: row.advertisement_no || null,
    recruitment_year: row.cycle_year != null ? Number(row.cycle_year) : null,
    cycle_year: row.cycle_year != null ? Number(row.cycle_year) : null,
    title: row.title || null,
    slug: row.slug || null
  };
}

function sortCandidatesDeterministically(candidates) {
  return [...candidates].sort((a, b) => {
    const idA = Number(a.id) || 0;
    const idB = Number(b.id) || 0;
    if (idA !== idB) return idA - idB;
    return String(a.advertisement_no || "").localeCompare(String(b.advertisement_no || ""));
  });
}

function dedupeById(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const id = row && row.id != null ? Number(row.id) : null;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

/**
 * Priority:
 * 1. Advertisement number
 * 2. Organization + exam (+ optional year)
 * 3. Organization + post (+ optional year)
 * 4. Organization + year
 * Otherwise: empty (never guess from weak signals)
 */
async function runLookupQueries(criteria) {
  const attempts = [];

  if (criteria.advertisementNo) {
    attempts.push({
      strategy: "advertisement_number_exact",
      filters: { advertisementNo: criteria.advertisementNo, limit: MAX_CANDIDATES }
    });
    attempts.push({
      strategy: "advertisement_number_loose",
      filters: { advertisementNo: criteria.advertisementNo, limit: MAX_CANDIDATES },
      looseAdvertisement: true
    });
  }

  if (criteria.organization && criteria.examName) {
    const filters = {
      department: criteria.organization,
      postTokens: buildPostSearchTerms(criteria.examName, null),
      limit: MAX_CANDIDATES
    };
    if (criteria.recruitmentYear != null) {
      filters.cycleYear = criteria.recruitmentYear;
    }
    attempts.push({
      strategy:
        criteria.recruitmentYear != null
          ? "organization_exam_year"
          : "organization_exam",
      filters
    });
  }

  if (criteria.organization && criteria.postName && criteria.postName !== criteria.examName) {
    const filters = {
      department: criteria.organization,
      postTokens: buildPostSearchTerms(criteria.examName, criteria.postName),
      limit: MAX_CANDIDATES
    };
    if (criteria.recruitmentYear != null) {
      filters.cycleYear = criteria.recruitmentYear;
    }
    attempts.push({
      strategy:
        criteria.recruitmentYear != null
          ? "organization_post_year"
          : "organization_post",
      filters
    });
  }

  if (criteria.organization && criteria.recruitmentYear != null) {
    attempts.push({
      strategy: "organization_year",
      filters: {
        department: criteria.organization,
        cycleYear: criteria.recruitmentYear,
        limit: MAX_CANDIDATES
      }
    });
  }

  for (const attempt of attempts) {
    let rows = [];
    if (attempt.looseAdvertisement) {
      rows = await recruitmentRepository.findCandidatesByAdvertisementNoLoose(
        attempt.filters.advertisementNo,
        attempt.filters.limit
      );
    } else {
      rows = await recruitmentRepository.findCandidatesForLookup(attempt.filters);
    }

    if (rows.length > 0) {
      return {
        strategy: attempt.strategy,
        rows: dedupeById(rows)
      };
    }
  }

  return {
    strategy: attempts.length === 0 ? "insufficient_criteria" : "no_matches",
    rows: []
  };
}

/**
 * @param {{ notice?: Object }} input
 * @returns {Promise<{ candidates: Object[], searchSummary: Object }>}
 */
async function lookupRecruitmentCandidates(input = {}) {
  const notice = input.notice && typeof input.notice === "object" ? input.notice : input;
  const title = String(notice.title || "").trim();
  const content = String(notice.content || "").trim();
  const url = String(notice.url || "").trim();

  if (!title && !content && !url) {
    return {
      candidates: [],
      searchSummary: {
        criteria: null,
        strategy: "invalid_notice",
        candidateCount: 0,
        limitedTo: MAX_CANDIDATES
      }
    };
  }

  const exists = await recruitmentRepository.tableExists();
  if (!exists) {
    return {
      candidates: [],
      searchSummary: {
        criteria: null,
        strategy: "table_missing",
        candidateCount: 0,
        limitedTo: MAX_CANDIDATES
      }
    };
  }

  const criteria = extractLookupCriteria({
    title,
    content,
    url
  });

  const { strategy, rows } = await runLookupQueries(criteria);
  const candidates = sortCandidatesDeterministically(rows.map(mapRowToCandidate)).slice(
    0,
    MAX_CANDIDATES
  );

  return {
    candidates,
    searchSummary: {
      criteria: {
        advertisementNo: criteria.advertisementNo,
        organization: criteria.organization,
        examName: criteria.examName,
        postName: criteria.postName,
        recruitmentYear: criteria.recruitmentYear
      },
      strategy,
      candidateCount: candidates.length,
      limitedTo: MAX_CANDIDATES
    }
  };
}

/**
 * True when existing Phase 26 lookup rules would attempt at least one SELECT strategy.
 * @param {Object} notice
 * @returns {boolean}
 */
function hasSufficientLookupCriteria(notice = {}) {
  const title = String(notice.title || "").trim();
  const content = String(notice.content || "").trim();
  const url = String(notice.url || "").trim();
  if (!title && !content && !url) {
    return false;
  }

  const criteria = extractLookupCriteria({ title, content, url });
  if (criteria.advertisementNo) return true;
  if (criteria.organization && criteria.examName) return true;
  if (criteria.organization && criteria.postName && criteria.postName !== criteria.examName) {
    return true;
  }
  if (criteria.organization && criteria.recruitmentYear != null) return true;
  return false;
}

/**
 * Build a preview-friendly lookup summary.
 * @param {Object} partial
 * @returns {Object}
 */
function buildLookupSummary(partial = {}) {
  return {
    status: partial.status || LOOKUP_EXECUTION_STATUS.SKIPPED,
    strategy: partial.strategy != null ? partial.strategy : null,
    candidateCount:
      partial.candidateCount != null ? Number(partial.candidateCount) || 0 : 0,
    limitedTo: partial.limitedTo != null ? partial.limitedTo : MAX_CANDIDATES,
    criteria: partial.criteria != null ? partial.criteria : null,
    message: partial.message != null ? String(partial.message) : null
  };
}

/**
 * Phase 31.C — never-throwing runtime lookup for the feature-flagged worker path.
 * Skips DB when criteria are insufficient. SELECT only. No review persistence.
 *
 * @param {{ notice?: Object }} input
 * @returns {Promise<{ candidates: Object[], lookupSummary: Object }>}
 */
async function lookupRecruitmentCandidatesForRuntime(input = {}) {
  const notice = input.notice && typeof input.notice === "object" ? input.notice : input;

  try {
    if (!hasSufficientLookupCriteria(notice)) {
      return {
        candidates: [],
        lookupSummary: buildLookupSummary({
          status: LOOKUP_EXECUTION_STATUS.SKIPPED,
          strategy: "insufficient_criteria",
          candidateCount: 0
        })
      };
    }

    const result = await lookupRecruitmentCandidates({ notice });
    const summary = result && result.searchSummary ? result.searchSummary : {};
    return {
      candidates: Array.isArray(result.candidates) ? result.candidates : [],
      lookupSummary: buildLookupSummary({
        status: LOOKUP_EXECUTION_STATUS.OK,
        strategy: summary.strategy || null,
        candidateCount: summary.candidateCount != null ? summary.candidateCount : 0,
        limitedTo: summary.limitedTo != null ? summary.limitedTo : MAX_CANDIDATES,
        criteria: summary.criteria || null
      })
    };
  } catch (error) {
    return {
      candidates: [],
      lookupSummary: buildLookupSummary({
        status: LOOKUP_EXECUTION_STATUS.FAILED,
        strategy: "lookup_error",
        candidateCount: 0,
        message: error && error.message ? error.message : String(error)
      })
    };
  }
}

module.exports = {
  MAX_CANDIDATES,
  LOOKUP_EXECUTION_STATUS,
  extractLookupCriteria,
  mapRowToCandidate,
  sortCandidatesDeterministically,
  hasSufficientLookupCriteria,
  lookupRecruitmentCandidates,
  lookupRecruitmentCandidatesForRuntime
};
