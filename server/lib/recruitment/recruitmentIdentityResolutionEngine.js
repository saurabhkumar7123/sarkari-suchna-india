"use strict";

/**
 * Phase 70 — Recruitment Identity Resolution Engine (Phase 1).
 *
 * First executable recruitment business engine that produces descriptive
 * identity resolution results from a Recruitment Context. Inspects available
 * and missing identity signals, determines workflow state, and recommends
 * manual review when appropriate.
 *
 * Does NOT perform recruitment matching, query databases, or assign
 * recruitment IDs.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  RECRUITMENT_CONTEXT_PHASE,
  DEFAULT_RECRUITMENT_CONTEXT,
  isRecruitmentContext
} = require("./recruitmentContext");

const IDENTITY_RESOLUTION_ENGINE_PHASE = 70;

const IDENTITY_RESOLUTION_STATES = Object.freeze({
  UNRESOLVED: "unresolved",
  INSUFFICIENT_INFORMATION: "insufficient_information",
  IDENTITY_ANCHOR_DETECTED: "identity_anchor_detected",
  READY_FOR_MATCHING: "ready_for_matching"
});

const SUPPORTED_RESOLUTION_STATES = Object.freeze(
  new Set(Object.values(IDENTITY_RESOLUTION_STATES))
);

const PRIMARY_SIGNAL_KEYS = Object.freeze([
  "advertisement_number",
  "official_identifier",
  "organization"
]);

const REQUIRED_SIGNAL_KEYS = Object.freeze(["recruitment_title"]);

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const ANCHOR_EVENT_IDS = Object.freeze({
  NOTIFICATION: "notification",
  SHORT_NOTIFICATION: "short_notification"
});

const IDENTITY_RESOLUTION_METADATA = Object.freeze({
  phase: IDENTITY_RESOLUTION_ENGINE_PHASE,
  descriptiveOnly: true,
  architectureOnly: false,
  runtimeIntegration: true,
  matchingExecution: false,
  persistenceEnabled: false,
  sideEffects: false,
  recruitmentContextPhase: RECRUITMENT_CONTEXT_PHASE,
  assignsRecruitmentIds: false,
  performsMatching: false
});

const IDENTITY_RESOLUTION_DESCRIPTOR = Object.freeze({
  entity: "recruitment_identity_resolution_result",
  domain: "recruitment",
  phase: IDENTITY_RESOLUTION_ENGINE_PHASE,
  description:
    "Descriptive identity resolution outcome derived from recruitment context signal observations.",
  resolutionStates: SUPPORTED_RESOLUTION_STATES,
  metadata: IDENTITY_RESOLUTION_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

const ORGANIZATION_PATTERNS = Object.freeze([
  { pattern: /\bstaff selection commission\b/i, value: "Staff Selection Commission" },
  { pattern: /\bunion public service commission\b/i, value: "Union Public Service Commission" },
  { pattern: /\bssc\b/i, value: "Staff Selection Commission" },
  { pattern: /\bupsc\b/i, value: "Union Public Service Commission" },
  { pattern: /\brrb\b/i, value: "Railway Recruitment Board" },
  { pattern: /\bibps\b/i, value: "Institute of Banking Personnel Selection" }
]);

const ADVERTISEMENT_NUMBER_PATTERNS = Object.freeze([
  /\badvt\.?\s*no\.?\s*([A-Za-z0-9\-/]+)/i,
  /\badvertisement\s*(?:no\.?|number)\s*([A-Za-z0-9\-/]+)/i,
  /\b([A-Z]{2,6}-\d{1,4}\/\d{4})\b/,
  /\bnotification\s*(?:no\.?|number)\s*([A-Za-z0-9\-/]+)/i
]);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

function getIdentitySignalKeys(context) {
  const ctx = isRecruitmentContext(context) ? context : DEFAULT_RECRUITMENT_CONTEXT;
  const keys = ctx.identity?.signalKeys;
  return Array.isArray(keys) && keys.length > 0
    ? keys
    : DEFAULT_RECRUITMENT_CONTEXT.identity.signalKeys;
}

function getObservedSignalsFromContext(context) {
  if (!isRecruitmentContext(context)) {
    return Object.freeze({});
  }
  const metadata = context.metadata;
  if (!isPlainObject(metadata)) {
    return Object.freeze({});
  }
  const observed = metadata.observedSignals;
  if (!isPlainObject(observed)) {
    return Object.freeze({});
  }
  const normalized = {};
  const keys = Object.keys(observed);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const value = normalizeString(observed[key]);
    if (value != null) {
      normalized[key] = value;
    }
  }
  return deepFreeze(normalized);
}

function getSupplementalText(context) {
  if (!isRecruitmentContext(context)) {
    return null;
  }
  const metadata = context.metadata;
  if (!isPlainObject(metadata)) {
    return null;
  }
  return (
    normalizeString(metadata.noticeContent) ??
    normalizeString(metadata.supplementalText) ??
    null
  );
}

function extractOrganization(text) {
  if (text == null) {
    return null;
  }
  for (let i = 0; i < ORGANIZATION_PATTERNS.length; i += 1) {
    const entry = ORGANIZATION_PATTERNS[i];
    if (entry.pattern.test(text)) {
      return entry.value;
    }
  }
  return null;
}

function extractAdvertisementNumber(text) {
  if (text == null) {
    return null;
  }
  for (let i = 0; i < ADVERTISEMENT_NUMBER_PATTERNS.length; i += 1) {
    const match = text.match(ADVERTISEMENT_NUMBER_PATTERNS[i]);
    if (match != null && match[1] != null) {
      return normalizeString(match[1]);
    }
  }
  return null;
}

function extractRecruitmentYear(text) {
  if (text == null) {
    return null;
  }
  const match = text.match(/\b(20\d{2})\b/);
  return match != null ? match[1] : null;
}

function looksLikeShortNotification(title, supplementalText) {
  const titleText = normalizeString(title);
  if (titleText == null) {
    return false;
  }
  const combined = supplementalText == null ? titleText : `${titleText} ${supplementalText}`;
  return (
    /\bshort\s+notice\b/i.test(combined) ||
    /\bshort\s+notification\b/i.test(combined) ||
    (titleText.length < 40 && /\bnotice\b/i.test(titleText))
  );
}

/**
 * Collect signal observations from recruitment context metadata and text heuristics.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function collectSignalObservations(context) {
  const observed = getObservedSignalsFromContext(context);
  const supplementalText = getSupplementalText(context);
  const title = observed.recruitment_title ?? null;
  const combinedText =
    title == null && supplementalText == null
      ? null
      : [title, supplementalText].filter((part) => part != null).join(" ");

  const observations = { ...observed };

  if (observations.organization == null && combinedText != null) {
    const organization = extractOrganization(combinedText);
    if (organization != null) {
      observations.organization = organization;
    }
  }

  if (observations.advertisement_number == null && combinedText != null) {
    const advertisementNumber = extractAdvertisementNumber(combinedText);
    if (advertisementNumber != null) {
      observations.advertisement_number = advertisementNumber;
    }
  }

  if (observations.recruitment_year == null && combinedText != null) {
    const recruitmentYear = extractRecruitmentYear(combinedText);
    if (recruitmentYear != null) {
      observations.recruitment_year = recruitmentYear;
    }
  }

  return deepFreeze(observations);
}

function partitionSignals(signalKeys, observations) {
  const available = [];
  const missing = [];

  for (let i = 0; i < signalKeys.length; i += 1) {
    const key = signalKeys[i];
    if (observations[key] != null) {
      available.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    available: Object.freeze(available.slice()),
    missing: Object.freeze(missing.slice())
  };
}

function countPrimarySignalsAvailable(availableSignals) {
  let count = 0;
  for (let i = 0; i < PRIMARY_SIGNAL_KEYS.length; i += 1) {
    if (availableSignals.includes(PRIMARY_SIGNAL_KEYS[i])) {
      count += 1;
    }
  }
  return count;
}

function determineAnchorEventId(title, supplementalText) {
  if (normalizeString(title) == null) {
    return null;
  }
  if (looksLikeShortNotification(title, supplementalText)) {
    return ANCHOR_EVENT_IDS.SHORT_NOTIFICATION;
  }
  return ANCHOR_EVENT_IDS.NOTIFICATION;
}

function determineConfidenceLevel(availableSignals, primaryCount, anchorEventId) {
  if (availableSignals.length === 0) {
    return CONFIDENCE_LEVELS.UNKNOWN;
  }

  if (
    primaryCount >= 2 &&
    availableSignals.includes("recruitment_title") &&
    anchorEventId === ANCHOR_EVENT_IDS.NOTIFICATION
  ) {
    return CONFIDENCE_LEVELS.HIGH;
  }

  if (
    availableSignals.includes("recruitment_title") &&
    (primaryCount >= 1 || anchorEventId != null)
  ) {
    return CONFIDENCE_LEVELS.MEDIUM;
  }

  if (availableSignals.length > 0) {
    return CONFIDENCE_LEVELS.LOW;
  }

  return CONFIDENCE_LEVELS.UNKNOWN;
}

function determineResolutionState(availableSignals, observations, anchorEventId) {
  if (availableSignals.length === 0) {
    return IDENTITY_RESOLUTION_STATES.UNRESOLVED;
  }

  const hasRequiredTitle = observations.recruitment_title != null;
  if (!hasRequiredTitle) {
    return IDENTITY_RESOLUTION_STATES.INSUFFICIENT_INFORMATION;
  }

  const primaryCount = countPrimarySignalsAvailable(availableSignals);

  if (
    primaryCount >= 2 ||
    (primaryCount >= 1 &&
      availableSignals.includes("source_url") &&
      anchorEventId === ANCHOR_EVENT_IDS.NOTIFICATION)
  ) {
    return IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING;
  }

  if (anchorEventId != null || primaryCount >= 1) {
    return IDENTITY_RESOLUTION_STATES.IDENTITY_ANCHOR_DETECTED;
  }

  return IDENTITY_RESOLUTION_STATES.INSUFFICIENT_INFORMATION;
}

function buildManualReviewRecommendation(resolutionState, anchorEventId, availableSignals) {
  const reasons = [];

  if (resolutionState === IDENTITY_RESOLUTION_STATES.UNRESOLVED) {
    reasons.push("NO_IDENTITY_SIGNALS_OBSERVED");
  }

  if (resolutionState === IDENTITY_RESOLUTION_STATES.INSUFFICIENT_INFORMATION) {
    reasons.push("MISSING_REQUIRED_IDENTITY_SIGNALS");
  }

  if (anchorEventId === ANCHOR_EVENT_IDS.SHORT_NOTIFICATION) {
    reasons.push("ALTERNATE_IDENTITY_ANCHOR_REQUIRES_CONFIRMATION");
  }

  if (
    resolutionState === IDENTITY_RESOLUTION_STATES.IDENTITY_ANCHOR_DETECTED &&
    !availableSignals.includes("advertisement_number")
  ) {
    reasons.push("MISSING_ADVERTISEMENT_NUMBER");
  }

  if (
    resolutionState === IDENTITY_RESOLUTION_STATES.IDENTITY_ANCHOR_DETECTED &&
    !availableSignals.includes("official_identifier")
  ) {
    reasons.push("MISSING_OFFICIAL_IDENTIFIER");
  }

  if (resolutionState !== IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING) {
    reasons.push("IDENTITY_NOT_READY_FOR_MATCHING");
  }

  const uniqueReasons = Object.freeze([...new Set(reasons)]);
  return deepFreeze({
    recommendsManualReview: uniqueReasons.length > 0,
    manualReviewReasons: uniqueReasons
  });
}

function buildValidationResult(reasons) {
  const normalizedReasons = Array.isArray(reasons)
    ? reasons.filter((reason) => typeof reason === "string" && reason.trim() !== "")
    : [];

  let status = VALIDATION_STATUS.VALID;
  if (normalizedReasons.length > 0) {
    status =
      normalizedReasons.some((reason) => reason.startsWith("MISSING_")) ||
      normalizedReasons.some((reason) => reason.startsWith("INVALID_"))
        ? VALIDATION_STATUS.INCOMPLETE
        : VALIDATION_STATUS.INVALID;
  }

  return deepFreeze({
    valid: normalizedReasons.length === 0,
    status,
    reasons: Object.freeze(normalizedReasons.slice())
  });
}

/**
 * Create a descriptive identity resolution result from a recruitment context.
 * Pure: no matching, no persistence, no recruitment ID assignment.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>|null}
 */
function createIdentityResolutionResult(context) {
  try {
    const recruitmentContext = isRecruitmentContext(context)
      ? context
      : DEFAULT_RECRUITMENT_CONTEXT;

    const signalKeys = getIdentitySignalKeys(recruitmentContext);
    const observations = collectSignalObservations(recruitmentContext);
    const { available, missing } = partitionSignals(signalKeys, observations);
    const supplementalText = getSupplementalText(recruitmentContext);
    const anchorEventId = determineAnchorEventId(
      observations.recruitment_title,
      supplementalText
    );
    const resolutionState = determineResolutionState(available, observations, anchorEventId);
    const primarySignalCount = countPrimarySignalsAvailable(available);
    const confidenceLevel = determineConfidenceLevel(available, primarySignalCount, anchorEventId);
    const manualReview = buildManualReviewRecommendation(
      resolutionState,
      anchorEventId,
      available
    );

    return deepFreeze({
      phase: IDENTITY_RESOLUTION_ENGINE_PHASE,
      entity: IDENTITY_RESOLUTION_DESCRIPTOR.entity,
      descriptiveOnly: true,
      matchingExecution: false,
      persistenceEnabled: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      performsMatching: false,
      recruitmentContextPhase: recruitmentContext.phase,
      recruitmentContextEntity: recruitmentContext.entity,
      resolutionState,
      availableSignals: available,
      missingSignals: missing,
      signalObservations: observations,
      requiredSignalKeys: REQUIRED_SIGNAL_KEYS,
      primarySignalKeys: PRIMARY_SIGNAL_KEYS,
      anchorEventId,
      confidenceLevel,
      recommendsManualReview: manualReview.recommendsManualReview,
      manualReviewReasons: manualReview.manualReviewReasons,
      primarySignalCount,
      signalCount: available.length,
      metadata: deepFreeze({
        ...IDENTITY_RESOLUTION_METADATA,
        createReason: isRecruitmentContext(context) ? "context" : "default",
        observedSignalCount: Object.keys(getObservedSignalsFromContext(recruitmentContext)).length,
        supplementalTextPresent: supplementalText != null
      })
    });
  } catch {
    return null;
  }
}

/**
 * Resolve recruitment identity from a recruitment context.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>|null}
 */
function resolveRecruitmentIdentity(context) {
  return createIdentityResolutionResult(context);
}

/**
 * @param {*} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateIdentityResolution(result) {
  const reasons = [];

  if (!isPlainObject(result)) {
    return buildValidationResult(["INVALID_RESULT_SHAPE"]);
  }

  if (result.phase !== IDENTITY_RESOLUTION_ENGINE_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (result.entity !== IDENTITY_RESOLUTION_DESCRIPTOR.entity) {
    reasons.push("INVALID_ENTITY");
  }

  if (!SUPPORTED_RESOLUTION_STATES.has(result.resolutionState)) {
    reasons.push("INVALID_RESOLUTION_STATE");
  }

  if (result.matchingExecution !== false || result.performsMatching !== false) {
    reasons.push("MATCHING_EXECUTION_MUST_BE_FALSE");
  }

  if (result.assignsRecruitmentIds !== false) {
    reasons.push("ASSIGNS_RECRUITMENT_IDS_MUST_BE_FALSE");
  }

  if (result.persistenceEnabled !== false || result.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (!Array.isArray(result.availableSignals) || !Array.isArray(result.missingSignals)) {
    reasons.push("INVALID_SIGNAL_LISTS");
  }

  if (!isPlainObject(result.signalObservations)) {
    reasons.push("MISSING_SIGNAL_OBSERVATIONS");
  }

  if (typeof result.recommendsManualReview !== "boolean") {
    reasons.push("INVALID_MANUAL_REVIEW_FLAG");
  }

  if (!Array.isArray(result.manualReviewReasons)) {
    reasons.push("INVALID_MANUAL_REVIEW_REASONS");
  }

  if (
    result.recommendsManualReview === false &&
    result.resolutionState !== IDENTITY_RESOLUTION_STATES.READY_FOR_MATCHING
  ) {
    reasons.push("MANUAL_REVIEW_FLAG_INCONSISTENT_WITH_STATE");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeIdentityResolution(result) {
  const validation = validateIdentityResolution(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: IDENTITY_RESOLUTION_ENGINE_PHASE,
      entity: IDENTITY_RESOLUTION_DESCRIPTOR.entity,
      valid: false,
      resolutionState: IDENTITY_RESOLUTION_STATES.UNRESOLVED,
      signalCount: 0,
      primarySignalCount: 0,
      recommendsManualReview: true,
      manualReviewReasonCount: 0,
      anchorEventId: null,
      confidenceLevel: CONFIDENCE_LEVELS.UNKNOWN,
      matchingExecution: false,
      assignsRecruitmentIds: false
    });
  }

  return Object.freeze({
    phase: result.phase,
    entity: result.entity,
    valid: true,
    resolutionState: result.resolutionState,
    signalCount: result.signalCount,
    primarySignalCount: result.primarySignalCount,
    recommendsManualReview: result.recommendsManualReview,
    manualReviewReasonCount: result.manualReviewReasons.length,
    anchorEventId: result.anchorEventId,
    confidenceLevel: result.confidenceLevel,
    matchingExecution: false,
    assignsRecruitmentIds: false
  });
}

module.exports = {
  IDENTITY_RESOLUTION_ENGINE_PHASE,
  IDENTITY_RESOLUTION_STATES,
  SUPPORTED_RESOLUTION_STATES,
  PRIMARY_SIGNAL_KEYS,
  REQUIRED_SIGNAL_KEYS,
  CONFIDENCE_LEVELS,
  ANCHOR_EVENT_IDS,
  IDENTITY_RESOLUTION_DESCRIPTOR,
  IDENTITY_RESOLUTION_METADATA,
  VALIDATION_STATUS,
  collectSignalObservations,
  createIdentityResolutionResult,
  resolveRecruitmentIdentity,
  validateIdentityResolution,
  summarizeIdentityResolution
};
