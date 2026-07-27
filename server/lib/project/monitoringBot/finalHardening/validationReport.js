'use strict';

/**
 * FT-1A — Validation Report Aggregator
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const VALIDATION_REPORT_VERSION = 'FT1A.1.0.0';

/**
 * Build the complete FT-1A system validation report.
 * @param {object} parts results from Parts A–I
 */
function buildSystemValidationReport(parts = {}) {
  const sectionSummaries = [
    {
      part: 'A',
      name: 'END_TO_END_VALIDATION',
      passed: !!(parts.partA && parts.partA.allPassed),
    },
    {
      part: 'B',
      name: 'REGRESSION',
      passed: !!(parts.partB && parts.partB.allPassed),
    },
    {
      part: 'C',
      name: 'SCHEDULER_VALIDATION',
      passed: !!(parts.partC && parts.partC.allPassed),
    },
    {
      part: 'D',
      name: 'TELEGRAM_VALIDATION',
      passed: !!(parts.partD && parts.partD.allPassed),
    },
    {
      part: 'E',
      name: 'REVIEW_VALIDATION',
      passed: !!(parts.partE && parts.partE.allPassed),
    },
    {
      part: 'F',
      name: 'SOURCE_VALIDATION',
      passed: !!(parts.partF && parts.partF.allPassed),
    },
    {
      part: 'G',
      name: 'CONFIGURATION_AUDIT',
      passed: !!(parts.partG && parts.partG.allPassed),
    },
    {
      part: 'H',
      name: 'FAILURE_INJECTION',
      passed: !!(parts.partH && parts.partH.allPassed),
    },
    {
      part: 'I',
      name: 'OPEN_HANDLE_VALIDATION',
      passed: !!(parts.partI && parts.partI.allPassed !== false),
    },
  ];

  const allPassed = sectionSummaries.every((s) => s.passed === true);

  return deepFreeze({
    reportVersion: VALIDATION_REPORT_VERSION,
    reportId: 'FT1A_SYSTEM_VALIDATION_HARDENING_REPORT',
    packageCode: 'FT-1A',
    packageName: 'System Validation & Hardening Framework',
    advisoryOnly: true,
    productionActivated: false,
    generatedAt:
      typeof parts.generatedAt === 'string'
        ? parts.generatedAt
        : new Date().toISOString(),
    sectionSummaries,
    allPassed,
    confirmations: {
      operationalWorkflowValidated: !!(parts.partA && parts.partA.allPassed),
      regressionsAbsent: !!(parts.partB && parts.partB.allPassed),
      schedulerSafe: !!(parts.partC && parts.partC.allPassed),
      telegramSafe: !!(parts.partD && parts.partD.allPassed),
      reviewWorkflowValidated: !!(parts.partE && parts.partE.allPassed),
      configurationConsistent: !!(parts.partG && parts.partG.allPassed),
      onlyApprovedGovernmentSourcesActive: !!(
        parts.partF && parts.partF.allPassed
      ),
      thirdPartyPrivateMonitoringDisabled: !!(
        parts.partF &&
        parts.partF.checks &&
        parts.partF.checks.some(
          (c) =>
            c.checkId === 'THIRD_PARTY_PRIVATE_MONITORING_DISABLED' &&
            c.passed
        )
      ),
      readyForFT1BProductionReadiness: allPassed,
    },
    parts: {
      A: parts.partA || null,
      B: parts.partB || null,
      C: parts.partC || null,
      D: parts.partD || null,
      E: parts.partE || null,
      F: parts.partF || null,
      G: parts.partG || null,
      H: parts.partH || null,
      I: parts.partI || null,
    },
    nextPackage: 'FT-1B',
    nextPackageName: 'Production Readiness',
    recommendation: allPassed
      ? 'FT1A_COMPLETE_SYSTEM_VALIDATED_READY_FOR_FT1B_NO_PRODUCTION_ACTIVATION'
      : 'FT1A_VALIDATION_INCOMPLETE_RESOLVE_FAILING_PARTS_BEFORE_FT1B',
  });
}

module.exports = {
  VALIDATION_REPORT_VERSION,
  buildSystemValidationReport,
};
