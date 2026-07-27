"use strict";

/**
 * Phase AI-3 — Recommendation object.
 *
 * The single structured object this phase contributes. It is additive and
 * namespaced: the Production Workflow keeps receiving exactly the event it
 * received before, with the recommendation attached under one new key. Nothing
 * in this object is an instruction — `advisoryOnly` and `appliesChanges` say so
 * explicitly.
 */

const { deepFreeze, round2 } = require("../noticeIntelligence/textUtils");
const { ENGINE_VERSION, FORMAT_ID, MATCH_QUALITY, PHASE, RECOMMENDATION_LABELS } = require("./types");

/** Key used to attach AI-3 output to an event. */
const RECOMMENDATION_FIELD = "recruitmentMatching";

/** How many ranked candidates are reported back. */
const REPORTED_CANDIDATE_LIMIT = 10;

/**
 * Compact view of a ranked candidate.
 * @param {object} entry
 * @returns {object}
 */
function summarizeCandidate(entry) {
  return {
    recruitmentId: entry.recruitmentId,
    recruitmentKey: entry.record.recruitmentKey,
    title: entry.record.title,
    board: entry.record.board,
    boardCode: entry.record.boardCode,
    year: entry.record.year,
    category: entry.record.category,
    lifecycleStage: entry.record.lifecycleStage,
    score: round2(entry.score),
    level: entry.level,
    foundBy: entry.strategies,
    matchedFactors: entry.similarity.matchedFactors,
    mismatchedFactors: entry.similarity.mismatchedFactors
  };
}

/**
 * Full view of the winning candidate, including the factor breakdown that
 * produced its score.
 * @param {object|null} entry
 * @returns {object|null}
 */
function summarizeBestMatch(entry) {
  if (!entry) return null;
  return {
    ...summarizeCandidate(entry),
    similarity: {
      score: entry.similarity.score,
      level: entry.similarity.level,
      rawScore: entry.similarity.rawScore,
      coverage: entry.similarity.coverage,
      comparableWeight: entry.similarity.comparableWeight,
      factors: entry.similarity.factors,
      adjustments: entry.similarity.adjustments,
      conflicts: entry.similarity.conflicts,
      identifierMatched: entry.similarity.identifierMatched,
      titleSimilarity: entry.similarity.title.score,
      sharedTitleTokens: entry.similarity.title.sharedTokens,
      sharedKeywords: entry.similarity.keywords.shared
    },
    foundByDetails: entry.strategyDetails
  };
}

/**
 * Assemble the frozen recommendation object.
 *
 * @param {object} parts
 * @returns {object}
 */
function buildMatchRecommendation(parts = {}) {
  const ranking = parts.ranking || {};
  const search = parts.search || {};
  const decision = parts.decision || {};
  const confidence = parts.confidence || {};
  const identity = parts.identity || {};
  const relationship = parts.relationship || {};

  const recommendation = {
    formatId: FORMAT_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    advisoryOnly: true,
    appliesChanges: false,
    generatedAt: parts.generatedAt || new Date().toISOString(),

    // --- The recommendation ---
    recommendation: decision.recommendation,
    recommendationLabel: RECOMMENDATION_LABELS[decision.recommendation] || null,
    explanation: decision.explanation,
    ruleId: decision.ruleId,
    alternativesConsidered: decision.alternativesConsidered || [],

    // --- What kind of update this event carries ---
    updateRelationship: {
      relationship: relationship.relationship,
      label: relationship.label,
      lifecycleOrder: relationship.lifecycleOrder,
      isAnnouncement: relationship.isAnnouncement,
      isUpdate: relationship.isUpdate,
      requiresExistingRecruitment: relationship.requiresExistingRecruitment,
      occursAnytime: relationship.occursAnytime,
      resolved: relationship.resolved,
      source: relationship.source,
      explanation: relationship.explanation
    },
    updateMapping: parts.updateMapping || null,

    // --- Who it was matched against ---
    bestMatch: summarizeBestMatch(ranking.best || null),
    runnerUp: ranking.runnerUp ? summarizeCandidate(ranking.runnerUp) : null,
    separation: ranking.separation === undefined ? null : ranking.separation,
    matchQualityLevel: ranking.best ? ranking.best.level : MATCH_QUALITY.NONE,
    candidates: (ranking.ranked || []).slice(0, REPORTED_CANDIDATE_LIMIT).map(summarizeCandidate),

    candidateSearch: {
      repositorySize: search.repositorySize || 0,
      candidateCount: (ranking.ranked || []).length,
      totalFound: search.totalFound || 0,
      truncated: Boolean(search.truncated),
      strategiesUsed: search.strategiesUsed || [],
      identifierBlocked: Boolean(search.identifierBlocked),
      isEmptyRepository: Boolean(search.isEmptyRepository)
    },

    // --- How sure it is ---
    confidence,

    // --- What a reviewer should know ---
    validation: parts.validation || null,
    duplicate: parts.duplicate || null,

    // --- What it matched on ---
    eventIdentity: {
      title: identity.title,
      board: identity.board,
      boardCode: identity.boardCode,
      department: identity.department,
      advertisementNumber: identity.advertisementNumber,
      referenceNumber: identity.referenceNumber,
      year: identity.year,
      category: identity.category,
      keywords: identity.keywords,
      postNames: identity.postNames,
      eventType: identity.eventType,
      eventSubType: identity.eventSubType,
      language: identity.language,
      eventConfidence: identity.eventConfidence,
      isRecruitmentCandidate: identity.isRecruitmentCandidate,
      fingerprint: identity.fingerprint
    }
  };

  return deepFreeze(recommendation);
}

/**
 * Attach a recommendation to an event without altering it.
 *
 * The returned object is a superset of the original: every original key keeps
 * its original value, so any existing Production Workflow stage behaves exactly
 * as it did before this phase existed.
 *
 * @param {object} originalEvent
 * @param {object} recommendation
 * @returns {object}
 */
function attachRecommendation(originalEvent, recommendation) {
  const base = originalEvent && typeof originalEvent === "object" ? originalEvent : {};
  return {
    ...base,
    [RECOMMENDATION_FIELD]: recommendation || null
  };
}

/**
 * Read a recommendation back off an event, if present.
 * @param {object} event
 * @returns {object|null}
 */
function readRecommendation(event) {
  if (!event || typeof event !== "object") return null;
  const value = event[RECOMMENDATION_FIELD];
  return value && typeof value === "object" ? value : null;
}

module.exports = {
  RECOMMENDATION_FIELD,
  REPORTED_CANDIDATE_LIMIT,
  summarizeCandidate,
  summarizeBestMatch,
  buildMatchRecommendation,
  attachRecommendation,
  readRecommendation
};
