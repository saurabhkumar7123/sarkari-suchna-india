'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Resolution Report (Advisory / Read-Only)
 *
 * Includes:
 *   - Duplicate summary
 *   - Identity summary
 *   - Merge recommendations
 *   - Unresolved candidates
 *   - Operator action suggestions
 */

const { deepFreeze, REUSED_MODULE_IDS } = require('./candidateIdentityContract');
const { MERGE_RECOMMENDATIONS } = require('./mergeRecommendationEngine');

const RESOLUTION_REPORT_VERSION = '5E.1.0.0';

function buildOperatorActionSuggestions({
  detection,
  resolution,
  mergeRecommendations,
}) {
  const suggestions = [];

  if (!detection || detection.candidateCount === 0) {
    suggestions.push({
      code: 'PROVIDE_CANDIDATES',
      priority: 'HIGH',
      message:
        'Provide candidate identities for advisory duplicate detection and resolution preview.',
    });
    return suggestions;
  }

  if (resolution && resolution.groupCount === 0) {
    suggestions.push({
      code: 'NO_RELATED_GROUPS',
      priority: 'INFO',
      message:
        'No related candidate groups were detected. Continue monitoring with existing identities.',
    });
  }

  const counts =
    (mergeRecommendations && mergeRecommendations.counts) || {
      mergeRecommended: 0,
      reviewRequired: 0,
      keepSeparate: 0,
      insufficientEvidence: 0,
    };

  if (counts.mergeRecommended > 0) {
    suggestions.push({
      code: 'OPERATOR_CONFIRM_MERGE_CANDIDATES',
      priority: 'HIGH',
      message:
        'Review merge-recommended groups in the resolution preview. No automatic merge will occur.',
      groupCount: counts.mergeRecommended,
    });
  }

  if (counts.reviewRequired > 0) {
    suggestions.push({
      code: 'OPERATOR_REVIEW_RELATED_CANDIDATES',
      priority: 'MEDIUM',
      message:
        'Inspect matching and differing fields for review-required groups before deciding.',
      groupCount: counts.reviewRequired,
    });
  }

  if (counts.keepSeparate > 0) {
    suggestions.push({
      code: 'KEEP_CANDIDATES_SEPARATE',
      priority: 'INFO',
      message:
        'Weak identity overlap detected. Prefer keeping candidates separate unless stronger evidence appears.',
      groupCount: counts.keepSeparate,
    });
  }

  if (counts.insufficientEvidence > 0) {
    suggestions.push({
      code: 'COLLECT_ADDITIONAL_IDENTITY_FIELDS',
      priority: 'MEDIUM',
      message:
        'Enrich advertisement number, organization, title, and source URL fields to improve advisory confidence.',
      groupCount: counts.insufficientEvidence,
    });
  }

  if (resolution && resolution.unresolvedCount > 0) {
    suggestions.push({
      code: 'INSPECT_UNRESOLVED_CANDIDATES',
      priority: 'INFO',
      message:
        'Unresolved candidates have no related peers in this set. Retain them as independent identities.',
      unresolvedCount: resolution.unresolvedCount,
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      code: 'OPERATOR_REVIEW_RESOLUTION_REPORT',
      priority: 'INFO',
      message:
        'Resolution report is ready for operator inspection. Production data remains unmodified.',
    });
  }

  return suggestions;
}

/**
 * Generate an advisory resolution report.
 *
 * @param {object} [input]
 * @param {object} [input.detection]
 * @param {object} [input.resolution]
 * @param {object} [input.mergeRecommendations]
 * @param {object} [input.preview]
 */
function generateResolutionReport(input = {}) {
  const detection = input.detection || null;
  const resolution = input.resolution || null;
  const mergeRecommendations = input.mergeRecommendations || null;
  const preview = input.preview || null;

  const identities = detection && Array.isArray(detection.identities)
    ? detection.identities
    : [];

  const fingerprintClasses = {
    exact_identity: 0,
    strong_similarity: 0,
    partial_similarity: 0,
    unknown: 0,
  };
  for (const identity of identities) {
    const key = identity.fingerprintClass || 'unknown';
    if (Object.prototype.hasOwnProperty.call(fingerprintClasses, key)) {
      fingerprintClasses[key] += 1;
    } else {
      fingerprintClasses.unknown += 1;
    }
  }

  const operatorActionSuggestions = buildOperatorActionSuggestions({
    detection,
    resolution,
    mergeRecommendations,
  });

  const recommendedNextStep = operatorActionSuggestions[0] || {
    code: 'OPERATOR_REVIEW_RESOLUTION_REPORT',
    priority: 'INFO',
    message: 'Review the advisory resolution report.',
  };

  return deepFreeze({
    reportVersion: RESOLUTION_REPORT_VERSION,
    advisoryOnly: true,
    readOnly: true,
    productionDataModified: false,
    automaticMerge: false,
    reusedModules: REUSED_MODULE_IDS,
    duplicateSummary: detection
      ? {
          candidateCount: detection.candidateCount,
          relatedPairCount: detection.relatedPairCount,
          ...detection.summary,
        }
      : {
          candidateCount: 0,
          relatedPairCount: 0,
          exactDuplicates: 0,
          nearDuplicates: 0,
          sameAdvertisement: 0,
          sameOrganization: 0,
          updatedMetadata: 0,
        },
    identitySummary: {
      identityCount: identities.length,
      fingerprintClasses,
      withFingerprint: identities.filter((i) => i.identityFingerprint).length,
      withAdvertisementNumber: identities.filter((i) => i.advertisementNumber)
        .length,
      withOrganization: identities.filter((i) => i.organization).length,
    },
    mergeRecommendations: mergeRecommendations
      ? {
          recommendationCount: mergeRecommendations.recommendationCount,
          counts: mergeRecommendations.counts,
          items: mergeRecommendations.recommendations,
        }
      : {
          recommendationCount: 0,
          counts: {
            mergeRecommended: 0,
            reviewRequired: 0,
            keepSeparate: 0,
            insufficientEvidence: 0,
          },
          items: [],
        },
    unresolvedCandidates: {
      count: resolution ? resolution.unresolvedCount : 0,
      candidateIds: resolution ? resolution.unresolvedCandidateIds : [],
    },
    previewReady: Boolean(preview && preview.ready),
    operatorActionSuggestions,
    recommendedNextStep,
    recommendationCodes: Object.values(MERGE_RECOMMENDATIONS),
  });
}

module.exports = {
  RESOLUTION_REPORT_VERSION,
  generateResolutionReport,
};
