'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Structured Recruitment Model (Immutable / Advisory Only)
 *
 * Canonical immutable recruitment object produced by extraction.
 * No persistence. No publishing.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const STRUCTURED_RECRUITMENT_MODEL_VERSION = 'MB3.1.0.0';
const STRUCTURED_RECRUITMENT_SCHEMA_VERSION = 1;

const APPLICATION_MODES = Object.freeze({
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  HYBRID: 'HYBRID',
  UNKNOWN: 'UNKNOWN',
});

const REQUIRED_RECRUITMENT_FIELDS = Object.freeze([
  'sourceId',
  'recruitmentTitle',
  'officialUrl',
]);

const OPTIONAL_RECRUITMENT_FIELDS = Object.freeze([
  'department',
  'organization',
  'advertisementNumber',
  'notificationDate',
  'lastDate',
  'applicationMode',
  'qualification',
  'age',
  'vacancyCount',
  'category',
  'attachments',
  'rawSourceReference',
  'confidenceScore',
]);

function asStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIsoOrNull(value) {
  const text = asStringOrNull(value);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function normalizeApplicationMode(value) {
  const text = asStringOrNull(value);
  if (!text) return APPLICATION_MODES.UNKNOWN;
  const key = text.toUpperCase().replace(/[\s-]+/g, '_');
  if (Object.prototype.hasOwnProperty.call(APPLICATION_MODES, key)) {
    return APPLICATION_MODES[key];
  }
  if (/online/i.test(text)) return APPLICATION_MODES.ONLINE;
  if (/offline/i.test(text)) return APPLICATION_MODES.OFFLINE;
  if (/hybrid|both/i.test(text)) return APPLICATION_MODES.HYBRID;
  return APPLICATION_MODES.UNKNOWN;
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) {
      return [{ url: value.trim(), label: null, contentType: null }];
    }
    return [];
  }
  return value
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        return url
          ? { url, label: null, contentType: null, attachmentId: `ATT_${index + 1}` }
          : null;
      }
      if (!entry || typeof entry !== 'object') return null;
      const url = asStringOrNull(entry.url || entry.href || entry.link);
      if (!url) return null;
      return {
        attachmentId:
          asStringOrNull(entry.attachmentId) || `ATT_${index + 1}`,
        url,
        label: asStringOrNull(entry.label || entry.name || entry.title),
        contentType: asStringOrNull(entry.contentType || entry.mimeType),
      };
    })
    .filter(Boolean);
}

function clampConfidence(value) {
  const n = asNumberOrNull(value);
  if (n == null) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 10000) / 10000;
}

/**
 * Create an immutable structured recruitment object.
 * @param {object} [input]
 */
function createStructuredRecruitment(input = {}) {
  const src = input && typeof input === 'object' ? input : {};

  const recruitment = {
    modelVersion: STRUCTURED_RECRUITMENT_MODEL_VERSION,
    schemaVersion: STRUCTURED_RECRUITMENT_SCHEMA_VERSION,
    immutable: true,
    readOnly: true,
    advisoryOnly: true,

    sourceId: asStringOrNull(src.sourceId || src.source),
    department: asStringOrNull(src.department),
    organization: asStringOrNull(src.organization || src.org),
    recruitmentTitle: asStringOrNull(
      src.recruitmentTitle || src.title || src.postName
    ),
    advertisementNumber: asStringOrNull(
      src.advertisementNumber || src.advertisementNo || src.advtNo
    ),
    notificationDate:
      asIsoOrNull(src.notificationDate || src.noticeDate || src.publishedAt) ||
      asStringOrNull(src.notificationDate),
    lastDate:
      asIsoOrNull(src.lastDate || src.closingDate || src.applicationEndDate) ||
      asStringOrNull(src.lastDate),
    applicationMode: normalizeApplicationMode(src.applicationMode),
    qualification: asStringOrNull(src.qualification || src.eligibility),
    age: asStringOrNull(src.age || src.ageLimit),
    vacancyCount: asNumberOrNull(src.vacancyCount || src.vacancies || src.posts),
    category: asStringOrNull(src.category || src.recruitmentCategory),
    officialUrl: asStringOrNull(
      src.officialUrl || src.sourceUrl || src.url || src.link
    ),
    attachments: normalizeAttachments(src.attachments),
    rawSourceReference: asStringOrNull(
      src.rawSourceReference || src.rawReference || src.fingerprint
    ),
    confidenceScore: clampConfidence(
      src.confidenceScore != null ? src.confidenceScore : src.confidence
    ),
    extractedFields: Array.isArray(src.extractedFields)
      ? src.extractedFields.map((f) => asStringOrNull(f)).filter(Boolean)
      : [],
    parserId: asStringOrNull(src.parserId),
    contentType: asStringOrNull(src.contentType),
    extractionTimestamp:
      asIsoOrNull(src.extractionTimestamp) ||
      (typeof src.extractionTimestamp === 'string'
        ? src.extractionTimestamp
        : null),
  };

  return deepFreeze(recruitment);
}

/**
 * Validate structured recruitment shape (advisory only).
 * @param {object} recruitment
 */
function validateStructuredRecruitment(recruitment) {
  const r = recruitment && typeof recruitment === 'object' ? recruitment : null;
  const missingRequired = [];
  const diagnostics = [];

  if (!r) {
    return deepFreeze({
      valid: false,
      modelVersion: STRUCTURED_RECRUITMENT_MODEL_VERSION,
      missingRequired: REQUIRED_RECRUITMENT_FIELDS.slice(),
      missingOptional: OPTIONAL_RECRUITMENT_FIELDS.slice(),
      diagnostics: [
        {
          code: 'RECRUITMENT_OBJECT_MISSING',
          severity: 'error',
          message: 'Structured recruitment object is missing',
        },
      ],
    });
  }

  for (const field of REQUIRED_RECRUITMENT_FIELDS) {
    const value = r[field];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && !value.trim());
    if (empty) {
      missingRequired.push(field);
      diagnostics.push({
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
        field,
        message: `Required field "${field}" is missing`,
      });
    }
  }

  const missingOptional = [];
  for (const field of OPTIONAL_RECRUITMENT_FIELDS) {
    const value = r[field];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && !value.trim()) ||
      (Array.isArray(value) && value.length === 0) ||
      (field === 'confidenceScore' &&
        (value === 0 || !Number.isFinite(Number(value))));
    if (empty && field !== 'confidenceScore') {
      missingOptional.push(field);
    }
  }

  if (
    r.schemaVersion != null &&
    Number(r.schemaVersion) !== STRUCTURED_RECRUITMENT_SCHEMA_VERSION
  ) {
    diagnostics.push({
      code: 'SCHEMA_VERSION_MISMATCH',
      severity: 'warning',
      field: 'schemaVersion',
      message: `Unexpected schemaVersion ${r.schemaVersion}`,
    });
  }

  return deepFreeze({
    valid: missingRequired.length === 0,
    modelVersion: STRUCTURED_RECRUITMENT_MODEL_VERSION,
    missingRequired,
    missingOptional,
    diagnostics,
  });
}

module.exports = {
  STRUCTURED_RECRUITMENT_MODEL_VERSION,
  STRUCTURED_RECRUITMENT_SCHEMA_VERSION,
  APPLICATION_MODES,
  REQUIRED_RECRUITMENT_FIELDS,
  OPTIONAL_RECRUITMENT_FIELDS,
  createStructuredRecruitment,
  validateStructuredRecruitment,
  normalizeApplicationMode,
  deepFreeze,
};
