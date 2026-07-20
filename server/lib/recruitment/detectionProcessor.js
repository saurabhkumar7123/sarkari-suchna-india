"use strict";

/**
 * Phase 23 — deterministic recruitment detection orchestration.
 * Pure library: no DB, no network, no runtime wiring in this phase.
 */

const {
  UNKNOWN_EVENT_TYPE,
  normalizeRecruitmentNoticeText,
  classifyRecruitmentEventType
} = require("./eventTypeClassifier");
const { isSameRecruitment } = require("./recruitmentMatcher");
const { createReviewItem } = require("./reviewQueue");

const PROCESS_RESULT_STATUS = Object.freeze({
  SUCCESS: "success",
  UNKNOWN_EVENT: "unknown_event",
  NO_MATCH: "no_match",
  AMBIGUOUS_MATCH: "ambiguous_match",
  INVALID_INPUT: "invalid_input"
});

const PROCESS_WARNINGS = Object.freeze({
  MULTIPLE_EQUAL_MATCHES: "MULTIPLE_EQUAL_MATCHES",
  UNKNOWN_EVENT_TYPE: "UNKNOWN_EVENT_TYPE",
  INVALID_NOTICE: "INVALID_NOTICE",
  NO_CANDIDATES: "NO_CANDIDATES"
});

const CONFIDENCE_RANK = Object.freeze({
  high: 0,
  medium: 1,
  low: 2,
  none: 3
});

/**
 * @typedef {Object} DetectionInput
 * @property {Object} notice
 * @property {Object[]} candidateRecruitments
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} DetectionResult
 * @property {string} status
 * @property {string[]} warnings
 * @property {string} eventType
 * @property {Object|null} selectedRecruitment
 * @property {Object|null} reviewItem
 */

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sortWarnings(warnings) {
  return [...new Set(warnings)].sort((a, b) => a.localeCompare(b));
}

function validateDetectionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, warning: PROCESS_WARNINGS.INVALID_NOTICE };
  }
  if (!input.notice || typeof input.notice !== "object" || Array.isArray(input.notice)) {
    return { valid: false, warning: PROCESS_WARNINGS.INVALID_NOTICE };
  }
  if (!Array.isArray(input.candidateRecruitments)) {
    return { valid: false, warning: PROCESS_WARNINGS.INVALID_NOTICE };
  }

  const title = collapseWhitespace(input.notice.title);
  const content = collapseWhitespace(input.notice.content);
  const url = collapseWhitespace(input.notice.url);
  if (!title && !content && !url) {
    return { valid: false, warning: PROCESS_WARNINGS.INVALID_NOTICE };
  }

  return { valid: true, warning: null };
}

function computeMatchStrength(matchResult) {
  if (!matchResult || matchResult.match !== true) {
    return null;
  }

  const matchedSignals = Array.isArray(matchResult.matchedSignals)
    ? [...matchResult.matchedSignals].sort()
    : [];

  return {
    confidenceRank: CONFIDENCE_RANK[matchResult.confidence] ?? CONFIDENCE_RANK.none,
    signalCount: matchedSignals.length,
    signalKey: matchedSignals.join("|")
  };
}

function strengthsAreEqual(left, right) {
  return (
    left.confidenceRank === right.confidenceRank &&
    left.signalCount === right.signalCount &&
    left.signalKey === right.signalKey
  );
}

function compareStrength(left, right) {
  if (left.confidenceRank !== right.confidenceRank) {
    return left.confidenceRank - right.confidenceRank;
  }
  if (left.signalCount !== right.signalCount) {
    return right.signalCount - left.signalCount;
  }
  return left.signalKey.localeCompare(right.signalKey);
}

function selectStrongestMatch(matches) {
  const positiveMatches = matches.filter((entry) => entry.strength !== null);
  if (positiveMatches.length === 0) {
    return {
      selectedRecruitment: null,
      selectedMatchResult: null,
      ambiguous: false,
      warnings: []
    };
  }

  const ranked = [...positiveMatches].sort((left, right) =>
    compareStrength(left.strength, right.strength)
  );
  const strongest = ranked[0];
  const equalMatches = ranked.filter((entry) =>
    strengthsAreEqual(entry.strength, strongest.strength)
  );

  if (equalMatches.length > 1) {
    return {
      selectedRecruitment: null,
      selectedMatchResult: null,
      ambiguous: true,
      warnings: [PROCESS_WARNINGS.MULTIPLE_EQUAL_MATCHES]
    };
  }

  return {
    selectedRecruitment: strongest.candidate,
    selectedMatchResult: strongest.matchResult,
    ambiguous: false,
    warnings: []
  };
}

function buildNoticeTitle(notice) {
  const title = collapseWhitespace(notice.title);
  if (title) return title.slice(0, 500);

  const content = collapseWhitespace(notice.content);
  if (content) return content.slice(0, 500);

  return collapseWhitespace(notice.url).slice(0, 500);
}

function buildReviewItem({
  notice,
  eventType,
  selectedRecruitment,
  selectedMatchResult,
  classification,
  createdAt
}) {
  const reviewEventType = eventType === UNKNOWN_EVENT_TYPE ? "unknown" : eventType;
  const confidence = selectedMatchResult?.confidence ?? classification.confidence ?? null;

  return createReviewItem({
    recruitmentId: selectedRecruitment?.id ?? null,
    eventType: reviewEventType,
    matchResult: selectedMatchResult,
    confidence,
    sourceUrl: collapseWhitespace(notice.url) || null,
    title: buildNoticeTitle(notice),
    createdAt
  });
}

function buildCandidateMatches(notice, candidateRecruitments) {
  return candidateRecruitments.map((candidate, candidateIndex) => {
    const matchResult = isSameRecruitment(notice, candidate);
    return {
      candidateIndex,
      candidate,
      matchResult,
      strength: computeMatchStrength(matchResult)
    };
  });
}

/**
 * @param {DetectionInput} input
 * @returns {Object}
 */
function processCandidateMatches(input = {}) {
  const validation = validateDetectionInput(input);
  if (!validation.valid) {
    return {
      matches: [],
      selectedRecruitment: null,
      selectedMatchResult: null,
      warnings: [validation.warning],
      ambiguous: false
    };
  }

  const warnings = [];
  if (input.candidateRecruitments.length === 0) {
    warnings.push(PROCESS_WARNINGS.NO_CANDIDATES);
  }

  const matches = buildCandidateMatches(input.notice, input.candidateRecruitments);
  const selection = selectStrongestMatch(matches);

  return {
    matches: matches.map(({ candidateIndex, candidate, matchResult, strength }) => ({
      candidateIndex,
      candidate,
      matchResult,
      strength
    })),
    selectedRecruitment: selection.selectedRecruitment,
    selectedMatchResult: selection.selectedMatchResult,
    warnings: sortWarnings([...warnings, ...selection.warnings]),
    ambiguous: selection.ambiguous
  };
}

/**
 * @param {DetectionInput} input
 * @returns {DetectionResult}
 */
function processRecruitmentDetection(input = {}) {
  const validation = validateDetectionInput(input);
  if (!validation.valid) {
    return {
      status: PROCESS_RESULT_STATUS.INVALID_INPUT,
      warnings: [PROCESS_WARNINGS.INVALID_NOTICE],
      eventType: UNKNOWN_EVENT_TYPE,
      selectedRecruitment: null,
      reviewItem: null
    };
  }

  const notice = input.notice;
  const normalizedText = normalizeRecruitmentNoticeText(notice);
  const classification = classifyRecruitmentEventType(notice);
  const matchOutcome = processCandidateMatches(input);

  const warnings = [...matchOutcome.warnings];
  if (classification.eventType === UNKNOWN_EVENT_TYPE) {
    warnings.push(PROCESS_WARNINGS.UNKNOWN_EVENT_TYPE);
  }

  let status = PROCESS_RESULT_STATUS.SUCCESS;
  if (classification.eventType === UNKNOWN_EVENT_TYPE) {
    status = PROCESS_RESULT_STATUS.UNKNOWN_EVENT;
  } else if (matchOutcome.ambiguous) {
    status = PROCESS_RESULT_STATUS.AMBIGUOUS_MATCH;
  } else if (!matchOutcome.selectedRecruitment) {
    status = PROCESS_RESULT_STATUS.NO_MATCH;
  }

  const reviewItem = buildReviewItem({
    notice,
    eventType: classification.eventType,
    selectedRecruitment: matchOutcome.selectedRecruitment,
    selectedMatchResult: matchOutcome.selectedMatchResult,
    classification,
    createdAt: input.createdAt
  });

  return {
    status,
    warnings: sortWarnings(warnings),
    eventType: classification.eventType,
    selectedRecruitment: matchOutcome.selectedRecruitment,
    reviewItem
  };
}

module.exports = {
  processRecruitmentDetection,
  processCandidateMatches,
  PROCESS_RESULT_STATUS,
  PROCESS_WARNINGS
};
