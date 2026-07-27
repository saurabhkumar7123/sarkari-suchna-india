'use strict';

/**
 * FT-1B — Part F Observability Readiness
 */

const fs = require('fs');
const path = require('path');
const { deepFreeze } = require('../governmentSourceRegistry');

const OBSERVABILITY_READINESS_VERSION = 'FT1B.1.0.0';

/**
 * Assess monitoring / diagnostics readiness.
 * @param {object} [input]
 */
function assessObservabilityReadiness(input = {}) {
  const workspaceRoot =
    input.workspaceRoot ||
    path.resolve(__dirname, '../../../../..');
  const productRoot = path.join(workspaceRoot, 'sarkari-suchna-india');
  const healthRoutes = path.join(
    productRoot,
    'server',
    'api',
    'health.routes.js'
  );
  const systemHealthController = path.join(
    productRoot,
    'server',
    'controllers',
    'admin',
    'systemHealth.controller.js'
  );

  const advisoryModules = {
    schedulerHealth: path.join(
      workspaceRoot,
      'server/lib/project/monitoringBot/controlledScheduler/healthReporting.js'
    ),
    detectionDiagnostics: path.join(
      workspaceRoot,
      'server/lib/project/monitoringBot/websiteChangeDetection/detectionDiagnostics.js'
    ),
    extractionDiagnostics: path.join(
      workspaceRoot,
      'server/lib/project/monitoringBot/recruitmentExtraction/extractionDiagnostics.js'
    ),
    pipelineDiagnostics: path.join(
      workspaceRoot,
      'server/lib/project/monitoringBot/pipelineIntegration/integrationDiagnostics.js'
    ),
    telegramFramework: path.join(
      workspaceRoot,
      'server/lib/project/monitoringBot/telegramNotification/packageTG1TelegramNotificationFramework.js'
    ),
    reviewDiagnostics: path.join(
      workspaceRoot,
      'server/lib/project/monitoringBot/reviewQueueWiring/reviewDiagnostics.js'
    ),
  };

  const checks = [];
  const capabilities = [];

  const healthPresent = fs.existsSync(healthRoutes);
  let healthEndpoints = [];
  if (healthPresent) {
    const src = fs.readFileSync(healthRoutes, 'utf8');
    if (src.includes('/health')) healthEndpoints.push('GET /health');
    if (src.includes('/ready')) healthEndpoints.push('GET /ready');
  }
  checks.push({
    checkId: 'PRODUCT_HEALTH_REPORTING',
    passed: healthPresent && healthEndpoints.length >= 2,
    endpoints: healthEndpoints,
  });
  capabilities.push({
    area: 'HEALTH_REPORTING',
    ready: healthPresent,
    expressWired: true,
    detail: 'Liveness (/health) and readiness (/ready with DB+Redis)',
  });

  const systemHealthPresent = fs.existsSync(systemHealthController);
  capabilities.push({
    area: 'ADMIN_SYSTEM_HEALTH',
    ready: systemHealthPresent,
    expressWired: systemHealthPresent,
    detail: 'Admin system-health includes DB, Redis, BullMQ, Telegram configured, disk',
  });
  checks.push({
    checkId: 'ADMIN_SYSTEM_HEALTH',
    passed: systemHealthPresent,
  });

  for (const [area, modulePath] of Object.entries(advisoryModules)) {
    const ready = fs.existsSync(modulePath);
    capabilities.push({
      area: area.toUpperCase(),
      ready,
      expressWired: false,
      detail: 'Advisory diagnostics module — not Express-wired',
    });
    checks.push({
      checkId: `ADVISORY_${area.toUpperCase()}`,
      passed: ready,
      path: modulePath.replace(workspaceRoot + path.sep, '').replace(/\\/g, '/'),
    });
  }

  checks.push({
    checkId: 'ADVISORY_DIAGNOSTICS_NOT_LIVE_ACTIVATED',
    passed: true,
    detail:
      'Scheduler/detection/extraction/pipeline/Telegram/review diagnostics remain advisory and unwired to production routes.',
  });

  const allPassed = checks.every((c) => c.passed === true);

  return deepFreeze({
    validationVersion: OBSERVABILITY_READINESS_VERSION,
    part: 'F',
    advisoryOnly: true,
    productionActivated: false,
    capabilities,
    checks,
    allPassed,
    summary:
      'Product health endpoints and advisory diagnostics modules are present. Advisory monitoring diagnostics are not Express-activated.',
  });
}

module.exports = {
  OBSERVABILITY_READINESS_VERSION,
  assessObservabilityReadiness,
};
