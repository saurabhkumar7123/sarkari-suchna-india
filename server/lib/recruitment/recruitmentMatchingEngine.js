"use strict";

/**
 * Phase 71 — Recruitment Matching Engine (Phase 1).
 *
 * First executable matching engine that consumes Identity Resolution Results
 * and produces deterministic advisory Matching Results. Classifies observable
 * identity signals against Phase 66 matching profiles and recommends manual
 * review where appropriate.
 *
 * Does NOT query databases, assign recruitment IDs, or perform persistence.
 *
 * No Express. No database. No filesystem. No network access.
 */

const {
  IDENTITY_RESOLUTION_ENGINE_PHASE,
  IDENTITY_RESOLUTION_STATES,
  ANCHOR_EVENT_IDS,
  validateIdentityResolution,
  createIdentityResolutionResult
} = require("./recruitmentIdentityResolutionEngine");

const {
  MATCHING_CONTRACTS_PHASE,
  MATCH_CATEGORIES,
  SUPPORTED_MATCH_CATEGORIES,
  DEFAULT_MATCH_CATEGORY,
  MATCH_CATEGORY_DESCRIPTOR,
  MATCHING_PROFILES,
  MATCHING_PROFILE_BY_ID,
  MANUAL_REVIEW_SCENARIO_BY_ID,
  isMatchCategory,
  isMatchingProfile,
  isManualReviewScenario
} = require("./recruitmentMatchingContracts");

const MATCHING_ENGINE_PHASE = 71;

const MATCHING_RESULT_ENTITY = "recruitment_matching_result";

const PROFILE_MATCH_ORDER = Object.freeze(
  MATCHING_PROFILES.slice()
    .filter(
      (profile) =>
        profile.id !== "manual_review_ambiguous" &&
        profile.id !== "no_shared_identity_signals"
    )
    .sort((left, right) => left.order - right.order)
);

const CORROBORATING_SIGNAL_KEYS = Object.freeze([
  "post_name",
  "department",
  "source_url",
  "examination_name"
]);

const MANUAL_REVIEW_REASON_TO_SCENARIO = Object.freeze({
  NO_IDENTITY_SIGNALS_OBSERVED: "insufficient_identity_signals",
  MISSING_REQUIRED_IDENTITY_SIGNALS: "insufficient_identity_signals",
  ALTERNATE_IDENTITY_ANCHOR_REQUIRES_CONFIRMATION: "insufficient_identity_signals",
  MISSING_ADVERTISEMENT_NUMBER: "insufficient_identity_signals",
  MISSING_OFFICIAL_IDENTIFIER: "insufficient_identity_signals",
  IDENTITY_NOT_READY_FOR_MATCHING: "insufficient_identity_signals"
});

const MATCHING_RESULT_METADATA = Object.freeze({
  phase: MATCHING_ENGINE_PHASE,
  descriptiveOnly: true,
  architectureOnly: false,
  runtimeIntegration: true,
  matchingExecution: false,
  persistenceEnabled: false,
  sideEffects: false,
  identityResolutionPhase: IDENTITY_RESOLUTION_ENGINE_PHASE,
  matchingContractsPhase: MATCHING_CONTRACTS_PHASE,
  assignsRecruitmentIds: false,
  queriesDatabase: false,
  performsPersistence: false
});

const MATCHING_RESULT_DESCRIPTOR = Object.freeze({
  entity: MATCHING_RESULT_ENTITY,
  domain: "recruitment",
  phase: MATCHING_ENGINE_PHASE,
  description:
    "Deterministic advisory matching outcome derived from identity resolution signal observations.",
  supportedCategories: SUPPORTED_MATCH_CATEGORIES,
  metadata: MATCHING_RESULT_METADATA
});

const VALIDATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  INCOMPLETE: "incomplete"
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
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

function normalizeIdentityResolution(identityResolution) {
  if (validateIdentityResolution(identityResolution).valid) {
    return identityResolution;
  }
  return createIdentityResolutionResult(null);
}

function getSignalObservations(identityResolution) {
  const observations = identityResolution?.signalObservations;
  if (!isPlainObject(observations)) {
    return Object.freeze({});
  }
  return observations;
}

function hasRequiredSignals(observations, requiredSignals) {
  if (!Array.isArray(requiredSignals) || requiredSignals.length === 0) {
    return false;
  }
  for (let i = 0; i < requiredSignals.length; i += 1) {
    const key = requiredSignals[i];
    if (observations[key] == null) {
      return false;
    }
  }
  return true;
}

function collectContributingSignalKeys(profile, observations) {
  const keys = [];
  const required = Array.isArray(profile?.requiredSignals) ? profile.requiredSignals : [];
  const optional = Array.isArray(profile?.optionalSignals) ? profile.optionalSignals : [];
  const candidates = [...required, ...optional];

  for (let i = 0; i < candidates.length; i += 1) {
    const key = candidates[i];
    if (observations[key] != null && !keys.includes(key)) {
      keys.push(key);
    }
  }

  for (let i = 0; i < required.length; i += 1) {
    const key = required[i];
    if (observations[key] != null && !keys.includes(key)) {
      keys.unshift(key);
    }
  }

  return Object.freeze(keys.slice());
}

function resolveManualReviewScenario(identityResolution) {
  const reasons = Array.isArray(identityResolution?.manualReviewReasons)
    ? identityResolution.manualReviewReasons
    : [];

  for (let i = 0; i < reasons.length; i += 1) {
    const scenarioId = MANUAL_REVIEW_REASON_TO_SCENARIO[reasons[i]];
    if (scenarioId != null && isManualReviewScenario(scenarioId)) {
      return scenarioId;
    }
  }

  if (identityResolution?.anchorEventId === ANCHOR_EVENT_IDS.SHORT_NOTIFICATION) {
    return "insufficient_identity_signals";
  }

  if (
    identityResolution?.resolutionState === IDENTITY_RESOLUTION_STATES.UNRESOLVED ||
    identityResolution?.resolutionState === IDENTITY_RESOLUTION_STATES.INSUFFICIENT_INFORMATION
  ) {
    return "insufficient_identity_signals";
  }

  return "insufficient_identity_signals";
}

function findBestMatchingProfile(observations) {
  for (let i = 0; i < PROFILE_MATCH_ORDER.length; i += 1) {
    const profile = PROFILE_MATCH_ORDER[i];
    if (hasRequiredSignals(observations, profile.requiredSignals)) {
      return profile;
    }
  }
  return null;
}

function buildManualReviewEvaluation(identityResolution) {
  const reviewScenarioId = resolveManualReviewScenario(identityResolution);
  const profile = MATCHING_PROFILE_BY_ID.manual_review_ambiguous;
  const observations = getSignalObservations(identityResolution);
  const contributingSignalKeys = Object.freeze(
    (identityResolution?.availableSignals ?? []).slice()
  );

  return deepFreeze({
    matchCategory: MATCH_CATEGORIES.MANUAL_REVIEW,
    profileId: profile.id,
    reviewScenarioId,
    contributingSignalKeys,
    recommendsManualReview: true,
    manualReviewReasons: Object.freeze(
      (identityResolution?.manualReviewReasons ?? []).slice()
    ),
    identityResolutionPhase: identityResolution?.phase ?? IDENTITY_RESOLUTION_ENGINE_PHASE,
    resolutionState:
      identityResolution?.resolutionState ?? IDENTITY_RESOLUTION_STATES.UNRESOLVED,
    matchedProfileOrder: profile.order,
    advisoryLabel: MATCH_CATEGORY_DESCRIPTOR.advisoryLabels.manual_review
  });
}

function buildProfileEvaluation(profile, observations, identityResolution) {
  const contributingSignalKeys = collectContributingSignalKeys(profile, observations);

  return deepFreeze({
    matchCategory: profile.category,
    profileId: profile.id,
    reviewScenarioId: null,
    contributingSignalKeys,
    recommendsManualReview: false,
    manualReviewReasons: Object.freeze([]),
    identityResolutionPhase: identityResolution.phase,
    resolutionState: identityResolution.resolutionState,
    matchedProfileOrder: profile.order,
    advisoryLabel: MATCH_CATEGORY_DESCRIPTOR.advisoryLabels[profile.category] ?? null
  });
}

function buildNoMatchEvaluation(identityResolution) {
  const profile = MATCHING_PROFILE_BY_ID.no_shared_identity_signals;
  const observations = getSignalObservations(identityResolution);

  return deepFreeze({
    matchCategory: MATCH_CATEGORIES.NO_MATCH,
    profileId: profile.id,
    reviewScenarioId: null,
    contributingSignalKeys: Object.freeze([]),
    recommendsManualReview: false,
    manualReviewReasons: Object.freeze([]),
    identityResolutionPhase: identityResolution?.phase ?? IDENTITY_RESOLUTION_ENGINE_PHASE,
    resolutionState:
      identityResolution?.resolutionState ?? IDENTITY_RESOLUTION_STATES.UNRESOLVED,
    matchedProfileOrder: profile.order,
    advisoryLabel: MATCH_CATEGORY_DESCRIPTOR.advisoryLabels.no_match
  });
}

function buildFallbackEvaluation(identityResolution, observations) {
  const availableSignals = Array.isArray(identityResolution?.availableSignals)
    ? identityResolution.availableSignals
    : [];

  if (availableSignals.length === 0) {
    return buildNoMatchEvaluation(identityResolution);
  }

  if (hasRequiredSignals(observations, ["post_name"])) {
    return buildProfileEvaluation(
      MATCHING_PROFILE_BY_ID.corroborating_only_weak,
      observations,
      identityResolution
    );
  }

  if (hasRequiredSignals(observations, ["recruitment_title", "recruitment_year"])) {
    return buildProfileEvaluation(
      MATCHING_PROFILE_BY_ID.title_year_weak,
      observations,
      identityResolution
    );
  }

  return buildManualReviewEvaluation({
    ...identityResolution,
    recommendsManualReview: true,
    manualReviewReasons: Object.freeze(["INSUFFICIENT_PROFILE_SIGNAL_COMBINATION"])
  });
}

/**
 * Evaluate advisory match category from an identity resolution result.
 * Pure: deterministic, no I/O.
 *
 * @param {Object|null|undefined} identityResolution
 * @returns {Readonly<Object>}
 */
function evaluateRecruitmentMatch(identityResolution) {
  try {
    const resolution = normalizeIdentityResolution(identityResolution);
    const observations = getSignalObservations(resolution);

    if (resolution.recommendsManualReview === true) {
      return buildManualReviewEvaluation(resolution);
    }

    const matchedProfile = findBestMatchingProfile(observations);
    if (matchedProfile != null) {
      return buildProfileEvaluation(matchedProfile, observations, resolution);
    }

    return buildFallbackEvaluation(resolution, observations);
  } catch {
    return buildManualReviewEvaluation({
      phase: IDENTITY_RESOLUTION_ENGINE_PHASE,
      resolutionState: IDENTITY_RESOLUTION_STATES.UNRESOLVED,
      recommendsManualReview: true,
      manualReviewReasons: Object.freeze(["NO_IDENTITY_SIGNALS_OBSERVED"]),
      availableSignals: Object.freeze([]),
      signalObservations: Object.freeze({})
    });
  }
}

/**
 * Create an immutable matching result from an identity resolution result.
 * Pure: no persistence, no recruitment ID assignment.
 *
 * @param {Object|null|undefined} identityResolution
 * @returns {Readonly<Object>|null}
 */
function createMatchingResult(identityResolution) {
  try {
    const resolution = normalizeIdentityResolution(identityResolution);
    const evaluation = evaluateRecruitmentMatch(resolution);
    const observations = getSignalObservations(resolution);

    return deepFreeze({
      phase: MATCHING_ENGINE_PHASE,
      entity: MATCHING_RESULT_ENTITY,
      descriptiveOnly: true,
      matchingExecution: false,
      persistenceEnabled: false,
      sideEffects: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false,
      performsPersistence: false,
      identityResolutionPhase: resolution.phase,
      matchingContractsPhase: MATCHING_CONTRACTS_PHASE,
      resolutionState: resolution.resolutionState,
      matchCategory: evaluation.matchCategory,
      profileId: evaluation.profileId,
      reviewScenarioId: evaluation.reviewScenarioId,
      contributingSignalKeys: evaluation.contributingSignalKeys,
      recommendsManualReview: evaluation.recommendsManualReview,
      manualReviewReasons: evaluation.manualReviewReasons,
      matchedProfileOrder: evaluation.matchedProfileOrder,
      advisoryLabel: evaluation.advisoryLabel,
      signalCount: resolution.signalCount ?? 0,
      primarySignalCount: resolution.primarySignalCount ?? 0,
      availableSignals: Object.freeze((resolution.availableSignals ?? []).slice()),
      signalObservations: observations,
      evaluation,
      metadata: deepFreeze({
        ...MATCHING_RESULT_METADATA,
        createReason: validateIdentityResolution(identityResolution).valid
          ? "identity_resolution"
          : "default",
        identityConfidenceLevel: resolution.confidenceLevel ?? null,
        anchorEventId: resolution.anchorEventId ?? null
      })
    });
  } catch {
    return null;
  }
}

/**
 * @param {*} result
 * @returns {Readonly<{ valid: boolean, status: string, reasons: string[] }>}
 */
function validateMatchingResult(result) {
  const reasons = [];

  if (!isPlainObject(result)) {
    return buildValidationResult(["INVALID_RESULT_SHAPE"]);
  }

  if (result.phase !== MATCHING_ENGINE_PHASE) {
    reasons.push("INVALID_PHASE");
  }

  if (result.entity !== MATCHING_RESULT_ENTITY) {
    reasons.push("INVALID_ENTITY");
  }

  if (!isMatchCategory(result.matchCategory)) {
    reasons.push("INVALID_MATCH_CATEGORY");
  }

  if (result.profileId != null && !isMatchingProfile(result.profileId)) {
    reasons.push("INVALID_PROFILE_ID");
  }

  if (result.reviewScenarioId != null && !isManualReviewScenario(result.reviewScenarioId)) {
    reasons.push("INVALID_REVIEW_SCENARIO_ID");
  }

  if (result.matchingExecution !== false) {
    reasons.push("MATCHING_EXECUTION_MUST_BE_FALSE");
  }

  if (result.assignsRecruitmentIds !== false || result.queriesDatabase !== false) {
    reasons.push("EXECUTION_FLAGS_MUST_BE_FALSE");
  }

  if (result.persistenceEnabled !== false || result.sideEffects !== false) {
    reasons.push("SIDE_EFFECT_FLAGS_MUST_BE_FALSE");
  }

  if (!Array.isArray(result.contributingSignalKeys)) {
    reasons.push("INVALID_CONTRIBUTING_SIGNAL_KEYS");
  }

  if (typeof result.recommendsManualReview !== "boolean") {
    reasons.push("INVALID_MANUAL_REVIEW_FLAG");
  }

  if (!Array.isArray(result.manualReviewReasons)) {
    reasons.push("INVALID_MANUAL_REVIEW_REASONS");
  }

  if (
    result.matchCategory === MATCH_CATEGORIES.MANUAL_REVIEW &&
    result.recommendsManualReview !== true
  ) {
    reasons.push("MANUAL_REVIEW_CATEGORY_REQUIRES_REVIEW_FLAG");
  }

  if (
    result.matchCategory !== MATCH_CATEGORIES.MANUAL_REVIEW &&
    result.reviewScenarioId != null
  ) {
    reasons.push("REVIEW_SCENARIO_ONLY_FOR_MANUAL_REVIEW");
  }

  if (
    result.recommendsManualReview === true &&
    result.matchCategory !== MATCH_CATEGORIES.MANUAL_REVIEW
  ) {
    reasons.push("MANUAL_REVIEW_FLAG_INCONSISTENT_WITH_CATEGORY");
  }

  if (!isPlainObject(result.evaluation)) {
    reasons.push("MISSING_EVALUATION");
  }

  if (!isPlainObject(result.signalObservations)) {
    reasons.push("MISSING_SIGNAL_OBSERVATIONS");
  }

  return buildValidationResult(reasons);
}

/**
 * @param {Object|null|undefined} result
 * @returns {Readonly<Object>}
 */
function summarizeMatchingResult(result) {
  const validation = validateMatchingResult(result);
  if (!validation.valid) {
    return Object.freeze({
      phase: MATCHING_ENGINE_PHASE,
      entity: MATCHING_RESULT_ENTITY,
      valid: false,
      matchCategory: DEFAULT_MATCH_CATEGORY,
      profileId: null,
      reviewScenarioId: null,
      recommendsManualReview: true,
      contributingSignalCount: 0,
      matchingExecution: false,
      assignsRecruitmentIds: false,
      queriesDatabase: false
    });
  }

  return Object.freeze({
    phase: result.phase,
    entity: result.entity,
    valid: true,
    matchCategory: result.matchCategory,
    profileId: result.profileId,
    reviewScenarioId: result.reviewScenarioId,
    recommendsManualReview: result.recommendsManualReview,
    contributingSignalCount: result.contributingSignalKeys.length,
    resolutionState: result.resolutionState,
    signalCount: result.signalCount,
    primarySignalCount: result.primarySignalCount,
    matchingExecution: false,
    assignsRecruitmentIds: false,
    queriesDatabase: false
  });
}

module.exports = {
  MATCHING_ENGINE_PHASE,
  MATCHING_RESULT_ENTITY,
  MATCHING_RESULT_DESCRIPTOR,
  MATCHING_RESULT_METADATA,
  PROFILE_MATCH_ORDER,
  CORROBORATING_SIGNAL_KEYS,
  VALIDATION_STATUS,
  evaluateRecruitmentMatch,
  createMatchingResult,
  validateMatchingResult,
  summarizeMatchingResult
};
