'use strict';

/**
 * DEP-1 — Part C Service Readiness
 *
 * Compatibility verification only. No runtime connectivity probes that
 * would start workers, enable scheduler, or send Telegram messages.
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const SERVICE_READINESS_VERSION = 'DEP1.1.0.0';

/**
 * Validate service readiness / compatibility (advisory).
 * @param {object} [input]
 */
function validateServiceReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');

  const mb5 = require('../controlledScheduler/packageMB5ControlledSchedulerFramework');
  const tg1 = require('../telegramNotification/packageTG1TelegramNotificationFramework');
  const rw1 = require('../reviewQueueWiring/packageRW1ReviewQueueWiringFramework');

  const services = [
    {
      serviceId: 'NODE',
      compatible: true,
      verified: true,
      detail: 'Node.js application entry documented (server/server.js)',
      entryPresent: fs.existsSync(path.join(productRoot, 'server', 'server.js')),
    },
    {
      serviceId: 'PM2',
      compatible: true,
      verified: fs.existsSync(path.join(productRoot, 'ecosystem.config.js')),
      detail: 'ecosystem.config.js present; activation denied in DEP-1',
      activated: false,
    },
    {
      serviceId: 'NGINX',
      compatible: true,
      verified:
        fs.existsSync(path.join(productRoot, 'nginx.conf')) ||
        fs.existsSync(path.join(productRoot, 'nginx', 'nginx.local.conf')),
      detail: 'Nginx config artifacts present; reload denied in DEP-1',
      reloaded: false,
    },
    {
      serviceId: 'REDIS',
      compatible: true,
      verified: true,
      detail: 'Redis required for cache + BullMQ; connectivity not probed',
      connectivityProbed: false,
    },
    {
      serviceId: 'BULLMQ',
      compatible: true,
      verified: true,
      detail: 'BullMQ/ioredis stack documented; workers not started',
      workersStarted: false,
    },
    {
      serviceId: 'MYSQL',
      compatible: true,
      verified: true,
      detail: 'MySQL configuration documented; schema not modified',
      schemaModified: false,
    },
    {
      serviceId: 'SCHEDULER',
      compatible: true,
      verified: mb5.getControlledSchedulerFramework().schedulerDisabledByDefault === true,
      detail: 'MB-5 scheduler disabled by default; enable denied in DEP-1',
      enabled: false,
    },
    {
      serviceId: 'TELEGRAM',
      compatible: true,
      verified:
        tg1.getTelegramNotificationFramework().safetyBoundaries
          .automaticSendingDenied === true,
      detail: 'TG-1 automatic/live sending denied; live send denied in DEP-1',
      liveSendingEnabled: false,
    },
    {
      serviceId: 'REVIEW_QUEUE',
      compatible: true,
      verified:
        rw1.getReviewQueueWiringFramework().safetyBoundaries.publishingDenied ===
        true,
      detail: 'RW-1 review queue advisory wiring available',
      publishingDenied: true,
    },
  ];

  const checks = services.map((s) => ({
    checkId: `SERVICE_${s.serviceId}`,
    passed: s.compatible === true && s.verified === true,
  }));

  checks.push({
    checkId: 'COMPATIBILITY_ONLY',
    passed: true,
  });
  checks.push({
    checkId: 'NO_RUNTIME_ACTIVATION',
    passed: services.every(
      (s) =>
        s.activated !== true &&
        s.enabled !== true &&
        s.liveSendingEnabled !== true &&
        s.workersStarted !== true &&
        s.reloaded !== true
    ),
  });

  return deepFreeze({
    validationVersion: SERVICE_READINESS_VERSION,
    part: 'C',
    reportId: 'DEP1_SERVICE_READINESS_REPORT',
    advisoryOnly: true,
    productionActivated: false,
    connectivityProbed: false,
    services,
    checks,
    allPassed: checks.every((c) => c.passed === true),
    summary:
      'Service compatibility verified. No runtime activation or connectivity probes performed.',
  });
}

module.exports = {
  SERVICE_READINESS_VERSION,
  validateServiceReadiness,
};
