"use strict";

/**
 * Package 4F — SEO & content pipeline operator service.
 *
 * Advisory surfaces only. No auto-correction, publishing, or automation.
 */

const pageRepository = require("../repositories/page.repository");
const contentReviewMetadata = require("../repositories/contentReviewMetadata.repository");
const { getBaseUrl } = require("../utils/baseUrl");
const { staticPaths, validateSitemapCoverage } = require("../lib/sitemapGenerator");
const { validateContentPipeline } = require("../lib/seo/contentPipelineValidation");
const { buildEditorialChecklist } = require("../lib/seo/editorialChecklist");
const { buildInternalLinkSuggestions } = require("../lib/seo/internalLinkingAssistant");
const { buildContentFreshnessIndicator } = require("../lib/seo/contentFreshnessStatus");
const {
  buildPageSeoDiagnostics,
  buildSeoDiagnosticsPanel
} = require("../lib/seo/seoDiagnostics");
const { generateFeatureCompletionReport } = require("../lib/seo/featureCompletionReport");

function resolveBaseUrl() {
  try {
    return String(getBaseUrl() || "https://www.example.com").replace(/\/$/, "");
  } catch {
    return "https://www.example.com";
  }
}

async function loadPageBySlug(slug) {
  const clean = String(slug || "")
    .trim()
    .replace(/\.html$/i, "");
  if (!clean) {
    const err = new Error("slug is required");
    err.statusCode = 400;
    throw err;
  }
  const page =
    (await pageRepository.findAdminPageBySlug(clean)) ||
    (await pageRepository.findPublicRowBySlug(clean)) ||
    (await pageRepository.findRowBySlug(clean));
  if (!page || Number(page.deleted) === 1) {
    const err = new Error("Page not found");
    err.statusCode = 404;
    throw err;
  }
  return page;
}

async function validatePageContent(slug) {
  const page = await loadPageBySlug(slug);
  const baseUrl = resolveBaseUrl();
  return {
    page: { slug: page.slug, title: page.title },
    validation: validateContentPipeline({
      title: page.title,
      slug: page.slug,
      status: page.status,
      rawText: page.raw_text,
      content: page.content,
      seoTitle: page.title,
      metaDescription: null,
      canonicalUrl: `${baseUrl}/${page.slug}`,
      structuredData: page.content
    })
  };
}

async function getEditorialChecklistForSlug(slug) {
  const page = await loadPageBySlug(slug);
  return {
    page: { slug: page.slug, title: page.title },
    checklist: buildEditorialChecklist({
      rawText: page.raw_text,
      content: page.content,
      totalPosts: page.total_posts,
      lastDate: page.last_date,
      qualification: page.qualification
    })
  };
}

async function getLinkSuggestionsForSlug(slug, limit = 6) {
  const page = await loadPageBySlug(slug);
  let candidatePages = [];
  try {
    candidatePages = await pageRepository.selectRelatedCandidates(page.slug, 80);
  } catch {
    candidatePages = [];
  }

  let candidateRecruitments = [];
  try {
    const recruitmentRepository = require("../repositories/recruitment.repository");
    const listed = await recruitmentRepository.listRecruitments({ page: 1, limit: 40 });
    candidateRecruitments = Array.isArray(listed?.data) ? listed.data : [];
  } catch {
    candidateRecruitments = [];
  }

  return buildInternalLinkSuggestions({
    page,
    candidatePages,
    candidateRecruitments,
    limit
  });
}

async function getFreshnessForSlug(slug) {
  const page = await loadPageBySlug(slug);
  const lastReviewDate = contentReviewMetadata.getLastReviewDate(page.slug);
  return {
    page: { slug: page.slug, title: page.title },
    freshness: buildContentFreshnessIndicator({
      createdAt: page.created_at,
      updatedAt: page.updated_at,
      contentUpdatedAt: page.content_updated_at,
      lastReviewDate
    })
  };
}

async function recordPageReview(slug, lastReviewDate, updatedBy) {
  const page = await loadPageBySlug(slug);
  const row = contentReviewMetadata.setLastReviewDate(
    page.slug,
    lastReviewDate || new Date(),
    updatedBy
  );
  return {
    page: { slug: page.slug, title: page.title },
    review: row,
    freshness: buildContentFreshnessIndicator({
      createdAt: page.created_at,
      updatedAt: page.updated_at,
      contentUpdatedAt: page.content_updated_at,
      lastReviewDate: row.lastReviewDate
    })
  };
}

async function getPageDiagnostics(slug) {
  const page = await loadPageBySlug(slug);
  let knownSlugs = [];
  try {
    knownSlugs = await pageRepository.selectAllSlugsPublic();
  } catch {
    knownSlugs = [];
  }
  const slugList = Array.isArray(knownSlugs)
    ? knownSlugs.map((s) => (typeof s === "string" ? s : s.slug)).filter(Boolean)
    : [];
  return buildPageSeoDiagnostics({
    page,
    knownSlugs: slugList,
    lastReviewDate: contentReviewMetadata.getLastReviewDate(page.slug),
    canonicalUrl: `${resolveBaseUrl()}/${page.slug}`,
    seoTitle: page.title
  });
}

async function getDiagnosticsPanel(limit = 40) {
  const take = Math.min(100, Math.max(1, Number(limit) || 40));
  let pages = [];
  try {
    pages = await pageRepository.selectAdminPageList("WHERE deleted=0", [], "DESC", take, 0);
  } catch {
    pages = [];
  }

  const enriched = [];
  for (const row of pages) {
    if (row.raw_text != null || row.content != null) {
      enriched.push(row);
      continue;
    }
    try {
      const full = await pageRepository.findAdminPageBySlug(row.slug);
      enriched.push(full || row);
    } catch {
      enriched.push(row);
    }
  }

  const baseUrl = resolveBaseUrl();
  const topicCategories = enriched.map((p) => p.category).filter(Boolean);
  const staticLocs = staticPaths(baseUrl, { topicCategories }).map((p) => p.loc);
  const jobLocs = enriched
    .map((p) => String(p.slug || "").trim())
    .filter(Boolean)
    .map((slug) => `${baseUrl}/${slug}`);

  return buildSeoDiagnosticsPanel({
    pages: enriched,
    sitemapLocs: [...staticLocs, ...jobLocs],
    topicCategories,
    baseUrl,
    reviewDates: contentReviewMetadata.getAllReviewDates(),
    limit: take
  });
}

async function getSitemapValidationReport() {
  const baseUrl = resolveBaseUrl();
  let topicCategories = [];
  let jobLocs = [];
  try {
    const db = require("../config/db");
    const [rows] = await db.query("SELECT slug, category FROM pages WHERE deleted=0");
    topicCategories = (rows || []).map((r) => r.category).filter(Boolean);
    jobLocs = (rows || [])
      .map((r) => String(r.slug || "").trim())
      .filter(Boolean)
      .map((slug) => `${baseUrl}/${slug}`);
  } catch {
    topicCategories = [];
    jobLocs = [];
  }
  const locs = [...staticPaths(baseUrl, { topicCategories }).map((p) => p.loc), ...jobLocs];
  return validateSitemapCoverage({ locs, topicCategories, baseUrl });
}

function getFeatureCompletionReportData(overrides = {}) {
  return generateFeatureCompletionReport(overrides);
}

module.exports = {
  validatePageContent,
  getEditorialChecklistForSlug,
  getLinkSuggestionsForSlug,
  getFreshnessForSlug,
  recordPageReview,
  getPageDiagnostics,
  getDiagnosticsPanel,
  getSitemapValidationReport,
  getFeatureCompletionReportData
};
