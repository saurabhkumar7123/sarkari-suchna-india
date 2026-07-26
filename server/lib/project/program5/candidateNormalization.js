'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Candidate Normalization (Deterministic / Configuration-Driven)
 *
 * Normalizes titles, departments, qualifications, states,
 * recruitment categories, and important dates.
 *
 * Deterministic. No AI. No external APIs.
 */

const { deepFreeze, createMonitoringCandidate } = require('./monitoringCandidateContract');

const CANDIDATE_NORMALIZATION_VERSION = '5B.1.0.0';

const DEFAULT_DEPARTMENT_ALIASES = Object.freeze({
  defence: 'army',
  defense: 'army',
  'ministry of defence': 'army',
  ssc: 'ssc',
  'staff selection commission': 'ssc',
  upsc: 'upsc',
  'union public service commission': 'upsc',
  railway: 'rrb',
  railways: 'rrb',
  'indian railways': 'rrb',
});

const DEFAULT_STATE_ALIASES = Object.freeze({
  'all india': 'central',
  india: 'central',
  'pan india': 'central',
  up: 'uttar pradesh',
  'u.p.': 'uttar pradesh',
  'u.p': 'uttar pradesh',
  mp: 'madhya pradesh',
  'm.p.': 'madhya pradesh',
  'm.p': 'madhya pradesh',
  uk: 'uttarakhand',
  ua: 'uttarakhand',
  nct: 'delhi',
  'nct of delhi': 'delhi',
  'new delhi': 'delhi',
});

const DEFAULT_QUALIFICATION_ALIASES = Object.freeze({
  graduate: 'graduation',
  graduates: 'graduation',
  'bachelor': 'graduation',
  'bachelors': 'graduation',
  'b.a': 'graduation',
  'b.sc': 'graduation',
  'b.tech': 'graduation',
  'post graduate': 'post graduation',
  postgraduate: 'post graduation',
  'post-graduate': 'post graduation',
  masters: 'post graduation',
  'master': 'post graduation',
  '10 th': '10th',
  '10th pass': '10th',
  matric: '10th',
  '12 th': '12th',
  '12th pass': '12th',
  intermediate: '12th',
  'senior secondary': '12th',
  doctorate: 'phd',
  'ph.d': 'phd',
  'ph.d.': 'phd',
});

const DEFAULT_CATEGORY_ALIASES = Object.freeze({
  'latest jobs': 'notification',
  jobs: 'notification',
  vacancy: 'notification',
  vacancies: 'notification',
  recruitment: 'notification',
  'admit card': 'admit_card',
  'admit cards': 'admit_card',
  'hall ticket': 'admit_card',
  results: 'result',
  'final results': 'final_result',
  'final result': 'final_result',
  exam: 'exam',
  examination: 'exam',
  application: 'application',
  apply: 'application',
});

const DEFAULT_DATE_LABEL_ALIASES = Object.freeze({
  'last date': 'application_end',
  'last date to apply': 'application_end',
  'closing date': 'application_end',
  'apply by': 'application_end',
  'start date': 'application_start',
  'opening date': 'application_start',
  'exam date': 'exam_date',
  'examination date': 'exam_date',
  'result date': 'result_date',
  'admit card date': 'admit_card_date',
  notification: 'notification_date',
  'notification date': 'notification_date',
});

function collapseWhitespace(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSlugKey(value) {
  const text = collapseWhitespace(value).toLowerCase();
  return text || null;
}

function applyAliasMap(value, aliases) {
  const key = toSlugKey(value);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(aliases, key)) {
    return aliases[key];
  }
  return key;
}

/**
 * Deterministic title normalization: trim, collapse whitespace, strip trailing noise.
 */
function normalizeTitle(value) {
  let text = collapseWhitespace(value);
  if (!text) return null;
  text = text.replace(/[\s|–—-]+$/g, '').trim();
  text = text.replace(/\s{2,}/g, ' ');
  return text || null;
}

function normalizeDepartment(value, aliases = DEFAULT_DEPARTMENT_ALIASES) {
  return applyAliasMap(value, aliases);
}

function normalizeQualification(value, aliases = DEFAULT_QUALIFICATION_ALIASES) {
  return applyAliasMap(value, aliases);
}

function normalizeState(value, aliases = DEFAULT_STATE_ALIASES) {
  return applyAliasMap(value, aliases);
}

function normalizeRecruitmentCategory(value, aliases = DEFAULT_CATEGORY_ALIASES) {
  return applyAliasMap(value, aliases);
}

function normalizeImportantDateEntry(entry, labelAliases = DEFAULT_DATE_LABEL_ALIASES) {
  if (entry == null) return null;
  if (typeof entry !== 'object') {
    const dateText = collapseWhitespace(entry);
    return dateText ? { label: null, date: dateText } : null;
  }
  const labelRaw = entry.label || entry.name || entry.type || null;
  const dateRaw = entry.date || entry.value || entry.at || null;
  const labelKey = toSlugKey(labelRaw);
  const label =
    labelKey && Object.prototype.hasOwnProperty.call(labelAliases, labelKey)
      ? labelAliases[labelKey]
      : labelKey;
  let date = null;
  if (dateRaw != null && String(dateRaw).trim()) {
    const parsed = Date.parse(String(dateRaw));
    date = Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : collapseWhitespace(dateRaw);
  }
  if (!label && !date) return null;
  return { label: label || null, date };
}

function normalizeImportantDates(value, labelAliases = DEFAULT_DATE_LABEL_ALIASES) {
  const rows = Array.isArray(value) ? value : value != null ? [value] : [];
  const normalized = [];
  for (const entry of rows) {
    const item = normalizeImportantDateEntry(entry, labelAliases);
    if (item) normalized.push(item);
  }
  // Deterministic sort: label then date
  normalized.sort((a, b) => {
    const la = a.label || '';
    const lb = b.label || '';
    if (la !== lb) return la.localeCompare(lb);
    return String(a.date || '').localeCompare(String(b.date || ''));
  });
  return normalized;
}

function resolveConfig(config = {}) {
  return {
    departmentAliases: {
      ...DEFAULT_DEPARTMENT_ALIASES,
      ...(config.departmentAliases || {}),
    },
    stateAliases: {
      ...DEFAULT_STATE_ALIASES,
      ...(config.stateAliases || {}),
    },
    qualificationAliases: {
      ...DEFAULT_QUALIFICATION_ALIASES,
      ...(config.qualificationAliases || {}),
    },
    categoryAliases: {
      ...DEFAULT_CATEGORY_ALIASES,
      ...(config.categoryAliases || {}),
    },
    dateLabelAliases: {
      ...DEFAULT_DATE_LABEL_ALIASES,
      ...(config.dateLabelAliases || {}),
    },
  };
}

/**
 * Normalize a monitoring candidate (or raw input) into canonical fields.
 * Same input + same config → same output.
 *
 * @param {object} input
 * @param {object} [config]
 */
function normalizeMonitoringCandidate(input = {}, config = {}) {
  const resolved = resolveConfig(config);
  const base =
    input && input.contractVersion
      ? input
      : createMonitoringCandidate(input);
  const meta = base.normalizedMetadata || {};

  const normalizedMetadata = {
    title: normalizeTitle(meta.title),
    department: normalizeDepartment(meta.department, resolved.departmentAliases),
    qualification: normalizeQualification(
      meta.qualification,
      resolved.qualificationAliases
    ),
    state: normalizeState(meta.state, resolved.stateAliases),
    recruitmentCategory: normalizeRecruitmentCategory(
      meta.recruitmentCategory,
      resolved.categoryAliases
    ),
    importantDates: normalizeImportantDates(
      meta.importantDates,
      resolved.dateLabelAliases
    ),
    advertisementNo: meta.advertisementNo
      ? collapseWhitespace(meta.advertisementNo).toUpperCase()
      : null,
    postName: normalizeTitle(meta.postName),
    cycleYear:
      meta.cycleYear != null && Number.isFinite(Number(meta.cycleYear))
        ? Number(meta.cycleYear)
        : null,
    rawFingerprint: meta.rawFingerprint || null,
    extensions:
      meta.extensions && typeof meta.extensions === 'object'
        ? { ...meta.extensions }
        : {},
  };

  const mappingSummary = {
    title: { from: meta.title || null, to: normalizedMetadata.title },
    department: { from: meta.department || null, to: normalizedMetadata.department },
    qualification: {
      from: meta.qualification || null,
      to: normalizedMetadata.qualification,
    },
    state: { from: meta.state || null, to: normalizedMetadata.state },
    recruitmentCategory: {
      from: meta.recruitmentCategory || null,
      to: normalizedMetadata.recruitmentCategory,
    },
    importantDates: {
      fromCount: Array.isArray(meta.importantDates) ? meta.importantDates.length : 0,
      toCount: normalizedMetadata.importantDates.length,
    },
  };

  return deepFreeze({
    normalizationVersion: CANDIDATE_NORMALIZATION_VERSION,
    deterministic: true,
    aiUsed: false,
    externalApisUsed: false,
    status: 'normalized',
    candidate: createMonitoringCandidate({
      ...base,
      normalizedMetadata,
      advisoryNotes: base.advisoryNotes,
    }),
    mappingSummary,
  });
}

module.exports = {
  CANDIDATE_NORMALIZATION_VERSION,
  DEFAULT_DEPARTMENT_ALIASES,
  DEFAULT_STATE_ALIASES,
  DEFAULT_QUALIFICATION_ALIASES,
  DEFAULT_CATEGORY_ALIASES,
  DEFAULT_DATE_LABEL_ALIASES,
  normalizeTitle,
  normalizeDepartment,
  normalizeQualification,
  normalizeState,
  normalizeRecruitmentCategory,
  normalizeImportantDates,
  normalizeMonitoringCandidate,
};
