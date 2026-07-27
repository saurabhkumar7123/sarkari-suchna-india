'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Review Queue Adapter
 *
 * Transforms a validated monitoring candidate into a Human Review item
 * payload shaped for the existing Editorial Review framework.
 *
 * Reuses Editorial Review workflow identities by contract alignment:
 *   workflowState values match Package 4C editorialWorkflow.
 *
 * Does NOT insert records into production queues.
 * Only generates review payloads.
 */

const { deepFreeze, createMonitoringCandidate } = require('./monitoringCandidateContract');
const { mapConfidenceBand } = require('./confidenceMapping');

const REVIEW_QUEUE_ADAPTER_VERSION = '5B.1.0.0';

/**
 * Editorial Review workflow states (identity reuse — Package 4C).
 * Values must remain identical to editorialWorkflow.WORKFLOW_STATES.
 */
const EDITORIAL_WORKFLOW_STATES = Object.freeze({
  DRAFT_CREATED: 'draft_created',
  DRAFT_ATTACHED: 'draft_attached',
  REVIEW_PENDING: 'review_pending',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
});

const REUSED_MODULE_IDS = Object.freeze({
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  SHARED_PREVIEW: 'SHARED_PREVIEW',
  RECRUITMENT_OPERATIONS: 'RECRUITMENT_OPERATIONS',
  SEO_DIAGNOSTICS: 'SEO_DIAGNOSTICS',
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
});

/**
 * Build an advisory Human Review payload from a candidate.
 *
 * @param {object} candidate
 * @param {object} [options]
 * @param {object} [options.validation] prior validation result
 * @param {object} [options.normalization] prior normalization result
 * @param {object} [options.confidenceThresholds]
 * @param {string} [options.suggestedWorkflowState]
 * @param {number|null} [options.recruitmentId] optional binding hint only
 * @param {number|null} [options.draftId] optional binding hint only
 */
function adaptCandidateToReviewPayload(candidateInput = {}, options = {}) {
  const candidate =
    candidateInput && candidateInput.contractVersion
      ? candidateInput
      : createMonitoringCandidate(candidateInput);

  const confidence = mapConfidenceBand(
    candidate.confidence,
    options.confidenceThresholds || {}
  );

  const meta = candidate.normalizedMetadata || {};
  const suggestedWorkflowState =
    options.suggestedWorkflowState &&
    Object.values(EDITORIAL_WORKFLOW_STATES).includes(options.suggestedWorkflowState)
      ? options.suggestedWorkflowState
      : EDITORIAL_WORKFLOW_STATES.REVIEW_PENDING;

  const advisoryNotes = [
    ...(Array.isArray(candidate.advisoryNotes) ? candidate.advisoryNotes : []),
  ];
  if (options.validation && options.validation.status) {
    advisoryNotes.push(`validation_status:${options.validation.status}`);
  }
  if (confidence.band) {
    advisoryNotes.push(`confidence_band:${confidence.band}`);
  }

  const reviewPayload = {
    payloadKind: 'HUMAN_REVIEW_ITEM',
    adapterVersion: REVIEW_QUEUE_ADAPTER_VERSION,
    advisoryOnly: true,
    productionQueueInsert: false,
    automaticInsertDenied: true,
    reusedModules: [
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.RECRUITMENT_OPERATIONS,
    ],
    // Shape aligned with editorialReview.repository.createDefaultReview
    editorialReview: {
      recruitmentId:
        options.recruitmentId != null && Number.isFinite(Number(options.recruitmentId))
          ? Number(options.recruitmentId)
          : null,
      draftId:
        options.draftId != null && Number.isFinite(Number(options.draftId))
          ? Number(options.draftId)
          : null,
      workflowState: suggestedWorkflowState,
      notes: advisoryNotes.map((text, index) => ({
        id: `monitoring_note_${index + 1}`,
        text: String(text),
        decision: null,
        operator: 'monitoring_integration',
        createdAt: candidate.detectionTime || null,
        internal: true,
        source: 'PACKAGE_5B_MONITORING_REVIEW_ADAPTER',
      })),
      decisionHistory: [],
      updatedBy: null,
    },
    monitoringProvenance: {
      candidateId: candidate.candidateId,
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      detectionTime: candidate.detectionTime,
      recruitmentType: candidate.recruitmentType,
      confidence: candidate.confidence,
      confidenceBand: confidence.band,
      validationStatus:
        (options.validation && options.validation.status) || candidate.validationStatus,
    },
    contentSummary: {
      title: meta.title || null,
      department: meta.department || null,
      qualification: meta.qualification || null,
      state: meta.state || null,
      recruitmentCategory: meta.recruitmentCategory || null,
      importantDates: Array.isArray(meta.importantDates) ? meta.importantDates : [],
      advertisementNo: meta.advertisementNo || null,
      postName: meta.postName || null,
      cycleYear: meta.cycleYear != null ? meta.cycleYear : null,
    },
    mappingSummary: {
      workflowStateMappedTo: suggestedWorkflowState,
      editorialFieldsPopulated: [
        'workflowState',
        'notes',
        'decisionHistory',
        'recruitmentId',
        'draftId',
      ],
      confidenceBand: confidence.band,
      normalizationApplied: Boolean(options.normalization),
      validationApplied: Boolean(options.validation),
    },
  };

  return deepFreeze({
    adapterVersion: REVIEW_QUEUE_ADAPTER_VERSION,
    advisoryOnly: true,
    insertedIntoProductionQueue: false,
    ready: Boolean(candidate.candidateId && candidate.sourceUrl),
    confidence,
    reviewPayload,
  });
}

module.exports = {
  REVIEW_QUEUE_ADAPTER_VERSION,
  EDITORIAL_WORKFLOW_STATES,
  REUSED_MODULE_IDS,
  adaptCandidateToReviewPayload,
};
