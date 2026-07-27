'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package RW-1
 * Review Queue Wiring
 *
 * Integrates advisory candidates into existing Program 5 review workflow.
 * Reuses Shared Preview, Lifecycle, Draft Preparation, Candidate Resolution,
 * Publish Readiness via MB-4 / Program 5 outputs.
 *
 * No database writes. No automatic approval. Publishing impossible.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const {
  createOperatorReviewObject,
} = require('./operatorReviewObject');
const {
  generateReviewDiagnostics,
  DIAGNOSTIC_CODES,
} = require('./reviewDiagnostics');

const REVIEW_QUEUE_WIRING_VERSION = 'RW1.1.0.0';

/**
 * Wire an advisory pipeline result into an operator review payload.
 * @param {object} [input]
 */
function wireAdvisoryCandidateToReviewQueue(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const pipelineResult = src.pipelineResult || src.pipeline || null;
  const timestamp =
    typeof src.timestamp === 'string' && src.timestamp.trim()
      ? src.timestamp.trim()
      : new Date().toISOString();

  const operatorReview = createOperatorReviewObject({
    ...src,
    pipelineResult,
    timestamp,
  });

  const diagnostics = generateReviewDiagnostics({
    operatorReview,
    pipelineResult,
    candidate: src.candidate,
    validationSummary: src.validationSummary,
    duplicateStatus: operatorReview.duplicateStatus,
  });

  const sharedPreview =
    (pipelineResult && pipelineResult.preview) ||
    src.sharedPreview ||
    null;
  const lifecycle =
    (pipelineResult &&
      pipelineResult.program5 &&
      pipelineResult.program5.lifecycle) ||
    src.lifecycle ||
    null;
  const draft =
    (pipelineResult &&
      pipelineResult.program5 &&
      pipelineResult.program5.draft) ||
    src.draft ||
    null;
  const resolution =
    (pipelineResult &&
      pipelineResult.program5 &&
      pipelineResult.program5.resolution) ||
    src.resolution ||
    null;
  const publishReadiness =
    (pipelineResult &&
      pipelineResult.program5 &&
      pipelineResult.program5.publishReadiness) ||
    src.publishReadiness ||
    null;

  return deepFreeze({
    wiringVersion: REVIEW_QUEUE_WIRING_VERSION,
    advisoryOnly: true,
    databaseWriteDenied: true,
    automaticApprovalDenied: true,
    publishingDenied: true,
    productionQueueInsert: false,

    operatorReview,
    diagnostics,
    advisoryReviewPayload: {
      kind: 'ADVISORY_REVIEW_PAYLOAD',
      candidateId: operatorReview.candidateId,
      source: operatorReview.source,
      confidence: operatorReview.confidence,
      duplicateStatus: operatorReview.duplicateStatus,
      validationSummary: operatorReview.validationSummary,
      previewReference: operatorReview.previewReference,
      advisoryRecommendation: operatorReview.advisoryRecommendation,
      draftReady: diagnostics.readinessSummary.draftReady,
      publishReady: false,
      workflowState: 'review_pending',
      generatedAt: timestamp,
    },

    reused: {
      sharedPreview: !!sharedPreview,
      lifecycle: !!lifecycle,
      draftPreparation: !!draft,
      candidateResolution: !!resolution,
      publishReadiness: !!publishReadiness,
    },

    program5Artifacts: {
      sharedPreview,
      lifecycle,
      draft,
      resolution,
      publishReadiness,
    },

    effects: {
      databaseWritten: false,
      reviewQueuePersisted: false,
      approved: false,
      published: false,
      redisUsed: false,
      routesActivated: false,
    },
  });
}

module.exports = {
  REVIEW_QUEUE_WIRING_VERSION,
  DIAGNOSTIC_CODES,
  wireAdvisoryCandidateToReviewQueue,
  createOperatorReviewObject,
  generateReviewDiagnostics,
};
