'use strict';

/**
 * Package 5D — Product-side Draft Preparation Framework facade.
 *
 * Thin composition layer over Program 5 Package 5D governance framework.
 * Reuses Recruitment Operations, Editorial Review, Shared Preview,
 * Controlled Lifecycle Engine, Monitoring Review Integration,
 * SEO Diagnostics, and Generator identities without duplicating logic.
 *
 * No production draft creation. No publishing. No runtime automation.
 */

const path = require("path");

const frameworkPath = path.resolve(
  __dirname,
  "../../../../../server/lib/project/program5/package5DDraftPreparationFramework.js"
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
  SHARED_PREVIEW_SCHEMA_VERSION
} = require("../sharedPreviewModel");

/**
 * Map editorial workflow approval onto draft preparation input.
 */
function resolveApprovalHints(input = {}) {
  const editorialState = input.editorialWorkflowState
    ? normalizeState(input.editorialWorkflowState)
    : null;

  const approved =
    input.approved === true ||
    editorialState === WORKFLOW_STATES.APPROVED ||
    Boolean(input.reviewApproved);

  return {
    approved,
    editorialWorkflowState: editorialState
  };
}

/**
 * Prepare a product-side draft from an approved Human Review payload.
 * Advisory only — never persists or publishes.
 *
 * @param {object} [input]
 */
function prepareProductDraftFromReviewPayload(input = {}) {
  const approval = resolveApprovalHints(input);

  let sharedPreviewSnapshot = input.sharedPreviewSnapshot || null;
  if (!sharedPreviewSnapshot && input.sharedPreviewInput) {
    sharedPreviewSnapshot = buildPreviewSnapshot(input.sharedPreviewInput);
  }

  const result = framework.prepareDraftFromReviewPayload({
    ...input,
    approved: approval.approved,
    reviewApproved: approval.approved,
    sharedPreviewSnapshot
  });

  const editorialAlignment = {
    reusedModule: "EDITORIAL_REVIEW",
    workflowState: approval.editorialWorkflowState,
    workflowStateValid: Boolean(approval.editorialWorkflowState),
    allowedDecisions: approval.editorialWorkflowState
      ? listAllowedDecisions(approval.editorialWorkflowState)
      : [],
    approved: approval.approved,
    validationSummaryHint: buildValidationSummary({
      recruitment: input.sharedPreviewInput
        ? input.sharedPreviewInput.recruitment
        : null,
      draft: input.sharedPreviewInput
        ? input.sharedPreviewInput.draft
        : null
    })
  };

  return framework.deepFreeze({
    ...result,
    editorialAlignment,
    sharedPreview: {
      schemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
      snapshotAttached: Boolean(sharedPreviewSnapshot),
      previewReady: Boolean(result.preview && result.preview.ready)
    },
    productReuse: {
      recruitmentOperations: true,
      editorialReview: true,
      sharedPreview: true,
      controlledLifecycleEngine: true,
      monitoringReviewIntegration: true,
      seoDiagnostics: true,
      generator: true
    }
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  DRAFT_LIFECYCLE_STATES: framework.DRAFT_LIFECYCLE_STATES,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  GENERATOR_PAYLOAD_FIELDS: framework.GENERATOR_PAYLOAD_FIELDS,
  WORKFLOW_STATES,
  prepareProductDraftFromReviewPayload,
  prepareDraftFromReviewPayload: framework.prepareDraftFromReviewPayload,
  createDraftPreparationContract: framework.createDraftPreparationContract,
  createDraftPreparationModel: framework.createDraftPreparationModel,
  assembleDraftFromReviewPayload: framework.assembleDraftFromReviewPayload,
  validatePreparedDraft: framework.validatePreparedDraft,
  adaptPreparedDraftToGenerator: framework.adaptPreparedDraftToGenerator,
  buildDraftPreviewModel: framework.buildDraftPreviewModel,
  generateDraftReadinessReport: framework.generateDraftReadinessReport,
  buildDraftDiagnostics: framework.buildDraftDiagnostics,
  getDraftPreparationFramework: framework.getDraftPreparationFramework,
  getDraftPreparationFrameworkIdentity:
    framework.getDraftPreparationFrameworkIdentity,
  normalizeDraftLifecycleState: framework.normalizeDraftLifecycleState
};
