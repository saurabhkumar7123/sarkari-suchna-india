"use strict";

/**
 * Rebuilds generated/jobs/*.html for every published page using current
 * generator (sectionBuilder, template, etc.).
 *
 * Usage (from project root): node scripts/regenerate-all-jobs.js
 */

require("dotenv").config();

const db = require("../server/config/db");
const pipeline = require("../generator/pipeline/generatePage");
const { invalidatePageCaches } = require("../server/services/cache.services");
const { writeSitemapFile } = require("../server/lib/sitemapGenerator");
const logger = require("../server/utils/logger");

const CANONICAL_STATUSES = new Set([
  "latest job",
  "admit card",
  "result",
  "answer key",
  "document",
  "admission",
  "syllabus"
]);

const LEGACY_STATUS_ALIASES = {
  "new form": "latest job",
  new: "latest job",
  form: "latest job",
  admit: "admit card",
  answer: "answer key"
};

function normalizeStatus(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "other";

  const lower = raw.toLowerCase();
  if (CANONICAL_STATUSES.has(lower)) return lower;
  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_ALIASES, lower)) {
    return LEGACY_STATUS_ALIASES[lower];
  }

  const cleaned = raw.replace(/\s+/g, " ").slice(0, 64).trim();
  if (!cleaned) return "other";
  return cleaned.toLowerCase();
}

async function main() {
  const [rows] = await db.query(
    "SELECT title, slug, raw_text, category, status, post_name, total_posts FROM pages WHERE deleted=0"
  );

  let ok = 0;
  const errors = [];
  const slugs = [];

  for (const row of rows) {
    const slug = String(row.slug || "").trim();
    if (!slug) continue;

    const normalizedStatus = normalizeStatus(row.status);
    try {
      const html = await pipeline.buildJobHtml({
        title: row.title,
        text: row.raw_text || "",
        slug,
        category: row.category || "",
        normalizedStatus,
        postName: row.post_name != null ? String(row.post_name) : null,
        totalPosts: row.total_posts != null ? String(row.total_posts) : null
      });
      await pipeline.writeJobHtmlFile(slug, html);
      slugs.push(slug);
      ok += 1;
    } catch (e) {
      errors.push({ slug, message: e.message });
      logger.error("regenerate-all-jobs: failed", { slug, message: e.message });
    }
  }

  await invalidatePageCaches(slugs);
  try {
    await writeSitemapFile(db);
  } catch (e) {
    logger.warn("regenerate-all-jobs: sitemap failed", { message: e.message });
  }

  console.log(`Regenerated ${ok} job HTML file(s) in generated/jobs/`);
  if (errors.length) {
    console.error(`Failed: ${errors.length}`, errors);
    process.exitCode = 1;
  }

  await db.end().catch(() => {});
}

main().catch(async (e) => {
  console.error(e);
  await db.end().catch(() => {});
  process.exit(1);
});
