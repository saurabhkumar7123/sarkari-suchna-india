'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Final Readiness Evaluator (Advisory Only)
 *
 * Produces overall readiness status:
 *   READY | READY_WITH_WARNINGS | NOT_READY
 *
 * Lists blocking issues, remaining prerequisites, and recommended actions.
 * Evaluation only. No publishing. No deployment. No automatic approval.
 */

const { deepFreeze } = require('./publishReadinessContract');
const { GATE_RESULT } = require('./authorizationGates');

const FINAL_READINESS_EVALUATOR_VERSION = '5F.1.0.0';

const OVERALL_STATUS = Object.freeze({
  READY: 'READY',
  READY_WITH_WARNINGS: 'READY_WITH_WARNINGS',
  NOT_READY: 'NOT_READY',
});

/**
 * Evaluate final controlled publish readiness from gate and advisory checks.
 *
 * @param {object} [input]
 * @param {object} [input.gateEvaluation]
 * @param {object} [input.rollbackReadiness]
 * @param {object} [input.backupReadiness]
 * @param {string[]} [input.additionalBlockingIssues]
 * @param {string[]} [input.additionalPrerequisites]
 */
function evaluateFinalReadiness(input = {}) {
  const gateEvaluation = input.gateEvaluation || {
    results: [],
    blockedGateIds: [],
    warningGateIds: [],
    passedGateIds: [],
    passCount: 0,
    warningCount: 0,
    blockedCount: 0,
  };

  const rollback = input.rollbackReadiness || { ready: false, missing: [] };
  const backup = input.backupReadiness || { ready: false, missing: [] };

  const blockingIssues = [];
  const remainingPrerequisites = [];
  const recommendedActions = [];

  const gateResults = Array.isArray(gateEvaluation.results)
    ? gateEvaluation.results
    : [];

  for (let i = 0; i < gateResults.length; i += 1) {
    const gate = gateResults[i];
    if (gate.result === GATE_RESULT.BLOCKED) {
      blockingIssues.push({
        code: `GATE_BLOCKED_${gate.gateId}`,
        source: 'AUTHORIZATION_GATE',
        gateId: gate.gateId,
        message: gate.message || `${gate.gateId} is blocked`,
      });
      remainingPrerequisites.push(`RESOLVE_GATE_${gate.gateId}`);
      recommendedActions.push({
        code: `CLEAR_${gate.gateId}`,
        priority: 'HIGH',
        message: `Resolve blocking authorization gate: ${gate.gateId}`,
      });
    } else if (gate.result === GATE_RESULT.WARNING) {
      remainingPrerequisites.push(`REVIEW_GATE_${gate.gateId}`);
      recommendedActions.push({
        code: `REVIEW_${gate.gateId}`,
        priority: 'MEDIUM',
        message: `Review warning on authorization gate: ${gate.gateId}`,
      });
    }
  }

  if (!rollback.ready) {
    const missing = Array.isArray(rollback.missing) ? rollback.missing : [];
    for (let i = 0; i < missing.length; i += 1) {
      remainingPrerequisites.push(`ROLLBACK_${missing[i]}`);
      recommendedActions.push({
        code: `COMPLETE_ROLLBACK_${missing[i]}`,
        priority: 'MEDIUM',
        message: `Document rollback prerequisite: ${missing[i]}`,
      });
    }
    if (missing.length > 0) {
      blockingIssues.push({
        code: 'ROLLBACK_READINESS_INCOMPLETE',
        source: 'ROLLBACK_READINESS',
        message: `Rollback documentation incomplete: ${missing.join(', ')}`,
      });
    }
  }

  if (!backup.ready) {
    const missing = Array.isArray(backup.missing) ? backup.missing : [];
    for (let i = 0; i < missing.length; i += 1) {
      remainingPrerequisites.push(`BACKUP_${missing[i]}`);
      recommendedActions.push({
        code: `COMPLETE_BACKUP_${missing[i]}`,
        priority: 'MEDIUM',
        message: `Document backup prerequisite: ${missing[i]}`,
      });
    }
    if (missing.length > 0) {
      blockingIssues.push({
        code: 'BACKUP_READINESS_INCOMPLETE',
        source: 'BACKUP_READINESS',
        message: `Backup documentation incomplete: ${missing.join(', ')}`,
      });
    }
  }

  const extraBlocking = Array.isArray(input.additionalBlockingIssues)
    ? input.additionalBlockingIssues
    : [];
  for (let i = 0; i < extraBlocking.length; i += 1) {
    const issue = extraBlocking[i];
    if (typeof issue === 'string') {
      blockingIssues.push({
        code: issue,
        source: 'ADDITIONAL',
        message: issue,
      });
    } else if (issue && typeof issue === 'object') {
      blockingIssues.push({
        code: typeof issue.code === 'string' ? issue.code : 'ADDITIONAL_BLOCK',
        source: 'ADDITIONAL',
        message:
          typeof issue.message === 'string' ? issue.message : String(issue.code),
      });
    }
  }

  const extraPrereqs = Array.isArray(input.additionalPrerequisites)
    ? input.additionalPrerequisites
    : [];
  for (let i = 0; i < extraPrereqs.length; i += 1) {
    if (typeof extraPrereqs[i] === 'string' && extraPrereqs[i].trim()) {
      remainingPrerequisites.push(extraPrereqs[i].trim());
    }
  }

  const blockedGateCount = Number(gateEvaluation.blockedCount) || 0;
  const warningGateCount = Number(gateEvaluation.warningCount) || 0;
  const hasBlocking = blockingIssues.length > 0 || blockedGateCount > 0;

  let overallStatus = OVERALL_STATUS.NOT_READY;
  if (!hasBlocking && warningGateCount === 0) {
    overallStatus = OVERALL_STATUS.READY;
  } else if (!hasBlocking && warningGateCount > 0) {
    overallStatus = OVERALL_STATUS.READY_WITH_WARNINGS;
  } else {
    overallStatus = OVERALL_STATUS.NOT_READY;
  }

  if (overallStatus === OVERALL_STATUS.READY) {
    recommendedActions.push({
      code: 'OPERATOR_REVIEW_AUTHORIZATION_PANEL',
      priority: 'INFO',
      message:
        'Readiness evaluation is complete for operator review. Deployment remains NOT AUTHORIZED.',
    });
  } else if (overallStatus === OVERALL_STATUS.READY_WITH_WARNINGS) {
    recommendedActions.push({
      code: 'OPERATOR_TRIAGE_WARNINGS',
      priority: 'MEDIUM',
      message:
        'Address remaining warnings before any future deployment program. Deployment remains NOT AUTHORIZED.',
    });
  } else {
    recommendedActions.push({
      code: 'RESOLVE_BLOCKING_ISSUES',
      priority: 'HIGH',
      message:
        'Resolve blocking issues before controlled implementation assessment can pass.',
    });
  }

  // Deduplicate prerequisites while preserving order
  const seenPrereq = {};
  const uniquePrerequisites = [];
  for (let i = 0; i < remainingPrerequisites.length; i += 1) {
    const key = remainingPrerequisites[i];
    if (!seenPrereq[key]) {
      seenPrereq[key] = true;
      uniquePrerequisites.push(key);
    }
  }

  return deepFreeze({
    evaluatorId: 'FINAL_READINESS_EVALUATOR',
    version: FINAL_READINESS_EVALUATOR_VERSION,
    advisoryOnly: true,
    evaluationOnly: true,
    automaticApproval: false,
    publishingDenied: true,
    deploymentAuthorized: false,
    overallStatus,
    blockingIssues,
    remainingPrerequisites: uniquePrerequisites,
    recommendedActions,
    summary: {
      gatePassCount: Number(gateEvaluation.passCount) || 0,
      gateWarningCount: warningGateCount,
      gateBlockedCount: blockedGateCount,
      blockingIssueCount: blockingIssues.length,
      remainingPrerequisiteCount: uniquePrerequisites.length,
      rollbackReady: Boolean(rollback.ready),
      backupReady: Boolean(backup.ready),
    },
  });
}

module.exports = {
  FINAL_READINESS_EVALUATOR_VERSION,
  OVERALL_STATUS,
  evaluateFinalReadiness,
};
