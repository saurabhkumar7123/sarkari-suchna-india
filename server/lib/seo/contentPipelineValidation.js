"use strict";

/**
 * Package 4F — Advisory content pipeline validation.
 *
 * Validates required sections, metadata, SEO fields, structured data signals,
 * internal links, and publish readiness. Advisory only — no auto-corrections.
 */

const { parseSectionsFromText } = require("../../../generator/parse/sectionParse");
const { buildValidationSummary } = require("../recruitment/editorialWorkflow");

const REQUIRED_SECTION_PATTERNS = Object.freeze([
  { id: "short_information", label: "Short Information", pattern: /short\s*info/i },
  { id: "important_dates", label: "Important Dates", pattern: /important\s*dates?/i },
  { id: "eligibility", label: "Eligibility", pattern: /eligibility|qualification/i },
  { id: "vacancy", label: "Vacancy", pattern: /vacancy|vacancies|post\s*details/i },
  { id: "selection_process", label: "Selection Process", pattern: /selection/i },
  { id: "application_process", label: "Application Process", pattern: /how\s*to\s*apply|application\s*process|apply\s*online/i },
  { id: "important_links", label: "Important Links", pattern: /important\s*links?/i }
]);

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInternalHrefs(htmlOrText) {
  const src = String(htmlOrText || "");
  const hrefs = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(src)) !== null) {
    const href = String(match[1] || "").trim();
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    if (/^https?:\/\//i.test(href) && !/sarkari/i.test(href)) continue;
    hrefs.push(href);
  }
  return [...new Set(hrefs)];
}

function detectSections(rawText) {
  const sections = parseSectionsFromText(rawText);
  const titles = sections.map((s) => String(s.cleanHeaderTitle || "").trim()).filter(Boolean);
  return { sections, titles };
}

function hasSection(titles, pattern) {
  return titles.some((title) => pattern.test(title));
}

function checkSeoTitle(value) {
  const title = String(value || "").trim();
  const len = title.length;
  return {
    id: "seo_title",
    label: "SEO title",
    ok: len >= 10 && len <= 70,
    detail: title ? `Length ${len} (target 10–70)` : "Missing SEO title"
  };
}

function checkMetaDescription(value) {
  const desc = String(value || "").trim();
  const len = desc.length;
  return {
    id: "meta_description",
    label: "Meta description",
    ok: len >= 50 && len <= 160,
    detail: desc ? `Length ${len} (target 50–160)` : "Missing meta description"
  };
}

function checkCanonical(value, slug) {
  const canonical = String(value || "").trim();
  const cleanSlug = String(slug || "")
    .trim()
    .replace(/^\//, "")
    .replace(/\.html$/i, "");
  let ok = Boolean(canonical);
  let detail = canonical || "Missing canonical URL";
  if (canonical && cleanSlug) {
    const pathMatch = canonical.match(/https?:\/\/[^/]+(\/.*)?$/i);
    const path = pathMatch ? String(pathMatch[1] || "/").replace(/\/$/, "") : canonical;
    const expected = `/${cleanSlug}`;
    if (path && path.toLowerCase() !== expected.toLowerCase() && !path.toLowerCase().endsWith(expected.toLowerCase())) {
      ok = false;
      detail = `Canonical path "${path}" does not align with slug "/${cleanSlug}"`;
    }
  }
  return {
    id: "canonical_url",
    label: "Canonical URL",
    ok,
    detail
  };
}

function checkStructuredData(htmlOrFlag) {
  if (typeof htmlOrFlag === "boolean") {
    return {
      id: "structured_data",
      label: "Structured data availability",
      ok: htmlOrFlag,
      detail: htmlOrFlag ? "Structured data signal present" : "Structured data not detected"
    };
  }
  const html = String(htmlOrFlag || "");
  const hasLdJson = /application\/ld\+json/i.test(html) || /"@type"\s*:\s*"JobPosting"/i.test(html);
  const hasSchemaHint =
    hasLdJson ||
    /itemtype\s*=\s*["']https?:\/\/schema\.org\/JobPosting/i.test(html) ||
    Boolean(html && html.length > 0 && /JobPosting/i.test(html));
  return {
    id: "structured_data",
    label: "Structured data availability",
    ok: hasSchemaHint,
    detail: hasSchemaHint ? "JobPosting / JSON-LD signal found" : "No JobPosting schema signal found"
  };
}

/**
 * @param {object} input
 * @param {string} [input.title]
 * @param {string} [input.slug]
 * @param {string} [input.status]
 * @param {string} [input.rawText]
 * @param {string} [input.content]
 * @param {string} [input.seoTitle]
 * @param {string} [input.metaDescription]
 * @param {string} [input.canonicalUrl]
 * @param {boolean|string} [input.structuredData]
 * @param {object|null} [input.recruitment]
 * @param {object|null} [input.draft]
 * @param {boolean} [input.publishReadyHint]
 */
function validateContentPipeline(input = {}) {
  const rawText = String(input.rawText || input.content || "");
  const contentHtml = String(input.content || "");
  const { titles } = detectSections(rawText);
  const checks = [];

  for (const req of REQUIRED_SECTION_PATTERNS) {
    const ok = hasSection(titles, req.pattern) || req.pattern.test(rawText.slice(0, 4000));
    checks.push({
      id: `section_${req.id}`,
      label: `Required section: ${req.label}`,
      ok,
      detail: ok ? "Present" : `Missing "${req.label}" section`
    });
  }

  const title = String(input.title || "").trim();
  checks.push({
    id: "page_title",
    label: "Page title",
    ok: title.length >= 5,
    detail: title ? title.slice(0, 80) : "Missing title"
  });

  const slug = String(input.slug || "").trim().replace(/\.html$/i, "");
  checks.push({
    id: "slug",
    label: "Slug",
    ok: slug.length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug),
    detail: slug || "Missing slug"
  });

  checks.push(checkSeoTitle(input.seoTitle || title));
  checks.push(checkMetaDescription(input.metaDescription || stripHtml(rawText).slice(0, 160)));
  checks.push(checkCanonical(input.canonicalUrl, slug));
  checks.push(checkStructuredData(input.structuredData != null ? input.structuredData : contentHtml || rawText));

  const internalLinks = extractInternalHrefs(contentHtml || rawText);
  checks.push({
    id: "internal_links",
    label: "Internal links",
    ok: internalLinks.length > 0 || /href\s*=/i.test(contentHtml) || /important\s*links?/i.test(rawText),
    detail: internalLinks.length
      ? `${internalLinks.length} internal href(s) detected`
      : "No internal links detected — review Important Links"
  });

  const status = String(input.status || "").trim();
  const bodyLen = stripHtml(rawText || contentHtml).length;
  const publishReady =
    input.publishReadyHint === true ||
    (title.length >= 5 && slug.length >= 3 && bodyLen >= 80 && Boolean(status));
  checks.push({
    id: "publish_readiness",
    label: "Publish readiness",
    ok: publishReady,
    detail: publishReady
      ? "Basic publish readiness signals look complete"
      : "Not publish-ready — title, slug, status, or body incomplete"
  });

  if (input.recruitment || input.draft) {
    const editorial = buildValidationSummary({
      recruitment: input.recruitment,
      draft: input.draft
    });
    checks.push({
      id: "editorial_alignment",
      label: "Editorial alignment summary",
      ok: editorial.ok,
      detail: `${editorial.passed}/${editorial.total} editorial checks passed`
    });
  }

  const failed = checks.filter((c) => !c.ok).length;
  return {
    advisory: true,
    autoCorrect: false,
    ok: failed === 0,
    total: checks.length,
    passed: checks.length - failed,
    failed,
    checks,
    detectedSections: titles,
    internalLinks
  };
}

module.exports = {
  REQUIRED_SECTION_PATTERNS,
  validateContentPipeline,
  extractInternalHrefs,
  detectSections: (rawText) => detectSections(rawText).titles
};
