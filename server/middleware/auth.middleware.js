const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { isSessionActive, touchSessionActivity } = require("../controllers/admin/auth.controller");
const AUTH_DEBUG_LOGS = process.env.NODE_ENV === "development";

if (process.env.NODE_ENV === "production" && process.env.PDF_EXTRACT_SKIP_AUTH === "true") {
  throw new Error("Security risk: auth bypass is enabled in production");
}

function isPostPdfExtract(req) {
  if (req.method !== "POST") return false;
  const pathOnly = String(req.originalUrl || "").split("?")[0];
  return pathOnly === "/api/admin/pdf/extract" || pathOnly.endsWith("/api/admin/pdf/extract");
}

module.exports = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";
  if (process.env.PDF_EXTRACT_SKIP_AUTH === "true" && isDev && isPostPdfExtract(req)) {
    logger.warn("Auth bypass enabled for generator extract in non-production");
    return next();
  }

  const isApiRequest = req.path.startsWith("/api/") || req.originalUrl.startsWith("/api/");
  const requestPath = String(req.originalUrl || req.path || "");

  try {
    const token = req.cookies.access_token || req.cookies.token;

    if (AUTH_DEBUG_LOGS && (requestPath.startsWith("/api/admin") || requestPath === "/dashboard")) {
      logger.info("auth-debug: protected route check", {
        requestId: req.id || "",
        route: requestPath,
        method: req.method
      });
    }

    if (!token) {
      if (isApiRequest) {
        return res.status(401).json({
          success: false,
          status: "error",
          message: "Unauthorized"
        });
      }
      return res.redirect("/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.type && decoded.type !== "access") {
      throw new Error("Invalid token type");
    }
    if (!decoded || !decoded.sid) {
      throw new Error("Missing session id");
    }
    const active = await isSessionActive(decoded.sid);
    if (!active) {
      throw new Error("Session revoked");
    }
    req.user = decoded;
    await touchSessionActivity(decoded.sid, {
      ip: req.ip,
      userAgent: String((req.headers && req.headers["user-agent"]) || ""),
      ttlSec: 7 * 24 * 60 * 60
    }).catch(() => {});
    if (AUTH_DEBUG_LOGS && (requestPath.startsWith("/api/admin") || requestPath === "/dashboard")) {
      logger.info("auth-debug: allowed", {
        requestId: req.id || "",
        route: requestPath,
        method: req.method
      });
    }

    next();
  } catch (err) {
    if (isApiRequest) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: "Unauthorized"
      });
    }
    return res.redirect("/login");
  }
};