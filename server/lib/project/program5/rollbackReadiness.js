'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Rollback Readiness (Advisory Verification Only)
 *
 * Verifies advisory prerequisites for rollback planning.
 * Never executes rollback. Never mutates production state.
 */

const { deepFreeze } = require('./publishReadinessContract');

const ROLLBACK_READINESS_VERSION = '5F.1.0.0';

const ROLLBACK_CHECK_IDS = Object.freeze({
  ROLLBACK_PLAN_EXISTS: 'ROLLBACK_PLAN_EXISTS',
  RECOVERY_PROCEDURE_DOCUMENTED: 'RECOVERY_PROCEDURE_DOCUMENTED',
  MANUAL_RECOVERY_CHECKLIST_AVAILABLE: 'MANUAL_RECOVERY_CHECKLIST_AVAILABLE',
});

const DEFAULT_ROLLBACK_CHECKS = deepFreeze([
  {
    checkId: ROLLBACK_CHECK_IDS.ROLLBACK_PLAN_EXISTS,
    name: 'Rollback Plan Exists',
    summary: 'A documented rollback plan must be available for operator review.',
  },
  {
    checkId: ROLLBACK_CHECK_IDS.RECOVERY_PROCEDURE_DOCUMENTED,
    name: 'Recovery Procedure Documented',
    summary: 'Recovery procedure documentation must be available.',
  },
  {
    checkId: ROLLBACK_CHECK_IDS.MANUAL_RECOVERY_CHECKLIST_AVAILABLE,
    name: 'Manual Recovery Checklist Available',
    summary: 'A manual recovery checklist must be available to operators.',
  },
]);

/**
 * Verify rollback readiness prerequisites (advisory only).
 * Never executes rollback.
 *
 * @param {object} [input]
 * @param {boolean} [input.rollbackPlanExists]
 * @param {boolean} [input.recoveryProcedureDocumented]
 * @param {boolean} [input.manualRecoveryChecklistAvailable]
 * @param {string} [input.rollbackPlanReference]
 * @param {string} [input.recoveryProcedureReference]
 * @param {string} [input.checklistReference]
 * @param {object[]} [input.checks]
 */
function verifyRollbackReadiness(input = {}) {
  const checks =
    Array.isArray(input.checks) && input.checks.length
      ? input.checks
      : DEFAULT_ROLLBACK_CHECKS;

  const observations = {
    [ROLLBACK_CHECK_IDS.ROLLBACK_PLAN_EXISTS]: Boolean(
      input.rollbackPlanExists
    ),
    [ROLLBACK_CHECK_IDS.RECOVERY_PROCEDURE_DOCUMENTED]: Boolean(
      input.recoveryProcedureDocumented
    ),
    [ROLLBACK_CHECK_IDS.MANUAL_RECOVERY_CHECKLIST_AVAILABLE]: Boolean(
      input.manualRecoveryChecklistAvailable
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
    verificationId: 'ROLLBACK_READINESS_VERIFICATION',
    version: ROLLBACK_READINESS_VERSION,
    advisoryOnly: true,
    verificationOnly: true,
    rollbackExecuted: false,
    productionStateMutated: false,
    checkCount: results.length,
    satisfiedCount,
    missingCount: missing.length,
    ready: missing.length === 0,
    missing,
    results,
    references: {
      rollbackPlanReference:
        typeof input.rollbackPlanReference === 'string'
          ? input.rollbackPlanReference
          : null,
      recoveryProcedureReference:
        typeof input.recoveryProcedureReference === 'string'
          ? input.recoveryProcedureReference
          : null,
      checklistReference:
        typeof input.checklistReference === 'string'
          ? input.checklistReference
          : null,
    },
    recommendation:
      missing.length === 0
        ? 'ROLLBACK_PREREQUISITES_DOCUMENTED_NO_EXECUTION'
        : 'COMPLETE_ROLLBACK_DOCUMENTATION_BEFORE_CONTROLLED_IMPLEMENTATION',
  });
}

module.exports = {
  ROLLBACK_READINESS_VERSION,
  ROLLBACK_CHECK_IDS,
  DEFAULT_ROLLBACK_CHECKS,
  verifyRollbackReadiness,
};
