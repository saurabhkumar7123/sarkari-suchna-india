'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Duplicate Detection (Advisory Fingerprints / Structured Identifiers)
 *
 * Returns advisory duplicate status only.
 * No merge. No delete. No database.
 */

const crypto = require('crypto');
const { deepFreeze } = require('../governmentSourceRegistry');

const DUPLICATE_DETECTION_VERSION = 'MB3.1.0.0';

const DUPLICATE_STATUS = Object.freeze({
  UNIQUE: 'UNIQUE',
  EXACT_DUPLICATE: 'EXACT_DUPLICATE',
  NEAR_DUPLICATE: 'NEAR_DUPLICATE',
  SAME_ADVERTISEMENT: 'SAME_ADVERTISEMENT',
  UNKNOWN: 'UNKNOWN',
});

function asStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeKeyPart(value) {
  const text = asStringOrNull(value);
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Build an advisory fingerprint from structured recruitment fields.
 * @param {object} recruitment
 */
function generateRecruitmentFingerprint(recruitment = {}) {
  const r = recruitment && typeof recruitment === 'object' ? recruitment : {};
  const parts = [
    normalizeKeyPart(r.sourceId),
    normalizeKeyPart(r.advertisementNumber),
    normalizeKeyPart(r.recruitmentTitle),
    normalizeKeyPart(r.organization),
    normalizeKeyPart(r.officialUrl),
  ];
  const canonical = parts.join('|');
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');

  return deepFreeze({
    fingerprintVersion: DUPLICATE_DETECTION_VERSION,
    algorithm: 'sha256',
    fingerprint: hash,
    canonical,
    identifiers: {
      sourceId: asStringOrNull(r.sourceId),
      advertisementNumber: asStringOrNull(r.advertisementNumber),
      recruitmentTitle: asStringOrNull(r.recruitmentTitle),
      organization: asStringOrNull(r.organization),
      officialUrl: asStringOrNull(r.officialUrl),
      rawSourceReference: asStringOrNull(r.rawSourceReference),
    },
    advisoryOnly: true,
  });
}

function compareIdentifiers(left, right) {
  const fields = [
    'sourceId',
    'advertisementNumber',
    'recruitmentTitle',
    'organization',
    'officialUrl',
  ];
  const matching = [];
  const different = [];
  const missing = [];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const a = normalizeKeyPart(left[field]);
    const b = normalizeKeyPart(right[field]);
    if (!a && !b) {
      missing.push(field);
      continue;
    }
    if (!a || !b) {
      different.push(field);
      continue;
    }
    if (a === b) matching.push(field);
    else different.push(field);
  }

  return { matching, different, missing };
}

/**
 * Compare a recruitment against advisory fingerprints / prior recruitments.
 * @param {object} [input]
 */
function detectAdvisoryDuplicate(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const recruitment = src.recruitment || {};
  const current = generateRecruitmentFingerprint(recruitment);

  const existingFingerprints = Array.isArray(src.existingFingerprints)
    ? src.existingFingerprints
    : [];
  const existingRecruitments = Array.isArray(src.existingRecruitments)
    ? src.existingRecruitments
    : [];

  const comparisons = [];

  for (let i = 0; i < existingFingerprints.length; i += 1) {
    const entry = existingFingerprints[i];
    const fp =
      typeof entry === 'string'
        ? entry
        : entry && entry.fingerprint
          ? entry.fingerprint
          : null;
    if (!fp) continue;
    if (fp === current.fingerprint) {
      comparisons.push({
        matchType: DUPLICATE_STATUS.EXACT_DUPLICATE,
        fingerprint: fp,
        score: 1,
      });
    }
  }

  for (let i = 0; i < existingRecruitments.length; i += 1) {
    const other = generateRecruitmentFingerprint(existingRecruitments[i]);
    const fieldComparison = compareIdentifiers(
      current.identifiers,
      other.identifiers
    );

    if (other.fingerprint === current.fingerprint) {
      comparisons.push({
        matchType: DUPLICATE_STATUS.EXACT_DUPLICATE,
        fingerprint: other.fingerprint,
        score: 1,
        matchingFields: fieldComparison.matching,
      });
      continue;
    }

    const leftAdv = normalizeKeyPart(current.identifiers.advertisementNumber);
    const rightAdv = normalizeKeyPart(other.identifiers.advertisementNumber);
    const sameSource =
      normalizeKeyPart(current.identifiers.sourceId) &&
      normalizeKeyPart(current.identifiers.sourceId) ===
        normalizeKeyPart(other.identifiers.sourceId);

    if (leftAdv && rightAdv && leftAdv === rightAdv && sameSource) {
      comparisons.push({
        matchType: DUPLICATE_STATUS.SAME_ADVERTISEMENT,
        fingerprint: other.fingerprint,
        score: 0.92,
        matchingFields: fieldComparison.matching,
      });
      continue;
    }

    if (fieldComparison.matching.length >= 3 && fieldComparison.different.length <= 2) {
      comparisons.push({
        matchType: DUPLICATE_STATUS.NEAR_DUPLICATE,
        fingerprint: other.fingerprint,
        score: fieldComparison.matching.length / 5,
        matchingFields: fieldComparison.matching,
        differentFields: fieldComparison.different,
      });
    }
  }

  let status = DUPLICATE_STATUS.UNIQUE;
  let bestScore = 0;
  for (let i = 0; i < comparisons.length; i += 1) {
    if (comparisons[i].score > bestScore) {
      bestScore = comparisons[i].score;
      status = comparisons[i].matchType;
    }
  }

  if (
    existingFingerprints.length === 0 &&
    existingRecruitments.length === 0 &&
    !current.identifiers.advertisementNumber &&
    !current.identifiers.recruitmentTitle
  ) {
    status = DUPLICATE_STATUS.UNKNOWN;
  }

  return deepFreeze({
    detectionVersion: DUPLICATE_DETECTION_VERSION,
    advisoryOnly: true,
    persistenceDenied: true,
    mergeDenied: true,
    deleteDenied: true,
    duplicateStatus: status,
    isDuplicate:
      status === DUPLICATE_STATUS.EXACT_DUPLICATE ||
      status === DUPLICATE_STATUS.NEAR_DUPLICATE ||
      status === DUPLICATE_STATUS.SAME_ADVERTISEMENT,
    fingerprint: current,
    comparisons,
    bestScore,
  });
}

module.exports = {
  DUPLICATE_DETECTION_VERSION,
  DUPLICATE_STATUS,
  generateRecruitmentFingerprint,
  detectAdvisoryDuplicate,
};
