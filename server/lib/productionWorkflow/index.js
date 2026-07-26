"use strict";

/**
 * Production Workflow Program (PWP) — Phases 1–5
 *
 * Phase 1: End-to-end production orchestration layer.
 * Phase 2: Recruitment Resolution & Routing Engine.
 * Phase 3: Generator Integration & Draft Preparation.
 * Phase 4: Editorial Workflow & Review Operations.
 * Phase 5: Production Readiness, Operational Verification & Observability.
 *
 * Reuses existing Monitoring Bot, CIP Program 3 (3A–3E), Program 1,
 * Program 2, Generator draft contract, Editorial Review Queue, and
 * Telegram Notification services.
 *
 * No new intelligence / extraction / monitoring / generator engines.
 * No DB schema changes. AUTO_PUBLISH_ENABLED remains false.
 */

const workflowStates = require("./workflowStates");
const pipelineContracts = require("./pipelineContracts");
const auditTrail = require("./auditTrail");
const failureHandling = require("./failureHandling");
const publishingPolicy = require("./publishingPolicy");
const contentAdapters = require("./contentAdapters");
const stageRunners = require("./stageRunners");
const workflowEngine = require("./workflowEngine");
const recruitmentResolution = require("./recruitmentResolution");
const resolutionTypes = require("./recruitmentResolution/resolutionTypes");
const pageMatching = require("./recruitmentResolution/pageMatching");
const duplicatePolicy = require("./recruitmentResolution/duplicatePolicy");
const updatePlanner = require("./recruitmentResolution/updatePlanner");
const routingModel = require("./recruitmentResolution/routingModel");
const generatorIntegration = require("./generatorIntegration");
const editorialWorkflow = require("./editorialWorkflow");
const productionReadiness = require("./productionReadiness");

module.exports = {
  ...workflowStates,
  ...pipelineContracts,
  ...publishingPolicy,
  ...failureHandling,
  createAuditTrail: auditTrail.createAuditTrail,
  buildWorkflowReport: auditTrail.buildWorkflowReport,
  buildPassThroughAiResponse: contentAdapters.buildPassThroughAiResponse,
  buildGeneratorDraftFromCanonical: contentAdapters.buildGeneratorDraftFromCanonical,
  resolveProgram1Text: contentAdapters.resolveProgram1Text,
  STAGE_RUNNERS: stageRunners.STAGE_RUNNERS,
  ORCHESTRATOR_ID: workflowEngine.ORCHESTRATOR_ID,
  ORCHESTRATOR_VERSION: workflowEngine.ORCHESTRATOR_VERSION,
  PHASE: workflowEngine.PHASE,
  runProductionWorkflow: workflowEngine.runProductionWorkflow,
  createWorkflowId: workflowEngine.createWorkflowId,

  // Phase 2 — Recruitment Resolution & Routing
  resolveRecruitment: recruitmentResolution.resolveRecruitment,
  resolveRecruitmentEvent: recruitmentResolution.resolveRecruitmentEvent,
  RESOLUTION_ENGINE_ID: resolutionTypes.ENGINE_ID,
  RESOLUTION_ENGINE_VERSION: resolutionTypes.ENGINE_VERSION,
  RESOLUTION_PHASE: resolutionTypes.PHASE,
  RESOLUTION_DECISIONS: resolutionTypes.RESOLUTION_DECISIONS,
  ROUTE_DESTINATIONS: resolutionTypes.ROUTE_DESTINATIONS,
  RECOMMENDED_ACTIONS: resolutionTypes.RECOMMENDED_ACTIONS,
  PAGE_SECTIONS: resolutionTypes.PAGE_SECTIONS,
  CONFIDENCE_LEVELS: resolutionTypes.CONFIDENCE_LEVELS,
  planUpdateScope: updatePlanner.planUpdateScope,
  matchExistingRecruitment: pageMatching.matchExistingRecruitment,
  matchExistingPage: pageMatching.matchExistingPage,
  evaluateDuplicatePolicy: duplicatePolicy.evaluateDuplicatePolicy,
  buildRouting: routingModel.buildRouting,
  shouldRunGenerator: routingModel.shouldRunGenerator,
  shouldRunEditorialQueue: routingModel.shouldRunEditorialQueue,

  // Phase 3 — Generator Integration & Draft Preparation
  prepareGeneratorDraft: generatorIntegration.prepareGeneratorDraft,
  buildDraftPackage: generatorIntegration.buildDraftPackage,
  buildUpdatePackage: generatorIntegration.buildUpdatePackage,
  buildEditorialNotes: generatorIntegration.buildEditorialNotes,
  buildGeneratorContract: generatorIntegration.buildGeneratorContract,
  validateGeneratorDraftInput: generatorIntegration.validateGeneratorDraftInput,
  decisionToDraftType: generatorIntegration.decisionToDraftType,
  createDraftId: generatorIntegration.createDraftId,
  GENERATOR_INTEGRATION_ENGINE_ID: generatorIntegration.ENGINE_ID,
  GENERATOR_INTEGRATION_ENGINE_VERSION: generatorIntegration.ENGINE_VERSION,
  GENERATOR_INTEGRATION_PHASE: generatorIntegration.PHASE,
  DRAFT_TYPES: generatorIntegration.DRAFT_TYPES,
  SECTION_ACTIONS: generatorIntegration.SECTION_ACTIONS,
  EDITORIAL_NOTE_CODES: generatorIntegration.EDITORIAL_NOTE_CODES,
  DRAFT_PACKAGE_FORMAT_ID: generatorIntegration.DRAFT_PACKAGE_FORMAT_ID,
  GENERATOR_CONTRACT_FORMAT_ID: generatorIntegration.GENERATOR_CONTRACT_FORMAT_ID,

  // Phase 4 — Editorial Workflow & Review Operations
  prepareEditorialReview: editorialWorkflow.prepareEditorialReview,
  reviewAction: editorialWorkflow.reviewAction,
  validateEditorialReviewInput: editorialWorkflow.validateEditorialReviewInput,
  buildEditorialPackage: editorialWorkflow.buildEditorialPackage,
  buildEditorialContract: editorialWorkflow.buildEditorialContract,
  buildDiffModel: editorialWorkflow.buildDiffModel,
  createReviewId: editorialWorkflow.createReviewId,
  clearEditorialReviewMemory: editorialWorkflow.clearReviewMemory,
  getEditorialReviewHistory: editorialWorkflow.getReviewHistory,
  EDITORIAL_WORKFLOW_ENGINE_ID: editorialWorkflow.ENGINE_ID,
  EDITORIAL_WORKFLOW_ENGINE_VERSION: editorialWorkflow.ENGINE_VERSION,
  EDITORIAL_WORKFLOW_PHASE: editorialWorkflow.PHASE,
  REVIEW_STATES: editorialWorkflow.REVIEW_STATES,
  REVIEW_ACTIONS: editorialWorkflow.REVIEW_ACTIONS,
  REVIEW_TRANSITIONS: editorialWorkflow.REVIEW_TRANSITIONS,
  TERMINAL_REVIEW_STATES: editorialWorkflow.TERMINAL_REVIEW_STATES,
  EDITORIAL_PACKAGE_FORMAT_ID: editorialWorkflow.EDITORIAL_PACKAGE_FORMAT_ID,
  EDITORIAL_CONTRACT_FORMAT_ID: editorialWorkflow.EDITORIAL_CONTRACT_FORMAT_ID,

  // Phase 5 — Production Readiness, Verification & Observability
  evaluateProductionReadiness: productionReadiness.evaluateProductionReadiness,
  buildProductionReadinessManifest: productionReadiness.buildProductionReadinessManifest,
  validateProductionManifest: productionReadiness.validateProductionManifest,
  buildWorkflowDiagnostics: productionReadiness.buildWorkflowDiagnostics,
  buildObservabilitySummary: productionReadiness.buildObservabilitySummary,
  READINESS_SERVICE_ID: productionReadiness.READINESS_SERVICE_ID,
  READINESS_SERVICE_VERSION: productionReadiness.READINESS_SERVICE_VERSION,
  READINESS_PHASE: productionReadiness.PHASE,
  READINESS_REPORT_FORMAT_ID: productionReadiness.REPORT_FORMAT_ID,
  READINESS_LEVELS: productionReadiness.READINESS_LEVELS,
  HEALTH_LEVELS: productionReadiness.HEALTH_LEVELS,
  READINESS_STAGE_HEALTH: productionReadiness.STAGE_HEALTH,
  EXPECTED_READINESS_STAGE_ORDER: productionReadiness.EXPECTED_STAGE_ORDER
};
