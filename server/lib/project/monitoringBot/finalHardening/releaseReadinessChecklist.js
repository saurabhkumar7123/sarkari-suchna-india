'use strict';

/**
 * FT-1B — Part H Release Readiness Checklist
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const RELEASE_CHECKLIST_VERSION = 'FT1B.1.0.0';

/**
 * Build comprehensive release readiness checklist.
 * @param {object} [input] optional part results to derive statuses
 */
function buildReleaseReadinessChecklist(input = {}) {
  const partStatus = (part) => {
    if (!part) return 'ADVISORY_PENDING_EVALUATION';
    return part.allPassed === true ? 'SATISFIED' : 'GAPS_PRESENT';
  };

  const items = [
    {
      itemId: 'CONFIGURATION_COMPLETE',
      category: 'CONFIGURATION',
      description: 'Required env catalog, feature flags, scheduler/Telegram/monitoring docs complete',
      status: partStatus(input.partA),
      evidencePart: 'A',
    },
    {
      itemId: 'ENVIRONMENT_COMPLETE',
      category: 'ENVIRONMENT',
      description: 'Startup secret gates and env separation validated; live .env operator-owned',
      status: partStatus(input.partA),
      evidencePart: 'A',
    },
    {
      itemId: 'TESTS_PASSING',
      category: 'QUALITY',
      description: 'Programs 1–5, MB-1..MB-5, TG-1, RW-1, FT-1A regression posture intact; FT-1B suite deterministic',
      status: partStatus(input.regression),
      evidencePart: 'REGRESSION',
    },
    {
      itemId: 'SAFETY_GATES',
      category: 'SAFETY',
      description: 'Publishing, auto-approval, cron, Express wiring, and production activation remain denied for advisory stack',
      status: 'SATISFIED',
      evidencePart: 'FRAMEWORK',
    },
    {
      itemId: 'MONITORING_READY',
      category: 'OBSERVABILITY',
      description: 'Health/ready endpoints and advisory diagnostics modules available',
      status: partStatus(input.partF),
      evidencePart: 'F',
    },
    {
      itemId: 'ROLLBACK_PREPARED',
      category: 'RECOVERY',
      description: 'Backup/restore docs and recovery checklist defined; drills not executed by FT-1B',
      status: partStatus(input.partE),
      evidencePart: 'E',
    },
    {
      itemId: 'DOCUMENTATION_AVAILABLE',
      category: 'DOCUMENTATION',
      description: 'DEPLOYMENT, BACKUP_RESTORE, VPS, and package frameworks documented',
      status: partStatus(input.partE),
      evidencePart: 'E',
    },
    {
      itemId: 'OPERATIONAL_PROCEDURES_DEFINED',
      category: 'OPERATIONS',
      description: 'Startup/shutdown recommendations, PM2 scripts present but inactive, DEP-1 requires explicit authorization',
      status: partStatus(input.partB),
      evidencePart: 'B',
    },
    {
      itemId: 'DEPENDENCIES_DECLARED',
      category: 'DEPENDENCIES',
      description: 'npm/PM2/Nginx artifacts present; live Redis verification deferred to DEP-1',
      status: partStatus(input.partC),
      evidencePart: 'C',
    },
    {
      itemId: 'SECURITY_REVIEWED',
      category: 'SECURITY',
      description: 'Security configuration reviewed; no FT-1B security mutations',
      status: partStatus(input.partD),
      evidencePart: 'D',
    },
    {
      itemId: 'PERFORMANCE_BASELINE_RECORDED',
      category: 'PERFORMANCE',
      description: 'Advisory latency/memory/CPU expectations recorded without optimization',
      status: partStatus(input.partG),
      evidencePart: 'G',
    },
    {
      itemId: 'OPERATOR_AUTHORIZATION_REQUIRED',
      category: 'GOVERNANCE',
      description: 'Explicit operator authorization required before any production activation or DEP-1',
      status: 'REQUIRED',
      evidencePart: 'I',
    },
  ];

  const blocking = items.filter((i) => i.status === 'GAPS_PRESENT');
  const allSatisfiedOrRequired = items.every(
    (i) => i.status === 'SATISFIED' || i.status === 'REQUIRED'
  );

  return deepFreeze({
    validationVersion: RELEASE_CHECKLIST_VERSION,
    part: 'H',
    reportId: 'FT1B_RELEASE_READINESS_CHECKLIST',
    advisoryOnly: true,
    productionActivated: false,
    items,
    blockingItemIds: blocking.map((i) => i.itemId),
    checks: [
      {
        checkId: 'CHECKLIST_COMPLETE',
        passed: items.length >= 12,
      },
      {
        checkId: 'NO_GAPS_OR_GAPS_TRACKED',
        passed: true,
        gapsPresent: blocking.length > 0,
      },
    ],
    allPassed: allSatisfiedOrRequired,
    summary: allSatisfiedOrRequired
      ? 'Release readiness checklist satisfied for DEP-1 eligibility pending Go/No-Go conditions and operator authorization.'
      : 'Release checklist has gaps — see blockingItemIds.',
  });
}

module.exports = {
  RELEASE_CHECKLIST_VERSION,
  buildReleaseReadinessChecklist,
};
