'use strict';

/**
 * DEP-1 — Part G Smoke Test Plan
 *
 * Smoke tests defined only. No production publishing. No runtime execution.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const SMOKE_TEST_PLAN_VERSION = 'DEP1.1.0.0';

const SMOKE_TESTS = Object.freeze([
  {
    testId: 'SMOKE_01_APPLICATION_STARTS',
    description: 'Application starts',
    expected: 'Process boots without fatal config errors',
    executeNow: false,
  },
  {
    testId: 'SMOKE_02_CONFIGURATION_LOADS',
    description: 'Configuration loads',
    expected: 'Required env keys resolve; NODE_ENV respected',
    executeNow: false,
  },
  {
    testId: 'SMOKE_03_SCHEDULER_DISABLED',
    description: 'Scheduler disabled',
    expected: 'MB-5 remains disabled by default; no cron/workers auto-started',
    executeNow: false,
  },
  {
    testId: 'SMOKE_04_TELEGRAM_DISABLED',
    description: 'Telegram disabled',
    expected: 'TG-1 live/automatic sending remains denied',
    executeNow: false,
  },
  {
    testId: 'SMOKE_05_REVIEW_QUEUE_AVAILABLE',
    description: 'Review Queue available',
    expected: 'RW-1 advisory review wiring available without DB write/publish',
    executeNow: false,
  },
  {
    testId: 'SMOKE_06_MONITORING_REGISTRY_LOADS',
    description: 'Monitoring registry loads',
    expected: 'MB-1 government source registry loads deterministically',
    executeNow: false,
  },
  {
    testId: 'SMOKE_07_NO_PRODUCTION_PUBLISHING',
    description: 'No production publishing',
    expected: 'No pages published; Program 5F publish remains unauthorized',
    executeNow: false,
  },
]);

/**
 * Prepare smoke test plan (no execution).
 * @param {object} [input]
 */
function prepareSmokeTestPlan(input = {}) {
  const checks = [
    {
      checkId: 'SMOKE_SUITE_DEFINED',
      passed: SMOKE_TESTS.length >= 7,
    },
    {
      checkId: 'NO_EXECUTION',
      passed: SMOKE_TESTS.every((t) => t.executeNow === false),
    },
    {
      checkId: 'INCLUDES_SCHEDULER_DISABLED',
      passed: SMOKE_TESTS.some((t) => t.testId === 'SMOKE_03_SCHEDULER_DISABLED'),
    },
    {
      checkId: 'INCLUDES_TELEGRAM_DISABLED',
      passed: SMOKE_TESTS.some((t) => t.testId === 'SMOKE_04_TELEGRAM_DISABLED'),
    },
    {
      checkId: 'INCLUDES_NO_PUBLISHING',
      passed: SMOKE_TESTS.some(
        (t) => t.testId === 'SMOKE_07_NO_PRODUCTION_PUBLISHING'
      ),
    },
  ];

  return deepFreeze({
    validationVersion: SMOKE_TEST_PLAN_VERSION,
    part: 'G',
    reportId: 'DEP1_SMOKE_TEST_PLAN',
    advisoryOnly: true,
    productionActivated: false,
    executed: false,
    tests: SMOKE_TESTS.slice(),
    generatedAt: input.generatedAt || null,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Smoke test plan prepared. Tests are not executed during DEP-1 preparation.',
  });
}

module.exports = {
  SMOKE_TEST_PLAN_VERSION,
  SMOKE_TESTS,
  prepareSmokeTestPlan,
};
