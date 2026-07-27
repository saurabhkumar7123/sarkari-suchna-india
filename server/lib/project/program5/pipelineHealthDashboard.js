'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Health Operator Dashboard (Read-Only / Advisory)
 *
 * Generates dashboard data for operators:
 * - Pipeline stages
 * - Health status
 * - Dependency graph summary
 * - Diagnostics summary
 * - Advisory recommendations
 *
 * Read-only. No routes wired. No feature activation.
 * Reuses Admin Dashboard as the conceptual operator surface identity only.
 */

const { getDefaultPipelineHealthRegistry } = require('./pipelineHealthRegistry');
const { buildPipelineDependencyGraph } = require('./pipelineDependencyGraph');
const { generatePipelineHealthReport } = require('./pipelineHealthReport');
const { HEALTH_STATUS } = require('./pipelineHealthStatusModel');

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

/**
 * Generate read-only Pipeline Health dashboard data.
 * @param {object} [input]
 */
function generatePipelineHealthDashboard(input = {}) {
  const registry = input.registry || getDefaultPipelineHealthRegistry();
  const graph = input.graph || buildPipelineDependencyGraph(registry);
  const report = generatePipelineHealthReport({
    registry,
    graph,
    observations: input.observations,
    lastEvaluatedAt: input.lastEvaluatedAt,
  });

  const stageRows = report.stages.map((state) => {
    const meta = registry.byId[state.stageId] || {};
    return {
      stageId: state.stageId,
      name: meta.name || state.stageId,
      order: meta.order || 0,
      status: state.status,
      summary: state.summary,
      lastEvaluatedAt: state.lastEvaluatedAt,
      advisoryNotes: state.advisoryNotes,
      reusedModules: meta.reusedModules || [],
      dependsOn: meta.dependsOn || [],
    };
  });

  const statusLegend = [
    { status: HEALTH_STATUS.HEALTHY, meaning: 'Stage operating within advisory expectations.' },
    { status: HEALTH_STATUS.WARNING, meaning: 'Non-blocking advisory warnings present.' },
    { status: HEALTH_STATUS.DEGRADED, meaning: 'Validation or configuration issues reduce confidence.' },
    { status: HEALTH_STATUS.BLOCKED, meaning: 'Prerequisites or dependencies prevent progress.' },
    { status: HEALTH_STATUS.UNKNOWN, meaning: 'Insufficient observations to evaluate.' },
  ];

  return deepFreeze({
    dashboardId: 'PIPELINE_HEALTH_OPERATOR_DASHBOARD',
    title: 'Pipeline Health & Diagnostics',
    packageId: 'PACKAGE_5A_PIPELINE_HEALTH_AND_DIAGNOSTICS',
    operatorSurface: 'ADMIN_DASHBOARD',
    readOnly: true,
    advisoryOnly: true,
    runtimeWired: false,
    featureActivated: false,
    polling: false,
    monitoringExecution: false,
    overallHealth: report.overallHealth,
    lastEvaluatedAt: report.lastEvaluatedAt,
    pipelineStages: stageRows,
    healthStatus: {
      overall: report.overallHealth,
      counts: report.counts,
      legend: statusLegend,
    },
    dependencyGraphSummary: {
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      highlightedDependencies: graph.summary.highlightedDependencies,
      rootStages: graph.summary.rootStages,
      leafStages: graph.summary.leafStages,
      description: graph.summary.description,
    },
    diagnosticsSummary: report.diagnosticsSummary,
    advisoryRecommendations: report.recommendations,
    quickLinks: [
      {
        id: 'LINK_RECRUITMENT_OPERATIONS',
        label: 'Recruitment Operations',
        moduleId: 'RECRUITMENT_OPERATIONS',
        pathHint: '/admin/recruitments',
      },
      {
        id: 'LINK_EDITORIAL_REVIEW',
        label: 'Editorial Review',
        moduleId: 'EDITORIAL_REVIEW',
        pathHint: '/admin/editorial-review',
      },
      {
        id: 'LINK_SHARED_PREVIEW',
        label: 'Shared Preview',
        moduleId: 'SHARED_PREVIEW',
        pathHint: '/admin/recruitment-runtime-preview',
      },
      {
        id: 'LINK_SEO_DIAGNOSTICS',
        label: 'SEO Diagnostics',
        moduleId: 'SEO_DIAGNOSTICS',
        pathHint: '/admin/seo-diagnostics',
      },
      {
        id: 'LINK_ADMIN_DASHBOARD',
        label: 'Admin Dashboard',
        moduleId: 'ADMIN_DASHBOARD',
        pathHint: '/admin/dashboard',
      },
    ],
    safety: {
      automation: false,
      publishing: false,
      autoApproval: false,
      aiDecisions: false,
      schedulers: false,
      workers: false,
      redis: false,
    },
  });
}

module.exports = {
  generatePipelineHealthDashboard,
};
