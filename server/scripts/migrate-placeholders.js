/* eslint-disable no-console */
/**
 * Rebuilds `pages.content` and `generated/jobs/{slug}.html` for any row whose
 * stored HTML still contains `{{...}}` tokens, using the same pipeline as
 * generator / regenerate (full applyTemplatePlaceholders — not partial regex).
 */
const fs = require("fs/promises");
const path = require("path");
require("dotenv").config();
const db = require("../config/db");
const pipeline = require("../../generator/pipeline/generatePage");

const CANONICAL_STATUSES = new Set([
  "new form",
  "admit card",
  "result",
  "answer key",
  "document",
  "admission",
  "syllabus"
]);
const LEGACY_STATUS_ALIASES = {
  new: "new form",
  form: "new form",
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

async function run() {
  const [rows] = await db.query(
    `SELECT id, slug, title, status, category, raw_text, content, post_name, total_posts
     FROM pages
     WHERE deleted = 0 AND content LIKE '%{{%'`
  );

  if (!rows.length) {
    console.log("[migrate-placeholders] No pages with placeholders found.");
    await db.end();
    return;
  }

  let updated = 0;
  const outputDir = path.join(process.cwd(), "generated", "jobs");
  await fs.mkdir(outputDir, { recursive: true });

  for (const row of rows) {
    const slug = String(row.slug || "").trim();
    if (!slug) continue;

    let html;
    try {
      html = await pipeline.buildJobHtml({
        title: row.title || "",
        text: row.raw_text || "",
        slug,
        category: row.category || "",
        normalizedStatus: normalizeStatus(row.status),
        postName: row.post_name != null ? String(row.post_name) : null,
        totalPosts: row.total_posts != null ? String(row.total_posts) : null
      });
    } catch (e) {
      console.error(`[migrate-placeholders] skip slug=${slug}:`, e.message || e);
      continue;
    }

    if (html === row.content) continue;

    await db.query("UPDATE pages SET content = ? WHERE id = ?", [html, row.id]);
    await fs.writeFile(path.join(outputDir, `${slug}.html`), html, "utf8");
    updated += 1;
  }

  console.log(`[migrate-placeholders] Updated ${updated} page(s).`);
  await db.end();
}

run().catch(async (err) => {
  console.error("[migrate-placeholders] Failed:", err);
  try {
    await db.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
