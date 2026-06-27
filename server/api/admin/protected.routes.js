"use strict";

/**
 * Admin API routes that require JWT + CSRF (cookie-based double-submit).
 * Login stays in auth.routes.js (no CSRF — browser has no token yet).
 */
const express = require("express");
const csrf = require("csurf");
const router = express.Router();

const verifyToken = require("../../middleware/auth.middleware");
const { adminApiLimiter } = require("../../config/rateLimits");
const asyncHandler = require("../../utils/asyncHandler");
const validateJoi = require("../../middleware/validateJoi.middleware");
const { adminLogoutSchema } = require("../../validations/admin.validation");
const authController = require("../../controllers/admin/auth.controller");
const logger = require("../../utils/logger");
const { adminSensitiveLimiter } = require("../../config/rateLimits");
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
    logger.warn("auth-csrf: protected origin mismatch observed", { path: req.path, method: req.method, origin, host, ip: req.ip });
  }
  return next();
}

function logCsrfPair(req, _res, next) {
  if (!AUTH_DEBUG_LOGS) return next();
  logger.info("auth-csrf: protected request diagnostics", {
    requestId: req.id || "",
    route: req.path,
    method: req.method,
    hasCsrfHeader: Boolean(req.get("x-csrf-token") || req.get("csrf-token")),
    hasCsrfCookie: Boolean(req.cookies && req.cookies._csrf)
  });
  return next();
}

router.use(verifyToken);
router.use(enforceOriginConsistency);
router.use(logCsrfPair);
router.use(csrfProtection);

router.use(adminApiLimiter);
router.post("/logout", adminSensitiveLimiter, validateJoi(adminLogoutSchema, "body"), asyncHandler(authController.logout));
router.get("/sessions", adminSensitiveLimiter, asyncHandler(authController.getSessions));
router.post("/sessions/revoke/:sessionId", adminSensitiveLimiter, asyncHandler(authController.revokeSession));
router.post("/sessions/revoke-all", adminSensitiveLimiter, asyncHandler(authController.revokeAllSessions));

router.use(require("./generator.routes"));
router.use(require("./page.routes"));
router.use(require("./file.routes"));
router.use(require("./upload.routes"));
router.use(require("./contentImport.routes"));
router.use(require("./generatorDraft.routes"));
router.use(require("./updates.routes"));

module.exports = router;
