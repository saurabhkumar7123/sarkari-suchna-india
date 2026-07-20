"use strict";

/**
 * Package 4F — Expected sitemap coverage for hubs and editorial surfaces.
 *
 * Advisory helpers used by sitemap generation and validation.
 * No publishing. No automation.
 */

const { allBoardHubs } = require("../boardHubs");
const {
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_STATES
} = require("../structuredFields");
const {
  buildDepartmentPath,
  buildQualificationPath,
  buildStatePath,
  toTaxonomyPathSlug
} = require("../taxonomySlugs");
const { parseCategoryTags, normalizeTopicSlug } = require("../topicTags");

const EDITORIAL_STATIC_PATHS = Object.freeze([
  "/",
  "/search",
  "/latest-job",
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
  "/categories"
]);

/**
 * @returns {{ path: string, kind: string, label: string }[]}
 */
function listDepartmentHubPaths() {
  return allBoardHubs().map((hub) => ({
    path: buildDepartmentPath(hub.slug),
    kind: "department_hub",
    label: hub.label || hub.slug
  }));
}

/**
 * @returns {{ path: string, kind: string, label: string }[]}
 */
function listQualificationHubPaths() {
  return [...ALLOWED_JOB_QUALIFICATIONS].sort().map((slug) => ({
    path: buildQualificationPath(slug),
    kind: "qualification_hub",
    label: slug
  }));
}

/**
 * @returns {{ path: string, kind: string, label: string }[]}
 */
function listStateHubPaths() {
  return [...ALLOWED_JOB_STATES].sort().map((slug) => ({
    path: buildStatePath(slug),
    kind: "state_hub",
    label: slug
  }));
}

/**
 * Derive topic hub paths from category text values (pages / samples).
 * @param {Iterable<string>|null|undefined} categoryValues
 * @returns {{ path: string, kind: string, label: string }[]}
 */
function listTopicHubPathsFromCategories(categoryValues) {
  const seen = new Map();
  for (const raw of categoryValues || []) {
    const tags = parseCategoryTags(raw);
    for (const tag of tags) {
      const slug = normalizeTopicSlug(tag);
      if (!slug || seen.has(slug)) continue;
      seen.set(slug, {
        path: `/topic/${encodeURIComponent(slug)}`,
        kind: "topic_hub",
        label: tag
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Recruitment public pages are job slugs under `/`.
 * @param {Iterable<{ slug?: string, title?: string }>|null|undefined} pages
 * @returns {{ path: string, kind: string, label: string }[]}
 */
function listRecruitmentPagePaths(pages) {
  const out = [];
  for (const page of pages || []) {
    const slug = String(page?.slug || "")
      .trim()
      .replace(/\.html$/i, "");
    if (!slug) continue;
    out.push({
      path: `/${encodeURIComponent(slug).replace(/%2F/gi, "/")}`,
      kind: "recruitment_page",
      label: page.title || slug
    });
  }
  return out;
}

/**
 * @returns {{ path: string, kind: string, label: string }[]}
 */
function listEditorialStaticPaths() {
  return EDITORIAL_STATIC_PATHS.map((path) => ({
    path,
    kind: "editorial_page",
    label: path === "/" ? "home" : path.replace(/^\//, "")
  }));
}

/**
 * Full expected coverage set for validation (static + hubs; topics optional).
 * @param {{ topicCategories?: Iterable<string> }} [options]
 */
function listExpectedSitemapCoverage(options = {}) {
  const topicPaths = listTopicHubPathsFromCategories(options.topicCategories || []);
  return [
    ...listEditorialStaticPaths(),
    ...listDepartmentHubPaths(),
    ...listQualificationHubPaths(),
    ...listStateHubPaths(),
    ...topicPaths
  ];
}

/**
 * Absolute URL helpers for sitemap static rows.
 * @param {string} baseUrl
 * @param {{ topicCategories?: Iterable<string> }} [options]
 */
function buildStaticSitemapEntries(baseUrl, options = {}) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  const coverage = listExpectedSitemapCoverage(options);
  return coverage.map((item) => ({
    loc: `${root}${item.path}`,
    changefreq: item.kind === "editorial_page" ? "weekly" : "daily",
    kind: item.kind,
    path: item.path
  }));
}

/**
 * Normalize a loc/path to a comparable path key (no host, trailing slash stripped).
 * @param {string} locOrPath
 * @param {string} [baseUrl]
 */
function normalizeSitemapPathKey(locOrPath, baseUrl) {
  let value = String(locOrPath || "").trim();
  if (!value) return "";
  const root = String(baseUrl || "").replace(/\/$/, "");
  if (root && value.startsWith(root)) {
    value = value.slice(root.length) || "/";
  }
  try {
    if (/^https?:\/\//i.test(value)) {
      value = new URL(value).pathname || "/";
    }
  } catch {
    // keep as path-ish
  }
  value = decodeURIComponent(value).replace(/\/+$/, "") || "/";
  if (!value.startsWith("/")) value = `/${value}`;
  return value.toLowerCase();
}

/**
 * Canonical path for a taxonomy hub kind + slug.
 * @param {"department"|"qualification"|"state"|"topic"} kind
 * @param {string} slug
 */
function canonicalHubPath(kind, slug) {
  const raw = String(slug || "").trim();
  if (!raw) return null;
  if (kind === "department") return buildDepartmentPath(raw);
  if (kind === "qualification") return buildQualificationPath(raw);
  if (kind === "state") return buildStatePath(raw);
  if (kind === "topic") {
    const topic = normalizeTopicSlug(raw) || toTaxonomyPathSlug(raw);
    return topic ? `/topic/${encodeURIComponent(topic)}` : null;
  }
  return null;
}

module.exports = {
  EDITORIAL_STATIC_PATHS,
  listDepartmentHubPaths,
  listQualificationHubPaths,
  listStateHubPaths,
  listTopicHubPathsFromCategories,
  listRecruitmentPagePaths,
  listEditorialStaticPaths,
  listExpectedSitemapCoverage,
  buildStaticSitemapEntries,
  normalizeSitemapPathKey,
  canonicalHubPath
};
