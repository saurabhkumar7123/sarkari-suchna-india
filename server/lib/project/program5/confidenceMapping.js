'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Confidence Mapping (Advisory / Configurable Thresholds)
 *
 * Maps numeric confidence scores to reusable bands.
 * Confidence remains advisory. No automatic approval.
 */

const { deepFreeze } = require('./monitoringCandidateContract');

const CONFIDENCE_MAPPING_VERSION = '5B.1.0.0';

const CONFIDENCE_BANDS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
});

const VALID_CONFIDENCE_BANDS = Object.freeze(Object.values(CONFIDENCE_BANDS));

/**
 * Default thresholds (inclusive lower bounds).
 * high  >= 0.80
 * medium >= 0.50
 * low   >= 0.00
 */
const DEFAULT_CONFIDENCE_THRESHOLDS = Object.freeze({
  high: 0.8,
  medium: 0.5,
  low: 0.0,
});

function resolveThresholds(config = {}) {
  const high =
    config.high != null && Number.isFinite(Number(config.high))
      ? Number(config.high)
      : DEFAULT_CONFIDENCE_THRESHOLDS.high;
  const medium =
    config.medium != null && Number.isFinite(Number(config.medium))
      ? Number(config.medium)
      : DEFAULT_CONFIDENCE_THRESHOLDS.medium;
  const low =
    config.low != null && Number.isFinite(Number(config.low))
      ? Number(config.low)
      : DEFAULT_CONFIDENCE_THRESHOLDS.low;

  return deepFreeze({ high, medium, low });
}

function validateThresholdOrder(thresholds) {
  const issues = [];
  if (!(thresholds.high >= thresholds.medium && thresholds.medium >= thresholds.low)) {
    issues.push({
      code: 'THRESHOLD_ORDER_INVALID',
      severity: 'warning',
      message: 'Expected high >= medium >= low; mapping may be unpredictable',
    });
  }
  for (const key of ['high', 'medium', 'low']) {
    const v = thresholds[key];
    if (v < 0 || v > 1) {
      issues.push({
        code: 'THRESHOLD_OUT_OF_RANGE',
        severity: 'warning',
        field: key,
        message: `Threshold "${key}" should be within [0, 1]`,
      });
    }
  }
  return issues;
}

/**
 * Map a confidence score to a band using configurable thresholds.
 *
 * @param {number|null|undefined} confidence
 * @param {object} [thresholdConfig]
 */
function mapConfidenceBand(confidence, thresholdConfig = {}) {
  const thresholds = resolveThresholds(thresholdConfig);
  const thresholdIssues = validateThresholdOrder(thresholds);

  if (confidence === undefined || confidence === null || confidence === '') {
    return deepFreeze({
      mappingVersion: CONFIDENCE_MAPPING_VERSION,
      advisoryOnly: true,
      automaticApproval: false,
      confidence: null,
      band: CONFIDENCE_BANDS.UNKNOWN,
      thresholds,
      reason: 'confidence_missing',
      thresholdIssues,
    });
  }

  const score = Number(confidence);
  if (!Number.isFinite(score)) {
    return deepFreeze({
      mappingVersion: CONFIDENCE_MAPPING_VERSION,
      advisoryOnly: true,
      automaticApproval: false,
      confidence: null,
      band: CONFIDENCE_BANDS.UNKNOWN,
      thresholds,
      reason: 'confidence_not_numeric',
      thresholdIssues,
    });
  }

  let band = CONFIDENCE_BANDS.LOW;
  let reason = 'below_medium_threshold';
  if (score >= thresholds.high) {
    band = CONFIDENCE_BANDS.HIGH;
    reason = 'meets_high_threshold';
  } else if (score >= thresholds.medium) {
    band = CONFIDENCE_BANDS.MEDIUM;
    reason = 'meets_medium_threshold';
  } else if (score >= thresholds.low) {
    band = CONFIDENCE_BANDS.LOW;
    reason = 'meets_low_threshold';
  } else {
    band = CONFIDENCE_BANDS.UNKNOWN;
    reason = 'below_low_threshold';
  }

  return deepFreeze({
    mappingVersion: CONFIDENCE_MAPPING_VERSION,
    advisoryOnly: true,
    automaticApproval: false,
    confidence: score,
    band,
    thresholds,
    reason,
    thresholdIssues,
  });
}

/**
 * Create a reusable confidence mapper bound to thresholds.
 * @param {object} [thresholdConfig]
 */
function createConfidenceMapper(thresholdConfig = {}) {
  const thresholds = resolveThresholds(thresholdConfig);
  return deepFreeze({
    mappingVersion: CONFIDENCE_MAPPING_VERSION,
    thresholds,
    advisoryOnly: true,
    automaticApproval: false,
    map(confidence) {
      return mapConfidenceBand(confidence, thresholds);
    },
  });
}

module.exports = {
  CONFIDENCE_MAPPING_VERSION,
  CONFIDENCE_BANDS,
  VALID_CONFIDENCE_BANDS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  resolveThresholds,
  mapConfidenceBand,
  createConfidenceMapper,
};
