require("dotenv").config();

const express = require("express");
const { normalizeBreadcrumbInHtml } = require("./lib/breadcrumb");
const { normalizeJobPageShareInHtml } = require("./lib/jobPageShare");
const { normalizeHighlightBannerInHtml } = require("./lib/highlightBannerHtml");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const errorHandler = require("./middleware/errorHandler.middleware");
const accessLogMiddleware = require("./middleware/accessLog.middleware");
const logger = require("./utils/logger");
const { globalLimiter, apiLimiter } = require("./config/rateLimits");
const { sendSitemap } = require("./controllers/public/sitemap.controller");
const fileService = require("./services/file.service");
const {
  normalizeFilesystemSlug,
  isValidFilesystemSlug,
  resolveInsideRoot
} = require("./lib/safeFilesystemPath");
const miscService = require("./services/misc.service");
const pageService = require("./services/page.service");
const homeStatsService = require("./services/homeStats.service");
const taxonomyPageService = require("./services/taxonomyPage.service");
const topicPageService = require("./services/topicPage.service");
const {
  buildDepartmentPath,
  buildQualificationPath,
  buildStatePath
} = require("./lib/taxonomySlugs");
const { ALLOWED_JOB_QUALIFICATIONS, ALLOWED_JOB_STATES, normalizeStateSlug } = require("./lib/structuredFields");
const searchService = require("./services/search.service");
const asyncHandler = require("./utils/asyncHandler");
const { getBaseUrl, getPublicBaseUrl } = require("./utils/baseUrl");
const { buildHomeBootstrap, buildHomeBootstrapScriptTag } = require("./lib/homeBootstrap");
const {
  resolveHomepageBadgeHtmlFromItem,
  resolveHomeCardBadgeHtmlFromItem
} = require("./lib/homepageBadges");
const { buildHomeViewMoreLinkHtml } = require("./lib/homeViewMore");
const { buildHomeSectionCardAttrs, sortHomeSectionResults } = require("./lib/homeSectionOrder");

const app = express();
const isProd = process.env.NODE_ENV === "production";
const isDev = process.env.NODE_ENV === "development";
const siteUrl = getBaseUrl();
const isHttpsSite = /^https:\/\//i.test(siteUrl);
const forceUpgradeInsecureRequests = process.env.CSP_UPGRADE_INSECURE_REQUESTS === "1";
const PROD_COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || process.env.PRODUCTION_COOKIE_DOMAIN || "").trim();

app.disable("x-powered-by");

const rootDir = path.join(__dirname, "..");
const publicAssets = path.join(rootDir, "public", "assets");
const generatedDir = path.join(rootDir, "generated");
const uploadsRoot = path.join(rootDir, "storage", "uploads");
const headerTemplatePath = path.join(generatedDir, "static", "header.html");

let cachedHeader = "";
let hasLoggedHeaderCacheFailure = false;
let headerReloadInFlight = false;

function loadHeaderIntoCache() {
  try {
    const nextHeader = fs.readFileSync(headerTemplatePath, "utf8");
    cachedHeader = String(nextHeader || "");
    hasLoggedHeaderCacheFailure = false;
  } catch (err) {
    if (!hasLoggedHeaderCacheFailure) {
      hasLoggedHeaderCacheFailure = true;
      logger.error("header cache load failed; continuing without header injection", {
        message: err && err.message ? err.message : String(err)
      });
    }
    cachedHeader = "";
  }
}

function reloadHeaderCacheOnce() {
  if (headerReloadInFlight) return;
  headerReloadInFlight = true;
  fileService.readFile(headerTemplatePath, "utf8")
    .then((nextHeader) => {
      cachedHeader = String(nextHeader || "");
      hasLoggedHeaderCacheFailure = false;
    })
    .catch((err) => {
      if (!hasLoggedHeaderCacheFailure) {
        hasLoggedHeaderCacheFailure = true;
        logger.error("header cache reload failed; continuing without header injection", {
          message: err && err.message ? err.message : String(err)
        });
      }
    })
    .finally(() => {
      headerReloadInFlight = false;
    });
}

loadHeaderIntoCache();
try {
  fs.watch(headerTemplatePath, { persistent: false }, () => {
    loadHeaderIntoCache();
  });
} catch (err) {
  logger.warn("header cache watch unavailable", {
    message: err && err.message ? err.message : String(err)
  });
}

if (process.env.TRUST_PROXY === "1" || isProd) {
  app.set("trust proxy", 1);
}

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
if (siteUrl) allowedOrigins.push(siteUrl);
if (isProd && PROD_COOKIE_DOMAIN) {
  allowedOrigins.push(`https://${PROD_COOKIE_DOMAIN}`);
}
const allowedOriginsSet = new Set(allowedOrigins);

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (allowedOriginsSet.has(origin)) return true;
  if (isProd) return false;
  // Local/LAN development support for multi-device login checks.
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/i.test(origin);
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/i.test(String(origin || ""));
}

const baseHelmetOptions = {
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
  frameguard: { action: "deny" },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      fullscreen: ["self"]
    }
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
};
const cspDirectivesBase = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://www.googletagmanager.com",
    "'unsafe-inline'"
  ],
  styleSrc: ["'self'", "https://cdnjs.cloudflare.com"],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com"
  ],
  connectSrc: [
    "'self'",
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://region1.google-analytics.com",
    "https://www.googletagmanager.com"
  ],
  fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: null
};
const helmetWithUpgrade = helmet({
  ...baseHelmetOptions,
  contentSecurityPolicy: {
    directives: { ...cspDirectivesBase, upgradeInsecureRequests: [] }
  }
});
const helmetWithoutUpgrade = helmet({
  ...baseHelmetOptions,
  contentSecurityPolicy: {
    directives: cspDirectivesBase
  }
});

app.use((req, res, next) => {
  req.id = req.id || (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  res.setHeader("X-Request-Id", req.id);
  next();
});

function shouldRedirectToHttps(req) {
  if (!isProd) return false;
  const pathOnly = String((req && req.path) || "").split("?")[0];
  if (pathOnly === "/health" || pathOnly === "/ready") return false;
  const hostHeader = String((req && req.headers && req.headers.host) || "").trim().toLowerCase();
  const host = hostHeader.split(":")[0];
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
  if (isLocalHost) return false;
  const forwardedProto = String((req.headers && req.headers["x-forwarded-proto"]) || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === "https" || req.secure) return false;
  return true;
}


app.use((req, res, next) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const requestIsHttps = req.secure || forwardedProto === "https";
  const shouldUpgrade = forceUpgradeInsecureRequests || (isProd && isHttpsSite && requestIsHttps);
  const middleware = shouldUpgrade ? helmetWithUpgrade : helmetWithoutUpgrade;
  return middleware(req, res, next);
});

app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)"
  );
  next();
});

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    }
  })
);
app.use(accessLogMiddleware);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin)) return callback(null, true);
      if (origin) {
        logger.warn("auth-network: CORS origin rejected", { origin });
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);

// Minimal login-network diagnostics for local multi-device debugging.
app.use((req, res, next) => {
  if (!isDev) return next();
  const pathOnly = String(req.originalUrl || "").split("?")[0];
  if (pathOnly !== "/api/admin/login") return next();
  logger.info("auth-network: login request received", {
    requestId: req.id || "",
    route: pathOnly,
    method: req.method
  });
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      logger.warn("auth-network: login request failed", {
        requestId: req.id || "",
        route: pathOnly,
        statusCode: res.statusCode
      });
    }
  });
  next();
});

app.use(require("./api/health.routes"));

function dispatchRateLimit(req, res, next) {
  if (req.path === "/health" || req.path === "/ready") return next();
  if (req.path.startsWith("/api")) return apiLimiter(req, res, next);
  return globalLimiter(req, res, next);
}

app.use(dispatchRateLimit);

app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(hpp());

/** Short cache for HTML responses (programmatic sendFile). */
async function sendHtml(req, res, absPath, statusCode) {
  const source = await fileService.readFile(absPath, "utf8");
  const html = normalizeSeoUrlsInHtml(String(source || ""), getPublicBaseUrl(req));
  return sendHtmlString(req, res, html, statusCode);
}

function shouldSkipChromeInjection(req) {
  const pathOnly = String((req && req.originalUrl) || "")
    .split("?")[0]
    .replace(/\/+$/, "") || "/";
  return pathOnly === "/login";
}

async function sendHtmlString(req, res, html, statusCode) {
  if (statusCode) res.status(statusCode);
  if (isProd) {
    const maxAge = statusCode === 404 ? "60" : "120";
    res.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=300`);
  }
  res.type("html");
  const withHeader = shouldSkipChromeInjection(req) ? String(html || "") : await injectHeader(html);
  const normalized = normalizeJobPageShareInHtml(
    normalizeHighlightBannerInHtml(normalizeBreadcrumbInHtml(withHeader))
  );
  return res.send(normalized);
}

async function injectHeader(htmlString) {
  const source = String(htmlString || "");
  if (source.includes('<header class="main-header">')) return source;
  const header = String(cachedHeader || "");
  if (!header) {
    reloadHeaderCacheOnce();
    return source;
  }
  if (source.includes('<div id="header"></div>')) {
    return source.replace('<div id="header"></div>', header);
  }
  // Some generated pages (e.g. tools) don't have a header slot. Inject right after <body>.
  return source.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
}

function absolutizeUrl(baseUrl, value) {
  const v = String(value || "").trim();
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (!baseUrl) return v;
  if (v.startsWith("/")) return `${baseUrl}${v}`;
  return `${baseUrl}/${v.replace(/^\/+/, "")}`;
}

function normalizeSeoUrlsInHtml(html, baseUrl) {
  let out = String(html || "");
  if (!baseUrl) return out;
  out = out.replace(
    /<link rel="canonical"[^>]*href="([^"]*)"[^>]*>/i,
    (_, href) => `<link rel="canonical" href="${absolutizeUrl(baseUrl, href)}">`
  );
  out = out.replace(
    /<meta property="og:url"[^>]*content="([^"]*)"[^>]*>/i,
    (_, content) => `<meta property="og:url" content="${absolutizeUrl(baseUrl, content)}">`
  );
  out = out.replace(
    /<meta property="og:image"[^>]*content="([^"]*)"[^>]*>/i,
    (_, content) => `<meta property="og:image" content="${absolutizeUrl(baseUrl, content)}">`
  );
  out = out.replace(
    /<meta name="twitter:image"[^>]*content="([^"]*)"[^>]*>/i,
    (_, content) => `<meta name="twitter:image" content="${absolutizeUrl(baseUrl, content)}">`
  );
  out = out.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    (full, json) => {
      try {
        const parsed = JSON.parse(json);
        const visit = (node) => {
          if (!node || typeof node !== "object") return;
          if (typeof node.url === "string") {
            node.url = absolutizeUrl(baseUrl, node.url);
          }
          for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === "object") visit(value);
          }
        };
        if (Array.isArray(parsed)) parsed.forEach(visit);
        else visit(parsed);
        return `<script type="application/ld+json">${JSON.stringify(parsed)}</script>`;
      } catch {
        return full;
      }
    }
  );
  return out;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safePageHref(item) {
  if (!item || typeof item !== "object") return "#";
  const rawUrl = item.url != null ? String(item.url).trim() : "";
  const rawSlug = item.slug != null ? String(item.slug).trim() : "";
  if (rawUrl && rawUrl !== "undefined" && rawUrl !== "null" && rawUrl !== "#") return rawUrl;
  if (rawSlug && rawSlug !== "undefined" && rawSlug !== "null") {
    return `/${rawSlug.replace(/^\/+/, "")}`;
  }
  return "#";
}

function getHomeRibbonClass(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "latest job" || s.startsWith("latest job ")) return "navy-ribbon";
  if (s === "new form" || s.startsWith("new form ")) return "navy-ribbon";
  if (s === "admission" || s.startsWith("admission ")) return "navy-ribbon";
  if (s.includes("admit card") || s === "admit") return "orange-ribbon";
  if (s.includes("answer key") || s === "answer") return "purple-ribbon";
  if (s.includes("result")) return "green-ribbon";
  if (s.includes("syllabus")) return "darkblue-ribbon";
  if (s.includes("document")) return "orange-ribbon";
  if (/\bnew\b/.test(s)) return "blue-ribbon";
  return "green-ribbon";
}

function isLatestJobRibbonStatus(status) {
  const t = String(status ?? "").trim().toLowerCase();
  return t === "latest job" || t.startsWith("latest job ")
    || t === "new form" || t.startsWith("new form ");
}

function formatRibbonLabelText(status) {
  const line = String(status ?? "").trim() || "SECTION";
  const upper = line.toUpperCase();
  if (upper.endsWith("S")) return upper;
  return `${upper}S`;
}

function buildRibbonTitleHtml(status) {
  if (isLatestJobRibbonStatus(status)) {
    return '<span class="mini-badge">Latest</span><span class="title">JOBS</span>';
  }
  const line = formatRibbonLabelText(status);
  return `<span class="title">${escapeHtml(line)}</span>`;
}

function breakingNewsLinkAttrsSsr(href) {
  const s = String(href || "").trim();
  if (!s || s === "#") return "";
  if (s.startsWith("/")) return "";
  if (/^https?:\/\//i.test(s)) return ' target="_blank" rel="noopener noreferrer"';
  return "";
}

function renderBreakingNewsHtml(items) {
  if (!Array.isArray(items) || !items.length) return "";

  const chips = items
    .map((item) => {
      const href =
        item && item.url != null && String(item.url).trim()
          ? String(item.url).trim()
          : safePageHref(item);
      const badge = resolveHomepageBadgeHtmlFromItem(item);
      const title = escapeHtml(item.title);
      const ext = breakingNewsLinkAttrsSsr(href);
      const badgeHtml = badge ? `<span class="breaking-rotator__badges">${badge}</span>` : "";
      return `<a href="${escapeHtml(href)}" class="breaking-rotator__chip"${ext} title="${title}"><span class="breaking-rotator__chip-inner">${badgeHtml}<span class="breaking-rotator__title">${title}</span></span></a>`;
    })
    .join("");

  const count = items.length;
  const dots = items
    .slice(0, 5)
    .map(
      (_, i) =>
        `<button type="button" class="breaking-rotator__dot${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-index="${i}" aria-label="Breaking update ${i + 1}"></button>`
    )
    .join("");
  const dotsMore =
    count > 5 ? `<span class="breaking-rotator__dots-more" hidden aria-hidden="true">+${count - 5}</span>` : "";
  const controlsClass = count <= 1 ? " breaking-rotator__controls--hidden" : "";

  return `<div class="breaking-rotator" data-breaking-rotator data-count="${count}" aria-live="polite"><div class="breaking-rotator__viewport"><div class="breaking-rotator__track">${chips}</div></div><div class="breaking-rotator__controls${controlsClass}"><button type="button" class="breaking-rotator__arrow breaking-rotator__arrow--prev" aria-label="Previous breaking update"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><div class="breaking-rotator__dots" role="tablist">${dots}${dotsMore}</div><button type="button" class="breaking-rotator__arrow breaking-rotator__arrow--next" aria-label="Next breaking update"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button></div></div>`;
}

function renderSmallBoxesHtml(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const colors = ["blue", "green", "orange", "purple"];
  const { colorIndexForSlot, MAX_SLOT } = require("./lib/smallBoxSlots");
  return items
    .slice(0, MAX_SLOT)
    .map((item, idx) => {
      const slot = item && item.smallBoxSlot != null ? Number(item.smallBoxSlot) : null;
      const colorIdx = colorIndexForSlot(slot, idx);
      const slotAttr =
        slot != null && Number.isInteger(slot) ? ` data-small-box-slot="${slot}"` : "";
      return `<a href="${escapeHtml(safePageHref(item))}" class="cat ${colors[colorIdx % colors.length]}"${slotAttr}>${escapeHtml(item.title)}</a>`;
    })
    .join("");
}

function renderTrendingSectionHtml(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return `<div class="trending-section section is-hidden" id="trendingSection" aria-hidden="true">
<h2 class="section-title">🔥 Trending Jobs</h2>
<ul id="trendingJobs" class="trending-list"></ul>
</div>`;
  }
  const listHtml = list
    .map((item) => {
      const badge = resolveHomeCardBadgeHtmlFromItem(item);
      return `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}${badge}</a></li>`;
    })
    .join("");
  return `<div class="trending-section section" id="trendingSection">
<h2 class="section-title">🔥 Trending Jobs</h2>
<ul id="trendingJobs" class="trending-list">${listHtml}</ul>
<div class="trending-view-more"><a href="/search" class="view-more view-more--green">View all trending jobs</a></div>
</div>`;
}

function renderPopularBoardsHtml(boards, opts = {}) {
  if (!Array.isArray(boards) || !boards.length) return "";
  const preview = boards.slice(0, 2);
  const pills = preview
    .map((board) => {
      const count = Number(board.count) || 0;
      const label =
        count > 0
          ? `${escapeHtml(board.label)}<span class="popular-categories__pill-count"> (${count})</span>`
          : escapeHtml(board.label);
      return `<a href="${escapeHtml(board.href)}" class="popular-categories__pill">${label}</a>`;
    })
    .join("");
  const panelClass = opts.panelClass || "";
  const panelAttrs = opts.panelAttrs || "";
  return `
<section class="popular-categories taxonomy-panel section${panelClass}" id="popularBoards" ${panelAttrs} aria-label="All Departments">
  <div class="taxonomy-panel__inner">
  <div class="popular-categories__row">
    ${pills}
    <a href="/categories?tab=departments" class="popular-categories__pill popular-categories__pill--view-all">View All</a>
  </div>
  </div>
</section>`;
}

function renderPopularQualificationsHtml(qualifications, opts = {}) {
  if (!Array.isArray(qualifications) || !qualifications.length) return "";
  const preview = qualifications.slice(0, 2);
  const pills = preview
    .map((item) => {
      const label = `${escapeHtml(item.label)}<span class="popular-categories__pill-count"> (${item.count})</span>`;
      return `<a href="${escapeHtml(item.href)}" class="popular-categories__pill">${label}</a>`;
    })
    .join("");
  const panelClass = opts.panelClass || "";
  const panelAttrs = opts.panelAttrs || "";
  return `
<section class="popular-categories taxonomy-panel section${panelClass}" id="popularQualifications" ${panelAttrs} aria-label="All Qualifications">
  <div class="taxonomy-panel__inner">
  <div class="popular-categories__row">
    ${pills}
    <a href="/categories?tab=qualifications" class="popular-categories__pill popular-categories__pill--view-all">View All</a>
  </div>
  </div>
</section>`;
}

function renderPopularStatesHtml(states, opts = {}) {
  if (!Array.isArray(states) || !states.length) return "";
  const preview = states.slice(0, 2);
  const pills = preview
    .map((item) => {
      const label = `${escapeHtml(item.label)}<span class="popular-categories__pill-count"> (${item.count})</span>`;
      return `<a href="${escapeHtml(item.href)}" class="popular-categories__pill">${label}</a>`;
    })
    .join("");
  const panelClass = opts.panelClass || "";
  const panelAttrs = opts.panelAttrs || "";
  return `
<section class="popular-categories taxonomy-panel section${panelClass}" id="popularStates" ${panelAttrs} aria-label="All States">
  <div class="taxonomy-panel__inner">
  <div class="popular-categories__row">
    ${pills}
    <a href="/categories?tab=states" class="popular-categories__pill popular-categories__pill--view-all">View All</a>
  </div>
  </div>
</section>`;
}

const VALID_CATEGORY_TABS = new Set(["departments", "qualifications", "states"]);

function normalizeCategoryTabParam(raw) {
  const tab = String(raw || "")
    .trim()
    .toLowerCase();
  return VALID_CATEGORY_TABS.has(tab) ? tab : "departments";
}

function renderCategoriesPanelPills(items, labelFn) {
  if (!Array.isArray(items) || !items.length) {
    return `<p class="categories-browse__empty">No categories available yet.</p>`;
  }
  return items
    .map((item) => {
      const label = labelFn(item);
      return `<a href="${escapeHtml(item.href)}" class="popular-categories__pill">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function renderCategoriesBrowseHtml(boards, qualifications, states, activeTabRaw) {
  const activeTab = normalizeCategoryTabParam(activeTabRaw);

  const departmentItems = Array.isArray(boards) ? boards : [];
  const qualificationItems = Array.isArray(qualifications) ? qualifications : [];
  const stateItems = Array.isArray(states) ? states : [];

  const formatBrowseLabel = (item) =>
    Number(item.count) > 0 ? `${item.label} (${item.count})` : item.label;

  const tabDefs = [
    {
      key: "departments",
      label: "Departments",
      tabId: "categoriesTabDepartments",
      panelId: "categoriesBoards",
      pills: renderCategoriesPanelPills(departmentItems, formatBrowseLabel)
    },
    {
      key: "qualifications",
      label: "Qualifications",
      tabId: "categoriesTabQualifications",
      panelId: "categoriesQualifications",
      pills: renderCategoriesPanelPills(qualificationItems, formatBrowseLabel)
    },
    {
      key: "states",
      label: "States",
      tabId: "categoriesTabStates",
      panelId: "categoriesStates",
      pills: renderCategoriesPanelPills(stateItems, formatBrowseLabel)
    }
  ];

  const resolvedActive = tabDefs.some((tab) => tab.key === activeTab)
    ? activeTab
    : "departments";

  const tabsHtml = tabDefs
    .map((tab) => {
      const isActive = tab.key === resolvedActive;
      return `<button type="button" class="taxonomy-tabs__btn${isActive ? " is-active" : ""}" role="tab" id="${tab.tabId}" data-taxonomy-tab="${escapeHtml(tab.key)}" aria-selected="${isActive ? "true" : "false"}" aria-expanded="${isActive ? "true" : "false"}" aria-controls="${escapeHtml(tab.panelId)}"><span class="taxonomy-tabs__label">${escapeHtml(tab.label)}</span></button>`;
    })
    .join("");

  const panelsHtml = tabDefs
    .map((tab) => {
      const isActive = tab.key === resolvedActive;
      return `<section class="popular-categories taxonomy-panel categories-browse__panel section${isActive ? " taxonomy-panel--active" : ""}" id="${escapeHtml(tab.panelId)}" data-taxonomy-panel="${escapeHtml(tab.key)}" role="tabpanel" aria-hidden="${isActive ? "false" : "true"}"><div class="taxonomy-panel__inner"><div class="popular-categories__grid popular-categories__grid--browse">${tab.pills}</div></div></section>`;
    })
    .join("");

  return `<div class="taxonomy-discovery categories-browse" id="categoriesBrowse"><div class="taxonomy-tabs" role="tablist" aria-label="Browse job categories">${tabsHtml}</div><div class="taxonomy-panels">${panelsHtml}</div></div>`;
}

function renderTaxonomyDiscoveryHtml(boards, qualifications, states) {
  const panelIdByKey = {
    departments: "popularBoards",
    qualifications: "popularQualifications",
    states: "popularStates"
  };

  const tabDefs = [
    {
      key: "departments",
      label: "All Departments",
      tabId: "taxonomyTabDepartments",
      html: renderPopularBoardsHtml(boards, {
        panelAttrs: 'data-taxonomy-panel="departments" role="tabpanel"'
      })
    },
    {
      key: "qualifications",
      label: "All Qualifications",
      tabId: "taxonomyTabQualifications",
      html: renderPopularQualificationsHtml(qualifications, {
        panelAttrs: 'data-taxonomy-panel="qualifications" role="tabpanel"'
      })
    },
    {
      key: "states",
      label: "All States",
      tabId: "taxonomyTabStates",
      html: renderPopularStatesHtml(states, {
        panelAttrs: 'data-taxonomy-panel="states" role="tabpanel"'
      })
    }
  ];

  const activeTabs = tabDefs.filter((def) => Boolean(def.html));

  if (!activeTabs.length) return "";

  const tabsHtml = activeTabs
    .map((tab, index) => {
      const isActive = index === 0;
      const panelId = panelIdByKey[tab.key] || "";
      const activeClass = isActive ? " is-active" : "";
      const ariaExpanded = isActive ? "true" : "false";
      return `<button type="button" class="taxonomy-tabs__btn${activeClass}" role="tab" id="${tab.tabId}" data-taxonomy-tab="${escapeHtml(tab.key)}" aria-selected="${isActive ? "true" : "false"}" aria-expanded="${ariaExpanded}" aria-controls="${escapeHtml(panelId)}"><span class="taxonomy-tabs__label">${escapeHtml(tab.label)}</span></button>`;
    })
    .join("");

  const panelsHtml = activeTabs
    .map((tab, index) => {
      const activeClass = index === 0 ? " taxonomy-panel--active" : "";
      return tab.html.replace(
        'class="popular-categories taxonomy-panel section"',
        `class="popular-categories taxonomy-panel section${activeClass}"`
      );
    })
    .join("");

  return `
<div class="taxonomy-discovery section" id="taxonomyDiscovery">
  <div class="taxonomy-tabs" role="tablist" aria-label="Explore jobs by category">
    ${tabsHtml}
  </div>
  <div class="taxonomy-panels">
    ${panelsHtml}
  </div>
</div>`;
}

function renderHomeCardsHtml(sectionResults) {
  const cards = [];
  const sorted = sortHomeSectionResults(sectionResults, "desktop");
  for (const { def, payload } of sorted) {
    if (!payload || !Array.isArray(payload.data) || !payload.data.length) continue;
    const ribbonClass = getHomeRibbonClass(def.ribbonStatus);
    const ribbonFormClass = isLatestJobRibbonStatus(def.ribbonStatus) ? " form-ribbon" : "";
    const linksHtml = payload.data
      .map((item) => {
        const badge = resolveHomeCardBadgeHtmlFromItem(item);
        return `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}${badge || ""}</a></li>`;
      })
      .join("");
    cards.push(`
      <div class="card" ${buildHomeSectionCardAttrs(def)}>
        <div class="ribbon ${ribbonClass}${ribbonFormClass}">
          ${buildRibbonTitleHtml(def.ribbonStatus)}
        </div>
        <div class="card-content">
          <ul class="job-list">${linksHtml}</ul>
          ${buildHomeViewMoreLinkHtml(def, payload, escapeHtml)}
        </div>
      </div>
    `);
  }
  return cards.join("");
}

function renderListingItemsHtml(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div class="card"><div class="card-content"><p class="listing-empty">No updates found in this section yet.</p></div></div>';
  }
  const linksHtml = items
    .map((item) => `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}</a></li>`)
    .join("");
  return `
    <div class="card">
      <div class="card-content">
        <ul class="job-list">${linksHtml}</ul>
      </div>
    </div>
  `;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderSearchResultsHtml(query, items) {
  if (!query) {
    return `
      <div class="result-card">
        <h2>Search Sarkari Updates</h2>
        <p>Use the search box to find government jobs, results, admit cards, answer keys, syllabus and admission updates.</p>
      </div>
    `;
  }
  if (!Array.isArray(items) || !items.length) {
    return `<p>No results found</p>`;
  }
  const rx = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return items
    .map((item) => {
      const title = escapeHtml(item.title || "Untitled");
      const href = escapeHtml(safePageHref(item));
      const highlightedTitle = title.replace(rx, "<span class=\"highlight\">$1</span>");
      return `
        <div class="result-card">
          <div class="result-card__main">
            <h2><a href="${href}">${highlightedTitle}</a></h2>
          </div>
        </div>
      `;
    })
    .join("");
}

async function buildSearchFallbackHtml(req, query) {
  const source = await fileService.readFile(path.join(generatedDir, "static", "search.html"), "utf8");
  const topViews = await pageService.getTopViews().catch(() => []);
  const latestJobLinks = Array.isArray(topViews)
    ? topViews
        .slice(0, 10)
        .map((item) => `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}</a></li>`)
        .join("")
    : "";
  const popularSearchLinks = [
    { href: "/search?q=railway", label: "Railway Jobs" },
    { href: "/search?q=ssc", label: "SSC" },
    { href: "/search?q=upsc", label: "UPSC" },
    { href: "/search?q=admit+card", label: "Admit Card" },
    { href: "/search?q=result", label: "Results" },
    { href: "/search?q=answer+key", label: "Answer Key" }
  ]
    .map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`)
    .join("");
  const guidance = query
    ? `Search is temporarily unavailable for "<strong>${escapeHtml(query)}</strong>". You can explore these popular categories and latest jobs.`
    : "Find jobs faster using popular search topics and the latest government job links below.";
  const fallbackResultsHtml = `
    <div class="result-card">
      <h2>Search Help</h2>
      <p>${guidance}</p>
    </div>
    <div class="result-card">
      <h2>Popular Searches</h2>
      <ul class="job-list">${popularSearchLinks}</ul>
    </div>
    <div class="result-card">
      <h2>Latest Jobs</h2>
      <ul class="job-list">${latestJobLinks || '<li><a href="/latest-job">Browse latest government jobs</a></li>'}</ul>
    </div>
  `;
  const title = query ? `Search Fallback for "${escapeHtml(query)}"` : "Search Sarkari Jobs";
  const countText = query
    ? "Showing fallback links while search service recovers."
    : "Browse popular searches and latest jobs.";
  const html = String(source)
    .replace(/<h1 id="searchTitle">[\s\S]*?<\/h1>/, `<h1 id="searchTitle">${title}</h1>`)
    .replace(/<p id="resultCount">[\s\S]*?<\/p>/, `<p id="resultCount">${countText}</p>`)
    .replace(/<div id="results">[\s\S]*?<\/div>/, `<div id="results">${fallbackResultsHtml}</div>`);
  return normalizeSeoUrlsInHtml(html, getPublicBaseUrl(req));
}

async function buildHomepageInitialSections() {
  const [breakingNews, countdownEvents, smallBoxes, trendingJobs, sectionDefs, taxonomyStats] = await Promise.all([
    miscService.getBreakingNews().catch(() => []),
    miscService.getCountdownEvents().catch(() => []),
    miscService.getSmallBoxes().catch(() => []),
    pageService.getTopViews().catch(() => []),
    miscService.getHomepageSections().catch(() => []),
    homeStatsService.getTaxonomyStats().catch(() => ({ boards: [], qualifications: [], states: [] }))
  ]);

  const popularBoards = Array.isArray(taxonomyStats.boards) ? taxonomyStats.boards : [];
  const popularQualifications = Array.isArray(taxonomyStats.qualifications)
    ? taxonomyStats.qualifications
    : [];
  const popularStates = Array.isArray(taxonomyStats.states) ? taxonomyStats.states : [];

  const sectionResults = await Promise.all(
    sectionDefs.map(async (def) => {
      const payload = await pageService.listPages({
        status: def.queryMode === "status" ? def.queryValue : undefined,
        section: def.queryMode === "section" ? def.queryValue : undefined,
        page: 1,
        limit: 25,
        freshnessSort: true
      }).catch(() => null);
      return { def, payload };
    })
  );

  const bootstrap = buildHomeBootstrap({
    breakingNews,
    countdownEvents,
    smallBoxes,
    trendingJobs,
    sectionDefs,
    sectionResults,
    popularBoards,
    popularQualifications,
    popularStates
  });

  return {
    breakingNewsHtml: renderBreakingNewsHtml(breakingNews),
    smallBoxesHtml: renderSmallBoxesHtml(smallBoxes),
    trendingSectionHtml: renderTrendingSectionHtml(trendingJobs),
    popularBoardsHtml: renderPopularBoardsHtml(popularBoards),
    popularQualificationsHtml: renderPopularQualificationsHtml(popularQualifications),
    popularStatesHtml: renderPopularStatesHtml(popularStates),
    taxonomyDiscoveryHtml: renderTaxonomyDiscoveryHtml(
      popularBoards,
      popularQualifications,
      popularStates
    ),
    dynamicSectionsHtml: renderHomeCardsHtml(sectionResults),
    bootstrapScript: buildHomeBootstrapScriptTag(bootstrap)
  };
}

async function sendSeoAugmentedHtml(req, res, absPath, {
  title = "",
  description = "",
  canonicalPath = "/",
  noindex = false
} = {}, statusCode) {
  const source = await fileService.readFile(absPath, "utf8");
  const baseUrl = getPublicBaseUrl(req);
  const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
  let html = String(source);
  if (title) {
    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
    }
  }
  if (description) {
    if (/<meta name="description"[^>]*>/i.test(html)) {
      html = html.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${description}">`);
    } else {
      html = html.replace(/<\/head>/i, `  <meta name="description" content="${description}">\n</head>`);
    }
  }
  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}">`;
  if (/<link rel="canonical"[^>]*>/i.test(html)) {
    html = html.replace(/<link rel="canonical"[^>]*>/i, canonicalTag);
  } else {
    html = html.replace(/<\/head>/i, `  ${canonicalTag}\n</head>`);
  }
  if (description && !/<meta property="og:description"[^>]*>/i.test(html)) {
    html = html.replace(/<\/head>/i, `  <meta property="og:description" content="${description}">\n</head>`);
  }
  if (title && !/<meta property="og:title"[^>]*>/i.test(html)) {
    html = html.replace(/<\/head>/i, `  <meta property="og:title" content="${title}">\n</head>`);
  }
  if (!/<meta property="og:url"[^>]*>/i.test(html)) {
    html = html.replace(/<\/head>/i, `  <meta property="og:url" content="${canonicalUrl}">\n</head>`);
  }
  if (!/<meta property="og:image"[^>]*>/i.test(html)) {
    const defaultOgImage = baseUrl ? `${baseUrl}/assets/image/logo/favicon.png` : "/assets/image/logo/favicon.png";
    html = html.replace(/<\/head>/i, `  <meta property="og:image" content="${defaultOgImage}">\n</head>`);
  }
  html = normalizeSeoUrlsInHtml(html, baseUrl);
  if (noindex && !/<meta name="robots"[^>]*>/i.test(html)) {
    html = html.replace(/<\/head>/i, `  <meta name="robots" content="noindex, nofollow">\n</head>`);
  }
  return sendHtmlString(req, res, html, statusCode);
}

const assetCache = isProd ? "30d" : 0;
const uploadCache = isProd ? "7d" : 0;
const htmlStaticCache = isProd ? 120 : 0;

const noStoreDevHeaders = (res) => {
  if (!isProd) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
};

const assetStaticOpts = isProd
  ? { maxAge: assetCache, etag: true, index: false }
  : { maxAge: 0, etag: false, index: false, setHeaders: noStoreDevHeaders };
const uploadStaticOpts = { maxAge: uploadCache, etag: true, index: false };
const generatedStaticOpts = {
  maxAge: htmlStaticCache,
  etag: true,
  index: "index.html"
};

app.use("/assets", express.static(publicAssets, assetStaticOpts));
app.use("/css", express.static(path.join(publicAssets, "css"), assetStaticOpts));
app.use("/js", express.static(path.join(publicAssets, "js"), assetStaticOpts));

app.use("/image", express.static(path.join(uploadsRoot, "images"), uploadStaticOpts));
app.use("/pdf", express.static(path.join(uploadsRoot, "pdf"), uploadStaticOpts));

app.get("/css/base/site-tokens.css", (req, res) => {
  res.redirect(301, "/css/base/tokens.css");
});
app.get("/css/site-tokens.css", (req, res) => {
  res.redirect(301, "/css/base/tokens.css");
});

app.get("/sitemap.xml", sendSitemap);
app.get("/sitemap/:name", asyncHandler(async (req, res, next) => {
  const name = String(req.params.name || "").trim();
  if (!/^sitemap-[a-z0-9-]+\.xml$/i.test(name)) return next();
  const filePath = resolveInsideRoot(generatedDir, "sitemap", name);
  if (!filePath || !fileService.existsSync(filePath)) return next();
  if (isProd) {
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  }
  res.type("application/xml; charset=utf-8");
  return res.sendFile(filePath);
}));

const { renderOgJobImage } = require("./controllers/public/ogJob.controller");
app.get("/og/job/:slug", renderOgJobImage);

app.use("/api", require("./api/public/jobs.routes"));
app.use("/api", require("./api/public/search.routes"));
app.use("/api", require("./api/public/finder.routes"));
app.use("/api", require("./api/public/page.routes"));
app.use("/api", require("./api/public/misc.routes"));

app.use("/api/admin", require("./api/admin/auth.routes"));
app.use("/api/admin", require("./api/admin/protected.routes"));

app.use("/static", asyncHandler(async (req, res, next) => {
  const reqPath = String(req.path || "");
  if (!/\.html$/i.test(reqPath)) return next();
  const rel = reqPath.replace(/^\/+/, "");
  const abs = resolveInsideRoot(generatedDir, "static", rel);
  if (!abs || !fileService.existsSync(abs)) return next();
  const source = await fileService.readFile(abs, "utf8");
  const html = normalizeSeoUrlsInHtml(String(source || ""), getPublicBaseUrl(req));
  return sendHtmlString(req, res, html);
}));
app.use("/static", express.static(path.join(generatedDir, "static"), { ...generatedStaticOpts, index: false }));

app.get("/robots.txt", (req, res) => {
  const siteUrl = getPublicBaseUrl(req);
  if (isProd) res.set("Cache-Control", "public, max-age=86400");
  res.type("text/plain; charset=utf-8");
  const sitemapLine = siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : "Sitemap: /sitemap.xml";
  res.send(`User-agent: *
Allow: /
Disallow: /search?q=
Disallow: /login
Disallow: /generator
Disallow: /upload
Disallow: /trash
Disallow: /dashboard
Disallow: /admin/
Disallow: /api/
Disallow: /job-admin

${sitemapLine}
`);
});

app.get("/login", asyncHandler(async (req, res) => {
  await sendSeoAugmentedHtml(req, res, path.join(generatedDir, "static", "login.html"), {
    title: "Admin Login | Sarkari Suchna India",
    description: "Admin login portal for Sarkari Suchna India.",
    canonicalPath: "/login",
    noindex: true
  });
}));

app.get("/search", asyncHandler(async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const source = await fileService.readFile(path.join(generatedDir, "static", "search.html"), "utf8");
    const results = query ? await searchService.search(query).catch(() => []) : [];
    const searchTitle = query ? `Search Results for "${escapeHtml(query)}"` : "Search Sarkari Jobs";
    const resultCountText = query
      ? `${results.length} result(s) found`
      : "Browse government jobs, results, admit cards and related updates.";
    let html = String(source)
      .replace(/<h1 id="searchTitle">[\s\S]*?<\/h1>/, `<h1 id="searchTitle">${searchTitle}</h1>`)
      .replace(/<p id="resultCount">[\s\S]*?<\/p>/, `<p id="resultCount">${escapeHtml(resultCountText)}</p>`)
      .replace(/<div id="results">[\s\S]*?<\/div>/, `<div id="results">${renderSearchResultsHtml(query, results)}</div>`);
    html = normalizeSeoUrlsInHtml(html, getPublicBaseUrl(req));
    if (query) {
      if (/<meta name="robots"[^>]*>/i.test(html)) {
        html = html.replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="noindex,follow">');
      } else {
        html = html.replace(/<\/head>/i, '  <meta name="robots" content="noindex,follow">\n</head>');
      }
    }
    await sendHtmlString(req, res, html);
  } catch (err) {
    logger.warn("search server-render fallback failed", {
      message: err && err.message ? err.message : String(err)
    });
    const query = String(req.query.q || "").trim();
    const fallbackHtml = await buildSearchFallbackHtml(req, query).catch(() => "");
    if (fallbackHtml) {
      await sendHtmlString(req, res, fallbackHtml);
      return;
    }
    await sendSeoAugmentedHtml(req, res, path.join(generatedDir, "static", "search.html"), {
      title: "Search Sarkari Jobs, Results and Admit Cards | Sarkari Suchna India",
      description: "Search government jobs, results, admit cards, answer keys, syllabus and admission updates on Sarkari Suchna India.",
      canonicalPath: "/search"
    });
  }
}));

/** Legacy jobs.html filters → canonical SEO taxonomy hub URLs */
app.get("/jobs.html", asyncHandler(async (req, res, next) => {
  const dept = normalizeBoardSlug(req.query.department);
  const qual = String(req.query.qualification || "")
    .trim()
    .toLowerCase();
  const stateRaw = String(req.query.state || "")
    .trim()
    .toLowerCase();
  const state = normalizeStateSlug(stateRaw);
  const hasExtra = req.query.status || req.query.jobType || req.query.source;

  if (!hasExtra) {
    if (dept && isBoardSlug(dept) && !qual && !state) {
      return res.redirect(301, buildDepartmentPath(dept));
    }
    if (qual && !dept && !state && ALLOWED_JOB_QUALIFICATIONS.has(qual)) {
      return res.redirect(301, buildQualificationPath(qual));
    }
    if (state && !dept && !qual && ALLOWED_JOB_STATES.has(state)) {
      return res.redirect(301, buildStatePath(state));
    }
  }
  return next();
}));

app.get(["/", "/index.html"], asyncHandler(async (req, res) => {
  try {
    const source = await fileService.readFile(path.join(generatedDir, "static", "index.html"), "utf8");
    const homeSections = await buildHomepageInitialSections();
    let html = String(source)
      .replace('<div id="header"></div>', String(cachedHeader || ""))
      .replace(
        /<div class="breaking-right" id="breakingNews">[\s\S]*?<\/div>/,
        `<div class="breaking-right" id="breakingNews">${homeSections.breakingNewsHtml}</div>`
      )
      .replace(
        /<div class="small-boxes section" id="smallBoxes">[\s\S]*?<\/div>/,
        `<div class="small-boxes section" id="smallBoxes">${homeSections.smallBoxesHtml}</div>`
      )
      .replace(
        /<div class="taxonomy-discovery section" id="taxonomyDiscovery"[\s\S]*?<\/div>\s*(?=<!-- 🟦 Cards -->|<div class="cards card-grid section cards-section" id="dynamicSections">)/,
        homeSections.taxonomyDiscoveryHtml || ""
      )
      .replace(
        /<div class="cards card-grid section cards-section" id="dynamicSections">[\s\S]*?<\/div>/,
        `<div class="cards card-grid section cards-section" id="dynamicSections">${homeSections.dynamicSectionsHtml}</div>`
      )
      .replace(
        /<div class="trending-section section"[\s\S]*?<\/div>\s*(?=<div id="about-site")/,
        homeSections.trendingSectionHtml
      )
      .replace(
        /<div id="about-site" class="section about-site-slot"[^>]*><\/div>/,
        `<div id="about-site" class="section about-site-slot about-site-slot--collapsible" aria-label="About this site">${taxonomyPageService.getAboutSiteHtml()}</div>`
      )
      .replace(
        '<div id="footer"></div>',
        taxonomyPageService.getFooterHtml()
      )
      .replace(
        '<script src="/js/index.js?v=2" defer></script>',
        `${homeSections.bootstrapScript}\n<script src="/js/index.js?v=2" defer></script>`
      );
    const baseUrl = getPublicBaseUrl(req);
    html = normalizeSeoUrlsInHtml(html, baseUrl);
    await sendHtmlString(req, res, html);
  } catch (err) {
    logger.warn("homepage server-render fallback failed", {
      message: err && err.message ? err.message : String(err)
    });
    const source = await fileService.readFile(path.join(generatedDir, "static", "index.html"), "utf8");
    let html = String(source)
      .replace('<div id="header"></div>', String(cachedHeader || ""))
      .replace(
        /<div id="about-site" class="section about-site-slot"[^>]*><\/div>/,
        `<div id="about-site" class="section about-site-slot about-site-slot--collapsible" aria-label="About this site">${taxonomyPageService.getAboutSiteHtml()}</div>`
      )
      .replace('<div id="footer"></div>', taxonomyPageService.getFooterHtml());
    html = normalizeSeoUrlsInHtml(html, getPublicBaseUrl(req));
    await sendHtmlString(req, res, html);
  }
}));

const { isBoardSlug, normalizeBoardSlug, allBoardHubs } = require("./lib/boardHubs");

async function sendTaxonomyHubHtml(req, res, type) {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    return res.redirect(302, "/search");
  }
  if (type === "state" && slug.toLowerCase() === "all-india") {
    return res.redirect(301, buildStatePath("central"));
  }
  if (type === "board") {
    const rawNorm = slug.replace(/-/g, " ").trim().toLowerCase();
    const canonical = normalizeBoardSlug(rawNorm);
    if (canonical && canonical !== rawNorm && isBoardSlug(canonical)) {
      return res.redirect(301, buildDepartmentPath(canonical));
    }
  }
  const html = await taxonomyPageService.buildTaxonomyPage({
    type,
    slug,
    baseUrl: getPublicBaseUrl(req),
    headerHtml: cachedHeader
  });
  if (!html) {
    return res.redirect(302, `/search?q=${encodeURIComponent(slug)}`);
  }
  const normalized = normalizeSeoUrlsInHtml(html, getPublicBaseUrl(req));
  return sendHtmlString(req, res, normalized);
}

app.get("/department/:slug", asyncHandler(async (req, res) => sendTaxonomyHubHtml(req, res, "board")));
app.get("/qualification/:slug", asyncHandler(async (req, res) => sendTaxonomyHubHtml(req, res, "qualification")));
app.get("/state/:slug", asyncHandler(async (req, res) => sendTaxonomyHubHtml(req, res, "state")));

app.get("/topic/:slug", asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    return res.redirect(302, "/search");
  }
  const html = await topicPageService.buildTopicPage({
    slug,
    baseUrl: getPublicBaseUrl(req),
    headerHtml: cachedHeader,
    footerHtml: taxonomyPageService.getFooterHtml()
  });
  if (!html) {
    return res.redirect(302, `/search?q=${encodeURIComponent(slug)}`);
  }
  const normalized = normalizeSeoUrlsInHtml(html, getPublicBaseUrl(req));
  return sendHtmlString(req, res, normalized);
}));

/** Legacy /board/{slug} → canonical /department/{slug} */
app.get("/board/:slug", asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    return res.redirect(302, "/search");
  }
  return res.redirect(301, buildDepartmentPath(slug));
}));

/** Legacy /tag/{board} → /department/{board}; other tags → /topic/{slug}. */
app.get("/tag/:tag", asyncHandler(async (req, res) => {
  const raw = normalizeBoardSlug(req.params.tag);
  if (!raw) {
    return res.redirect(302, "/search");
  }
  if (isBoardSlug(raw)) {
    return res.redirect(301, buildDepartmentPath(raw));
  }
  return res.redirect(301, `/topic/${encodeURIComponent(raw)}`);
}));

const staticPageRoutes = {
  "privacy-policy": "privacy-policy.html",
  "terms-and-conditions": "terms-and-conditions.html",
  disclaimer: "disclaimer.html",
  "content-policy": "content-policy.html",
  "contact-us": "contact-us.html",
  privacy: "privacy-policy.html",
  terms: "terms-and-conditions.html",
  contact: "contact-us.html",
  "disclaimer-policy": "disclaimer.html"
};
const staticPageSeo = {
  "privacy-policy": {
    title: "Privacy Policy | Sarkari Suchna India",
    description: "Read the privacy policy for Sarkari Suchna India and understand how user information is handled."
  },
  privacy: {
    title: "Privacy Policy | Sarkari Suchna India",
    description: "Read the privacy policy for Sarkari Suchna India and understand how user information is handled."
  },
  "terms-and-conditions": {
    title: "Terms and Conditions | Sarkari Suchna India",
    description: "Read the terms and conditions for using Sarkari Suchna India and its public information services."
  },
  terms: {
    title: "Terms and Conditions | Sarkari Suchna India",
    description: "Read the terms and conditions for using Sarkari Suchna India and its public information services."
  },
  disclaimer: {
    title: "Disclaimer | Sarkari Suchna India",
    description: "Read the Sarkari Suchna India disclaimer regarding job information, notifications and third-party links."
  },
  "disclaimer-policy": {
    title: "Disclaimer | Sarkari Suchna India",
    description: "Read the Sarkari Suchna India disclaimer regarding job information, notifications and third-party links."
  },
  "content-policy": {
    title: "Content Policy | Sarkari Suchna India",
    description: "Review the editorial and content policy followed by Sarkari Suchna India."
  },
  "contact-us": {
    title: "Contact Us | Sarkari Suchna India",
    description: "Contact Sarkari Suchna India for support, feedback or corrections."
  },
  contact: {
    title: "Contact Us | Sarkari Suchna India",
    description: "Contact Sarkari Suchna India for support, feedback or corrections."
  }
};

const categoriesPagePath = path.join(generatedDir, "static", "categories.html");
const categoriesPageSeo = {
  title: "Browse Categories | Sarkari Suchna India",
  description:
    "Browse government job categories by department, qualification and state on Sarkari Suchna India.",
  canonicalPath: "/categories"
};

app.get(["/categories", "/categories.html"], asyncHandler(async (req, res) => {
  const activeTab = normalizeCategoryTabParam(req.query.tab);
  const browseLists = await homeStatsService.getBrowseCategoryLists().catch(() => ({
    boards: allBoardHubs().map((hub) => ({
      slug: hub.slug,
      label: hub.label,
      href: buildDepartmentPath(hub.slug),
      count: 0
    })),
    qualifications: [],
    states: []
  }));
  const browseHtml = renderCategoriesBrowseHtml(
    browseLists.boards,
    browseLists.qualifications,
    browseLists.states,
    activeTab
  );
  const source = await fileService.readFile(categoriesPagePath, "utf8");
  const html = String(source).replace(
    /<div id="categoriesBrowse"[\s\S]*?<\/div>/,
    browseHtml
  );
  const baseUrl = getPublicBaseUrl(req);
  const canonicalPath = activeTab === "departments" ? "/categories" : `/categories?tab=${activeTab}`;
  let out = html;
  if (categoriesPageSeo.title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${categoriesPageSeo.title}</title>`);
  }
  if (categoriesPageSeo.description) {
    out = out.replace(
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${categoriesPageSeo.description}">`
    );
  }
  const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
  out = out.replace(
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonicalUrl}">`
  );
  out = normalizeSeoUrlsInHtml(out, baseUrl);
  await sendHtmlString(req, res, out);
}));

Object.entries(staticPageRoutes).forEach(([route, file]) => {
  const abs = path.join(generatedDir, "static", file);
  app.get(`/${route}`, asyncHandler(async (req, res) => {
    await sendSeoAugmentedHtml(req, res, abs, {
      ...(staticPageSeo[route] || {}),
      canonicalPath: `/${route}`
    });
  }));
  app.get(`/${route}.html`, asyncHandler(async (req, res) => {
    await sendSeoAugmentedHtml(req, res, abs, {
      ...(staticPageSeo[route] || {}),
      canonicalPath: `/${route}`
    });
  }));
});

const listingHtmlPath = path.join(generatedDir, "static", "listing.html");
const listingSeoMap = {
  "latest-job": {
    title: "Latest Govt Jobs 2026 | Sarkari Suchna India",
    description: "Browse the latest government job forms, recruitment notifications and apply online updates on Sarkari Suchna India."
  },
  result: {
    title: "Latest Results 2026 | Sarkari Suchna India",
    description: "Check latest Sarkari results, scorecards and result announcements from central and state recruitment boards."
  },
  "admit-card": {
    title: "Admit Card 2026 Download | Sarkari Suchna India",
    description: "Download latest admit cards and exam hall ticket updates for Sarkari exams, recruitment tests and admissions."
  },
  "answer-key": {
    title: "Answer Key 2026 | Sarkari Suchna India",
    description: "Check latest official answer keys, objection notices and exam solution updates on Sarkari Suchna India."
  },
  document: {
    title: "Important Documents Updates | Sarkari Suchna India",
    description: "Find document verification, document upload and certificate related recruitment updates on Sarkari Suchna India."
  },
  syllabus: {
    title: "Exam Syllabus 2026 | Sarkari Suchna India",
    description: "Find latest Sarkari exam syllabus, pattern and subject-wise preparation details for upcoming recruitment exams."
  },
  admission: {
    title: "Admission 2026 Updates | Sarkari Suchna India",
    description: "Track latest admission forms, counselling schedules and education entrance related updates on Sarkari Suchna India."
  }
};

async function sendListingHtml(req, res, segment) {
  const seo = listingSeoMap[segment] || listingSeoMap["latest-job"];
  const baseUrl = getPublicBaseUrl(req);
  const absoluteUrl = baseUrl ? `${baseUrl}/${segment}` : `/${segment}`;
  const source = await fileService.readFile(listingHtmlPath, "utf8");
  const payload = await pageService.listPages({ section: segment, page: 1, limit: 20 }).catch(() => ({ data: [] }));
  let html = String(source)
    .replace(/<title id="pageTitle">[\s\S]*?<\/title>/, `<title id="pageTitle">${seo.title}</title>`)
    .replace(/<meta name="description" id="metaDesc" content="[^"]*">/, `<meta name="description" id="metaDesc" content="${seo.description}">`)
    .replace(/<link rel="canonical" id="canonicalLink" href="[^"]*">/, `<link rel="canonical" id="canonicalLink" href="${absoluteUrl}">`)
    .replace(/<meta property="og:title" id="ogTitle" content="[^"]*">/, `<meta property="og:title" id="ogTitle" content="${seo.title}">`)
    .replace(/<meta property="og:description" id="ogDesc" content="[^"]*">/, `<meta property="og:description" id="ogDesc" content="${seo.description}">`)
    .replace(/<meta property="og:url" id="ogUrl" content="[^"]*">/, `<meta property="og:url" id="ogUrl" content="${absoluteUrl}">`)
    .replace(/<h1 id="listingHeading">[\s\S]*?<\/h1>/, `<h1 id="listingHeading">${seo.title.replace(/\s+\|\s+Sarkari Suchna India$/, "")}</h1>`)
    .replace(/<p id="listingSub">[\s\S]*?<\/p>/, `<p id="listingSub">${seo.description}</p>`)
    .replace(/<div class="cards card-grid" id="dynamicSections">[\s\S]*?<\/div>/, `<div class="cards card-grid" id="dynamicSections">${renderListingItemsHtml(payload.data)}</div>`);
  html = normalizeSeoUrlsInHtml(html, baseUrl);
  return sendHtmlString(req, res, html);
}
app.get(["/new-form", "/new-form/"], (req, res) => {
  res.redirect(301, "/latest-job");
});
const listingSegments = [
  "latest-job",
  "result",
  "admit-card",
  "answer-key",
  "document",
  "syllabus",
  "admission"
];
listingSegments.forEach((seg) => {
  const handler = async (req, res, next) => {
    try {
      await sendListingHtml(req, res, seg);
    } catch (err) {
      next(err);
    }
  };
  app.get(`/${seg}`, handler);
  app.get(`/${seg}/`, handler);
});

app.get("/tools/age-calculator", asyncHandler(async (req, res) => {
  await sendSeoAugmentedHtml(req, res, path.join(generatedDir, "tools", "age-calculator.html"), {
    title: "Age Calculator | Sarkari Suchna India",
    description: "Calculate exact age from date of birth for SSC, UPSC, Railway and state government job eligibility — years, months, days and cut-off date support.",
    canonicalPath: "/tools/age-calculator"
  });
}));

app.get("/tools/image-resizer", asyncHandler(async (req, res) => {
  await sendSeoAugmentedHtml(req, res, path.join(generatedDir, "tools", "image-resizer.html"), {
    title: "Image Resizer & Compressor | Sarkari Suchna India",
    description: "Free image resizer for government job forms — resize passport photos, compress to KB limits and download JPG, PNG or WEBP.",
    canonicalPath: "/tools/image-resizer"
  });
}));

const verifyToken = require("./middleware/auth.middleware");

const privatePagesDir = path.join(__dirname, "../private");

function injectAdminNoindex(html) {
  const tag = '<meta name="robots" content="noindex, nofollow">';
  const source = String(html || "");
  if (/<meta name="robots"[^>]*>/i.test(source)) {
    return source.replace(/<meta name="robots"[^>]*>/i, tag);
  }
  return source.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function sendPrivatePage(res, fileName) {
  if (isProd) res.set("Cache-Control", "private, no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  const abs = path.join(privatePagesDir, fileName);
  const html = injectAdminNoindex(fs.readFileSync(abs, "utf8"));
  res.type("html").send(html);
}

app.get(["/admin/dashboard", "/admin/dashboard/", "/admin/dashboard.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-dashboard.html");
});
app.get(["/admin/page-manager", "/admin/page-manager/", "/admin/page-manager.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-page-manager.html");
});
app.get(["/admin/monitoring", "/admin/monitoring/", "/admin/monitoring.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-monitoring.html");
});
app.get(["/admin/alerts", "/admin/alerts/", "/admin/alerts.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-alerts.html");
});
app.get(["/admin/csv-upload", "/admin/csv-upload/", "/admin/csv-upload.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-csv-upload.html");
});
app.get(["/admin/sessions", "/admin/sessions/", "/admin/sessions.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-sessions.html");
});
app.get(["/admin/activity", "/admin/activity/", "/admin/activity.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-activity.html");
});
app.get(["/admin/homepage-management", "/admin/homepage-management/", "/admin/homepage-management.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-homepage-management.html");
});
app.get(["/admin/recruitments", "/admin/recruitments/", "/admin/recruitments.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-recruitments.html");
});
app.get(
  ["/admin/editorial-review", "/admin/editorial-review/", "/admin/editorial-review.html"],
  verifyToken,
  (req, res) => {
    return sendPrivatePage(res, "admin-editorial-review.html");
  }
);
app.get(["/admin/recruitment-testing", "/admin/recruitment-testing/", "/admin/recruitment-testing.html"], verifyToken, (req, res) => {
  return sendPrivatePage(res, "admin-recruitment-testing.html");
});
app.get(
  ["/admin/recruitment-review-queue", "/admin/recruitment-review-queue/", "/admin/recruitment-review-queue.html"],
  verifyToken,
  (req, res) => {
    return sendPrivatePage(res, "admin-recruitment-review-queue.html");
  }
);
app.get(
  [
    "/admin/recruitment-runtime-preview",
    "/admin/recruitment-runtime-preview/",
    "/admin/recruitment-runtime-preview.html"
  ],
  verifyToken,
  (req, res) => {
    return sendPrivatePage(res, "admin-recruitment-runtime-preview.html");
  }
);
app.get(
  ["/admin/seo-diagnostics", "/admin/seo-diagnostics/", "/admin/seo-diagnostics.html"],
  verifyToken,
  (req, res) => {
    return sendPrivatePage(res, "admin-seo-diagnostics.html");
  }
);
app.get("/admin", verifyToken, (req, res) => {
  res.redirect(302, "/admin/dashboard");
});

["dashboard", "generator", "upload", "trash"].forEach((route) => {
  app.get(`/${route}`, verifyToken, (req, res) => {
    if (route === "dashboard") return res.redirect(302, "/admin/dashboard");
    sendPrivatePage(res, `${route}.html`);
  });
});

app.get("/notification", (req, res) => {
  res.redirect(302, "/admin/alerts");
});

/** Job pages are created only via /generator; legacy job-admin UI is retired. */
app.get(["/job-admin", "/job-admin.html"], verifyToken, (req, res) => {
  if (isProd) res.set("Cache-Control", "private, no-store");
  res.redirect(302, "/generator");
});

app.use(asyncHandler(async (req, res, next) => {
  const reqPath = String(req.path || "");
  if (!/\.html$/i.test(reqPath)) return next();
  const rel = reqPath.replace(/^\/+/, "");
  const abs = resolveInsideRoot(generatedDir, rel);
  if (!abs || !fileService.existsSync(abs)) return next();
  const source = await fileService.readFile(abs, "utf8");
  const html = normalizeSeoUrlsInHtml(String(source || ""), getPublicBaseUrl(req));
  return sendHtmlString(req, res, html);
}));
app.use(express.static(generatedDir, { ...generatedStaticOpts, index: false }));

app.get("/:slug", async (req, res, next) => {
  const slug = normalizeFilesystemSlug(req.params.slug);

  const ignore = [
    "api",
    "tag",
    "search",
    "css",
    "js",
    "pdf",
    "posts",
    "generator",
    "dashboard",
    "job-admin",
    "upload",
    "notification",
    "trash",
    "login",
    "health",
    "ready",
    "latest-job",
    "new-form",
    "result",
    "admit-card",
    "answer-key",
    "document",
    "syllabus",
    "admission",
    "categories",
    "tools",
    "static",
    "image",
    "assets",
    "sitemap.xml",
    "admin"
  ];

  if (ignore.includes(slug)) return next();

  if (!isValidFilesystemSlug(slug)) return next();

  const postPath = resolveInsideRoot(generatedDir, "jobs", `${slug}.html`);
  if (postPath && fileService.existsSync(postPath)) {
    try {
      const { trackJobPageView } = require("./services/pageViews.service");
      setImmediate(() => {
        trackJobPageView(req, slug).catch(() => {});
      });
      const raw = await fileService.readFile(postPath, "utf8");
      const baseUrl = getPublicBaseUrl(req);
      const html = normalizeSeoUrlsInHtml(raw, baseUrl);
      return sendHtmlString(req, res, html);
    } catch (err) {
      return next(err);
    }
  }

  const pagePath = resolveInsideRoot(generatedDir, "pages", `${slug}.html`);
  if (pagePath && fileService.existsSync(pagePath)) {
    try {
      const raw = await fileService.readFile(pagePath, "utf8");
      const baseUrl = getPublicBaseUrl(req);
      const html = normalizeSeoUrlsInHtml(raw, baseUrl);
      return sendHtmlString(req, res, html);
    } catch (err) {
      return next(err);
    }
  }

  return next();
});

app.use(errorHandler);

app.use((req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  const notFound = path.join(generatedDir, "404.html");
  if (fileService.existsSync(notFound)) {
    return sendHtml(req, res, notFound, 404);
  }
  return sendHtml(req, res, path.join(generatedDir, "static", "404.html"), 404);
});

module.exports = app;
