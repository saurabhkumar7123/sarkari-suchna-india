'use strict';

/**
 * FT-1B — Part G Performance Baseline (Advisory)
 *
 * Creates advisory expectations only. No optimization.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const PERFORMANCE_BASELINE_VERSION = 'FT1B.1.0.0';

/**
 * Create advisory performance baseline for monitoring platform.
 * @param {object} [input]
 */
function createPerformanceBaseline(input = {}) {
  const generatedAt =
    typeof input.generatedAt === 'string'
      ? input.generatedAt
      : '2026-07-20T00:00:00.000Z';

  const baselines = [
    {
      metricId: 'SCHEDULER_THROUGHPUT',
      unit: 'sources_per_manual_invocation',
      advisoryExpectation:
        'MB-5 concurrency default 1; product UPDATE_WORKER_CONCURRENCY default 5 (when product scheduler active in DEP-1).',
      targetHint: '≤ configured concurrency; no automatic retries in advisory path',
      measuredInFt1b: false,
    },
    {
      metricId: 'DETECTION_LATENCY',
      unit: 'ms_per_source',
      advisoryExpectation:
        'Dominated by HTTP fetch + fingerprint; mock transports in tests are near-instant.',
      targetHint: 'p95 < 5000ms per source on typical government sites (operator-measured in DEP-1)',
      measuredInFt1b: false,
    },
    {
      metricId: 'EXTRACTION_LATENCY',
      unit: 'ms_per_document',
      advisoryExpectation:
        'Cheerio/parser-bound; advisory MB-3 runs in-process without DB writes.',
      targetHint: 'p95 < 2000ms for typical HTML recruitment pages',
      measuredInFt1b: false,
    },
    {
      metricId: 'PIPELINE_LATENCY',
      unit: 'ms_end_to_end_advisory',
      advisoryExpectation:
        'MB-4 advisory pipeline is synchronous composition without publish.',
      targetHint: 'p95 < 10000ms detection→preview for single source',
      measuredInFt1b: false,
    },
    {
      metricId: 'NOTIFICATION_LATENCY',
      unit: 'ms_per_notification',
      advisoryExpectation:
        'TG-1 null/memory transport is instantaneous; live Telegram (product) depends on Telegram API RTT.',
      targetHint: 'Live path p95 < 3000ms when explicitly enabled in DEP-1',
      measuredInFt1b: false,
    },
    {
      metricId: 'MEMORY_USAGE',
      unit: 'rss_mb',
      advisoryExpectation:
        'PM2_MAX_MEMORY available as guardrail; advisory frameworks are ephemeral per invocation.',
      targetHint: 'Web process steady-state within PM2 max_memory_restart budget',
      measuredInFt1b: false,
    },
    {
      metricId: 'CPU_EXPECTATIONS',
      unit: 'relative',
      advisoryExpectation:
        'CPU spikes expected during HTML parse/fingerprint batches; cluster mode spreads HTTP load.',
      targetHint: 'Avoid overlapping heavy worker concurrency beyond HEAVY_TASK_WORKER_CONCURRENCY',
      measuredInFt1b: false,
    },
  ];

  return deepFreeze({
    validationVersion: PERFORMANCE_BASELINE_VERSION,
    part: 'G',
    advisoryOnly: true,
    productionActivated: false,
    optimizationPerformed: false,
    loadTestExecuted: false,
    generatedAt,
    baselines,
    checks: [
      {
        checkId: 'ADVISORY_BASELINE_DEFINED',
        passed: true,
        metricCount: baselines.length,
      },
      {
        checkId: 'NO_OPTIMIZATION_IN_FT1B',
        passed: true,
      },
    ],
    allPassed: true,
    summary:
      'Advisory performance baselines recorded for operator measurement during DEP-1. No optimization or load testing executed in FT-1B.',
  });
}

module.exports = {
  PERFORMANCE_BASELINE_VERSION,
  createPerformanceBaseline,
};
