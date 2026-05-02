"use strict";

function normalizeAbsoluteHttpUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return "";
  return raw;
}

function getBaseUrl() {
  const siteUrl = normalizeAbsoluteHttpUrl(process.env.SITE_URL);
  if (siteUrl) return siteUrl;
  return "";
}

function getRequestOrigin(req) {
  if (!req) return "";
  const host = String(req.get && req.get("host") ? req.get("host") : req.headers && req.headers.host ? req.headers.host : "")
    .trim()
    .replace(/\/+$/, "");
  if (!host) return "";
  const forwardedProto = String(req.headers && req.headers["x-forwarded-proto"] ? req.headers["x-forwarded-proto"] : "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const protocol = forwardedProto || (req.protocol ? String(req.protocol).toLowerCase() : "http");
  return normalizeAbsoluteHttpUrl(`${protocol}://${host}`);
}

function getPublicBaseUrl(req) {
  const envUrl = getBaseUrl();
  if (process.env.NODE_ENV === "production") return envUrl;
  return getRequestOrigin(req) || envUrl;
}

module.exports = { getBaseUrl, normalizeAbsoluteHttpUrl, getRequestOrigin, getPublicBaseUrl };
