'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Merge Recommendation Engine (Advisory Only)
 *
 * Generates operator-facing recommendations:
 *   - merge_recommended
 *   - review_required
 *   - keep_separate
 *   - insufficient_evidence
 *
 * Recommendations only. Never merges.
 */

const { deepFreeze } = require('./candidateIdentityContract');
const { DUPLICATE_RELATION_TYPES } = require('./duplicateDetectionEngine');

const MERGE_RECOMMENDATION_VERSION = '5E.1.0.0';

const MERGE_RECOMMENDATIONS = Object.freeze({
  MERGE_RECOMMENDED: 'merge_recommended',
  REVIEW_REQUIRED: 'review_required',
  KEEP_SEPARATE: 'keep_separate',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
});

const DEFAULT_RECOMMENDATION_THRESHOLDS = deepFreeze({
  mergeRecommendedMinConfidence: 0.9,
  reviewRequiredMinConfidence: 0.55,
  keepSeparateMaxConfidence: 0.35,
});

function decideRecommendation(group, thresholds) {
  const relations = group.relations || [];
  const confidence = Number(group.confidenceScore) || 0;

  if (
    relations.includes(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE) &&
    confidence >= thresholds.mergeRecommendedMinConfidence
  ) {
    return {
      recommendation: MERGE_RECOMMENDATIONS.MERGE_RECOMMENDED,
      rationale:
        'Exact duplicate evidence with high confidence supports an advisory merge recommendation. Operator confirmation is still required.',
    };
  }

  if (
    relations.includes(
      DUPLICATE_RELATION_TYPES.SAME_RECRUITMENT_UPDATED_METADATA
    ) &&
    confidence >= thresholds.reviewRequiredMinConfidence
  ) {
    return {
      recommendation: MERGE_RECOMMENDATIONS.REVIEW_REQUIRED,
      rationale:
        'Same recruitment with updated metadata detected. Operator should review field differences before any merge decision.',
    };
  }

  if (
    (relations.includes(DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE) ||
      relations.includes(DUPLICATE_RELATION_TYPES.SAME_ADVERTISEMENT)) &&
    confidence >= thresholds.reviewRequiredMinConfidence
  ) {
    return {
      recommendation: MERGE_RECOMMENDATIONS.REVIEW_REQUIRED,
      rationale:
        'Near-duplicate or shared advertisement evidence requires human review before any merge action.',
    };
  }

  if (
    relations.includes(DUPLICATE_RELATION_TYPES.SAME_ORGANIZATION) &&
    confidence <= thresholds.keepSeparateMaxConfidence
  ) {
    return {
      recommendation: MERGE_RECOMMENDATIONS.KEEP_SEPARATE,
      rationale:
        'Organization overlap alone is weak identity evidence. Keeping candidates separate is advised unless stronger fields align.',
    };
  }

  if (confidence < thresholds.reviewRequiredMinConfidence) {
    return {
      recommendation: MERGE_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE,
      rationale:
        'Identity evidence is insufficient for a merge recommendation. Collect additional fields or confirm manually.',
    };
  }

  return {
    recommendation: MERGE_RECOMMENDATIONS.REVIEW_REQUIRED,
    rationale:
      'Related candidates were grouped, but confidence is not high enough for an advisory merge recommendation.',
  };
}

/**
 * Generate advisory merge recommendations for resolution groups.
 *
 * @param {object} [input]
 * @param {object} [input.resolution]
 * @param {object[]} [input.groups]
 * @param {object} [input.thresholds]
 */
function generateMergeRecommendations(input = {}) {
  const resolution = input.resolution || null;
  const groups = Array.isArray(input.groups)
    ? input.groups
    : resolution && Array.isArray(resolution.groups)
      ? resolution.groups
      : [];

  const thresholds = {
    ...DEFAULT_RECOMMENDATION_THRESHOLDS,
    ...(input.thresholds || {}),
  };

  const recommendations = groups.map((group) => {
    const decision = decideRecommendation(group, thresholds);
    return deepFreeze({
      groupId: group.groupId,
      recommendation: decision.recommendation,
      rationale: decision.rationale,
      confidenceScore: group.confidenceScore,
      primaryCandidateId:
        group.primaryCandidateSuggestion &&
        group.primaryCandidateSuggestion.candidateId
          ? group.primaryCandidateSuggestion.candidateId
          : null,
      relatedCandidateIds: (group.relatedCandidates || []).map(
        (candidate) => candidate.candidateId
      ),
      relations: (group.relations || []).slice(),
      advisoryOnly: true,
      autoMerged: false,
      operatorConfirmationRequired: true,
    });
  });

  const counts = {
    mergeRecommended: 0,
    reviewRequired: 0,
    keepSeparate: 0,
    insufficientEvidence: 0,
  };

  for (const item of recommendations) {
    if (item.recommendation === MERGE_RECOMMENDATIONS.MERGE_RECOMMENDED) {
      counts.mergeRecommended += 1;
    } else if (item.recommendation === MERGE_RECOMMENDATIONS.REVIEW_REQUIRED) {
      counts.reviewRequired += 1;
    } else if (item.recommendation === MERGE_RECOMMENDATIONS.KEEP_SEPARATE) {
      counts.keepSeparate += 1;
    } else {
      counts.insufficientEvidence += 1;
    }
  }

  return deepFreeze({
    recommendationVersion: MERGE_RECOMMENDATION_VERSION,
    advisoryOnly: true,
    recommendationsOnly: true,
    automaticMerge: false,
    thresholds,
    recommendationCount: recommendations.length,
    recommendations,
    counts,
  });
}

module.exports = {
  MERGE_RECOMMENDATION_VERSION,
  MERGE_RECOMMENDATIONS,
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  generateMergeRecommendations,
};
