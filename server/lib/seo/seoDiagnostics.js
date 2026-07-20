"use strict";

/**
 * Package 4F — SEO diagnostics builder (operator-facing, advisory).
 *
 * Aggregates missing metadata/schema, broken internal links, duplicate titles,
 * missing descriptions, and validation summary. No external SEO services.
 */

const { validateContentPipeline, extractInternalHrefs } = require("./contentPipelineValidation");
const { buildEditorialChecklist } = require("./editorialChecklist");
const { buildContentFreshnessIndicator } = require("./contentFreshnessStatus");
const { validateSitemapCoverage } = require("./sitemapValidation");

function normalizeTitleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {Array<{ title?: string, slug?: string }>} pages
 */
function findDuplicateTitles(pages) {
  const map = new Map();
  for (const page of pages || []) {
    const key = normalizeTitleKey(page.title);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      title: page.title,
      slug: page.slug || null
    });
  }
  return [...map.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      title: group[0].title,
      count: group.length,
      slugs: group.map((g) => g.slug).filter(Boolean)
    }))
    .sort((a, b) => b.count - a.count || String(a.title).localeCompare(String(b.title)));
}

/**
 * @param {string[]} hrefs
 * @param {Set<string>} knownSlugs
 */
function findBrokenInternalLinks(hrefs, knownSlugs) {
  const broken = [];
  for (const href of hrefs || []) {
    const raw = String(href || "").trim();
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:)/i.test(raw)) continue;
    if (/^https?:\/\//i.test(raw)) continue;
    if (
      raw.startsWith("/department/") ||
      raw.startsWith("/qualification/") ||
      raw.startsWith("/state/") ||
      raw.startsWith("/topic/") ||
      raw.startsWith("/search") ||
      raw.startsWith("/latest-job") ||
      raw.startsWith("/result") ||
      raw.startsWith("/admit-card") ||
      raw.startsWith("/admin/") ||
      raw === "/"
    ) {
      continue;
    }
    const path = raw.replace(/^\//, "").replace(/\.html$/i, "").split(/[?#]/)[0];
    if (!path) continue;
    if (knownSlugs && knownSlugs.size && !knownSlugs.has(path.toLowerCase())) {
      broken.push({ href: raw, slug: path, detail: "No matching published page slug" });
    }
  }
  return broken;
}

/**
 * Build diagnostics for a single page context.
 * @param {object} input
 */
function buildPageSeoDiagnostics(input = {}) {
  const page = input.page && typeof input.page === "object" ? input.page : {};
  const validation = validateContentPipeline({
    title: page.title,
    slug: page.slug,
    status: page.status,
    rawText: page.raw_text || page.rawText,
    content: page.content,
    seoTitle: input.seoTitle || page.seoTitle || page.title,
    metaDescription: input.metaDescription || page.metaDescription || page.meta_description,
    canonicalUrl: input.canonicalUrl || page.canonicalUrl || page.canonical_url,
    structuredData: input.structuredData != null ? input.structuredData : page.content,
    recruitment: input.recruitment,
    draft: input.draft,
    publishReadyHint: input.publishReadyHint
  });

  const checklist = buildEditorialChecklist({
    rawText: page.raw_text || page.rawText,
    content: page.content,
    totalPosts: page.total_posts || page.totalPosts,
    lastDate: page.last_date || page.lastDate,
    qualification: page.qualification,
    imageAvailable: input.imageAvailable
  });

  const freshness = buildContentFreshnessIndicator({
    createdAt: page.created_at || page.createdAt,
    updatedAt: page.updated_at || page.updatedAt,
    contentUpdatedAt: page.content_updated_at || page.contentUpdatedAt,
    lastReviewDate: input.lastReviewDate || page.last_review_date || page.lastReviewDate,
    now: input.now
  });

  const missingMetadata = validation.checks
    .filter((c) => !c.ok && ["page_title", "slug", "seo_title", "meta_description", "canonical_url"].includes(c.id))
    .map((c) => ({ id: c.id, label: c.label, detail: c.detail }));

  const missingSchema = validation.checks
    .filter((c) => !c.ok && c.id === "structured_data")
    .map((c) => ({ id: c.id, label: c.label, detail: c.detail }));

  const missingDescriptions = validation.checks
    .filter((c) => !c.ok && c.id === "meta_description")
    .map((c) => ({ id: c.id, label: c.label, detail: c.detail }));

  const knownSlugs = new Set(
    (input.knownSlugs || []).map((s) =>
      String(s || "")
        .trim()
        .replace(/\.html$/i, "")
        .toLowerCase()
    )
  );
  const hrefs = extractInternalHrefs(page.content || page.raw_text || "");
  const brokenInternalLinks = findBrokenInternalLinks(hrefs, knownSlugs);

  return {
    advisory: true,
    externalServices: false,
    page: {
      slug: page.slug || null,
      title: page.title || null
    },
    missingMetadata,
    missingSchema,
    missingDescriptions,
    brokenInternalLinks,
    validationSummary: {
      ok: validation.ok,
      passed: validation.passed,
      failed: validation.failed,
      total: validation.total
    },
    checklistProgress: {
      percent: checklist.percent,
      completed: checklist.completed,
      total: checklist.total,
      progressLabel: checklist.progressLabel
    },
    freshness,
    validation,
    checklist
  };
}

/**
 * Aggregate operator diagnostics across a page sample + sitemap locs.
 * @param {object} input
 */
function buildSeoDiagnosticsPanel(input = {}) {
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const knownSlugs = new Set(
    pages
      .map((p) =>
        String(p.slug || "")
          .trim()
          .replace(/\.html$/i, "")
          .toLowerCase()
      )
      .filter(Boolean)
  );

  const duplicateTitles = findDuplicateTitles(pages);
  const pageDiagnostics = pages.slice(0, Number(input.limit) || 50).map((page) =>
    buildPageSeoDiagnostics({
      page,
      knownSlugs: [...knownSlugs],
      lastReviewDate: input.reviewDates && input.reviewDates[page.slug],
      now: input.now
    })
  );

  const missingMetadata = [];
  const missingSchema = [];
  const missingDescriptions = [];
  const brokenInternalLinks = [];
  let validationFailed = 0;

  for (const row of pageDiagnostics) {
    if (!row.validationSummary.ok) validationFailed += 1;
    for (const item of row.missingMetadata) {
      missingMetadata.push({ slug: row.page.slug, ...item });
    }
    for (const item of row.missingSchema) {
      missingSchema.push({ slug: row.page.slug, ...item });
    }
    for (const item of row.missingDescriptions) {
      missingDescriptions.push({ slug: row.page.slug, ...item });
    }
    for (const item of row.brokenInternalLinks) {
      brokenInternalLinks.push({ slug: row.page.slug, ...item });
    }
  }

  const sitemap = validateSitemapCoverage({
    locs: input.sitemapLocs || [],
    topicCategories: input.topicCategories || pages.map((p) => p.category).filter(Boolean),
    baseUrl: input.baseUrl
  });

  return {
    advisory: true,
    externalServices: false,
    generatedAt: (input.now ? new Date(input.now) : new Date()).toISOString(),
    summary: {
      pagesScanned: pageDiagnostics.length,
      validationFailed,
      missingMetadataCount: missingMetadata.length,
      missingSchemaCount: missingSchema.length,
      missingDescriptionCount: missingDescriptions.length,
      brokenInternalLinkCount: brokenInternalLinks.length,
      duplicateTitleCount: duplicateTitles.length,
      sitemapOk: sitemap.ok
    },
    missingMetadata,
    missingSchema,
    missingDescriptions,
    brokenInternalLinks,
    duplicateTitles,
    sitemap,
    validationSummary: {
      scanned: pageDiagnostics.length,
      failed: validationFailed,
      ok: validationFailed === 0
    },
    pages: pageDiagnostics
  };
}

module.exports = {
  findDuplicateTitles,
  findBrokenInternalLinks,
  buildPageSeoDiagnostics,
  buildSeoDiagnosticsPanel
};
