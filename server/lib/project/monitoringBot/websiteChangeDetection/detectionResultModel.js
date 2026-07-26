'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Runtime Result Model (Immutable / Read-Only)
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const DETECTION_RESULT_MODEL_VERSION = 'MB2.1.0.0';

const DETECTION_RESULT_STATUSES = Object.freeze({
  NO_CHANGE: 'NO_CHANGE',
  CHANGED: 'CHANGED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  FETCH_FAILED: 'FETCH_FAILED',
  SKIPPED: 'SKIPPED',
});

/**
 * Create an immutable detection result object.
 * @param {object} [input]
 */
function createDetectionResult(input = {}) {
  const src = input && typeof input === 'object' ? input : {};

  const timestamp =
    typeof src.timestamp === 'string' && src.timestamp.trim()
      ? src.timestamp.trim()
      : new Date().toISOString();

  const detectionStatus =
    typeof src.detectionStatus === 'string' && src.detectionStatus.trim()
      ? src.detectionStatus.trim()
      : DETECTION_RESULT_STATUSES.INCONCLUSIVE;

  return deepFreeze({
    resultModelVersion: DETECTION_RESULT_MODEL_VERSION,
    readOnly: true,
    immutable: true,
    advisoryOnly: true,

    sourceId:
      typeof src.sourceId === 'string' && src.sourceId.trim()
        ? src.sourceId.trim()
        : null,
    detectionStatus,
    fingerprint: src.fingerprint != null ? src.fingerprint : null,
    previousFingerprint:
      src.previousFingerprint != null ? src.previousFingerprint : null,
    metadata: src.metadata != null ? src.metadata : null,
    diagnostics: src.diagnostics != null ? src.diagnostics : null,
    classification: src.classification != null ? src.classification : null,
    confidence:
      typeof src.confidence === 'number' && Number.isFinite(src.confidence)
        ? src.confidence
        : null,
    confidenceMetadata:
      src.confidenceMetadata != null ? src.confidenceMetadata : null,
    timestamp,
    fetchUrl:
      typeof src.fetchUrl === 'string' && src.fetchUrl.trim()
        ? src.fetchUrl.trim()
        : null,
    expectedContentType:
      typeof src.expectedContentType === 'string'
        ? src.expectedContentType
        : null,

    extractionPerformed: false,
    reviewItemCreated: false,
    telegramSent: false,
    published: false,
    databaseWritten: false,
    schedulerUsed: false,
    workerUsed: false,
    retriesPerformed: 0,

    effects: deepFreeze({
      recruitmentExtracted: false,
      reviewItemCreated: false,
      telegramSent: false,
      published: false,
      databaseWritten: false,
      redisUsed: false,
      routeActivated: false,
    }),
  });
}

module.exports = {
  DETECTION_RESULT_MODEL_VERSION,
  DETECTION_RESULT_STATUSES,
  createDetectionResult,
};
