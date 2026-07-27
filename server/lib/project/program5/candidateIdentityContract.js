'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Candidate Identity Contract (Versioned / Configuration-Driven)
 *
 * Versioned identity model for controlled candidate resolution
 * and advisory deduplication.
 *
 * Advisory only. Does NOT merge, delete, overwrite, or modify
 * production data.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const CANDIDATE_IDENTITY_CONTRACT_VERSION = '5E.1.0.0';

const REUSED_MODULE_IDS = Object.freeze({
  MONITORING_REVIEW_INTEGRATION: 'MONITORING_REVIEW_INTEGRATION',
  CONTROLLED_LIFECYCLE_ENGINE: 'CONTROLLED_LIFECYCLE_ENGINE',
  DRAFT_PREPARATION: 'DRAFT_PREPARATION',
  RECRUITMENT_OPERATIONS: 'RECRUITMENT_OPERATIONS',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  SHARED_PREVIEW: 'SHARED_PREVIEW',
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
});

/**
 * Default identity field catalog — configuration-driven and extensible.
 */
const DEFAULT_IDENTITY_FIELD_CATALOG = deepFreeze([
  {
    fieldId: 'candidateId',
    label: 'Candidate ID',
    required: true,
    category: 'identity',
  },
  {
    fieldId: 'source',
    label: 'Source',
    required: true,
    category: 'provenance',
  },
  {
    fieldId: 'sourceUrl',
    label: 'Source URL',
    required: true,
    category: 'provenance',
  },
  {
    fieldId: 'recruitmentType',
    label: 'Recruitment Type',
    required: true,
    category: 'recruitment',
  },
  {
    fieldId: 'organization',
    label: 'Organization',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'department',
    label: 'Department',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'qualification',
    label: 'Qualification',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'state',
    label: 'State',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'advertisementNumber',
    label: 'Advertisement Number',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'title',
    label: 'Title',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'importantDates',
    label: 'Important Dates',
    required: false,
    category: 'recruitment',
  },
  {
    fieldId: 'identityFingerprint',
    label: 'Identity Fingerprint',
    required: false,
    category: 'fingerprint',
  },
  {
    fieldId: 'confidence',
    label: 'Confidence',
    required: true,
    category: 'scoring',
  },
  {
    fieldId: 'advisoryNotes',
    label: 'Advisory Notes',
    required: false,
    category: 'advisory',
  },
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

function normalizeImportantDates(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (entry == null) return null;
      if (typeof entry === 'string') {
        const date = asStringOrNull(entry);
        return date ? { label: null, date } : null;
      }
      if (typeof entry === 'object') {
        const label = asStringOrNull(entry.label);
        const date = asStringOrNull(entry.date || entry.value);
        if (!label && !date) return null;
        return { label, date };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Create a versioned candidate identity contract definition.
 *
 * @param {object} [options]
 * @param {string} [options.version]
 * @param {object[]} [options.fields]
 * @param {object} [options.extensions]
 */
function createCandidateIdentityContract(options = {}) {
  const fields = Array.isArray(options.fields)
    ? options.fields.map((field) => ({
        fieldId: String(field.fieldId),
        label: String(field.label || field.fieldId),
        required: Boolean(field.required),
        category: String(field.category || 'custom'),
      }))
    : DEFAULT_IDENTITY_FIELD_CATALOG.map((field) => ({ ...field }));

  return deepFreeze({
    contractVersion: options.version || CANDIDATE_IDENTITY_CONTRACT_VERSION,
    configurationDriven: true,
    advisoryOnly: true,
    extensible: true,
    productionMergeDenied: true,
    productionDeleteDenied: true,
    productionOverwriteDenied: true,
    fieldCount: fields.length,
    fieldIds: fields.map((field) => field.fieldId),
    fields,
    reusedModules: REUSED_MODULE_IDS,
    extensions:
      options.extensions && typeof options.extensions === 'object'
        ? options.extensions
        : {},
  });
}

function getDefaultCandidateIdentityContract() {
  return createCandidateIdentityContract();
}

/**
 * Build a versioned candidate identity model from raw or monitoring input.
 * Advisory only — never mutates production records.
 *
 * @param {object} [input]
 * @param {object} [input.fingerprintResult] optional precomputed fingerprint
 */
function createCandidateIdentityModel(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const meta =
    raw.normalizedMetadata && typeof raw.normalizedMetadata === 'object'
      ? raw.normalizedMetadata
      : {};
  const fingerprintResult =
    raw.fingerprintResult && typeof raw.fingerprintResult === 'object'
      ? raw.fingerprintResult
      : null;

  const organization =
    asStringOrNull(raw.organization) ||
    asStringOrNull(meta.organization) ||
    asStringOrNull(raw.department) ||
    asStringOrNull(meta.department);

  const advertisementNumber =
    asStringOrNull(raw.advertisementNumber) ||
    asStringOrNull(raw.advertisementNo) ||
    asStringOrNull(meta.advertisementNumber) ||
    asStringOrNull(meta.advertisementNo);

  const importantDates = normalizeImportantDates(
    raw.importantDates != null ? raw.importantDates : meta.importantDates
  );

  const identityFingerprint =
    asStringOrNull(raw.identityFingerprint) ||
    (fingerprintResult && asStringOrNull(fingerprintResult.fingerprint)) ||
    asStringOrNull(raw.rawFingerprint) ||
    asStringOrNull(meta.rawFingerprint) ||
    asStringOrNull(meta.identityFingerprint);

  const advisoryNotes = Array.isArray(raw.advisoryNotes)
    ? raw.advisoryNotes.map((note) => String(note))
    : fingerprintResult && Array.isArray(fingerprintResult.advisoryNotes)
      ? fingerprintResult.advisoryNotes.map((note) => String(note))
      : [];

  const confidence = asNumberOrNull(raw.confidence);
  const fingerprintConfidence =
    fingerprintResult && asNumberOrNull(fingerprintResult.confidence);

  return deepFreeze({
    contractVersion: CANDIDATE_IDENTITY_CONTRACT_VERSION,
    advisoryOnly: true,
    productionRecord: false,
    merged: false,
    deleted: false,
    overwritten: false,
    candidateId: asStringOrNull(raw.candidateId),
    source: asStringOrNull(raw.source),
    sourceUrl: asStringOrNull(raw.sourceUrl),
    recruitmentType:
      asStringOrNull(raw.recruitmentType) ||
      asStringOrNull(meta.recruitmentType) ||
      asStringOrNull(meta.recruitmentCategory) ||
      'unknown',
    organization,
    department:
      asStringOrNull(raw.department) || asStringOrNull(meta.department),
    qualification:
      asStringOrNull(raw.qualification) || asStringOrNull(meta.qualification),
    state: asStringOrNull(raw.state) || asStringOrNull(meta.state),
    advertisementNumber,
    title: asStringOrNull(raw.title) || asStringOrNull(meta.title),
    importantDates,
    identityFingerprint,
    fingerprintClass:
      fingerprintResult && fingerprintResult.fingerprintClass
        ? fingerprintResult.fingerprintClass
        : identityFingerprint
          ? 'exact_identity'
          : 'unknown',
    confidence:
      confidence != null
        ? confidence
        : fingerprintConfidence != null
          ? fingerprintConfidence
          : null,
    advisoryNotes,
    extensions:
      raw.extensions && typeof raw.extensions === 'object'
        ? raw.extensions
        : meta.extensions && typeof meta.extensions === 'object'
          ? meta.extensions
          : {},
  });
}

module.exports = {
  CANDIDATE_IDENTITY_CONTRACT_VERSION,
  REUSED_MODULE_IDS,
  DEFAULT_IDENTITY_FIELD_CATALOG,
  deepFreeze,
  createCandidateIdentityContract,
  getDefaultCandidateIdentityContract,
  createCandidateIdentityModel,
};
