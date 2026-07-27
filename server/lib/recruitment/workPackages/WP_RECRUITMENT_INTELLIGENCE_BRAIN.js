"use strict";

/**
 * AMP-1 — WP_RECRUITMENT_INTELLIGENCE_BRAIN Implementation Specification.
 *
 * Pure deterministic advisory specification for the Recruitment Intelligence Brain.
 * Does not execute, wire, or activate anything.
 */

const WP_RECRUITMENT_INTELLIGENCE_BRAIN_PHASE = "AMP-1";

const WP_RECRUITMENT_INTELLIGENCE_BRAIN_ENTITY = "wp_recruitment_intelligence_brain";

const WP_RECRUITMENT_INTELLIGENCE_BRAIN_SCHEMA_VERSION = "1.0.0";

const WORK_PACKAGE_ID = "WP_RECRUITMENT_INTELLIGENCE_BRAIN";

const GAP_ID = "GAP_AMP1_RECRUITMENT_INTELLIGENCE_BRAIN";

const OBJECTIVE =
  "Build the complete Recruitment Intelligence Brain that understands entire recruitment lifecycles and produces structured Recruitment Objects without activating production automation.";

const CURRENT_PRODUCTION_ASSUMPTIONS = Object.freeze([
  Object.freeze({
    id: "ASSUMPTION_PIPELINE_DISABLED",
    order: 1,
    statement: "RECRUITMENT_PIPELINE_ENABLED remains FALSE in production.",
  }),
  Object.freeze({
    id: "ASSUMPTION_MONITORING_ACTIVE",
    order: 2,
    statement: "Monitoring policy and official source whitelist are already operational.",
  }),
  Object.freeze({
    id: "ASSUMPTION_DRAFT_FOUNDATION_EXISTS",
    order: 3,
    statement: "Draft generation foundation (Package 5D) exists for future renderer integration.",
  }),
  Object.freeze({
    id: "ASSUMPTION_ADVISORY_ONLY",
    order: 4,
    statement: "AMP-1 is advisory-only with zero production side effects.",
  }),
]);

const CAPABILITIES = Object.freeze([
  "RECRUITMENT_BRAIN",
  "LIFECYCLE_INTELLIGENCE",
  "RECRUITMENT_MATCHING",
  "HISTORY_RECOVERY",
  "CURRENT_STAGE_DETECTION",
  "TIMELINE_BUILDER",
  "UPDATE_INTELLIGENCE",
  "DUPLICATE_DETECTION",
  "CONFIDENCE_ENGINE",
  "DRAFT_READINESS",
  "MISSING_INFORMATION_ENGINE",
  "VALIDATION_ENGINE",
  "PAGE_DECISION_ENGINE",
  "STRUCTURED_OUTPUT",
  "RENDERER_COMPATIBILITY",
]);

const IMPLEMENTATION_DEPENDENCIES = Object.freeze([
  Object.freeze({ module: "recruitmentDomainModel", phase: 63, required: true }),
  Object.freeze({ module: "recruitmentMatcher", phase: 21, required: true }),
  Object.freeze({ module: "eventTypeClassifier", phase: 20, required: true }),
  Object.freeze({ module: "draftPreparation", package: "5D", required: true }),
  Object.freeze({ module: "controlledLifecycleEngine", package: "5C", required: true }),
  Object.freeze({ module: "governmentSourceRegistry", package: "MB-1", required: true }),
]);

const FUTURE_INTEGRATION_NOTES = Object.freeze([
  Object.freeze({
    id: "INTEGRATION_SITE_WORKER",
    order: 1,
    note: "Wire processRecruitmentIntelligence behind RECRUITMENT_PIPELINE_ENABLED flag in siteWorker.",
  }),
  Object.freeze({
    id: "INTEGRATION_DETECTION_PROCESSOR",
    order: 2,
    note: "Replace/adjunct detectionProcessor matching with recruitmentMatchingEngine.",
  }),
  Object.freeze({
    id: "INTEGRATION_DRAFT_PROPOSAL",
    order: 3,
    note: "Feed recruitmentDraftProposalEngine from draftReadiness and pageDecision outputs.",
  }),
  Object.freeze({
    id: "INTEGRATION_HISTORY_RECOVERY",
    order: 4,
    note: "Connect historyRecoveryEngine to monitoring source search results from official whitelist.",
  }),
  Object.freeze({
    id: "INTEGRATION_GENERATOR",
    order: 5,
    note: "Pass buildGeneratorPayload output to Package 5D draft preparation when draft ready.",
  }),
]);

const COMPLETION_CHECKLIST = Object.freeze([
  Object.freeze({ id: "CHK_BRAIN_ORCHESTRATOR", label: "Recruitment Brain orchestrator complete", done: true }),
  Object.freeze({ id: "CHK_LIFECYCLE", label: "Lifecycle intelligence with 19 stages", done: true }),
  Object.freeze({ id: "CHK_MATCHING", label: "Recruitment matching engine", done: true }),
  Object.freeze({ id: "CHK_HISTORY", label: "History recovery engine", done: true }),
  Object.freeze({ id: "CHK_TIMELINE", label: "Timeline builder", done: true }),
  Object.freeze({ id: "CHK_UPDATE", label: "Update intelligence engine", done: true }),
  Object.freeze({ id: "CHK_DUPLICATE", label: "Duplicate detection engine", done: true }),
  Object.freeze({ id: "CHK_CONFIDENCE", label: "Confidence engine 0-100", done: true }),
  Object.freeze({ id: "CHK_DRAFT_READINESS", label: "Draft readiness evaluation", done: true }),
  Object.freeze({ id: "CHK_MISSING", label: "Missing information engine", done: true }),
  Object.freeze({ id: "CHK_VALIDATION", label: "Validation engine", done: true }),
  Object.freeze({ id: "CHK_PAGE_DECISION", label: "Page decision engine", done: true }),
  Object.freeze({ id: "CHK_RENDERER", label: "Renderer compatibility (no HTML)", done: true }),
  Object.freeze({ id: "CHK_TESTS", label: "Comprehensive test suite", done: true }),
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
    phase: WP_RECRUITMENT_INTELLIGENCE_BRAIN_PHASE,
    entity: WP_RECRUITMENT_INTELLIGENCE_BRAIN_ENTITY,
    schemaVersion: WP_RECRUITMENT_INTELLIGENCE_BRAIN_SCHEMA_VERSION,
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
    },
  });
}

module.exports = {
  WORK_PACKAGE_ID,
  GAP_ID,
  WP_RECRUITMENT_INTELLIGENCE_BRAIN_PHASE,
  buildWorkPackageSpec,
};
