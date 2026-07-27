"use strict";

/**
 * AMP-2 — WP_AUTOMATION_WORKFLOW Implementation Specification.
 *
 * Pure deterministic advisory specification for the orchestration layer.
 * Does not execute, wire, or activate production behavior.
 */

const WORK_PACKAGE_ID = "WP_AUTOMATION_WORKFLOW";
const GAP_ID = "GAP_AMP2_AUTOMATION_WORKFLOW";
const PHASE = "AMP-2";
const ENTITY = "wp_automation_workflow";
const SCHEMA_VERSION = "1.0.0";

const OBJECTIVE =
  "Build the complete automation workflow that connects detection, AMP-1 intelligence, draft generation, Telegram review preparation, manual approval, versioning, metrics, and recovery without enabling production automation.";

const CURRENT_PRODUCTION_ASSUMPTIONS = Object.freeze([
  Object.freeze({
    id: "ASSUMPTION_PIPELINE_DISABLED",
    order: 1,
    statement: "RECRUITMENT_PIPELINE_ENABLED remains FALSE.",
  }),
  Object.freeze({
    id: "ASSUMPTION_ADVISORY_ONLY",
    order: 2,
    statement: "AMP-2 remains advisory-only with zero publishing, scheduler, or worker activation.",
  }),
  Object.freeze({
    id: "ASSUMPTION_AMP1_EXISTS",
    order: 3,
    statement: "AMP-1 Recruitment Intelligence Brain is the intelligence layer for workflow orchestration.",
  }),
  Object.freeze({
    id: "ASSUMPTION_REVIEW_MANUAL",
    order: 4,
    statement: "Approval remains manual and publish stays future-only.",
  }),
]);

const CAPABILITIES = Object.freeze([
  "AUTOMATION_ORCHESTRATOR",
  "WORKFLOW_STATE_MACHINE",
  "DRAFT_GENERATION_COORDINATOR",
  "DRAFT_PACKAGE_BUILDER",
  "DRAFT_DIFFERENCE_ENGINE",
  "TELEGRAM_MESSAGE_BUILDER",
  "APPROVAL_WORKFLOW_MODEL",
  "REVIEW_QUEUE",
  "AUTOMATION_AUDIT_LOG",
  "WORKFLOW_METRICS",
  "FAILURE_RECOVERY",
  "WORKFLOW_VERSIONING",
  "RENDERER_COMPATIBILITY",
]);

const IMPLEMENTATION_DEPENDENCIES = Object.freeze([
  Object.freeze({ module: "recruitmentIntelligenceBrain", package: "AMP-1", required: true }),
  Object.freeze({ module: "draftPreparation", package: "5D", required: true }),
  Object.freeze({ module: "reviewQueueWiring", package: "RW-1", required: true }),
  Object.freeze({ module: "telegramNotification", package: "TG-1", required: true }),
  Object.freeze({ module: "pipelineFeatureFlag", phase: 24, required: true }),
]);

const FUTURE_INTEGRATION_NOTES = Object.freeze([
  Object.freeze({
    id: "INTEGRATION_AMP3_ADMIN_UI",
    order: 1,
    note: "Expose AMP-2 review artifacts to AMP-3 Admin UI without changing current production routes.",
  }),
  Object.freeze({
    id: "INTEGRATION_REVIEW_QUEUE_PERSISTENCE",
    order: 2,
    note: "Persist review queue only after explicit authorization and separate enablement package.",
  }),
  Object.freeze({
    id: "INTEGRATION_TELEGRAM_SEND",
    order: 3,
    note: "Connect Telegram send path only after manual approval flow and credential governance are approved.",
  }),
  Object.freeze({
    id: "INTEGRATION_PUBLISH_STEP",
    order: 4,
    note: "Map Approved state to a future publish package without enabling auto-publish from AMP-2.",
  }),
]);

const COMPLETION_CHECKLIST = Object.freeze([
  Object.freeze({ id: "CHK_ORCHESTRATOR", label: "Automation orchestrator complete", done: true }),
  Object.freeze({ id: "CHK_STATE_MACHINE", label: "Workflow state machine complete", done: true }),
  Object.freeze({ id: "CHK_DRAFT_COORDINATOR", label: "Draft generation coordinator complete", done: true }),
  Object.freeze({ id: "CHK_DRAFT_PACKAGE", label: "Draft package builder complete", done: true }),
  Object.freeze({ id: "CHK_DIFFERENCE", label: "Draft difference engine complete", done: true }),
  Object.freeze({ id: "CHK_TELEGRAM", label: "Telegram review message builder complete", done: true }),
  Object.freeze({ id: "CHK_APPROVAL", label: "Approval workflow model complete", done: true }),
  Object.freeze({ id: "CHK_QUEUE", label: "Review queue complete", done: true }),
  Object.freeze({ id: "CHK_AUDIT", label: "Automation audit log complete", done: true }),
  Object.freeze({ id: "CHK_METRICS", label: "Workflow metrics complete", done: true }),
  Object.freeze({ id: "CHK_RECOVERY", label: "Failure recovery complete", done: true }),
  Object.freeze({ id: "CHK_VERSIONING", label: "Workflow versioning complete", done: true }),
  Object.freeze({ id: "CHK_TESTS", label: "Unit and integration coverage complete", done: true }),
  Object.freeze({ id: "CHK_NO_PRODUCTION", label: "No production activation", done: true }),
]);

function deepFreeze(value) {
  if (value == null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) deepFreeze(value[i]);
  } else {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) deepFreeze(value[keys[i]]);
  }
  return value;
}

function buildWorkPackageSpec() {
  return deepFreeze({
    workPackageId: WORK_PACKAGE_ID,
    gapId: GAP_ID,
    phase: PHASE,
    entity: ENTITY,
    schemaVersion: SCHEMA_VERSION,
    objective: OBJECTIVE,
    currentProductionAssumptions: CURRENT_PRODUCTION_ASSUMPTIONS,
    capabilities: CAPABILITIES,
    implementationDependencies: IMPLEMENTATION_DEPENDENCIES,
    futureIntegrationNotes: FUTURE_INTEGRATION_NOTES,
    completionChecklist: COMPLETION_CHECKLIST,
    advisoryMetadata: {
      advisoryOnly: true,
      productionImpact: false,
      pipelineActivation: false,
      publishing: false,
      schedulerActivation: false,
      workerActivation: false,
      cronActivation: false,
    },
  });
}

module.exports = {
  WORK_PACKAGE_ID,
  GAP_ID,
  PHASE,
  buildWorkPackageSpec,
};
