"use strict";

const fs = require("fs/promises");
const path = require("path");
const logger = require("../utils/logger");
const { getBaseUrl } = require("../utils/baseUrl");
const { allBoardHubs } = require("./boardHubs");

const OUT_DIR = path.join(process.cwd(), "generated", "sitemap");
const OUT_FILE = path.join(OUT_DIR, "sitemap.xml");
const CHUNK_SIZE = Math.max(5000, parseInt(process.env.SITEMAP_CHUNK_SIZE || "40000", 10));

function staticPaths(baseUrl) {
  const boardTagPaths = allBoardHubs().map((hub) => `/department/${hub.slug}`);
  const paths = [
    "/",
    "/search",
    "/new-form",
    "/result",
    "/admit-card",
    "/answer-key",
    "/document",
    "/syllabus",
    "/admission",
    "/tools/age-calculator",
    "/tools/image-resizer",
    "/privacy-policy",
    "/terms-and-conditions",
    "/disclaimer",
    "/content-policy",
    "/contact-us",
    "/categories",
    ...boardTagPaths
  ];
  return paths.map((p) => ({ loc: `${baseUrl.replace(/\/$/, "")}${p}`, changefreq: "weekly" }));
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toIsoDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildUrlNode({ loc, lastmod, changefreq }) {
  const safeLoc = escapeXml(loc);
  const lm = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
  const cf = changefreq ? `\n    <changefreq>${escapeXml(changefreq)}</changefreq>` : "";
  return `  <url><loc>${safeLoc}</loc>${lm}${cf}\n  </url>`;
}

async function writeSitemapChunk(filePath, rows) {
  const body = rows.join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  await fs.writeFile(filePath, xml, "utf8");
}

async function writeSitemapIndex(siteUrl, entries) {
  const body = entries
    .map((entry) => {
      const lm = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `  <sitemap><loc>${escapeXml(entry.loc)}</loc>${lm}\n  </sitemap>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
  await fs.writeFile(OUT_FILE, xml, "utf8");
}

/**
 * @param {import("mysql2/promise").Pool} db
 * @returns {Promise<{ path: string, urlCount: number }>}
 */
async function writeSitemapFile(db) {
  const siteUrl = getBaseUrl();
  if (!siteUrl) {
    throw new Error("BASE_URL or SITE_URL must be set to generate sitemap in production");
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const [rows] = await db.query("SELECT slug, created_at FROM pages WHERE deleted=0");
  const staticRows = staticPaths(siteUrl).map((p) => buildUrlNode({ loc: p.loc, changefreq: p.changefreq }));
  const jobRows = [];
  let newestLastmod = "";
  for (const row of rows) {
    const slug = String(row.slug || "").trim();
    if (!slug) continue;
    const lastmod = toIsoDate(row.created_at);
    if (lastmod && (!newestLastmod || lastmod > newestLastmod)) {
      newestLastmod = lastmod;
    }
    jobRows.push(buildUrlNode({ loc: `${siteUrl}/${slug}`, lastmod }));
  }

  const chunks = [];
  chunks.push({
    fileName: "sitemap-static.xml",
    rows: staticRows,
    lastmod: toIsoDate(new Date())
  });
  for (let i = 0; i < jobRows.length; i += CHUNK_SIZE) {
    const idx = Math.floor(i / CHUNK_SIZE) + 1;
    chunks.push({
      fileName: `sitemap-jobs-${idx}.xml`,
      rows: jobRows.slice(i, i + CHUNK_SIZE),
      lastmod: newestLastmod || toIsoDate(new Date())
    });
  }

  // Clean old generated chunk files except the index file.
  const currentFiles = new Set(chunks.map((c) => c.fileName).concat(["sitemap.xml"]));
  const existing = await fs.readdir(OUT_DIR).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.endsWith(".xml") && !currentFiles.has(name))
      .map((name) => fs.unlink(path.join(OUT_DIR, name)).catch(() => {}))
  );

  await Promise.all(
    chunks.map((chunk) => writeSitemapChunk(path.join(OUT_DIR, chunk.fileName), chunk.rows))
  );

  const indexEntries = chunks.map((chunk) => ({
    loc: `${siteUrl}/sitemap/${chunk.fileName}`,
    lastmod: chunk.lastmod
  }));
  await writeSitemapIndex(siteUrl, indexEntries);

  return { path: OUT_FILE, urlCount: staticRows.length + jobRows.length };
}

/**
 * Create sitemap.xml when missing (or empty). Safe if DB is down — logs and skips.
 * @param {import("mysql2/promise").Pool} db
 */
async function ensureSitemapExists(db) {
  try {
    const st = await fs.stat(OUT_FILE).catch(() => null);
    if (st && st.size > 50) {
      return { skipped: true, path: OUT_FILE };
    }
  } catch {
    // create
  }

  try {
    await db.query("SELECT 1");
    const result = await writeSitemapFile(db);
    logger.info("Sitemap created at startup", { path: result.path, urlCount: result.urlCount });
    return { skipped: false, ...result };
  } catch (e) {
    logger.warn("Sitemap not generated at startup (DB or IO)", { message: e.message });
    return { skipped: false, error: e.message };
  }
}

module.exports = {
  OUT_DIR,
  OUT_FILE,
  staticPaths,
  writeSitemapFile,
  ensureSitemapExists
};
