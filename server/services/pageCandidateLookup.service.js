"use strict";

/**
 * Page-aware lifecycle candidate lookup.
 * SELECT only. Never attaches. Never creates recruitments.
 */

const pageRepository = require("../repositories/page.repository");
const { extractLookupCriteria, buildPostSearchTerms } = require("./recruitmentCandidateLookup.service");

const MAX_CANDIDATES = 20;

function hasPageLookupCriteria(criteria = {}) {
  if (criteria.advertisementNo) return true;
  if (criteria.organization && (criteria.examName || criteria.postName)) return true;
  if (criteria.organization && criteria.recruitmentYear != null) return true;
  return false;
}

async function lookupPageCandidatesForRuntime(input = {}) {
  const notice = input.notice && typeof input.notice === "object" ? input.notice : input;
  try {
    const criteria = extractLookupCriteria(notice);
    if (!hasPageLookupCriteria(criteria)) {
      return {
        candidates: [],
        lookupSummary: {
          status: "skipped",
          strategy: "insufficient_criteria",
          candidateCount: 0
        }
      };
    }

    const attempts = [];
    if (criteria.advertisementNo) {
      attempts.push({
        strategy: "page_advertisement_number",
        filters: { advertisementNo: criteria.advertisementNo, limit: MAX_CANDIDATES }
      });
    }
    if (criteria.organization && (criteria.examName || criteria.postName)) {
      attempts.push({
        strategy: "page_department_post",
        filters: {
          department: criteria.organization,
          postTokens: buildPostSearchTerms(criteria.examName, criteria.postName),
          limit: MAX_CANDIDATES
        }
      });
    }

    let strategy = "no_matches";
    let rows = [];
    for (const attempt of attempts) {
      const found = await pageRepository.findLifecycleCandidates(attempt.filters);
      if (Array.isArray(found) && found.length > 0) {
        strategy = attempt.strategy;
        rows = found;
        break;
      }
    }

    return {
      candidates: rows.slice(0, MAX_CANDIDATES),
      lookupSummary: {
        status: "ok",
        strategy,
        candidateCount: rows.length
      }
    };
  } catch (error) {
    return {
      candidates: [],
      lookupSummary: {
        status: "failed",
        strategy: "lookup_error",
        candidateCount: 0,
        message: error && error.message ? error.message : String(error)
      }
    };
  }
}

module.exports = {
  MAX_CANDIDATES,
  lookupPageCandidatesForRuntime
};
