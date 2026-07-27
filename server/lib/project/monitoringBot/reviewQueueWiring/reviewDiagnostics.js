'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package RW-1
 * Review Diagnostics
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const REVIEW_DIAGNOSTICS_VERSION = 'RW1.1.0.0';

const DIAGNOSTIC_CODES = Object.freeze({
  MISSING_FIELD: 'MISSING_FIELD',
  VALIDATION_ISSUE: 'VALIDATION_ISSUE',
  CONFIDENCE_WARNING: 'CONFIDENCE_WARNING',
  DUPLICATE_WARNING: 'DUPLICATE_WARNING',
  READINESS_SUMMARY: 'READINESS_SUMMARY',
  DRAFT_READY: 'DRAFT_READY',
  NOT_READY: 'NOT_READY',
});

/**
 * Generate review diagnostics for an operator review object / pipeline result.
 * @param {object} [input]
 */
function generateReviewDiagnostics(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const review = src.operatorReview || src.review || {};
  const pipeline = src.pipelineResult || src.pipeline || null;
  const candidate =
    src.candidate ||
    (pipeline && pipeline.pipelinePayload && pipeline.pipelinePayload.candidate) ||
    {};

  const missingFields = [];
  const required = [
    ['candidateId', review.candidateId || candidate.candidateId],
    ['source', review.source || candidate.source],
    [
      'officialUrl',
      candidate.sourceUrl ||
        candidate.officialUrl ||
        (candidate.normalizedMetadata &&
          candidate.normalizedMetadata.officialUrl),
    ],
    [
      'title',
      candidate.title ||
        (candidate.normalizedMetadata && candidate.normalizedMetadata.title),
    ],
  ];
  for (const [field, value] of required) {
    if (value == null || String(value).trim() === '') {
      missingFields.push(field);
    }
  }

  const validationIssues = [];
  const validation =
    review.validationSummary ||
    src.validationSummary ||
    (pipeline &&
      pipeline.program5 &&
      pipeline.program5.monitoringReview &&
      pipeline.program5.monitoringReview.validation) ||
    {};
  if (validation.status === 'FAIL' || validation.status === 'INVALID') {
    validationIssues.push({
      code: DIAGNOSTIC_CODES.VALIDATION_ISSUE,
      message: `Validation status: ${validation.status}`,
    });
  }
  if (Array.isArray(validation.issues)) {
    for (const issue of validation.issues) {
      validationIssues.push({
        code: DIAGNOSTIC_CODES.VALIDATION_ISSUE,
        message:
          typeof issue === 'string'
            ? issue
            : issue.message || JSON.stringify(issue),
      });
    }
  }

  const confidenceWarnings = [];
  const confidence =
    typeof review.confidence === 'number'
      ? review.confidence
      : typeof candidate.confidence === 'number'
        ? candidate.confidence
        : null;
  if (confidence != null && confidence < 0.5) {
    confidenceWarnings.push({
      code: DIAGNOSTIC_CODES.CONFIDENCE_WARNING,
      message: `Low confidence: ${confidence}`,
      confidence,
    });
  } else if (confidence != null && confidence < 0.7) {
    confidenceWarnings.push({
      code: DIAGNOSTIC_CODES.CONFIDENCE_WARNING,
      message: `Moderate confidence: ${confidence}`,
      confidence,
    });
  }

  const duplicateWarnings = [];
  const duplicateStatus = String(
    review.duplicateStatus ||
      src.duplicateStatus ||
      (pipeline &&
        pipeline.pipelinePayload &&
        pipeline.pipelinePayload.duplicateStatus) ||
      ''
  ).toUpperCase();
  if (
    duplicateStatus === 'DUPLICATE' ||
    duplicateStatus === 'LIKELY_DUPLICATE'
  ) {
    duplicateWarnings.push({
      code: DIAGNOSTIC_CODES.DUPLICATE_WARNING,
      message: `Duplicate status: ${duplicateStatus}`,
      duplicateStatus,
    });
  }

  const draftReady =
    review.draftReadyHint === true ||
    review.advisoryRecommendation === 'PROCEED_TO_OPERATOR_REVIEW';
  const publishReady = false;
  const readinessSummary = {
    code: draftReady
      ? DIAGNOSTIC_CODES.DRAFT_READY
      : DIAGNOSTIC_CODES.NOT_READY,
    draftReady,
    publishReady,
    approvalManualOnly: true,
    publishingDenied: true,
    databaseWriteDenied: true,
    message: draftReady
      ? 'Draft ready for operator review — publishing remains impossible.'
      : 'Not draft-ready — operator attention required.',
  };

  const codes = [];
  if (missingFields.length) codes.push(DIAGNOSTIC_CODES.MISSING_FIELD);
  if (validationIssues.length) codes.push(DIAGNOSTIC_CODES.VALIDATION_ISSUE);
  if (confidenceWarnings.length) codes.push(DIAGNOSTIC_CODES.CONFIDENCE_WARNING);
  if (duplicateWarnings.length) codes.push(DIAGNOSTIC_CODES.DUPLICATE_WARNING);
  codes.push(DIAGNOSTIC_CODES.READINESS_SUMMARY);
  codes.push(readinessSummary.code);

  return deepFreeze({
    diagnosticsVersion: REVIEW_DIAGNOSTICS_VERSION,
    missingFields,
    validationIssues,
    confidenceWarnings,
    duplicateWarnings,
    readinessSummary,
    codes,
    advisoryOnly: true,
    publishingDenied: true,
  });
}

module.exports = {
  REVIEW_DIAGNOSTICS_VERSION,
  DIAGNOSTIC_CODES,
  generateReviewDiagnostics,
};
