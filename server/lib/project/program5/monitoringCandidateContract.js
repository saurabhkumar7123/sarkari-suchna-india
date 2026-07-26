'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Monitoring Candidate Contract (Canonical / Versioned)
 *
 * Reusable canonical model representing a monitoring candidate destined
 * for the Human Review integration path.
 *
 * Versioned and extensible. Deep-frozen outputs.
 * No monitoring execution. No persistence. No queue insertion.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const MONITORING_CANDIDATE_CONTRACT_VERSION = '5B.1.0.0';
const MONITORING_CANDIDATE_SCHEMA_VERSION = 1;

const VALIDATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ADVISORY_PASS: 'advisory_pass',
  ADVISORY_WARN: 'advisory_warn',
  ADVISORY_FAIL: 'advisory_fail',
  UNKNOWN: 'unknown',
});

const VALID_VALIDATION_STATUSES = Object.freeze(Object.values(VALIDATION_STATUS));

const RECRUITMENT_TYPES = Object.freeze({
  NOTIFICATION: 'notification',
  APPLICATION: 'application',
  EXAM: 'exam',
  ADMIT_CARD: 'admit_card',
  RESULT: 'result',
  FINAL_RESULT: 'final_result',
  UNKNOWN: 'unknown',
});

const VALID_RECRUITMENT_TYPES = Object.freeze(Object.values(RECRUITMENT_TYPES));

const REQUIRED_CANDIDATE_FIELDS = Object.freeze([
  'candidateId',
  'source',
  'sourceUrl',
  'detectionTime',
  'recruitmentType',
  'confidence',
]);

const EXTENSIBLE_METADATA_KEYS = Object.freeze([
  'title',
  'department',
  'qualification',
  'state',
  'recruitmentCategory',
  'importantDates',
  'advertisementNo',
  'postName',
  'cycleYear',
  'rawFingerprint',
  'extensions',
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

function normalizeRecruitmentType(value) {
  const text = asStringOrNull(value);
  if (!text) return RECRUITMENT_TYPES.UNKNOWN;
  const key = text.toLowerCase().replace(/[\s-]+/g, '_');
  return VALID_RECRUITMENT_TYPES.includes(key) ? key : RECRUITMENT_TYPES.UNKNOWN;
}

function normalizeValidationStatus(value) {
  const text = asStringOrNull(value);
  if (!text) return VALIDATION_STATUS.PENDING;
  const key = text.toLowerCase().replace(/[\s-]+/g, '_');
  return VALID_VALIDATION_STATUSES.includes(key) ? key : VALIDATION_STATUS.UNKNOWN;
}

/**
 * Build a versioned monitoring candidate from raw input.
 * Extra fields land under normalizedMetadata.extensions (extensible).
 *
 * @param {object} [input]
 * @returns {object} deep-frozen candidate
 */
function createMonitoringCandidate(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const metadataIn =
    raw.normalizedMetadata && typeof raw.normalizedMetadata === 'object'
      ? raw.normalizedMetadata
      : {};

  const knownMeta = {};
  for (const key of EXTENSIBLE_METADATA_KEYS) {
    if (key === 'extensions') continue;
    if (metadataIn[key] !== undefined) {
      knownMeta[key] = metadataIn[key];
    } else if (raw[key] !== undefined) {
      knownMeta[key] = raw[key];
    }
  }

  const extensionSources = [
    raw.extensions,
    metadataIn.extensions,
    raw.extra,
    raw.customFields,
  ].filter((v) => v && typeof v === 'object' && !Array.isArray(v));

  const extensions = {};
  for (const src of extensionSources) {
    for (const key of Object.keys(src).sort()) {
      extensions[key] = src[key];
    }
  }

  // Capture unknown top-level keys as extensions for forward compatibility.
  const reserved = new Set([
    'candidateId',
    'source',
    'sourceUrl',
    'detectionTime',
    'recruitmentType',
    'confidence',
    'normalizedMetadata',
    'validationStatus',
    'advisoryNotes',
    'schemaVersion',
    'contractVersion',
    'extensions',
    'extra',
    'customFields',
    ...EXTENSIBLE_METADATA_KEYS,
  ]);
  for (const key of Object.keys(raw).sort()) {
    if (!reserved.has(key)) {
      extensions[key] = raw[key];
    }
  }

  const importantDatesRaw = knownMeta.importantDates;
  let importantDates = [];
  if (Array.isArray(importantDatesRaw)) {
    importantDates = importantDatesRaw
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          return {
            label: asStringOrNull(entry.label || entry.name || entry.type),
            date: asIsoOrNull(entry.date || entry.value || entry.at) || asStringOrNull(entry.date),
          };
        }
        return { label: null, date: asStringOrNull(entry) };
      })
      .filter((d) => d.label || d.date);
  }

  const advisoryNotes = Array.isArray(raw.advisoryNotes)
    ? raw.advisoryNotes.map((n) => asStringOrNull(n)).filter(Boolean)
    : raw.advisoryNotes
      ? [asStringOrNull(raw.advisoryNotes)].filter(Boolean)
      : [];

  const candidate = {
    schemaVersion: MONITORING_CANDIDATE_SCHEMA_VERSION,
    contractVersion: MONITORING_CANDIDATE_CONTRACT_VERSION,
    candidateId: asStringOrNull(raw.candidateId || raw.id),
    source: asStringOrNull(raw.source || raw.sourceName),
    sourceUrl: asStringOrNull(raw.sourceUrl || raw.url),
    detectionTime: asIsoOrNull(raw.detectionTime || raw.detectedAt) || asStringOrNull(raw.detectionTime),
    recruitmentType: normalizeRecruitmentType(raw.recruitmentType || raw.type),
    confidence: asNumberOrNull(raw.confidence),
    normalizedMetadata: {
      title: asStringOrNull(knownMeta.title),
      department: asStringOrNull(knownMeta.department),
      qualification: asStringOrNull(knownMeta.qualification),
      state: asStringOrNull(knownMeta.state),
      recruitmentCategory: asStringOrNull(
        knownMeta.recruitmentCategory || knownMeta.category
      ),
      importantDates,
      advertisementNo: asStringOrNull(knownMeta.advertisementNo),
      postName: asStringOrNull(knownMeta.postName),
      cycleYear: asNumberOrNull(knownMeta.cycleYear),
      rawFingerprint: asStringOrNull(knownMeta.rawFingerprint),
      extensions,
    },
    validationStatus: normalizeValidationStatus(raw.validationStatus),
    advisoryNotes,
  };

  return deepFreeze(candidate);
}

/**
 * Structural contract check (shape only — not advisory validation).
 * @param {object} candidate
 */
function validateMonitoringCandidateContract(candidate) {
  const diagnostics = [];
  const c = candidate && typeof candidate === 'object' ? candidate : null;

  if (!c) {
    return deepFreeze({
      valid: false,
      contractVersion: MONITORING_CANDIDATE_CONTRACT_VERSION,
      schemaVersion: MONITORING_CANDIDATE_SCHEMA_VERSION,
      missingFields: REQUIRED_CANDIDATE_FIELDS.slice(),
      diagnostics: [
        {
          code: 'CONTRACT_MISSING_CANDIDATE',
          severity: 'error',
          message: 'Candidate object is missing',
        },
      ],
    });
  }

  for (const field of REQUIRED_CANDIDATE_FIELDS) {
    const value = c[field];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && !value.trim()) ||
      (field === 'confidence' && !Number.isFinite(Number(value)));
    if (empty) {
      diagnostics.push({
        code: 'CONTRACT_MISSING_FIELD',
        severity: 'error',
        field,
        message: `Required contract field "${field}" is missing or invalid`,
      });
    }
  }

  if (
    c.schemaVersion != null &&
    Number(c.schemaVersion) !== MONITORING_CANDIDATE_SCHEMA_VERSION
  ) {
    diagnostics.push({
      code: 'CONTRACT_SCHEMA_VERSION_MISMATCH',
      severity: 'warning',
      field: 'schemaVersion',
      message: `Unexpected schemaVersion ${c.schemaVersion}; expected ${MONITORING_CANDIDATE_SCHEMA_VERSION}`,
    });
  }

  if (
    c.recruitmentType &&
    !VALID_RECRUITMENT_TYPES.includes(String(c.recruitmentType))
  ) {
    diagnostics.push({
      code: 'CONTRACT_INVALID_RECRUITMENT_TYPE',
      severity: 'error',
      field: 'recruitmentType',
      message: `Unsupported recruitmentType "${c.recruitmentType}"`,
    });
  }

  if (
    c.validationStatus &&
    !VALID_VALIDATION_STATUSES.includes(String(c.validationStatus))
  ) {
    diagnostics.push({
      code: 'CONTRACT_INVALID_VALIDATION_STATUS',
      severity: 'error',
      field: 'validationStatus',
      message: `Unsupported validationStatus "${c.validationStatus}"`,
    });
  }

  if (c.normalizedMetadata == null || typeof c.normalizedMetadata !== 'object') {
    diagnostics.push({
      code: 'CONTRACT_MISSING_METADATA',
      severity: 'warning',
      field: 'normalizedMetadata',
      message: 'normalizedMetadata object is recommended for extensibility',
    });
  }

  const missingFields = diagnostics
    .filter((d) => d.code === 'CONTRACT_MISSING_FIELD')
    .map((d) => d.field);

  return deepFreeze({
    valid: diagnostics.every((d) => d.severity !== 'error'),
    contractVersion: MONITORING_CANDIDATE_CONTRACT_VERSION,
    schemaVersion: MONITORING_CANDIDATE_SCHEMA_VERSION,
    missingFields,
    diagnostics,
  });
}

module.exports = {
  MONITORING_CANDIDATE_CONTRACT_VERSION,
  MONITORING_CANDIDATE_SCHEMA_VERSION,
  VALIDATION_STATUS,
  VALID_VALIDATION_STATUSES,
  RECRUITMENT_TYPES,
  VALID_RECRUITMENT_TYPES,
  REQUIRED_CANDIDATE_FIELDS,
  EXTENSIBLE_METADATA_KEYS,
  createMonitoringCandidate,
  validateMonitoringCandidateContract,
  normalizeRecruitmentType,
  normalizeValidationStatus,
  deepFreeze,
};
