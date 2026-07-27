'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Health Report (Advisory Only)
 *
 * Reusable report covering overall health, stage buckets,
 * missing prerequisites, and recommendations.
 */

const {
  HEALTH_STATUS,
  buildStageHealthState,
  evaluateHealthStatus,
  aggregateOverallHealth,
} = require('./pipelineHealthStatusModel');
const { getDefaultPipelineHealthRegistry } = require('./pipelineHealthRegistry');
const { generatePipelineDiagnostics } = require('./pipelineDiagnostics');
const { buildPipelineDependencyGraph } = require('./pipelineDependencyGraph');

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

function buildRecommendations(overallHealth, diagnostics, stageStates) {
  const recommendations = [];

  if (overallHealth === HEALTH_STATUS.UNKNOWN) {
    recommendations.push({
      code: 'PROVIDE_STAGE_OBSERVATIONS',
      priority: 'HIGH',
      message:
        'Supply stage observations so pipeline health can be evaluated beyond UNKNOWN.',
    });
  }

  if (diagnostics.summary.missingPrerequisiteCount > 0) {
    recommendations.push({
      code: 'RESOLVE_MISSING_PREREQUISITES',
      priority: 'HIGH',
      message:
        'Review and satisfy missing prerequisites listed in the diagnostics summary.',
    });
  }

  if (diagnostics.summary.configurationProblemCount > 0) {
    recommendations.push({
      code: 'FIX_CONFIGURATION_PROBLEMS',
      priority: 'HIGH',
      message:
        'Address configuration problems before considering further pipeline progression.',
    });
  }

  if (diagnostics.summary.dependencyIssueCount > 0) {
    recommendations.push({
      code: 'REVIEW_UPSTREAM_DEPENDENCIES',
      priority: 'HIGH',
      message:
        'Inspect upstream dependency issues; downstream stages remain advisory-blocked.',
    });
  }

  if (diagnostics.summary.validationFailureCount > 0) {
    recommendations.push({
      code: 'ADDRESS_VALIDATION_FAILURES',
      priority: 'MEDIUM',
      message:
        'Resolve validation failures using existing Program 4 review and SEO diagnostic surfaces.',
    });
  }

  if (diagnostics.summary.stageWarningCount > 0) {
    recommendations.push({
      code: 'TRIAGE_STAGE_WARNINGS',
      priority: 'MEDIUM',
      message: 'Triage stage warnings; they are informational and non-activating.',
    });
  }

  const blocked = stageStates.filter((s) => s.status === HEALTH_STATUS.BLOCKED);
  if (blocked.length > 0) {
    recommendations.push({
      code: 'UNBLOCK_STAGES_MANUALLY',
      priority: 'HIGH',
      message:
        'Blocked stages require manual operator action — no automatic recovery is performed.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      code: 'CONTINUE_ADVISORY_MONITORING',
      priority: 'LOW',
      message:
        'Pipeline health is advisory-healthy. Continue read-only observation; no automation is activated.',
    });
  }

  recommendations.push({
    code: 'PACKAGE_5A_ADVISORY_ONLY',
    priority: 'INFO',
    message:
      'Package 5A remains advisory-only. No monitoring execution, publishing, or automation is authorized.',
  });

  return recommendations;
}

/**
 * Generate a reusable Pipeline Health Report.
 * @param {object} [input]
 */
function generatePipelineHealthReport(input = {}) {
  const registry = input.registry || getDefaultPipelineHealthRegistry();
  const graph = input.graph || buildPipelineDependencyGraph(registry);
  const observations = Array.isArray(input.observations)
    ? input.observations
    : [];
  const lastEvaluatedAt =
    typeof input.lastEvaluatedAt === 'string' && input.lastEvaluatedAt.trim()
      ? input.lastEvaluatedAt.trim()
      : null;

  const observationById = {};
  for (let i = 0; i < observations.length; i += 1) {
    const obs = observations[i];
    if (obs && typeof obs.stageId === 'string') {
      observationById[obs.stageId] = obs;
    }
  }

  const diagnostics = generatePipelineDiagnostics({
    registry,
    graph,
    observations,
  });

  const stageStates = [];
  for (let i = 0; i < registry.stages.length; i += 1) {
    const stage = registry.stages[i];
    const obs = observationById[stage.stageId] || { stageId: stage.stageId };
    const stageDiag = diagnostics.stages.find((s) => s.stageId === stage.stageId);
    const status =
      (stageDiag && stageDiag.status) || evaluateHealthStatus(obs);
    const notes = [];
    if (stageDiag) {
      for (let j = 0; j < stageDiag.diagnostics.length; j += 1) {
        notes.push(stageDiag.diagnostics[j].message);
      }
    }

    stageStates.push(
      buildStageHealthState({
        stageId: stage.stageId,
        status,
        summary: stage.summary,
        lastEvaluatedAt:
          (typeof obs.lastEvaluatedAt === 'string' && obs.lastEvaluatedAt) ||
          lastEvaluatedAt,
        advisoryNotes: notes,
      })
    );
  }

  const overallHealth = aggregateOverallHealth(stageStates);

  const healthyStages = stageStates.filter(
    (s) => s.status === HEALTH_STATUS.HEALTHY
  );
  const warningStages = stageStates.filter(
    (s) => s.status === HEALTH_STATUS.WARNING
  );
  const degradedStages = stageStates.filter(
    (s) => s.status === HEALTH_STATUS.DEGRADED
  );
  const blockedStages = stageStates.filter(
    (s) => s.status === HEALTH_STATUS.BLOCKED
  );
  const unknownStages = stageStates.filter(
    (s) => s.status === HEALTH_STATUS.UNKNOWN
  );

  const missingPrerequisites = diagnostics.byType.missingPrerequisites.map(
    (d) => ({
      stageId: d.stageId,
      detail: d.detail,
      message: d.message,
    })
  );

  const recommendations = buildRecommendations(
    overallHealth,
    diagnostics,
    stageStates
  );

  return deepFreeze({
    reportId: 'PIPELINE_HEALTH_REPORT',
    packageId: 'PACKAGE_5A_PIPELINE_HEALTH_AND_DIAGNOSTICS',
    advisoryOnly: true,
    automaticRecovery: false,
    monitoringExecution: false,
    publishing: false,
    automation: false,
    lastEvaluatedAt,
    overallHealth,
    stages: stageStates,
    healthyStages: healthyStages.map((s) => s.stageId),
    warningStages: warningStages.map((s) => s.stageId),
    degradedStages: degradedStages.map((s) => s.stageId),
    blockedStages: blockedStages.map((s) => s.stageId),
    unknownStages: unknownStages.map((s) => s.stageId),
    counts: {
      total: stageStates.length,
      healthy: healthyStages.length,
      warning: warningStages.length,
      degraded: degradedStages.length,
      blocked: blockedStages.length,
      unknown: unknownStages.length,
    },
    missingPrerequisites,
    diagnosticsSummary: diagnostics.summary,
    recommendations,
    dependencyGraphSummary: graph.summary,
  });
}

module.exports = {
  generatePipelineHealthReport,
};
