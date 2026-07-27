'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Diagnostics (Informational / Advisory Only)
 *
 * Describes missing prerequisites, configuration problems, dependency
 * issues, validation failures, and stage warnings.
 * Informational only — no automatic remediation.
 */

const { evaluateHealthStatus, HEALTH_STATUS } = require('./pipelineHealthStatusModel');
const {
  getDefaultPipelineHealthRegistry,
  getPipelineStage,
} = require('./pipelineHealthRegistry');
const {
  buildPipelineDependencyGraph,
  getUpstreamDependencies,
} = require('./pipelineDependencyGraph');

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const DIAGNOSTIC_TYPES = Object.freeze({
  MISSING_PREREQUISITE: 'MISSING_PREREQUISITE',
  CONFIGURATION_PROBLEM: 'CONFIGURATION_PROBLEM',
  DEPENDENCY_ISSUE: 'DEPENDENCY_ISSUE',
  VALIDATION_FAILURE: 'VALIDATION_FAILURE',
  STAGE_WARNING: 'STAGE_WARNING',
});

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === 'string' && value[i].trim()) {
      out.push(value[i].trim());
    } else if (value[i] && typeof value[i] === 'object') {
      const code =
        (typeof value[i].code === 'string' && value[i].code) ||
        (typeof value[i].id === 'string' && value[i].id) ||
        (typeof value[i].message === 'string' && value[i].message) ||
        '';
      if (code.trim()) out.push(code.trim());
    }
  }
  return out;
}

function pushDiagnostic(list, diagnostic) {
  list.push({
    diagnosticId: diagnostic.diagnosticId,
    type: diagnostic.type,
    severity: diagnostic.severity,
    stageId: diagnostic.stageId,
    message: diagnostic.message,
    detail: diagnostic.detail || null,
    informationalOnly: true,
    autoRemediation: false,
  });
}

/**
 * Generate informational diagnostics for one stage observation.
 * @param {object} observation
 * @param {object} [context]
 */
function generateStageDiagnostics(observation = {}, context = {}) {
  const registry = context.registry || getDefaultPipelineHealthRegistry();
  const graph = context.graph || buildPipelineDependencyGraph(registry);
  const stageId =
    typeof observation.stageId === 'string' && observation.stageId.trim()
      ? observation.stageId.trim()
      : 'UNKNOWN_STAGE';

  const diagnostics = [];
  const stage = getPipelineStage(registry, stageId);

  const missingPrerequisites = asStringList(observation.missingPrerequisites);
  if (stage && Array.isArray(stage.prerequisiteHints)) {
    const satisfied = new Set(asStringList(observation.satisfiedPrerequisites));
    for (let i = 0; i < stage.prerequisiteHints.length; i += 1) {
      const hint = stage.prerequisiteHints[i];
      if (!satisfied.has(hint) && observation.assumePrerequisitesMet !== true) {
        if (
          missingPrerequisites.indexOf(hint) === -1 &&
          observation.evaluated !== true &&
          observation.healthy !== true &&
          observation.ok !== true
        ) {
          // Only emit config-hint missing prerequisites when explicitly flagged or unknown.
          if (
            observation.reportPrerequisiteHints === true ||
            missingPrerequisites.length > 0
          ) {
            missingPrerequisites.push(hint);
          }
        }
      }
    }
  }

  for (let i = 0; i < missingPrerequisites.length; i += 1) {
    pushDiagnostic(diagnostics, {
      diagnosticId: `${stageId}_MISSING_PREREQUISITE_${i + 1}`,
      type: DIAGNOSTIC_TYPES.MISSING_PREREQUISITE,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      stageId,
      message: `Missing prerequisite: ${missingPrerequisites[i]}`,
      detail: missingPrerequisites[i],
    });
  }

  const configurationProblems = asStringList(observation.configurationProblems);
  for (let i = 0; i < configurationProblems.length; i += 1) {
    pushDiagnostic(diagnostics, {
      diagnosticId: `${stageId}_CONFIGURATION_PROBLEM_${i + 1}`,
      type: DIAGNOSTIC_TYPES.CONFIGURATION_PROBLEM,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      stageId,
      message: `Configuration problem: ${configurationProblems[i]}`,
      detail: configurationProblems[i],
    });
  }

  const dependencyIssues = asStringList(observation.dependencyIssues);
  const upstream = getUpstreamDependencies(graph, stageId);
  const upstreamHealth = context.upstreamHealth || {};
  for (let i = 0; i < upstream.length; i += 1) {
    const upId = upstream[i];
    const upStatus = upstreamHealth[upId];
    if (
      upStatus === HEALTH_STATUS.BLOCKED ||
      upStatus === HEALTH_STATUS.DEGRADED
    ) {
      dependencyIssues.push(`UPSTREAM_${upId}_${upStatus}`);
    }
  }

  const uniqueDeps = [];
  for (let i = 0; i < dependencyIssues.length; i += 1) {
    if (uniqueDeps.indexOf(dependencyIssues[i]) === -1) {
      uniqueDeps.push(dependencyIssues[i]);
    }
  }

  for (let i = 0; i < uniqueDeps.length; i += 1) {
    pushDiagnostic(diagnostics, {
      diagnosticId: `${stageId}_DEPENDENCY_ISSUE_${i + 1}`,
      type: DIAGNOSTIC_TYPES.DEPENDENCY_ISSUE,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      stageId,
      message: `Dependency issue: ${uniqueDeps[i]}`,
      detail: uniqueDeps[i],
    });
  }

  const validationFailures = asStringList(observation.validationFailures);
  for (let i = 0; i < validationFailures.length; i += 1) {
    pushDiagnostic(diagnostics, {
      diagnosticId: `${stageId}_VALIDATION_FAILURE_${i + 1}`,
      type: DIAGNOSTIC_TYPES.VALIDATION_FAILURE,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      stageId,
      message: `Validation failure: ${validationFailures[i]}`,
      detail: validationFailures[i],
    });
  }

  const warnings = asStringList(observation.warnings);
  for (let i = 0; i < warnings.length; i += 1) {
    pushDiagnostic(diagnostics, {
      diagnosticId: `${stageId}_STAGE_WARNING_${i + 1}`,
      type: DIAGNOSTIC_TYPES.STAGE_WARNING,
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      stageId,
      message: `Stage warning: ${warnings[i]}`,
      detail: warnings[i],
    });
  }

  const status = evaluateHealthStatus({
    ...observation,
    missingPrerequisites,
    dependencyIssues: uniqueDeps,
    configurationProblems,
    validationFailures,
    warnings,
  });

  return deepFreeze({
    stageId,
    status,
    advisoryOnly: true,
    informationalOnly: true,
    autoRemediation: false,
    diagnosticCount: diagnostics.length,
    diagnostics,
    summary: {
      missingPrerequisites: missingPrerequisites.slice(),
      configurationProblems: configurationProblems.slice(),
      dependencyIssues: uniqueDeps.slice(),
      validationFailures: validationFailures.slice(),
      stageWarnings: warnings.slice(),
    },
  });
}

/**
 * Generate diagnostics across all observed stages.
 * @param {object} input
 */
function generatePipelineDiagnostics(input = {}) {
  const registry = input.registry || getDefaultPipelineHealthRegistry();
  const graph = input.graph || buildPipelineDependencyGraph(registry);
  const observations = Array.isArray(input.observations)
    ? input.observations
    : [];

  const observationById = {};
  for (let i = 0; i < observations.length; i += 1) {
    const obs = observations[i];
    if (obs && typeof obs.stageId === 'string') {
      observationById[obs.stageId] = obs;
    }
  }

  // First pass: evaluate raw statuses for upstream context.
  const upstreamHealth = {};
  for (let i = 0; i < registry.stages.length; i += 1) {
    const stage = registry.stages[i];
    const obs = observationById[stage.stageId] || { stageId: stage.stageId };
    upstreamHealth[stage.stageId] = evaluateHealthStatus(obs);
  }

  const stageDiagnostics = [];
  const allDiagnostics = [];

  for (let i = 0; i < registry.stages.length; i += 1) {
    const stage = registry.stages[i];
    const obs = observationById[stage.stageId] || { stageId: stage.stageId };
    const result = generateStageDiagnostics(obs, {
      registry,
      graph,
      upstreamHealth,
    });
    stageDiagnostics.push(result);
    for (let j = 0; j < result.diagnostics.length; j += 1) {
      allDiagnostics.push(result.diagnostics[j]);
    }
  }

  const byType = {
    missingPrerequisites: allDiagnostics.filter(
      (d) => d.type === DIAGNOSTIC_TYPES.MISSING_PREREQUISITE
    ),
    configurationProblems: allDiagnostics.filter(
      (d) => d.type === DIAGNOSTIC_TYPES.CONFIGURATION_PROBLEM
    ),
    dependencyIssues: allDiagnostics.filter(
      (d) => d.type === DIAGNOSTIC_TYPES.DEPENDENCY_ISSUE
    ),
    validationFailures: allDiagnostics.filter(
      (d) => d.type === DIAGNOSTIC_TYPES.VALIDATION_FAILURE
    ),
    stageWarnings: allDiagnostics.filter(
      (d) => d.type === DIAGNOSTIC_TYPES.STAGE_WARNING
    ),
  };

  return deepFreeze({
    advisoryOnly: true,
    informationalOnly: true,
    autoRemediation: false,
    monitoringExecution: false,
    stageCount: stageDiagnostics.length,
    diagnosticCount: allDiagnostics.length,
    stages: stageDiagnostics,
    diagnostics: allDiagnostics,
    byType,
    summary: {
      missingPrerequisiteCount: byType.missingPrerequisites.length,
      configurationProblemCount: byType.configurationProblems.length,
      dependencyIssueCount: byType.dependencyIssues.length,
      validationFailureCount: byType.validationFailures.length,
      stageWarningCount: byType.stageWarnings.length,
    },
  });
}

module.exports = {
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_SEVERITY,
  generateStageDiagnostics,
  generatePipelineDiagnostics,
};
