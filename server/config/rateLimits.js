const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("./redis");

function buildStore(prefix) {
  try {
    if (redis.isOpen) {
      return new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
        prefix: `rl:${prefix}:`
      });
    }
  } catch {
    // memory fallback
  }
  return undefined;
}

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const publicWindowMs = parseInt(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS || "60000", 10);
const loginWindowMs = parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || String(15 * 60 * 1000), 10);
const apiDefaultMax = parseInt(process.env.RATE_LIMIT_API_MAX || "1200", 10);
const apiBurstMax = parseInt(process.env.RATE_LIMIT_API_BURST_MAX || "12000", 10);
const apiStrictMax = parseInt(process.env.RATE_LIMIT_API_STRICT_MAX || "15", 10);
const aiParseMax = parseInt(process.env.RATE_LIMIT_AI_PARSE_MAX || "15", 10);
const previewPageMax = parseInt(process.env.RATE_LIMIT_PREVIEW_PAGE_MAX || "20", 10);

const skipHealth = (req) =>
  req.path === "/health" ||
  req.path === "/ready" ||
  req.path === "/sitemap.xml" ||
  req.path === "/robots.txt";

function getClientIp(req) {
  // trust proxy is configured in app.js; req.ip already respects x-forwarded-for.
  const ip = String((req && req.ip) || "").trim();
  return ip || "unknown";
}

function apiRouteMax(req) {
  const pathOnly = String(req.path || "").split("?")[0];
  // Read-heavy public endpoints support higher burst traffic.
  if (
    pathOnly === "/api/jobs" ||
    pathOnly === "/api/finder-data" ||
    pathOnly === "/api/pages" ||
    pathOnly === "/api/top-views" ||
    pathOnly === "/api/search" ||
    pathOnly === "/api/search-suggest"
  ) {
    return apiBurstMax;
  }
  // Costly parsing endpoints remain strict to reduce abuse.
  if (pathOnly === "/api/ai-parse" || pathOnly === "/api/preview-page") {
    return apiStrictMax;
  }
  return apiDefaultMax;
}

/** Static / HTML (higher ceiling) */
const globalLimiter = rateLimit({
  windowMs: publicWindowMs,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || "15000", 10),
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("global"),
  skip: skipHealth,
  keyGenerator: (req) => getClientIp(req)
});

/** JSON APIs — stricter */
const apiLimiter = rateLimit({
  windowMs: publicWindowMs,
  max: (req) => apiRouteMax(req),
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("api"),
  skip: skipHealth,
  keyGenerator: (req) => `${getClientIp(req)}:${String(req.path || "").split("?")[0]}`
});

/** Admin protected APIs — medium strict */
const adminApiLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_ADMIN_API_MAX || "200", 10),
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("admin-api"),
  skip: skipHealth,
  keyGenerator: (req) => getClientIp(req)
});

/** Admin login brute-force guard */
const adminLoginLimiter = rateLimit({
  windowMs: loginWindowMs,
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("login"),
  keyGenerator: (req) => `${getClientIp(req)}:admin-login`,
  message: { success: false, message: "Too many login attempts. Try again later." }
});

/** Admin sensitive actions — strict */
const adminSensitiveLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_ADMIN_SENSITIVE_MAX || "60", 10),
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("admin-sensitive"),
  skip: skipHealth,
  keyGenerator: (req) => `${getClientIp(req)}:${String(req.path || "").split("?")[0]}`
});

const rateLimitTooManyMessage = { success: false, message: "Too many requests. Try again later." };

/** Public AI parse — conservative per-IP cap (OpenAI cost abuse) */
const aiParseLimiter = rateLimit({
  windowMs,
  max: aiParseMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("ai-parse"),
  skip: skipHealth,
  keyGenerator: (req) => getClientIp(req),
  message: rateLimitTooManyMessage
});

/** Public preview HTML — conservative per-IP cap */
const previewPageLimiter = rateLimit({
  windowMs,
  max: previewPageMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("preview-page"),
  skip: skipHealth,
  keyGenerator: (req) => getClientIp(req),
  message: rateLimitTooManyMessage
});

module.exports = {
  globalLimiter,
  apiLimiter,
  adminLoginLimiter,
  adminApiLimiter,
  adminSensitiveLimiter,
  aiParseLimiter,
  previewPageLimiter
};
