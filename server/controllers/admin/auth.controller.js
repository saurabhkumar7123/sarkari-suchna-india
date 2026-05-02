const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const redis = require("../../config/redis");
const logger = require("../../utils/logger");
const { recordActivity } = require("../../services/adminActivity.service");

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const LOGIN_FAILURE_DELAY_MS = Math.max(0, parseInt(process.env.LOGIN_FAILURE_DELAY_MS || "400", 10));
const IS_PROD = process.env.NODE_ENV === "production";
const IS_DEV = process.env.NODE_ENV === "development";
const AUTH_DEBUG_LOGS = process.env.NODE_ENV === "development";
const MAX_ACTIVE_SESSIONS_PER_USER = parseInt(process.env.MAX_ACTIVE_SESSIONS_PER_USER || "5", 10);
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || process.env.PRODUCTION_COOKIE_DOMAIN || "").trim();
const memoryRefreshByJti = new Map();
const memoryLatestJtiBySid = new Map();
const memoryUserSessions = new Map();
let hasLoggedProdRedisUnavailable = false;

if (!Number.isFinite(MAX_ACTIVE_SESSIONS_PER_USER) || MAX_ACTIVE_SESSIONS_PER_USER < 1) {
  throw new Error("MAX_ACTIVE_SESSIONS_PER_USER must be a positive integer");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseExpiresToSeconds(v, fallbackSec) {
  const s = String(v || "").trim().toLowerCase();
  const m = s.match(/^(\d+)\s*([smhd])$/);
  if (!m) return fallbackSec;
  const n = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(n) || n <= 0) return fallbackSec;
  if (unit === "s") return n;
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 60 * 60;
  if (unit === "d") return n * 60 * 60 * 24;
  return fallbackSec;
}

function isLocalHostName(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function shouldUseSecureCookies(req) {
  if (!IS_PROD) return false;
  const hostHeader = String((req && req.headers && req.headers.host) || "");
  const hostName = hostHeader.split(":")[0];
  const origin = String((req && req.headers && req.headers.origin) || "").toLowerCase();
  if (isLocalHostName(hostName)) return false;
  if (/^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/i.test(origin)) {
    return false;
  }
  return true;
}

function getCookieBaseOptions(req) {
  const useSecure = shouldUseSecureCookies(req);
  const base = {
    httpOnly: true,
    secure: useSecure,
    // Keep cookie CSRF surface reduced without cross-site requirement for admin-only app.
    sameSite: "lax"
  };
  if (useSecure && COOKIE_DOMAIN) {
    base.domain = COOKIE_DOMAIN;
  }
  return base;
}

function getCookieOptions(req, maxAgeMs) {
  return {
    ...getCookieBaseOptions(req),
    maxAge: maxAgeMs
  };
}

function getClearCookieOptions(req) {
  return {
    ...getCookieBaseOptions(req),
    maxAge: 0
  };
}

function newTokenId() {
  return crypto.randomBytes(24).toString("hex");
}

function hasRedisStore() {
  return Boolean(redis && redis.isOpen);
}

function assertAuthStoreAvailableOrThrow() {
  if (hasRedisStore()) return;
  if (IS_PROD) {
    if (!hasLoggedProdRedisUnavailable) {
      hasLoggedProdRedisUnavailable = true;
      logger.error("auth: Redis unavailable in production; rejecting authentication operations");
    }
    const err = new Error("Authentication store unavailable");
    err.code = "AUTH_STORE_UNAVAILABLE";
    throw err;
  }
}

function canUseMemoryFallback() {
  return IS_DEV && !hasRedisStore();
}

async function saveRefreshState({ sid, jti, username, ttlSec }) {
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    memoryRefreshByJti.set(jti, { sid, username, expiresAt: Date.now() + ttlSec * 1000 });
    memoryLatestJtiBySid.set(sid, jti);
    return;
  }
  const keyJti = `auth:refresh:jti:${jti}`;
  const keyLatest = `auth:refresh:latest:${sid}`;
  await redis.set(keyJti, JSON.stringify({ sid, username }), { EX: ttlSec });
  await redis.set(keyLatest, jti, { EX: ttlSec });
}

async function saveSessionState({ sid, username, ttlSec }) {
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    memoryLatestJtiBySid.set(`session:${sid}`, JSON.stringify({
      username,
      ip: "",
      userAgent: "",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlSec * 1000
    }));
    return;
  }
  await redis.set(`auth:session:${sid}`, JSON.stringify({
    username,
    ip: "",
    userAgent: "",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  }), { EX: ttlSec });
}

async function invalidateRefreshState({ sid, jti }) {
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    if (jti) memoryRefreshByJti.delete(jti);
    if (sid) memoryLatestJtiBySid.delete(sid);
    return;
  }
  const keys = [];
  if (jti) keys.push(`auth:refresh:jti:${jti}`);
  if (sid) keys.push(`auth:refresh:latest:${sid}`);
  if (keys.length) await redis.del(keys);
}

async function invalidateSessionState(sid) {
  if (!sid) return;
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    memoryLatestJtiBySid.delete(`session:${sid}`);
    return;
  }
  await redis.del(`auth:session:${sid}`);
}

async function registerActiveUserSession({ username, sid, refreshTtlSec }) {
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    const sessions = memoryUserSessions.get(username) || [];
    const updated = sessions.filter((entry) => entry.sid !== sid);
    updated.push({ sid, ts: Date.now() });
    updated.sort((a, b) => a.ts - b.ts);
    while (updated.length > MAX_ACTIVE_SESSIONS_PER_USER) {
      const stale = updated.shift();
      if (!stale) break;
      const staleJti = memoryLatestJtiBySid.get(stale.sid) || null;
      logger.warn("auth: session limit exceeded; removing oldest session", {
        username,
        maxSessions: MAX_ACTIVE_SESSIONS_PER_USER,
        removedSid: stale.sid
      });
      await invalidateRefreshState({ sid: stale.sid, jti: staleJti });
    }
    memoryUserSessions.set(username, updated);
    return;
  }
  const keyUserSessions = `auth:user:sessions:${username}`;
  const now = Date.now();
  const sessionTtlMs = Math.max(1, refreshTtlSec) * 1000;
  await redis.zAdd(keyUserSessions, [{ score: now, value: sid }]);
  await redis.pExpire(keyUserSessions, sessionTtlMs);

  const over = await redis.zCard(keyUserSessions).then((n) => n - MAX_ACTIVE_SESSIONS_PER_USER);
  if (over <= 0) return;
  logger.warn("auth: session limit exceeded", {
    username,
    maxSessions: MAX_ACTIVE_SESSIONS_PER_USER,
    overflowCount: over
  });

  const staleSids = await redis.zRange(keyUserSessions, 0, over - 1);
  if (!staleSids.length) return;

  for (const staleSid of staleSids) {
    const latestJti = await redis.get(`auth:refresh:latest:${staleSid}`);
    logger.warn("auth: auto-removing oldest session (LRU)", {
      username,
      removedSid: staleSid
    });
    await invalidateRefreshState({ sid: staleSid, jti: latestJti || null });
    await redis.zRem(keyUserSessions, staleSid);
  }
}

async function unregisterActiveUserSession({ username, sid }) {
  if (!username || !sid) return;
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    const sessions = memoryUserSessions.get(username) || [];
    memoryUserSessions.set(
      username,
      sessions.filter((entry) => entry.sid !== sid)
    );
    return;
  }
  const keyUserSessions = `auth:user:sessions:${username}`;
  await redis.zRem(keyUserSessions, sid);
}

async function getLatestJtiForSid(sid) {
  if (!sid) return null;
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    return memoryLatestJtiBySid.get(sid) || null;
  }
  return redis.get(`auth:refresh:latest:${sid}`);
}

async function isSessionActive(sid) {
  if (!sid) return false;
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    return memoryLatestJtiBySid.has(`session:${sid}`);
  }
  const current = await redis.get(`auth:session:${sid}`);
  return Boolean(current);
}

async function setSessionMetadata({ sid, ttlSec, ip, userAgent, createdAt }) {
  if (!sid) return;
  assertAuthStoreAvailableOrThrow();
  const nowIso = new Date().toISOString();
  if (canUseMemoryFallback()) {
    const raw = memoryLatestJtiBySid.get(`session:${sid}`) || "{}";
    let parsed = {};
    try { parsed = JSON.parse(String(raw)); } catch {}
    parsed.ip = String(ip || parsed.ip || "");
    parsed.userAgent = String(userAgent || parsed.userAgent || "");
    parsed.createdAt = String(createdAt || parsed.createdAt || nowIso);
    parsed.lastActiveAt = nowIso;
    parsed.expiresAt = Date.now() + Math.max(1, Number(ttlSec) || 1) * 1000;
    memoryLatestJtiBySid.set(`session:${sid}`, JSON.stringify(parsed));
    return;
  }
  const key = `auth:session:${sid}`;
  const currentRaw = await redis.get(key);
  let parsed = {};
  try { parsed = currentRaw ? JSON.parse(currentRaw) : {}; } catch {}
  parsed.ip = String(ip || parsed.ip || "");
  parsed.userAgent = String(userAgent || parsed.userAgent || "");
  parsed.createdAt = String(createdAt || parsed.createdAt || nowIso);
  parsed.lastActiveAt = nowIso;
  await redis.set(key, JSON.stringify(parsed), { EX: Math.max(1, Number(ttlSec) || 1) });
}

async function listActiveSessionsForUser(username) {
  if (!username) return [];
  const sids = await listActiveUserSids(username);
  const rows = [];
  for (const sid of sids) {
    if (canUseMemoryFallback()) {
      const raw = memoryLatestJtiBySid.get(`session:${sid}`);
      let parsed = {};
      try { parsed = raw ? JSON.parse(String(raw)) : {}; } catch {}
      rows.push({
        sid,
        admin: username,
        ip: String(parsed.ip || ""),
        userAgent: String(parsed.userAgent || ""),
        createdAt: parsed.createdAt || null,
        lastActiveAt: parsed.lastActiveAt || null
      });
      continue;
    }
    const raw = await redis.get(`auth:session:${sid}`);
    let parsed = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch {}
    rows.push({
      sid,
      admin: String(parsed.username || username),
      ip: String(parsed.ip || ""),
      userAgent: String(parsed.userAgent || ""),
      createdAt: parsed.createdAt || null,
      lastActiveAt: parsed.lastActiveAt || null
    });
  }
  return rows.sort((a, b) => Date.parse(b.lastActiveAt || 0) - Date.parse(a.lastActiveAt || 0));
}

async function touchSessionActivity(sid, { ip, userAgent, ttlSec }) {
  if (!sid) return;
  await setSessionMetadata({ sid, ip, userAgent, ttlSec });
}

async function invalidateSessionBySid({ username, sid }) {
  const latestJti = await getLatestJtiForSid(sid);
  await invalidateRefreshState({ sid, jti: latestJti });
  await invalidateSessionState(sid);
  if (username) await unregisterActiveUserSession({ username, sid });
}

async function listActiveUserSids(username) {
  if (!username) return [];
  assertAuthStoreAvailableOrThrow();
  if (canUseMemoryFallback()) {
    const sessions = memoryUserSessions.get(username) || [];
    return sessions.map((entry) => entry.sid);
  }
  const keyUserSessions = `auth:user:sessions:${username}`;
  return redis.zRange(keyUserSessions, 0, -1);
}

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const accessTtlSec = parseExpiresToSeconds(ACCESS_TOKEN_EXPIRES_IN, 15 * 60);
  const refreshTtlSec = parseExpiresToSeconds(REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60);
  const requestOrigin = String((req.headers && req.headers.origin) || "");
  const requestHost = String((req.headers && req.headers.host) || "");
  if (AUTH_DEBUG_LOGS) {
    logger.info("auth-debug: login request received", {
      requestId: req.id || "",
      route: req.path,
      method: req.method,
      hasUsername: typeof username === "string" && username.length > 0
    });
  }

  if (username !== process.env.ADMIN_USER) {
    logger.warn("auth: login failed", { requestId: req.id || "", route: req.path, status: "fail" });
    await sleep(LOGIN_FAILURE_DELAY_MS);
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  const isMatch = await bcrypt.compare(password, process.env.ADMIN_PASS_HASH);

  if (!isMatch) {
    logger.warn("auth: login failed", { requestId: req.id || "", route: req.path, status: "fail" });
    await sleep(LOGIN_FAILURE_DELAY_MS);
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  const sid = newTokenId();
  const refreshJti = newTokenId();

  const accessToken = jwt.sign(
    { username, type: "access", sid },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    { username, type: "refresh", sid, jti: refreshJti },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  try {
    await saveRefreshState({ sid, jti: refreshJti, username, ttlSec: refreshTtlSec });
    await saveSessionState({ sid, username, ttlSec: refreshTtlSec });
    await setSessionMetadata({
      sid,
      ttlSec: refreshTtlSec,
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      createdAt: new Date().toISOString()
    });
    await registerActiveUserSession({ username, sid, refreshTtlSec });
  } catch (err) {
    if (err && err.code === "AUTH_STORE_UNAVAILABLE") {
      return res.status(503).json({ status: "error", message: "Authentication temporarily unavailable" });
    }
    throw err;
  }

  res.cookie("token", accessToken, getCookieOptions(req, accessTtlSec * 1000)); // backward-compat
  res.cookie("access_token", accessToken, getCookieOptions(req, accessTtlSec * 1000));
  res.cookie("refresh_token", refreshToken, getCookieOptions(req, refreshTtlSec * 1000));
  logger.info("auth: login success", {
    requestId: req.id || "",
    route: req.path,
    status: "success",
    secureCookie: shouldUseSecureCookies(req)
  });
  await recordActivity({
    admin: username,
    action: "login",
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ status: "success" });
};

exports.refresh = async (req, res) => {
  const refreshToken = req.cookies && req.cookies.refresh_token ? req.cookies.refresh_token : "";
  if (AUTH_DEBUG_LOGS) {
    logger.info("auth-debug: refresh request", {
      requestId: req.id || "",
      route: req.path,
      method: req.method,
      hasRefreshCookie: Boolean(refreshToken)
    });
  }
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (!payload || payload.type !== "refresh" || !payload.sid || !payload.jti || !payload.username) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const latestJti = await getLatestJtiForSid(payload.sid);
    // Refresh token reuse detection (works with Redis and local fallback store).
    if (!latestJti || latestJti !== payload.jti) {
      await invalidateSessionBySid({ username: payload.username, sid: payload.sid }).catch(() => {});
      res.clearCookie("token", getClearCookieOptions(req));
      res.clearCookie("access_token", getClearCookieOptions(req));
      res.clearCookie("refresh_token", getClearCookieOptions(req));
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const accessTtlSec = parseExpiresToSeconds(ACCESS_TOKEN_EXPIRES_IN, 15 * 60);
    const refreshTtlSec = parseExpiresToSeconds(REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60);
    const nextJti = newTokenId();

    const nextAccess = jwt.sign(
      { username: payload.username, type: "access", sid: payload.sid },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
    const nextRefresh = jwt.sign(
      { username: payload.username, type: "refresh", sid: payload.sid, jti: nextJti },
      process.env.JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    await saveRefreshState({
      sid: payload.sid,
      jti: nextJti,
      username: payload.username,
      ttlSec: refreshTtlSec
    });
    await saveSessionState({ sid: payload.sid, username: payload.username, ttlSec: refreshTtlSec });
    await setSessionMetadata({
      sid: payload.sid,
      ttlSec: refreshTtlSec,
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || "")
    });
    await invalidateRefreshState({ sid: null, jti: payload.jti });

    res.cookie("token", nextAccess, getCookieOptions(req, accessTtlSec * 1000)); // backward-compat
    res.cookie("access_token", nextAccess, getCookieOptions(req, accessTtlSec * 1000));
    res.cookie("refresh_token", nextRefresh, getCookieOptions(req, refreshTtlSec * 1000));
    return res.json({ success: true });
  } catch (err) {
    if (err && err.code === "AUTH_STORE_UNAVAILABLE") {
      return res.status(503).json({ success: false, message: "Authentication temporarily unavailable" });
    }
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

exports.logout = async (req, res) => {
  const refreshToken = req.cookies && req.cookies.refresh_token ? req.cookies.refresh_token : "";
  const logoutAll = Boolean(req.body && req.body.logoutAll === true);
  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
      if (payload && payload.sid && payload.jti) {
        if (logoutAll && payload.username) {
          // Optional global sign-out: invalidate every tracked refresh session for this admin.
          const allSids = await listActiveUserSids(payload.username);
          for (const activeSid of allSids) {
            await invalidateSessionBySid({ username: payload.username, sid: activeSid });
          }
        } else {
          await invalidateSessionBySid({ username: payload.username, sid: payload.sid });
        }
      }
    } catch (err) {
      if (err && err.code === "AUTH_STORE_UNAVAILABLE") {
        logger.error("auth: logout token invalidation skipped due to unavailable auth store");
      }
      // ignore invalid token on logout
    }
  }

  res.clearCookie("token", getClearCookieOptions(req));
  res.clearCookie("access_token", getClearCookieOptions(req));
  res.clearCookie("refresh_token", getClearCookieOptions(req));
  await recordActivity({
    admin: req.user && req.user.username ? req.user.username : "admin",
    action: logoutAll ? "logout_all" : "logout",
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ status: "logout" });
};

exports.getSessions = async (req, res) => {
  const username = req.user && req.user.username ? req.user.username : "";
  const currentSid = req.user && req.user.sid ? String(req.user.sid) : "";
  const sessions = await listActiveSessionsForUser(username);
  res.json({
    success: true,
    data: sessions.map((s) => ({
      sessionId: s.sid,
      admin: s.admin,
      ip: s.ip,
      userAgent: s.userAgent,
      created_at: s.createdAt,
      last_active_at: s.lastActiveAt,
      current: currentSid && s.sid === currentSid
    }))
  });
};

exports.revokeSession = async (req, res) => {
  const username = req.user && req.user.username ? req.user.username : "";
  const sid = String(req.params.sessionId || "").trim();
  if (!sid) return res.status(400).json({ success: false, message: "invalid session id" });
  await invalidateSessionBySid({ username, sid });
  await recordActivity({
    admin: username,
    action: "session_revoke",
    target: sid,
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true });
};

exports.revokeAllSessions = async (req, res) => {
  const username = req.user && req.user.username ? req.user.username : "";
  const currentSid = req.user && req.user.sid ? String(req.user.sid) : "";
  const sids = await listActiveUserSids(username);
  for (const sid of sids) {
    if (sid === currentSid) continue;
    await invalidateSessionBySid({ username, sid });
  }
  await recordActivity({
    admin: username,
    action: "session_revoke_all",
    status: "success",
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
    requestId: req.id || ""
  }).catch(() => {});
  res.json({ success: true });
};

exports.isSessionActive = isSessionActive;
exports.touchSessionActivity = touchSessionActivity;