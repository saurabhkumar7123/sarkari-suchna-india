"use strict";

/**
 * Central monitoring HTTP safety layer (Phase 1).
 *
 * Technically enforces:
 * - GET only (POST/PUT/PATCH/DELETE rejected before network I/O)
 * - Official-host / private-host policy
 * - Hop-by-hop safe redirects
 * - Response body size limits (fail closed)
 * - Automation master kill-switch for live automation fetches
 *
 * Admin verification paths may set allowWhenAutomationDormant=true so operators
 * can verify sources while automation remains OFF.
 */

const axios = require("axios");
const {
  isApprovedOfficialMonitoringUrl,
  extractHostname
} = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");
const {
  isPrivateOrInternalHostname
} = require("./monitoringUrlSafety");
const { isMonitoringFetchPermitted } = require("../../config/automationControlPlane");
const {
  SECURITY_EVENT_TYPES,
  recordBlockedSecurityEvent
} = require("./monitoringSecurityAudit");

const MONITORING_BOT_UA =
  process.env.UPDATE_BOT_USER_AGENT ||
  "SarkariSuchnaMonitor/1.0 (+https://sarkarisuchna.in; read-only official monitoring)";

const ALLOWED_METHODS = new Set(["GET"]);
const BLOCKED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE", "CONNECT"]);

/** Default 2 MiB — notice/list HTML pages; far below PDF upload limit (10 MiB). */
const DEFAULT_MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_SAFE_REDIRECTS = 5;

function getMaxHtmlBytes() {
  const raw = parseInt(process.env.UPDATE_MAX_HTML_BYTES || String(DEFAULT_MAX_HTML_BYTES), 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_HTML_BYTES;
  // Hard ceiling 8 MiB to prevent absurd env values.
  return Math.min(8 * 1024 * 1024, raw);
}

class MonitoringHttpSafetyError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.name = "MonitoringHttpSafetyError";
    this.code = code;
    this.blocked = true;
    this.securityEventType = extra.securityEventType || null;
    this.requestedUrl = extra.requestedUrl || null;
    this.destinationUrl = extra.destinationUrl || null;
    this.requestedMethod = extra.requestedMethod || null;
    this.statusCode = extra.statusCode || 400;
  }
}

function normalizeMethod(method) {
  return String(method || "GET")
    .trim()
    .toUpperCase();
}

function assertUrlPolicy(rawUrl, { requireOfficialHost = true } = {}) {
  const url = String(rawUrl || "").trim();
  if (!url) {
    throw new MonitoringHttpSafetyError("INVALID_URL", "Monitoring URL is required.", {
      securityEventType: SECURITY_EVENT_TYPES.INVALID_URL,
      requestedUrl: url,
      statusCode: 400
    });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new MonitoringHttpSafetyError("INVALID_URL", "Monitoring URL is malformed.", {
      securityEventType: SECURITY_EVENT_TYPES.INVALID_URL,
      requestedUrl: url,
      statusCode: 400
    });
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new MonitoringHttpSafetyError(
      "UNSUPPORTED_PROTOCOL",
      "Monitoring URL must use http or https.",
      {
        securityEventType: SECURITY_EVENT_TYPES.UNSUPPORTED_PROTOCOL,
        requestedUrl: url,
        statusCode: 400
      }
    );
  }

  const hostname = extractHostname(url) || parsed.hostname.toLowerCase();
  if (!hostname || isPrivateOrInternalHostname(hostname) || isPrivateOrInternalHostname(parsed.hostname)) {
    throw new MonitoringHttpSafetyError(
      "UNAPPROVED_HOST",
      "Monitoring URL must not target private or internal hosts.",
      {
        securityEventType: SECURITY_EVENT_TYPES.UNAPPROVED_HOST,
        requestedUrl: url,
        statusCode: 400
      }
    );
  }

  if (requireOfficialHost && !isApprovedOfficialMonitoringUrl(url)) {
    throw new MonitoringHttpSafetyError(
      "UNAPPROVED_HOST",
      "Monitoring URL host is not an approved official source.",
      {
        securityEventType: SECURITY_EVENT_TYPES.UNAPPROVED_HOST,
        requestedUrl: url,
        statusCode: 400
      }
    );
  }

  return { url, parsed, hostname };
}

async function rejectBlocked(err, context = {}) {
  if (err.securityEventType) {
    await recordBlockedSecurityEvent({
      eventType: err.securityEventType,
      reason: err.message,
      action: err.code || err.securityEventType,
      requestedMethod: err.requestedMethod || context.method || null,
      requestedUrl: err.requestedUrl || context.url || null,
      destinationUrl: err.destinationUrl || null,
      siteId: context.siteId != null ? context.siteId : null,
      detail: context.detail || null
    }).catch(() => null);
  }
  throw err;
}

/**
 * Fail-closed method firewall. Must run before any network I/O.
 */
async function assertMonitoringHttpMethodAllowed(method, context = {}) {
  const normalized = normalizeMethod(method);
  if (ALLOWED_METHODS.has(normalized)) {
    return normalized;
  }

  const err = new MonitoringHttpSafetyError(
    "BLOCKED_HTTP_METHOD",
    `HTTP method ${normalized} is prohibited for monitoring requests.`,
    {
      securityEventType: SECURITY_EVENT_TYPES.BLOCKED_HTTP_METHOD,
      requestedMethod: normalized,
      requestedUrl: context.url || null,
      statusCode: 403
    }
  );
  await rejectBlocked(err, context);
  return normalized;
}

function assertRedirectDestinationAllowed(nextUrl, approvedOriginHost) {
  let validated;
  try {
    validated = assertUrlPolicy(nextUrl, { requireOfficialHost: true });
  } catch (err) {
    if (err instanceof MonitoringHttpSafetyError) {
      throw new MonitoringHttpSafetyError(
        "UNSAFE_REDIRECT",
        err.code === "UNAPPROVED_HOST"
          ? "Redirect leads to an unapproved host."
          : err.message,
        {
          securityEventType: SECURITY_EVENT_TYPES.UNSAFE_REDIRECT,
          requestedUrl: null,
          destinationUrl: nextUrl,
          statusCode: 400
        }
      );
    }
    throw err;
  }
  const nextHost = validated.hostname;
  const originHost = String(approvedOriginHost || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  const normalizedNext = String(nextHost || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");

  // Same-host family only: reject cross-org redirects even if both official.
  if (originHost && normalizedNext && originHost !== normalizedNext) {
    const related =
      normalizedNext.endsWith(`.${originHost}`) || originHost.endsWith(`.${normalizedNext}`);
    if (!related) {
      throw new MonitoringHttpSafetyError(
        "UNSAFE_REDIRECT",
        "Redirect leads to a different host than the approved monitoring URL.",
        {
          securityEventType: SECURITY_EVENT_TYPES.UNSAFE_REDIRECT,
          requestedUrl: null,
          destinationUrl: nextUrl,
          statusCode: 400
        }
      );
    }
  }

  return validated;
}

/**
 * Manual redirect following with per-hop host policy.
 * Does not contact unapproved destinations.
 */
async function fetchWithSafeRedirects(url, options = {}) {
  const maxRedirects =
    Number.isFinite(options.maxRedirects) && options.maxRedirects >= 0
      ? Math.min(MAX_SAFE_REDIRECTS, options.maxRedirects)
      : MAX_SAFE_REDIRECTS;
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : getMaxHtmlBytes();
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 25000;
  const headers = {
    "User-Agent": options.userAgent || MONITORING_BOT_UA,
    Accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...(options.headers || {})
  };
  // Never forward cookies/auth.
  delete headers.Cookie;
  delete headers.cookie;
  delete headers.Authorization;
  delete headers.authorization;

  const origin = assertUrlPolicy(url, { requireOfficialHost: options.requireOfficialHost !== false });
  let current = origin.url;
  const chain = [];

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let response;
    try {
      response = await axios.get(current, {
        timeout,
        maxRedirects: 0,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        responseType: options.responseType || "text",
        transformResponse: options.transformResponse || [(data) => data],
        validateStatus: () => true,
        headers,
        method: "GET",
        params: options.params
      });
    } catch (err) {
      const code = err && err.code ? String(err.code) : "";
      if (code === "ERR_FR_MAX_BODY_LENGTH_EXCEEDED" || code === "ERR_BAD_RESPONSE") {
        const tooLarge = new MonitoringHttpSafetyError(
          "RESPONSE_TOO_LARGE",
          `Monitoring response exceeded max size (${maxBytes} bytes).`,
          {
            securityEventType: SECURITY_EVENT_TYPES.RESPONSE_TOO_LARGE,
            requestedUrl: current,
            statusCode: 413
          }
        );
        await rejectBlocked(tooLarge, { url: current, siteId: options.siteId, method: "GET" });
      }
      throw err;
    }

    const status = Number(response.status || 0);
    chain.push({ url: current, status });

    const body = response.data;
    const bodyBytes =
      typeof body === "string"
        ? Buffer.byteLength(body, "utf8")
        : Buffer.isBuffer(body)
          ? body.length
          : body == null
            ? 0
            : Buffer.byteLength(String(body), "utf8");

    if (bodyBytes > maxBytes) {
      const tooLarge = new MonitoringHttpSafetyError(
        "RESPONSE_TOO_LARGE",
        `Monitoring response exceeded max size (${maxBytes} bytes).`,
        {
          securityEventType: SECURITY_EVENT_TYPES.RESPONSE_TOO_LARGE,
          requestedUrl: current,
          statusCode: 413
        }
      );
      await rejectBlocked(tooLarge, { url: current, siteId: options.siteId, method: "GET" });
    }

    if (status >= 300 && status < 400) {
      const location = response.headers && response.headers.location;
      if (!location) {
        throw new MonitoringHttpSafetyError(
          "UNSAFE_REDIRECT",
          `Redirect missing Location header (HTTP ${status}).`,
          {
            securityEventType: SECURITY_EVENT_TYPES.UNSAFE_REDIRECT,
            requestedUrl: current,
            statusCode: 400
          }
        );
      }
      let nextUrl;
      try {
        nextUrl = new URL(String(location), current).toString();
      } catch {
        throw new MonitoringHttpSafetyError("UNSAFE_REDIRECT", "Redirect target is malformed.", {
          securityEventType: SECURITY_EVENT_TYPES.UNSAFE_REDIRECT,
          requestedUrl: current,
          statusCode: 400
        });
      }

      try {
        assertRedirectDestinationAllowed(nextUrl, origin.hostname);
      } catch (policyErr) {
        policyErr.requestedUrl = origin.url;
        policyErr.destinationUrl = nextUrl;
        await rejectBlocked(policyErr, {
          url: origin.url,
          siteId: options.siteId,
          method: "GET",
          detail: { redirectChain: chain }
        });
      }

      if (hop === maxRedirects) {
        const limitErr = new MonitoringHttpSafetyError("UNSAFE_REDIRECT", "Too many redirects.", {
          securityEventType: SECURITY_EVENT_TYPES.UNSAFE_REDIRECT,
          requestedUrl: origin.url,
          destinationUrl: nextUrl,
          statusCode: 400
        });
        await rejectBlocked(limitErr, { url: origin.url, siteId: options.siteId, method: "GET" });
      }
      current = nextUrl;
      continue;
    }

    return {
      status,
      data: body,
      headers: response.headers || {},
      finalUrl: current,
      redirectChain: chain,
      requestUrl: origin.url
    };
  }

  const limitErr = new MonitoringHttpSafetyError("UNSAFE_REDIRECT", "Too many redirects.", {
    securityEventType: SECURITY_EVENT_TYPES.UNSAFE_REDIRECT,
    requestedUrl: origin.url,
    statusCode: 400
  });
  await rejectBlocked(limitErr, { url: origin.url, siteId: options.siteId, method: "GET" });
  return null;
}

/**
 * Central entry: monitoring GET against an official source URL.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.method="GET"] — non-GET is blocked before network I/O
 * @param {boolean} [options.allowWhenAutomationDormant=false]
 * @param {boolean} [options.requireOfficialHost=true]
 * @param {number|null} [options.siteId]
 */
async function monitoringSafeRequest(url, options = {}) {
  const method = await assertMonitoringHttpMethodAllowed(options.method || "GET", {
    url,
    siteId: options.siteId
  });

  if (method !== "GET") {
    // unreachable — assert throws — kept for clarity
    return null;
  }

  const allowWhenDormant = options.allowWhenAutomationDormant === true;
  // Live + DRY_RUN permit fetch; DORMANT / emergency stop block unless admin verify path.
  if (!allowWhenDormant && !isMonitoringFetchPermitted()) {
    const err = new MonitoringHttpSafetyError(
      "AUTOMATION_KILL_SWITCH",
      "Monitoring fetch blocked by automation master kill-switch / dormant control plane.",
      {
        securityEventType: SECURITY_EVENT_TYPES.AUTOMATION_KILL_SWITCH,
        requestedUrl: url,
        requestedMethod: "GET",
        statusCode: 403
      }
    );
    await rejectBlocked(err, { url, siteId: options.siteId, method: "GET" });
  }

  assertUrlPolicy(url, { requireOfficialHost: options.requireOfficialHost !== false });

  return fetchWithSafeRedirects(url, {
    ...options,
    method: "GET"
  });
}

async function monitoringSafeGet(url, options = {}) {
  return monitoringSafeRequest(url, { ...options, method: "GET" });
}

module.exports = {
  MONITORING_BOT_UA,
  ALLOWED_METHODS,
  BLOCKED_METHODS,
  DEFAULT_MAX_HTML_BYTES,
  MAX_SAFE_REDIRECTS,
  MonitoringHttpSafetyError,
  getMaxHtmlBytes,
  assertMonitoringHttpMethodAllowed,
  assertUrlPolicy,
  assertRedirectDestinationAllowed,
  fetchWithSafeRedirects,
  monitoringSafeRequest,
  monitoringSafeGet
};
