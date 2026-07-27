'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package RW-1
 * Operator Review Object (Immutable)
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const OPERATOR_REVIEW_OBJECT_VERSION = 'RW1.1.0.0';

/**
 * Build an immutable operator review object for Program 5 review workflow.
 * No database writes.
 *
 * @param {object} [input]
 */
function createOperatorReviewObject(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const pipeline = src.pipelineResult || src.pipeline || null;
  const candidate =
    src.candidate ||
    (pipeline && pipeline.pipelinePayload && pipeline.pipelinePayload.candidate) ||
    {};
  const duplicate =
    src.duplicate ||
    (pipeline &&
      pipeline.pipelinePayload &&
      pipeline.pipelinePayload.duplicateStatus) ||
    null;
  const validationSummary =
    src.validationSummary ||
    (pipeline &&
      pipeline.program5 &&
      pipeline.program5.monitoringReview &&
      pipeline.program5.monitoringReview.validation) ||
    src.validation ||
    {};
  const previewReference =
    src.previewReference ||
    (pipeline && pipeline.preview && pipeline.preview.previewId) ||
    (pipeline && pipeline.preview) ||
    null;

  const confidence =
    typeof src.confidence === 'number'
      ? src.confidence
      : typeof candidate.confidence === 'number'
        ? candidate.confidence
        : pipeline &&
            pipeline.pipelinePayload &&
            typeof pipeline.pipelinePayload.confidence === 'number'
          ? pipeline.pipelinePayload.confidence
          : null;

  const duplicateStatus =
    typeof duplicate === 'string'
      ? duplicate
      : duplicate && duplicate.duplicateStatus
        ? duplicate.duplicateStatus
        : 'UNKNOWN';

  const advisoryRecommendation =
    typeof src.advisoryRecommendation === 'string' &&
    src.advisoryRecommendation.trim()
      ? src.advisoryRecommendation.trim()
      : confidence != null && confidence < 0.5
        ? 'HOLD_FOR_MANUAL_REVIEW_LOW_CONFIDENCE'
        : duplicateStatus === 'DUPLICATE' ||
            duplicateStatus === 'LIKELY_DUPLICATE'
          ? 'REVIEW_DUPLICATE_BEFORE_DRAFT'
          : 'PROCEED_TO_OPERATOR_REVIEW';

  return deepFreeze({
    objectVersion: OPERATOR_REVIEW_OBJECT_VERSION,
    immutable: true,
    advisoryOnly: true,
    databaseWriteDenied: true,
    automaticApprovalDenied: true,
    publishingDenied: true,

    candidateId:
      src.candidateId ||
      candidate.candidateId ||
      'UNASSIGNED_CANDIDATE',
    source:
      src.source ||
      candidate.source ||
      src.sourceId ||
      'UNKNOWN',
    confidence,
    duplicateStatus,
    validationSummary,
    previewReference,
    advisoryRecommendation,

    sharedPreviewReused: true,
    lifecycleReused: true,
    draftPreparationReused: true,
    candidateResolutionReused: true,
    publishReadinessReused: true,

    draftReadyHint:
      src.draftReadyHint === true ||
      !!(
        pipeline &&
        pipeline.program5 &&
        pipeline.program5.draft &&
        pipeline.program5.draft.draftReady
      ) ||
      advisoryRecommendation === 'PROCEED_TO_OPERATOR_REVIEW',

    program5:
      pipeline && pipeline.program5
        ? {
            monitoringReview: !!pipeline.program5.monitoringReview,
            lifecycle: !!pipeline.program5.lifecycle,
            draft: !!pipeline.program5.draft,
            resolution: !!pipeline.program5.resolution,
            publishReadiness: !!pipeline.program5.publishReadiness,
          }
        : null,

    timestamp:
      typeof src.timestamp === 'string' && src.timestamp.trim()
        ? src.timestamp.trim()
        : new Date().toISOString(),
  });
}

module.exports = {
  OPERATOR_REVIEW_OBJECT_VERSION,
  createOperatorReviewObject,
};
