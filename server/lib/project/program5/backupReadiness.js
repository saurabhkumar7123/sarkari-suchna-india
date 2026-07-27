'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Backup Readiness (Advisory Verification Only)
 *
 * Verifies advisory backup prerequisites.
 * Never executes backups. Never restores. Never mutates production state.
 */

const { deepFreeze } = require('./publishReadinessContract');

const BACKUP_READINESS_VERSION = '5F.1.0.0';

const BACKUP_CHECK_IDS = Object.freeze({
  BACKUP_POLICY_DOCUMENTED: 'BACKUP_POLICY_DOCUMENTED',
  RESTORE_PROCEDURE_AVAILABLE: 'RESTORE_PROCEDURE_AVAILABLE',
  VERIFICATION_CHECKLIST_COMPLETE: 'VERIFICATION_CHECKLIST_COMPLETE',
});

const DEFAULT_BACKUP_CHECKS = deepFreeze([
  {
    checkId: BACKUP_CHECK_IDS.BACKUP_POLICY_DOCUMENTED,
    name: 'Backup Policy Documented',
    summary: 'A backup policy document must be available for operator review.',
  },
  {
    checkId: BACKUP_CHECK_IDS.RESTORE_PROCEDURE_AVAILABLE,
    name: 'Restore Procedure Available',
    summary: 'A restore procedure must be documented and available.',
  },
  {
    checkId: BACKUP_CHECK_IDS.VERIFICATION_CHECKLIST_COMPLETE,
    name: 'Verification Checklist Complete',
    summary: 'Backup verification checklist must be marked complete by operators.',
  },
]);

/**
 * Verify backup readiness prerequisites (advisory only).
 * Never executes backup or restore.
 *
 * @param {object} [input]
 * @param {boolean} [input.backupPolicyDocumented]
 * @param {boolean} [input.restoreProcedureAvailable]
 * @param {boolean} [input.verificationChecklistComplete]
 * @param {string} [input.backupPolicyReference]
 * @param {string} [input.restoreProcedureReference]
 * @param {string} [input.checklistReference]
 * @param {object[]} [input.checks]
 */
function verifyBackupReadiness(input = {}) {
  const checks =
    Array.isArray(input.checks) && input.checks.length
      ? input.checks
      : DEFAULT_BACKUP_CHECKS;

  const observations = {
    [BACKUP_CHECK_IDS.BACKUP_POLICY_DOCUMENTED]: Boolean(
      input.backupPolicyDocumented
    ),
    [BACKUP_CHECK_IDS.RESTORE_PROCEDURE_AVAILABLE]: Boolean(
      input.restoreProcedureAvailable
    ),
    [BACKUP_CHECK_IDS.VERIFICATION_CHECKLIST_COMPLETE]: Boolean(
      input.verificationChecklistComplete
    ),
  };

  const results = checks.map((check) => {
    const satisfied = Boolean(observations[check.checkId]);
    return {
      checkId: check.checkId,
      name: check.name,
      summary: check.summary,
      satisfied,
      status: satisfied ? 'VERIFIED' : 'MISSING',
      advisoryOnly: true,
      executed: false,
    };
  });

  const satisfiedCount = results.filter((r) => r.satisfied).length;
  const missing = results.filter((r) => !r.satisfied).map((r) => r.checkId);

  return deepFreeze({
    verificationId: 'BACKUP_READINESS_VERIFICATION',
    version: BACKUP_READINESS_VERSION,
    advisoryOnly: true,
    verificationOnly: true,
    backupExecuted: false,
    restoreExecuted: false,
    productionStateMutated: false,
    checkCount: results.length,
    satisfiedCount,
    missingCount: missing.length,
    ready: missing.length === 0,
    missing,
    results,
    references: {
      backupPolicyReference:
        typeof input.backupPolicyReference === 'string'
          ? input.backupPolicyReference
          : null,
      restoreProcedureReference:
        typeof input.restoreProcedureReference === 'string'
          ? input.restoreProcedureReference
          : null,
      checklistReference:
        typeof input.checklistReference === 'string'
          ? input.checklistReference
          : null,
    },
    recommendation:
      missing.length === 0
        ? 'BACKUP_PREREQUISITES_DOCUMENTED_NO_EXECUTION'
        : 'COMPLETE_BACKUP_DOCUMENTATION_BEFORE_CONTROLLED_IMPLEMENTATION',
  });
}

module.exports = {
  BACKUP_READINESS_VERSION,
  BACKUP_CHECK_IDS,
  DEFAULT_BACKUP_CHECKS,
  verifyBackupReadiness,
};
