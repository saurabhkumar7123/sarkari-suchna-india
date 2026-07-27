'use strict';

/**
 * DEP-1 — Part H Rollback Package
 *
 * Documentation only. No rollback execution.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const ROLLBACK_PACKAGE_VERSION = 'DEP1.1.0.0';

const ROLLBACK_TRIGGERS = Object.freeze([
  {
    triggerId: 'HEALTH_FAILURE',
    description: 'API, pipeline, or monitoring health check fails after start',
  },
  {
    triggerId: 'DATA_INTEGRITY_RISK',
    description: 'Unexpected database mutation or restore verification failure',
  },
  {
    triggerId: 'AUTHORIZATION_REVOKED',
    description: 'Operator revokes authorization or Final Go Decision withdrawn',
  },
  {
    triggerId: 'UNEXPECTED_PUBLISH_OR_SEND',
    description: 'Any production publish, auto-approve, or Telegram live send observed',
  },
  {
    triggerId: 'OPERATOR_ABORT',
    description: 'Operator initiates controlled abort during deployment window',
  },
]);

const ROLLBACK_SEQUENCE = Object.freeze([
  { stepId: 'SEQ_01', action: 'Freeze publishing, approvals, scheduler, and Telegram live' },
  { stepId: 'SEQ_02', action: 'Stop newly activated PM2 apps (if started)' },
  { stepId: 'SEQ_03', action: 'Revert Nginx upstream/config to last known-good (if reloaded)' },
  { stepId: 'SEQ_04', action: 'Restore application revision from prior release artifact' },
  { stepId: 'SEQ_05', action: 'Restore MySQL from verified backup if required' },
  { stepId: 'SEQ_06', action: 'Clear unsafe Redis queue state if workers ran unexpectedly' },
  { stepId: 'SEQ_07', action: 'Record rollback evidence and return to DEPLOYMENT_PREPARED' },
]);

const RECOVERY_VALIDATION = Object.freeze([
  { itemId: 'RV_01', action: 'Confirm process set matches pre-deployment inventory' },
  { itemId: 'RV_02', action: 'Confirm MySQL restore checksum / row-count spot checks' },
  { itemId: 'RV_03', action: 'Confirm Redis/BullMQ idle and scheduler still disabled' },
  { itemId: 'RV_04', action: 'Confirm no pages published during failed window' },
]);

const POST_ROLLBACK_VERIFICATION = Object.freeze([
  { itemId: 'PRV_01', action: 'API health returns expected baseline' },
  { itemId: 'PRV_02', action: 'Review queue advisory available; publishing denied' },
  { itemId: 'PRV_03', action: 'Telegram live sending remains disabled' },
  { itemId: 'PRV_04', action: 'Authorization gate state reset; production inactive' },
  { itemId: 'PRV_05', action: 'Incident notes filed before any re-authorization attempt' },
]);

/**
 * Generate rollback package documentation.
 * @param {object} [input]
 */
function generateRollbackPackage(input = {}) {
  const checks = [
    {
      checkId: 'TRIGGERS_DEFINED',
      passed: ROLLBACK_TRIGGERS.length >= 5,
    },
    {
      checkId: 'SEQUENCE_DEFINED',
      passed: ROLLBACK_SEQUENCE.length >= 6,
    },
    {
      checkId: 'RECOVERY_VALIDATION_DEFINED',
      passed: RECOVERY_VALIDATION.length >= 4,
    },
    {
      checkId: 'POST_ROLLBACK_VERIFICATION_DEFINED',
      passed: POST_ROLLBACK_VERIFICATION.length >= 4,
    },
    {
      checkId: 'NO_ROLLBACK_EXECUTED',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: ROLLBACK_PACKAGE_VERSION,
    part: 'H',
    reportId: 'DEP1_ROLLBACK_PACKAGE',
    advisoryOnly: true,
    productionActivated: false,
    rollbackExecuted: false,
    triggers: ROLLBACK_TRIGGERS.slice(),
    sequence: ROLLBACK_SEQUENCE.slice(),
    recoveryValidation: RECOVERY_VALIDATION.slice(),
    postRollbackVerification: POST_ROLLBACK_VERIFICATION.slice(),
    relatedDocs: [
      'sarkari-suchna-india/docs/BACKUP_RESTORE.md',
      'sarkari-suchna-india/docs/DEPLOYMENT.md',
      'sarkari-suchna-india/docs/deployment/phase3-deploy-runbook.md',
    ],
    generatedAt: input.generatedAt || null,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Rollback package documented. No rollback or restore was executed.',
  });
}

module.exports = {
  ROLLBACK_PACKAGE_VERSION,
  ROLLBACK_TRIGGERS,
  ROLLBACK_SEQUENCE,
  RECOVERY_VALIDATION,
  POST_ROLLBACK_VERIFICATION,
  generateRollbackPackage,
};
