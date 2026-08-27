"use strict";

/**
 * Per-host politeness for live monitoring fetches.
 * Serializes same-host requests and applies crawl-delay / 429 backoff.
 * Different hosts proceed independently.
 */

const logger = require("../../utils/logger");
const { extractHostname } = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");

const DEFAULT_MIN_GAP_MS = Math.min(
  60000,
  Math.max(500, parseInt(process.env.UPDATE_HOST_MIN_GAP_MS || "2000", 10) || 2000)
);

const MAX_429_BACKOFF_MS = Math.min(
  60 * 60 * 1000,
  Math.max(30000, parseInt(process.env.UPDATE_HOST_429_MAX_BACKOFF_MS || "900000", 10) || 900000)
);

/** @type {Map<string, { chain: Promise<unknown>, nextAllowedAt: number, last429At: number }>} */
const hostState = new Map();

function hostKeyFromUrl(url) {
  const host = extractHostname(url);
  return host ? host.toLowerCase() : "";
}

function getState(hostKey) {
  if (!hostState.has(hostKey)) {
    hostState.set(hostKey, {
      chain: Promise.resolve(),
      nextAllowedAt: 0,
      last429At: 0
    });
  }
  return hostState.get(hostKey);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function parseRetryAfterMs(retryAfterHeader) {
  if (retryAfterHeader == null || retryAfterHeader === "") return null;
  const raw = String(retryAfterHeader).trim();
  if (/^\d+$/.test(raw)) {
    return Math.min(MAX_429_BACKOFF_MS, Math.max(1000, parseInt(raw, 10) * 1000));
  }
  const when = Date.parse(raw);
  if (!Number.isNaN(when)) {
    return Math.min(MAX_429_BACKOFF_MS, Math.max(1000, when - Date.now()));
  }
  return null;
}

/**
 * Record a 429 (or Retry-After) so subsequent same-host work waits.
 */
function noteHostRateLimited(url, retryAfterHeader) {
  const hostKey = hostKeyFromUrl(url);
  if (!hostKey) return;
  const state = getState(hostKey);
  const fromHeader = parseRetryAfterMs(retryAfterHeader);
  const backoff = fromHeader != null ? fromHeader : Math.min(MAX_429_BACKOFF_MS, DEFAULT_MIN_GAP_MS * 15);
  state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now() + backoff);
  state.last429At = Date.now();
  logger.warn("updates: host rate-limited / 429 backoff", {
    host: hostKey,
    backoffMs: backoff,
    retryAfter: retryAfterHeader || null
  });
}

/**
 * Apply Crawl-Delay from robots (ms) into nextAllowedAt.
 */
function noteHostCrawlDelay(url, crawlDelayMs) {
  const hostKey = hostKeyFromUrl(url);
  if (!hostKey) return;
  const delay = Math.max(0, Number(crawlDelayMs) || 0);
  if (delay <= 0) return;
  const state = getState(hostKey);
  state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now() + delay);
}

/**
 * Run an async fetch under per-host serialization + gap.
 * @template T
 * @param {string} url
 * @param {() => Promise<T>} fn
 * @param {{ minGapMs?: number, crawlDelayMs?: number }} [options]
 * @returns {Promise<T>}
 */
function withHostPoliteness(url, fn, options = {}) {
  const hostKey = hostKeyFromUrl(url) || "__unknown__";
  const state = getState(hostKey);
  const minGapMs = Math.max(
    0,
    Number.isFinite(options.minGapMs) ? options.minGapMs : DEFAULT_MIN_GAP_MS
  );
  const crawlDelayMs = Math.max(0, Number(options.crawlDelayMs) || 0);

  const run = state.chain.then(async () => {
    const waitMs = Math.max(0, state.nextAllowedAt - Date.now(), crawlDelayMs > 0 ? 0 : 0);
    const gapWait = Math.max(waitMs, 0);
    if (gapWait > 0) {
      logger.info("updates: host politeness wait", { host: hostKey, waitMs: gapWait });
      await sleep(gapWait);
    }
    const started = Date.now();
    try {
      return await fn();
    } finally {
      const elapsed = Date.now() - started;
      const nextGap = Math.max(minGapMs, crawlDelayMs);
      state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now() + Math.max(0, nextGap - Math.min(elapsed, nextGap)));
    }
  });

  // Prevent unbroken rejection chains from stalling the host
  state.chain = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

function resetHostPolitenessForTests() {
  hostState.clear();
}

function getHostPolitenessSnapshot() {
  const out = {};
  for (const [host, state] of hostState.entries()) {
    out[host] = {
      nextAllowedAt: state.nextAllowedAt,
      last429At: state.last429At,
      waitMs: Math.max(0, state.nextAllowedAt - Date.now())
    };
  }
  return out;
}

module.exports = {
  DEFAULT_MIN_GAP_MS,
  withHostPoliteness,
  noteHostRateLimited,
  noteHostCrawlDelay,
  parseRetryAfterMs,
  resetHostPolitenessForTests,
  getHostPolitenessSnapshot,
  hostKeyFromUrl
};
