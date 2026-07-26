'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Change Detection Engine
 *
 * Compares previous fingerprint to current fingerprint.
 * Returns No Change or Changed with confidence metadata.
 * No extraction. No review items. No notifications.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  FINGERPRINT_ALGORITHMS,
  generateContentFingerprint,
  generateRawSha256Fingerprint,
} = require('./contentFingerprintEngine');
const {
  classifyDetectedChange,
  CHANGE_CLASSES,
} = require('./changeClassification');

const CHANGE_DETECTION_ENGINE_VERSION = 'MB2.1.0.0';

const DETECTION_STATUS = Object.freeze({
  NO_CHANGE: 'NO_CHANGE',
  CHANGED: 'CHANGED',
  INCONCLUSIVE: 'INCONCLUSIVE',
});

function fingerprintValue(fp) {
  if (fp == null) return null;
  if (typeof fp === 'string' && fp.trim()) return fp.trim();
  if (typeof fp === 'object') {
    if (typeof fp.fingerprint === 'string' && fp.fingerprint.trim()) {
      return fp.fingerprint.trim();
    }
    if (typeof fp.hash === 'string' && fp.hash.trim()) {
      const algo =
        typeof fp.algorithm === 'string' && fp.algorithm.trim()
          ? fp.algorithm.trim()
          : 'SHA-256';
      return `${algo}:${fp.hash.trim()}`;
    }
  }
  return null;
}

/**
 * Compare previous and current fingerprints.
 * @param {object} [input]
 */
function detectChange(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const previousValue = fingerprintValue(src.previousFingerprint);
  const currentFingerprint =
    src.currentFingerprint && typeof src.currentFingerprint === 'object'
      ? src.currentFingerprint
      : typeof src.currentFingerprint === 'string'
        ? { fingerprint: src.currentFingerprint, hash: src.currentFingerprint }
        : src.body != null
          ? generateContentFingerprint({
              body: src.body,
              contentType: src.contentType || src.expectedContentType,
              sourceId: src.sourceId,
              algorithm: src.algorithm,
            })
          : null;

  const currentValue = fingerprintValue(currentFingerprint);

  if (!currentValue) {
    return deepFreeze({
      detectionEngineVersion: CHANGE_DETECTION_ENGINE_VERSION,
      detectionStatus: DETECTION_STATUS.INCONCLUSIVE,
      changed: false,
      confidence: 0,
      previousFingerprint: previousValue,
      currentFingerprint: null,
      hashMismatch: false,
      missingPreviousFingerprint: !previousValue,
      missingCurrentFingerprint: true,
      classification: null,
      extractionPerformed: false,
      advisoryOnly: true,
    });
  }

  if (!previousValue) {
    const classification = classifyDetectedChange({
      detectionStatus: DETECTION_STATUS.CHANGED,
      fingerprint: currentFingerprint,
      hashMismatch: true,
      contentType: src.contentType || src.expectedContentType,
      expectedContentType: src.expectedContentType,
    });

    return deepFreeze({
      detectionEngineVersion: CHANGE_DETECTION_ENGINE_VERSION,
      detectionStatus: DETECTION_STATUS.CHANGED,
      changed: true,
      confidence: 0.5,
      confidenceMetadata: deepFreeze({
        reason: 'FIRST_OBSERVATION_NO_PREVIOUS_FINGERPRINT',
        previousAvailable: false,
        currentAvailable: true,
        baselineConfidence: 0.5,
      }),
      previousFingerprint: null,
      currentFingerprint,
      hashMismatch: true,
      missingPreviousFingerprint: true,
      missingCurrentFingerprint: false,
      firstObservation: true,
      classification,
      extractionPerformed: false,
      advisoryOnly: true,
    });
  }

  const hashMismatch = previousValue !== currentValue;
  const detectionStatus = hashMismatch
    ? DETECTION_STATUS.CHANGED
    : DETECTION_STATUS.NO_CHANGE;

  let rawHashChanged = src.rawHashChanged;
  let normalizedHashChanged = src.normalizedHashChanged;

  if (
    src.body != null &&
    src.previousRawFingerprint != null &&
    rawHashChanged == null
  ) {
    const raw = generateRawSha256Fingerprint(src.body, src.sourceId);
    rawHashChanged =
      fingerprintValue(src.previousRawFingerprint) !== fingerprintValue(raw);
  }

  if (
    src.body != null &&
    src.previousNormalizedFingerprint != null &&
    normalizedHashChanged == null
  ) {
    const normalized = generateContentFingerprint({
      body: src.body,
      algorithm: FINGERPRINT_ALGORITHMS.NORMALIZED_HTML,
      sourceId: src.sourceId,
      contentType: 'HTML',
    });
    normalizedHashChanged =
      fingerprintValue(src.previousNormalizedFingerprint) !==
      fingerprintValue(normalized);
  }

  if (rawHashChanged == null) {
    rawHashChanged = hashMismatch;
  }
  if (normalizedHashChanged == null) {
    normalizedHashChanged = hashMismatch;
  }

  const etagChanged =
    src.previousMetadata &&
    src.metadata &&
    src.previousMetadata.etag != null &&
    src.metadata.etag != null
      ? src.previousMetadata.etag !== src.metadata.etag
      : false;

  const lastModifiedChanged =
    src.previousMetadata &&
    src.metadata &&
    src.previousMetadata.lastModified != null &&
    src.metadata.lastModified != null
      ? src.previousMetadata.lastModified !== src.metadata.lastModified
      : false;

  const contentLengthChanged =
    src.previousMetadata &&
    src.metadata &&
    src.previousMetadata.contentLength != null &&
    src.metadata.contentLength != null
      ? src.previousMetadata.contentLength !== src.metadata.contentLength
      : false;

  let confidence = hashMismatch ? 0.9 : 1;
  if (hashMismatch && (etagChanged || lastModifiedChanged)) {
    confidence = 0.95;
  }
  if (!hashMismatch && (etagChanged || lastModifiedChanged)) {
    confidence = 0.85;
  }

  const classification = classifyDetectedChange({
    detectionStatus,
    fingerprint: currentFingerprint,
    hashMismatch,
    rawHashChanged,
    normalizedHashChanged,
    etagChanged,
    lastModifiedChanged,
    contentLengthChanged,
    contentType: src.contentType || src.expectedContentType,
    expectedContentType: src.expectedContentType,
    algorithm: currentFingerprint && currentFingerprint.algorithm,
  });

  return deepFreeze({
    detectionEngineVersion: CHANGE_DETECTION_ENGINE_VERSION,
    detectionStatus,
    changed: hashMismatch,
    confidence,
    confidenceMetadata: deepFreeze({
      reason: hashMismatch ? 'FINGERPRINT_MISMATCH' : 'FINGERPRINT_MATCH',
      previousAvailable: true,
      currentAvailable: true,
      etagChanged,
      lastModifiedChanged,
      contentLengthChanged,
      rawHashChanged: !!rawHashChanged,
      normalizedHashChanged: !!normalizedHashChanged,
      baselineConfidence: confidence,
    }),
    previousFingerprint: previousValue,
    currentFingerprint,
    hashMismatch,
    missingPreviousFingerprint: false,
    missingCurrentFingerprint: false,
    firstObservation: false,
    classification,
    extractionPerformed: false,
    reviewItemCreated: false,
    notificationSent: false,
    advisoryOnly: true,
  });
}

module.exports = {
  CHANGE_DETECTION_ENGINE_VERSION,
  DETECTION_STATUS,
  CHANGE_CLASSES,
  fingerprintValue,
  detectChange,
};
