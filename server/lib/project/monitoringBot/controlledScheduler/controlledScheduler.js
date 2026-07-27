'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-5
 * Controlled Scheduler Framework Core
 *
 * DISABLED by default.
 * No background execution unless explicitly invoked.
 * No cron installation. No OS services.
 */

const {
  deepFreeze,
  getDefaultGovernmentSourceRegistry,
  getGovernmentSource,
} = require('../governmentSourceRegistry');
const {
  createMonitoringConfigurationMap,
  getSourceMonitoringConfiguration,
} = require('../monitoringConfiguration');
const { createSourceLockManager } = require('./locking');
const { createRateLimiter } = require('./rateLimiter');
const { createCooldownTracker } = require('./cooldown');
const { createExecutionHistory } = require('./executionHistory');
const {
  generateSchedulerHealthReport,
  HEALTH_STATUSES,
} = require('./healthReporting');
const { coordinateSourceExecution } = require('./executionCoordinator');

const CONTROLLED_SCHEDULER_VERSION = 'MB5.1.0.0';

/**
 * Create a controlled scheduler instance (disabled by default).
 * @param {object} [options]
 */
function createControlledScheduler(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};

  let enabled = opts.enabled === true; // default false
  let selectedSources = Array.isArray(opts.selectedSources)
    ? opts.selectedSources.map((id) => String(id).trim()).filter(Boolean)
    : [];
  /** @type {Map<string, number>} */
  const intervalsBySource = new Map();
  if (opts.intervalsBySource && typeof opts.intervalsBySource === 'object') {
    for (const [sourceId, ms] of Object.entries(opts.intervalsBySource)) {
      if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
        intervalsBySource.set(sourceId, Math.floor(ms));
      }
    }
  }

  let concurrencyLimit =
    typeof opts.concurrencyLimit === 'number' &&
    Number.isFinite(opts.concurrencyLimit) &&
    opts.concurrencyLimit > 0
      ? Math.floor(opts.concurrencyLimit)
      : 1;

  let executionTimeoutMs =
    typeof opts.executionTimeoutMs === 'number' &&
    Number.isFinite(opts.executionTimeoutMs) &&
    opts.executionTimeoutMs > 0
      ? Math.floor(opts.executionTimeoutMs)
      : 60000;

  const locks = createSourceLockManager({
    defaultTtlMs: opts.lockTtlMs || executionTimeoutMs,
  });
  let rateLimiter = createRateLimiter({
    maxPerWindow: opts.maxPerWindow != null ? opts.maxPerWindow : 1,
    windowMs: opts.windowMs != null ? opts.windowMs : 60000,
  });
  const cooldown = createCooldownTracker({
    defaultCooldownMs:
      opts.defaultCooldownMs != null ? opts.defaultCooldownMs : 0,
  });
  const history = createExecutionHistory({
    maxEntries: opts.maxHistoryEntries || 100,
  });

  /** @type {Map<string, { cancelToken: { cancelled: boolean }, sourceId: string }>} */
  const active = new Map();
  let lastInvocationAt = null;
  const recentErrors = [];

  /** @type {Map<string, number>} last started timestamps for interval gating */
  const lastStartedBySource = new Map();

  function enable() {
    enabled = true;
    return deepFreeze({ enabled: true });
  }

  function disable() {
    enabled = false;
    return deepFreeze({ enabled: false });
  }

  function isEnabled() {
    return enabled === true;
  }

  function selectSources(sourceIds) {
    selectedSources = Array.isArray(sourceIds)
      ? sourceIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    return deepFreeze({ selectedSources: selectedSources.slice() });
  }

  function getSelectedSources() {
    return deepFreeze(selectedSources.slice());
  }

  function setSourceInterval(sourceId, intervalMs) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) return deepFreeze({ ok: false, reason: 'INVALID_SOURCE_ID' });
    if (
      typeof intervalMs !== 'number' ||
      !Number.isFinite(intervalMs) ||
      intervalMs <= 0
    ) {
      return deepFreeze({ ok: false, reason: 'INVALID_INTERVAL' });
    }
    intervalsBySource.set(id, Math.floor(intervalMs));
    return deepFreeze({ ok: true, sourceId: id, intervalMs: Math.floor(intervalMs) });
  }

  function getSourceInterval(sourceId, monitoringConfiguration) {
    const id =
      typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : null;
    if (!id) return null;
    if (intervalsBySource.has(id)) return intervalsBySource.get(id);
    const configMap =
      monitoringConfiguration ||
      createMonitoringConfigurationMap({
        sources: getDefaultGovernmentSourceRegistry().sources,
      });
    const cfg = getSourceMonitoringConfiguration(configMap, id);
    return cfg ? cfg.defaultIntervalMs : null;
  }

  function setConcurrencyLimit(limit) {
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      return deepFreeze({ ok: false, reason: 'INVALID_LIMIT' });
    }
    concurrencyLimit = Math.floor(limit);
    return deepFreeze({ ok: true, concurrencyLimit });
  }

  function setExecutionTimeoutMs(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
      return deepFreeze({ ok: false, reason: 'INVALID_TIMEOUT' });
    }
    executionTimeoutMs = Math.floor(ms);
    return deepFreeze({ ok: true, executionTimeoutMs });
  }

  function setRateLimit(config = {}) {
    rateLimiter = rateLimiter.configure(config);
    return deepFreeze({
      ok: true,
      maxPerWindow: rateLimiter.maxPerWindow,
      windowMs: rateLimiter.windowMs,
    });
  }

  function setSourceCooldown(sourceId, cooldownMs) {
    const ok = cooldown.setCooldown(sourceId, cooldownMs);
    return deepFreeze({ ok, sourceId, cooldownMs });
  }

  function cancel(executionId) {
    const activeExec = active.get(executionId);
    if (!activeExec) {
      return deepFreeze({ cancelled: false, reason: 'NOT_ACTIVE' });
    }
    activeExec.cancelToken.cancelled = true;
    return deepFreeze({ cancelled: true, executionId });
  }

  function cancelAll() {
    const ids = [];
    for (const [executionId, entry] of active.entries()) {
      entry.cancelToken.cancelled = true;
      ids.push(executionId);
    }
    return deepFreeze({ cancelled: true, executionIds: ids });
  }

  function getHealth() {
    return generateSchedulerHealthReport({
      enabled,
      selectedSources,
      activeExecutions: active.size,
      concurrencyLimit,
      historyCount: history.snapshot().count,
      lockCount: locks.snapshot().count,
      recentErrors: recentErrors.slice(-10),
      rateLimiter: rateLimiter.snapshot(),
      cooldown: cooldown.snapshot(),
      lastInvocationAt,
      cancelled: false,
    });
  }

  function getHistory(limit) {
    return history.list(limit);
  }

  function isDue(sourceId, at = Date.now(), monitoringConfiguration) {
    const intervalMs = getSourceInterval(sourceId, monitoringConfiguration);
    if (intervalMs == null) return true;
    const last = lastStartedBySource.get(sourceId);
    if (last == null) return true;
    return at - last >= intervalMs;
  }

  /**
   * Explicit controlled invocation — the only way to run work.
   * Does not install cron or start background loops.
   *
   * @param {object} [invocation]
   */
  async function invoke(invocation = {}) {
    const inv = invocation && typeof invocation === 'object' ? invocation : {};
    lastInvocationAt = new Date().toISOString();

    // Disabled by default. Explicit allowWhenDisabled is for controlled diagnostics only.
    if (!enabled && inv.allowWhenDisabled !== true) {
      return deepFreeze({
        invoked: false,
        reason: 'SCHEDULER_DISABLED',
        enabled: false,
        results: [],
        health: getHealth(),
        background: false,
        cronInstalled: false,
        publishingDenied: true,
      });
    }

    const sourceRegistry =
      inv.sourceRegistry || getDefaultGovernmentSourceRegistry();
    const monitoringConfiguration =
      inv.monitoringConfiguration ||
      createMonitoringConfigurationMap({ sources: sourceRegistry.sources });

    const requested = Array.isArray(inv.sourceIds)
      ? inv.sourceIds.map((id) => String(id).trim()).filter(Boolean)
      : selectedSources.slice();

    const targets = requested.length
      ? requested
      : (sourceRegistry.sources || [])
          .map((s) => s.sourceId || s.id)
          .filter(Boolean);

    const results = [];
    const queue = targets.slice();

    async function runOne(sourceId) {
      const executionId = `sched_${sourceId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const registered = getGovernmentSource(sourceRegistry, sourceId);
      if (
        registered &&
        registered.active === false &&
        inv.allowInactiveSources !== true
      ) {
        return createSkipped(executionId, sourceId, 'SOURCE_INACTIVE', {
          active: false,
        });
      }

      const monCfg = getSourceMonitoringConfiguration(
        monitoringConfiguration,
        sourceId
      );
      if (
        monCfg &&
        monCfg.monitoringEnabled === false &&
        inv.allowMonitoringDisabled !== true
      ) {
        return createSkipped(executionId, sourceId, 'MONITORING_DISABLED', {
          monitoringEnabled: false,
        });
      }

      if (!isDue(sourceId, Date.now(), monitoringConfiguration) && !inv.ignoreInterval) {
        return deepFreeze({
          executionId,
          sourceId,
          status: 'SKIPPED',
          reason: 'INTERVAL_NOT_ELAPSED',
        });
      }

      const cooldownCheck = cooldown.canRun(
        sourceId,
        Date.now(),
        inv.cooldownMs
      );
      if (!cooldownCheck.allowed && !inv.ignoreCooldown) {
        return createSkipped(executionId, sourceId, 'COOLDOWN_ACTIVE', cooldownCheck);
      }

      const rate = rateLimiter.allow(sourceId);
      if (!rate.allowed && !inv.ignoreRateLimit) {
        return createSkipped(executionId, sourceId, 'RATE_LIMITED', rate);
      }

      const lock = locks.tryAcquire(sourceId, executionId, executionTimeoutMs);
      if (!lock.acquired && !inv.ignoreLock) {
        return createSkipped(executionId, sourceId, 'LOCKED', lock);
      }

      if (active.size >= concurrencyLimit && !inv.ignoreConcurrency) {
        locks.release(sourceId, executionId);
        return createSkipped(executionId, sourceId, 'CONCURRENCY_LIMIT', {
          concurrencyLimit,
          active: active.size,
        });
      }

      const cancelToken = { cancelled: false };
      active.set(executionId, { cancelToken, sourceId });
      lastStartedBySource.set(sourceId, Date.now());

      try {
        const result = await coordinateSourceExecution({
          ...inv,
          sourceId,
          executionId,
          cancelToken,
          executionTimeoutMs:
            inv.executionTimeoutMs != null
              ? inv.executionTimeoutMs
              : executionTimeoutMs,
          sourceRegistry,
          monitoringConfiguration,
        });
        history.record(result);
        cooldown.markFinished(sourceId, Date.now(), inv.cooldownMs);
        if (result.errors && result.errors.length) {
          recentErrors.push({
            sourceId,
            executionId,
            at: result.finished,
            errors: result.errors,
          });
          while (recentErrors.length > 20) recentErrors.shift();
        }
        return result;
      } catch (error) {
        const failure = deepFreeze({
          executionId,
          sourceId,
          status: 'FAILED',
          errors: [
            {
              code: 'INVOKE_EXCEPTION',
              message: error && error.message ? error.message : String(error),
            },
          ],
        });
        history.record(failure);
        recentErrors.push({
          sourceId,
          executionId,
          at: new Date().toISOString(),
          errors: failure.errors,
        });
        return failure;
      } finally {
        active.delete(executionId);
        locks.release(sourceId, executionId);
      }
    }

    function createSkipped(executionId, sourceId, reason, details) {
      const skipped = deepFreeze({
        executionId,
        source: sourceId,
        sourceId,
        status: 'SKIPPED',
        reason,
        details,
        started: new Date().toISOString(),
        finished: new Date().toISOString(),
        durationMs: 0,
        errors: [],
        warnings: [{ code: reason, message: reason }],
        publishingDenied: true,
      });
      history.record(skipped);
      return skipped;
    }

    // Process with concurrency limit (no background loop)
    const workers = [];
    const workerCount = Math.max(1, Math.min(concurrencyLimit, queue.length || 1));

    for (let i = 0; i < workerCount; i += 1) {
      workers.push(
        (async () => {
          while (queue.length) {
            const sourceId = queue.shift();
            if (!sourceId) break;
            const result = await runOne(sourceId);
            results.push(result);
          }
        })()
      );
    }

    await Promise.all(workers);

    return deepFreeze({
      invoked: true,
      reason: 'EXPLICIT_INVOCATION',
      enabled,
      background: false,
      cronInstalled: false,
      osServiceStarted: false,
      automaticRetries: false,
      results,
      health: getHealth(),
      publishingDenied: true,
      approvalManualOnly: true,
    });
  }

  return {
    schedulerVersion: CONTROLLED_SCHEDULER_VERSION,
    enable,
    disable,
    isEnabled,
    selectSources,
    getSelectedSources,
    setSourceInterval,
    getSourceInterval,
    setConcurrencyLimit,
    setExecutionTimeoutMs,
    setRateLimit,
    setSourceCooldown,
    cancel,
    cancelAll,
    getHealth,
    getHistory,
    isDue,
    invoke,
    // exposed for tests
    _internals: {
      locks,
      rateLimiter: () => rateLimiter,
      cooldown,
      history,
      active,
      get concurrencyLimit() {
        return concurrencyLimit;
      },
      get executionTimeoutMs() {
        return executionTimeoutMs;
      },
    },
  };
}

module.exports = {
  CONTROLLED_SCHEDULER_VERSION,
  HEALTH_STATUSES,
  createControlledScheduler,
};
