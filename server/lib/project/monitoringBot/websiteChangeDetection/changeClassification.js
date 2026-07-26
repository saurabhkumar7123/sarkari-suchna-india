'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Change Classification (Advisory Only)
 *
 * Classifies detected changes. Does not extract recruitment data.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  FINGERPRINT_ALGORITHMS,
} = require('./contentFingerprintEngine');

const CHANGE_CLASSIFICATION_VERSION = 'MB2.1.0.0';

const CHANGE_CLASSES = Object.freeze({
  CONTENT_UPDATED: 'CONTENT_UPDATED',
  LAYOUT_ONLY: 'LAYOUT_ONLY',
  FILE_CHANGED: 'FILE_CHANGED',
  UNKNOWN: 'UNKNOWN',
  NO_CHANGE: 'NO_CHANGE',
});

/**
 * Classify a detected change using fingerprint and metadata signals.
 * Advisory only — heuristics, not extraction.
 *
 * @param {object} [input]
 */
function classifyDetectedChange(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const detectionStatus = src.detectionStatus;

  if (detectionStatus === 'NO_CHANGE') {
    return deepFreeze({
      classificationVersion: CHANGE_CLASSIFICATION_VERSION,
      advisoryOnly: true,
      classification: CHANGE_CLASSES.NO_CHANGE,
      confidence: 1,
      rationale: 'Fingerprints match; no change detected.',
      signals: Object.freeze([]),
      extractionPerformed: false,
    });
  }

  if (detectionStatus !== 'CHANGED') {
    return deepFreeze({
      classificationVersion: CHANGE_CLASSIFICATION_VERSION,
      advisoryOnly: true,
      classification: CHANGE_CLASSES.UNKNOWN,
      confidence: 0,
      rationale: 'Change classification requires a Changed detection status.',
      signals: Object.freeze(['MISSING_CHANGED_STATUS']),
      extractionPerformed: false,
    });
  }

  const signals = [];
  const algorithm =
    (src.fingerprint && src.fingerprint.algorithm) ||
    src.algorithm ||
    null;
  const rawHashChanged = src.rawHashChanged === true;
  const normalizedHashChanged = src.normalizedHashChanged === true;
  const etagChanged = src.etagChanged === true;
  const lastModifiedChanged = src.lastModifiedChanged === true;
  const contentLengthChanged = src.contentLengthChanged === true;
  const contentTypeHint =
    typeof src.contentType === 'string'
      ? src.contentType.toUpperCase()
      : typeof src.expectedContentType === 'string'
        ? src.expectedContentType.toUpperCase()
        : '';

  if (algorithm === FINGERPRINT_ALGORITHMS.PDF_BINARY || contentTypeHint === 'PDF') {
    signals.push('PDF_OR_BINARY_FINGERPRINT');
    return deepFreeze({
      classificationVersion: CHANGE_CLASSIFICATION_VERSION,
      advisoryOnly: true,
      classification: CHANGE_CLASSES.FILE_CHANGED,
      confidence: 0.9,
      rationale:
        'Binary/PDF fingerprint differs; classified as file changed (advisory).',
      signals: Object.freeze(signals),
      extractionPerformed: false,
    });
  }

  if (
    algorithm === FINGERPRINT_ALGORITHMS.NORMALIZED_HTML &&
    rawHashChanged &&
    !normalizedHashChanged
  ) {
    signals.push('RAW_HASH_CHANGED');
    signals.push('NORMALIZED_HASH_UNCHANGED');
    return deepFreeze({
      classificationVersion: CHANGE_CLASSIFICATION_VERSION,
      advisoryOnly: true,
      classification: CHANGE_CLASSES.LAYOUT_ONLY,
      confidence: 0.75,
      rationale:
        'Raw HTML hash changed while normalized content hash is unchanged; likely layout/noise (advisory).',
      signals: Object.freeze(signals),
      extractionPerformed: false,
    });
  }

  if (normalizedHashChanged || rawHashChanged || src.hashMismatch === true) {
    signals.push('FINGERPRINT_HASH_MISMATCH');
    if (etagChanged) signals.push('ETAG_CHANGED');
    if (lastModifiedChanged) signals.push('LAST_MODIFIED_CHANGED');
    if (contentLengthChanged) signals.push('CONTENT_LENGTH_CHANGED');

    let confidence = 0.85;
    if (etagChanged || lastModifiedChanged) confidence = 0.92;
    if (contentLengthChanged) confidence = Math.max(confidence, 0.88);

    return deepFreeze({
      classificationVersion: CHANGE_CLASSIFICATION_VERSION,
      advisoryOnly: true,
      classification: CHANGE_CLASSES.CONTENT_UPDATED,
      confidence,
      rationale:
        'Primary content fingerprint differs from previous observation (advisory).',
      signals: Object.freeze(signals),
      extractionPerformed: false,
    });
  }

  signals.push('INSUFFICIENT_SIGNALS');
  return deepFreeze({
    classificationVersion: CHANGE_CLASSIFICATION_VERSION,
    advisoryOnly: true,
    classification: CHANGE_CLASSES.UNKNOWN,
    confidence: 0.4,
    rationale: 'Change reported but classification signals are inconclusive.',
    signals: Object.freeze(signals),
    extractionPerformed: false,
  });
}

module.exports = {
  CHANGE_CLASSIFICATION_VERSION,
  CHANGE_CLASSES,
  classifyDetectedChange,
};
