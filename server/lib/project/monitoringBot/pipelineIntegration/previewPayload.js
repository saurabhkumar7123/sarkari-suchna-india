'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-4
 * Preview Payload (Advisory Only)
 *
 * Generate advisory preview payload.
 * No page generation. No public output.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const PREVIEW_PAYLOAD_VERSION = 'MB4.1.0.0';

/**
 * Build an advisory preview payload from pipeline mapping / Program 5 stages.
 * @param {object} [input]
 */
function generateAdvisoryPreviewPayload(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const payload = src.pipelinePayload || src.payload || null;
  const candidate = (payload && payload.candidate) || src.candidate || null;
  const reviewIntegration = src.reviewIntegration || null;
  const lifecycle = src.lifecycle || null;
  const draft = src.draft || null;
  const resolution = src.resolution || null;
  const publishReadiness = src.publishReadiness || null;

  const title =
    (candidate &&
      candidate.normalizedMetadata &&
      candidate.normalizedMetadata.title) ||
    null;
  const source = (candidate && candidate.source) || null;
  const sourceUrl = (candidate && candidate.sourceUrl) || null;

  const previewBlocks = [];
  if (title) {
    previewBlocks.push({
      blockId: 'TITLE',
      label: 'Recruitment Title',
      value: title,
    });
  }
  if (source) {
    previewBlocks.push({
      blockId: 'SOURCE',
      label: 'Source',
      value: source,
    });
  }
  if (sourceUrl) {
    previewBlocks.push({
      blockId: 'OFFICIAL_URL',
      label: 'Official URL',
      value: sourceUrl,
    });
  }
  if (
    candidate &&
    candidate.normalizedMetadata &&
    candidate.normalizedMetadata.advertisementNo
  ) {
    previewBlocks.push({
      blockId: 'ADVERTISEMENT',
      label: 'Advertisement Number',
      value: candidate.normalizedMetadata.advertisementNo,
    });
  }

  const stagePreviews = {
    monitoringReview: reviewIntegration
      ? {
          available: true,
          previewAvailable:
            !!(
              reviewIntegration.preview &&
              reviewIntegration.preview.available !== false
            ),
          workflowState:
            (reviewIntegration.adapter &&
              reviewIntegration.adapter.workflowState) ||
            null,
        }
      : { available: false },
    lifecycle: lifecycle
      ? {
          available: true,
          currentState:
            lifecycle.currentState ||
            (lifecycle.evaluation && lifecycle.evaluation.currentState) ||
            null,
        }
      : { available: false },
    draft: draft
      ? {
          available: true,
          draftReady:
            !!(draft.readiness && draft.readiness.ready) ||
            !!(draft.preview && draft.preview.available !== false),
        }
      : { available: false },
    resolution: resolution
      ? {
          available: true,
          duplicateAdvice:
            (resolution.report && resolution.report.summary) ||
            (resolution.preview && resolution.preview.summary) ||
            null,
        }
      : { available: false },
    publishReadiness: publishReadiness
      ? {
          available: true,
          authorized: false,
          readiness:
            (publishReadiness.finalReadiness &&
              publishReadiness.finalReadiness.status) ||
            null,
        }
      : { available: false },
  };

  return deepFreeze({
    previewVersion: PREVIEW_PAYLOAD_VERSION,
    advisoryOnly: true,
    pageGenerationDenied: true,
    publicOutputDenied: true,
    publishingDenied: true,
    candidateId: candidate ? candidate.candidateId : null,
    title,
    source,
    sourceUrl,
    confidence: candidate ? candidate.confidence : null,
    previewBlocks,
    stagePreviews,
    operatorMessage:
      'Advisory preview only — no public page generated and no publishing authorized.',
  });
}

module.exports = {
  PREVIEW_PAYLOAD_VERSION,
  generateAdvisoryPreviewPayload,
};
