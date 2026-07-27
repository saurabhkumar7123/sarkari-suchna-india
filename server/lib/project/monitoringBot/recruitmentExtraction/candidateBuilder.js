'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Candidate Builder (Advisory Candidates Only)
 *
 * Creates advisory candidate objects for Program 5 integration.
 * No database. No review queue creation. No publishing.
 */

const crypto = require('crypto');
const { deepFreeze } = require('../governmentSourceRegistry');
const {
  createStructuredRecruitment,
} = require('./structuredRecruitmentModel');

const CANDIDATE_BUILDER_VERSION = 'MB3.1.0.0';

const CANDIDATE_STATUSES = Object.freeze({
  ADVISORY: 'ADVISORY',
  INCOMPLETE: 'INCOMPLETE',
  DUPLICATE_ADVISORY: 'DUPLICATE_ADVISORY',
  SKIPPED: 'SKIPPED',
});

function asStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function buildCandidateId(recruitment) {
  const seed = [
    recruitment.sourceId || '',
    recruitment.advertisementNumber || '',
    recruitment.recruitmentTitle || '',
    recruitment.officialUrl || '',
    recruitment.rawSourceReference || '',
  ].join('|');
  const hash = crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
  return `ADV_${hash.slice(0, 16).toUpperCase()}`;
}

function inferRecruitmentType(recruitment) {
  const title = String(recruitment.recruitmentTitle || '').toLowerCase();
  if (/admit\s*card/.test(title)) return 'admit_card';
  if (/result|final\s*result/.test(title)) return 'result';
  if (/exam|examination/.test(title)) return 'exam';
  if (/application|apply/.test(title)) return 'application';
  if (/notification|recruitment|vacancy|advertisement/.test(title)) {
    return 'notification';
  }
  return 'unknown';
}

/**
 * Build an advisory candidate from a structured recruitment.
 * Compatible with Program 5B monitoring candidate shape.
 *
 * @param {object} [input]
 */
function buildAdvisoryCandidate(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const recruitment =
    src.recruitment && src.recruitment.modelVersion
      ? src.recruitment
      : createStructuredRecruitment(src.recruitment || src);

  const duplicate = src.duplicate || null;
  const diagnostics = src.diagnostics || null;

  const incomplete =
    !recruitment.sourceId ||
    !recruitment.recruitmentTitle ||
    !recruitment.officialUrl;

  let candidateStatus = CANDIDATE_STATUSES.ADVISORY;
  if (src.skipped === true) {
    candidateStatus = CANDIDATE_STATUSES.SKIPPED;
  } else if (duplicate && duplicate.isDuplicate) {
    candidateStatus = CANDIDATE_STATUSES.DUPLICATE_ADVISORY;
  } else if (incomplete) {
    candidateStatus = CANDIDATE_STATUSES.INCOMPLETE;
  }

  const importantDates = [];
  if (recruitment.notificationDate) {
    importantDates.push({
      label: 'notification_date',
      date: recruitment.notificationDate,
    });
  }
  if (recruitment.lastDate) {
    importantDates.push({
      label: 'last_date',
      date: recruitment.lastDate,
    });
  }

  const candidateId =
    asStringOrNull(src.candidateId) || buildCandidateId(recruitment);

  const detectionTime =
    asStringOrNull(src.detectionTime) ||
    asStringOrNull(recruitment.extractionTimestamp) ||
    new Date().toISOString();

  const candidate = {
    builderVersion: CANDIDATE_BUILDER_VERSION,
    advisoryOnly: true,
    immutable: true,
    readOnly: true,
    databaseDenied: true,
    reviewQueueCreationDenied: true,
    publishingDenied: true,
    telegramDenied: true,

    candidateStatus,
    candidateId,
    source: recruitment.sourceId,
    sourceUrl: recruitment.officialUrl,
    detectionTime,
    recruitmentType: inferRecruitmentType(recruitment),
    confidence: recruitment.confidenceScore,
    validationStatus: incomplete
      ? 'advisory_fail'
      : diagnostics && diagnostics.hasErrors
        ? 'advisory_warn'
        : 'advisory_pass',
    normalizedMetadata: {
      title: recruitment.recruitmentTitle,
      department: recruitment.department,
      qualification: recruitment.qualification,
      state: null,
      recruitmentCategory: recruitment.category,
      importantDates,
      advertisementNo: recruitment.advertisementNumber,
      postName: recruitment.recruitmentTitle,
      cycleYear: null,
      rawFingerprint: recruitment.rawSourceReference,
      extensions: {
        organization: recruitment.organization,
        applicationMode: recruitment.applicationMode,
        age: recruitment.age,
        vacancyCount: recruitment.vacancyCount,
        attachments: recruitment.attachments,
        parserId: recruitment.parserId,
        contentType: recruitment.contentType,
        mb3Candidate: true,
      },
    },
    advisoryNotes: [
      'MB-3 advisory candidate — no database write',
      'No review queue creation',
      'No publishing',
    ],
    structuredRecruitment: recruitment,
    duplicateStatus: duplicate ? duplicate.duplicateStatus : null,
    diagnosticsSummary: diagnostics
      ? {
          hasErrors: diagnostics.hasErrors === true,
          hasWarnings: diagnostics.hasWarnings === true,
          codes: Array.isArray(diagnostics.codes)
            ? diagnostics.codes.slice()
            : [],
        }
      : null,
  };

  return deepFreeze(candidate);
}

module.exports = {
  CANDIDATE_BUILDER_VERSION,
  CANDIDATE_STATUSES,
  buildAdvisoryCandidate,
  buildCandidateId,
  inferRecruitmentType,
};
