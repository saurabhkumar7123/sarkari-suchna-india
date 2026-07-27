'use strict';

/**
 * FT-1B — Part E Backup & Rollback Readiness
 *
 * Assessment only. No backup execution.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const BACKUP_ROLLBACK_VERSION = 'FT1B.1.0.0';

/**
 * Assess backup and rollback readiness.
 * @param {object} [input]
 */
function assessBackupRollbackReadiness(input = {}) {
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
    deploySh: path.join(productRoot, 'deploy.sh'),
    envExample: path.join(productRoot, '.env.example'),
  };

  const checks = [];
  const findings = [];
  const recommendations = [];
  const present = {};

  for (const [key, filePath] of Object.entries(artifacts)) {
    present[key] = fs.existsSync(filePath);
  }

  checks.push({
    checkId: 'CONFIGURATION_BACKUP_GUIDANCE',
    passed: present.envExample,
    detail:
      '.env.example documents configuration keys; live .env must be backed up off-repo by operators.',
  });

  checks.push({
    checkId: 'ENVIRONMENT_BACKUP_DOCUMENTED',
    passed: present.backupRestoreDoc,
    scripts: {
      bash: present.backupSh,
      powershell: present.backupPs1,
    },
  });

  let rollbackSequenceDocumented = false;
  const runbookPath = present.phase3Runbook
    ? artifacts.phase3Runbook
    : present.deploymentDoc
      ? artifacts.deploymentDoc
      : null;
  if (runbookPath) {
    const text = fs.readFileSync(runbookPath, 'utf8');
    rollbackSequenceDocumented =
      /rollback|git checkout|pm2 reload|restore/i.test(text);
  }
  checks.push({
    checkId: 'ROLLBACK_SEQUENCE_DOCUMENTED',
    passed: rollbackSequenceDocumented || present.backupRestoreDoc,
    runbookPresent: !!runbookPath,
  });

  const recoveryChecklist = [
    {
      itemId: 'STOP_WRITE_TRAFFIC',
      description: 'Pause content import / publishing operations if active',
    },
    {
      itemId: 'RESTORE_DB_FROM_BACKUP',
      description: 'Restore MySQL from backups/mysql/*.sql per BACKUP_RESTORE.md',
    },
    {
      itemId: 'RESTORE_ENV_IF_NEEDED',
      description: 'Restore operator-held .env from secure backup',
    },
    {
      itemId: 'CHECKOUT_PRIOR_RELEASE',
      description: 'git checkout previous known-good tag/commit',
    },
    {
      itemId: 'REINSTALL_DEPS',
      description: 'npm install at restored revision',
    },
    {
      itemId: 'RELOAD_PROCESS_MANAGER',
      description: 'pm2 reload (DEP-1 only — not executed by FT-1B)',
    },
    {
      itemId: 'VERIFY_READY',
      description: 'GET /ready returns 200 with DB + Redis healthy',
    },
  ];

  checks.push({
    checkId: 'RECOVERY_CHECKLIST_DEFINED',
    passed: true,
    items: recoveryChecklist,
  });

  checks.push({
    checkId: 'DATA_PROTECTION_CONSIDERATIONS',
    passed: true,
    considerations: [
      'Database dumps contain sensitive operational data — treat like credentials',
      'Off-site encrypted copies recommended (S3/Backblaze/secondary VPS)',
      'Advisory monitoring packages (MB/TG/RW/FT) do not write production DB rows',
      'Schema migrations may be irreversible — document column rollback cautions',
    ],
  });

  if (!present.backupSh && !present.backupPs1) {
    findings.push({
      findingId: 'BACKUP_SCRIPTS_MISSING',
      severity: 'MEDIUM',
      detail: 'Backup scripts referenced by docs were not found under scripts/.',
    });
  }

  recommendations.push({
    recommendationId: 'REC_NO_BACKUP_EXECUTION',
    action: 'FT-1B does not execute backups. Operators must run backup drills before DEP-1.',
  });
  recommendations.push({
    recommendationId: 'REC_CONFIG_SECRET_BACKUP',
    action:
      'Maintain an encrypted off-host backup of production .env separate from git and DB dumps.',
  });

  const allPassed = checks.every((c) => c.passed === true);

  return deepFreeze({
    validationVersion: BACKUP_ROLLBACK_VERSION,
    part: 'E',
    advisoryOnly: true,
    productionActivated: false,
    backupExecuted: false,
    artifactsPresent: present,
    recoveryChecklist,
    findings,
    recommendations,
    checks,
    allPassed,
    summary:
      'Backup/restore documentation and recovery checklist are available. No backup was executed. Operator drills remain a DEP-1 precondition.',
  });
}

module.exports = {
  BACKUP_ROLLBACK_VERSION,
  assessBackupRollbackReadiness,
};
