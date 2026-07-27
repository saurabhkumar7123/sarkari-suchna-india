"use strict";

/**
 * Phase AI-5 — End-to-End Production Validation & Operational Readiness.
 *
 * Public facade. Advisory validation only: does not publish, does not modify
 * Production Workflow, Generator UI, Monitoring, scheduler, deployment config,
 * or database schema, and never enables AUTO_PUBLISH.
 */

const types = require("./types");
const diagnostics = require("./diagnostics");
const performance = require("./performance");
const pipelineRunner = require("./pipelineRunner");
const suite = require("./suite");
const compatibility = require("./compatibility");
const readiness = require("./readiness");
const report = require("./report");
const diagrams = require("./diagrams");

/**
 * Convenience: run scenarios + failures + compatibility → full operational report.
 * @param {{
 *   scenarios: object[],
 *   failures: object[],
 *   now?: Date
 * }} input
 * @returns {object}
 */
function runFullValidation(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  const scenarioSuite = suite.runScenarioSuite(input.scenarios || [], { now });
  const failureSuite = suite.runFailureSuite(input.failures || [], { now });
  const compatibilityReport = compatibility.checkBackwardCompatibility();
  const operationalReport = report.buildOperationalReport({
    scenarioSuite,
    failureSuite,
    compatibility: compatibilityReport,
    now
  });
  const scenarioOutputs = report.buildScenarioOutputDigest(scenarioSuite.runs);

  return {
    scenarioSuite,
    failureSuite,
    compatibility: compatibilityReport,
    operationalReport,
    scenarioOutputs,
    diagrams: diagrams.renderPipelineDiagrams()
  };
}

module.exports = {
  ...types,
  ...diagnostics,
  ...performance,
  ...pipelineRunner,
  ...suite,
  ...compatibility,
  ...readiness,
  ...report,
  ...diagrams,
  runFullValidation
};
