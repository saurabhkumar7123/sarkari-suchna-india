'use strict';

/**
 * FT-1B — Production Readiness Report Aggregator
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const PRODUCTION_READINESS_REPORT_VERSION = 'FT1B.1.0.0';

/**
 * Build the complete FT-1B production readiness report.
 * @param {object} parts results from Parts A–I + compatibility
 */
function buildProductionReadinessReport(parts = {}) {
  const sectionSummaries = [
    {
      part: 'A',
      name: 'ENVIRONMENT_VALIDATION',
      passed: !!(parts.partA && parts.partA.allPassed),
    },
    {
      part: 'B',
      name: 'STARTUP_SHUTDOWN_READINESS',
      passed: !!(parts.partB && parts.partB.allPassed),
    },
    {
      part: 'C',
      name: 'DEPENDENCY_READINESS',
      passed: !!(parts.partC && parts.partC.allPassed),
    },
    {
      part: 'D',
      name: 'SECURITY_CONFIGURATION_REVIEW',
      passed: !!(parts.partD && parts.partD.allPassed),
    },
    {
      part: 'E',
      name: 'BACKUP_ROLLBACK_READINESS',
      passed: !!(parts.partE && parts.partE.allPassed),
    },
    {
      part: 'F',
      name: 'OBSERVABILITY_READINESS',
      passed: !!(parts.partF && parts.partF.allPassed),
    },
    {
      part: 'G',
      name: 'PERFORMANCE_BASELINE',
      passed: !!(parts.partG && parts.partG.allPassed),
    },
    {
      part: 'H',
      name: 'RELEASE_READINESS_CHECKLIST',
      passed: !!(parts.partH && parts.partH.allPassed),
    },
    {
      part: 'I',
      name: 'GO_NO_GO_ASSESSMENT',
      passed: !!(parts.partI && parts.partI.allPassed),
    },
  ];

  const allPassed = sectionSummaries.every((s) => s.passed === true);
  const decision =
    (parts.partI && parts.partI.decision) || 'GO_WITH_CONDITIONS';

  return deepFreeze({
    reportVersion: PRODUCTION_READINESS_REPORT_VERSION,
    reportId: 'FT1B_PRODUCTION_READINESS_REPORT',
    packageCode: 'FT-1B',
    packageName: 'Production Readiness Framework',
    advisoryOnly: true,
    productionActivated: false,
    newBusinessFeaturesAdded: false,
    generatedAt:
      typeof parts.generatedAt === 'string'
        ? parts.generatedAt
        : new Date().toISOString(),
    sectionSummaries,
    allPassed,
    decision,
    eligibleForDep1: !!(parts.partI && parts.partI.eligibleForDep1),
    deliverables: {
      productionReadinessReport: true,
      environmentValidationReport: !!(parts.partA && parts.partA.reportId),
      releaseReadinessChecklist: !!(parts.partH && parts.partH.reportId),
      goNoGoAssessment: !!(parts.partI && parts.partI.reportId),
      program678CompatibilityReport: !!(
        parts.programCompatibility && parts.programCompatibility.reportId
      ),
    },
    confirmations: {
      environmentValidated: !!(parts.partA && parts.partA.allPassed),
      lifecycleReviewed: !!(parts.partB && parts.partB.allPassed),
      dependenciesAudited: !!(parts.partC && parts.partC.allPassed),
      securityReviewed: !!(parts.partD && parts.partD.allPassed),
      backupRollbackAssessed: !!(parts.partE && parts.partE.allPassed),
      observabilityReady: !!(parts.partF && parts.partF.allPassed),
      performanceBaselineRecorded: !!(parts.partG && parts.partG.allPassed),
      releaseChecklistComplete: !!(parts.partH && parts.partH.allPassed),
      goNoGoCompleted: !!(parts.partI && parts.partI.allPassed),
      programs678Compatible: !!(
        parts.programCompatibility && parts.programCompatibility.allPassed
      ),
      priorsUnchanged: !!(parts.regression && parts.regression.allPassed),
      ft1aUnchanged: !!(parts.ft1a && parts.ft1a.allPassed !== false),
      productionRemainsInactive: true,
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
      programCompatibility: parts.programCompatibility || null,
      regression: parts.regression || null,
      ft1a: parts.ft1a || null,
    },
    nextPackage: 'DEP-1',
    nextPackageName: 'Controlled Deployment',
    recommendation:
      decision === 'NO_GO'
        ? 'FT1B_NO_GO_RESOLVE_BLOCKING_ISSUES_BEFORE_DEP1'
        : 'FT1B_GO_WITH_CONDITIONS_ELIGIBLE_FOR_DEP1_REQUIRES_OPERATOR_AUTHORIZATION_NO_PRODUCTION_ACTIVATION',
  });
}

module.exports = {
  PRODUCTION_READINESS_REPORT_VERSION,
  buildProductionReadinessReport,
};
