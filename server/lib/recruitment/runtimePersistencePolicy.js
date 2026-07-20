"use strict";

/**
 * Phase 33 — Safe Runtime Persistence Policy (architecture only).
 *
 * Deterministic decision module for what runtime *should* do next.
 * Never persists. Never enqueues. No DB, filesystem, Express, or queue access.
 * Automatic persistence remains disabled unless callers explicitly pass
 * featureFlags.automaticPersistenceEnabled === true (not wired in production).
 */

const {
  LIFECYCLE_EVENT_TYPES,
  UNKNOWN_EVENT_TYPE
} = require("./eventTypeClassifier");

/** Aligned with recruitment.service.LIFECYCLE_STATES (no import coupling). */
const SUPPORTED_LIFECYCLE_STATES = Object.freeze([
  "announced",
  "open",
  "exam_scheduled",
  "post_exam",
  "results",
  "closed"
]);

const PERSISTENCE_ACTIONS = Object.freeze({
  PERSIST: "persist",
  REVIEW: "review",
  PREVIEW_ONLY: "preview_only",
  SKIP: "skip"
});

const RUNTIME_MODES = Object.freeze({
  LIVE: "live",
  PREVIEW: "preview",
  DRY_RUN: "dry_run"
});

const PERSISTENCE_REASONS = Object.freeze({
  INVALID_CONTEXT: "INVALID_CONTEXT",
  PIPELINE_DISABLED: "PIPELINE_DISABLED",
  AUTOMATION_DISABLED: "AUTOMATION_DISABLED",
  PREVIEW_MODE: "PREVIEW_MODE",
  DRY_RUN_MODE: "DRY_RUN_MODE",
  ELIGIBLE_HIGH_CONFIDENCE: "ELIGIBLE_HIGH_CONFIDENCE",
  ELIGIBILITY_MANUAL_REVIEW: "ELIGIBILITY_MANUAL_REVIEW",
  ELIGIBILITY_INELIGIBLE: "ELIGIBILITY_INELIGIBLE",
  ELIGIBILITY_MISSING: "ELIGIBILITY_MISSING",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  MEDIUM_CONFIDENCE: "MEDIUM_CONFIDENCE",
  LOW_OR_NONE_CONFIDENCE: "LOW_OR_NONE_CONFIDENCE",
  UNKNOWN_EVENT: "UNKNOWN_EVENT",
  UNSUPPORTED_LIFECYCLE_STATE: "UNSUPPORTED_LIFECYCLE_STATE",
  EXISTING_RECRUITMENT_MATCH: "EXISTING_RECRUITMENT_MATCH",
  KNOWN_LIFECYCLE_EVENT: "KNOWN_LIFECYCLE_EVENT",
  SUPPORTED_LIFECYCLE_STATE: "SUPPORTED_LIFECYCLE_STATE",
  MATCH_TRUE: "MATCH_TRUE",
  SAFE_DEFAULT_PREVIEW: "SAFE_DEFAULT_PREVIEW"
});

const KNOWN_EVENT_TYPES = Object.freeze(new Set(LIFECYCLE_EVENT_TYPES));
const SUPPORTED_STATE_SET = Object.freeze(new Set(SUPPORTED_LIFECYCLE_STATES));

/**
 * @typedef {Object} PersistenceFeatureFlags
 * @property {boolean} [pipelineEnabled]
 * @property {boolean} [automaticPersistenceEnabled]
 * @property {boolean} [reviewQueueEnqueueEnabled]
 */

/**
 * @typedef {Object} EligibilityLike
 * @property {boolean} [eligible]
 * @property {string} [status]
 * @property {string[]} [reasons]
 * @property {string|null} [confidence]
 * @property {string|null} [eventType]
 */

/**
 * @typedef {Object} MatchResultLike
 * @property {boolean|string} [match]
 * @property {string} [confidence]
 * @property {string[]} [matchedSignals]
 * @property {string[]} [conflictingSignals]
 */

/**
 * @typedef {Object} RuntimePersistencePolicyContext
 * @property {PersistenceFeatureFlags} [featureFlags]
 * @property {string} [runtimeMode]
 * @property {boolean} [previewMode]
 * @property {EligibilityLike|null} [eligibility]
 * @property {boolean} [reviewRequired]
 * @property {string} [matcherConfidence]
 * @property {MatchResultLike|null} [matchResult]
 * @property {Object|string|number|null} [existingRecruitmentMatch]
 * @property {string|null} [eventType]
 * @property {string|null} [lifecycleState]
 * @property {string[]} [supportedLifecycleStates]
 */

/**
 * @typedef {Object} PersistencePolicyDecision
 * @property {string} action
 * @property {string} reason
 * @property {string[]} reasons
 * @property {Object} metadata
 */

function sortReasons(reasons) {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function asBool(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value === true;
}

function normalizeMode(value) {
  if (value == null || value === "") {
    return null;
  }
  return String(value).trim().toLowerCase();
}

function normalizeConfidence(context) {
  if (context.matcherConfidence != null && context.matcherConfidence !== "") {
    return String(context.matcherConfidence).toLowerCase();
  }
  const matchResult = context.matchResult;
  if (
    matchResult &&
    typeof matchResult === "object" &&
    !Array.isArray(matchResult) &&
    matchResult.confidence != null &&
    matchResult.confidence !== ""
  ) {
    return String(matchResult.confidence).toLowerCase();
  }
  const eligibility = context.eligibility;
  if (
    eligibility &&
    typeof eligibility === "object" &&
    !Array.isArray(eligibility) &&
    eligibility.confidence != null &&
    eligibility.confidence !== ""
  ) {
    return String(eligibility.confidence).toLowerCase();
  }
  return null;
}

function normalizeEventType(context) {
  if (context.eventType != null && context.eventType !== "") {
    return String(context.eventType);
  }
  const eligibility = context.eligibility;
  if (
    eligibility &&
    typeof eligibility === "object" &&
    !Array.isArray(eligibility) &&
    eligibility.eventType != null &&
    eligibility.eventType !== ""
  ) {
    return String(eligibility.eventType);
  }
  return null;
}

function normalizeEligibilityStatus(eligibility) {
  if (!eligibility || typeof eligibility !== "object" || Array.isArray(eligibility)) {
    return null;
  }
  if (eligibility.status != null && eligibility.status !== "") {
    return String(eligibility.status).toLowerCase();
  }
  if (eligibility.eligible === true) {
    return "eligible";
  }
  if (eligibility.eligible === false) {
    return "ineligible";
  }
  return null;
}

function hasExistingRecruitmentMatch(value) {
  if (value == null || value === false) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

function resolveSupportedStates(context) {
  if (Array.isArray(context.supportedLifecycleStates)) {
    return new Set(
      context.supportedLifecycleStates
        .filter((s) => s != null && s !== "")
        .map((s) => String(s).toLowerCase())
    );
  }
  return SUPPORTED_STATE_SET;
}

function buildDecision({ action, reasons, metadata }) {
  const sorted = sortReasons(reasons);
  return {
    action,
    reason: sorted[0] || PERSISTENCE_REASONS.SAFE_DEFAULT_PREVIEW,
    reasons: sorted,
    metadata
  };
}

function buildMetadata(base, extras) {
  return {
    automationEnabled: base.automationEnabled,
    reviewQueueEnqueueEnabled: base.reviewQueueEnqueueEnabled,
    pipelineEnabled: base.pipelineEnabled,
    previewMode: base.previewMode,
    runtimeMode: base.runtimeMode,
    eligibilityStatus: base.eligibilityStatus,
    confidence: base.confidence,
    eventType: base.eventType,
    lifecycleState: base.lifecycleState,
    reviewRequired: base.reviewRequired,
    hasExistingRecruitmentMatch: base.hasExistingMatch,
    intendedAction: extras.intendedAction,
    wouldPersistIfAutomationEnabled: extras.wouldPersistIfAutomationEnabled === true,
    wouldReviewIfEnqueueEnabled: extras.wouldReviewIfEnqueueEnabled === true
  };
}

/**
 * Decide what runtime should do. Pure: no I/O, no mutation, no persistence.
 *
 * Fail-safe defaults:
 * - automaticPersistenceEnabled → false
 * - reviewQueueEnqueueEnabled → false
 * - pipelineEnabled → true when omitted (caller typically gates already)
 *
 * @param {RuntimePersistencePolicyContext|null|undefined} context
 * @returns {PersistencePolicyDecision}
 */
function evaluateRuntimePersistencePolicy(context) {
  if (context == null || typeof context !== "object" || Array.isArray(context)) {
    return buildDecision({
      action: PERSISTENCE_ACTIONS.SKIP,
      reasons: [PERSISTENCE_REASONS.INVALID_CONTEXT],
      metadata: buildMetadata(
        {
          automationEnabled: false,
          reviewQueueEnqueueEnabled: false,
          pipelineEnabled: false,
          previewMode: false,
          runtimeMode: null,
          eligibilityStatus: null,
          confidence: null,
          eventType: null,
          lifecycleState: null,
          reviewRequired: false,
          hasExistingMatch: false
        },
        {
          intendedAction: PERSISTENCE_ACTIONS.SKIP,
          wouldPersistIfAutomationEnabled: false,
          wouldReviewIfEnqueueEnabled: false
        }
      )
    });
  }

  const flags =
    context.featureFlags &&
    typeof context.featureFlags === "object" &&
    !Array.isArray(context.featureFlags)
      ? context.featureFlags
      : {};

  const pipelineEnabled = asBool(flags.pipelineEnabled, true);
  const automationEnabled = asBool(flags.automaticPersistenceEnabled, false);
  const reviewQueueEnqueueEnabled = asBool(flags.reviewQueueEnqueueEnabled, false);
  const previewMode = asBool(context.previewMode, false);
  const runtimeMode = normalizeMode(context.runtimeMode);
  const reviewRequired = asBool(context.reviewRequired, false);
  const confidence = normalizeConfidence(context);
  const eventType = normalizeEventType(context);
  const eligibilityStatus = normalizeEligibilityStatus(context.eligibility);
  const lifecycleState =
    context.lifecycleState != null && context.lifecycleState !== ""
      ? String(context.lifecycleState).toLowerCase()
      : null;
  const hasExistingMatch = hasExistingRecruitmentMatch(context.existingRecruitmentMatch);
  const supportedStates = resolveSupportedStates(context);

  const baseMeta = {
    automationEnabled,
    reviewQueueEnqueueEnabled,
    pipelineEnabled,
    previewMode,
    runtimeMode,
    eligibilityStatus,
    confidence,
    eventType,
    lifecycleState,
    reviewRequired,
    hasExistingMatch
  };

  const isKnownEvent =
    eventType != null &&
    eventType !== UNKNOWN_EVENT_TYPE &&
    KNOWN_EVENT_TYPES.has(eventType);

  const matchResult =
    context.matchResult &&
    typeof context.matchResult === "object" &&
    !Array.isArray(context.matchResult)
      ? context.matchResult
      : null;
  const matchValue = matchResult ? matchResult.match : undefined;

  // --- Hard skip gates ---
  if (!pipelineEnabled) {
    return buildDecision({
      action: PERSISTENCE_ACTIONS.SKIP,
      reasons: [PERSISTENCE_REASONS.PIPELINE_DISABLED],
      metadata: buildMetadata(baseMeta, {
        intendedAction: PERSISTENCE_ACTIONS.SKIP,
        wouldPersistIfAutomationEnabled: false,
        wouldReviewIfEnqueueEnabled: false
      })
    });
  }

  if (hasExistingMatch) {
    return buildDecision({
      action: PERSISTENCE_ACTIONS.SKIP,
      reasons: [PERSISTENCE_REASONS.EXISTING_RECRUITMENT_MATCH],
      metadata: buildMetadata(baseMeta, {
        intendedAction: PERSISTENCE_ACTIONS.SKIP,
        wouldPersistIfAutomationEnabled: false,
        wouldReviewIfEnqueueEnabled: false
      })
    });
  }

  if (lifecycleState != null && !supportedStates.has(lifecycleState)) {
    return buildDecision({
      action: PERSISTENCE_ACTIONS.SKIP,
      reasons: [PERSISTENCE_REASONS.UNSUPPORTED_LIFECYCLE_STATE],
      metadata: buildMetadata(baseMeta, {
        intendedAction: PERSISTENCE_ACTIONS.SKIP,
        wouldPersistIfAutomationEnabled: false,
        wouldReviewIfEnqueueEnabled: false
      })
    });
  }

  if (eligibilityStatus === "ineligible") {
    return buildDecision({
      action: PERSISTENCE_ACTIONS.SKIP,
      reasons: [PERSISTENCE_REASONS.ELIGIBILITY_INELIGIBLE],
      metadata: buildMetadata(baseMeta, {
        intendedAction: PERSISTENCE_ACTIONS.SKIP,
        wouldPersistIfAutomationEnabled: false,
        wouldReviewIfEnqueueEnabled: false
      })
    });
  }

  // --- Intended action from quality signals ---
  const intendedReasons = [];
  let intendedAction = PERSISTENCE_ACTIONS.PREVIEW_ONLY;

  const needsReview =
    reviewRequired === true ||
    eligibilityStatus == null ||
    eligibilityStatus === "manual_review" ||
    confidence === "medium" ||
    confidence === "low" ||
    confidence === "none" ||
    confidence === "" ||
    confidence == null ||
    !isKnownEvent ||
    matchValue === "unknown" ||
    (matchValue !== true && eligibilityStatus !== "eligible");

  const canPersist =
    eligibilityStatus === "eligible" &&
    confidence === "high" &&
    isKnownEvent &&
    reviewRequired !== true &&
    (matchValue === true || matchValue === undefined) &&
    (lifecycleState == null || supportedStates.has(lifecycleState));

  if (canPersist) {
    intendedAction = PERSISTENCE_ACTIONS.PERSIST;
    intendedReasons.push(PERSISTENCE_REASONS.ELIGIBLE_HIGH_CONFIDENCE);
    intendedReasons.push(PERSISTENCE_REASONS.KNOWN_LIFECYCLE_EVENT);
    if (matchValue === true) {
      intendedReasons.push(PERSISTENCE_REASONS.MATCH_TRUE);
    }
    if (lifecycleState != null) {
      intendedReasons.push(PERSISTENCE_REASONS.SUPPORTED_LIFECYCLE_STATE);
    }
  } else if (needsReview) {
    intendedAction = PERSISTENCE_ACTIONS.REVIEW;
    if (reviewRequired) {
      intendedReasons.push(PERSISTENCE_REASONS.REVIEW_REQUIRED);
    }
    if (eligibilityStatus === "manual_review") {
      intendedReasons.push(PERSISTENCE_REASONS.ELIGIBILITY_MANUAL_REVIEW);
    }
    if (eligibilityStatus == null) {
      intendedReasons.push(PERSISTENCE_REASONS.ELIGIBILITY_MISSING);
    }
    if (confidence === "medium") {
      intendedReasons.push(PERSISTENCE_REASONS.MEDIUM_CONFIDENCE);
    }
    if (
      confidence === "low" ||
      confidence === "none" ||
      confidence === "" ||
      confidence == null
    ) {
      intendedReasons.push(PERSISTENCE_REASONS.LOW_OR_NONE_CONFIDENCE);
    }
    if (!isKnownEvent) {
      intendedReasons.push(PERSISTENCE_REASONS.UNKNOWN_EVENT);
    }
    if (intendedReasons.length === 0) {
      intendedReasons.push(PERSISTENCE_REASONS.ELIGIBILITY_MANUAL_REVIEW);
    }
  } else {
    intendedAction = PERSISTENCE_ACTIONS.PREVIEW_ONLY;
    intendedReasons.push(PERSISTENCE_REASONS.SAFE_DEFAULT_PREVIEW);
  }

  const wouldPersistIfAutomationEnabled =
    intendedAction === PERSISTENCE_ACTIONS.PERSIST;
  const wouldReviewIfEnqueueEnabled = intendedAction === PERSISTENCE_ACTIONS.REVIEW;

  // --- Safety overlay (Phase 33: automation off by default) ---
  const overlayReasons = [...intendedReasons];
  let action = intendedAction;

  if (previewMode) {
    if (action === PERSISTENCE_ACTIONS.PERSIST || action === PERSISTENCE_ACTIONS.REVIEW) {
      action = PERSISTENCE_ACTIONS.PREVIEW_ONLY;
      overlayReasons.push(PERSISTENCE_REASONS.PREVIEW_MODE);
    }
  } else if (runtimeMode === RUNTIME_MODES.PREVIEW) {
    if (action === PERSISTENCE_ACTIONS.PERSIST || action === PERSISTENCE_ACTIONS.REVIEW) {
      action = PERSISTENCE_ACTIONS.PREVIEW_ONLY;
      overlayReasons.push(PERSISTENCE_REASONS.PREVIEW_MODE);
    }
  } else if (runtimeMode === RUNTIME_MODES.DRY_RUN) {
    if (action === PERSISTENCE_ACTIONS.PERSIST || action === PERSISTENCE_ACTIONS.REVIEW) {
      action = PERSISTENCE_ACTIONS.PREVIEW_ONLY;
      overlayReasons.push(PERSISTENCE_REASONS.DRY_RUN_MODE);
    }
  }

  // Persist requires an explicit automation enablement flag (off by default).
  if (action === PERSISTENCE_ACTIONS.PERSIST && !automationEnabled) {
    action = PERSISTENCE_ACTIONS.PREVIEW_ONLY;
    overlayReasons.push(PERSISTENCE_REASONS.AUTOMATION_DISABLED);
  }

  // REVIEW without enqueue enablement remains an advisory decision only —
  // this module never writes. Callers must not treat REVIEW as a side effect.

  return buildDecision({
    action,
    reasons: overlayReasons,
    metadata: buildMetadata(baseMeta, {
      intendedAction,
      wouldPersistIfAutomationEnabled,
      wouldReviewIfEnqueueEnabled
    })
  });
}

module.exports = {
  PERSISTENCE_ACTIONS,
  PERSISTENCE_REASONS,
  RUNTIME_MODES,
  SUPPORTED_LIFECYCLE_STATES,
  evaluateRuntimePersistencePolicy
};
