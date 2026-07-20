'use strict';

/**
 * Package 5A — Product-side Pipeline Health facade (advisory only).
 *
 * Thin re-export / composition layer over the Program 5 Package 5A
 * governance framework. Keeps product code able to build reports and
 * dashboard data without wiring routes or activating features.
 *
 * No automation. No monitoring execution. No publishing.
 */

const path = require("path");

// Load governance framework from monorepo root (Programs 1–5 advisory tree).
const frameworkPath = path.resolve(
  __dirname,
  "../../../../../server/lib/project/program5/package5APipelineHealthAndDiagnosticsFramework.js"
);

const framework = require(frameworkPath);
const {
  buildPipelineHealthObservationsFromProgram4,
} = require("./pipelineHealthObservations");

/**
 * Build full advisory pipeline health evaluation from Program 4 inputs.
 * @param {object} [input]
 */
function evaluateProductPipelineHealth(input = {}) {
  const observations =
    Array.isArray(input.observations) && input.observations.length
      ? input.observations
      : buildPipelineHealthObservationsFromProgram4(input);

  return framework.evaluatePipelineHealth({
    observations,
    lastEvaluatedAt: input.lastEvaluatedAt || null,
    stages: input.stages,
  });
}

/**
 * @param {object} [input]
 */
function generateProductPipelineHealthReport(input = {}) {
  const evaluation = evaluateProductPipelineHealth(input);
  return evaluation.report;
}

/**
 * @param {object} [input]
 */
function generateProductPipelineHealthDashboard(input = {}) {
  const evaluation = evaluateProductPipelineHealth(input);
  return evaluation.dashboard;
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  HEALTH_STATUS: framework.HEALTH_STATUS,
  buildPipelineHealthObservationsFromProgram4,
  evaluateProductPipelineHealth,
  generateProductPipelineHealthReport,
  generateProductPipelineHealthDashboard,
  // Pass-throughs for direct use
  createPipelineHealthRegistry: framework.createPipelineHealthRegistry,
  getDefaultPipelineHealthRegistry: framework.getDefaultPipelineHealthRegistry,
  buildPipelineDependencyGraph: framework.buildPipelineDependencyGraph,
  validatePipelineDependencyGraph: framework.validatePipelineDependencyGraph,
  generatePipelineDiagnostics: framework.generatePipelineDiagnostics,
  generatePipelineHealthReport: framework.generatePipelineHealthReport,
  generatePipelineHealthDashboard: framework.generatePipelineHealthDashboard,
  evaluatePipelineHealth: framework.evaluatePipelineHealth,
  getPipelineHealthAndDiagnosticsFramework:
    framework.getPipelineHealthAndDiagnosticsFramework,
  transitionHealthStatus: framework.transitionHealthStatus,
};
