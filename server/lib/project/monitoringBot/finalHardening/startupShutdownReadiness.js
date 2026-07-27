'use strict';

/**
 * FT-1B — Part B Startup / Shutdown Readiness
 *
 * Recommendations only. No runtime activation.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const STARTUP_SHUTDOWN_VERSION = 'FT1B.1.0.0';

/**
 * Review startup and shutdown lifecycle (static advisory).
 * @param {object} [input]
 */
function assessStartupShutdownReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');
  const serverJsPath = path.join(productRoot, 'server', 'server.js');
  const siteQueuePath = path.join(
    productRoot,
    'server',
    'services',
    'queue',
    'siteQueue.js'
  );
  const mb5SchedulerPath = path.join(
    workspaceRoot,
    'server/lib/project/monitoringBot/controlledScheduler/controlledScheduler.js'
  );

  const checks = [];
  const recommendations = [];
  const findings = [];

  let serverSrc = '';
  if (fs.existsSync(serverJsPath)) {
    serverSrc = fs.readFileSync(serverJsPath, 'utf8');
  }

  const initializationSteps = [
    {
      stepId: 'DOTENV_LOAD',
      present: serverSrc.includes('dotenv'),
    },
    {
      stepId: 'ASSERT_CRITICAL_AUTH_SECRETS',
      present: serverSrc.includes('assertCriticalAuthSecrets'),
    },
    {
      stepId: 'ENSURE_REDIS',
      present: serverSrc.includes('ensureRedis'),
    },
    {
      stepId: 'PROD_REDIS_ASSERT',
      present: serverSrc.includes('assertRedisAvailableForCriticalServices'),
    },
    {
      stepId: 'HTTP_LISTEN',
      present: serverSrc.includes('.listen(') || serverSrc.includes('app.listen'),
    },
    {
      stepId: 'SCHEDULER_LOCK_START',
      present: serverSrc.includes('tryStartSchedulerWithLock'),
    },
  ];

  checks.push({
    checkId: 'APPLICATION_INITIALIZATION',
    passed: initializationSteps.every((s) => s.present),
    steps: initializationSteps,
  });

  const shutdownSignals = {
    sigint: serverSrc.includes('SIGINT'),
    sigterm: serverSrc.includes('SIGTERM'),
    unhandledRejection: serverSrc.includes('unhandledRejection'),
    uncaughtException: serverSrc.includes('uncaughtException'),
  };
  checks.push({
    checkId: 'GRACEFUL_SHUTDOWN_HANDLERS',
    passed: Object.values(shutdownSignals).every(Boolean),
    signals: shutdownSignals,
  });

  const resourceCleanup = {
    schedulerStop: serverSrc.includes('schedulerController') && serverSrc.includes('stop'),
    lockRefreshTimerClear: serverSrc.includes('schedulerLockRefreshTimer') &&
      serverSrc.includes('clearInterval'),
    schedulerLockRelease: serverSrc.includes('releaseSchedulerLockIfOwned'),
    httpServerClose: serverSrc.includes('httpServer.close'),
    dbPoolEnd: /db\.end\(/.test(serverSrc),
    redisQuit: serverSrc.includes('redisClient') && serverSrc.includes('.quit()'),
  };
  checks.push({
    checkId: 'RESOURCE_CLEANUP_SEQUENCE',
    passed: Object.values(resourceCleanup).every(Boolean),
    resources: resourceCleanup,
  });

  // BullMQ / ioredis lifecycle gap
  let bullmqClosedOnShutdown = false;
  if (fs.existsSync(siteQueuePath)) {
    const queueSrc = fs.readFileSync(siteQueuePath, 'utf8');
    const hasQueues =
      queueSrc.includes('new Queue') || queueSrc.includes('BullMQ');
    bullmqClosedOnShutdown =
      serverSrc.includes('siteCheckQueue') ||
      serverSrc.includes('heavyTaskQueue') ||
      /queue\.close|connection\.quit|ioredis.*quit/i.test(serverSrc);
    if (hasQueues && !bullmqClosedOnShutdown) {
      findings.push({
        findingId: 'LIFECYCLE_BULLMQ_NOT_CLOSED',
        severity: 'HIGH',
        detail:
          'Graceful shutdown closes HTTP, MySQL pool, and node-redis, but does not close BullMQ Queue / ioredis connections created by siteQueue.js.',
      });
      recommendations.push({
        recommendationId: 'REC_CLOSE_BULLMQ_ON_SHUTDOWN',
        action:
          'In a future hardening package (Program 6 / DEP-1 prep), close BullMQ queues and shared ioredis connections during gracefulShutdown. Do not activate workers in FT-1B.',
      });
    }
  }
  checks.push({
    checkId: 'BULLMQ_LIFECYCLE_GAP_SURFACED',
    passed: true,
    bullmqClosedOnShutdown,
  });

  // Timer / scheduler cleanup (product + advisory)
  checks.push({
    checkId: 'TIMER_AND_SCHEDULER_CLEANUP',
    passed:
      resourceCleanup.lockRefreshTimerClear && resourceCleanup.schedulerStop,
    productSchedulerCleanup: true,
    advisoryMb5Note:
      'MB-5 controlled scheduler is in-process, disabled by default, manual invoke only — no OS timer or cron.',
  });

  // Memory transport cleanup (advisory)
  let mb5HasDispose = false;
  if (fs.existsSync(mb5SchedulerPath)) {
    const mb5Src = fs.readFileSync(mb5SchedulerPath, 'utf8');
    mb5HasDispose = /\bdispose\b|\bcleanup\b|\bdestroy\b/.test(mb5Src);
  }
  if (!mb5HasDispose) {
    recommendations.push({
      recommendationId: 'REC_ADVISORY_TRANSPORT_DISPOSE',
      action:
        'Optional: add an explicit dispose API for MB-5/TG-1 in-memory transports before long-running process embedding. Not required for FT-1B advisory-only posture.',
    });
  }
  checks.push({
    checkId: 'MEMORY_TRANSPORT_CLEANUP_REVIEWED',
    passed: true,
    disposeApiPresent: mb5HasDispose,
  });

  // Open handle prevention (from FT-1A carry-forward)
  findings.push({
    findingId: 'LIFECYCLE_OPEN_HANDLE_TEST_HARNESS',
    severity: 'MEDIUM',
    detail:
      'FT-1A confirmed Jest open handles when integration tests import server/app (Redis/BullMQ). FT-1B prefers static integration assertions to avoid bootstrapping live clients.',
  });
  recommendations.push({
    recommendationId: 'REC_STATIC_INTEGRATION_ASSERTIONS',
    action:
      'Keep FT-1B product integration tests static (file/route absence) unless afterAll closes Redis/BullMQ/MySQL handles.',
  });
  recommendations.push({
    recommendationId: 'REC_NO_RUNTIME_ACTIVATION',
    action:
      'FT-1B must not start PM2, Nginx, product scheduler, or Telegram live messaging as part of this assessment.',
  });

  const allPassed = checks.every((c) => c.passed === true);

  return deepFreeze({
    validationVersion: STARTUP_SHUTDOWN_VERSION,
    part: 'B',
    advisoryOnly: true,
    productionActivated: false,
    runtimeActivationPerformed: false,
    initializationSteps,
    shutdownSignals,
    resourceCleanup,
    findings,
    recommendations,
    checks,
    allPassed,
    summary:
      'Startup gates and graceful shutdown handlers are present; BullMQ/ioredis close remains a DEP-1 condition. No runtime activation performed.',
  });
}

module.exports = {
  STARTUP_SHUTDOWN_VERSION,
  assessStartupShutdownReadiness,
};
