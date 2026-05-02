"use strict";

const fs = require("fs/promises");
const path = require("path");
const miscService = require("../../services/misc.service");
const { OUT_FILE, writeSitemapFile } = require("../../lib/sitemapGenerator");
const db = require("../../config/db");
const logger = require("../../utils/logger");
const asyncHandler = require("../../utils/asyncHandler");
const { getPublicBaseUrl } = require("../../utils/baseUrl");

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const sendSitemap = asyncHandler(async (req, res) => {
  try {
    await fs.access(OUT_FILE);
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.sendFile(path.resolve(OUT_FILE));
  } catch {
    // build from DB
  }

  try {
    await writeSitemapFile(db);
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.sendFile(path.resolve(OUT_FILE));
  } catch (e) {
    logger.warn("sitemap: rebuild failed, using DB rows only", { message: e.message });
  }

  const baseUrl = getPublicBaseUrl(req);
  let rows = [];
  try {
    rows = await miscService.getSitemapRows();
  } catch (e) {
    logger.warn("sitemap: getSitemapRows failed", { message: e.message });
  }
  const urls = rows
    .map((p) => `\n    <url><loc>${baseUrl}/${escapeXml(p.slug)}</loc></url>`)
    .join("");
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=300");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`);
});

module.exports = { sendSitemap };
