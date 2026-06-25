"use strict";

const crypto = require("crypto");
const redis = require("../config/redis");
const logger = require("../utils/logger");
const pageRepository = require("../repositories/page.repository");
const { delCache } = require("./cache.services");
const memCache = require("../config/cache");

const BOT_UA =
  /bot|crawler|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot|preview|headless|curl\/|wget\/|python-requests|scrapy|httpclient|go-http|java\/|libwww|archive\.org/i;

const COOLDOWN_SEC = parseInt(process.env.PAGE_VIEW_COOLDOWN_SEC || "1800", 10);
const ENABLED = String(process.env.PAGE_VIEWS_ENABLED || "1").trim() !== "0";
const DAILY_VIEWS_TTL_SEC = 60 * 60 * 24 * 95;

function dailyViewsKey(date = new Date()) {
  return `pageviews:daily:${date.toISOString().slice(0, 10)}`;
}

function isEnabled() {
  return ENABLED;
}

function isLikelyBot(req) {
  const ua = String((req.headers && req.headers["user-agent"]) || "");
  if (!ua || ua.length < 12) return true;
  return BOT_UA.test(ua);
}

function isAdminTraffic(req) {
  const path = String(req.originalUrl || req.path || "");
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) return true;
  if (path.startsWith("/generator") || path.startsWith("/dashboard")) return true;
  if (req.cookies && (req.cookies.access_token || req.cookies.token)) return true;
  return false;
}

/**
 * @param {import("express").Request} req
 * @param {string} slug
 */
function buildVisitorKey(req, slug) {
  const ip = String(req.ip || req.socket?.remoteAddress || "");
  const ua = String((req.headers && req.headers["user-agent"]) || "").slice(0, 120);
  return crypto.createHash("sha256").update(`${ip}|${ua}|${slug}`).digest("hex").slice(0, 32);
}

async function acquireViewCooldown(visitorKey, slug) {
  const key = `pageview:${slug}:${visitorKey}`;
  try {
    if (redis.isOpen) {
      const ok = await redis.set(key, "1", { NX: true, EX: Math.max(60, COOLDOWN_SEC) });
      return ok === "OK";
    }
  } catch (err) {
    logger.warn("pageViews: redis cooldown failed", { message: err.message });
  }
  const memKey = `mv:${key}`;
  if (memCache.get(memKey)) return false;
  memCache.set(memKey, "1", Math.max(60, COOLDOWN_SEC));
  return true;
}

async function bumpDailyViewTotal() {
  const key = dailyViewsKey();
  try {
    if (redis.isOpen) {
      await redis.incr(key);
      await redis.expire(key, DAILY_VIEWS_TTL_SEC);
      return;
    }
  } catch (err) {
    logger.warn("pageViews: daily counter redis failed", { message: err.message });
  }
  const memKey = `pvd:${key}`;
  memCache.set(memKey, (Number(memCache.get(memKey)) || 0) + 1, 60 * 60 * 24);
}

async function getTodayViewCount() {
  const key = dailyViewsKey();
  try {
    if (redis.isOpen) {
      const value = await redis.get(key);
      return Number(value) || 0;
    }
  } catch (err) {
    logger.warn("pageViews: daily counter read failed", { message: err.message });
  }
  return Number(memCache.get(`pvd:${key}`)) || 0;
}

/**
 * Fire-and-forget job page view (anti-spam, bot filter).
 * @param {import("express").Request} req
 * @param {string} slug
 */
async function trackJobPageView(req, slug) {
  if (!isEnabled()) return;
  const cleanSlug = String(slug || "")
    .trim()
    .replace(/\.html$/i, "");
  if (!cleanSlug) return;
  if (isLikelyBot(req) || isAdminTraffic(req)) return;

  const visitorKey = buildVisitorKey(req, cleanSlug);
  const allowed = await acquireViewCooldown(visitorKey, cleanSlug);
  if (!allowed) return;

  const affected = await pageRepository.incrementViewsBySlug(cleanSlug);
  if (affected > 0) {
    await bumpDailyViewTotal().catch(() => {});
    await delCache("pages:topviews").catch(() => {});
  }
}

module.exports = {
  trackJobPageView,
  getTodayViewCount,
  bumpDailyViewTotal,
  dailyViewsKey,
  isEnabled,
  isLikelyBot,
  isAdminTraffic
};
