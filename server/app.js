require("dotenv").config();

const express = require("express");
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
const miscService = require("./services/misc.service");
const pageService = require("./services/page.service");
const homeStatsService = require("./services/homeStats.service");
const searchService = require("./services/search.service");
const asyncHandler = require("./utils/asyncHandler");
const { getBaseUrl, getPublicBaseUrl } = require("./utils/baseUrl");
const { buildHomeBootstrap, buildHomeBootstrapScriptTag } = require("./lib/homeBootstrap");
const { resolveHomepageBadgeHtmlFromItem } = require("./lib/homepageBadges");

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
  const source = String(req && req.query ? req.query.source || "" : "").toLowerCase();
  return pathOnly === "/login" || pathOnly === "/jobs.html" || source === "finder";
}

async function sendHtmlString(req, res, html, statusCode) {
  if (statusCode) res.status(statusCode);
  if (isProd) {
    const maxAge = statusCode === 404 ? "60" : "120";
    res.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=300`);
  }
  res.type("html");
  const withHeader = shouldSkipChromeInjection(req) ? String(html || "") : await injectHeader(html);
  return res.send(withHeader);
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

function isNewFormRibbonStatus(status) {
  const t = String(status ?? "").trim().toLowerCase();
  return t === "new form" || t.startsWith("new form ");
}

function buildRibbonTitleHtml(status) {
  if (isNewFormRibbonStatus(status)) {
    return '<span class="mini-badge">New</span><span class="title">FORM</span>';
  }
  const line = String(status ?? "").trim() || "SECTION";
  return `<span class="title">${escapeHtml(line.toUpperCase())}</span>`;
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
  return `<div class="breaking-scroll">${items
    .map((item) => {
      const href = item && item.url != null && String(item.url).trim()
        ? String(item.url).trim()
        : safePageHref(item);
      const badge = resolveHomepageBadgeHtmlFromItem(item);
      const ext = breakingNewsLinkAttrsSsr(href);
      return `<a href="${escapeHtml(href)}"${ext}>${escapeHtml(item.title)} ${badge}</a>`;
    })
    .join("")}</div>`;
}

function renderSmallBoxesHtml(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const colors = ["blue", "green", "purple", "red"];
  return items
    .slice(0, 4)
    .map((item, idx) => `<a href="${escapeHtml(safePageHref(item))}" class="cat ${colors[idx % colors.length]}">${escapeHtml(item.title)}</a>`)
    .join("");
}

function renderTrendingJobsHtml(items) {
  if (!Array.isArray(items) || !items.length) return "";
  return items
    .map((item) => `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}</a></li>`)
    .join("");
}

function renderPopularBoardsHtml(boards) {
  if (!Array.isArray(boards) || !boards.length) return "";
  const pills = boards
    .map(
      (board) =>
        `<a href="${escapeHtml(board.href)}" class="popular-categories__pill">${escapeHtml(board.label)}</a>`
    )
    .join("");
  return `
<section class="popular-categories section" id="popularBoards" aria-labelledby="popularBoardsTitle">
  <h2 class="section-title popular-categories__title" id="popularBoardsTitle">Popular Boards</h2>
  <div class="popular-categories__grid">
    ${pills}
    <a href="/categories" class="popular-categories__pill popular-categories__pill--view-all">View All Categories</a>
  </div>
</section>`;
}

function renderPopularQualificationsHtml(qualifications) {
  if (!Array.isArray(qualifications) || !qualifications.length) return "";
  const pills = qualifications
    .map((item) => {
      const label = `${item.label} (${item.count})`;
      return `<a href="${escapeHtml(item.href)}" class="popular-categories__pill">${escapeHtml(label)}</a>`;
    })
    .join("");
  return `
<section class="popular-categories section" id="popularQualifications" aria-labelledby="popularQualificationsTitle">
  <h2 class="section-title popular-categories__title" id="popularQualificationsTitle">Popular Qualifications</h2>
  <div class="popular-categories__grid">
    ${pills}
  </div>
</section>`;
}

function renderHomeCardsHtml(sectionResults) {
  const cards = [];
  for (const { def, payload } of sectionResults) {
    if (!payload || !Array.isArray(payload.data) || !payload.data.length) continue;
    const ribbonClass = getHomeRibbonClass(def.ribbonStatus);
    const ribbonFormClass = isNewFormRibbonStatus(def.ribbonStatus) ? " form-ribbon" : "";
    const linksHtml = payload.data
      .map((item) => {
        const badge = resolveHomepageBadgeHtmlFromItem(item);
        return `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}</a>${badge}</li>`;
      })
      .join("");
    cards.push(`
      <div class="card">
        <div class="ribbon ${ribbonClass}${ribbonFormClass}">
          ${buildRibbonTitleHtml(def.ribbonStatus)}
        </div>
        <div class="card-content">
          <ul class="job-list">${linksHtml}</ul>
          <div class="card-view-more">
            <a href="${escapeHtml(def.href)}" class="view-more">View More</a>
          </div>
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

function getSearchStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("new")) return "badge-green";
  if (s.includes("result")) return "badge-blue";
  if (s.includes("admit")) return "badge-orange";
  if (s.includes("answer")) return "badge-purple";
  if (s.includes("syllabus")) return "badge-teal";
  return "badge-default";
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
      const status = escapeHtml(item.status || "");
      return `
        <div class="result-card">
          <h2><a href="${href}">${highlightedTitle}</a></h2>
          ${status ? `<span class="badge ${getSearchStatusClass(item.status)}">${status}</span>` : ""}
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
      <ul class="job-list">${latestJobLinks || '<li><a href="/new-form">Browse latest government jobs</a></li>'}</ul>
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
  const [breakingNews, smallBoxes, trendingJobs, sectionDefs, taxonomyStats] = await Promise.all([
    miscService.getBreakingNews().catch(() => []),
    miscService.getSmallBoxes().catch(() => []),
    pageService.getTopViews().catch(() => []),
    miscService.getHomepageSections().catch(() => []),
    homeStatsService.getTaxonomyStats().catch(() => ({ boards: [], qualifications: [] }))
  ]);

  const popularBoards = Array.isArray(taxonomyStats.boards) ? taxonomyStats.boards : [];
  const popularQualifications = Array.isArray(taxonomyStats.qualifications)
    ? taxonomyStats.qualifications
    : [];

  const sectionResults = await Promise.all(
    sectionDefs.map(async (def) => {
      const payload = await pageService.listPages({
        status: def.queryMode === "status" ? def.queryValue : undefined,
        section: def.queryMode === "section" ? def.queryValue : undefined,
        page: 1,
        limit: 25
      }).catch(() => null);
      return { def, payload };
    })
  );

  const bootstrap = buildHomeBootstrap({
    breakingNews,
    smallBoxes,
    trendingJobs,
    sectionDefs,
    sectionResults,
    popularBoards,
    popularQualifications
  });

  return {
    breakingNewsHtml: renderBreakingNewsHtml(breakingNews),
    smallBoxesHtml: renderSmallBoxesHtml(smallBoxes),
    trendingJobsHtml: renderTrendingJobsHtml(trendingJobs),
    popularBoardsHtml: renderPopularBoardsHtml(popularBoards),
    popularQualificationsHtml: renderPopularQualificationsHtml(popularQualifications),
    taxonomyDiscoveryHtml:
      renderPopularBoardsHtml(popularBoards) + renderPopularQualificationsHtml(popularQualifications),
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
  const filePath = path.join(generatedDir, "sitemap", name);
  const sitemapRoot = path.join(generatedDir, "sitemap");
  if (!filePath.startsWith(sitemapRoot) || !fileService.existsSync(filePath)) return next();
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
  const abs = path.join(generatedDir, "static", rel);
  const staticRoot = path.join(generatedDir, "static");
  if (!abs.startsWith(staticRoot) || !fileService.existsSync(abs)) return next();
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

/** Phase 2: department-only jobs filter → canonical board hub URL */
app.get("/jobs.html", asyncHandler(async (req, res, next) => {
  const dept = normalizeBoardSlug(req.query.department);
  const hasExtra =
    req.query.qualification || req.query.state || req.query.status || req.query.jobType || req.query.source;
  if (dept && isBoardSlug(dept) && !hasExtra) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const target = page > 1 ? `/tag/${dept}?page=${page}` : `/tag/${dept}`;
    return res.redirect(301, target);
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
        /<section class="popular-categories section" id="popularCategories"[\s\S]*?<\/section>/,
        homeSections.taxonomyDiscoveryHtml || ""
      )
      .replace(
        /<div class="cards card-grid section cards-section" id="dynamicSections">[\s\S]*?<\/div>/,
        `<div class="cards card-grid section cards-section" id="dynamicSections">${homeSections.dynamicSectionsHtml}</div>`
      )
      .replace(
        /<ul id="trendingJobs" class="trending-list">[\s\S]*?<\/ul>/,
        `<ul id="trendingJobs" class="trending-list">${homeSections.trendingJobsHtml}</ul>`
      )
      .replace(
        '<script src="/js/index.js" defer></script>',
        `${homeSections.bootstrapScript}\n<script src="/js/index.js" defer></script>`
      );
    const baseUrl = getPublicBaseUrl(req);
    html = normalizeSeoUrlsInHtml(html, baseUrl);
    await sendHtmlString(req, res, html);
  } catch (err) {
    logger.warn("homepage server-render fallback failed", {
      message: err && err.message ? err.message : String(err)
    });
    const source = await fileService.readFile(path.join(generatedDir, "static", "index.html"), "utf8");
    let html = String(source).replace('<div id="header"></div>', String(cachedHeader || ""));
    html = normalizeSeoUrlsInHtml(html, getPublicBaseUrl(req));
    await sendHtmlString(req, res, html);
  }
}));

const { isBoardSlug, getBoardHub, normalizeBoardSlug } = require("./lib/boardHubs");

function renderBoardHubItemsHtml(boardLabel, items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div class="card"><div class="card-content"><p class="listing-empty">No updates found for this category yet.</p></div></div>';
  }
  const linksHtml = items
    .map((item) => `<li><a href="${escapeHtml(safePageHref(item))}">${escapeHtml(item.title)}</a></li>`)
    .join("");
  return `
    <div class="card">
      <div class="ribbon navy-ribbon">
        <span class="title">${escapeHtml(String(boardLabel || "Jobs").toUpperCase())}</span>
      </div>
      <div class="card-content">
        <ul class="job-list">${linksHtml}</ul>
      </div>
    </div>`;
}

async function sendBoardHubHtml(req, res, boardSlug) {
  const hub = getBoardHub(boardSlug);
  if (!hub) {
    return res.redirect(302, `/search?q=${encodeURIComponent(boardSlug)}`);
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 20;
  const baseUrl = getPublicBaseUrl(req);
  const canonicalPath = page > 1 ? `/tag/${hub.slug}?page=${page}` : `/tag/${hub.slug}`;
  const absoluteUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;
  const listingHtmlPath = path.join(generatedDir, "static", "listing.html");
  const source = await fileService.readFile(listingHtmlPath, "utf8");
  const payload = await pageService
    .listPagesByDepartment({ department: hub.slug, page, limit })
    .catch(() => ({ data: [], pagination: { totalPages: 0, currentPage: page, limit } }));
  let html = String(source)
    .replace(/<title id="pageTitle">[\s\S]*?<\/title>/, `<title id="pageTitle">${escapeHtml(hub.title)}</title>`)
    .replace(
      /<meta name="description" id="metaDesc" content="[^"]*">/,
      `<meta name="description" id="metaDesc" content="${escapeHtml(hub.description)}">`
    )
    .replace(/<link rel="canonical" id="canonicalLink" href="[^"]*">/, `<link rel="canonical" id="canonicalLink" href="${absoluteUrl}">`)
    .replace(/<meta property="og:title" id="ogTitle" content="[^"]*">/, `<meta property="og:title" id="ogTitle" content="${escapeHtml(hub.title)}">`)
    .replace(/<meta property="og:description" id="ogDesc" content="[^"]*">/, `<meta property="og:description" id="ogDesc" content="${escapeHtml(hub.description)}">`)
    .replace(/<meta property="og:url" id="ogUrl" content="[^"]*">/, `<meta property="og:url" id="ogUrl" content="${absoluteUrl}">`)
    .replace(/<h1 id="listingHeading">[\s\S]*?<\/h1>/, `<h1 id="listingHeading">${escapeHtml(hub.h1)}</h1>`)
    .replace(/<p id="listingSub">[\s\S]*?<\/p>/, `<p id="listingSub">${escapeHtml(hub.sub)}</p>`)
    .replace(
      /<div class="cards card-grid" id="dynamicSections">[\s\S]*?<\/div>/,
      `<div class="cards card-grid" id="dynamicSections">${renderBoardHubItemsHtml(hub.label, payload.data)}</div>`
    )
    .replace(
      '<script src="/js/listing.js" defer></script>',
      `<script>window.__BOARD_HUB_SLUG__=${JSON.stringify(hub.slug)};window.__BOARD_HUB_PAGINATION__=${JSON.stringify(payload.pagination || null)};</script>\n<script src="/js/board-hub.js" defer></script>`
    );
  if (!/<meta name="robots"[^>]*>/i.test(html)) {
    html = html.replace(/<\/head>/i, '  <meta name="robots" content="index, follow">\n</head>');
  }
  html = normalizeSeoUrlsInHtml(html, baseUrl);
  return sendHtmlString(req, res, html);
}

/** Board hubs: /tag/ssc → department listing; other tags → search (until exam tag hubs). */
app.get("/tag/:tag", asyncHandler(async (req, res) => {
  const raw = normalizeBoardSlug(req.params.tag);
  if (!raw) {
    return res.redirect(302, "/search");
  }
  if (isBoardSlug(raw)) {
    return sendBoardHubHtml(req, res, raw);
  }
  return res.redirect(302, `/search?q=${encodeURIComponent(raw)}`);
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
    "Browse government job categories by board — SSC, Railway, UPSC, Bank, Police, Teaching, Defence and Health on Sarkari Suchna India.",
  canonicalPath: "/categories"
};

app.get(["/categories", "/categories.html"], asyncHandler(async (req, res) => {
  await sendSeoAugmentedHtml(req, res, categoriesPagePath, categoriesPageSeo);
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
  "new-form": {
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
  const seo = listingSeoMap[segment] || listingSeoMap["new-form"];
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
const listingSegments = [
  "new-form",
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
    description: "Use the age calculator tool to compute exact age from date of birth.",
    canonicalPath: "/tools/age-calculator"
  });
}));

app.get("/tools/image-resizer", asyncHandler(async (req, res) => {
  await sendSeoAugmentedHtml(req, res, path.join(generatedDir, "tools", "image-resizer.html"), {
    title: "Image Resizer | Sarkari Suchna India",
    description: "Resize images quickly for forms, documents and uploads.",
    canonicalPath: "/tools/image-resizer"
  });
}));

const verifyToken = require("./middleware/auth.middleware");

function sendPrivatePage(res, fileName) {
  if (isProd) res.set("Cache-Control", "private, no-store");
  return res.sendFile(path.join(__dirname, `../private/${fileName}`));
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
  const abs = path.join(generatedDir, rel);
  if (!abs.startsWith(generatedDir) || !fileService.existsSync(abs)) return next();
  const source = await fileService.readFile(abs, "utf8");
  const html = normalizeSeoUrlsInHtml(String(source || ""), getPublicBaseUrl(req));
  return sendHtmlString(req, res, html);
}));
app.use(express.static(generatedDir, { ...generatedStaticOpts, index: false }));

app.get("/:slug", async (req, res, next) => {
  const slug = req.params.slug.replace(".html", "");

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

  const postPath = path.join(generatedDir, "jobs", `${slug}.html`);
  if (fileService.existsSync(postPath)) {
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

  const pagePath = path.join(generatedDir, "pages", `${slug}.html`);
  if (fileService.existsSync(pagePath)) {
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
