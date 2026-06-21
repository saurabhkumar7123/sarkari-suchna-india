"use strict";

const { applyTemplatePlaceholders } = require("../utils/templatePlaceholders");
const { buildHighlightBannerFields } = require("./highlightBanner");
const { decodeHtmlEntities } = require("./breadcrumb");

const BANNER_PLACEHOLDER_RE = /\{\{\s*BANNER_/i;

function stripTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function firstMatch(html, re) {
  const m = String(html || "").match(re);
  return m && m[1] ? stripTags(m[1]) : "";
}

function extractImportantDatesText(html) {
  const sectionMatch = String(html || "").match(
    /Important\s+Dates[\s\S]*?<div class="card-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (!sectionMatch) return "";

  const rows = [];
  const rowRe =
    /<div class="date-row"[^>]*>[\s\S]*?<span class="date-label"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="date-value[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = rowRe.exec(sectionMatch[1])) !== null) {
    const label = stripTags(match[1]);
    const value = stripTags(match[2]);
    if (label && value) rows.push(`${label}: ${value}`);
  }

  return rows.length ? `[Section: ImportantDates]\n${rows.join("\n")}` : "";
}

function extractEligibilityText(html) {
  const sectionMatch = String(html || "").match(
    /Eligibility[\s\S]*?<div class="card-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (!sectionMatch) return "";
  const text = stripTags(sectionMatch[1]);
  return text ? `[Section: Eligibility]\n${text}` : "";
}

function extractJobFactsText(html) {
  const parts = [extractImportantDatesText(html), extractEligibilityText(html)].filter(Boolean);
  return parts.join("\n\n");
}

function extractBannerContextFromHtml(html) {
  const source = String(html || "");
  const title = firstMatch(source, /<h1[^>]*class="job-title"[^>]*>([\s\S]*?)<\/h1>/i);
  const postNameFromBanner = firstMatch(
    source,
    /<p class="highlight-banner-subtitle"[^>]*>([\s\S]*?)<\/p>/i
  );
  const postName =
    postNameFromBanner && !/\{\{/.test(postNameFromBanner)
      ? postNameFromBanner.replace(/^Post Name/i, "").replace(/^:/, "").trim()
      : "";
  const metaTag = firstMatch(source, /class="tag-link meta-tag"[^>]*>([\s\S]*?)<\/a>/i);
  const statusFromTitle = title;
  const totalPosts = firstMatch(source, /<span class="highlight-banner-total-num"[^>]*>([\s\S]*?)<\/span>/i);
  const advertisementNo = firstMatch(source, /<span class="advt-value"[^>]*>([\s\S]*?)<\/span>/i);

  return {
    title,
    postName: postName || title,
    category: metaTag,
    normalizedStatus: metaTag || inferStatusFromTitle(title),
    totalPosts,
    advertisementNo,
    text: extractJobFactsText(source),
    statusFromTitle
  };
}

function inferStatusFromTitle(title) {
  const t = String(title || "").toLowerCase();
  if (/\badmit\s*card\b/.test(t)) return "admit card";
  if (/\bresult\b/.test(t)) return "result";
  if (/\banswer\s*key\b/.test(t)) return "answer key";
  if (/\bsyllabus\b/.test(t)) return "syllabus";
  if (/\badmission\b/.test(t)) return "admission";
  if (/\bonline\s+form\b/.test(t) || /\bapply\s+online\b/.test(t)) return "new form";
  return "general";
}

/**
 * Resolve unresolved {{BANNER_*}} tokens in saved job HTML at serve time.
 * @param {string} html
 * @returns {string}
 */
function normalizeHighlightBannerInHtml(html) {
  const source = String(html || "");
  if (!BANNER_PLACEHOLDER_RE.test(source)) return source;

  const ctx = extractBannerContextFromHtml(source);
  if (!ctx.title) return source;

  const fields = buildHighlightBannerFields({
    title: ctx.title,
    text: ctx.text,
    category: ctx.category,
    normalizedStatus: ctx.normalizedStatus,
    postName: ctx.postName,
    totalPosts: ctx.totalPosts,
    advertisementNo: ctx.advertisementNo
  });

  return applyTemplatePlaceholders(source, {
    BANNER_STATUS_BADGE: fields.BANNER_STATUS_BADGE,
    BANNER_ORG: fields.BANNER_ORG,
    BANNER_TITLE_SHORT: fields.BANNER_TITLE_SHORT,
    BANNER_ACTION: fields.BANNER_ACTION,
    BANNER_FACT: fields.BANNER_FACT,
    BANNER_ADVT_DISPLAY: fields.BANNER_ADVT_DISPLAY,
    BANNER_THEME_CLASS: fields.BANNER_THEME_CLASS
  });
}

module.exports = {
  normalizeHighlightBannerInHtml,
  extractBannerContextFromHtml,
  extractJobFactsText
};
