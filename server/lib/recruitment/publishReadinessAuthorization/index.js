'use strict';

/**
 * Package 5F — Product-side Controlled Publish Readiness & Authorization facade.
 *
 * Thin composition layer over Program 5 Package 5F governance framework.
 * Reuses Pipeline Health, Monitoring Review Integration, Controlled Lifecycle
 * Engine, Draft Preparation, Candidate Resolution, Editorial Review,
 * Shared Preview, and SEO Diagnostics identities without duplicating logic.
 *
 * Authorization assessment only. No publishing. No deployment. No routes.
 */

const path = require("path");

const frameworkPath = path.resolve(
  __dirname,
  "../../../../../server/lib/project/program5/package5FControlledPublishReadinessAuthorizationFramework.js"
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
 * Map optional editorial workflow context onto authorization input hints.
 */
function resolveEditorialHints(input = {}) {
  const editorialState = input.editorialWorkflowState
    ? normalizeState(input.editorialWorkflowState)
    : null;

  const validationSummary = input.editorialValidationInput
    ? buildValidationSummary(input.editorialValidationInput)
    : null;

  return {
    editorialWorkflowState: editorialState,
    validationSummary
  };
}

/**
 * Evaluate product-side publish readiness authorization (advisory only).
 * Never publishes, deploys, or activates routes.
 *
 * @param {object} [input]
 */
function evaluateProductPublishReadinessAuthorization(input = {}) {
  const editorial = resolveEditorialHints(input);

  let sharedPreviewSnapshot = input.sharedPreviewSnapshot || null;
  if (!sharedPreviewSnapshot && input.sharedPreviewInput) {
    sharedPreviewSnapshot = buildPreviewSnapshot(input.sharedPreviewInput);
  }

  const gateObservations = {
    ...(input.gateObservations || {})
  };

  if (editorial.editorialWorkflowState && gateObservations.editorialReady == null) {
    gateObservations.editorialReady =
      editorial.editorialWorkflowState === WORKFLOW_STATES.APPROVED ||
      editorial.editorialWorkflowState === "approved";
  }

  if (
    editorial.validationSummary &&
    gateObservations.editorialChecklistComplete == null
  ) {
    gateObservations.editorialChecklistComplete = Boolean(
      editorial.validationSummary.valid ||
        editorial.validationSummary.checklistComplete
    );
  }

  const result = framework.evaluatePublishReadinessAuthorization({
    ...input,
    gateObservations
  });

  const editorialAlignment = {
    reusedModule: "EDITORIAL_REVIEW",
    workflowState: editorial.editorialWorkflowState,
    workflowStateValid: Boolean(editorial.editorialWorkflowState),
    allowedDecisions: editorial.editorialWorkflowState
      ? listAllowedDecisions(editorial.editorialWorkflowState)
      : [],
    operatorControlled: true,
    automaticApproval: false
  };

  return framework.deepFreeze({
    ...result,
    editorialAlignment,
    sharedPreview: {
      schemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
      snapshotAttached: Boolean(sharedPreviewSnapshot),
      previewOnly: true
    },
    productReuse: {
      pipelineHealth: true,
      monitoringReviewIntegration: true,
      controlledLifecycleEngine: true,
      draftPreparation: true,
      candidateResolution: true,
      editorialReview: true,
      sharedPreview: true,
      seoDiagnostics: true
    }
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  GATE_RESULT: framework.GATE_RESULT,
  AUTHORIZATION_GATE_IDS: framework.AUTHORIZATION_GATE_IDS,
  OVERALL_STATUS: framework.OVERALL_STATUS,
  DEPLOYMENT_RECOMMENDATION: framework.DEPLOYMENT_RECOMMENDATION,
  WORKFLOW_STATES,
  evaluateProductPublishReadinessAuthorization,
  evaluatePublishReadinessAuthorization:
    framework.evaluatePublishReadinessAuthorization,
  createPublishReadinessContract: framework.createPublishReadinessContract,
  createPublishReadinessModel: framework.createPublishReadinessModel,
  createAuthorizationGateRegistry: framework.createAuthorizationGateRegistry,
  evaluateAuthorizationGates: framework.evaluateAuthorizationGates,
  verifyRollbackReadiness: framework.verifyRollbackReadiness,
  verifyBackupReadiness: framework.verifyBackupReadiness,
  evaluateFinalReadiness: framework.evaluateFinalReadiness,
  buildOperatorAuthorizationPanel: framework.buildOperatorAuthorizationPanel,
  generateFinalGovernanceReport: framework.generateFinalGovernanceReport,
  getControlledPublishReadinessAuthorizationFramework:
    framework.getControlledPublishReadinessAuthorizationFramework,
  getControlledPublishReadinessAuthorizationFrameworkIdentity:
    framework.getControlledPublishReadinessAuthorizationFrameworkIdentity
};
