"use strict";

/**
 * PWP Phase 2 — Recruitment Resolution Engine.
 *
 * Deterministic decision service shared by manual and monitoring workflows.
 * No AI. No content generation. No publishing. No page mutation.
 */

const {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  RESOLUTION_DECISIONS,
  CONFIDENCE_LEVELS,
  RECOMMENDED_ACTIONS,
  ROUTE_DESTINATIONS,
  PAGE_SECTIONS
} = require("./resolutionTypes");
const {
  extractIdentityFromCorrelation,
  matchExistingRecruitment,
  matchExistingPage
} = require("./pageMatching");
const { evaluateDuplicatePolicy } = require("./duplicatePolicy");
const { planUpdateScope } = require("./updatePlanner");
const { buildRouting } = require("./routingModel");
const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");

function resolveConfidenceRank(level) {
  switch (level) {
    case CONFIDENCE_LEVELS.HIGH:
      return 3;
    case CONFIDENCE_LEVELS.MEDIUM:
      return 2;
    case CONFIDENCE_LEVELS.LOW:
      return 1;
    default:
      return 0;
  }
}

function minConfidence(...levels) {
  let lowest = CONFIDENCE_LEVELS.HIGH;
  let rank = 3;
  for (const level of levels) {
    const r = resolveConfidenceRank(level || CONFIDENCE_LEVELS.NONE);
    if (r < rank) {
      rank = r;
      lowest = level || CONFIDENCE_LEVELS.NONE;
    }
  }
  return lowest;
}

function isUnsupportedContext(workflowContext = {}, correlation = null) {
  if (workflowContext.unsupported === true) return true;
  if (workflowContext.supported === false) return true;
  const contentType = String(
    workflowContext.contentType ||
      (workflowContext.monitoringEvent && workflowContext.monitoringEvent.contentType) ||
      ""
  ).toLowerCase();
  if (contentType && /image\/|audio\/|video\//.test(contentType)) return true;
  if (workflowContext.unknownRecruitment === true) return false; // handled as manual review
  if (!correlation && workflowContext.requireCorrelation === true) return true;
  return false;
}

function buildDecisionResult({
  decision,
  reason,
  confidence,
  recommendedAction,
  recommendedActions,
  routing,
  match,
  pageMatch,
  duplicatePolicy,
  updatePlan,
  identity,
  evidence,
  extras = {}
}) {
  const result = {
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    decision,
    reason,
    confidence,
    recommendedAction:
      recommendedAction ||
      (recommendedActions && recommendedActions[0]) ||
      RECOMMENDED_ACTIONS.NO_ACTION,
    recommendedActions: recommendedActions || routing.recommendedActions || [],
    routing,
    identity,
    match: match || null,
    pageMatch: pageMatch || null,
    duplicatePolicy: duplicatePolicy || null,
    updatePlan: updatePlan || null,
    evidence: Array.isArray(evidence) ? evidence.slice() : [],
    effects: Object.freeze({
      modifiesPages: false,
      generatesContent: false,
      publishes: false,
      usesAi: false
    }),
    ...extras
  };
  return deepFreeze(result);
}

/**
 * Resolve what action the production workflow should take.
 *
 * @param {object} [input]
 * @param {object} [input.workflowContext]
 * @param {object} [input.correlation] Stage 3D correlation output
 * @param {object|null} [input.existingRecruitment]
 * @param {object|null} [input.existingPage]
 * @param {Array} [input.detectedChanges]
 * @param {boolean} [input.freeze=true]
 * @returns {object} Resolution Decision
 */
function resolveRecruitment(input = {}) {
  const workflowContext = input.workflowContext && typeof input.workflowContext === "object"
    ? input.workflowContext
    : {};
  const correlation = input.correlation || workflowContext.correlation || null;
  const existingRecruitment =
    input.existingRecruitment != null
      ? input.existingRecruitment
      : workflowContext.existingRecruitment != null
        ? workflowContext.existingRecruitment
        : null;
  const existingPage =
    input.existingPage != null
      ? input.existingPage
      : workflowContext.existingPage != null
        ? workflowContext.existingPage
        : null;
  const detectedChanges =
    input.detectedChanges ||
    (correlation && correlation.detectedChanges) ||
    [];

  const identity = extractIdentityFromCorrelation(correlation);
  const duplicatePolicy = evaluateDuplicatePolicy(correlation, workflowContext);
  const recruitmentMatch = matchExistingRecruitment(identity, existingRecruitment);
  const pageMatch = matchExistingPage(identity, existingPage, recruitmentMatch);

  // 1) Unsupported
  if (isUnsupportedContext(workflowContext, correlation)) {
    const routing = buildRouting(RESOLUTION_DECISIONS.UNSUPPORTED);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.UNSUPPORTED,
      reason: "unsupported_recruitment_event",
      confidence: CONFIDENCE_LEVELS.HIGH,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: ["unsupported_context"]
    });
  }

  // 2) Explicit unknown → manual review (never guess)
  if (
    workflowContext.unknownRecruitment === true ||
    workflowContext.forceManualReview === true
  ) {
    const routing = buildRouting(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED,
      reason: workflowContext.forceManualReview
        ? "force_manual_review"
        : "unknown_recruitment",
      confidence: CONFIDENCE_LEVELS.LOW,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: ["unknown_or_forced_manual_review"]
    });
  }

  // 3) Duplicate → ignore
  if (duplicatePolicy.isDuplicate) {
    const routing = buildRouting(RESOLUTION_DECISIONS.IGNORE_DUPLICATE);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.IGNORE_DUPLICATE,
      reason: duplicatePolicy.reason || "duplicate_notification",
      confidence: CONFIDENCE_LEVELS.HIGH,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: duplicatePolicy.evidence || []
    });
  }

  // 4) Superseded → mark + route newest
  if (duplicatePolicy.isSuperseded) {
    const routing = buildRouting(RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT);
    const updatePlan = pageMatch.matched
      ? planUpdateScope({ existingPage, detectedChanges, correlation })
      : null;
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT,
      reason: duplicatePolicy.reason || "superseded_document",
      confidence: CONFIDENCE_LEVELS.HIGH,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      updatePlan,
      identity,
      evidence: duplicatePolicy.evidence || [],
      extras: {
        supersededDocumentId: duplicatePolicy.supersededDocumentId,
        newestDocumentId: duplicatePolicy.newestDocumentId,
        routeNewestDocumentId: duplicatePolicy.newestDocumentId
      }
    });
  }

  // 5) Truly empty identity with no event signal → manual review (never guess)
  const identityConfidence = identity.confidence || CONFIDENCE_LEVELS.NONE;
  const hasAnyIdentity = Boolean(
    identity.advertisementNumber ||
      identity.recruitmentKey ||
      identity.organization ||
      identity.recruitmentName ||
      identity.postName ||
      identity.department
  );
  const eventTitle =
    (workflowContext.monitoringEvent && workflowContext.monitoringEvent.title) ||
    workflowContext.title ||
    null;
  if (
    !existingRecruitment &&
    !hasAnyIdentity &&
    !eventTitle &&
    workflowContext.allowLowConfidenceCreate !== true
  ) {
    const routing = buildRouting(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED,
      reason: "insufficient_recruitment_identity",
      confidence: CONFIDENCE_LEVELS.NONE,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: ["empty_identity_without_event_title"]
    });
  }

  // 6) Ambiguous match against provided existing recruitment
  if (existingRecruitment && recruitmentMatch.ambiguous && !recruitmentMatch.matched) {
    const routing = buildRouting(RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED,
      reason: recruitmentMatch.reason || "ambiguous_recruitment_match",
      confidence: CONFIDENCE_LEVELS.LOW,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: recruitmentMatch.evidence || []
    });
  }

  // CASE 1 — New official recruitment
  if (!existingRecruitment || !recruitmentMatch.matched) {
    const routing = buildRouting(RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT,
      reason: "new_official_recruitment",
      confidence: minConfidence(identityConfidence, CONFIDENCE_LEVELS.MEDIUM),
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: ["no_existing_recruitment"]
    });
  }

  // Prefer explicit recruitment-only update when requested
  if (
    recruitmentMatch.matched &&
    workflowContext.updateRecruitmentOnly === true
  ) {
    const routing = buildRouting(RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT,
      reason: "update_existing_recruitment_only",
      confidence: recruitmentMatch.confidence,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: recruitmentMatch.evidence || []
    });
  }

  // CASE 2 — Existing recruitment, missing page
  if (recruitmentMatch.matched && !pageMatch.matched) {
    // Corrigendum / replacement against recruitment record without page:
    // still create a new page draft (CASE 2).
    if (
      duplicatePolicy.isReplacement &&
      workflowContext.preferRecruitmentUpdate === true
    ) {
      const routing = buildRouting(RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT);
      return buildDecisionResult({
        decision: RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT,
        reason: "update_existing_recruitment_before_page",
        confidence: recruitmentMatch.confidence,
        recommendedActions: routing.recommendedActions,
        routing,
        match: recruitmentMatch,
        pageMatch,
        duplicatePolicy,
        identity,
        evidence: [...(recruitmentMatch.evidence || []), ...(duplicatePolicy.evidence || [])]
      });
    }

    const routing = buildRouting(RESOLUTION_DECISIONS.CREATE_NEW_PAGE);
    return buildDecisionResult({
      decision: RESOLUTION_DECISIONS.CREATE_NEW_PAGE,
      reason: "existing_recruitment_missing_page",
      confidence: recruitmentMatch.confidence,
      recommendedActions: routing.recommendedActions,
      routing,
      match: recruitmentMatch,
      pageMatch,
      duplicatePolicy,
      identity,
      evidence: [...(recruitmentMatch.evidence || []), "page_absent"]
    });
  }

  // CASE 3 — Existing recruitment + existing page → update affected sections only
  const updatePlan = planUpdateScope({ existingPage, detectedChanges, correlation });
  const routing = buildRouting(RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE);
  return buildDecisionResult({
    decision: RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE,
    reason: "existing_page_update",
    confidence: minConfidence(recruitmentMatch.confidence, pageMatch.confidence),
    recommendedActions: routing.recommendedActions,
    routing,
    match: recruitmentMatch,
    pageMatch,
    duplicatePolicy,
    updatePlan,
    identity,
    evidence: [
      ...(recruitmentMatch.evidence || []),
      ...(pageMatch.evidence || []),
      `affected_sections:${updatePlan.affectedSections.join(",") || "none"}`
    ]
  });
}

/** Alias for shared manual + monitoring workflows. */
function resolveRecruitmentEvent(input) {
  return resolveRecruitment(input);
}

module.exports = {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  RESOLUTION_DECISIONS,
  ROUTE_DESTINATIONS,
  CONFIDENCE_LEVELS,
  RECOMMENDED_ACTIONS,
  PAGE_SECTIONS,
  resolveRecruitment,
  resolveRecruitmentEvent
};
