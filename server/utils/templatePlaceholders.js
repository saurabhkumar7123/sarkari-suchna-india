"use strict";

const { buildDynamicSectionsWithWarnings } = require("../../generator/builders/sectionBuilder");
const { extractAdvertisementNo } = require("./extractAdvertisementNo");
const { extractTotalPosts } = require("./extractTotalPosts");
const { escapeHtml, sanitizeUrl, safeUrlSegment } = require("./escapeHtml");
const { getBaseUrl } = require("./baseUrl");
const { renderBreadcrumbHtml } = require("../lib/breadcrumb");

function createSlug(title) {
  return String(title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatPostDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatPostTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function extractFieldFromText(text, label) {
  const src = String(text || "");
  if (!src) return "";
  const re = new RegExp(`${label}\\s*:\\s*([^\\n\\r]+)`, "i");
  const m = src.match(re);
  return m && m[1] ? String(m[1]).trim() : "";
}

function parseFlexibleDateToIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = raw.match(/^(\d{1,2})[\/\- ](\d{1,2})[\/\- ](\d{4})$/);
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!dd || !mm || !yyyy) return "";
  const d2 = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(d2.getTime())) return "";
  return d2.toISOString().slice(0, 10);
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `{{KEY}}` with optional internal whitespace (templates / hand edits). */
function placeholderRegexForKey(key) {
  return new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "gi");
}

function applyTemplatePlaceholders(template, variables) {
  let html = String(template || "");
  const vars = variables && typeof variables === "object" ? variables : {};

  for (const [key, value] of Object.entries(vars)) {
    const safe = value == null || value === undefined ? "" : String(value);
    html = html.replace(placeholderRegexForKey(key), () => safe);
  }

  const titleFallback = vars.TITLE == null || vars.TITLE === undefined ? "" : String(vars.TITLE);
  const seoTitleRaw = vars.SEO_TITLE;
  const seoTitleFinal =
    seoTitleRaw != null && String(seoTitleRaw).trim().length > 0 ? String(seoTitleRaw).trim() : titleFallback;
  const rawPn = vars.POST_NAME;
  const postNameFinal =
    rawPn != null && String(rawPn).trim().length > 0 ? String(rawPn).trim() : titleFallback;
  const rawTp = vars.TOTAL_POSTS;
  const totalPostsFinal = rawTp == null || rawTp === undefined ? "" : String(rawTp);

  html = html.replace(placeholderRegexForKey("POST_NAME"), () => postNameFinal);
  html = html.replace(placeholderRegexForKey("TOTAL_POSTS"), () => totalPostsFinal);
  html = html.replace(placeholderRegexForKey("SEO_TITLE"), () => seoTitleFinal);

  return html;
}

/**
 * Ensures banner placeholders are gone (strict + whitespace-tolerant).
 * Call after applyTemplatePlaceholders on full page HTML.
 */
function assertJobBannerPlaceholdersResolved(html) {
  const h = String(html || "");
  if (/\{\{\s*POST_NAME\s*\}\}/i.test(h) || /\{\{\s*TOTAL_POSTS\s*\}\}/i.test(h)) {
    throw new Error("Placeholder not replaced: {{POST_NAME}} or {{TOTAL_POSTS}} still present");
  }
}

/**
 * @param {{
 *   title: string,
 *   text: string,
 *   slug: string,
 *   category?: string,
 *   normalizedStatus?: string,
 *   now?: Date,
 *   postName?: string | null,
 *   totalPosts?: string | null
 * }} opts
 */
function buildJobTemplateVariables(opts) {
  const {
    title,
    text,
    slug,
    category = "general",
    normalizedStatus = "general",
    now = new Date(),
    postName = null,
    totalPosts = null
  } = opts;

  let dynamicSections;
  let parserWarnings = [];
  try {
    const parsed = buildDynamicSectionsWithWarnings(String(text || ""));
    dynamicSections = parsed.html;
    parserWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
  } catch {
    dynamicSections = String(text || "");
    parserWarnings = [];
  }

  const tag = String(category || normalizedStatus || "general")
    .trim()
    .replace(/\s+/g, " ");
  const tagSlug = createSlug(tag || "general");
  const titleTrim = String(title || "").trim();
  const postNameTrim = String(postName ?? "").trim();
  const postNameForTemplate = postNameTrim.length > 0 ? postNameTrim : titleTrim;
  const lastDateRaw = extractFieldFromText(String(text || ""), "Last Date");
  const yearMatch = String(lastDateRaw || "").match(/\b(20\d{2})\b/) || String(now.getFullYear()).match(/\b(20\d{2})\b/);
  const yearText = yearMatch ? yearMatch[1] : String(now.getFullYear());
  const seoBaseTitle = postNameForTemplate || titleTrim || "Job";
  const seoTitleBase = `${seoBaseTitle} Recruitment ${yearText} - Apply Online, Last Date`;
  const seoSiteSuffix = " | Sarkari Suchna India";
  const seoTitle = seoTitleBase.length <= 58 ? `${seoTitleBase}${seoSiteSuffix}` : seoTitleBase;
  const metaDescriptionRaw = `${seoBaseTitle} recruitment update. Check apply online process, last date, eligibility, vacancy details and important links.`;
  const metaDescription = metaDescriptionRaw;
  const stateRaw = extractFieldFromText(String(text || ""), "State");
  const departmentRaw = extractFieldFromText(String(text || ""), "Department");
  const lastDateIso = parseFlexibleDateToIso(lastDateRaw);
  const advertisementNo = extractAdvertisementNo(String(text || ""));
  const explicitTotal = String(totalPosts ?? "").trim();
  const extractedTotal = extractTotalPosts(String(text || ""));
  const totalPostsForTemplate =
    explicitTotal.length > 0 ? explicitTotal.replace(/\s+/g, " ") : extractedTotal == null ? "" : String(extractedTotal);

  const slugClean = String(slug || "")
    .trim()
    .replace(/\.html$/i, "");

  const slugForUrls = slugClean ? safeUrlSegment(slugClean) : "";
  const tagSlugForUrls = safeUrlSegment(tagSlug || "general") || "general";
  const baseUrl = getBaseUrl().replace(/\/+$/, "");
  const canonicalPath = sanitizeUrl(slugForUrls ? `/${slugForUrls}` : "/");
  const canonicalUrl = `${baseUrl}${canonicalPath}`;
  const jobPosting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: seoBaseTitle || "Job Update",
    description: metaDescriptionRaw,
    datePosted: now.toISOString().slice(0, 10),
    hiringOrganization: {
      "@type": "Organization",
      name: "Sarkari Suchna India",
      sameAs: baseUrl || undefined
    },
    url: canonicalUrl
  };
  if (departmentRaw) {
    jobPosting.industry = departmentRaw;
  }
  if (stateRaw) {
    jobPosting.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressRegion: stateRaw,
        addressCountry: "IN"
      }
    };
  }
  if (lastDateIso) {
    jobPosting.validThrough = lastDateIso;
  }

  const SEO_TITLE = escapeHtml(seoTitle);
  console.log("SEO_TITLE:", SEO_TITLE);

  const displayTitle = titleTrim || seoBaseTitle;

  return {
    /** Escaped for HTML text/attributes — do not double-escape {{DYNAMIC_SECTIONS}} (already HTML). */
    TITLE: escapeHtml(displayTitle),
    BREADCRUMB: renderBreadcrumbHtml(displayTitle),
    SEO_TITLE,
    /** Display: explicit post name, else page title (never raw {{POST_NAME}}). */
    POST_NAME: escapeHtml(postNameForTemplate),
    DYNAMIC_SECTIONS: dynamicSections,
    POST_DATE: formatPostDate(now),
    POST_TIME: formatPostTime(now),
    TAG: escapeHtml(tag || "general"),
    TAG_SLUG: tagSlugForUrls,
    ADVERTISEMENT_NO: escapeHtml(advertisementNo),
    CANONICAL_URL: canonicalUrl,
    META_DESCRIPTION: escapeHtml(metaDescription),
    BASE_URL: escapeHtml(baseUrl),
    SLUG: slugForUrls || "page",
    TOTAL_POSTS: escapeHtml(totalPostsForTemplate),
    JOBPOSTING_SCHEMA: JSON.stringify(jobPosting),
    PARSER_WARNINGS: parserWarnings
  };
}

module.exports = {
  applyTemplatePlaceholders,
  assertJobBannerPlaceholdersResolved,
  buildJobTemplateVariables,
  createSlug
};
