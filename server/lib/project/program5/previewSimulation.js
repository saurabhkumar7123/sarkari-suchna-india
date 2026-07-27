'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Preview Simulation (Operator Preview / No Persistence)
 *
 * Allows operators to preview the generated review payload before
 * anything is submitted. Reuses Shared Preview framework identities
 * where appropriate.
 *
 * No persistence unless explicitly initiated by an operator flag
 * (still advisory — this package never writes).
 */

const { deepFreeze } = require('./monitoringCandidateContract');
const { canonicalSerialize } = (function loadCanonical() {
  // Lightweight local canonical serializer (mirrors Shared Preview approach
  // without requiring product modules from the governance tree).
  function serialize(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value === undefined ? null : value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => serialize(item)).join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    const parts = keys.map(
      (key) => `${JSON.stringify(key)}:${serialize(value[key])}`
    );
    return `{${parts.join(',')}}`;
  }
  return { canonicalSerialize: serialize };
})();

const crypto = require('crypto');

const PREVIEW_SIMULATION_VERSION = '5B.1.0.0';

const SHARED_PREVIEW_REUSE = Object.freeze({
  moduleId: 'SHARED_PREVIEW',
  reuseMode: 'identity_and_snapshot_shape',
  persistenceDelegated: false,
});

function computePreviewVersion(content) {
  const hash = crypto
    .createHash('sha256')
    .update(canonicalSerialize(content))
    .digest('hex');
  return `5b-preview-${hash.slice(0, 16)}`;
}

/**
 * Simulate an operator preview of the review payload.
 *
 * @param {object} input
 * @param {object} input.adapter Result of adaptCandidateToReviewPayload
 * @param {object} [input.candidate]
 * @param {object} [input.validation]
 * @param {object} [input.sharedPreviewSnapshot] optional Shared Preview snapshot reuse
 * @param {boolean} [input.operatorPersistRequested] acknowledged but never executed here
 * @param {string} [input.generatedAt]
 */
function simulateReviewPayloadPreview(input = {}) {
  const adapter = input.adapter || null;
  const reviewPayload = adapter && adapter.reviewPayload ? adapter.reviewPayload : null;
  const operatorPersistRequested = Boolean(input.operatorPersistRequested);
  const generatedAt = input.generatedAt || '1970-01-01T00:00:00.000Z';

  const content = {
    schemaVersion: 1,
    previewKind: 'MONITORING_REVIEW_PAYLOAD_PREVIEW',
    reusedModule: SHARED_PREVIEW_REUSE.moduleId,
    reviewPayload,
    candidateSummary: input.candidate
      ? {
          candidateId: input.candidate.candidateId || null,
          source: input.candidate.source || null,
          sourceUrl: input.candidate.sourceUrl || null,
          recruitmentType: input.candidate.recruitmentType || null,
          confidence: input.candidate.confidence != null ? input.candidate.confidence : null,
        }
      : null,
    validationStatus: input.validation ? input.validation.status : null,
    sharedPreview: input.sharedPreviewSnapshot
      ? {
          reused: true,
          snapshotVersion: input.sharedPreviewSnapshot.snapshotVersion || null,
          integrityStatus:
            input.sharedPreviewSnapshot.integrity &&
            input.sharedPreviewSnapshot.integrity.status
              ? input.sharedPreviewSnapshot.integrity.status
              : null,
        }
      : {
          reused: false,
          snapshotVersion: null,
          integrityStatus: null,
        },
  };

  const previewVersion = computePreviewVersion(content);

  return deepFreeze({
    simulationVersion: PREVIEW_SIMULATION_VERSION,
    advisoryOnly: true,
    simulationOnly: true,
    ready: Boolean(reviewPayload),
    persisted: false,
    persistenceExecuted: false,
    operatorPersistRequested,
    persistenceNote: operatorPersistRequested
      ? 'Operator requested persistence, but Package 5B never persists; submission remains a future explicit operator action outside this package.'
      : 'No persistence requested.',
    sharedPreviewReuse: SHARED_PREVIEW_REUSE,
    generatedAt,
    previewVersion,
    preview: {
      ...content,
      timestamp: generatedAt,
      previewVersion,
    },
  });
}

module.exports = {
  PREVIEW_SIMULATION_VERSION,
  SHARED_PREVIEW_REUSE,
  simulateReviewPayloadPreview,
  computePreviewVersion,
};
