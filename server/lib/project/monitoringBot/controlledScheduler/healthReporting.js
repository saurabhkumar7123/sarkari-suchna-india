'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Scheduler Health Reporting
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const HEALTH_REPORTING_VERSION = 'MB5.1.0.0';

const HEALTH_STATUSES = Object.freeze({
  DISABLED: 'DISABLED',
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  DEGRADED: 'DEGRADED',
  CANCELLED: 'CANCELLED',
});

/**
 * Build an immutable health report from scheduler internals.
 * @param {object} [input]
 */
function generateSchedulerHealthReport(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const enabled = src.enabled === true;
  const activeExecutions =
    typeof src.activeExecutions === 'number' ? src.activeExecutions : 0;
  const historyCount =
    typeof src.historyCount === 'number' ? src.historyCount : 0;
  const recentErrors = Array.isArray(src.recentErrors)
    ? src.recentErrors.slice()
    : [];
  const lockCount = typeof src.lockCount === 'number' ? src.lockCount : 0;
  const selectedSources = Array.isArray(src.selectedSources)
    ? src.selectedSources.slice()
    : [];

  let status = HEALTH_STATUSES.DISABLED;
  if (enabled && activeExecutions > 0) status = HEALTH_STATUSES.RUNNING;
  else if (enabled && recentErrors.length > 0) status = HEALTH_STATUSES.DEGRADED;
  else if (enabled) status = HEALTH_STATUSES.IDLE;
  if (src.cancelled === true) status = HEALTH_STATUSES.CANCELLED;

  return deepFreeze({
    healthVersion: HEALTH_REPORTING_VERSION,
    status,
    enabled,
    disabledByDefault: true,
    backgroundExecutionDenied: true,
    cronDenied: true,
    osServiceDenied: true,
    automaticRetriesDenied: true,
    selectedSources,
    selectedSourceCount: selectedSources.length,
    activeExecutions,
    concurrencyLimit:
      typeof src.concurrencyLimit === 'number' ? src.concurrencyLimit : 1,
    lockCount,
    historyCount,
    recentErrors,
    rateLimiter: src.rateLimiter || null,
    cooldown: src.cooldown || null,
    lastInvocationAt: src.lastInvocationAt || null,
    timestamp:
      typeof src.timestamp === 'string' && src.timestamp.trim()
        ? src.timestamp.trim()
        : new Date().toISOString(),
    publishingDenied: true,
    approvalManualOnly: true,
  });
}

module.exports = {
  HEALTH_REPORTING_VERSION,
  HEALTH_STATUSES,
  generateSchedulerHealthReport,
};
