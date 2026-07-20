"use strict";

const {
  processRecruitmentDetection,
  processCandidateMatches,
  PROCESS_RESULT_STATUS,
  PROCESS_WARNINGS
} = require("../lib/recruitment/detectionProcessor");
const {
  normalizeRecruitmentNoticeText,
  classifyRecruitmentEventType
} = require("../lib/recruitment/eventTypeClassifier");

function normalizeNoticeInput(input = {}) {
  return {
    title: input.title ?? "",
    content: input.content ?? "",
    url: input.url ?? ""
  };
}

function normalizeCandidateRecruitments(value) {
  return Array.isArray(value) ? value : [];
}

function buildCandidateMatchingSummary({
  candidateRecruitments,
  recruitmentMatching,
  processorOutput,
  classification
}) {
  const matches = Array.isArray(recruitmentMatching.matches) ? recruitmentMatching.matches : [];
  const warnings = Array.isArray(processorOutput.warnings) ? processorOutput.warnings : [];
  const status = processorOutput.status;

  const individualMatchResults = matches.map((entry, index) => ({
    candidateIndex: entry.candidateIndex ?? index,
    candidate: entry.candidate,
    match: entry.matchResult?.match ?? null,
    confidence: entry.matchResult?.confidence ?? null,
    matchedSignals: Array.isArray(entry.matchResult?.matchedSignals)
      ? [...entry.matchResult.matchedSignals]
      : [],
    conflictingSignals: Array.isArray(entry.matchResult?.conflictingSignals)
      ? [...entry.matchResult.conflictingSignals]
      : [],
    strength: entry.strength ?? null
  }));

  const matchedSignals = [
    ...new Set(individualMatchResults.flatMap((entry) => entry.matchedSignals))
  ].sort();
  const conflictingSignals = [
    ...new Set(individualMatchResults.flatMap((entry) => entry.conflictingSignals))
  ].sort();

  const hasUnknownMatch = individualMatchResults.some((entry) => entry.match === "unknown");

  return {
    candidateCount: candidateRecruitments.length,
    individualMatchResults,
    matchedSignals,
    conflictingSignals,
    selectedCandidate: recruitmentMatching.selectedRecruitment ?? null,
    selectedMatchResult: recruitmentMatching.selectedMatchResult ?? null,
    ambiguous: recruitmentMatching.ambiguous === true,
    warnings: {
      ambiguousMatch: warnings.includes(PROCESS_WARNINGS.MULTIPLE_EQUAL_MATCHES),
      noCandidates: warnings.includes(PROCESS_WARNINGS.NO_CANDIDATES),
      noMatch:
        status === PROCESS_RESULT_STATUS.NO_MATCH &&
        !warnings.includes(PROCESS_WARNINGS.NO_CANDIDATES),
      unknownMatch:
        status === PROCESS_RESULT_STATUS.UNKNOWN_EVENT ||
        classification.eventType === "unknown" ||
        hasUnknownMatch
    },
    finalStatus: status
  };
}

/**
 * Read-only recruitment pipeline analysis for internal admin testing.
 * No database access. No side effects.
 *
 * @param {Object} input
 * @returns {Object}
 */
function analyzeRecruitmentNoticeInput(input = {}) {
  const notice = normalizeNoticeInput(input);
  const candidateRecruitments = normalizeCandidateRecruitments(input.candidateRecruitments);
  const createdAt = input.createdAt || new Date().toISOString();

  const normalizedNotice = normalizeRecruitmentNoticeText(notice);
  const classification = classifyRecruitmentEventType(notice);
  const recruitmentMatching = processCandidateMatches({
    notice,
    candidateRecruitments
  });
  const processorOutput = processRecruitmentDetection({
    notice,
    candidateRecruitments,
    createdAt
  });

  return {
    rawInput: {
      notice,
      candidateRecruitments
    },
    normalizedNotice,
    classification: {
      eventType: classification.eventType,
      confidence: classification.confidence,
      matchedRules: classification.matchedRules,
      normalizedText: classification.normalizedText
    },
    recruitmentMatching,
    candidateMatching: buildCandidateMatchingSummary({
      candidateRecruitments,
      recruitmentMatching,
      processorOutput,
      classification
    }),
    selectedMatch: {
      selectedRecruitment: recruitmentMatching.selectedRecruitment,
      selectedMatchResult: recruitmentMatching.selectedMatchResult,
      ambiguous: recruitmentMatching.ambiguous
    },
    reviewItem: processorOutput.reviewItem,
    warnings: processorOutput.warnings,
    finalStatus: processorOutput.status,
    processorOutput: {
      status: processorOutput.status,
      warnings: processorOutput.warnings,
      eventType: processorOutput.eventType,
      selectedRecruitment: processorOutput.selectedRecruitment,
      reviewItem: processorOutput.reviewItem
    }
  };
}

module.exports = {
  analyzeRecruitmentNoticeInput
};
