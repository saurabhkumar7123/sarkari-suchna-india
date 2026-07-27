'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Identity Fingerprint Engine (Deterministic / Configuration-Driven)
 *
 * Generates deterministic identity fingerprints using configurable fields.
 *
 * Supports fingerprint classes:
 *   - exact_identity
 *   - strong_similarity
 *   - partial_similarity
 *   - unknown
 *
 * No AI. No fuzzy external services. No machine learning.
 */

const crypto = require('crypto');
const { deepFreeze } = require('./candidateIdentityContract');

const IDENTITY_FINGERPRINT_ENGINE_VERSION = '5E.1.0.0';

const FINGERPRINT_CLASSES = Object.freeze({
  EXACT_IDENTITY: 'exact_identity',
  STRONG_SIMILARITY: 'strong_similarity',
  PARTIAL_SIMILARITY: 'partial_similarity',
  UNKNOWN: 'unknown',
});

/**
 * Default field sets used to derive fingerprints (configuration-driven).
 */
const DEFAULT_FINGERPRINT_FIELD_CONFIG = deepFreeze({
  exactIdentityFields: [
    'sourceUrl',
    'advertisementNumber',
    'organization',
    'recruitmentType',
    'title',
  ],
  strongSimilarityFields: [
    'advertisementNumber',
    'organization',
    'recruitmentType',
  ],
  partialSimilarityFields: ['organization', 'department', 'state', 'title'],
  alternateExactFields: ['source', 'advertisementNumber', 'title'],
});

const DEFAULT_FINGERPRINT_THRESHOLDS = deepFreeze({
  exactMinPresentFields: 3,
  strongMinPresentFields: 2,
  partialMinPresentFields: 2,
  exactConfidence: 1.0,
  strongConfidence: 0.85,
  partialConfidence: 0.55,
  unknownConfidence: 0.0,
});

function asNormalizedToken(value) {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, ' ')
    .replace(/[^\w\s.:/-]/g, '')
    .trim();
  return text.length ? text : null;
}

function extractIdentityValues(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const meta =
    raw.normalizedMetadata && typeof raw.normalizedMetadata === 'object'
      ? raw.normalizedMetadata
      : {};

  return {
    candidateId: asNormalizedToken(raw.candidateId),
    source: asNormalizedToken(raw.source || meta.source),
    sourceUrl: asNormalizedToken(raw.sourceUrl),
    recruitmentType: asNormalizedToken(
      raw.recruitmentType || meta.recruitmentType || meta.recruitmentCategory
    ),
    organization: asNormalizedToken(
      raw.organization || meta.organization || raw.department || meta.department
    ),
    department: asNormalizedToken(raw.department || meta.department),
    qualification: asNormalizedToken(raw.qualification || meta.qualification),
    state: asNormalizedToken(raw.state || meta.state),
    advertisementNumber: asNormalizedToken(
      raw.advertisementNumber ||
        raw.advertisementNo ||
        meta.advertisementNumber ||
        meta.advertisementNo
    ),
    title: asNormalizedToken(raw.title || meta.title),
  };
}

function collectPresentFields(values, fieldIds) {
  const present = [];
  const payload = {};
  for (const fieldId of fieldIds) {
    const value = values[fieldId];
    if (value != null) {
      present.push(fieldId);
      payload[fieldId] = value;
    }
  }
  return { present, payload };
}

function canonicalSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`
  );
  return `{${parts.join(',')}}`;
}

function hashPayload(prefix, payload) {
  const digest = crypto
    .createHash('sha256')
    .update(canonicalSerialize(payload))
    .digest('hex');
  return `${prefix}:${digest.slice(0, 24)}`;
}

function mergeConfig(defaults, overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return {
      fields: {
        exactIdentityFields: defaults.exactIdentityFields.slice(),
        strongSimilarityFields: defaults.strongSimilarityFields.slice(),
        partialSimilarityFields: defaults.partialSimilarityFields.slice(),
        alternateExactFields: defaults.alternateExactFields.slice(),
      },
      thresholds: { ...DEFAULT_FINGERPRINT_THRESHOLDS },
    };
  }

  return {
    fields: {
      exactIdentityFields: Array.isArray(overrides.exactIdentityFields)
        ? overrides.exactIdentityFields.map(String)
        : defaults.exactIdentityFields.slice(),
      strongSimilarityFields: Array.isArray(overrides.strongSimilarityFields)
        ? overrides.strongSimilarityFields.map(String)
        : defaults.strongSimilarityFields.slice(),
      partialSimilarityFields: Array.isArray(overrides.partialSimilarityFields)
        ? overrides.partialSimilarityFields.map(String)
        : defaults.partialSimilarityFields.slice(),
      alternateExactFields: Array.isArray(overrides.alternateExactFields)
        ? overrides.alternateExactFields.map(String)
        : defaults.alternateExactFields.slice(),
    },
    thresholds: {
      ...DEFAULT_FINGERPRINT_THRESHOLDS,
      ...(overrides.thresholds || {}),
    },
  };
}

/**
 * Generate a deterministic identity fingerprint for a candidate.
 *
 * @param {object} [input] candidate or identity fields
 * @param {object} [options] field/threshold configuration overrides
 */
function generateIdentityFingerprint(input = {}, options = {}) {
  const config = mergeConfig(DEFAULT_FINGERPRINT_FIELD_CONFIG, options);
  const values = extractIdentityValues(input);
  const advisoryNotes = [];

  const exact = collectPresentFields(values, config.fields.exactIdentityFields);
  const strong = collectPresentFields(
    values,
    config.fields.strongSimilarityFields
  );
  const partial = collectPresentFields(
    values,
    config.fields.partialSimilarityFields
  );
  const alternate = collectPresentFields(
    values,
    config.fields.alternateExactFields
  );

  let fingerprintClass = FINGERPRINT_CLASSES.UNKNOWN;
  let fingerprint = null;
  let confidence = config.thresholds.unknownConfidence;
  let contributingFields = [];

  if (exact.present.length >= config.thresholds.exactMinPresentFields) {
    fingerprintClass = FINGERPRINT_CLASSES.EXACT_IDENTITY;
    fingerprint = hashPayload('exact', exact.payload);
    confidence = config.thresholds.exactConfidence;
    contributingFields = exact.present.slice();
    advisoryNotes.push(
      'Exact identity fingerprint generated from configured identity fields.'
    );
  } else if (
    alternate.present.length >= config.thresholds.exactMinPresentFields
  ) {
    fingerprintClass = FINGERPRINT_CLASSES.EXACT_IDENTITY;
    fingerprint = hashPayload('exact-alt', alternate.payload);
    confidence = config.thresholds.exactConfidence;
    contributingFields = alternate.present.slice();
    advisoryNotes.push(
      'Exact identity fingerprint generated from alternate configured fields.'
    );
  } else if (strong.present.length >= config.thresholds.strongMinPresentFields) {
    fingerprintClass = FINGERPRINT_CLASSES.STRONG_SIMILARITY;
    fingerprint = hashPayload('strong', strong.payload);
    confidence = config.thresholds.strongConfidence;
    contributingFields = strong.present.slice();
    advisoryNotes.push(
      'Strong similarity fingerprint generated; operator review still required.'
    );
  } else if (
    partial.present.length >= config.thresholds.partialMinPresentFields
  ) {
    fingerprintClass = FINGERPRINT_CLASSES.PARTIAL_SIMILARITY;
    fingerprint = hashPayload('partial', partial.payload);
    confidence = config.thresholds.partialConfidence;
    contributingFields = partial.present.slice();
    advisoryNotes.push(
      'Partial similarity fingerprint generated from sparse configured fields.'
    );
  } else {
    advisoryNotes.push(
      'Insufficient configured fields to generate a usable identity fingerprint.'
    );
    if (values.candidateId) {
      fingerprint = hashPayload('unknown', { candidateId: values.candidateId });
      contributingFields = ['candidateId'];
    }
  }

  return deepFreeze({
    engineVersion: IDENTITY_FINGERPRINT_ENGINE_VERSION,
    advisoryOnly: true,
    deterministic: true,
    aiUsed: false,
    fuzzyExternalServiceUsed: false,
    machineLearningUsed: false,
    fingerprintClass,
    fingerprint,
    confidence,
    contributingFields,
    presentFieldCount: contributingFields.length,
    fieldValues: values,
    configurationDriven: true,
    advisoryNotes,
  });
}

/**
 * Compare two fingerprint results deterministically.
 */
function compareIdentityFingerprints(left, right) {
  const a = left && typeof left === 'object' ? left : {};
  const b = right && typeof right === 'object' ? right : {};

  if (!a.fingerprint || !b.fingerprint) {
    return deepFreeze({
      matched: false,
      matchClass: FINGERPRINT_CLASSES.UNKNOWN,
      reason: 'missing_fingerprint',
      score: 0,
    });
  }

  if (a.fingerprint === b.fingerprint) {
    const matchClass =
      a.fingerprintClass === b.fingerprintClass
        ? a.fingerprintClass
        : FINGERPRINT_CLASSES.STRONG_SIMILARITY;
    return deepFreeze({
      matched: true,
      matchClass,
      reason: 'fingerprint_equality',
      score:
        matchClass === FINGERPRINT_CLASSES.EXACT_IDENTITY
          ? 1
          : matchClass === FINGERPRINT_CLASSES.STRONG_SIMILARITY
            ? 0.85
            : 0.55,
    });
  }

  return deepFreeze({
    matched: false,
    matchClass: FINGERPRINT_CLASSES.UNKNOWN,
    reason: 'fingerprint_divergence',
    score: 0,
  });
}

module.exports = {
  IDENTITY_FINGERPRINT_ENGINE_VERSION,
  FINGERPRINT_CLASSES,
  DEFAULT_FINGERPRINT_FIELD_CONFIG,
  DEFAULT_FINGERPRINT_THRESHOLDS,
  generateIdentityFingerprint,
  compareIdentityFingerprints,
  extractIdentityValues,
};
