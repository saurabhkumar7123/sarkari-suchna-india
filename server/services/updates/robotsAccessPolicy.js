"use strict";

/**
 * Read-only robots.txt / access-policy gate for official monitoring.
 *
 * Fail-closed for new activation and per-check monitoring when policy is unclear.
 * Does not bypass Disallow. Does not POST. Does not evade restrictions.
 *
 * Behavior matrix (documented + enforced):
 * - robots.txt 200 + Allow for path     → allow
 * - robots.txt 200 + Disallow for path  → deny
 * - robots.txt 404                      → allow (no robots file = no crawler rules;
 *                                         still subject to official-host + rate limits)
 * - robots.txt 401/403                  → deny (restricted; fail closed)
 * - timeout / DNS / network error       → deny (unclear; fail closed)
 * - malformed / unparseable body        → deny (unclear; fail closed)
 * - empty body on 200                   → deny (unclear; fail closed)
 *
 * Note on 404: RFC 9309 / common practice treats missing robots.txt as unrestricted
 * by robots rules. Official-host allowlist still applies. New activations still
 * require a successful policy decision (404 = explicit "no robots rules").
 */

const axios = require("axios");
const robotsParser = require("robots-parser");
const logger = require("../../utils/logger");
const { extractHostname } = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");
const { createHttpError } = require("./monitoringUrlSafety");

const MONITORING_BOT_UA =
  process.env.UPDATE_BOT_USER_AGENT ||
  "SarkariSuchnaMonitor/1.0 (+https://sarkarisuchna.in; read-only official monitoring)";

const ROBOTS_TIMEOUT_MS = Math.min(
  15000,
  Math.max(3000, parseInt(process.env.UPDATE_ROBOTS_TIMEOUT_MS || "8000", 10) || 8000)
);

const ROBOTS_CACHE_TTL_MS = Math.min(
  60 * 60 * 1000,
  Math.max(60 * 1000, parseInt(process.env.UPDATE_ROBOTS_CACHE_TTL_MS || "900000", 10) || 900000)
);

/** @type {Map<string, { expiresAt: number, decision: object }>} */
const robotsCache = new Map();

function robotsUrlFor(targetUrl) {
  const parsed = new URL(String(targetUrl));
  return `${parsed.protocol}//${parsed.host}/robots.txt`;
}

function getCached(hostKey) {
  const hit = robotsCache.get(hostKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    robotsCache.delete(hostKey);
    return null;
  }
  return hit.decision;
}

function setCached(hostKey, decision) {
  robotsCache.set(hostKey, { expiresAt: Date.now() + ROBOTS_CACHE_TTL_MS, decision });
}

async function fetchRobotsTxt(robotsUrl) {
  try {
    const response = await axios.get(robotsUrl, {
      timeout: ROBOTS_TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
      responseType: "text",
      transformResponse: [(data) => data],
      headers: {
        Accept: "text/plain,*/*",
        "User-Agent": MONITORING_BOT_UA
      }
    });
    return {
      ok: true,
      status: Number(response.status) || 0,
      body: typeof response.data === "string" ? response.data : String(response.data || "")
    };
  } catch (err) {
    const code = err && err.code ? String(err.code) : "";
    const message = err && err.message ? String(err.message) : String(err);
    return {
      ok: false,
      status: 0,
      body: "",
      errorCode: code || "NETWORK_ERROR",
      errorMessage: message
    };
  }
}

function evaluateParsedRobots(robots, targetUrl) {
  const agents = [MONITORING_BOT_UA, "SarkariSuchnaMonitor", "*"];
  for (const agent of agents) {
    try {
      if (typeof robots.isAllowed === "function" && robots.isAllowed(targetUrl, agent) === false) {
        return { allowed: false, matchedAgent: agent, reason: "robots_disallow" };
      }
    } catch {
      return { allowed: false, matchedAgent: agent, reason: "robots_eval_error" };
    }
  }

  let crawlDelayMs = 0;
  for (const agent of agents) {
    try {
      if (typeof robots.getCrawlDelay === "function") {
        const delaySec = robots.getCrawlDelay(agent);
        if (typeof delaySec === "number" && Number.isFinite(delaySec) && delaySec > 0) {
          crawlDelayMs = Math.max(crawlDelayMs, Math.round(delaySec * 1000));
        }
      }
    } catch {
      // ignore crawl-delay parse issues; allow decision still stands
    }
  }

  return { allowed: true, matchedAgent: "*", reason: "robots_allow", crawlDelayMs };
}

/**
 * @param {string} targetUrl
 * @param {{ bypassCache?: boolean }} [options]
 * @returns {Promise<{
 *   allowed: boolean,
 *   reason: string,
 *   status: number,
 *   robotsUrl: string,
 *   crawlDelayMs: number,
 *   failClosed: boolean
 * }>}
 */
async function evaluateRobotsAccessPolicy(targetUrl, options = {}) {
  let parsed;
  try {
    parsed = new URL(String(targetUrl || "").trim());
  } catch {
    return {
      allowed: false,
      reason: "invalid_url",
      status: 0,
      robotsUrl: "",
      crawlDelayMs: 0,
      failClosed: true
    };
  }

  const hostKey = `${parsed.protocol}//${parsed.host}`.toLowerCase();
  if (!options.bypassCache) {
    const cached = getCached(hostKey);
    if (cached) {
      // Re-evaluate path against cached parser body when available
      if (cached.parserBody != null && cached.status === 200) {
        try {
          const robots = robotsParser(cached.robotsUrl, cached.parserBody);
          const pathDecision = evaluateParsedRobots(robots, parsed.toString());
          return {
            allowed: pathDecision.allowed,
            reason: pathDecision.reason,
            status: cached.status,
            robotsUrl: cached.robotsUrl,
            crawlDelayMs: pathDecision.crawlDelayMs || cached.crawlDelayMs || 0,
            failClosed: !pathDecision.allowed,
            cached: true
          };
        } catch {
          return {
            allowed: false,
            reason: "robots_malformed",
            status: cached.status,
            robotsUrl: cached.robotsUrl,
            crawlDelayMs: 0,
            failClosed: true,
            cached: true
          };
        }
      }
      return { ...cached, cached: true };
    }
  }

  const robotsUrl = robotsUrlFor(parsed.toString());
  const fetched = await fetchRobotsTxt(robotsUrl);

  if (!fetched.ok) {
    const decision = {
      allowed: false,
      reason:
        fetched.errorCode === "ENOTFOUND" || fetched.errorCode === "EAI_AGAIN"
          ? "robots_dns_failure"
          : fetched.errorCode === "ECONNABORTED" || /timeout/i.test(fetched.errorMessage || "")
            ? "robots_timeout"
            : "robots_network_error",
      status: 0,
      robotsUrl,
      crawlDelayMs: 0,
      failClosed: true,
      errorCode: fetched.errorCode
    };
    setCached(hostKey, decision);
    logger.warn("updates: robots policy fail-closed", {
      host: extractHostname(parsed.toString()),
      reason: decision.reason,
      errorCode: fetched.errorCode
    });
    return decision;
  }

  const status = fetched.status;

  if (status === 404) {
    const decision = {
      allowed: true,
      reason: "robots_not_found",
      status,
      robotsUrl,
      crawlDelayMs: 0,
      failClosed: false
    };
    setCached(hostKey, decision);
    return decision;
  }

  if (status === 401 || status === 403) {
    const decision = {
      allowed: false,
      reason: "robots_forbidden",
      status,
      robotsUrl,
      crawlDelayMs: 0,
      failClosed: true
    };
    setCached(hostKey, decision);
    return decision;
  }

  if (status < 200 || status >= 300) {
    const decision = {
      allowed: false,
      reason: "robots_unexpected_status",
      status,
      robotsUrl,
      crawlDelayMs: 0,
      failClosed: true
    };
    setCached(hostKey, decision);
    return decision;
  }

  const body = String(fetched.body || "");
  if (!body.trim()) {
    const decision = {
      allowed: false,
      reason: "robots_empty",
      status,
      robotsUrl,
      crawlDelayMs: 0,
      failClosed: true
    };
    setCached(hostKey, decision);
    return decision;
  }

  let robots;
  try {
    robots = robotsParser(robotsUrl, body);
  } catch {
    const decision = {
      allowed: false,
      reason: "robots_malformed",
      status,
      robotsUrl,
      crawlDelayMs: 0,
      failClosed: true
    };
    setCached(hostKey, decision);
    return decision;
  }

  const pathDecision = evaluateParsedRobots(robots, parsed.toString());
  const decision = {
    allowed: pathDecision.allowed === true,
    reason: pathDecision.reason,
    status,
    robotsUrl,
    crawlDelayMs: pathDecision.crawlDelayMs || 0,
    failClosed: pathDecision.allowed !== true,
    parserBody: body,
    matchedAgent: pathDecision.matchedAgent
  };
  setCached(hostKey, decision);

  if (!decision.allowed) {
    logger.warn("updates: robots disallow", {
      url: parsed.toString(),
      reason: decision.reason,
      robotsUrl
    });
  }

  return decision;
}

/**
 * Hard gate for create / enable / restore. Throws HTTP error on deny.
 */
async function assertRobotsAllowsMonitoring(targetUrl) {
  const decision = await evaluateRobotsAccessPolicy(targetUrl);
  if (decision.allowed === true) return decision;

  const message =
    decision.reason === "robots_disallow"
      ? "Monitoring URL is disallowed by robots.txt."
      : "Monitoring access policy is unclear or restricted; activation blocked (fail closed).";

  throw createHttpError(400, message, "MONITORING_ROBOTS_DENIED");
}

function clearRobotsPolicyCache() {
  robotsCache.clear();
}

module.exports = {
  MONITORING_BOT_UA,
  evaluateRobotsAccessPolicy,
  assertRobotsAllowsMonitoring,
  clearRobotsPolicyCache,
  robotsUrlFor
};
