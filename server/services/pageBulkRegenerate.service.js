"use strict";

/**
 * Package 4E — Bulk page regenerate (admin stub closure).
 *
 * Synchronous, operator-triggered regenerate for selected slugs.
 * No workers, schedulers, or background queues.
 */

const pageRepository = require("../repositories/page.repository");
const pipeline = require("../../generator/pipeline/generatePage");
const { invalidatePageCaches } = require("./cache.services");
const { embedRelatedJobsInJobHtml } = require("../lib/relatedJobsEmbed");
const { getRelatedPagesForSlug } = require("./relatedPages.service");
const fileService = require("./file.service");
const path = require("path");

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

const MAX_SLUGS = 40;

function normalizeStatus(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (CANONICAL_STATUSES.has(lower)) return lower;
  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_ALIASES, lower)) {
    return LEGACY_STATUS_ALIASES[lower];
  }
  const cleaned = raw.replace(/\s+/g, " ").slice(0, 64).trim();
  return cleaned ? cleaned.toLowerCase() : "other";
}

function normalizeSlugs(slugs) {
  const unique = [
    ...new Set(
      (Array.isArray(slugs) ? slugs : [])
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .map((s) => s.replace(/^\//, "").slice(0, 255))
    )
  ];
  if (!unique.length) {
    const err = new Error("slugs must include at least one page slug");
    err.statusCode = 400;
    throw err;
  }
  if (unique.length > MAX_SLUGS) {
    const err = new Error(`slugs cannot exceed ${MAX_SLUGS} items`);
    err.statusCode = 400;
    throw err;
  }
  return unique;
}

async function regenerateOne(slug) {
  const page = await pageRepository.findRowBySlug(slug);
  if (!page || Number(page.deleted) === 1) {
    return { slug, status: "failed", reason: "not_found" };
  }

  let html = await pipeline.buildJobHtml({
    title: page.title || "",
    text: page.raw_text || "",
    slug: page.slug,
    category: page.category || "",
    normalizedStatus: normalizeStatus(page.status),
    postName: page.post_name != null ? String(page.post_name) : null,
    totalPosts: page.total_posts != null ? String(page.total_posts) : null,
    advertisementNo: page.advertisement_no != null ? String(page.advertisement_no) : null
  });

  try {
    const relatedItems = await getRelatedPagesForSlug(page.slug, 6);
    html = embedRelatedJobsInJobHtml(html, page.slug, relatedItems);
  } catch {
    /* non-blocking */
  }

  const filePath = path.join(process.cwd(), "generated", "jobs", `${page.slug}.html`);
  await fileService.writeFile(filePath, html, "utf8");
  if (typeof pageRepository.updateRestoredPageContent === "function") {
    await pageRepository.updateRestoredPageContent(page.slug, html).catch(() => {});
  }
  await invalidatePageCaches([page.slug]).catch(() => {});

  return { slug: page.slug, status: "ok" };
}

/**
 * @param {{ slugs: string[], confirm: boolean }} input
 */
async function regeneratePages(input = {}) {
  if (input.confirm !== true) {
    const err = new Error("Explicit confirmation is required (confirm: true)");
    err.statusCode = 400;
    throw err;
  }
  const slugs = normalizeSlugs(input.slugs);
  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await regenerateOne(slug));
    } catch (err) {
      results.push({
        slug,
        status: "failed",
        reason: err && err.message ? err.message : "failed"
      });
    }
  }
  return {
    summary: {
      requested: slugs.length,
      ok: results.filter((r) => r.status === "ok").length,
      failed: results.filter((r) => r.status === "failed").length
    },
    results
  };
}

module.exports = {
  MAX_SLUGS,
  regeneratePages,
  normalizeStatus
};
