"use strict";

/**
 * Pre-activation verification for Official Source Manager.
 * GET-only, exact-URL, official-host, robots fail-closed, redirect-host safe.
 * Does not activate sources and never bypasses policy.
 */

const axios = require("axios");
const cheerio = require("cheerio");
const {
  assertSafeOfficialMonitoringUrl,
  isPrivateOrInternalHostname,
  createHttpError
} = require("./monitoringUrlSafety");
const { isApprovedOfficialMonitoringUrl, extractHostname } = require(
  "../../lib/contentIntelligence/sourceIntelligence/officialDomains"
);
const { evaluateRobotsAccessPolicy, MONITORING_BOT_UA } = require("./robotsAccessPolicy");
const { findDuplicateMonitoringUrl } = require("./monitoringSiteWriteGuard");
const { withHostPoliteness } = require("./hostPoliteness");
const { classifyMonitoringHttpError } = require("./monitoringFetchErrors");

const PURPOSE_VALUES = Object.freeze([
  "recruitment",
  "notice",
  "admit_card",
  "result",
  "answer_key",
  "examination",
  "other"
]);

const PURPOSE_LABELS = Object.freeze({
  recruitment: "Recruitment / Vacancy",
  notice: "Notification / Notice",
  admit_card: "Admit Card",
  result: "Result",
  answer_key: "Answer Key",
  examination: "Examination",
  other: "Other"
});

const VERIFY_TIMEOUT_MS = 20000;
const MAX_SAFE_REDIRECTS = 5;

function pass(detail) {
  return { status: "PASS", detail: detail || "ok" };
}

function fail(detail) {
  return { status: "FAIL", detail: detail || "failed" };
}

function blocked(detail) {
  return { status: "BLOCKED", detail: detail || "blocked" };
}

function normalizePurpose(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[/]+/g, " ")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!value) return "";
  if (PURPOSE_VALUES.includes(value)) return value;
  const aliases = {
    recruitment_vacancy: "recruitment",
    vacancy: "recruitment",
    notification: "notice",
    notification_notice: "notice",
    admitcard: "admit_card",
    answerkey: "answer_key",
    exam: "examination"
  };
  return aliases[value] || "";
}

function purposeLabel(value) {
  const key = normalizePurpose(value);
  return key ? PURPOSE_LABELS[key] : "";
}

function checkResult(status, detail) {
  if (status === "PASS") return pass(detail);
  if (status === "BLOCKED") return blocked(detail);
  return fail(detail);
}

/**
 * Follow redirects manually so each hop stays on an approved official host.
 */
async function fetchWithSafeRedirects(url) {
  let current = String(url || "").trim();
  const chain = [];
  for (let hop = 0; hop <= MAX_SAFE_REDIRECTS; hop += 1) {
    let response;
    try {
      response = await axios.get(current, {
        timeout: VERIFY_TIMEOUT_MS,
        maxRedirects: 0,
        responseType: "text",
        transformResponse: [(data) => data],
        validateStatus: () => true,
        headers: {
          "User-Agent": MONITORING_BOT_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        method: "GET"
      });
    } catch (err) {
      const classification = classifyMonitoringHttpError(err);
      const error = createHttpError(
        400,
        classification.kind === "timeout"
          ? "URL network unavailable (timeout)."
          : "URL network unavailable.",
        "MONITORING_URL_UNREACHABLE"
      );
      error.classification = classification;
      throw error;
    }

    const status = Number(response.status || 0);
    chain.push({ url: current, status });

    if (status >= 300 && status < 400) {
      const location = response.headers && response.headers.location;
      if (!location) {
        const err = createHttpError(
          400,
          `Redirect missing Location header (HTTP ${status}).`,
          "MONITORING_REDIRECT_INVALID"
        );
        err.httpStatus = status;
        err.redirectChain = chain;
        throw err;
      }
      let nextUrl;
      try {
        nextUrl = new URL(String(location), current).toString();
      } catch {
        const err = createHttpError(400, "Redirect target is malformed.", "MONITORING_REDIRECT_INVALID");
        err.httpStatus = status;
        err.redirectChain = chain;
        throw err;
      }
      const nextHost = extractHostname(nextUrl);
      if (!nextHost || isPrivateOrInternalHostname(nextHost)) {
        const err = createHttpError(
          400,
          "Redirect leads to a private or internal host.",
          "MONITORING_REDIRECT_PRIVATE"
        );
        err.httpStatus = status;
        err.redirectChain = chain;
        err.finalUrl = nextUrl;
        throw err;
      }
      if (!isApprovedOfficialMonitoringUrl(nextUrl)) {
        const err = createHttpError(
          400,
          "Redirect leads to an unapproved host.",
          "MONITORING_REDIRECT_NOT_OFFICIAL"
        );
        err.httpStatus = status;
        err.redirectChain = chain;
        err.finalUrl = nextUrl;
        throw err;
      }
      if (hop === MAX_SAFE_REDIRECTS) {
        const err = createHttpError(400, "Too many redirects.", "MONITORING_REDIRECT_LIMIT");
        err.httpStatus = status;
        err.redirectChain = chain;
        throw err;
      }
      current = nextUrl;
      continue;
    }

    return {
      status,
      html: typeof response.data === "string" ? response.data : String(response.data || ""),
      finalUrl: current,
      redirectChain: chain
    };
  }
  const err = createHttpError(400, "Too many redirects.", "MONITORING_REDIRECT_LIMIT");
  err.redirectChain = chain;
  throw err;
}

function extractSelectorPreview(html, selector, pageUrl) {
  const sel = String(selector || "").trim();
  if (!sel) {
    return { ok: false, reason: "CSS selector is required.", preview: "", count: 0, quality: "YELLOW" };
  }
  if (/^body$/i.test(sel)) {
    return {
      ok: false,
      reason: "Selector 'body' is too broad for GREEN activation. Choose a stable notice/list selector.",
      preview: "",
      count: 0,
      quality: "YELLOW"
    };
  }
  const $ = cheerio.load(String(html || ""));
  const roots = $(sel);
  if (!roots.length) {
    return { ok: false, reason: "Selector returned no useful content.", preview: "", count: 0, quality: "YELLOW" };
  }
  const chunks = [];
  roots.slice(0, 5).each((_, node) => {
    const text = String($(node).text() || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) chunks.push(text.slice(0, 180));
  });
  if (!chunks.length) {
    return {
      ok: false,
      reason: "Selector returned no useful content.",
      preview: "",
      count: roots.length,
      quality: "YELLOW"
    };
  }

  const RELEVANT_RE =
    /recruit|vacanc|notif|notice|admit|result|answer\s*key|exam|interview|advertisement|circular|corrigendum|appointment|selection|merit|advt|employment|notification/i;
  const NAV_NOISE_RE =
    /skip to|screen reader|main content|vision|mission|how to reach|footer|menu|login|register|home page/i;
  const relevant = chunks.filter((t) => RELEVANT_RE.test(t) && !NAV_NOISE_RE.test(t));
  const preview = chunks.join(" · ").slice(0, 500);

  if (!relevant.length) {
    return {
      ok: false,
      reason: "Selector extraction is not clearly recruitment/notice relevant. Leave inactive (YELLOW).",
      preview,
      count: roots.length,
      quality: "YELLOW"
    };
  }

  let pathname = "/";
  try {
    pathname = new URL(String(pageUrl || "")).pathname || "/";
  } catch {
    pathname = "/";
  }
  const isHomepage = pathname === "/" || pathname === "";
  if (isHomepage && /^a$/i.test(sel)) {
    return {
      ok: false,
      reason: "Homepage with generic 'a' selector is too noisy. Prefer an exact notices/list page.",
      preview,
      count: roots.length,
      quality: "YELLOW"
    };
  }

  return {
    ok: true,
    reason: `Matched ${roots.length} node(s); ${relevant.length} relevant preview chunk(s).`,
    preview,
    count: roots.length,
    quality: "GREEN",
    pageUrl
  };
}

/**
 * Full pre-save / pre-activation verification report.
 * @param {{ url: string, selector?: string, excludeId?: number|null, checkDuplicates?: boolean }} input
 */
async function verifyMonitoringSource(input = {}) {
  const reasons = [];
  const checks = {
    urlSyntax: fail("Not checked"),
    officialHost: fail("Not checked"),
    privateHost: fail("Not checked"),
    duplicate: pass("Not checked"),
    robots: fail("Not checked"),
    reachable: fail("Not checked"),
    httpStatus: fail("Not checked"),
    redirect: pass("Not checked"),
    selector: fail("Not checked"),
    relevantContent: fail("Not checked")
  };

  let exactUrl = String(input.url || "").trim();
  let hostname = "";
  let preview = "";
  let httpStatus = null;
  let robots = null;
  let redirectChain = [];
  let qualityGrade = "YELLOW";
  const verifiedAt = new Date().toISOString();
  const requestedSelector = String(input.selector || "").trim();

  try {
    const validated = assertSafeOfficialMonitoringUrl(exactUrl);
    exactUrl = validated.url;
    hostname = validated.hostname;
    checks.urlSyntax = pass("Valid http(s) URL.");
    checks.privateHost = pass("Not a private/internal destination.");
    checks.officialHost = pass(`Approved official host: ${hostname}`);
  } catch (err) {
    const code = err && err.code;
    const message = (err && err.message) || "URL validation failed.";
    if (code === "MONITORING_URL_MALFORMED" || code === "MONITORING_URL_PROTOCOL" || code === "MONITORING_URL_REQUIRED") {
      checks.urlSyntax = fail(message);
      reasons.push(message);
    } else if (code === "MONITORING_URL_PRIVATE") {
      checks.urlSyntax = pass("URL parsed.");
      checks.privateHost = fail(message);
      reasons.push(message);
    } else if (code === "MONITORING_URL_NOT_OFFICIAL") {
      checks.urlSyntax = pass("URL parsed.");
      checks.privateHost = pass("Not private/internal.");
      checks.officialHost = fail("Host is not an approved official source.");
      reasons.push("Host is not an approved official source.");
    } else {
      checks.urlSyntax = fail(message);
      reasons.push(message);
    }
    return finalizeReport({
      exactUrl,
      hostname,
      checks,
      reasons,
      robots,
      httpStatus,
      preview,
      redirectChain,
      qualityGrade,
      verifiedAt
    });
  }

  const checkDuplicates = input.checkDuplicates !== false;
  if (checkDuplicates) {
    const dup = await findDuplicateMonitoringUrl(exactUrl, input.excludeId);
    if (dup) {
      checks.duplicate = fail(`Duplicate of existing source #${dup.id} (${dup.name || "unnamed"}).`);
      reasons.push("Monitoring URL already exists.");
    } else {
      checks.duplicate = pass("No duplicate monitoring URL.");
    }
  }

  robots = await evaluateRobotsAccessPolicy(exactUrl);
  if (!robots.allowed) {
    const detail =
      robots.reason === "robots_disallow"
        ? "robots policy blocks automated monitoring."
        : robots.reason === "robots_forbidden" || robots.reason === "robots_unauthorized"
          ? "HTTP access to robots.txt is restricted."
          : "robots/policy unclear; fail closed.";
    checks.robots = blocked(detail);
    reasons.push(
      robots.reason === "robots_disallow"
        ? "robots policy blocks automated monitoring."
        : "Policy unclear or restricted; activation blocked."
    );
  } else {
    checks.robots = pass(robots.reason || "Robots allowed.");
  }

  // Selector quality gate after host/robots hard checks (human-curation GREEN requirement).
  if (!requestedSelector) {
    checks.selector = fail("CSS selector is required.");
    checks.relevantContent = fail("No selector to evaluate.");
    reasons.push("CSS selector is required.");
  } else if (/^body$/i.test(requestedSelector)) {
    checks.selector = fail("Selector 'body' is too broad for GREEN activation.");
    checks.relevantContent = fail("body selector skipped for quality gate.");
    reasons.push("Selector 'body' is too broad for GREEN activation. Choose a stable notice/list selector.");
  }

  if (reasons.length) {
    if (robots && robots.allowed === false) qualityGrade = "BLOCKED";
    return finalizeReport({
      exactUrl,
      hostname,
      checks,
      reasons,
      robots,
      httpStatus,
      preview,
      redirectChain,
      qualityGrade,
      verifiedAt
    });
  }

  try {
    const fetched = await withHostPoliteness(exactUrl, () => fetchWithSafeRedirects(exactUrl), {
      crawlDelayMs: Number(robots && robots.crawlDelayMs) || 0
    });
    httpStatus = fetched.status;
    redirectChain = fetched.redirectChain || [];
    checks.redirect =
      redirectChain.length > 1
        ? pass(`Safe redirects (${redirectChain.length - 1}) stayed on approved hosts.`)
        : pass("No unapproved redirect.");
    checks.httpStatus = checkResult(
      fetched.status >= 200 && fetched.status < 300 ? "PASS" : "FAIL",
      `HTTP ${fetched.status}`
    );
    if (fetched.status === 403) {
      checks.reachable = blocked("URL returned 403.");
      reasons.push("URL returned 403.");
      qualityGrade = "BLOCKED";
    } else if (fetched.status < 200 || fetched.status >= 300) {
      checks.reachable = fail(`URL returned ${fetched.status}.`);
      reasons.push(`URL returned ${fetched.status}.`);
      qualityGrade = "BLOCKED";
    } else {
      checks.reachable = pass("URL reachable.");
      const extracted = extractSelectorPreview(fetched.html, requestedSelector, fetched.finalUrl);
      if (!extracted.ok) {
        checks.selector = fail(extracted.reason);
        checks.relevantContent = fail(extracted.reason);
        reasons.push(extracted.reason);
        qualityGrade = extracted.quality || "YELLOW";
        preview = extracted.preview || "";
      } else {
        checks.selector = pass(extracted.reason);
        checks.relevantContent = pass("Relevant recruitment/notice content detected in preview.");
        preview = extracted.preview;
        qualityGrade = "GREEN";
      }
    }
  } catch (err) {
    const code = err && err.code;
    httpStatus = err.httpStatus || null;
    redirectChain = err.redirectChain || redirectChain;
    qualityGrade = "BLOCKED";
    if (code === "MONITORING_REDIRECT_NOT_OFFICIAL") {
      checks.redirect = fail("Redirect leads to an unapproved host.");
      checks.reachable = fail("Redirect not approved.");
      reasons.push("Redirect leads to an unapproved host.");
    } else if (code === "MONITORING_REDIRECT_PRIVATE") {
      checks.redirect = fail("Redirect leads to a private/internal host.");
      reasons.push("Redirect leads to a private or internal host.");
    } else if (code === "MONITORING_URL_UNREACHABLE") {
      checks.reachable = fail("Network unavailable.");
      reasons.push("Network unavailable.");
    } else {
      checks.reachable = fail((err && err.message) || "Fetch failed.");
      reasons.push((err && err.message) || "Fetch failed.");
    }
  }

  return finalizeReport({
    exactUrl,
    hostname,
    checks,
    reasons,
    robots,
    httpStatus,
    preview,
    redirectChain,
    qualityGrade,
    verifiedAt
  });
}

function finalizeReport(parts) {
  const safeToActivate = parts.reasons.length === 0;
  const qualityGrade = safeToActivate ? "GREEN" : parts.qualityGrade || "YELLOW";
  return {
    safeToActivate,
    qualityGrade,
    verifiedAt: parts.verifiedAt || new Date().toISOString(),
    exactUrl: parts.exactUrl,
    hostname: parts.hostname || extractHostname(parts.exactUrl) || "",
    httpStatus: parts.httpStatus,
    robots: parts.robots
      ? {
          allowed: parts.robots.allowed === true,
          reason: parts.robots.reason || "",
          status: parts.robots.status,
          robotsUrl: parts.robots.robotsUrl || ""
        }
      : null,
    checks: parts.checks,
    preview: parts.preview || "",
    redirectChain: parts.redirectChain || [],
    reasons: parts.reasons,
    message: safeToActivate
      ? "Verification passed. GREEN — safe to activate."
      : parts.reasons[0] || "Verification failed."
  };
}

/**
 * Assert activation is allowed (used when enabling a source).
 */
async function assertSafeToActivateMonitoringSource(input = {}) {
  const report = await verifyMonitoringSource(input);
  if (!report.safeToActivate) {
    throw createHttpError(400, report.message || "Verification failed.", "MONITORING_VERIFY_FAILED");
  }
  return report;
}

module.exports = {
  PURPOSE_VALUES,
  PURPOSE_LABELS,
  normalizePurpose,
  purposeLabel,
  verifyMonitoringSource,
  assertSafeToActivateMonitoringSource,
  fetchWithSafeRedirects,
  extractSelectorPreview
};
