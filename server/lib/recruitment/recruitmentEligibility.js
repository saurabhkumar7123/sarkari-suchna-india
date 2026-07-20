"use strict";

/**
 * Phase 32 — Recruitment Eligibility Engine (read-only quality gate).
 *
 * Deterministic evaluation of whether a processed notice is suitable for
 * future review-queue creation. Never persists. Never enqueues.
 * No AI, fuzzy scoring, or probabilities.
 */

const {
  LIFECYCLE_EVENT_TYPES,
  UNKNOWN_EVENT_TYPE
} = require("./eventTypeClassifier");

/** Aligned with detectionProcessor.PROCESS_RESULT_STATUS (no import coupling). */
const PROCESSOR_STATUS = Object.freeze({
  SUCCESS: "success",
  UNKNOWN_EVENT: "unknown_event",
  AMBIGUOUS_MATCH: "ambiguous_match",
  INVALID_INPUT: "invalid_input"
});

/** Aligned with detectionProcessor.PROCESS_WARNINGS. */
const PROCESSOR_WARNING = Object.freeze({
  MULTIPLE_EQUAL_MATCHES: "MULTIPLE_EQUAL_MATCHES",
  UNKNOWN_EVENT_TYPE: "UNKNOWN_EVENT_TYPE"
});

const ELIGIBILITY_STATUS = Object.freeze({
  ELIGIBLE: "eligible",
  INELIGIBLE: "ineligible",
  MANUAL_REVIEW: "manual_review"
});

const ELIGIBILITY_REASONS = Object.freeze({
  KNOWN_LIFECYCLE_EVENT: "KNOWN_LIFECYCLE_EVENT",
  LOOKUP_SUCCEEDED: "LOOKUP_SUCCEEDED",
  CANDIDATES_PRESENT: "CANDIDATES_PRESENT",
  SINGLE_SELECTED_RECRUITMENT: "SINGLE_SELECTED_RECRUITMENT",
  MATCH_TRUE: "MATCH_TRUE",
  CONFIDENCE_HIGH: "CONFIDENCE_HIGH",
  NO_CONFLICTING_SIGNALS: "NO_CONFLICTING_SIGNALS",
  PROCESSOR_SUCCESS: "PROCESSOR_SUCCESS",
  INVALID_PROCESSOR_INPUT: "INVALID_PROCESSOR_INPUT",
  CONFLICTING_SIGNALS: "CONFLICTING_SIGNALS",
  MATCH_FALSE: "MATCH_FALSE",
  CRITICAL_PROCESSOR_FAILURE: "CRITICAL_PROCESSOR_FAILURE",
  MEDIUM_CONFIDENCE: "MEDIUM_CONFIDENCE",
  UNKNOWN_MATCH: "UNKNOWN_MATCH",
  MULTIPLE_EQUAL_MATCHES: "MULTIPLE_EQUAL_MATCHES",
  LOOKUP_FAILED: "LOOKUP_FAILED",
  LOOKUP_SKIPPED: "LOOKUP_SKIPPED",
  NO_CANDIDATES: "NO_CANDIDATES",
  UNKNOWN_EVENT: "UNKNOWN_EVENT"
});

const KNOWN_EVENT_TYPES = Object.freeze(new Set(LIFECYCLE_EVENT_TYPES));

/**
 * @typedef {Object} EligibilityResult
 * @property {boolean} eligible
 * @property {string} status
 * @property {string[]} reasons
 * @property {string|null} confidence
 * @property {string|null} eventType
 * @property {number} candidateCount
 * @property {Object|null} matchResult
 * @property {Object|null} lookupSummary
 */

function sortReasons(reasons) {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function asSignalArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function sanitizeLookupSummary(lookupSummary) {
  if (!lookupSummary || typeof lookupSummary !== "object" || Array.isArray(lookupSummary)) {
    return null;
  }
  return {
    status: lookupSummary.status != null ? String(lookupSummary.status) : null,
    strategy: lookupSummary.strategy != null ? String(lookupSummary.strategy) : null,
    candidateCount:
      lookupSummary.candidateCount != null
        ? Number(lookupSummary.candidateCount) || 0
        : 0,
    limitedTo:
      lookupSummary.limitedTo != null ? Number(lookupSummary.limitedTo) || null : null,
    criteria: lookupSummary.criteria != null ? lookupSummary.criteria : null,
    message: lookupSummary.message != null ? String(lookupSummary.message) : null
  };
}

function extractMatchResult(processorOutput) {
  if (
    processorOutput.matchResult &&
    typeof processorOutput.matchResult === "object" &&
    !Array.isArray(processorOutput.matchResult)
  ) {
    return processorOutput.matchResult;
  }
  const reviewItem = processorOutput.reviewItem;
  if (
    reviewItem &&
    typeof reviewItem === "object" &&
    reviewItem.matchResult &&
    typeof reviewItem.matchResult === "object" &&
    !Array.isArray(reviewItem.matchResult)
  ) {
    return reviewItem.matchResult;
  }
  return null;
}

function buildBaseResult({
  status,
  reasons,
  confidence,
  eventType,
  candidateCount,
  matchResult,
  lookupSummary
}) {
  return {
    eligible: status === ELIGIBILITY_STATUS.ELIGIBLE,
    status,
    reasons: sortReasons(reasons),
    confidence: confidence != null ? String(confidence) : null,
    eventType: eventType != null ? String(eventType) : null,
    candidateCount: Number.isFinite(candidateCount) ? candidateCount : 0,
    matchResult: matchResult
      ? {
          match: matchResult.match,
          confidence:
            matchResult.confidence != null ? String(matchResult.confidence) : null,
          matchedSignals: asSignalArray(matchResult.matchedSignals),
          conflictingSignals: asSignalArray(matchResult.conflictingSignals)
        }
      : null,
    lookupSummary
  };
}

/**
 * Deterministic eligibility evaluation for future review-queue creation.
 * Pure: no I/O, no mutation, no persistence.
 *
 * @param {Object|null|undefined} processorOutput
 *   Detection processor result, optionally enriched with lookupSummary /
 *   criticalFailure / failed flags from the worker.
 * @returns {EligibilityResult}
 */
function evaluateRecruitmentEligibility(processorOutput) {
  const emptyLookup = null;
  const emptyMatch = null;

  if (
    processorOutput == null ||
    typeof processorOutput !== "object" ||
    Array.isArray(processorOutput)
  ) {
    return buildBaseResult({
      status: ELIGIBILITY_STATUS.INELIGIBLE,
      reasons: [ELIGIBILITY_REASONS.INVALID_PROCESSOR_INPUT],
      confidence: null,
      eventType: null,
      candidateCount: 0,
      matchResult: emptyMatch,
      lookupSummary: emptyLookup
    });
  }

  const lookupSummary = sanitizeLookupSummary(processorOutput.lookupSummary);
  const candidateCount =
    lookupSummary && lookupSummary.candidateCount != null
      ? lookupSummary.candidateCount
      : processorOutput.candidateCount != null
        ? Number(processorOutput.candidateCount) || 0
        : 0;

  const eventType =
    processorOutput.eventType != null ? String(processorOutput.eventType) : null;
  const processorStatus =
    processorOutput.status != null ? String(processorOutput.status) : null;
  const warnings = Array.isArray(processorOutput.warnings)
    ? processorOutput.warnings.map((w) => String(w))
    : [];
  const matchResult = extractMatchResult(processorOutput);
  const confidence = matchResult && matchResult.confidence != null
    ? String(matchResult.confidence).toLowerCase()
    : processorOutput.confidence != null
      ? String(processorOutput.confidence).toLowerCase()
      : null;
  const matchValue = matchResult ? matchResult.match : undefined;
  const conflictingSignals = matchResult
    ? asSignalArray(matchResult.conflictingSignals)
    : [];
  const selectedRecruitment = processorOutput.selectedRecruitment;

  const criticalFailure =
    processorOutput.criticalFailure === true ||
    processorOutput.failed === true ||
    processorOutput.criticalProcessorFailure === true;

  // --- Ineligible (hard fails; checked first) ---
  const ineligibleReasons = [];

  if (criticalFailure) {
    ineligibleReasons.push(ELIGIBILITY_REASONS.CRITICAL_PROCESSOR_FAILURE);
  }

  if (processorStatus === PROCESSOR_STATUS.INVALID_INPUT) {
    ineligibleReasons.push(ELIGIBILITY_REASONS.INVALID_PROCESSOR_INPUT);
  }

  if (matchValue === false) {
    ineligibleReasons.push(ELIGIBILITY_REASONS.MATCH_FALSE);
  }

  if (conflictingSignals.length > 0) {
    ineligibleReasons.push(ELIGIBILITY_REASONS.CONFLICTING_SIGNALS);
  }

  if (ineligibleReasons.length > 0) {
    return buildBaseResult({
      status: ELIGIBILITY_STATUS.INELIGIBLE,
      reasons: ineligibleReasons,
      confidence,
      eventType,
      candidateCount,
      matchResult,
      lookupSummary
    });
  }

  // --- Manual review (soft gates) ---
  const manualReasons = [];

  const isKnownEvent =
    eventType != null &&
    eventType !== UNKNOWN_EVENT_TYPE &&
    KNOWN_EVENT_TYPES.has(eventType);

  if (
    !isKnownEvent ||
    processorStatus === PROCESSOR_STATUS.UNKNOWN_EVENT ||
    warnings.includes(PROCESSOR_WARNING.UNKNOWN_EVENT_TYPE)
  ) {
    manualReasons.push(ELIGIBILITY_REASONS.UNKNOWN_EVENT);
  }

  const lookupStatus = lookupSummary && lookupSummary.status
    ? String(lookupSummary.status).toLowerCase()
    : null;

  if (lookupStatus === "failed") {
    manualReasons.push(ELIGIBILITY_REASONS.LOOKUP_FAILED);
  } else if (lookupStatus === "skipped" || lookupStatus == null) {
    manualReasons.push(ELIGIBILITY_REASONS.LOOKUP_SKIPPED);
  }

  if (candidateCount === 0) {
    manualReasons.push(ELIGIBILITY_REASONS.NO_CANDIDATES);
  }

  if (
    processorStatus === PROCESSOR_STATUS.AMBIGUOUS_MATCH ||
    warnings.includes(PROCESSOR_WARNING.MULTIPLE_EQUAL_MATCHES)
  ) {
    manualReasons.push(ELIGIBILITY_REASONS.MULTIPLE_EQUAL_MATCHES);
  }

  if (confidence === "medium") {
    manualReasons.push(ELIGIBILITY_REASONS.MEDIUM_CONFIDENCE);
  }

  if (
    matchValue === "unknown" ||
    matchValue == null ||
    confidence === "none" ||
    confidence === "low" ||
    confidence === ""
  ) {
    // Only flag unknown match when we do not already have a positive true match.
    if (matchValue !== true) {
      manualReasons.push(ELIGIBILITY_REASONS.UNKNOWN_MATCH);
    } else if (confidence !== "high" && confidence !== "medium") {
      manualReasons.push(ELIGIBILITY_REASONS.UNKNOWN_MATCH);
    }
  }

  if (manualReasons.length > 0) {
    return buildBaseResult({
      status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
      reasons: manualReasons,
      confidence,
      eventType,
      candidateCount,
      matchResult,
      lookupSummary
    });
  }

  // --- Eligible: every hard gate must pass ---
  const eligibleReasons = [];
  let allGatesPass = true;

  if (isKnownEvent) {
    eligibleReasons.push(ELIGIBILITY_REASONS.KNOWN_LIFECYCLE_EVENT);
  } else {
    allGatesPass = false;
  }

  if (lookupStatus === "ok") {
    eligibleReasons.push(ELIGIBILITY_REASONS.LOOKUP_SUCCEEDED);
  } else {
    allGatesPass = false;
  }

  if (candidateCount > 0) {
    eligibleReasons.push(ELIGIBILITY_REASONS.CANDIDATES_PRESENT);
  } else {
    allGatesPass = false;
  }

  if (
    selectedRecruitment &&
    typeof selectedRecruitment === "object" &&
    !Array.isArray(selectedRecruitment)
  ) {
    eligibleReasons.push(ELIGIBILITY_REASONS.SINGLE_SELECTED_RECRUITMENT);
  } else {
    allGatesPass = false;
  }

  if (matchValue === true) {
    eligibleReasons.push(ELIGIBILITY_REASONS.MATCH_TRUE);
  } else {
    allGatesPass = false;
  }

  if (confidence === "high") {
    eligibleReasons.push(ELIGIBILITY_REASONS.CONFIDENCE_HIGH);
  } else {
    allGatesPass = false;
  }

  if (conflictingSignals.length === 0) {
    eligibleReasons.push(ELIGIBILITY_REASONS.NO_CONFLICTING_SIGNALS);
  } else {
    allGatesPass = false;
  }

  if (processorStatus === PROCESSOR_STATUS.SUCCESS) {
    eligibleReasons.push(ELIGIBILITY_REASONS.PROCESSOR_SUCCESS);
  } else {
    allGatesPass = false;
  }

  if (allGatesPass) {
    return buildBaseResult({
      status: ELIGIBILITY_STATUS.ELIGIBLE,
      reasons: eligibleReasons,
      confidence,
      eventType,
      candidateCount,
      matchResult,
      lookupSummary
    });
  }

  // Safe default — anything that slipped gates without a hard fail.
  return buildBaseResult({
    status: ELIGIBILITY_STATUS.MANUAL_REVIEW,
    reasons: [ELIGIBILITY_REASONS.UNKNOWN_MATCH],
    confidence,
    eventType,
    candidateCount,
    matchResult,
    lookupSummary
  });
}

module.exports = {
  ELIGIBILITY_STATUS,
  ELIGIBILITY_REASONS,
  evaluateRecruitmentEligibility
};
