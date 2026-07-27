'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Final Governance Report (Advisory Only)
 *
 * Generates Program 5 completion summary and controlled implementation
 * readiness assessment.
 *
 * Deployment recommendation MUST always remain: NOT AUTHORIZED
 * unless explicitly changed in a future deployment program.
 */

const { deepFreeze, REUSED_MODULE_IDS } = require('./publishReadinessContract');
const { OVERALL_STATUS } = require('./finalReadinessEvaluator');

const FINAL_GOVERNANCE_REPORT_VERSION = '5F.1.0.0';

const DEPLOYMENT_RECOMMENDATION = Object.freeze({
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
});

/**
 * Generate the final Program 5 governance report.
 *
 * @param {object} [input]
 * @param {object} [input.finalEvaluation]
 * @param {object} [input.gateEvaluation]
 * @param {object} [input.readinessModel]
 * @param {object} [input.panel]
 * @param {object} [input.rollbackReadiness]
 * @param {object} [input.backupReadiness]
 * @param {object} [input.pipelineSummary]
 * @param {object} [input.lifecycleSummary]
 * @param {object} [input.draftSummary]
 * @param {object} [input.resolutionSummary]
 * @param {object[]} [input.outstandingRisks]
 * @param {string} [input.generatedAt]
 */
function generateFinalGovernanceReport(input = {}) {
  const finalEvaluation = input.finalEvaluation || {
    overallStatus: OVERALL_STATUS.NOT_READY,
    blockingIssues: [],
    remainingPrerequisites: [],
    recommendedActions: [],
    summary: {},
  };
  const gateEvaluation = input.gateEvaluation || {
    passCount: 0,
    warningCount: 0,
    blockedCount: 0,
  };
  const readinessModel = input.readinessModel || null;
  const panel = input.panel || null;
  const rollback = input.rollbackReadiness || null;
  const backup = input.backupReadiness || null;

  const outstandingRisks = Array.isArray(input.outstandingRisks)
    ? input.outstandingRisks.slice()
    : (readinessModel && readinessModel.outstandingRisks) || [];

  const pipelineSummary = input.pipelineSummary || {
    reusedModule: REUSED_MODULE_IDS.PIPELINE_HEALTH,
    status: 'EVALUATED_VIA_AUTHORIZATION_GATE',
    advisoryOnly: true,
  };
  const lifecycleSummary = input.lifecycleSummary || {
    reusedModule: REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE,
    status: 'EVALUATED_VIA_AUTHORIZATION_GATE',
    advisoryOnly: true,
  };
  const draftSummary = input.draftSummary || {
    reusedModule: REUSED_MODULE_IDS.DRAFT_PREPARATION,
    status: 'EVALUATED_VIA_AUTHORIZATION_GATE',
    advisoryOnly: true,
  };
  const resolutionSummary = input.resolutionSummary || {
    reusedModule: REUSED_MODULE_IDS.CANDIDATE_RESOLUTION,
    status: 'EVALUATED_VIA_AUTHORIZATION_GATE',
    advisoryOnly: true,
  };

  const readinessSummary = {
    overallStatus: finalEvaluation.overallStatus,
    readinessScore: panel ? panel.readinessScore : null,
    gatePassCount: Number(gateEvaluation.passCount) || 0,
    gateWarningCount: Number(gateEvaluation.warningCount) || 0,
    gateBlockedCount: Number(gateEvaluation.blockedCount) || 0,
    rollbackReady: rollback ? Boolean(rollback.ready) : false,
    backupReady: backup ? Boolean(backup.ready) : false,
    authorizationStatus:
      readinessModel && readinessModel.authorizationStatus
        ? readinessModel.authorizationStatus
        : 'NOT_AUTHORIZED',
  };

  return deepFreeze({
    reportId: 'FINAL_GOVERNANCE_REPORT_PROGRAM_5',
    reportVersion: FINAL_GOVERNANCE_REPORT_VERSION,
    packageId: 'PACKAGE_5F_CONTROLLED_PUBLISH_READINESS_AUTHORIZATION',
    packageCode: '5F',
    advisoryOnly: true,
    readOnly: true,
    generatedAt:
      typeof input.generatedAt === 'string' && input.generatedAt.trim()
        ? input.generatedAt.trim()
        : '1970-01-01T00:00:00.000Z',

    program5CompletionSummary: {
      programId: 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING',
      status: 'PROGRAM_5_COMPLETE',
      packagesCompleted: ['5A', '5B', '5C', '5D', '5E', '5F'],
      automationAuthorized: false,
      publishingAuthorized: false,
      deploymentAuthorized: false,
      runtimeActivated: false,
      purpose:
        'Program 5 delivered advisory controlled automation wiring frameworks culminating in publish readiness authorization assessment.',
    },

    pipelineSummary,
    lifecycleSummary,
    draftSummary,
    resolutionSummary,
    readinessSummary,

    outstandingRisks,
    blockingIssues: (finalEvaluation.blockingIssues || []).slice(),
    remainingPrerequisites: (
      finalEvaluation.remainingPrerequisites || []
    ).slice(),

    program6Recommendation: {
      eligibleToBegin: true,
      recommendation: 'PROGRAM_6_ELIGIBLE_TO_BEGIN',
      message:
        'Program 5 is complete. Program 6 may begin. Deployment remains NOT AUTHORIZED until an explicit future deployment program changes that recommendation.',
      automatesPublishing: false,
      authorizesDeployment: false,
    },

    deploymentRecommendation: DEPLOYMENT_RECOMMENDATION.NOT_AUTHORIZED,
    deploymentRecommendationLocked: true,
    deploymentRecommendationNote:
      'Deployment recommendation must always remain NOT AUTHORIZED unless explicitly changed in a future deployment program.',

    effects: {
      contentPublished: false,
      softwareDeployed: false,
      automationEnabled: false,
      schedulersActivated: false,
      productionStateMutated: false,
      routesActivated: false,
      databaseWritten: false,
      featureActivated: false,
    },

    reusedModules: REUSED_MODULE_IDS,
  });
}

module.exports = {
  FINAL_GOVERNANCE_REPORT_VERSION,
  DEPLOYMENT_RECOMMENDATION,
  generateFinalGovernanceReport,
};
