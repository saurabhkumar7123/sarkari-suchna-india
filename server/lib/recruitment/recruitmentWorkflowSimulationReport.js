"use strict";

/**
 * Phase 137 — Recruitment Workflow Simulation Report (Advisory Only).
 *
 * Pure advisory report generator that produces a readable recruitment workflow
 * simulation report from aggregated summary outputs. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_SIMULATION_REPORT_PHASE = 137;

const RECRUITMENT_WORKFLOW_SIMULATION_REPORT_ENTITY = "recruitment_workflow_simulation_report";

const REPORT_FORMAT = Object.freeze({
  ADVISORY_TEXT: "ADVISORY_TEXT",
  STRUCTURED: "STRUCTURED",
  UNKNOWN: "UNKNOWN"
});

const REPORT_SECTION = Object.freeze({
  HEADER: "HEADER",
  SCENARIO: "SCENARIO",
  SIMULATION: "SIMULATION",
  DRY_RUN: "DRY_RUN",
  VALIDATION: "VALIDATION",
  SUMMARY: "SUMMARY",
  FOOTER: "FOOTER"
});

const SUMMARY_POSTURE = Object.freeze({
  SIMULATION_READY: "SIMULATION_READY",
  SIMULATION_BLOCKED: "SIMULATION_BLOCKED",
  SIMULATION_REVIEW_REQUIRED: "SIMULATION_REVIEW_REQUIRED",
  SIMULATION_REGRESSION: "SIMULATION_REGRESSION",
  SIMULATION_RECOVERY: "SIMULATION_RECOVERY",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_SIMULATION_REPORT_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_137",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  simulationOnly: true,
  simulationReportOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136
  ])
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {Readonly<Object>} summary
 * @returns {Readonly<Array>}
 */
function buildReportSections(summary) {
  if (!isPlainObject(summary)) {
    return Object.freeze([
      Object.freeze({
        section: REPORT_SECTION.HEADER,
        content: "Recruitment Workflow Advisory Simulation Report"
      }),
      Object.freeze({
        section: REPORT_SECTION.SUMMARY,
        content: "Report generation awaits a recognized simulation summary."
      }),
      Object.freeze({
        section: REPORT_SECTION.FOOTER,
        content: "Advisory only. No production runtime. No persistence. No side effects."
      })
    ]);
  }

  const sections = [
    Object.freeze({
      section: REPORT_SECTION.HEADER,
      content: "Recruitment Workflow Advisory Simulation Report — Phase 137"
    }),
    Object.freeze({
      section: REPORT_SECTION.SCENARIO,
      content: `Scenario: ${summary.scenarioId || "unknown"} | Recruitment ID: ${summary.recruitmentId || "none"}`
    }),
    Object.freeze({
      section: REPORT_SECTION.SIMULATION,
      content: `Simulation status: ${summary.simulationStatus || "unknown"} | Workflow state: ${summary.workflowState || "unknown"}`
    }),
    Object.freeze({
      section: REPORT_SECTION.DRY_RUN,
      content: `Dry-run status: ${summary.dryRunStatus || "unknown"} | Advisory dry-run only, no side effects.`
    }),
    Object.freeze({
      section: REPORT_SECTION.VALIDATION,
      content: `Validation status: ${summary.validationStatus || "unknown"}`
    }),
    Object.freeze({
      section: REPORT_SECTION.SUMMARY,
      content: `Summary posture: ${summary.summaryPosture || SUMMARY_POSTURE.UNKNOWN} | ${summary.simulationSummary || ""}`
    }),
    Object.freeze({
      section: REPORT_SECTION.FOOTER,
      content:
        "This report is advisory-only. Simulation did not connect to production runtime, persistence, scheduler, workers, API, publishing, or automation."
    })
  ];

  return deepFreeze(sections);
}

/**
 * @param {Readonly<Array>} sections
 * @returns {string}
 */
function buildAdvisoryText(sections) {
  if (!Array.isArray(sections)) {
    return "Advisory simulation report unavailable.";
  }

  const lines = [];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    lines.push(`[${section.section}] ${section.content}`);
  }

  return lines.join("\n");
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function generateRecruitmentWorkflowSimulationReport(input) {
  if (!isPlainObject(input)) {
    return deepFreeze({
      reportFormat: REPORT_FORMAT.UNKNOWN,
      recognized: false,
      sectionCount: 0,
      reportSections: Object.freeze([]),
      advisoryText: "Simulation report generator awaits a recognized simulation summary.",
      reportSummary: "Advisory report generation incomplete.",
      advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA
    });
  }

  const summary = input.summary || input;
  const reportSections = buildReportSections(summary);
  const advisoryText = buildAdvisoryText(reportSections);

  return deepFreeze({
    reportFormat: REPORT_FORMAT.ADVISORY_TEXT,
    recognized: isPlainObject(summary) && summary.recognized !== false,
    recruitmentId: summary.recruitmentId || null,
    scenarioId: summary.scenarioId || null,
    summaryPosture: summary.summaryPosture || SUMMARY_POSTURE.UNKNOWN,
    sectionCount: reportSections.length,
    reportSections,
    advisoryText,
    keySimulationSignals: summary.keySimulationSignals
      ? deepFreeze([...summary.keySimulationSignals])
      : Object.freeze([]),
    reportSummary: `Advisory simulation report generated with ${reportSections.length} sections for posture ${summary.summaryPosture || SUMMARY_POSTURE.UNKNOWN}.`,
    advisoryMetadata: RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_SIMULATION_REPORT_PHASE,
  RECRUITMENT_WORKFLOW_SIMULATION_REPORT_ENTITY,
  REPORT_FORMAT,
  REPORT_SECTION,
  SUMMARY_POSTURE,
  RECRUITMENT_WORKFLOW_SIMULATION_REPORT_METADATA,
  generateRecruitmentWorkflowSimulationReport
};
