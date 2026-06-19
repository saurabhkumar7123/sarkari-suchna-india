const express = require("express");
const router = express.Router();
const csrf = require("csurf");

const asyncHandler = require("../../utils/asyncHandler");
const authController = require("../../controllers/admin/auth.controller");
const { validateLogin } = require("../../validations/auth.validation");
const { adminLoginLimiter } = require("../../config/rateLimits");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminLoginSchema } = require("../../validations/admin.validation");
const logger = require("../../utils/logger");
const AUTH_DEBUG_LOGS = process.env.NODE_ENV === "development";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || process.env.PRODUCTION_COOKIE_DOMAIN || "").trim();

function isLocalHostName(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function parseHostFromOrigin(origin) {
  try {
    return new URL(String(origin || "")).host;
  } catch {
    return "";
  }
}

function shouldUseLocalCookieMode(req) {
  const hostHeader = String((req && req.headers && req.headers.host) || "").split(":")[0];
  const originHost = parseHostFromOrigin(req && req.headers ? req.headers.origin : "").split(":")[0];
  return isLocalHostName(hostHeader) || isLocalHostName(originHost);
}

function buildCsrfCookieOptions(req) {
  const localMode = shouldUseLocalCookieMode(req);
  const useSecure = IS_PROD && !localMode;
  return {
    key: "_csrf",
    httpOnly: true,
    secure: useSecure,
    sameSite: "lax",
    ...(useSecure && COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
  };
}

const csrfLocal = csrf({ cookie: buildCsrfCookieOptions({ headers: { host: "localhost" } }) });
const csrfSecure = csrf({ cookie: buildCsrfCookieOptions({ headers: { host: "example.com", origin: "https://example.com" } }) });
function csrfProtection(req, res, next) {
  return (shouldUseLocalCookieMode(req) ? csrfLocal : csrfSecure)(req, res, next);
}

function enforceOriginConsistency(req, res, next) {
  if (!AUTH_DEBUG_LOGS) return next();
  const origin = String((req.headers && req.headers.origin) || "");
  const host = String((req.headers && req.headers.host) || "");
  if (!origin) return next();
  const originHost = parseHostFromOrigin(origin);
  if (originHost && originHost !== host) {
    logger.warn("auth-csrf: origin mismatch observed", { path: req.path, method: req.method, origin, host, ip: req.ip });
  }
  return next();
}

function logCsrfPair(req, _res, next) {
  if (!AUTH_DEBUG_LOGS) return next();
  if (req.path === "/login" || req.path === "/csrf-token" || req.path === "/refresh") {
    logger.info("auth-csrf: request diagnostics", {
      requestId: req.id || "",
      route: req.path,
      method: req.method,
      hasCsrfHeader: Boolean(req.get("x-csrf-token") || req.get("csrf-token")),
      hasCsrfCookie: Boolean(req.cookies && req.cookies._csrf)
    });
  }
  return next();
}

// LOGIN (Redis-backed when available — survives PM2 cluster)
router.post(
  "/login",
  enforceOriginConsistency,
  logCsrfPair,
  adminLoginLimiter,
  validateLogin,
  validateJoi(adminLoginSchema, "body"),
  asyncHandler(authController.login)
);

router.post(
  "/dev-auto-login",
  enforceOriginConsistency,
  logCsrfPair,
  asyncHandler(authController.devAutoLogin)
);

// CSRF token is needed both for authenticated admin actions and refresh-cookie rotation.
router.get("/csrf-token", enforceOriginConsistency, logCsrfPair, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

router.post("/refresh", enforceOriginConsistency, logCsrfPair, adminLoginLimiter, csrfProtection, asyncHandler(authController.refresh));

// Logout is registered in protected.routes.js (requires CSRF on POST).

module.exports = router;