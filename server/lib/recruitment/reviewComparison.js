"use strict";

/**
 * Phase 29 — comparison + history view models for admin review UI.
 * Pure library: no DB, no network, no persistence side effects.
 */

const {
  normalizeRecruitmentIdentity,
  RECRUITMENT_MATCH_SIGNALS
} = require("./recruitmentMatcher");
const {
  recommendDecisionFromMatchResult
} = require("./reviewDecisionAssistant");

const FIELD_VISUAL_STATUS = Object.freeze({
  MATCHED: "matched",
  MISSING: "missing",
  CONFLICTING: "conflicting",
  NEUTRAL: "neutral"
});

const COMPARISON_FIELD_DEFS = Object.freeze([
  {
    key: "organization",
    label: "Organization",
    signal: RECRUITMENT_MATCH_SIGNALS.ORGANIZATION
  },
  {
    key: "examName",
    label: "Exam Name",
    signal: RECRUITMENT_MATCH_SIGNALS.EXAM
  },
  {
    key: "postName",
    label: "Post Name",
    signal: RECRUITMENT_MATCH_SIGNALS.POST
  },
  {
    key: "advertisementNo",
    label: "Advertisement Number",
    signal: RECRUITMENT_MATCH_SIGNALS.ADVERTISEMENT_NUMBER
  },
  {
    key: "recruitmentYear",
    label: "Recruitment Year",
    signal: RECRUITMENT_MATCH_SIGNALS.YEAR
  },
  {
    key: "eventType",
    label: "Event Type",
    signal: null
  },
  {
    key: "confidence",
    label: "Confidence",
    signal: null
  },
  {
    key: "matchedSignals",
    label: "Matched Signals",
    signal: null
  },
  {
    key: "conflictingSignals",
    label: "Conflicting Signals",
    signal: null
  }
]);

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayValue(value) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => String(item)).join(", ") : null;
  }
  return collapseWhitespace(value) || null;
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asSignalArray(value) {
  return Array.isArray(value) ? [...new Set(value.map((item) => String(item)))].sort() : [];
}

function pickFirstDisplay(...values) {
  for (const value of values) {
    const displayed = displayValue(value);
    if (displayed != null) return displayed;
  }
  return null;
}

function candidateSourceFromReviewItem(reviewItem = {}) {
  const processor = asPlainObject(reviewItem.processor_output);
  if (processor && asPlainObject(processor.selectedRecruitment)) {
    return processor.selectedRecruitment;
  }

  const payload = asPlainObject(reviewItem.payload);
  if (payload) {
    if (asPlainObject(payload.selectedRecruitment)) return payload.selectedRecruitment;
    if (asPlainObject(payload.selectedCandidate)) return payload.selectedCandidate;
    const reviewNested = asPlainObject(payload.reviewItem);
    if (reviewNested && asPlainObject(reviewNested.selectedRecruitment)) {
      return reviewNested.selectedRecruitment;
    }
  }

  return null;
}

function noticeSourceFromReviewItem(reviewItem = {}) {
  const raw = asPlainObject(reviewItem.raw_notice);
  if (!raw) return {};

  if (asPlainObject(raw.notice)) return raw.notice;
  return raw;
}

/**
 * Normalize side values for comparison display using matcher identity rules.
 * @param {Object} source
 * @returns {Object}
 */
function extractSideFields(source = {}) {
  const safeSource = asPlainObject(source) || {};
  const identity = normalizeRecruitmentIdentity(safeSource);
  return {
    organization: pickFirstDisplay(
      identity.organization,
      safeSource.organization,
      safeSource.department,
      safeSource.board
    ),
    examName: pickFirstDisplay(identity.examName, safeSource.exam_name, safeSource.examName),
    postName: pickFirstDisplay(identity.postName, safeSource.post_name, safeSource.postName),
    advertisementNo: pickFirstDisplay(
      identity.advertisementNo,
      safeSource.advertisement_no,
      safeSource.advertisementNo
    ),
    recruitmentYear: pickFirstDisplay(
      identity.recruitmentYear,
      safeSource.recruitment_year,
      safeSource.cycle_year,
      safeSource.recruitmentYear
    )
  };
}

/**
 * @param {string|null} signal
 * @param {string[]} matchedSignals
 * @param {string[]} conflictingSignals
 * @param {string|null} noticeValue
 * @param {string|null} candidateValue
 * @returns {string}
 */
function resolveFieldVisualStatus(
  signal,
  matchedSignals,
  conflictingSignals,
  noticeValue,
  candidateValue
) {
  if (!signal) {
    return FIELD_VISUAL_STATUS.NEUTRAL;
  }
  if (conflictingSignals.includes(signal)) {
    return FIELD_VISUAL_STATUS.CONFLICTING;
  }
  if (matchedSignals.includes(signal)) {
    return FIELD_VISUAL_STATUS.MATCHED;
  }
  if (noticeValue == null || candidateValue == null) {
    return FIELD_VISUAL_STATUS.MISSING;
  }
  return FIELD_VISUAL_STATUS.NEUTRAL;
}

/**
 * Build side-by-side comparison rows for admin UI.
 * @param {Object} reviewItem
 * @returns {Object}
 */
function buildReviewComparison(reviewItem = {}) {
  const matchResult = asPlainObject(reviewItem.match_result) || {};
  const matchedSignals = asSignalArray(matchResult.matchedSignals);
  const conflictingSignals = asSignalArray(matchResult.conflictingSignals);
  const confidence = pickFirstDisplay(reviewItem.confidence, matchResult.confidence);
  const eventType = pickFirstDisplay(reviewItem.event_type, reviewItem.eventType);

  const noticeFields = extractSideFields(noticeSourceFromReviewItem(reviewItem));
  const candidateFields = extractSideFields(candidateSourceFromReviewItem(reviewItem));

  const notice = {
    ...noticeFields,
    eventType,
    confidence,
    matchedSignals: matchedSignals.length ? matchedSignals.join(", ") : null,
    conflictingSignals: conflictingSignals.length ? conflictingSignals.join(", ") : null
  };

  const candidate = {
    ...candidateFields,
    eventType: null,
    confidence,
    matchedSignals: matchedSignals.length ? matchedSignals.join(", ") : null,
    conflictingSignals: conflictingSignals.length ? conflictingSignals.join(", ") : null
  };

  const rows = COMPARISON_FIELD_DEFS.map((field) => {
    const noticeValue = notice[field.key] ?? null;
    const candidateValue = candidate[field.key] ?? null;
    return {
      key: field.key,
      label: field.label,
      signal: field.signal,
      noticeValue: noticeValue == null ? "—" : noticeValue,
      candidateValue: candidateValue == null ? "—" : candidateValue,
      visualStatus: resolveFieldVisualStatus(
        field.signal,
        matchedSignals,
        conflictingSignals,
        noticeValue,
        candidateValue
      )
    };
  });

  return {
    notice,
    candidate,
    matchedSignals,
    conflictingSignals,
    confidence: confidence || null,
    eventType: eventType || null,
    recruitmentId: reviewItem.recruitment_id ?? reviewItem.recruitmentId ?? null,
    rows
  };
}

/**
 * History snapshot for admin UI (read-only).
 * @param {Object} reviewItem
 * @returns {Object}
 */
function buildReviewHistory(reviewItem = {}) {
  const status = pickFirstDisplay(reviewItem.status, reviewItem.review_status);
  return {
    createdAt: reviewItem.created_at ?? reviewItem.createdAt ?? null,
    status: status || null,
    decision: reviewItem.decision ?? null,
    notes: reviewItem.notes ?? null,
    frozen: String(status || "").toLowerCase() === "frozen"
  };
}

/**
 * Full Phase 29 assist payload for admin detail responses.
 * @param {Object} reviewItem
 * @returns {Object}
 */
function buildReviewAssistView(reviewItem = {}) {
  const matchResult = asPlainObject(reviewItem.match_result);
  const recommendation = recommendDecisionFromMatchResult(matchResult);
  return {
    recommendation,
    comparison: buildReviewComparison(reviewItem),
    history: buildReviewHistory(reviewItem)
  };
}

module.exports = {
  FIELD_VISUAL_STATUS,
  COMPARISON_FIELD_DEFS,
  buildReviewComparison,
  buildReviewHistory,
  buildReviewAssistView,
  resolveFieldVisualStatus,
  extractSideFields
};
