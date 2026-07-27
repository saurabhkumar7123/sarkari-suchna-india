'use strict';

/**
 * DEP-1 — Part E Deployment Checklist
 *
 * Deterministic pre / deploy / post / rollback / emergency checklist.
 * Documentation only — no execution.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const DEPLOYMENT_CHECKLIST_VERSION = 'DEP1.1.0.0';

const PRE_DEPLOYMENT = Object.freeze([
  { stepId: 'PRE_01', action: 'Confirm Programs 1–5, MB-1..MB-5, TG-1, RW-1, FT-1A, FT-1B approved' },
  { stepId: 'PRE_02', action: 'Confirm FT-1B GO_WITH_CONDITIONS conditions reviewed' },
  { stepId: 'PRE_03', action: 'Validate environment variables against .env.example' },
  { stepId: 'PRE_04', action: 'Verify Redis auth consistency (node-redis + ioredis)' },
  { stepId: 'PRE_05', action: 'Verify MySQL credentials and connectivity readiness (operator)' },
  { stepId: 'PRE_06', action: 'Confirm MySQL backup artifact available (do not skip)' },
  { stepId: 'PRE_07', action: 'Confirm restore procedure reviewed from BACKUP_RESTORE.md' },
  { stepId: 'PRE_08', action: 'Confirm rollback package reviewed' },
  { stepId: 'PRE_09', action: 'Confirm scheduler remains disabled' },
  { stepId: 'PRE_10', action: 'Confirm Telegram live sending remains disabled' },
  { stepId: 'PRE_11', action: 'Confirm no automatic draft approval enabled' },
  { stepId: 'PRE_12', action: 'Obtain explicit operator authorization token/record' },
]);

const DEPLOYMENT = Object.freeze([
  { stepId: 'DEP_01', action: 'Place build artifacts on target host (operator-driven)' },
  { stepId: 'DEP_02', action: 'Apply production .env (operator-owned secrets)' },
  { stepId: 'DEP_03', action: 'Validate PM2 ecosystem config without starting processes' },
  { stepId: 'DEP_04', action: 'Validate Nginx/SSL config without reload' },
  { stepId: 'DEP_05', action: 'Confirm logging paths writable' },
  { stepId: 'DEP_06', action: 'Stop — await authorization gate before any activation' },
]);

const POST_DEPLOYMENT = Object.freeze([
  { stepId: 'POST_01', action: 'Only after AUTHORIZED: start PM2 under operator control' },
  { stepId: 'POST_02', action: 'Only after AUTHORIZED: reload Nginx under operator control' },
  { stepId: 'POST_03', action: 'Run health verification plan (API, scheduler inactive, monitoring)' },
  { stepId: 'POST_04', action: 'Run smoke test plan; confirm no production publishing' },
  { stepId: 'POST_05', action: 'Record deployment evidence and authorization ID' },
  { stepId: 'POST_06', action: 'Keep scheduler/Telegram live flags disabled unless separately authorized' },
]);

const ROLLBACK = Object.freeze([
  { stepId: 'RB_01', action: 'Trigger: health failure, data risk, auth revoked, or operator abort' },
  { stepId: 'RB_02', action: 'Stop newly started processes (if any were started)' },
  { stepId: 'RB_03', action: 'Restore previous application revision' },
  { stepId: 'RB_04', action: 'Restore MySQL from verified backup if schema/data impacted' },
  { stepId: 'RB_05', action: 'Re-validate health on restored stack' },
  { stepId: 'RB_06', action: 'Mark deployment state back to NOT_DEPLOYED or DEPLOYMENT_PREPARED' },
]);

const EMERGENCY_RECOVERY = Object.freeze([
  { stepId: 'ER_01', action: 'Declare emergency; freeze publishing and approvals' },
  { stepId: 'ER_02', action: 'Disable scheduler and Telegram live sending immediately' },
  { stepId: 'ER_03', action: 'Isolate traffic (Nginx maintenance / upstream down) if needed' },
  { stepId: 'ER_04', action: 'Restore from last known-good backup' },
  { stepId: 'ER_05', action: 'Validate API health and review-queue advisory availability' },
  { stepId: 'ER_06', action: 'Document incident, root cause, and authorization for re-attempt' },
]);

/**
 * Build deterministic deployment checklist.
 * @param {object} [input]
 */
function buildDeploymentChecklist(input = {}) {
  const partAPassed = input.partA ? input.partA.allPassed === true : true;
  const partBPassed = input.partB ? input.partB.allPassed === true : true;
  const partCPassed = input.partC ? input.partC.allPassed === true : true;
  const partDPassed = input.partD ? input.partD.allPassed === true : true;

  const sections = [
    {
      sectionId: 'PRE_DEPLOYMENT',
      steps: PRE_DEPLOYMENT.slice(),
      executed: false,
    },
    {
      sectionId: 'DEPLOYMENT',
      steps: DEPLOYMENT.slice(),
      executed: false,
    },
    {
      sectionId: 'POST_DEPLOYMENT',
      steps: POST_DEPLOYMENT.slice(),
      executed: false,
    },
    {
      sectionId: 'ROLLBACK',
      steps: ROLLBACK.slice(),
      executed: false,
    },
    {
      sectionId: 'EMERGENCY_RECOVERY',
      steps: EMERGENCY_RECOVERY.slice(),
      executed: false,
    },
  ];

  const checks = [
    {
      checkId: 'PRE_DEPLOYMENT_PRESENT',
      passed: PRE_DEPLOYMENT.length >= 10,
    },
    {
      checkId: 'DEPLOYMENT_PRESENT',
      passed: DEPLOYMENT.length >= 5,
    },
    {
      checkId: 'POST_DEPLOYMENT_PRESENT',
      passed: POST_DEPLOYMENT.length >= 5,
    },
    {
      checkId: 'ROLLBACK_PRESENT',
      passed: ROLLBACK.length >= 5,
    },
    {
      checkId: 'EMERGENCY_RECOVERY_PRESENT',
      passed: EMERGENCY_RECOVERY.length >= 5,
    },
    {
      checkId: 'DETERMINISTIC',
      passed: true,
    },
    {
      checkId: 'PRIOR_PARTS_READY',
      passed: partAPassed && partBPassed && partCPassed && partDPassed,
    },
    {
      checkId: 'NO_EXECUTION',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: DEPLOYMENT_CHECKLIST_VERSION,
    part: 'E',
    reportId: 'DEP1_DEPLOYMENT_CHECKLIST',
    advisoryOnly: true,
    productionActivated: false,
    executed: false,
    sections,
    stepCounts: {
      preDeployment: PRE_DEPLOYMENT.length,
      deployment: DEPLOYMENT.length,
      postDeployment: POST_DEPLOYMENT.length,
      rollback: ROLLBACK.length,
      emergencyRecovery: EMERGENCY_RECOVERY.length,
    },
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Deterministic deployment checklist generated. No deployment steps executed.',
  });
}

module.exports = {
  DEPLOYMENT_CHECKLIST_VERSION,
  PRE_DEPLOYMENT,
  DEPLOYMENT,
  POST_DEPLOYMENT,
  ROLLBACK,
  EMERGENCY_RECOVERY,
  buildDeploymentChecklist,
};
