'use strict';

/**
 * Package 5E — Product-side Controlled Candidate Resolution facade.
 *
 * Thin composition layer over Program 5 Package 5E governance framework.
 * Reuses Monitoring Review Integration, Controlled Lifecycle Engine,
 * Draft Preparation, Recruitment Operations, Editorial Review,
 * Shared Preview, and Pipeline Health identities without duplicating logic.
 *
 * No automatic merge. No production modifications. No runtime automation.
 */

const path = require("path");

const frameworkPath = path.resolve(
  __dirname,
  "../../../../../server/lib/project/program5/package5EControlledCandidateResolutionFramework.js"
);

const framework = require(frameworkPath);

const {
  WORKFLOW_STATES,
  normalizeState,
  listAllowedDecisions
} = require("../editorialWorkflow");

const {
  buildPreviewSnapshot,
  SHARED_PREVIEW_SCHEMA_VERSION
} = require("../sharedPreviewModel");

/**
 * Map optional editorial workflow context onto resolution input hints.
 */
function resolveEditorialHints(input = {}) {
  const editorialState = input.editorialWorkflowState
    ? normalizeState(input.editorialWorkflowState)
    : null;

  return {
    editorialWorkflowState: editorialState
  };
}

/**
 * Resolve product-side candidates with advisory deduplication.
 * Never merges, deletes, or overwrites production data.
 *
 * @param {object} [input]
 */
function resolveProductControlledCandidates(input = {}) {
  const editorial = resolveEditorialHints(input);

  let sharedPreviewSnapshot = input.sharedPreviewSnapshot || null;
  if (!sharedPreviewSnapshot && input.sharedPreviewInput) {
    sharedPreviewSnapshot = buildPreviewSnapshot(input.sharedPreviewInput);
  }

  const result = framework.resolveControlledCandidates({
    ...input,
    sharedPreviewSnapshot
  });

  const editorialAlignment = {
    reusedModule: "EDITORIAL_REVIEW",
    workflowState: editorial.editorialWorkflowState,
    workflowStateValid: Boolean(editorial.editorialWorkflowState),
    allowedDecisions: editorial.editorialWorkflowState
      ? listAllowedDecisions(editorial.editorialWorkflowState)
      : [],
    operatorControlled: true
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
      monitoringReviewIntegration: true,
      controlledLifecycleEngine: true,
      draftPreparation: true,
      recruitmentOperations: true,
      editorialReview: true,
      sharedPreview: true,
      pipelineHealth: true
    }
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  FINGERPRINT_CLASSES: framework.FINGERPRINT_CLASSES,
  DUPLICATE_RELATION_TYPES: framework.DUPLICATE_RELATION_TYPES,
  MERGE_RECOMMENDATIONS: framework.MERGE_RECOMMENDATIONS,
  WORKFLOW_STATES,
  resolveProductControlledCandidates,
  resolveControlledCandidates: framework.resolveControlledCandidates,
  createCandidateIdentityContract: framework.createCandidateIdentityContract,
  createCandidateIdentityModel: framework.createCandidateIdentityModel,
  generateIdentityFingerprint: framework.generateIdentityFingerprint,
  detectCandidateDuplicates: framework.detectCandidateDuplicates,
  resolveRelatedCandidates: framework.resolveRelatedCandidates,
  generateMergeRecommendations: framework.generateMergeRecommendations,
  buildResolutionPreviewModel: framework.buildResolutionPreviewModel,
  generateResolutionReport: framework.generateResolutionReport,
  getControlledCandidateResolutionFramework:
    framework.getControlledCandidateResolutionFramework,
  getControlledCandidateResolutionFrameworkIdentity:
    framework.getControlledCandidateResolutionFrameworkIdentity
};
