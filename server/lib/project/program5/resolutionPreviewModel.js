'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Resolution Preview Model (Read-Only)
 *
 * Allows operators to inspect:
 *   - Candidate comparison
 *   - Matching fields
 *   - Different fields
 *   - Identity score
 *   - Resolution recommendation
 *
 * Read-only. Reuses Shared Preview identity.
 */

const { deepFreeze, REUSED_MODULE_IDS } = require('./candidateIdentityContract');
const { compareFields } = require('./duplicateDetectionEngine');

const RESOLUTION_PREVIEW_MODEL_VERSION = '5E.1.0.0';

const SHARED_PREVIEW_REUSE = Object.freeze({
  moduleId: REUSED_MODULE_IDS.SHARED_PREVIEW,
  reuseMode: 'identity_and_snapshot_shape',
  persistenceDelegated: false,
});

function summarizeIdentity(identity) {
  if (!identity) return null;
  return {
    candidateId: identity.candidateId || null,
    source: identity.source || null,
    sourceUrl: identity.sourceUrl || null,
    recruitmentType: identity.recruitmentType || null,
    organization: identity.organization || null,
    department: identity.department || null,
    qualification: identity.qualification || null,
    state: identity.state || null,
    advertisementNumber: identity.advertisementNumber || null,
    title: identity.title || null,
    importantDates: Array.isArray(identity.importantDates)
      ? identity.importantDates
      : [],
    identityFingerprint: identity.identityFingerprint || null,
    confidence: identity.confidence,
  };
}

/**
 * Build a read-only resolution preview for operator inspection.
 *
 * @param {object} [input]
 * @param {object} [input.resolution]
 * @param {object} [input.mergeRecommendations]
 * @param {object} [input.detection]
 * @param {object} [input.sharedPreviewSnapshot]
 * @param {string} [input.generatedAt]
 */
function buildResolutionPreviewModel(input = {}) {
  const resolution = input.resolution || null;
  const mergeRecommendations = input.mergeRecommendations || null;
  const detection = input.detection || null;
  const generatedAt = input.generatedAt || '1970-01-01T00:00:00.000Z';

  const recommendationByGroup = new Map();
  if (mergeRecommendations && Array.isArray(mergeRecommendations.recommendations)) {
    for (const item of mergeRecommendations.recommendations) {
      recommendationByGroup.set(item.groupId, item);
    }
  }

  const pairByMembers = new Map();
  if (detection && Array.isArray(detection.relatedPairs)) {
    for (const pair of detection.relatedPairs) {
      const key = [pair.leftCandidateId, pair.rightCandidateId].sort().join('::');
      pairByMembers.set(key, pair);
    }
  }

  const groupPreviews = (resolution && resolution.groups ? resolution.groups : []).map(
    (group) => {
      const primary = group.primaryCandidateSuggestion || null;
      const related = group.relatedCandidates || [];
      const recommendation = recommendationByGroup.get(group.groupId) || null;

      const comparisons = related.map((candidate) => {
        const fieldComparison = compareFields(primary || {}, candidate || {});
        const pairKey = [primary && primary.candidateId, candidate.candidateId]
          .filter(Boolean)
          .sort()
          .join('::');
        const pair = pairByMembers.get(pairKey) || null;

        return {
          leftCandidateId: primary ? primary.candidateId : null,
          rightCandidateId: candidate.candidateId,
          matchingFields: pair
            ? pair.matchingFields
            : fieldComparison.matchingFields,
          differentFields: pair
            ? pair.differentFields
            : fieldComparison.differentFields,
          identityScore: pair ? pair.identityScore : group.confidenceScore,
          left: summarizeIdentity(primary),
          right: summarizeIdentity(candidate),
        };
      });

      return deepFreeze({
        groupId: group.groupId,
        primaryCandidate: summarizeIdentity(primary),
        relatedCandidates: related.map(summarizeIdentity),
        confidenceScore: group.confidenceScore,
        resolutionExplanation: group.resolutionExplanation,
        recommendation: recommendation
          ? recommendation.recommendation
          : null,
        recommendationRationale: recommendation
          ? recommendation.rationale
          : null,
        comparisons,
      });
    }
  );

  const ready = Boolean(resolution);

  return deepFreeze({
    previewVersion: RESOLUTION_PREVIEW_MODEL_VERSION,
    advisoryOnly: true,
    previewOnly: true,
    readOnly: true,
    ready,
    generatedAt,
    sharedPreviewReuse: SHARED_PREVIEW_REUSE,
    sharedPreviewSnapshotAttached: Boolean(input.sharedPreviewSnapshot),
    groupCount: groupPreviews.length,
    unresolvedCandidateIds:
      resolution && Array.isArray(resolution.unresolvedCandidateIds)
        ? resolution.unresolvedCandidateIds
        : [],
    groups: groupPreviews,
    operatorInspection: {
      canCompareCandidates: true,
      canViewMatchingFields: true,
      canViewDifferentFields: true,
      canViewIdentityScore: true,
      canViewRecommendation: true,
      canMergeAutomatically: false,
    },
  });
}

module.exports = {
  RESOLUTION_PREVIEW_MODEL_VERSION,
  SHARED_PREVIEW_REUSE,
  buildResolutionPreviewModel,
};
