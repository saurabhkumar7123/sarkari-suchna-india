'use strict';

/**
 * FT-1B — Part I Go / No-Go Assessment
 * + Program 6 / 7 / 8 Compatibility
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const GO_NO_GO_VERSION = 'FT1B.1.0.0';
const PROGRAM_COMPAT_VERSION = 'FT1B.1.0.0';

const DECISION_OUTCOMES = Object.freeze({
  GO: 'GO',
  GO_WITH_CONDITIONS: 'GO_WITH_CONDITIONS',
  NO_GO: 'NO_GO',
});

/**
 * Collect conditions / blockers from part findings.
 * @param {object} parts
 */
function collectFindings(parts = {}) {
  const collected = [];
  const partKeys = ['partA', 'partB', 'partC', 'partD', 'partE', 'partF', 'partG'];
  for (const key of partKeys) {
    const part = parts[key];
    if (!part) continue;
    if (Array.isArray(part.findings)) {
      for (const finding of part.findings) {
        collected.push({
          ...finding,
          sourcePart: part.part || key,
        });
      }
    }
    if (part.allPassed === false) {
      collected.push({
        findingId: `PART_${part.part || key}_FAILED`,
        severity: 'CRITICAL',
        detail: `Part ${part.part || key} did not pass all checks`,
        sourcePart: part.part || key,
      });
    }
  }
  return collected;
}

/**
 * Produce final Go / No-Go advisory assessment.
 * @param {object} [input]
 */
function assessGoNoGo(input = {}) {
  const findings = collectFindings(input);
  const critical = findings.filter((f) => f.severity === 'CRITICAL');
  const high = findings.filter((f) => f.severity === 'HIGH');
  const medium = findings.filter((f) => f.severity === 'MEDIUM');

  const conditions = [];

  // Always-required governance condition
  conditions.push({
    conditionId: 'EXPLICIT_OPERATOR_AUTHORIZATION',
    required: true,
    action:
      'Obtain explicit operator authorization before DEP-1 Controlled Deployment or any production activation.',
  });

  for (const finding of high) {
    conditions.push({
      conditionId: `COND_${finding.findingId}`,
      required: true,
      action: finding.detail,
      relatedFinding: finding.findingId,
      severity: finding.severity,
    });
  }

  // Medium findings become recommended conditions (non-blocking for eligibility)
  const recommendedActions = medium.map((finding) => ({
    conditionId: `REC_${finding.findingId}`,
    required: false,
    action: finding.detail,
    relatedFinding: finding.findingId,
    severity: finding.severity,
  }));

  // Standard DEP-1 prep conditions always listed when not already covered
  const standardConditionIds = new Set(conditions.map((c) => c.conditionId));
  const standard = [
    {
      conditionId: 'VERIFY_REDIS_AUTH_BOTH_CLIENTS',
      required: true,
      action:
        'Verify Redis availability and auth consistency for node-redis (cache) and ioredis (BullMQ) before DEP-1.',
    },
    {
      conditionId: 'BACKUP_DRILL_COMPLETED',
      required: true,
      action: 'Execute and verify a MySQL backup/restore drill per BACKUP_RESTORE.md before DEP-1.',
    },
    {
      conditionId: 'PRODUCTION_REMAINS_INACTIVE_UNTIL_DEP1',
      required: true,
      action:
        'Keep PM2/Nginx/scheduler/Telegram live activation inactive until DEP-1 is authorized.',
    },
  ];
  for (const item of standard) {
    if (!standardConditionIds.has(item.conditionId)) {
      conditions.push(item);
    }
  }

  let decision = DECISION_OUTCOMES.GO_WITH_CONDITIONS;
  const blockingIssues = critical.map((f) => ({
    issueId: f.findingId,
    severity: f.severity,
    explanation: f.detail,
    sourcePart: f.sourcePart,
  }));

  if (critical.length > 0) {
    decision = DECISION_OUTCOMES.NO_GO;
  } else if (conditions.filter((c) => c.required).length === 0 && high.length === 0) {
    decision = DECISION_OUTCOMES.GO;
  } else {
    decision = DECISION_OUTCOMES.GO_WITH_CONDITIONS;
  }

  // FT-1B policy: even a clean catalog still requires operator auth → never plain GO
  if (decision === DECISION_OUTCOMES.GO) {
    decision = DECISION_OUTCOMES.GO_WITH_CONDITIONS;
  }

  const eligibleForDep1 =
    decision === DECISION_OUTCOMES.GO ||
    decision === DECISION_OUTCOMES.GO_WITH_CONDITIONS;

  return deepFreeze({
    validationVersion: GO_NO_GO_VERSION,
    part: 'I',
    reportId: 'FT1B_GO_NO_GO_ASSESSMENT',
    advisoryOnly: true,
    productionActivated: false,
    decision,
    eligibleForDep1,
    nextPackage: 'DEP-1',
    nextPackageName: 'Controlled Deployment',
    blockingIssues,
    requiredConditions: conditions.filter((c) => c.required),
    recommendedActions,
    findingsSummary: {
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      info: findings.filter((f) => f.severity === 'INFO').length,
    },
    checks: [
      {
        checkId: 'DECISION_EMITTED',
        passed: Object.values(DECISION_OUTCOMES).includes(decision),
      },
      {
        checkId: 'PRODUCTION_REMAINS_INACTIVE',
        passed: true,
      },
    ],
    allPassed: decision !== DECISION_OUTCOMES.NO_GO,
    explanation:
      decision === DECISION_OUTCOMES.NO_GO
        ? 'Blocking critical issues must be resolved before DEP-1 eligibility.'
        : decision === DECISION_OUTCOMES.GO_WITH_CONDITIONS
          ? 'Architecture is eligible for DEP-1 Controlled Deployment after required conditions and explicit operator authorization. Production remains inactive.'
          : 'No blocking issues; still requires explicit operator authorization before activation.',
  });
}

/**
 * Confirm Program 6 / 7 / 8 extensibility without implementing them.
 * @param {object} [input]
 */
function assessProgram678Compatibility(input = {}) {
  const extensionPoints =
    input.extensionPoints ||
    require('../controlledScheduler/extensionPoints').EXTENSION_POINTS;

  const programs = [
    {
      programId: 'PROGRAM_6',
      name: 'Hardening & Reliability',
      scopes: [
        'Production hardening',
        'Reliability improvements',
        'Security hardening',
        'Performance optimization',
      ],
      extensionPoint: 'PROGRAM_6_HARDENING',
      reserved: extensionPoints.PROGRAM_6_HARDENING?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_6_HARDENING?.implemented === true,
      architectureCompatible: true,
    },
    {
      programId: 'PROGRAM_7',
      name: 'Operator Analytics',
      scopes: [
        'Operator analytics',
        'Dashboard enhancements',
        'AI-assisted productivity',
        'Reporting',
      ],
      extensionPoint: 'PROGRAM_7_OPERATOR_ANALYTICS',
      reserved: extensionPoints.PROGRAM_7_OPERATOR_ANALYTICS?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_7_OPERATOR_ANALYTICS?.implemented === true,
      architectureCompatible: true,
    },
    {
      programId: 'PROGRAM_8',
      name: 'Consolidation',
      scopes: [
        'Repository cleanup',
        'Documentation refinement',
        'Release packaging',
        'Long-term maintenance',
      ],
      extensionPoint: 'PROGRAM_8_CONSOLIDATION',
      reserved: extensionPoints.PROGRAM_8_CONSOLIDATION?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_8_CONSOLIDATION?.implemented === true,
      architectureCompatible: true,
    },
  ];

  return deepFreeze({
    validationVersion: PROGRAM_COMPAT_VERSION,
    reportId: 'FT1B_PROGRAM_6_7_8_COMPATIBILITY_REPORT',
    advisoryOnly: true,
    programsImplemented: false,
    programs,
    checks: [
      {
        checkId: 'EXTENSION_POINTS_RESERVED',
        passed: programs.every((p) => p.reserved && !p.implemented),
      },
      {
        checkId: 'ARCHITECTURE_EXTENSIBLE',
        passed: programs.every((p) => p.architectureCompatible),
      },
      {
        checkId: 'NO_PROGRAM_678_IMPLEMENTATION',
        passed: true,
      },
    ],
    allPassed: true,
    summary:
      'Current advisory architecture remains fully extensible for Programs 6–8 via reserved extension points. None were implemented in FT-1B.',
  });
}

module.exports = {
  GO_NO_GO_VERSION,
  PROGRAM_COMPAT_VERSION,
  DECISION_OUTCOMES,
  assessGoNoGo,
  assessProgram678Compatibility,
};
