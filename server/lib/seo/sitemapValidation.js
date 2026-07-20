"use strict";

/**
 * Package 4F — Sitemap validation (advisory).
 *
 * Validates duplicate URLs, missing expected coverage, and canonical consistency.
 * Does not rewrite the sitemap.
 */

const {
  listExpectedSitemapCoverage,
  normalizeSitemapPathKey,
  canonicalHubPath
} = require("./sitemapCoverage");

/**
 * @param {string[]} locs
 * @param {string} [baseUrl]
 * @returns {{ path: string, count: number }[]}
 */
function findDuplicateUrls(locs, baseUrl) {
  const counts = new Map();
  for (const loc of locs || []) {
    const key = normalizeSitemapPathKey(loc, baseUrl);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * @param {string[]} locs
 * @param {{ topicCategories?: Iterable<string>, baseUrl?: string }} [options]
 */
function findMissingExpectedUrls(locs, options = {}) {
  const present = new Set(
    (locs || []).map((loc) => normalizeSitemapPathKey(loc, options.baseUrl)).filter(Boolean)
  );
  const expected = listExpectedSitemapCoverage({
    topicCategories: options.topicCategories
  });
  return expected
    .filter((item) => !present.has(normalizeSitemapPathKey(item.path, options.baseUrl)))
    .map((item) => ({
      path: item.path,
      kind: item.kind,
      label: item.label
    }));
}

/**
 * Check hub path forms match canonical builders.
 * @param {string[]} locs
 * @param {string} [baseUrl]
 */
function findCanonicalInconsistencies(locs, baseUrl) {
  const issues = [];
  for (const loc of locs || []) {
    const path = normalizeSitemapPathKey(loc, baseUrl);
    if (!path || path === "/") continue;

    const dept = path.match(/^\/department\/([^/]+)$/i);
    if (dept) {
      const decoded = decodeURIComponent(dept[1]);
      const canonical = canonicalHubPath("department", decoded);
      const canonKey = normalizeSitemapPathKey(canonical, baseUrl);
      if (canonical && canonKey !== path) {
        issues.push({
          path,
          expected: canonKey,
          kind: "department_hub",
          detail: "Department hub path does not match canonical builder"
        });
      }
      continue;
    }

    const qual = path.match(/^\/qualification\/([^/]+)$/i);
    if (qual) {
      const decoded = decodeURIComponent(qual[1]).replace(/-/g, " ");
      const canonical = canonicalHubPath("qualification", decoded);
      const canonKey = normalizeSitemapPathKey(canonical, baseUrl);
      if (canonical && canonKey !== path) {
        issues.push({
          path,
          expected: canonKey,
          kind: "qualification_hub",
          detail: "Qualification hub path does not match canonical builder"
        });
      }
      continue;
    }

    const state = path.match(/^\/state\/([^/]+)$/i);
    if (state) {
      const decoded = decodeURIComponent(state[1]).replace(/-/g, " ");
      const canonical = canonicalHubPath("state", decoded);
      const canonKey = normalizeSitemapPathKey(canonical, baseUrl);
      if (canonical && canonKey !== path) {
        issues.push({
          path,
          expected: canonKey,
          kind: "state_hub",
          detail: "State hub path does not match canonical builder"
        });
      }
      continue;
    }

    const topic = path.match(/^\/topic\/([^/]+)$/i);
    if (topic) {
      const decoded = decodeURIComponent(topic[1]);
      const canonical = canonicalHubPath("topic", decoded);
      const canonKey = normalizeSitemapPathKey(canonical, baseUrl);
      if (canonical && canonKey !== path) {
        issues.push({
          path,
          expected: canonKey,
          kind: "topic_hub",
          detail: "Topic hub path does not match canonical builder"
        });
      }
    }
  }
  return issues.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * @param {{ locs?: string[], topicCategories?: Iterable<string>, baseUrl?: string }} input
 */
function validateSitemapCoverage(input = {}) {
  const locs = Array.isArray(input.locs) ? input.locs : [];
  const duplicates = findDuplicateUrls(locs, input.baseUrl);
  const missing = findMissingExpectedUrls(locs, {
    topicCategories: input.topicCategories,
    baseUrl: input.baseUrl
  });
  const canonicalIssues = findCanonicalInconsistencies(locs, input.baseUrl);
  const ok = duplicates.length === 0 && missing.length === 0 && canonicalIssues.length === 0;

  return {
    advisory: true,
    ok,
    summary: {
      urlCount: locs.length,
      duplicateCount: duplicates.length,
      missingCount: missing.length,
      canonicalIssueCount: canonicalIssues.length
    },
    duplicates,
    missing,
    canonicalIssues
  };
}

module.exports = {
  findDuplicateUrls,
  findMissingExpectedUrls,
  findCanonicalInconsistencies,
  validateSitemapCoverage
};
