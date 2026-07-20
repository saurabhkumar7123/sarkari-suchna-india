'use strict';

/**
 * Package 5C — Product-side Controlled Lifecycle Engine facade.
 *
 * Thin composition layer over Program 5 Package 5C governance framework.
 * Reuses Pipeline Health, Monitoring Review Integration, Editorial Review,
 * Shared Preview, and SEO Diagnostics identities without duplicating logic.
 *
 * No automatic transitions. No runtime state mutation. No publishing.
 */

const path = require("path");

const frameworkPath = path.resolve(
  __dirname,
  "../../../../../server/lib/project/program5/package5CControlledLifecycleEngineFramework.js"
);

const framework = require(frameworkPath);

const {
  WORKFLOW_STATES,
  listAllowedDecisions,
  normalizeState
} = require("../editorialWorkflow");

const { SHARED_PREVIEW_SCHEMA_VERSION } = require("../sharedPreviewModel");

/**
 * Map editorial workflow states to lifecycle advisory hints (identity reuse).
 */
const EDITORIAL_TO_LIFECYCLE_HINT = Object.freeze({
  [WORKFLOW_STATES.REVIEW_PENDING]: "REVIEW_READY",
  [WORKFLOW_STATES.IN_REVIEW]: "UNDER_REVIEW",
  [WORKFLOW_STATES.APPROVED]: "APPROVED",
  [WORKFLOW_STATES.REJECTED]: "REJECTED"
});

/**
 * Evaluate product-side controlled lifecycle (advisory only).
 *
 * @param {object} [input]
 */
function evaluateProductControlledLifecycle(input = {}) {
  const result = framework.evaluateControlledLifecycle(input);

  const editorialState = input.editorialWorkflowState
    ? normalizeState(input.editorialWorkflowState)
    : null;

  const editorialAlignment = {
    reusedModule: "EDITORIAL_REVIEW",
    workflowState: editorialState,
    workflowStateValid: Boolean(editorialState),
    allowedDecisions: editorialState ? listAllowedDecisions(editorialState) : [],
    lifecycleHint: editorialState
      ? EDITORIAL_TO_LIFECYCLE_HINT[editorialState] || null
      : null
  };

  return framework.deepFreeze({
    ...result,
    editorialAlignment,
    sharedPreview: {
      schemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
      availabilityObserved: Boolean(
        input.gateObservations &&
          (input.gateObservations.satisfiedGates || []).includes(
            "SHARED_PREVIEW_AVAILABILITY"
          )
      )
    },
    productReuse: {
      pipelineHealth: true,
      monitoringReviewIntegration: true,
      editorialReview: true,
      sharedPreview: true,
      seoDiagnostics: true,
      recruitmentOperations: true
    }
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  LIFECYCLE_STATES: framework.LIFECYCLE_STATES,
  GATE_IDS: framework.GATE_IDS,
  WORKFLOW_STATES,
  EDITORIAL_TO_LIFECYCLE_HINT,
  evaluateProductControlledLifecycle,
  evaluateControlledLifecycle: framework.evaluateControlledLifecycle,
  createLifecycleDefinition: framework.createLifecycleDefinition,
  createLifecycleTransitionRules: framework.createLifecycleTransitionRules,
  createLifecycleGateRegistry: framework.createLifecycleGateRegistry,
  listAllowedNextStates: framework.listAllowedNextStates,
  isLifecycleTransitionAllowed: framework.isLifecycleTransitionAllowed,
  evaluateLifecycleGates: framework.evaluateLifecycleGates,
  validateLifecycleTransition: framework.validateLifecycleTransition,
  createLifecycleHistoryRecord: framework.createLifecycleHistoryRecord,
  buildLifecycleHistory: framework.buildLifecycleHistory,
  generateLifecycleDashboard: framework.generateLifecycleDashboard,
  generateLifecycleReadinessReport: framework.generateLifecycleReadinessReport,
  getControlledLifecycleEngineFramework:
    framework.getControlledLifecycleEngineFramework,
  getControlledLifecycleEngineFrameworkIdentity:
    framework.getControlledLifecycleEngineFrameworkIdentity,
  normalizeLifecycleState: framework.normalizeLifecycleState
};
