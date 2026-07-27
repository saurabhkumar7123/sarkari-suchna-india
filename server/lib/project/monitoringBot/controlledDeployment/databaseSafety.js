'use strict';

/**
 * DEP-1 — Part D Database Safety
 *
 * Prepares deployment checklist for backup/restore/rollback.
 * Does NOT execute backup.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const DATABASE_SAFETY_VERSION = 'DEP1.1.0.0';

/**
 * Prepare database safety checklist (advisory).
 * @param {object} [input]
 */
function prepareDatabaseSafetyChecklist(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const artifacts = {
    backupRestoreDoc: path.join(productRoot, 'docs', 'BACKUP_RESTORE.md'),
    deploymentDoc: path.join(productRoot, 'docs', 'DEPLOYMENT.md'),
    phase3Runbook: path.join(
      productRoot,
      'docs',
      'deployment',
      'phase3-deploy-runbook.md'
    ),
    backupSh: path.join(productRoot, 'scripts', 'backup-db.sh'),
    backupPs1: path.join(productRoot, 'scripts', 'backup-db.ps1'),
  };

  const present = {};
  for (const [key, filePath] of Object.entries(artifacts)) {
    present[key] = fs.existsSync(filePath);
  }

  const checklist = [
    {
      itemId: 'BACKUP_AVAILABLE',
      required: true,
      status: present.backupRestoreDoc || present.backupSh || present.backupPs1
        ? 'DOCUMENTED'
        : 'MISSING',
      action: 'Confirm latest MySQL backup artifact exists before activation',
      executed: false,
    },
    {
      itemId: 'RESTORE_PROCEDURE',
      required: true,
      status: present.backupRestoreDoc ? 'DOCUMENTED' : 'MISSING',
      action: 'Follow BACKUP_RESTORE.md restore steps; verify dry-run success',
      executed: false,
    },
    {
      itemId: 'ROLLBACK_PLAN',
      required: true,
      status:
        present.phase3Runbook || present.deploymentDoc || present.backupRestoreDoc
          ? 'DOCUMENTED'
          : 'MISSING',
      action: 'Confirm application + DB rollback sequence is operator-approved',
      executed: false,
    },
    {
      itemId: 'RECOVERY_DOCUMENTATION',
      required: true,
      status: present.backupRestoreDoc ? 'DOCUMENTED' : 'MISSING',
      action: 'Keep recovery documentation accessible during deployment window',
      executed: false,
    },
  ];

  const checks = [
    {
      checkId: 'BACKUP_GUIDANCE_PRESENT',
      passed: present.backupRestoreDoc || present.backupSh || present.backupPs1,
    },
    {
      checkId: 'RESTORE_PROCEDURE_DOCUMENTED',
      passed: present.backupRestoreDoc,
    },
    {
      checkId: 'ROLLBACK_PLAN_DOCUMENTED',
      passed:
        present.phase3Runbook ||
        present.deploymentDoc ||
        present.backupRestoreDoc,
    },
    {
      checkId: 'RECOVERY_DOCUMENTATION_PRESENT',
      passed: present.backupRestoreDoc,
    },
    {
      checkId: 'BACKUP_NOT_EXECUTED',
      passed: true,
    },
  ];

  return deepFreeze({
    validationVersion: DATABASE_SAFETY_VERSION,
    part: 'D',
    reportId: 'DEP1_DATABASE_SAFETY_CHECKLIST',
    advisoryOnly: true,
    productionActivated: false,
    backupExecuted: false,
    databaseModified: false,
    artifactsPresent: present,
    checklist,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Database safety checklist prepared. Backup was not executed.',
  });
}

module.exports = {
  DATABASE_SAFETY_VERSION,
  prepareDatabaseSafetyChecklist,
};
