'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Extraction Diagnostics (Advisory Only / No Persistence)
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  REQUIRED_RECRUITMENT_FIELDS,
  validateStructuredRecruitment,
} = require('./structuredRecruitmentModel');

const EXTRACTION_DIAGNOSTICS_VERSION = 'MB3.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
});

const DIAGNOSTIC_CODES = Object.freeze({
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  AMBIGUOUS_FIELD: 'AMBIGUOUS_FIELD',
  DUPLICATE_SECTION: 'DUPLICATE_SECTION',
  LOW_PARSING_CONFIDENCE: 'LOW_PARSING_CONFIDENCE',
  PDF_PARSER_UNAVAILABLE: 'PDF_PARSER_UNAVAILABLE',
  PARSER_NOT_REGISTERED: 'PARSER_NOT_REGISTERED',
  CONTENT_TYPE_UNSUPPORTED: 'CONTENT_TYPE_UNSUPPORTED',
  EXTRACTION_SKIPPED: 'EXTRACTION_SKIPPED',
  VALIDATION_PASS: 'VALIDATION_PASS',
  VALIDATION_WARN: 'VALIDATION_WARN',
  VALIDATION_FAIL: 'VALIDATION_FAIL',
});

/**
 * Generate extraction diagnostics from parse + recruitment validation.
 * @param {object} [input]
 */
function generateExtractionDiagnostics(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const codes = [];
  const items = [];
  const missingRequired = [];
  const ambiguousFields = Array.isArray(src.ambiguousFields)
    ? src.ambiguousFields.slice()
    : [];
  const duplicateSections = Array.isArray(src.duplicateSections)
    ? src.duplicateSections.slice()
    : [];

  const recruitment = src.recruitment || null;
  const validation = recruitment
    ? validateStructuredRecruitment(recruitment)
    : deepFreeze({
        valid: false,
        missingRequired: REQUIRED_RECRUITMENT_FIELDS.slice(),
        missingOptional: [],
        diagnostics: [],
      });

  for (let i = 0; i < validation.missingRequired.length; i += 1) {
    const field = validation.missingRequired[i];
    missingRequired.push(field);
    codes.push(DIAGNOSTIC_CODES.MISSING_REQUIRED_FIELD);
    items.push({
      code: DIAGNOSTIC_CODES.MISSING_REQUIRED_FIELD,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field,
      message: `Required field "${field}" was not extracted`,
    });
  }

  for (let i = 0; i < ambiguousFields.length; i += 1) {
    const field = ambiguousFields[i];
    codes.push(DIAGNOSTIC_CODES.AMBIGUOUS_FIELD);
    items.push({
      code: DIAGNOSTIC_CODES.AMBIGUOUS_FIELD,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field,
      message: `Field "${field}" appears ambiguous`,
    });
  }

  for (let i = 0; i < duplicateSections.length; i += 1) {
    codes.push(DIAGNOSTIC_CODES.DUPLICATE_SECTION);
    items.push({
      code: DIAGNOSTIC_CODES.DUPLICATE_SECTION,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'sections',
      message: `Duplicate section detected: "${duplicateSections[i]}"`,
    });
  }

  const parsingConfidence =
    typeof src.parsingConfidence === 'number' &&
    Number.isFinite(src.parsingConfidence)
      ? src.parsingConfidence
      : recruitment && typeof recruitment.confidenceScore === 'number'
        ? recruitment.confidenceScore
        : 0;

  if (parsingConfidence < 0.5) {
    codes.push(DIAGNOSTIC_CODES.LOW_PARSING_CONFIDENCE);
    items.push({
      code: DIAGNOSTIC_CODES.LOW_PARSING_CONFIDENCE,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'confidenceScore',
      message: `Parsing confidence ${parsingConfidence} is below advisory threshold`,
    });
  }

  if (src.pdfParserUnavailable === true) {
    codes.push(DIAGNOSTIC_CODES.PDF_PARSER_UNAVAILABLE);
    items.push({
      code: DIAGNOSTIC_CODES.PDF_PARSER_UNAVAILABLE,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'contentType',
      message: 'PDF parser interface only — no PDF text extraction performed',
    });
  }

  if (src.parserNotRegistered === true) {
    codes.push(DIAGNOSTIC_CODES.PARSER_NOT_REGISTERED);
    items.push({
      code: DIAGNOSTIC_CODES.PARSER_NOT_REGISTERED,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'parserId',
      message: `Parser "${src.parserId || 'unknown'}" is not registered in MB-1`,
    });
  }

  if (src.contentTypeUnsupported === true) {
    codes.push(DIAGNOSTIC_CODES.CONTENT_TYPE_UNSUPPORTED);
    items.push({
      code: DIAGNOSTIC_CODES.CONTENT_TYPE_UNSUPPORTED,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'contentType',
      message: `Content type "${src.contentType || 'unknown'}" is unsupported`,
    });
  }

  if (src.extractionSkipped === true) {
    codes.push(DIAGNOSTIC_CODES.EXTRACTION_SKIPPED);
    items.push({
      code: DIAGNOSTIC_CODES.EXTRACTION_SKIPPED,
      severity: DIAGNOSTIC_SEVERITY.INFO,
      field: 'detectionStatus',
      message: src.skipReason || 'Extraction skipped',
    });
  }

  let validationSummaryCode = DIAGNOSTIC_CODES.VALIDATION_PASS;
  if (!validation.valid) {
    validationSummaryCode = DIAGNOSTIC_CODES.VALIDATION_FAIL;
  } else if (
    items.some((item) => item.severity === DIAGNOSTIC_SEVERITY.WARNING)
  ) {
    validationSummaryCode = DIAGNOSTIC_CODES.VALIDATION_WARN;
  }
  codes.push(validationSummaryCode);
  items.push({
    code: validationSummaryCode,
    severity:
      validationSummaryCode === DIAGNOSTIC_CODES.VALIDATION_FAIL
        ? DIAGNOSTIC_SEVERITY.ERROR
        : validationSummaryCode === DIAGNOSTIC_CODES.VALIDATION_WARN
          ? DIAGNOSTIC_SEVERITY.WARNING
          : DIAGNOSTIC_SEVERITY.INFO,
    field: null,
    message: `Validation summary: ${validationSummaryCode}`,
  });

  const uniqueCodes = [];
  const seen = new Set();
  for (let i = 0; i < codes.length; i += 1) {
    if (!seen.has(codes[i])) {
      seen.add(codes[i]);
      uniqueCodes.push(codes[i]);
    }
  }

  return deepFreeze({
    diagnosticsVersion: EXTRACTION_DIAGNOSTICS_VERSION,
    advisoryOnly: true,
    persistenceDenied: true,
    missingRequiredFields: missingRequired,
    ambiguousFields,
    duplicateSections,
    parsingConfidence,
    validationSummary: {
      code: validationSummaryCode,
      valid: validation.valid,
      missingRequired: validation.missingRequired.slice(),
      missingOptional: validation.missingOptional
        ? validation.missingOptional.slice()
        : [],
    },
    codes: uniqueCodes,
    items,
    hasErrors: items.some((item) => item.severity === DIAGNOSTIC_SEVERITY.ERROR),
    hasWarnings: items.some(
      (item) => item.severity === DIAGNOSTIC_SEVERITY.WARNING
    ),
  });
}

module.exports = {
  EXTRACTION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  generateExtractionDiagnostics,
};
