'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Candidate Validation (Advisory Diagnostics Only)
 *
 * Validates required fields, metadata completeness, duplicate indicators,
 * invalid values, and unsupported source formats.
 *
 * Diagnostics only. No automatic rejection.
 */

const {
  deepFreeze,
  VALIDATION_STATUS,
  VALID_RECRUITMENT_TYPES,
  createMonitoringCandidate,
  validateMonitoringCandidateContract,
} = require('./monitoringCandidateContract');

const CANDIDATE_VALIDATION_VERSION = '5B.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
});

const SUPPORTED_SOURCE_URL_PROTOCOLS = Object.freeze(['http:', 'https:']);

const METADATA_COMPLETENESS_FIELDS = Object.freeze([
  'title',
  'department',
  'qualification',
  'state',
  'recruitmentCategory',
]);

function pushDiag(list, { code, severity, field = null, message, detail = null }) {
  list.push({
    code,
    severity,
    field,
    message,
    detail,
  });
}

function isValidUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return SUPPORTED_SOURCE_URL_PROTOCOLS.includes(url.protocol);
  } catch {
    return false;
  }
}

function looksLikeDuplicateFingerprint(candidate, existingFingerprints) {
  const fp =
    candidate.normalizedMetadata && candidate.normalizedMetadata.rawFingerprint
      ? String(candidate.normalizedMetadata.rawFingerprint)
      : null;
  if (!fp) return { indicated: false, reason: null };
  const set = new Set(
    (Array.isArray(existingFingerprints) ? existingFingerprints : []).map(String)
  );
  if (set.has(fp)) {
    return { indicated: true, reason: 'fingerprint_match' };
  }
  return { indicated: false, reason: null };
}

function looksLikeDuplicateUrl(candidate, existingSourceUrls) {
  const url = candidate.sourceUrl ? String(candidate.sourceUrl).toLowerCase() : null;
  if (!url) return { indicated: false, reason: null };
  const set = new Set(
    (Array.isArray(existingSourceUrls) ? existingSourceUrls : []).map((u) =>
      String(u).toLowerCase()
    )
  );
  if (set.has(url)) {
    return { indicated: true, reason: 'source_url_match' };
  }
  return { indicated: false, reason: null };
}

/**
 * Advisory validation for a monitoring candidate.
 * Never rejects — only emits diagnostics and an advisory status.
 *
 * @param {object} input Candidate or raw input
 * @param {object} [options]
 */
function validateMonitoringCandidate(input = {}, options = {}) {
  const candidate =
    input && input.contractVersion
      ? input
      : createMonitoringCandidate(input);

  const diagnostics = [];
  const contract = validateMonitoringCandidateContract(candidate);

  for (const d of contract.diagnostics) {
    pushDiag(diagnostics, {
      code: d.code,
      severity: d.severity,
      field: d.field || null,
      message: d.message,
    });
  }

  // Required fields (advisory — already covered by contract, add completeness notes)
  if (!candidate.candidateId) {
    pushDiag(diagnostics, {
      code: 'REQUIRED_CANDIDATE_ID',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'candidateId',
      message: 'Candidate ID is required for review integration',
    });
  }
  if (!candidate.source) {
    pushDiag(diagnostics, {
      code: 'REQUIRED_SOURCE',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'source',
      message: 'Source identifier is required',
    });
  }
  if (!candidate.detectionTime) {
    pushDiag(diagnostics, {
      code: 'REQUIRED_DETECTION_TIME',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'detectionTime',
      message: 'Detection time is required',
    });
  } else if (!Number.isFinite(Date.parse(candidate.detectionTime))) {
    pushDiag(diagnostics, {
      code: 'INVALID_DETECTION_TIME',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'detectionTime',
      message: 'Detection time is not a valid ISO timestamp',
      detail: candidate.detectionTime,
    });
  }

  // Metadata completeness
  const meta = candidate.normalizedMetadata || {};
  const missingMeta = [];
  for (const field of METADATA_COMPLETENESS_FIELDS) {
    if (!meta[field]) missingMeta.push(field);
  }
  if (missingMeta.length) {
    pushDiag(diagnostics, {
      code: 'METADATA_INCOMPLETE',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'normalizedMetadata',
      message: 'Normalized metadata is incomplete',
      detail: missingMeta.join(','),
    });
  }
  if (!Array.isArray(meta.importantDates) || meta.importantDates.length === 0) {
    pushDiag(diagnostics, {
      code: 'IMPORTANT_DATES_MISSING',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'importantDates',
      message: 'No important dates present on candidate',
    });
  }

  // Invalid values
  if (
    candidate.confidence != null &&
    (!Number.isFinite(Number(candidate.confidence)) ||
      Number(candidate.confidence) < 0 ||
      Number(candidate.confidence) > 1)
  ) {
    pushDiag(diagnostics, {
      code: 'INVALID_CONFIDENCE',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'confidence',
      message: 'Confidence must be a number between 0 and 1 inclusive',
      detail: String(candidate.confidence),
    });
  }

  if (
    candidate.recruitmentType &&
    !VALID_RECRUITMENT_TYPES.includes(candidate.recruitmentType)
  ) {
    pushDiag(diagnostics, {
      code: 'INVALID_RECRUITMENT_TYPE',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'recruitmentType',
      message: `Invalid recruitment type "${candidate.recruitmentType}"`,
    });
  }

  // Unsupported source formats
  if (!candidate.sourceUrl) {
    pushDiag(diagnostics, {
      code: 'REQUIRED_SOURCE_URL',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'sourceUrl',
      message: 'Source URL is required',
    });
  } else if (!isValidUrl(candidate.sourceUrl)) {
    pushDiag(diagnostics, {
      code: 'UNSUPPORTED_SOURCE_FORMAT',
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'sourceUrl',
      message: 'Source URL format is unsupported (http/https required)',
      detail: candidate.sourceUrl,
    });
  }

  // Duplicate indicators (advisory only)
  const fpDup = looksLikeDuplicateFingerprint(
    candidate,
    options.existingFingerprints
  );
  const urlDup = looksLikeDuplicateUrl(candidate, options.existingSourceUrls);
  if (fpDup.indicated) {
    pushDiag(diagnostics, {
      code: 'DUPLICATE_INDICATOR_FINGERPRINT',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'rawFingerprint',
      message: 'Duplicate indicator: fingerprint matches an existing candidate',
      detail: fpDup.reason,
    });
  }
  if (urlDup.indicated) {
    pushDiag(diagnostics, {
      code: 'DUPLICATE_INDICATOR_SOURCE_URL',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'sourceUrl',
      message: 'Duplicate indicator: source URL matches an existing candidate',
      detail: urlDup.reason,
    });
  }

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  let advisoryStatus = VALIDATION_STATUS.ADVISORY_PASS;
  if (errorCount > 0) advisoryStatus = VALIDATION_STATUS.ADVISORY_FAIL;
  else if (warningCount > 0) advisoryStatus = VALIDATION_STATUS.ADVISORY_WARN;

  // Deduplicate by code+field+message while preserving order
  const seen = new Set();
  const unique = [];
  for (const d of diagnostics) {
    const key = `${d.code}|${d.field}|${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }

  return deepFreeze({
    validationVersion: CANDIDATE_VALIDATION_VERSION,
    advisoryOnly: true,
    automaticRejection: false,
    candidateId: candidate.candidateId,
    status: advisoryStatus,
    contractValid: contract.valid,
    errorCount,
    warningCount,
    diagnosticCount: unique.length,
    diagnostics: unique,
    duplicateIndicators: {
      fingerprint: fpDup.indicated,
      sourceUrl: urlDup.indicated,
    },
    missingMetadataFields: missingMeta,
  });
}

module.exports = {
  CANDIDATE_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  SUPPORTED_SOURCE_URL_PROTOCOLS,
  METADATA_COMPLETENESS_FIELDS,
  validateMonitoringCandidate,
};
