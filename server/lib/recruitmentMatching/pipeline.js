"use strict";

/**
 * Phase AI-3 — Recruitment matching pipeline.
 *
 * Normalized Event → Recruitment Matching → Similarity Analysis →
 * Recommendation Engine → (unchanged) Production Workflow.
 *
 * The pass is pure: it reads a normalized event and a read-only collection of
 * recruitment metadata and returns a recommendation. It never fetches,
 * schedules, persists, publishes, or mutates the records it is given.
 */

const { deepFreeze } = require("../noticeIntelligence/textUtils");
const { buildEventIdentity, buildRecruitmentIndex } = require("./recruitmentRecord");
const { searchCandidates } = require("./candidateSearch");
const { rankCandidates } = require("./similarityEngine");
const {
  assessLifecyclePlausibility,
  classifyUpdateRelationship,
  findRecordedDuplicate,
  mapUpdateToCandidate
} = require("./updateClassification");
const {
  buildConfidenceReport,
  scoreCandidateSelection,
  scoreMatchQuality,
  scoreRecommendation
} = require("./confidenceEngine");
const { validateMatching } = require("./validation");
const { evaluateRecommendation } = require("./recommendationEngine");
const {
  RECOMMENDATION_FIELD,
  attachRecommendation,
  buildMatchRecommendation
} = require("./recommendation");
const { ENGINE_VERSION, FORMAT_ID } = require("./types");
const { INTELLIGENCE_FIELD } = require("../noticeIntelligence/normalizedEvent");

const NOTICE_FORMAT_ID = "notice_intelligence_event_v1";

/**
 * Accept any of the three shapes a caller may hold:
 *   1. a Phase AI-2 normalized event,
 *   2. a monitoring event already enriched by Phase AI-2, or
 *   3. a raw monitoring event, which is run through Phase AI-2 first.
 *
 * @param {object} input
 * @param {{ now?: Date }} [options]
 * @returns {{ normalizedEvent: object, source: string }}
 */
function resolveNormalizedEvent(input, options = {}) {
  const event = input && typeof input === "object" ? input : {};

  if (event.formatId === NOTICE_FORMAT_ID) {
    return { normalizedEvent: event, source: "normalized_event" };
  }

  const attached = event[INTELLIGENCE_FIELD];
  if (attached && typeof attached === "object") {
    return { normalizedEvent: attached, source: "enriched_monitoring_event" };
  }

  // Required lazily so this module can be used with a normalized event without
  // pulling in the whole AI-2 content stack.
  const { analyzeGovernmentNotice } = require("../noticeIntelligence/pipeline");
  const result = analyzeGovernmentNotice(event, { now: options.now });
  return { normalizedEvent: result.normalizedEvent, source: "raw_monitoring_event" };
}

/**
 * Run the full Phase AI-3 matching pass.
 *
 * @param {object} input normalized event, enriched event, or monitoring event
 * @param {Array<object>|object} recruitments existing recruitment metadata, or a prebuilt index
 * @param {{
 *   now?: Date,
 *   maxCandidates?: number,
 *   existingRecruitmentId?: string
 * }} [options]
 * @returns {{
 *   recommendation: object,
 *   identity: object,
 *   relationship: object,
 *   search: object,
 *   ranking: object,
 *   duplicate: object|null,
 *   plausibility: object|null,
 *   updateMapping: object,
 *   confidence: object,
 *   validation: object,
 *   meta: object
 * }}
 */
function matchRecruitment(input, recruitments = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const startedAt = Date.now();

  const { normalizedEvent, source } = resolveNormalizedEvent(input, options);
  const identity = buildEventIdentity(normalizedEvent);
  const relationship = classifyUpdateRelationship(normalizedEvent);

  const index =
    recruitments && recruitments.isIndex ? recruitments : buildRecruitmentIndex(recruitments);
  const search = searchCandidates(identity, index, options);
  const ranking = rankCandidates(identity, search.candidates);

  const best = ranking.best;
  const plausibility = best ? assessLifecyclePlausibility(relationship, best.record) : null;
  const duplicate = best ? findRecordedDuplicate(identity, best.record, relationship) : null;

  const validation = validateMatching({
    identity,
    relationship,
    search,
    ranking,
    plausibility,
    duplicate,
    eventConfidence: identity.eventConfidence
  });

  const decision = evaluateRecommendation({
    identity,
    relationship,
    search,
    ranking,
    duplicate,
    plausibility
  });

  const candidateSelection = scoreCandidateSelection(search, ranking);
  const matchQuality = scoreMatchQuality(best, plausibility);
  const recommendationConfidence = scoreRecommendation({
    rule: decision.rule,
    candidateSelection,
    matchQuality,
    identity,
    validationFlags: validation.flags
  });
  const confidence = buildConfidenceReport({
    candidateSelection,
    matchQuality,
    recommendation: recommendationConfidence,
    dependsOn: decision.dependsOn
  });

  const updateMapping = mapUpdateToCandidate(relationship, best);

  const recommendation = buildMatchRecommendation({
    identity,
    relationship,
    search,
    ranking,
    decision,
    confidence,
    validation,
    duplicate,
    updateMapping,
    generatedAt: now.toISOString()
  });

  return {
    recommendation,
    identity,
    relationship,
    search,
    ranking,
    duplicate,
    plausibility,
    updateMapping,
    confidence,
    validation,
    meta: deepFreeze({
      formatId: FORMAT_ID,
      engineVersion: ENGINE_VERSION,
      eventSource: source,
      repositorySize: index.size,
      candidateCount: ranking.ranked.length,
      durationMs: Date.now() - startedAt
    })
  };
}

/**
 * Convenience wrapper for callers that only need the enriched event.
 *
 * The result is the original event plus one additive, namespaced key, so
 * passing it to the existing Production Workflow produces identical behaviour
 * to passing the original event.
 *
 * @param {object} event
 * @param {Array<object>|object} recruitments
 * @param {object} [options]
 * @returns {object}
 */
function enrichEventWithRecommendation(event, recruitments = [], options = {}) {
  const result = matchRecruitment(event, recruitments, options);
  return attachRecommendation(event, result.recommendation);
}

module.exports = {
  NOTICE_FORMAT_ID,
  RECOMMENDATION_FIELD,
  resolveNormalizedEvent,
  matchRecruitment,
  enrichEventWithRecommendation
};
