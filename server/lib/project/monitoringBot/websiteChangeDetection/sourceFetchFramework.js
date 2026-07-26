'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-2
 * Source Fetch Framework (Manual Invocation Only)
 *
 * Reusable fetch layer:
 *   - HTTP GET / HTTPS
 *   - Configurable headers
 *   - User-Agent
 *   - Timeout
 *   - Redirect policy
 *
 * Uses MB-1 monitoring configuration and crawl policy for defaults.
 * No scheduler. No background worker. No automatic retries.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { deepFreeze } = require('../governmentSourceRegistry');
const { DEFAULT_CRAWL_POLICY } = require('../crawlPolicy');
const { collectResponseMetadata } = require('./responseMetadata');
const { DIAGNOSTIC_CODES } = require('./detectionDiagnostics');

const SOURCE_FETCH_FRAMEWORK_VERSION = 'MB2.1.0.0';

const DEFAULT_USER_AGENT =
  'SarkariSuchnaMonitoringBot/MB-2 (+manual-change-detection; not-a-crawler-scheduler)';

const REDIRECT_STATUS_CODES = Object.freeze([301, 302, 303, 307, 308]);

function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  Object.keys(headers).forEach((key) => {
    const value = headers[key];
    if (value == null) return;
    out[String(key)] = Array.isArray(value) ? value.join(', ') : String(value);
  });
  return out;
}

/**
 * Resolve fetch options from MB-1 crawl/monitoring configuration.
 * Retry policy from MB-1 is intentionally ignored (no retries in MB-2).
 */
function resolveFetchOptions(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const crawlPolicy =
    src.crawlPolicy && typeof src.crawlPolicy === 'object'
      ? src.crawlPolicy
      : DEFAULT_CRAWL_POLICY;

  const timeoutMs =
    typeof src.timeoutMs === 'number' &&
    Number.isFinite(src.timeoutMs) &&
    src.timeoutMs > 0
      ? Math.floor(src.timeoutMs)
      : typeof crawlPolicy.requestTimeoutMs === 'number' &&
          crawlPolicy.requestTimeoutMs > 0
        ? Math.floor(crawlPolicy.requestTimeoutMs)
        : DEFAULT_CRAWL_POLICY.requestTimeoutMs;

  const maximumRedirects =
    typeof src.maximumRedirects === 'number' &&
    Number.isFinite(src.maximumRedirects) &&
    src.maximumRedirects >= 0
      ? Math.floor(src.maximumRedirects)
      : typeof crawlPolicy.maximumRedirects === 'number' &&
          crawlPolicy.maximumRedirects >= 0
        ? Math.floor(crawlPolicy.maximumRedirects)
        : DEFAULT_CRAWL_POLICY.maximumRedirects;

  const headers = normalizeHeaders(src.headers);
  if (!Object.keys(headers).some((k) => k.toLowerCase() === 'user-agent')) {
    headers['User-Agent'] =
      typeof src.userAgent === 'string' && src.userAgent.trim()
        ? src.userAgent.trim()
        : DEFAULT_USER_AGENT;
  } else if (typeof src.userAgent === 'string' && src.userAgent.trim()) {
    // Explicit userAgent wins over headers map
    const existingKey = Object.keys(headers).find(
      (k) => k.toLowerCase() === 'user-agent'
    );
    if (existingKey) delete headers[existingKey];
    headers['User-Agent'] = src.userAgent.trim();
  }

  return deepFreeze({
    method: 'GET',
    timeoutMs,
    maximumRedirects,
    headers,
    retriesDenied: true,
    maxRetries: 0,
    followRedirects: src.followRedirects !== false,
  });
}

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

/**
 * Freeze fetch outcome without recursively walking Buffer bytes.
 */
function freezeFetchOutcome(outcome) {
  const body = Buffer.isBuffer(outcome.body)
    ? outcome.body
    : Buffer.from(outcome.body || '');
  const rest = { ...outcome };
  delete rest.body;
  const frozenRest = deepFreeze(rest);
  return Object.freeze({
    ...frozenRest,
    body,
  });
}

function defaultHttpTransport(requestOptions) {
  return new Promise((resolve, reject) => {
    const url = new URL(requestOptions.url);
    const lib = url.protocol === 'https:' ? https : http;
    const headers = normalizeHeaders(requestOptions.headers);

    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    req.setTimeout(requestOptions.timeoutMs, () => {
      req.destroy(Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' }));
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Perform a single GET with optional redirect following.
 * No automatic retries.
 *
 * @param {object} input
 * @param {string} input.url
 * @param {object} [input.headers]
 * @param {string} [input.userAgent]
 * @param {number} [input.timeoutMs]
 * @param {number} [input.maximumRedirects]
 * @param {object} [input.crawlPolicy] MB-1 crawl policy
 * @param {Function} [input.transport] Injectable transport for tests
 */
async function fetchSource(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const startedAt = Date.now();
  const fetchTimestamp =
    typeof src.fetchTimestamp === 'string' && src.fetchTimestamp.trim()
      ? src.fetchTimestamp.trim()
      : new Date().toISOString();

  const options = resolveFetchOptions(src);
  const transport =
    typeof src.transport === 'function' ? src.transport : defaultHttpTransport;

  if (!isValidHttpUrl(src.url)) {
    return freezeFetchOutcome({
      fetchFrameworkVersion: SOURCE_FETCH_FRAMEWORK_VERSION,
      ok: false,
      success: false,
      url: typeof src.url === 'string' ? src.url : null,
      finalUrl: null,
      method: 'GET',
      body: Buffer.alloc(0),
      redirectCount: 0,
      redirectChain: Object.freeze([]),
      options,
      metadata: collectResponseMetadata({
        httpStatus: null,
        responseTimeMs: Date.now() - startedAt,
        headers: {},
        body: Buffer.alloc(0),
        fetchTimestamp,
        url: src.url,
      }),
      error: {
        code: DIAGNOSTIC_CODES.INVALID_URL,
        message: 'Invalid or missing HTTP(S) URL.',
      },
      timeout: false,
      redirectLoop: false,
      networkError: false,
      retriesPerformed: 0,
      manualInvocationOnly: true,
      schedulerDenied: true,
      workerDenied: true,
    });
  }

  let currentUrl = String(src.url).trim();
  const redirectChain = [];
  let redirectCount = 0;
  let lastResponse = null;

  try {
    while (true) {
      const response = await transport({
        url: currentUrl,
        headers: { ...options.headers },
        timeoutMs: options.timeoutMs,
        method: 'GET',
      });

      lastResponse = response;
      const statusCode = response && response.statusCode;

      if (
        options.followRedirects &&
        REDIRECT_STATUS_CODES.includes(statusCode)
      ) {
        const locationHeader =
          response.headers &&
          (response.headers.location || response.headers.Location);
        if (!locationHeader) {
          break;
        }

        redirectCount += 1;
        if (redirectCount > options.maximumRedirects) {
          const responseTimeMs = Date.now() - startedAt;
          return freezeFetchOutcome({
            fetchFrameworkVersion: SOURCE_FETCH_FRAMEWORK_VERSION,
            ok: false,
            success: false,
            url: String(src.url).trim(),
            finalUrl: currentUrl,
            method: 'GET',
            body: Buffer.isBuffer(response.body)
              ? response.body
              : Buffer.from(response.body || ''),
            redirectCount,
            redirectChain: Object.freeze(redirectChain.slice()),
            options,
            metadata: collectResponseMetadata({
              httpStatus: statusCode,
              responseTimeMs,
              headers: response.headers || {},
              body: response.body,
              fetchTimestamp,
              finalUrl: currentUrl,
              redirectCount,
            }),
            error: {
              code: DIAGNOSTIC_CODES.REDIRECT_LOOP,
              message: 'Maximum redirects exceeded.',
            },
            timeout: false,
            redirectLoop: true,
            networkError: false,
            retriesPerformed: 0,
            manualInvocationOnly: true,
            schedulerDenied: true,
            workerDenied: true,
          });
        }

        const nextUrl = new URL(String(locationHeader), currentUrl).toString();
        redirectChain.push(
          deepFreeze({
            from: currentUrl,
            to: nextUrl,
            statusCode,
          })
        );
        currentUrl = nextUrl;
        continue;
      }

      break;
    }
  } catch (err) {
    const responseTimeMs = Date.now() - startedAt;
    const code = err && err.code;
    const isTimeout =
      code === 'ETIMEDOUT' ||
      code === 'ESOCKETTIMEDOUT' ||
      (err && /timed?\s*out/i.test(String(err.message || '')));

    return freezeFetchOutcome({
      fetchFrameworkVersion: SOURCE_FETCH_FRAMEWORK_VERSION,
      ok: false,
      success: false,
      url: String(src.url).trim(),
      finalUrl: currentUrl,
      method: 'GET',
      body: Buffer.alloc(0),
      redirectCount,
      redirectChain: Object.freeze(redirectChain.slice()),
      options,
      metadata: collectResponseMetadata({
        httpStatus: null,
        responseTimeMs,
        headers: {},
        body: Buffer.alloc(0),
        fetchTimestamp,
        finalUrl: currentUrl,
        redirectCount,
      }),
      error: {
        code: isTimeout
          ? DIAGNOSTIC_CODES.TIMEOUT
          : DIAGNOSTIC_CODES.NETWORK_ERROR,
        message: err && err.message ? String(err.message) : 'Fetch failed.',
      },
      timeout: isTimeout,
      redirectLoop: false,
      networkError: !isTimeout,
      retriesPerformed: 0,
      manualInvocationOnly: true,
      schedulerDenied: true,
      workerDenied: true,
    });
  }

  const responseTimeMs = Date.now() - startedAt;
  const body = Buffer.isBuffer(lastResponse.body)
    ? lastResponse.body
    : Buffer.from(lastResponse.body || '');
  const statusCode = lastResponse.statusCode || 0;
  const ok = statusCode >= 200 && statusCode < 400;

  return freezeFetchOutcome({
    fetchFrameworkVersion: SOURCE_FETCH_FRAMEWORK_VERSION,
    ok,
    success: ok,
    url: String(src.url).trim(),
    finalUrl: currentUrl,
    method: 'GET',
    body,
    redirectCount,
    redirectChain: Object.freeze(redirectChain.slice()),
    options,
    metadata: collectResponseMetadata({
      httpStatus: statusCode,
      responseTimeMs,
      headers: lastResponse.headers || {},
      body,
      fetchTimestamp,
      finalUrl: currentUrl,
      redirectCount,
    }),
    error: ok
      ? null
      : {
          code: DIAGNOSTIC_CODES.HTTP_ERROR_STATUS,
          message: `HTTP status ${statusCode}`,
        },
    timeout: false,
    redirectLoop: false,
    networkError: false,
    retriesPerformed: 0,
    manualInvocationOnly: true,
    schedulerDenied: true,
    workerDenied: true,
  });
}

module.exports = {
  SOURCE_FETCH_FRAMEWORK_VERSION,
  DEFAULT_USER_AGENT,
  REDIRECT_STATUS_CODES,
  resolveFetchOptions,
  isValidHttpUrl,
  defaultHttpTransport,
  fetchSource,
};
