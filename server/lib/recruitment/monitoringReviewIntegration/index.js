'use strict';

/**
 * Package 5B — Product-side Monitoring → Review Integration facade.
 *
 * Thin composition layer over Program 5 Package 5B governance framework.
 * Reuses Editorial Review and Shared Preview product modules without
 * duplicating workflow or preview business logic.
 *
 * No monitoring execution. No runtime automation. No publishing.
 * No production queue insertion.
 */

const path = require("path");

const frameworkPath = path.resolve(
  __dirname,
  "../../project/program5/package5BMonitoringReviewIntegrationFramework.js"
);

const framework = require(frameworkPath);

const {
  WORKFLOW_STATES,
  normalizeState,
  listAllowedDecisions,
  buildValidationSummary
} = require("../editorialWorkflow");

const {
  buildPreviewSnapshot,
  validatePreviewIntegrity,
  SHARED_PREVIEW_SCHEMA_VERSION
} = require("../sharedPreviewModel");

/**
 * Enrich adapter options so suggested workflow state is validated
 * against the live Editorial Review state machine (reuse, no duplicate).
 */
function resolveAdapterOptions(options = {}) {
  const suggested = options.suggestedWorkflowState
    ? normalizeState(options.suggestedWorkflowState)
    : WORKFLOW_STATES.REVIEW_PENDING;

  return {
    ...options,
    suggestedWorkflowState: suggested || WORKFLOW_STATES.REVIEW_PENDING
  };
}

/**
 * Run product-side integration, optionally attaching a Shared Preview snapshot.
 *
 * @param {object} [input]
 */
function integrateProductMonitoringCandidate(input = {}) {
  const result = framework.integrateMonitoringCandidateToReview({
    ...input,
    adapterOptions: resolveAdapterOptions(input.adapterOptions || {})
  });

  let sharedPreviewSnapshot = null;
  if (input.sharedPreviewInput && typeof input.sharedPreviewInput === "object") {
    sharedPreviewSnapshot = buildPreviewSnapshot(input.sharedPreviewInput);
  }

  const preview = framework.simulateReviewPayloadPreview({
    adapter: result.adapter,
    candidate: result.candidate,
    validation: result.validation,
    sharedPreviewSnapshot,
    operatorPersistRequested: Boolean(
      input.previewOptions && input.previewOptions.operatorPersistRequested
    ),
    generatedAt:
      (input.previewOptions && input.previewOptions.generatedAt) ||
      "1970-01-01T00:00:00.000Z"
  });

  const diagnostics = framework.buildIntegrationDiagnostics({
    normalization: result.normalization,
    validation: result.validation,
    adapter: result.adapter,
    confidence: result.confidence,
    preview,
    availablePrerequisites: input.availablePrerequisites
  });

  const editorialAlignment = {
    reusedModule: "EDITORIAL_REVIEW",
    workflowState: result.adapter.reviewPayload.editorialReview.workflowState,
    workflowStateValid: Boolean(
      normalizeState(result.adapter.reviewPayload.editorialReview.workflowState)
    ),
    allowedDecisions: listAllowedDecisions(
      result.adapter.reviewPayload.editorialReview.workflowState
    ),
    validationSummaryHint: buildValidationSummary({
      recruitment: input.sharedPreviewInput
        ? input.sharedPreviewInput.recruitment
        : null,
      draft: input.sharedPreviewInput
        ? input.sharedPreviewInput.primaryDraft
        : null
    })
  };

  return framework.deepFreeze({
    ...result,
    preview,
    diagnostics,
    editorialAlignment,
    sharedPreview: {
      schemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
      snapshot: sharedPreviewSnapshot,
      integrity: sharedPreviewSnapshot
        ? sharedPreviewSnapshot.integrity
        : input.sharedPreviewInput
          ? validatePreviewIntegrity(input.sharedPreviewInput)
          : null
    },
    productReuse: {
      editorialReview: true,
      sharedPreview: true,
      pipelineHealth: true,
      recruitmentOperations: true,
      seoDiagnostics: true
    }
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  WORKFLOW_STATES,
  integrateProductMonitoringCandidate,
  createMonitoringCandidate: framework.createMonitoringCandidate,
  validateMonitoringCandidateContract: framework.validateMonitoringCandidateContract,
  normalizeMonitoringCandidate: framework.normalizeMonitoringCandidate,
  validateMonitoringCandidate: framework.validateMonitoringCandidate,
  mapConfidenceBand: framework.mapConfidenceBand,
  createConfidenceMapper: framework.createConfidenceMapper,
  adaptCandidateToReviewPayload: framework.adaptCandidateToReviewPayload,
  buildIntegrationDiagnostics: framework.buildIntegrationDiagnostics,
  simulateReviewPayloadPreview: framework.simulateReviewPayloadPreview,
  integrateMonitoringCandidateToReview: framework.integrateMonitoringCandidateToReview,
  getMonitoringReviewIntegrationFramework:
    framework.getMonitoringReviewIntegrationFramework,
  getMonitoringReviewIntegrationFrameworkIdentity:
    framework.getMonitoringReviewIntegrationFrameworkIdentity,
  normalizeTitle: framework.normalizeTitle,
  normalizeDepartment: framework.normalizeDepartment,
  normalizeQualification: framework.normalizeQualification,
  normalizeStateField: framework.normalizeState,
  normalizeRecruitmentCategory: framework.normalizeRecruitmentCategory,
  normalizeImportantDates: framework.normalizeImportantDates,
  CONFIDENCE_BANDS: framework.CONFIDENCE_BANDS,
  EDITORIAL_WORKFLOW_STATES: framework.EDITORIAL_WORKFLOW_STATES,
  VALIDATION_STATUS: framework.VALIDATION_STATUS
};
