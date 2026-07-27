'use strict';

/**
 * DEP-1 — Part F Health Verification Plan
 *
 * Plan only. No runtime execution.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const HEALTH_VERIFICATION_VERSION = 'DEP1.1.0.0';

const HEALTH_CHECKS = Object.freeze([
  {
    checkId: 'API_HEALTH',
    target: 'API',
    method: 'GET /health or /ready',
    expected: 'HTTP 200 with DB/Redis readiness indicators as configured',
    executeNow: false,
  },
  {
    checkId: 'SCHEDULER_HEALTH',
    target: 'Scheduler',
    method: 'MB-5 health report / config inspection',
    expected: 'Scheduler disabled by default; no background execution',
    executeNow: false,
  },
  {
    checkId: 'MONITORING_HEALTH',
    target: 'Monitoring',
    method: 'MB-1 registry load + MB-2/MB-3 advisory availability',
    expected: 'Government source registry loads; detection/extraction advisory-only',
    executeNow: false,
  },
  {
    checkId: 'TELEGRAM_HEALTH',
    target: 'Telegram',
    method: 'TG-1 policy + config presence',
    expected: 'Automatic/live sending denied; delivery layer inactive for live',
    executeNow: false,
  },
  {
    checkId: 'REVIEW_QUEUE_HEALTH',
    target: 'Review Queue',
    method: 'RW-1 wiring diagnostics',
    expected: 'Review queue available in advisory mode; publishing denied',
    executeNow: false,
  },
  {
    checkId: 'PIPELINE_HEALTH',
    target: 'Pipeline',
    method: 'Program 5A health dashboard / MB-4 integration diagnostics',
    expected: 'Pipeline advisory health report available; no publish execution',
    executeNow: false,
  },
]);

/**
 * Prepare health verification plan (no runtime execution).
 * @param {object} [input]
 */
function prepareHealthVerificationPlan(input = {}) {
  const checks = [
    {
      checkId: 'PLAN_COMPLETE',
      passed: HEALTH_CHECKS.length === 6,
    },
    {
      checkId: 'NO_RUNTIME_EXECUTION',
      passed: HEALTH_CHECKS.every((c) => c.executeNow === false),
    },
    {
      checkId: 'COVERS_API',
      passed: HEALTH_CHECKS.some((c) => c.checkId === 'API_HEALTH'),
    },
    {
      checkId: 'COVERS_SCHEDULER',
      passed: HEALTH_CHECKS.some((c) => c.checkId === 'SCHEDULER_HEALTH'),
    },
    {
      checkId: 'COVERS_MONITORING',
      passed: HEALTH_CHECKS.some((c) => c.checkId === 'MONITORING_HEALTH'),
    },
    {
      checkId: 'COVERS_TELEGRAM',
      passed: HEALTH_CHECKS.some((c) => c.checkId === 'TELEGRAM_HEALTH'),
    },
    {
      checkId: 'COVERS_REVIEW_QUEUE',
      passed: HEALTH_CHECKS.some((c) => c.checkId === 'REVIEW_QUEUE_HEALTH'),
    },
    {
      checkId: 'COVERS_PIPELINE',
      passed: HEALTH_CHECKS.some((c) => c.checkId === 'PIPELINE_HEALTH'),
    },
  ];

  return deepFreeze({
    validationVersion: HEALTH_VERIFICATION_VERSION,
    part: 'F',
    reportId: 'DEP1_HEALTH_VERIFICATION_PLAN',
    advisoryOnly: true,
    productionActivated: false,
    runtimeExecuted: false,
    healthChecks: HEALTH_CHECKS.slice(),
    operatorNotes: [
      'Execute health checks only after AUTHORIZED state and controlled start',
      'Scheduler and Telegram live must remain disabled unless separately authorized',
      'Treat any unexpected publish/approve side-effect as rollback trigger',
    ],
    generatedAt: input.generatedAt || null,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Health verification plan prepared. No runtime health probes executed.',
  });
}

module.exports = {
  HEALTH_VERIFICATION_VERSION,
  HEALTH_CHECKS,
  prepareHealthVerificationPlan,
};
