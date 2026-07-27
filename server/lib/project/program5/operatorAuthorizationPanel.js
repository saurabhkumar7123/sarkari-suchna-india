'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Operator Authorization Panel (Read-Only Model)
 *
 * Read-only authorization model for operator inspection.
 * Displays gate results, blocking issues, required approvals,
 * readiness score, and advisory recommendations.
 *
 * Does NOT activate routes. Does NOT authorize deployment.
 */

const { deepFreeze } = require('./publishReadinessContract');
const { GATE_RESULT } = require('./authorizationGates');
const { OVERALL_STATUS } = require('./finalReadinessEvaluator');

const OPERATOR_AUTHORIZATION_PANEL_VERSION = '5F.1.0.0';

function computeReadinessScore(gateEvaluation, finalEvaluation) {
  const results =
    gateEvaluation && Array.isArray(gateEvaluation.results)
      ? gateEvaluation.results
      : [];
  if (results.length === 0) return 0;

  let points = 0;
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].result === GATE_RESULT.PASS) points += 1;
    else if (results[i].result === GATE_RESULT.WARNING) points += 0.5;
  }

  let score = points / results.length;

  if (finalEvaluation && finalEvaluation.summary) {
    if (!finalEvaluation.summary.rollbackReady) score *= 0.9;
    if (!finalEvaluation.summary.backupReady) score *= 0.9;
  }

  return Math.round(score * 1000) / 1000;
}

/**
 * Build a read-only operator authorization panel model.
 *
 * @param {object} [input]
 * @param {object} [input.gateEvaluation]
 * @param {object} [input.finalEvaluation]
 * @param {object} [input.readinessModel]
 * @param {object} [input.rollbackReadiness]
 * @param {object} [input.backupReadiness]
 * @param {string[]} [input.requiredApprovals]
 * @param {string[]} [input.recordedApprovals]
 * @param {string} [input.generatedAt]
 */
function buildOperatorAuthorizationPanel(input = {}) {
  const gateEvaluation = input.gateEvaluation || {
    results: [],
    blockedGateIds: [],
    warningGateIds: [],
    passedGateIds: [],
  };
  const finalEvaluation = input.finalEvaluation || {
    overallStatus: OVERALL_STATUS.NOT_READY,
    blockingIssues: [],
    remainingPrerequisites: [],
    recommendedActions: [],
    summary: {},
  };
  const readinessModel = input.readinessModel || null;
  const rollback = input.rollbackReadiness || null;
  const backup = input.backupReadiness || null;

  const requiredApprovals = Array.isArray(input.requiredApprovals)
    ? input.requiredApprovals.slice()
    : ['EDITORIAL_APPROVAL', 'PUBLISH_READINESS_REVIEW'];
  const recordedApprovals = Array.isArray(input.recordedApprovals)
    ? input.recordedApprovals.slice()
    : [];
  const missingApprovals = requiredApprovals.filter(
    (id) => recordedApprovals.indexOf(id) === -1
  );

  const readinessScore = computeReadinessScore(gateEvaluation, finalEvaluation);

  const advisoryRecommendations = (
    finalEvaluation.recommendedActions || []
  ).map((action) => ({
    code: action.code,
    priority: action.priority,
    message: action.message,
  }));

  advisoryRecommendations.push({
    code: 'DEPLOYMENT_REMAINS_NOT_AUTHORIZED',
    priority: 'INFO',
    message:
      'Deployment recommendation remains NOT AUTHORIZED. No routes activated.',
  });

  return deepFreeze({
    panelId: 'OPERATOR_AUTHORIZATION_PANEL',
    version: OPERATOR_AUTHORIZATION_PANEL_VERSION,
    readOnly: true,
    advisoryOnly: true,
    routesActivated: false,
    publishingEnabled: false,
    deploymentAuthorized: false,
    automaticApproval: false,
    generatedAt:
      typeof input.generatedAt === 'string' && input.generatedAt.trim()
        ? input.generatedAt.trim()
        : '1970-01-01T00:00:00.000Z',
    overallStatus: finalEvaluation.overallStatus,
    readinessScore,
    gateResults: (gateEvaluation.results || []).map((g) => ({
      gateId: g.gateId,
      result: g.result,
      name: g.name,
      message: g.message,
    })),
    blockingIssues: (finalEvaluation.blockingIssues || []).slice(),
    requiredApprovals,
    recordedApprovals,
    missingApprovals,
    remainingPrerequisites: (
      finalEvaluation.remainingPrerequisites || []
    ).slice(),
    advisoryRecommendations,
    readinessModelSummary: readinessModel
      ? {
          readinessId: readinessModel.readinessId,
          lifecycleStatus: readinessModel.lifecycleStatus,
          authorizationStatus: readinessModel.authorizationStatus,
          platformVersion: readinessModel.platformVersion,
        }
      : null,
    rollbackSummary: rollback
      ? {
          ready: Boolean(rollback.ready),
          missing: (rollback.missing || []).slice(),
          rollbackExecuted: false,
        }
      : null,
    backupSummary: backup
      ? {
          ready: Boolean(backup.ready),
          missing: (backup.missing || []).slice(),
          backupExecuted: false,
        }
      : null,
    displayHints: {
      title: 'Controlled Publish Authorization Panel',
      subtitle: 'Read-only assessment — no activation',
      showGateResults: true,
      showBlockingIssues: true,
      showRequiredApprovals: true,
      showReadinessScore: true,
      showAdvisoryRecommendations: true,
      activateRoutes: false,
    },
  });
}

module.exports = {
  OPERATOR_AUTHORIZATION_PANEL_VERSION,
  buildOperatorAuthorizationPanel,
  computeReadinessScore,
};
