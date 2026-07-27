'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-4
 * Integration Diagnostics (Advisory Only)
 *
 * Validate mapping, missing fields, confidence, duplicate status, readiness.
 * Diagnostics only — no persistence / publishing.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const INTEGRATION_DIAGNOSTICS_VERSION = 'MB4.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
});

const DIAGNOSTIC_CODES = Object.freeze({
  MAPPING_INCOMPLETE: 'MAPPING_INCOMPLETE',
  MISSING_FIELD: 'MISSING_FIELD',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  DUPLICATE_DETECTED: 'DUPLICATE_DETECTED',
  NOT_READY: 'NOT_READY',
  READY_ADVISORY: 'READY_ADVISORY',
  PROGRAM5_STAGE_SKIPPED: 'PROGRAM5_STAGE_SKIPPED',
  VALIDATION_PASS: 'VALIDATION_PASS',
  VALIDATION_WARN: 'VALIDATION_WARN',
  VALIDATION_FAIL: 'VALIDATION_FAIL',
});

/**
 * Generate MB-4 integration diagnostics.
 * @param {object} [input]
 */
function generateIntegrationDiagnostics(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const payload = src.pipelinePayload || src.payload || null;
  const preview = src.preview || null;
  const program5 = src.program5 || null;

  const codes = [];
  const items = [];

  const missingFields = payload && Array.isArray(payload.missingMappedFields)
    ? payload.missingMappedFields.slice()
    : [];

  for (let i = 0; i < missingFields.length; i += 1) {
    codes.push(DIAGNOSTIC_CODES.MISSING_FIELD);
    items.push({
      code: DIAGNOSTIC_CODES.MISSING_FIELD,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: missingFields[i],
      message: `Mapped Program 5 field "${missingFields[i]}" is missing`,
    });
  }

  if (missingFields.length > 0) {
    codes.push(DIAGNOSTIC_CODES.MAPPING_INCOMPLETE);
    items.push({
      code: DIAGNOSTIC_CODES.MAPPING_INCOMPLETE,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      field: 'mapping',
      message: 'Advisory pipeline mapping is incomplete',
    });
  }

  const confidence =
    typeof (payload && payload.confidence) === 'number'
      ? payload.confidence
      : typeof src.confidence === 'number'
        ? src.confidence
        : 0;

  if (confidence < 0.5) {
    codes.push(DIAGNOSTIC_CODES.LOW_CONFIDENCE);
    items.push({
      code: DIAGNOSTIC_CODES.LOW_CONFIDENCE,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'confidence',
      message: `Confidence ${confidence} is below advisory readiness threshold`,
    });
  }

  const duplicateStatus =
    (payload && payload.duplicateStatus) || src.duplicateStatus || null;
  if (
    duplicateStatus &&
    duplicateStatus !== 'UNIQUE' &&
    duplicateStatus !== 'UNKNOWN'
  ) {
    codes.push(DIAGNOSTIC_CODES.DUPLICATE_DETECTED);
    items.push({
      code: DIAGNOSTIC_CODES.DUPLICATE_DETECTED,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: 'duplicateStatus',
      message: `Advisory duplicate status: ${duplicateStatus}`,
    });
  }

  const stageNames = [
    'pipelineHealth',
    'monitoringReview',
    'lifecycle',
    'draft',
    'resolution',
    'publishReadiness',
  ];
  const skippedStages = [];
  if (program5 && typeof program5 === 'object') {
    for (let i = 0; i < stageNames.length; i += 1) {
      if (!program5[stageNames[i]]) {
        skippedStages.push(stageNames[i]);
      }
    }
  }

  for (let i = 0; i < skippedStages.length; i += 1) {
    codes.push(DIAGNOSTIC_CODES.PROGRAM5_STAGE_SKIPPED);
    items.push({
      code: DIAGNOSTIC_CODES.PROGRAM5_STAGE_SKIPPED,
      severity: DIAGNOSTIC_SEVERITY.INFO,
      field: skippedStages[i],
      message: `Program 5 stage "${skippedStages[i]}" was not evaluated in this advisory run`,
    });
  }

  const hasErrors = items.some(
    (item) => item.severity === DIAGNOSTIC_SEVERITY.ERROR
  );
  const hasWarnings = items.some(
    (item) => item.severity === DIAGNOSTIC_SEVERITY.WARNING
  );

  const readiness = {
    mappingComplete: missingFields.length === 0,
    confidenceAcceptable: confidence >= 0.5,
    duplicateClear:
      !duplicateStatus ||
      duplicateStatus === 'UNIQUE' ||
      duplicateStatus === 'UNKNOWN',
    previewGenerated: !!(preview && preview.previewBlocks),
    publishAuthorized: false,
    runtimeActivated: false,
  };

  const ready =
    readiness.mappingComplete &&
    readiness.confidenceAcceptable &&
    readiness.duplicateClear;

  if (ready) {
    codes.push(DIAGNOSTIC_CODES.READY_ADVISORY);
    items.push({
      code: DIAGNOSTIC_CODES.READY_ADVISORY,
      severity: DIAGNOSTIC_SEVERITY.INFO,
      field: null,
      message: 'Advisory pipeline integration is ready (no runtime activation)',
    });
  } else {
    codes.push(DIAGNOSTIC_CODES.NOT_READY);
    items.push({
      code: DIAGNOSTIC_CODES.NOT_READY,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      field: null,
      message: 'Advisory pipeline integration is not fully ready',
    });
  }

  let validationSummary = DIAGNOSTIC_CODES.VALIDATION_PASS;
  if (hasErrors) validationSummary = DIAGNOSTIC_CODES.VALIDATION_FAIL;
  else if (hasWarnings) validationSummary = DIAGNOSTIC_CODES.VALIDATION_WARN;
  codes.push(validationSummary);

  const uniqueCodes = [];
  const seen = new Set();
  for (let i = 0; i < codes.length; i += 1) {
    if (!seen.has(codes[i])) {
      seen.add(codes[i]);
      uniqueCodes.push(codes[i]);
    }
  }

  return deepFreeze({
    diagnosticsVersion: INTEGRATION_DIAGNOSTICS_VERSION,
    advisoryOnly: true,
    persistenceDenied: true,
    publishingDenied: true,
    missingFields,
    confidence,
    duplicateStatus,
    readiness,
    ready,
    validationSummary,
    codes: uniqueCodes,
    items,
    hasErrors,
    hasWarnings,
    skippedStages,
  });
}

module.exports = {
  INTEGRATION_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  generateIntegrationDiagnostics,
};
