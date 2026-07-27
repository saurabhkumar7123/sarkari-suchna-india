'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Health & Diagnostics Framework
 * (Advisory / Observability Only)
 *
 * Unified Pipeline Health & Diagnostics layer providing complete
 * operational visibility into the recruitment processing pipeline.
 *
 * This package focuses ONLY on observability and diagnostics.
 * It does NOT automate recruitment.
 * It does NOT publish content.
 * It does NOT execute monitoring jobs.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * No runtime integration. No feature activation. No SQL redesign.
 * No database changes. No APIs. No routes. No scheduler. No worker.
 * No Redis. No polling. No publishing. No GitHub. No deployment.
 * No production behavior changes. No automatic processing.
 *
 * Reuses Program 4 module identities:
 *   Recruitment Operations, Editorial Review, Shared Preview,
 *   SEO Diagnostics, Admin Dashboard.
 *
 * Functions:
 *   getPipelineHealthAndDiagnosticsFramework()
 *   getPipelineHealthAndDiagnosticsFrameworkIdentity()
 *   evaluatePipelineHealth(input)
 */

const {
  PIPELINE_HEALTH_REGISTRY_VERSION,
  PIPELINE_STAGE_IDS,
  REUSED_MODULE_IDS,
  createPipelineHealthRegistry,
  getDefaultPipelineHealthRegistry,
  getPipelineStage,
  listPipelineStages,
} = require('./pipelineHealthRegistry');

const {
  HEALTH_STATUS,
  HEALTH_STATUS_RANK,
  VALID_HEALTH_STATUSES,
  buildStageHealthState,
  evaluateHealthStatus,
  transitionHealthStatus,
  aggregateOverallHealth,
} = require('./pipelineHealthStatusModel');

const {
  buildPipelineDependencyGraph,
  validatePipelineDependencyGraph,
  getUpstreamDependencies,
  getDownstreamDependents,
} = require('./pipelineDependencyGraph');

const {
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_SEVERITY,
  generateStageDiagnostics,
  generatePipelineDiagnostics,
} = require('./pipelineDiagnostics');

const { generatePipelineHealthReport } = require('./pipelineHealthReport');
const { generatePipelineHealthDashboard } = require('./pipelineHealthDashboard');

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING';
const PACKAGE_ID = 'PACKAGE_5A_PIPELINE_HEALTH_AND_DIAGNOSTICS';
const PACKAGE_NAME = 'Pipeline Health & Diagnostics Framework';
const PACKAGE_CODE = '5A';

const GAP_ADDRESSED = 'GAP_FC_PIPELINE_HEALTH_ALERTS';

const OBJECTIVE =
  'Introduce a unified Pipeline Health & Diagnostics layer that provides complete operational visibility into the recruitment processing pipeline.';

const OUT_OF_SCOPE = Object.freeze([
  'AUTOMATION',
  'SCHEDULERS',
  'WORKERS',
  'REDIS',
  'MONITORING_EXECUTION',
  'POLLING',
  'PUBLISHING',
  'AUTO_APPROVAL',
  'AI_DECISIONS',
  'RUNTIME_ACTIVATION',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'VPS',
  'GITHUB',
  'SQL_SCHEMA_REDESIGN',
  'RUNTIME_WIRING',
  'AUTOMATIC_PROCESSING',
  'FEATURE_ACTIVATION',
]);

const CAPABILITIES = Object.freeze([
  'PIPELINE_HEALTH_REGISTRY',
  'HEALTH_STATUS_MODEL',
  'PIPELINE_DIAGNOSTICS',
  'DEPENDENCY_GRAPH',
  'OPERATOR_DASHBOARD_DATA',
  'HEALTH_REPORT',
]);

/**
 * Evaluate full pipeline health (registry + graph + diagnostics + report + dashboard).
 * @param {object} [input]
 */
function evaluatePipelineHealth(input = {}) {
  const registry =
    input.registry ||
    createPipelineHealthRegistry(
      input.stages ? { stages: input.stages } : undefined
    );
  const graph = buildPipelineDependencyGraph(registry);
  const graphValidation = validatePipelineDependencyGraph(graph, registry);
  const diagnostics = generatePipelineDiagnostics({
    registry,
    graph,
    observations: input.observations,
  });
  const report = generatePipelineHealthReport({
    registry,
    graph,
    observations: input.observations,
    lastEvaluatedAt: input.lastEvaluatedAt,
  });
  const dashboard = generatePipelineHealthDashboard({
    registry,
    graph,
    observations: input.observations,
    lastEvaluatedAt: input.lastEvaluatedAt,
  });

  return deepFreeze({
    advisoryOnly: true,
    packageId: PACKAGE_ID,
    overallHealth: report.overallHealth,
    registry,
    dependencyGraph: graph,
    graphValidation,
    diagnostics,
    report,
    dashboard,
  });
}

function getPipelineHealthAndDiagnosticsFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    advisoryOnly: true,
  });
}

function getPipelineHealthAndDiagnosticsFramework() {
  const registry = getDefaultPipelineHealthRegistry();
  const dependencyGraph = buildPipelineDependencyGraph(registry);
  const emptyEvaluation = evaluatePipelineHealth({
    registry,
    observations: [],
  });

  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    objective: OBJECTIVE,
    advisoryOnly: true,
    observabilityOnly: true,
    configurationDriven: true,
    productionSafe: true,
    program5PackageStarted: true,
    program5AutomationAuthorized: false,
    package5BReady: true,

    advisoryOnlyFlags: {
      advisoryOnly: true,
      automatesRecruitment: false,
      publishesContent: false,
      executesMonitoringJobs: false,
      automaticRecovery: false,
      executionEngine: false,
    },

    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),

    healthStatuses: VALID_HEALTH_STATUSES.slice(),
    healthStatusModel: HEALTH_STATUS,
    diagnosticTypes: DIAGNOSTIC_TYPES,
    reusedModules: REUSED_MODULE_IDS,
    defaultStageIds: PIPELINE_STAGE_IDS.slice(),

    registry,
    registryVersion: PIPELINE_HEALTH_REGISTRY_VERSION,
    dependencyGraph,
    sampleEmptyEvaluation: {
      overallHealth: emptyEvaluation.overallHealth,
      diagnosticCount: emptyEvaluation.diagnostics.diagnosticCount,
      stageCount: emptyEvaluation.registry.stageCount,
    },

    safetyBoundaries: {
      boundariesIdentity: 'SAFETY_PACKAGE_5A_PIPELINE_HEALTH',
      advisoryOnly: true,
      runtimeIntegrationDenied: true,
      featureActivationDenied: true,
      sqlSchemaRedesignDenied: true,
      databaseChangesDenied: true,
      apiCreationDenied: true,
      routeCreationDenied: true,
      schedulerDenied: true,
      workerDenied: true,
      redisDenied: true,
      pollingDenied: true,
      publishingDenied: true,
      autoApprovalDenied: true,
      aiDecisionsDenied: true,
      githubDenied: true,
      deploymentDenied: true,
      vpsDenied: true,
      productionChangesDenied: true,
      monitoringExecutionDenied: true,
      automaticProcessingDenied: true,
      hardDeniedActions: [
        'DENIED_RUNTIME_WIRING',
        'DENIED_FEATURE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_MONITORING_EXECUTION',
        'DENIED_POLLING',
        'DENIED_PUBLISHING',
        'DENIED_AUTOMATION',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_AUTO_APPROVAL',
        'DENIED_AI_DECISIONS',
        'DENIED_GITHUB',
        'DENIED_DEPLOYMENT',
        'DENIED_VPS',
        'DENIED_PRODUCTION_CHANGES',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_5A',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      pollingEnabled: false,
      publishingExecuted: false,
      monitoringJobsExecuted: false,
      filesystemWritten: false,
      networkAccessed: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
      automaticProcessingEnabled: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_5A',
      status: 'PIPELINE_HEALTH_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete advisory Pipeline Health & Diagnostics framework for operator visibility.',
      nextPackage: '5B',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      monitoringExecutionAuthorized: false,
    },

    recommendation:
      'PIPELINE_HEALTH_DIAGNOSTICS_FRAMEWORK_COMPLETE_ADVISORY_ONLY_READY_FOR_PACKAGE_5B',
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  GAP_ADDRESSED,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  HEALTH_STATUS,
  HEALTH_STATUS_RANK,
  VALID_HEALTH_STATUSES,
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_SEVERITY,
  PIPELINE_STAGE_IDS,
  REUSED_MODULE_IDS,
  createPipelineHealthRegistry,
  getDefaultPipelineHealthRegistry,
  getPipelineStage,
  listPipelineStages,
  buildStageHealthState,
  evaluateHealthStatus,
  transitionHealthStatus,
  aggregateOverallHealth,
  buildPipelineDependencyGraph,
  validatePipelineDependencyGraph,
  getUpstreamDependencies,
  getDownstreamDependents,
  generateStageDiagnostics,
  generatePipelineDiagnostics,
  generatePipelineHealthReport,
  generatePipelineHealthDashboard,
  evaluatePipelineHealth,
  getPipelineHealthAndDiagnosticsFramework,
  getPipelineHealthAndDiagnosticsFrameworkIdentity,
};
