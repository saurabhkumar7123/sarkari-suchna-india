"use strict";

/**
 * Production matching evaluation.
 * Reuses isSameRecruitment. Only HIGH auto-attaches.
 * Title similarity alone is never sufficient.
 */

const { isSameRecruitment, extractRecruitmentAttributes } = require("./recruitmentMatcher");
const { MATCH_LEVELS } = require("./lifecycleSafety");

const MATCH_SIGNALS = Object.freeze({
  ADVERTISEMENT_NUMBER: "ADVERTISEMENT_NUMBER",
  YEAR: "YEAR"
});

function mapPageToCandidate(page = {}) {
  return {
    id: page.recruitment_id || page.id,
    pageId: page.id,
    recruitment_id: page.recruitment_id || null,
    title: page.title || null,
    slug: page.slug || null,
    department: page.department || null,
    organization: page.department || null,
    post_name: page.post_name || null,
    advertisement_no: page.advertisement_no || null,
    status: page.status || null
  };
}

function rankMatchResult(matchResult) {
  if (!matchResult) {
    return { level: MATCH_LEVELS.NO_MATCH, autoAttach: false };
  }

  const conflicts = Array.isArray(matchResult.conflictingSignals)
    ? matchResult.conflictingSignals
    : [];
  if (
    conflicts.includes(MATCH_SIGNALS.ADVERTISEMENT_NUMBER) ||
    conflicts.includes(MATCH_SIGNALS.YEAR)
  ) {
    return { level: MATCH_LEVELS.HARD_NEGATIVE, autoAttach: false };
  }

  if (matchResult.match === true && matchResult.confidence === "high") {
    return { level: MATCH_LEVELS.HIGH, autoAttach: true };
  }

  if (matchResult.match === true && matchResult.confidence === "medium") {
    return { level: MATCH_LEVELS.MEDIUM, autoAttach: false };
  }

  return { level: MATCH_LEVELS.NO_MATCH, autoAttach: false };
}

function scoreCandidate(kind, record, notice) {
  const comparable =
    kind === "page"
      ? mapPageToCandidate(record)
      : {
          id: record.id,
          title: record.title,
          slug: record.slug,
          department: record.department || record.organization,
          organization: record.organization || record.department,
          post_name: record.post_name,
          advertisement_no: record.advertisement_no,
          recruitment_year: record.recruitment_year || record.cycle_year,
          cycle_year: record.cycle_year || record.recruitment_year,
          exam_name: record.exam_name
        };

  const matchResult = isSameRecruitment(notice, comparable);
  const ranked = rankMatchResult(matchResult);
  const recruitmentId =
    kind === "page"
      ? record.recruitment_id || null
      : record.id || null;

  return {
    kind,
    record,
    recruitmentId,
    pageId: kind === "page" ? record.id || null : null,
    matchResult,
    level: ranked.level,
    autoAttach: ranked.autoAttach,
    score:
      ranked.level === MATCH_LEVELS.HIGH
        ? 0.95
        : ranked.level === MATCH_LEVELS.MEDIUM
          ? 0.7
          : ranked.level === MATCH_LEVELS.HARD_NEGATIVE
            ? 0
            : 0.2
  };
}

/**
 * @param {{
 *   notice: object,
 *   recruitmentCandidates?: object[],
 *   pageCandidates?: object[]
 * }} input
 */
function evaluateLifecycleMatch(input = {}) {
  const notice = input.notice && typeof input.notice === "object" ? input.notice : {};
  const recruitmentCandidates = Array.isArray(input.recruitmentCandidates)
    ? input.recruitmentCandidates
    : [];
  const pageCandidates = Array.isArray(input.pageCandidates) ? input.pageCandidates : [];

  const identity = extractRecruitmentAttributes(notice);
  const evaluations = [];

  for (const record of recruitmentCandidates) {
    if (!record) continue;
    evaluations.push(scoreCandidate("recruitment", record, notice));
  }
  for (const record of pageCandidates) {
    if (!record) continue;
    evaluations.push(scoreCandidate("page", record, notice));
  }

  const high = evaluations.filter((entry) => entry.level === MATCH_LEVELS.HIGH);
  const medium = evaluations.filter((entry) => entry.level === MATCH_LEVELS.MEDIUM);
  const hardNegative = evaluations.filter((entry) => entry.level === MATCH_LEVELS.HARD_NEGATIVE);

  const uniqueHighRecruitmentIds = [
    ...new Set(high.map((entry) => entry.recruitmentId).filter((id) => id != null))
  ];
  const uniqueMediumRecruitmentIds = [
    ...new Set(medium.map((entry) => entry.recruitmentId).filter((id) => id != null))
  ];

  let matchLevel = MATCH_LEVELS.NO_MATCH;
  let selected = null;

  if (high.length === 1 && (high[0].recruitmentId != null || high[0].kind === "page")) {
    if (high[0].kind === "recruitment" && high[0].recruitmentId != null) {
      matchLevel = MATCH_LEVELS.HIGH;
      selected = high[0];
    } else if (high[0].kind === "page" && high[0].recruitmentId != null) {
      matchLevel = MATCH_LEVELS.HIGH;
      selected = high[0];
    } else {
      matchLevel = MATCH_LEVELS.MEDIUM;
      selected = high[0];
    }
  } else if (high.length > 1) {
    const sameParent =
      uniqueHighRecruitmentIds.length === 1 && uniqueHighRecruitmentIds[0] != null;
    if (sameParent) {
      matchLevel = MATCH_LEVELS.HIGH;
      selected = high.find((entry) => Number(entry.recruitmentId) === Number(uniqueHighRecruitmentIds[0]));
    } else {
      matchLevel = MATCH_LEVELS.AMBIGUOUS;
    }
  } else if (medium.length === 1) {
    matchLevel = MATCH_LEVELS.MEDIUM;
    selected = medium[0];
  } else if (medium.length > 1) {
    const sameParent =
      uniqueMediumRecruitmentIds.length === 1 && uniqueMediumRecruitmentIds[0] != null;
    matchLevel = sameParent ? MATCH_LEVELS.MEDIUM : MATCH_LEVELS.AMBIGUOUS;
    selected = sameParent ? medium[0] : null;
  } else if (hardNegative.length > 0 && evaluations.length === hardNegative.length) {
    matchLevel = MATCH_LEVELS.HARD_NEGATIVE;
  }

  const candidates = evaluations
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      kind: entry.kind,
      id: entry.kind === "page" ? entry.pageId : entry.record.id,
      recruitmentId: entry.recruitmentId,
      title: entry.record.title || null,
      slug: entry.record.slug || null,
      advertisement_no: entry.record.advertisement_no || null,
      department: entry.record.department || entry.record.organization || null,
      status: entry.record.status || null,
      level: entry.level,
      score: entry.score,
      matchResult: entry.matchResult
    }));

  return {
    matchLevel,
    selected,
    selectedRecruitmentId:
      matchLevel === MATCH_LEVELS.HIGH && selected && selected.recruitmentId
        ? selected.recruitmentId
        : null,
    identity,
    candidates,
    highCount: high.length,
    mediumCount: medium.length
  };
}

module.exports = {
  mapPageToCandidate,
  rankMatchResult,
  scoreCandidate,
  evaluateLifecycleMatch
};
